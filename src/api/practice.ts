import { api } from './client';

/** Readiness check and aptitude practice (dev.readiness, dev.aptitude). */

export type AreaKey = 'aptitude' | 'technical' | 'communication' | 'interview' | 'presence' | 'clarity';
export type AreaScores = Record<AreaKey, number>;
export type Section = 'QUANT' | 'REASONING' | 'VERBAL' | 'TECHNICAL';
export type SessionMode = 'TOPIC' | 'MIXED' | 'REVIEW';

export interface PlanTask {
  title: string;
  why: string;
  to: string;
  action: string;
}

export interface UpcomingRound {
  applicationId: string;
  jobId: string;
  company: string;
  role: string;
  round: { name: string; type: string; description: string | null; at: string; isOnline: boolean };
  daysUntil: number;
  steps: { when: string; task: string; to: string }[];
}

export interface ReadinessView {
  areas: { key: AreaKey; label: string }[];
  questions: { key: string; area: AreaKey; text: string }[];
  latest: { at: string; composite: number; scores: AreaScores } | null;
  history: { at: string; composite: number }[];
  plan: { focus: { area: AreaKey; label: string; score: number }[]; tasks: PlanTask[] } | null;
  practice: { attempts: number; accuracy: number | null };
  upcoming: UpcomingRound[];
}

export interface AptitudeOverview {
  sections: {
    section: Section;
    topics: { topic: string; questions: number; attempts: number; accuracy: number | null }[];
  }[];
  totals: { attempts: number; accuracy: number | null };
  weakTopics: { topic: string; section: Section; accuracy: number; attempts: number; lastAt: string }[];
  toRetry: number;
}

export interface PracticeQuestion {
  id: string;
  section: Section;
  topic: string;
  difficulty: number;
  stem: string;
  options: string[];
}

export interface PracticeSession {
  mode: SessionMode;
  timeLimitSec: number | null;
  questions: PracticeQuestion[];
}

export interface CollegeReadiness {
  students: number;
  checked: number;
  checkedPct: number;
  average: number | null;
  distribution: { label: string; count: number }[];
  areas: { key: AreaKey; label: string; average: number | null }[];
  batches: { name: string; students: number; checked: number; average: number | null }[];
}

export const practiceApi = {
  readiness: () => api.get<ReadinessView>('/practice/readiness'),
  submitCheck: (answers: Record<string, number>) => api.post<ReadinessView>('/practice/readiness', { answers }),
  aptitude: () => api.get<AptitudeOverview>('/practice/aptitude'),
  start: (input: { mode: SessionMode; section?: Section; topic?: string }) =>
    api.post<PracticeSession>('/practice/aptitude/session', input),
  answer: (questionId: string, chosenIndex: number, timeMs?: number) =>
    api.post<{ correct: boolean; answerIndex: number; explanation: string | null }>('/practice/aptitude/answer', {
      questionId,
      chosenIndex,
      timeMs,
    }),
  college: () => api.get<CollegeReadiness>('/practice/college'),
};

export const SECTION_LABEL: Record<Section, string> = {
  QUANT: 'Quantitative',
  REASONING: 'Reasoning',
  VERBAL: 'Verbal',
  TECHNICAL: 'Technical',
};
