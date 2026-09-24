import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import StudentLayout from './StudentLayout';
import {
  candidateApi,
  studentJobsApi,
  type JobCard,
  type OfferCard,
  type Profile,
  type SavedResume,
  type StudentJobDetail,
} from '../../api/candidate';
import {
  ACCOMMODATION_LABELS,
  CTC_INCLUDE_LABELS,
  OFFER_CONDITION_LABELS,
  PWD_LABELS,
  SHIFT_LABELS,
  TRAVEL_LABELS,
} from '../../api/jobs';
import { ApiError } from '../../api/client';
import { REPORT_REASONS, trustApi, type NotEligibleRole, type ReportReason } from '../../api/trust';
import GuideStrip from './guides/GuideStrip';
import { useAuth } from '../../auth/AuthContext';
import FeeWarning from '../../components/FeeWarning';
import './Profile.css';
import './Jobs.css';
import MapEmbed from '../../components/MapEmbed';
import { useT, type MessageKey } from '../../i18n';
import { en } from '../../i18n/en';

type T = ReturnType<typeof useT>['t'];

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const lakhs = (n: number) => `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)}L`;

/** A round type's name in the reader's language; an unknown type shows as it is. */
function roundLabel(t: T, type: string): string {
  const key = `round.${type}` as MessageKey;
  return key in en ? t(key) : type;
}

/**
 * The pay, shown the way the company quoted it.
 *
 * Stored per year whatever was typed, because a placement report has to add
 * these up - but a role advertised at "₹30,000 a month" reads as nonsense
 * converted to lakhs, so it is put back the way it was written.
 */
function ctc(t: T, min: string | null, max: string | null, period: string = 'YEARLY'): string {
  if (period === 'MONTHLY') {
    const m = (v: string) => `₹${Math.round(Number(v) / 12).toLocaleString('en-IN')}`;
    if (min && max) return t('pay.rangeMonth', { min: m(min), max: m(max) });
    if (min) return t('pay.fromMonth', { amount: m(min) });
    if (max) return t('pay.upToMonth', { amount: m(max) });
    return t('common.notStated');
  }

  const l = (v: string) => `${(Number(v) / 100000).toFixed(1)}L`;
  if (min && max) return t('pay.range', { min: `₹${l(min)}`, max: l(max) });
  if (min) return t('pay.from', { amount: `₹${l(min)}` });
  if (max) return t('pay.upTo', { amount: `₹${l(max)}` });
  return t('common.notStated');
}

/** How a student wants the list ordered. */
type Sort = 'match' | 'deadline' | 'newest' | 'pay';

interface Filters {
  q: string;
  kind: 'all' | 'fulltime' | 'internship';
  place: string;
  /** Days since it was posted; 0 means do not filter on it. */
  posted: number;
  closingSoon: boolean;
}

const EMPTY: Filters = { q: '', kind: 'all', place: '', posted: 0, closingSoon: false };

const daysTo = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

/** Days since something happened, rounded down. */
const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

/**
 * "Posted today", "3 days ago".
 *
 * Rough on purpose: a student is judging how picked-over a role is, and
 * "posted 2 days ago" answers that where a date they have to subtract from
 * today does not.
 */
function posted(t: T, iso: string | null): string | null {
  if (!iso) return null;
  const d = daysSince(iso);
  if (d <= 0) return t('jobs.postedToday');
  if (d === 1) return t('jobs.postedYesterday');
  if (d < 30) return t('jobs.postedDays', { n: d });
  return t('jobs.postedMonths', { n: Math.floor(d / 30) });
}

/** The biggest figure a role quotes, for sorting by pay. */
const payOf = (j: JobCard) => Number(j.ctcMax ?? j.ctcMin ?? 0);

/**
 * Jobs: the list on the left, the role on the right.
 *
 * A student browsing roles is comparing, not reading one thing - and the old
 * shape made them leave the list to look at anything, then come back and
 * find their place again. Side by side, choosing a role costs nothing, so
 * they actually read more than the two whose titles happened to appeal.
 *
 * The list stays narrow and each row says only what a comparison needs: who,
 * where, how fresh, how long left, and whether they are already in it.
 * Everything else is in the pane.
 */
