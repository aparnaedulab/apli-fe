import { api } from './client';

/** Alumni connect and pooled drives. */

export interface MentorProfile {
  available: boolean;
  currentCompany: string | null;
  currentRole: string | null;
  canRefer: boolean;
  topics: string[];
}

export interface Mentor {
  candidateId: string;
  name: string;
  graduationYear: number | null;
  course: string | null;
  specialisation: string | null;
  currentCompany: string | null;
  currentRole: string | null;
  canRefer: boolean;
  topics: string[];
}

export interface AlumniAnswer {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
  by: string;
  byLine: string | null;
}

export interface AlumniQuestion {
  id: string;
  body: string;
  companyName: string | null;
  anonymous: boolean;
  status: 'OPEN' | 'ANSWERED' | 'HIDDEN';
  mine: boolean;
  createdAt: string;
  /** Null when the asker chose to stay anonymous (to other students). */
  askedBy: string | null;
  answers: AlumniAnswer[];
}

export interface Referral {
  id: string;
  company: string;
  role: string;
  message: string;
  status: 'SENT' | 'ACCEPTED' | 'DECLINED';
  createdAt: string;
  other: { name: string; graduationYear: number | null; course: string | null; specialisation: string | null } | null;
}

export interface PoolMember {
  collegeId: string;
  collegeName: string;
  collegeCode: string | null;
  city: string | null;
  status: 'INVITED' | 'JOINED' | 'DECLINED';
  placementId?: string | null;
  students: number;
}

export interface Pool {
  id: string;
  name: string;
  year: number;
  type: 'FINAL' | 'INTERNSHIP';
  hostCollegeId: string;
  hostName: string;
  createdAt: string;
  members: PoolMember[];
  joined: number;
  students: number;
  myStatus?: 'INVITED' | 'JOINED' | 'DECLINED';
}

export interface CampusPools {
  hosted: Pool[];
  invited: Pool[];
  colleges: { id: string; name: string; code: string; city: string }[];
  placements: { id: string; name: string; year: number; type: 'FINAL' | 'INTERNSHIP' }[];
}

export const networkApi = {
  /* --- alumni ----------------------------------------------------------- */
  me: () =>
    api.get<{ isAlumnus: boolean; collegeName: string | null; profile: MentorProfile | null; maxOpenReferrals: number }>(
      '/network/alumni/me',
    ),
  saveProfile: (data: MentorProfile) => api.put<{ profile: MentorProfile }>('/network/alumni/me', data),
  mentors: () => api.get<{ mentors: Mentor[] }>('/network/alumni/mentors').then((r) => r.mentors),
  questions: () => api.get<{ questions: AlumniQuestion[]; isAlumnus: boolean }>('/network/alumni/questions'),
  ask: (data: { body: string; companyName: string; anonymous: boolean }) =>
    api.post<{ question: { id: string } }>('/network/alumni/questions', data),
  answer: (questionId: string, body: string) =>
    api.post<{ answer: { id: string } }>(`/network/alumni/questions/${questionId}/answers`, { body }),
  referrals: () => api.get<{ sent: Referral[]; received: Referral[]; open: number }>('/network/alumni/referrals'),
  requestReferral: (data: { toCandidateId: string; company: string; role: string; message: string }) =>
    api.post<{ referral: { id: string } }>('/network/alumni/referrals', data),
  respondReferral: (id: string, status: 'ACCEPTED' | 'DECLINED') =>
    api.post<{ referral: { id: string; status: string } }>(`/network/alumni/referrals/${id}/respond`, { status }),

  /* --- alumni, the placement cell --------------------------------------- */
  collegeQuestions: () => api.get<{ questions: AlumniQuestion[]; mentors: number }>('/network/college/questions'),
  setQuestionHidden: (id: string, hidden: boolean) =>
    api.post<{ question: { id: string; status: string } }>(`/network/college/questions/${id}/visibility`, { hidden }),
  removeAnswer: (id: string) => api.delete<void>(`/network/college/answers/${id}`),

  /* --- pools, colleges -------------------------------------------------- */
  pools: () => api.get<CampusPools>('/network/pools'),
  createPool: (data: { name: string; year: number; type: 'FINAL' | 'INTERNSHIP'; placementId: string }) =>
    api.post<{ pool: Pool }>('/network/pools', data),
  invite: (poolId: string, collegeIds: string[]) =>
    api.post<{ invited: number; pool: Pool }>(`/network/pools/${poolId}/invites`, { collegeIds }),
  join: (poolId: string, placementId: string) => api.post<{ pool: Pool }>(`/network/pools/${poolId}/join`, { placementId }),
  decline: (poolId: string) => api.post<{ pool: Pool }>(`/network/pools/${poolId}/decline`),

  /* --- pools, companies ------------------------------------------------- */
  companyPools: () => api.get<{ pools: Pool[]; jobs: { id: string; title: string }[] }>('/network/company/pools'),
  sendToPool: (poolId: string, jobId: string) =>
    api.post<{
      created: number;
      alreadyThere: number;
      skippedClosed: number;
      skippedNeedsApproval?: number;
      needsApproval?: string[];
      jobTitle: string;
    }>(
      `/network/company/pools/${poolId}/send`,
      { jobId },
    ),
};
