import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import StudentLayout from './StudentLayout';
import { studentJobsApi, type MyApplication, type MyRound } from '../../api/candidate';
import { myApplicationApi } from '../../api/applications';
import { ApiError } from '../../api/client';
import { trackerApi, type TrackedApplication } from '../../api/tracker';
import { useAuth } from '../../auth/AuthContext';
import { Stepper, Timeline, WaitingNote } from '../../components/TrackerView';
import { afterOfferApi, type RatingRow, type StudentOffer } from '../../api/afterOffer';
import { JoiningCard, RateCard } from './AfterOffer';
import { proofApi, type EnrolmentStatus, type StudentRoundSimulation } from '../../api/proof';
import { notificationApi, type Notification } from '../../api/notifications';
import GuideStrip, { cueForRound, cueForStatus } from './guides/GuideStrip';
import { useT, type MessageKey } from '../../i18n';
import './Profile.css';
import './Applications.css';

/**
 * My applications.
 *
 * One card per role they applied to, and everything about that role on it -
 * where it stands, what has changed, and anything that is theirs to do.
 *
 * The updates matter most and used to be furthest away. They were written on
 * every company move since the portal was built and the student had nowhere
 * to read them; then they sat in one pooled feed at the top of the page,
 * where "you have moved to the next round" was a sentence you had to match
 * to a job by reading it. On the card there is nothing to match: the update
 * is inside the thing it happened to.
 */

/** The three states a student sorts their own applications into. */
type Bucket = 'live' | 'offer' | 'closed';

const BUCKET: Record<string, Bucket> = {
  APPLIED: 'live',
  UNDER_REVIEW: 'live',
  SHORTLISTED: 'live',
  IN_ROUND: 'live',
  WAITLISTED: 'live',
  OFFERED: 'offer',
  ACCEPTED: 'offer',
  HIRED: 'offer',
  DECLINED: 'closed',
  REJECTED: 'closed',
  WITHDRAWN: 'closed',
};

const bucketOf = (status: string): Bucket => BUCKET[status] ?? 'live';

/** The pill colour, which is the only thing the tone has to carry. */
const STATUS_PILL: Record<string, string> = {
  APPLIED: 'pill-hold',
  UNDER_REVIEW: 'pill-hold',
  SHORTLISTED: 'pill-pass',
  IN_ROUND: 'pill-hold',
  WAITLISTED: 'pill-hold',
  OFFERED: 'pill-pass',
  ACCEPTED: 'pill-pass',
  HIRED: 'pill-pass',
  DECLINED: 'pill-stop',
  REJECTED: 'pill-stop',
  WITHDRAWN: 'pill-stop',
};

/* Typed lookups rather than an interpolated key, so a status we forget to
   translate is a compile error and not an empty pill. */
const ST: Record<string, MessageKey> = {
  APPLIED: 'app.st.APPLIED',
  UNDER_REVIEW: 'app.st.UNDER_REVIEW',
  SHORTLISTED: 'app.st.SHORTLISTED',
  IN_ROUND: 'app.st.IN_ROUND',
  WAITLISTED: 'app.st.WAITLISTED',
  OFFERED: 'app.st.OFFERED',
  ACCEPTED: 'app.st.ACCEPTED',
  HIRED: 'app.st.HIRED',
  DECLINED: 'app.st.DECLINED',
  REJECTED: 'app.st.REJECTED',
  WITHDRAWN: 'app.st.WITHDRAWN',
};

/**
 * The statuses whose sentence tells the student something the pill does not.
 *
 * "In a round" as a pill and "You are in a round." as a sentence is one fact
 * written twice, and a card that repeats itself teaches the reader to skim.
 * These five earn the line: they say what is happening behind the label, or
 * what happens next.
 */