export function StudentJobs() {
  const { hasModule } = useAuth();
  const { t } = useT();
  const [jobs, setJobs] = useState<JobCard[] | null>(null);
  const [canApply, setCanApply] = useState(true);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [f, setF] = useState<Filters>(EMPTY);
  const [sort, setSort] = useState<Sort>('match');
  const [tab, setTab] = useState<'all' | 'open' | 'applied'>('all');
  /** Which role the pane is showing. */
  const [picked, setPicked] = useState<string | null>(null);

  const load = useCallback(() => {
    studentJobsApi
      .list()
      .then((r) => {
        setJobs(r.jobs);
        setCanApply(r.canApply);
        setBlocked(r.blockedReason);
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : t('jobs.loadError')),
      );
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  /* The places actually on offer, rather than a list of every city. */
  const places = useMemo(
    () => [...new Set((jobs ?? []).map((j) => j.location).filter(Boolean) as string[])].sort(),
    [jobs],
  );

  const shown = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    const out = (jobs ?? []).filter((j) => {
      if (tab === 'open' && j.applicationStatus) return false;
      if (tab === 'applied' && !j.applicationStatus) return false;
      if (f.kind === 'internship' && !j.jobType.startsWith('INTERNSHIP')) return false;
      if (f.kind === 'fulltime' && j.jobType.startsWith('INTERNSHIP')) return false;
      if (f.place && j.location !== f.place) return false;
      if (f.posted > 0 && (!j.postedAt || daysSince(j.postedAt) > f.posted)) return false;
      if (f.closingSoon && daysTo(j.deadline) > 7) return false;
      if (!q) return true;
      // Searched across what a student would actually type: the role, the
      // company, or a skill they know they have.
      return [j.title, j.companyName, j.location ?? '', ...j.skills]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });

    return out.sort((a, b) => {
      if (sort === 'deadline') return a.deadline.localeCompare(b.deadline);
      if (sort === 'newest') return (b.postedAt ?? '').localeCompare(a.postedAt ?? '');
      if (sort === 'pay') return payOf(b) - payOf(a);
      return b.match.score - a.match.score || a.deadline.localeCompare(b.deadline);
    });
  }, [jobs, f, sort, tab]);

  /* The pane always has something in it: the first row of whatever is on
     screen, until the student chooses otherwise. */
  useEffect(() => {
    if (shown.length === 0) {
      setPicked(null);
      return;
    }
    if (!picked || !shown.some((j) => j.id === picked)) setPicked(shown[0]!.id);
  }, [shown, picked]);

  const filtering =
    f.q !== '' || f.kind !== 'all' || f.place !== '' || f.posted > 0 || f.closingSoon;

  return (
    <StudentLayout>
      <div className="jb">
        <header className="jb-head">
          <div className="jb-head-left">
            <h1>{t('jobs.title')}</h1>
            {jobs && <span className="jb-head-count">{t('jobs.openToYou', { n: jobs.length })}</span>}
          </div>

          {jobs && jobs.length > 0 && (
            <label className="jb-head-search">
              <span className="sr-only">{t('jobs.search')}</span>
              <input
                value={f.q}
                onChange={(e) => setF({ ...f, q: e.target.value })}
                placeholder={t('jobs.searchPlaceholder')}
              />
            </label>
          )}
        </header>

      {error && <p className="alert alert-error">{error}</p>}
      {!canApply && blocked && <p className="alert alert-warn">{blocked}</p>}

      {jobs && jobs.length > 0 && (
        <>
          <div className="jb-bar">
            <label className="jb-field">
              <span>{t('jobs.kind')}</span>
              <select
                value={f.kind}
                onChange={(e) => setF({ ...f, kind: e.target.value as Filters['kind'] })}
              >
                <option value="all">{t('jobs.kindAll')}</option>
                <option value="fulltime">{t('jobs.kindFullTime')}</option>
                <option value="internship">{t('jobs.kindInternship')}</option>
              </select>
            </label>

            {places.length > 1 && (
              <label className="jb-field">
                <span>{t('jobs.place')}</span>
                <select value={f.place} onChange={(e) => setF({ ...f, place: e.target.value })}>
                  <option value="">{t('jobs.placeAll')}</option>
                  {places.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="jb-field">
              <span>{t('jobs.posted')}</span>
              <select
                value={String(f.posted)}
                onChange={(e) => setF({ ...f, posted: Number(e.target.value) })}
              >
                <option value="0">{t('jobs.postedAny')}</option>
                <option value="1">{t('jobs.posted24h')}</option>
                <option value="3">{t('jobs.posted3d')}</option>
                <option value="7">{t('jobs.posted7d')}</option>
                <option value="30">{t('jobs.posted30d')}</option>
              </select>
            </label>

            <label className="jb-field">
              <span>{t('jobs.sort')}</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="match">{t('jobs.sortMatch')}</option>
                <option value="deadline">{t('jobs.sortDeadline')}</option>
                <option value="newest">{t('jobs.sortNewest')}</option>
                <option value="pay">{t('jobs.sortPay')}</option>
              </select>
            </label>

            <label className="jb-toggle">
              <input
                type="checkbox"
                checked={f.closingSoon}
                onChange={(e) => setF({ ...f, closingSoon: e.target.checked })}
              />
              {t('jobs.closingSoon')}
            </label>

            {filtering && (
              <button type="button" className="link-btn jb-clear" onClick={() => setF(EMPTY)}>
                {t('jobs.clear')}
              </button>
            )}
          </div>

          <div className="jb-split">
            <section className="jb-list" aria-label={t('jobs.title')}>
              <div className="jb-tabs" role="tablist">
                {(
                  [
                    ['all', t('jobs.tabAll'), jobs.length],
                    ['open', t('jobs.tabOpen'), jobs.filter((j) => !j.applicationStatus).length],
                    ['applied', t('jobs.tabApplied'), jobs.filter((j) => j.applicationStatus).length],
                  ] as const
                ).map(([key, label, n]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={tab === key}
                    className={`jb-tab ${tab === key ? 'is-current' : ''}`}
                    onClick={() => setTab(key)}
                  >
                    {label}
                    <span>{n}</span>
                  </button>
                ))}
              </div>

              {shown.length === 0 ? (
                <div className="jb-none">
                  <p>{t('jobs.noneMatch')}</p>
                  <p className="muted">{t('jobs.noneMatchBody')}</p>
                </div>
              ) : (
                <ul className="jb-rows">
                  {shown.map((j) => {
                    const days = daysTo(j.deadline);
                    return (
                      <li key={j.id}>
                        <button
                          type="button"
                          className={`jb-row ${picked === j.id ? 'is-current' : ''}`}
                          onClick={() => setPicked(j.id)}
                          aria-current={picked === j.id}
                        >
                          {/* A monogram, not a logo: every company has two
                              letters, and a column of broken images is
                              worse than none. */}
                          <span className="jb-mark" aria-hidden="true">
                            {j.companyName.slice(0, 2).toUpperCase()}
                          </span>

                          <span className="jb-row-main">
                            <b>{j.title}</b>
                            <em>
                              {j.companyName}
                              {j.location ? ` · ${j.location}` : ''}
                            </em>
                            <small>
                              {posted(t, j.postedAt)}
                              {days >= 0 && (
                                <>
                                  {j.postedAt ? ' · ' : ''}
                                  <span className={days <= 3 ? 'is-urgent' : ''}>
                                    {t('jobs.daysLeft', { n: days })}
                                  </span>
                                </>
                              )}
                            </small>
                          </span>

                          <span
                            className={`jb-state ${j.applicationStatus ? 'is-in' : ''}`}
                          >
                            {j.applicationStatus ? t('jobs.stateIn') : t('jobs.stateOut')}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* The role itself, in the same component the standalone page
                uses, so the two can never drift apart. */}
            <section className="jb-pane" aria-live="polite">
              {picked ? (
                <StudentJobDetailPage key={picked} paneId={picked} />
              ) : (
                <div className="jb-none">
                  <p>{t('jobs.pickOne')}</p>
                </div>
              )}
            </section>
          </div>
        </>
      )}

      {jobs?.length === 0 && (
        <div className="empty">
          <h2>{t('jobs.emptyTitle')}</h2>
          <p>{t('jobs.emptyBody')}</p>
        </div>
      )}

      {jobs === null && !error && <p className="muted">{t('common.loading')}</p>}

        {hasModule('trust.whyNot') && <NotEligible />}
      </div>
    </StudentLayout>
  );
}

/**
 * Roles in the student's own drives that they cannot apply to, and why.
 *
 * Collapsed by default: the list above is what they can act on today. Opened,
 * each role says plainly which bar was missed and what, if anything, would
 * change it - "ask your placement cell" is an answer; silence is not.
 */
function NotEligible() {
  const { t, date } = useT();
  const [roles, setRoles] = useState<NotEligibleRole[] | null>(null);

  useEffect(() => {
    trustApi
      .notEligible()
      .then(setRoles)
      .catch(() => setRoles([]));
  }, []);

  if (!roles || roles.length === 0) return null;

  return (
    <details className="not-eligible">
      <summary>
        <span>
          {t('notEligible.title')} <span className="not-eligible-count">{roles.length}</span>
        </span>
        <span className="muted">{t('notEligible.open')}</span>
      </summary>
      <ul>
        {roles.map((role) => (
          <li key={role.id}>
            <p className="not-eligible-role">
              <b>{role.title}</b> · {role.companyName}
              <span className="muted"> · {t('notEligible.closes', { date: date(role.deadline) })}</span>
            </p>
            <ul className="not-eligible-reasons">
              {role.reasons.map((reason) => (
                <li key={reason.code}>
                  {reason.text}
                  {reason.fix && <span className="not-eligible-fix">{reason.fix}</span>}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </details>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * One role, in full.
 *
 * Rendered two ways from one component: as its own page for a link somebody
 * was sent, and as the right-hand pane of the jobs list. Only the frame
 * differs - a second copy of a screen this size is a second copy to keep in
 * step, and the one that drifts is always the one nobody is looking at.
 */
export function StudentJobDetailPage({ paneId }: { paneId?: string } = {}) {
  const { hasModule } = useAuth();
  const { t, date, time } = useT();
  const { id: routeId = '' } = useParams();
  const id = paneId ?? routeId;

  /*
   * In the pane the role is split into sections, because a pane is narrow
   * and the whole of a role is a long scroll. On its own page there is room
   * for all of it at once and nothing to gain from hiding three quarters of
   * it behind a click.
   */
  const [sec, setSec] = useState<'overview' | 'eligibility' | 'process' | 'company'>('overview');
  const on = (k: typeof sec) => !paneId || sec === k;

  /** A page has the shell around it; a pane is already inside one. */
  const Frame = ({ children }: { children: ReactNode }) =>
    paneId ? <>{children}</> : <Frame>{children}</Frame>;
  const [needsConsent, setNeedsConsent] = useState(false);
  const [data, setData] = useState<StudentJobDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [ref, setRef] = useState('');

  /*
   * The confirm step, and what it is sending.
   *
   * The resumes are fetched once when the page opens rather than when the
   * button is pressed, so the preview is there the moment they look at it.
   */
  /* Their own record, so the dialog can show what is being sent with it. */
  const [me, setMe] = useState<Profile | null>(null);
  const profileResume = me?.resumeUrl ?? null;

  useEffect(() => {
    candidateApi
      .getProfile()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  const [confirming, setConfirming] = useState(false);
  const [resumes, setResumes] = useState<SavedResume[] | null>(null);
  const [pickedResume, setPickedResume] = useState<string | null>(null);
  const [makeDefault, setMakeDefault] = useState(false);

  useEffect(() => {
    candidateApi
      .resumes()
      .then((list) => {
        setResumes(list);
        // Whichever is current leads, since that is what applying would have
        // sent before there was a choice.
        const current = list.find((r) => r.url === profileResume) ?? list[0];
        setPickedResume(current?.id ?? null);
      })
      .catch(() => setResumes([]));
  }, [profileResume]);

  const refresh = useCallback(async () => {
    try {
      setData(await studentJobsApi.get(id));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('job.loadError'));
    }
    // `t` changes with the language; the fetch itself does not depend on it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (error && !data) {
    return (
      <Frame>
        <p className="alert alert-error">{error}</p>
        <p className="crumb">
          <Link to="/student/jobs">{t('job.allJobs')}</Link>
        </p>
      </Frame>
    );
  }

  if (!data) {
    return (
      <Frame>
        <p className="muted">{t('common.loading')}</p>
      </Frame>
    );
  }

  const { job, application, canApply, blockedReason, beforeApplying } = data;
  const test = beforeApplying?.test ?? null;
  const terms = beforeApplying?.terms ?? [];

  /*
   * Everything the company asked for before an application counts. Both are
   * sent with the application and kept on it, so that months later - when
   * somebody turns down an offer over a relocation they say nobody mentioned
   * - there is a row saying when they agreed to it.
   */
  const ready = (terms.length === 0 || accepted) && (!test?.required || ref.trim() !== '');

  async function apply() {
    setBusy(true);
    setError(null);
    setNeedsConsent(false);
    try {
      await studentJobsApi.apply(id, {
        acceptTerms: accepted,
        screeningRef: ref.trim(),
        ...(pickedResume ? { resumeId: pickedResume, makeDefault } : {}),
      });
      setConfirming(false);
      await refresh();
    } catch (err) {
      // Consent is not an error to shout about: it is one decision the
      // student makes once, on the privacy page, and then applying works.
      if (err instanceof ApiError && err.code === 'CONSENT_REQUIRED') setNeedsConsent(true);
      else setError(err instanceof ApiError ? err.message : t('job.applyError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Frame>
      <p className="crumb">
        <Link to="/student/jobs">{t('job.allJobs')}</Link>
      </p>

      <header className="page-head">
        <div>
          <p className="eyebrow">
            {job.company.name}
            {hasModule('showcase.company') && (
              <Link to={`/student/companies/${job.companyId}`} className="company-link">
                {t('job.aboutLink', { company: job.company.name })}
              </Link>
            )}
          </p>
          <h1>{job.title}</h1>
          <p className="page-lede">
            {ctc(t, job.ctcMin, job.ctcMax, job.payPeriod)}
            {job.location ? ` · ${job.location}` : ''} · {t('job.applyBy', { date: date(job.deadline) })}
          </p>
          {/* How fresh it is and how crowded, said before the detail. */}
          <p className="job-card-when">
            {posted(t, job.postedAt)}
            {job.applicants > 0 && (
              <>
                {job.postedAt ? ' · ' : ''}
                {t('jobs.applicants', { n: job.applicants })}
              </>
            )}
          </p>
        </div>
        {application ? (
          <span className="pill pill-pass">{t('job.applied')}</span>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setConfirming(true)}
            disabled={!canApply || busy || confirming}
          >
            {t('job.apply')}
          </button>
        )}
      </header>

      {error && <p className="alert alert-error">{error}</p>}

      {/*
        Nothing is sent until they have seen what is going. The button above
        opens this; it is what actually applies.
      */}
      {confirming && !application && (
        <ApplyConfirm
          job={job}
          me={me}
          terms={terms}
          test={test}
          resumes={resumes ?? []}
          chosenId={pickedResume}
          onChoose={setPickedResume}
          makeDefault={makeDefault}
          onMakeDefault={setMakeDefault}
          onCancel={() => setConfirming(false)}
          onSend={() => void apply()}
          busy={busy}
          ready={ready}
        />
      )}

      {needsConsent && (
        <p className="alert alert-warn">
          <b>{t('job.consentTitle')}</b> {t('job.consentBody')}{' '}
          <Link to="/student/privacy?reason=apply">{t('job.consentLink')}</Link>
        </p>
      )}

      {data.feeWarning && data.feeWarning.length > 0 && (
        <FeeWarning hits={data.feeWarning} title={t('job.feeTitle')}>
          {t('job.feeBody')}
        </FeeWarning>
      )}

      {application && (
        <p className="alert alert-ok">
          <b>{t('job.appliedOn', { date: date(application.appliedAt) })}</b> {t('job.trackUnder')}{' '}
          <Link to="/student/applications">{t('nav.My applications')}</Link>.
        </p>
      )}

      {!application && !canApply && blockedReason && (
        <p className="alert alert-warn">{blockedReason}</p>
      )}

      {!application && (test || terms.length > 0) && (
        <section className="card before-applying">
          <h2>{t('before.title')}</h2>

          {test && (
            <div className="before-block">
              <h3 className="sub-heading">
                {test.name ?? t('before.aTest')}
                {test.required ? (
                  <span className="pill pill-hold">{t('common.required')}</span>
                ) : (
                  <span className="pill pill-idle">{t('common.optional')}</span>
                )}
              </h3>

              {test.instructions && <p className="prose">{test.instructions}</p>}

              {test.deadline && (
                <p className="muted">{t('before.closes', { date: date(test.deadline) })}</p>
              )}

              {/* The link leaves the portal, so it says so and opens away
                  from this page rather than losing a half-filled form. */}
              <a
                className="btn btn-secondary"
                href={test.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('before.openTest')}
              </a>

              {test.required && (
                <label className="field">
                  <span className="field-label">
                    {t('before.testResult')}
                    <span className="req">{t('before.requiredTag')}</span>
                  </span>
                  <input
                    value={ref}
                    onChange={(e) => setRef(e.target.value)}
                    placeholder={t('before.testPlaceholder')}
                    disabled={busy}
                  />
                  <span className="field-hint">{t('before.testHint', { company: job.company.name })}</span>
                </label>
              )}
            </div>
          )}

          {terms.length > 0 && (
            <div className="before-block">
              <h3 className="sub-heading">{t('before.conditions')}</h3>
              <p className="muted">{t('before.conditionsNote')}</p>
              <ol className="prose term-conditions">
                {terms.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ol>

              <label className="check-row">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  disabled={busy}
                />
                <span>
                  <b>{t('before.accept')}</b>
                  <span className="check-hint">{t('before.acceptHint')}</span>
                </span>
              </label>
            </div>
          )}
        </section>
      )}

      {paneId && (
        <div className="pane-tabs" role="tablist">
          {(
            [
              ['overview', t('sec.overview')],
              ['eligibility', t('sec.eligibility')],
              ['process', t('sec.process')],
              ['company', t('sec.company')],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={sec === key}
              className={`pane-tab ${sec === key ? 'is-current' : ''}`}
              onClick={() => setSec(key)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {on('overview') && data.offerCard && (
        <OfferCardView card={data.offerCard} company={job.company.name} />
      )}

      {on('overview') && (
      <section className="card">
        <h2>{t('role.title')}</h2>
        <p className="prose">{job.description}</p>
        {job.responsibilities && (
          <>
            <h3 className="sub-heading">{t('role.responsibilities')}</h3>
            <p className="prose">{job.responsibilities}</p>
          </>
        )}
        <dl className="facts-grid">
          <div>
            <dt>{t('role.type')}</dt>
            <dd>{job.jobTypeLabel ?? job.jobType.replace('_', ' ').toLowerCase()}</dd>
          </div>
          <div>
            <dt>{t('role.openings')}</dt>
            <dd>{job.openings ?? t('common.notStated')}</dd>
          </div>
          <div>
            <dt>{t('role.rounds')}</dt>
            <dd>{job.roundCount}</dd>
          </div>
          <div>
            <dt>{t('role.bond')}</dt>
            <dd>
              {job.bondMonths ? (
                <>
                  {t('common.months', { n: job.bondMonths })}
                  {job.bondAmount && ` · ₹${Number(job.bondAmount).toLocaleString('en-IN')}`}
                  {job.bondNote && <span className="row-sub">{job.bondNote}</span>}
                </>
              ) : (
                t('common.none')
              )}
            </dd>
          </div>
          {job.shift && (
            <div>
              <dt>{t('role.shift')}</dt>
              <dd>{SHIFT_LABELS[job.shift] ?? job.shift}</dd>
            </div>
          )}
          {job.travel && (
            <div>
              <dt>{t('role.travel')}</dt>
              <dd>
                {TRAVEL_LABELS[job.travel] ?? job.travel}
                {job.relocationRequired && <span className="row-sub">{t('role.relocation')}</span>}
              </dd>
            </div>
          )}
          {!job.travel && job.relocationRequired && (
            <div>
              <dt>{t('role.travel')}</dt>
              <dd>{t('role.relocation')}</dd>
            </div>
          )}
          {job.genderEligibility !== 'ANY' && (
            <div>
              <dt>{t('role.gender')}</dt>
              <dd>
                {t(
                  job.genderEligibility === 'WOMEN'
                    ? 'role.womenOnly'
                    : job.genderEligibility === 'MEN'
                      ? 'role.menOnly'
                      : 'role.womenPreferred',
                )}
                {job.genderNote && <span className="row-sub">{job.genderNote}</span>}
              </dd>
            </div>
          )}
          {job.employerType && (
            <div>
              <dt>{t('role.employer')}</dt>
              <dd>
                {job.employerType === 'DIRECT'
                  ? t('role.directHire')
                  : t('role.payrollOf', { name: job.employerName ?? '' })}
              </dd>
            </div>
          )}
          {job.designation && (
            <div>
              <dt>{t('role.designation')}</dt>
              <dd>{job.designation}</dd>
            </div>
          )}
          {job.offerLetterDays !== null && (
            <div>
              <dt>{t('role.offerLetter')}</dt>
              <dd>{t('role.offerLetterWithin', { n: job.offerLetterDays })}</dd>
            </div>
          )}
          {job.probationMonths ? (
            <div>
              <dt>{t('role.probation')}</dt>
              <dd>
                {t('common.months', { n: job.probationMonths })}
                {job.probationCtc && ` · ₹${Number(job.probationCtc).toLocaleString('en-IN')}`}
              </dd>
            </div>
          ) : null}
          {job.trainingMonths ? (
            <div>
              <dt>{t('role.training')}</dt>
              <dd>
                {t('common.months', { n: job.trainingMonths })}
                {job.trainingLocation && ` · ${job.trainingLocation}`}
                {job.trainingStipend && (
                  <span className="row-sub">₹{Number(job.trainingStipend).toLocaleString('en-IN')} / month</span>
                )}
              </dd>
            </div>
          ) : null}
        </dl>

        {job.offerConditional === 'YES' && (
          <p className="prose">
            <b>{t('role.conditional')}:</b>{' '}
            {[
              ...(job.offerConditions ?? []).map((k) => OFFER_CONDITION_LABELS[k] ?? k),
              ...(job.offerConditionNote ? [job.offerConditionNote] : []),
            ].join(' · ')}
          </p>
        )}
        {(job.ctcIncludes ?? []).length > 0 && (
          <p className="prose">
            <b>{t('role.ctcIncludes')}:</b> {(job.ctcIncludes ?? []).map((k) => CTC_INCLUDE_LABELS[k] ?? k).join(', ')}
            {job.ctcNote && ` · ${job.ctcNote}`}
          </p>
        )}
        {job.nightShiftSafety && <p className="prose">{job.nightShiftSafety}</p>}
        {job.noFeeDeclaredAt && <p className="prose muted">{t('role.noFee')}</p>}

        {/* Whether the job is open to a person with a disability - the first
            thing such a student needs to know, and almost never said. */}
        {(job.pwdSuitable || job.inclusionNote) && (
          <>
            <h3 className="sub-heading">{t('role.inclusion')}</h3>
            {job.pwdSuitable && (
              <p className="prose">
                <b>{t(job.pwdSuitable === 'YES' ? 'role.pwdYes' : 'role.pwdNo')}</b>
                {job.pwdSuitable === 'YES' && (job.pwdCategories ?? []).length > 0 && (
                  <>: {(job.pwdCategories ?? []).map((k) => PWD_LABELS[k] ?? k).join(', ')}</>
                )}
              </p>
            )}
            {job.pwdSuitable === 'YES' && (job.accommodations ?? []).length > 0 && (
              <p className="prose">
                {t('role.support')}:{' '}
                {(job.accommodations ?? []).map((k) => ACCOMMODATION_LABELS[k] ?? k).join(' · ')}
              </p>
            )}
            {job.inclusionNote && <p className="prose">{job.inclusionNote}</p>}
          </>
        )}
      </section>
      )}

      {/*
        What the role asks of them, and whether they meet it.

        Every role a student can see is one they already qualify for - the
        visibility query saw to that - but they are never told which bars
        they cleared. Seeing "8.0 CGPA, you have 9.2" is worth more than
        silence: it is the difference between being let in and knowing why.
      */}
      {on('eligibility') && (
        <section className="card">
          <h2>{t('sec.eligibility')}</h2>
          <p className="muted">{t('elig.note')}</p>

          <ul className="elig">
            {(
              [
                [t('elig.courses'), job.allowedCourses, t('elig.anyCourse')],
                [t('elig.branches'), job.allowedSpecialisations, t('elig.anyBranch')],
                [t('elig.years'), job.graduationYears.map(String), t('elig.anyYear')],
              ] as const
            ).map(([label, list, anyText]) => (
              <li key={label}>
                <span className="elig-k">{label}</span>
                <span className="elig-v">{list.length > 0 ? list.join(', ') : anyText}</span>
              </li>
            ))}

            {job.openToAll ? (
              <li>
                <span className="elig-k">{t('elig.marks')}</span>
                <span className="elig-v">{t('elig.noBar')}</span>
              </li>
            ) : (
              (
                [
                  [t('elig.cgpa'), job.minCgpa],
                  [t('elig.tenth'), job.minTenthPct],
                  [t('elig.twelfth'), job.minTwelfthPct],
                  [t('elig.diploma'), job.minDiplomaPct],
                ] as const
              )
                .filter(([, v]) => v !== null && v !== undefined)
                .map(([label, v]) => (
                  <li key={label}>
                    <span className="elig-k">{label}</span>
                    <span className="elig-v">{String(v)}</span>
                  </li>
                ))
            )}

            {job.maxActiveBacklogs !== null && job.maxActiveBacklogs !== undefined && (
              <li>
                <span className="elig-k">{t('elig.liveBacklogs')}</span>
                <span className="elig-v">{job.maxActiveBacklogs}</span>
              </li>
            )}
          </ul>

          {/* They are reading this, so they already cleared all of it. */}
          <p className="elig-ok">{t('elig.youMeet')}</p>
        </section>
      )}

      {on('overview') && (job.addressLine || job.mapEmbedUrl || job.mapsLink) && (
        <section className="card">
          <h2>{t('where.title')}</h2>
          {job.addressLine && (
            <p className="prose">
              {job.addressLine}
              {job.location ? `, ${job.location}` : ''}
              {job.pincode ? ` ${job.pincode}` : ''}
            </p>
          )}
          {job.mapEmbedUrl && (
            <MapEmbed
              embedUrl={job.mapEmbedUrl}
              mapsLink={job.mapsLink}
              label={job.addressLine ?? job.location ?? t('where.office')}
            />
          )}
        </section>
      )}

      {on('process') && (
      <section className="card">
        <h2>{t('process.title')}</h2>
        <p className="muted">{t('process.note')}</p>

        {/*
          The shape of it, and nothing more.

          When and where is arranged per student after they are shortlisted,
          so a date and a hall shown to everyone who opens the role is a slot
          most of them will never be given - and it is wrong the moment the
          company moves it. What a student needs before applying is how many
          rounds there are and whether they travel or open a link.
        */}
        <ol className="round-preview">
          {job.rounds.map((r) => (
            <li key={r.id}>
              <span className="round-order">{r.order}</span>
              <span className="round-detail">
                <b>{r.name}</b>
                <span className="check-sub">
                  {r.typeLabel ?? roundLabel(t, r.type)}
                  {' · '}
                  {r.isOnline ? t('process.online') : t('process.inPerson')}
                  {' · '}
                  {r.isElimination ? t('process.eliminates') : t('process.noCut')}
                </span>
                {r.description && <span className="round-about-text">{r.description}</span>}
              </span>
            </li>
          ))}
        </ol>

        <p className="field-hint">{t('process.detailsLater')}</p>
      </section>
      )}

      {/*
        Who they would be working for.
        
        Shown even when the company has written nothing, because the link to
        their page is the point: a student deciding whether to spend three
        rounds on somebody wants to read about them first, and a heading that
        appears only for the companies that filled in an "about" hides the
        link exactly where it is most needed.
      */}
      {on('company') && (
      <section className="card">
        <h2>{t('job.aboutHeading', { company: job.company.name })}</h2>

        <div className="job-company">
          <span className="job-company-logo" aria-hidden="true">
            {job.company.logoUrl ? (
              <img src={job.company.logoUrl} alt="" />
            ) : (
              job.company.name.slice(0, 2).toUpperCase()
            )}
          </span>
          <div>
            <p className="job-company-name">{job.company.name}</p>
            <p className="job-company-links">
              {hasModule('showcase.company') && (
                <Link to={`/student/companies/${job.company.id}`}>{t('job.companyPage')}</Link>
              )}
              {job.company.website && (
                <a href={job.company.website} target="_blank" rel="noreferrer noopener">
                  {t('job.companySite')}
                </a>
              )}
            </p>
          </div>
        </div>

        {job.company.about && <p className="prose">{job.company.about}</p>}
      </section>
      )}

      {hasModule('trust.scamShield') && <ReportRole jobId={job.id} existing={data.myReport ?? null} />}
    </Frame>
  );
}

/**
 * The last step before an application goes, as a dialog.
 *
 * An application is one of the few things on here a student cannot take back,
 * and it used to happen on a single click. So it stops and shows the three
 * things that decide whether they meant it: what the role is, what is being
 * sent about them, and which resume goes with it.
 *
 * The resume is named rather than drawn. A student picking between two of
 * their own already knows what is in them, and a page of PDF in a dialog
 * buries the button they came here to press. It is one click away for anybody
 * who does want to check.
 */
function ApplyConfirm({
  job,
  me,
  terms,
  test,
  resumes,
  chosenId,
  onChoose,
  makeDefault,
  onMakeDefault,
  onCancel,
  onSend,
  busy,
  ready,
}: {
  job: StudentJobDetail['job'];
  me: Profile | null;
  terms: string[];
  test: { name: string | null; required: boolean } | null;
  resumes: SavedResume[];
  chosenId: string | null;
  onChoose: (id: string) => void;
  makeDefault: boolean;
  onMakeDefault: (v: boolean) => void;
  onCancel: () => void;
  onSend: () => void;
  busy: boolean;
  ready: boolean;
}) {
  const { t, date } = useT();
  const chosen = resumes.find((r) => r.id === chosenId) ?? resumes[0] ?? null;

  // Escape closes it, which is what every other dialog on a computer does.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  return (
    <div
      className="modal-back"
      onMouseDown={(e) => {
        // Only a click on the backdrop itself, not one that started inside.
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="apply-title">
        <div className="modal-head">
          <h2 id="apply-title">{t('apply.title')}</h2>
          <button type="button" className="modal-x" onClick={onCancel} disabled={busy} aria-label={t('common.cancel')}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* What they are applying to. */}
          <section className="apply-block">
            <p className="apply-label">{t('apply.theRole')}</p>
            <p className="apply-role">{job.title}</p>
            <p className="apply-sub">
              {job.company.name}
              {job.location ? ` · ${job.location}` : ''}
            </p>
            <dl className="apply-facts">
              <div>
                <dt>{t('jobs.applyBy')}</dt>
                <dd>{date(job.deadline)}</dd>
              </div>
              <div>
                <dt>{t('jobs.rounds')}</dt>
                <dd>{job.roundCount}</dd>
              </div>
              {job.applicants > 0 && (
                <div>
                  <dt>{t('apply.alreadyApplied')}</dt>
                  <dd>{job.applicants}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* What goes with it about them. Read-only: this is a last look,
              not another form to fill in. */}
          {me && (
            <section className="apply-block">
              <p className="apply-label">{t('apply.aboutYou')}</p>
              <dl className="apply-facts">
                <div>
                  <dt>{t('apply.name')}</dt>
                  <dd>{me.fullName}</dd>
                </div>
                {me.batch && (
                  <div>
                    <dt>{t('apply.batch')}</dt>
                    <dd>{me.batch.name}</dd>
                  </div>
                )}
                {me.cgpa && (
                  <div>
                    <dt>CGPA</dt>
                    <dd>{me.cgpa}</dd>
                  </div>
                )}
                {me.phone && (
                  <div>
                    <dt>{t('basics.phone')}</dt>
                    <dd>{me.phone}</dd>
                  </div>
                )}
              </dl>
              <p className="apply-sub">{me.email}</p>
            </section>
          )}

          {/* Which resume, by name. */}
          <section className="apply-block">
            <p className="apply-label">{t('apply.theResume')}</p>

            {resumes.length === 0 ? (
              <>
                <p className="alert alert-warn">{t('apply.none')}</p>
                <Link to="/student/profile" className="btn btn-secondary btn-sm">
                  {t('apply.addOne')}
                </Link>
              </>
            ) : resumes.length === 1 ? (
              <p className="apply-one">
                <b>{chosen?.name}</b>
                <a href={chosen?.url} target="_blank" rel="noreferrer noopener">
                  {t('apply.check')}
                </a>
              </p>
            ) : (
              <>
                <ul className="apply-list">
                  {resumes.map((r) => (
                    <li key={r.id}>
                      <label className={chosen?.id === r.id ? 'is-current' : ''}>
                        <input
                          type="radio"
                          name="apply-resume"
                          checked={chosen?.id === r.id}
                          onChange={() => onChoose(r.id)}
                          disabled={busy}
                        />
                        <span>
                          <b>{r.name}</b>
                          <small>
                            {r.source === 'BUILT' ? t('resume.sourceBuilt') : t('resume.sourceUploaded')}
                            {' · '}
                            {new Date(r.createdAt).toLocaleDateString()}
                          </small>
                        </span>
                      </label>
                      <a href={r.url} target="_blank" rel="noreferrer noopener">
                        {t('apply.check')}
                      </a>
                    </li>
                  ))}
                </ul>

                {/* Answers the question once, for every application after
                    this one - which is why it is asked here at all. */}
                <label className="round-check apply-default">
                  <input
                    type="checkbox"
                    checked={makeDefault}
                    onChange={(e) => onMakeDefault(e.target.checked)}
                    disabled={busy}
                  />
                  <span>
                    <b>{t('apply.useAlways')}</b>
                    <small>{t('apply.useAlwaysHint')}</small>
                  </span>
                </label>
              </>
            )}
          </section>

          {/* What is still in the way, named rather than left to a disabled
              button nobody can explain. */}
          {!ready && (
            <p className="alert alert-warn">
              {terms.length > 0 && test?.required
                ? t('apply.blockedBoth')
                : terms.length > 0
                  ? t('apply.blockedTerms')
                  : t('apply.blockedTest', { name: test?.name ?? '' })}
            </p>
          )}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onSend}
            disabled={busy || !ready || !chosen}
          >
            {busy ? t('job.applying') : t('apply.send')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The honest offer card                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The pay, split the way it will actually be paid, and what the fixed part
 * comes to in a month.
 *
 * The in-hand figure leads because it is the one a student can plan a life
 * around; everything that is not guaranteed monthly - variable pay, a joining
 * bonus - sits beside it, never inside it. "How we worked this out" is one
 * click away, so the number is never a black box.
 */
function OfferCardView({ card, company }: { card: OfferCard; company: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const est = card.inHand;
  const isInternship = card.stipendPerMonth !== null;

  return (
    <section className="card offer-card">
      <div className="offer-card-head">
        <div>
          <p className="eyebrow">{t('offer.eyebrow')}</p>
          {est ? (
            <p className="offer-inhand">
              ≈ {rupees(est.monthly)}
              <span> {t('offer.inHandMonth')}</span>
            </p>
          ) : isInternship ? (
            <p className="offer-inhand">
              {rupees(card.stipendPerMonth!)}
              <span> {t('offer.stipendMonth')}</span>
            </p>
          ) : (
            <p className="offer-inhand offer-inhand-missing">
              {t('offer.notStated', { company })}
              <span>{t('offer.askCell')}</span>
            </p>
          )}
        </div>
      </div>

      <dl className="offer-split">
        {card.fixed !== null && (
          <div>
            <dt>{t('offer.fixed')}</dt>
            <dd>{t('offer.perYear', { amount: lakhs(card.fixed) })}</dd>
          </div>
        )}
        {card.variable !== null && card.variable > 0 && (
          <div className="is-maybe">
            <dt>{t('offer.variable')}</dt>
            <dd>
              {t('offer.upToYear', { amount: lakhs(card.variable) })}
              <small>{t('offer.notGuaranteed')}</small>
            </dd>
          </div>
        )}
        {card.joiningBonus !== null && card.joiningBonus > 0 && (
          <div>
            <dt>{t('offer.bonus')}</dt>
            <dd>
              {rupees(card.joiningBonus)}
              <small>{t('offer.bonusNote')}</small>
            </dd>
          </div>
        )}
        {isInternship && (
          <div>
            <dt>{t('offer.internship')}</dt>
            <dd>
              {card.internshipMonths ? t('common.months', { n: card.internshipMonths }) : t('offer.lengthNotStated')}
              {card.ppoCtc ? <small>{t('offer.ppo', { amount: lakhs(card.ppoCtc) })}</small> : null}
            </dd>
          </div>
        )}
        <div className={card.bond ? 'is-bond' : ''}>
          <dt>{t('offer.bond')}</dt>
          <dd>
            {card.bond ? (
              <>
                {card.bond.months ? t('common.months', { n: card.bond.months }) : t('common.yes')}
                {card.bond.amount ? ` · ${t('offer.bondLeave', { amount: rupees(card.bond.amount) })}` : ''}
                {card.bond.note && <small>{card.bond.note}</small>}
              </>
            ) : (
              t('common.none')
            )}
          </dd>
        </div>
      </dl>

      {est && (
        <>
          <button type="button" className="linkish offer-how" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? t('offer.hideWorking') : t('offer.showWorking')}
          </button>
          {open && (
            <div className="offer-working">
              <table>
                <tbody>
                  <tr>
                    <td>{t('offer.rowFixed')}</td>
                    <td>{rupees(est.breakdown.grossMonthly)}</td>
                  </tr>
                  <tr>
                    <td>{t('offer.rowTax')}</td>
                    <td>− {rupees(est.breakdown.incomeTaxMonthly)}</td>
                  </tr>
                  <tr>
                    <td>{t('offer.rowPf')}</td>
                    <td>− {rupees(est.breakdown.epfMonthly)}</td>
                  </tr>
                  <tr>
                    <td>{t('offer.rowPt')}</td>
                    <td>− {rupees(est.breakdown.professionalTaxMonthly)}</td>
                  </tr>
                  <tr className="offer-total">
                    <td>{t('offer.rowInHand')}</td>
                    <td>{rupees(est.monthlyExact)}</td>
                  </tr>
                </tbody>
              </table>
              <ul>
                {est.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
              <p className="muted">{t('offer.estimateNote')}</p>
            </div>
          )}
        </>
      )}

      {/*
        The card already refuses to hide the parts inside one big number. This
        is the sentence that explains why that matters, for the student seeing
        fixed, variable and a bond on the same card for the first time.
      */}
      <GuideStrip
        from="jobs"
        cue={{
          guide: 'offer-letter',
          cue: 'Fixed, variable, in-hand, bond: what each one actually means.',
        }}
      />
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Reporting a role                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The scam shield's human half. Quiet until needed: one line at the foot of
 * the role, which opens into a short form. The report goes to the student's
 * own placement cell, and the page says so.
 */
function ReportRole({
  jobId,
  existing,
}: {
  jobId: string;
  existing: { reason: string; status: string; createdAt: string } | null;
}) {
  const { t, date, locale } = useT();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('FEE_DEMANDED');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(existing ? existing.createdAt : null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const { report } = await trustApi.report(jobId, reason, note.trim());
      setSent(report.createdAt);
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('report.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="report-role">
      {sent && !open ? (
        <p className="muted">
          {t('report.sentOn', { date: date(sent) })}{' '}
          <button type="button" className="linkish" onClick={() => setOpen(true)}>
            {t('report.update')}
          </button>
        </p>
      ) : !open ? (
        <p className="muted">
          {t('report.prompt')}{' '}
          <button type="button" className="linkish" onClick={() => setOpen(true)}>
            {t('report.link')}
          </button>
        </p>
      ) : (
        <div className="card report-form">
          <h2>{t('report.title')}</h2>
          <p className="muted">{t('report.who')}</p>
          <div className="report-reasons" role="radiogroup" aria-label="What is wrong">
            {REPORT_REASONS.map((r) => (
              <label key={r.value} className={`report-reason ${reason === r.value ? 'is-on' : ''}`}>
                <input
                  type="radio"
                  name="report-reason"
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                />
                {/* English keeps the wording the reasons were written in. */}
                {locale === 'en' ? r.label : t(`report.reason.${r.value}` as MessageKey)}
              </label>
            ))}
          </div>
          <label className="field">
            <span className="field-label">{t('report.whatHappened')}</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} />
          </label>
          {error && <p className="alert alert-error">{error}</p>}
          <div className="report-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-primary" onClick={send} disabled={busy}>
              {busy ? t('report.sending') : t('report.send')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
