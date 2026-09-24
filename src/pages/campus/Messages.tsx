import { useEffect, useState } from 'react';
import CampusLayout from './CampusLayout';
import { ApiError } from '../../api/client';
import { insightsApi, type MessageLog, type MessageStatus } from '../../api/insights';
import { useAuth } from '../../auth/AuthContext';
import './Messages.css';

const STATUS: Record<MessageStatus, { label: string; cls: string }> = {
  SENT: { label: 'Sent', cls: 'pill-pass' },
  FAILED: { label: 'Failed', cls: 'pill-stop' },
  SKIPPED: { label: 'Not sent', cls: 'pill-hold' },
  QUEUED: { label: 'Sending', cls: 'pill-idle' },
};

const TYPE_LABEL: Record<string, string> = {
  'application.in_round': 'Moved to the next round',
  'application.waitlisted': 'Waitlisted',
  'application.offered': 'Offer made',
  'application.hired': 'Hired',
  'application.rejected': 'Not selected',
  SHOWCASE_INVITE: 'Invited to apply',
  'placement_cell.check_in': 'Note from the placement cell',
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * What WhatsApp did for this college's students.
 *
 * The first thing on the page says whether the portal can send at all - a log
 * of "not sent" is a setup question before it is anything else. Numbers are
 * only ever shown masked; the full one stays on the student's record.
 */
export default function Messages() {
  const { hasModule, can } = useAuth();
  const [log, setLog] = useState<MessageLog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const enabled = hasModule('channel.whatsapp');
  const allowed = can('report:read');

  useEffect(() => {
    if (!enabled || !allowed) return;
    insightsApi
      .messages()
      .then(setLog)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load the message log.'));
  }, [enabled, allowed]);

  return (
    <CampusLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Placement cell · WhatsApp</p>
          <h1>WhatsApp messages</h1>
          <p className="page-lede">Important updates copied to your students’ WhatsApp, and what happened to each.</p>
        </div>
      </header>

      {!enabled && (
        <div className="empty">
          <h2>WhatsApp is not switched on</h2>
          <p>WhatsApp updates are part of the Growth and Complete plans. Ask the platform team to switch them on.</p>
        </div>
      )}
      {enabled && !allowed && (
        <div className="empty">
          <h2>Your role cannot see this</h2>
          <p>Ask your placement officer for the “See placement statistics” permission.</p>
        </div>
      )}
      {error && <p className="alert alert-error">{error}</p>}

      {log && (
        <>
          {log.configured ? (
            <p className="alert alert-ok">
              WhatsApp is set up. Students who have allowed WhatsApp updates on their Privacy page get the messages below.
            </p>
          ) : (
            <p className="alert alert-warn">
              <b>WhatsApp is not set up yet, so nothing is being sent.</b> The platform team needs to connect a WhatsApp
              Business account. Until then, updates still reach students in the app, and each one is listed here as
              “Not sent”.
            </p>
          )}

          <div className="stat-row">
            {(['SENT', 'SKIPPED', 'FAILED'] as MessageStatus[]).map((s) => (
              <div key={s} className="stat">
                <p className="stat-value">{log.counts[s] ?? 0}</p>
                <p className="stat-label">{STATUS[s].label}</p>
              </div>
            ))}
          </div>

          <section className="card">
            <h2>What gets sent</h2>
            <p className="muted">Only news a student would want the moment it happens. Everything else stays in the app.</p>
            <div className="ms-types">
              {log.types.map((t) => (
                <span key={t} className="chip is-static">
                  {TYPE_LABEL[t] ?? t}
                </span>
              ))}
            </div>
          </section>

          <section className="card">
            <h2>Recent messages</h2>
            {log.messages.length === 0 ? (
              <p className="muted">Nothing yet. Messages appear here within a minute of the update in the app.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Student</th>
                      <th>Number</th>
                      <th>Template</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {log.messages.map((m) => (
                      <tr key={m.id}>
                        <td className="ms-when">{when(m.createdAt)}</td>
                        <td>{m.student}</td>
                        <td className="ms-num">{m.toMasked}</td>
                        <td className="ms-tpl">{m.template}</td>
                        <td>
                          <span className={`pill ${STATUS[m.status].cls}`}>{STATUS[m.status].label}</span>
                          {m.error && <small className="ms-why">{m.error}</small>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </CampusLayout>
  );
}
