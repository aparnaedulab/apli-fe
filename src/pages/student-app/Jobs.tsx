import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { studentJobsApi, type JobCard, type MyApplication } from '../../api/candidate';
import { INVITE_STATUS, studentInviteApi, type StudentInvite } from '../../api/interviewInvites';
import { studentAppApi } from '../../api/studentApp';
import { dateText, OFFER_STATUS, offersApi, placeText, stipendText, type StudentOffer } from '../../api/offers';
import Shell, { CompanyTile } from './Shell';

const message = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

/** What a job pays, in a line: "₹16-19 LPA", or "₹75,000/month · 2 months". */
export function payText(j: { jobType: string; ctcMin: string | null; ctcMax: string | null; stipend?: string | null; stipendPerMonth?: string | null; internshipMonths?: number | null }) {
  const lakhs = (v: string | null) => (v === null ? null : Number(v) / 100_000);
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  const stipend = j.stipend ?? j.stipendPerMonth ?? null;
  if (stipend) {
    return `₹${Number(stipend).toLocaleString('en-IN')}/month${j.internshipMonths ? ` · ${j.internshipMonths} month${j.internshipMonths === 1 ? '' : 's'}` : ''}`;
  }
  const lo = lakhs(j.ctcMin);
  const hi = lakhs(j.ctcMax);
  if (lo && hi && lo !== hi) return `₹${fmt(lo)}–${fmt(hi)} LPA`;
  if (lo ?? hi) return `₹${fmt((lo ?? hi)!)} LPA`;
  return 'Pay on request';
}

/** Where an application stands, in the student's words. */
export const APP_STATUS: Record<string, { label: string; tone: string }> = {
  APPLIED: { label: 'Applied', tone: 'is-review' },
  UNDER_REVIEW: { label: 'Being reviewed', tone: 'is-review' },
  SHORTLISTED: { label: 'Shortlisted', tone: 'is-working' },
  IN_ROUND: { label: 'In selection rounds', tone: 'is-working' },
  WAITLISTED: { label: 'Waitlisted', tone: 'is-review' },
  OFFERED: { label: 'Offer made', tone: 'is-verified' },
  ACCEPTED: { label: 'Offer accepted', tone: 'is-verified' },
  HIRED: { label: 'Hired', tone: 'is-verified' },
  DECLINED: { label: 'You declined', tone: '' },
  REJECTED: { label: 'Not shortlisted', tone: 'is-changes' },
  WITHDRAWN: { label: 'Withdrawn', tone: '' },
};

const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
const typeLabel = (t: string) => (t === 'INTERNSHIP' ? 'Internship' : t === 'FULL_TIME' ? 'Full-time' : t.replace(/_/g, ' ').toLowerCase());

type Tab = 'browse' | 'applications' | 'offers';

/**
 * Jobs, in three places: jobs open to this student (posted to their
 * college's drives, and that they are eligible for), what they have applied
 * to and how far each has got, and internship offers made from their work.
 */
