import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import {
  companyAdminApi,
  industryAdminApi,
  type IndustryRow,
  type CompanyDetail,
  type CompanyStatus,
  type CompanySummary,
} from '../../api/admin';
import { useAuth } from '../../auth/AuthContext';
import ConsoleHeader from './ConsoleHeader';
import './Platform.css';

const TABS: { key: CompanyStatus | 'ALL'; label: string }[] = [
  { key: 'PENDING', label: 'Waiting for review' },
  { key: 'VERIFIED', label: 'Verified' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'SUSPENDED', label: 'Suspended' },
  { key: 'ALL', label: 'All' },
];

const SIZE: Record<string, string> = {
  STARTUP: '1–50',
  SMALL: '51–200',
  MID: '201–1,000',
  LARGE: '1,001–5,000',
  ENTERPRISE: '5,000+',
};

const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/**
 * Companies, for the platform team.
 *
 * A company is verified once and then hires at every institution, so this is
 * a platform decision, made here rather than from inside any one institution.
 * The queue opens on the companies waiting for review, oldest question first,
 * and each one shows the facts to check it against before a decision.
 */
export default function ConsoleCompanies() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('status') as CompanyStatus | 'ALL' | null) ?? 'PENDING';
  const selectedId = params.get('id');

  const [list, setList] = useState<CompanySummary[] | null>(null);
  const [counts, setCounts] = useState<Partial<Record<CompanyStatus, number>>>({});
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    companyAdminApi
      .list(tab === 'ALL' ? undefined : tab)
      .then((r) => {
        setList(r.companies);
        setCounts(r.counts);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load companies.'));
  }, [tab]);

  useEffect(() => {
    setList(null);
    load();
  }, [load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (list ?? []).filter(
      (c) => !q || c.name.toLowerCase().includes(q) || (c.city ?? '').toLowerCase().includes(q) || (c.industry ?? '').toLowerCase().includes(q),
    );
  }, [list, query]);

  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);

  function select(id: string | null) {
    const next = new URLSearchParams(params);
    if (id) next.set('id', id);
    else next.delete('id');
    setParams(next, { replace: true });
  }

  function setTab(key: CompanyStatus | 'ALL') {
    const next = new URLSearchParams();
    next.set('status', key);
    setParams(next, { replace: true });
  }

  return (
    <div className="console">
      <ConsoleHeader />

      <main className="console-main">
        <section className="console-hero">
          <div>
            <p className="eyebrow">Companies</p>
            <h1>Who may hire here.</h1>
            <p className="console-lede">
              {counts.PENDING
                ? `${counts.PENDING} waiting for review · ${counts.VERIFIED ?? 0} verified · ${total} in all`
                : `Nothing waiting · ${counts.VERIFIED ?? 0} verified · ${total} in all`}
            </p>
          </div>
        </section>

        <div className="console-bar">
          <div className="seg" role="radiogroup" aria-label="Filter by status">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="radio"
                aria-checked={tab === t.key}
                className={`seg-opt ${tab === t.key ? 'is-on' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
                <span className="seg-count">{t.key === 'ALL' ? total : (counts[t.key] ?? 0)}</span>
              </button>
            ))}
          </div>
          <div className="search">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m20 20-4.2-4.2" />
            </svg>
            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, city or industry"
              aria-label="Search companies"
            />
          </div>
        </div>

        {error && <p className="status-error">{error}</p>}

        <div className={`co-split ${selectedId ? 'has-detail' : ''}`}>
          <ul className="co-list">
            {list === null && <li className="co-empty">Loading…</li>}
            {list && shown.length === 0 && (
              <li className="co-empty">
                {tab === 'PENDING' ? 'Nobody is waiting. New sign-ups appear here.' : 'No companies here.'}
              </li>
            )}
            {shown.map((c) => (
              <li key={c.id}>
                <button type="button" className={`co-row ${selectedId === c.id ? 'is-on' : ''}`} onClick={() => select(c.id)}>
                  <span className="co-mono" aria-hidden="true">
                    {c.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="co-main">
                    <strong>{c.name}</strong>
                    <small>{[c.industry, c.city].filter(Boolean).join(' · ') || 'No details yet'}</small>
                  </span>
                  <span className="co-meta">
                    <StatusPill status={c.status} />
                    <small>{c.appliedAt ? `Applied ${date(c.appliedAt)}` : `Added ${date(c.createdAt)}`}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {selectedId && (
            <CompanyPanel
              key={selectedId}
              id={selectedId}
              onClose={() => select(null)}
              onDecided={() => {
                load();
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function StatusPill({ status }: { status: CompanyStatus }) {
  const map: Record<CompanyStatus, [string, string]> = {
    PENDING: ['pill-hold', 'Waiting'],
    VERIFIED: ['pill-pass', 'Verified'],
    REJECTED: ['pill-stop', 'Rejected'],
    SUSPENDED: ['pill-stop', 'Suspended'],
  };
  const [cls, label] = map[status];
  return <span className={`pill ${cls}`}>{label}</span>;
}

/* -------------------------------------------------------------------------- */
/* One company, and the decision                                               */
/* -------------------------------------------------------------------------- */

/**
 * Quick checks a reviewer would do by hand. Hints, not verdicts: a real
 * company can use a gmail address, and a missing GSTIN may just be an
 * unfinished profile. They say where to look, and the person decides.
 */
function checksFor(c: CompanyDetail) {
  const host = (() => {
    try {
      return c.website ? new URL(c.website).hostname.replace(/^www\./, '') : null;
    } catch {
      return null;
    }
  })();
  const owner = c.members.find((m) => m.roleKey === 'company.owner') ?? c.members[0];
  const domain = owner?.user.email.split('@')[1]?.toLowerCase() ?? null;
  const freeMail = domain ? /^(gmail|yahoo|outlook|hotmail|rediffmail|proton|icloud)\./.test(domain) : false;

  return [
    {
      label: 'Website',
      ok: Boolean(host),
      text: host ? host : 'No website given',
    },
    {
      label: 'Sign-up email matches the website',
      ok: Boolean(host && domain && (domain === host || domain.endsWith(`.${host}`) || host.endsWith(`.${domain}`))),
      text: !domain ? 'No one has signed up yet' : freeMail ? `Uses a personal address (${domain})` : domain,
    },
    {
      label: 'GSTIN',
      ok: Boolean(c.gstin && /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(c.gstin)),
      text: c.gstin ? (/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(c.gstin) ? c.gstin : `${c.gstin} - not the usual 15-character shape`) : 'Not given',
    },
    {
      label: 'CIN',
      ok: Boolean(c.cin && /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/.test(c.cin)),
      text: c.cin ? (/^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/.test(c.cin) ? c.cin : `${c.cin} - not the usual 21-character shape`) : 'Not given (only registered companies have one)',
    },
  ];
}

function CompanyPanel({ id, onClose, onDecided }: { id: string; onClose: () => void; onDecided: () => void }) {
  const { can } = useAuth();
  const [c, setC] = useState<CompanyDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState<CompanyStatus | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(() => {
    companyAdminApi
      .get(id)
      .then(setC)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load this company.'));
  }, [id]);

  useEffect(load, [load]);

  async function decide(status: CompanyStatus, why?: string) {
    setBusy(true);
    setError(null);
    try {
      await companyAdminApi.decide(id, status, why);
      setC(await companyAdminApi.get(id));
      setRejecting(null);
      setReason('');
      onDecided();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save that decision.');
    } finally {
      setBusy(false);
    }
  }

  if (!c) {
    return (
      <aside className="co-panel">
        <p className="muted">{error ?? 'Loading…'}</p>
      </aside>
    );
  }

  const mayDecide = can('company:verify');
  const checks = checksFor(c);

  return (
    <aside className="co-panel ob-in" aria-label={`${c.name} details`}>
      <div className="co-panel-head">
        <div>
          <h2>{c.name}</h2>
          <p className="muted">
            {c.legalName && c.legalName !== c.name ? `${c.legalName} · ` : ''}
            {c.industry?.name ?? (c.industryOther ? `${c.industryOther} — not on the list yet` : 'Industry not given')}
          </p>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="co-status">
        <StatusPill status={c.status} />
        <span className="muted">
          {c.appliedAt ? `Applied ${date(c.appliedAt)}` : 'Added by the platform team'}
          {c.reviewedAt ? ` · reviewed ${date(c.reviewedAt)}` : ''}
        </span>
      </div>
      {c.status === 'REJECTED' && c.rejectionReason && <p className="notice notice-stop">Rejected: {c.rejectionReason}</p>}

      {c.industryOther && mayDecide && <IndustrySuggestion company={c} onDone={load} />}

      <h3 className="co-h">Checks</h3>
      <ul className="co-checks">
        {checks.map((k) => (
          <li key={k.label} className={k.ok ? 'is-ok' : 'is-warn'}>
            <span aria-hidden="true">{k.ok ? '✓' : '!'}</span>
            <span>
              <strong>{k.label}</strong>
              <small>{k.text}</small>
            </span>
          </li>
        ))}
      </ul>

      <h3 className="co-h">Profile</h3>
      <dl className="co-facts">
        <Fact label="Website" value={c.website ? <a href={c.website} target="_blank" rel="noreferrer noopener">{c.website}</a> : null} />
        <Fact label="Careers page" value={c.careersUrl ? <a href={c.careersUrl} target="_blank" rel="noreferrer noopener">{c.careersUrl}</a> : null} />
        <Fact label="LinkedIn" value={c.linkedinUrl ? <a href={c.linkedinUrl} target="_blank" rel="noreferrer noopener">{c.linkedinUrl}</a> : null} />
        <Fact label="Size" value={c.sizeBand ? `${SIZE[c.sizeBand]} people` : null} />
        <Fact label="Founded" value={c.foundedYear} />
        <Fact label="Head office" value={[c.city, c.state, c.pincode].filter(Boolean).join(', ') || null} />
        <Fact label="Roles posted" value={c._count.jobs} />
      </dl>
      {c.about && <p className="co-about">{c.about}</p>}

      <h3 className="co-h">People</h3>
      {c.members.length === 0 && c.invites.length === 0 ? (
        <p className="muted">No one yet.</p>
      ) : (
        <ul className="co-people">
          {c.members.map((m) => (
            <li key={m.id}>
              <strong>{m.user.fullName}</strong>
              <small>
                {m.user.email} · {m.roleName.toLowerCase()}
              </small>
            </li>
          ))}
          {c.invites.map((i) => (
            <li key={i.id}>
              <strong>{i.invitedName || i.email}</strong>
              <small>invited · {i.email}</small>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="step-error">{error}</p>}

      {mayDecide && (
        <div className="co-actions">
          {rejecting ? (
            <div className="co-reject ob-in">
              <label className="f">
                <span className="f-label">
                  {rejecting === 'REJECTED' ? 'Why is it being rejected?' : 'Why is it being suspended?'}
                  {rejecting === 'SUSPENDED' && <span className="f-optional">optional</span>}
                </span>
                <textarea
                  className="input"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={rejecting === 'REJECTED' ? 'The company is shown this, so say what would change your mind.' : ''}
                  autoFocus
                />
              </label>
              <div className="new-course-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRejecting(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm co-danger"
                  disabled={busy || (rejecting === 'REJECTED' && !reason.trim())}
                  onClick={() => decide(rejecting, reason.trim() || undefined)}
                >
                  {rejecting === 'REJECTED' ? 'Reject company' : 'Suspend company'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {(c.status === 'PENDING' || c.status === 'REJECTED') && (
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => decide('VERIFIED')}>
                  {c.status === 'REJECTED' ? 'Verify after all' : 'Verify company'}
                </button>
              )}
              {c.status === 'PENDING' && (
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setRejecting('REJECTED')}>
                  Reject
                </button>
              )}
              {c.status === 'VERIFIED' && (
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setRejecting('SUSPENDED')}>
                  Suspend
                </button>
              )}
              {c.status === 'SUSPENDED' && (
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => decide('VERIFIED')}>
                  Reinstate
                </button>
              )}
              <p className="co-note">
                {c.status === 'PENDING'
                  ? 'Verifying lets them post roles. Each college still approves every role before its students see it.'
                  : c.status === 'VERIFIED'
                    ? 'Suspending stops them posting anywhere. Their existing roles and applications stay on record.'
                    : ''}
              </p>
            </>
          )}
        </div>
      )}
      {!mayDecide && <p className="co-note">Your role can see companies but not verify them.</p>}
    </aside>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value === null || value === undefined || value === '' ? <span className="muted">—</span> : value}</dd>
    </div>
  );
}

/**
 * The company could not find its industry on the shared list and typed it
 * instead. Settling it here, while the company is being verified, is the one
 * moment somebody is already reading the whole profile.
 */
function IndustrySuggestion({ company, onDone }: { company: CompanyDetail; onDone: () => void }) {
  const [industries, setIndustries] = useState<IndustryRow[] | null>(null);
  const [chosen, setChosen] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    industryAdminApi
      .list()
      .then(setIndustries)
      .catch(() => setIndustries([]));
  }, []);

  async function resolve(industryId?: string) {
    setBusy(true);
    setError(null);
    try {
      await industryAdminApi.resolve(company.id, industryId);
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save that.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="notice">
      <p>
        <strong>Industry not on the list.</strong> They said: &ldquo;{company.industryOther}&rdquo;
      </p>
      {error && <p className="alert alert-error">{error}</p>}
      <div className="btn-row">
        <button type="button" className="btn btn-primary" onClick={() => resolve()} disabled={busy}>
          Add it to the list
        </button>
        <select value={chosen} onChange={(e) => setChosen(e.target.value)} disabled={busy || !industries}>
          <option value="">Or use one we already have…</option>
          {(industries ?? []).map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => resolve(chosen)}
          disabled={busy || !chosen}
        >
          Use that one
        </button>
      </div>
    </div>
  );
}
