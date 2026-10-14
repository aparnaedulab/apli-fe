import { api } from './client';
import type { Round, RoundType, JobOption, OptionKind } from './jobs';

export type { Round, RoundType };

/**
 * An interview process a company defines before running a drive or ad-hoc hiring.
 * It is a lightweight wrapper around the existing job-rounds concept:
 * a named process with a type (hiring / internship), status, and an ordered
 * list of rounds the candidate goes through.
 */
export type InterviewProcessStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface InterviewProcess {
  id: string;
  title: string;
  description: string | null;
  processType: 'HIRING' | 'INTERNSHIP';
  status: InterviewProcessStatus;
  rounds: Round[];
  roundCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewProcessSummary {
  id: string;
  title: string;
  processType: 'HIRING' | 'INTERNSHIP';
  status: InterviewProcessStatus;
  roundCount: number;
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
  type: RoundType;
  isElimination: boolean;
  description?: string;
  isOnline: boolean;
  durationMin?: number;
  mode?: string;
  shortlistCount?: number;
  meetingLink?: string;
  addressLine?: string;
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
  VIDEO_INTERVIEW: 'Candidate records their answers to your questions',
  LIVE_INTERVIEW: 'Real-time one-on-one or panel interview',
  GROUP_DISCUSSION: 'Candidates discuss a topic together',
  ASSIGNMENT: 'Take-home task or case study',
  WORK_SIMULATION: 'Hands-on work sample via Apli.ai simulation',
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

/** Company interview processes — backed by the /company/interview-processes endpoints. */
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

  /** Fetch the options (round types, modes) — reuses the jobs meta endpoint */
  options: () =>
    api
      .get<{ options: Record<OptionKind, JobOption[]> }>('/company/jobs/meta')
      .then((r) => r.options),
};
