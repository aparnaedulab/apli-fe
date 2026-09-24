import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { api, ApiError } from '../../api/client';
import './Pulse.css';

/**
 * What is going on - the operations and business read on the whole platform.
 *
 * The Overview page answers "how many of each thing exist". This one answers
 * the question an operator actually has at nine on a Monday: is the season
 * moving, and if it is not, who is holding it up. Four hundred applications is
 * good news or bad news entirely depending on whether anybody is answering
 * them, so almost nothing here is a bare total:
 *
 *   every pulse figure carries the window before it, because a number with
 *   nothing to compare it to cannot be acted on;
 *
 *   the funnel carries the drop between each stage, because that is where a
 *   season is lost and a column of counts hides it;
 *
 *   both sides are measured on answering - companies on how long they take to
 *   respond to an application, students on how long they take to answer an
 *   offer - because that is the promise the product makes and the only one it
 *   can be held to.
 */

interface Trend {
  now: number;
  before: number;
}

interface Overview {
  window: { days: number; from: string; until: string };
  pulse: {
    students: Trend;
    applications: Trend;
    jobsPublished: Trend;
    offers: Trend;
    accepted: Trend;
    events: Trend;
    posts: Trend;
  };
  funnel: { status: string; count: number }[];
  companies: {
    targetDays: number;
    medianFirstResponseDays: number | null;
    answeredWithinTargetPct: number | null;
    measured: number;
    overdueNow: number;
    stalled: { id: string; company: string; role: string; waitingDays: number }[];
  };
  students: {
    medianOfferAnswerDays: number | null;
    measured: number;
    offersPending: number;
    students: number;
    frozen: number;
    frozenPct: number | null;
    appliedPct: number | null;
  };
  colleges: {
    id: string;
    name: string;
    students: number;
    frozen: number;
    applications: number;
    offers: number;
  }[];
  recruiters: { id: string; name: string; jobs: number; applications: number; offers: number }[];
  activity: { id: string; at: string; kind: string; what: string; where: string | null }[];
}

const WINDOWS = [7, 30, 90, 365];

const label = (s: string) => s.replace(/_/g, ' ').toLowerCase();

