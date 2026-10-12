import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { signupApi } from '../../api/signup';
import {
  companyAppApi,
  STATUS_LABEL,
  type CompanySim,
  type CompanySimRow,
  type SimInput,
  type SimLevel,
  type TaskDraft,
} from '../../api/companyApp';
import Frame from './Frame';

const LEVELS: { key: SimLevel; label: string }[] = [
  { key: 'BEGINNER', label: 'Beginner' },
  { key: 'INTERMEDIATE', label: 'Intermediate' },
  { key: 'ADVANCED', label: 'Advanced' },
];

const message = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

/** Every simulation the company has written, newest change first. */
export function CompanySimulationList() {
  const [rows, setRows] = useState<CompanySimRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    companyAppApi
      .simulations()
      .then(setRows)
      .catch((e) => setError(message(e, 'Could not load your simulations.')));
  }, []);

  return (
    <Frame>
      <section className="sa-hero is-short">
        <div className="sa-wrap sa-ov-head">
          <div>
            <p className="sa-eyebrow">Simulations</p>
            <h1>
              Real work, <span className="sa-mark">in short tasks</span>
            </h1>
            <p className="sa-lede">Write them here, send them to Apli.ai to check, and students can start once they are live.</p>
          </div>
          <Link to="/company/simulations/new" className="sa-btn">
            New simulation <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <div className="sa-wrap sa-body">
        {error && <p className="sa-alert">{error}</p>}
        {!rows && !error && <p className="sa-loading">Loading…</p>}
        {rows && rows.length === 0 && (
          <div className="sa-empty ca-start">
            <b>No simulations yet</b>
            <span>Think of a real problem from a week in the job, and split it into two to six tasks.</span>
            <Link to="/company/simulations/new" className="sa-btn">
              Write the first one
            </Link>
          </div>
        )}
        {rows && rows.length > 0 && (
          <div className="ca-table-wrap">
            <table className="ca-table">
              <thead>
                <tr>
                  <th>Simulation</th>
                  <th>Status</th>
                  <th>Tasks</th>
                  <th>Working</th>
                  <th>To review</th>
                  <th>Approved</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link to={`/company/simulations/${s.id}`} className="ca-table-title">
                        {s.title}
                      </Link>
                      <span className="ca-table-sub">
                        {s.field} · {s.hours} hrs
                        {s.status === 'CHANGES_ASKED' && s.reviewNote ? ` · Apli.ai: ${s.reviewNote}` : ''}
                      </span>
                    </td>
                    <td>
                      <span className={`ca-chip is-${s.status.toLowerCase()}`}>{STATUS_LABEL[s.status]}</span>
                    </td>
                    <td>{s.tasks}</td>
                    <td>{s.students.working}</td>
                    <td>{s.students.toReview ? <Link to="/company/reviews">{s.students.toReview}</Link> : 0}</td>
                    <td>{s.students.verified}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Frame>
  );
}
