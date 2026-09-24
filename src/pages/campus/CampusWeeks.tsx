import { useCallback, useEffect, useState } from 'react';
import CampusLayout from './CampusLayout';
import { ApiError } from '../../api/client';
import {
  COLLEGE_EVENT_KINDS,
  EVENT_LABEL,
  fmtDate,
  fmtDateTime,
  opportunitiesApi,
  toLocalInput,
  type CollegeWeek,
  type EventKind,
  type WeekEventInput,
  type WeekStatus,
} from '../../api/opportunities';
import { campusApi, postingApi, type BatchSummary, type PostingRow } from '../../api/campus';
import { useAuth } from '../../auth/AuthContext';
import '../student/Opportunities.css';
import './Events.css';

type Event = CollegeWeek['events'][number];

const STATUS: Record<WeekStatus, { pill: string; label: string }> = {
  PROPOSED: { pill: 'pill-hold', label: 'Needs your decision' },
  APPROVED: { pill: 'pill-pass', label: 'On' },
  DECLINED: { pill: 'pill-stop', label: 'Declined' },
  DONE: { pill: 'pill-idle', label: 'Finished' },
};

/** A new event starts as one session, because most of them are one session. */
const blankSession = (): WeekEventInput => ({
  kind: 'PREP',
  title: '',
  startsAt: toLocalInput(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()),
  durationMin: 60,
  where: '',
  jobId: '',
});

/** The day an event spans, worked out from its sessions rather than asked for. */
function span(sessions: WeekEventInput[]) {
  const times = sessions.map((s) => new Date(s.startsAt).getTime()).filter((t) => !Number.isNaN(t));
  if (times.length === 0) return null;
  const day = (t: number) => {
    const d = new Date(t);
    d.setHours(12, 0, 0, 0);
    return d.toISOString();
  };
  return { startDate: day(Math.min(...times)), endDate: day(Math.max(...times)) };
}

/**
 * Events on campus: the cell's own, and the weeks companies ask for.
 *
 * One page because they are one thing to a student - somewhere to be, at a
 * time, that they can put their name down for. What differs is who owns it. A
 * company proposes and this page decides; an event the placement cell creates
 * is on the moment it is saved, because there is nobody left to approve it.
 *
 * Either way the college can invite people: a batch, or everybody who applied
 * to a role it hosts. Invitations do not close the door - a student who was
 * not invited can still enrol themselves.
 */
