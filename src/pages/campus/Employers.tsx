import { useCallback, useEffect, useMemo, useState, type DragEvent, type FormEvent } from 'react';
import CampusLayout from './CampusLayout';
import { ApiError } from '../../api/client';
import { opsApi, type CrmBoard, type Employer, type EmployerStage, type InteractionKind } from '../../api/ops';
import { useAuth } from '../../auth/AuthContext';
import './Employers.css';

const STAGE_LABEL: Record<EmployerStage, string> = {
  PROSPECT: 'Prospect',
  CONTACTED: 'Contacted',
  INTERESTED: 'Interested',
  VISITING: 'Visiting campus',
  HIRED: 'Hired',
  DORMANT: 'Dormant',
};

const KIND_LABEL: Record<InteractionKind, string> = {
  CALL: 'Call',
  EMAIL: 'Email',
  MEETING: 'Meeting',
  VISIT: 'Campus visit',
  NOTE: 'Note',
};

const PRIORITY: Record<number, string> = { 1: 'High', 2: 'Normal', 3: 'Low' };

const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/**
 * The employer CRM: every company the placement cell is courting, as a board
 * by stage.
 *
 * What needs doing today sits at the top - follow-ups that are due or late -
 * because that is the question a placement officer opens this page with.
 * Companies already sending roles to the college are offered as one-click
 * additions, so the board starts full rather than empty.
 */
