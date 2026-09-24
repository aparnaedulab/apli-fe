import { api } from './client';

/** NEP internships: the student's record, the placement cell's queue, and the mentor's link. */

export type InternshipStatus = 'PROPOSED' | 'APPROVED' | 'ONGOING' | 'COMPLETED' | 'REJECTED' | 'WITHDRAWN';
export type Queue = 'to_approve' | 'ongoing' | 'to_evaluate' | 'completed' | 'closed';

export interface InternshipLog {
  id: string;
  weekStart: string;
  hours: number;
  summary: string;
  reviewedAt: string | null;
  reviewerNote: string | null;
}

export interface Internship {
  id: string;
  organisation: string;
  role: string;
  mode: string | null;
  companyId: string | null;
  jobId: string | null;
  startDate: string;
  endDate: string;
  hoursPerWeek: number | null;
  credits: number | null;
  suggestedCredits: number | null;
  requiredHours: number | null;
  hoursLogged: number;
  status: InternshipStatus;
  decisionNote: string | null;
  mentorName: string | null;
  mentorEmail: string | null;
  evaluation: { score: number | null; note: string | null; at: string } | null;
  mentorLinkIssued: boolean;
  certificateUrl: string | null;
  abcSubmittedAt: string | null;
  hasEnded: boolean;
  logs: InternshipLog[];
  createdAt: string;
}

export interface CollegeInternship extends Internship {
  queue: Queue;
  student: { id: string; name: string; email: string; prn: string | null; course: string | null };
}

export interface ImportableOffer {
  applicationId: string;
  jobId: string;
  organisation: string;
  role: string;
  startDate: string | null;
  months: number | null;
}

export interface ProposalInput {
  organisation: string;
  role: string;
  mode: string;
  startDate: string;
  endDate: string;
  hoursPerWeek?: number;
  mentorName: string;
  mentorEmail: string;
}

export interface CollegeSummary {
  to_approve: number;
  ongoing: number;
  to_evaluate: number;
  completed: number;
  closed: number;
  creditsAwarded: number;
  hoursLogged: number;
  logsToReview: number;
}

export interface MentorLink {
  link: string;
  emailed: 'sent' | 'failed' | 'no email';
}

export interface ReviewPreview {
  student: string;
  college: string | null;
  organisation: string;
  role: string;
  startDate: string;
  endDate: string;
  mentorName: string | null;
  weeksLogged: number;
  hoursLogged: number;
}

type Mine = { internships: Internship[]; importable: ImportableOffer[] };

export const internshipApi = {
  /* the student */
  mine: () => api.get<Mine>('/internships/mine'),
  propose: (data: ProposalInput) => api.post<{ internship: string }>('/internships/mine', data),
  importOffer: (applicationId: string) =>
    api.post<{ internship: string }>(`/internships/mine/import/${applicationId}`),
  editProposal: (id: string, data: ProposalInput) =>
    api.put<{ internships: Internship[] }>(`/internships/mine/${id}`, data),
  withdraw: (id: string) => api.post<{ internships: Internship[] }>(`/internships/mine/${id}/withdraw`),
  addLog: (id: string, data: { weekOf: string; hours: number; summary: string }) =>
    api.post<{ internships: Internship[] }>(`/internships/mine/${id}/logs`, data),
  editLog: (id: string, logId: string, data: { hours: number; summary: string }) =>
    api.put<{ internships: Internship[] }>(`/internships/mine/${id}/logs/${logId}`, data),

  /* the placement cell */
  college: (queue?: Queue | 'all') =>
    api.get<{ internships: CollegeInternship[]; summary: CollegeSummary }>(
      `/internships/college${queue ? `?queue=${queue}` : ''}`,
    ),
  collegeOne: (id: string) =>
    api.get<{ internship: CollegeInternship }>(`/internships/college/${id}`).then((r) => r.internship),
  decide: (id: string, data: { approve: boolean; note?: string; credits?: number }) =>
    api.post<{ internship: CollegeInternship; mentor: MentorLink | null }>(`/internships/college/${id}/decision`, data),
  mentorLink: (id: string) => api.post<{ mentor: MentorLink }>(`/internships/college/${id}/mentor-link`),
  reviewLog: (id: string, logId: string, note?: string) =>
    api.post<{ internship: CollegeInternship }>(`/internships/college/${id}/logs/${logId}/review`, { note }),
  setCredits: (id: string, credits: number) =>
    api.put<{ internship: CollegeInternship }>(`/internships/college/${id}/credits`, { credits }),
  complete: (id: string, certificateUrl?: string) =>
    api.post<{ internship: CollegeInternship }>(`/internships/college/${id}/complete`, { certificateUrl }),
  markAbc: (id: string, at?: string) =>
    api.post<{ internship: CollegeInternship }>(`/internships/college/${id}/abc`, { at }),

  /* the mentor (no login) */
  reviewPreview: (token: string) =>
    api.get<{ internship: ReviewPreview }>(`/internships/review/${token}`).then((r) => r.internship),
  submitReview: (token: string, data: { score: number; note: string }) =>
    api.post<{ ok: true }>(`/internships/review/${token}`, data),
};

/** Shared by the student and college screens. */
export const HOURS_PER_CREDIT = 30;

export function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

export function weeksBetween(start: string, end: string): number {
  const days = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000) + 1;
  return Math.max(1, Math.ceil(days / 7));
}

/** The same suggestion the server makes, so the form can show it before anything is saved. */
export function suggestCredits(hoursPerWeek: number | undefined, start: string, end: string): number | null {
  if (!hoursPerWeek || !start || !end || end < start) return null;
  const hours = hoursPerWeek * weeksBetween(start, end);
  return Math.max(0.5, Math.round((hours / HOURS_PER_CREDIT) * 2) / 2);
}

/** Monday of the week a date falls in, as YYYY-MM-DD. */
export function mondayOf(d: Date): string {
  const day = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const offset = (day.getUTCDay() + 6) % 7;
  return new Date(day.getTime() - offset * 86_400_000).toISOString().slice(0, 10);
}
