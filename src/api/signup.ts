import { api } from './client';

/** A college a student can pick at sign-up. */
export interface CollegeOption {
  id: string;
  /** A partner college, or one on the directory the platform team keeps. */
  source: 'partner' | 'listing';
  name: string;
  city: string | null;
  institution: string | null;
}

/** A city or town for "City you live in". */
export interface CitySuggestion {
  name: string;
  state: string | null;
}

export type DegreeLevel = 'DIPLOMA' | 'UG' | 'PG' | 'PHD';

/** A course on the list, with its level and how many years it runs. */
export interface SignupCourse {
  name: string;
  level: DegreeLevel | null;
  years: number | null;
}

export interface SignupOptions {
  courses: SignupCourse[];
  genders: string[];
  degreeLevels: { key: DegreeLevel; label: string }[];
  interests: string[];
}

export interface StudentSignup {
  fullName: string;
  email: string;
  password: string;
  collegeId?: string;
  listingId?: string;
  otherCollege?: string;
  course: string;
  degreeLevel: DegreeLevel;
  specialisation?: string;
  city: string;
  /** The country the mobile number's code is for, e.g. IN. */
  phoneCountry: string;
  phone: string;
  gender: string;
  /** YYYY-MM-DD. */
  dateOfBirth: string;
  /** Out of 10; the college verifies it. */
  cgpa?: number;
  interests: string[];
  /** The batch: the year they joined and the year they finish. */
  startYear: number;
  graduationYear: number;
  agree: true;
}

/** Open sign-up: no college code, no invitation, no approval. */
export const signupApi = {
  colleges: (q: string) =>
    api.get<{ colleges: CollegeOption[] }>(`/public/colleges?q=${encodeURIComponent(q)}`).then((r) => r.colleges),
  cities: (q: string) =>
    api.get<{ cities: CitySuggestion[] }>(`/public/cities?q=${encodeURIComponent(q)}`).then((r) => r.cities),
  options: () => api.get<SignupOptions>('/public/signup/options'),
  student: (body: StudentSignup) =>
    api.post<{ user: { id: string; fullName: string; email: string } }>('/public/signup/student', body),
};
