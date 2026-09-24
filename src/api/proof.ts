import { api } from './client';

/** Proof of work: work simulations and the verified skills passport. */

export type SimulationStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type EnrolmentStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'EXPLAIN_BOOKED' | 'COMPLETED' | 'NEEDS_WORK';

export interface Resource {
  label: string;
  url: string;
}

export interface SimulationInput {
  title: string;
  role: string;
  summary: string;
  estimatedHours: number;
  skills: string[];
  tasks: { title: string; brief: string; resources: Resource[] }[];
}

export interface CompanySimulationRow {
  id: string;
  title: string;
  role: string;
  summary: string;
  estimatedHours: number;
  skills: string[];
  status: SimulationStatus;
  updatedAt: string;
  taskCount: number;
  enrolled: number;
  waitingForReview: number;
  completed: number;
}

export interface CompanySimulation {
  id: string;
  title: string;
  role: string;
  summary: string;
  estimatedHours: number;
  skills: string[];
  status: SimulationStatus;
  tasks: { id: string; order: number; title: string; brief: string; resources: Resource[] }[];
  _count: { enrolments: number };
}

export interface QueueRow {
  id: string;
  status: EnrolmentStatus;
  explainAt: string | null;
  completedAt: string | null;
  createdAt: string;
  simulation: { id: string; title: string; role: string };
  student: { name: string; college: string | null };
}

export interface ReviewEnrolment {
  id: string;
  status: EnrolmentStatus;
  explainAt: string | null;
  explainNote: string | null;
  completedAt: string | null;
  certificateCode: string | null;
  student: { id: string; name: string; college: string | null };
  simulation: { id: string; title: string; role: string };
  tasks: {
    id: string;
    order: number;
    title: string;
    brief: string;
    answer: { text: string | null; link: string | null; at: string } | null;
  }[];
}

export type Decision =
  | { action: 'NEEDS_WORK'; note: string }
  | { action: 'BOOK_EXPLAIN'; explainAt: string; note: string }
  | { action: 'COMPLETE'; note?: string };

export interface StudentSimulationRow {
  id: string;
  title: string;
  role: string;
  summary: string;
  estimatedHours: number;
  skills: string[];
  company: { id: string; name: string; logoUrl: string | null };
  taskCount: number;
  mine: { status: EnrolmentStatus; certificateCode: string | null } | null;
}

export interface StudentSimulation {
  id: string;
  title: string;
  role: string;
  summary: string;
  estimatedHours: number;
  skills: string[];
  status: SimulationStatus;
  company: { id: string; name: string; logoUrl: string | null };
  enrolment: {
    id: string;
    status: EnrolmentStatus;
    explainAt: string | null;
    explainNote: string | null;
    completedAt: string | null;
    certificateCode: string | null;
  } | null;
  tasks: {
    id: string;
    order: number;
    title: string;
    brief: string;
    resources: Resource[];
    answer: { text: string | null; link: string | null } | null;
  }[];
}

export interface Certificate {
  code: string;
  student: string;
  simulation: string;
  role: string;
  hours: number;
  company: string;
  completedAt: string;
}

export type Evidence = 'COLLEGE_VERIFIED' | 'EMPLOYER_VERIFIED' | 'SELF_REPORTED';

export interface Claim {
  kind: 'MARKS' | 'SKILL' | 'SIMULATION' | 'INTERNSHIP' | 'PROJECT' | 'EXPERIENCE';
  label: string;
  detail: string | null;
  evidence: Evidence;
  source: string;
  certificateCode?: string | null;
}

export interface Passport {
  student: { name: string; college: string | null };
  summary: { collegeVerified: number; employerVerified: number; selfReported: number };
  claims: Claim[];
}

export interface RoundEnrolment {
  status: EnrolmentStatus;
  certificateCode: string | null;
  explainAt: string | null;
}

export interface StudentRoundSimulation {
  applicationId: string;
  roundId: string;
  roundName: string;
  simulation: { id: string; title: string; estimatedHours: number };
  /** False once the company has unpublished it - carrying on is still fine. */
  canStart: boolean;
  enrolment: RoundEnrolment | null;
}

