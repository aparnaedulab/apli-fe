import { api } from './client';

export interface CampusOverview {
  college: { name: string; city: string | null } | null;
  stats: {
    batches: number;
    students: number;
    frozen: number;
    unverified: number;
    pendingInvites: number;
    drives: number;
    pendingPostings: number;
    /** People with a login at this college, the officer included. */
    teamMembers: number;
    teamInvites: number;
    drivesEver: number;
    acceptedPostings: number;
  };
}

export interface BatchSummary {
  id: string;
  /** Chosen by the college. The only thing a batch must have. */
  name: string;
  course: string | null;
  specialisation: string | null;
  graduationYear: number | null;
  /** 1 for first year, 2 for second - for groups that stay put as people move through. */
  studyYear: number | null;
  headOfDept: string | null;
  joinCodeEnabled: boolean;
  studentCount: number;
  frozenCount: number;
}

export interface RosterStudent {
  membershipId: string;
  candidateId: string;
  name: string;
  email: string;
  rollNo: string | null;
  division: string | null;
  prn: string | null;
  phone: string | null;
  cgpa: string | null;
  isFrozen: boolean;
  verifiedAt: string | null;
  joinedAt: string;
  hasResume: boolean;
  hasClaimed: boolean;
}

export interface BatchDetail {
  batch: BatchSummary & { joinCode: string | null; joinLink: string | null };
  students: RosterStudent[];
  invites: { id: string; email: string; expiresAt: string }[];
}

export interface BulkInviteResult {
  created: { email: string; link: string }[];
  skipped: { email: string; reason: string }[];
}

export interface NewBatch {
  /** Optional: one is derived from the other fields when it is left out. */
  name?: string;
  course?: string;
  specialisation?: string;
  graduationYear?: number;
  studyYear?: number;
  headOfDept?: string;
}

export const campusApi = {
  overview: () => api.get<CampusOverview>('/campus/overview'),

  listBatches: () => api.get<{ batches: BatchSummary[] }>('/campus/batches').then((r) => r.batches),

  createBatch: (data: NewBatch) =>
    api.post<{ batch: BatchSummary }>('/campus/batches', data).then((r) => r.batch),

  getBatch: (id: string) => api.get<BatchDetail>(`/campus/batches/${id}`),

  inviteStudents: (batchId: string, emails: string[]) =>
    api.post<BulkInviteResult>(`/campus/batches/${batchId}/invites`, { emails }),

  enableJoinLink: (batchId: string) =>
    api.post<{ joinLink: string; joinCode: string }>(`/campus/batches/${batchId}/join-code`),

  disableJoinLink: (batchId: string) =>
    api.delete<void>(`/campus/batches/${batchId}/join-code`),

  removeStudent: (batchId: string, membershipId: string) =>
    api.delete<void>(`/campus/batches/${batchId}/members/${membershipId}`),

  cancelInvite: (inviteId: string) => api.delete<void>(`/campus/invites/${inviteId}`),

  freeze: (batchId: string, membershipIds: string[], rollNos?: Record<string, string>) =>
    api.post<{ frozen: number }>(`/campus/batches/${batchId}/freeze`, { membershipIds, rollNos }),

  unfreeze: (batchId: string, membershipIds: string[]) =>
    api.post<{ unfrozen: number }>(`/campus/batches/${batchId}/unfreeze`, { membershipIds }),

  getStudent: (candidateId: string) =>
    api.get<{ profile: unknown; membership: unknown }>(`/campus/students/${candidateId}`),
};

/* --- public batch join ----------------------------------------------------- */

export interface JoinPreview {
  batchName: string;
  course: string;
  specialisation: string | null;
  graduationYear: number;
  collegeName: string;
}

export const joinApi = {
  preview: (code: string) =>
    api.get<{ batch: JoinPreview }>(`/auth/join/${code}`).then((r) => r.batch),

  accept: (code: string, data: { fullName: string; email: string; password: string }) =>
    api.post<{ user: { id: string; role: string } }>(`/auth/join/${code}/accept`, data),
};

/* --- placement drives ------------------------------------------------------ */

export interface PlacementSummary {
  id: string;
  name: string;
  type: 'FINAL' | 'INTERNSHIP';
  year: number;
  isOpen: boolean;
  oneOfferRule: boolean;
  batchCount: number;
  studentCount: number;
  jobCount: number;
  applicationCount: number;
}

export interface PlacementBatch {
  id: string;
  name: string;
  course: string;
  graduationYear: number;
  studentCount: number;
}

export interface PlacementDetail {
  placement: Omit<PlacementSummary, 'batchCount'> & {
    batches: PlacementBatch[];
    verifiedCount: number;
  };
  allBatches: { id: string; name: string; course: string; graduationYear: number }[];
}

