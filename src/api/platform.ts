import { api } from './client';

/** Everything the platform console and the onboarding wizard talk to. */

export type TenantKind = 'UNIVERSITY' | 'COLLEGE' | 'GROUP';
export type TenantStatus = 'DRAFT' | 'ACTIVE' | 'SUSPENDED';
export type GradingScale = 'CGPA_10' | 'CGPA_4' | 'PERCENTAGE' | 'BOTH';
export type StepKey =
  | 'identity'
  | 'academics'
  | 'colleges'
  | 'mapping'
  | 'batches'
  | 'students'
  | 'features'
  | 'help'
  | 'people'
  | 'review';
export type ModuleCategory =
  | 'core'
  | 'trust'
  | 'compliance'
  | 'development'
  | 'proof'
  | 'showcase'
  | 'operations'
  | 'channels';
export type Audience = 'student' | 'college' | 'company';

export interface TenantCard {
  id: string;
  name: string;
  shortName: string | null;
  slug: string;
  kind: TenantKind;
  status: TenantStatus;
  plan: string;
  brandColor: string;
  logoUrl: string | null;
  city: string | null;
  state: string | null;
  completedSteps: StepKey[];
  colleges: number;
  admins: number;
  students: number;
  launchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ModuleDefinition {
  key: string;
  name: string;
  summary: string;
  category: ModuleCategory;
  audience: Audience[];
  status: 'live' | 'planned';
  phase: 0 | 1 | 2 | 3;
  core?: boolean;
  requires?: string[];
}

export interface PlanDefinition {
  key: 'STARTER' | 'GROWTH' | 'COMPLETE';
  name: string;
  pitch: string;
  modules: string[];
}

export interface Catalogue {
  categories: Record<ModuleCategory, { name: string; blurb: string }>;
  modules: ModuleDefinition[];
  plans: PlanDefinition[];
  /** The tabs each audience sees - screens, not features. */
  screens: Record<Audience, { key: string; label: string; core: boolean }[]>;
  /** Which tab each feature sits on, per audience. */
  moduleScreens: Record<string, Partial<Record<Audience, string>>>;
  /** The master branch list every course picks from. */
  branches: { id: string; name: string }[];
  courses: {
    id: string;
    name: string;
    specialisations: { id: string; name: string; branchId: string }[];
  }[];
  collegeTypes: { id: string; name: string }[];
  states: string[];
  naacGrades: string[];
  adminRoles: { id: string; key: string | null; name: string; description: string | null }[];
  /** Where the portal runs, e.g. http://localhost:5180 - the start of every address. */
  portalBase: string;
}

export interface TenantRecord {
  id: string;
  name: string;
  shortName: string | null;
  slug: string;
  kind: TenantKind;
  status: TenantStatus;
  legalName: string | null;
  website: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  brandColor: string;
  tagline: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  pincode: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  supportAltPhone: string | null;
  supportWhatsapp: string | null;
  officeHours: string | null;
  gradingScale: GradingScale;
  academicYearStartMonth: number;
  oneOfferDefault: boolean;
  allowSelfJoin: boolean;
  responseDays: number;
  companyApprovalRequired: boolean;
  unverifiedCompanyAccess: boolean;
  plan: string;
  completedSteps: StepKey[];
  launchedAt: string | null;
}

export interface CollegeRow {
  id: string;
  name: string;
  code: string;
  city: string;
  state: string;
  collegeTypeId: string | null;
  naacGrade: string | null;
  affiliation: string | null;
  address: string | null;
  pincode: string | null;
  isVerified: boolean;
  batches: number;
  students: number;
  /** Course + branch pairs mapped to this college. */
  programs: number;
  courses: string[];
  officer: { name: string | null; email: string; status: 'active' | 'invited' } | null;
}

export interface BatchRow {
  id: string;
  name: string;
  collegeId: string | null;
  college: { name: string; code: string } | null;
  course: string | null;
  specialisation: string | null;
  graduationYear: number | null;
  studyYear: number | null;
  students: number;
}

/** One college, as the "Add a college" form sends it. */
export interface CollegeForm {
  name: string;
  code: string;
  collegeTypeId: string;
  affiliation: 'THIS_UNIVERSITY' | 'AUTONOMOUS' | 'OTHER';
  affiliationName: string;
  city: string;
  state: string;
  address: string;
  pincode: string;
  naacGrade: string;
  isVerified: boolean;
  officerName: string;
  officerEmail: string;
}

export type OfficerOutcome =
  | { email: string; status: 'active' | 'already invited' | 'emailed' }
  | { email: string; status: 'link'; link: string }
  | { email: string; status: 'failed'; note: string }
  | null;

export interface BatchForm {
  scope: 'UNIVERSITY' | 'ALL_COLLEGES' | 'SOME_COLLEGES';
  collegeIds: string[];
  name: string;
  course: string;
  specialisation: string;
  graduationYear?: number;
  studyYear?: number;
  headOfDept: string;
}

export type AdminEntry =
  | {
      kind: 'member';
      id: string;
      fullName: string;
      email: string;
      roleName: string;
      lastLoginAt: string | null;
    }
  | {
      kind: 'invite';
      id: string;
      fullName: string | null;
      email: string;
      roleName: string | null;
      expiresAt: string;
      expired: boolean;
    };

export interface ChecklistItem {
  step: StepKey;
  label: string;
  done: boolean;
  required: boolean;
  detail: string;
}

export interface OnboardingState {
  tenant: TenantRecord;
  programs: { courseId: string; courseName: string; specialisationIds: string[] }[];
  colleges: CollegeRow[];
  batches: BatchRow[];
  modules: string[];
  admins: AdminEntry[];
  checklist: ChecklistItem[];
}

export interface IdentityInput {
  name: string;
  shortName: string;
  slug: string;
  kind: TenantKind;
  legalName: string;
  website: string;
  logoUrl: string;
  faviconUrl: string;
  brandColor: string;
  tagline: string;
  city: string;
  state: string;
  address: string;
  pincode: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  supportEmail: string;
  supportPhone: string;
  supportAltPhone: string;
  supportWhatsapp: string;
  officeHours: string;
}

export interface AcademicsInput {
  gradingScale?: GradingScale;
  academicYearStartMonth?: number;
  oneOfferDefault: boolean;
  allowSelfJoin: boolean;
  responseDays?: number;
  companyApprovalRequired?: boolean;
  unverifiedCompanyAccess?: boolean;
  programs: { courseId: string; specialisationIds: string[] }[];
}

export interface CollegeInput {
  id?: string;
  name: string;
  code: string;
  city: string;
  state: string;
  collegeTypeId: string;
  naacGrade: string;
  courses: string[];
  officerName: string;
  officerEmail: string;
}

type BranchRef = { id: string; name: string };

/** How one pasted course line was read against the master branch list. */
export interface BulkCoursePlan {
  preview: true;
  plan: {
    course: string;
    courseId: string | null;
    branches: (
      | { input: string; status: 'matched' | 'similar' | 'new'; branch: BranchRef }
      | { input: string; status: 'missing' }
    )[];
  }[];
  summary: { courses: number; newCourses: number; newBranches: number; mapped: number; missing: number };
}

export type BulkKind = 'branches' | 'courses' | 'colleges';

function formWith(file: File): FormData {
  const form = new FormData();
  form.append('file', file);
  return form;
}

/** One row of an uploaded branches sheet, and what adding it would do. */
export type BulkBranchRow =
  | { row: number; name: string; status: 'add' }
  | { row: number; name: string; status: 'exists'; branch: BranchRef }
  | { row: number; name: string; status: 'similar'; similar: BranchRef[] }
  | { row: number; name: string; status: 'duplicate' | 'invalid'; reason: string };

export interface BulkBranchesResult {
  preview: boolean;
  rows: BulkBranchRow[];
  summary: { rows: number; add: number; exists: number; held: number; skipped: number };
  /** After a commit: what was actually written, and the whole list now. */
  added?: { name: string; status: string; branch?: BranchRef }[];
  branches?: BranchRef[];
}

export interface BulkCourseRow {
  row: number;
  course: string;
  newCourse: boolean;
  branch: string;
  status: 'matched' | 'similar' | 'new' | 'missing' | 'none' | 'invalid';
  readAs?: string;
  reason?: string;
}

export type BulkCoursesResult = Omit<BulkCoursePlan, 'preview'> & {
  preview: boolean;
  rows: BulkCourseRow[];
  skipped: number;
  courses?: Catalogue['courses'];
  branches?: Catalogue['branches'];
};

export type BulkCollegeRow =
  | {
      row: number;
      name: string;
      code: string;
      status: 'valid';
      city: string;
      state: string;
      officerEmail: string | null;
    }
  | { row: number; name: string; code: string; status: 'invalid'; problems: string[] };

export interface BulkCollegesResult {
  preview: boolean;
  rows: BulkCollegeRow[];
  summary: { rows: number; valid: number; invalid: number; officers: number };
  added?: { row: number; id: string; name: string }[];
  skipped?: { row: number; name: string; code: string; problems: string[] }[];
  state?: OnboardingState;
}

export interface InviteOutcome {
  email: string;
  where: string;
  link?: string;
  emailed?: 'sent' | 'failed';
  note?: string;
}

export interface HelpQuestionInput {
  question: string;
  answer: string;
  isVisible: boolean;
}

export interface HelpList {
  questions: (HelpQuestionInput & { id: string })[];
  /** True until the institution saves a list of its own. */
  isDefault: boolean;
}

export const platformApi = {
  tenants: () => api.get<{ tenants: TenantCard[] }>('/platform/tenants'),
  catalogue: () => api.get<Catalogue>('/platform/catalogue'),
  checkSlug: (value: string, exclude?: string) =>
    api.get<{ valid: boolean; available: boolean; suggestion?: string | null; message?: string }>(
      `/platform/slug?value=${encodeURIComponent(value)}${exclude ? `&exclude=${exclude}` : ''}`,
    ),
  create: (data: IdentityInput) => api.post<{ tenant: TenantRecord }>('/platform/tenants', data),
  state: (id: string) => api.get<OnboardingState>(`/platform/tenants/${id}`),
  saveIdentity: (id: string, data: IdentityInput) =>
    api.put<OnboardingState>(`/platform/tenants/${id}/identity`, data),
  saveAcademics: (id: string, data: AcademicsInput) =>
    api.put<OnboardingState>(`/platform/tenants/${id}/academics`, data),
  saveColleges: (id: string, data: { colleges: CollegeInput[]; passingYears: number[] }) =>
    api.put<OnboardingState & { result: { batchesCreated: number; invites: InviteOutcome[] } }>(
      `/platform/tenants/${id}/colleges`,
      data,
    ),
  createCollege: (id: string, data: CollegeForm) =>
    api.post<OnboardingState & { result: { officer: OfficerOutcome } }>(`/platform/tenants/${id}/colleges`, data),
  updateCollege: (id: string, collegeId: string, data: CollegeForm) =>
    api.put<OnboardingState & { result: { officer: OfficerOutcome } }>(
      `/platform/tenants/${id}/colleges/${collegeId}`,
      data,
    ),
  deleteCollege: (id: string, collegeId: string) =>
    api.delete<OnboardingState>(`/platform/tenants/${id}/colleges/${collegeId}`),
  createBatches: (id: string, data: BatchForm) =>
    api.post<
      OnboardingState & {
        result: {
          created: { id: string; name: string; college: string | null }[];
          skipped: { name: string; college: string | null }[];
        };
      }
    >(`/platform/tenants/${id}/batches`, data),
  /** One batch per mapped college + course + branch, for each passing year. */
  createBatchesFromMapping: (id: string, data: { graduationYears: number[]; collegeIds?: string[] }) =>
    api.post<
      OnboardingState & {
        result: {
          created: { id: string; name: string; college: string | null }[];
          skipped: { name: string; college: string | null }[];
        };
      }
    >(`/platform/tenants/${id}/batches/from-mapping`, data),
  deleteBatch: (id: string, batchId: string) =>
    api.delete<OnboardingState>(`/platform/tenants/${id}/batches/${batchId}`),
  /** Passes an optional step (batches) without adding anything. */
  /** The student help questions, or the platform defaults to start from. */
  help: (id: string) => api.get<HelpList>(`/platform/tenants/${id}/help`),
  saveHelp: (id: string, questions: HelpQuestionInput[]) =>
    api.put<HelpList & OnboardingState>(`/platform/tenants/${id}/help`, { questions }),
  completeStep: (id: string, step: StepKey) =>
    api.post<OnboardingState>(`/platform/tenants/${id}/steps/${step}/complete`),
  saveFeatures: (id: string, selected: string[], unverifiedCompanyAccess?: boolean) =>
    api.put<OnboardingState & { result: { enabled: string[]; added: string[]; plan: string } }>(
      `/platform/tenants/${id}/features`,
      { selected, ...(unverifiedCompanyAccess === undefined ? {} : { unverifiedCompanyAccess }) },
    ),
  inviteAdmin: (
    id: string,
    data: { fullName: string; email: string; phone: string; roleId: string; sendEmail: boolean },
  ) =>
    api.post<
      OnboardingState & {
        result: { link: string; emailed: 'sent' | 'failed' | 'not asked'; reason?: string };
      }
    >(`/platform/tenants/${id}/admins`, data),
  revokeInvite: (id: string, inviteId: string) =>
    api.delete<OnboardingState>(`/platform/tenants/${id}/admins/invites/${inviteId}`),
  launch: (id: string) => api.post<OnboardingState>(`/platform/tenants/${id}/launch`),
  /** Adds a course (and its branches) to the shared list; returns it as the catalogue lists it. */
  addCourse: (name: string, branchIds: string[]) =>
    api.post<{ course: Catalogue['courses'][number]; existed: boolean }>('/platform/courses', {
      name,
      branchIds,
    }),
  /** Adds a branch to the master list. A look-alike answers 409 with `details.similar`. */
  addBranch: (name: string, confirm = false) =>
    api.post<{ branch: Catalogue['branches'][number]; existed: boolean }>('/platform/branches', { name, confirm }),
  /** A pasted list of branches; look-alikes come back as `similar`, not added. */
  addBranchesBulk: (names: string[]) =>
    api.post<{
      results: (
        | { name: string; status: 'added' | 'existed'; branch: BranchRef }
        | { name: string; status: 'similar'; similar: BranchRef[] }
        | { name: string; status: 'invalid'; reason: string }
      )[];
      added: number;
      held: number;
    }>('/platform/branches/bulk', { names }),
  /** A pasted list of courses. `preview` changes nothing; then commit does exactly what it showed. */
  addCoursesBulk: (rows: { course: string; branches: string[] }[], addMissingBranches: boolean, preview: boolean) =>
    api.post<
      | BulkCoursePlan
      | (Omit<BulkCoursePlan, 'preview'> & {
          preview: false;
          courses: Catalogue['courses'];
          branches: Catalogue['branches'];
        })
    >('/platform/courses/bulk', { rows, addMissingBranches, preview }),
  /** Excel templates for bulk add, generated with today's dropdown lists. */
  bulkTemplate: (kind: BulkKind) => api.download(`/platform/bulk/${kind}/template`, `apli-${kind}-template.xlsx`),
  /** The filled branches template. `preview` writes nothing. */
  bulkBranches: (file: File, preview: boolean) =>
    api.upload<BulkBranchesResult>(`/platform/bulk/branches/upload?preview=${preview}`, formWith(file)),
  /** The filled courses template, one row per course and branch. */
  bulkCourses: (file: File, addMissing: boolean, preview: boolean) =>
    api.upload<BulkCoursesResult>(
      `/platform/bulk/courses/upload?preview=${preview}&addMissing=${addMissing}`,
      formWith(file),
    ),
  /** The filled colleges template; rows with a problem are skipped and listed. */
  bulkColleges: (tenantId: string, file: File, preview: boolean) =>
    api.upload<BulkCollegesResult>(`/platform/bulk/tenants/${tenantId}/colleges?preview=${preview}`, formWith(file)),
  /** Offers more master branches under an existing course. */
  attachBranches:(courseId: string, branchIds: string[]) =>
    api.post<{ course: Catalogue['courses'][number] }>(`/platform/courses/${courseId}/branches`, { branchIds }),
  /** Uploads a logo or favicon; returns the address to save on the institution. */
  uploadImage: (kind: 'logo' | 'favicon', file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.upload<{ url: string }>(`/platform/uploads/${kind}`, form);
  },
  setStatus: (id: string, status: 'ACTIVE' | 'SUSPENDED') =>
    api.post<OnboardingState>(`/platform/tenants/${id}/status`, { status }),
};
