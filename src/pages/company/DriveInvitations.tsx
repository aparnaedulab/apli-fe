import { useEffect, useState } from 'react';
import CompanyLayout from './CompanyLayout';
import { ApiError } from '../../api/client';
import { companyDrivesApi, type Drive, type EligibilityReport } from '../../api/drives';
import '../campus/CampusDrives.css';

/**
 * Colleges asking you to come.
 *
 * The decision a recruiter is actually making here is "is this campus worth a
 * day", so the numbers are the page rather than a link off it: how many
 * students are in the season, how many the college has verified, and how many
 * clear the bar you were given - loaded with the invitation, not behind a
 * click.
 *
 * What is not here, and will not be: the students. No name, no roll number, no
 * list. The college holds its roster and the counts are what travel.
 */

const LABEL: Record<Drive['status'], string> = {
  DRAFT: 'Draft',
  INVITED: 'Waiting on you',
  ACCEPTED: 'You agreed',
  SCHEDULED: 'Scheduled',
  OPEN: 'Open to students',
  CLOSED: 'Closed',
  DECLINED: 'You declined',
};

export default function DriveInvitations() {
  const [drives, setDrives] = useState<Drive[] | null>(null);
  const [reports, setReports] = useState<Record<string, EligibilityReport>>({});
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  function load() {
    companyDrivesApi
      .list()
      .then((r) => {
        setDrives(r.drives);
        // The numbers are the decision, so they arrive with the invitation.
        for (const d of r.drives) {
          if (d.status === 'INVITED') {
            companyDrivesApi
              .eligibility(d.id)
              .then((e) => setReports((m) => ({ ...m, [d.id]: e.report })))
              .catch(() => undefined);
          }
        }
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load invitations.'));
  }
  useEffect(load, []);

  async function respond(id: string, accept: boolean, why?: string) {
    setError(null);
    try {
      await companyDrivesApi.respond(id, accept, why);
      setDeclining(null);
      setReason('');
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not work.');
    }
  }

  return (
    <CompanyLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Recruiter</p>
          <h1>Campus invitations</h1>
          <p className="page-lede">
            Colleges that have asked you to come, with how many of their students clear the bar.
          </p>
        </div>
      </header>

      {error && <p className="alert alert-error">{error}</p>}
      {drives === null && <p className="muted">Loading…</p>}
      {drives?.length === 0 && (
        <p className="muted">No college has invited you to a drive yet.</p>
      )}

      <div className="drive-list">
        {drives?.map((d) => {
          const r = reports[d.id];
          return (
            <section key={d.id} className="card drive-card">
              <div className="drive-head">
                <div>
                  <h2>{d.college.name}</h2>
                  <p className="drive-sub">{d.title}</p>
                </div>
                <span className={`pill pill-${d.status === 'INVITED' ? 'hold' : d.status === 'DECLINED' ? 'stop' : 'pass'}`}>
                  {LABEL[d.status]}
                </span>
              </div>

              {d.pitch && <p className="drive-pitch">{d.pitch}</p>}

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
                      : 'The college sets this once you agree'}
                  </dd>
                </div>
                <div>
                  <dt>Where</dt>
                  <dd>{d.addressLine || (d.meetingLink ? 'Online' : 'Set once you agree')}</dd>
                </div>
                <div>
                  <dt>Season</dt>
                  <dd>
                    {d.placement.name} ({d.placement.year})
                  </dd>
                </div>
                <div>
                  <dt>Your roles on the day</dt>
                  <dd>
                    {d.jobs.length === 0
                      ? 'None yet — you can add them after agreeing'
                      : d.jobs.map((j) => j.job.title).join(', ')}
                  </dd>
                </div>
              </dl>

              {d.status === 'INVITED' ? (
                <Bar
                  drive={d}
                  onChanged={(drive, report) => {
                    setDrives((ds) => ds?.map((x) => (x.id === drive.id ? drive : x)) ?? ds);
                    setReports((m) => ({ ...m, [drive.id]: report }));
                  }}
                />
              ) : (
                <p className="drive-bar muted">
                  Your bar:{' '}
                  {[
                    d.minCgpa && `CGPA ${d.minCgpa}+`,
                    d.maxBacklogs !== null && `backlogs ≤ ${d.maxBacklogs}`,
                    d.gradYears.length > 0 && d.gradYears.map((g) => g.year).join(', '),
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'everyone verified in the season'}
                </p>
              )}

              {r && (
                <div className="drive-report">
                  <div className="drive-figures">
                    <div className="drive-figure">
                      <b>{r.inSeason}</b>
                      <span>in the season</span>
                    </div>
                    <div className="drive-figure">
                      <b>{r.verified}</b>
                      <span>verified by the college</span>
                    </div>
                    <div className="drive-figure is-strong">
                      <b>{r.eligible}</b>
                      <span>
                        clear your bar{r.eligiblePct === null ? '' : ` · ${r.eligiblePct}%`}
                      </span>
                    </div>
                  </div>
                  {r.byBranch.length > 0 && (
                    <p className="drive-split">
                      {r.byBranch.map((b) => `${b.branch}: ${b.count}`).join(' · ')}
                    </p>
                  )}
                  <p className="muted drive-note">{r.note}</p>
                </div>
              )}

              {d.status === 'INVITED' && (
                <div className="drive-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => respond(d.id, true)}
                  >
                    Yes, we will come
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setDeclining(declining === d.id ? null : d.id)}
                  >
                    Decline
                  </button>
                </div>
              )}

              {declining === d.id && (
                <form
                  className="drive-decline"
                  onSubmit={(e) => {
                    e.preventDefault();
                    respond(d.id, false, reason);
                  }}
                >
                  <label className="field">
                    <span className="field-label">Why not?</span>
                    <input
                      className="input"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Hiring is paused for this quarter."
                      required
                    />
                    <span className="field-hint">
                      The cell is planning a season around this, so a reason saves them a fortnight
                      of guessing.
                    </span>
                  </label>
                  <button type="submit" className="btn btn-secondary btn-sm">
                    Send
                  </button>
                </form>
              )}

              {(d.status === 'OPEN' || d.status === 'CLOSED') && <Roster driveId={d.id} />}

              {d.status === 'DECLINED' && d.declineReason && (
                <p className="muted">You said: {d.declineReason}</p>
              )}
            </section>
          );
        })}
      </div>
    </CompanyLayout>
  );
}

/**
 * Who you will meet.
 *
 * Students who put their own name down for this drive and agreed to share
 * their profile. Anybody who has not answered that consent is counted and not
 * named, so the number still adds up and nobody is quietly missing.
 */
function Roster({ driveId }: { driveId: string }) {
  const [data, setData] = useState<Awaited<
    ReturnType<typeof companyDrivesApi.students>
  > | null>(null);

  useEffect(() => {
    companyDrivesApi
      .students(driveId)
      .then(setData)
      .catch(() => setData(null));
  }, [driveId]);

  if (!data) return null;

  return (
    <div className="drive-panel">
      <h3 className="drive-panel-head">
        Who is coming <span className="count">{data.students.length}</span>
      </h3>

      {data.students.length === 0 ? (
        <p className="muted">{data.note}</p>
      ) : (
        <table className="league">
          <thead>
            <tr>
              <th>Student</th>
              <th>Branch</th>
              <th className="num">CGPA</th>
              <th className="num">Backlogs</th>
              <th className="num">Graduating</th>
            </tr>
          </thead>
          <tbody>
            {data.students.map((s) => (
              <tr key={s.id}>
                <td>
                  {s.name}
                  <br />
                  <small className="muted">{s.email}</small>
                </td>
                <td>{s.branch ?? s.course ?? '—'}</td>
                <td className="num">{s.cgpa ?? '—'}</td>
                <td className="num">{s.backlogs ?? '—'}</td>
                <td className="num">{s.graduationYear ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {data.withheld > 0 && (
        <p className="muted drive-note">
          {data.withheld} more {data.withheld === 1 ? 'student has' : 'students have'} put their
          name down but not agreed to share their profile, so they are counted here and not named.
        </p>
      )}
    </div>
  );
}

/**
 * The bar, as the company's own.
 *
 * The college wrote down what it was told on the phone; this is where that
 * gets corrected by the people whose requirement it actually is. The counts
 * move with it, so the trade - drop to 6.5 and reach nineteen more - is one
 * number to look at rather than a second conversation.
 */
function Bar({
  drive: d,
  onChanged,
}: {
  drive: Drive;
  onChanged: (drive: Drive, report: EligibilityReport) => void;
}) {
  const [cgpa, setCgpa] = useState(d.minCgpa ?? '');
  const [backlogs, setBacklogs] = useState(d.maxBacklogs === null ? '' : String(d.maxBacklogs));
  const [years, setYears] = useState(d.gradYears.map((g) => g.year).join(', '));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function apply() {
    setBusy(true);
    setNote(null);
    try {
      const r = await companyDrivesApi.setCriteria(d.id, {
        minCgpa: cgpa === '' ? null : Number(cgpa),
        maxBacklogs: backlogs === '' ? null : Number(backlogs),
        gradYears: years
          .split(',')
          .map((y) => Number(y.trim()))
          .filter((y) => Number.isFinite(y) && y > 2000),
      });
      onChanged(r.drive, r.report);
      setNote('Updated. The counts below are for this bar.');
    } catch (e) {
      setNote(e instanceof ApiError ? e.message : 'Could not change that.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="drive-barform">
      <p className="drive-barform-head">
        <b>Your requirement</b> — {d.college.name} wrote down what you asked for. Correct it and the
        numbers move.
      </p>
      <div className="drive-barform-row">
        <label className="field">
          <span className="field-label">Minimum CGPA</span>
          <input className="input" value={cgpa} onChange={(e) => setCgpa(e.target.value)} placeholder="any" />
        </label>
        <label className="field">
          <span className="field-label">Backlogs allowed</span>
          <input
            className="input"
            value={backlogs}
            onChange={(e) => setBacklogs(e.target.value)}
            placeholder="any"
          />
        </label>
        <label className="field">
          <span className="field-label">Graduating years</span>
          <input
            className="input"
            value={years}
            onChange={(e) => setYears(e.target.value)}
            placeholder="2026"
          />
        </label>
        <button type="button" className="btn btn-secondary btn-sm" onClick={apply} disabled={busy}>
          {busy ? 'Counting…' : 'Recount'}
        </button>
      </div>
      {note && <p className="muted">{note}</p>}
    </div>
  );
}
