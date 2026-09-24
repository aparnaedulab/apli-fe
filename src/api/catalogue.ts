import { api } from './client';

/**
 * The courses and branches the university runs.
 *
 * Kept by operations rather than typed wherever a course is needed. Course is
 * matched as a plain string everywhere it matters - a batch, a student, a
 * role's criteria - so two spellings of the same course are two courses that
 * never match each other.
 */
export interface CatalogueCourse {
  id: string;
  name: string;
  branches: string[];
}

export interface Catalogue {
  courses: CatalogueCourse[];
  /** Branches recorded before anybody said which course they belong to. */
  looseBranches: string[];
}

/** Every list a form might offer, in one call. */
export interface FullCatalogue extends Catalogue {
  cities: string[];
  states: string[];
  naacGrades: string[];
  genders: string[];
  collegeTypes: { id: string; name: string }[];
  industries: { id: string; name: string }[];
  /**
   * Every skill the portal knows about, shared by students and roles.
   *
   * The same row on both sides is the whole point: a student's "Node.js" and
   * a role asking for "Node.js" only meet because they are one skill.
   */
  skills: string[];
  /** The colleges of the caller's own institution, by name. */
  colleges: string[];
  /**
   * The fixed inclusion lists a role is written from.
   *
   * A student answers in the same keys, which is the only reason a role that
   * says it suits a group and a student who is in one can ever be matched.
   */
  pwdCategories: { key: string; label: string; hint?: string }[];
  accommodations: { key: string; label: string }[];
  travel: string[];
}

export const catalogueApi = {
  courses: () => api.get<Catalogue>('/catalogue/courses'),
  all: () => api.get<FullCatalogue>('/catalogue'),
};
