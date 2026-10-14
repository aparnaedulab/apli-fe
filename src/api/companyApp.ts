import { api } from './client';
import type { ReviewItem } from './studentApp';
import type { HandInKind, PageDraft } from './taskPages';

/** The rebuilt company app's API: /api/company-app/... and Apli.ai's check. */

export type SimStatus = 'DRAFT' | 'SUBMITTED' | 'CHANGES_ASKED' | 'LIVE' | 'RETIRED';
export type SimLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export interface CompanyOverview {
  company: { id: string; name: string; logoUrl: string | null; status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED' };
  simulations: { draft: number; submitted: number; live: number; retired: number; changesAsked: number };
  students: { working: number; toReview: number; verified: number; sharedWithYou: number };
  waiting: { runId: string; student: string; simulation: string; submittedAt: string | null }[];
}

export interface CompanySimRow {
  id: string;
  slug: string;
  title: string;
  field: string;
  level: SimLevel;
  hours: number;
  status: SimStatus;
  reviewNote: string | null;
  submittedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  tasks: number;
  students: { working: number; toReview: number; verified: number };
}

export interface TaskDraft {
  id?: string;
  title: string;
  brief: string;
  handIn: string | null;
  learn: string[];
  /** What the student does, step by step. */
  steps: string[];
  /** Pages to read and quick checks, with the answers. */
  pages: PageDraft[];
  /** How students may hand it in. */
  handInKinds: HandInKind[];
  minutes: number;
}

export interface CompanySim {
  id: string;
  slug: string;
  title: string;
  summary: string;
  about: string | null;
  coverUrl: string | null;
  videoUrl: string | null;
  field: string;
  level: SimLevel;
  hours: number;
  skills: string[];
  status: SimStatus;
  reviewNote: string | null;
  submittedAt: string | null;
  publishedAt: string | null;
  editable: boolean;
  tasks: (TaskDraft & { id: string; position: number })[];
}

export interface SimInput {
  title: string;
  summary: string;
  about?: string | null;
  coverUrl?: string | null;
  videoUrl?: string | null;
  field: string;
  level: SimLevel;
  hours: number;
  skills: string[];
  tasks: {
    title: string;
    brief: string;
    handIn?: string | null;
    learn?: string[];
    steps?: string[];
    pages?: PageDraft[];
    handInKinds?: HandInKind[];
    minutes: number;
  }[];
}

export interface SharedWork {
  sharedAt: string;
  runId: string;
  student: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    city: string | null;
    college: string | null;
    course: string | null;
    batch: string | null;
    cgpa: number | null;
  };
  simulation: { title: string; field: string; company: string };
  certificateCode: string | null;
  completedAt: string | null;
  tasks: { title: string; answer: string | null; link: string | null; fileUrl: string | null; fileName: string | null }[];
  explainHow: string | null;
  explainChange: string | null;
}

/** A try at a test a student sent the company, every answer written out. */
export interface SentTest {
  id: string;
  runId: string;
  sentAt: string;
  takenAt: string;
  /** Which try this was, of how many they have had. */
  attempt: number;
  tries: number;
  score: number;
  total: number;
  simulation: string;
  task: string;
  test: string;
  student: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    city: string | null;
    college: string | null;
    course: string | null;
    batch: string | null;
  };
  questions: {
    prompt: string;
    kind: 'text' | 'choice' | 'sort' | 'order';
    answer: string[];
    right: string[];
    /** Null for a written answer: it is for the company to judge. */
    correct: boolean | null;
  }[];
}

type Group = { rows: { label: string; count: number }[]; missing: number };
export type RunStatus = 'ACTIVE' | 'IN_REVIEW' | 'NEEDS_WORK' | 'COMPLETED' | 'LEFT';
type WrittenOut = SentTest['questions'];

