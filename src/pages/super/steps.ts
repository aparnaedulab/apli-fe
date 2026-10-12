import type { StepKey } from '../../api/platform';

export type SetupKey = 'institution' | 'colleges' | 'courses' | 'interests' | 'features';

/** The super admin's setup, in order. Features comes next and is not built yet. */
export const SETUP_STEPS: { key: SetupKey; label: string; short: string; hint: string; ready: boolean }[] = [
  { key: 'institution', label: 'Institution details', short: 'Details', hint: 'Name, address and contact', ready: true },
  { key: 'colleges', label: 'Colleges', short: 'Colleges', hint: 'One by one or a spreadsheet', ready: true },
  { key: 'courses', label: 'Courses', short: 'Courses', hint: 'What it runs, and where', ready: true },
  { key: 'interests', label: 'Skills & interests', short: 'Interests', hint: 'What students can pick', ready: true },
  { key: 'features', label: 'Features', short: 'Features', hint: 'What it switches on', ready: false },
];

/** Which setup steps an institution has finished, from what the server records. */
export function stepsDone(t: { completedSteps: StepKey[]; colleges: number }): Set<SetupKey> {
  const done = new Set<SetupKey>();
  if (t.completedSteps.includes('identity')) done.add('institution');
  if (t.colleges > 0) done.add('colleges');
  if (t.completedSteps.includes('academics')) done.add('courses');
  if (t.completedSteps.includes('interests')) done.add('interests');
  if (t.completedSteps.includes('features')) done.add('features');
  return done;
}

/** "Savitribai Phule Pune University" -> "SPPU": the first letters of the words that matter. */
const SMALL_WORDS = new Set(['of', 'and', 'the', 'for', 'in', 'at', '&']);
export function initials(name: string, max = 8): string {
  return name
    .split(/[\s,.-]+/)
    .filter((w) => w && !SMALL_WORDS.has(w.toLowerCase()))
    .map((w) => w[0])
    .join('')
    .slice(0, max);
}