export interface ApplicantRoundSimulation {
  roundId: string;
  roundName: string;
  isCurrent: boolean;
  simulation: { id: string; title: string; estimatedHours: number };
  enrolment: (RoundEnrolment & { id: string }) | null;
}

export const proofApi = {
  /* --- company --- */
  companyList: () =>
    api.get<{ simulations: CompanySimulationRow[] }>('/proof/company/simulations').then((r) => r.simulations),
  companyGet: (id: string) =>
    api.get<{ simulation: CompanySimulation }>(`/proof/company/simulations/${id}`).then((r) => r.simulation),
  create: (data: SimulationInput) =>
    api.post<{ simulation: CompanySimulation }>('/proof/company/simulations', data).then((r) => r.simulation),
  update: (id: string, data: SimulationInput) =>
    api.put<{ simulation: CompanySimulation }>(`/proof/company/simulations/${id}`, data).then((r) => r.simulation),
  setStatus: (id: string, status: SimulationStatus) =>
    api.post<{ simulation: CompanySimulation }>(`/proof/company/simulations/${id}/status`, { status }).then((r) => r.simulation),
  queue: (status?: EnrolmentStatus) =>
    api
      .get<{ enrolments: QueueRow[] }>(`/proof/company/enrolments${status ? `?status=${status}` : ''}`)
      .then((r) => r.enrolments),
  review: (id: string) =>
    api.get<{ enrolment: ReviewEnrolment }>(`/proof/company/enrolments/${id}`).then((r) => r.enrolment),
  decide: (id: string, d: Decision) =>
    api.post<{ enrolment: ReviewEnrolment }>(`/proof/company/enrolments/${id}/decision`, d).then((r) => r.enrolment),
  applicantPassport: (candidateId: string) =>
    api.get<{ passport: Passport }>(`/proof/company/passport/${candidateId}`).then((r) => r.passport),

  /* --- student --- */
  list: () => api.get<{ simulations: StudentSimulationRow[] }>('/proof/simulations').then((r) => r.simulations),
  get: (id: string) => api.get<{ simulation: StudentSimulation }>(`/proof/simulations/${id}`).then((r) => r.simulation),
  enrol: (id: string) =>
    api.post<{ simulation: StudentSimulation }>(`/proof/simulations/${id}/enrol`).then((r) => r.simulation),
  answer: (id: string, taskId: string, data: { text: string; link: string }) =>
    api.put<{ simulation: StudentSimulation }>(`/proof/simulations/${id}/tasks/${taskId}`, data).then((r) => r.simulation),
  submit: (id: string) =>
    api.post<{ simulation: StudentSimulation }>(`/proof/simulations/${id}/submit`).then((r) => r.simulation),
  passport: () => api.get<{ passport: Passport }>('/proof/passport').then((r) => r.passport),

  /* --- a simulation as a hiring round --- */
  /** The student's applications waiting at a work-simulation round. */
  roundsMine: () => api.get<{ rounds: StudentRoundSimulation[] }>('/proof/rounds/mine').then((r) => r.rounds),
  /** Begin, or return to, the round's simulation. Safe to call twice. */
  startRound: (applicationId: string) =>
    api.post<{ simulationId: string; enrolment: RoundEnrolment }>(`/proof/rounds/${applicationId}/start`),
  /** Company: how far one applicant has got in the job's simulation rounds. */
  applicantRounds: (applicationId: string) =>
    api
      .get<{ rounds: ApplicantRoundSimulation[] }>(`/proof/company/applications/${applicationId}/simulations`)
      .then((r) => r.rounds),

  /* --- public --- */
  certificate: (code: string) =>
    api.get<{ certificate: Certificate }>(`/proof/certificates/${encodeURIComponent(code)}`).then((r) => r.certificate),
};

/** Where a certificate can be checked by anyone, for sharing. */
export function certificateLink(code: string): string {
  return `${window.location.origin}/certificates/${code}`;
}