export default function Pulse() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    api
      .get<Overview>(`/admin/overview?days=${days}`)
      .then((r) => {
        if (live) {
          setData(r);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (live) setError(err instanceof ApiError ? err.message : 'Could not load the overview.');
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [days]);

  return (
    <AdminLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Super admin</p>
          <h1>What is going on</h1>
          <p className="page-lede">
            Every college, company and student on the platform, read as movement rather than
            totals - what changed, who is answering, and who is holding things up.
          </p>
        </div>
        <div className="pulse-window" role="group" aria-label="Window">
          {WINDOWS.map((d) => (
            <button
              key={d}
              type="button"
              className={`pulse-window-opt ${days === d ? 'is-on' : ''}`}
              aria-pressed={days === d}
              onClick={() => setDays(d)}
            >
              {d === 365 ? '1 year' : `${d} days`}
            </button>
          ))}
        </div>
      </header>

      {error && <p className="alert alert-error">{error}</p>}
      {loading && !data && <p className="muted">Reading the last {days} days…</p>}

      {data && (
        <div className={loading ? 'is-reloading' : ''}>
          <section className="stat-group">
            <h2>The last {data.window.days} days</h2>
            <div className="pulse-row">
              <Pulse1 label="New students" t={data.pulse.students} to="/admin/students" />
              <Pulse1 label="Applications" t={data.pulse.applications} to="/admin/applications" />
              <Pulse1 label="Roles published" t={data.pulse.jobsPublished} to="/admin/jobs" />
              <Pulse1 label="Offers made" t={data.pulse.offers} />
              <Pulse1 label="Offers accepted" t={data.pulse.accepted} />
              <Pulse1 label="Campus events" t={data.pulse.events} />
              <Pulse1 label="Company posts" t={data.pulse.posts} />
            </div>
            <p className="pulse-foot muted">
              Each figure is compared with the {data.window.days} days before it.
            </p>
          </section>

          {/* Responsiveness: the two sides of the promise. */}
          <div className="pulse-pair">
            <section className="card">
              <div className="card-head">
                <h2>Are companies answering?</h2>
              </div>
              {data.companies.measured === 0 ? (
                <p className="muted">No applications have been answered yet.</p>
              ) : (
                <>
                  <div className="big-row">
                    <Big
                      value={
                        data.companies.medianFirstResponseDays === null
                          ? '–'
                          : `${data.companies.medianFirstResponseDays}d`
                      }
                      label="median to first response"
                    />
                    <Big
                      value={
                        data.companies.answeredWithinTargetPct === null
                          ? '–'
                          : `${data.companies.answeredWithinTargetPct}%`
                      }
                      label={`answered within ${data.companies.targetDays} days`}
                      tone={
                        (data.companies.answeredWithinTargetPct ?? 100) < 70 ? 'bad' : 'good'
                      }
                    />
                    <Big
                      value={String(data.companies.overdueNow)}
                      label="overdue right now"
                      tone={data.companies.overdueNow > 0 ? 'bad' : 'good'}
                    />
                  </div>
                  <p className="muted pulse-foot">
                    Measured from the application to the first move away from “applied” - the only
                    moment a student experiences as somebody having looked. Over{' '}
                    {data.companies.measured} applications.
                  </p>
                </>
              )}

              {data.companies.stalled.length > 0 && (
                <>
                  <h3 className="sub-head">Waiting longest</h3>
                  <ul className="stall-list">
                    {data.companies.stalled.map((s) => (
                      <li key={s.id}>
                        <span className="stall-who">
                          <b>{s.company}</b>
                          <small>{s.role}</small>
                        </span>
                        <span className="stall-days">{s.waitingDays}d</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            <section className="card">
              <div className="card-head">
                <h2>Are students answering?</h2>
              </div>
              <div className="big-row">
                <Big
                  value={
                    data.students.medianOfferAnswerDays === null
                      ? '–'
                      : `${data.students.medianOfferAnswerDays}d`
                  }
                  label="median to answer an offer"
                />
                <Big
                  value={String(data.students.offersPending)}
                  label="offers still unanswered"
                  tone={data.students.offersPending > 0 ? 'watch' : 'good'}
                />
              </div>
              <div className="big-row">
                <Big
                  value={data.students.frozenPct === null ? '–' : `${data.students.frozenPct}%`}
                  label="of the roll verified"
                  tone={(data.students.frozenPct ?? 0) < 60 ? 'bad' : 'good'}
                />
                <Big
                  value={data.students.appliedPct === null ? '–' : `${data.students.appliedPct}%`}
                  label="have applied to something"
                  tone={(data.students.appliedPct ?? 0) < 50 ? 'watch' : 'good'}
                />
              </div>
              <p className="muted pulse-foot">
                A student who is not verified cannot apply at all, so the first of these caps the
                second. {data.students.frozen} of {data.students.students} students are frozen.
              </p>
            </section>
          </div>

          {/* The funnel, with the drop that a column of counts hides. */}
          <section className="card">
            <div className="card-head">
              <h2>Where the season is being lost</h2>
              <Link to="/admin/applications" className="link-btn">
                See every application
              </Link>
            </div>
            <div className="funnel funnel-drop">
              {data.funnel.map((step, i) => {
                const prev = i > 0 ? data.funnel[i - 1]!.count : null;
                const drop = prev && prev > 0 ? Math.round(((prev - step.count) / prev) * 100) : null;
                return (
                  <div key={step.status} className="funnel-step">
                    <span className="funnel-value">{step.count}</span>
                    <span className="funnel-label">{label(step.status)}</span>
                    {drop !== null && drop > 0 && <span className="funnel-drop-pct">−{drop}%</span>}
                  </div>
                );
              })}
            </div>
            <p className="muted pulse-foot">
              How many applications have <em>ever</em> reached each stage, read from their status
              history - not where they are sitting now. Current status cannot answer this: an
              application at “hired” is no longer counted at “applied”, so a column of live
              counts shows no funnel at all.
            </p>
          </section>

          <div className="pulse-pair">
            <Table
              title="Colleges"
              to="/admin/colleges"
              head={['College', 'Students', 'Verified', 'Apps', 'Offers']}
              rows={data.colleges.map((c) => ({
                key: c.id,
                to: `/admin/colleges/${c.id}`,
                cells: [
                  c.name,
                  String(c.students),
                  String(c.frozen),
                  String(c.applications),
                  String(c.offers),
                ],
                quiet: c.applications === 0,
              }))}
              empty="No colleges yet."
              note="Apps are applications. A college with students but none of them is the one to ring."
            />

            <Table
              title="Recruiters"
              to="/admin/companies"
              head={['Company', 'Roles', 'Apps', 'Offers']}
              rows={data.recruiters.map((r) => ({
                key: r.id,
                to: `/admin/companies/${r.id}`,
                cells: [r.name, String(r.jobs), String(r.applications), String(r.offers)],
                quiet: r.applications === 0,
              }))}
              empty="No roles have been posted yet."
              note="Applications received against roles posted to this institution."
            />
          </div>

          <section className="card">
            <div className="card-head">
              <h2>Latest</h2>
            </div>
            {data.activity.length === 0 ? (
              <p className="muted">Nothing has moved in this window.</p>
            ) : (
              <ul className="feed">
                {data.activity.map((a) => (
                  <li key={`${a.kind}-${a.id}`}>
                    <span className={`feed-kind is-${a.kind.toLowerCase()}`}>{label(a.kind)}</span>
                    <span className="feed-what">{a.what}</span>
                    {a.where && <span className="feed-where">{a.where}</span>}
                    <time dateTime={a.at}>{new Date(a.at).toLocaleDateString()}</time>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </AdminLayout>
  );
}

/** One pulse figure, with the direction it is moving. */
function Pulse1({ label: text, t, to }: { label: string; t: Trend; to?: string }) {
  const delta = t.now - t.before;
  const pct = t.before > 0 ? Math.round((delta / t.before) * 100) : null;
  const dir = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';

  const body = (
    <>
      <p className="stat-value">{t.now}</p>
      <p className="stat-label">{text}</p>
      <p className={`pulse-delta is-${dir}`}>
        {dir === 'flat'
          ? 'no change'
          : `${delta > 0 ? '+' : '−'}${Math.abs(delta)}${pct === null ? '' : ` · ${Math.abs(pct)}%`}`}
      </p>
    </>
  );

  return to ? (
    <Link to={to} className="stat is-link">
      {body}
    </Link>
  ) : (
    <div className="stat">{body}</div>
  );
}

function Big({
  value,
  label: text,
  tone,
}: {
  value: string;
  label: string;
  tone?: 'good' | 'watch' | 'bad';
}) {
  return (
    <div className={`big ${tone ? `is-${tone}` : ''}`}>
      <p className="big-value">{value}</p>
      <p className="big-label">{text}</p>
    </div>
  );
}

function Table({
  title,
  to,
  head,
  rows,
  empty,
  note,
}: {
  title: string;
  to: string;
  head: string[];
  rows: { key: string; to: string; cells: string[]; quiet?: boolean }[];
  empty: string;
  note: string;
}) {
  return (
    <section className="card">
      <div className="card-head">
        <h2>{title}</h2>
        <Link to={to} className="link-btn">
          See all
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <table className="league">
          <thead>
            <tr>
              {head.map((h, i) => (
                <th key={h} className={i === 0 ? '' : 'num'}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className={r.quiet ? 'is-quiet' : ''}>
                {r.cells.map((c, i) => (
                  <td key={i} className={i === 0 ? '' : 'num'}>
                    {i === 0 ? <Link to={r.to}>{c}</Link> : c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted pulse-foot">{note}</p>
    </section>
  );
}
