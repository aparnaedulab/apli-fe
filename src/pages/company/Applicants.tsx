import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import CompanyLayout from './CompanyLayout';
import {
  applicantApi,
  STATUS_PILL,
  type ApplicantRow,
  type ApplicantSort,
} from '../../api/applications';
import { jobApi, type JobSummary } from '../../api/jobs';
import { ApiError } from '../../api/client';
import { trackerApi } from '../../api/tracker';
import '../../components/TrackerView.css';
import './Applicants.css';

/**
 * The hiring queue: the roles first, then the people in one of them.
 *
 * A recruiter does not have "applicants". They have a role they are trying to
 * fill and a pile of people who want it, and they work one role at a time -
 * so the roles are what the page opens with, each carrying its own funnel,
 * and choosing one is what puts its applicants on screen.
 *
 * Inside a role, every move the state machine allows from where somebody
 * stands is a button on their card. The old screen made each decision cost a
 * page load, a decision, a journey back and a hunt for your place again;
 * nobody gets through ninety applicants that way.
 */

/** Closed. Nothing further can be done, by anybody. */
const TERMINAL = ['HIRED', 'REJECTED', 'DECLINED', 'WITHDRAWN'];

/** Closed without an offer - one chip, because they read as one outcome. */
const CLOSED = ['REJECTED', 'DECLINED', 'WITHDRAWN'];

/**
 * The stages, as the recruiter thinks of them.
 *
 * `CLOSED` is three statuses behind one chip. Everything is matched here
 * rather than by asking the server for one status at a time: the page already
 * holds every application it needs for the funnels, so filtering is instant
 * and a chip never costs a round trip or a flash of "Loading…".
 */
const STAGES = [
  { key: '', label: 'Everyone' },
  { key: 'APPLIED', label: 'New' },
  { key: 'UNDER_REVIEW', label: 'Reviewing' },
  { key: 'SHORTLISTED', label: 'Shortlisted' },
  { key: 'IN_ROUND', label: 'In a round' },
  { key: 'WAITLISTED', label: 'Waitlisted' },
  { key: 'OFFERED', label: 'Offered' },
  { key: 'HIRED', label: 'Hired' },
  { key: 'CLOSED', label: 'Not taken forward' },
] as const;

const inStage = (a: ApplicantRow, stage: string) =>
  !stage || (stage === 'CLOSED' ? CLOSED.includes(a.status) : a.status === stage);

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

/** The funnel for one pile of applications. */
function funnelOf(rows: ApplicantRow[]) {
  return {
    total: rows.length,
    fresh: rows.filter((r) => r.status === 'APPLIED').length,
    reading: rows.filter((r) => r.status === 'UNDER_REVIEW').length,
    shortlisted: rows.filter((r) => r.status === 'SHORTLISTED').length,
    inRounds: rows.filter((r) => ['IN_ROUND', 'WAITLISTED'].includes(r.status)).length,
    offered: rows.filter((r) => ['OFFERED', 'ACCEPTED'].includes(r.status)).length,
    hired: rows.filter((r) => r.status === 'HIRED').length,
  };
}

