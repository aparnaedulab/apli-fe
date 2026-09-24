import { useCallback, useEffect, useState } from 'react';
import CompanyLayout from './CompanyLayout';
import { companyAccessApi, type Institution } from '../../api/companyAccess';
import { ApiError } from '../../api/client';
import '../admin/CompanyAccess.css';
import './Institutions.css';

const STATUS: Record<Institution['status'], { cls: string; label: string }> = {
  NONE: { cls: 'pill-idle', label: 'Not asked yet' },
  PENDING: { cls: 'pill-hold', label: 'Waiting for them' },
  APPROVED: { cls: 'pill-pass', label: 'Approved' },
  BLOCKED: { cls: 'pill-stop', label: 'Declined' },
};

/**
 * The institutions that approve companies themselves, and where this company
 * stands with each. Every other institution needs nothing from here - its
 * colleges can already receive roles once the platform has verified you.
 */
export default function Institutions() {
  const [list, setList] = useState<Institution[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    companyAccessApi
      .institutions()
      .then(setList)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load institutions.'));
  }, []);
  useEffect(load, [load]);

  async function ask(t: Institution) {
    setBusy(t.tenantId);
    setError(null);
    try {
      await companyAccessApi.request(t.tenantId, notes[t.tenantId]?.trim() || undefined);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send that request.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <CompanyLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Recruiting</p>
          <h1>Institutions</h1>
          <p className="page-lede">
            Some universities approve companies before roles reach their colleges. Ask once here; when they approve,
            their drives open up for your roles, campus weeks and invitations.
          </p>
        </div>
      </header>

      {error && <p className="alert alert-error">{error}</p>}

      {list === null ? (
        !error && <p className="muted">Loading…</p>
      ) : list.length === 0 ? (
        <div className="empty">
          <p>No institution asks for approval right now. You can send roles to every college on the platform.</p>
        </div>
      ) : (
        <ul className="ca-list">
          {list.map((t) => (
            <li key={t.tenantId} className="card ca-row">
              <div className="ca-main">
                <div className="ca-title">
                  <h2>{t.name}</h2>
                  <span className={`pill ${STATUS[t.status].cls}`}>{STATUS[t.status].label}</span>
                </div>
                <p className="ca-meta">
                  {[[t.city, t.state].filter(Boolean).join(', '), `${t.colleges} college${t.colleges === 1 ? '' : 's'}`]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {t.status === 'BLOCKED' && t.note && <blockquote className="ca-quote">{t.note}</blockquote>}
                {t.status === 'PENDING' && t.requestedAt && (
                  <p className="ca-when">Asked {new Date(t.requestedAt).toLocaleDateString('en-IN')}</p>
                )}
                {(t.status === 'NONE' || t.status === 'PENDING') && (
                  <label className="inst-note">
                    <span>A line about why you hire from here (optional)</span>
                    <textarea
                      rows={2}
                      maxLength={500}
                      value={notes[t.tenantId] ?? (t.status === 'PENDING' ? t.note ?? '' : '')}
                      onChange={(e) => setNotes((m) => ({ ...m, [t.tenantId]: e.target.value }))}
                      placeholder="We hire freshers for analyst roles in Pune every year."
                    />
                  </label>
                )}
              </div>
              {(t.status === 'NONE' || t.status === 'PENDING') && (
                <div className="ca-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy === t.tenantId}
                    onClick={() => ask(t)}
                  >
                    {t.status === 'NONE' ? 'Request access' : 'Update request'}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </CompanyLayout>
  );
}
