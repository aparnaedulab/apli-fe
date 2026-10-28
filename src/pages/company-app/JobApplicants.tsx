import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { applicantApi, type ApplicantRow } from '../../api/applications';
import { companyInviteApi, INVITE_STATUS, type CompanyInvite } from '../../api/interviewInvites';
import InviteToInterview from '../../components/InviteToInterview';
import Frame from './Frame';

const msg = (e: unknown, fb: string) => (e instanceof ApiError ? e.message : fb);
const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

const STAGE: Record<string, { label: string; tone: string }> = {
  APPLIED: { label: 'New', tone: 'is-review' },
  UNDER_REVIEW: { label: 'Reviewing', tone: 'is-review' },
  SHORTLISTED: { label: 'Shortlisted', tone: 'is-working' },
  IN_ROUND: { label: 'In rounds', tone: 'is-working' },
  WAITLISTED: { label: 'Waitlisted', tone: '' },
  OFFERED: { label: 'Offered', tone: 'is-verified' },
  ACCEPTED: { label: 'Accepted', tone: 'is-verified' },
  HIRED: { label: 'Hired', tone: 'is-verified' },
  DECLINED: { label: 'Declined', tone: '' },
  REJECTED: { label: 'Not shortlisted', tone: 'is-changes' },
  WITHDRAWN: { label: 'Withdrawn', tone: '' },
};

type Filter = 'all' | 'new' | 'interviewing' | 'closed';

/**
 * Everyone who applied for one job: who they are, where they study, their
 * CGPA, and how far they have got. Shortlist someone by inviting them to
 * interview - the job's own interview process, the same one students go
 * through from a simulation - or mark them not shortlisted.
 */
