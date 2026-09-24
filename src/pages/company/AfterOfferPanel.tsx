import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import {
  afterOfferApi,
  JOINING_LABEL,
  JOINING_PILL,
  prettyDate,
  relativeDays,
  type CompanyOfferView,
  type ReliabilityKind,
} from '../../api/afterOffer';
import { useAuth } from '../../auth/AuthContext';
import { JoiningHistory } from '../student/AfterOffer';
import '../student/AfterOffer.css';

const RELIABILITY: { kind: ReliabilityKind; label: string; hint: string }[] = [
  { kind: 'ON_TIME', label: 'Kept their word', hint: 'Turned up to every round and, if offered, joined as agreed.' },
  { kind: 'NO_SHOW', label: 'Did not turn up', hint: 'Missed a round or the first day without telling you.' },
  { kind: 'RENEGED', label: 'Went back on an acceptance', hint: 'Accepted the offer, then did not join.' },
];

/**
 * The company's side of what happens after the offer: the joining date, and
 * whether the candidate kept their word.
 *
 * The student sees every joining change and the reason for it; the college
 * sees a withdrawn offer. Reliability goes only to the student's own college,
 * so it can counsel them - never to other companies.
 */
export default function AfterOfferPanel({ applicationId }: { applicationId: string }) {
  const { can } = useAuth();
  const [view, setView] = useState<CompanyOfferView | null>(null);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [mode, setMode] = useState<'none' | 'date' | 'revoke'>('none');
  const [relNote, setRelNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    afterOfferApi.companyView(applicationId).then(setView).catch(() => setView(null));
  }, [applicationId]);

  useEffect(load, [load]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setMode('none');
      setReason('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  if (!view) return null;
  const t = view.tracker;
  const mayDecide = can('offer:make');
  const later = Boolean(t?.expectedJoiningDate && date && date > t.expectedJoiningDate);

  return (
    <>
      {view.offerTaken && t && (
        <section className="card">
          <div className="joining-head">
            <div>
              <h2>Joining</h2>
              <p className="muted">
                Expected {prettyDate(t.expectedJoiningDate)}
                {t.daysToJoining !== null ? ` · ${relativeDays(t.daysToJoining)}` : ''}
              </p>
            </div>
            <span className={`pill ${JOINING_PILL[t.status]}`}>{JOINING_LABEL[t.status]}</span>
          </div>
          {t.overdue && (
            <p className="joining-warn">The expected date has passed. Mark them joined, or set the new date and say why.</p>
          )}
          {t.reason && <p className="joining-reason">{t.reason}</p>}
          {error && <p className="f-error">{error}</p>}

          {mayDecide && t.status !== 'JOINED' && t.status !== 'REVOKED' && mode === 'none' && (
            <div className="joining-actions">
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(() => afterOfferApi.companyJoining(applicationId, { action: 'JOINED' }))}>
                They joined
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMode('date')}>
                {t.expectedJoiningDate ? 'Change the date' : 'Set the joining date'}
              </button>
              <button type="button" className="link-btn is-danger" onClick={() => setMode('revoke')}>
                Withdraw the offer
              </button>
            </div>
          )}

          {mode === 'date' && (
            <div className="joining-report">
              <label className="f">
                <span className="f-label">Joining date</span>
                <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              {later && (
                <label className="f">
                  <span className="f-label">Why is it moving later?</span>
                  <textarea className="input" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
                  <span className="f-hint">The student sees this, and it shows as a delay to their college.</span>
                </label>
              )}
              <div className="joining-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode('none')}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busy || !date || (later && reason.trim().length < 3)}
                  onClick={() =>
                    run(() => afterOfferApi.companyJoining(applicationId, { action: 'SET_DATE', date, ...(reason.trim() ? { reason: reason.trim() } : {}) }))
                  }
                >
                  Save and tell the student
                </button>
              </div>
            </div>
          )}

          {mode === 'revoke' && (
            <div className="joining-report">
              <label className="f">
                <span className="f-label">Why is the offer being withdrawn?</span>
                <textarea className="input" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
                <span className="f-hint">
                  The student and their placement cell are told, and it counts against your offer-honour rate on your company page.
                </span>
              </label>
              <div className="joining-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode('none')}>
                  Keep the offer
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm co-danger"
                  disabled={busy || reason.trim().length < 3}
                  onClick={() => run(() => afterOfferApi.companyJoining(applicationId, { action: 'REVOKE', reason: reason.trim() }))}
                >
                  Withdraw the offer
                </button>
              </div>
            </div>
          )}

          {t.history.length > 0 && <JoiningHistory entries={t.history} />}
        </section>
      )}

      {can('application:advance') && (
        <section className="card">
          <h2>Did they keep their word?</h2>
          <p className="muted">
            Goes only to the student's own college, so they can talk it through with them. Other companies never see it.
          </p>
          <div className="joining-actions">
            {RELIABILITY.map((r) => (
              <button
                key={r.kind}
                type="button"
                title={r.hint}
                className={`chip ${view.reliability?.kind === r.kind ? 'is-on' : ''}`}
                disabled={busy}
                onClick={() => run(() => afterOfferApi.markReliability(applicationId, { kind: r.kind, ...(relNote.trim() ? { note: relNote.trim() } : {}) }))}
              >
                {r.label}
              </button>
            ))}
          </div>
          <input
            className="input rel-note"
            value={relNote}
            onChange={(e) => setRelNote(e.target.value)}
            maxLength={500}
            placeholder="Optional note, e.g. told us two days before joining"
          />
          {view.reliability && (
            <p className="f-hint">
              Recorded {new Date(view.reliability.at).toLocaleDateString('en-IN')}
              {view.reliability.note ? ` - ${view.reliability.note}` : ''}
            </p>
          )}
        </section>
      )}
    </>
  );
}
