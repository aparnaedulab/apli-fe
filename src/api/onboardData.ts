import { api } from './client';
import type { PartnerKind } from './partners';
import type { StudyLevel } from './platform';

/** A university or college on the directory students pick from at sign-up. */
export interface Listing {
  id: string;
  kind: PartnerKind;
  name: string;
  city: string;
  state: string | null;
  affiliation: string | null;
  isActive: boolean;
  students: number;
  createdAt: string;
}

export interface ListingInput {
  kind: PartnerKind;
  name: string;
  city: string;
  state?: string | null;
  affiliation?: string | null;
}

export interface ListingPage {
  listings: Listing[];
  total: number;
  page: number;
  pageCount: number;
  counts: { active: number; hidden: number };
}

/** One career interest students can pick at sign-up. */
export interface InterestEntry {
  id: string;
  value: string;
  isActive: boolean;
  inUse: number;
}

export interface CourseEntry {
  id: string;
  name: string;
  level: StudyLevel | null;
  years: number | null;
  isActive: boolean;
  inUse: number;
}

/** What the platform team keeps so the sign-up dropdowns have answers. */
export const onboardDataApi = {
  listings: (q: string, show: 'active' | 'hidden', page = 1) =>
    api.get<ListingPage>(
      `/platform/listings?show=${show}&page=${page}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    ),
  addListing: (body: ListingInput) => api.post<{ listing: Listing; revived?: boolean }>('/platform/listings', body),
  addListings: (rows: ListingInput[]) =>
    api.post<{ added: number; skipped: number }>('/platform/listings/bulk', { rows }),
  updateListing: (id: string, body: Partial<ListingInput> & { isActive?: boolean }) =>
    api.patch<{ listing: Listing }>(`/platform/listings/${id}`, body),

  courses: () =>
    api.get<{ courses: CourseEntry[] }>('/admin/courses?includeRetired=true').then((r) => r.courses),
  addCourse: (name: string) => api.post<{ course: CourseEntry; revived?: boolean }>('/admin/courses', { name }),
  updateCourse: (id: string, data: { level?: StudyLevel | null; years?: number | null }) =>
    api.patch(`/admin/courses/${id}`, data),
  setCourseActive: (id: string, isActive: boolean) => api.patch(`/admin/courses/${id}`, { isActive }),
  removeCourse: (id: string) => api.delete(`/admin/courses/${id}`),

  interests: () =>
    api
      .get<{ values: InterestEntry[] }>('/admin/reference?kind=CAREER_INTEREST&includeRetired=true')
      .then((r) => r.values),
  addInterest: (value: string) => api.post('/admin/reference/CAREER_INTEREST', { value }),
  setInterestActive: (id: string, isActive: boolean) => api.patch(`/admin/reference/${id}`, { isActive }),
  renameInterest: (id: string, value: string) => api.patch(`/admin/reference/${id}`, { value }),
  removeInterest: (id: string) => api.delete(`/admin/reference/${id}`),
};
