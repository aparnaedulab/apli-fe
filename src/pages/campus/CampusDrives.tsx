import { useEffect, useState, type FormEvent } from 'react';
import CampusLayout from './CampusLayout';
import { ApiError } from '../../api/client';
import { placementApi } from '../../api/campus';
import {
  campusDrivesApi,
  type Drive,
  type EligibilityReport,
} from '../../api/drives';
import './CampusDrives.css';

/**
 * Drives the cell arranges.
 *
 * The page is the order of the thing, top to bottom: draft it, invite them,
 * wait, schedule it, open it. Each card shows only the one action that is
 * possible next, because a drive that is still an invitation cannot be given a
 * room and a drive nobody has agreed to cannot be opened - and a row of
 * buttons that are mostly disabled teaches nobody the order.
 */

const STEP: Record<Drive['status'], { label: string; tone: string; next: string | null }> = {
  DRAFT: { label: 'Draft', tone: 'idle', next: 'Invite the company' },
  INVITED: { label: 'Invited', tone: 'hold', next: null },
  ACCEPTED: { label: 'They agreed', tone: 'pass', next: 'Set the day and place' },
  SCHEDULED: { label: 'Scheduled', tone: 'pass', next: 'Open it to students' },
  OPEN: { label: 'Open', tone: 'pass', next: null },
  CLOSED: { label: 'Closed', tone: 'idle', next: null },
  DECLINED: { label: 'Declined', tone: 'stop', next: null },
};

export default function CampusDrives() {
  const [drives, setDrives] = useState<Drive[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  function load() {
    campusDrivesApi
      .list()
      .then((r) => setDrives(r.drives))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load the drives.'));
  }
  useEffect(load, []);

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not work.');
    }
  }

  return (
    <CampusLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Placement cell</p>
          <h1>Drives</h1>
          <p className="page-lede">
            Companies you have asked to campus. You arrange it, they agree, then you set the day and
            open it to students.
          </p>
        </div>
        {!adding && (
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            + Arrange a drive
          </button>
        )}
      </header>

      {error && <p className="alert alert-error">{error}</p>}

      {adding && (
        <NewDrive
          onCancel={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            load();
          }}
        />
      )}

      {drives === null && <p className="muted">Loading…</p>}
      {drives?.length === 0 && !adding && (
        <p className="muted">
          No drives yet. Arranging one is how you ask a company to come - they see how many of your
          students clear the bar, and decide.
        </p>
      )}

      <div className="drive-list">
        {drives?.map((d) => (
          <DriveCard key={d.id} drive={d} act={act} />
        ))}
      </div>
    </CampusLayout>
  );
}

