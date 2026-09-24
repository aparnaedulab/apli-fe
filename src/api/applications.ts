import { api } from './client';

export type AppStatus =
  | 'APPLIED'
  | 'UNDER_REVIEW'
  /** Picked out of the pile, before any round has been scheduled. */
  | 'SHORTLISTED'
  | 'IN_ROUND'
  | 'WAITLISTED'
  | 'OFFERED'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'HIRED'
  | 'REJECTED'
  | 'WITHDRAWN';

export const STATUS_PILL: Record<AppStatus, string> = {
  APPLIED: 'pill-idle',
  UNDER_REVIEW: 'pill-hold',
  SHORTLISTED: 'pill-pass',
  IN_ROUND: 'pill-hold',
  WAITLISTED: 'pill-hold',
  OFFERED: 'pill-pass',
  ACCEPTED: 'pill-pass',
  HIRED: 'pill-pass',
  DECLINED: 'pill-stop',
  REJECTED: 'pill-stop',
  WITHDRAWN: 'pill-stop',
};

export interface ApplicantRow {
  id: string;
  status: AppStatus;
  appliedAt: string;
  jobId: string;
  jobTitle: string;
  totalRounds: number;
  /** The role's rounds, so the queue can name the one it is moving somebody into. */
  rounds: { id: string; order: number; name: string; isOnline: boolean; scheduledAt: string | null }[];
  currentRound: { id: string; order: number; name: string } | null;
  candidateId: string;
  name: string;
  email: string;
  cgpa: string | null;
  degreePct: string | null;
  resumeUrl: string | null;
  rollNo: string | null;
  batchId: string | null;
  batchName: string | null;
  /** Which campus they are on, for a role run across more than one. */
  collegeId: string | null;
  collegeName: string | null;
  course: string | null;
  specialisation: string | null;

  /* Why this one is near the top, in the words the role used. */
  beatsPreferred: boolean;
  skillsAsked: number;
  skillsAskedHeld: number;
  skillsWelcomed: number;
  skillsWelcomedHeld: number;
  reasons: string[];
  score: number;
}

/** How the list is ordered. `match` is the default and the point of it. */
export type ApplicantSort = 'match' | 'cgpa' | 'applied' | 'name';

export interface RoundResultRow {
  roundOrder: number;
  roundName: string;
  outcome: 'PENDING' | 'PASSED' | 'FAILED' | 'SKIPPED';
  score: string | null;
  feedback: string | null;
  evaluatedAt: string | null;
}

export interface EventRow {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  note: string | null;
  actor: string;
  createdAt: string;
}

export interface ApplicantDetail {
  id: string;
  status: AppStatus;
  appliedAt: string;
  currentRound: { id: string; order: number; name: string } | null;
  rounds: { id: string; order: number; name: string; type: string; isElimination: boolean }[];
  results: RoundResultRow[];
  events: EventRow[];
  job: { id: string; title: string };
  candidate: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    headline: string | null;
    about: string | null;
    resumeUrl: string | null;

    /* The whole academic record, not the three columns the list filters on. */
    cgpa: string | null;
    degreePct: string | null;
    tenthPct: string | null;
    twelfthPct: string | null;
    /** What a second-year lateral entrant has instead of a 12th percentage. */
    diplomaPct: string | null;
    pgCgpa: string | null;
    pgPct: string | null;
    /** Ever accumulated, and still outstanding. Criteria sheets want both. */
    backlogs: number | null;
    activeBacklogs: number | null;
    gapYears: number | null;
    isLateralEntry: boolean;
    prn: string | null;
    graduationYear: number | null;

    course: string | null;
    specialisation: string | null;
    collegeName: string | null;

    batch: {
      name: string;
      course: string;
      graduationYear: number;
      rollNo: string | null;
      isFrozen: boolean;
    } | null;
    educations: {
      id: string;
      degree: string;
      institution: string;
      board: string | null;
      startYear: number;
      endYear: number | null;
      cgpa: string | null;
      percentage: string | null;
    }[];
    experiences: {
      id: string;
      title: string;
      organisation: string;
      location: string | null;
      description: string | null;
      startDate: string;
      endDate: string | null;
      isCurrent: boolean;
    }[];
    projects: {
      id: string;
      title: string;
      description: string | null;
      /** Every place the work can be seen, not whichever one came first. */
      links: { url: string; label?: string }[];
      startDate: string | null;
      endDate: string | null;
    }[];
    skills: string[];
  };
}

interface Feedback {
  score?: number;
  feedback?: string;
  note?: string;
}

export const applicantApi = {
  list: (
    params: {
      jobId?: string;
      status?: string;
      course?: string;
      specialisation?: string;
      minCgpa?: string;
      sort?: ApplicantSort;
    } = {},
  ) => {
    const q = new URLSearchParams();
    if (params.jobId) q.set('jobId', params.jobId);
    if (params.status) q.set('status', params.status);
    if (params.course) q.set('course', params.course);
    if (params.specialisation) q.set('specialisation', params.specialisation);
    if (params.minCgpa) q.set('minCgpa', params.minCgpa);
    if (params.sort) q.set('sort', params.sort);
    const qs = q.toString();
    return api
      .get<{ applications: ApplicantRow[] }>(`/company/applications${qs ? `?${qs}` : ''}`)
      .then((r) => r.applications);
  },

  get: (id: string) =>
    api.get<{ application: ApplicantDetail }>(`/company/applications/${id}`).then((r) => r.application),

  review: (id: string) => api.post<unknown>(`/company/applications/${id}/review`),
  shortlist: (id: string) => api.post<unknown>(`/company/applications/${id}/shortlist`),
  /** Calls them to a round, which releases its date, venue and link. */
  invite: (id: string, roundId?: string) =>
    api.post<{ calledTo?: string }>(`/company/applications/${id}/invite`, { roundId }),
  advance: (id: string, body: Feedback = {}) =>
    api.post<{ movedTo?: string }>(`/company/applications/${id}/advance`, body),
  waitlist: (id: string, body: Feedback = {}) =>
    api.post<unknown>(`/company/applications/${id}/waitlist`, body),
  reject: (id: string, body: Feedback = {}) =>
    api.post<unknown>(`/company/applications/${id}/reject`, body),
  offer: (id: string) => api.post<unknown>(`/company/applications/${id}/offer`),
  hire: (id: string) => api.post<unknown>(`/company/applications/${id}/hire`),
};

/* --- the student's own moves ----------------------------------------------- */

export const myApplicationApi = {
  respond: (id: string, decision: 'ACCEPT' | 'DECLINE') =>
    api.post<{ cascaded: number }>(`/candidate/jobs/mine/applications/${id}/respond`, { decision }),

  withdraw: (id: string) =>
    api.post<unknown>(`/candidate/jobs/mine/applications/${id}/withdraw`),
};
