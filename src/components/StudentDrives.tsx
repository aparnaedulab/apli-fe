import { useEffect, useState } from 'react';
import { studentDrivesApi, type StudentDrive } from '../api/drives';
import './StudentDrives.css';

/**
 * Drives coming to campus, and putting your name down for one.
 *
 * Opting in is not applying. It is the sheet that goes round before a company
 * visits - it tells the cell how many chairs to put out, and it is how you
 * hear about the day. Applying still happens against the role, through the
 * same route as everything else, which is why the roles are listed here as
 * links rather than as a second apply button that would mean something subtly
 * different.
 *
 * Renders nothing when there is nothing on, rather than an empty box.
 */
export default function StudentDrives() {
  const [drives, setDrives] = useState<StudentDrive[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    studentDrivesApi
      .list()
      .then((r) => setDrives(r.drives))
      .catch(() => setDrives([]));
  }, []);

  if (!drives || drives.length === 0) return null;

  async function toggle(d: StudentDrive) {
    setBusy(d.id);
    try {
      const r = d.registered
        ? await studentDrivesApi.withdraw(d.id)
        : await studentDrivesApi.register(d.id);
      setDrives(r.drives);
    } catch {
      // Left as it was. The list reloads on the next visit.
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="sd" aria-label="Drives coming to campus">
      <h2 className="sd-head">
        Coming to campus
        <span className="sd-count">{drives.length}</span>
      </h2>

      <ul className="sd-list">
        {drives.map((d) => (
          <li key={d.id} className="sd-item">
            <div className="sd-main">
              <h3>{d.company}</h3>
              <p className="sd-when">
                {d.scheduledAt
                  ? new Date(d.scheduledAt).toLocaleString(undefined, {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Date to be confirmed'}
                {d.addressLine && ` · ${d.addressLine}`}
              </p>
              {d.pitch && <p className="sd-pitch">{d.pitch}</p>}
              {d.roles.length > 0 && (
                <p className="sd-roles">
                  {d.roles.map((r) => r.title).join(' · ')}
                </p>
              )}
            </div>

            <div className="sd-act">
              {d.registered && <span className="sd-in">Name is down</span>}
              <button
                type="button"
                className={`btn btn-sm ${d.registered ? 'btn-ghost' : 'btn-primary'}`}
                disabled={!d.canRegister || busy === d.id}
                onClick={() => toggle(d)}
              >
                {busy === d.id
                  ? '…'
                  : d.registered
                    ? 'Take my name off'
                    : 'Put my name down'}
              </button>
              {!d.canRegister && (
                <span className="sd-blocked">
                  Your college has not verified your record yet.
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
