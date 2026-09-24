import { api } from './client';

/** One use of a student's data, with their current answer and its history. */
export interface ConsentPurpose {
  key: string;
  title: string;
  explain: string;
  neededToApply: boolean;
  /** Null until the student has answered at all. */
  granted: boolean | null;
  changedAt: string | null;
  history: { granted: boolean; at: string }[];
}

export interface CollegeConsentCount {
  key: string;
  title: string;
  neededToApply: boolean;
  students: number;
  granted: number;
  withdrew: number;
  declined: number;
  neverAnswered: number;
}

export const consentApi = {
  mine: () => api.get<{ purposes: ConsentPurpose[] }>('/consent').then((r) => r.purposes),
  set: (purpose: string, granted: boolean) =>
    api.put<{ purposes: ConsentPurpose[] }>('/consent', { purpose, granted }).then((r) => r.purposes),
  setMany: (grants: Record<string, boolean>) =>
    api.put<{ purposes: ConsentPurpose[] }>('/consent/bulk', { grants }).then((r) => r.purposes),
  college: () => api.get<{ purposes: CollegeConsentCount[] }>('/consent/college').then((r) => r.purposes),
};