function DriveCard({ drive: d, act }: { drive: Drive; act: (fn: () => Promise<unknown>) => void }) {
  const [report, setReport] = useState<EligibilityReport | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [panel, setPanel] = useState<'roles' | 'names' | null>(null);
  const step = STEP[d.status];

  return (
    <section className="card drive-card">
      <div className="drive-head">
        <div>
          {/* The company is what this is, the title is what it is called. It
              used to be the other way round, which made two drives for the
              same company impossible to tell apart at a glance. */}
          <h2>{d.company.name}</h2>
          <p className="drive-sub">{d.title}</p>
        </div>
        <span className={`pill pill-${step.tone}`}>{step.label}</span>
      </div>

      {d.pitch && <p className="drive-pitch">{d.pitch}</p>}

      {/* The questions anybody actually has, each with its answer beside it,
          rather than five facts run together after a dot. */}
      <dl className="drive-facts">
        <div>
          <dt>When</dt>
          <dd>
            {d.scheduledAt
              ? new Date(d.scheduledAt).toLocaleString(undefined, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Not set yet'}
          </dd>
        </div>
        <div>
          <dt>Where</dt>
          <dd>{d.addressLine || (d.meetingLink ? 'Online' : 'Not set yet')}</dd>
        </div>
        <div>
          <dt>Season</dt>
          <dd>{d.placement.name}</dd>
        </div>
        <div>
          <dt>Roles</dt>
          <dd>
            {d.jobs.length === 0
              ? 'None yet'
              : d.jobs
                  .map((j) => `${j.job.title}${j.confirmedAt ? '' : ' (unconfirmed)'}`)
                  .join(', ')}
          </dd>
        </div>
        <div>
          <dt>Who can come</dt>
          <dd>
            {[
              d.minCgpa && `CGPA ${d.minCgpa}+`,
              d.maxBacklogs !== null && `backlogs ${d.maxBacklogs} or fewer`,
              d.gradYears.length > 0 && `graduating ${d.gradYears.map((g) => g.year).join(', ')}`,
              d.branches.length > 0 && `${d.branches.length} branches`,
            ]
              .filter(Boolean)
              .join(' · ') || 'Anyone verified in the season — the company has not set a bar'}
          </dd>
        </div>
        <div>
          <dt>Names down</dt>
          <dd>
            {d.status === 'OPEN' || d.status === 'CLOSED'
              ? `${d._count.registrations} student${d._count.registrations === 1 ? '' : 's'}`
              : 'Opens to students once you open the drive'}
          </dd>
        </div>
      </dl>

      {d.status === 'DECLINED' && d.declineReason && (
        <p className="alert alert-error drive-reason">
          <b>They said no.</b> {d.declineReason}
        </p>
      )}

      <div className="drive-actions">
        {step.next && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              if (d.status === 'DRAFT') act(() => campusDrivesApi.invite(d.id));
              else if (d.status === 'ACCEPTED') setScheduling(true);
              else if (d.status === 'SCHEDULED') act(() => campusDrivesApi.open(d.id));
            }}
          >
            {step.next}
          </button>
        )}
        {d.status === 'INVITED' && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => act(() => campusDrivesApi.withdraw(d.id))}
          >
            Pull the invitation back
          </button>
        )}
        {(d.status === 'SCHEDULED' || d.status === 'OPEN') && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setScheduling(true)}>
            Change the day
          </button>
        )}
        {d.status !== 'CLOSED' && d.status !== 'DECLINED' && d.status !== 'DRAFT' && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => act(() => campusDrivesApi.close(d.id))}
          >
            Close
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setPanel(panel === 'roles' ? null : 'roles')}
        >
          Roles on the day
        </button>
        {(d.status === 'OPEN' || d.status === 'CLOSED') && d._count.registrations > 0 && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setPanel(panel === 'names' ? null : 'names')}
          >
            Who is coming
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() =>
            report
              ? setReport(null)
              : campusDrivesApi.eligibility(d.id).then((r) => setReport(r.report))
          }
        >
          {report ? 'Hide the numbers' : 'What they will see'}
        </button>
      </div>

      {scheduling && (
        <Schedule
          drive={d}
          onCancel={() => setScheduling(false)}
          onDone={(fn) => {
            setScheduling(false);
            act(fn);
          }}
        />
      )}

      {panel === 'roles' && <Roles drive={d} onChanged={() => act(async () => undefined)} />}
      {panel === 'names' && <Names driveId={d.id} />}
      {report && <Report report={report} />}
    </section>
  );
}

/**
 * The roles being offered on the day.
 *
 * Optional, and the panel says so. A cell fixes a date weeks before the roles
 * are settled, and a drive with none is simply an appointment - students can
 * put their names down, they just have nothing to apply to yet.
 */
