import { useCallback, useEffect, useState, type FormEvent } from 'react';
import CampusLayout from './CampusLayout';
import { networkApi, type CampusPools, type Pool } from '../../api/network';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import '../student/Alumni.css';
import './Pools.css';

const TYPE_LABEL = { FINAL: 'Final placements', INTERNSHIP: 'Internships' } as const;

/**
 * Pooled drives: several colleges of the institution running one drive
 * together, so a company that would not visit one small campus visits five.
 *
 * Each college joins through one of its own drives and keeps approving every
 * role that reaches its students - the pool only saves the company from
 * choosing colleges one by one.
 */
export default function Pools() {
  const { hasModule, can } = useAuth();
  const enabled = hasModule('ops.pooledDrives');
  const mayEdit = can('drive:write');
  const [data, setData] = useState<CampusPools | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    networkApi
      .pools()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load pooled drives.'));
  }, []);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  async function act(fn: () => Promise<unknown>, message: string) {
    setError(null);
    try {
      await fn();
      setNotice(message);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not work.');
    }
  }

  if (!enabled) {
    return (
      <CampusLayout>
        <header className="page-head">
          <div>
            <h1>Pooled drives</h1>
            <p className="page-lede">Your institution has not switched on pooled drives yet.</p>
          </div>
        </header>
      </CampusLayout>
    );
  }

  const invitations = (data?.invited ?? []).filter((p) => p.myStatus === 'INVITED');
  const joinedElsewhere = (data?.invited ?? []).filter((p) => p.myStatus !== 'INVITED');

  return (
    <CampusLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Placements</p>
          <h1>Pooled drives</h1>
          <p className="page-lede">
            Run one drive with other colleges of your institution. Companies reach all of you at once; you still accept
            or decline every role for your own students.
          </p>
        </div>
        {mayEdit && !creating && (
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            Start a pooled drive
          </button>
        )}
      </header>

      {error && <p className="alert alert-error">{error}</p>}
      {notice && (
        <p className="alert pl-notice" role="status">
          {notice}
        </p>
      )}

      {creating && data && (
        <CreatePool
          placements={data.placements}
          onCancel={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            setNotice('Pooled drive started. Invite colleges next.');
            load();
          }}
        />
      )}

      {invitations.length > 0 && (
        <section className="card pl-invites">
          <h2>Invitations</h2>
          {invitations.map((p) => (
            <Invitation
              key={p.id}
              pool={p}
              placements={(data?.placements ?? []).filter((x) => x.type === p.type)}
              mayEdit={mayEdit}
              onJoin={(placementId) => act(() => networkApi.join(p.id, placementId), `You joined ${p.name}.`)}
              onDecline={() => act(() => networkApi.decline(p.id), `You declined ${p.name}.`)}
            />
          ))}
        </section>
      )}

      {data && data.hosted.length === 0 && invitations.length === 0 && joinedElsewhere.length === 0 && !creating && (
        <p className="nw-empty">
          No pooled drives yet. Start one to bring smaller colleges together, or wait for an invitation.
        </p>
      )}

      {data?.hosted.map((p) => (
        <HostedPool
          key={p.id}
          pool={p}
          colleges={data.colleges}
          mayEdit={mayEdit}
          onInvite={(ids) => act(() => networkApi.invite(p.id, ids), 'Invitations sent.')}
        />
      ))}

      {joinedElsewhere.map((p) => (
        <section key={p.id} className="card pl-pool">
          <PoolHead pool={p} />
          <p className="muted">
            {p.myStatus === 'JOINED'
              ? `You are in this pool, hosted by ${p.hostName}. Roles sent to it arrive in your Job requests.`
              : `You declined this pool, hosted by ${p.hostName}.`}
          </p>
          {p.myStatus === 'JOINED' && mayEdit && (
            <button type="button" className="link-btn is-danger" onClick={() => act(() => networkApi.decline(p.id), `You left ${p.name}.`)}>
              Leave this pool
            </button>
          )}
          <MemberList pool={p} />
        </section>
      ))}
    </CampusLayout>
  );
}

function PoolHead({ pool }: { pool: Pool }) {
  return (
    <div className="pl-head">
      <div>
        <h2>{pool.name}</h2>
        <p className="muted">
          {TYPE_LABEL[pool.type]} · {pool.year} · hosted by {pool.hostName}
        </p>
      </div>
      <dl className="pl-stats">
        <div>
          <dt>Colleges in</dt>
          <dd>{pool.joined}</dd>
        </div>
        <div>
          <dt>Students</dt>
          <dd>{pool.students.toLocaleString('en-IN')}</dd>
        </div>
      </dl>
    </div>
  );
}

