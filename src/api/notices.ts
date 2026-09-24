import { api } from './client';

export interface Notice {
  id: string;
  title: string;
  body: string;
  toStudents: boolean;
  toCompanies: boolean;
  toColleges: boolean;
  publishedAt: string;
  expiresAt: string | null;
  retractedAt: string | null;
  author: { fullName: string } | null;
  tenant: { name: string; shortName: string | null } | null;
}

/** Only on the institution's own list - what a notice is doing right now. */
export type NoticeStatus = 'live' | 'expired' | 'retracted';

export interface AdminNotice extends Notice {
  status: NoticeStatus;
}

export interface NoticeDraft {
  title: string;
  body: string;
  toStudents: boolean;
  toCompanies: boolean;
  toColleges: boolean;
  /** ISO, or null to stand until taken down. */
  expiresAt: string | null;
}

export const noticesApi = {
  /** What the signed-in person has been sent. Every role may ask. */
  mine: () => api.get<{ notices: Notice[] }>('/notices'),

  /** Everything this institution has posted, live or not. Admin only. */
  all: () => api.get<{ notices: AdminNotice[] }>('/notices/all'),

  post: (draft: NoticeDraft) => api.post<{ notice: Notice }>('/notices', draft),

  /** Taken down, but kept on the record. */
  retract: (id: string) => api.post<void>(`/notices/${id}/retract`, {}),

  remove: (id: string) => api.delete<void>(`/notices/${id}`),
};
