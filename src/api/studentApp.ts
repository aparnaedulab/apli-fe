import { api } from './client';
import type { Answers, HandInKind, MarkedCheck, StudentPage } from './taskPages';

/** The rebuilt student app's API: /api/student-app/... and the review queue. */

export interface SimulationCard {
  id: string;
  slug: string;
  title: string;
  summary: string;
  field: string;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  hours: number;
  skills: string[];
  tasks: number;
  company: { id: string; name: string; logoUrl: string | null };
  coverUrl: string | null;
  isNew: boolean;
  /** Where this student stands on it, once they have started. */
  myStatus: RunStatus | null;
  /** Students from the same college who finished it. */
  fromCollege: number;
}

export type RunStatus = 'ACTIVE' | 'IN_REVIEW' | 'NEEDS_WORK' | 'COMPLETED' | 'LEFT';

export interface InProgress {
  runId: string;
  status: RunStatus;
  simulation: SimulationCard;
  tasksDone: number;
  tasksLeft: number;
  nextTask: { title: string; minutes: number } | null;
  readyToExplain: boolean;
  reviewNote: string | null;
  lastActiveAt: string;
}

export interface CompanyRef {
  id: string;
  name: string;
}

export interface Certificate {
  runId: string;
  simulation: SimulationCard;
  completedAt: string | null;
  certificateCode: string | null;
  sharedWith: CompanyRef[];
}

export interface ActivityEvent {
  at: string;
  kind: 'started' | 'handed-in' | 'sent' | 'changes' | 'verified';
  text: string;
  slug: string;
}

export interface Dashboard {
  firstName: string;
  interests: string[];
  stats: { tasksHandedIn: number; hoursVerified: number };
  activity: ActivityEvent[];
  skills: { name: string; times: number; verified: boolean }[];
  fields: { field: string; open: number; started: number; verified: number }[];
  suggested: SimulationCard[];
  moreToTry: number;
  inProgress: InProgress[];
  certificates: Certificate[];
  sharedCount: number;
  profile: { complete: number; missing: { key: string; label: string }[] };
}

export interface SimulationDetail {
  simulation: SimulationCard & { headline: string | null; about: string | null; videoUrl: string | null };
  company: {
    name: string;
    headline: string | null;
    about: string | null;
    website: string | null;
    city: string | null;
    size: string | null;
    founded: number | null;
    industry: string | null;
    more: { slug: string; title: string; field: string; hours: number }[];
  };
  reviews: {
    average: number | null;
    count: number;
    mine: { stars: number; comment: string | null } | null;
    canReview: boolean;
  };
  tasks: {
    id: string;
    position: number;
    title: string;
    brief: string;
    /** What to hand in for it, in the company's words. */
    handIn: string | null;
    /** What the task teaches, as short points. */
    learn: string[];
    /** What to do, step by step. */
    steps: string[];
    /** Pages to read and quick checks to answer, without the answers. */
    pages: StudentPage[];
    /** This student's marked checks, by page id. */
    checks: Record<string, MarkedCheck>;
    /** How this task may be handed in. */
    handInKinds: HandInKind[];
    minutes: number;
    done: boolean;
    handedIn: {
      answer: string | null;
      link: string | null;
      fileUrl: string | null;
      fileName: string | null;
      at: string;
    } | null;
  }[];
  run: {
    id: string;
    status: RunStatus;
    startedAt: string;
    completedAt: string | null;
    certificateCode: string | null;
    explainHow: string | null;
    explainChange: string | null;
    submittedAt: string | null;
    reviewNote: string | null;
    sharedWith: CompanyRef[];
  } | null;
}

export interface HandInBody {
  answer?: string;
  link?: string;
  fileUrl?: string | null;
  fileName?: string | null;
}

export interface SimulationReview {
  stars: number;
  comment: string | null;
  at: string;
  by: string;
  college: string | null;
}

