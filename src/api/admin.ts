import { api } from './client';

export type CollegeSort = 'name' | 'code' | 'city' | 'students' | 'newest';

export interface CollegeQuery {
  q?: string;
  typeId?: string;
  city?: string;
  affiliated?: 'yes' | 'no' | '';
  hasTeam?: 'yes' | 'no' | '';
  sort?: CollegeSort;
  page?: number;
  limit?: number;
}

export interface CollegeList {
  colleges: CollegeSummary[];
  page: number;
  limit: number;
  total: number;
  pages: number;
  /** Totals for the current filter, not for the whole portal. */
  summary: { colleges: number; students: number; batches: number; withoutTeam: number };
  /** Built from what exists, so a filter can never offer an empty result. */
  filters: {
    types: { id: string; name: string; count: number }[];
    cities: { name: string; count: number }[];
  };
}

export interface CollegeSummary {
  id: string;
  name: string;
  code: string;
  city: string;
  state: string;
  collegeTypeId: string | null;
  type: string | null;
  naacGrade: string | null;
  isVerified: boolean;
  affiliation: string | null;
  createdAt: string;
  memberCount: number;
  batchCount: number;
  studentCount: number;
  placementCount: number;
}

export interface CollegeMember {
  id: string;
  role: 'TPO' | 'COORDINATOR';
  createdAt: string;
  user: { id: string; fullName: string; email: string; isActive: boolean };
}

export interface PendingInvite {
  id: string;
  email: string;
  invitedName: string | null;
  campusRole: 'TPO' | 'COORDINATOR' | null;
  expiresAt: string;
}

export interface CollegeDetail {
  id: string;
  name: string;
  code: string;
  city: string;
  state: string;
  collegeTypeId: string | null;
  type: string | null;
  affiliation: string | null;
  address: string | null;
  pincode: string | null;
  naacGrade: string | null;
  isVerified: boolean;
  createdAt: string;
  members: CollegeMember[];
  invites: PendingInvite[];
  _count: { batches: number; placements: number };
}

export interface AdminStats {
  colleges: number;
  companies: number;
  users: number;
  openDrives: number;
  pendingInvites: number;
}

export const adminApi = {
  stats: () => api.get<{ stats: AdminStats }>('/admin/stats').then((r) => r.stats),

  listColleges: (params: CollegeQuery = {}) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') search.set(key, String(value));
    }
    const qs = search.toString();
    return api.get<CollegeList>(`/admin/colleges${qs ? `?${qs}` : ''}`);
  },

  setCollegeVerified: (id: string, isVerified: boolean) =>
    api.patch<{ college: { id: string; isVerified: boolean } }>(
      `/admin/colleges/${id}/verify`,
      { isVerified },
    ),

  getCollege: (id: string) =>
    api.get<{ college: CollegeDetail }>(`/admin/colleges/${id}`).then((r) => r.college),

  invitePlacementOfficer: (
    collegeId: string,
    data: { email: string; invitedName?: string; campusRole?: 'TPO' | 'COORDINATOR' },
  ) =>
    api.post<{ invite: PendingInvite; link: string }>(`/admin/colleges/${collegeId}/invites`, data),

  cancelInvite: (collegeId: string, inviteId: string) =>
    api.delete<void>(`/admin/colleges/${collegeId}/invites/${inviteId}`),
};

/* --- public invite endpoints ---------------------------------------------- */

export interface InvitePreview {
  kind: 'STUDENT' | 'CAMPUS_MEMBER' | 'COMPANY_MEMBER';
  email: string;
  invitedName: string | null;
  organisation: string | null;
  role: 'CANDIDATE' | 'CAMPUS' | 'COMPANY';
  expiresAt: string;
}

export const inviteApi = {
  preview: (token: string) =>
    api.get<{ invite: InvitePreview }>(`/auth/invite/${token}`).then((r) => r.invite),

  accept: (token: string, data: { fullName: string; password: string }) =>
    api.post<{ user: { id: string; role: string } }>(`/auth/invite/${token}/accept`, data),
};

