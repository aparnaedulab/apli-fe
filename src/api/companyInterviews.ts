import { api } from './client';
import { jobApi, type JobOption, type OptionKind, type RoundType } from './jobs';

export type { RoundType };

/**
 * A company's own interview processes: a named, reusable set of rounds it
 * puts students through after seeing their work. Round types are the same
 * list as job rounds - the shipped ones plus any the company adds.
 */
export type InterviewProcessStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export type QuestionType = 'intro' | 'behavioural' | 'situational' | 'technical' | 'motivation';

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  intro: 'Introduction',
  behavioural: 'Behavioural',
  situational: 'Situational',
  technical: 'Technical',
  motivation: 'Motivation',
};

export interface ProcessQuestion {
  id?: string;
  text: string;
  hint: string | null;
  type: QuestionType;
}

/** One round of a process, as the company edits it. */
export interface Round {
  id: string;
  order: number;
  name: string;
  /** A shipped type, or one the company added (CUSTOM_...). */
  type: string;
  typeLabel: string;
  isElimination: boolean;
  description: string | null;
  isOnline: boolean;
  meetingLink: string | null;
  addressLine: string | null;
  shortlistCount: number | null;
  durationMin: number | null;
  mode: string | null;
  /** Recorded interview: seconds to answer and to think, per question. */
  questionTimeSec: number | null;
  prepTimeSec: number | null;
  /** Work-simulation round: which simulation. */
  simulationId: string | null;
  simulationTitle: string | null;
  questions: ProcessQuestion[];
}

export interface InterviewProcess {
  id: string;
  title: string;
  description: string | null;
  processType: 'HIRING' | 'INTERNSHIP';
  status: InterviewProcessStatus;
  rounds: Round[];
  roundCount: number;
  /** Students invited and still in it. */
  inviteCount: number;
  /** False once students are going through it: duplicate it to change the rounds. */
  editable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewProcessSummary {
  id: string;
  title: string;
  processType: 'HIRING' | 'INTERNSHIP';
  status: InterviewProcessStatus;
  roundCount: number;
  inviteCount: number;
  updatedAt: string;
}

export interface CreateProcessInput {
  title: string;
  description?: string;
  processType: 'HIRING' | 'INTERNSHIP';
}

export interface RoundInput {
  order: number;
  name: string;
  type: string;
  isElimination: boolean;
  description?: string;
  isOnline: boolean;
  durationMin?: number;
  mode?: string;
  shortlistCount?: number;
  meetingLink?: string;
  addressLine?: string;
  questionTimeSec?: number;
  prepTimeSec?: number;
  simulationId?: string;
  questions?: { text: string; hint?: string; type: QuestionType }[];
}

export interface QuestionPack {
  id: string;
  title: string;
  description: string;
  role: string;
  questions: { text: string; hint?: string; type: string }[];
}

export const PROCESS_TYPE_LABELS: Record<string, string> = {
  HIRING: 'Full-time / Lateral hire',
  INTERNSHIP: 'Internship',
};

export const STATUS_LABELS: Record<InterviewProcessStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  ARCHIVED: 'Archived',
};

export const ROUND_TYPE_LABELS: Record<string, string> = {
  RESUME_SCREEN: 'Resume screen',
  MCQ_TEST: 'Online test',
  VIDEO_INTERVIEW: 'Recorded interview',
  LIVE_INTERVIEW: 'Live interview',
  GROUP_DISCUSSION: 'Group discussion',
  ASSIGNMENT: 'Assignment',
  WORK_SIMULATION: 'Work simulation',
};

export const ROUND_TYPE_ICONS: Record<string, string> = {
  RESUME_SCREEN: '📄',
  MCQ_TEST: '📝',
  VIDEO_INTERVIEW: '🎥',
  LIVE_INTERVIEW: '🎙️',
  GROUP_DISCUSSION: '🗣️',
  ASSIGNMENT: '📋',
  WORK_SIMULATION: '💼',
};

export const ROUND_TYPE_HINTS: Record<string, string> = {
  RESUME_SCREEN: 'Review CVs and shortlist candidates',
  MCQ_TEST: 'Timed online aptitude or technical test',
  VIDEO_INTERVIEW: 'Students record answers to your questions, in the app',
  LIVE_INTERVIEW: 'Real-time one-on-one or panel interview',
  GROUP_DISCUSSION: 'Candidates discuss a topic together',
  ASSIGNMENT: 'Take-home task or case study',
  WORK_SIMULATION: 'One of your Apli.ai simulations, as a round',
};

export const ROUND_TYPES: RoundType[] = [
  'RESUME_SCREEN',
  'MCQ_TEST',
  'VIDEO_INTERVIEW',
  'LIVE_INTERVIEW',
  'GROUP_DISCUSSION',
  'ASSIGNMENT',
  'WORK_SIMULATION',
];

/** Company interview processes - backed by the /company/interview-processes endpoints. */
export const interviewProcessApi = {
  list: () =>
    api.get<{ processes: InterviewProcessSummary[] }>('/company/interview-processes').then((r) => r.processes),
  get: (id: string) =>
    api.get<{ process: InterviewProcess }>(`/company/interview-processes/${id}`).then((r) => r.process),
  create: (data: CreateProcessInput) =>
    api.post<{ process: InterviewProcess }>('/company/interview-processes', data).then((r) => r.process),
  update: (id: string, data: Partial<CreateProcessInput> & { status?: InterviewProcessStatus }) =>
    api.patch<{ process: InterviewProcess }>(`/company/interview-processes/${id}`, data).then((r) => r.process),
  setRounds: (id: string, rounds: RoundInput[]) =>
    api
      .put<{ process: InterviewProcess }>(`/company/interview-processes/${id}/rounds`, { rounds })
      .then((r) => r.process),
  remove: (id: string) => api.delete<void>(`/company/interview-processes/${id}`),
  /** A fresh draft copy - the way to change a process students are in. */
  duplicate: (id: string) =>
    api.post<{ process: InterviewProcess }>(`/company/interview-processes/${id}/duplicate`).then((r) => r.process),
  /** Question packs to pull into a recorded interview. */
  packs: () => api.get<{ packs: QuestionPack[] }>('/company/interview-processes/packs').then((r) => r.packs),
  /** The company's live simulations, for a work-simulation round. */
  simulations: () =>
    api
      .get<{ simulations: { id: string; title: string; hours: number }[] }>('/company/interview-processes/simulations')
      .then((r) => r.simulations),
  /** The round types and modes the company can pick - shipped ones and its own. */
  options: () =>
    api.get<{ options: Record<OptionKind, JobOption[]> }>('/company/jobs/meta').then((r) => r.options),
  /** A kind of round of the company's own, e.g. "Machine test". */
  addRoundType: (label: string) => jobApi.addOption('ROUND_TYPE', label),
};