export default function Applicants() {
  const [params, setParams] = useSearchParams();
  const jobId = params.get('jobId') ?? '';
  const stage = params.get('status') ?? '';
  const sort = (params.get('sort') ?? 'match') as ApplicantSort;
  const minCgpa = params.get('minCgpa') ?? '';
  const branch = params.get('branch') ?? '';
  const q = params.get('q') ?? '';
  const onlyOverdue = params.get('overdue') === '1';

  /**
   * Every application, in the order the sort asked for.
   *
   * One fetch rather than one per filter: a campus role has hundreds of
   * applicants, not millions, and holding them makes the funnels truthful and
   * every chip instant. Only the sort goes back to the server, because the
   * match score is computed there from two tables.
   */
  const [all, setAll] = useState<ApplicantRow[] | null>(null);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Applications past the college's response time. Each college sets its own,
  // so the server works it out per applicant; this list only marks them.
  const [overdue, setOverdue] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      setAll(await applicantApi.list({ sort }));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load applicants.');
    }
    jobApi.list().then(setJobs).catch(() => setJobs([]));
    trackerApi
      .company()
      .then((r) => setOverdue(new Set(r.jobs.flatMap((j) => j.applicationIds))))
      .catch(() => setOverdue(new Set()));
  }, [sort]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  /** Open a role. Filters from the last one do not follow it in. */
  function openJob(id: string) {
    const next = new URLSearchParams();
    next.set('jobId', id);
    setParams(next);
  }

  /** Drop everything except which role is open and how it is ordered. */
  function clearFilters() {
    const next = new URLSearchParams();
    if (jobId) next.set('jobId', jobId);
    if (sort !== 'match') next.set('sort', sort);
    setParams(next, { replace: true });
  }

  /**
   * Make a move on one applicant.
   *
   * The card is what goes busy, not the page: a recruiter working down a list
   * should be able to keep reading while a decision saves, and greying out
   * ninety cards to save one is how a queue stops feeling like a queue.
   */
  async function act(id: string, fn: () => Promise<unknown>, message: string) {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      setFlash(message);
      window.setTimeout(() => setFlash(null), 3500);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not work.');
    } finally {
      setBusyId(null);
    }
  }

  /** Every role, with its pile - including the ones nobody has applied to. */
  const roles = useMemo(() => {
    if (!all) return null;
    const by = new Map<string, ApplicantRow[]>();
    for (const a of all) {
      if (!by.has(a.jobId)) by.set(a.jobId, []);
      by.get(a.jobId)!.push(a);
    }

    // Jobs the company has, plus any role an application points at that the
    // job list did not return - a closed role still has people in it.
    const seen = new Set(jobs.map((j) => j.id));
    const extra = [...by.keys()]
      .filter((id) => !seen.has(id))
      .map((id) => ({ id, title: by.get(id)![0]!.jobTitle, job: undefined }));

    const out = [
      ...jobs.map((j) => ({ id: j.id, title: j.title, job: j as JobSummary | undefined })),
      ...extra,
    ].map((r) => ({ ...r, rows: by.get(r.id) ?? [] }));

    // What is waiting comes first: a role with eleven people nobody has
    // opened matters more than one with three already in rounds, however
    // recently either was posted. Roles with nobody sink to the bottom.
    return out.sort((x, y) => {
      const fx = funnelOf(x.rows);
      const fy = funnelOf(y.rows);
      return fy.fresh - fx.fresh || fy.total - fx.total || x.title.localeCompare(y.title);
    });
  }, [all, jobs]);

  const here = roles?.find((r) => r.id === jobId);
  const hereRows = useMemo(() => here?.rows ?? [], [here]);

  /** The branches actually present, rather than a box to guess a spelling in. */
  const branches = useMemo(
    () => [...new Set(hereRows.map((a) => a.specialisation).filter(Boolean) as string[])].sort(),
    [hereRows],
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const floor = minCgpa ? Number(minCgpa) : null;
    return hereRows.filter((a) => {
      if (!inStage(a, stage)) return false;
      if (onlyOverdue && !overdue.has(a.id)) return false;
      if (branch && a.specialisation !== branch) return false;
      // A missing mark is not a low one, but a recruiter asking for 8.0 is
      // asking to see people they can check - so an unfilled profile drops
      // out, exactly as it would on the server.
      if (floor !== null && (a.cgpa === null || Number(a.cgpa) < floor)) return false;
      if (!needle) return true;
      return [a.name, a.email, a.rollNo ?? '', a.batchName ?? '', a.specialisation ?? '']
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [hereRows, stage, onlyOverdue, overdue, branch, minCgpa, q]);

  const overdueAll = all ? all.filter((a) => overdue.has(a.id)).length : 0;
  const overdueHere = hereRows.filter((a) => overdue.has(a.id)).length;
  const filtering = Boolean(stage || branch || minCgpa || q || onlyOverdue);

  return (
    <CompanyLayout>
      <div className="ac">
        {/* ---------------------------------------------------------------
            The roles.
            --------------------------------------------------------------- */}
        {!jobId && (
          <>
            <header className="ac-head">
              <div className="ac-head-left">
                <h1>Applicants</h1>
                {all && (
                  <span className="ac-head-count">
                    {all.length} {all.length === 1 ? 'person' : 'people'}
                  </span>
                )}
              </div>
            </header>

            <p className="ac-lede">
              Your roles, and who is waiting in each. Everyone who appears has already met your
              criteria and had their record verified by their college &mdash; so this is about who
              to read first, and who to move on.
            </p>

            {overdueAll > 0 && (
              <div className="alert alert-warn tk-banner" role="status">
                <span>
                  <b>
                    {overdueAll} applicant{overdueAll === 1 ? ' has' : 's have'} waited longer than
                    the college’s response time.
                  </b>{' '}
                  The students and their placement cells can see this.
                </span>
              </div>
            )}

            {error && <p className="alert alert-error">{error}</p>}
            {roles === null && !error && <p className="muted">Loading…</p>}

            {roles?.length === 0 && (
              <div className="empty">
                <h2>No roles yet</h2>
                <p>
                  Post a role and send it to a college. Applications appear once the college
                  accepts it and an eligible student applies.
                </p>
                <Link className="btn btn-primary" to="/company/jobs">
                  Post a role
                </Link>
              </div>
            )}

            {roles && roles.length > 0 && (
              <div className="ac-jobs">
                {roles.map((r) => (
                  <JobCard
                    key={r.id}
                    title={r.title}
                    job={r.job}
                    rows={r.rows}
                    overdue={r.rows.filter((a) => overdue.has(a.id)).length}
                    onOpen={() => openJob(r.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ---------------------------------------------------------------
            One role, and the people in it.
            --------------------------------------------------------------- */}
        {jobId && (
          <>
            <button
              type="button"
              className="ac-back"
              onClick={() => setParams(new URLSearchParams())}
            >
              All roles
            </button>

            <header className="ac-head">
              <div className="ac-head-left">
                <h1>{here?.title ?? 'Role'}</h1>
                <span className="ac-head-count">
                  {filtering && shown.length !== hereRows.length
                    ? `${shown.length} of ${hereRows.length}`
                    : `${hereRows.length} ${hereRows.length === 1 ? 'applicant' : 'applicants'}`}
                </span>
              </div>
              <Link to={`/company/jobs/${jobId}`} className="ac-pile-link">
                The role
              </Link>
            </header>

            {/*
              The stages and the narrowing, in one band.
              The counts used to be stated twice - once as a funnel panel and
              again, unnumbered, as a row of tabs. Putting the number on the
              chip that filters by it says it once and makes it clickable.
            */}
            <div className="ac-filters">
              <div className="ac-stages" role="tablist" aria-label="Stage">
                {STAGES.map((s) => {
                  const n =
                    s.key === ''
                      ? hereRows.length
                      : hereRows.filter((a) => inStage(a, s.key)).length;
                  if (n === 0 && s.key !== '') return null;
                  return (
                    <button
                      key={s.key || 'all'}
                      type="button"
                      role="tab"
                      aria-selected={stage === s.key}
                      className={`ac-chip ${stage === s.key ? 'is-on' : ''} ${
                        s.key === 'APPLIED' ? 'is-new' : ''
                      }`}
                      onClick={() => setParam('status', s.key)}
                    >
                      {s.label}
                      <span>{n}</span>
                    </button>
                  );
                })}

                {overdueHere > 0 && (
                  <button
                    type="button"
                    className={`ac-chip is-late ${onlyOverdue ? 'is-on' : ''}`}
                    aria-pressed={onlyOverdue}
                    onClick={() => setParam('overdue', onlyOverdue ? '' : '1')}
                  >
                    Overdue
                    <span>{overdueHere}</span>
                  </button>
                )}
              </div>

              <div className="ac-tools">
                <label className="ac-find">
                  <span className="sr-only">Find someone</span>
                  <input
                    value={q}
                    onChange={(e) => setParam('q', e.target.value)}
                    placeholder="Find by name, roll number or branch"
                  />
                </label>

                <label className="ac-pick">
                  <span>Order</span>
                  <select value={sort} onChange={(e) => setParam('sort', e.target.value)}>
                    <option value="match">Best match</option>
                    <option value="cgpa">Highest CGPA</option>
                    <option value="applied">Applied first</option>
                    <option value="name">Name</option>
                  </select>
                </label>

                {branches.length > 1 && (
                  <label className="ac-pick">
                    <span>Branch</span>
                    <select value={branch} onChange={(e) => setParam('branch', e.target.value)}>
                      <option value="">Any</option>
                      {branches.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="ac-pick">
                  <span>CGPA from</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={minCgpa}
                    onChange={(e) => setParam('minCgpa', e.target.value)}
                    placeholder="Any"
                  />
                </label>

                {filtering && (
                  <button type="button" className="ac-clear" onClick={clearFilters}>
                    Clear
                  </button>
                )}
              </div>
            </div>

            {error && <p className="alert alert-error">{error}</p>}
            {flash && <p className="alert alert-ok">{flash}</p>}
            {all === null && !error && <p className="muted">Loading…</p>}

            {all !== null && shown.length === 0 && (
              <div className="empty">
                <h2>Nobody here</h2>
                <p>
                  {hereRows.length === 0
                    ? 'Applications appear once a college accepts this role and an eligible student applies.'
                    : onlyOverdue
                      ? 'Nobody here is overdue. Everyone has heard from you within the college’s time.'
                      : 'Nobody in this role matches what you have narrowed to.'}
                </p>
                {filtering && hereRows.length > 0 && (
                  <button type="button" className="btn btn-secondary" onClick={clearFilters}>
                    Clear the filters
                  </button>
                )}
              </div>
            )}

            {shown.length > 0 && (
              <div className="ac-cards">
                {shown.map((a) => (
                  <ApplicantCard
                    key={a.id}
                    a={a}
                    overdue={overdue.has(a.id)}
                    busy={busyId === a.id}
                    anyBusy={busyId !== null}
                    onAct={act}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </CompanyLayout>
  );
}

/** The stage counts on a role card, as a footnote. */
function Funnel({ f }: { f: ReturnType<typeof funnelOf> }) {
  const cells = [
    ['New', f.fresh, 'is-new'],
    ['Reviewing', f.reading, ''],
    ['Shortlisted', f.shortlisted, ''],
    ['In rounds', f.inRounds, ''],
    ['Offered', f.offered, 'is-good'],
    ['Hired', f.hired, 'is-good'],
  ] as const;

  const live = cells.filter(([, n]) => n > 0);
  if (live.length === 0) return null;

  return (
    <dl className="ac-funnel">
      {live.map(([label, n, tone]) => (
        <div key={label} className={tone}>
          <dt>{label}</dt>
          <dd>{n}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * One role, as a card.
 *
 * The number that decides whether a recruiter opens it is how many people
 * nobody has looked at yet, so that is what the card leads with.
 */
function JobCard({
  title,
  job,
  rows,
  overdue,
  onOpen,
}: {
  title: string;
  job?: JobSummary;
  rows: ApplicantRow[];
  overdue: number;
  onOpen: () => void;
}) {
  const f = funnelOf(rows);
  const empty = f.total === 0;

  return (
    <article className={`ac-job ${f.fresh > 0 ? 'is-waiting' : ''} ${empty ? 'is-empty' : ''}`}>
      {/* The whole card opens the role; anything genuinely its own target
          stays one, so keyboard users get a stop per card, not six. */}
      <button type="button" className="ac-job-hit" onClick={onOpen}>
        <span className="sr-only">{title}</span>
      </button>

      <header className="ac-job-top">
        <h2>{title}</h2>
        {job && (
          <span className={`pill ${job.status === 'PUBLISHED' ? 'pill-pass' : 'pill-idle'}`}>
            {job.status}
          </span>
        )}
      </header>

      <p className="ac-job-meta">
        {[
          job?.location,
          job?.openings ? `${job.openings} opening${job.openings === 1 ? '' : 's'}` : null,
          job ? `closes ${shortDate(job.deadline)}` : null,
          job?.roundCount ? `${job.roundCount} round${job.roundCount === 1 ? '' : 's'}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>

      {empty ? (
        <p className="ac-job-none">No applications yet.</p>
      ) : (
        <>
          <div className="ac-job-count">
            <b>{f.total}</b>
            <span>{f.total === 1 ? 'applicant' : 'applicants'}</span>
          </div>

          <Funnel f={f} />

          {/* The one line that decides whether this role gets opened today. */}
          {f.fresh > 0 && (
            <p className="ac-job-call">
              {f.fresh} waiting on you
              {overdue > 0 && <span className="ac-job-late"> · {overdue} overdue</span>}
            </p>
          )}
        </>
      )}

      <span className="ac-job-go" aria-hidden="true">
        {empty || f.fresh === 0 ? 'Open' : `Review ${f.fresh}`}
      </span>
    </article>
  );
}

/**
 * One person, as a card, with what can be done about them on it.
 *
 * The card carries only what a decision needs - who they are, how they match,
 * where they have got to, and their resume. Reading somebody properly is
 * still a click away; it is no longer the toll on every decision.
 */
function ApplicantCard({
  a,
  overdue,
  busy,
  anyBusy,
  onAct,
}: {
  a: ApplicantRow;
  overdue: boolean;
  busy: boolean;
  anyBusy: boolean;
  onAct: (id: string, fn: () => Promise<unknown>, message: string) => void;
}) {
  /** Score and a note, opened only for the move that can carry them. */
  const [noting, setNoting] = useState(false);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');

  const terminal = TERMINAL.includes(a.status);
  const waited = daysSince(a.appliedAt);

  function clearNote() {
    setScore('');
    setFeedback('');
    setNoting(false);
  }

  return (
    <article className={`ac-card ${terminal ? 'is-closed' : ''} ${busy ? 'is-busy' : ''}`}>
      <header className="ac-card-top">
        <span className="ac-avatar" aria-hidden="true">
          {a.name.slice(0, 2).toUpperCase()}
        </span>
        <div className="ac-who-text">
          <Link to={`/company/applicants/${a.id}`} className="ac-name">
            {a.name}
          </Link>
          <small>
            {[a.batchName, a.rollNo, a.specialisation].filter(Boolean).join(' · ') || a.email}
          </small>
        </div>
        <span className="ac-marks">
          <b>{a.cgpa ?? (a.degreePct ? `${a.degreePct}%` : '—')}</b>
          <small>{a.cgpa ? 'CGPA' : a.degreePct ? 'Degree' : 'not given'}</small>
        </span>
      </header>

      {/*
        Why they are where they are in the list, in the words the role used.
        Not a score out of a hundred: an invented number nobody can check is
        worse than a short list a recruiter can disagree with.
      */}
      <div className="ac-match">
        {a.beatsPreferred && <span className="pill pill-pass">Above preferred</span>}
        {a.skillsAsked > 0 && (
          <span
            className={`pill ${a.skillsAskedHeld === a.skillsAsked ? 'pill-pass' : 'pill-idle'}`}
          >
            {a.skillsAskedHeld}/{a.skillsAsked} asked for
          </span>
        )}
        {a.skillsWelcomedHeld > 0 && (
          <span className="ac-welcomed">+{a.skillsWelcomedHeld} welcomed</span>
        )}
      </div>

      <div className="ac-where">
        <span className={`pill ${STATUS_PILL[a.status]}`}>{a.status.replace(/_/g, ' ')}</span>
        {overdue && (
          <span className="pill pill-stop" title="Past the college’s response time">
            Overdue
          </span>
        )}
        {a.currentRound && (
          <span className="ac-round">
            Round {a.currentRound.order} of {a.totalRounds} · {a.currentRound.name}
          </span>
        )}
      </div>

      <p className="ac-when">
        Applied {shortDate(a.appliedAt)}
        {waited > 0 && ` · ${waited} day${waited === 1 ? '' : 's'} ago`}
      </p>

      {/* Score and feedback go onto the round result and into the student's
          own history. Folded away until asked for: most passes do not need
          one, and a form on every card is a wall. */}
      {a.status === 'IN_ROUND' && (
        <div className="ac-note">
          <button type="button" className="link-btn" onClick={() => setNoting((v) => !v)}>
            {noting ? 'Hide score and feedback' : 'Add a score or feedback'}
          </button>
          {noting && (
            <div className="ac-note-fields">
              <label>
                <span>Score</span>
                <input
                  type="number"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  placeholder="82"
                  disabled={anyBusy}
                />
              </label>
              <label>
                <span>Feedback</span>
                <input
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Strong on system design."
                  disabled={anyBusy}
                />
              </label>
            </div>
          )}
        </div>
      )}

      <footer className="ac-card-foot">
        <div className="ac-reads">
          {/* The resume this application carried, not whichever they are
              using today - its own tab, so the queue keeps its place. */}
          {a.resumeUrl ? (
            <a className="ac-resume" href={a.resumeUrl} target="_blank" rel="noreferrer">
              Resume
            </a>
          ) : (
            <span className="ac-resume is-none">No resume</span>
          )}
          <Link to={`/company/applicants/${a.id}`} className="ac-full">
            Full profile
          </Link>
        </div>

        <Moves
          a={a}
          busy={busy}
          anyBusy={anyBusy}
          score={score}
          feedback={feedback}
          onAct={onAct}
          clearNote={clearNote}
        />
      </footer>
    </article>
  );
}

/**
 * Only the moves the state machine allows from here.
 *
 * The server is still the authority; this just avoids offering a button that
 * would come back as an illegal transition. The wording is the recruiter's,
 * not the schema's: moving somebody into round one is an invitation, and
 * saying "shortlist" hides the fact that the student is about to be told a
 * date and a place to be.
 */
function Moves({
  a,
  busy,
  anyBusy,
  score,
  feedback,
  onAct,
  clearNote,
}: {
  a: ApplicantRow;
  busy: boolean;
  anyBusy: boolean;
  score: string;
  feedback: string;
  onAct: (id: string, fn: () => Promise<unknown>, message: string) => void;
  clearNote: () => void;
}) {
  const off = busy || anyBusy;
  const first = a.rounds[0];
  const atIndex = a.currentRound ? a.rounds.findIndex((r) => r.id === a.currentRound!.id) : -1;
  const next = atIndex >= 0 ? a.rounds[atIndex + 1] : undefined;
  const isLastRound = atIndex >= 0 && !next;

  if (TERMINAL.includes(a.status)) {
    return <span className="ac-done">{a.status === 'HIRED' ? 'Hired' : 'Closed'}</span>;
  }

  /* Two moves, not one. Shortlisting says "you are through"; calling them
     to a round says "be here, then". They arrive on different days. */
  const shortlist = () =>
    onAct(
      a.id,
      () => applicantApi.shortlist(a.id),
      `${a.name} shortlisted. They have been told.`,
    );

  const invite = () => {
    if (!first) return;
    onAct(
      a.id,
      () => applicantApi.invite(a.id),
      `${a.name} called to ${first.name}. They can now see when and where.`,
    );
  };

  const pass = () =>
    onAct(
      a.id,
      async () => {
        const r = await applicantApi.advance(a.id, {
          score: score ? Number(score) : undefined,
          feedback: feedback || undefined,
        });
        clearNote();
        return r;
      },
      isLastRound
        ? `Offer made to ${a.name}.`
        : `${a.name} moved to ${next?.name ?? 'the next round'}.`,
    );

  return (
    <div className="ac-moves">
      {a.status === 'APPLIED' && (
        <button
          type="button"
          className="btn btn-primary ac-btn"
          disabled={off}
          onClick={() => onAct(a.id, () => applicantApi.review(a.id), `Opened ${a.name}.`)}
        >
          Start reviewing
        </button>
      )}

      {a.status === 'UNDER_REVIEW' && (
        <button type="button" className="btn btn-primary ac-btn" disabled={off} onClick={shortlist}>
          Shortlist
        </button>
      )}

      {a.status === 'SHORTLISTED' &&
        (first ? (
          <button type="button" className="btn btn-primary ac-btn" disabled={off} onClick={invite}>
            Call to {first.name}
          </button>
        ) : (
          <span className="ac-nudge">This role has no rounds to call them to.</span>
        ))}

      {a.status === 'IN_ROUND' && (
        <button type="button" className="btn btn-primary ac-btn" disabled={off} onClick={pass}>
          {isLastRound ? 'Pass and make an offer' : `Pass to ${next?.name ?? 'the next round'}`}
        </button>
      )}

      {/* Waitlisted is not a dead end: the state machine lets them back into
          a round, so the button that does it belongs here. */}
      {a.status === 'WAITLISTED' &&
        (a.currentRound ? (
          <button type="button" className="btn btn-primary ac-btn" disabled={off} onClick={pass}>
            {isLastRound ? 'Pass and make an offer' : `Pass to ${next?.name ?? 'the next round'}`}
          </button>
        ) : (
          first && (
            <button type="button" className="btn btn-primary ac-btn" disabled={off} onClick={invite}>
              Call to {first.name}
            </button>
          )
        ))}

      {a.status === 'OFFERED' && <span className="ac-nudge">Waiting on them to answer</span>}

      {a.status === 'ACCEPTED' && (
        <button
          type="button"
          className="btn btn-primary ac-btn"
          disabled={off}
          onClick={() => onAct(a.id, () => applicantApi.hire(a.id), `${a.name} confirmed as hired.`)}
        >
          Confirm they joined
        </button>
      )}

      {['UNDER_REVIEW', 'SHORTLISTED', 'IN_ROUND'].includes(a.status) && (
        <button
          type="button"
          className="btn btn-secondary ac-btn"
          disabled={off}
          onClick={() => onAct(a.id, () => applicantApi.waitlist(a.id), `${a.name} waitlisted.`)}
        >
          Waitlist
        </button>
      )}

      {!['OFFERED', 'ACCEPTED'].includes(a.status) && (
        <button
          type="button"
          className="link-btn is-danger ac-btn"
          disabled={off}
          onClick={() =>
            onAct(
              a.id,
              () => applicantApi.reject(a.id, { feedback: feedback || undefined }),
              `${a.name} was not taken forward.`,
            )
          }
        >
          Reject
        </button>
      )}
    </div>
  );
}
