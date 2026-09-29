import { api } from './client';

export interface Education {
  id: string;
  degree: string;
  institution: string;
  board: string | null;
  startYear: number;
  endYear: number | null;
  cgpa: string | null;
  percentage: string | null;
  /**
   * Who entered it. A row the college entered is the evidence behind the
   * verified marks, so it is read-only to the student in the same way they
   * are - the API refuses to change or remove one.
   */
  source: 'STUDENT' | 'COLLEGE';
}

export interface Experience {
  id: string;
  title: string;
  organisation: string;
  location: string | null;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  description: string | null;
}

/** The most a project shows, and the most a reader will follow. */
export const MAX_PROJECT_LINKS = 6;

export interface ProjectLink {
  url: string;
  /** What it is - "Repository", "Live demo". Optional; the URL stands alone. */
  label?: string;
}

export interface Project {
  id: string;
  title: string;
  description: string | null;
  /**
   * Where the work can be seen. A list, because one project is routinely the
   * repository and a live demo and a write-up, and a single box made a
   * student choose which of them a recruiter got to follow.
   */
  links: ProjectLink[];
  startDate: string | null;
  endDate: string | null;
}

/** Every section the builder can draw, in the order it draws them by default. */
export const RESUME_SECTIONS = ['summary', 'education', 'experience', 'projects', 'skills'] as const;
export type ResumeSection = (typeof RESUME_SECTIONS)[number];

/**
 * The layouts on offer. Not skins - each is shaped for a different way of
 * being read. See the renderer for what each one is for.
 */
export const RESUME_LAYOUTS = ['classic', 'compact', 'sidebar'] as const;
export type ResumeLayout = (typeof RESUME_LAYOUTS)[number];

export interface ResumeBuild {
  summary?: string;
  sections?: ResumeSection[];
  /** Ids of entries to leave out - a weaker project, an old internship. */
  hide?: string[];
  showMarks?: boolean;
  layout?: ResumeLayout;
}

/** A resume a student keeps: built here, or uploaded. */
export interface SavedResume {
  id: string;
  name: string;
  url: string;
  source: 'BUILT' | 'UPLOADED';
  build: ResumeBuild | null;
  createdAt: string;
}

export interface CompletionSection {
  key: string;
  label: string;
  weight: number;
  done: boolean;
  hint: string;
}

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  graduationYear: number | null;
  /** What they are studying, which a role filters on by exact name. */
  course: string | null;
  specialisation: string | null;
  /**
   * The marks the college verified, which the API has always sent and the
   * type never declared. Decimals arrive as strings.
   */
  cgpa: string | null;
  tenthPct: string | null;
  twelfthPct: string | null;
  /**
   * The rest of the marks a role may set a bar on.
   *
   * A percentage-awarding university, a lateral entrant with no 12th, and
   * anybody on a master's each need one of these, and a blank fails the bar
   * that asks for it - so the form has to offer them all.
   */
  degreePct: string | null;
  diplomaPct: string | null;
  pgCgpa: string | null;
  pgPct: string | null;
  backlogs: number | null;
  activeBacklogs: number | null;
  gapYears: number | null;
  isLateralEntry: boolean;

  /** Declared by the student, read by nothing that gates. */
  isPwd: boolean;
  pwdCategories: string[];
  pwdPct: number | null;
  accommodations: string[];

  /** Null means they have not said, which is not the same as no. */
  openToRelocate: boolean | null;
  openToNightShift: boolean | null;
  openToTravel: string | null;

  headline: string | null;
  about: string | null;
  resumeUrl: string | null;
  educations: Education[];
  experiences: Experience[];
  projects: Project[];
  skills: string[];
  /**
   * The university's registration number, typed into the roster by the
   * college. Read-only here: a student cannot set it, but until now could
   * not see it either, so a digit mistyped at import surfaced at result time.
   */
  prn: string | null;
  batch: {
    id: string;
    name: string;
    course: string;
    graduationYear: number;
    college: string;
    /** The college's own number for them, and the division they sit in. */
    rollNo: string | null;
    division: string | null;
    isFrozen: boolean;
    verifiedAt: string | null;
  } | null;
  completion: { percent: number; sections: CompletionSection[] };
  /** What they chose last time they built one here, if they ever have. */
  resumeBuild: ResumeBuild | null;
}

type P = { profile: Profile };

/**
 * The courses and branches one student may say they are on.
 *
 * Not the platform catalogue, which is every course anywhere: a student is on
 * one of their own college's programmes, and offering them the rest is
 * offering a course that matches no role's criteria and says nothing about
 * why. `source` says whose list this is - anything but `catalogue` is
 * somebody's deliberate selection, so the form closes the list.
 */
export interface StudentPrograms {
  courses: { id: string; name: string; branches: { id: string; name: string }[] }[];
  source: 'college' | 'university' | 'catalogue';
}

