import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from './StudentLayout';
import { ApiError } from '../../api/client';
import { EVENT_LABEL, fmtDate, fmtDateTime, opportunitiesApi, type StudentWeek } from '../../api/opportunities';
import { useAuth } from '../../auth/AuthContext';
import './Opportunities.css';

type Ev = StudentWeek['events'][number];

/**
 * Events: your placement cell's own sessions, and the weeks companies spend
 * on your campus.
 *
 * Two ways onto a list, and they are equal. You can put your own name down
 * for anything here; or somebody - the cell, or a company whose role you
 * applied to - asks you directly, and then it sits at the top of this page
 * until you answer. Nobody is ever added without being asked.
 *
 * Registering is free. A company is told how many are coming, never who; your
 * placement cell takes attendance on the day.
 */
export default function CampusWeeks() {
  const { hasModule } = useAuth();
  const on = hasModule('showcase.campusWeeks');
  const [weeks, setWeeks] = useState<StudentWeek[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!on) return;
    opportunitiesApi
      .studentWeeks()
      .then(setWeeks)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load events.'));
  }, [on]);

  async function answer(eventId: string, coming: boolean) {
    setBusy(eventId);
    setError(null);
    try {
      setWeeks(coming ? await opportunitiesApi.register(eventId) : await opportunitiesApi.unregister(eventId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not work.');
    } finally {
      setBusy(null);
    }
  }

  /** Invitations nobody has answered, newest events first. */
  const asked = useMemo(
    () =>
      (weeks ?? [])
        .flatMap((w) => w.events.map((e) => ({ w, e })))
        .filter(({ e }) => e.myStatus === 'INVITED' && !e.started)
        .sort((a, b) => new Date(a.e.startsAt).getTime() - new Date(b.e.startsAt).getTime()),
    [weeks],
  );

  return (
    <StudentLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Events</p>
          <h1>What is on at your campus</h1>
          <p className="page-lede">
            {on
              ? 'Preparation sessions and workshops your placement cell runs, and the weeks companies spend here. Put your name down for anything - it is free, and it helps them plan the room.'
              : 'Your institution has not switched this on yet.'}
          </p>
        </div>
      </header>

      {on && (
        <>
          {error && <p className="alert alert-error">{error}</p>}
          {!weeks && !error && <p className="muted">Loading…</p>}

          {asked.length > 0 && (
            <section className="ev-asked">
              <h2>
                You were invited to {asked.length} session{asked.length === 1 ? '' : 's'}
              </h2>
              <ul>
                {asked.map(({ w, e }) => (
                  <li key={e.id}>
                    <div>
                      <strong>{e.title}</strong>
                      <small>
                        {w.company?.name ?? 'Your placement cell'} · {fmtDateTime(e.startsAt)}
                        {e.where ? ` · ${e.where}` : ''}
                      </small>
                      {e.job && (
                        <small>
                          About <Link to={`/student/jobs/${e.job.id}`}>{e.job.title}</Link> · {e.job.company}
                        </small>
                      )}
                    </div>
                    <span className="ev-asked-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busy === e.id}
                        onClick={() => answer(e.id, true)}
                      >
                        I am coming
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={busy === e.id}
                        onClick={() => answer(e.id, false)}
                      >
                        Not this time
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {weeks && weeks.length === 0 && (
            <div className="empty">
              <h2>Nothing on yet.</h2>
              <p>
                You will get a notification when your placement cell puts on a session, or approves a company’s campus
                week.
              </p>
            </div>
          )}

          {weeks && weeks.length > 0 && (
            <div className="week-list">
              {weeks.map((w) => (
                <section key={w.id} className="card opp-card">
                  <div className="opp-top">
                    <div>
                      <h3>{w.title}</h3>
                      <span className="opp-company">
                        {w.company?.name ?? 'Your placement cell'} · {fmtDate(w.startDate)}
                        {w.startDate.slice(0, 10) !== w.endDate.slice(0, 10) ? ` to ${fmtDate(w.endDate)}` : ''}
                      </span>
                    </div>
                    {w.status === 'DONE' && <span className="pill pill-idle">Finished</span>}
                  </div>
                  {w.message && <p className="opp-brief">{w.message}</p>}
                  <ul className="week-events">
                    {w.events.map((e) => (
                      <EventRow key={e.id} e={e} busy={busy === e.id} onAnswer={answer} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </StudentLayout>
  );
}

function EventRow({
  e,
  busy,
  onAnswer,
}: {
  e: Ev;
  busy: boolean;
  onAnswer: (eventId: string, coming: boolean) => void;
}) {
  return (
    <li className="week-event">
      <span className="week-kind">{EVENT_LABEL[e.kind]}</span>
      <div>
        <strong>{e.title}</strong>
        <small>
          {fmtDateTime(e.startsAt)} · {e.durationMin} min{e.where ? ` · ${e.where}` : ''} · {e.registered} coming
        </small>
        {e.job && (
          <small>
            About <Link to={`/student/jobs/${e.job.id}`}>{e.job.title}</Link> · {e.job.company}
          </small>
        )}
        {e.myStatus === 'INVITED' && !e.started && <small className="ev-tag">You were invited</small>}
      </div>
      <div>
        {e.attended ? (
          <span className="pill pill-pass">Attended</span>
        ) : e.started ? (
          e.mine ? (
            <span className="pill pill-idle">You were coming</span>
          ) : null
        ) : e.myStatus === 'INVITED' ? (
          <span className="ev-asked-actions">
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => onAnswer(e.id, true)}>
              I am coming
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onAnswer(e.id, false)}>
              Not this time
            </button>
          </span>
        ) : (
          <button
            type="button"
            className={`btn btn-sm ${e.mine ? 'btn-ghost' : 'btn-secondary'}`}
            disabled={busy}
            onClick={() => onAnswer(e.id, !e.mine)}
          >
            {e.mine ? 'Cancel' : e.myStatus === 'DECLINED' ? 'Changed my mind' : 'Put my name down'}
          </button>
        )}
      </div>
    </li>
  );
}
