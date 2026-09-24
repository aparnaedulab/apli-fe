import { api } from './client';

export type JobStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED';

/**
 * All four are open lists a company can add to, so they are plain strings.
 *
 * Employment type is the one the form behaves differently about - a stipend
 * only makes sense for something paid monthly - so rather than branching on
 * four names it knows, it reads the traits on the chosen option.
 */
export type EmploymentType = string;
export type WorkMode = string;
export type RoundMode = string;

export type OptionKind = 'EMPLOYMENT_TYPE' | 'WORK_MODE' | 'ROUND_TYPE' | 'ROUND_MODE';

export interface JobOption {
  value: string;
  label: string;
  /** False for choices this company added. */
  isStandard: boolean;
  /** Paid monthly for a fixed number of months. Employment types only. */
  paysStipend: boolean;
  /** Can turn into a permanent job, so the form asks what it converts to. */
  convertsToPpo: boolean;
}

/** What the chosen employment type does, which decides what else is asked. */
export const traitsOf = (options: JobOption[], value: string) =>
  options.find((o) => o.value === value) ?? {
    paysStipend: false,
    convertsToPpo: false,
  };

export const EMPLOYMENT_LABELS: Record<string, string> = {
  FULL_TIME: 'Full time',
  INTERNSHIP: 'Internship',
  INTERNSHIP_PPO: 'Internship with PPO',
  CONTRACT: 'Contract',
};

export const WORK_MODE_LABELS: Record<string, string> = {
  ONSITE: 'From the office',
  HYBRID: 'Hybrid',
  REMOTE: 'Remote',
};

export const ROUND_MODE_LABELS: Record<string, string> = {
  ON_CAMPUS: 'On campus',
  ONLINE: 'Online',
  AT_OFFICE: 'At our office',
};

/** A label for a stored value, falling back to the list a company added to. */
export const labelFor = (options: JobOption[], value: string | null): string =>
  options.find((o) => o.value === value)?.label ?? value ?? '—';


export type RoundType =
  | 'RESUME_SCREEN'
  | 'MCQ_TEST'
  | 'VIDEO_INTERVIEW'
  | 'LIVE_INTERVIEW'
  | 'GROUP_DISCUSSION'
  | 'ASSIGNMENT'
  | 'WORK_SIMULATION';

export const ROUND_LABELS: Record<string, string> = {
  RESUME_SCREEN: 'Resume screen',
  MCQ_TEST: 'Online test',
  VIDEO_INTERVIEW: 'Recorded interview',
  LIVE_INTERVIEW: 'Live interview',
  GROUP_DISCUSSION: 'Group discussion',
  ASSIGNMENT: 'Assignment',
  WORK_SIMULATION: 'Work simulation',
};

export interface JobSummary {
  id: string;
  title: string;
  jobType: EmploymentType;
  workMode: WorkMode | null;
  location: string | null;
  openings: number | null;
  deadline: string;
  status: JobStatus;
  roundCount: number;
  applicationCount: number;
  accepted: number;
  pending: number;
  declined: number;
}

export interface Round {
  id: string;
  order: number;
  name: string;
  type: string;
  isElimination: boolean;
  /** What sitting in this round is actually like. */
  description: string | null;

  /** Somewhere to be, or a link to open. Never usefully both. */
  isOnline: boolean;
  addressLine: string | null;
  pincode: string | null;
  mapsLink: string | null;
  mapEmbedUrl: string | null;
  meetingLink: string | null;
  /** Roughly how many go through, where the company will say. */
  shortlistCount: number | null;
  /** A campus round is a date in a college's calendar before anything else. */
  scheduledAt: string | null;
  durationMin: number | null;
  mode: RoundMode | null;
  venue: string | null;
  /** Per-type settings. A WORK_SIMULATION round holds { simulationId }. */
  config?: Record<string, unknown>;
}