export const candidateApi = {
  getProfile: () => api.get<P>('/candidate/profile').then((r) => r.profile),

  programs: () => api.get<StudentPrograms>('/candidate/programs'),

  saveBasics: (data: Record<string, unknown>) =>
    api.patch<P>('/candidate/profile', data).then((r) => r.profile),

  /**
   * Stores a resume and hands back its address.
   *
   * Nothing on the profile changes until the basics block is saved with that
   * address, so an abandoned upload leaves the old resume in place.
   */
  uploadResume: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.upload<{ url: string; resume: SavedResume; profile: Profile }>('/candidate/resume', form);
  },

  /** Everything they keep, newest first. */
  resumes: () => api.get<{ resumes: SavedResume[] }>('/candidate/resumes').then((r) => r.resumes),

  /** Use this one, rename it, or both. */
  updateResume: (id: string, data: { name?: string; use?: boolean }) =>
    api.patch<{ resume: SavedResume; profile: Profile }>(`/candidate/resumes/${id}`, data),

  /** Removes it, and the stored file with it. */
  deleteResume: (id: string) => api.delete<{ profile: Profile }>(`/candidate/resumes/${id}`),

  /**
   * Builds a resume from this profile and makes it theirs in one step.
   *
   * Built and used together, because a student who has just pressed Build has
   * said what they want; the choices come back on the profile so returning to
   * change one line does not mean making every choice again.
   */
  /** The same PDF the build would produce, rendered but never stored. */
  previewResume: (build: ResumeBuild) => api.postForBlob('/candidate/resume/preview', build),

  buildResume: (build: ResumeBuild & { name?: string }) =>
    api.post<{ url: string; resume: SavedResume; profile: Profile }>('/candidate/resume/build', build),

  saveSkills: (skills: string[]) =>
    api.put<P>('/candidate/skills', { skills }).then((r) => r.profile),

  addEducation: (d: Record<string, unknown>) =>
    api.post<P>('/candidate/education', d).then((r) => r.profile),
  removeEducation: (id: string) =>
    api.delete<P>(`/candidate/education/${id}`).then((r) => r.profile),

  addExperience: (d: Record<string, unknown>) =>
    api.post<P>('/candidate/experience', d).then((r) => r.profile),
  removeExperience: (id: string) =>
    api.delete<P>(`/candidate/experience/${id}`).then((r) => r.profile),

  addProject: (d: Record<string, unknown>) =>
    api.post<P>('/candidate/projects', d).then((r) => r.profile),
  removeProject: (id: string) =>
    api.delete<P>(`/candidate/projects/${id}`).then((r) => r.profile),
};

/* --- job discovery and applications ---------------------------------------- */

/**
 * Why a role might suit this student.
 *
 * Every role they can see is one they are already eligible for, so this is
 * not about eligibility - it is about which of forty to read first. The
 * reasons matter more than the number: a suggestion you cannot argue with is
 * one you cannot act on.
 */
export interface JobMatch {
  score: number;
  have: string[];
  missing: string[];
  reasons: string[];
}

export interface JobCard {
  id: string;
  title: string;
  companyName: string;
  jobType: string;
  location: string | null;
  workMode?: string | null;
  openings?: number | null;
  skills: string[];
  match: JobMatch;
  /** How it was quoted. The figures are per year either way. */
  payPeriod: 'YEARLY' | 'MONTHLY';
  ctcMin: string | null;
  ctcMax: string | null;
  deadline: string;
  roundCount: number;
  /** When it was published. Null for anything that never was. */
  postedAt: string | null;
  /** Everyone who has applied, the turned-down included. */
  applicants: number;
  applicationStatus: string | null;
  /** Present only where the institution has the honest offer card. */
  ctcFixed?: string | null;
  stipendPerMonth?: string | null;
  inHandMonthly?: number | null;
}

/** The honest offer card: the pay split, and what the fixed part is worth a month. */
export interface OfferCard {
  fixed: number | null;
  variable: number | null;
  joiningBonus: number | null;
  headline: { min: number | null; max: number | null };
  bond: { months: number | null; amount: number | null; note: string | null } | null;
  stipendPerMonth: number | null;
  internshipMonths: number | null;
  ppoCtc: number | null;
  inHand: {
    fixedYearly: number;
    monthly: number;
    monthlyExact: number;
    breakdown: { grossMonthly: number; incomeTaxMonthly: number; epfMonthly: number; professionalTaxMonthly: number };
    yearly: { taxableIncome: number; incomeTax: number; epf: number; professionalTax: number };
    assumptions: string[];
  } | null;
}

