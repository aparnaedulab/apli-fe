import { useEffect, useState } from 'react';
import StudentLayout from './StudentLayout';
import { ApiError } from '../../api/client';
import {
  fmtDate,
  opportunitiesApi,
  rupees,
  type MicroApplicationStatus,
  type MyMicroApplication,
  type OpenProject,
} from '../../api/opportunities';
import { useAuth } from '../../auth/AuthContext';
import './Opportunities.css';

const STATUS: Record<MicroApplicationStatus, { pill: string; label: string }> = {
  APPLIED: { pill: 'pill-hold', label: 'Applied' },
  SELECTED: { pill: 'pill-pass', label: 'Chosen - do the work' },
  REJECTED: { pill: 'pill-idle', label: 'Not this time' },
  DELIVERED: { pill: 'pill-hold', label: 'Handed in' },
  COMPLETED: { pill: 'pill-pass', label: 'Completed' },
  WITHDRAWN: { pill: 'pill-idle', label: 'Withdrawn' },
};

/**
 * Micro-internships: short, paid pieces of real work for a company.
 *
 * Two lists - projects open now, and the ones you are in - and every card of
 * yours says what happens next and whose move it is. The stipend is paid by
 * the company directly; the page says so before anybody applies, so nobody
 * expects the platform to pay them.
 */
export default function MicroProjects() {
  const { hasModule } = useAuth();
  const on = hasModule('proof.microInternships');
  const [data, setData] = useState<{ open: OpenProject[]; mine: MyMicroApplication[] } | null>(null);
  const [tab, setTab] = useState<'open' | 'mine'>('open');
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const d = await opportunitiesApi.studentProjects();
      setData(d);
      setError(null);
      return d;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load projects.');
      return null;
    }
  }

  useEffect(() => {
    if (!on) return;
    void refresh().then((d) => {
      // Straight to your own list when you are already in something.
      if (d && d.mine.some((a) => ['SELECTED', 'DELIVERED'].includes(a.status))) setTab('mine');
    });
  }, [on]);

  if (!on) {
    return (
      <StudentLayout>
        <header className="page-head">
          <div>
            <p className="eyebrow">Micro-internships</p>
            <h1>Paid projects</h1>
            <p className="page-lede">Your institution has not switched this on yet.</p>
          </div>
        </header>
      </StudentLayout>
    );
  }

  const active = data?.mine.filter((a) => a.status !== 'WITHDRAWN' && a.status !== 'REJECTED').length ?? 0;

  return (
    <StudentLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Micro-internships</p>
          <h1>Paid projects</h1>
          <p className="page-lede">
            Real work for a real company in 10 to 40 hours. Earn a stipend, and a completed project counts as proof of
            what you can do.
          </p>
        </div>
      </header>

      <p className="opp-money">
        <span>
          <strong>How you get paid:</strong> the company pays you directly, outside Apli.ai. We never ask you for money
          and never hold your stipend - if anyone asks you to pay to take part, report it to your placement cell.
        </span>
      </p>

      {error && <p className="alert alert-error">{error}</p>}

      <div className="opp-tabs" role="tablist" aria-label="Projects">
        <button type="button" role="tab" aria-selected={tab === 'open'} className={tab === 'open' ? 'is-on' : ''} onClick={() => setTab('open')}>
          Open now {data ? `(${data.open.length})` : ''}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'is-on' : ''} onClick={() => setTab('mine')}>
          Yours {data ? `(${active})` : ''}
        </button>
      </div>

      {!data && !error && <p className="muted">Loading…</p>}

      {data && tab === 'open' && (
        data.open.length === 0 ? (
          <div className="empty">
            <h2>Nothing open right now.</h2>
            <p>New projects appear here as companies post them.</p>
          </div>
        ) : (
          <div className="opp-grid">
            {data.open.map((p) => (
              <OpenCard key={p.id} project={p} onApplied={refresh} />
            ))}
          </div>
        )
      )}

      {data && tab === 'mine' && (
        data.mine.length === 0 ? (
          <div className="empty">
            <h2>You have not applied to any yet.</h2>
            <p>Pick one from “Open now” that matches what you want to get better at.</p>
          </div>
        ) : (
          <div className="opp-grid">
            {data.mine.map((a) => (
              <MineCard key={a.id} app={a} onChanged={refresh} />
            ))}
          </div>
        )
      )}
    </StudentLayout>
  );
}

function Facts({ p }: { p: { hours: number; stipend: number; deadline: string; slots: number } }) {
  return (
    <div className="opp-facts">
      <span>
        <b>{rupees(p.stipend)}</b> stipend
      </span>
      <span>
        <b>{p.hours} h</b> of work
      </span>
      <span>Apply by {fmtDate(p.deadline)}</span>
      <span>
        {p.slots} place{p.slots === 1 ? '' : 's'}
      </span>
    </div>
  );
}

