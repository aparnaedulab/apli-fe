import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { studentJobsApi, type StudentJobDetail } from '../../api/candidate';
import { roundIcon } from '../../api/interviewInvites';
import { studentAppApi, type StudentProfile } from '../../api/studentApp';
import { consentApi } from '../../api/consent';
import Shell, { CompanyTile } from './Shell';
import { APP_STATUS, payText } from './Jobs';

const message = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);
const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * One job: what it is, what it pays, whether the student meets what it asks
 * for (checked against their own profile), the selection rounds they will go
 * through, and Apply.
 */
export default function JobDetail() {
  const { id = '' } = useParams();
  const [data, setData] = useState<StudentJobDetail | null>(null);
  const [me, setMe] = useState<StudentProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [testRef, setTestRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [justApplied, setJustApplied] = useState(false);
  // What the student has to agree to first, when their college asks for consent.
  const [needsConsent, setNeedsConsent] = useState<string[] | null>(null);

  const load = () =>
    studentJobsApi
      .get(id)
      .then(setData)
      .catch((e) => setError(message(e, 'This role is not available to you.')));

  useEffect(() => {
    void load();
    studentAppApi
      .profile()
      .then(setMe)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function apply(grant?: string[]) {
    if (!data) return;
    setBusy(true);
    setApplyError(null);
    try {
      if (grant?.length) {
        await consentApi.setMany(Object.fromEntries(grant.map((k) => [k, true])));
        setNeedsConsent(null);
      }
      await studentJobsApi.apply(data.job.id, {
        acceptTerms: data.beforeApplying.terms.length > 0 ? agree : undefined,
        screeningRef: testRef.trim() || undefined,
      });
      setJustApplied(true);
      await load();
    } catch (e) {
      // Their college asks them to agree to sharing their profile first: ask, then apply.
      if (e instanceof ApiError && e.code === 'CONSENT_REQUIRED') {
        const purposes = (e.details as { purposes?: string[] } | undefined)?.purposes ?? [];
        setNeedsConsent(purposes);
      } else {
        setApplyError(message(e, 'Could not send your application.'));
      }
    } finally {
      setBusy(false);
    }
  }

  const j = data?.job;
  const pay = j as (StudentJobDetail['job'] & { stipendPerMonth?: string | null; internshipMonths?: number | null; ppoCtc?: string | null }) | undefined;
  const left = j ? Math.ceil((new Date(j.deadline).getTime() - Date.now()) / 86_400_000) : 0;
  const status = data?.application ? (APP_STATUS[data.application.status] ?? { label: data.application.status, tone: '' }) : null;
  const intern = j?.jobType === 'INTERNSHIP';

  // What the role asks for, ticked against the student's own record.
  const checks: { label: string; ok: boolean | null; have: string }[] = [];
  if (j && me) {
    if (j.allowedCourses.length) {
      checks.push({ label: `Course: ${j.allowedCourses.join(', ')}`, ok: me.course ? j.allowedCourses.includes(me.course) : null, have: me.course ?? 'not on your profile' });
    }
    if (j.minCgpa) {
      checks.push({ label: `CGPA ${Number(j.minCgpa)} or above`, ok: me.cgpa === null ? null : me.cgpa >= Number(j.minCgpa), have: me.cgpa === null ? 'not on your profile' : String(me.cgpa) });
    }
    if (j.graduationYears.length) {
      const year = Number((me.batch ?? '').match(/\d{4}/)?.[0] ?? NaN);
      checks.push({ label: `Graduating in ${j.graduationYears.join(' or ')}`, ok: Number.isNaN(year) ? null : j.graduationYears.includes(year), have: Number.isNaN(year) ? (me.batch ?? '-') : String(year) });
    }
    if (j.maxActiveBacklogs !== null) checks.push({ label: j.maxActiveBacklogs === 0 ? 'No active backlogs' : `At most ${j.maxActiveBacklogs} active backlogs`, ok: true, have: 'as your college records' });
  }

  return (
    <Shell>
      <section className="sa-hero is-short">
        <div className="sa-wrap">
          <Link to="/student/jobs" className="sa-link is-small">
            <span aria-hidden="true">←</span> All jobs
          </Link>
          {j && (
            <div className="jd-head">
              <CompanyTile company={{ id: j.company.id, name: j.company.name, logoUrl: j.company.logoUrl }} big />
              <div>
                <p className="sa-eyebrow">{intern ? 'Internship' : 'Full-time job'}</p>
                <h1>{j.title}</h1>
                <p className="sa-lede">
                  {j.company.name}
                  {j.location ? ` · ${j.location}` : ''}
                  {(j as { workMode?: string | null }).workMode ? ` · ${(j as { workMode?: string | null }).workMode}` : ''}
                </p>
              </div>
              {status && <span className={`sa-status ${status.tone}`}>{status.label}</span>}
            </div>
          )}
        </div>
      </section>

      <div className="sa-wrap sa-body">
        {error && <p className="sa-alert">{error}</p>}
        {!data && !error && <p className="sa-loading">Loading…</p>}

        {j && data && (
          <div className="sa-layout jd-layout">
            <div className="sa-main-col">
              <section className="sa-block">
                <h2>About the role</h2>
                <p className="jd-text">{j.description}</p>
              </section>
              {j.responsibilities && (
                <section className="sa-block">
                  <h2>What you will do</h2>
                  <ul className="jd-list">
                    {j.responsibilities
                      .split('\n')
                      .filter((l) => l.trim())
                      .map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                  </ul>
                </section>
              )}
              <section className="sa-block">
                <h2>How selection works</h2>
                <p className="jd-muted">
                  {j.rounds.length} round{j.rounds.length === 1 ? '' : 's'}. If you are shortlisted, {j.company.name} invites you to
                  interview - it shows up under Interviews, and you follow every round there.
                </p>
                <ol className="jd-rounds">
                  {j.rounds.map((r) => (
                    <li key={r.id}>
                      <span className="jd-round-n">{r.order}</span>
                      <span className="jd-round-icon" aria-hidden="true">
                        {roundIcon(r.type)}
                      </span>
                      <span>
                        <b>{r.name}</b>
                        <i>
                          {r.typeLabel ?? r.type.replace(/_/g, ' ').toLowerCase()}
                          {r.isOnline ? ' · online' : ''}
                          {r.isElimination ? '' : ' · final round'}
                        </i>
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
              {j.company.about && (
                <section className="sa-block">
                  <h2>About {j.company.name}</h2>
                  <p className="jd-text">{j.company.about}</p>
                </section>
              )}
            </div>

            <aside className="sa-aside">
              <section className="sa-panel is-white jd-apply">
                <p className="jd-pay">{payText({ ...j, stipendPerMonth: pay?.stipendPerMonth ?? null, internshipMonths: pay?.internshipMonths ?? null })}</p>
                {intern && pay?.ppoCtc ? (
                  <p className="jd-muted">Full-time offer of ₹{(Number(pay.ppoCtc) / 100_000).toFixed(0)} LPA for strong interns</p>
                ) : null}
                <dl className="jd-facts">
                  <div>
                    <dt>Apply by</dt>
                    <dd className={left <= 5 ? 'is-soon' : ''}>
                      {day(j.deadline)} ({left <= 0 ? 'today' : `${left} day${left === 1 ? '' : 's'} left`})
                    </dd>
                  </div>
                  {j.openings ? (
                    <div>
                      <dt>Openings</dt>
                      <dd>{j.openings}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Applied so far</dt>
                    <dd>{j.applicants}</dd>
                  </div>
                </dl>

                {data.application ? (
                  <div className="jd-applied">
                    <b>{justApplied ? '✓ Application sent' : `You applied on ${day(data.application.appliedAt)}`}</b>
                    <span>
                      {justApplied
                        ? `${j.company.name} has been told. Follow it under My applications.`
                        : `Status: ${status?.label ?? data.application.status}`}
                    </span>
                    <Link to="/student/jobs?tab=applications" className="sa-btn is-ghost is-small is-wide">
                      Track my application
                    </Link>
                  </div>
                ) : data.canApply ? (
                  <div className="jd-applyform">
                    {data.beforeApplying.test?.required && (
                      <label>
                        <span>
                          Take {data.beforeApplying.test.name ?? 'the test'} first, then enter the reference it gives you
                        </span>
                        <a href={data.beforeApplying.test.url} target="_blank" rel="noreferrer" className="sa-link is-small">
                          Open the test ↗
                        </a>
                        <input value={testRef} onChange={(e) => setTestRef(e.target.value)} />
                      </label>
                    )}
                    {data.beforeApplying.terms.length > 0 && (
                      <label className="jd-agree">
                        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                        <span>I accept: {data.beforeApplying.terms.join('; ')}</span>
                      </label>
                    )}
                    {applyError && <p className="sa-alert">{applyError}</p>}
                    {needsConsent ? (
                      <div className="jd-consent">
                        <b>One thing before you apply</b>
                        <span>
                          Allow Apli.ai to share your profile and your college-verified marks with the companies you apply to.
                          You can change this any time in your profile.
                        </span>
                        <button type="button" className="sa-btn is-wide" disabled={busy} onClick={() => void apply(needsConsent)}>
                          {busy ? 'Sending…' : 'Allow and apply'} <span aria-hidden="true">→</span>
                        </button>
                        <button type="button" className="sa-quiet" onClick={() => setNeedsConsent(null)} disabled={busy}>
                          Not now
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="sa-btn is-wide"
                        disabled={busy || (data.beforeApplying.terms.length > 0 && !agree)}
                        onClick={() => void apply()}
                      >
                        {busy ? 'Sending…' : 'Apply now'} <span aria-hidden="true">→</span>
                      </button>
                    )}
                    <span className="jd-muted">Your profile and certificates go to {j.company.name}. Free - you never pay to apply.</span>
                  </div>
                ) : (
                  <p className="sa-alert">{data.blockedReason ?? 'You cannot apply to this role.'}</p>
                )}
              </section>

              {checks.length > 0 && (
                <section className="sa-panel is-white">
                  <h2>Who can apply</h2>
                  <ul className="jd-checks">
                    {checks.map((c) => (
                      <li key={c.label} className={c.ok === false ? 'is-no' : c.ok ? 'is-ok' : ''}>
                        <span aria-hidden="true">{c.ok === false ? '✗' : c.ok ? '✓' : '•'}</span>
                        <span>
                          {c.label}
                          <i>You: {c.have}</i>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </aside>
          </div>
        )}
      </div>
    </Shell>
  );
}
