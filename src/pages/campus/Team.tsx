import { useCallback, useEffect, useState, type FormEvent } from 'react';
import CampusLayout from './CampusLayout';
import { api, ApiError } from '../../api/client';
import { rolesApi, type AssignableRole } from '../../api/roles';
import { OneTimeLink } from '../admin/Companies';

interface NamedRole {
  id: string;
  name: string;
}

interface Member {
  id: string;
  role: NamedRole;
  isMe: boolean;
  joinedAt: string;
  user: { id: string; fullName: string; email: string; isActive: boolean };
}

interface PendingInvite {
  id: string;
  email: string;
  invitedName: string | null;
  role: NamedRole | null;
  expiresAt: string;
}

/**
 * The people at this college who can sign in, and what each of them may do.
 *
 * Roles are not a fixed list any more - the university creates them - so this
 * screen asks which ones it may hand out rather than naming any itself. What
 * *this* person may do arrives with the team, so the screen can hide controls
 * rather than offer them and then refuse.
 */
export default function Team() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [roles, setRoles] = useState<AssignableRole[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshLink, setFreshLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<{
        myPermissions: string[];
        members: Member[];
        invites: PendingInvite[];
      }>('/campus/team');
      setMembers(data.members);
      setInvites(data.invites);
      setPermissions(data.myPermissions);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your team.');
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
    rolesApi
      .assignable()
      .then(setRoles)
      .catch(() => setRoles([]));
  }, [refresh]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  const canManage = permissions.includes('team:manage');

  return (
    <CampusLayout>
      <header className="page-head">
        <div>
          <h1>Team</h1>
          <p className="page-lede">
            Everyone at your college who can work on placements. You create their logins here —
            they set their own passwords when they accept.
          </p>
        </div>
      </header>

      {error && <p className="alert alert-error">{error}</p>}
      {!loaded && <p className="muted">Loading…</p>}

      {freshLink && <OneTimeLink link={freshLink} onDismiss={() => setFreshLink(null)} />}

      {loaded && (
        <section className="card">
          <h2>Members</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>
                    {m.user.fullName}
                    {m.isMe && <span className="row-sub">You</span>}
                  </td>
                  <td className="mono">{m.user.email}</td>
                  <td>
                    {canManage && !m.isMe ? (
                      <select
                        value={m.role.id}
                        disabled={busy}
                        aria-label={`Role for ${m.user.fullName}`}
                        onChange={(e) =>
                          run(() => api.patch(`/campus/team/${m.id}`, { roleId: e.target.value }))
                        }
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="pill pill-idle">{m.role.name}</span>
                    )}
                  </td>
                  <td className="right">
                    {canManage && !m.isMe && (
                      <button
                        type="button"
                        className="link-btn is-danger"
                        disabled={busy}
                        onClick={() => run(() => api.delete(`/campus/team/${m.id}`))}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {invites.length > 0 && (
        <section className="card">
          <h2>Invited, not joined yet</h2>
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
              {invites.map((inv) => (
                <tr key={inv.id}>
                  <td className="mono">{inv.email}</td>
                  <td>{inv.invitedName ?? '—'}</td>
                  <td>
                    <span className="pill pill-idle">{inv.role?.name ?? '—'}</span>
                  </td>
                  <td>{new Date(inv.expiresAt).toLocaleDateString()}</td>
                  <td className="right">
                    {canManage && (
                      <button
                        type="button"
                        className="link-btn is-danger"
                        disabled={busy}
                        onClick={() => run(() => api.delete(`/campus/team/invites/${inv.id}`))}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {loaded &&
        (canManage ? (
          <InviteForm
            roles={roles}
            onInvited={(link) => {
              setFreshLink(link);
              void refresh();
            }}
          />
        ) : (
          <p className="muted">Your role cannot add or remove team members.</p>
        ))}
    </CampusLayout>
  );
}

function InviteForm({
  roles,
  onInvited,
}: {
  roles: AssignableRole[];
  onInvited: (link: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [invitedName, setInvitedName] = useState('');
  const [roleId, setRoleId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Default to the narrowest role on offer, so the safe choice is the one
  // nobody has to make.
  useEffect(() => {
    if (!roleId && roles.length > 0) {
      const narrowest = [...roles].sort((a, b) => a.permissions.length - b.permissions.length)[0]!;
      setRoleId(narrowest.id);
    }
  }, [roles, roleId]);

  const chosen = roles.find((r) => r.id === roleId);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    setError(null);
    setSending(true);
    try {
      const { link } = await api.post<{ link: string }>('/campus/team/invites', {
        email,
        invitedName,
        roleId,
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
      <h2>Add someone to the team</h2>
      <p className="muted">Nobody has an account until they accept.</p>
      {error && <p className="alert alert-error">{error}</p>}

      <div className="form-row">
        <label className="field">
          <span className="field-label">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="coordinator@demo-college.example"
            disabled={sending}
          />
        </label>
        <label className="field">
          <span className="field-label">Name (optional)</span>
          <input
            value={invitedName}
            onChange={(e) => setInvitedName(e.target.value)}
            disabled={sending}
          />
        </label>
        <label className="field">
          <span className="field-label">Role</span>
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)} disabled={sending}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          {/* What the role means, rather than leaving them to find out. */}
          {chosen?.description && <span className="field-hint">{chosen.description}</span>}
        </label>
      </div>

      <button type="submit" className="btn btn-primary" disabled={sending || !roleId}>
        {sending ? 'Creating…' : 'Create invitation'}
      </button>
    </form>
  );
}