function OpenCard({ project: p, onApplied }: { project: OpenProject; onApplied: () => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [pitch, setPitch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    setBusy(true);
    setError(null);
    try {
      await opportunitiesApi.apply(p.id, pitch.trim());
      await onApplied();
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send your application.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="opp-card">
      <div className="opp-top">
        <div>
          <h3>{p.title}</h3>
          <span className="opp-company">{p.company?.name}</span>
        </div>
        {p.applied ? <span className="pill pill-pass">Applied</span> : p.full ? <span className="pill pill-idle">Places filled</span> : null}
      </div>
      <Facts p={p} />
      <p className="opp-brief">{p.brief}</p>
      {p.skills.length > 0 && (
        <div className="opp-skills">
          {p.skills.map((s) => (
            <span key={s} className="opp-skill">
              {s}
            </span>
          ))}
        </div>
      )}

      {open ? (
        <div className="opp-form">
          <label className="field">
            <span className="field-label">Why you? (a few sentences)</span>
            <textarea
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
              maxLength={800}
              autoFocus
              placeholder="What you have done that is close to this, and what you would do first."
            />
            <div className="opp-count">{pitch.length} / 800</div>
          </label>
          {error && <p className="alert alert-error">{error}</p>}
          <div className="form-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={apply} disabled={busy || pitch.trim().length < 40}>
              {busy ? 'Sending…' : 'Send application'}
            </button>
          </div>
        </div>
      ) : (
        !p.applied &&
        !p.full && (
          <div className="opp-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
              Apply
            </button>
          </div>
        )
      )}
    </article>
  );
}

/** What happens next, in one line, and whose move it is. */
function nextLine(a: MyMicroApplication): string {
  switch (a.status) {
    case 'APPLIED':
      return `Waiting for ${a.project.company?.name ?? 'the company'} to choose.`;
    case 'SELECTED':
      return 'You were chosen. Do the work, then hand it in below.';
    case 'DELIVERED':
      return 'Handed in. The company reviews it and rates your work.';
    case 'COMPLETED':
      if (!a.paidAt) return 'Complete. The company pays you directly and records it here.';
      if (!a.paymentConfirmedAt) return 'The company says it has paid you. Confirm once the money reaches you.';
      return 'Complete and paid. This now counts as employer-checked work.';
    case 'REJECTED':
      return 'The company went with someone else this time.';
    case 'WITHDRAWN':
      return 'You withdrew.';
  }
}

function MineCard({ app: a, onChanged }: { app: MyMicroApplication; onChanged: () => Promise<unknown> }) {
  const [work, setWork] = useState(a.deliverable ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = STATUS[a.status];

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`opp-card ${a.status === 'WITHDRAWN' || a.status === 'REJECTED' ? 'is-muted' : ''}`}>
      <div className="opp-top">
        <div>
          <h3>{a.project.title}</h3>
          <span className="opp-company">{a.project.company?.name}</span>
        </div>
        <span className={`pill ${s.pill}`}>{s.label}</span>
      </div>
      <Facts p={a.project} />
      <p className="opp-next">{nextLine(a)}</p>

      {(a.status === 'SELECTED' || a.status === 'DELIVERED') && (
        <div className="opp-form">
          <label className="field">
            <span className="field-label">{a.status === 'DELIVERED' ? 'What you handed in' : 'Hand in your work'}</span>
            <textarea
              value={work}
              onChange={(e) => setWork(e.target.value)}
              placeholder="A link to your work (a shared folder, a repository), and a line on what you made."
              maxLength={4000}
            />
          </label>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy || work.trim().length < 10}
              onClick={() => run(() => opportunitiesApi.deliver(a.id, work.trim()))}
            >
              {a.status === 'DELIVERED' ? 'Update what I handed in' : 'Hand it in'}
            </button>
          </div>
        </div>
      )}

      {a.status === 'COMPLETED' && a.rating && (
        <p className="opp-quote">
          Rated {a.rating} of 5{a.review ? ` - “${a.review}”` : ''}
        </p>
      )}

      {error && <p className="alert alert-error">{error}</p>}

      <div className="opp-actions">
        {(a.status === 'APPLIED' || a.status === 'SELECTED') && (
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(() => opportunitiesApi.withdraw(a.id))}>
            Withdraw
          </button>
        )}
        {a.status === 'COMPLETED' && a.paidAt && !a.paymentConfirmedAt && (
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(() => opportunitiesApi.confirmPaid(a.id))}>
            I have received the payment
          </button>
        )}
      </div>
    </article>
  );
}
