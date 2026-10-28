import { api } from './client';

/**
 * Interview invites: a company invites a student whose work it has seen into
 * one of its interview processes; the student accepts, then goes through the
 * rounds - a recorded interview in the app, a work simulation, or a round the
 * company runs itself - and the company gives a verdict on each.
 */

export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN' | 'REJECTED' | 'OFFERED';
export type Outcome = 'PASSED' | 'FAILED' | 'SKIPPED' | 'PENDING';

export interface RoundFeedback {
  roundOrder: number;
  roundName: string;
  outcome: Outcome;
  /** The company's score and notes - only the company sees them. */
  score: number | null;
  notes: string | null;
}

interface RoundBase {
  order: number;
  name: string;
  type: string;
  typeLabel: string;
  isElimination: boolean;
  durationMin: number | null;
  isOnline: boolean;
  meetingLink: string | null;
  addressLine: string | null;
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
  candidate: { id: string; name: string; email: string; phone: string | null; college: string | null; course: string | null };
  process: {
    id: string;
    title: string;
    processType: string;
    rounds: (RoundBase & {
      questions: { id: string; text: string; answer: { fileUrl: string; seconds: number | null; at: string } | null }[];
    })[];
  };
  roundFeedbacks: RoundFeedback[];
}

/** What the student sees */
export interface StudentRound extends RoundBase {
  description: string | null;
  simulation: { slug: string; title: string } | null;
  video: {
    questionTimeSec: number;
    prepTimeSec: number;
    count: number;
    /** The company has judged the round: answers are final. */
    locked: boolean;
    /** Only for the round they are in. */
    questions: { id: string; text: string; hint: string | null; answer: { fileUrl: string; seconds: number | null } | null }[];
  } | null;
}

export interface StudentInvite {
  id: string;
  role: string;
  message: string | null;
  status: InviteStatus;
  currentRoundOrder: number;
  createdAt: string;
  respondedAt: string | null;
  company: { name: string; logoUrl: string | null; website: string | null };
  process: { title: string; processType: string; rounds: StudentRound[] };
  roundFeedbacks: RoundFeedback[];
}

export const INVITE_STATUS: Record<InviteStatus, { label: string; tone: string }> = {
  PENDING: { label: 'Waiting for a reply', tone: 'is-review' },
  ACCEPTED: { label: 'In progress', tone: 'is-working' },
  DECLINED: { label: 'Declined', tone: '' },
  WITHDRAWN: { label: 'Withdrawn', tone: '' },
  REJECTED: { label: 'Not taken further', tone: 'is-changes' },
  OFFERED: { label: 'Cleared every round', tone: 'is-verified' },
};

/** Kept for older screens. */
export const INVITE_STATUS_LABEL: Record<InviteStatus, string> = Object.fromEntries(
  Object.entries(INVITE_STATUS).map(([k, v]) => [k, v.label]),
) as Record<InviteStatus, string>;

export const ROUND_TYPE_ICONS: Record<string, string> = {
  RESUME_SCREEN: '📄',
  MCQ_TEST: '📝',
  VIDEO_INTERVIEW: '🎥',
  LIVE_INTERVIEW: '🎙️',
  GROUP_DISCUSSION: '🗣️',
  ASSIGNMENT: '📋',
  WORK_SIMULATION: '💼',
};
export const roundIcon = (type: string) => ROUND_TYPE_ICONS[type] ?? '🧩';

/* ── Company API ── */
export const companyInviteApi = {
  list: () => api.get<{ invites: CompanyInvite[] }>('/company/interview-invites').then((r) => r.invites),
  get: (id: string) => api.get<{ invite: CompanyInvite }>(`/company/interview-invites/${id}`).then((r) => r.invite),
  send: (data: { candidateId: string; processId: string; role: string; message?: string }) =>
    api.post<{ invite: CompanyInvite }>('/company/interview-invites', data).then((r) => r.invite),
  feedback: (
    id: string,
    data: { roundOrder: number; outcome: 'PASSED' | 'FAILED' | 'SKIPPED'; score?: number; notes?: string },
  ) => api.post<{ invite: CompanyInvite }>(`/company/interview-invites/${id}/feedback`, data).then((r) => r.invite),
  withdraw: (id: string) => api.post<{ ok: boolean }>(`/company/interview-invites/${id}/withdraw`),
};

/* ── Student API ── */
export const studentInviteApi = {
  list: () => api.get<{ invites: StudentInvite[] }>('/candidate/interview-invites').then((r) => r.invites),
  respond: (id: string, decision: 'ACCEPTED' | 'DECLINED') =>
    api
      .post<{ invites: StudentInvite[] }>(`/candidate/interview-invites/${id}/respond`, { decision })
      .then((r) => r.invites),
  /** A recorded answer to one question; recording again replaces it. */
  answer: (id: string, questionId: string, video: Blob, seconds: number) => {
    const form = new FormData();
    form.append('file', video, video.type.includes('mp4') ? 'answer.mp4' : 'answer.webm');
    form.append('seconds', String(Math.round(seconds)));
    return api
      .upload<{ invites: StudentInvite[] }>(`/candidate/interview-invites/${id}/answers/${questionId}`, form)
      .then((r) => r.invites);
  },
};
