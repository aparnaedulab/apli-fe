import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import CompanyFields, {
  emptyCompanyForm,
  SIZE_LABEL,
  toCompanyPayload,
} from '../../components/CompanyFields';
import {
  companyAdminApi,
  industryAdminApi,
  type CompanyDetail,
  type CompanyList,
  type CompanyStatus,
} from '../../api/admin';
import { ApiError } from '../../api/client';

const STATUS_TABS: { key: CompanyStatus | 'ALL'; label: string }[] = [
  { key: 'PENDING', label: 'Waiting on you' },
  { key: 'VERIFIED', label: 'Verified' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'SUSPENDED', label: 'Suspended' },
  { key: 'ALL', label: 'Everyone' },
];

export const STATUS_PILL: Record<CompanyStatus, { cls: string; label: string }> = {
  PENDING: { cls: 'pill-hold', label: 'Pending review' },
  VERIFIED: { cls: 'pill-pass', label: 'Verified' },
  REJECTED: { cls: 'pill-stop', label: 'Rejected' },
  SUSPENDED: { cls: 'pill-stop', label: 'Suspended' },
};

export function Companies() {
  // The queue opens first. Anything sitting in PENDING is a company waiting on
  // a person, which is the only part of this screen that is time-sensitive.
  const [tab, setTab] = useState<CompanyStatus | 'ALL'>('PENDING');
  const [data, setData] = useState<CompanyList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setData(await companyAdminApi.list(tab === 'ALL' ? undefined : tab));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load companies.');
    }
  }, [tab]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const companies = data?.companies ?? null;
  const counts = data?.counts ?? {};

  return (
    <AdminLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>Companies</h1>
          <p className="page-lede">
            Companies register themselves and land here for review. A pending company can sign in
            and draft roles, but cannot publish to any college until you verify it — and each
            posting still needs that college&rsquo;s own approval.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowForm((v) => !v)}
          aria-expanded={showForm}
        >
          {showForm ? 'Cancel' : 'Add company'}
        </button>
      </header>

      {showForm && (
        <AddCompanyForm
          onDone={() => {
            setShowForm(false);
            void refresh();
          }}
        />
      )}

      <nav className="tabs" aria-label="Filter by status">
        {STATUS_TABS.map((t) => {
          const n = t.key === 'ALL' ? undefined : counts[t.key];
          return (
            <button
              key={t.key}
              type="button"
              className={`tab ${tab === t.key ? 'is-current' : ''}`}
              onClick={() => setTab(t.key)}
              aria-current={tab === t.key}
            >
              {t.label}
              {n ? <span className="tab-count">{n}</span> : null}
            </button>
          );
        })}
      </nav>

      {error && <p className="alert alert-error">{error}</p>}
      {companies === null && !error && <p className="muted">Loading…</p>}

      {companies?.length === 0 && (
        <div className="empty">
          <h2>{tab === 'PENDING' ? 'Nothing waiting' : 'Nothing here'}</h2>
          <p>
            {tab === 'PENDING'
              ? 'Every registration has been reviewed. New ones appear here as they arrive.'
              : 'No company has this status.'}
          </p>
        </div>
      )}

      {companies && companies.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Industry</th>
                <th>Came from</th>
                <th className="num">Team</th>
                <th className="num">Jobs</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link to={`/admin/companies/${c.id}`} className="row-link">
                      {c.name}
                    </Link>
                    {c.website && <span className="row-sub">{c.website}</span>}
                  </td>
                  <td>
                    {c.industry ?? '—'}
                    {c.city && <span className="row-sub">{c.city}</span>}
                  </td>
                  <td>
                    {/* Worth telling apart: one was vouched for, one was not. */}
                    {c.appliedAt ? (
                      <>
                        Registered
                        <span className="row-sub">
                          {new Date(c.appliedAt).toLocaleDateString()}
                        </span>
                      </>
                    ) : (
                      <span className="muted">Added by operations</span>
                    )}
                  </td>
                  <td className="num">{c.memberCount}</td>
                  <td className="num">{c.jobCount}</td>
                  <td>
                    <span className={`pill ${STATUS_PILL[c.status].cls}`}>
                      {STATUS_PILL[c.status].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}

/**
 * Operations entering a company by hand.
 *
 * The same fields the company would have filled in itself - anything less and
 * a company added here would look half-empty next to one that registered,
 * which is exactly the state the review screen exists to judge. The difference
 * is the outcome, not the form: this one is verified on the spot, because the
 * person who would review it is the person typing it in.
 */
function AddCompanyForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState(emptyCompanyForm());
  const [industries, setIndustries] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    industryAdminApi
      .list()
      .then(setIndustries)
      .catch(() => setIndustries([]));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError(null);
    setFieldErrors({});
    setSaving(true);
    try {
      await companyAdminApi.create(toCompanyPayload(form));
      onDone();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.fields) {
          setFieldErrors(
            Object.fromEntries(err.fields.map((f) => [f.path.split('.').pop()!, f.message])),
          );
        }
      } else {
        setError('Could not save the company.');
      }
      setSaving(false);
    }
  }

  return (
    <form className="card form-card form-wide" onSubmit={onSubmit} noValidate>
      <h2>Add a company</h2>
      <p className="muted">
        For a recruiter you already deal with. It is verified straight away and can publish as soon
        as someone from it accepts an invitation.
      </p>
      {error && <p className="alert alert-error">{error}</p>}

      <CompanyFields
        value={form}
        onChange={setForm}
        industries={industries}
        errors={fieldErrors}
        disabled={saving}
        tone="admin"
      />

      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? 'Saving…' : 'Create company'}
      </button>
    </form>
  );
}

