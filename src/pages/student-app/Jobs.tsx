import { Link } from 'react-router-dom';
import Shell from './Shell';

/** Jobs are the next part of the student app; until then, this says so plainly. */
export default function Jobs() {
  return (
    <Shell>
      <section className="sa-hero is-short">
        <div className="sa-wrap">
          <p className="sa-eyebrow">Jobs</p>
          <h1>
            Openings that <span className="sa-mark">match</span> your work
          </h1>
          <p className="sa-lede">Matched to the fields you picked and the simulations you finish.</p>
        </div>
      </section>
      <div className="sa-wrap sa-body">
        <section className="sa-panel sa-soon">
          <h2>Jobs open here soon</h2>
          <p>
            Every simulation you finish now counts towards them: companies will see which tasks you completed, not just a
            line on a résumé.
          </p>
          <Link to="/student/simulations" className="sa-btn">
            Find a simulation <span aria-hidden="true">→</span>
          </Link>
        </section>
      </div>
    </Shell>
  );
}
