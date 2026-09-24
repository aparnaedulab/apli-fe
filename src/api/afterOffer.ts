import { api } from './client';

/** Offer protection and two-way reputation. */

export type JoiningStatus = 'AWAITING' | 'CONFIRMED' | 'DELAYED' | 'JOINED' | 'REVOKED';

export interface JoiningHistoryEntry {
  at: string;
  by: 'STUDENT' | 'COMPANY' | 'COLLEGE';
  status: JoiningStatus;
  date?: string | null;
  note?: string | null;
}

export interface JoiningTracker {
  status: JoiningStatus;
  expectedJoiningDate: string | null;
  daysToJoining: number | null;
  overdue: boolean;
  reason: string | null;
  history: JoiningHistoryEntry[];
  updatedAt: string;
}

export interface StudentOffer {
  applicationId: string;
  job: { id: string; title: string };
  company: { id: string; name: string };
  tracker: JoiningTracker;
}

export interface RatingRow {
  applicationId: string;
  status: string;
  job: { title: string };
  company: { id: string; name: string };
  rating: { communication: number; clarity: number; fairness: number; createdAt: string } | null;
}

export type ReliabilityKind = 'ON_TIME' | 'NO_SHOW' | 'RENEGED';

export interface CompanyOfferView {
  offerTaken: boolean;
  tracker: JoiningTracker | null;
  reliability: { kind: ReliabilityKind; note: string | null; at: string } | null;
}

export interface CollegeOfferRow {
  applicationId: string;
  student: string;
  job: { id: string; title: string };
  company: { id: string; name: string };
  tracker: JoiningTracker;
}

export interface CollegeOffers {
  offers: CollegeOfferRow[];
  summary: { total: number; awaiting: number; confirmed: number; delayed: number; joined: number; revoked: number; overdue: number };
  companies: { id: string; name: string }[];
}

export interface CollegeCompanyRow {
  id: string;
  name: string;
  offers: number;
  accepted: number;
  honour: { joined: number; revoked: number; decided: number; enough: boolean; rate: number | null };
  rating: {
    count: number;
    enough: boolean;
    communication: number | null;
    clarity: number | null;
    fairness: number | null;
    overall: number | null;
  } | null;
}

export interface ReliabilityRow {
  applicationId: string;
  student: string;
  company: string;
  job: string;
  kind: ReliabilityKind;
  note: string | null;
  at: string;
}

export const afterOfferApi = {
  studentOffers: () => api.get<{ offers: StudentOffer[] }>('/after-offer/student/offers').then((r) => r.offers),
  studentAct: (
    applicationId: string,
    body:
      | { action: 'CONFIRM' }
      | { action: 'NO_NEWS'; note?: string }
      | { action: 'REPORT_DELAY'; note: string; date?: string }
      | { action: 'REPORT_REVOKED'; note: string },
  ) => api.post<{ tracker: JoiningTracker }>(`/after-offer/student/offers/${applicationId}`, body),
  studentRatings: () =>
    api.get<{ applications: RatingRow[] }>('/after-offer/student/ratings').then((r) => r.applications),
  rate: (applicationId: string, body: { communication: number; clarity: number; fairness: number; note?: string }) =>
    api.post<{ rating: RatingRow['rating'] }>(`/after-offer/student/ratings/${applicationId}`, body),

  companyView: (applicationId: string) =>
    api.get<CompanyOfferView>(`/after-offer/company/applications/${applicationId}`),
  companyJoining: (
    applicationId: string,
    body: { action: 'SET_DATE'; date: string; reason?: string } | { action: 'JOINED' } | { action: 'REVOKE'; reason: string },
  ) => api.post<{ tracker: JoiningTracker }>(`/after-offer/company/applications/${applicationId}/joining`, body),
  markReliability: (applicationId: string, body: { kind: ReliabilityKind; note?: string }) =>
    api.post<{ reliability: CompanyOfferView['reliability'] }>(
      `/after-offer/company/applications/${applicationId}/reliability`,
      body,
    ),

  collegeOffers: (companyId?: string) =>
    api.get<CollegeOffers>(`/after-offer/college/offers${companyId ? `?companyId=${companyId}` : ''}`),
  collegeNote: (applicationId: string, note: string) =>
    api.post<{ tracker: JoiningTracker }>(`/after-offer/college/offers/${applicationId}/note`, { note }),
  collegeCompanies: () =>
    api.get<{ companies: CollegeCompanyRow[]; ratingsShown: boolean }>('/after-offer/college/companies'),
  collegeReliability: () =>
    api.get<{ marks: ReliabilityRow[] }>('/after-offer/college/reliability').then((r) => r.marks),
};

export const JOINING_LABEL: Record<JoiningStatus, string> = {
  AWAITING: 'Waiting for a date to be confirmed',
  CONFIRMED: 'Joining date confirmed',
  DELAYED: 'Joining delayed',
  JOINED: 'Joined',
  REVOKED: 'Offer withdrawn',
};

export const JOINING_PILL: Record<JoiningStatus, string> = {
  AWAITING: 'pill-hold',
  CONFIRMED: 'pill-pass',
  DELAYED: 'pill-hold',
  JOINED: 'pill-pass',
  REVOKED: 'pill-stop',
};

export const BY_LABEL: Record<JoiningHistoryEntry['by'], string> = {
  STUDENT: 'Student',
  COMPANY: 'Company',
  COLLEGE: 'Placement cell',
};

/** "12 Mar 2027" */
export function prettyDate(ymd: string | null): string {
  if (!ymd) return 'not set yet';
  return new Date(`${ymd}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "in 12 days" / "today" / "3 days ago" */
export function relativeDays(n: number | null): string {
  if (n === null) return '';
  if (n === 0) return 'today';
  if (n > 0) return `in ${n} day${n === 1 ? '' : 's'}`;
  return `${-n} day${n === -1 ? '' : 's'} ago`;
}
