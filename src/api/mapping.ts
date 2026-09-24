import { api } from './client';

/**
 * Map data: college -> course + branch -> students.
 *
 * The university and a college call the same shapes on different paths; the
 * college's paths are fixed to its own college and never see the
 * university's unplaced students.
 */

export interface OfferedCourse {
  id: string;
  name: string;
  branches: { id: string; name: string }[];
}

export interface Offered {
  courses: OfferedCourse[];
  /** True when the university has not chosen its programmes, so the whole catalogue is on offer. */
  fromCatalogue: boolean;
}

export interface CollegeProgram {
  id: string;
  courseId: string;
  course: string;
  branchId: string | null;
  branch: string | null;
  intake: number | null;
  students: number;
}

export interface ProgramChoice {
  courseId: string;
  branchId: string | null;
  intake?: number | null;
}

export interface MappingCollege {
  id: string;
  name: string;
  code: string;
  city: string;
  programs: number;
  students: number;
  mapped: number;
}

export interface MappingStudent {
  id: string;
  name: string;
  email: string;
  prn: string | null;
  rollNo: string | null;
  batches: string[];
  graduationYear: number | null;
  college: { id: string; name: string; code: string } | null;
  course: string | null;
  branch: string | null;
  programId: string | null;
}

export interface StudentPage {
  total: number;
  page: number;
  pageSize: number;
  rows: MappingStudent[];
}

export interface StudentFilter {
  programId?: string;
  status?: 'mapped' | 'unmapped' | 'all';
  includeUnplaced?: boolean;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface MappingSummaryCollege {
  id: string;
  name: string;
  code: string;
  courses: {
    course: string;
    branches: { branch: string | null; students: number; intake: number | null }[];
  }[];
}

export interface MapResult {
  mapped: number;
  skipped: { name: string; reason: string }[];
}

const qs = (f: StudentFilter) => {
  const p = new URLSearchParams();
  if (f.programId) p.set('programId', f.programId);
  if (f.status) p.set('status', f.status);
  if (f.includeUnplaced) p.set('includeUnplaced', 'true');
  if (f.q) p.set('q', f.q);
  if (f.page) p.set('page', String(f.page));
  if (f.pageSize) p.set('pageSize', String(f.pageSize));
  const s = p.toString();
  return s ? `?${s}` : '';
};

/** One college's mapping, whichever side is asking. */
export interface MappingScope {
  programs(): Promise<CollegeProgram[]>;
  savePrograms(programs: ProgramChoice[]): Promise<CollegeProgram[]>;
  students(filter: StudentFilter): Promise<StudentPage>;
  map(programId: string, candidateIds: string[]): Promise<MapResult>;
  unmap(candidateIds: string[]): Promise<{ unmapped: number }>;
  /** Only the university can see students with no college yet. */
  canSeeUnplaced: boolean;
}

export const adminMapping = {
  /** The university's own courses and branches, and the catalogue it picks from. */
  offered: () =>
    api.get<{ catalogue: OfferedCourse[]; programs: CollegeProgram[] }>('/admin/mapping/offered'),
  saveOffered: (programs: ProgramChoice[]) =>
    api.put<{ programs: CollegeProgram[] }>('/admin/mapping/offered', { programs }).then((r) => r.programs),

  overview: () =>
    api.get<{ colleges: MappingCollege[]; unplacedStudents: number; offered: Offered }>('/admin/mapping'),
  unplaced: (filter: StudentFilter) => api.get<StudentPage>(`/admin/mapping/unplaced${qs(filter)}`),
  summary: () => api.get<{ colleges: MappingSummaryCollege[] }>('/admin/mapping/summary'),

  forCollege(collegeId: string): MappingScope {
    const base = `/admin/mapping/colleges/${collegeId}`;
    return {
      canSeeUnplaced: true,
      programs: () => api.get<{ programs: CollegeProgram[] }>(`${base}/programs`).then((r) => r.programs),
      savePrograms: (programs) =>
        api.put<{ programs: CollegeProgram[] }>(`${base}/programs`, { programs }).then((r) => r.programs),
      students: (filter) => api.get<StudentPage>(`${base}/students${qs(filter)}`),
      map: (programId, candidateIds) =>
        api.post<MapResult>(`/admin/mapping/programs/${programId}/students`, { candidateIds }),
      unmap: (candidateIds) => api.post<{ unmapped: number }>('/admin/mapping/unmap', { candidateIds }),
    };
  },
};

/** The same university-side calls, for the onboarding wizard, which names its institution in the path. */
export function platformMapping(tenantId: string) {
  const root = `/platform/tenants/${tenantId}/mapping`;
  return {
    overview: () =>
      api.get<{ colleges: MappingCollege[]; unplacedStudents: number; offered: Offered }>(root),
    summary: () => api.get<{ colleges: MappingSummaryCollege[] }>(`${root}/summary`),
    forCollege(collegeId: string): MappingScope {
      const base = `${root}/colleges/${collegeId}`;
      return {
        canSeeUnplaced: true,
        programs: () => api.get<{ programs: CollegeProgram[] }>(`${base}/programs`).then((r) => r.programs),
        savePrograms: (programs) =>
          api.put<{ programs: CollegeProgram[] }>(`${base}/programs`, { programs }).then((r) => r.programs),
        students: (filter) => api.get<StudentPage>(`${base}/students${qs(filter)}`),
        map: (programId, candidateIds) =>
          api.post<MapResult>(`${root}/programs/${programId}/students`, { candidateIds }),
        unmap: (candidateIds) => api.post<{ unmapped: number }>(`${root}/unmap`, { candidateIds }),
      };
    },
  };
}

export const campusMapping = {
  overview: () =>
    api.get<{
      college: { id: string; name: string; code: string };
      offered: Offered;
      programs: CollegeProgram[];
      students: number;
      mapped: number;
    }>('/campus/mapping'),

  scope: {
    canSeeUnplaced: false,
    programs: () =>
      api.get<{ programs: CollegeProgram[] }>('/campus/mapping').then((r) => r.programs),
    savePrograms: (programs: ProgramChoice[]) =>
      api
        .put<{ programs: CollegeProgram[] }>('/campus/mapping/programs', { programs })
        .then((r) => r.programs),
    students: (filter: StudentFilter) => api.get<StudentPage>(`/campus/mapping/students${qs(filter)}`),
    map: (programId: string, candidateIds: string[]) =>
      api.post<MapResult>(`/campus/mapping/programs/${programId}/students`, { candidateIds }),
    unmap: (candidateIds: string[]) =>
      api.post<{ unmapped: number }>('/campus/mapping/unmap', { candidateIds }),
  } satisfies MappingScope,
};