export const placementApi = {
  list: () =>
    api.get<{ placements: PlacementSummary[] }>('/campus/placements').then((r) => r.placements),

  create: (data: {
    name: string;
    type: 'FINAL' | 'INTERNSHIP';
    year: number;
    oneOfferRule: boolean;
    batchIds: string[];
  }) => api.post<{ placement: PlacementSummary }>('/campus/placements', data),

  get: (id: string) => api.get<PlacementDetail>(`/campus/placements/${id}`),

  update: (id: string, data: { name?: string; isOpen?: boolean; oneOfferRule?: boolean }) =>
    api.patch<{ placement: PlacementSummary }>(`/campus/placements/${id}`, data),

  setBatches: (id: string, batchIds: string[]) =>
    api.put<{ batchCount: number }>(`/campus/placements/${id}/batches`, { batchIds }),

  remove: (id: string) => api.delete<void>(`/campus/placements/${id}`),

  summary: (id: string) =>
    api.get<{ summary: DriveSummary }>(`/campus/placements/${id}/summary`).then((r) => r.summary),
};

export interface DriveSummary {
  studentCount: number;
  placed: number;
  placedPercent: number;
  companiesVisiting: number;
  applications: number;
  byStatus: Record<string, number>;
  highestCtc: number | null;
  averageCtc: number | null;
  recentOffers: { company: string; role: string; status: string }[];
}

/* --- incoming job requests (the approval gate) ----------------------------- */

export interface PostingRow {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  decidedAt: string | null;
  declineReason: string | null;
  placementName: string;
  placementYear: number;
  jobId: string;
  title: string;
  jobType: string;
  location: string | null;
  ctcMin: string | null;
  ctcMax: string | null;
  deadline: string;
  jobStatus: string;
  companyName: string;
  companyVerified: boolean;
  roundCount: number;
}

export interface PostingDetail {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  decidedAt: string | null;
  decidedBy: string | null;
  declineReason: string | null;
  placement: {
    id: string;
    name: string;
    year: number;
    batches: {
      id: string;
      name: string;
      course: string;
      graduationYear: number;
      studentCount: number;
    }[];
  };
  eligibleCount: number;
  job: {
    id: string;
    title: string;
    description: string;
    responsibilities: string | null;
    jobType: string;
    /** What the company calls it, which may be its own word. */
    jobTypeLabel: string | null;
    location: string | null;
    /** Where exactly, where the company gave one. */
    addressLine: string | null;
    pincode: string | null;
    mapsLink: string | null;
    mapEmbedUrl: string | null;
    /** How it was quoted. The figures are per year either way. */
    payPeriod: 'YEARLY' | 'MONTHLY';
    ctcMin: string | null;
    ctcMax: string | null;
    ctcFixed: string | null;
    openings: number | null;
    bondMonths: number | null;
    bondAmount: string | null;
    bondNote: string | null;
    genderEligibility: 'ANY' | 'WOMEN_PREFERRED' | 'WOMEN' | 'MEN';
    genderNote: string | null;
    pwdSuitable: 'YES' | 'NO' | null;
    pwdCategories: string[] | null;
    accommodations: string[] | null;
    inclusionNote: string | null;
    shift: string | null;
    travel: string | null;
    relocationRequired: boolean;
    nightShiftSafety: string | null;
    designation: string | null;
    sector: string | null;
    employerType: 'DIRECT' | 'SUBSIDIARY' | 'THIRD_PARTY' | null;
    employerName: string | null;
    probationMonths: number | null;
    probationCtc: string | null;
    trainingMonths: number | null;
    trainingLocation: string | null;
    trainingStipend: string | null;
    ctcIncludes: string[] | null;
    ctcNote: string | null;
    resultDays: number | null;
    offerLetterDays: number | null;
    offerConditional: 'YES' | 'NO' | null;
    offerConditions: string[] | null;
    offerConditionNote: string | null;
    noFeeDeclaredAt: string | null;
    deadline: string;

    /** The conditions a student has to accept, which the college fields the
     *  complaints about. Worth reading before accepting the posting. */
    terms: string[];
    screeningTestName: string | null;
    screeningTestUrl: string | null;
    screeningTestDeadline: string | null;
    screeningTestRequired: boolean;
    minCgpa: string | null;
    minTenthPct: string | null;
    minTwelfthPct: string | null;
    maxBacklogs: number | null;
    allowedCourses: string[];
    graduationYears: number[];
    company: { name: string; website: string | null; about: string | null; isVerified: boolean };
    rounds: {
      id: string;
      order: number;
      name: string;
      type: string;
      /** What the company calls it, which may be its own word. */
      typeLabel: string | null;
      modeLabel: string | null;
      isElimination: boolean;
      /** What sitting in this round is actually like. */
      description: string | null;
      /** Somewhere to be, or a link to open. */
      isOnline: boolean;
      addressLine: string | null;
      pincode: string | null;
      mapsLink: string | null;
      mapEmbedUrl: string | null;
      meetingLink: string | null;
      shortlistCount: number | null;
      durationMin: number | null;
      scheduledAt: string | null;
      venue: string | null;
    }[];
  };
}

export const postingApi = {
  list: (status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'ALL' = 'PENDING') =>
    api
      .get<{ postings: PostingRow[] }>(`/campus/postings?status=${status}`)
      .then((r) => r.postings),

  get: (id: string) =>
    api.get<{ posting: PostingDetail }>(`/campus/postings/${id}`).then((r) => r.posting),

  accept: (id: string) => api.post<unknown>(`/campus/postings/${id}/accept`),

  decline: (id: string, reason: string) =>
    api.post<unknown>(`/campus/postings/${id}/decline`, { reason }),
};
