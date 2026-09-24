import { api } from './client';

/**
 * Micro-internships and campus weeks.
 *
 * Neither moves money: a micro-internship stipend is paid by the company
 * straight to the student, outside the platform, and campus weeks are free.
 */

export type MicroProjectStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'COMPLETED';
export type MicroApplicationStatus = 'APPLIED' | 'SELECTED' | 'REJECTED' | 'DELIVERED' | 'COMPLETED' | 'WITHDRAWN';

export interface MicroProject {
  id: string;
  title: string;
  brief: string;
  hours: number;
  stipend: number;
  skills: string[];
  slots: number;
  taken: number;
  deadline: string;
  status: MicroProjectStatus;
  counts?: Partial<Record<MicroApplicationStatus, number>>;
  createdAt: string;
}

export interface CompanyRef {
  id: string;
  name: string;
  logoUrl?: string | null;
}

export interface StudentBasics {
  id: string;
  name: string;
  headline: string | null;
  course: string | null;
  specialisation: string | null;
  graduationYear: number | null;
  college: { name: string; code: string } | null;
  skills: string[];
  verified: boolean;
}

export interface MicroApplication {
  id: string;
  status: MicroApplicationStatus;
  pitch: string;
  deliverable: string | null;
  rating: number | null;
  review: string | null;
  paidAt: string | null;
  paymentConfirmedAt: string | null;
  createdAt: string;
}

export interface ProjectInput {
  title: string;
  brief: string;
  hours: number;
  stipend: number;
  skills: string[];
  slots: number;
  deadline: string;
}

export interface OpenProject extends MicroProject {
  company: CompanyRef | null;
  applied: boolean;
  full: boolean;
}

export interface MyMicroApplication extends MicroApplication {
  project: MicroProject & { company: CompanyRef | null };
}

export type EventKind = 'TALK' | 'CHALLENGE' | 'ALUMNI' | 'INTERVIEWS' | 'PREP' | 'WORKSHOP';

/** How a student came to be on a session's list. Only GOING is registered. */
export type AttendeeStatus = 'INVITED' | 'GOING' | 'DECLINED';
export type WeekStatus = 'PROPOSED' | 'APPROVED' | 'DECLINED' | 'DONE';

export interface WeekEventInput {
  kind: EventKind;
  title: string;
  startsAt: string;
  durationMin: number;
  where?: string;
  simulationId?: string;
  /** The role this session is about, where it is about one. */
  jobId?: string;
}

/**
 * Who the creator is asking to come.
 *
 * A college may name students, a batch or a role it hosts; a company may only
 * name one of its own jobs, and is answered with a count rather than a list.
 */
export interface InviteScope {
  candidateIds?: string[];
  batchId?: string;
  jobId?: string;
}

export interface WeekInput {
  collegeId: string;
  title: string;
  message?: string;
  startDate: string;
  endDate: string;
  events: WeekEventInput[];
}

export interface CompanyWeek {
  id: string;
  title: string;
  message: string | null;
  startDate: string;
  endDate: string;
  status: WeekStatus;
  decisionNote: string | null;
  college: { id: string; name: string };
  events: {
    id: string;
    kind: EventKind;
    title: string;
    startsAt: string;
    durationMin: number;
    where: string | null;
    simulationId: string | null;
    jobId: string | null;
    registered: number;
    invited: number;
    attended: number;
  }[];
}

export interface CollegeWeek {
  id: string;
  title: string;
  message: string | null;
  startDate: string;
  endDate: string;
  status: WeekStatus;
  decisionNote: string | null;
  /** Null when the placement cell is running it itself. */
  company: { id: string; name: string; verified: boolean } | null;
  /** The college's own event, rather than a company's proposal. */
  mine: boolean;
  events: {
    id: string;
    kind: EventKind;
    title: string;
    startsAt: string;
    durationMin: number;
    where: string | null;
    jobId: string | null;
    registered: number;
    invited: number;
    attended: number;
    people: {
      candidateId: string;
      name: string;
      course: string;
      status: AttendeeStatus;
      invited: boolean;
      attended: boolean;
    }[];
  }[];
}

export interface StudentWeek {
  id: string;
  title: string;
  message: string | null;
  startDate: string;
  endDate: string;
  status: WeekStatus;
  company: CompanyRef | null;
  events: {
    id: string;
    kind: EventKind;
    title: string;
    startsAt: string;
    durationMin: number;
    where: string | null;
    job: { id: string; title: string; company: string } | null;
    registered: number;
    myStatus: AttendeeStatus | null;
    mine: boolean;
    invited: boolean;
    attended: boolean;
    started: boolean;
  }[];
}

export const EVENT_LABEL: Record<EventKind, string> = {
  TALK: 'Talk',
  CHALLENGE: 'Challenge',
  ALUMNI: 'Alumni session',
  INTERVIEWS: 'Interviews',
  PREP: 'Preparation session',
  WORKSHOP: 'Workshop',
};

/** The kinds a placement cell runs itself; the rest belong to a company week. */
export const COLLEGE_EVENT_KINDS: EventKind[] = ['PREP', 'WORKSHOP', 'TALK', 'ALUMNI'];