export interface Skill {
  id: string;
  name: string;
  /** Asked for rather than merely welcomed. Only set on a role's own list. */
  isRequired?: boolean;
}

/**
 * What the eligibility step is allowed to offer.
 *
 * Read from the students who exist rather than typed, because the match is on
 * exact strings: "B.E." against a roster of "B.Tech" is a role nobody sees.
 */
export interface JobMeta {
  courses: string[];
  specialisations: string[];
  graduationYears: number[];
  skills: Skill[];
  /** What each growable dropdown offers this company. */
  options: Record<OptionKind, JobOption[]>;
  /** The fixed lists behind the inclusion step. */
  inclusion: {
    pwdCategories: { key: string; label: string; hint?: string }[];
    accommodations: { key: string; label: string }[];
  };
  /** The fixed lists behind the offer questions. */
  offer: {
    ctcIncludes: { key: string; label: string }[];
    conditions: { key: string; label: string }[];
  };
}

export const EMPLOYER_LABELS: Record<string, string> = {
  DIRECT: 'Our own company',
  SUBSIDIARY: 'A subsidiary or group company',
  THIRD_PARTY: 'A staffing agency (third-party payroll)',
};

export const CTC_INCLUDE_LABELS: Record<string, string> = {
  PF: 'Employer PF contribution',
  GRATUITY: 'Gratuity',
  INSURANCE: 'Health insurance premium',
  RELOCATION: 'Relocation allowance',
  MEALS: 'Meal or food allowance',
  RETENTION: 'Retention or long-term bonus',
};

export const OFFER_CONDITION_LABELS: Record<string, string> = {
  PASS_FINAL: 'Passing the final-year exams',
  NO_BACKLOGS: 'No backlogs by the joining date',
  MIN_MARKS: 'Keeping the minimum marks until graduation',
  BACKGROUND: 'Background verification',
  MEDICAL: 'Medical fitness test',
  DOCUMENTS: 'Original documents at joining',
};

export type GenderEligibility = 'ANY' | 'WOMEN_PREFERRED' | 'WOMEN' | 'MEN';

export const GENDER_LABELS: Record<GenderEligibility, string> = {
  ANY: 'Open to all genders',
  WOMEN_PREFERRED: 'Women preferred',
  WOMEN: 'Women only',
  MEN: 'Men only',
};

/** Short names for display. The editor reads the full list, with hints, from the server. */
export const PWD_LABELS: Record<string, string> = {
  VISUAL: 'Blindness and low vision',
  HEARING: 'Deaf and hard of hearing',
  LOCOMOTOR: 'Locomotor disability',
  SPEECH: 'Speech and language disability',
  AUTISM: 'Autism spectrum disorder',
  INTELLECTUAL: 'Intellectual disability',
  LEARNING: 'Specific learning disabilities',
  MENTAL: 'Mental illness',
  NEUROLOGICAL: 'Chronic neurological conditions',
  BLOOD: 'Blood disorders',
  MULTIPLE: 'Multiple disabilities',
};

export const ACCOMMODATION_LABELS: Record<string, string> = {
  WHEELCHAIR: 'Wheelchair-accessible office and restrooms',
  SCREEN_READER: 'Screen-reader-friendly tools and documents',
  SIGN_LANGUAGE: 'Sign-language interpreter for interviews',
  EXTRA_TIME: 'Extra time in tests',
  ASSISTIVE_TECH: 'Assistive technology provided',
  FLEXIBLE_HOURS: 'Flexible working hours',
  REMOTE_OPTION: 'Work from home where needed',
  TRANSPORT: 'Accessible transport to the office',
};

export const SHIFT_LABELS: Record<string, string> = {
  DAY: 'Day shift',
  ROTATIONAL: 'Rotational shifts',
  NIGHT: 'Night shift',
  FLEXIBLE: 'Flexible hours',
};

export const TRAVEL_LABELS: Record<string, string> = {
  NONE: 'No travel',
  OCCASIONAL: 'Occasional travel',
  FREQUENT: 'Frequent travel',
};

