import { api } from './client';
import type { MockFeedback } from './mockInterview';

/* Group discussion ---------------------------------------------------------- */

export type TopicType = 'TECH' | 'SOCIAL' | 'BUSINESS' | 'ABSTRACT';

export interface GdTopic {
  id: string;
  title: string;
  type: TopicType;
}

export interface GdPersona {
  key: 'dominant' | 'quiet' | 'offtopic' | 'data';
  name: string;
  trait: string;
}

export interface GdTurn {
  /** 'moderator', 'you', or a persona key. */
  speaker: string;
  text: string;
  at: string;
  kind?: 'summary';
}

export interface GdFeedback {
  source: 'builtin' | 'ai';
  fellBack?: boolean;
  score: number;
  strengths: string[];
  improvements: { title: string; tip: string }[];
  metrics: {
    contributions: number;
    avgWords: number;
    share: number;
    enteredAt: number | null;
    referencedOthers: number;
    broughtBackOnTopic: boolean;
    usedExamples: boolean;
    summarised: boolean;
  };
}

export interface GdSession {
  id: string;
  topic: GdTopic;
  transcript: GdTurn[];
  phase: 'discussion' | 'summary' | 'ended';
  feedback: GdFeedback | null;
  createdAt: string;
  endedAt: string | null;
}

export interface GdSessionSummary {
  id: string;
  topic: string;
  createdAt: string;
  endedAt: string | null;
  score: number | null;
}

export const gdApi = {
  topics: () => api.get<{ topics: GdTopic[]; personas: GdPersona[]; aiEnabled: boolean }>('/growth/gd/topics'),
  sessions: () => api.get<{ sessions: GdSessionSummary[] }>('/growth/gd/sessions').then((r) => r.sessions),
  start: (topicId?: string) => api.post<GdSession>('/growth/gd/sessions', topicId ? { topicId } : {}),
  get: (id: string) => api.get<GdSession>(`/growth/gd/sessions/${id}`),
  speak: (id: string, text: string) => api.post<GdSession>(`/growth/gd/sessions/${id}/turns`, { text }),
  pass: (id: string) => api.post<GdSession>(`/growth/gd/sessions/${id}/pass`, {}),
  finish: (id: string, summary?: string) => api.post<GdSession>(`/growth/gd/sessions/${id}/finish`, summary ? { summary } : {}),
};

/* Confidence & wellbeing ----------------------------------------------------- */

export interface LadderStep {
  key: string;
  label: string;
  to: string;
  /** The feature the step links to; null when it is always available. */
  module: string | null;
  done: boolean;
}

export interface Win {
  id: string;
  text: string;
  createdAt: string;
}

export interface Mood {
  id: string;
  score: number;
  note: string | null;
  createdAt: string;
}

export interface WellbeingState {
  ladder: LadderStep[];
  wins: Win[];
  moods: Mood[];
  recentRejection: { role: string; company: string; at: string } | null;
}

export const wellbeingApi = {
  get: () => api.get<WellbeingState>('/growth/wellbeing'),
  tick: (step: string, done: boolean) => api.post<{ step: string; done: boolean }>('/growth/wellbeing/ladder', { step, done }),
  addWin: (text: string) => api.post<Win>('/growth/wellbeing/wins', { text }),
  removeWin: (id: string) => api.delete<void>(`/growth/wellbeing/wins/${id}`),
  mood: (score: number, note?: string) => api.post<Mood>('/growth/wellbeing/mood', note ? { score, note } : { score }),
};

/* Soft skills ---------------------------------------------------------------- */

export interface PitchPart {
  key: 'who' | 'proof' | 'fit' | 'ask';
  label: string;
  ok: boolean;
  tip: string;
}

export interface PitchFeedback extends MockFeedback {
  structure: PitchPart[];
  seconds: number | null;
}

export interface EmailCheck {
  key: string;
  label: string;
  ok: boolean;
  tip?: string;
}

export interface EmailFeedback {
  source: 'builtin' | 'ai';
  fellBack?: boolean;
  score: number;
  checks: EmailCheck[];
  improvements: { title: string; tip: string }[];
  improved: { subject: string; body: string; from: 'template' | 'ai' };
  notes?: string[];
}

export type SoftKind = 'SPEAKING' | 'PITCH' | 'EMAIL';

export interface SoftAttempt {
  id: string;
  prompt: string;
  response: string;
  feedback: MockFeedback | PitchFeedback | EmailFeedback;
  createdAt: string;
}

export interface SoftSkillsHome {
  dailyPrompt: string;
  pitchPrompts: string[];
  scenarios: { id: string; title: string; brief: string }[];
  history: Record<SoftKind, SoftAttempt[]>;
  aiEnabled: boolean;
}

type Spoken = { prompt: string; response: string; durationSec?: number; mode: 'typed' | 'voice' };

export const softSkillsApi = {
  home: () => api.get<SoftSkillsHome>('/growth/soft-skills'),
  speaking: (data: Spoken) => api.post<{ id: string; feedback: MockFeedback }>('/growth/soft-skills/speaking', data),
  pitch: (data: Spoken) => api.post<{ id: string; feedback: PitchFeedback }>('/growth/soft-skills/pitch', data),
  email: (data: { scenarioId: string; subject: string; body: string }) =>
    api.post<{ id: string; feedback: EmailFeedback }>('/growth/soft-skills/email', data),
};
