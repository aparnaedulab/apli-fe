import { api } from './client';

/** Placement-cell tools: the employer CRM, drive day, and students who have stalled. */

export type EmployerStage = 'PROSPECT' | 'CONTACTED' | 'INTERESTED' | 'VISITING' | 'HIRED' | 'DORMANT';
export type InteractionKind = 'CALL' | 'EMAIL' | 'MEETING' | 'VISIT' | 'NOTE';

export interface EmployerContact {
  id: string;
  name: string;
  designation: string | null;
  email: string | null;
  phone: string | null;
}

export interface EmployerInteraction {
  id: string;
  kind: InteractionKind;
  summary: string;
  happenedAt: string;
  followUpAt: string | null;
  followUpDoneAt: string | null;
  followUpState: 'overdue' | 'today' | 'upcoming' | null;
}

export interface Employer {
  id: string;
  companyId: string | null;
  companyName: string;
  stage: EmployerStage;
  priority: number;
  notes: string | null;
  contacts: EmployerContact[];
  interactions: EmployerInteraction[];
  lastContactAt: string | null;
  nextFollowUpAt: string | null;
  yearsHired: number[];
}

export interface CrmBoard {
  stages: EmployerStage[];
  employers: Employer[];
  followUps: {
    interactionId: string;
    relationId: string;
    companyName: string;
    summary: string;
    followUpAt: string;
    state: 'overdue' | 'today';
  }[];
  suggestions: { companyId: string; name: string; roles: number; accepted: number }[];
}

export interface DriveOption {
  id: string;
  name: string;
  year: number;
  type: 'FINAL' | 'INTERNSHIP';
  roles: number;
  applications: number;
  checkedIn: number;
}

export interface DriveRoom {
  id: string;
  name: string;
  panel: string | null;
  jobId: string | null;
}

export interface DriveBoard {
  drive: { id: string; name: string; year: number };
  checkedIn: number;
  rooms: DriveRoom[];
  jobs: {
    jobId: string;
    title: string;
    company: string;
    rounds: { id: string; name: string; order: number; scheduledAt: string | null; count: number }[];
    rooms: DriveRoom[];
    applicants: {
      applicationId: string;
      candidateId: string;
      name: string;
      status: string;
      round: string | null;
      failedIn: string | null;
      checkedInAt: string | null;
    }[];
    totals: { applicants: number; checkedIn: number; offered: number };
  }[];
}

export interface DriveStudent {
  candidateId: string;
  name: string;
  rollNo: string | null;
  batch: string;
  checkedInAt: string | null;
  method: 'QR' | 'MANUAL' | null;
}

export interface DrivePass {
  id: string;
  name: string;
  year: number;
  college: string;
  token: string;
  code: string;
  checkedInAt: string | null;
  roles: {
    title: string;
    company: string;
    status: string;
    round: string | null;
    scheduledAt: string | null;
    venue: string | null;
  }[];
}

export type RiskKey =
  | 'profile_incomplete'
  | 'not_verified'
  | 'not_applying'
  | 'repeated_rejections'
  | 'inactive'
  | 'not_placed';

export interface StalledStudent {
  candidateId: string;
  name: string;
  email: string;
  batches: { id: string; name: string }[];
  completion: number;
  flags: { key: RiskKey; reason: string; weight: number }[];
  score: number;
  lastLoginAt: string | null;
}

export const opsApi = {
  crm: () => api.get<CrmBoard>('/ops/crm'),
  addEmployer: (data: { companyName?: string; companyId?: string; stage?: EmployerStage; priority?: number; notes?: string }) =>
    api.post<{ employer: Employer }>('/ops/crm/employers', data),
  updateEmployer: (id: string, data: { stage?: EmployerStage; priority?: number; notes?: string }) =>
    api.patch<{ employer: Employer }>(`/ops/crm/employers/${id}`, data),
  removeEmployer: (id: string) => api.delete<void>(`/ops/crm/employers/${id}`),
  addContact: (id: string, data: { name: string; designation?: string; email?: string; phone?: string }) =>
    api.post<{ contact: EmployerContact }>(`/ops/crm/employers/${id}/contacts`, data),
  removeContact: (contactId: string) => api.delete<void>(`/ops/crm/contacts/${contactId}`),
  logInteraction: (id: string, data: { kind: InteractionKind; summary: string; followUpAt?: string | null }) =>
    api.post<{ interaction: EmployerInteraction }>(`/ops/crm/employers/${id}/interactions`, data),
  followUpDone: (interactionId: string) => api.post(`/ops/crm/interactions/${interactionId}/done`),

  drives: () => api.get<{ drives: DriveOption[] }>('/ops/drive-day').then((r) => r.drives),
  board: (placementId: string) => api.get<DriveBoard>(`/ops/drive-day/${placementId}`),
  students: (placementId: string) =>
    api.get<{ students: DriveStudent[] }>(`/ops/drive-day/${placementId}/students`).then((r) => r.students),
  addRoom: (placementId: string, data: { name: string; panel?: string; jobId?: string }) =>
    api.post<{ room: DriveRoom }>(`/ops/drive-day/${placementId}/rooms`, data),
  removeRoom: (placementId: string, roomId: string) => api.delete<void>(`/ops/drive-day/${placementId}/rooms/${roomId}`),
  checkIn: (placementId: string, data: { token?: string; code?: string; candidateId?: string }) =>
    api.post<{ alreadyCheckedIn: boolean; name: string }>(`/ops/drive-day/${placementId}/check-in`, data),
  undoCheckIn: (placementId: string, candidateId: string) =>
    api.delete<void>(`/ops/drive-day/${placementId}/check-in/${candidateId}`),
  attendanceCsv: (placementId: string, name: string) =>
    api.download(`/ops/drive-day/${placementId}/attendance.csv`, `attendance-${name.replace(/[^A-Za-z0-9-]+/g, '-')}.csv`),
  passes: () => api.get<{ passes: DrivePass[] }>('/ops/drive-pass').then((r) => r.passes),

  atRisk: (batchId?: string) =>
    api.get<{ students: StalledStudent[]; batches: { id: string; name: string }[]; rules: Record<string, number> }>(
      `/ops/at-risk${batchId ? `?batchId=${encodeURIComponent(batchId)}` : ''}`,
    ),
  nudge: (candidateId: string) => api.post<{ sent: boolean; title: string }>(`/ops/at-risk/${candidateId}/nudge`),
};
