import { api } from './client';

export type CompanyStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
export type CompanySize = 'STARTUP' | 'SMALL' | 'MID' | 'LARGE' | 'ENTERPRISE';

/** One picture on a company's page: the office, the team, the work. */
export interface CompanyPhoto {
  url: string;
  caption?: string;
}

/** The most a page shows - the server refuses more. */
export const MAX_PHOTOS = 6;

/** The most a single post carries - the server refuses more. */
export const MAX_MEDIA = 4;

/** A picture or a video inside a post. */
export interface PostMedia {
  kind: 'image' | 'video';
  url: string;
  caption?: string;
}

export interface CompanyPost {
  id: string;
  title: string | null;
  /** Sanitised by the server before it was stored. */
  bodyHtml: string;
  media: PostMedia[];
  /** Null means it is still a draft, seen by nobody outside the company. */
  publishedAt: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PostEdit {
  title?: string;
  bodyHtml?: string;
  media?: PostMedia[];
  publish?: boolean;
}

export interface CompanyProfile {
  id: string;
  name: string;
  legalName: string | null;
  website: string | null;
  careersUrl: string | null;
  linkedinUrl: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  photos: CompanyPhoto[];
  headline: string | null;
  about: string | null;
  sizeBand: CompanySize | null;
  foundedYear: number | null;
  gstin: string | null;
  cin: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  pincode: string | null;
  industry: { id: string; name: string } | null;
  /** What they typed when nothing on the list fitted; cleared once resolved. */
  industryOther?: string | null;
  status: CompanyStatus;
  appliedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  isVerified: boolean;
  statusNote: string | null;
}

/** The fields a company may change about itself. Never its name. */
export type CompanyProfileEdit = Partial<
  Pick<
    CompanyProfile,
    | 'legalName'
    | 'website'
    | 'careersUrl'
    | 'linkedinUrl'
    | 'logoUrl'
    | 'coverUrl'
    | 'photos'
    | 'headline'
    | 'about'
    | 'city'
    | 'state'
    | 'address'
    | 'pincode'
  >
> & {
  industryId?: string;
  industryOther?: string;
  sizeBand?: CompanySize | '';
  foundedYear?: number;
  /** The page's own words. They live on the company, beside `about`. */
  whyJoin?: string;
  howWeHire?: string;
};

export interface CompanyOverview {
  company: CompanyProfile | null;
  myRole: 'OWNER' | 'RECRUITER' | 'INTERVIEWER' | null;
  stats: {
    jobs: number;
    published: number;
    drafts: number;
    applications: number;
    pendingInvites: number;
  };
  funnel: Record<string, number>;
}

/**
 * A role as the team screen reads it.
 *
 * Roles stopped being a fixed OWNER/RECRUITER/INTERVIEWER list when they
 * became data the platform keeps, so this carries what the role may do rather
 * than a name the screen would have to interpret.
 */
export interface CompanyRoleRef {
  id: string;
  name: string;
  permissions?: string[];
}

export interface TeamMember {
  id: string;
  role: CompanyRoleRef;
  isMe: boolean;
  user: { id: string; fullName: string; email: string; isActive: boolean };
}

export interface TeamInvite {
  id: string;
  email: string;
  invitedName: string | null;
  role: CompanyRoleRef | null;
  expiresAt: string;
}

export const companyApi = {
  overview: () => api.get<CompanyOverview>('/company/overview'),

  saveProfile: (data: CompanyProfileEdit) =>
    api.patch<{ company: CompanyProfile }>('/company/profile', data).then((r) => r.company),

  /**
   * Stores a picture and hands back its address. Nothing on the company
   * changes until the profile is saved with that address.
   */
  uploadImage: (kind: 'logo' | 'cover' | 'photo', file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.upload<{ url: string }>(`/company/uploads/${kind}`, form).then((r) => r.url);
  },

  /** The team, and what the person asking may do to it. */
  team: () =>
    api.get<{ members: TeamMember[]; invites: TeamInvite[]; myPermissions: string[] }>(
      '/company/team',
    ),

  invite: (data: { email: string; invitedName?: string; roleId: string }) =>
    api.post<{ link: string }>('/company/team/invites', data),

  /** Changes what a colleague may do, including whether they run the account. */
  setMemberRole: (memberId: string, roleId: string) =>
    api.patch<{ member: TeamMember }>(`/company/team/${memberId}`, { roleId }),

  cancelInvite: (id: string) => api.delete<void>(`/company/team/invites/${id}`),

  removeMember: (memberId: string) => api.delete<void>(`/company/team/${memberId}`),
};

/** The company's own feed: what it has posted, and what is still a draft. */
export const companyPostsApi = {
  mine: () => api.get<{ posts: CompanyPost[] }>('/company/posts').then((r) => r.posts),

  create: (data: PostEdit) => api.post<{ post: CompanyPost }>('/company/posts', data).then((r) => r.post),

  update: (id: string, data: PostEdit) =>
    api.patch<{ post: CompanyPost }>(`/company/posts/${id}`, data).then((r) => r.post),

  remove: (id: string) => api.delete<void>(`/company/posts/${id}`),

  pin: (id: string, pinned: boolean) =>
    api.post<{ post: CompanyPost }>(`/company/posts/${id}/pin`, { pinned }).then((r) => r.post),

  /**
   * Stores a picture or a video and hands back its address. Nothing appears on
   * a post until the post itself is saved with that address.
   */
  uploadMedia: (kind: 'image' | 'video', file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.upload<{ kind: 'image' | 'video'; url: string }>(`/company/posts/media?kind=${kind}`, form);
  },
};
