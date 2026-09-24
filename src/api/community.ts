import { api } from './client';

/** Campus stories and the student showcase. */

export type StoryKind = 'INTERVIEW' | 'INTERN_DIARY' | 'FIRST_MONTHS';
export type StoryStatus = 'PENDING' | 'PUBLISHED' | 'HIDDEN';
export type ShowcaseVisibility = 'PRIVATE' | 'COLLEGE' | 'RECRUITERS';

export interface Story {
  id: string;
  kind: StoryKind;
  companyId: string | null;
  companyName: string;
  role: string;
  year: number;
  rounds: { name: string; what: string }[];
  body: string;
  difficulty: number | null;
  result: string | null;
  anonymous: boolean;
  /** Null when the author chose to stay anonymous (to other students). */
  author: string | null;
  helpful: number;
  status: StoryStatus;
  mine: boolean;
  createdAt: string;
}

export interface NewStory {
  kind: StoryKind;
  companyId?: string;
  companyName?: string;
  role: string;
  year: number;
  rounds: { name: string; what: string }[];
  body: string;
  difficulty?: number;
  result?: string;
  anonymous: boolean;
}

export interface ShowcaseInviteRow {
  id: string;
  company: { id: string; name: string; logoUrl: string | null };
  jobId: string | null;
  jobTitle: string | null;
  message: string;
  status: 'SENT' | 'SEEN' | 'APPLIED' | 'DECLINED';
  createdAt: string;
}

export interface MyShowcase {
  profile: { pitch: string; videoUrl: string; pinned: string[]; visibility: ShowcaseVisibility };
  projects: { id: string; title: string; description: string | null; link: string | null }[];
  consentGranted: boolean;
  invites: ShowcaseInviteRow[];
}

export interface TalentCard {
  candidateId: string;
  name: string;
  headline: string | null;
  college: { id: string; name: string; code: string } | null;
  course: string | null;
  branch: string | null;
  graduationYear: number | null;
  verified: boolean;
  pitch: string | null;
  videoUrl: string | null;
  skills: string[];
  projects: { id: string; title: string; description: string | null; link: string | null }[];
}

export interface TalentResult {
  students: TalentCard[];
  jobs: { id: string; title: string }[];
  options: {
    courses: string[];
    branches: string[];
    years: number[];
    skills: string[];
    colleges: { id: string; name: string; code: string }[];
  };
}

const qs = (o: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const communityApi = {
  stories: (f: { companyId?: string; kind?: StoryKind; year?: number } = {}) =>
    api.get<{ stories: Story[]; companies: { id: string; name: string }[]; years: number[] }>(`/community/stories${qs(f)}`),
  myStories: () => api.get<{ stories: Story[] }>('/community/stories/mine').then((r) => r.stories),
  storyCompanies: () =>
    api.get<{ companies: { id: string; name: string }[] }>('/community/stories/companies').then((r) => r.companies),
  write: (data: NewStory) => api.post<{ story: Story }>('/community/stories', data).then((r) => r.story),
  remove: (id: string) => api.delete<void>(`/community/stories/${id}`),
  helpful: (id: string) => api.post<{ helpful: number }>(`/community/stories/${id}/helpful`),

  collegeStories: (status?: StoryStatus) =>
    api.get<{ stories: Story[]; counts: Partial<Record<StoryStatus, number>> }>(
      `/community/college/stories${qs({ status })}`,
    ),
  decide: (id: string, status: 'PUBLISHED' | 'HIDDEN', reason?: string) =>
    api.post<{ story: Story }>(`/community/college/stories/${id}/decision`, { status, reason }),

  showcase: () => api.get<MyShowcase>('/community/showcase'),
  saveShowcase: (data: MyShowcase['profile']) => api.put<MyShowcase>('/community/showcase', data),
  respond: (id: string, action: 'SEEN' | 'DECLINED') =>
    api.post<MyShowcase>(`/community/showcase/invites/${id}/respond`, { action }),

  talent: (f: { course?: string; branch?: string; year?: number; skill?: string; collegeId?: string; q?: string }) =>
    api.get<TalentResult>(`/community/talent${qs(f)}`),
  sentInvites: () =>
    api
      .get<{ invites: { id: string; candidateId: string; name: string; jobId: string | null; status: string; createdAt: string }[] }>(
        '/community/talent/invites',
      )
      .then((r) => r.invites),
  invite: (candidateId: string, data: { jobId?: string; message: string }) =>
    api.post<{ invite: { id: string } }>(`/community/talent/${candidateId}/invite`, data),
};
