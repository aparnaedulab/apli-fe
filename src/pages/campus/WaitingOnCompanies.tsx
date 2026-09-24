import { useEffect, useState } from 'react';
import { trackerApi, type CollegeOverdue } from '../../api/tracker';
import { useAuth } from '../../auth/AuthContext';

/**
 * Companies keeping this college's students waiting past the response time.
 *
 * On the dashboard because it is something a placement officer acts on - a
 * phone call to a recruiter - rather than a report to read. Nothing shows at
 * all when nobody is overdue: an empty warning is noise.
 */
export default function WaitingOnCompanies() {
  const { hasModule, can } = useAuth();
  const [data, setData] = useState<CollegeOverdue | null>(null);
  const on = hasModule('trust.tracker') && can('application:read');

  useEffect(() => {
    if (!on) return;
    trackerApi
      .college()
      .then(setData)
      .catch(() => setData(null));
  }, [on]);

  if (!on || !data || data.total === 0) return null;

  return (
    <section className="card waiting-card">
      <h2>Companies keeping your students waiting</h2>
      <p className="page-lede">
        {data.total} application{data.total === 1 ? ' has' : 's have'} had no answer for longer than your response time. A
        reminder from you usually moves them.
      </p>
      <ul className="waiting-list">
        {data.companies.map((c) => (
          <li key={c.companyId}>
            <strong>{c.name}</strong>
            <span>
              {c.overdue} waiting · oldest {c.oldestDays} day{c.oldestDays === 1 ? '' : 's'}
            </span>
            <small>{c.jobs.map((j) => `${j.title} (${j.overdue})`).join(' · ')}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}
