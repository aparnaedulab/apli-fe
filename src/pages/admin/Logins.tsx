import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { api, ApiError } from '../../api/client';
import { adminApi } from '../../api/admin';
import { rolesApi, type AssignableRole, type RoleScope } from '../../api/roles';
import { OneTimeLink } from './Companies';
import '../../components/AddStudents.css';
import './Logins.css';

/** What became of the invitation email for one person. */
type EmailOutcome =
  | { state: 'sent' }
  | { state: 'failed'; reason: string }
  | { state: 'not asked' };

interface BulkResult {
  created: {
    row: number;
    fullName: string;
    email: string;
    role: string;
    where: string;
    link: string;
    emailed: EmailOutcome;
  }[];
  skipped: { row: number; fullName: string; email: string; reason: string }[];
  fileName: string | null;
  rowsRead: number;
  mailConfigured: boolean;
}

/** Whether this portal can send at all, and who from. */
interface MailStatus {
  configured: boolean;
  from: string | null;
}

/** One line saying what happened to an email, in the same words everywhere. */
function EmailCell({ emailed }: { emailed: EmailOutcome }) {
  if (emailed.state === 'sent') return <span className="pill pill-pass">Emailed</span>;

  if (emailed.state === 'failed') {
    return (
      <>
        <span className="pill pill-stop">Not sent</span>
        <span className="row-sub">{emailed.reason}</span>
      </>
    );
  }

  return (
    <>
      <span className="pill pill-idle">Link only</span>
      <span className="row-sub">Send email was blank or No.</span>
    </>
  );
}

interface Person {
  membershipId: string;
  scope: RoleScope;
  user: { id: string; fullName: string; email: string; phone: string | null; isActive: boolean };
  role: { id: string; name: string };
  org: { id: string; name: string } | null;
  joinedAt: string;
}

interface PendingInvite {
  id: string;
  email: string;
  invitedName: string | null;
  phone: string | null;
  role: { id: string; name: string; scope: RoleScope } | null;
  org: string | null;
  expiresAt: string;
}

interface AccessData {
  people: Person[];
  invites: PendingInvite[];
  canCreate: Record<RoleScope, boolean>;
  mail: MailStatus;
}

const SCOPE_LABEL: Record<RoleScope, string> = {
  ADMIN: 'University',
  CAMPUS: 'College',
  COMPANY: 'Company',
};

/**
 * Every login that holds a role, and the one place to make another.
 *
 * Colleges and companies build their own teams; this is the university's view
 * across all of them - and the only way to create an operations login at all.
 * Until now that took a command-line script.
 *
 * Students are absent on purpose. They hold no role and arrive on a college
 * roster; offering to "create a student login" here would be offering to
 * bypass the roster that makes a student record worth trusting.
 */
