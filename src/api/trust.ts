import { api } from './client';

/**
 * The trust checks: why a student cannot apply, and the scam shield.
 * Each call exists only where the institution has the module switched on;
 * the screens ask `hasModule` before calling.
 */

export interface IneligibilityReason {
  code: string;
  text: string;
  required?: string;
  yours?: string;
  fix?: string;
}

export interface NotEligibleRole {
  id: string;
  title: string;
  companyName: string;
  deadline: string;
  reasons: IneligibilityReason[];
}

export interface FeeHit {
  phrase: string;
  snippet: string;
  kind: 'fee' | 'deposit' | 'payment' | 'offer_letter';
}

export type ReportReason = 'FEE_DEMANDED' | 'FAKE_COMPANY' | 'MISLEADING' | 'OTHER';
export type ReportStatus = 'OPEN' | 'REVIEWED' | 'DISMISSED';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'FEE_DEMANDED', label: 'They asked me to pay something' },
  { value: 'FAKE_COMPANY', label: 'The company does not seem real' },
  { value: 'MISLEADING', label: 'The role or pay is not as described' },
  { value: 'OTHER', label: 'Something else' },
];

export interface JobReport {
  id: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  reason: ReportReason;
  note: string | null;
  status: ReportStatus;
  createdAt: string;
  reviewedAt: string | null;
  studentName: string;
}

export const trustApi = {
  notEligible: () => api.get<{ roles: NotEligibleRole[] }>('/trust/not-eligible').then((r) => r.roles),

  scan: (text: string) => api.post<{ hits: FeeHit[] }>('/trust/scan', { text }).then((r) => r.hits),

  report: (jobId: string, reason: ReportReason, note: string) =>
    api.post<{ report: { id: string; reason: ReportReason; status: ReportStatus; createdAt: string } }>(
      `/trust/jobs/${jobId}/report`,
      { reason, note },
    ),

  /** For the college: what it should know before deciding on a role. */
  signals: (jobId: string) => api.get<{ hits: FeeHit[]; reports: JobReport[] }>(`/trust/jobs/${jobId}/signals`),

  reports: (status?: ReportStatus) =>
    api.get<{ reports: JobReport[] }>(`/trust/reports${status ? `?status=${status}` : ''}`).then((r) => r.reports),

  review: (reportId: string, status: 'REVIEWED' | 'DISMISSED') =>
    api.post<{ report: JobReport }>(`/trust/reports/${reportId}/review`, { status }).then((r) => r.report),
};
