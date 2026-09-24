import { api } from './client';

/** The skill-demand heatmap and the WhatsApp message log. */

export type InsightScope = 'college' | 'tenant';

export interface SkillRow {
  skillId: string;
  skill: string;
  roles: number;
  required: number;
  niceToHave: number;
  openings: number;
  demandPct: number;
  students: number;
  coveragePct: number | null;
  gap: number;
}

export interface SkillHeatmap {
  scope: { kind: InsightScope; name: string };
  year: number | null;
  years: number[];
  rolesAnalysed: number;
  pool: number;
  poolBasis: 'drive batches' | 'passing year' | 'none';
  skills: SkillRow[];
  grid: {
    branches: { key: string; course: string | null; branch: string | null; students: number }[];
    rows: { skillId: string; skill: string; cells: (number | null)[] }[];
  };
  rising: { skill: string; now: number; before: number; change: number }[];
  perCollege?: { collegeId: string; name: string; students: number; roles: number }[];
  notes: string[];
}

export type MessageStatus = 'QUEUED' | 'SENT' | 'FAILED' | 'SKIPPED';

export interface MessageLog {
  configured: boolean;
  types: string[];
  counts: Record<MessageStatus, number>;
  messages: {
    id: string;
    student: string;
    template: string;
    toMasked: string;
    status: MessageStatus;
    error: string | null;
    createdAt: string;
  }[];
}

export const insightsApi = {
  skills: (scope: InsightScope, year?: number) =>
    api.get<SkillHeatmap>(`/insights/skills/${scope}${year ? `?year=${year}` : ''}`),
  messages: () => api.get<MessageLog>('/insights/whatsapp/college'),
};