export default function Logins() {
  const [data, setData] = useState<AccessData | null>(null);
  const [scope, setScope] = useState<RoleScope | 'ALL'>('ALL');
  const [q, setQ] = useState('');
  const [typed, setTyped] = useState('');
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState<{ link: string; emailed: EmailOutcome } | null>(null);
  const [error, setError] = useState<string | null>(null);

  /*
   * Arriving from the Roles screen with a role already in mind.
   *
   * The form opens on that role rather than making somebody find it again in
   * a list of eight - they were looking straight at it a click ago.
   */
  const [params, setParams] = useSearchParams();
  const askedRole = params.get('role');
  const askedScope = params.get('scope') as RoleScope | null;

  useEffect(() => {
    if (askedRole) setCreating(true);
  }, [askedRole]);

  useEffect(() => {
    const id = window.setTimeout(() => setQ(typed), 250);
    return () => window.clearTimeout(id);
  }, [typed]);

  const load = useCallback(async () => {
    try {
      const search = new URLSearchParams();
      if (scope !== 'ALL') search.set('scope', scope);
      if (q) search.set('q', q);
      const qs = search.toString();
      setData(await api.get<AccessData>(`/admin/access${qs ? `?${qs}` : ''}`));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the logins.');
    }
  }, [scope, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const all = data?.people ?? [];
    return {
      ADMIN: all.filter((p) => p.scope === 'ADMIN').length,
      CAMPUS: all.filter((p) => p.scope === 'CAMPUS').length,
      COMPANY: all.filter((p) => p.scope === 'COMPANY').length,
    };
  }, [data]);

  return (
    <AdminLayout>
      <header className="page-head">
        <div>
          <h1>Logins</h1>
          <p className="page-lede">
            Everyone who can sign in and what they may do. Nobody is given a password — each
            person sets their own from a one-time link.{' '}
            <Link to="/admin/roles">Role management</Link> decides what each of these can do.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            if (creating) setParams({}, { replace: true });
            setCreating((v) => !v);
          }}
          aria-expanded={creating}
        >
          {creating ? 'Cancel' : 'Create a login'}
        </button>
      </header>

      {error && <p className="alert alert-error">{error}</p>}

      {fresh && (
        <>
          {fresh.emailed.state === 'sent' && (
            <p className="alert alert-ok">
              The invitation was emailed. The link below is the same one &mdash; keep it only if
              you need to send it another way.
            </p>
          )}
          {fresh.emailed.state === 'failed' && (
            <p className="alert alert-error">
              The account was created, but the email did not go out: {fresh.emailed.reason}
            </p>
          )}
          <OneTimeLink link={fresh.link} onDismiss={() => setFresh(null)} />
        </>
      )}

      {creating && data && (
        <CreateLogins
          canCreate={data.canCreate}
          initialScope={askedScope ?? undefined}
          initialRoleId={askedRole ?? undefined}
          mail={data.mail}
          onCreated={(link, emailed) => {
            setFresh({ link, emailed });
            setCreating(false);
            setParams({}, { replace: true });
            void load();
          }}
          onImported={() => void load()}
        />
      )}

      {data && (
        <>
          <div className="logins-bar">
            <div className="search">
              <input
                type="search"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Search by name or email"
                aria-label="Search logins"
              />
            </div>

            <div className="tabs-bar compact">
              {(['ALL', 'ADMIN', 'CAMPUS', 'COMPANY'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`tabs-btn ${scope === s ? 'is-active' : ''}`}
                  onClick={() => setScope(s)}
                >
                  {s === 'ALL' ? 'Everyone' : SCOPE_LABEL[s]}
                  {s !== 'ALL' && counts[s] > 0 && <span className="tab-count">{counts[s]}</span>}
                </button>
              ))}
            </div>
          </div>

          {data.invites.length > 0 && (
            <section className="card">
              <div className="card-head">
                <h2>Invited, not joined yet</h2>
                <span className="muted">{data.invites.length} waiting</span>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Mobile</th>
                    <th>Role</th>
                    <th>Where</th>
                    <th>Expires</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.invites.map((inv) => (
                    <tr key={inv.id}>
                      <td>{inv.invitedName ?? '—'}</td>
                      <td className="mono">{inv.email}</td>
                      <td className="mono">{inv.phone ?? '—'}</td>
                      <td>
                        <span className="pill pill-idle">{inv.role?.name ?? '—'}</span>
                      </td>
                      <td>{inv.org ?? 'The university'}</td>
                      <td>{new Date(inv.expiresAt).toLocaleDateString()}</td>
                      <td className="right">
                        <button
                          type="button"
                          className="link-btn is-danger"
                          onClick={async () => {
                            await api.delete(`/admin/access/invites/${inv.id}`);
                            void load();
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

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Mobile</th>
                  <th>Kind</th>
                  <th>Role</th>
                  <th>Where</th>
                  <th>Account</th>
                </tr>
              </thead>
              <tbody>
                {data.people.map((p) => (
                  <tr key={p.membershipId}>
                    <td>
                      {p.user.fullName}
                      <span className="row-sub mono">{p.user.email}</span>
                    </td>
                    <td className="mono">{p.user.phone ?? '—'}</td>
                    <td>
                      <span className={`pill pill-${p.scope === 'ADMIN' ? 'pass' : 'idle'}`}>
                        {SCOPE_LABEL[p.scope]}
                      </span>
                    </td>
                    <td>{p.role.name}</td>
                    <td>{p.org?.name ?? 'The university'}</td>
                    <td>
                      {p.user.isActive ? (
                        <span className="pill pill-pass">Active</span>
                      ) : (
                        <span className="pill pill-idle">Not joined</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.people.length === 0 && (
            <div className="empty">
              <h2>Nobody here</h2>
              <p>No login matches {q ? `"${q}"` : 'this filter'}.</p>
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Creating a login.
 *
 * The kind comes first, because it decides everything after it: a college
 * login needs a college, a company login needs a company, and an operations
 * login needs neither.
 */
/**
 * Creating logins one at a time, or a file at a time.
 *
 * Both live behind the same button because they are the same act - the only
 * difference is whether you are onboarding one placement officer or the
 * thirty-eight a university hands over at the start of a season.
 */
function CreateLogins({
  canCreate,
  mail,
  initialScope,
  initialRoleId,
  onCreated,
  onImported,
}: {
  canCreate: Record<RoleScope, boolean>;
  mail: MailStatus;
  initialScope?: RoleScope;
  initialRoleId?: string;
  onCreated: (link: string, emailed: EmailOutcome) => void;
  onImported: () => void;
}) {
  const [mode, setMode] = useState<'one' | 'many'>('one');

  return (
    <section className="card form-card">
      <div className="card-head">
        <h2>Create a login</h2>
        <div className="tabs-bar compact">
          <button
            type="button"
            className={`tabs-btn ${mode === 'one' ? 'is-active' : ''}`}
            onClick={() => setMode('one')}
          >
            One person
          </button>
          <button
            type="button"
            className={`tabs-btn ${mode === 'many' ? 'is-active' : ''}`}
            onClick={() => setMode('many')}
          >
            Many, from Excel
          </button>
        </div>
      </div>

      <p className="muted">
        Everybody gets a one-time link and sets their own password. Nobody &mdash; including you
        &mdash; ever sees it.
      </p>

      {mode === 'one' ? (
        <NewLogin
          bare
          canCreate={canCreate}
          mail={mail}
          initialScope={initialScope}
          initialRoleId={initialRoleId}
          onCreated={onCreated}
        />
      ) : (
        <BulkLogins mail={mail} onImported={onImported} />
      )}
    </section>
  );
}

/**
 * A file of people, each row resolved on its own.
 *
 * The template is generated fresh, so the Role column is a dropdown of the
 * roles that exist today and the last sheet lists every college code and
 * company name a row is allowed to name. Getting those right is the whole
 * difficulty; a static file would go stale the first time somebody adds a role.
 */
function BulkLogins({ mail, onImported }: { mail: MailStatus; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function downloadTemplate() {
    setError(null);
    setDownloading(true);
    try {
      await api.download('/admin/access/bulk/template', 'apli-logins.xlsx');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not download the template.');
    } finally {
      setDownloading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving || !file) return;
    setError(null);
    setSaving(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.upload<BulkResult>('/admin/access/bulk', form);
      setResult(res);
      setFile(null);
      onImported();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not read that file.');
    } finally {
      setSaving(false);
    }
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('Could not reach the clipboard. Select the link and copy it by hand.');
    }
  }

  if (result) {
    const sent = result.created.filter((c) => c.emailed.state === 'sent').length;
    const asked = result.created.filter((c) => c.emailed.state !== 'not asked').length;

    return (
      <div className="bulk-result">
        <div className="card-head">
          <h3>
            {result.created.length} invitation{result.created.length === 1 ? '' : 's'} created
            {result.skipped.length > 0 && `, ${result.skipped.length} skipped`}
          </h3>
          {result.fileName && (
            <span className="muted">
              {result.fileName} &middot; {result.rowsRead} row
              {result.rowsRead === 1 ? '' : 's'} read
            </span>
          )}
        </div>

        {error && <p className="alert alert-error">{error}</p>}

        {result.created.length > 0 && (
          <>
            {/*
              Every link below is a credential: whoever opens it becomes that
              person. They are shown once, here, and never again.
            */}
            <p className="alert alert-warn">
              Each link works once and lets whoever opens it become that person. Send each one to
              its own address, and to nobody else. They are not shown again.
            </p>

            {sent > 0 && (
              <p className="alert alert-ok">
                {sent} of {result.created.length} {sent === 1 ? 'was' : 'were'} emailed straight
                away. The rest are yours to send.
              </p>
            )}

            {!result.mailConfigured && asked > 0 && (
              <p className="alert alert-error">
                {asked} row{asked === 1 ? '' : 's'} asked for an email, but this portal has no mail
                server set up &mdash; so none went out. Every account below was still created; copy
                the links and send them yourself.
              </p>
            )}

            <div className="btn-row">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  copy(
                    result.created.map((c) => `${c.fullName}\t${c.email}\t${c.link}`).join('\n'),
                    'all',
                  )
                }
              >
                {copied === 'all' ? 'Copied all' : 'Copy all as a list'}
              </button>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Role</th>
                  <th>Where</th>
                  <th>Email</th>
                  <th>One-time link</th>
                </tr>
              </thead>
              <tbody>
                {result.created.map((c) => (
                  <tr key={c.email}>
                    <td>
                      {c.fullName}
                      <span className="row-sub mono">{c.email}</span>
                    </td>
                    <td>
                      <span className="pill pill-idle">{c.role}</span>
                    </td>
                    <td>{c.where}</td>
                    <td>
                      <EmailCell emailed={c.emailed} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => copy(c.link, c.email)}
                      >
                        {copied === c.email ? 'Copied' : 'Copy link'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {result.skipped.length > 0 && (
          <div className="skipped">
            <p className="skipped-title">
              Skipped {result.skipped.length}. Fix these rows and upload the file again &mdash;
              the ones above will not be created twice.
            </p>
            <ul>
              {result.skipped.map((s) => (
                <li key={`${s.row}-${s.email}`}>
                  <span className="mono">Row {s.row}</span>{' '}
                  {s.fullName || s.email ? `(${s.fullName || s.email})` : ''} &mdash; {s.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="btn-row">
          <button type="button" className="btn btn-secondary" onClick={() => setResult(null)}>
            Upload another file
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {error && <p className="alert alert-error">{error}</p>}

      <div className="template-strip">
        <div>
          <p className="template-title">Start from the template</p>
          <p className="template-note">
            Name, email, mobile, which role in which college or company, and whether to email them
            their link &mdash; with the roles that exist today as a dropdown, every college code
            and company name on a sheet of its own, and three filled-in examples that are ignored
            on upload.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={downloadTemplate}
          disabled={downloading}
        >
          {downloading ? 'Preparing…' : 'Download Excel template'}
        </button>
      </div>

      <label className="field">
        <span className="field-label">Filled-in file</span>
        <input
          type="file"
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={saving}
          className="file-input"
        />
        <span className="field-hint">
          {file
            ? `${file.name} · ${(file.size / 1024).toFixed(0)} KB`
            : 'An .xlsx from the template above, or a .csv export. Up to 500 people.'}
        </span>
      </label>

      {/*
        Said before the upload, not after. The Send email column decides this
        per person, and a blank one sends nothing - which is worth knowing
        while the file can still be changed.
      */}
      <p className={`alert ${mail.configured ? 'alert-warn' : 'alert-error'}`}>
        {mail.configured ? (
          <>
            Rows with <b>Yes</b> in the Send email column are emailed their link as soon as you
            upload, from <span className="mono">{mail.from}</span>. A blank counts as No.
          </>
        ) : (
          <>
            This portal has no mail server set up yet, so nothing can be emailed whatever the Send
            email column says. Every login is still created, and you copy the links out yourself.
          </>
        )}
      </p>

      <button type="submit" className="btn btn-primary" disabled={saving || !file}>
        {saving ? 'Creating…' : 'Create the invitations'}
      </button>
    </form>
  );
}

function NewLogin({
  bare,
  canCreate,
  mail,
  initialScope,
  initialRoleId,
  onCreated,
}: {
  canCreate: Record<RoleScope, boolean>;
  mail: MailStatus;
  /** Set when arriving from a particular role on the Roles screen. */
  initialScope?: RoleScope;
  initialRoleId?: string;
  onCreated: (link: string, emailed: EmailOutcome) => void;
  /** Set when the surrounding panel already carries the heading and the intro. */
  bare?: boolean;
}) {
  const kinds = (['ADMIN', 'CAMPUS', 'COMPANY'] as RoleScope[]).filter((s) => canCreate[s]);

  const [scope, setScope] = useState<RoleScope>(
    initialScope && kinds.includes(initialScope) ? initialScope : (kinds[0] ?? 'CAMPUS'),
  );
  const [roles, setRoles] = useState<AssignableRole[]>([]);
  const [roleId, setRoleId] = useState('');
  const [orgId, setOrgId] = useState('');
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [email, setEmail] = useState('');
  const [invitedName, setInvitedName] = useState('');
  const [phone, setPhone] = useState('');
  /*
   * Ticked by default, but only because one person is in front of whoever is
   * ticking it. The spreadsheet defaults the other way - a file where nobody
   * filled the column in must not become three hundred emails.
   */
  const [sendEmail, setSendEmail] = useState(mail.configured);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The roles on offer, and the organisations to attach to, both follow the
  // kind - so both are reloaded whenever it changes.
  useEffect(() => {
    setRoleId('');
    setOrgId('');
    rolesApi
      .assignable(scope)
      .then((r) => {
        setRoles(r);

        // The role that was asked for, if it is one this kind can hold;
        // otherwise the narrowest, because the safe choice should be the one
        // nobody has to make.
        const asked = initialRoleId ? r.find((x) => x.id === initialRoleId) : undefined;
        const narrowest = [...r].sort((a, b) => a.permissions.length - b.permissions.length)[0];
        const pick = asked ?? narrowest;
        if (pick) setRoleId(pick.id);
      })
      .catch(() => setRoles([]));

    if (scope === 'CAMPUS') {
      adminApi
        .listColleges({ limit: 100, sort: 'name' })
        .then((res) => setOrgs(res.colleges.map((c) => ({ id: c.id, name: `${c.name} (${c.code})` }))))
        .catch(() => setOrgs([]));
    } else if (scope === 'COMPANY') {
      api
        .get<{ companies: { id: string; name: string }[] }>('/admin/companies')
        .then((res) => setOrgs(res.companies))
        .catch(() => setOrgs([]));
    } else {
      setOrgs([]);
    }
  }, [scope]);

  const chosen = roles.find((r) => r.id === roleId);
  const needsOrg = scope !== 'ADMIN';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      const { link, emailed } = await api.post<{ link: string; emailed: EmailOutcome }>(
        '/admin/access/invites',
        {
          email,
          invitedName,
          phone,
          roleId,
          sendEmail: sendEmail && mail.configured,
          ...(scope === 'CAMPUS' ? { collegeId: orgId } : {}),
          ...(scope === 'COMPANY' ? { companyId: orgId } : {}),
        },
      );
      setEmail('');
      setInvitedName('');
      setPhone('');
      onCreated(link, emailed);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the login.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={bare ? '' : 'card form-card'} onSubmit={onSubmit} noValidate>
      {!bare && (
        <>
          <h2>Create a login</h2>
          <p className="muted">
            They get a one-time link and set their own password. Nobody — including you — ever
            sees it.
          </p>
        </>
      )}

      {error && <p className="alert alert-error">{error}</p>}

      <fieldset className="scope-choice">
        <legend className="field-label">What kind of login?</legend>
        {kinds.map((s) => (
          <label key={s} className={`scope ${scope === s ? 'is-current' : ''}`}>
            <input
              type="radio"
              name="login-kind"
              checked={scope === s}
              onChange={() => setScope(s)}
            />
            <span>
              <b>
                {s === 'ADMIN'
                  ? 'University'
                  : s === 'CAMPUS'
                    ? 'A college'
                    : 'A company'}
              </b>
              <span className="scope-hint">
                {s === 'ADMIN'
                  ? 'Works across every college and company.'
                  : s === 'CAMPUS'
                    ? 'Works inside one college only.'
                    : 'Works inside one company only.'}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="form-row">
        {needsOrg && (
          <label className="field">
            <span className="field-label">
              Which {scope === 'CAMPUS' ? 'college' : 'company'}?
            </span>
            <select value={orgId} onChange={(e) => setOrgId(e.target.value)} disabled={saving}>
              <option value="">Choose one</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="field">
          <span className="field-label">Role</span>
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)} disabled={saving}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          {chosen?.description && <span className="field-hint">{chosen.description}</span>}
        </label>
      </div>

      <div className="form-row">
        <label className="field">
          <span className="field-label">
            Full name<span className="req">required</span>
          </span>
          <input
            value={invitedName}
            onChange={(e) => setInvitedName(e.target.value)}
            required
            placeholder="Sujata Bhide"
            disabled={saving}
          />
        </label>
        <label className="field">
          <span className="field-label">
            Email<span className="req">required</span>
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="name@demo-university.example"
            disabled={saving}
          />
          <span className="field-hint">The activation link goes here, and it is how they sign in.</span>
        </label>
        <label className="field">
          <span className="field-label">Mobile</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="9000000023"
            inputMode="tel"
            disabled={saving}
          />
          <span className="field-hint">
            Optional, but it is how you chase somebody when the link never arrives.
          </span>
        </label>
      </div>

      <label className={`check-row ${mail.configured ? '' : 'is-off'}`}>
        <input
          type="checkbox"
          checked={sendEmail && mail.configured}
          onChange={(e) => setSendEmail(e.target.checked)}
          disabled={saving || !mail.configured}
        />
        <span>
          <b>Email them the link now</b>
          <span className="check-hint">
            {mail.configured ? (
              <>
                Sent from <span className="mono">{mail.from}</span> the moment you create it. Leave
                this off to copy the link and send it yourself.
              </>
            ) : (
              <>
                No mail server is set up on this portal yet, so nothing can be sent. The link is
                shown once after you create the invitation &mdash; copy it then.
              </>
            )}
          </span>
        </span>
      </label>

      <button
        type="submit"
        className="btn btn-primary"
        disabled={saving || !roleId || !invitedName.trim() || !email.trim() || (needsOrg && !orgId)}
      >
        {saving
          ? 'Creating…'
          : sendEmail && mail.configured
            ? 'Create it and send the email'
            : 'Create the invitation'}
      </button>
    </form>
  );
}
