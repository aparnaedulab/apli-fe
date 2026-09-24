import { api } from './client';

/** Institutions approving companies, for those that switch it on. */

export type AccessStatus = 'PENDING' | 'APPROVED' | 'BLOCKED';

export interface Institution {
  tenantId: string;
  name: string;
  shortName: string | null;
  city: string | null;
  state: string | null;
  colleges: number;
  /** NONE: the company has not asked yet. */
  status: AccessStatus | 'NONE';
  note: string | null;
  requestedAt: string | null;
  decidedAt: string | null;
}

export interface AccessRequest {
  companyId: string;
  name: string;
  industry: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
  /** The platform's own verification, shown so an admin never approves an unverified company blind. */
  platformStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  status: AccessStatus;
  note: string | null;
  requestedAt: string;
  decidedAt: string | null;
}

export const companyAccessApi = {
  institutions: () => api.get<{ institutions: Institution[] }>('/company-access/company').then((r) => r.institutions),
  request: (tenantId: string, note?: string) =>
    api.post<{ status: AccessStatus; notified: number }>(`/company-access/company/${tenantId}/request`, { note }),
  requests: () => api.get<{ approvalRequired: boolean; requests: AccessRequest[] }>('/company-access/tenant'),
  decide: (companyId: string, status: AccessStatus, note?: string) =>
    api.post<{ companyId: string; status: AccessStatus }>(`/company-access/tenant/${companyId}/decision`, { status, note }),
};