export default function Employers() {
  const { hasModule, can } = useAuth();
  const on = hasModule('ops.employerCrm');
  const edit = can('drive:write');

  const [data, setData] = useState<CrmBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await opsApi.crm());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your employers.');
    }
  }, []);

  useEffect(() => {
    if (on) void load();
  }, [on, load]);

  const byStage = useMemo(() => {
    const map = new Map<EmployerStage, Employer[]>();
    for (const s of data?.stages ?? []) map.set(s, []);
    for (const e of data?.employers ?? []) map.get(e.stage)?.push(e);
    return map;
  }, [data]);

  const open = data?.employers.find((e) => e.id === openId) ?? null;

  async function act(fn: () => Promise<unknown>) {
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not work.');
    }
  }

  function onDrop(stage: EmployerStage, e: DragEvent) {
    e.preventDefault();
    const id = dragId;
    setDragId(null);
    const emp = data?.employers.find((x) => x.id === id);
    if (!emp || emp.stage === stage) return;
    void act(() => opsApi.updateEmployer(emp.id, { stage }));
  }

  if (!on) {
    return (
      <CampusLayout>
        <header className="page-head">
          <div>
            <p className="eyebrow">Placement cell</p>
            <h1>Employers</h1>
            <p className="page-lede">The employer CRM is not switched on for your institution.</p>
          </div>
        </header>
      </CampusLayout>
    );
  }

  return (
    <CampusLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Placement cell</p>
          <h1>Employers</h1>
          <p className="page-lede">
            Every company you are courting, from first call to hiring - and what needs doing next.
          </p>
        </div>
        {edit && (
          <button type="button" className="btn btn-primary" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
            {adding ? 'Cancel' : 'Add an employer'}
          </button>
        )}
      </header>

      {error && <p className="alert alert-error">{error}</p>}

      {adding && (
        <AddEmployer
          onDone={() => {
            setAdding(false);
            void load();
          }}
        />
      )}

      {data && data.followUps.length > 0 && (
        <section className="crm-due card">
          <h2>Follow up</h2>
          <ul>
            {data.followUps.map((f) => (
              <li key={f.interactionId}>
                <span className={`pill ${f.state === 'overdue' ? 'pill-stop' : 'pill-hold'}`}>
                  {f.state === 'overdue' ? `Late · ${date(f.followUpAt)}` : 'Today'}
                </span>
                <button type="button" className="link-btn" onClick={() => setOpenId(f.relationId)}>
                  {f.companyName}
                </button>
                <span className="crm-due-what">{f.summary}</span>
                {edit && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => act(() => opsApi.followUpDone(f.interactionId))}>
                    Done
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {data && data.suggestions.length > 0 && edit && (
        <section className="crm-suggest">
          <p className="muted">Already sending you roles - add them to keep track:</p>
          <div className="crm-chips">
            {data.suggestions.map((s) => (
              <button
                key={s.companyId}
                type="button"
                className="crm-chip"
                onClick={() => act(() => opsApi.addEmployer({ companyId: s.companyId, stage: s.accepted ? 'HIRED' : 'INTERESTED' }))}
                title={`${s.roles} role${s.roles === 1 ? '' : 's'} sent, ${s.accepted} accepted`}
              >
                + {s.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {data === null && !error && <p className="muted">Loading…</p>}

      {data && data.employers.length === 0 && (
        <div className="empty">
          <h2>No employers yet</h2>
          <p>Add the companies you are talking to. Each moves across the board as the relationship grows.</p>
        </div>
      )}

      {data && data.employers.length > 0 && (
        <div className={`crm-layout ${open ? 'has-panel' : ''}`}>
          <div className="crm-board" role="list">
            {data.stages.map((stage) => (
              <section
                key={stage}
                className={`crm-col ${dragId ? 'is-droppable' : ''}`}
                onDragOver={(e) => edit && e.preventDefault()}
                onDrop={(e) => onDrop(stage, e)}
                aria-label={STAGE_LABEL[stage]}
              >
                <h3>
                  {STAGE_LABEL[stage]} <span className="muted">{byStage.get(stage)?.length ?? 0}</span>
                </h3>
                {(byStage.get(stage) ?? []).map((e) => (
                  <article
                    key={e.id}
                    role="listitem"
                    className={`crm-card ${openId === e.id ? 'is-open' : ''}`}
                    draggable={edit}
                    onDragStart={() => setDragId(e.id)}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => setOpenId(e.id)}
                  >
                    <strong>
                      {e.priority === 1 && <span className="crm-hot" title="High priority" />}
                      {e.companyName}
                    </strong>
                    {e.yearsHired.length > 0 && <small>Hired here {e.yearsHired.join(', ')}</small>}
                    <small>
                      {e.lastContactAt ? `Last contact ${date(e.lastContactAt)}` : 'Not contacted yet'}
                      {e.nextFollowUpAt ? ` · follow up ${date(e.nextFollowUpAt)}` : ''}
                    </small>
                  </article>
                ))}
              </section>
            ))}
          </div>

          {open && (
            <EmployerPanel
              key={open.id}
              employer={open}
              stages={data.stages}
              edit={edit}
              onClose={() => setOpenId(null)}
              onChanged={load}
              onError={setError}
            />
          )}
        </div>
      )}
    </CampusLayout>
  );
}

function AddEmployer({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [priority, setPriority] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await opsApi.addEmployer({ companyName: name, priority });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add that employer.');
      setBusy(false);
    }
  }

  return (
    <form className="card crm-add" onSubmit={submit}>
      <label className="crm-field">
        <span>Company</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Demo Technologies" autoFocus />
      </label>
      <label className="crm-field">
        <span>Priority</span>
        <select value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
          <option value={1}>High</option>
          <option value={2}>Normal</option>
          <option value={3}>Low</option>
        </select>
      </label>
      <button type="submit" className="btn btn-primary" disabled={busy || name.trim().length < 2}>
        {busy ? 'Adding…' : 'Add as prospect'}
      </button>
      {error && <p className="alert alert-error crm-wide">{error}</p>}
    </form>
  );
}

function EmployerPanel({
  employer,
  stages,
  edit,
  onClose,
  onChanged,
  onError,
}: {
  employer: Employer;
  stages: EmployerStage[];
  edit: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const [notes, setNotes] = useState(employer.notes ?? '');
  const [contact, setContact] = useState({ name: '', designation: '', email: '', phone: '' });
  const [log, setLog] = useState<{ kind: InteractionKind; summary: string; followUpAt: string }>({
    kind: 'CALL',
    summary: '',
    followUpAt: '',
  });

  async function run(fn: () => Promise<unknown>, reset?: () => void) {
    try {
      await fn();
      reset?.();
      await onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'That did not work.');
    }
  }

  return (
    <aside className="crm-panel" aria-label={employer.companyName}>
      <div className="crm-panel-head">
        <h2>{employer.companyName}</h2>
        <button type="button" className="crm-x" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      {employer.companyId && <p className="muted crm-linked">On the platform - their roles come to you directly.</p>}

      <div className="crm-panel-row">
        <label className="crm-field">
          <span>Stage</span>
          <select
            value={employer.stage}
            disabled={!edit}
            onChange={(e) => run(() => opsApi.updateEmployer(employer.id, { stage: e.target.value as EmployerStage }))}
          >
            {stages.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="crm-field">
          <span>Priority</span>
          <select
            value={employer.priority}
            disabled={!edit}
            onChange={(e) => run(() => opsApi.updateEmployer(employer.id, { priority: Number(e.target.value) }))}
          >
            {[1, 2, 3].map((p) => (
              <option key={p} value={p}>
                {PRIORITY[p]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {employer.yearsHired.length > 0 && (
        <p className="crm-years">
          Came back {employer.yearsHired.length} year{employer.yearsHired.length === 1 ? '' : 's'}:{' '}
          {employer.yearsHired.map((y) => (
            <span key={y} className="pill pill-pass">
              {y}
            </span>
          ))}
        </p>
      )}

      <label className="crm-field">
        <span>Notes</span>
        <textarea
          rows={3}
          value={notes}
          disabled={!edit}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== (employer.notes ?? '') && run(() => opsApi.updateEmployer(employer.id, { notes }))}
          placeholder="What they look for, when they usually hire…"
        />
      </label>

      <h3>People</h3>
      {employer.contacts.length === 0 && <p className="muted">No contacts yet.</p>}
      <ul className="crm-people">
        {employer.contacts.map((c) => (
          <li key={c.id}>
            <span>
              <strong>{c.name}</strong>
              <small>{[c.designation, c.email, c.phone].filter(Boolean).join(' · ') || 'No details'}</small>
            </span>
            {edit && (
              <button type="button" className="link-btn is-danger" onClick={() => run(() => opsApi.removeContact(c.id))}>
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      {edit && (
        <form
          className="crm-mini"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => opsApi.addContact(employer.id, contact), () => setContact({ name: '', designation: '', email: '', phone: '' }));
          }}
        >
          <input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} placeholder="Name - Demo Recruiter" />
          <input value={contact.designation} onChange={(e) => setContact({ ...contact, designation: e.target.value })} placeholder="Campus hiring lead" />
          <input type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} placeholder="recruiter@demo-company.example" />
          <input type="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} placeholder="+91 90000 00000" />
          <button type="submit" className="btn btn-secondary btn-sm" disabled={contact.name.trim().length < 2}>
            Add contact
          </button>
        </form>
      )}

      <h3>History</h3>
      {edit && (
        <form
          className="crm-mini"
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              () =>
                opsApi.logInteraction(employer.id, {
                  kind: log.kind,
                  summary: log.summary,
                  followUpAt: log.followUpAt ? new Date(`${log.followUpAt}T10:00:00`).toISOString() : null,
                }),
              () => setLog({ kind: 'CALL', summary: '', followUpAt: '' }),
            );
          }}
        >
          <select value={log.kind} onChange={(e) => setLog({ ...log, kind: e.target.value as InteractionKind })}>
            {(Object.keys(KIND_LABEL) as InteractionKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
          <input value={log.summary} onChange={(e) => setLog({ ...log, summary: e.target.value })} placeholder="What was said or agreed" />
          <label className="crm-inline">
            Follow up on
            <input type="date" value={log.followUpAt} onChange={(e) => setLog({ ...log, followUpAt: e.target.value })} />
          </label>
          <button type="submit" className="btn btn-primary btn-sm" disabled={log.summary.trim().length < 2}>
            Log it
          </button>
        </form>
      )}
      {employer.interactions.length === 0 && <p className="muted">Nothing logged yet.</p>}
      <ol className="crm-log">
        {employer.interactions.map((i) => (
          <li key={i.id}>
            <span className="crm-log-kind">{KIND_LABEL[i.kind]}</span>
            <span className="crm-log-body">
              {i.summary}
              <small>
                {date(i.happenedAt)}
                {i.followUpAt && !i.followUpDoneAt && ` · follow up ${date(i.followUpAt)}`}
                {i.followUpDoneAt && ' · followed up'}
              </small>
            </span>
            {i.followUpState && i.followUpState !== 'upcoming' && edit && (
              <button type="button" className="link-btn" onClick={() => run(() => opsApi.followUpDone(i.id))}>
                Done
              </button>
            )}
          </li>
        ))}
      </ol>

      {edit && (
        <button
          type="button"
          className="link-btn is-danger crm-remove"
          onClick={() => {
            if (window.confirm(`Remove ${employer.companyName} and its history from your board?`)) {
              void run(() => opsApi.removeEmployer(employer.id), onClose);
            }
          }}
        >
          Remove from board
        </button>
      )}
    </aside>
  );
}