export interface Posting {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  declineReason: string | null;
  decidedAt: string | null;
  placementId: string;
  placementName: string;
  placementYear: number;
  collegeName: string;
}

export interface JobDetail {
  id: string;
  title: string;
  description: string;
  responsibilities: string | null;
  jobType: EmploymentType;
  workMode: WorkMode | null;
  location: string | null;
  /** Where exactly, for a role with one office rather than only a city. */
  addressLine: string | null;
  pincode: string | null;
  /** Pasted off a maps app: one to open, one to embed. */
  mapsLink: string | null;
  mapEmbedUrl: string | null;
  openings: number | null;
  deadline: string;
  joiningFrom: string | null;
  status: JobStatus;

  /* What it pays. The headline range, and what it is actually made of. */
  /** How the figures were quoted. They are stored per year either way. */
  payPeriod: 'YEARLY' | 'MONTHLY';
  ctcMin: string | null;
  ctcMax: string | null;
  ctcFixed: string | null;
  ctcVariable: string | null;
  joiningBonus: string | null;
  stipendPerMonth: string | null;
  internshipMonths: number | null;
  ppoCtc: string | null;
  bondMonths: number | null;
  bondAmount: string | null;
  bondNote: string | null;

  /* A test the company wants taken before anybody applies. */
  screeningTestName: string | null;
  screeningTestUrl: string | null;
  screeningTestInstructions: string | null;
  screeningTestDeadline: string | null;
  screeningTestRequired: boolean;

  /** Conditions of the role that are not open to discussion. */
  terms: string[];

  /* Who may apply. */
  minCgpa: string | null;
  /** The same bar in the other unit. A student clears either. */
  minDegreePct: string | null;
  minTenthPct: string | null;
  minTwelfthPct: string | null;
  /** What stands in for the 12th for a lateral entrant. */
  minDiplomaPct: string | null;
  /** The master's, for a role aimed at MCA, M.Tech or MBA students. */
  minPgCgpa: string | null;
  minPgPct: string | null;
  /** Better than the bar, rather than instead of it. Sorts, never gates. */
  preferredCgpa: string | null;
  preferredDegreePct: string | null;
  maxBacklogs: number | null;
  maxActiveBacklogs: number | null;
  maxGapYears: number | null;
  allowsLateralEntry: boolean;
  /** Said out loud: no marks bar at all, rather than bars not yet filled in. */
  openToAll: boolean;

  /* Who else it is open to, and what the work is like. */
  genderEligibility: GenderEligibility;
  genderNote: string | null;
  /** YES, NO, or null for not assessed. */
  pwdSuitable: 'YES' | 'NO' | null;
  pwdCategories: string[] | null;
  accommodations: string[] | null;
  inclusionNote: string | null;
  shift: string | null;
  travel: string | null;
  relocationRequired: boolean;
  nightShiftSafety: string | null;

  /* Who employs them, and the offer. */
  designation: string | null;
  sector: string | null;
  employerType: 'DIRECT' | 'SUBSIDIARY' | 'THIRD_PARTY' | null;
  employerName: string | null;
  probationMonths: number | null;
  probationCtc: string | null;
  trainingMonths: number | null;
  trainingLocation: string | null;
  trainingStipend: string | null;
  ctcIncludes: string[] | null;
  ctcNote: string | null;
  resultDays: number | null;
  offerLetterDays: number | null;
  offerConditional: 'YES' | 'NO' | null;
  offerConditions: string[] | null;
  offerConditionNote: string | null;
  noFeeDeclaredAt: string | null;
  allowedCourses: string[];
  allowedSpecialisations: string[];
  graduationYears: number[];
  skills: Skill[];
  /** The subset of skills the role asks for rather than merely welcomes. */
  requiredSkillIds: string[];

  /** Whose role it is - the preview shows the card a student sees. */
  company: { name: string };

