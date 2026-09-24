import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import CampusLayout from './CampusLayout';
import { postingApi, type PostingDetail } from '../../api/campus';
import {
  ACCOMMODATION_LABELS,
  CTC_INCLUDE_LABELS,
  EMPLOYER_LABELS,
  GENDER_LABELS,
  OFFER_CONDITION_LABELS,
  PWD_LABELS,
  SHIFT_LABELS,
  TRAVEL_LABELS,
} from '../../api/jobs';
import { ApiError } from '../../api/client';
import MapEmbed from '../../components/MapEmbed';
import FeeWarning from '../../components/FeeWarning';
import { REPORT_REASONS, trustApi, type FeeHit, type JobReport } from '../../api/trust';
import { useAuth } from '../../auth/AuthContext';

const ROUND_LABELS: Record<string, string> = {
  RESUME_SCREEN: 'Resume screen',
  MCQ_TEST: 'Online test',
  VIDEO_INTERVIEW: 'Recorded interview',
  LIVE_INTERVIEW: 'Live interview',
  GROUP_DISCUSSION: 'Group discussion',
  ASSIGNMENT: 'Assignment',
  WORK_SIMULATION: 'Work simulation',
};

export default function JobRequestDetail() {
  const { id = '' } = useParams();
  const [p, setP] = useState<PostingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');

  const refresh = useCallback(async () => {
    try {
      setP(await postingApi.get(id));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this request.');
    }
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setDeclining(false);
      setReason('');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  if (error && !p) {
    return (
      <CampusLayout>
        <p className="alert alert-error">{error}</p>
        <p className="crumb">
          <Link to="/campus/requests">← All job requests</Link>
        </p>
      </CampusLayout>
    );
  }

  if (!p) {
    return (
      <CampusLayout>
        <p className="muted">Loading…</p>
      </CampusLayout>
    );
  }

  const j = p.job;
  const pending = p.status === 'PENDING';

  const criteria = [
    j.minCgpa && `CGPA ${j.minCgpa} or above`,
    j.minTenthPct && `10th ${j.minTenthPct}%+`,
    j.minTwelfthPct && `12th ${j.minTwelfthPct}%+`,
    j.maxBacklogs !== null && `at most ${j.maxBacklogs} backlogs`,
    j.allowedCourses.length > 0 && j.allowedCourses.join(', '),
    j.graduationYears.length > 0 && `graduating ${j.graduationYears.join(', ')}`,
  ].filter(Boolean) as string[];

  return (
    <CampusLayout>
      <p className="crumb">
        <Link to="/campus/requests">← All job requests</Link>
      </p>

      <header className="page-head">
        <div>
          <p className="eyebrow">
            {j.company.name}
            {!j.company.isVerified && ' · not verified'}
          </p>
          <h1>{j.title}</h1>
          <p className="page-lede">
            Requested for <b>{p.placement.name}</b> · apply by{' '}
            {new Date(j.deadline).toLocaleDateString()}
            {j.location ? ` · ${j.location}` : ''}
          </p>
        </div>
        {!pending && (
          <span className={`pill ${p.status === 'ACCEPTED' ? 'pill-pass' : 'pill-stop'}`}>
            {p.status}
          </span>
        )}
      </header>

      {error && <p className="alert alert-error">{error}</p>}

      {!pending && (
        <p className={p.status === 'ACCEPTED' ? 'alert alert-ok' : 'alert alert-warn'}>
          <b>
            {p.status === 'ACCEPTED' ? 'Accepted' : 'Declined'}
            {p.decidedBy ? ` by ${p.decidedBy}` : ''}
            {p.decidedAt ? ` on ${new Date(p.decidedAt).toLocaleDateString()}` : ''}.
          </b>{' '}
          {p.status === 'ACCEPTED'
            ? 'Eligible students in this drive can see and apply to this role.'
            : p.declineReason}
        </p>
      )}

      <div className="stat-row">
        <div className="stat">
          <p className="stat-value">{p.eligibleCount}</p>
          <p className="stat-label">Students who would see it</p>
        </div>
        <div className="stat">
          <p className="stat-value">{j.rounds.length}</p>
          <p className="stat-label">Hiring rounds</p>
        </div>
        <div className="stat">
          <p className="stat-value">{p.placement.batches.length}</p>
          <p className="stat-label">Batches in this drive</p>
        </div>
      </div>

      {pending && p.eligibleCount === 0 && (
        <p className="alert alert-warn">
          No verified student in this drive meets the criteria, so accepting would show this role to
          nobody. Verify more students first, or decline it.
        </p>
      )}

      <TrustSignals jobId={j.id} />

      {pending && (
        <section className="card decide">
          <h2>Your decision</h2>
          <p className="muted">
            Accept and eligible students see it immediately. Decline and it never appears — the
            recruiter is told why.
          </p>

          {declining ? (
            <>
              <label className="field">
                <span className="field-label">Why are you declining?</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  autoFocus
                  placeholder="The CTC is below our floor for this batch."
                  disabled={busy}
                />
              </label>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || reason.trim().length < 3}
                  onClick={() => act(() => postingApi.decline(p.id, reason))}
                >
                  {busy ? 'Sending…' : 'Send decline'}
                </button>
                <button type="button" className="link-btn" onClick={() => setDeclining(false)}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => act(() => postingApi.accept(p.id))}
              >
                Accept for {p.placement.name}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => setDeclining(true)}
              >
                Decline
              </button>
            </div>
          )}
        </section>
      )}

      <section className="card">
        <h2>The role</h2>
        <p className="prose">{j.description}</p>
        {j.responsibilities && (
          <>
            <h3 className="sub-heading">Responsibilities</h3>
            <p className="prose">{j.responsibilities}</p>
          </>
        )}
        <dl className="facts-grid">
          <Fact label="Type" value={j.jobTypeLabel ?? j.jobType.replace('_', ' ').toLowerCase()} />
          <Fact
            label={j.payPeriod === 'MONTHLY' ? 'Monthly' : 'CTC'}
            value={
              j.ctcMin || j.ctcMax
                ? j.payPeriod === 'MONTHLY'
                  ? // Quoted per month, so shown per month - converted to
                    // lakhs it reads as a number nobody wrote down.
                    `₹${j.ctcMin ? Math.round(Number(j.ctcMin) / 12).toLocaleString('en-IN') : '?'} – ₹${
                      j.ctcMax ? Math.round(Number(j.ctcMax) / 12).toLocaleString('en-IN') : '?'
                    } a month`
                  : `₹${j.ctcMin ? (Number(j.ctcMin) / 100000).toFixed(1) : '?'}L – ₹${
                      j.ctcMax ? (Number(j.ctcMax) / 100000).toFixed(1) : '?'
                    }L`
                : 'Not stated'
            }
          />
          <Fact label="Openings" value={j.openings !== null ? String(j.openings) : 'Not stated'} />
          <Fact
            label="Fixed"
            value={
              j.ctcFixed
                ? `₹${(Number(j.ctcFixed) / 100000).toFixed(1)}L`
                : 'Not broken out'
            }
          />
          <Fact
            label="Bond"
            value={
              j.bondMonths
                ? `${j.bondMonths} months${
                    j.bondAmount ? ` · ₹${Number(j.bondAmount).toLocaleString('en-IN')}` : ''
                  }`
                : 'None'
            }
          />
          <Fact label="Rounds" value={String(j.rounds.length)} />
        </dl>

        {j.bondNote && (
          <p className="muted">
            <b>Bond terms:</b> {j.bondNote}
          </p>
        )}
      </section>

      {/*
        What a placement cell asks about every offer before it lets a company
        near its students - who employs them, when the letter comes, what can
        cancel it, and whether anybody pays anything.
      */}
      <section className="card">
        <h2>The offer</h2>
        {j.employerType === 'THIRD_PARTY' && (
          <p className="alert alert-warn">
            <b>Third-party payroll.</b> Students would be employed by {j.employerName ?? 'a staffing agency'}, not by
            the company posting the role.
          </p>
        )}
        {!j.noFeeDeclaredAt && (
          <p className="alert alert-warn">The company has not declared that the process is free for students.</p>
        )}
        <dl className="facts-grid">
          <Fact
            label="Employer"
            value={
              j.employerType === 'DIRECT'
                ? 'Direct hire'
                : j.employerType
                  ? `${EMPLOYER_LABELS[j.employerType]}: ${j.employerName ?? '—'}`
                  : 'Not stated'
            }
          />
          <Fact label="Designation" value={j.designation ?? 'Not stated'} />
          <Fact label="Sector" value={j.sector ?? 'Not stated'} />
          <Fact
            label="Offer letter"
            value={j.offerLetterDays !== null ? `Within ${j.offerLetterDays} days of results` : 'Not stated'}
          />
          <Fact label="Results" value={j.resultDays !== null ? `Within ${j.resultDays} days` : 'Not stated'} />
          <Fact
            label="Conditional"
            value={
              j.offerConditional === 'YES'
                ? [
                    ...(j.offerConditions ?? []).map((k) => OFFER_CONDITION_LABELS[k] ?? k),
                    ...(j.offerConditionNote ? [j.offerConditionNote] : []),
                  ].join(', ')
                : j.offerConditional === 'NO'
                  ? 'No'
                  : 'Not stated'
            }
          />
          {j.probationMonths ? <Fact label="Probation" value={`${j.probationMonths} months`} /> : null}
          {j.trainingMonths ? (
            <Fact
              label="Training"
              value={`${j.trainingMonths} months${j.trainingLocation ? ` in ${j.trainingLocation}` : ''}`}
            />
          ) : null}
          {(j.ctcIncludes ?? []).length > 0 && (
            <Fact label="CTC includes" value={(j.ctcIncludes ?? []).map((k) => CTC_INCLUDE_LABELS[k] ?? k).join(', ')} />
          )}
          <Fact
            label="No-fee declaration"
            value={j.noFeeDeclaredAt ? `Made ${new Date(j.noFeeDeclaredAt).toLocaleDateString()}` : 'Not made'}
          />
        </dl>
        {j.nightShiftSafety && (
          <p className="muted">
            <b>Night-shift arrangements:</b> {j.nightShiftSafety}
          </p>
        )}
      </section>

      {/*
        A role closed to one gender hides from every other student, which the
        college answers for. It is shown first here, with the company's
        reason, so it is decided on rather than discovered.
      */}
      {(j.genderEligibility !== 'ANY' || j.pwdSuitable || j.shift || j.travel || j.relocationRequired) && (
        <section className="card">
          <h2>Who it is open to, and what the work is like</h2>
          {(j.genderEligibility === 'WOMEN' || j.genderEligibility === 'MEN') && (
            <p className="alert alert-warn">
              <b>{GENDER_LABELS[j.genderEligibility]}.</b> Accepting this hides the role from every student
              who is not recorded as {j.genderEligibility === 'WOMEN' ? 'female' : 'male'}.
              {j.genderNote ? ` The company's reason: “${j.genderNote}”` : ''}
            </p>
          )}
          <dl className="facts-grid">
            {j.genderEligibility === 'WOMEN_PREFERRED' && (
              <Fact label="Gender" value={`Women preferred${j.genderNote ? ` — ${j.genderNote}` : ''}`} />
            )}
            <Fact
              label="Persons with disabilities"
              value={
                j.pwdSuitable === 'YES'
                  ? `Suitable: ${(j.pwdCategories ?? []).map((k) => PWD_LABELS[k] ?? k).join(', ')}`
                  : j.pwdSuitable === 'NO'
                    ? 'Not suitable'
                    : 'Not assessed'
              }
            />
            {j.pwdSuitable === 'YES' && (j.accommodations ?? []).length > 0 && (
              <Fact
                label="Support offered"
                value={(j.accommodations ?? []).map((k) => ACCOMMODATION_LABELS[k] ?? k).join(', ')}
              />
            )}
            {j.shift && <Fact label="Shifts" value={SHIFT_LABELS[j.shift] ?? j.shift} />}
            {j.travel && <Fact label="Travel" value={TRAVEL_LABELS[j.travel] ?? j.travel} />}
            {j.relocationRequired && <Fact label="Relocation" value="Required" />}
          </dl>
          {j.inclusionNote && <p className="muted">{j.inclusionNote}</p>}
        </section>
      )}

      {/*
        What the company will ask of a student before they can apply.
        The placement cell fields the complaints about both of these, so it
        sees them before it puts the role in front of anybody.
      */}
      {(j.terms.length > 0 || j.screeningTestUrl) && (
        <section className="card">
          <h2>What students have to agree to</h2>

          {j.screeningTestUrl && (
            <>
              <h3 className="sub-heading">
                {j.screeningTestName ?? 'A test before applying'}{' '}
                {j.screeningTestRequired ? (
                  <span className="pill pill-hold">Required to apply</span>
                ) : (
                  <span className="pill pill-idle">Optional</span>
                )}
              </h3>
              <p className="muted">
                Hosted by the company.
                {j.screeningTestDeadline &&
                  ` Closes ${new Date(j.screeningTestDeadline).toLocaleDateString()}.`}
              </p>
            </>
          )}

          {j.terms.length > 0 && (
            <>
              <h3 className="sub-heading">Conditions of the role</h3>
              <p className="muted">
                Not open to negotiation. Every applicant accepts these before applying, and the
                date is kept on their application.
              </p>
              <ol className="prose">
                {j.terms.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ol>
            </>
          )}
        </section>
      )}

      <section className="card">
        <h2>Who can apply</h2>
        {criteria.length === 0 ? (
          <p className="muted">No criteria — open to every verified student in this drive.</p>
        ) : (
          <ul className="criteria-list">
            {criteria.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        )}
      </section>

      {(j.addressLine || j.mapEmbedUrl || j.mapsLink) && (
        <section className="card">
          <h2>Where the work is</h2>
          {j.addressLine && (
            <p className="prose">
              {j.addressLine}
              {j.location ? `, ${j.location}` : ''}
              {j.pincode ? ` ${j.pincode}` : ''}
            </p>
          )}
          {j.mapEmbedUrl && (
            <MapEmbed
              embedUrl={j.mapEmbedUrl}
              mapsLink={j.mapsLink}
              label={j.addressLine ?? j.location ?? 'the office'}
              height={180}
            />
          )}
        </section>
      )}

      <section className="card">
        <h2>Hiring rounds</h2>
        <ol className="round-preview">
          {j.rounds.map((r) => (
            <li key={r.id}>
              <span className="round-order">{r.order}</span>
              <span className="round-detail">
                <b>{r.name}</b>
                <span className="check-sub">
                  {r.typeLabel ?? ROUND_LABELS[r.type] ?? r.type}
                  {r.isElimination ? ' · eliminates' : ' · non-eliminating'}
                </span>

                {/*
                  The dates and venues the cell has to book a hall around, and
                  tell a batch to turn up for.
                */}
                {(r.scheduledAt || r.modeLabel || r.venue || r.durationMin) && (
                  <span className="round-facts">
                    {r.scheduledAt && (
                      <span>
                        {new Date(r.scheduledAt).toLocaleDateString()} ·{' '}
                        {new Date(r.scheduledAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                    {r.modeLabel && <span>{r.modeLabel}</span>}
                    {r.venue && <span>{r.venue}</span>}
                    {r.durationMin && <span>{r.durationMin} min</span>}
                    {r.shortlistCount && <span>{r.shortlistCount} go through</span>}
                  </span>
                )}

                {r.description && <span className="round-about-text">{r.description}</span>}
                {/*
                  What a student does with this round: turn up, or open a
                  link. The map only appears once the address was looked up -
                  an empty map reads as a wrong address rather than an
                  unchecked one.
                */}
                {r.isOnline && r.meetingLink && (
                  <a
                    className="round-link"
                    href={r.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Join the meeting ↗
                  </a>
                )}
                {r.isOnline && !r.meetingLink && (
                  <span className="check-sub">Online. The link comes closer to the date.</span>
                )}
                {!r.isOnline && r.addressLine && (
                  <span className="round-about-text">
                    {r.addressLine}
                    {r.pincode ? ` ${r.pincode}` : ''}
                  </span>
                )}
                {!r.isOnline && r.mapEmbedUrl && (
                  <MapEmbed
                    embedUrl={r.mapEmbedUrl}
                    mapsLink={r.mapsLink}
                    label={r.addressLine ?? r.name}
                    height={150}
                  />
                )}
                {!r.isOnline && !r.mapEmbedUrl && r.mapsLink && (
                  <a
                    className="round-link"
                    href={r.mapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Get directions ↗
                  </a>
                )}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {j.company.about && (
        <section className="card">
          <h2>About {j.company.name}</h2>
          <p className="prose">{j.company.about}</p>
          {j.company.website && (
            <a className="entry-link" href={j.company.website} target="_blank" rel="noreferrer">
              {j.company.website}
            </a>
          )}
        </section>
      )}
    </CampusLayout>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/**
 * What the college should know before it decides: any sentence in the role
 * asking students to pay, and what its own students have reported about it.
 *
 * Shown above the decision on purpose - it is information for the decision,
 * not something to find after it. Nothing here appears when there is nothing
 * to say, so a clean role costs no space.
 */
function TrustSignals({ jobId }: { jobId: string }) {
  const { hasModule, can } = useAuth();
  const enabled = hasModule('trust.scamShield');
  const [hits, setHits] = useState<FeeHit[]>([]);
  const [reports, setReports] = useState<JobReport[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    trustApi
      .signals(jobId)
      .then((r) => {
        setHits(r.hits);
        setReports(r.reports);
      })
      .catch(() => undefined);
  }, [enabled, jobId]);

  if (!enabled || (hits.length === 0 && reports.length === 0)) return null;

  async function review(id: string, status: 'REVIEWED' | 'DISMISSED') {
    setError(null);
    try {
      const updated = await trustApi.review(id, status);
      setReports((rs) => rs.map((r) => (r.id === id ? updated : r)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update that report.');
    }
  }

  const reasonLabel = (v: string) => REPORT_REASONS.find((r) => r.value === v)?.label ?? v;
  const open = reports.filter((r) => r.status === 'OPEN').length;

  return (
    <section className="card">
      <h2>Before you decide</h2>

      <FeeWarning hits={hits} title="This role mentions a payment by the student.">
        Genuine employers do not charge the people they hire. Ask the company about these lines before accepting.
      </FeeWarning>

      {reports.length > 0 && (
        <>
          <h3 className="sub-heading">
            Reported by your students
            {open > 0 && <span className="pill pill-stop">{open} open</span>}
          </h3>
          <ul className="report-list">
            {reports.map((r) => (
              <li key={r.id}>
                <p>
                  <b>{reasonLabel(r.reason)}</b> · {r.studentName} ·{' '}
                  <span className="muted">{new Date(r.createdAt).toLocaleDateString()}</span>
                  {r.status !== 'OPEN' && <span className="pill pill-idle">{r.status.toLowerCase()}</span>}
                </p>
                {r.note && <p className="muted">“{r.note}”</p>}
                {r.status === 'OPEN' && can('posting:decide') && (
                  <div className="btn-row">
                    <button type="button" className="btn btn-secondary" onClick={() => review(r.id, 'REVIEWED')}>
                      Mark as looked into
                    </button>
                    <button type="button" className="link-btn" onClick={() => review(r.id, 'DISMISSED')}>
                      Dismiss
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {error && <p className="alert alert-error">{error}</p>}
    </section>
  );
}