export default function JobApplicants() {
  const { id = '' } = useParams();
  const [rows, setRows] = useState<ApplicantRow[] | null>(null);
  const [invites, setInvites] = useState<CompanyInvite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');

  const load = useCallback(() => {
    applicantApi
      .list({ jobId: id, sort: 'cgpa' })
      .then(setRows)
      .catch((e) => setError(msg(e, 'Could not load the applicants.')));
    companyInviteApi
      .list()
      .then(setInvites)
      .catch(() => setInvites([]));
  }, [id]);

  useEffect(load, [load]);

  const title = rows?.[0]?.jobTitle ?? 'This job';
  const inviteOf = (r: ApplicantRow) =>
    invites.find((v) => v.candidate.id === r.candidateId && v.role === r.jobTitle && v.status !== 'WITHDRAWN');

  const counts = useMemo(() => {
    const list = rows ?? [];
    return {
      all: list.length,
      new: list.filter((r) => r.status === 'APPLIED' || r.status === 'UNDER_REVIEW').length,
      interviewing: list.filter((r) => inviteOf(r) || r.status === 'SHORTLISTED' || r.status === 'IN_ROUND').length,
      closed: list.filter((r) => ['REJECTED', 'WITHDRAWN', 'DECLINED'].includes(r.status)).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, invites]);

  const shown = (rows ?? []).filter((r) => {
    if (q.trim() && !`${r.name} ${r.collegeName ?? ''} ${r.email}`.toLowerCase().includes(q.trim().toLowerCase())) return false;
    if (filter === 'new') return r.status === 'APPLIED' || r.status === 'UNDER_REVIEW';
    if (filter === 'interviewing') return Boolean(inviteOf(r)) || r.status === 'SHORTLISTED' || r.status === 'IN_ROUND';
    if (filter === 'closed') return ['REJECTED', 'WITHDRAWN', 'DECLINED'].includes(r.status);
    return true;
  });

  async function act(r: ApplicantRow, call: () => Promise<unknown>) {
    setBusy(r.id);
    setError(null);
    try {
      await call();
      load();
    } catch (e) {
      setError(msg(e, 'That did not work.'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Frame>
      <section className="sa-hero is-short">
        <div className="sa-wrap">
          <Link to="/company/jobs" className="sa-link is-small">
            <span aria-hidden="true">←</span> All jobs
          </Link>
          <p className="sa-eyebrow" style={{ marginTop: 10 }}>
            Applicants
          </p>
          <h1>{title}</h1>
          <p className="sa-lede">
            Shortlist by inviting a student to interview - they go through this job&apos;s rounds under Interviews, and you give
            a verdict on each.
          </p>
        </div>
      </section>

      <div className="sa-wrap sa-body">
        {error && <p className="sa-alert">{error}</p>}
        {!rows && !error && <p className="sa-loading">Loading…</p>}

        {rows && (
          <>
            <div className="ja-bar">
              <div className="jb-seg" role="tablist" aria-label="Applicants">
                {(
                  [
                    ['all', 'All'],
                    ['new', 'New'],
                    ['interviewing', 'Interviewing'],
                    ['closed', 'Not shortlisted'],
                  ] as [Filter, string][]
                ).map(([k, label]) => (
                  <button key={k} type="button" role="tab" aria-selected={filter === k} className={filter === k ? 'is-on' : ''} onClick={() => setFilter(k)}>
                    {label} <span>{counts[k]}</span>
                  </button>
                ))}
              </div>
              <input className="jb-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a name or a college" aria-label="Search applicants" />
            </div>

            {shown.length === 0 && (
              <p className="sa-empty">{rows.length === 0 ? 'No one has applied yet. Applications appear here as students apply.' : 'No one in this list.'}</p>
            )}

            <ul className="ja-list">
              {shown.map((r) => {
                const inv = inviteOf(r);
                const st = inv ? INVITE_STATUS[inv.status] : (STAGE[r.status] ?? { label: r.status, tone: '' });
                const closed = ['REJECTED', 'WITHDRAWN', 'DECLINED'].includes(r.status);
                return (
                  <li key={r.id} className="ja-row">
                    <div className="ja-who">
                      <b>{r.name}</b>
                      <span>
                        {r.collegeName ?? 'College not given'}
                        {r.course ? ` · ${r.course}${r.specialisation ? ` ${r.specialisation}` : ''}` : ''}
                      </span>
                      <i>
                        Applied {day(r.appliedAt)} · {r.email}
                      </i>
                    </div>
                    <div className="ja-cgpa">
                      <b>{r.cgpa ? Number(r.cgpa).toFixed(2) : '-'}</b>
                      <span>CGPA</span>
                    </div>
                    <div className="ja-stage">
                      <span className={`sa-status ${st.tone}`}>{st.label}</span>
                      {inv && inv.status === 'ACCEPTED' && (
                        <span className="ja-round">
                          Round {inv.currentRoundOrder} of {inv.process.rounds.length}
                        </span>
                      )}
                    </div>
                    <div className="ja-actions">
                      {inv ? (
                        <Link to={`/company/interviews/invites/${inv.id}`} className="sa-btn is-small">
                          Open interview →
                        </Link>
                      ) : closed ? null : (
                        <>
                          <InviteToInterview
                            candidateId={r.candidateId}
                            candidateName={r.name}
                            defaultRole={r.jobTitle}
                            defaultProcessTitle={r.jobTitle}
                            // Inviting to interview is shortlisting: reviewed first if it was new.
                            onSent={() =>
                              void act(r, async () => {
                                if (r.status === 'APPLIED') await applicantApi.review(r.id);
                                if (r.status === 'APPLIED' || r.status === 'UNDER_REVIEW') await applicantApi.shortlist(r.id);
                              })
                            }
                          />
                          <button
                            type="button"
                            className="sa-quiet"
                            disabled={busy === r.id}
                            onClick={() => void act(r, () => applicantApi.reject(r.id, { note: 'Not shortlisted for this role.' }))}
                          >
                            Not shortlisted
                          </button>
                        </>
                      )}
                      {r.resumeUrl && (
                        <a href={r.resumeUrl} target="_blank" rel="noreferrer" className="sa-link is-small">
                          Resume ↗
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </Frame>
  );
}
