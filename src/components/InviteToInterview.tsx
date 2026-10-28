import { useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { companyInviteApi } from '../api/interviewInvites';
import { interviewProcessApi, type InterviewProcessSummary } from '../api/companyInterviews';
import './InviteToInterview.css';

interface Props {
  candidateId: string;
  candidateName: string;
  /** Optional: pre-fill role name from simulation/job context */
  defaultRole?: string;
  /** Optional: the process to pick first, by its title - a job's own process. */
  defaultProcessTitle?: string;
  /** Called once the invite has gone, e.g. to shortlist the application too. */
  onSent?: () => void;
}

const msg = (e: unknown, fb: string) => (e instanceof ApiError ? e.message : fb);

/**
 * Drop-in button that opens an inline form to invite a student to an
 * interview process. Used on "Shared with you" and "Students' work" pages.
 */
export default function InviteToInterview({ candidateId, candidateName, defaultRole, defaultProcessTitle, onSent }: Props) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <span className="iti-sent">
        <span aria-hidden="true">✓</span> Interview invite sent to {candidateName}.
      </span>
    );
  }

  return open ? (
    <InviteForm
      candidateId={candidateId}
      candidateName={candidateName}
      defaultRole={defaultRole}
      defaultProcessTitle={defaultProcessTitle}
      onCancel={() => setOpen(false)}
      onSent={() => {
        setSent(true);
        onSent?.();
      }}
    />
  ) : (
    <button type="button" className="sa-btn is-small" onClick={() => setOpen(true)}>
      Invite to interview
    </button>
  );
}

function InviteForm({
  candidateId,
  candidateName,
  defaultRole,
  defaultProcessTitle,
  onCancel,
  onSent,
}: {
  candidateId: string;
  candidateName: string;
  defaultRole?: string;
  defaultProcessTitle?: string;
  onCancel: () => void;
  onSent: () => void;
}) {
  const [processes, setProcesses] = useState<InterviewProcessSummary[] | null>(null);
  const [processId, setProcessId] = useState('');
  const [role, setRole] = useState(defaultRole ?? '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    interviewProcessApi
      .list()
      .then((ps) => {
        const active = ps.filter((p) => p.status !== 'ARCHIVED' && p.roundCount > 0);
        setProcesses(active);
        const preferred = defaultProcessTitle ? active.find((p) => p.title === defaultProcessTitle) : undefined;
        if (preferred) setProcessId(preferred.id);
        else if (active.length === 1) setProcessId(active[0]!.id);
      })
      .catch(() => setProcesses([]));
  }, [defaultProcessTitle]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!processId) { setError('Choose an interview process.'); return; }
    if (!role.trim()) { setError('Enter the role name.'); return; }
    setBusy(true);
    setError(null);
    try {
      await companyInviteApi.send({
        candidateId,
        processId,
        role: role.trim(),
        message: message.trim() || undefined,
      });
      onSent();
    } catch (e) {
      setError(msg(e, 'Could not send the invite.'));
      setBusy(false);
    }
  }

  return (
    <form className="iti-form" onSubmit={submit}>
      <h3 className="iti-title">Invite {candidateName} to interview</h3>

      <label className="iti-field">
        <span>Interview process</span>
        {processes === null ? (
          <span className="iti-loading">Loading your processes…</span>
        ) : processes.length === 0 ? (
          <span className="iti-warn">
            No interview process with rounds yet.{' '}
            <a href="/company/interviews/new" target="_blank" rel="noreferrer">
              Build one first →
            </a>
          </span>
        ) : (
          <select value={processId} onChange={(e) => setProcessId(e.target.value)} required>
            <option value="">— choose a process —</option>
            {processes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.roundCount} round{p.roundCount === 1 ? '' : 's'})
              </option>
            ))}
          </select>
        )}
      </label>

      <label className="iti-field">
        <span>Role</span>
        <input
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="e.g. Software Engineer Intern"
          maxLength={120}
          required
        />
      </label>

      <label className="iti-field">
        <span>Message <i>optional</i></span>
        <textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="A short note to the candidate — what to expect, when, any preparation…"
          maxLength={1000}
        />
      </label>

      {error && <p className="iti-error">{error}</p>}

      <div className="iti-actions">
        <button type="submit" className="sa-btn" disabled={busy || !processId || processes?.length === 0}>
          {busy ? 'Sending…' : 'Send invite'}
        </button>
        <button type="button" className="sa-quiet" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}
