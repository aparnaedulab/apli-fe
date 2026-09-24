import { useCallback, useEffect, useState, type FormEvent } from 'react';
import CompanyLayout from './CompanyLayout';
import { companyApi, type TeamInvite, type TeamMember } from '../../api/company';
import { rolesApi, type AssignableRole } from '../../api/roles';
import RolePreview, { type PermissionLabel } from '../../components/RolePreview';
import { ApiError } from '../../api/client';
import { OneTimeLink } from '../admin/Companies';

/** The capability this screen is about: who may change who else is here. */
const ADMIN = 'team:manage';

const isAdminRole = (permissions?: string[]) => Boolean(permissions?.includes(ADMIN));

/**
 * Everyone at this company who can sign in, and what each of them may do.
 *
 * Roles are not a fixed list - the platform keeps them, and a company may be
 * given more than one that can run the account - so this screen asks which
 * ones it may hand out rather than naming any itself. What *this* person may
 * do arrives with the team, so controls are hidden rather than offered and
 * then refused.
 */
export default function Team() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [roles, setRoles] = useState<AssignableRole[]>([]);
  const [catalogue, setCatalogue] = useState<PermissionLabel[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshLink, setFreshLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { members: m, invites: i, myPermissions } = await companyApi.team();
      setMembers(m);
      setInvites(i);
      setPermissions(myPermissions ?? []);
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
      .assignableWithCatalogue()
      .then(({ roles: r, catalogue: c }) => {
        setRoles(r);
        setCatalogue(c ?? []);
      })
      .catch(() => setRoles([]));
  }, [refresh]);

  /** Every change reloads, so the last-admin rule is read from the server. */
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

  const canManage = permissions.includes(ADMIN);
  const admins = members.filter((m) => isAdminRole(m.role.permissions)).length;

  return (
    <CompanyLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Recruiter</p>
          <h1>Team</h1>
          <p className="page-lede">
            Everyone who can work on your hiring. You create their logins here &mdash; they set
            their own password when they accept. What somebody may do is their role, and a role
            that can manage the team can add and remove people, including other admins.
          </p>
        </div>
      </header>

      {error && <p className="alert alert-error">{error}</p>}
      {!loaded && <p className="muted">Loading…</p>}

      {freshLink && <OneTimeLink link={freshLink} onDismiss={() => setFreshLink(null)} />}

      {loaded && (
        <section className="card">
          <h2>Members</h2>
          <p className="muted">
            {members.length} {members.length === 1 ? 'person' : 'people'} &mdash; {admins} who can
            manage the team.
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Can manage the team</th>
                <th>What they may do</th>
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
                    {/*
                      Changing the role is how somebody is made an admin, or
                      stops being one: the role is the whole of what they may
                      do, so a separate switch would be a second answer to one
                      question.
                    */}
                    {canManage && !m.isMe ? (
                      <select
                        value={m.role.id}
                        disabled={busy}
                        aria-label={`Role for ${m.user.fullName}`}
                        onChange={(e) =>
                          run(() => companyApi.setMemberRole(m.id, e.target.value))
                        }
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                            {isAdminRole(r.permissions) ? ' — admin' : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="pill pill-idle">{m.role.name}</span>
                    )}
                  </td>
                  <td>
                    {isAdminRole(m.role.permissions) ? (
                      <span className="pill pill-pass">Yes</span>
                    ) : (
                      <span className="muted">No</span>
                    )}
                  </td>
                  <td>
                    {/* Read from the catalogue, so it says the same thing
                        here as it does on the invitation form. */}
                    <RolePreview
                      role={roles.find((r) => r.id === m.role.id) ?? {
                        id: m.role.id,
                        name: m.role.name,
                        description: null,
                        permissions: m.role.permissions ?? [],
                      }}
                      catalogue={catalogue}
                    />
                  </td>
                  <td className="right">
                    {canManage && !m.isMe && (
                      <button
                        type="button"
                        className="link-btn is-danger"
                        disabled={busy}
                        onClick={() => run(() => companyApi.removeMember(m.id))}
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
                        onClick={() => run(() => companyApi.cancelInvite(inv.id))}
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
            catalogue={catalogue}
            onInvited={(link) => {
              setFreshLink(link);
              void refresh();
            }}
          />
        ) : (
          <p className="muted">Your role cannot add or remove team members.</p>
        ))}
    </CompanyLayout>
  );
}

function InviteForm({
  roles,
  catalogue,
  onInvited,
}: {
  roles: AssignableRole[];
  catalogue: PermissionLabel[];
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
  const adminRoles = roles.filter((r) => isAdminRole(r.permissions));
  const asAdmin = isAdminRole(chosen?.permissions);

  /*
   * The admin switch moves the role rather than setting a flag beside it.
   *
   * Managing the team is a permission a role carries, not a property of a
   * person, so a switch that stored its own answer would be a second source
   * of truth that the server would ignore. Turned on, it picks the narrowest
   * role that can manage the team; turned off, the narrowest that cannot.
   */
  function setAdmin(on: boolean) {
    const pool = on ? adminRoles : roles.filter((r) => !isAdminRole(r.permissions));
    const narrowest = [...pool].sort((a, b) => a.permissions.length - b.permissions.length)[0];
    if (narrowest) setRoleId(narrowest.id);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (sending || !roleId) return;
    setError(null);
    setSending(true);
    try {
      const { link } = await companyApi.invite({ email, invitedName, roleId });
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
      <p className="muted">Nobody has an account until they accept the invitation.</p>
      {error && <p className="alert alert-error">{error}</p>}

      <div className="form-row">
        <label className="field">
          <span className="field-label">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="recruiter@demo-company.example"
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
            {roles.length === 0 && <option value="">Loading…</option>}
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/*
        Shown open, not behind a link: the role is the decision this form is
        making, and a permission somebody did not mean to hand out is not the
        sort of thing to find out about later.
      */}
      <RolePreview role={chosen} catalogue={catalogue} open />

      {adminRoles.length > 0 && (
        <label className="check-row">
          <input
            type="checkbox"
            checked={asAdmin}
            onChange={(e) => setAdmin(e.target.checked)}
            disabled={sending}
          />
          <span>
            <b>Make them a company admin</b>
            <span className="check-hint">
              They can invite and remove colleagues, and give other people admin themselves. This
              is carried by the role, so ticking it moves them to{' '}
              <b>{adminRoles.map((r) => r.name).join(' or ')}</b> &mdash; which grants everything
              that role grants, not team management alone.
            </span>
          </span>
        </label>
      )}

      <button type="submit" className="btn btn-primary" disabled={sending || !roleId}>
        {sending ? 'Creating…' : 'Create invitation'}
      </button>
    </form>
  );
}
