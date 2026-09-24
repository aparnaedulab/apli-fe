import { api } from './client';
import type { CompanyPhoto, CompanyPost } from './company';

/** The company page (showcase.company): what a company says, what we measure, what seniors say. */

export interface MeasuredFact {
  key: string;
  label: string;
  display: string | null;
  value: number | null;
  enough: boolean;
  sentence: string;
  /** Only meaningful to the company itself: what would move this fact. */
  improve: string | null;
}

export interface CompanySays {
  id: string;
  name: string;
  logoUrl: string | null;
  coverUrl: string | null;
  /** The one line under the name; `about` is the paragraph. */
  headline: string | null;
  /** The office, the team, the work - in the order the company chose. */
  photos: CompanyPhoto[];
  about: string | null;
  whyJoin: string | null;
  howWeHire: string | null;
  website: string | null;
  careersUrl: string | null;
  linkedinUrl: string | null;
  sizeBand: 'STARTUP' | 'SMALL' | 'MID' | 'LARGE' | 'ENTERPRISE' | null;
  city: string | null;
  foundedYear: number | null;
  industry: string | null;
}

export interface CompanyPageView {
  says: CompanySays;
  measured: MeasuredFact[];
  seniors: { stories: unknown[]; note: string };
  /** The newest few, so the page is one request rather than two. */
  posts: CompanyPost[];
  /** Where the next page of the feed starts; null when that was all of it. */
  postsCursor: string | null;
}

export interface StudentCompanyPage extends CompanyPageView {
  roles: { id: string; title: string; location: string | null; deadline: string; jobType: string }[];
}

export const showcaseApi = {
  /** A student reading a verified company's page. */
  company: (id: string) => api.get<StudentCompanyPage>(`/showcase/companies/${id}`),
  /** The signed-in company's own page. */
  mine: () => api.get<CompanyPageView>('/showcase/mine'),
  saveMine: (data: { whyJoin: string; howWeHire: string }) => api.put<CompanyPageView>('/showcase/mine', data),

  /** The rest of a company's feed, oldest-ward from the cursor. */
  posts: (id: string, before?: string) =>
    api.get<{ posts: CompanyPost[]; nextCursor: string | null }>(
      `/showcase/companies/${id}/posts${before ? `?before=${encodeURIComponent(before)}` : ''}`,
    ),
};

export const SIZE_LABEL: Record<NonNullable<CompanySays['sizeBand']>, string> = {
  STARTUP: '1–50 people',
  SMALL: '51–200 people',
  MID: '201–1,000 people',
  LARGE: '1,001–5,000 people',
  ENTERPRISE: '5,000+ people',
};
