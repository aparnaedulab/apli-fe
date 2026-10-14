import { api } from './client';

export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN' | 'REJECTED' | 'OFFERED';

export interface InviteRound {
  order: number;
  name: string;
  type: string;
  isElimination: boolean;
  durationMin: number | null;
  isOnline: boolean;
  description: string | null;
  meetingLink?: string | null;
  addressLine?: string | null;
}

export interface RoundFeedback {
  roundOrder: number;
  roundName: string;
  outcome: 'PASSED' | 'FAILED' | 'SKIPPED' | 'PENDING';
  score: number | null;
  notes: string | null;
}

/** What the company sees */
export interface CompanyInvite {
  id: string;
  role: string;
  message: string | null;
  status: InviteStatus;
  currentRoundOrder: number;
  createdAt: string;
  respondedAt: string | null;
  sentBy: string | null;
  candidate: { id: string; name: string; email: string };
  process: {
    id: string;
    title: string;
    processType: string;
    rounds: InviteRound[];
  };
  roundFeedbacks: RoundFeedback[];
}

/** What the student sees */
export interface StudentInvite {
  id: string;
  role: string;
  message: string | null;
  status: InviteStatus;
  currentRoundOrder: number;
  createdAt: string;
  respondedAt: string | null;
  company: { name: string; logoUrl: string | null };
  process: {
    title: string;
    processType: string;
    rounds: InviteRound[];
  };
  roundFeedbacks: RoundFeedback[];
}

export const INVITE_STATUS_LABEL: Record<InviteStatus, string> = {
  PENDING: 'Pending your reply',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  WITHDRAWN: 'Withdrawn',
  REJECTED: 'Not progressed',
  OFFERED: 'Offer extended',
};

export const INVITE_STATUS_TONE: Record<InviteStatus, string> = {
  PENDING: 'is-hold',
  ACCEPTED: 'is-pass',
  DECLINED: 'is-stop',
  WITHDRAWN: 'is-stop',
  REJECTED: 'is-stop',
  OFFERED: 'is-pass',
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

/* ── Company API ── */
export const companyInviteApi = {
  list: () =>
    api.get<{ invites: CompanyInvite[] }>('/company/interview-invites').then((r) => r.invites),

  get: (id: string) =>
    api.get<{ invite: CompanyInvite }>(`/company/interview-invites/${id}`).then((r) => r.invite),

  send: (data: { candidateId: string; processId: string; role: string; message?: string }) =>
    api.post<{ invite: CompanyInvite }>('/company/interview-invites', data).then((r) => r.invite),

  feedback: (id: string, data: { roundOrder: number; outcome: 'PASSED' | 'FAILED' | 'SKIPPED'; score?: number; notes?: string }) =>
    api.post<{ invite: CompanyInvite }>(`/company/interview-invites/${id}/feedback`, data).then((r) => r.invite),

  withdraw: (id: string) =>
    api.post<{ ok: boolean }>(`/company/interview-invites/${id}/withdraw`),
};

/* ── Student API ── */
export const studentInviteApi = {
  list: () =>
    api.get<{ invites: StudentInvite[] }>('/candidate/interview-invites').then((r) => r.invites),

  respond: (id: string, decision: 'ACCEPTED' | 'DECLINED') =>
    api
      .post<{ invites: StudentInvite[] }>(`/candidate/interview-invites/${id}/respond`, { decision })
      .then((r) => r.invites),
};