  rounds: Round[];
  /** Derived from the rounds, never stored beside them. */
  roundCount: number;
  postings: Posting[];
  applicationCount: number;

  /** Who at the company is running this hire, and who could be. */
  team: Colleague[];
  colleagues: (Colleague & { roleName: string })[];
}

export interface Colleague {
  id: string;
  fullName: string;
  email: string;
}

export interface DriveBatch {
  id: string;
  name: string;
  course: string | null;
  graduationYear: number | null;
  studentCount: number;
}

export interface Drive {
  id: string;
  name: string;
  type: 'FINAL' | 'INTERNSHIP';
  year: number;
  collegeName: string;
  collegeCode: string;
  collegeCity: string | null;
  collegeState: string | null;
  naacGrade: string | null;
  courses: string[];
  studentCount: number;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | null;
  /** The college's institution approves companies first, and has not approved this one. */
  needsApproval?: boolean;

  /** Every batch in the drive, and which of them this role was narrowed to. */
  batches: DriveBatch[];
  /** Empty means the whole drive, not none of it. */
  chosenBatchIds: string[];
}

/** A college on the portal that has no drive open to aim anything at. */
export interface CollegeWaiting {
  id: string;
  name: string;
  code: string;
  where: string;
}

/** One drive this role goes to, and optionally only part of it. */
export interface JobTarget {
  placementId: string;
  batchIds: string[];
}

/** How many students the role as written would actually reach. */
export interface Reach {
  inScope: number;
  eligible: number;
  verified: number;
  targeted: number;
  narrowest: { field: string; label: string; cut: number } | null;
}

export interface Readiness {
  ok: boolean;
  problems: string[];
}

export const jobApi = {
  list: () => api.get<{ jobs: JobSummary[] }>('/company/jobs').then((r) => r.jobs),

  /** Who the role reaches as written - the answer to "will anybody see this". */
  reach: (id: string) => api.get<Reach>(`/company/jobs/${id}/reach`),

  /** The courses, branches, years and skills the eligibility step offers. */
  meta: () => api.get<JobMeta>('/company/jobs/meta'),

  /** Adds a choice to one of the growable dropdowns, for this company. */
  addOption: (kind: OptionKind, label: string, traits: Record<string, boolean> = {}) =>
    api
      .post<{ option: JobOption }>('/company/jobs/options', { kind, label, ...traits })
      .then((r) => r.option),


  create: (data: Record<string, unknown>) =>
    api.post<{ job: JobDetail }>('/company/jobs', data).then((r) => r.job),

  get: (id: string) => api.get<{ job: JobDetail; readiness: Readiness }>(`/company/jobs/${id}`),

  update: (id: string, data: Record<string, unknown>) =>
    api.patch<{ job: JobDetail }>(`/company/jobs/${id}`, data).then((r) => r.job),

  setRounds: (id: string, rounds: unknown[]) =>
    api.put<{ rounds: Round[] }>(`/company/jobs/${id}/rounds`, { rounds }).then((r) => r.rounds),

  targets: (id: string) =>
    api.get<{ drives: Drive[]; notOpenYet: CollegeWaiting[] }>(`/company/jobs/${id}/targets`),

  setTeam: (id: string, userIds: string[]) =>
    api.put<{ team: string[] }>(`/company/jobs/${id}/team`, { userIds }),

  setTargets: (id: string, targets: JobTarget[]) =>
    api.put<{ targets: number }>(`/company/jobs/${id}/targets`, { targets }),

  publish: (id: string) => api.post<{ job: JobDetail }>(`/company/jobs/${id}/publish`),

  close: (id: string) => api.post<{ job: JobDetail }>(`/company/jobs/${id}/close`),

  remove: (id: string) => api.delete<void>(`/company/jobs/${id}`),
  /** The recruiter's statement that no fee is charged at any stage. */
  declareNoFee: (id: string) => api.post<void>(`/company/jobs/${id}/declare-no-fee`),
};