/** How a simulation is being used. Counts cover everyone; names only those who chose to show the company. */
export interface SimAnalytics {
  simulation: { id: string; title: string; status: SimStatus; publishedAt: string | null };
  status: {
    started: number;
    working: number;
    stalled: number;
    toReview: number;
    changesAsked: number;
    verified: number;
    left: number;
    completionRate: number | null;
    medianDaysToFinish: number | null;
    rating: number | null;
    ratings: number;
    stalledAfterDays: number;
  };
  weeks: { week: string; started: number; finished: number }[];
  who: { colleges: Group; courses: Group; branches: Group; cities: Group; classOf: Group; levels: Group };
  tasks: {
    id: string;
    position: number;
    title: string;
    reached: number;
    handedIn: number;
    tests: {
      id: string;
      title: string;
      graded: boolean;
      takers: number;
      firstTry: number | null;
      latest: number | null;
      averageTries: number | null;
      sawAnswers: number;
      sent: number;
      questions: { prompt: string; kind: WrittenOut[number]['kind']; firstTryRight: number | null }[];
    }[];
  }[];
  students: {
    runId: string;
    candidateId: string;
    name: string;
    email: string;
    phone: string | null;
    college: string | null;
    course: string | null;
    batch: string | null;
    city: string | null;
    status: RunStatus;
    why: 'handed-in' | 'shared' | 'sent-a-test';
    startedAt: string;
    lastActiveAt: string;
    completedAt: string | null;
    tasksDone: number;
    tasks: {
      taskId: string;
      handedInAt: string | null;
      tests: {
        pageId: string;
        title: string;
        tries: number;
        visible: { number: number; score: number; total: number; sent: boolean }[];
        latest: { score: number; total: number } | null;
        sawAnswers: boolean | null;
        answers: { number: number; questions: WrittenOut } | null;
      }[];
    }[];
  }[];
  anonymous: number;
}

export interface SimToCheck {
  id: string;
  title: string;
  summary: string;
  about: string | null;
  coverUrl: string | null;
  videoUrl: string | null;
  field: string;
  level: SimLevel;
  hours: number;
  skills: string[];
  submittedAt: string | null;
  company: { id: string; name: string; status: string };
  tasks: {
    position: number;
    title: string;
    brief: string;
    handIn: string | null;
    learn: string[];
    steps: string[];
    minutes: number;
  }[];
}

export const STATUS_LABEL: Record<SimStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'With Apli.ai',
  CHANGES_ASKED: 'Changes asked',
  LIVE: 'Live',
  RETIRED: 'Retired',
};

const base = '/company-app';

export const companyAppApi = {
  overview: () => api.get<CompanyOverview>(`${base}/overview`),
  simulations: () => api.get<{ simulations: CompanySimRow[] }>(`${base}/simulations`).then((r) => r.simulations),
  simulation: (id: string) => api.get<CompanySim>(`${base}/simulations/${id}`),
  create: (body: SimInput) => api.post<CompanySim>(`${base}/simulations`, body),
  update: (id: string, body: SimInput) => api.put<CompanySim>(`${base}/simulations/${id}`, body),
  remove: (id: string) => api.delete(`${base}/simulations/${id}`),
  act: (id: string, action: 'submit' | 'withdraw' | 'retire') => api.post<CompanySim>(`${base}/simulations/${id}/${action}`),
  reviews: () => api.get<{ reviews: ReviewItem[] }>(`${base}/reviews`).then((r) => r.reviews),
  decide: (runId: string, decision: 'approve' | 'changes', note?: string) =>
    api.post<{ reviews: ReviewItem[] }>(`${base}/reviews/${runId}`, { decision, note }).then((r) => r.reviews),
  shared: () => api.get<{ shared: SharedWork[] }>(`${base}/shared`).then((r) => r.shared),
  tests: () => api.get<{ tests: SentTest[] }>(`${base}/tests`).then((r) => r.tests),
  analytics: (id: string) => api.get<SimAnalytics>(`${base}/simulations/${id}/analytics`),
  uploadCover: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.upload<{ url: string }>(`${base}/uploads/cover`, form).then((r) => r.url);
  },
};

export const simulationCheckApi = {
  queue: () => api.get<{ simulations: SimToCheck[] }>('/platform/simulations').then((r) => r.simulations),
  decide: (id: string, decision: 'approve' | 'changes', note?: string) =>
    api.post<{ simulations: SimToCheck[] }>(`/platform/simulations/${id}`, { decision, note }).then((r) => r.simulations),
};