export default function Jobs() {
  const [params, setParams] = useSearchParams();
  const tab = (['browse', 'applications', 'offers'].includes(params.get('tab') ?? '') ? params.get('tab') : 'browse') as Tab;
  const [jobs, setJobs] = useState<{ canApply: boolean; blockedReason: string | null; jobs: JobCard[] } | null>(null);
  const [apps, setApps] = useState<MyApplication[] | null>(null);
  const [invites, setInvites] = useState<StudentInvite[]>([]);
  const [offers, setOffers] = useState<StudentOffer[] | null>(null);
  const [certCompanies, setCertCompanies] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'all' | 'FULL_TIME' | 'INTERNSHIP'>('all');
  const [city, setCity] = useState('');
  const [mineOnly, setMineOnly] = useState(false);

  useEffect(() => {
    studentJobsApi
      .list()
      .then(setJobs)
      .catch((e) => setError(message(e, 'Could not load jobs.')));
    studentJobsApi
      .applications()
      .then(setApps)
      .catch(() => setApps([]));
    studentInviteApi
      .list()
      .then(setInvites)
      .catch(() => setInvites([]));
    offersApi
      .mine()
      .then(setOffers)
      .catch(() => setOffers([]));
    studentAppApi
      .dashboard()
      .then((d) => setCertCompanies(new Set(d.certificates.map((c) => c.simulation.company.name))))
      .catch(() => undefined);
  }, []);

  const all = jobs?.jobs ?? [];
  const cities = [...new Set(all.map((j) => j.location).filter(Boolean) as string[])].sort();
  const shown = all.filter(
    (j) =>
      (kind === 'all' || j.jobType === kind) &&
      (!city || j.location === city) &&
      (!mineOnly || certCompanies.has(j.companyName)) &&
      (!q.trim() || `${j.title} ${j.companyName}`.toLowerCase().includes(q.trim().toLowerCase())),
  );
  const openOffers = offers?.filter((o) => o.status === 'SENT').length ?? 0;
  const activeApps = apps?.filter((a) => !['REJECTED', 'WITHDRAWN', 'DECLINED'].includes(a.status)).length ?? 0;
  const go = (t: Tab) => setParams(t === 'browse' ? {} : { tab: t });

  return (
    <Shell>
      <section className="sa-hero is-short">
        <div className="sa-wrap">
          <p className="sa-eyebrow">Jobs</p>
          <h1>
            Jobs and internships <span className="sa-mark">open to you</span>
          </h1>
          <p className="sa-lede">
            Roles posted to your college that you are eligible for. Apply in one click, then follow every round here.
          </p>
          <div className="jb-tabs" role="tablist" aria-label="Jobs">
            <button type="button" role="tab" aria-selected={tab === 'browse'} className={tab === 'browse' ? 'is-on' : ''} onClick={() => go('browse')}>
              Jobs for you {jobs ? <span>{all.length}</span> : null}
            </button>
            <button type="button" role="tab" aria-selected={tab === 'applications'} className={tab === 'applications' ? 'is-on' : ''} onClick={() => go('applications')}>
              My applications {apps?.length ? <span>{activeApps}</span> : null}
            </button>
            <button type="button" role="tab" aria-selected={tab === 'offers'} className={tab === 'offers' ? 'is-on' : ''} onClick={() => go('offers')}>
              Internship offers {openOffers ? <span className="is-alert">{openOffers}</span> : null}
            </button>
          </div>
        </div>
      </section>

      <div className="sa-wrap sa-body">
        {error && <p className="sa-alert">{error}</p>}

        {tab === 'browse' && (
          <>
            {jobs && !jobs.canApply && jobs.blockedReason && <p className="sa-alert">{jobs.blockedReason}</p>}
            <div className="jb-filters">
              <input
                className="jb-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search a role or a company"
                aria-label="Search jobs"
              />
              <div className="jb-seg" role="radiogroup" aria-label="Kind of job">
                {(['all', 'FULL_TIME', 'INTERNSHIP'] as const).map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={kind === k} className={kind === k ? 'is-on' : ''} onClick={() => setKind(k)}>
                    {k === 'all' ? 'All' : typeLabel(k)}
                  </button>
                ))}
              </div>
              <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="City">
                <option value="">Any city</option>
                {cities.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              {certCompanies.size > 0 && (
                <label className="jb-mine">
                  <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
                  Companies I have a certificate from
                </label>
              )}
            </div>

            {!jobs && !error && <p className="sa-loading">Loading…</p>}
            {jobs && shown.length === 0 && (
              <p className="sa-empty">
                {all.length === 0
                  ? 'No roles are open to you right now. New ones are posted to your college every week.'
                  : 'Nothing matches those filters.'}
              </p>
            )}
            <ul className="jb-grid">
              {shown.map((j) => {
                const left = daysLeft(j.deadline);
                const st = j.applicationStatus ? APP_STATUS[j.applicationStatus] : null;
                const known = certCompanies.has(j.companyName);
                return (
                  <li key={j.id}>
                    <Link to={`/student/jobs/${j.id}`} className={`jb-card ${known ? 'is-known' : ''}`}>
                      <span className="jb-card-top">
                        <CompanyTile company={j.company ?? { id: j.companyName, name: j.companyName, logoUrl: null }} />
                        <span className="jb-card-who">
                          <b>{j.title}</b>
                          <i>{j.companyName}</i>
                        </span>
                        {st && <span className={`sa-status ${st.tone}`}>{st.label}</span>}
                      </span>
                      <span className="jb-chips">
                        <span className={`jb-chip ${j.jobType === 'INTERNSHIP' ? 'is-intern' : ''}`}>{typeLabel(j.jobType)}</span>
                        {j.location && <span className="jb-chip">{j.location}</span>}
                        {j.workMode && <span className="jb-chip">{j.workMode}</span>}
                      </span>
                      <span className="jb-pay">{payText(j)}</span>
                      {known && <span className="jb-known">✓ You have a certificate from {j.companyName}</span>}
                      <span className="jb-foot">
                        <span className={left <= 5 ? 'is-soon' : ''}>{left <= 0 ? 'Closes today' : `Closes in ${left} day${left === 1 ? '' : 's'}`}</span>
                        <span>
                          {j.applicants} applied · {j.roundCount} round{j.roundCount === 1 ? '' : 's'}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {tab === 'applications' && (
          <>
            {!apps && <p className="sa-loading">Loading…</p>}
            {apps && apps.length === 0 && (
              <div className="sa-empty jb-empty">
                <b>No applications yet</b>
                <span>Find a role under Jobs for you and apply - every stage of it shows up here.</span>
                <button type="button" className="sa-btn" onClick={() => go('browse')}>
                  Browse jobs
                </button>
              </div>
            )}
            <ul className="jb-apps">
              {(apps ?? []).map((a) => {
                const st = APP_STATUS[a.status] ?? { label: a.status, tone: '' };
                const inv = invites.find((v) => v.company.name === a.companyName && v.role === a.title && v.status !== 'WITHDRAWN');
                const rounds = inv?.process.rounds ?? [];
                return (
                  <li key={a.id} className="jb-app">
                    <div className="jb-app-head">
                      <CompanyTile company={{ id: a.companyName, name: a.companyName, logoUrl: null }} />
                      <div>
                        <Link to={`/student/jobs/${a.jobId}`} className="jb-app-title">
                          {a.title}
                        </Link>
                        <span>
                          {a.companyName} · applied {new Date(a.appliedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <span className={`sa-status ${st.tone}`}>{inv ? INVITE_STATUS[inv.status].label : st.label}</span>
                    </div>
                    {/* Where it has got to: applied, reviewed, shortlisted, then each interview round. */}
                    <ol className="jb-track">
                      <li className="is-done">Applied</li>
                      <li className={a.status !== 'APPLIED' ? 'is-done' : 'is-now'}>Reviewed</li>
                      {a.status === 'REJECTED' ? (
                        <li className="is-stop">Not shortlisted</li>
                      ) : (
                        <>
                          <li className={inv || ['SHORTLISTED', 'IN_ROUND', 'OFFERED', 'ACCEPTED', 'HIRED'].includes(a.status) ? 'is-done' : ''}>Shortlisted</li>
                          {rounds.map((r) => {
                            const fb = inv?.roundFeedbacks.find((f) => f.roundOrder === r.order);
                            const now = inv?.status === 'ACCEPTED' && inv.currentRoundOrder === r.order && !fb;
                            return (
                              <li key={r.order} className={fb?.outcome === 'FAILED' ? 'is-stop' : fb ? 'is-done' : now ? 'is-now' : ''}>
                                {r.name}
                              </li>
                            );
                          })}
                          {inv?.status === 'OFFERED' && <li className="is-done">Cleared every round</li>}
                        </>
                      )}
                    </ol>
                    {inv && (
                      <p className="jb-app-next">
                        {inv.status === 'PENDING' ? (
                          <>
                            <b>{a.companyName} invited you to interview.</b>{' '}
                            <Link to="/student/interviews" className="sa-link">
                              Accept or decline →
                            </Link>
                          </>
                        ) : inv.status === 'ACCEPTED' ? (
                          <>
                            Interviewing - round {inv.currentRoundOrder} of {rounds.length}.{' '}
                            <Link to="/student/interviews" className="sa-link">
                              Go to your interview →
                            </Link>
                          </>
                        ) : null}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {tab === 'offers' && (
          <>
            {!offers && <p className="sa-loading">Loading…</p>}
            {offers && offers.length > 0 && (
              <ul className="of-cards">
                {offers.map((o) => (
                  <OfferCard key={o.id} offer={o} onChange={setOffers} />
                ))}
              </ul>
            )}
            {offers && offers.length === 0 && (
              <section className="sa-panel sa-soon">
                <h2>No offers yet</h2>
                <p>
                  Companies offer internships to students whose work they have seen. Finish a simulation and share it with
                  them.
                </p>
                <Link to="/student/simulations" className="sa-btn">
                  Find a simulation <span aria-hidden="true">→</span>
                </Link>
              </section>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}

function OfferCard({ offer: o, onChange }: { offer: StudentOffer; onChange: (o: StudentOffer[]) => void }) {
  const [answering, setAnswering] = useState<'accept' | 'decline' | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const st = OFFER_STATUS[o.status];

  async function answer() {
    if (!answering) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await offersApi.respond(o.id, answering, note.trim() || undefined));
    } catch (e) {
      setError(message(e, 'Could not send your answer.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={`of-card ${o.status === 'SENT' ? 'is-open' : ''}`}>
      <div className="of-card-head">
        <CompanyTile company={{ id: o.company.name, name: o.company.name, logoUrl: o.company.logoUrl }} />
        <div>
          <h2>{o.role}</h2>
          <p>
            {o.company.name}
            {o.simulation && (
              <>
                {' '}
                · from your work on{' '}
                <Link to={`/student/simulations/${o.simulation.slug}`} className="sa-link">
                  {o.simulation.title}
                </Link>
              </>
            )}
          </p>
        </div>
        <span className={`sa-status ${st.tone}`}>{st.label}</span>
      </div>

      <dl className="sa-facts">
        <div>
          <dt>Where</dt>
          <dd>{placeText(o)}</dd>
        </div>
        <div>
          <dt>How long</dt>
          <dd>
            {o.months} month{o.months === 1 ? '' : 's'}
            {o.startsOn ? `, from ${dateText(o.startsOn)}` : ''}
          </dd>
        </div>
        <div>
          <dt>Stipend</dt>
          <dd>{stipendText(o.stipend)}</dd>
        </div>
        <div>
          <dt>{o.respondedAt ? 'You answered' : 'Reply by'}</dt>
          <dd>{dateText(o.respondedAt ?? o.respondBy)}</dd>
        </div>
      </dl>

      <p className="of-about">{o.about}</p>
      <p className="of-fee">
        <span aria-hidden="true">✓</span> {o.company.name} has promised you pay nothing to take this internship. If anyone
        asks you for money, do not pay - tell Apli.ai.
      </p>

      {o.status === 'SENT' &&
        (answering ? (
          <div className="of-answer">
            <label>
              <span>
                {answering === 'accept' ? 'A note to the company' : 'Tell them why, if you like'} <i>optional</i>
              </span>
              <textarea rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            {error && <p className="sa-alert">{error}</p>}
            <span className="of-answer-actions">
              <button type="button" className={`sa-btn ${answering === 'decline' ? 'is-ghost' : ''}`} disabled={busy} onClick={answer}>
                {busy ? 'Sending…' : answering === 'accept' ? 'Accept the offer' : 'Decline the offer'}
              </button>
              <button type="button" className="sa-quiet" onClick={() => setAnswering(null)} disabled={busy}>
                Back
              </button>
            </span>
          </div>
        ) : (
          <div className="of-answer-actions">
            <button type="button" className="sa-btn" onClick={() => setAnswering('accept')}>
              Accept
            </button>
            <button type="button" className="sa-btn is-ghost" onClick={() => setAnswering('decline')}>
              Decline
            </button>
          </div>
        ))}

      {o.status === 'ACCEPTED' && o.contact && (
        <p className="of-next">
          <b>Next:</b> {o.contact.name} from {o.company.name} will be in touch. You can also write to them at{' '}
          <a href={`mailto:${o.contact.email}`}>{o.contact.email}</a>.
        </p>
      )}
      {o.status === 'LAPSED' && (
        <p className="of-next">The reply date has passed. If you are still interested, write to the company.</p>
      )}
      {o.studentNote && o.status !== 'SENT' && <p className="of-note">You wrote: “{o.studentNote}”</p>}
    </li>
  );
}