export default function CampusWeeks() {
  const { hasModule, can } = useAuth();
  const on = hasModule('showcase.campusWeeks') && can('drive:read');
  const mayWrite = can('drive:write');
  const [weeks, setWeeks] = useState<CollegeWeek[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  /* What the invite panel and the "about this role" picker choose from. */
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [roles, setRoles] = useState<PostingRow[]>([]);

  const load = useCallback(async () => {
    try {
      setWeeks(await opportunitiesApi.collegeWeeks());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load events.');
    }
  }, []);

  useEffect(() => {
    if (!on) return;
    void load();
    campusApi
      .listBatches()
      .then(setBatches)
      .catch(() => setBatches([]));
    postingApi
      .list('ACCEPTED')
      .then(setRoles)
      .catch(() => setRoles([]));
  }, [on, load]);

  async function run(fn: () => Promise<CollegeWeek[] | unknown>, msg?: string) {
    setError(null);
    setNotice(null);
    try {
      const r = await fn();
      if (Array.isArray(r)) setWeeks(r as CollegeWeek[]);
      else await load();
      if (msg) setNotice(msg);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not work.');
    }
  }

  const waiting = weeks?.filter((w) => w.status === 'PROPOSED') ?? [];
  const ours = weeks?.filter((w) => w.mine && w.status !== 'PROPOSED') ?? [];
  const rest = weeks?.filter((w) => !w.mine && w.status !== 'PROPOSED') ?? [];

  return (
    <CampusLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Events</p>
          <h1>Events on campus</h1>
          <p className="page-lede">
            {on
              ? 'Your own sessions - preparation, workshops, alumni talks - and the weeks companies ask to run. Students can enrol themselves, and you can invite a batch or everyone who applied to a role.'
              : 'Campus events are not switched on for your institution.'}
          </p>
        </div>
        {on && mayWrite && !creating && (
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            Create an event
          </button>
        )}
      </header>

      {on && (
        <>
          <p className="opp-money">
            <span>
              <strong>Free, and names stay here.</strong> Nobody pays for a campus event. A company sees only how many
              students registered and attended, never who.
            </span>
          </p>
          {error && <p className="alert alert-error">{error}</p>}
          {notice && <p className="alert alert-ok">{notice}</p>}

          {creating && (
            <EventForm
              roles={roles}
              onCancel={() => setCreating(false)}
              onSave={async (input) => {
                await run(
                  () => opportunitiesApi.createEvent(input).then((r) => r.weeks),
                  `"${input.title}" is on. Every student here has been told.`,
                );
                setCreating(false);
              }}
            />
          )}

          {!weeks && !error && <p className="muted">Loading…</p>}
          {weeks && weeks.length === 0 && !creating && (
            <div className="empty">
              <h2>Nothing on yet.</h2>
              <p>
                Create an event for your own students, or wait for a company to propose a week - a proposal appears here
                and you get a notification.
              </p>
            </div>
          )}

          {waiting.length > 0 && (
            <>
              <h2 className="ev-heading">Waiting for you ({waiting.length})</h2>
              <div className="week-list" style={{ marginBottom: 24 }}>
                {waiting.map((w) => (
                  <WeekCard key={w.id} w={w} mayWrite={mayWrite} run={run} batches={batches} roles={roles} notify={setNotice} />
                ))}
              </div>
            </>
          )}

          {ours.length > 0 && (
            <>
              <h2 className="ev-heading">Yours</h2>
              <div className="week-list" style={{ marginBottom: 24 }}>
                {ours.map((w) => (
                  <WeekCard key={w.id} w={w} mayWrite={mayWrite} run={run} batches={batches} roles={roles} notify={setNotice} />
                ))}
              </div>
            </>
          )}

          {rest.length > 0 && (
            <>
              <h2 className="ev-heading">Company weeks</h2>
              <div className="week-list">
                {rest.map((w) => (
                  <WeekCard key={w.id} w={w} mayWrite={mayWrite} run={run} batches={batches} roles={roles} notify={setNotice} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </CampusLayout>
  );
}

type Run = (fn: () => Promise<CollegeWeek[] | unknown>, msg?: string) => Promise<void>;

/* -------------------------------------------------------------------------- */
/* Creating one                                                                */
/* -------------------------------------------------------------------------- */

function EventForm({
  roles,
  onCancel,
  onSave,
}: {
  roles: PostingRow[];
  onCancel: () => void;
  onSave: (input: {
    collegeId: string;
    title: string;
    message?: string;
    startDate: string;
    endDate: string;
    events: WeekEventInput[];
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sessions, setSessions] = useState<WeekEventInput[]>([blankSession()]);
  const [busy, setBusy] = useState(false);

  function setSession(i: number, patch: Partial<WeekEventInput>) {
    setSessions((xs) => xs.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  const dates = span(sessions);
  const ready = title.trim().length >= 4 && sessions.every((s) => s.title.trim().length >= 3) && dates !== null;

  return (
    <section className="opp-card ev-form">
      <h2>A new event</h2>
      <p className="muted">
        Every student at your college is told when you save it. Invite a batch or a role’s applicants afterwards if it is
        meant for some of them in particular.
      </p>

      <label className="field">
        <span className="field-label">What is it called</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={140}
          placeholder="Aptitude preparation before the Zenith Labs drive"
          autoFocus
        />
      </label>

      <label className="field">
        <span className="field-label">
          Anything students should know <span className="muted">optional</span>
        </span>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} rows={2} />
      </label>

      <p className="field-label">Sessions</p>
      {sessions.map((s, i) => (
        <div key={i} className="ev-session">
          <select value={s.kind} onChange={(e) => setSession(i, { kind: e.target.value as EventKind })} aria-label="Kind">
            {COLLEGE_EVENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {EVENT_LABEL[k]}
              </option>
            ))}
          </select>
          <input
            value={s.title}
            onChange={(e) => setSession(i, { title: e.target.value })}
            placeholder="What happens in this session"
            maxLength={140}
            aria-label="Session title"
          />
          <input
            type="datetime-local"
            value={s.startsAt}
            onChange={(e) => setSession(i, { startsAt: e.target.value })}
            aria-label="Starts"
          />
          <input
            type="number"
            min={15}
            max={480}
            step={15}
            value={s.durationMin}
            onChange={(e) => setSession(i, { durationMin: Number(e.target.value) })}
            aria-label="Minutes"
          />
          <input
            value={s.where ?? ''}
            onChange={(e) => setSession(i, { where: e.target.value })}
            placeholder="Room or hall"
            maxLength={300}
            aria-label="Where"
          />
          <select value={s.jobId ?? ''} onChange={(e) => setSession(i, { jobId: e.target.value })} aria-label="About which role">
            <option value="">Not about one role</option>
            {roles.map((r) => (
              <option key={r.jobId} value={r.jobId}>
                {r.title} · {r.companyName}
              </option>
            ))}
          </select>
          {sessions.length > 1 && (
            <button
              type="button"
              className="link-btn is-danger"
              onClick={() => setSessions((xs) => xs.filter((_, j) => j !== i))}
            >
              Remove
            </button>
          )}
        </div>
      ))}

      <div className="form-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSessions((xs) => [...xs, blankSession()])}>
          Add another session
        </button>
        <span className="ev-grow" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!ready || busy}
          onClick={async () => {
            if (!dates) return;
            setBusy(true);
            try {
              await onSave({
                collegeId: '',
                title: title.trim(),
                message: message.trim() || undefined,
                startDate: dates.startDate,
                endDate: dates.endDate,
                events: sessions.map((s) => ({
                  ...s,
                  title: s.title.trim(),
                  startsAt: new Date(s.startsAt).toISOString(),
                  where: s.where?.trim() || undefined,
                  jobId: s.jobId || undefined,
                })),
              });
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Saving…' : 'Create and tell students'}
        </button>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* One event or week                                                           */
/* -------------------------------------------------------------------------- */

function WeekCard({
  w,
  mayWrite,
  run,
  batches,
  roles,
  notify,
}: {
  w: CollegeWeek;
  mayWrite: boolean;
  run: Run;
  batches: BatchSummary[];
  roles: PostingRow[];
  notify: (msg: string) => void;
}) {
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState('');
  const s = STATUS[w.status];
  const live = w.status === 'PROPOSED' || w.status === 'APPROVED';

  return (
    <section className={`opp-card ${w.mine ? 'is-ours' : ''}`}>
      <div className="opp-top">
        <div>
          <h3>{w.title}</h3>
          <span className="opp-company">
            {w.mine ? 'Yours' : `${w.company?.name ?? 'A company'}${w.company?.verified ? ' (verified)' : ''}`} ·{' '}
            {fmtDate(w.startDate)}
            {w.startDate.slice(0, 10) !== w.endDate.slice(0, 10) ? ` to ${fmtDate(w.endDate)}` : ''}
          </span>
        </div>
        <span className={`pill ${s.pill}`}>{s.label}</span>
      </div>
      {w.message && <p className="opp-quote">{w.message}</p>}
      {w.decisionNote && w.status !== 'PROPOSED' && <p className="muted">Your note: {w.decisionNote}</p>}

      <ul className="week-events">
        {w.events.map((e) => (
          <EventRow
            key={e.id}
            w={w}
            e={e}
            mayEdit={mayWrite && live}
            mayMark={mayWrite && (w.status === 'APPROVED' || w.status === 'DONE')}
            run={run}
            batches={batches}
            roles={roles}
            notify={notify}
          />
        ))}
      </ul>

      {mayWrite && w.status === 'PROPOSED' && !declining && (
        <div className="opp-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() =>
              run(
                () => opportunitiesApi.decideWeek(w.id, 'APPROVED', note.trim()),
                `Approved. Your students have been told about “${w.title}”.`,
              )
            }
          >
            Approve and tell students
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDeclining(true)}>
            Decline
          </button>
        </div>
      )}
      {declining && (
        <div className="opp-form">
          <label className="field">
            <span className="field-label">Why, or what would work instead - the company sees this</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} autoFocus />
          </label>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDeclining(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={note.trim().length === 0}
              onClick={() => run(() => opportunitiesApi.decideWeek(w.id, 'DECLINED', note.trim()), 'Declined. The company has your note.')}
            >
              Decline with this note
            </button>
          </div>
        </div>
      )}
      {mayWrite && w.status === 'APPROVED' && (
        <div className="opp-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => run(() => opportunitiesApi.finishWeek(w.id), 'Marked finished.')}
          >
            Mark it finished
          </button>
          {w.mine && (
            <button
              type="button"
              className="link-btn is-danger"
              onClick={() => run(() => opportunitiesApi.deleteEvent(w.id), 'Event removed.')}
            >
              Delete this event
            </button>
          )}
          <span className="muted">You can still correct attendance afterwards.</span>
        </div>
      )}
    </section>
  );
}

function EventRow({
  w,
  e,
  mayEdit,
  mayMark,
  run,
  batches,
  roles,
  notify,
}: {
  w: CollegeWeek;
  e: Event;
  mayEdit: boolean;
  mayMark: boolean;
  run: Run;
  batches: BatchSummary[];
  roles: PostingRow[];
  notify: (msg: string) => void;
}) {
  const [moving, setMoving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [startsAt, setStartsAt] = useState(toLocalInput(e.startsAt));
  const [durationMin, setDurationMin] = useState(e.durationMin);
  const [where, setWhere] = useState(e.where ?? '');
  const role = roles.find((r) => r.jobId === e.jobId);

  const going = e.people.filter((p) => p.status === 'GOING');
  const asked = e.people.filter((p) => p.status === 'INVITED');
  const no = e.people.filter((p) => p.status === 'DECLINED');

  return (
    <li className="week-event">
      <span className="week-kind">{EVENT_LABEL[e.kind]}</span>
      <div>
        <strong>{e.title}</strong>
        <small>
          {fmtDateTime(e.startsAt)} · {e.durationMin} min{e.where ? ` · ${e.where}` : ''} · {e.registered} coming
          {e.invited > 0 ? ` · ${e.invited} asked` : ''}
          {e.attended > 0 ? ` · ${e.attended} came` : ''}
        </small>
        {role && (
          <small className="ev-role">
            About {role.title} · {role.companyName}
          </small>
        )}
      </div>
      <div className="ev-row-actions">
        {mayEdit && !moving && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMoving(true)}>
            Change time or place
          </button>
        )}
        {mayEdit && w.status === 'APPROVED' && !e.people.length && !inviting && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setInviting(true)}>
            Invite students
          </button>
        )}
        {mayEdit && w.status === 'APPROVED' && e.people.length > 0 && !inviting && (
          <button type="button" className="link-btn" onClick={() => setInviting(true)}>
            Invite more
          </button>
        )}
      </div>

      {moving && (
        <div className="opp-form week-people">
          <input type="datetime-local" value={startsAt} onChange={(x) => setStartsAt(x.target.value)} aria-label="Starts" style={{ maxWidth: 220 }} />
          <input type="number" min={15} max={480} step={15} value={durationMin} onChange={(x) => setDurationMin(Number(x.target.value))} aria-label="Minutes" style={{ maxWidth: 100 }} />
          <input value={where} onChange={(x) => setWhere(x.target.value)} placeholder="Room or hall" maxLength={300} aria-label="Where" style={{ maxWidth: 220 }} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMoving(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={async () => {
              await run(
                () =>
                  opportunitiesApi.adjustEvent(w.id, e.id, {
                    startsAt: new Date(startsAt).toISOString(),
                    durationMin,
                    where: where.trim(),
                  }),
                'Session updated. Anybody coming sees the new time.',
              );
              setMoving(false);
            }}
          >
            Save
          </button>
        </div>
      )}

      {inviting && (
        <InvitePanel
          w={w}
          e={e}
          batches={batches}
          roles={roles}
          run={run}
          notify={notify}
          onDone={() => setInviting(false)}
        />
      )}

      {e.people.length > 0 && (
        <div className="week-people">
          {[
            { list: going, label: 'Coming' },
            { list: asked, label: 'Invited, no answer yet' },
            { list: no, label: 'Not coming' },
          ]
            .filter((g) => g.list.length > 0)
            .map((g) => (
              <div key={g.label} className="ev-group">
                <small className="ev-group-label">
                  {g.label} ({g.list.length})
                </small>
                <div className="ev-group-people">
                  {g.list.map((p) => (
                    <label key={p.candidateId} className="week-person" title={p.course}>
                      {mayMark && g.label !== 'Not coming' && (
                        <input
                          type="checkbox"
                          checked={p.attended}
                          onChange={(x) => run(() => opportunitiesApi.attendance(w.id, e.id, p.candidateId, x.target.checked))}
                        />
                      )}
                      {p.name}
                      {!mayMark && p.attended ? ' ✓' : ''}
                    </label>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </li>
  );
}

/**
 * Who to ask.
 *
 * Two scopes, because they are the two that come up: a whole batch, or
 * everybody who applied to a role. Neither shuts anybody out - a student who
 * was not invited still sees the event and can put their own name down.
 */
function InvitePanel({
  w,
  e,
  batches,
  roles,
  run,
  notify,
  onDone,
}: {
  w: CollegeWeek;
  e: Event;
  batches: BatchSummary[];
  roles: PostingRow[];
  run: Run;
  notify: (msg: string) => void;
  onDone: () => void;
}) {
  const [scope, setScope] = useState<'batch' | 'job'>(e.jobId ? 'job' : 'batch');
  const [batchId, setBatchId] = useState(batches[0]?.id ?? '');
  const [jobId, setJobId] = useState(e.jobId ?? roles[0]?.jobId ?? '');
  const [busy, setBusy] = useState(false);

  const ready = scope === 'batch' ? Boolean(batchId) : Boolean(jobId);

  return (
    <div className="opp-form ev-invite">
      <div className="ev-scope" role="radiogroup" aria-label="Who to invite">
        <label>
          <input type="radio" checked={scope === 'batch'} onChange={() => setScope('batch')} /> A batch
        </label>
        <label>
          <input type="radio" checked={scope === 'job'} onChange={() => setScope('job')} /> Everyone who applied to a role
        </label>
      </div>

      {scope === 'batch' ? (
        <select value={batchId} onChange={(x) => setBatchId(x.target.value)} aria-label="Batch">
          {batches.length === 0 && <option value="">No batches yet</option>}
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      ) : (
        <select value={jobId} onChange={(x) => setJobId(x.target.value)} aria-label="Role">
          {roles.length === 0 && <option value="">No roles accepted yet</option>}
          {roles.map((r) => (
            <option key={r.jobId} value={r.jobId}>
              {r.title} · {r.companyName}
            </option>
          ))}
        </select>
      )}

      <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>
        Cancel
      </button>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={!ready || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await run(async () => {
              const r = await opportunitiesApi.invite(w.id, e.id, scope === 'batch' ? { batchId } : { jobId });
              notify(
                r.invited === 0
                  ? 'Everybody there had already been asked.'
                  : `${r.invited} student${r.invited === 1 ? '' : 's'} invited to “${e.title}”.`,
              );
              return r.weeks;
            });
            onDone();
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Inviting…' : 'Send invitations'}
      </button>
    </div>
  );
}
