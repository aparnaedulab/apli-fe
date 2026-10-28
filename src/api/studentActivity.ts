import { api } from './client';

/**
 * What students do in the student app - simulations, internship offers and
 * interviews - read by the people who look after them.
 *
 * The same read answers two callers: an institution's admins (`/admin`, their
 * own students) and the platform team (`/platform/activity`, every student,
 * including those whose college is not on Apli.ai yet).
 */
export type ActivityBase = '/admin' | '/platform/activity';

export type RunStatus = 'ACTIVE' | 'IN_REVIEW' | 'NEEDS_WORK' | 'COMPLETED' | 'LEFT';
export type OfferStatus = 'SENT' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN' | 'LAPSED';
export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN' | 'REJECTED' | 'OFFERED';

export interface ActivityStats {
  students: number;
  newStudents: number;
  activeStudents: number;
  simulations: {
    live: number;
    started: number;
    inProgress: number;
    inReview: number;
    needsWork: number;
    certified: number;
  };
  offers: { sent: number; accepted: number; open: number };
  interviews: { total: number; open: number };
  fields: { field: string; started: number; certified: number }[];
}

/** /admin/stats adds the institution's own set-up counts. */
export interface AdminStats extends ActivityStats {
  colleges: number;
  batches: number;
  pendingInvites: number;
}

/** /platform/activity/stats adds students who belong to no institution. */
export interface PlatformStats extends ActivityStats {
  unattachedStudents: number;
}

export interface StudentRow {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
  joinedAt: string;
  college: string | null;
  onPartnerCollege: boolean;
  course: string | null;
  graduationYear: number | null;
  batch: string | null;
  started: number;
  certified: number;
  offers: number;
  interviews: number;
}

export interface StudentRun {
  id: string;
  status: RunStatus;
  simulation: string;
  field: string;
  company: string;
  tasksDone: number;
  tasks: number;
  sharedWith: number;
  startedAt: string;
  lastActiveAt: string;
  submittedAt: string | null;
  completedAt: string | null;
  certificateCode: string | null;
  reviewNote: string | null;
}

export interface StudentDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  joinedAt: string;
  college: string | null;
  onPartnerCollege: boolean;
  city: string | null;
  degreeLevel: string | null;
  course: string | null;
  specialisation: string | null;
  graduationYear: number | null;
  headline: string | null;
  interests: string[];
  batches: { id: string; name: string; rollNo: string | null }[];
  runs: StudentRun[];
  offers: {
    id: string;
    company: string;
    role: string;
    status: OfferStatus;
    months: number;
    stipend: number | null;
    workMode: string;
    respondBy: string;
    sentAt: string;
  }[];
  interviews: {
    id: string;
    company: string;
    role: string;
    status: InviteStatus;
    round: number;
    rounds: number;
    sentAt: string;
  }[];
}

export interface SimulationRow {
  id: string;
  slug: string;
  title: string;
  company: string;
  field: string;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  hours: number;
  tasks: number;
  status: 'LIVE' | 'RETIRED' | 'DRAFT' | 'SUBMITTED' | 'CHANGES_ASKED';
  publishedAt: string | null;
  started: number;
  inReview: number;
  certified: number;
}

export interface WorkRow {
  id: string;
  status: RunStatus;
  studentId: string;
  student: string;
  email: string;
  college: string | null;
  simulation: string;
  company: string;
  field: string;
  tasksDone: number;
  tasks: number;
  sharedWith: number;
  startedAt: string;
  lastActiveAt: string;
  submittedAt: string | null;
  completedAt: string | null;
  certificateCode: string | null;
}

export interface OfferRow {
  id: string;
  studentId: string;
  student: string;
  email: string;
  college: string | null;
  company: string;
  role: string;
  status: OfferStatus;
  workMode: string;
  city: string | null;
  months: number;
  stipend: number | null;
  startsOn: string | null;
  respondBy: string;
  respondedAt: string | null;
  sentAt: string;
  fromSimulation: string | null;
}

export interface InterviewRow {
  id: string;
  studentId: string;
  student: string;
  email: string;
  college: string | null;
  company: string;
  role: string;
  status: InviteStatus;
  round: number;
  rounds: number;
  roundName: string | null;
  sentAt: string;
  respondedAt: string | null;
  updatedAt: string;
}

export const studentActivityApi = {
  adminStats: () => api.get<AdminStats>('/admin/stats'),
  platformStats: () => api.get<PlatformStats>('/platform/activity/stats'),
  student: (base: ActivityBase, id: string) => api.get<StudentDetail>(`${base}/students/${id}`),
};

/* -------------------------------------------------------------------------- */
/* Labels and tones, shared so every screen says the same thing.               */
/* -------------------------------------------------------------------------- */

type Tone = 'pass' | 'hold' | 'stop' | 'idle';

export const RUN_LABEL: Record<RunStatus, [string, Tone]> = {
  ACTIVE: ['In progress', 'idle'],
  IN_REVIEW: ['In review', 'hold'],
  NEEDS_WORK: ['Changes asked', 'stop'],
  COMPLETED: ['Certified', 'pass'],
  LEFT: ['Left', 'idle'],
};

export const OFFER_LABEL: Record<OfferStatus, [string, Tone]> = {
  SENT: ['Waiting on student', 'hold'],
  ACCEPTED: ['Accepted', 'pass'],
  DECLINED: ['Declined', 'stop'],
  WITHDRAWN: ['Withdrawn', 'idle'],
  LAPSED: ['Lapsed', 'idle'],
};

export const INVITE_LABEL: Record<InviteStatus, [string, Tone]> = {
  PENDING: ['Waiting on student', 'hold'],
  ACCEPTED: ['In process', 'idle'],
  DECLINED: ['Declined', 'stop'],
  WITHDRAWN: ['Withdrawn', 'idle'],
  REJECTED: ['Not selected', 'stop'],
  OFFERED: ['Offered', 'pass'],
};

export const LEVEL_LABEL: Record<SimulationRow['level'], string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
};

export const options = <K extends string>(labels: Record<K, [string, Tone]>) =>
  (Object.keys(labels) as K[]).map((k) => ({ value: k, label: labels[k][0] }));
