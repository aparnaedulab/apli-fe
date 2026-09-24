import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import CampusLayout from './CampusLayout';
import { campusApi, type BatchDetail as Detail, type BulkInviteResult } from '../../api/campus';
import { ApiError } from '../../api/client';
import AddStudents from '../../components/AddStudents';

export default function BatchDetail() {
  const { id = '' } = useParams();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<BulkInviteResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      setData(await campusApi.getBatch(id));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this batch.');
    }
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (error) {
    return (
      <CampusLayout>
        <p className="alert alert-error">{error}</p>
        <p className="crumb">
          <Link to="/campus/batches">← All batches</Link>
        </p>
      </CampusLayout>
    );
  }

  if (!data) {
    return (
      <CampusLayout>
        <p className="muted">Loading…</p>
      </CampusLayout>
    );
  }

  const { batch, students, invites } = data;
  const verified = students.filter((s) => s.isFrozen).length;

  return (
    <CampusLayout>
      <p className="crumb">
        <Link to="/campus/batches">← All batches</Link>
      </p>

      <header className="page-head">
        <div>
          <p className="eyebrow">Batch</p>
          <h1>{batch.name}</h1>
          <p className="page-lede">
            {[batch.course, batch.specialisation, `Graduating ${batch.graduationYear}`]
              .filter(Boolean)
              .join(' · ')}
            {batch.headOfDept ? ` · ${batch.headOfDept}` : ''}
          </p>
        </div>
      </header>

      <div className="stat-row">
        <Stat label="Students" value={students.length} />
        <Stat label="Verified" value={verified} />
        <Stat label="Not yet verified" value={students.length - verified} />
        <Stat label="Pending invites" value={invites.length} />
      </div>

      <JoinLinkCard batch={batch} onChange={refresh} />

      {inviteResult && (
        <InviteResultCard result={inviteResult} onDismiss={() => setInviteResult(null)} />
      )}

      <AddStudents
        endpoint={`/campus/batches/${batch.id}/students`}
        batchName={batch.name}
        onDone={refresh}
      />

      <InviteStudentsForm
        batchId={batch.id}
        onInvited={(result) => {
          setInviteResult(result);
          void refresh();
        }}
      />

      <section className="card">
        <div className="card-head">
          <h2>Roster</h2>
          {selected.size > 0 && (
            <div className="btn-row">
              <span className="muted">{selected.size} selected</span>
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  await campusApi.freeze(batch.id, [...selected]);
                  setSelected(new Set());
                  void refresh();
                }}
              >
                Verify &amp; freeze
              </button>
              <button
                type="button"
                className="link-btn"
                onClick={async () => {
                  await campusApi.unfreeze(batch.id, [...selected]);
                  setSelected(new Set());
                  void refresh();
                }}
              >
                Unlock
              </button>
            </div>
          )}
        </div>
        {students.length === 0 ? (
          <p className="muted">
            Nobody has joined yet. Invite them by email above, or share the join link.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className="tick-col">
                  <input
                    type="checkbox"
                    aria-label="Select every student"
                    checked={selected.size > 0 && selected.size === students.length}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked ? new Set(students.map((s) => s.membershipId)) : new Set(),
                      )
                    }
                  />
                </th>
                <th>Name</th>
                <th>Email</th>
                <th>Roll no.</th>
                <th>Div</th>
                <th className="num">CGPA</th>
                <th>Account</th>
                <th>Resume</th>
                <th>Verified</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.membershipId}>
                  <td className="tick-col">
                    <input
                      type="checkbox"
                      aria-label={`Select ${s.name}`}
                      checked={selected.has(s.membershipId)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(s.membershipId);
                        else next.delete(s.membershipId);
                        setSelected(next);
                      }}
                    />
                  </td>
                  <td className="row-link">{s.name}</td>
                  <td className="mono">{s.email}</td>
                  <td>
                    {s.rollNo ?? '—'}
                    {s.prn && <span className="row-sub">{s.prn}</span>}
                  </td>
                  <td>{s.division ?? '—'}</td>
                  <td className="num">{s.cgpa ?? '—'}</td>
                  <td>
                    {s.hasClaimed ? (
                      <span className="pill pill-pass">Joined</span>
                    ) : (
                      <span className="pill pill-idle">Not yet</span>
                    )}
                  </td>
                  <td>
                    {s.hasResume ? (
                      <span className="pill pill-pass">Uploaded</span>
                    ) : (
                      <span className="pill pill-idle">None</span>
                    )}
                  </td>
                  <td>
                    {s.isFrozen ? (
                      <span className="pill pill-pass">Frozen</span>
                    ) : (
                      <span className="pill pill-hold">Pending</span>
                    )}
                  </td>
                  <td className="right">
                    <button
                      type="button"
                      className="link-btn is-danger"
                      onClick={async () => {
                        await campusApi.removeStudent(batch.id, s.membershipId);
                        void refresh();
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {invites.length > 0 && (
        <section className="card">
          <h2>Invited, not joined yet</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Expires</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => (
                <tr key={inv.id}>
                  <td className="mono">{inv.email}</td>
                  <td>{new Date(inv.expiresAt).toLocaleDateString()}</td>
                  <td className="right">
                    <button
                      type="button"
                      className="link-btn is-danger"
                      onClick={async () => {
                        await campusApi.cancelInvite(inv.id);
                        void refresh();
                      }}
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </CampusLayout>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <p className="stat-value">{value}</p>
      <p className="stat-label">{label}</p>
    </div>
  );
}

/**
 * The shareable join link. Unlike an emailed invitation this is one code for
 * the whole batch, so it can be read out in class or put on a notice board -
 * and turned off the moment the roster is complete.
 */
function JoinLinkCard({ batch, onChange }: { batch: Detail['batch']; onChange: () => void }) {
  const [link, setLink] = useState(batch.joinLink);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => setLink(batch.joinLink), [batch.joinLink]);

  async function enable() {
    setBusy(true);
    const { joinLink } = await campusApi.enableJoinLink(batch.id);
    setLink(joinLink);
    setBusy(false);
    onChange();
  }

  async function disable() {
    setBusy(true);
    await campusApi.disableJoinLink(batch.id);
    setLink(null);
    setBusy(false);
    onChange();
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="card">
      <h2>Join link</h2>
      {link ? (
        <>
          <p className="muted">
            Anyone with this link can join <b>{batch.name}</b>. Share it with the class, then turn
            it off once everyone is in.
          </p>
          <div className="link-row">
            <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="mono" />
            <button type="button" className="btn btn-primary" onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="btn-row">
            <button type="button" className="link-btn" onClick={enable} disabled={busy}>
              Generate a new link
            </button>
            <button type="button" className="link-btn is-danger" onClick={disable} disabled={busy}>
              Turn off
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">
            Turned off. Turn it on to let students join themselves instead of inviting them one by
            one.
          </p>
          <button type="button" className="btn btn-secondary" onClick={enable} disabled={busy}>
            {busy ? 'Working…' : 'Turn on join link'}
          </button>
        </>
      )}
    </section>
  );
}

function InviteStudentsForm({
  batchId,
  onInvited,
}: {
  batchId: string;
  onInvited: (r: BulkInviteResult) => void;
}) {
  const [raw, setRaw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const emails = raw
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (sending || emails.length === 0) return;
    setError(null);
    setSending(true);
    try {
      onInvited(await campusApi.inviteStudents(batchId, emails));
      setRaw('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the invitations.');
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="card form-card" onSubmit={onSubmit} noValidate>
      <h2>Invite students by email</h2>
      <p className="muted">
        Paste addresses separated by commas, spaces or new lines. Each gets its own single-use link.
      </p>
      {error && <p className="alert alert-error">{error}</p>}

      <label className="field">
        <span className="field-label">
          Email addresses
          {emails.length > 0 && <span className="muted">{emails.length} address{emails.length === 1 ? '' : 'es'}</span>}
        </span>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={4}
          placeholder={'student.one@demo-college.example\nstudent.two@demo-college.example'}
          disabled={sending}
        />
      </label>

      <button type="submit" className="btn btn-primary" disabled={sending || emails.length === 0}>
        {sending ? 'Creating…' : `Invite ${emails.length || ''} student${emails.length === 1 ? '' : 's'}`}
      </button>
    </form>
  );
}

/**
 * Bulk invites succeed partially by design - one bad address in a paste of
 * sixty should not lose the other fifty-nine - so both outcomes are shown.
 */
function InviteResultCard({
  result,
  onDismiss,
}: {
  result: BulkInviteResult;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const allLinks = result.created.map((c) => `${c.email}  ${c.link}`).join('\n');

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(allLinks);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="card invite-link">
      <h2>
        {result.created.length} invitation{result.created.length === 1 ? '' : 's'} created
      </h2>
      <p>
        Each link works once and expires in seven days. They <b>cannot be shown again</b> — copy
        them now, or use the batch join link instead.
      </p>

      {result.created.length > 0 && (
        <>
          <div className="link-list">
            {result.created.map((c) => (
              <div key={c.email} className="link-list-row">
                <span className="mono">{c.email}</span>
                <span className="mono link-list-url">{c.link}</span>
              </div>
            ))}
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={copyAll}>
              {copied ? 'Copied' : 'Copy all'}
            </button>
            <button type="button" className="link-btn" onClick={onDismiss}>
              Done
            </button>
          </div>
        </>
      )}

      {result.skipped.length > 0 && (
        <div className="skipped">
          <p className="skipped-title">Skipped {result.skipped.length}</p>
          <ul>
            {result.skipped.map((s, i) => (
              <li key={`${s.email}-${i}`}>
                <span className="mono">{s.email}</span> — {s.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
