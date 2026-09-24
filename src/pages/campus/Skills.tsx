import { useCallback, useEffect, useState } from 'react';
import CampusLayout from './CampusLayout';
import { ApiError } from '../../api/client';
import { insightsApi, type InsightScope, type SkillHeatmap } from '../../api/insights';
import { useAuth } from '../../auth/AuthContext';
import './Skills.css';

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v)}%`);

/** Coverage as a colour: red where few students have it, green where most do. */
function heat(v: number | null): string {
  if (v === null) return 'var(--paper-2)';
  // Hue 0 (red) → 140 (green); pale enough that the number on it stays readable.
  const hue = Math.round((Math.min(100, Math.max(0, v)) / 100) * 140);
  return `hsl(${hue} 70% 88%)`;
}

const branchLabel = (b: { course: string | null; branch: string | null }) =>
  [b.course, b.branch].filter(Boolean).join(' · ') || 'Not stated';

/**
 * What recruiters asked for against what students have.
 *
 * The page leads with the answer a curriculum committee wants - the biggest
 * gaps - and only then the detail: the full table, a heatmap by branch, and
 * what is rising. Every number is a count or a share; no student is shown.
 */
export function SkillDemandView({ scope }: { scope: InsightScope }) {
  const { can, hasModule } = useAuth();
  const [year, setYear] = useState<number | undefined>(undefined);
  const [data, setData] = useState<SkillHeatmap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const enabled = hasModule('ops.skillHeatmap');
  const allowed = can('report:read');

  const load = useCallback(
    (y?: number) => {
      setLoading(true);
      setError(null);
      insightsApi
        .skills(scope, y)
        .then(setData)
        .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load skill demand.'))
        .finally(() => setLoading(false));
    },
    [scope],
  );

  useEffect(() => {
    if (enabled && allowed) load(year);
  }, [enabled, allowed, load, year]);

  if (!enabled) {
    return (
      <div className="empty">
        <h2>Skill demand is not switched on</h2>
        <p>The skill-demand heatmap is part of the Complete plan. Ask the platform team to switch it on.</p>
      </div>
    );
  }
  if (!allowed) {
    return (
      <div className="empty">
        <h2>Your role cannot see this</h2>
        <p>Ask your placement officer or institution admin for the “See placement statistics” permission.</p>
      </div>
    );
  }

  const top = data?.skills.slice(0, 5) ?? [];

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">{scope === 'college' ? 'Placement cell' : 'Institution'} · Skills</p>
          <h1>What recruiters asked for</h1>
          <p className="page-lede">
            {data?.year
              ? `${data.scope.name} · ${data.year} · ${data.rolesAnalysed} role${data.rolesAnalysed === 1 ? '' : 's'} against ${data.pool} student${data.pool === 1 ? '' : 's'}`
              : 'Skills on the roles posted to your drives, against how many of your students list them.'}
          </p>
        </div>
        {data && data.years.length > 0 && (
          <select
            className="sk-year"
            aria-label="Year"
            value={data.year ?? ''}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {data.years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}
      </header>

      {error && <p className="alert alert-error">{error}</p>}
      {loading && !data && <p className="muted">Loading…</p>}

      {data && data.year === null && (
        <div className="empty">
          <h2>No drives yet</h2>
          <p>Once companies post roles into your drives, the skills they ask for show up here.</p>
        </div>
      )}

      {data && data.year !== null && data.skills.length === 0 && (
        <div className="empty">
          <h2>No skills listed on {data.year}’s roles</h2>
          <p>
            {data.rolesAnalysed} role{data.rolesAnalysed === 1 ? ' was' : 's were'} posted, but none named the skills
            they wanted. Encourage recruiters to add them when they post.
          </p>
        </div>
      )}

      {data && data.skills.length > 0 && (
        <>
          <section className="card">
            <h2>Biggest gaps</h2>
            <p className="muted">Asked for by many roles, listed by few students. The place to start a workshop.</p>
            <ul className="sk-gaps">
              {top.map((s) => (
                <li key={s.skillId}>
                  <span className="sk-gap-name">
                    <strong>{s.skill}</strong>
                    <small>
                      {s.roles} role{s.roles === 1 ? '' : 's'} · {s.required} required
                    </small>
                  </span>
                  <span className="sk-bars" aria-label={`Demand ${pct(s.demandPct)}, coverage ${pct(s.coveragePct)}`}>
                    <span className="sk-bar">
                      <span className="sk-bar-demand" style={{ width: `${s.demandPct}%` }} />
                    </span>
                    <span className="sk-bar">
                      <span className="sk-bar-cover" style={{ width: `${s.coveragePct ?? 0}%` }} />
                    </span>
                  </span>
                  <span className="sk-gap-nums">
                    <span>{pct(s.demandPct)} of roles</span>
                    <span>{pct(s.coveragePct)} of students</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="sk-legend">
              <span className="sk-key sk-key-demand" /> share of roles asking · <span className="sk-key sk-key-cover" /> share of
              students who list it
            </p>
          </section>

          {data.grid.branches.length > 0 && (
            <section className="card">
              <h2>By branch</h2>
              <p className="muted">
                The most asked-for skills, and the share of each branch’s students who list them. Red is few, green is
                most.
              </p>
              <div className="table-wrap">
                <table className="sk-grid">
                  <thead>
                    <tr>
                      <th scope="col">Skill</th>
                      {data.grid.branches.map((b) => (
                        <th key={b.key} scope="col" title={`${b.students} students`}>
                          {branchLabel(b)}
                          <small>{b.students}</small>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.grid.rows.map((r) => (
                      <tr key={r.skillId}>
                        <th scope="row">{r.skill}</th>
                        {r.cells.map((v, i) => (
                          <td key={i} style={{ background: heat(v) }}>
                            {pct(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <div className="sk-two">
            <section className="card">
              <h2>Rising since last year</h2>
              {data.rising.length === 0 ? (
                <p className="muted">Nothing asked for more often than last year.</p>
              ) : (
                <ul className="sk-rising">
                  {data.rising.map((r) => (
                    <li key={r.skill}>
                      <strong>{r.skill}</strong>
                      <span>
                        {r.before} → {r.now} roles <em>+{r.change}</em>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {data.perCollege && (
              <section className="card">
                <h2>By college</h2>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>College</th>
                      <th>Roles</th>
                      <th>Students</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.perCollege.map((c) => (
                      <tr key={c.collegeId}>
                        <td>{c.name}</td>
                        <td>{c.roles}</td>
                        <td>{c.students}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </div>

          <section className="card">
            <h2>Every skill asked for</h2>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Skill</th>
                    <th>Roles</th>
                    <th>Required</th>
                    <th>Nice to have</th>
                    <th>Openings</th>
                    <th>Students who list it</th>
                    <th>Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {data.skills.map((s) => (
                    <tr key={s.skillId}>
                      <td>{s.skill}</td>
                      <td>{s.roles}</td>
                      <td>{s.required}</td>
                      <td>{s.niceToHave}</td>
                      <td>{s.openings}</td>
                      <td>
                        {s.students} · {pct(s.coveragePct)}
                      </td>
                      <td>
                        <span className="sk-gap-score" style={{ background: heat(100 - s.gap) }}>
                          {s.gap}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {data && (
        <section className="card sk-notes">
          <h2>How to read this</h2>
          <ul>
            {data.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
            {data.poolBasis === 'passing year' && (
              <li>No batches are attached to this year’s drives, so students are counted by their passing year instead.</li>
            )}
          </ul>
        </section>
      )}
    </>
  );
}

/** The placement cell's page: its own college. */
export default function Skills() {
  return (
    <CampusLayout>
      <SkillDemandView scope="college" />
    </CampusLayout>
  );
}