const SD_ADDS = new Set(['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'WAITLISTED', 'OFFERED']);

const SD: Record<string, MessageKey> = {
  APPLIED: 'app.sd.APPLIED',
  UNDER_REVIEW: 'app.sd.UNDER_REVIEW',
  SHORTLISTED: 'app.sd.SHORTLISTED',
  IN_ROUND: 'app.sd.IN_ROUND',
  WAITLISTED: 'app.sd.WAITLISTED',
  OFFERED: 'app.sd.OFFERED',
  ACCEPTED: 'app.sd.ACCEPTED',
  HIRED: 'app.sd.HIRED',
  DECLINED: 'app.sd.DECLINED',
  REJECTED: 'app.sd.REJECTED',
  WITHDRAWN: 'app.sd.WITHDRAWN',
};

const SIM: Record<EnrolmentStatus, MessageKey> = {
  IN_PROGRESS: 'app.sim.IN_PROGRESS',
  NEEDS_WORK: 'app.sim.NEEDS_WORK',
  SUBMITTED: 'app.sim.SUBMITTED',
  EXPLAIN_BOOKED: 'app.sim.EXPLAIN_BOOKED',
  COMPLETED: 'app.sim.COMPLETED',
};

/** The translate function, named the same way the jobs screen names it. */
type T = ReturnType<typeof useT>['t'];

const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/**
 * How long ago, in the words somebody would use.
 *
 * An update is read to answer "is this new?", and a timestamp makes the
 * reader do the subtraction. Rough on purpose past a day: what matters then
 * is whether it was today, yesterday, or a while back.
 */
function ago(t: T, iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 2) return t('app.justNow');
  if (mins < 60) return t('app.minsAgo', { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours === 1) return t('app.hourAgo');
  if (hours < 24) return t('app.hoursAgo', { n: hours });
  const days = Math.floor(hours / 24);
  if (days === 1) return t('app.yesterday');
  return t('app.daysAgo', { n: days });
}

/** "Today", "Tomorrow", or "Thu 25 Sep" - the form the answer is needed in. */
function dayOf(t: T, at: number): string {
  const d = new Date(at);
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const days = Math.floor((d.getTime() - midnight.getTime()) / 86_400_000);
  if (days <= 0) return t('app.today');
  if (days === 1) return t('app.tomorrow');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

const timeOf = (at: number) =>
  new Date(at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

/** Apli, on the one thing that is actually about to happen. */
function apliAbout(
  t: T,
  next: { a: MyApplication; round: MyRound; at: number },
): string {
  const when = dayOf(t, next.at);
  const vars = { round: next.round.name, company: next.a.companyName };
  if (when === t('app.today')) return t('app.apliToday', vars);
  if (when === t('app.tomorrow')) return t('app.apliTomorrow', vars);
  return t('app.apliNext', { ...vars, when: `${when}, ${timeOf(next.at)}` });
}

/** Which application an update is about, when it says. */
function aboutOf(n: Notification): string | null {
  const id = n.payload?.applicationId;
  return typeof id === 'string' ? id : null;
}

export default function Applications() {
  const { t } = useT();
  const [apps, setApps] = useState<MyApplication[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const { hasModule } = useAuth();
  const tracking = hasModule('trust.tracker');
  // The tracker's view of each application, by id. Absent where the
  // institution has not switched the tracker on - the card then falls back to
  // the plain list of rounds it has always had.
  const [tracked, setTracked] = useState<Map<string, TrackedApplication>>(new Map());
  // After the offer: joining for accepted offers, a one-time rating for
  // closed ones. Each only where the institution has that feature on.
  const protecting = hasModule('trust.offerProtection');
  const rating = hasModule('trust.reputation');
  const [offers, setOffers] = useState<Map<string, StudentOffer>>(new Map());
  const [ratings, setRatings] = useState<Map<string, RatingRow>>(new Map());
  // Applications sitting at a work-simulation round. Not behind a module: the
  // company made it a round, so the student has to be able to do it.
  const [roundSims, setRoundSims] = useState<Map<string, StudentRoundSimulation>>(new Map());
  /** What the company's moves wrote, to be shown on the card each is about. */
  const [news, setNews] = useState<Notification[]>([]);
  const navigate = useNavigate();

  const [tile, setTile] = useState<'all' | Bucket | 'needs'>('all');
  /** The application open in the side panel. */
  const [openId, setOpenId] = useState<string | null>(null);
  const closePanel = useCallback(() => setOpenId(null), []);

  const load = useCallback(() => {
    studentJobsApi
      .applications()
      .then(setApps)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : t('app.loadError')),
      );
    notificationApi
      .applicationUpdates()
      .then(setNews)
      .catch(() => setNews([]));
    proofApi
      .roundsMine()
      .then((list) => setRoundSims(new Map(list.map((r) => [r.applicationId, r]))))
      .catch(() => setRoundSims(new Map()));
    if (tracking) {
      trackerApi
        .mine()
        .then((list) => setTracked(new Map(list.map((a) => [a.id, a]))))
        .catch(() => setTracked(new Map()));
    }
    if (protecting) {
      afterOfferApi
        .studentOffers()
        .then((list) => setOffers(new Map(list.map((o) => [o.applicationId, o]))))
        .catch(() => setOffers(new Map()));
    }
    if (rating) {
      afterOfferApi
        .studentRatings()
        .then((list) => setRatings(new Map(list.map((r) => [r.applicationId, r]))))
        .catch(() => setRatings(new Map()));
    }
  }, [t, tracking, protecting, rating]);

  useEffect(() => {
    load();
  }, [load]);

  /** Every update, filed under the application it is about. */
  const newsFor = useMemo(() => {
    const by = new Map<string, Notification[]>();
    for (const n of news) {
      const about = aboutOf(n);
      if (!about) continue;
      if (!by.has(about)) by.set(about, []);
      by.get(about)!.push(n);
    }
    return by;
  }, [news]);

  async function readEverything() {
    const ids = news.filter((n) => !n.readAt).map((n) => n.id);
    if (ids.length === 0) return;
    await notificationApi.markRead(ids).catch(() => undefined);
    const now = new Date().toISOString();
    setNews((prev) => prev.map((x) => (x.readAt ? x : { ...x, readAt: now })));
  }

  async function readOne(id: string) {
    await notificationApi.markRead([id]).catch(() => undefined);
    setNews((prev) =>
      prev.map((x) => (x.id === id ? { ...x, readAt: new Date().toISOString() } : x)),
    );
  }

  /**
   * Is this one waiting on the student rather than on the company?
   *
   * The page turns on this: an offer they have not answered, or a work
   * simulation they can open. Everything else is somebody else's move, and
   * saying so is what stops the page reading as a pile of homework.
   */
  const needsMe = useCallback(
    (a: MyApplication) => {
      if (a.status === 'OFFERED') return true;
      const sim = roundSims.get(a.id);
      return Boolean(sim && (sim.enrolment || sim.canStart));
    },
    [roundSims],
  );

  const counts = useMemo(() => {
    const list = apps ?? [];
    return {
      all: list.length,
      live: list.filter((a) => bucketOf(a.status) === 'live').length,
      offer: list.filter((a) => bucketOf(a.status) === 'offer').length,
      closed: list.filter((a) => bucketOf(a.status) === 'closed').length,
      needs: list.filter(needsMe).length,
    };
  }, [apps, needsMe]);

  const shown = useMemo(() => {
    const unreadOn = (a: MyApplication) =>
      (newsFor.get(a.id) ?? []).some((n) => !n.readAt) ? 1 : 0;

    return (apps ?? [])
      .filter((a) => {
        if (tile === 'needs' && !needsMe(a)) return false;
        if (tile !== 'all' && tile !== 'needs' && bucketOf(a.status) !== tile) return false;
        return true;
      })
      .sort(
        (x, y) =>
          // Unread first, then anything waiting on them, then whatever moved
          // most recently - which is the order they would ask in.
          unreadOn(y) - unreadOn(x) ||
          Number(needsMe(y)) - Number(needsMe(x)) ||
          y.lastEventAt.localeCompare(x.lastEventAt),
      );
  }, [apps, tile, needsMe, newsFor]);

  async function startRound(applicationId: string) {
    setBusy(true);
    setError(null);
    try {
      const { simulationId } = await proofApi.startRound(applicationId);
      navigate(`/student/projects?id=${simulationId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('app.simError'));
      setBusy(false);
    }
  }

  async function act(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setFlash(message);
      window.setTimeout(() => setFlash(null), 4000);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('app.error'));
    } finally {
      setBusy(false);
    }
  }

  /** One true thing about the page as a whole, drawn from their own record. */
  function apliSays(): { mood: 'hello' | 'cheer' | 'nudge' | 'think'; says: string } {
    if (counts.needs > 0)
      return {
        mood: 'nudge',
        says: counts.needs === 1 ? t('app.apliNeedsOne') : t('app.apliNeeds', { n: counts.needs }),
      };
    if (counts.offer > 0) return { mood: 'cheer', says: t('app.apliOffer') };
    if (counts.live > 0)
      return {
        mood: 'hello',
        says: counts.live === 1 ? t('app.apliLiveOne') : t('app.apliLive', { n: counts.live }),
      };
    return { mood: 'think', says: t('app.apliQuiet') };
  }

  const TILES = [
    ['all', t('app.tileAll'), t('app.tileAllHint'), counts.all],
    ['live', t('app.tileLive'), t('app.tileLiveHint'), counts.live],
    ['offer', t('app.tileOffers'), t('app.tileOffersHint'), counts.offer],
    ['closed', t('app.tileClosed'), t('app.tileClosedHint'), counts.closed],
  ] as const;

  /**
   * What is actually about to happen.
   *
   * Only rounds they have been called to: a date on a round further down the
   * process is not theirs yet, and printing it as "coming up" would be a
   * promise nobody made. Sorted by when, which is the one order this page
   * never had and the only one that matters on a Wednesday night.
   */
  const comingUp = useMemo(() => {
    const now = Date.now();
    return (apps ?? [])
      .filter((a) => a.status === 'IN_ROUND')
      .map((a) => {
        const round = a.rounds.find((r) => r.id === a.currentRound?.id);
        return round?.scheduledAt ? { a, round, at: new Date(round.scheduledAt).getTime() } : null;
      })
      .filter((x): x is { a: MyApplication; round: MyRound; at: number } => x !== null)
      .filter((x) => x.at > now)
      .sort((x, y) => x.at - y.at);
  }, [apps]);

  const said = apliSays();
  const unreadTotal = news.filter((n) => !n.readAt).length;

  return (
    <StudentLayout>
      <div className="ap">
        {/*
          One compact head: the title and a line saying what this is on the
          left, the filters on the right. The cards are the page; nothing
          above them should take more room than it has to.
        */}
        <header className="ap-head">
          <div className="ap-head-left">
            <h1>
              {t('app.title')}
              {unreadTotal > 0 && (
                <span className="ap-head-new">{t('app.newsNew', { n: unreadTotal })}</span>
              )}
            </h1>
            <p className="ap-lede">{t('app.lede')}</p>
          </div>

          {apps && apps.length > 0 && (
            <div className="ap-pills" role="tablist" aria-label={t('app.title')}>
              {counts.needs > 0 && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={tile === 'needs'}
                  className={`ap-pill is-hot ${tile === 'needs' ? 'is-current' : ''}`}
                  onClick={() => setTile('needs')}
                >
                  {t('app.tileNeeds')} <b>{counts.needs}</b>
                </button>
              )}
              {TILES.map(([key, label, , n]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tile === key}
                  className={`ap-pill ${tile === key ? 'is-current' : ''}`}
                  onClick={() => setTile(key)}
                >
                  {label} <b>{n}</b>
                </button>
              ))}
              {unreadTotal > 0 && (
                <button type="button" className="ap-read-all" onClick={readEverything}>
                  {t('app.markAllRead')}
                </button>
              )}
            </div>
          )}
        </header>

        {error && <p className="alert alert-error">{error}</p>}
        {flash && <p className="alert alert-ok">{flash}</p>}
        {apps === null && !error && <p className="muted">{t('common.loading')}</p>}

        {apps && apps.length > 0 && (
          <>
            {/* Only when there is something to act on or a date to keep:
                an interview coming up, or something waiting on the student.
                "Nothing needs you" is what the counts already say. */}
            {(comingUp.length > 0 || counts.needs > 0) && (
              <section className={`ap-next ${comingUp.length > 0 ? 'has-dates' : ''}`}>
                <p className="ap-apli">
                  <span className="ap-apli-dot" aria-hidden="true" />
                  <span>{comingUp.length > 0 ? apliAbout(t, comingUp[0]!) : said.says}</span>
                </p>

                {comingUp.length > 0 && (
                  <ul className="ap-next-list">
                    {comingUp.slice(0, 3).map(({ a, round, at }) => (
                      <li key={a.id}>
                        <button type="button" onClick={() => setOpenId(a.id)}>
                          <time dateTime={round.scheduledAt!}>{dayOf(t, at)}</time>
                          <span className="ap-next-what">
                            <b>{round.name}</b>
                            <small>
                              {a.companyName} · {round.isOnline ? t('app.online') : t('app.inPerson')}
                            </small>
                          </span>
                          <span className="ap-next-time">{timeOf(at)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {shown.length === 0 ? (
              <div className="ap-none">
                <p>{t('app.noneMatch')}</p>
                <p className="muted">{t('app.noneMatchBody')}</p>
              </div>
            ) : (
              <ul className="ap-board">
                {shown.map((a) => (
                  <Card
                    key={a.id}
                    a={a}
                    updates={newsFor.get(a.id) ?? []}
                    tracked={tracked.get(a.id)}
                    mine={needsMe(a)}
                    onOpen={() => setOpenId(a.id)}
                  />
                ))}
              </ul>
            )}

            {openId &&
              (() => {
                const a = (apps ?? []).find((x) => x.id === openId);
                if (!a) return null;
                return (
                  <Panel title={a.title} subtitle={`${a.companyName} · ${a.placementName}`} onClose={closePanel}>
                    <Detail
                      a={a}
                      updates={newsFor.get(a.id) ?? []}
                      tracked={tracked.get(a.id)}
                      sim={roundSims.get(a.id)}
                      offer={offers.get(a.id)}
                      rated={ratings.get(a.id)}
                      busy={busy}
                      onRead={readOne}
                      onStartRound={startRound}
                      onOpenSim={(id) => navigate(`/student/projects?id=${id}`)}
                      onAct={act}
                      onChanged={load}
                    />
                  </Panel>
                );
              })()}
          </>
        )}

        {apps?.length === 0 && (
          <div className="ap-empty">
            <h2>{t('app.emptyTitle')}</h2>
            <p>{t('app.emptyBody')}</p>
            <Link className="btn btn-primary" to="/student/jobs">
              {t('app.emptyGo')}
            </Link>
          </div>
        )}
      </div>
    </StudentLayout>
  );
}

/** A date and a time, written the way somebody would read it off a notice. */
function whenOf(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) +
    ', ' +
    d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
  );
}

/**
 * Where to be, and when.
 *
 * Only ever rendered for a round the student has actually been called to.
 * Until then the company may not have booked a hall, and a half-filled
 * "venue: to be confirmed" is worse than the sentence that says so.
 */
function WhenWhere({ round }: { round: MyRound }) {
  const { t } = useT();

  return (
    <section className="ap-where">
      <h3>{t('app.whenWhere')}</h3>

      <p className="ap-where-when">
        <b>{round.name}</b>
        <span className={`ap-mode ${round.isOnline ? 'is-online' : ''}`}>
          {round.isOnline ? t('app.online') : t('app.inPerson')}
        </span>
      </p>

      <p className="ap-where-date">
        {round.scheduledAt ? whenOf(round.scheduledAt) : t('app.noDate')}
        {round.durationMin ? ` · ${t('app.mins', { n: round.durationMin })}` : ''}
        {round.isElimination ? ` · ${t('app.eliminates')}` : ''}
      </p>

      {/* A link to open, for a round they do not attend. */}
      {round.isOnline && round.meetingLink && (
        <a className="ap-where-go" href={round.meetingLink} target="_blank" rel="noreferrer">
          {t('app.joinLink')}
        </a>
      )}

      {/* Somewhere to be, for one they do. */}
      {!round.isOnline && (round.venue || round.addressLine) && (
        <p className="ap-where-at">
          {[round.venue, round.addressLine].filter(Boolean).join(' · ')}
        </p>
      )}

      {/* The map itself, because a student finding a campus they have never
          been to at 9am does not want an address to retype. */}
      {!round.isOnline && round.mapEmbedUrl && (
        <iframe
          className="ap-map"
          src={round.mapEmbedUrl}
          title={`${round.name} — map`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      )}

      {!round.isOnline && round.mapsLink && (
        <a className="ap-where-go" href={round.mapsLink} target="_blank" rel="noreferrer">
          {t('app.openMap')}
        </a>
      )}
    </section>
  );
}

/**
 * One application on the board.
 *
 * The card answers what a student scans for: which role, where it stands,
 * and whether anything new has happened. The track along the middle is the
 * process drawn - applied, each round, the offer - with the student's place
 * on it. Everything else is one click away, in the side panel.
 */
function Card({
  a,
  updates,
  tracked,
  mine,
  onOpen,
}: {
  a: MyApplication;
  updates: Notification[];
  tracked?: TrackedApplication;
  mine: boolean;
  onOpen: () => void;
}) {
  const { t } = useT();
  const bucket = bucketOf(a.status);
  const rounds = tracked?.rounds ?? a.rounds;
  const unread = updates.filter((n) => !n.readAt).length;
  const latest = updates[0];
  const quiet = daysSince(a.lastEventAt);

  /* The track: applied, each round, the offer. */
  const stops = [t('app.st.APPLIED'), ...rounds.map((r) => r.name), t('app.tileOffers')];
  const reached =
    bucket === 'offer'
      ? stops.length - 1
      : a.status === 'IN_ROUND' || a.status === 'SHORTLISTED' || a.status === 'WAITLISTED'
        ? Math.max(1, a.currentRound?.order ?? 1)
        : 0;

  return (
    <li className={`ap-card is-${bucket} ${mine ? 'is-mine' : ''} ${unread > 0 ? 'is-unread' : ''}`}>
      <button type="button" className="ap-card-hit" onClick={onOpen} aria-label={`${a.title}, ${a.companyName}`}>
        <span className="ap-card-top">
          <span className="ap-mark" aria-hidden="true">
            {a.companyName.slice(0, 2).toUpperCase()}
          </span>
          <span className="ap-card-who">
            <b>{a.title}</b>
            <small>{a.companyName}</small>
          </span>
          <span className={`ap-status is-${a.status.toLowerCase()}`}>
            {ST[a.status] ? t(ST[a.status]!) : a.status}
          </span>
        </span>

        {bucket !== 'closed' && (
          <span className="ap-track" aria-hidden="true">
            {stops.map((name, i) => (
              <span
                key={i}
                className={`ap-stop ${i < reached ? 'is-done' : ''} ${i === reached ? 'is-here' : ''}`}
                title={name}
              >
                <i />
              </span>
            ))}
          </span>
        )}
        {bucket !== 'closed' && (
          <span className="ap-track-label">
            {reached === 0
              ? t('app.st.APPLIED')
              : reached >= stops.length - 1
                ? stops[stops.length - 1]
                : stops[reached]}
            <small>
              {' · '}
              {Math.min(reached + 1, stops.length)} / {stops.length}
            </small>
          </span>
        )}

        <span className="ap-card-news">
          {unread > 0 && <span className="ap-dot" aria-hidden="true" />}
          {latest ? (
            <>
              <b>{latest.title}</b>
              <small>{ago(t, latest.createdAt)}</small>
            </>
          ) : SD[a.status] ? (
            <span>{t(SD[a.status]!)}</span>
          ) : null}
        </span>

        <span className="ap-card-foot">
          <small>
            {t('app.appliedOn', { date: shortDate(a.appliedAt) })}
            {' · '}
            {quiet <= 0 ? t('app.movedToday') : quiet === 1 ? t('app.quietOne') : t('app.quietDays', { n: quiet })}
          </small>
          {mine ? (
            <span className="ap-card-cta">
              {a.status === 'OFFERED' ? t('app.accept') + ' / ' + t('app.decline') : t('app.needsYouFlag')} →
            </span>
          ) : (
            <span className="ap-card-more">Details →</span>
          )}
        </span>
      </button>
    </li>
  );
}

/** A panel that slides in from the right. Escape or the backdrop closes it. */
function Panel({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    box.current?.focus();
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = before;
    };
  }, [onClose]);

  return (
    <div className="ap-panel-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ap-panel" role="dialog" aria-modal="true" aria-labelledby="ap-panel-title" tabIndex={-1} ref={box}>
        <header className="ap-panel-head">
          <div>
            <h2 id="ap-panel-title">{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button type="button" className="ap-panel-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="ap-panel-body">{children}</div>
      </div>
    </div>
  );
}

/**
 * Everything about one application, in the side panel: its updates, where to
 * be and when, anything that is the student's to do, and its history.
 *
 * (Formerly the body of a row that opened in place.)
 *
 * Closed, it answers the three questions a student scanning the list has:
 * which role, where it stands, and whether anything has happened. Open, it is
 * everything about that application - every update, where to be and when,
 * anything theirs to do, and the history underneath.
 *
 * The count on the right is the point of the row. A student does not scan
 * this page reading statuses; they scan it looking for the one that has
 * changed, and a number they can see without opening anything is the fastest
 * way to find it.
 */
function Detail({
  a,
  updates,
  tracked,
  sim,
  offer,
  rated,
  busy,
  onRead,
  onStartRound,
  onOpenSim,
  onAct,
  onChanged,
}: {
  a: MyApplication;
  updates: Notification[];
  tracked?: TrackedApplication;
  sim?: StudentRoundSimulation;
  offer?: StudentOffer;
  rated?: RatingRow;
  busy: boolean;
  onRead: (id: string) => void;
  onStartRound: (id: string) => void;
  onOpenSim: (simulationId: string) => void;
  onAct: (fn: () => Promise<unknown>, message: string) => void;
  onChanged: () => void;
}) {
  const { t } = useT();

  const bucket = bucketOf(a.status);
  const currentOrder = a.currentRound?.order ?? 0;
  const rounds = tracked?.rounds ?? a.rounds;
  const at = Math.max(currentOrder, 1);
  const quiet = daysSince(a.lastEventAt);
  const unread = updates.filter((n) => !n.readAt).length;
  const here = a.rounds.find((r) => r.id === a.currentRound?.id) ?? null;
  const mine = a.status === 'OFFERED' || Boolean(sim && (sim.enrolment || sim.canStart));

  /*
   * Everything starts shut except what is waiting on the student. An accept
   * button behind a click somebody has to think to make is a missed offer,
   * and no amount of tidiness is worth that.
   */
  const [history, setHistory] = useState(true);

  return (
    <div className={`ap-detail is-${bucket}`}>
      <p className="ap-detail-status">
        <span className={`ap-status is-${a.status.toLowerCase()}`}>
          {ST[a.status] ? t(ST[a.status]!) : a.status}
        </span>
        {bucket !== 'closed' && rounds.length > 0 && (
          <span className="ap-detail-far">{t('app.roundOf', { n: at, of: rounds.length })}</span>
        )}
        {unread > 0 && <span className="ap-detail-new">{t('app.newsNew', { n: unread })}</span>}
      </p>
      {(
        <div className="ap-row-body">
          {/* The status as a sentence, but only where it says more than the
              pill above it already did. */}
          {SD_ADDS.has(a.status) && SD[a.status] && (
            <p className={`ap-said is-${bucket}`}>{t(SD[a.status]!)}</p>
          )}

          {/*
            What has changed, on the thing it changed. In a pooled feed "you
            have moved to the next round" is a sentence you have to match to a
            job by reading it; here there is nothing to match.
          */}
          {updates.length > 0 && (
            <section className="ap-news">
              <h3>{t('app.updates')}</h3>
              <ul>
                {updates.map((n) => (
                  <li key={n.id} className={n.readAt ? '' : 'is-new'}>
                    <b>{n.title}</b>
                    {n.body && <span>{n.body}</span>}
                    <span className="ap-news-foot">
                      <time dateTime={n.createdAt}>{ago(t, n.createdAt)}</time>
                      {!n.readAt && (
                        <button type="button" className="link-btn" onClick={() => onRead(n.id)}>
                          {t('app.readOne')}
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Where to be, once they have actually been called to a round. */}
          {a.status === 'IN_ROUND' && here && <WhenWhere round={here} />}

          {/*
            One guide, about the round that is actually next. The index of
            guides is a place a worried student has to think to visit; this is
            a place they already are, which is why the guides are handed over
            here rather than waiting to be found.
          */}
          {bucket === 'live' && (
            <GuideStrip cue={cueForRound(a.rounds.find((r) => r.order === at)?.type)} />
          )}

          {/* Anything that is theirs to do. */}
          {sim && (
            <div className="ap-todo">
              <p className="ap-todo-title">{t('app.simTitle', { title: sim.simulation.title })}</p>
              <p className="muted">
                {sim.simulation.estimatedHours === 1
                  ? t('app.simHour')
                  : t('app.simHours', { n: sim.simulation.estimatedHours })}
                {sim.enrolment && (
                  <>
                    {' · '}
                    {t(SIM[sim.enrolment.status])}
                    {sim.enrolment.status === 'EXPLAIN_BOOKED' &&
                      sim.enrolment.explainAt &&
                      ` · ${new Date(sim.enrolment.explainAt).toLocaleString()}`}
                    {sim.enrolment.certificateCode && ` · ${sim.enrolment.certificateCode}`}
                  </>
                )}
              </p>
              {sim.enrolment || sim.canStart ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() =>
                    sim.enrolment ? onOpenSim(sim.simulation.id) : onStartRound(a.id)
                  }
                >
                  {sim.enrolment ? t('app.simOpen') : t('app.simStart')}
                </button>
              ) : (
                <p className="muted">{t('app.simGone')}</p>
              )}
            </div>
          )}

          {a.status === 'OFFERED' && (
            <div className="ap-todo is-offer">
              <p className="ap-todo-title">{t('app.offerTitle', { company: a.companyName })}</p>
              <p className="muted">{t('app.offerBody', { placement: a.placementName })}</p>

              {/* Read before you answer: accepting usually closes the season. */}
              <GuideStrip cue={cueForStatus('OFFERED')} />

              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() =>
                    onAct(
                      () => myApplicationApi.respond(a.id, 'ACCEPT'),
                      t('app.accepted', { company: a.companyName }),
                    )
                  }
                >
                  {t('app.accept')}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() =>
                    onAct(() => myApplicationApi.respond(a.id, 'DECLINE'), t('app.declined'))
                  }
                >
                  {t('app.decline')}
                </button>
              </div>
            </div>
          )}

          {offer && <JoiningCard offer={offer} onChanged={onChanged} />}
          {rated && <RateCard row={rated} onRated={onChanged} />}

          <footer className="ap-row-foot">
            <span className="ap-when">
              {t('app.appliedOn', { date: shortDate(a.appliedAt) })}
              {' · '}
              {quiet <= 0
                ? t('app.movedToday')
                : quiet === 1
                  ? t('app.quietOne')
                  : t('app.quietDays', { n: quiet })}
            </span>

            {/* Quiet, but not hidden: a way to end something should never sit
                behind a disclosure labelled about something else. */}
            {['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'IN_ROUND', 'WAITLISTED'].includes(
              a.status,
            ) && (
              <button
                type="button"
                className="link-btn is-danger ap-withdraw"
                disabled={busy}
                onClick={() => onAct(() => myApplicationApi.withdraw(a.id), t('app.withdrawn'))}
              >
                {t('app.withdraw')}
              </button>
            )}

            <button
              type="button"
              className="link-btn ap-open"
              onClick={() => setHistory((v) => !v)}
            >
              {history ? t('app.hideHistory') : t('app.showHistory')}
            </button>
          </footer>

          {history && (
            <div className="ap-more">
              {tracked ? (
                <>
                  <Stepper rounds={tracked.rounds} />
                  <WaitingNote waiting={tracked.waiting} company={tracked.company.name} />
                  <Timeline entries={tracked.timeline} />
                </>
              ) : a.rounds.length > 0 ? (
                <ol className="tracker">
                  {a.rounds.map((r) => {
                    const state =
                      r.order < currentOrder ? 'done' : r.order === currentOrder ? 'now' : 'todo';
                    return (
                      <li key={r.id} className={`tracker-step is-${state}`}>
                        <span className="tracker-dot" aria-hidden="true" />
                        <span className="tracker-label">{r.name}</span>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="muted">{t('app.roundsNone')}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
