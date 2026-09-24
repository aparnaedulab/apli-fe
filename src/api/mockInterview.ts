import { api } from './client';

export type InterviewKind = 'HR' | 'TECHNICAL' | 'MANAGERIAL';

export interface MockOptions {
  kinds: { key: InterviewKind; label: string; blurb: string }[];
  roles: { key: string; label: string }[];
  /** True when the deployment has an AI key; otherwise built-in feedback only. */
  aiEnabled: boolean;
}

export interface MockFeedback {
  source: 'builtin' | 'ai';
  fellBack?: boolean;
  score: number;
  strengths: string[];
  improvements: { title: string; tip: string }[];
  betterOpening?: string;
  metrics: {
    words: number;
    idealWords: [number, number];
    wpm: number | null;
    fillers: { word: string; count: number }[];
    fillerTotal: number;
    star: { situation: boolean; task: boolean; action: boolean; result: boolean } | null;
    specifics: string[];
    repeated: string | null;
  };
}

export interface MockQuestion {
  id: string;
  text: string;
  type: string;
  idealWords: [number, number];
}

export interface MockSession {
  id: string;
  kind: InterviewKind;
  role: string;
  createdAt: string;
  questions: MockQuestion[];
  answers: { id: string; question: string; answer: string; durationSec: number | null; feedback: MockFeedback; createdAt: string }[];
  averageScore: number | null;
}

export interface MockSessionSummary {
  id: string;
  kind: InterviewKind;
  role: string;
  createdAt: string;
  answered: number;
  averageScore: number | null;
}

export const mockInterviewApi = {
  options: () => api.get<MockOptions>('/mock-interviews/options'),
  sessions: () => api.get<{ sessions: MockSessionSummary[] }>('/mock-interviews/sessions').then((r) => r.sessions),
  start: (kind: InterviewKind, role: string) =>
    api.post<{ session: MockSession }>('/mock-interviews/sessions', { kind, role }).then((r) => r.session),
  get: (id: string) => api.get<{ session: MockSession }>(`/mock-interviews/sessions/${id}`).then((r) => r.session),
  answer: (id: string, data: { questionId: string; answer: string; durationSec?: number; mode: 'typed' | 'voice' }) =>
    api.post<{ feedback: MockFeedback; session: MockSession }>(`/mock-interviews/sessions/${id}/answers`, data),
};
