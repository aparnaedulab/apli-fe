import { api } from './client';

/**
 * Assessments: a test somebody is asked to sit.
 *
 * Assigned, never requested. Apli does not host the questions yet, so an
 * assessment points at whatever platform the company already uses; what the
 * portal holds is who was asked, by when, and what came back.
 */

export type AssessmentStatus = 'ASSIGNED' | 'SUBMITTED' | 'PASSED' | 'FAILED' | 'MISSED';

export interface AssessmentRow {
  id: string;
  /** What it is now, with a passed due date already counted as missed. */
  status: AssessmentStatus;
  /**
   * The column as stored.
   *
   * Kept beside `status` so a screen can tell a missed test from a failed
   * one: the first is something that happened to them, the second a verdict
   * on their work, and saying "failed" for a deadline is a lie.
   */
  recordedStatus: AssessmentStatus;
  attempt: number;
  dueAt: string | null;
  submittedRef: string | null;
  submittedAt: string | null;
  score: string | null;
  maxScore: string | null;
  feedback: string | null;
  reviewedAt: string | null;
  assessment: {
    id: string;
    title: string;
    instructions: string | null;
    url: string | null;
    durationMin: number | null;
    /** Whether somebody watched. The label, not proctoring. */
    supervised: boolean;
    retakes: number;
    /** Who set it, and therefore who reads the result. */
    setBy: string;
    setByKind: 'company' | 'college';
  };
  application: {
    id: string;
    status: string;
    jobId: string;
    jobTitle: string;
  } | null;
}

export const assessmentApi = {
  mine: () =>
    api.get<{ assessments: AssessmentRow[] }>('/candidate/assessments').then((r) => r.assessments),

  /** Say it has been sat, with whatever the platform gave back. */
  submit: (id: string, ref: string) =>
    api
      .post<{ assessment: AssessmentRow }>(`/candidate/assessments/${id}/submit`, { ref })
      .then((r) => r.assessment),

  /** Sit it again, where the assessment allows it. */
  retake: (id: string) =>
    api
      .post<{ assessment: AssessmentRow }>(`/candidate/assessments/${id}/retake`)
      .then((r) => r.assessment),
};

/* --- the company's side ---------------------------------------------------- */

export interface CompanyAssessment {
  id: string;
  title: string;
  instructions: string | null;
  url: string | null;
  durationMin: number | null;
  supervised: boolean;
  retakes: number;
  createdAt: string;
  assigned: number;
  /** How many are still owed, so what is outstanding is visible from the list. */
  outstanding: number;
}

export interface AssignmentRow extends AssessmentRow {
  candidate: { id: string; name: string; email: string };
}

export const companyAssessmentApi = {
  list: () =>
    api.get<{ assessments: CompanyAssessment[] }>('/company/assessments').then((r) => r.assessments),

  create: (body: {
    title: string;
    instructions?: string;
    url?: string;
    durationMin?: number;
    supervised?: boolean;
    retakes?: number;
  }) => api.post<{ assessment: CompanyAssessment }>('/company/assessments', body),

  assign: (id: string, applicationIds: string[], dueAt?: string) =>
    api.post<{ assigned: number; alreadyHad: number }>(`/company/assessments/${id}/assign`, {
      applicationIds,
      dueAt,
    }),

  assignments: (id: string) =>
    api
      .get<{ assignments: AssignmentRow[] }>(`/company/assessments/${id}/assignments`)
      .then((r) => r.assignments),

  record: (
    assignmentId: string,
    body: { status: 'PASSED' | 'FAILED' | 'SUBMITTED'; score?: number; maxScore?: number; feedback?: string },
  ) =>
    api.patch<{ assignment: AssignmentRow }>(
      `/company/assessments/assignments/${assignmentId}`,
      body,
    ),
};
