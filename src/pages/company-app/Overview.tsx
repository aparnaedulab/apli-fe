import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { companyAppApi, STATUS_LABEL, type CompanyOverview, type CompanySimRow } from '../../api/companyApp';
import { CompanyTile } from '../student-app/Shell';
import Frame from './Frame';

/**
 * The company overview: where the company stands with Apli.ai, four numbers
 * on its simulations and students, what is waiting for it, and its
 * simulations at a glance.
 */
export default function Overview() {
  const [data, setData] = useState<CompanyOverview | null>(null);
  const [sims, setSims] = useState<CompanySimRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([companyAppApi.overview(), companyAppApi.simulations()])
      .then(([o, s]) => {
        setData(o);
        setSims(s);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load your overview.'));
  }, []);

  const verified = data?.company.status === 'VERIFIED';

  return (
    <Frame>
      <section className="sa-hero is-overview">
        <div className="sa-wrap sa-ov-head">
          <div className="ca-who">
            {data && <CompanyTile company={data.company} big />}
            <div>
              <p className="sa-eyebrow">Company</p>
              <h1>{data?.company.name ?? 'Your company'}</h1>
              <p className="sa-lede">
                {!data
                  ? 'Loading…'
                  : verified
                    ? 'Write work simulations, review what students hand in, and meet the ones who share their work with you.'
                    : 'Apli.ai is checking your company. You can write simulations now; they go live once you are verified.'}
              </p>
            </div>
          </div>
          <Link to="/company/simulations/new" className="sa-btn">
            New simulation <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <div className="sa-wrap sa-body">
        {error && <p className="sa-alert">{error}</p>}
        {!data && !error && <p className="sa-loading">Loading…</p>}
        {data && sims && (
          <>
            {!verified && (
              <p className="ca-banner">
                <b>Your company is {data.company.status === 'PENDING' ? 'waiting to be verified' : data.company.status.toLowerCase()}.</b>{' '}
                Apli.ai checks every company before students see its simulations. Drafts are saved in the meantime.
              </p>
            )}

            <ul className="sa-kpis">
              <li className="sa-kpi is-blue">
                <b>{data.simulations.live}</b>
                <span className="sa-kpi-label">Live simulations</span>
                <span className="sa-kpi-hint">
                  {data.simulations.submitted ? `${data.simulations.submitted} with Apli.ai to check` : 'Open to every student'}
                </span>
              </li>
              <li className="sa-kpi is-violet">
                <b>{data.students.working}</b>
                <span className="sa-kpi-label">Students working</span>
                <span className="sa-kpi-hint">On your simulations now</span>
              </li>
              <li className="sa-kpi is-orange">
                <b>{data.students.toReview}</b>
                <span className="sa-kpi-label">Waiting for your review</span>
                <span className="sa-kpi-hint">{data.students.verified} approved so far</span>
              </li>
              <li className="sa-kpi is-green">
                <b>{data.students.sharedWithYou}</b>
                <span className="sa-kpi-label">Shared with you</span>
                <span className="sa-kpi-hint">Students who chose to show you their work</span>
              </li>
            </ul>

            <div className="sa-layout is-overview">
              <div className="sa-main-col">
                <section className="sa-block">
                  <div className="sa-block-head">
                    <div>
                      <h2>Your simulations</h2>
                      <p>Drafts, those with Apli.ai, and the ones students are doing.</p>
                    </div>
                    <Link to="/company/simulations" className="sa-link">
                      All simulations <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                  {sims.length === 0 ? (
                    <div className="sa-empty ca-start">
                      <b>Write your first simulation</b>
                      <span>A few short tasks from a real week in the job. Most take students three to five hours.</span>
                      <Link to="/company/simulations/new" className="sa-btn">
                        Start writing
                      </Link>
                    </div>
                  ) : (
                    <ul className="ca-simlist">
                      {sims.slice(0, 5).map((s) => (
                        <li key={s.id}>
                          <Link to={`/company/simulations/${s.id}`} className="ca-simlist-title">
                            {s.title}
                          </Link>
                          <span className={`ca-chip is-${s.status.toLowerCase()}`}>{STATUS_LABEL[s.status]}</span>
                          <span className="ca-simlist-meta">
                            {s.field} · {s.tasks} task{s.tasks === 1 ? '' : 's'}
                          </span>
                          <span className="ca-simlist-meta">
                            {s.status === 'LIVE' || s.status === 'RETIRED'
                              ? `${s.students.working} working · ${s.students.verified} approved`
                              : s.status === 'CHANGES_ASKED'
                                ? 'Apli.ai asked for changes'
                                : s.status === 'SUBMITTED'
                                  ? 'Being checked'
                                  : 'Not sent yet'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              <aside className="sa-aside">
                <section className="sa-panel is-white">
                  <div className="sa-panel-head">
                    <h2>Waiting for you</h2>
                    {data.students.toReview > 0 && (
                      <Link to="/company/reviews" className="sa-link is-small">
                        Review
                      </Link>
                    )}
                  </div>
                  {data.waiting.length === 0 ? (
                    <p className="sa-panel-empty">No student work waiting. Hand-ins on your simulations appear here.</p>
                  ) : (
                    <ul className="ca-waiting">
                      {data.waiting.map((w) => (
                        <li key={w.runId}>
                          <Link to="/company/reviews">
                            <b>{w.student}</b>
                            <span>{w.simulation}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="sa-panel is-white">
                  <h2>How it works</h2>
                  <ol className="sa-how">
                    <li>Write a simulation and its tasks</li>
                    <li>Send it to Apli.ai to check</li>
                    <li>Students do it and explain their work</li>
                    <li>You approve or ask for changes</li>
                    <li>Students may share verified work with you</li>
                  </ol>
                </section>
              </aside>
            </div>
          </>
        )}
      </div>
    </Frame>
  );
}