function Roles({ drive: d, onChanged }: { drive: Drive; onChanged: () => void }) {
  const [available, setAvailable] = useState<
    { id: string; title: string; status: string }[] | null
  >(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    campusDrivesApi
      .companyJobs(d.id)
      .then((r) => setAvailable(r.jobs))
      .catch(() => setAvailable([]));
  }, [d.id]);

  const on = new Set(d.jobs.map((j) => j.job.id));
  const off = (available ?? []).filter((j) => !on.has(j.id));

  async function toggle(jobId: string, add: boolean) {
    setBusy(true);
    try {
      if (add) await campusDrivesApi.addJob(d.id, jobId);
      else await campusDrivesApi.removeJob(d.id, jobId);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="drive-panel">
      <h3 className="drive-panel-head">Roles on the day</h3>

      {d.jobs.length === 0 ? (
        <p className="muted">
          None yet — and that is fine. The visit can be arranged, agreed and scheduled without
          them. Students can put their names down; they just have nothing to apply to until a
          role is here and published.
        </p>
      ) : (
        <ul className="drive-roles">
          {d.jobs.map((j) => (
            <li key={j.job.id}>
              <span>
                <b>{j.job.title}</b>
                <small>
                  {j.job.status.toLowerCase()}
                  {j.confirmedAt ? ' · confirmed by the company' : ' · not confirmed yet'}
                </small>
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={busy}
                onClick={() => toggle(j.job.id, false)}
              >
                Take off
              </button>
            </li>
          ))}
        </ul>
      )}

      {available === null && <p className="muted">Looking up their roles…</p>}
      {off.length > 0 && (
        <div className="drive-addrole">
          <span className="muted">Add one of {d.company.name}&rsquo;s roles:</span>
          {off.slice(0, 12).map((j) => (
            <button
              key={j.id}
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy}
              onClick={() => toggle(j.id, true)}
            >
              + {j.title}
            </button>
          ))}
        </div>
      )}
      {available !== null && available.length === 0 && (
        <p className="muted">{d.company.name} has no roles on the platform yet.</p>
      )}
    </div>
  );
}