function MemberList({ pool }: { pool: Pool }) {
  return (
    <ul className="pl-members">
      {pool.members.map((m) => (
        <li key={m.collegeId}>
          <span>
            <strong>{m.collegeName}</strong>
            <small>{[m.collegeCode, m.city].filter(Boolean).join(' · ')}</small>
          </span>
          <span className="pl-member-right">
            {m.status === 'JOINED' && <small>{m.students} students</small>}
            <span className={`pill ${m.status === 'JOINED' ? 'pill-pass' : m.status === 'DECLINED' ? 'pill-idle' : 'pill-hold'}`}>
              {m.status === 'JOINED' ? 'Joined' : m.status === 'DECLINED' ? 'Declined' : 'Invited'}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function HostedPool({
  pool,
  colleges,
  mayEdit,
  onInvite,
}: {
  pool: Pool;
  colleges: CampusPools['colleges'];
  mayEdit: boolean;
  onInvite: (ids: string[]) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const already = new Set(pool.members.filter((m) => m.status !== 'DECLINED').map((m) => m.collegeId));
  const invitable = colleges.filter((c) => !already.has(c.id));

  return (
    <section className="card pl-pool">
      <PoolHead pool={pool} />
      <MemberList pool={pool} />
      {mayEdit &&
        (picking ? (
          <div className="pl-picker">
            <p className="muted">Colleges of your institution:</p>
            <div className="pl-chips">
              {invitable.length === 0 && <span className="muted">Every college is already invited.</span>}
              {invitable.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`pl-chip ${chosen.has(c.id) ? 'is-on' : ''}`}
                  aria-pressed={chosen.has(c.id)}
                  onClick={() =>
                    setChosen((s) => {
                      const n = new Set(s);
                      if (n.has(c.id)) n.delete(c.id);
                      else n.add(c.id);
                      return n;
                    })
                  }
                  title={c.name}
                >
                  {c.code} · {c.name}
                </button>
              ))}
            </div>
            <div className="nw-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setPicking(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={chosen.size === 0}
                onClick={() => {
                  onInvite([...chosen]);
                  setChosen(new Set());
                  setPicking(false);
                }}
              >
                Invite {chosen.size || ''}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={() => setPicking(true)}>
            Invite colleges
          </button>
        ))}
    </section>
  );
}

function Invitation({
  pool,
  placements,
  mayEdit,
  onJoin,
  onDecline,
}: {
  pool: Pool;
  placements: CampusPools['placements'];
  mayEdit: boolean;
  onJoin: (placementId: string) => void;
  onDecline: () => void;
}) {
  const [placementId, setPlacementId] = useState(placements[0]?.id ?? '');
  return (
    <div className="pl-invite">
      <PoolHead pool={pool} />
      {placements.length === 0 ? (
        <p className="muted">
          To join, open a drive for {TYPE_LABEL[pool.type].toLowerCase()} first - you join through one of your own
          drives, so its batches and rules keep applying.
        </p>
      ) : (
        mayEdit && (
          <div className="nw-row">
            <label className="nw-field">
              <span>Join with your drive</span>
              <select value={placementId} onChange={(e) => setPlacementId(e.target.value)}>
                {placements.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.year})
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn-ghost" onClick={onDecline}>
              Decline
            </button>
            <button type="button" className="btn btn-primary" disabled={!placementId} onClick={() => onJoin(placementId)}>
              Join the pool
            </button>
          </div>
        )
      )}
    </div>
  );
}

function CreatePool({
  placements,
  onCancel,
  onCreated,
}: {
  placements: CampusPools['placements'];
  onCancel: () => void;
  onCreated: () => void;
}) {
  const thisYear = new Date().getFullYear();
  const [form, setForm] = useState({ name: '', year: thisYear, type: 'FINAL' as 'FINAL' | 'INTERNSHIP', placementId: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mine = placements.filter((p) => p.type === form.type);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await networkApi.createPool({ ...form, placementId: form.placementId || mine[0]?.id || '' });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start the pooled drive.');
      setBusy(false);
    }
  }

  return (
    <form className="card pl-create" onSubmit={submit}>
      <h2>Start a pooled drive</h2>
      <div className="nw-row">
        <label className="nw-field">
          <span>Name</span>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Demo City Joint Drive 2027" />
        </label>
        <label className="nw-field pl-narrow">
          <span>Year</span>
          <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
        </label>
        <label className="nw-field">
          <span>Kind</span>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'FINAL' | 'INTERNSHIP', placementId: '' })}>
            <option value="FINAL">Final placements</option>
            <option value="INTERNSHIP">Internships</option>
          </select>
        </label>
      </div>
      <label className="nw-field">
        <span>Your drive in the pool</span>
        {mine.length === 0 ? (
          <p className="muted pl-inline">Open a drive for {TYPE_LABEL[form.type].toLowerCase()} first, under Drives.</p>
        ) : (
          <select value={form.placementId || mine[0]!.id} onChange={(e) => setForm({ ...form, placementId: e.target.value })}>
            {mine.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.year})
              </option>
            ))}
          </select>
        )}
      </label>
      {error && <p className="alert alert-error">{error}</p>}
      <div className="nw-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy || form.name.trim().length < 3 || mine.length === 0}>
          Start
        </button>
      </div>
    </form>
  );
}
