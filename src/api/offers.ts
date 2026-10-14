import { api } from './client';

/**
 * Internship offers. A company offers one student an internship - only a
 * student who has shown it their work - and the student accepts or declines.
 * An offer still waiting past its reply-by date has LAPSED.
 */

export type WorkMode = 'REMOTE' | 'OFFICE' | 'HYBRID';
export type OfferStatus = 'SENT' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN' | 'LAPSED';

export const WORK_MODE_LABEL: Record<WorkMode, string> = {
  REMOTE: 'Remote',
  OFFICE: 'At the office',
  HYBRID: 'Hybrid',
};

export const OFFER_STATUS: Record<OfferStatus, { label: string; tone: string }> = {
  SENT: { label: 'Waiting for an answer', tone: 'is-review' },
  ACCEPTED: { label: 'Accepted', tone: 'is-verified' },
  DECLINED: { label: 'Declined', tone: 'is-changes' },
  WITHDRAWN: { label: 'Withdrawn', tone: '' },
  LAPSED: { label: 'Reply date passed', tone: '' },
};

interface OfferBase {
  id: string;
  role: string;
  about: string;
  workMode: WorkMode;
  city: string | null;
  months: number;
  startsOn: string | null;
  /** Rupees a month; null when unpaid. */
  stipend: number | null;
  respondBy: string;
  status: OfferStatus;
  respondedAt: string | null;
  studentNote: string | null;
  createdAt: string;
  /** The simulation work that led to it. */
  simulation: { title: string; slug: string } | null;
}

export interface CompanyOffer extends OfferBase {
  sentBy: string;
  student: { id: string; name: string; email: string; phone: string | null; college: string | null; course: string | null };
}

export interface StudentOffer extends OfferBase {
  company: { name: string; logoUrl: string | null; website: string | null; city: string | null };
  /** Who to talk to - only once the student has accepted. */
  contact: { name: string; email: string } | null;
}

export interface OfferBody {
  candidateId: string;
  runId?: string | null;
  role: string;
  about: string;
  workMode: WorkMode;
  city?: string | null;
  months: number;
  startsOn?: string | null;
  stipend?: number | null;
  respondBy: string;
  noFee: boolean;
}

export const offersApi = {
  company: () => api.get<{ offers: CompanyOffer[] }>('/company-app/offers').then((r) => r.offers),
  send: (body: OfferBody) => api.post<{ offers: CompanyOffer[] }>('/company-app/offers', body).then((r) => r.offers),
  withdraw: (id: string) => api.post<{ offers: CompanyOffer[] }>(`/company-app/offers/${id}/withdraw`).then((r) => r.offers),
  mine: () => api.get<{ offers: StudentOffer[] }>('/student-app/offers').then((r) => r.offers),
  respond: (id: string, decision: 'accept' | 'decline', note?: string) =>
    api.post<{ offers: StudentOffer[] }>(`/student-app/offers/${id}/respond`, { decision, note }).then((r) => r.offers),
};

/** "₹15,000 a month", or "Unpaid". */
export const stipendText = (v: number | null) => (v ? `₹${v.toLocaleString('en-IN')} a month` : 'Unpaid');

/** "Hybrid · Pune" */
export const placeText = (o: { workMode: WorkMode; city: string | null }) =>
  [WORK_MODE_LABEL[o.workMode], o.city].filter(Boolean).join(' · ');

export const dateText = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