export const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** An ISO string as a datetime-local input wants it, in the browser's own time zone. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const opportunitiesApi = {
  /* --- micro-internships: company --- */
  companyProjects: () => api.get<{ projects: MicroProject[] }>('/opportunities/company/micro').then((r) => r.projects),
  createProject: (data: ProjectInput) =>
    api.post<{ project: MicroProject }>('/opportunities/company/micro', data).then((r) => r.project),
  updateProject: (id: string, data: ProjectInput) =>
    api.put<{ project: MicroProject }>(`/opportunities/company/micro/${id}`, data).then((r) => r.project),
  setProjectStatus: (id: string, status: 'OPEN' | 'CLOSED' | 'COMPLETED') =>
    api.post<{ project: MicroProject }>(`/opportunities/company/micro/${id}/status`, { status }).then((r) => r.project),
  projectDetail: (id: string) =>
    api.get<{ project: MicroProject; applications: (MicroApplication & { student: StudentBasics })[] }>(
      `/opportunities/company/micro/${id}`,
    ),
  decide: (applicationId: string, action: 'SELECT' | 'REJECT') =>
    api.post(`/opportunities/company/micro/applications/${applicationId}/decision`, { action }),
  complete: (applicationId: string, rating: number, review: string) =>
    api.post(`/opportunities/company/micro/applications/${applicationId}/complete`, { rating, review }),
  markPaid: (applicationId: string) => api.post(`/opportunities/company/micro/applications/${applicationId}/paid`),

  /* --- micro-internships: student --- */
  studentProjects: () => api.get<{ open: OpenProject[]; mine: MyMicroApplication[] }>('/opportunities/micro'),
  apply: (projectId: string, pitch: string) => api.post(`/opportunities/micro/${projectId}/apply`, { pitch }),
  withdraw: (applicationId: string) => api.post(`/opportunities/micro/applications/${applicationId}/withdraw`),
  deliver: (applicationId: string, deliverable: string) =>
    api.post(`/opportunities/micro/applications/${applicationId}/deliver`, { deliverable }),
  confirmPaid: (applicationId: string) => api.post(`/opportunities/micro/applications/${applicationId}/confirm-paid`),

  /* --- campus weeks: company --- */
  companyWeeks: () =>
    api.get<{
      weeks: CompanyWeek[];
      colleges: { id: string; name: string; code: string; city: string }[];
      simulations: { id: string; title: string }[];
      /** The company's own published roles, to name and to invite from. */
      jobs: { id: string; title: string }[];
    }>('/opportunities/company/weeks'),
  proposeWeek: (data: WeekInput) =>
    api.post<{ week: CompanyWeek }>('/opportunities/company/weeks', data).then((r) => r.week),
  updateWeek: (id: string, data: WeekInput) =>
    api.put<{ week: CompanyWeek }>(`/opportunities/company/weeks/${id}`, data).then((r) => r.week),
  withdrawWeek: (id: string) => api.delete(`/opportunities/company/weeks/${id}`),

  /* --- campus weeks: college --- */
  collegeWeeks: () => api.get<{ weeks: CollegeWeek[] }>('/opportunities/college/weeks').then((r) => r.weeks),
  decideWeek: (id: string, status: 'APPROVED' | 'DECLINED', note?: string) =>
    api.post<{ weeks: CollegeWeek[] }>(`/opportunities/college/weeks/${id}/decision`, { status, note }).then((r) => r.weeks),
  adjustEvent: (weekId: string, eventId: string, data: { startsAt?: string; durationMin?: number; where?: string }) =>
    api
      .patch<{ weeks: CollegeWeek[] }>(`/opportunities/college/weeks/${weekId}/events/${eventId}`, data)
      .then((r) => r.weeks),
  attendance: (weekId: string, eventId: string, candidateId: string, attended: boolean) =>
    api.post(`/opportunities/college/weeks/${weekId}/events/${eventId}/attendance`, { candidateId, attended }),
  finishWeek: (id: string) =>
    api.post<{ weeks: CollegeWeek[] }>(`/opportunities/college/weeks/${id}/done`).then((r) => r.weeks),

  /* --- the college's own events --- */
  createEvent: (data: WeekInput) =>
    api.post<{ id: string; weeks: CollegeWeek[] }>('/opportunities/college/events', data),
  updateEvent: (id: string, data: WeekInput) =>
    api.put<{ weeks: CollegeWeek[] }>(`/opportunities/college/events/${id}`, data).then((r) => r.weeks),
  deleteEvent: (id: string) =>
    api.delete<{ weeks: CollegeWeek[] }>(`/opportunities/college/events/${id}`).then((r) => r.weeks),
  invite: (weekId: string, eventId: string, scope: InviteScope) =>
    api.post<{ invited: number; already: number; weeks: CollegeWeek[] }>(
      `/opportunities/college/weeks/${weekId}/events/${eventId}/invite`,
      scope,
    ),

  /* --- a company inviting its own applicants --- */
  inviteApplicants: (weekId: string, eventId: string, jobId: string) =>
    api.post<{ invited: number; already: number; weeks: CompanyWeek[] }>(
      `/opportunities/company/weeks/${weekId}/events/${eventId}/invite`,
      { jobId },
    ),

  /* --- campus weeks: student --- */
  studentWeeks: () => api.get<{ weeks: StudentWeek[] }>('/opportunities/weeks').then((r) => r.weeks),
  register: (eventId: string) =>
    api.post<{ weeks: StudentWeek[] }>(`/opportunities/weeks/events/${eventId}/register`).then((r) => r.weeks),
  unregister: (eventId: string) =>
    api.delete<{ weeks: StudentWeek[] }>(`/opportunities/weeks/events/${eventId}/register`).then((r) => r.weeks),
};
