import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CompanyLayout from './CompanyLayout';
import {
  companyAssessmentApi,
  type AssignmentRow,
  type CompanyAssessment,
} from '../../api/assessments';
import { applicantApi, type ApplicantRow } from '../../api/applications';
import { ApiError } from '../../api/client';
import './Assessments.css';

/**
 * Assessments, from the company's side.
 *
 * Set a test, assign it to the people you have shortlisted, record what comes
 * back. There is no request-and-approve step anywhere: assigning is the
 * permission, because a company does not publish tests and wait for
 * volunteers, and an inbox between the two is latency nobody benefits from.
 *
 * Apli does not host the questions, so a test points at whatever platform is
 * already in use. What this screen is for is the part that was missing: who
 * was asked, by when, and what came back.
 */

const SAID: Record<string, string> = {
  ASSIGNED: 'Not sat yet',
  SUBMITTED: 'Sat — waiting on you',
  PASSED: 'Cleared',
  FAILED: 'Not cleared',
  MISSED: 'Missed the date',
};

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export default function CompanyAssessments() {
  const [params, setParams] = useSearchParams();
  const openId = params.get('id') ?? '';

  const [rows, setRows] = useState<CompanyAssessment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [making, setMaking] = useState(false);

  const load = useCallback(() => {
    companyAssessmentApi
      .list()
      .then(setRows)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Could not load assessments.'),
      );
  }, []);

  useEffect(load, [load]);

  function say(m: string) {
    setFlash(m);
    window.setTimeout(() => setFlash(null), 4000);
  }

  const open = rows?.find((r) => r.id === openId) ?? null;

  return (
    <CompanyLayout>
      <div className="ca">
        <header className="ca-head">
          <div>
            <h1>Assessments</h1>
            <p>
              Tests you ask applicants to sit. You set one, assign it to the people you have
              shortlisted, and record what comes back — the test itself is taken wherever you
              already run them.
            </p>
          </div>
          {!open && (
            <button type="button" className="btn btn-primary" onClick={() => setMaking(true)}>
              New assessment
            </button>
          )}
        </header>

        {error && <p className="alert alert-error">{error}</p>}
        {flash && <p className="alert alert-ok">{flash}</p>}

        {making && (
          <Make
            onDone={(title) => {
              setMaking(false);
              say(`“${title}” is ready to assign.`);
              load();
            }}
            onCancel={() => setMaking(false)}
            onError={setError}
          />
        )}

        {rows === null && !error && <p className="muted">Loading…</p>}

        {rows?.length === 0 && !making && (
          <div className="empty">
            <h2>No assessments yet</h2>
            <p>
              Set one up and you can send it to any applicant on any of your roles, with a date to
              come back by.
            </p>
          </div>
        )}

        {/* The list, or the one that is open. */}
        {!open && rows && rows.length > 0 && (
          <div className="ca-list">
            {rows.map((a) => (
              <article key={a.id} className={`ca-card ${a.outstanding > 0 ? 'is-waiting' : ''}`}>
                <button
                  type="button"
                  className="ca-card-hit"
                  onClick={() => setParams({ id: a.id })}
                >
                  <span className="sr-only">{a.title}</span>
                </button>

                <h2>{a.title}</h2>
                <p className="ca-card-meta">
                  {[
                    a.durationMin ? `${a.durationMin} minutes` : null,
                    a.supervised ? 'Supervised' : 'Unsupervised',
                    a.retakes > 0 ? `${a.retakes} retake${a.retakes === 1 ? '' : 's'}` : 'One attempt',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>

                <dl className="ca-nums">
                  <div>
                    <dt>Assigned</dt>
                    <dd>{a.assigned}</dd>
                  </div>
                  <div className={a.outstanding > 0 ? 'is-waiting' : ''}>
                    <dt>Still owed</dt>
                    <dd>{a.outstanding}</dd>
                  </div>
                </dl>

                <span className="ca-go" aria-hidden="true">
                  {a.assigned === 0 ? 'Assign it' : 'Open'}
                </span>
              </article>
            ))}
          </div>
        )}

        {open && (
          <Detail
            assessment={open}
            onBack={() => setParams({})}
            onChanged={load}
            onSay={say}
            onError={setError}
          />
        )}
      </div>
    </CompanyLayout>
  );
}

/** Setting one up. Short on purpose: the test itself lives elsewhere. */
function Make({
  onDone,
  onCancel,
  onError,
}: {
  onDone: (title: string) => void;
  onCancel: () => void;
  onError: (m: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [instructions, setInstructions] = useState('');
  const [durationMin, setDurationMin] = useState('');
  const [supervised, setSupervised] = useState(false);
  const [retakes, setRetakes] = useState('0');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    onError('');
    try {
      await companyAssessmentApi.create({
        title: title.trim(),
        url: url.trim() || undefined,
        instructions: instructions.trim() || undefined,
        durationMin: durationMin ? Number(durationMin) : undefined,
        supervised,
        retakes: Number(retakes),
      });
      onDone(title.trim());
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'That did not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card ca-make">
      <h2>New assessment</h2>

      <label className="field">
        <span className="field-label">What it is</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Aptitude round — quantitative and logical"
          disabled={busy}
        />
      </label>

      <label className="field">
        <span className="field-label">Where it is taken</span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…  the link on your own testing platform"
          disabled={busy}
        />
        <span className="field-hint">
          Apli does not host the questions. Students open this, sit it there, and come back with
          whatever reference it gives them.
        </span>
      </label>

      <label className="field">
        <span className="field-label">Anything they should know first</span>
        <textarea
          rows={3}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="No calculators. One sitting. Your college email is the login."
          disabled={busy}
        />
      </label>

      <div className="form-row">
        <label className="field">
          <span className="field-label">How long</span>
          <input
            type="number"
            min="1"
            max="600"
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
            placeholder="45"
            disabled={busy}
          />
        </label>

        <label className="field">
          <span className="field-label">Attempts beyond the first</span>
          <select value={retakes} onChange={(e) => setRetakes(e.target.value)} disabled={busy}>
            <option value="0">None — one attempt</option>
            <option value="1">One retake</option>
            <option value="2">Two retakes</option>
          </select>
        </label>
      </div>

      {/*
        The label, not proctoring. A student sitting it at home unwatched is a
        different claim from one sitting it in a hall, and a recruiter reading
        the score later weighs it by exactly this - so it is recorded rather
        than left to be assumed.
      */}
      <label className="ca-watch">
        <input
          type="checkbox"
          checked={supervised}
          onChange={(e) => setSupervised(e.target.checked)}
          disabled={busy}
        />
        <span>
          <b>Somebody watches it being taken</b>
          <small>
            Shown to the student and kept with the score. It does not enforce anything — it records
            what kind of score this is.
          </small>
        </span>
      </label>

      <div className="btn-row">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || title.trim().length < 2}
          onClick={() => void save()}
        >
          {busy ? 'Saving…' : 'Create it'}
        </button>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}

/** One assessment: who has it, and what came back. */
function Detail({
  assessment,
  onBack,
  onChanged,
  onSay,
  onError,
}: {
  assessment: CompanyAssessment;
  onBack: () => void;
  onChanged: () => void;
  onSay: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [rows, setRows] = useState<AssignmentRow[] | null>(null);
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(() => {
    companyAssessmentApi
      .assignments(assessment.id)
      .then(setRows)
      .catch(() => setRows([]));
  }, [assessment.id]);

  useEffect(load, [load]);

  return (
    <>
      <button type="button" className="ca-back" onClick={onBack}>
        All assessments
      </button>

      <header className="ca-head">
        <div>
          <h1>{assessment.title}</h1>
          <p>
            {[
              assessment.durationMin ? `${assessment.durationMin} minutes` : null,
              assessment.supervised ? 'Supervised' : 'Unsupervised',
              assessment.url ? 'Taken on your own platform' : 'No link set',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setAssigning((v) => !v)}>
          {assigning ? 'Done assigning' : 'Assign to applicants'}
        </button>
      </header>

      {assigning && (
        <Assign
          assessmentId={assessment.id}
          onDone={(n) => {
            onSay(n === 0 ? 'They all had it already.' : `Sent to ${n}.`);
            setAssigning(false);
            load();
            onChanged();
          }}
          onError={onError}
        />
      )}

      {rows === null && <p className="muted">Loading…</p>}

      {rows?.length === 0 && (
        <div className="empty">
          <h2>Nobody has it yet</h2>
          <p>Assign it to applicants on any of your roles and they will see it straight away.</p>
        </div>
      )}

      {rows && rows.length > 0 && (
        <ul className="ca-people">
          {rows.map((r) => (
            <Person key={r.id} r={r} onDone={load} onSay={onSay} onError={onError} />
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * Choosing who sits it.
 *
 * Four ways in - a role, a college, a batch, or a list of email addresses
 * pasted out of a spreadsheet - and all four narrow the same pool: people who
 * have applied to one of this company's own roles.
 *
 * That limit is the important part. A company assigning a test to a whole
 * batch it has no drive with would be learning who is in that batch, which is
 * the college's to give and not a recruiter's to take. Reaching a campus
 * happens by posting a role there; this screen only ever works through the
 * applications that came back.
 *
 * Whichever way is used, the matches are shown as a list to be confirmed
 * before anything is sent. Paste-and-send is how forty of the wrong people
 * get a test on a Friday afternoon.
 */
function Assign({
  assessmentId,
  onDone,
  onError,
}: {
  assessmentId: string;
  onDone: (n: number) => void;
  onError: (m: string) => void;
}) {
  const [all, setAll] = useState<ApplicantRow[] | null>(null);
  const [by, setBy] = useState<'job' | 'college' | 'batch' | 'email'>('job');
  const [jobId, setJobId] = useState('');
  const [collegeId, setCollegeId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [typed, setTyped] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);

  /* Every applicant this company has, once. A campus role has hundreds, not
     millions, and holding them makes each way of choosing instant. */
  useEffect(() => {
    applicantApi
      .list()
      .then(setAll)
      .catch(() => setAll([]));
  }, []);

  /* Anybody still in the running. Somebody rejected last week does not need a
     test, and offering them one is a cruelty the screen can just prevent. */
  const pool = useMemo(
    () =>
      (all ?? []).filter(
        (p) => !['HIRED', 'REJECTED', 'DECLINED', 'WITHDRAWN'].includes(p.status),
      ),
    [all],
  );

  /** The choices that actually exist in this company's own applicants. */
  const jobs = useMemo(() => {
    const by = new Map<string, string>();
    for (const p of pool) by.set(p.jobId, p.jobTitle);
    return [...by].map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title));
  }, [pool]);

  const colleges = useMemo(() => {
    const by = new Map<string, string>();
    for (const p of pool) if (p.collegeId && p.collegeName) by.set(p.collegeId, p.collegeName);
    return [...by].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [pool]);

  const batches = useMemo(() => {
    const by = new Map<string, string>();
    for (const p of pool) {
      if (p.batchId && p.batchName) {
        by.set(p.batchId, p.collegeName ? `${p.batchName} · ${p.collegeName}` : p.batchName);
      }
    }
    return [...by].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [pool]);

  /** What was typed, as addresses, however they were separated. */
  const wanted = useMemo(
    () =>
      typed
        .split(/[\s,;]+/)
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean),
    [typed],
  );

  const shown = useMemo(() => {
    const matched =
      by === 'job'
        ? jobId
          ? pool.filter((p) => p.jobId === jobId)
          : []
        : by === 'college'
          ? collegeId
            ? pool.filter((p) => p.collegeId === collegeId)
            : []
          : by === 'batch'
            ? batchId
              ? pool.filter((p) => p.batchId === batchId)
              : []
            : (() => {
                const set = new Set(wanted);
                return set.size === 0
                  ? []
                  : pool.filter((p) => set.has(p.email.toLowerCase()));
              })();

    /*
     * One row per person, not per application.
     *
     * A student who applied to two of this company's roles is two rows in the
     * applicant list and one person here - choosing by college, batch or
     * email is choosing people. Showing them twice invited a recruiter to
     * tick the same student twice, and sitting one test twice is not a thing
     * that can happen.
     */
    const seen = new Map<string, ApplicantRow & { alsoOn: string[] }>();
    for (const p of matched) {
      const had = seen.get(p.candidateId);
      if (had) had.alsoOn.push(p.jobTitle);
      else seen.set(p.candidateId, { ...p, alsoOn: [] });
    }
    return [...seen.values()];
  }, [by, jobId, collegeId, batchId, wanted, pool]);

  /*
   * Addresses that matched nobody.
   *
   * Said out loud rather than silently dropped: a recruiter who pastes forty
   * and sees "sent to 38" has no way of knowing which two never arrived, and
   * the two are usually the ones that mattered.
   */
  const unmatched = useMemo(() => {
    if (by !== 'email') return [];
    const known = new Set(pool.map((p) => p.email.toLowerCase()));
    return [...new Set(wanted)].filter((e) => !known.has(e));
  }, [by, wanted, pool]);

  /* Whatever was chosen last should not stay ticked under a new question. */
  useEffect(() => {
    setPicked(new Set(shown.map((p) => p.id)));
  }, [shown]);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function send() {
    setBusy(true);
    onError('');
    try {
      const r = await companyAssessmentApi.assign(
        assessmentId,
        [...picked],
        due ? new Date(due).toISOString() : undefined,
      );
      onDone(r.assigned);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'That did not send.');
    } finally {
      setBusy(false);
    }
  }

  const WAYS = [
    ['job', 'By role'],
    ['college', 'By college'],
    ['batch', 'By batch'],
    ['email', 'By email'],
  ] as const;

  return (
    <section className="card ca-assign">
      <div className="ca-ways" role="tablist" aria-label="How to choose">
        {WAYS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={by === key}
            className={`ca-way ${by === key ? 'is-on' : ''}`}
            onClick={() => setBy(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="ca-limit">
        Everyone here has applied to one of your roles. Reaching a campus you have no drive with is
        the college&rsquo;s to arrange, not something this screen can do.
      </p>

      <div className="form-row">
        {by === 'job' && (
          <label className="field">
            <span className="field-label">Applicants to</span>
            <select value={jobId} onChange={(e) => setJobId(e.target.value)}>
              <option value="">Choose a role</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          </label>
        )}

        {by === 'college' && (
          <label className="field">
            <span className="field-label">From</span>
            <select value={collegeId} onChange={(e) => setCollegeId(e.target.value)}>
              <option value="">Choose a college</option>
              {colleges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {colleges.length === 0 && (
              <span className="field-hint">No applicant has a college on record yet.</span>
            )}
          </label>
        )}

        {by === 'batch' && (
          <label className="field">
            <span className="field-label">From</span>
            <select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              <option value="">Choose a batch</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            {batches.length === 0 && (
              <span className="field-hint">No applicant is in a batch yet.</span>
            )}
          </label>
        )}

        <label className="field">
          <span className="field-label">Back by</span>
          <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          <span className="field-hint">
            Optional. A date that goes by shows on their side as missed, not failed.
          </span>
        </label>
      </div>

      {by === 'email' && (
        <label className="field ca-emails">
          <span className="field-label">Email addresses</span>
          <textarea
            rows={4}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Paste them in, separated by commas, spaces or new lines"
            disabled={busy}
          />
          <span className="field-hint">
            Matched against your own applicants. Anything that matches nobody is listed below
            rather than quietly dropped.
          </span>
        </label>
      )}

      {/* Addresses that matched nobody, named. A recruiter who pastes forty
          and is told "sent to 38" cannot tell which two never arrived. */}
      {unmatched.length > 0 && (
        <p className="alert alert-warn ca-unmatched">
          <b>
            {unmatched.length} address{unmatched.length === 1 ? '' : 'es'} matched nobody who has
            applied to you:
          </b>{' '}
          {unmatched.join(', ')}
        </p>
      )}

      {all === null && <p className="muted">Loading your applicants…</p>}

      {all !== null && shown.length === 0 && (
        <p className="muted">
          {by === 'email'
            ? 'Nobody matched yet.'
            : 'Nobody there is still in the running — choose another.'}
        </p>
      )}

      {shown.length > 0 && (
        <>
          <div className="ca-pick-all">
            <button
              type="button"
              className="link-btn"
              onClick={() =>
                setPicked(picked.size === shown.length ? new Set() : new Set(shown.map((p) => p.id)))
              }
            >
              {picked.size === shown.length ? 'Clear all' : `Select all ${shown.length}`}
            </button>
            <span className="muted">{picked.size} chosen</span>
          </div>

          <ul className="ca-pick">
            {shown.map((p) => (
              <li key={p.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={picked.has(p.id)}
                    onChange={() => toggle(p.id)}
                    disabled={busy}
                  />
                  <span className="ca-pick-who">
                    <b>{p.name}</b>
                    <small>
                      {[
                        /* Which role the test will be filed against, and how
                           many others they are in for - one test, whichever
                           way they were chosen. */
                        p.alsoOn.length > 0
                          ? `${p.jobTitle} +${p.alsoOn.length} more role${
                              p.alsoOn.length === 1 ? '' : 's'
                            }`
                          : p.jobTitle,
                        p.collegeName,
                        p.batchName,
                        p.cgpa ? `CGPA ${p.cgpa}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </small>
                  </span>
                  <span className="pill pill-idle">{p.status.replace(/_/g, ' ')}</span>
                </label>
              </li>
            ))}
          </ul>

          <div className="btn-row">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || picked.size === 0}
              onClick={() => void send()}
            >
              {busy ? 'Sending…' : `Send it to ${picked.size}`}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

/** One person who has it, and the result if it has come back. */
function Person({
  r,
  onDone,
  onSay,
  onError,
}: {
  r: AssignmentRow;
  onDone: () => void;
  onSay: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [score, setScore] = useState(r.score ?? '');
  const [maxScore, setMaxScore] = useState(r.maxScore ?? '');
  const [feedback, setFeedback] = useState(r.feedback ?? '');
  const [busy, setBusy] = useState(false);

  async function record(status: 'PASSED' | 'FAILED') {
    setBusy(true);
    onError('');
    try {
      await companyAssessmentApi.record(r.id, {
        status,
        score: score === '' ? undefined : Number(score),
        maxScore: maxScore === '' ? undefined : Number(maxScore),
        feedback: feedback.trim() || undefined,
      });
      onSay(`${r.candidate.name} recorded as ${status === 'PASSED' ? 'cleared' : 'not cleared'}.`);
      onDone();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'That did not save.');
    } finally {
      setBusy(false);
    }
  }

  const settled = ['PASSED', 'FAILED'].includes(r.status);

  return (
    <li className={`ca-person is-${r.status.toLowerCase()}`}>
      <div className="ca-person-top">
        <span className="ca-person-who">
          <b>{r.candidate.name}</b>
          <small>
            {r.application?.jobTitle ?? 'No role attached'}
            {r.attempt > 1 ? ` · attempt ${r.attempt}` : ''}
          </small>
        </span>

        <span className={`pill ${r.status === 'PASSED' ? 'pill-pass' : r.status === 'FAILED' || r.status === 'MISSED' ? 'pill-stop' : 'pill-hold'}`}>
          {SAID[r.status] ?? r.status}
        </span>

        {r.dueAt && <span className="ca-person-due">by {shortDate(r.dueAt)}</span>}
      </div>

      {/* What they came back with. It is the only evidence there is until
          somebody looks it up on the platform, so it is shown in full. */}
      {r.submittedRef && (
        <p className="ca-ref">
          Sent <code>{r.submittedRef}</code>
          {r.submittedAt ? ` on ${shortDate(r.submittedAt)}` : ''}
        </p>
      )}

      {r.status === 'SUBMITTED' && (
        <div className="ca-mark">
          <label>
            <span>Score</span>
            <input
              type="number"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="72"
              disabled={busy}
            />
          </label>
          <label>
            <span>Out of</span>
            <input
              type="number"
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value)}
              placeholder="100"
              disabled={busy}
            />
          </label>
          <label className="is-wide">
            <span>What you would tell them</span>
            <input
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Strong on quant, slower on logical."
              disabled={busy}
            />
          </label>

          <div className="btn-row">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy}
              onClick={() => void record('PASSED')}
            >
              Cleared
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy}
              onClick={() => void record('FAILED')}
            >
              Not cleared
            </button>
          </div>
        </div>
      )}

      {settled && (r.score !== null || r.feedback) && (
        <p className="ca-result">
          {r.score !== null && (
            <b>
              {r.score}
              {r.maxScore ? ` / ${r.maxScore}` : ''}
            </b>
          )}
          {r.feedback && <span>{r.feedback}</span>}
        </p>
      )}
    </li>
  );
}
