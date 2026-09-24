import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { ApiError } from '../../api/client';
import {
  rolesApi,
  type PermissionEntry,
  type PlatformRole,
  type RoleScope,
} from '../../api/roles';
import './Roles.css';

const SCOPES: { key: RoleScope; title: string; blurb: string }[] = [
  {
    key: 'CAMPUS',
    title: 'Colleges',
    blurb: 'What a placement cell can do, inside its own college.',
  },
  {
    key: 'COMPANY',
    title: 'Companies',
    blurb: 'What a recruiting team can do, inside its own company.',
  },
  {
    key: 'ADMIN',
    title: 'University',
    blurb: 'What operations can do across every college and company.',
  },
];

/** Permissions read better in the groups people already think in. */
const AREAS: { prefix: string; title: string }[] = [
  { prefix: 'roster', title: 'Students and batches' },
  { prefix: 'drive', title: 'Seasons' },
  { prefix: 'posting', title: 'Company requests' },
  { prefix: 'job', title: 'Roles' },
  { prefix: 'application', title: 'Applications' },
  { prefix: 'offer', title: 'Offers' },
  { prefix: 'team', title: 'Team' },
  { prefix: 'college', title: 'Colleges' },
  { prefix: 'company', title: 'Companies' },
  { prefix: 'user', title: 'Accounts' },
  { prefix: 'role', title: 'Roles' },
  { prefix: 'settings', title: 'Settings' },
  { prefix: 'audit', title: 'Records' },
];

interface Draft {
  name: string;
  description: string;
  permissions: string[];
}

/**
 * Creating and editing roles.
 *
 * A list on the left grouped by which world each role belongs to, one role open
 * on the right. The same shape as the set-up screen, for the same reason: a
 * page showing eight roles and eighteen permission checkboxes at once is a page
 * nobody can find anything on.
 *
 * Students are absent here by design. A candidate is not a role anybody
 * creates - they arrive on a college roster - so there is nothing to grant.
 */
