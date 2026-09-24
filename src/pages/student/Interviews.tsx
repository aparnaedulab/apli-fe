import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from './StudentLayout';
import { studentJobsApi, type MyApplication, type MyRound } from '../../api/candidate';
import { ApiError } from '../../api/client';
import { ApliFace } from './Apli';
import { useT } from '../../i18n';
import './Interviews.css';

/**
 * Interviews.
 *
 * Only rounds a company has actually called the student to. A date sitting on
 * round four of a process they are two rounds into is not their appointment -
 * it is the company's plan - and printing it here as though it were theirs
 * would have them preparing for a day nobody has promised them.
 *
 * So the page is short on purpose, and everything on it is something they
 * have to turn up to. What is next is the whole point, and it is at the top
 * at full size; what has already happened is underneath, small, because it is
 * a record rather than a thing to do.
 */

type T = ReturnType<typeof useT>['t'];

/** One round, paired with the application it belongs to. */
interface Sitting {
  a: MyApplication;
  round: MyRound;
  at: number | null;
}

const DAY = 86_400_000;

/** Whole days from today to then; negative once it is past. */
function daysOff(at: number): number {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  return Math.floor((at - midnight.getTime()) / DAY);
}

function dayOf(t: T, at: number): string {
  const d = daysOff(at);
  if (d === 0) return t('app.today');
  if (d === 1) return t('app.tomorrow');
  return new Date(at).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

const timeOf = (at: number) =>
  new Date(at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

export default function Interviews() {
  const { t } = useT();
  const [apps, setApps] = useState<MyApplication[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    studentJobsApi
      .applications()
      .then(setApps)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : t('app.loadError')),
      );
  }, [t]);

  /**
   * Everything they have been called to, split by whether it has happened.
   *
   * A round only counts once the company has moved them into it: that is the
   * act that releases its date and its place, and it is the only honest
   * signal that the student is expected somewhere.
   */
  const { next, past } = useMemo(() => {
    const now = Date.now();
    const called: Sitting[] = [];

    for (const a of (apps ?? []).filter((x) => x.status === 'IN_ROUND' || x.currentRound)) {
      const current = a.currentRound?.order ?? 0;
      for (const round of a.rounds) {
        // Rounds after the one they are in have not been offered to them.
        if (round.order > current) continue;
        called.push({
          a,
          round,
          at: round.scheduledAt ? new Date(round.scheduledAt).getTime() : null,
        });
      }
    }

    const next = called
      .filter((s) => s.at === null || s.at >= now)
      // A round with no date yet still belongs at the top: it is the one they
      // are waiting on, and saying so is better than leaving it off.
      .sort((x, y) => (x.at ?? Infinity) - (y.at ?? Infinity));

    const past = called
      .filter((s): s is Sitting & { at: number } => s.at !== null && s.at < now)
      .sort((x, y) => y.at - x.at);

    return { next, past };
  }, [apps]);

  /** One true thing about the nearest appointment. */
  function apliSays(): string {
    const soon = next.find((s) => s.at !== null);
    if (!soon?.at) return t('iv.apliNone');
    const d = daysOff(soon.at);
    if (d <= 0) return t('iv.apliToday');
    if (d === 1) return t('iv.apliTomorrow');
    return t('iv.apliSoon', { n: d });
  }

  return (
    <StudentLayout>
      <div className="iv">
        <header className="iv-head">
          <h1>{t('iv.title')}</h1>
          <p>{t('iv.lede')}</p>
        </header>

        {error && <p className="alert alert-error">{error}</p>}
        {apps === null && !error && <p className="muted">{t('common.loading')}</p>}

        {apps !== null && next.length === 0 && past.length === 0 && (
          <div className="iv-empty">
            <ApliFace mood="think" size={54} />
            <h2>{t('iv.emptyTitle')}</h2>
            <p>{t('iv.emptyBody')}</p>
            <Link className="btn btn-primary" to="/student/applications">
              {t('iv.emptyGo')}
            </Link>
          </div>
        )}

        {next.length > 0 && (
          <>
            <p className="iv-apli">
              <ApliFace mood="cheer" size={34} />
              <span>{apliSays()}</span>
            </p>

            <h2 className="iv-band">{t('iv.next')}</h2>
            <div className="iv-list">
              {next.map((s) => (
                <Sitting key={`${s.a.id}-${s.round.id}`} s={s} />
              ))}
            </div>
          </>
        )}

        {past.length > 0 && (
          <>
            <h2 className="iv-band">{t('iv.earlier')}</h2>
            <ul className="iv-past">
              {past.map((s) => (
                <li key={`${s.a.id}-${s.round.id}`}>
                  <time dateTime={s.round.scheduledAt ?? undefined}>
                    {new Date(s.at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </time>
                  <span>
                    <b>{s.round.name}</b>
                    <small>
                      {s.a.companyName} · {s.a.title}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </StudentLayout>
  );
}

/**
 * One appointment, at the size of something you have to turn up to.
 *
 * The date and the time are the largest thing on it, because that is what a
 * student came to check, and everything else on the card is what they need in
 * order to be there.
 */
function Sitting({ s }: { s: Sitting }) {
  const { t } = useT();
  const { a, round, at } = s;
  const left = a.rounds.length - round.order;

  return (
    <article className={`iv-card ${at !== null && daysOff(at) <= 1 ? 'is-soon' : ''}`}>
      <div className="iv-when">
        {at === null ? (
          <b className="iv-tbc">{t('iv.tbc')}</b>
        ) : (
          <>
            <b>{dayOf(t, at)}</b>
            <span>{timeOf(at)}</span>
            {round.durationMin && <small>{t('app.mins', { n: round.durationMin })}</small>}
          </>
        )}
      </div>

      <div className="iv-what">
        <h3>{round.name}</h3>
        <p className="iv-role">
          <Link to={`/student/jobs/${a.jobId}`}>{a.title}</Link> · {a.companyName}
        </p>

        <p className="iv-tags">
          <span className={`iv-mode ${round.isOnline ? 'is-online' : ''}`}>
            {round.isOnline ? t('app.online') : t('app.inPerson')}
          </span>
          <span className="iv-of">
            {t('iv.roundOf', { n: round.order, of: a.rounds.length })}
          </span>
          {/* What is still ahead, so a student can pace themselves rather
              than treat every round as the last hurdle. */}
          <span className="iv-left">
            {left === 0
              ? t('iv.lastOne')
              : left === 1
                ? t('iv.oneLeft')
                : t('iv.manyLeft', { n: left })}
          </span>
        </p>

        {/* Where to be, or what to open. Never usefully both. */}
        {round.isOnline
          ? round.meetingLink && (
              <a className="iv-go" href={round.meetingLink} target="_blank" rel="noreferrer">
                {t('app.joinLink')}
              </a>
            )
          : (round.venue || round.addressLine) && (
              <p className="iv-at">{[round.venue, round.addressLine].filter(Boolean).join(' · ')}</p>
            )}

        {!round.isOnline && round.mapEmbedUrl && (
          <iframe
            className="iv-map"
            src={round.mapEmbedUrl}
            title={`${round.name} — map`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        )}

        {!round.isOnline && round.mapsLink && (
          <a className="iv-go" href={round.mapsLink} target="_blank" rel="noreferrer">
            {t('app.openMap')}
          </a>
        )}

        <Link className="iv-app" to="/student/applications">
          {t('iv.openApp')}
        </Link>
      </div>
    </article>
  );
}
