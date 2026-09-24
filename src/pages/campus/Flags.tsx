import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CampusLayout from './CampusLayout';
import { ApiError } from '../../api/client';
import { gapsApi, shortDate, type ReportStatus, type RoleReport } from '../../api/gaps';
import { REPORT_REASONS } from '../../api/trust';
import { useAuth } from '../../auth/AuthContext';
import './Flags.css';

/**
 * Every role a student has reported at this college, in one place.
 *
 * Grouped by role because three students flagging the same posting is one
 * problem, not three - and that count is what should make an officer pull a
 * role. Pulling it happens on Job requests; this page only records that the
 * reports were looked at, so students who flagged something know it was.
 */
export default function Flags() {
  const { hasModule, can } = useAuth();
  const on = hasModule('trust.scamShield');
  const allowed = can('posting:read');
  const decide = can('posting:decide');
  const [status, setStatus] = useState<ReportStatus>('OPEN');
  const [reports, setReports] = useState<RoleReport[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!on || !allowed) return;
    setReports(null);
    gapsApi
      .reports(status)
      .then(setReports)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load reports.'));
  }, [on, allowed, status]);

  useEffect(load, [load]);

  const review = async (ids: string[], to: 'REVIEWED' | 'DISMISSED') => {
    setBusy(ids.join());
    setError(null);
    try {
      for (const id of ids) await gapsApi.reviewReport(id, to);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not go through. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const head = (lede: string) => (
    <header className="page-head">
      <div>
        <p className="eyebrow">Placement cell</p>
        <h1>Flagged roles</h1>
        <p className="page-lede">{lede}</p>
      </div>
    </header>
  );

  if (!on) {
    return <CampusLayout>{head('Scam protection is not switched on for your institution.')}</CampusLayout>;
  }
  if (!allowed) {
    return <CampusLayout>{head('Your role does not include reading job requests, so reports are not shown.')}</CampusLayout>;
  }

  // One group per role, the most-reported first.
  const groups = new Map<string, RoleReport[]>();
  for (const r of reports ?? []) groups.set(r.jobId, [...(groups.get(r.jobId) ?? []), r]);
  const ordered = [...groups.values()].sort((a, b) => b.length - a.length);

  return (
    <CampusLayout>
      {head(
        'Roles your students reported as suspicious - a fee asked for, a company that does not seem real, pay not as described. To stop a role reaching students, withdraw it from Job requests.',
      )}

      {error && <p className="alert alert-error">{error}</p>}

      <div className="flg-tabs" role="tablist" aria-label="Show">
        {(['OPEN', 'REVIEWED', 'DISMISSED'] as ReportStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={status === s}
            className={`seg-opt ${status === s ? 'is-on' : ''}`}
            onClick={() => setStatus(s)}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {reports === null ? (
        <p className="muted">Loading…</p>
      ) : ordered.length === 0 ? (
        <section className="card">
          <p className="muted">{status === 'OPEN' ? 'No reports waiting. Good.' : 'Nothing here.'}</p>
        </section>
      ) : (
        ordered.map((group) => {
          const first = group[0]!;
          const ids = group.map((r) => r.id);
          const key = ids.join();
          return (
            <article key={first.jobId} className={`card flg-role ${group.length > 1 ? 'is-many' : ''}`}>
              <header className="flg-role-head">
                <div>
                  <h2 className="flg-role-title">{first.jobTitle}</h2>
                  <p className="muted">{first.companyName}</p>
                </div>
                <span className={`pill ${group.length > 1 ? 'pill-stop' : 'pill-hold'}`}>
                  {group.length} {group.length === 1 ? 'report' : 'reports'}
                </span>
              </header>

              <ul className="flg-list">
                {group.map((r) => (
                  <li key={r.id}>
                    <p className="flg-reason">{reasonLabel(r.reason)}</p>
                    {r.note && <p className="flg-note">“{r.note}”</p>}
                    <p className="flg-meta muted">
                      {r.studentName} · {shortDate(r.createdAt)}
                      {r.reviewedAt && ` · looked at ${shortDate(r.reviewedAt)}`}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="flg-actions">
                <Link to="/campus/requests" className="btn btn-ghost flg-btn">
                  Open Job requests
                </Link>
                {decide && status === 'OPEN' && (
                  <>
                    <button type="button" className="btn btn-ghost flg-btn" disabled={busy !== null} onClick={() => void review(ids, 'DISMISSED')}>
                      Dismiss
                    </button>
                    <button type="button" className="btn btn-secondary flg-btn" disabled={busy !== null} onClick={() => void review(ids, 'REVIEWED')}>
                      {busy === key ? 'Saving…' : 'Mark reviewed'}
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })
      )}
    </CampusLayout>
  );
}

const STATUS_LABEL: Record<ReportStatus, string> = { OPEN: 'Open', REVIEWED: 'Reviewed', DISMISSED: 'Dismissed' };
const reasonLabel = (reason: string) => REPORT_REASONS.find((r) => r.value === reason)?.label ?? reason;
