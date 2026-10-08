import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CompanyLayout from './CompanyLayout';
import { ApiError } from '../../api/client';
import { barsOf, companyDrivesApi, type Drive, type EligibilityReport } from '../../api/drives';
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

      {drives && drives.length > 0 && (
        <ul className="ecards">
          {drives.map((d) => {
            const r = reports[d.id];
            return (
              <li key={d.id}>
                <section className={`ecard is-static ${d.status === 'DECLINED' ? 'is-muted' : ''}`}>
                  <span className="ecard-top">
                    <span className="ecard-tag">
                      {d.placement.name} ({d.placement.year})
                    </span>
                    <span className={`pill pill-${d.status === 'INVITED' ? 'hold' : d.status === 'DECLINED' ? 'stop' : 'pass'}`}>
                      {LABEL[d.status]}
                    </span>
                  </span>
                  <b className="ecard-title">{d.college.name}</b>
                  <span className="ecard-sub">{d.title}</span>

                  {d.pitch && <p className="drive-pitch">{d.pitch}</p>}

                  <dl className="ecard-facts">
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
                  </dl>
                  <p className="ecard-note">
                    <b>Your roles on the day:</b>{' '}
                    {d.jobs.length === 0
                      ? 'None yet — you can add them after agreeing'
                      : d.jobs.map((j) => j.job.title).join(', ')}
                  </p>

                  <Bar drive={d} />

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
                    <div className="ecard-actions">
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
                    <p className="ecard-note">You said: {d.declineReason}</p>
                  )}
                </section>
              </li>
            );
          })}
        </ul>
      )}
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
        // One column: this list sits inside an invitation card, narrower than the grid's minimum.
        <ul className="ecards" style={{ gridTemplateColumns: '1fr' }}>
          {data.students.map((s) => (
            <li key={s.id}>
              <div className="ecard is-static">
                <b className="ecard-title">{s.name}</b>
                <span className="ecard-sub">{s.email}</span>
                <dl className="ecard-facts">
                  <div>
                    <dt>Branch</dt>
                    <dd>{s.branch ?? s.course ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>CGPA</dt>
                    <dd>{s.cgpa ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Backlogs</dt>
                    <dd>{s.backlogs ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Graduating</dt>
                    <dd>{s.graduationYear ?? '—'}</dd>
                  </div>
                </dl>
              </div>
            </li>
          ))}
        </ul>
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
 * The bar, as the roles state it.
 *
 * This was a form: three boxes that wrote a bar onto the drive, so a
 * recruiter could pull CGPA down to 6.5 and watch the count move. The
 * numbers were real and the trade was worth showing - but they gated
 * nothing. A student was admitted or refused by the role's criteria, in
 * jobs/visibility.ts, and nothing made the two agree.
 *
 * So the bar is read here and set where it binds: the role editor. The
 * counts underneath now move with the rule that will actually be applied,
 * which is the only version of this screen that was ever telling the truth.
 */
function Bar({ drive: d }: { drive: Drive }) {
  const bars = barsOf(d);

  if (bars.length === 0) {
    return (
      <p className="drive-bar muted">
        No roles on this drive yet, so there is no bar and nothing to count against. Add one under{' '}
        <Link to="/company/jobs">your roles</Link>, and the numbers below narrow to it.
      </p>
    );
  }

  return (
    <div className="drive-bar">
      <p className="drive-bar-head">
        <b>Your bar</b> — stated by each role, and the same rule that decides who may
        apply. Change it in <Link to="/company/jobs">the role</Link>.
      </p>
      <ul className="drive-bars">
        {bars.map((b) => (
          <li key={b.title}>
            <b>{b.title}</b> — {b.bar}
          </li>
        ))}
      </ul>
    </div>
  );
}
