import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from './StudentLayout';
import { iconFor } from './navIcons';
import { useAuth } from '../../auth/AuthContext';
import { studentJobsApi, type MyApplication } from '../../api/candidate';
import './PrepareHub.css';

/**
 * Prepare: every way to get ready, on one page.
 *
 * The tab used to open whichever practice tool happened to be switched on
 * first, so "Prepare" meant a different page at every institution and the
 * other tools were buried in a menu. This is one hub instead: a card per tool
 * the institution has turned on, and - when a round is actually coming up -
 * a nudge to practise for that one.
 *
 * None of it is marked and none of it is seen by recruiters, and the page
 * says so, because that is what makes a nervous student try it.
 */

interface Tool {
  to: string;
  label: string;
  /** The icon, by its menu label. */
  icon: string;
  what: string;
  /** Off unless the institution has this module; absent means always on. */
  module?: string;
}

const TOOLS: Tool[] = [
  {
    to: '/student/interview',
    label: 'Mock interview',
    icon: 'Mock interview',
    what: 'Answer real interview questions out loud and get feedback on what to improve.',
    module: 'dev.mockInterview',
  },
  {
    to: '/student/practice',
    label: 'Aptitude practice',
    icon: 'Aptitude practice',
    what: 'Timed quant, reasoning and verbal questions, like the online tests companies use.',
    module: 'dev.aptitude',
  },
  {
    to: '/student/gd',
    label: 'Group discussion',
    icon: 'Group discussion',
    what: 'Practise speaking up, building on others and summing up in a group round.',
    module: 'dev.gd',
  },
  {
    to: '/student/soft-skills',
    label: 'Soft skills',
    icon: 'Soft skills',
    what: 'Short exercises on communication, emails and working with a team.',
    module: 'dev.softSkills',
  },
  {
    to: '/student/prepare',
    label: 'Walk in ready',
    icon: 'Interviews',
    what: 'What to wear, interview etiquette, a checklist for the day, and a camera & mic check.',
    module: 'dev.presence',
  },
  {
    to: '/student/readiness',
    label: 'Readiness check',
    icon: 'Assessments',
    what: 'See how ready you are for placements, part by part, and what to work on first.',
    module: 'dev.readiness',
  },
  {
    to: '/student/guides',
    label: 'Guides',
    icon: 'Guides',
    what: 'Short reads on each kind of round, reading an offer, and what to expect.',
  },
  {
    to: '/student/counselling',
    label: 'Career counselling',
    icon: 'Career counselling',
    what: 'Book a conversation with a counsellor about your choices or your nerves.',
  },
  {
    to: '/student/events',
    label: 'Events',
    icon: 'Events',
    what: 'Campus weeks and company sessions you can sign up for.',
    module: 'showcase.campusWeeks',
  },
];

/** Which tool fits a round, by the round's type. */
function toolForRound(type: string | undefined): string {
  if (type === 'MCQ_TEST') return '/student/practice';
  if (type === 'GROUP_DISCUSSION') return '/student/gd';
  return '/student/interview';
}

const dayOf = (at: number) =>
  new Date(at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

export default function PrepareHub() {
  const { hasModule } = useAuth();
  const [apps, setApps] = useState<MyApplication[] | null>(null);

  useEffect(() => {
    studentJobsApi
      .applications()
      .then(setApps)
      .catch(() => setApps([]));
  }, []);

  const tools = useMemo(() => TOOLS.filter((t) => !t.module || hasModule(t.module)), [hasModule]);

  /** The next round they have actually been called to, and the tool that fits it. */
  const next = useMemo(() => {
    const now = Date.now();
    const rounds = (apps ?? [])
      .filter((a) => a.status === 'IN_ROUND')
      .map((a) => {
        const round = a.rounds.find((r) => r.id === a.currentRound?.id);
        const at = round?.scheduledAt ? new Date(round.scheduledAt).getTime() : null;
        return round ? { a, round, at } : null;
      })
      .filter((x): x is { a: MyApplication; round: MyApplication['rounds'][number]; at: number | null } => x !== null)
      .filter((x) => x.at === null || x.at > now)
      .sort((x, y) => (x.at ?? Infinity) - (y.at ?? Infinity));
    const first = rounds[0];
    if (!first) return null;
    const to = toolForRound(first.round.type);
    const tool = tools.find((t) => t.to === to) ?? tools.find((t) => t.to === '/student/guides');
    return tool ? { ...first, tool } : null;
  }, [apps, tools]);

  return (
    <StudentLayout>
      <div className="pr">
        <header className="pr-head">
          <h1>Prepare</h1>
          <p>Practise before the real thing. Nothing here is marked, and recruiters never see it.</p>
        </header>

        {next && (
          <Link to={next.tool.to} className="pr-next">
            <span className="pr-next-tag">Up next</span>
            <span className="pr-next-text">
              <b>
                {next.round.name} · {next.a.companyName}
                {next.at ? ` · ${dayOf(next.at)}` : ''}
              </b>
              <small>Practise with {next.tool.label.toLowerCase()} before it.</small>
            </span>
            <span className="pr-next-go">Start →</span>
          </Link>
        )}

        <ul className="pr-grid">
          {tools.map((t) => {
            const Icon = iconFor(t.icon);
            return (
              <li key={t.to}>
                <Link to={t.to} className="pr-card">
                  <span className="pr-icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <span className="pr-card-text">
                    <b>{t.label}</b>
                    <small>{t.what}</small>
                  </span>
                  <span className="pr-go">Open →</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </StudentLayout>
  );
}
