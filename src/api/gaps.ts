import { api } from './client';

/**
 * Screens for endpoints that already existed but had nowhere to be seen: the
 * college's consent totals, alumni moderation, students' role reports, and
 * an institution's own rules after onboarding.
 */

/* ------------------------------------------------------------------ consent */

export interface ConsentCount {
  key: string;
  title: string;
  neededToApply: boolean;
  students: number;
  granted: number;
  withdrew: number;
  declined: number;
  neverAnswered: number;
}

/**
 * What each purpose means, in the words the student read. Kept here as well as
 * on the server because the totals endpoint returns counts, not the wording.
 */
export const CONSENT_EXPLAIN: Record<string, string> = {
  share_profile_with_recruiters:
    'Your name, contact details, education and projects go to the company - only for roles you apply to.',
  share_marks_with_recruiters:
    'CGPA, percentages and backlogs as your college verified them, so a company can check you meet its bar.',
  placement_statistics:
    'Your placement result is included, without your name, in the reports your college files with NAAC and NIRF.',
  showcase_to_recruiters:
    'Recruiters on the platform may see your profile and invite you to apply, even for roles you have not seen.',
  contact_on_whatsapp: 'Drive dates, deadlines and application updates on WhatsApp as well as in the app.',
};

/* ------------------------------------------------------------------- alumni */

export type QuestionStatus = 'OPEN' | 'ANSWERED' | 'HIDDEN';

export interface ModAnswer {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
  by: string;
  byLine: string | null;
}

export interface ModQuestion {
  id: string;
  body: string;
  companyName: string | null;
  anonymous: boolean;
  status: QuestionStatus;
  mine: boolean;
  createdAt: string;
  /** The real name, even when students see "Anonymous" - moderation needs it. */
  askedBy: string;
  answers: ModAnswer[];
}

/* -------------------------------------------------------------- role flags */

export type ReportStatus = 'OPEN' | 'REVIEWED' | 'DISMISSED';

export interface RoleReport {
  id: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  reason: string;
  note: string | null;
  status: ReportStatus;
  createdAt: string;
  reviewedAt: string | null;
  studentName: string;
}

/* ------------------------------------------------------- institution rules */

export interface InstitutionRules {
  oneOfferDefault: boolean;
  allowSelfJoin: boolean;
  responseDays: number;
  companyApprovalRequired: boolean;
  /** Whether a company can sign in while the platform is still checking it. */
  unverifiedCompanyAccess: boolean;
}

export const gapsApi = {
  consentCounts: () => api.get<{ purposes: ConsentCount[] }>('/consent/college').then((r) => r.purposes),

  alumniQuestions: () => api.get<{ questions: ModQuestion[]; mentors: number }>('/network/college/questions'),
  setQuestionHidden: (id: string, hidden: boolean) =>
    api.post<{ question: { id: string; status: QuestionStatus } }>(`/network/college/questions/${id}/visibility`, { hidden }),
  deleteAnswer: (id: string) => api.delete<void>(`/network/college/answers/${id}`),

  reports: (status?: ReportStatus) =>
    api.get<{ reports: RoleReport[] }>(`/trust/reports${status ? `?status=${status}` : ''}`).then((r) => r.reports),
  reviewReport: (id: string, status: 'REVIEWED' | 'DISMISSED') =>
    api.post<{ report: RoleReport }>(`/trust/reports/${id}/review`, { status }),

  rules: () => api.get<{ rules: InstitutionRules }>('/admin/institution-rules').then((r) => r.rules),
  saveRules: (rules: Partial<InstitutionRules>) =>
    api.put<{ rules: InstitutionRules }>('/admin/institution-rules', rules).then((r) => r.rules),
};

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