/** Who has put their name down. The cell's own list - names and all. */
function Names({ driveId }: { driveId: string }) {
  const [rows, setRows] = useState<
    | {
        id: string;
        createdAt: string;
        candidate: {
          id: string;
          course: string | null;
          specialisation: string | null;
          cgpa: string | null;
          user: { fullName: string; email: string };
        };
      }[]
    | null
  >(null);

  useEffect(() => {
    campusDrivesApi
      .registrations(driveId)
      .then((r) => setRows(r.registrations))
      .catch(() => setRows([]));
  }, [driveId]);

  if (rows === null) return <div className="drive-panel"><p className="muted">Loading…</p></div>;

  return (
    <div className="drive-panel">
      <h3 className="drive-panel-head">
        Who is coming <span className="count">{rows.length}</span>
      </h3>
      <table className="league">
        <thead>
          <tr>
            <th>Student</th>
            <th>Course</th>
            <th>Branch</th>
            <th className="num">CGPA</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                {r.candidate.user.fullName}
                <br />
                <small className="muted">{r.candidate.user.email}</small>
              </td>
              <td>{r.candidate.course ?? '—'}</td>
              <td>{r.candidate.specialisation ?? '—'}</td>
              <td className="num">{r.candidate.cgpa ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted drive-note">
        The company sees only those who also agreed to share their profile.
      </p>
    </div>
  );
}

/** The numbers, and nothing but. */
function Report({ report: r }: { report: EligibilityReport }) {
  return (
    <div className="drive-report">
      <div className="drive-figures">
        <Figure value={r.inSeason} label="in the season" />
        <Figure value={r.verified} label="verified" />
        <Figure
          value={r.eligible}
          label={r.eligiblePct === null ? 'clear the bar' : `clear the bar · ${r.eligiblePct}%`}
          strong
        />
      </div>

      {r.byBranch.length > 0 && (
        <p className="drive-split">
          {r.byBranch.map((b) => `${b.branch}: ${b.count}`).join(' · ')}
        </p>
      )}
      {r.failing.length > 0 && (
        <p className="muted">
          Held back by {r.failing.map((f) => `${f.reason} (${f.count})`).join(', ')}.
        </p>
      )}
      <p className="muted drive-note">{r.note} No names are shared.</p>
    </div>
  );
}

function Figure({ value, label, strong }: { value: number; label: string; strong?: boolean }) {
  return (
    <div className={`drive-figure ${strong ? 'is-strong' : ''}`}>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

function Schedule({
  drive,
  onCancel,
  onDone,
}: {
  drive: Drive;
  onCancel: () => void;
  onDone: (fn: () => Promise<unknown>) => void;
}) {
  const [when, setWhen] = useState(drive.scheduledAt?.slice(0, 16) ?? '');
  const [where, setWhere] = useState(drive.addressLine ?? '');
  const [link, setLink] = useState(drive.meetingLink ?? '');

  return (
    <form
      className="drive-schedule"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onDone(() =>
          campusDrivesApi.schedule(drive.id, {
            scheduledAt: new Date(when).toISOString(),
            addressLine: where,
            meetingLink: link,
          }),
        );
      }}
    >
      <label className="field">
        <span className="field-label">When</span>
        <input
          type="datetime-local"
          className="input"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          required
        />
      </label>
      <label className="field">
        <span className="field-label">Where on campus</span>
        <input
          className="input"
          value={where}
          onChange={(e) => setWhere(e.target.value)}
          placeholder="Hall B, Main Building"
        />
      </label>
      <label className="field">
        <span className="field-label">Or a link</span>
        <input
          className="input"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://…"
        />
      </label>
      <div className="drive-actions">
        <button type="submit" className="btn btn-primary btn-sm">
          Save the day
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function NewDrive({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const [seasons, setSeasons] = useState<{ id: string; name: string }[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [f, setF] = useState({ placementId: '', companyId: '', title: '', pitch: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    placementApi
      .list()
      .then((rows) => setSeasons(rows.filter((p) => p.isOpen)))
      .catch(() => setSeasons([]));
    campusDrivesApi
      .companies()
      .then((r) => setCompanies(r.companies))
      .catch(() => setCompanies([]));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await campusDrivesApi.create({
        placementId: f.placementId,
        companyId: f.companyId,
        title: f.title,
        pitch: f.pitch || null,
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not arrange that drive.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>Arrange a drive</h2>
      </div>
      {error && <p className="alert alert-error">{error}</p>}
      <form className="drive-form" onSubmit={submit}>
        <label className="field">
          <span className="field-label">Season</span>
          <select
            className="input"
            value={f.placementId}
            onChange={(e) => setF({ ...f, placementId: e.target.value })}
            required
          >
            <option value="">Choose…</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Company</span>
          {companies.length > 0 ? (
            <select
              className="input"
              value={f.companyId}
              onChange={(e) => setF({ ...f, companyId: e.target.value })}
              required
            >
              <option value="">Choose…</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="input"
              value={f.companyId}
              onChange={(e) => setF({ ...f, companyId: e.target.value })}
              placeholder="Company id"
              required
            />
          )}
        </label>

        <label className="field drive-form-wide">
          <span className="field-label">What to call it</span>
          <input
            className="input"
            value={f.title}
            onChange={(e) => setF({ ...f, title: e.target.value })}
            placeholder="Infosys — Systems Engineer"
            required
          />
        </label>

        <label className="field drive-form-wide">
          <span className="field-label">What you are telling them</span>
          <textarea
            className="input"
            rows={3}
            value={f.pitch}
            onChange={(e) => setF({ ...f, pitch: e.target.value })}
            placeholder="Two rounds on campus, hall and systems provided, offers the same evening."
          />
        </label>

        <div className="drive-actions drive-form-wide">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save as a draft'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <span className="muted">
            Nothing is sent yet. You invite the company from the card once it is saved - they set
            their own bar on the invitation, and see how many of your students clear it.
          </span>
        </div>
      </form>
    </section>
  );
}