/* -------------------------------------------------------------------------- */

export function CompanyDetailPage() {
  const { id = '' } = useParams();
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [freshLink, setFreshLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setCompany(await companyAdminApi.get(id));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this company.');
    }
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (error && !company) {
    return (
      <AdminLayout>
        <p className="alert alert-error">{error}</p>
        <p className="crumb">
          <Link to="/admin/companies">← All companies</Link>
        </p>
      </AdminLayout>
    );
  }

  if (!company) {
    return (
      <AdminLayout>
        <p className="muted">Loading…</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <p className="crumb">
        <Link to="/admin/companies">← All companies</Link>
      </p>

      <header className="page-head">
        <div>
          <p className="eyebrow">Company</p>
          <h1>{company.name}</h1>
          <p className="page-lede">
            {company.legalName ?? company.website ?? 'No website recorded'}
          </p>
        </div>
        <span className={`pill ${STATUS_PILL[company.status].cls}`}>
          {STATUS_PILL[company.status].label}
        </span>
      </header>

      <ReviewPanel
        company={company}
        busy={busy}
        onDecide={async (status, reason) => {
          setBusy(true);
          try {
            await companyAdminApi.decide(company.id, status, reason);
            setError(null);
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Could not record that decision.');
          }
          setBusy(false);
          void refresh();
        }}
      />

      <CompanyFacts company={company} />

      <div className="stat-row">
        <div className="stat">
          <p className="stat-value">{company.members.length}</p>
          <p className="stat-label">Team members</p>
        </div>
        <div className="stat">
          <p className="stat-value">{company.invites.length}</p>
          <p className="stat-label">Pending invites</p>
        </div>
        <div className="stat">
          <p className="stat-value">{company._count.jobs}</p>
          <p className="stat-label">Jobs</p>
        </div>
      </div>

      {freshLink && <OneTimeLink link={freshLink} onDismiss={() => setFreshLink(null)} />}

      <section className="card">
        <h2>Recruiting team</h2>
        {company.members.length === 0 ? (
          <p className="muted">Nobody from this company can sign in yet. Invite them below.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {company.members.map((m) => (
                <tr key={m.id}>
                  <td>{m.user.fullName}</td>
                  <td className="mono">{m.user.email}</td>
                  <td>
                    <span className="pill pill-idle">{m.roleName}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {company.invites.length > 0 && (
        <section className="card">
          <h2>Pending invitations</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Expires</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {company.invites.map((inv) => (
                <tr key={inv.id}>
                  <td className="mono">{inv.email}</td>
                  <td>
                    <span className="pill pill-idle">{inv.companyRole ?? 'RECRUITER'}</span>
                  </td>
                  <td>{new Date(inv.expiresAt).toLocaleDateString()}</td>
                  <td className="right">
                    <button
                      type="button"
                      className="link-btn is-danger"
                      onClick={async () => {
                        await companyAdminApi.cancelInvite(company.id, inv.id);
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

      <InviteRecruiterForm
        companyId={company.id}
        onInvited={(link) => {
          setFreshLink(link);
          void refresh();
        }}
      />
    </AdminLayout>
  );
}

function InviteRecruiterForm({
  companyId,
  onInvited,
}: {
  companyId: string;
  onInvited: (link: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [invitedName, setInvitedName] = useState('');
  const [companyRole, setCompanyRole] = useState('OWNER');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    setError(null);
    setSending(true);
    try {
      const { link } = await companyAdminApi.invite(companyId, {
        email,
        invitedName,
        companyRole,
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
      <h2>Invite a recruiter</h2>
      <p className="muted">
        The first person you invite should be an owner — only owners can add the rest of the team.
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
            placeholder="hiring@company.com"
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
          <select
            value={companyRole}
            onChange={(e) => setCompanyRole(e.target.value)}
            disabled={sending}
          >
            <option value="OWNER">Owner</option>
            <option value="RECRUITER">Recruiter</option>
            <option value="INTERVIEWER">Interviewer</option>
          </select>
        </label>
      </div>
      <button type="submit" className="btn btn-primary" disabled={sending}>
        {sending ? 'Creating…' : 'Create invitation'}
      </button>
    </form>
  );
}

export function OneTimeLink({ link, onDismiss }: { link: string; onDismiss: () => void }) {
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
        Send this link to them. It works once, expires in seven days, and{' '}
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

/* -------------------------------------------------------------------------- */

/**
 * What the decision is made on.
 *
 * Everything a reviewer needs is on one screen, because the alternative is
 * verifying companies on the strength of their name alone. A field nobody
 * filled in is shown as missing rather than hidden - an absent GSTIN is
 * information about the company, not an empty row to skip past.
 */
function CompanyFacts({ company }: { company: CompanyDetail }) {
  const rows: { label: string; value: string | null; link?: string }[] = [
    { label: 'Registered name', value: company.legalName },
    { label: 'Industry', value: company.industry?.name ?? null },
    { label: 'Size', value: company.sizeBand ? SIZE_LABEL[company.sizeBand]! : null },
    { label: 'Founded', value: company.foundedYear ? String(company.foundedYear) : null },
    { label: 'GSTIN', value: company.gstin },
    { label: 'CIN', value: company.cin },
    { label: 'Website', value: company.website, link: company.website ?? undefined },
    { label: 'Careers page', value: company.careersUrl, link: company.careersUrl ?? undefined },
    { label: 'LinkedIn', value: company.linkedinUrl, link: company.linkedinUrl ?? undefined },
    {
      label: 'Head office',
      value: [company.city, company.state, company.pincode].filter(Boolean).join(', ') || null,
    },
  ];

  return (
    <section className="card">
      <div className="card-head">
        <h2>On the record</h2>
        {company.appliedAt ? (
          <span className="muted">
            Registered {new Date(company.appliedAt).toLocaleDateString()}
          </span>
        ) : (
          <span className="muted">Added by operations</span>
        )}
      </div>

      <dl className="facts">
        {rows.map((r) => (
          <div key={r.label} className="fact">
            <dt>{r.label}</dt>
            <dd className={r.value ? '' : 'is-missing'}>
              {r.value ? (
                r.link ? (
                  <a href={r.link} target="_blank" rel="noreferrer noopener">
                    {r.value}
                  </a>
                ) : (
                  r.value
                )
              ) : (
                'Not given'
              )}
            </dd>
          </div>
        ))}
      </dl>

      {company.about && <p className="fact-about">{company.about}</p>}
    </section>
  );
}

/**
 * The decision. Verify is one click; rejecting and suspending open a reason
 * box first, because the company reads what is typed there.
 */
function ReviewPanel({
  company,
  busy,
  onDecide,
}: {
  company: CompanyDetail;
  busy: boolean;
  onDecide: (status: CompanyStatus, reason?: string) => Promise<void>;
}) {
  const [asking, setAsking] = useState<CompanyStatus | null>(null);
  const [reason, setReason] = useState('');

  const verified = company.status === 'VERIFIED';

  return (
    <section className={`card review review-${company.status.toLowerCase()}`}>
      <div className="review-head">
        <div>
          <h2>
            {verified
              ? 'Verified'
              : company.status === 'PENDING'
                ? 'Waiting on you'
                : STATUS_PILL[company.status].label}
          </h2>
          <p className="muted">
            {verified
              ? 'This company can publish roles. Every posting still goes to the college it targets for approval.'
              : company.status === 'PENDING'
                ? 'It can sign in and draft roles. It cannot publish anything until you decide.'
                : 'It cannot publish. Verifying clears this.'}
          </p>
          {company.rejectionReason && (
            <p className="review-reason">
              <strong>Reason given:</strong> {company.rejectionReason}
            </p>
          )}
          {company.reviewedAt && (
            <p className="muted review-when">
              Last reviewed {new Date(company.reviewedAt).toLocaleString()}
            </p>
          )}
        </div>

        {asking === null && (
          <div className="btn-row">
            {!verified && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void onDecide('VERIFIED')}
              >
                Verify
              </button>
            )}
            {company.status === 'PENDING' && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => setAsking('REJECTED')}
              >
                Reject
              </button>
            )}
            {verified && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => setAsking('SUSPENDED')}
              >
                Suspend
              </button>
            )}
          </div>
        )}
      </div>

      {asking && (
        <div className="review-ask">
          <label className="field">
            <span className="field-label">
              {asking === 'REJECTED' ? 'Why are you rejecting this?' : 'Why are you suspending it?'}
            </span>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
              placeholder={
                asking === 'REJECTED'
                  ? 'No registered entity details supplied. Send your CIN and we will look again.'
                  : 'Roles posted did not match what students were told at the drive.'
              }
            />
            <span className="field-hint">Everyone at the company is shown this.</span>
          </label>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy || reason.trim().length < 3}
              onClick={async () => {
                await onDecide(asking, reason.trim());
                setAsking(null);
                setReason('');
              }}
            >
              {asking === 'REJECTED' ? 'Reject company' : 'Suspend company'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => {
                setAsking(null);
                setReason('');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
