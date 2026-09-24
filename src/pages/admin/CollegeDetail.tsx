import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { adminApi, type CollegeDetail as College } from '../../api/admin';
import { ApiError } from '../../api/client';
import CollegeForm from './CollegeForm';
import CollegeStudents from './CollegeStudents';

export default function CollegeDetail() {
  const { id = '' } = useParams();
  const [college, setCollege] = useState<College | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** The one-time link, held in memory only. Never fetched again. */
  const [freshLink, setFreshLink] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setCollege(await adminApi.getCollege(id));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this college.');
    }
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (error) {
    return (
      <AdminLayout>
        <p className="alert alert-error">{error}</p>
        <p className="status-back">
          <Link to="/admin/colleges">← All colleges</Link>
        </p>
      </AdminLayout>
    );
  }

  if (!college) {
    return (
      <AdminLayout>
        <p className="muted">Loading…</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <p className="crumb">
        <Link to="/admin/colleges">← All colleges</Link>
      </p>

      <header className="page-head">
        <div>
          <p className="eyebrow">
            {college.code}
            {college.affiliation ? ` · ${college.affiliation}` : ''}
          </p>
          <h1>{college.name}</h1>
          <p className="page-lede">
            {[
              [college.city, college.state].filter(Boolean).join(', '),
              college.type,
              college.naacGrade ? `NAAC ${college.naacGrade}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn-secondary" onClick={() => setEditing((v) => !v)}>
            {editing ? 'Cancel' : 'Edit details'}
          </button>
          <button
            type="button"
            className={college.isVerified ? 'link-btn' : 'btn btn-primary'}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await adminApi.setCollegeVerified(college.id, !college.isVerified);
              setBusy(false);
              void refresh();
            }}
          >
            {college.isVerified ? 'Remove verification' : 'Verify college'}
          </button>
        </div>
      </header>

      {editing && (
        <CollegeForm
          collegeId={college.id}
          initial={{
            name: college.name,
            code: college.code,
            city: college.city,
            state: college.state,
            collegeTypeId: college.collegeTypeId ?? '',
            affiliation: college.affiliation ?? '',
            address: college.address ?? '',
            pincode: college.pincode ?? '',
            naacGrade: college.naacGrade ?? '',
          }}
          onDone={() => {
            setEditing(false);
            void refresh();
          }}
          onCancel={() => setEditing(false)}
        />
      )}

      {!editing && (
        <section className="card">
          <h2>Profile</h2>
          <dl className="facts-grid">
            <Fact label="Code" value={college.code} mono />
            <Fact label="Type" value={college.type} />
            <Fact label="Affiliated to" value={college.affiliation ?? 'Autonomous'} />
            <Fact label="NAAC grade" value={college.naacGrade} />
            <Fact label="City" value={`${college.city}, ${college.state}`} />
            <Fact label="PIN" value={college.pincode} />
            <Fact
              label="Verified"
              value={college.isVerified ? 'Yes' : 'Not yet'}
            />
          </dl>
          {college.address && (
            <p className="prose" style={{ marginTop: 16 }}>
              {college.address}
            </p>
          )}
        </section>
      )}

      <div className="stat-row">
        <Stat label="Team members" value={college.members.length} />
        <Stat label="Pending invites" value={college.invites.length} />
        <Stat label="Batches" value={college._count.batches} />
        <Stat label="Seasons" value={college._count.placements} />
      </div>

      {freshLink && <InviteLink link={freshLink} onDismiss={() => setFreshLink(null)} />}

      <section className="card">
        <h2>Placement team</h2>
        {college.members.length === 0 ? (
          <p className="muted">
            Nobody from this college can sign in yet. Invite the placement officer below.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {college.members.map((m) => (
                <tr key={m.id}>
                  <td>{m.user.fullName}</td>
                  <td className="mono">{m.user.email}</td>
                  <td>
                    <span className="pill pill-idle">{m.role}</span>
                  </td>
                  <td>
                    {m.user.isActive ? (
                      <span className="pill pill-pass">Active</span>
                    ) : (
                      <span className="pill pill-stop">Disabled</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {college.invites.length > 0 && (
        <section className="card">
          <h2>Pending invitations</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Role</th>
                <th>Expires</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {college.invites.map((inv) => (
                <tr key={inv.id}>
                  <td className="mono">{inv.email}</td>
                  <td>{inv.invitedName ?? '—'}</td>
                  <td>
                    <span className="pill pill-idle">{inv.campusRole ?? 'COORDINATOR'}</span>
                  </td>
                  <td>{new Date(inv.expiresAt).toLocaleDateString()}</td>
                  <td className="right">
                    <button
                      type="button"
                      className="link-btn is-danger"
                      onClick={async () => {
                        await adminApi.cancelInvite(college.id, inv.id);
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

      <CollegeStudents collegeId={college.id} collegeName={college.name} />

      <InviteForm
        collegeId={college.id}
        onInvited={(link) => {
          setFreshLink(link);
          void refresh();
        }}
      />
    </AdminLayout>
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
 * The invite link is shown exactly once, right after it is created. The server
 * only stores a hash of the token, so this cannot be retrieved later - losing
 * it means reissuing the invitation.
 */
function InviteLink({ link, onDismiss }: { link: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="card invite-link">
      <h2>Invitation created</h2>
      <p>
        Send this link to the placement officer. It works once, expires in seven days, and{' '}
        <b>cannot be shown again</b> — only a hash of it is stored.
      </p>
      <div className="link-row">
        <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="mono" />
        <button type="button" className="btn btn-primary" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <button type="button" className="link-btn" onClick={onDismiss}>
        Done
      </button>
    </section>
  );
}

function InviteForm({
  collegeId,
  onInvited,
}: {
  collegeId: string;
  onInvited: (link: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [invitedName, setInvitedName] = useState('');
  const [campusRole, setCampusRole] = useState<'TPO' | 'COORDINATOR'>('TPO');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    setError(null);
    setSending(true);
    try {
      const { link } = await adminApi.invitePlacementOfficer(collegeId, {
        email,
        invitedName,
        campusRole,
      });
      setEmail('');
      setInvitedName('');
      onInvited(link);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the invitation.');
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="card form-card" onSubmit={onSubmit} noValidate>
      <h2>Invite a team member</h2>
      <p className="muted">
        They set their own password when they accept. No account exists until they do.
      </p>
      {error && <p className="alert alert-error">{error}</p>}

      <div className="form-row">
        <label className="field">
          <span className="field-label">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="tpo@demo-college.example"
            disabled={sending}
          />
        </label>
        <label className="field">
          <span className="field-label">Name (optional)</span>
          <input
            value={invitedName}
            onChange={(e) => setInvitedName(e.target.value)}
            placeholder="Dr. Meera Nair"
            disabled={sending}
          />
        </label>
        <label className="field">
          <span className="field-label">Role</span>
          <select
            value={campusRole}
            onChange={(e) => setCampusRole(e.target.value as 'TPO' | 'COORDINATOR')}
            disabled={sending}
          >
            <option value="TPO">Placement officer (TPO)</option>
            <option value="COORDINATOR">Coordinator</option>
          </select>
        </label>
      </div>

      <button type="submit" className="btn btn-primary" disabled={sending}>
        {sending ? 'Creating…' : 'Create invitation'}
      </button>
    </form>
  );
}

function Fact({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined} style={{ textTransform: 'none' }}>
        {value || '—'}
      </dd>
    </div>
  );
}