export interface StudentJobDetail {
  job: {
    id: string;
    companyId: string;
    title: string;
    description: string;
    responsibilities: string | null;
    jobType: string;
    /** What the company calls it, which may be its own word. */
    jobTypeLabel: string | null;
    location: string | null;
    /** Where exactly, where the company gave one. */
    addressLine: string | null;
    pincode: string | null;
    mapsLink: string | null;
    mapEmbedUrl: string | null;
    /** How it was quoted. The figures are per year either way. */
    payPeriod: 'YEARLY' | 'MONTHLY';
    ctcMin: string | null;
    ctcMax: string | null;
    bondMonths: number | null;
    bondAmount: string | null;
    bondNote: string | null;
    genderEligibility: 'ANY' | 'WOMEN_PREFERRED' | 'WOMEN' | 'MEN';
    genderNote: string | null;
    pwdSuitable: 'YES' | 'NO' | null;
    pwdCategories: string[] | null;
    accommodations: string[] | null;
    inclusionNote: string | null;
    shift: string | null;
    travel: string | null;
    relocationRequired: boolean;
    nightShiftSafety: string | null;
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
    deadline: string;
    openings: number | null;
    /*
     * What the role asks for. All of it is already sent - `eligibilityOf` on
     * the server puts it on the job - and the type simply never said so, so
     * a student could not be shown which bars they had cleared.
     */
    openToAll: boolean;
    minCgpa: string | null;
    minTenthPct: string | null;
    minTwelfthPct: string | null;
    minDiplomaPct: string | null;
    maxBacklogs: number | null;
    maxActiveBacklogs: number | null;
    allowedCourses: string[];
    allowedSpecialisations: string[];
    graduationYears: number[];
    /** Conditions of the role that are not open to discussion. */
    terms: string[];
    /** Derived from the rounds, so it can never disagree with them. */
    roundCount: number;
    postedAt: string | null;
    /** Everyone who has applied, the turned-down included. */
    applicants: number;
    company: {
      id: string;
      name: string;
      website: string | null;
      about: string | null;
      logoUrl: string | null;
    };
    rounds: {
      id: string;
      order: number;
      name: string;
      type: string;
      /** What the company calls it, which may be a word it invented. */
      typeLabel: string | null;
      modeLabel: string | null;
      isElimination: boolean;
      /** What sitting in this round is actually like. */
      description: string | null;
      /** Somewhere to be, or a link to open. */
      isOnline: boolean;
      addressLine: string | null;
      pincode: string | null;
      mapsLink: string | null;
      mapEmbedUrl: string | null;
      meetingLink: string | null;
      shortlistCount: number | null;
      durationMin: number | null;
      scheduledAt: string | null;
      mode: string | null;
      venue: string | null;
    }[];
  };
  application: { id: string; status: string; appliedAt: string } | null;
  canApply: boolean;
  blockedReason: string | null;
  /** Null where the institution does not have the honest offer card. */
  offerCard?: OfferCard | null;
  /** Sentences that look like a demand for money; null where the scam shield is off. */
  feeWarning?: { phrase: string; snippet: string; kind: string }[] | null;
  /** The student's own report on this role, if they made one. */
  myReport?: { reason: string; status: string; createdAt: string } | null;

  /** What applying will ask for, said before they start rather than after. */
  beforeApplying: {
    terms: string[];
    test: {
      name: string | null;
      url: string;
      instructions: string | null;
      deadline: string | null;
      required: boolean;
    } | null;
  };
}

export interface MyApplication {
  id: string;
  status: string;
  appliedAt: string;
  updatedAt: string;
  jobId: string;
  title: string;
  companyName: string;
  placementName: string;
  deadline: string;
  /**
   * The rounds, with the logistics of each.
   *
   * Being called to a round is the message; the date, the place and the link
   * are what the message is for. A student who has to reopen the job advert
   * to find out where to be on Thursday has been told half of it.
   */
  rounds: MyRound[];
  currentRound: { id: string; order: number; name: string } | null;
  lastEventAt: string;
}

export interface MyRound {
  id: string;
  order: number;
  name: string;
  type: string;
  isOnline: boolean;
  isElimination: boolean;
  /** When it happens, once the company has set a date. */
  scheduledAt: string | null;
  durationMin: number | null;
  /** Somewhere to be. */
  venue: string | null;
  addressLine: string | null;
  mapsLink: string | null;
  mapEmbedUrl: string | null;
  /** Or a link to open, for one they do not attend. */
  meetingLink: string | null;
}

export const studentJobsApi = {
  list: () =>
    api.get<{ canApply: boolean; blockedReason: string | null; jobs: JobCard[] }>(
      '/candidate/jobs',
    ),

  get: (id: string) => api.get<StudentJobDetail>(`/candidate/jobs/${id}`),

  apply: (
    id: string,
    body: {
      acceptTerms?: boolean;
      screeningRef?: string;
      /** Which resume to send. Their current one when left out. */
      resumeId?: string;
      /** Keep the one they picked as their current resume from now on. */
      makeDefault?: boolean;
    } = {},
  ) =>
    api.post<unknown>(`/candidate/jobs/${id}/apply`, body),

  applications: () =>
    api
      .get<{ applications: MyApplication[] }>('/candidate/jobs/mine/applications')
      .then((r) => r.applications),
};