export default function Roles() {
  const [roles, setRoles] = useState<PlatformRole[]>([]);
  const [catalogue, setCatalogue] = useState<PermissionEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creatingIn, setCreatingIn] = useState<RoleScope | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await rolesApi.list();
      setRoles(data.roles);
      setCatalogue(data.catalogue);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the roles.');
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = roles.find((r) => r.id === selectedId) ?? null;

  function open(id: string) {
    setCreatingIn(null);
    setSelectedId(id);
  }

  /**
   * Which world the new role belongs to is asked in the editor, not decided by
   * which heading you happened to click. It is the first real question about a
   * role - a college role and an operations role have nothing in common - so
   * it belongs with the rest of them.
   */
  function startNew(scope: RoleScope = 'CAMPUS') {
    setSelectedId(null);
    setCreatingIn(scope);
  }

  return (
    <AdminLayout>
      <header className="page-head">
        <div>
          <h1>Role management</h1>
          <p className="page-lede">
            What each kind of login may do — a university login, a college one, or a company one.
            Create a role here, choose its permissions, then hand it to somebody on{' '}
            <Link to="/admin/logins">Logins</Link>.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => startNew()}
          aria-expanded={creatingIn !== null}
        >
          New role
        </button>
      </header>

      {error && <p className="alert alert-error">{error}</p>}
      {!loaded && <p className="muted">Loading…</p>}

      {loaded && (
        <div className="roles">
          <nav className="roles-list" aria-label="Roles">
            {SCOPES.map((s) => {
              const inScope = roles.filter((r) => r.scope === s.key);
              return (
                <div key={s.key} className="roles-group">
                  <div className="roles-group-head">
                    <p className="roles-group-title">{s.title}</p>
                    <button type="button" className="roles-add" onClick={() => startNew(s.key)}>
                      + New
                    </button>
                  </div>

                  {inScope.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className={`role-row ${r.id === selectedId ? 'is-current' : ''} ${
                        r.isActive ? '' : 'is-retired'
                      }`}
                      onClick={() => open(r.id)}
                      aria-current={r.id === selectedId}
                    >
                      <span className="role-row-name">
                        {r.name}
                        {!r.isActive && <span className="role-tag">retired</span>}
                      </span>
                      <span className="role-row-meta">
                        {r.permissions.length} permission{r.permissions.length === 1 ? '' : 's'}
                        {r.memberCount > 0 && ` · ${r.memberCount} holding`}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
          </nav>

          <section className="roles-pane">
            {creatingIn && (
              <RoleEditor
                key="new"
                scope={creatingIn}
                onScope={setCreatingIn}
                catalogue={catalogue}
                onSaved={async (id) => {
                  await load();
                  setCreatingIn(null);
                  setSelectedId(id);
                }}
                onCancel={() => setCreatingIn(null)}
              />
            )}

            {!creatingIn && selected && (
              <RoleEditor
                key={selected.id}
                role={selected}
                scope={selected.scope}
                catalogue={catalogue}
                onSaved={load}
                onDeleted={async () => {
                  await load();
                  setSelectedId(null);
                }}
              />
            )}

            {!creatingIn && !selected && (
              <div className="roles-empty">
                <h2>Pick a role</h2>
                <p>
                  Choose one on the left to see what it can do, or make a new one. The permissions
                  themselves are fixed; which of them a role holds is yours to decide.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </AdminLayout>
  );
}

/* -------------------------------------------------------------------------- */

function RoleEditor({
  role,
  scope,
  onScope,
  catalogue,
  onSaved,
  onCancel,
  onDeleted,
}: {
  role?: PlatformRole;
  scope: RoleScope;
  /** Only while creating: an existing role cannot change worlds. */
  onScope?: (scope: RoleScope) => void;
  catalogue: PermissionEntry[];
  onSaved: (id: string) => void | Promise<void>;
  onCancel?: () => void;
  onDeleted?: () => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft>({
    name: role?.name ?? '',
    description: role?.description ?? '',
    permissions: role?.permissions ?? [],
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const locked = role?.isLocked ?? false;

  // Switching worlds mid-draft leaves permissions behind that the new one
  // cannot hold; the server would drop them silently, so they go here where
  // the change is visible.
  useEffect(() => {
    const allowed = new Set(catalogue.filter((p) => p.scopes.includes(scope)).map((p) => p.key));
    setDraft((d) => {
      const kept = d.permissions.filter((p) => allowed.has(p));
      return kept.length === d.permissions.length ? d : { ...d, permissions: kept };
    });
  }, [scope, catalogue]);

  /** Only the permissions this world can hold, grouped for reading. */
  const groups = useMemo(() => {
    const available = catalogue.filter((p) => p.scopes.includes(scope));
    return AREAS.map((a) => ({
      title: a.title,
      items: available.filter((p) => p.key.split(':')[0] === a.prefix),
    })).filter((g) => g.items.length > 0);
  }, [catalogue, scope]);

  function toggle(key: string) {
    setDraft((d) => ({
      ...d,
      permissions: d.permissions.includes(key)
        ? d.permissions.filter((p) => p !== key)
        : [...d.permissions, key],
    }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      const body = {
        name: draft.name,
        description: draft.description,
        // A locked role never sends permissions: the server refuses them, and
        // sending what cannot change is how a save fails for no visible reason.
        ...(locked ? {} : { permissions: draft.permissions }),
      };

      const saved = role
        ? await rolesApi.update(role.id, body)
        : await rolesApi.create({ ...body, scope, permissions: draft.permissions });

      await onSaved(saved.role.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the role.');
    } finally {
      setSaving(false);
    }
  }

  async function setActive(isActive: boolean) {
    if (!role) return;
    setError(null);
    try {
      await rolesApi.update(role.id, { name: role.name, isActive });
      await onSaved(role.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change the role.');
    }
  }

  async function remove() {
    if (!role) return;
    setError(null);
    try {
      await rolesApi.remove(role.id);
      await onDeleted?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete the role.');
    }
  }

  return (
    <form className="role-editor" onSubmit={onSubmit} noValidate>
      <header className="role-head">
        <p className="role-scope">{SCOPES.find((s) => s.key === scope)?.title}</p>
        <h2>{role ? role.name : 'New role'}</h2>
        <p className="role-blurb">{SCOPES.find((s) => s.key === scope)?.blurb}</p>
      </header>

      {error && <p className="alert alert-error">{error}</p>}

      {/*
        Asked first, because everything below depends on it: the permissions a
        college role may hold are not the ones an operations role may hold, so
        changing this changes the whole list underneath.
      */}
      {onScope && (
        <fieldset className="scope-choice">
          <legend className="field-label">What kind of login is this role for?</legend>
          {SCOPES.map((s) => (
            <label key={s.key} className={`scope ${scope === s.key ? 'is-current' : ''}`}>
              <input
                type="radio"
                name="role-scope"
                checked={scope === s.key}
                onChange={() => onScope(s.key)}
              />
              <span>
                <b>
                  {s.key === 'ADMIN'
                    ? 'University login'
                    : s.key === 'CAMPUS'
                      ? 'College login'
                      : 'Company login'}
                </b>
                <span className="scope-hint">{s.blurb}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {locked && (
        <p className="alert alert-warn">
          This is the role that can do everything for its organisations. It can be renamed, but its
          permissions cannot be reduced — take one away and every organisation could be left with
          nobody able to act. Make a narrower role instead.
        </p>
      )}

      <div className="form-row">
        <label className="field">
          <span className="field-label">Name</span>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            required
            autoFocus={!role}
            placeholder="Verifier"
            disabled={saving}
          />
        </label>
        <label className="field">
          <span className="field-label">What it is for</span>
          <input
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="Checks marks and freezes students. Nothing else."
            disabled={saving}
          />
          <span className="field-hint">Shown to whoever is choosing a role for a colleague.</span>
        </label>
      </div>

      <div className="perms">
        <div className="perms-head">
          <p className="field-label">Permissions</p>
          <span className="perms-count">
            {locked ? draft.permissions.length : draft.permissions.length} of{' '}
            {groups.reduce((n, g) => n + g.items.length, 0)} selected
          </span>
        </div>

        {groups.map((g) => (
          <fieldset key={g.title} className="perm-group">
            <legend>{g.title}</legend>
            {g.items.map((p) => (
              <label key={p.key} className={`perm ${locked ? 'is-locked' : ''}`}>
                <input
                  type="checkbox"
                  checked={draft.permissions.includes(p.key)}
                  onChange={() => toggle(p.key)}
                  disabled={locked || saving}
                />
                <span>
                  {p.label}
                  <span className="perm-key">{p.key}</span>
                </span>
              </label>
            ))}
          </fieldset>
        ))}
      </div>

      <footer className="role-foot">
        <div className="btn-row">
          <button type="submit" className="btn btn-primary" disabled={saving || !draft.name.trim()}>
            {saving ? 'Saving…' : role ? 'Save changes' : 'Create role'}
          </button>
          {/*
            A role is only worth anything once somebody holds it, and this is
            the moment you know which role you mean. The form itself lives on
            the Logins screen - one implementation, reached with the role
            already chosen.
          */}
          {role && role.isActive && (
            <Link
              to={`/admin/logins?role=${role.id}&scope=${role.scope}`}
              className="btn btn-secondary"
            >
              Create a login with this role
            </Link>
          )}
          {onCancel && (
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>

        {role && !locked && (
          <div className="btn-row">
            {/*
              Retiring keeps the role on whoever holds it and stops it being
              offered again. Deleting is only ever for one nobody has.
            */}
            <button
              type="button"
              className="link-btn"
              onClick={() => setActive(!role.isActive)}
              disabled={saving}
            >
              {role.isActive ? 'Retire this role' : 'Bring it back'}
            </button>
            {!role.isSystem && role.memberCount === 0 && (
              <button type="button" className="link-btn is-danger" onClick={remove}>
                Delete
              </button>
            )}
          </div>
        )}
      </footer>

      {role && role.memberCount > 0 && (
        <p className="role-note">
          <Link to={`/admin/logins?scope=${role.scope}`}>
            {role.memberCount} {role.memberCount === 1 ? 'person holds' : 'people hold'} this role
          </Link>
          . Changes apply to all of them the next time they act.
        </p>
      )}
    </form>
  );
}
