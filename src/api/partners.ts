import { api } from './client';

export type PartnerKind = 'UNIVERSITY' | 'COLLEGE';
export type PartnerRequestStatus = 'NEW' | 'CONTACTED' | 'CLOSED';

export interface PartnerRequestInput {
  kind: PartnerKind;
  institutionName: string;
  city: string;
  state?: string;
  contactName: string;
  contactRole: string;
  email: string;
  phone?: string;
  students?: number;
  message?: string;
}

export interface PartnerRequest extends Required<Omit<PartnerRequestInput, 'state' | 'phone' | 'students' | 'message'>> {
  id: string;
  state: string | null;
  phone: string | null;
  students: number | null;
  message: string | null;
  status: PartnerRequestStatus;
  createdAt: string;
}

/** A university or college asking to partner; the platform team's list of them. */
export const partnersApi = {
  request: (body: PartnerRequestInput) => api.post<{ request: { id: string } }>('/public/partner-requests', body),
  list: () => api.get<{ requests: PartnerRequest[] }>('/platform/partner-requests').then((r) => r.requests),
  setStatus: (id: string, status: PartnerRequestStatus) =>
    api.patch<{ request: PartnerRequest }>(`/platform/partner-requests/${id}`, { status }),
};