export interface ShareOption {
  id: string;
  name: string;
  logoUrl: string | null;
  isOwner: boolean;
  shared: boolean;
}

export interface StudentProfile {
  fullName: string;
  email: string;
  college: string | null;
  course: string | null;
  degreeLevel: string | null;
  batch: string | null;
  interests: string[];
  city: string | null;
  phone: string | null;
  specialisation: string | null;
  cgpa: number | null;
  complete: number;
  missing: { key: string; label: string }[];
}

export interface ReviewItem {
  runId: string;
  companyId: string;
  submittedAt: string | null;
  student: { name: string; email: string; college: string | null };
  simulation: { title: string; slug: string; company: string };
  tasks: {
    id: string;
    position: number;
    title: string;
    brief: string;
    handIn: string | null;
    answer: string | null;
    link: string | null;
    fileUrl: string | null;
    fileName: string | null;
    checks: { title: string; score: number | null; total: number; written: { prompt: string; answer: string }[] }[];
  }[];
  explainHow: string | null;
  explainChange: string | null;
}

export const LEVEL_LABEL: Record<SimulationCard['level'], string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
};

const sim = (slug: string) => `/student-app/simulations/${encodeURIComponent(slug)}`;

export const studentAppApi = {
  dashboard: () => api.get<Dashboard>('/student-app/dashboard'),
  simulations: (field?: string, q?: string) => {
    const qs = new URLSearchParams();
    if (field) qs.set('field', field);
    if (q) qs.set('q', q);
    return api.get<{ simulations: SimulationCard[]; fields: { field: string; count: number }[] }>(
      `/student-app/simulations${qs.toString() ? `?${qs}` : ''}`,
    );
  },
  simulation: (slug: string) => api.get<SimulationDetail>(sim(slug)),
  reviews: (slug: string) =>
    api.get<{ reviews: SimulationReview[] }>(`${sim(slug)}/reviews`).then((r) => r.reviews),
  saveReview: (slug: string, body: { stars: number; comment?: string }) => api.put<SimulationDetail>(`${sim(slug)}/review`, body),
  start: (slug: string) => api.post<SimulationDetail>(`${sim(slug)}/start`),
  /** A file for a hand-in: a PDF or a picture. */
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.upload<{ url: string; name: string }>('/student-app/uploads', form);
  },
  handIn: (slug: string, taskId: string, body: HandInBody) =>
    api.put<SimulationDetail>(`${sim(slug)}/tasks/${taskId}`, body),
  answerCheck: (slug: string, taskId: string, pageId: string, answers: Answers) =>
    api.post<SimulationDetail>(`${sim(slug)}/tasks/${taskId}/checks/${pageId}`, { answers }),
  explain: (slug: string, body: { how: string; change: string }) => api.post<SimulationDetail>(`${sim(slug)}/explain`, body),
  shareOptions: (runId: string) => api.get<{ companies: ShareOption[] }>(`/student-app/runs/${runId}/shares`),
  setShares: (runId: string, companyIds: string[]) =>
    api.put<{ companies: ShareOption[] }>(`/student-app/runs/${runId}/shares`, { companyIds }),
  profile: () => api.get<StudentProfile>('/student-app/profile'),
  saveProfile: (body: {
    interests: string[];
    city: string;
    phoneCountry: string;
    phone?: string;
    specialisation?: string;
    cgpa?: number | '';
  }) => api.put<StudentProfile>('/student-app/profile', body),
  dismiss: (kind: 'suggestion' | 'run', id: string) => api.post('/student-app/dismiss', { kind, id }),
};

export const reviewApi = {
  queue: () => api.get<{ reviews: ReviewItem[] }>('/platform/reviews'),
  decide: (runId: string, decision: 'approve' | 'changes', note?: string) =>
    api.post<{ reviews: ReviewItem[] }>(`/platform/reviews/${runId}`, { decision, note }),
};
