import { api } from './client';

/**
 * Career counselling.
 *
 * The asking is the student's. Nothing here flags anybody: the portal already
 * knows who has stalled and tells the college, and this is the other
 * direction - a way to say "I need to talk to somebody".
 */

export type CounsellingReason =
  | 'OFFER_CHOICE'
  | 'NOT_SHORTLISTED'
  | 'BOND_OR_LOCATION'
  | 'FAMILY'
  | 'DIRECTION'
  | 'OTHER';

export type CounsellingStatus = 'OPEN' | 'BOOKED' | 'DONE' | 'CLOSED';

export interface CounsellingRequest {
  id: string;
  reason: CounsellingReason;
  note: string | null;
  status: CounsellingStatus;
  meetAt: string | null;
  meetWhere: string | null;
  /** What was agreed, written for the student to read. */
  outcome: string | null;
  createdAt: string;
  counsellor: { fullName: string } | null;
}

export interface CounsellingForCell extends CounsellingRequest {
  candidate: { id: string; name: string; email: string; batch: string | null };
}

/** The reasons, in the words a student would use for them. */
export const REASONS: { key: CounsellingReason; label: string; hint: string }[] = [
  {
    key: 'OFFER_CHOICE',
    label: 'Choosing between offers',
    hint: 'Accepting one closes the others, and that cannot be undone.',
  },
  {
    key: 'NOT_SHORTLISTED',
    label: 'Applying, and nothing is coming back',
    hint: 'Somebody who reads applications for a living can usually see why.',
  },
  {
    key: 'BOND_OR_LOCATION',
    label: 'A bond, a location, or a clause I am unsure about',
    hint: 'Before you sign it, not after.',
  },
  {
    key: 'FAMILY',
    label: 'The people at home want something different',
    hint: 'It is a common conversation, and not a small one.',
  },
  {
    key: 'DIRECTION',
    label: 'I do not know what I am aiming at',
    hint: 'A perfectly reasonable place to be in your final year.',
  },
  { key: 'OTHER', label: 'Something else', hint: 'Say as much or as little as you like.' },
];

export const counsellingApi = {
  mine: () =>
    api.get<{ requests: CounsellingRequest[] }>('/candidate/counselling').then((r) => r.requests),

  ask: (reason: CounsellingReason, note?: string) =>
    api
      .post<{ request: CounsellingRequest }>('/candidate/counselling', { reason, note })
      .then((r) => r.request),

  close: (id: string) => api.delete<{ closed: boolean }>(`/candidate/counselling/${id}`),
};

export const campusCounsellingApi = {
  list: () =>
    api.get<{ requests: CounsellingForCell[] }>('/campus/counselling').then((r) => r.requests),

  update: (
    id: string,
    body: { status?: 'BOOKED' | 'DONE' | 'CLOSED'; meetAt?: string; meetWhere?: string; outcome?: string },
  ) => api.patch<{ request: CounsellingRequest }>(`/campus/counselling/${id}`, body),
};