/* --- companies ------------------------------------------------------------- */

export type CompanyStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';

export interface CompanySummary {
  id: string;
  name: string;
  website: string | null;
  status: CompanyStatus;
  isVerified: boolean;
  industry: string | null;
  city: string | null;
  /** Set only when the company signed itself up. Null means operations entered it. */
  appliedAt: string | null;
  createdAt: string;
  memberCount: number;
  jobCount: number;
}

export interface CompanyList {
  companies: CompanySummary[];
  counts: Partial<Record<CompanyStatus, number>>;
}

export interface CompanyMemberRow {
  id: string;
  /** The role's own name - "Owner", "Recruiter" - and its stable key. */
  roleName: string;
  roleKey: string | null;
  user: { id: string; fullName: string; email: string; isActive: boolean };
}

export interface CompanyDetail {
  id: string;
  name: string;
  legalName: string | null;
  website: string | null;
  careersUrl: string | null;
  linkedinUrl: string | null;
  about: string | null;
  sizeBand: 'STARTUP' | 'SMALL' | 'MID' | 'LARGE' | 'ENTERPRISE' | null;
  foundedYear: number | null;
  gstin: string | null;
  cin: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  industry: { id: string; name: string } | null;
  /** What they typed because nothing on the list fitted; cleared once resolved. */
  industryOther: string | null;
  status: CompanyStatus;
  appliedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  isVerified: boolean;
  members: CompanyMemberRow[];
  invites: {
    id: string;
    email: string;
    invitedName: string | null;
    companyRole: string | null;
    expiresAt: string;
  }[];
  _count: { jobs: number };
}

export const companyAdminApi = {
  list: (status?: CompanyStatus) =>
    api.get<CompanyList>(`/admin/companies${status ? `?status=${status}` : ''}`),

  create: (data: { name: string; website?: string; about?: string; industryId?: string }) =>
    api.post<{ company: CompanySummary }>('/admin/companies', data),

  get: (id: string) => api.get<{ company: CompanyDetail }>(`/admin/companies/${id}`).then((r) => r.company),

  /**
   * The review. Rejecting requires a reason because the company is shown it.
   */
  decide: (id: string, status: CompanyStatus, reason?: string) =>
    api.post<{ company: CompanyDetail }>(`/admin/companies/${id}/decision`, { status, reason }),

  invite: (id: string, data: { email: string; invitedName?: string; companyRole?: string }) =>
    api.post<{ link: string }>(`/admin/companies/${id}/invites`, data),

  cancelInvite: (id: string, inviteId: string) =>
    api.delete<void>(`/admin/companies/${id}/invites/${inviteId}`),
};

export interface IndustryRow {
  id: string;
  name: string;
  isActive: boolean;
  companyCount: number;
}

/** Admin-managed reference data, the same shape as college types. */
export const industryAdminApi = {
  list: (includeRetired = false) =>
    api
      .get<{ industries: IndustryRow[] }>(
        `/admin/industries${includeRetired ? '?includeRetired=true' : ''}`,
      )
      .then((r) => r.industries),

  create: (name: string) =>
    api.post<{ industry: IndustryRow; revived?: boolean }>('/admin/industries', { name }),

  update: (id: string, data: { name?: string; isActive?: boolean }) =>
    api.patch<{ industry: IndustryRow }>(`/admin/industries/${id}`, data),

  /**
   * Settling what a company typed: with an id it is pointed at an industry
   * already on the list, without one what it typed is added.
   */
  resolve: (companyId: string, industryId?: string) =>
    api.post<{ company: { id: string; industry: { id: string; name: string } | null } }>(
      '/admin/industries/resolve',
      { companyId, ...(industryId ? { industryId } : {}) },
    ),

  remove: (id: string) => api.delete<void>(`/admin/industries/${id}`),
};
