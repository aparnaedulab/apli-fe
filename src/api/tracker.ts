import { api } from './client';

/** The live application tracker (trust.tracker). */

export type RoundState = 'passed' | 'current' | 'upcoming' | 'failed' | 'skipped';

export interface TimelineEntry {
  at: string;
  kind: 'applied' | 'status' | 'round';
  text: string;
  /** The company's own note - only ever present in the company's view. */
  note?: string;
}

export interface Waiting {
  daysWaiting: number;
  overdue: boolean;
  /** The college's response time, in days. */
  responseDays: number;
}

export interface TrackedApplication {
  id: string;
  status: string;
  appliedAt: string;
  lastActivityAt: string;
  job: { id: string; title: string };
  company: { id: string; name: string };
  placement: { id: string; name: string };
  rounds: { id: string; order: number; name: string; state: RoundState }[];
  timeline: TimelineEntry[];
  /** Null when the next move is not the company's. */
  waiting: Waiting | null;
}

export interface CompanyOverdue {
  total: number;
  jobs: { jobId: string; title: string; overdue: number; applicationIds: string[]; oldestDays: number }[];
}

export interface CollegeOverdue {
  total: number;
  companies: {
    companyId: string;
    name: string;
    overdue: number;
    oldestDays: number;
    jobs: { jobId: string; title: string; overdue: number }[];
  }[];
}

export const trackerApi = {
  mine: () =>
    api.get<{ applications: TrackedApplication[] }>('/tracker/applications').then((r) => r.applications),
  company: () => api.get<CompanyOverdue>('/tracker/company'),
  companyApplication: (id: string) =>
    api
      .get<{ application: TrackedApplication }>(`/tracker/company/applications/${id}`)
      .then((r) => r.application),
  college: () => api.get<CollegeOverdue>('/tracker/college'),
};
