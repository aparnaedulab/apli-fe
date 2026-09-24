import { api } from './client';

export type DriveStatus =
  | 'DRAFT'
  | 'INVITED'
  | 'ACCEPTED'
  | 'SCHEDULED'
  | 'OPEN'
  | 'CLOSED'
  | 'DECLINED';

export interface Drive {
  id: string;
  status: DriveStatus;
  title: string;
  pitch: string | null;
  scheduledAt: string | null;
  addressLine: string | null;
  meetingLink: string | null;
  minCgpa: string | null;
  minDegreePct: string | null;
  maxBacklogs: number | null;
  maxActiveBacklogs: number | null;
  declineReason: string | null;
  company: { id: string; name: string; status: string };
  college: { id: string; name: string };
  placement: { id: string; name: string; year: number; isOpen: boolean };
  courses: { course: string }[];
  branches: { specialisation: string }[];
  gradYears: { year: number }[];
  jobs: { confirmedAt: string | null; job: { id: string; title: string; status: string } }[];
  _count: { registrations: number };
}

/** Counts only. There is deliberately no shape here that carries a student. */
export interface EligibilityReport {
  inSeason: number;
  verified: number;
  eligible: number;
  eligiblePct: number | null;
  byBranch: { branch: string; count: number }[];
  failing: { reason: string; count: number }[];
  note: string;
}

export interface DriveDraft {
  placementId: string;
  companyId: string;
  title: string;
  pitch?: string | null;
  minCgpa?: number | null;
  minDegreePct?: number | null;
  maxBacklogs?: number | null;
  maxActiveBacklogs?: number | null;
  courses?: string[];
  branches?: string[];
  gradYears?: number[];
}

/** The placement cell arranging a visit. */
export const campusDrivesApi = {
  list: () => api.get<{ drives: Drive[] }>('/campus/drives'),
  /** Verified companies the cell may invite. A picker, not a directory. */
  companies: () =>
    api.get<{ companies: { id: string; name: string }[] }>('/campus/drives/companies'),
  create: (draft: DriveDraft) => api.post<{ drive: Drive }>('/campus/drives', draft),
  eligibility: (id: string) =>
    api.get<{ report: EligibilityReport }>(`/campus/drives/${id}/eligibility`),
  invite: (id: string) => api.post<{ drive: Drive }>(`/campus/drives/${id}/invite`, {}),
  withdraw: (id: string) => api.post<{ drive: Drive }>(`/campus/drives/${id}/withdraw`, {}),
  schedule: (id: string, when: { scheduledAt: string; addressLine?: string; meetingLink?: string }) =>
    api.post<{ drive: Drive }>(`/campus/drives/${id}/schedule`, when),
  open: (id: string) => api.post<{ drive: Drive }>(`/campus/drives/${id}/open`, {}),
  close: (id: string) => api.post<{ drive: Drive }>(`/campus/drives/${id}/close`, {}),
  /** This company's roles, to put on the day. */
  companyJobs: (id: string) =>
    api.get<{ jobs: { id: string; title: string; status: string; location: string | null }[] }>(
      `/campus/drives/${id}/company-jobs`,
    ),
  addJob: (id: string, jobId: string) =>
    api.post<{ drive: Drive }>(`/campus/drives/${id}/jobs`, { jobId }),
  removeJob: (id: string, jobId: string) =>
    api.delete<{ drive: Drive }>(`/campus/drives/${id}/jobs/${jobId}`),
  registrations: (id: string) =>
    api.get<{
      registrations: {
        id: string;
        createdAt: string;
        candidate: {
          id: string;
          course: string | null;
          specialisation: string | null;
          cgpa: string | null;
          user: { fullName: string; email: string };
        };
      }[];
    }>(`/campus/drives/${id}/registrations`),
};

/** The company answering an invitation. */
export const companyDrivesApi = {
  list: () => api.get<{ drives: Drive[] }>('/company/drives'),
  /** Unanswered invitations, for the badge on the nav. */
  pendingCount: () => api.get<{ count: number }>('/company/drives/pending-count'),
  eligibility: (id: string) =>
    api.get<{ report: EligibilityReport }>(`/company/drives/${id}/eligibility`),
  /** Correct the bar and get the counts back for it, in one call. */
  setCriteria: (
    id: string,
    bar: {
      minCgpa?: number | null;
      maxBacklogs?: number | null;
      gradYears?: number[];
    },
  ) =>
    api.patch<{ drive: Drive; report: EligibilityReport }>(
      `/company/drives/${id}/criteria`,
      bar,
    ),
  /** Who put their name down, and how many withheld their profile. */
  students: (id: string) =>
    api.get<{
      students: {
        id: string;
        name: string;
        email: string;
        course: string | null;
        branch: string | null;
        graduationYear: number | null;
        cgpa: string | null;
        backlogs: number | null;
        registeredAt: string;
      }[];
      withheld: number;
      note: string;
    }>(`/company/drives/${id}/students`),
  confirmJob: (id: string, jobId: string) =>
    api.post<void>(`/company/drives/${id}/jobs/${jobId}/confirm`, {}),
  respond: (id: string, accept: boolean, reason?: string) =>
    api.post<{ drive: Drive }>(`/company/drives/${id}/respond`, { accept, reason }),
};

export interface StudentDrive {
  id: string;
  title: string;
  company: string;
  scheduledAt: string | null;
  addressLine: string | null;
  meetingLink: string | null;
  pitch: string | null;
  roles: { id: string; title: string }[];
  registered: boolean;
  canRegister: boolean;
}

/** The student putting their name down. */
export const studentDrivesApi = {
  list: () => api.get<{ drives: StudentDrive[] }>('/candidate/drives'),
  register: (id: string) => api.post<{ drives: StudentDrive[] }>(`/candidate/drives/${id}/register`, {}),
  withdraw: (id: string) => api.post<{ drives: StudentDrive[] }>(`/candidate/drives/${id}/withdraw`, {}),
};
