import { api } from './client';

export type InterviewKind = 'HR' | 'TECHNICAL' | 'MANAGERIAL';

export interface BankQuestion {
  id?: string;
  text: string;
  type: string;
  isVisible: boolean;
}

export interface BankRound {
  questions: (BankQuestion & { id: string })[];
  /** True until the institution saves this round: these are the built-in questions. */
  isDefault: boolean;
  kinds: { key: InterviewKind; label: string; blurb: string }[];
  roles: { key: string; label: string }[];
  types: string[];
}

/** An institution's mock-interview questions, round by round. */
export const interviewBankApi = {
  round: (kind: InterviewKind, role: string) =>
    api.get<BankRound>(`/admin/interview-questions?kind=${kind}&role=${encodeURIComponent(role)}`),
  save: (kind: InterviewKind, role: string, questions: BankQuestion[]) =>
    api.put<BankRound>('/admin/interview-questions', { kind, role, questions }),
};
