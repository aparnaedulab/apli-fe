import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { companyAccessApi, type AccessRequest, type AccessStatus } from '../../api/companyAccess';
import { ApiError } from '../../api/client';
import './CompanyAccess.css';

const PILL: Record<AccessStatus, { cls: string; label: string }> = {
  PENDING: { cls: 'pill-hold', label: 'Waiting on you' },
  APPROVED: { cls: 'pill-pass', label: 'Approved' },
  BLOCKED: { cls: 'pill-stop', label: 'Declined' },
};

const PLATFORM_LABEL: Record<AccessRequest['platformStatus'], string> = {
  PENDING: 'Not yet verified by the platform',
  VERIFIED: 'Verified by the platform',
  REJECTED: 'Rejected by the platform',
  SUSPENDED: 'Suspended by the platform',
};

/**
 * The institution's own say over which companies reach its colleges.
 *
 * Only matters when "Companies need our approval first" is on. With it off
 * the page still loads - it explains the setting and keeps any past decisions
 * visible, so switching it back on later does not start from nothing.
 */
export default function CompanyAccess() {
  const [data, setData] = useState<{ approvalRequired: boolean; requests: AccessRequest[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    companyAccessApi
      .requests()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load company requests.'));
  }, []);
  useEffect(load, [load]);

  async function decide(r: AccessRequest, status: AccessStatus) {
    setBusy(r.companyId);
    setError(null);
    try {
      await companyAccessApi.decide(r.companyId, status);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save that decision.');
    } finally {
      setBusy(null);
    }
  }

  const waiting = data?.requests.filter((r) => r.status === 'PENDING').length ?? 0;

  return (
    <AdminLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Companies</p>
          <h1>Company access</h1>
          <p className="page-lede">
            The platform checks that a company is real. Here your institution decides whether it may send roles, campus
            weeks and invitations to your colleges. Each college still approves every role for its own students.
          </p>
        </div>
      </header>

      {error && <p className="alert alert-error">{error}</p>}

      {data && !data.approvalRequired && (
        <p className="ca-note">
          Approval is <strong>off</strong> for your institution, so every verified company can already reach your
          colleges. Turn on &ldquo;Companies need our approval first&rdquo; in{' '}
          <Link to="/admin/institution-rules">Placement rules</Link> to use this list.
        </p>
      )}

      {data === null ? (
        !error && <p className="muted">Loading…</p>
      ) : data.requests.length === 0 ? (
        <div className="empty">
          <p>No company has asked yet. Requests appear here as companies find your institution.</p>
        </div>
      ) : (
        <>
          {waiting > 0 && (
            <p className="ca-count">
              {waiting} {waiting === 1 ? 'company is' : 'companies are'} waiting for an answer.
            </p>
          )}
          <ul className="ca-list">
            {data.requests.map((r) => (
              <li key={r.companyId} className="card ca-row">
                <div className="ca-main">
                  <div className="ca-title">
                    <h2>{r.name}</h2>
                    <span className={`pill ${PILL[r.status].cls}`}>{PILL[r.status].label}</span>
                  </div>
                  <p className="ca-meta">
                    {[r.industry, [r.city, r.state].filter(Boolean).join(', '), r.website].filter(Boolean).join(' · ') ||
                      'No details given yet'}
                  </p>
                  <p className={`ca-platform ${r.platformStatus === 'VERIFIED' ? '' : 'is-warn'}`}>
                    {PLATFORM_LABEL[r.platformStatus]}
                  </p>
                  {r.note && <blockquote className="ca-quote">{r.note}</blockquote>}
                  <p className="ca-when">
                    Asked {new Date(r.requestedAt).toLocaleDateString('en-IN')}
                    {r.decidedAt && ` · decided ${new Date(r.decidedAt).toLocaleDateString('en-IN')}`}
                  </p>
                </div>
                <div className="ca-actions">
                  {r.status !== 'APPROVED' && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy === r.companyId}
                      onClick={() => decide(r, 'APPROVED')}
                    >
                      Approve
                    </button>
                  )}
                  {r.status !== 'BLOCKED' && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busy === r.companyId}
                      onClick={() => decide(r, 'BLOCKED')}
                    >
                      Decline
                    </button>
                  )}
                  {r.status !== 'PENDING' && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busy === r.companyId}
                      onClick={() => decide(r, 'PENDING')}
                      title="Takes the decision back. New roles stop until you decide again; roles already sent stay."
                    >
                      Review again
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </AdminLayout>
  );
}
