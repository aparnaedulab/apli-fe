import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { studentActivityApi, type PlatformStats } from '../../api/studentActivity';
import {
  InterviewsList,
  OffersList,
  SimulationsList,
  StatStrip,
  StudentsList,
  WorkList,
} from '../shared/StudentActivity';
import ConsoleHeader from './ConsoleHeader';
import './Platform.css';

const TABS = [
  { key: 'students', label: 'Students' },
  { key: 'work', label: 'Student work' },
  { key: 'offers', label: 'Internship offers' },
  { key: 'interviews', label: 'Interviews' },
  { key: 'simulations', label: 'Simulations' },
] as const;
type Tab = (typeof TABS)[number]['key'];

/**
 * Every student on Apli.ai and what they are doing in the student app.
 *
 * An institution's admins see their own students. Students whose college is
 * not on Apli.ai yet signed up on their own and belong to no institution -
 * this page is the only place anybody sees them.
 */
export default function ConsoleStudents() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.key === params.get('tab'))?.key ?? 'students') as Tab;
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    studentActivityApi
      .platformStats()
      .then(setStats)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load the numbers.'));
  }, []);

  const base = '/platform/activity' as const;

  return (
    <div className="console">
      <ConsoleHeader />
      <main className="console-main">
        <section className="console-hero">
          <div>
            <p className="eyebrow">Students</p>
            <h1>Every student, and what they are doing.</h1>
            <p className="console-lede">
              Across every institution, and those who signed up on their own because their college is not on Apli.ai yet.
            </p>
          </div>
        </section>

        {error && <p className="alert alert-error">{error}</p>}
        {stats && (
          <StatStrip
            items={[
              { label: 'Students', value: stats.students, hint: `${stats.newStudents} joined in the last 30 days` },
              { label: 'Signed up on their own', value: stats.unattachedStudents, hint: 'Not at a partner institution' },
              { label: 'Simulations started', value: stats.simulations.started, hint: `${stats.simulations.inProgress} in progress` },
              { label: 'Waiting for review', value: stats.simulations.inReview },
              { label: 'Certified', value: stats.simulations.certified },
              { label: 'Internship offers', value: stats.offers.sent, hint: `${stats.offers.accepted} accepted` },
              { label: 'Interviews', value: stats.interviews.total, hint: `${stats.interviews.open} in progress` },
            ]}
          />
        )}

        <div className="console-bar">
          <div className="seg" role="tablist" aria-label="Student activity">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                className={`seg-opt ${tab === t.key ? 'is-on' : ''}`}
                onClick={() => setParams(t.key === 'students' ? {} : { tab: t.key })}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Keyed by tab so each list starts with its own search and filters. */}
        <div key={tab}>
          {tab === 'students' && <StudentsList base={base} bare />}
          {tab === 'work' && <WorkList base={base} bare />}
          {tab === 'offers' && <OffersList base={base} bare />}
          {tab === 'interviews' && <InterviewsList base={base} bare />}
          {tab === 'simulations' && <SimulationsList base={base} bare />}
        </div>
      </main>
    </div>
  );
}
