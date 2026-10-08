import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import CompanyLayout from './CompanyLayout';
import {
  EMPLOYER_LABELS,
  EMPLOYMENT_LABELS,
  EmploymentType,
  GENDER_LABELS,
  SHIFT_LABELS,
  TRAVEL_LABELS,
  type GenderEligibility,
  JobMeta,
  ROUND_LABELS,
  ROUND_MODE_LABELS,
  RoundMode,
  WORK_MODE_LABELS,
  WorkMode,
  jobApi,
  traitsOf,
  type CollegeWaiting,
  type Drive,
  type JobDetail,
  type Reach,
  type Readiness,
  type Round,
  type RoundType,
} from '../../api/jobs';
import { ApiError } from '../../api/client';
import '../platform/Platform.css';
import './JobEditor.css';
import MultiSelect from '../../components/MultiSelect';
import GrowableSelect from '../../components/GrowableSelect';
import { catalogueApi, type FullCatalogue as Catalogue } from '../../api/catalogue';
import MapEmbed from '../../components/MapEmbed';
import JobPreview from './JobPreview';
import FeeWarning from '../../components/FeeWarning';
import { trustApi, type FeeHit } from '../../api/trust';
import { proofApi, type CompanySimulationRow } from '../../api/proof';

/**
 * Checks what the company is writing for any sentence asking students to pay,
 * a moment after they stop typing. It never blocks saving - a person decides -
 * but the company sees exactly what students and colleges will be warned about.
 */
function useFeeScan(text: string): FeeHit[] {
  const [hits, setHits] = useState<FeeHit[]>([]);
  useEffect(() => {
    if (!text.trim()) {
      setHits([]);
      return;
    }
    const handle = window.setTimeout(() => {
      trustApi
        .scan(text)
        .then(setHits)
        .catch(() => setHits([]));
    }, 600);
    return () => window.clearTimeout(handle);
  }, [text]);
  return hits;
}

/*
 * Package is its own step rather than four more boxes under Details.
 *
 * What a role pays is the most contested part of a campus posting - a headline
 * "12 LPA" is routinely 7 fixed - and it is what the college publishes in its
 * placement report. It earns the room.
 */
/*
 * Where the work is gets its own step rather than three more boxes under
 * Details. It is the second thing a student looks at after the pay, it is the
 * only part of a posting with a map in it, and Details had grown long enough
 * that an address at the bottom was easy to miss entirely.
 *
 * "Where it goes" was a different question - which placement cells this is
 * sent to - and the two were close enough to confuse while they shared a name.
 */
/*
 * Colleges and batches sit inside Eligibility rather than in a step of their
 * own, because they are the same question as the rest of it: who can apply.
 * A drive names the students who may see the role and a batch narrows that to
 * the group somebody maintains; courses, branches and marks then sift whoever
 * is left. Asked two steps apart, a recruiter could set a bar on the third
 * screen and not find out until the fifth that it applied to nobody.
 *
 * What is left over is the panel - which of our own people run this hire -
 * which is about us, not about them, so it keeps its own step under its own
 * name.
 */
const STEPS = ['Details', 'Package', 'Eligibility', 'Inclusion', 'Rounds', 'Panel', 'Publish'] as const;
type Step = (typeof STEPS)[number];

/** What each step is called on the page, and the one sentence under it. */
const STEP_META: Record<Step, { title: string; lede: string }> = {
  Details: {
    title: 'The role',
    lede: 'What the job is, where it is, and what the work is like day to day.',
  },
  Package: {
    title: 'What it pays',
    lede: 'The headline, and what it is really made of - fixed, variable, bonus and any bond.',
  },
  Eligibility: {
    title: 'Who can apply',
    lede: 'Which colleges and batches it goes to, and the marks and courses that sift them.',
  },
  Inclusion: {
    title: 'Inclusion',
    lede: 'Whether the role suits a person with a disability, who it is open to by gender, and the support you offer.',
  },
  Rounds: {
    title: 'The hiring process',
    lede: 'Any test before applying, then each round and where it happens.',
  },
  Panel: {
    title: 'Who runs it',
    lede: 'The people on your side who review, interview and decide.',
  },
  Publish: {
    title: 'Review and publish',
    lede: 'Check what is still missing, then send it to the colleges you chose.',
  },
};

/**
 * How far along one step is, from the role itself.
 *
 * Derived rather than tracked: a "completed steps" list would drift the first
 * time somebody edited a field from somewhere else, and a tick that lies is
 * worse than no tick.
 */
type StepState = 'done' | 'part' | 'empty';

function stateOf(step: Step, job: JobDetail): StepState {
  const some = (...xs: unknown[]) => xs.some((x) => x !== null && x !== undefined && x !== '');
  const all = (...xs: unknown[]) => xs.every((x) => x !== null && x !== undefined && x !== '');

  switch (step) {
    case 'Details':
      return all(job.title, job.description, job.openings) ? 'done' : 'part';
    case 'Package':
      return some(job.ctcMin, job.ctcMax, job.stipendPerMonth) ? 'done' : 'empty';
    case 'Eligibility': {
      /*
       * Two halves now, and the step is only done when both are answered:
       * who it goes to, and who among them may apply. Deciding there is no
       * marks bar is a decision, not an empty step.
       */
      const sifted =
        job.openToAll ||
        some(job.minCgpa, job.minDegreePct, job.minTenthPct, job.allowedCourses.length || null);
      const sent = job.postings.length > 0;
      if (sent && sifted) return 'done';
      return sent || sifted ? 'part' : 'empty';
    }
    case 'Inclusion':
      // Answering "not assessed" is not an answer; saying yes or no is.
      if (job.pwdSuitable) return 'done';
      return job.genderEligibility !== 'ANY' || job.shift ? 'part' : 'empty';
    case 'Rounds':
      return job.rounds.length > 0 ? 'done' : 'empty';
    case 'Panel':
      return job.team.length > 0 ? 'done' : 'empty';
    case 'Publish':
      return job.status === 'DRAFT' ? 'empty' : 'done';
  }
}

/**
 * Who the role reaches, as it stands.
 *
 * Shown on every step because it is the question a recruiter is actually
 * asking while they type. Zero is the interesting case and gets said loudly:
 * the usual cause is a bar set against a fact no college has recorded, and
 * the alternative to saying so here is nobody finding out until the deadline
 * passes with no applications.
 */
function ReachBar({ reach, onGo }: { reach: Reach | null; onGo: (s: Step) => void }) {
  if (!reach) return null;

  if (reach.targeted === 0) {
    return (
      <p className="reach reach-idle">
        No college chosen yet, so this reaches nobody.{' '}
        <button type="button" className="link-btn" onClick={() => onGo('Eligibility')}>
          Choose colleges
        </button>
      </p>
    );
  }

  if (reach.eligible === 0) {
    return (
      <p className="reach reach-stop">
        <b>Nobody can see this.</b> {reach.inScope} student
        {reach.inScope === 1 ? ' is' : 's are'} in the drives you chose, and none of them clear your
        criteria
        {reach.narrowest
          ? ` — ${reach.narrowest.label} alone rules out ${reach.narrowest.cut}`
          : ''}
        .{' '}
        <button type="button" className="link-btn" onClick={() => onGo('Eligibility')}>
          Loosen the criteria
        </button>
      </p>
    );
  }

  const tight = reach.inScope > 0 && reach.eligible / reach.inScope < 0.15;

  return (
    <p className={`reach ${tight ? 'reach-warn' : 'reach-ok'}`}>
      <b>
        {reach.eligible} student{reach.eligible === 1 ? '' : 's'}
      </b>{' '}
      of {reach.inScope} in your chosen drives can see this
      {reach.verified < reach.eligible && (
        <> — {reach.verified} of them verified by their college so far</>
      )}
      {tight && reach.narrowest && (
        <>
          . Narrow: {reach.narrowest.label} rules out {reach.narrowest.cut}.
        </>
      )}
    </p>
  );
}

export default function JobEditor() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [step, setStep] = useState<Step>('Details');
  // Closed until asked for: the form gets the whole width, and "Preview"
  // opens it beside the form (or over the page on a smaller screen).
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * The lists behind the dropdowns, loaded once for the whole form.
   *
   * Reloaded whenever a step saves, because a step may have added to one:
   * somebody who invents "Machine test" on the Rounds step should see it in
   * the Details step too, without a page refresh to explain.
   */
  const [meta, setMeta] = useState<JobMeta | null>(null);

  /*
   * How many students the role as written would actually reach.
   *
   * Refetched after every save, because it is the answer to the question a
   * recruiter is really asking while they type: is anybody going to see this?
   */
  const [reach, setReach] = useState<Reach | null>(null);

  const loadMeta = useCallback(async () => {
    try {
      setMeta(await jobApi.meta());
    } catch {
      setMeta(null);
    }
  }, []);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  const refresh = useCallback(async () => {
    try {
      const { job: j, readiness: r } = await jobApi.get(id);
      setJob(j);
      setReadiness(r);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this role.');
    }
  }, [id]);

  const loadReach = useCallback(async () => {
    try {
      setReach(await jobApi.reach(id));
    } catch {
      setReach(null);
    }
  }, [id]);

  /** After any save: the role, the lists, and who it now reaches. */
  const refreshAll = useCallback(async () => {
    await Promise.all([refresh(), loadMeta(), loadReach()]);
  }, [refresh, loadMeta, loadReach]);

  useEffect(() => {
    void loadReach();
  }, [loadReach]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (error && !job) {
    return (
      <CompanyLayout>
        <p className="alert alert-error">{error}</p>
        <p className="crumb">
          <Link to="/company/jobs">← All roles</Link>
        </p>
      </CompanyLayout>
    );
  }

  if (!job) {
    return (
      <CompanyLayout>
        <p className="muted">Loading…</p>
      </CompanyLayout>
    );
  }

  const isDraft = job.status === 'DRAFT';

  // The card is the student's view, so it carries the company's name rather
  // than the name of whoever happens to be logged in writing it.
  const companyName = job.company.name;

  const index = STEPS.indexOf(step);
  const meta2 = STEP_META[step];
  const states = STEPS.map((s) => stateOf(s, job));
  const doneCount = states.filter((x) => x === 'done').length;
  const next = STEPS[index + 1];
  const prev = STEPS[index - 1];

  function go(s: Step) {
    setStep(s);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /*
   * Laid out like the institution onboarding wizard: the journey on the left,
   * one step in the middle with a single "Save & continue", and the card a
   * student will see on the right, repainting after every save.
   */
  return (
    <AdvanceContext.Provider value={() => next && go(next)}>
      <div className={`ob job-wizard ${showPreview ? 'show-preview' : ''}`}>
        <aside className="ob-rail">
          <Link to="/company/jobs" className="ob-home">
            <span className="brand-mark" aria-hidden="true" />
            <span>
              <strong>{job.title || 'New role'}</strong>
              <small>← All roles</small>
            </span>
          </Link>

          <ol className="ob-steps">
            {STEPS.map((s, i) => {
              const state = states[i]!;
              const current = s === step;
              return (
                <li key={s} className={`ob-step ${current ? 'is-current' : ''} ${state === 'done' ? 'is-done' : ''}`}>
                  <button type="button" onClick={() => go(s)} aria-current={current ? 'step' : undefined}>
                    <span className="ob-step-dot" aria-hidden="true">
                      {state === 'done' && !current ? (
                        <svg viewBox="0 0 16 16">
                          <path
                            d="m3.5 8.5 3 3 6-7"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span className="ob-step-text">
                      <span className="ob-step-title">{STEP_META[s].title}</span>
                      <span className="ob-step-sum">
                        {current ? 'In progress' : state === 'done' ? 'Filled in' : state === 'part' ? 'Started' : 'Not started'}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {/* What is still stopping this going out, wherever you are. */}
          {isDraft && readiness && !readiness.ok && (
            <div className="rail-todo">
              <p className="rail-todo-head">Before publishing</p>
              <ul>
                {readiness.problems.slice(0, 4).map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="ob-progress" aria-label={`${doneCount} of ${STEPS.length} steps filled in`}>
            <div className="ob-progress-bar">
              <span style={{ width: `${(doneCount / STEPS.length) * 100}%` }} />
            </div>
            <p>
              {doneCount} of {STEPS.length} filled in
              <span className={`pill ${isDraft ? 'pill-idle' : job.status === 'PUBLISHED' ? 'pill-pass' : 'pill-hold'}`}>
                {isDraft ? 'Draft' : job.status === 'PUBLISHED' ? 'Published' : 'Closed'}
              </span>
            </p>
          </div>
        </aside>

        <main className="ob-main">
          <header className="ob-head">
            <div className="ob-head-top">
              <p className="eyebrow">
                Step {index + 1} of {STEPS.length}
                <span className="ob-head-tenant"> · {companyName}</span>
              </p>
              <div className="ob-head-tools">
                {job.status === 'PUBLISHED' && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={async () => {
                      await jobApi.close(job.id);
                      void refresh();
                    }}
                  >
                    Close role
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-ghost ob-preview-toggle"
                  onClick={() => setShowPreview((v) => !v)}
                >
                  {showPreview ? 'Hide preview' : 'Preview'}
                </button>
                <Link to="/company/jobs" className="btn btn-ghost">
                  Exit
                </Link>
              </div>
            </div>
            <h1>{meta2.title}</h1>
            <p className="ob-lede">
              {meta2.lede}
              {!isDraft && ' Published roles are fixed now that students can see them.'}
            </p>
          </header>

          {error && <p className="alert alert-error">{error}</p>}

          <div className="ob-body job-wizard-body" key={step}>
            {/*
              Who this reaches, on every step rather than only at the end. It is
              the one number that says whether what you have written works, and
              the publish screen is too late to find out.
            */}
            {isDraft && <ReachBar reach={reach} onGo={go} />}

            {step === 'Details' && (
              <DetailsStep job={job} meta={meta} editable={isDraft} onSaved={refreshAll} />
            )}
            {step === 'Package' && (
              <PackageStep job={job} meta={meta} editable={isDraft} onSaved={refreshAll} />
            )}
            {step === 'Eligibility' && (
              <>
                {/* Who it goes to first, then who among them may apply. */}
                <TargetsStep job={job} onSaved={refreshAll} />
                <EligibilityStep job={job} meta={meta} editable={isDraft} onSaved={refreshAll} />
              </>
            )}
            {step === 'Inclusion' && (
              <InclusionStep job={job} meta={meta} editable={isDraft} onSaved={refreshAll} />
            )}
            {step === 'Rounds' && (
              <>
                <ScreeningStep job={job} editable={isDraft} onSaved={refreshAll} />
                <RoundsStep job={job} meta={meta} editable={isDraft} onSaved={refreshAll} />
              </>
            )}
            {step === 'Panel' && <JobTeamStep job={job} editable={isDraft} onSaved={refresh} />}
            {step === 'Publish' && (
              <PublishStep
                job={job}
                readiness={readiness}
                reach={reach}
                onPublished={refresh}
                onDeclared={refreshAll}
                onDeleted={() => navigate('/company/jobs')}
              />
            )}

            {/* Moving on without saving is allowed - every step saves itself. */}
            <nav className="step-foot job-step-nav" aria-label="Move between steps">
              <div className="step-foot-row">
                {prev ? (
                  <button type="button" className="btn btn-ghost" onClick={() => go(prev)}>
                    ← {STEP_META[prev].title}
                  </button>
                ) : (
                  <span />
                )}
                <span className="step-foot-note">
                  {step !== 'Publish' && isDraft ? 'Saved steps stay saved. Nothing is sent until you publish.' : ''}
                </span>
                {next ? (
                  <button type="button" className="btn btn-secondary" onClick={() => go(next)}>
                    {STEP_META[next].title} →
                  </button>
                ) : (
                  <span />
                )}
              </div>
            </nav>
          </div>
        </main>

        {showPreview && (
          <aside className="ob-preview job-wizard-preview" aria-label="Preview of the role as students see it">
            <div className="jw-preview-head">
              <span>Preview · how students see it</span>
              <button type="button" className="jw-preview-x" onClick={() => setShowPreview(false)} aria-label="Hide preview">
                ×
              </button>
            </div>
            <JobPreview job={job} reach={reach} companyName={companyName} />
          </aside>
        )}
      </div>
    </AdvanceContext.Provider>
  );
}

/* -------------------------------------------------------------------------- */

/** Both edit steps post the whole job, so they share one payload builder. */
/**
 * The whole role, every time.
 *
 * Each step sends the complete job with its own fields overridden, so saving
 * one step can never quietly blank the fields belonging to another.
 */
function payloadFrom(job: JobDetail, overrides: Record<string, unknown>) {
  const money = (v: string | null) => (v ? Number(v) : undefined);

  return {
    title: job.title,
    description: job.description,
    responsibilities: job.responsibilities ?? '',
    jobType: job.jobType,
    workMode: job.workMode ?? undefined,
    location: job.location ?? '',
    addressLine: job.addressLine ?? '',
    pincode: job.pincode ?? '',
    mapsLink: job.mapsLink ?? '',
    mapEmbedUrl: job.mapEmbedUrl ?? '',
    openings: job.openings ?? undefined,
    deadline: job.deadline,
    joiningFrom: job.joiningFrom ?? '',

    ctcMin: money(job.ctcMin),
    ctcMax: money(job.ctcMax),
    ctcFixed: money(job.ctcFixed),
    ctcVariable: money(job.ctcVariable),
    joiningBonus: money(job.joiningBonus),
    stipendPerMonth: money(job.stipendPerMonth),
    internshipMonths: job.internshipMonths ?? undefined,
    ppoCtc: money(job.ppoCtc),
    payPeriod: job.payPeriod,
    bondMonths: job.bondMonths ?? undefined,
    bondAmount: money(job.bondAmount),
    bondNote: job.bondNote ?? '',

    screeningTestName: job.screeningTestName ?? '',
    screeningTestUrl: job.screeningTestUrl ?? '',
    screeningTestInstructions: job.screeningTestInstructions ?? '',
    screeningTestDeadline: job.screeningTestDeadline ?? '',
    screeningTestRequired: job.screeningTestRequired,

    terms: job.terms,

    minCgpa: money(job.minCgpa),
    minDegreePct: money(job.minDegreePct),
    minTenthPct: money(job.minTenthPct),
    minTwelfthPct: money(job.minTwelfthPct),
    minDiplomaPct: money(job.minDiplomaPct),
    minPgCgpa: money(job.minPgCgpa),
    minPgPct: money(job.minPgPct),
    preferredCgpa: money(job.preferredCgpa),
    preferredDegreePct: money(job.preferredDegreePct),
    /*
     * Backlogs, gap years and graduating years are no longer asked for on the
     * form, but they are still carried on every save - a role that was created
     * with them keeps filtering on them, rather than quietly opening up to
     * people it had excluded the moment somebody edits an unrelated step.
     *
     * Graduating year left the form because a year is a worse way of saying
     * what a batch says exactly: "CSE 2026" is a group somebody maintains,
     * 2026 is a guess about who is in it. Roles are aimed at batches now,
     * chosen on this same step inside the drive they are posted into.
     */
    maxBacklogs: job.maxBacklogs ?? undefined,
    maxActiveBacklogs: job.maxActiveBacklogs ?? undefined,
    maxGapYears: job.maxGapYears ?? undefined,
    allowsLateralEntry: job.allowsLateralEntry,
    openToAll: job.openToAll,
    allowedCourses: job.allowedCourses,
    allowedSpecialisations: job.allowedSpecialisations,
    graduationYears: job.graduationYears,
    skillIds: job.skills.map((s) => s.id),
    requiredSkillIds: job.requiredSkillIds,

    genderEligibility: job.genderEligibility,
    genderNote: job.genderNote ?? '',
    pwdSuitable: job.pwdSuitable ?? '',
    pwdCategories: job.pwdCategories ?? [],
    accommodations: job.accommodations ?? [],
    inclusionNote: job.inclusionNote ?? '',
    shift: job.shift ?? '',
    travel: job.travel ?? '',
    relocationRequired: job.relocationRequired,
    nightShiftSafety: job.nightShiftSafety ?? '',

    designation: job.designation ?? '',
    sector: job.sector ?? '',
    employerType: job.employerType ?? '',
    employerName: job.employerName ?? '',
    probationMonths: job.probationMonths ?? undefined,
    probationCtc: money(job.probationCtc),
    trainingMonths: job.trainingMonths ?? undefined,
    trainingLocation: job.trainingLocation ?? '',
    trainingStipend: money(job.trainingStipend),
    ctcIncludes: job.ctcIncludes ?? [],
    ctcNote: job.ctcNote ?? '',
    resultDays: job.resultDays ?? undefined,
    offerLetterDays: job.offerLetterDays ?? undefined,
    offerConditional: job.offerConditional ?? '',
    offerConditions: job.offerConditions ?? [],
    offerConditionNote: job.offerConditionNote ?? '',
    ...overrides,
  };
}

/** A number field that means "not stated" when it is left empty. */
const numberOrNothing = (v: string) => (v.trim() === '' ? undefined : Number(v));

/** A date input holds a day; the API wants an instant. */
const endOfDay = (v: string) => (v ? new Date(`${v}T23:59:59`).toISOString() : '');
const startOfDay = (v: string) => (v ? new Date(`${v}T00:00:00`).toISOString() : '');

/**
 * Moves the wizard on a step. Provided by the shell, so a step's own
 * "Save & continue" can advance without knowing what comes next.
 */
const AdvanceContext = createContext<() => void>(() => {});

/**
 * One step's save. With `continues`, a successful save also moves to the next
 * step - the wizard's single primary action. Steps that save in several
 * places (rounds, the panel, drives) leave it off and use the step footer.
 */
function useSave(onSaved: () => void, options: { continues?: boolean } = {}) {
  const advance = useContext(AdvanceContext);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
      onSaved();
      if (options.continues) advance();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return { busy, saved, error, save };
}

function DetailsStep({
  job,
  meta,
  editable,
  onSaved,
}: {
  job: JobDetail;
  meta: JobMeta | null;
  editable: boolean;
  onSaved: () => void;
}) {
  const { busy, saved, error, save } = useSave(onSaved, { continues: true });
  const [terms, setTerms] = useState<string[]>(job.terms.length ? job.terms : ['']);

  /*
   * Where the work is, picked rather than typed. Held as a list here and
   * stored as the one string the rest of the portal already shows, so nothing
   * downstream had to change to read it.
   */
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  /*
   * The exact address, and the point it was looked up to.
   *
   * The cities above are what a student filters on; this is what they put in
   * a maps app the morning they have to turn up. The pin is cleared whenever
   * the address changes, because a pin looked up for a different address is
   * worse than none at all.
   */

  useEffect(() => {
    catalogueApi
      .all()
      .then(setCatalogue)
      .catch(() => setCatalogue(null));
  }, []);

  /*
   * Skills describe the role, which is why they sit here rather than with the
   * criteria. Nothing in this list hides the role from anybody - every other
   * thing on the Eligibility step does, and keeping them there implied they
   * excluded people.
   */
  const [skillIds, setSkillIds] = useState<string[]>(job.skills.map((s) => s.id));
  const [requiredSkillIds, setRequiredSkillIds] = useState<string[]>(job.requiredSkillIds);

  const skillNames = useMemo(
    () => new Map((meta?.skills ?? []).map((s) => [s.name, s.id])),
    [meta],
  );
  const skillsById = useMemo(
    () => new Map((meta?.skills ?? job.skills).map((s) => [s.id, s.name])),
    [meta, job.skills],
  );
  /*
   * Where the work is - which is not where the interviews are.
   *
   * Interviews move around: a test online, a round in a college hall, a final
   * at the office. That belongs to each round and is asked there. This is the
   * one address that does not move, the posting a student is deciding whether
   * to take, and it is the reason the two were pulled apart.
   */
  const [f, setF] = useState({
    title: job.title,
    description: job.description,
    responsibilities: job.responsibilities ?? '',
    jobType: job.jobType,
    workMode: job.workMode ?? '',
    location: job.location ?? '',
    addressLine: job.addressLine ?? '',
    pincode: job.pincode ?? '',
    mapsLink: job.mapsLink ?? '',
    mapEmbedUrl: job.mapEmbedUrl ?? '',
    openings: job.openings !== null ? String(job.openings) : '',
    deadline: job.deadline.slice(0, 10),
    joiningFrom: job.joiningFrom ? job.joiningFrom.slice(0, 10) : '',
    shift: job.shift ?? '',
    travel: job.travel ?? '',
    nightShiftSafety: job.nightShiftSafety ?? '',
    designation: job.designation ?? '',
    sector: job.sector ?? '',
    employerType: job.employerType ?? '',
    employerName: job.employerName ?? '',
  });
  const [relocation, setRelocation] = useState(job.relocationRequired);

  const feeHits = useFeeScan([f.title, f.description, f.responsibilities, ...terms].join('\n'));

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void save(() =>
      jobApi.update(
        job.id,
        payloadFrom(job, {
          title: f.title,
          description: f.description,
          responsibilities: f.responsibilities,
          jobType: f.jobType,
          workMode: f.workMode || undefined,
          location: f.location,
          addressLine: f.addressLine,
          pincode: f.pincode,
          mapsLink: f.mapsLink,
          mapEmbedUrl: f.mapEmbedUrl,
          openings: numberOrNothing(f.openings),
          deadline: endOfDay(f.deadline),
          joiningFrom: startOfDay(f.joiningFrom),
          shift: f.shift,
          travel: f.travel,
          relocationRequired: relocation,
          nightShiftSafety: f.nightShiftSafety,
          designation: f.designation,
          sector: f.sector,
          employerType: f.employerType,
          employerName: f.employerName,
          terms: terms.map((t) => t.trim()).filter(Boolean),
          skillIds,
          // Only the ones still chosen: unticking a skill takes it out of
          // both lists rather than leaving it required but absent.
          requiredSkillIds: requiredSkillIds.filter((id) => skillIds.includes(id)),
        }),
      ),
    );
  }

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  // What the chosen type does, rather than what it is called.
  const traits = traitsOf(meta?.options.EMPLOYMENT_TYPE ?? [], f.jobType);

  return (
    <form className="card form-card" onSubmit={onSubmit} noValidate>
      <h2>The role</h2>
      {error && <p className="alert alert-error">{error}</p>}

      <div className="form-row">
        <label className="field">
          <span className="field-label">Title</span>
          <input
            value={f.title}
            onChange={set('title')}
            required
            placeholder="Software Engineer"
            disabled={!editable || busy}
          />
        </label>
        <label className="field">
          <span className="field-label">Type</span>
          <GrowableSelect
            value={f.jobType}
            options={meta?.options.EMPLOYMENT_TYPE ?? []}
            onChange={(v) => setF((p) => ({ ...p, jobType: v }))}
            onAdd={(label, traits) => jobApi.addOption('EMPLOYMENT_TYPE', label, traits)}
            disabled={!editable || busy}
            addLabel="Add a kind of role…"
            /*
             * The only dropdown whose answer changes the rest of the form, so
             * it is the only one that asks anything back. Without these two
             * the Package step has no way to know whether to ask for a stipend.
             */
            traitsIntro="The Package step changes with this, so it needs to know what the new kind does."
            traits={[
              {
                key: 'paysStipend',
                label: 'Paid a stipend each month',
                hint: 'Package will ask for a monthly figure and how many months it runs.',
              },
              {
                key: 'convertsToPpo',
                label: 'Can turn into a permanent job',
                hint: 'Package will ask what the CTC is if it converts.',
                requires: 'paysStipend',
              },
            ]}
          />
          {traits.paysStipend && (
            <span className="field-hint">The Package step will ask for a stipend.</span>
          )}
        </label>
        <label className="field">
          <span className="field-label">
            Openings<span className="req">required to publish</span>
          </span>
          <input
            type="number"
            min="1"
            value={f.openings}
            onChange={set('openings')}
            placeholder="12"
            disabled={!editable || busy}
          />
          <span className="field-hint">
            The first thing a placement cell asks, and how a student judges their odds.
          </span>
        </label>
      </div>

      <div className="form-row">
        <label className="field">
          <span className="field-label">Designation on the offer letter</span>
          <input
            value={f.designation}
            onChange={set('designation')}
            placeholder="Associate Software Engineer"
            disabled={!editable || busy}
          />
          <span className="field-hint">Often not the posting's title. It is what goes on the student's CV.</span>
        </label>
        <label className="field">
          <span className="field-label">Sector</span>
          <select value={f.sector} onChange={set('sector')} disabled={!editable || busy}>
            <option value="">Choose a sector</option>
            {(catalogue?.industries ?? []).map((i) => (
              <option key={i.id} value={i.name}>
                {i.name}
              </option>
            ))}
          </select>
          <span className="field-hint">Colleges report placements by sector.</span>
        </label>
      </div>

      <fieldset className="sub-block">
        <legend>
          Who employs the student <span className="req">required to publish</span>
        </legend>
        <p className="muted">
          The first thing a university checks. A student should know before applying whether the offer is from
          you or from an agency placing them with you.
        </p>
        <div className="form-row">
          <label className="field">
            <span className="field-label">On whose payroll</span>
            <select value={f.employerType} onChange={set('employerType')} disabled={!editable || busy}>
              <option value="">Choose one</option>
              {Object.entries(EMPLOYER_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          {f.employerType && f.employerType !== 'DIRECT' && (
            <label className="field">
              <span className="field-label">
                Employer's registered name<span className="req">required</span>
              </span>
              <input
                value={f.employerName}
                onChange={set('employerName')}
                placeholder={
                  f.employerType === 'THIRD_PARTY' ? 'Demo Staffing Services Pvt. Ltd.' : 'Demo Labs India Pvt. Ltd.'
                }
                disabled={!editable || busy}
              />
            </label>
          )}
        </div>
      </fieldset>

      <div className="form-row">
        <label className="field">
          <span className="field-label">Where will they work</span>
          <GrowableSelect
            value={f.workMode}
            options={meta?.options.WORK_MODE ?? []}
            onChange={(v) => setF((p) => ({ ...p, workMode: v }))}
            onAdd={(label) => jobApi.addOption('WORK_MODE', label)}
            disabled={!editable || busy}
            includeBlank
            addLabel="Add a way of working…"
          />
        </label>
        <label className="field">
          <span className="field-label">City</span>
          {/* From the city list, so "Pune" is spelt one way on every role -
              a student filtering by city otherwise misses half of them. */}
          <input
            value={f.location}
            onChange={set('location')}
            placeholder="Pune"
            list="job-cities"
            disabled={!editable || busy}
          />
          <datalist id="job-cities">
            {(catalogue?.cities ?? []).map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <span className="field-hint">Pick from the list. For several, separate with commas.</span>
        </label>
        <label className="field">
          <span className="field-label">Apply by</span>
          <input
            type="date"
            value={f.deadline}
            onChange={set('deadline')}
            required
            disabled={!editable || busy}
          />
        </label>
        <label className="field">
          <span className="field-label">Likely joining</span>
          <input
            type="date"
            value={f.joiningFrom}
            onChange={set('joiningFrom')}
            disabled={!editable || busy}
          />
          <span className="field-hint">Not the same as the deadline. Students plan around it.</span>
        </label>
      </div>

      <fieldset className="sub-block">
        <legend>Working conditions</legend>
        <p className="muted">
          What a student asks in the last round and should have known before applying. Said here, it shows
          on the role as a fact rather than a surprise.
        </p>
        <div className="form-row">
          <label className="field">
            <span className="field-label">Shifts</span>
            <select value={f.shift} onChange={set('shift')} disabled={!editable || busy}>
              <option value="">Not stated</option>
              {Object.entries(SHIFT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Travel</span>
            <select value={f.travel} onChange={set('travel')} disabled={!editable || busy}>
              <option value="">Not stated</option>
              {Object.entries(TRAVEL_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="check-row">
          <input
            type="checkbox"
            checked={relocation}
            onChange={(e) => setRelocation(e.target.checked)}
            disabled={!editable || busy}
          />
          <span>
            <b>Must be willing to relocate</b>
            <span className="check-hint">The student may be posted to another city than the one above.</span>
          </span>
        </label>

        {(f.shift === 'NIGHT' || f.shift === 'ROTATIONAL') && (
          <label className="field">
            <span className="field-label">Transport and safety at night</span>
            <textarea
              rows={2}
              value={f.nightShiftSafety}
              onChange={set('nightShiftSafety')}
              placeholder="Company cab with a security guard for women employees, door-to-door drop after 8 pm, and an internal complaints committee."
              disabled={!editable || busy}
            />
            <span className="field-hint">
              Maharashtra law requires these arrangements for women working at night. Colleges ask for them.
            </span>
          </label>
        )}
      </fieldset>

      <label className="field">
        <span className="field-label">Description</span>
        <textarea
          value={f.description}
          onChange={set('description')}
          rows={5}
          required
          placeholder="You will join the payments team building services used by two million merchants. In your first year you will work on APIs, write tests and ship to production with a senior engineer as your mentor."
          disabled={!editable || busy}
        />
      </label>

      <label className="field">
        <span className="field-label">Responsibilities</span>
        <textarea
          value={f.responsibilities}
          onChange={set('responsibilities')}
          rows={4}
          placeholder={'Build and maintain backend services in Java\nWrite unit and integration tests\nTake part in code reviews and on-call rotations'}
          disabled={!editable || busy}
        />
      </label>

      <FeeWarning hits={feeHits} title="This reads like you are asking students to pay.">
        Students are warned about any role that mentions a fee or deposit, and colleges see it before they decide
        whether to accept the role. If there is no charge, reword these lines.
      </FeeWarning>

      <MultiSelect
        label="Skills you would welcome"
        hint="These never hide the role from anybody - a half-filled profile is not a reason to lose a good candidate. They sort your applicant list, so whoever has them is the first name you read."

        options={(meta?.skills ?? []).map((s) => s.name)}
        selected={skillIds.map((id) => skillsById.get(id) ?? id)}
        onChange={(names) =>
          setSkillIds(names.map((n) => skillNames.get(n)).filter((id): id is string => Boolean(id)))
        }
        disabled={!editable || busy}
        emptyMeans="None stated"
        noOptions="No skills set up yet. Operations adds them under Setup."
      />

      {skillIds.length > 0 && (
        <div className="asked-for">
          <p className="field-label">Which of those are you really asking for?</p>
          <p className="muted">
            Somebody holding these is counted twice over in your applicant list. Still nobody is
            excluded &mdash; a student who never filled in their skills is not a student you want to
            lose sight of.
          </p>
          <div className="chip-list">
            {skillIds.map((id) => {
              const name = skillsById.get(id) ?? id;
              const on = requiredSkillIds.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  className={`chip ${on ? 'is-on' : ''}`}
                  aria-pressed={on}
                  disabled={!editable || busy}
                  onClick={() =>
                    setRequiredSkillIds((prev) =>
                      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
                    )
                  }
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/*
        The office, which is not where the interviews are - those move around
        and are asked on each round. Behind a summary because it matters after
        somebody joins rather than while they are deciding to apply.
      */}
      {f.workMode !== 'REMOTE' && (
        <details className="office" open={Boolean(f.addressLine)}>
          <summary>Office address &mdash; optional</summary>

          <div className="form-row">
            <label className="field">
              <span className="field-label">Address</span>
              <textarea
                rows={2}
                value={f.addressLine}
                onChange={set('addressLine')}
                placeholder="Tower B, Panchshil Business Park, Balewadi"
                disabled={!editable || busy}
              />
            </label>
            <label className="field">
              <span className="field-label">PIN code</span>
              <input
                value={f.pincode}
                onChange={set('pincode')}
                placeholder="411045"
                inputMode="numeric"
                disabled={!editable || busy}
              />
            </label>
          </div>

          <label className="field">
            <span className="field-label">Maps link</span>
            <input
              value={f.mapsLink}
              onChange={set('mapsLink')}
              placeholder="https://maps.app.goo.gl/…"
              disabled={!editable || busy}
            />
          </label>

          <label className="field">
            <span className="field-label">
              Map embed <span className="muted">optional, for the preview</span>
            </span>
            <input
              value={f.mapEmbedUrl}
              onChange={set('mapEmbedUrl')}
              placeholder="https://www.google.com/maps/embed?pb=!1m18…"
              disabled={!editable || busy}
            />
            <span className="field-hint">
              On Google Maps &rarr; Share &rarr; Embed a map &rarr; COPY HTML. Paste the whole{' '}
              <span className="mono">&lt;iframe&gt;</span> if you like &mdash; only the link is
              kept.
            </span>
          </label>

          {job.mapEmbedUrl && (
            <MapEmbed
              embedUrl={job.mapEmbedUrl}
              mapsLink={job.mapsLink}
              label={f.addressLine || f.location}
            />
          )}
        </details>
      )}

      <fieldset className="sub-block">
        <legend>What is not open to discussion</legend>
        <p className="muted">
          Relocation, a bond, night shifts, a service agreement &mdash; the things a student
          otherwise finds out in the last round. Every applicant has to accept these before they can
          apply, and the date they did is kept on their application.
        </p>

        <ol className="term-list">
          {terms.map((t, i) => (
            <li key={i}>
              <input
                value={t}
                onChange={(e) =>
                  setTerms((prev) => prev.map((x, k) => (k === i ? e.target.value : x)))
                }
                placeholder="Posted anywhere in India at the company's discretion"
                disabled={!editable || busy}
              />
              {editable && terms.length > 1 && (
                <button
                  type="button"
                  className="is-danger"
                  onClick={() => setTerms((prev) => prev.filter((_, k) => k !== i))}
                  aria-label="Remove this condition"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ol>

        {editable && terms.length < 20 && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setTerms((prev) => [...prev, ''])}
          >
            + Add a condition
          </button>
        )}
      </fieldset>

      {editable && (
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : saved ? 'Saved' : 'Save & continue'}
        </button>
      )}
    </form>
  );
}

/**
 * What the role pays, and what the headline is actually made of.
 *
 * "12 LPA" is routinely 7 fixed, 3 variable and a joining bonus, and a college
 * publishes the fixed figure in its placement report. Asking for the breakup
 * here is what makes that report true and lets a student compare two offers.
 */
/**
 * Where the work actually is.
 *
 * Its own step because it is the second thing a student looks at after the
 * pay, and because it is the only part of a posting that draws a map. The
 * links are pasted off a maps app rather than looked up from the address: a
 * geocoder guesses, and a link somebody copied while looking at the right
 * building does not.
 */
function PackageStep({
  job,
  meta,
  editable,
  onSaved,
}: {
  job: JobDetail;
  meta: JobMeta | null;
  editable: boolean;
  onSaved: () => void;
}) {
  const { busy, saved, error, save } = useSave(onSaved, { continues: true });

  /*
   * Plenty of campus roles are advertised per month, and a recruiter made to
   * multiply by twelve in their head will sooner or later slip a zero. The
   * figures are still stored per year - a placement report has to add them up
   * and compare them, so there can only be one unit - and this is only how
   * they are typed and shown back.
   */
  const [period, setPeriod] = useState<'YEARLY' | 'MONTHLY'>(job.payPeriod);

  const [f, setF] = useState({
    ctcMin: job.ctcMin ?? '',
    ctcMax: job.ctcMax ?? '',
    ctcFixed: job.ctcFixed ?? '',
    ctcVariable: job.ctcVariable ?? '',
    joiningBonus: job.joiningBonus ?? '',
    stipendPerMonth: job.stipendPerMonth ?? '',
    internshipMonths: job.internshipMonths !== null ? String(job.internshipMonths) : '',
    ppoCtc: job.ppoCtc ?? '',
    bondMonths: job.bondMonths !== null ? String(job.bondMonths) : '',
    bondAmount: job.bondAmount ?? '',
    bondNote: job.bondNote ?? '',
    probationMonths: job.probationMonths !== null ? String(job.probationMonths) : '',
    probationCtc: job.probationCtc ?? '',
    trainingMonths: job.trainingMonths !== null ? String(job.trainingMonths) : '',
    trainingLocation: job.trainingLocation ?? '',
    trainingStipend: job.trainingStipend ?? '',
    ctcNote: job.ctcNote ?? '',
    resultDays: job.resultDays !== null ? String(job.resultDays) : '',
    offerLetterDays: job.offerLetterDays !== null ? String(job.offerLetterDays) : '',
    offerConditionNote: job.offerConditionNote ?? '',
  });
  const [ctcIncludes, setCtcIncludes] = useState<string[]>(job.ctcIncludes ?? []);
  const [conditional, setConditional] = useState<'' | 'YES' | 'NO'>(job.offerConditional ?? '');
  const [conditions, setConditions] = useState<string[]>(job.offerConditions ?? []);
  const flip = (list: string[], set: (v: string[]) => void, key: string) =>
    set(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);

  /*
   * Most roles have no bond at all, and four empty boxes read as four things
   * somebody forgot to fill in. Asked once, and the detail only appears if the
   * answer is yes.
   */
  const [hasBond, setHasBond] = useState(Boolean(job.bondMonths || job.bondAmount || job.bondNote));

  // Asked of the chosen type rather than assumed from its name, so a kind a
  // company invented gets the same fields as one that shipped.
  const traits = traitsOf(meta?.options.EMPLOYMENT_TYPE ?? [], job.jobType);
  const internship = traits.paysStipend;
  const converts = traits.convertsToPpo;

  /** A typed figure as it is stored: per year, whatever the toggle says. */
  const perYear = (v: string) => {
    const n = numberOrNothing(v);
    if (n === undefined) return undefined;
    return period === 'MONTHLY' ? Math.round(n * 12) : n;
  };

  /** And back again, for the boxes. */
  const shown = (v: string) => {
    if (v.trim() === '') return '';
    const n = Number(v);
    if (Number.isNaN(n)) return v;
    return period === 'MONTHLY' ? String(Math.round(n / 12)) : String(n);
  };

  /** What a typed box means in the stored unit. */
  const raw = (typed: string) => {
    if (typed.trim() === '') return '';
    const n = Number(typed);
    if (Number.isNaN(n)) return typed;
    return period === 'MONTHLY' ? Math.round(n * 12) : n;
  };

  const perLabel = period === 'MONTHLY' ? 'Monthly' : 'CTC';
  const monthly = (v: string) => (v ? String(Math.round(Number(v) / 12)) : '');

  const rupees = (v: string) => (v ? `₹${Number(v).toLocaleString('en-IN')}` : '');

  /** "₹8,00,000 – ₹12,00,000", or just the one that was given. */
  const range = (lo: string, hi: string) =>
    lo && hi ? `${rupees(lo)} – ${rupees(hi)}` : rupees(lo) || rupees(hi);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void save(() =>
      jobApi.update(
        job.id,
        payloadFrom(job, {
          payPeriod: period,
          ctcMin: perYear(f.ctcMin),
          ctcMax: perYear(f.ctcMax),
          ctcFixed: numberOrNothing(f.ctcFixed),
          ctcVariable: numberOrNothing(f.ctcVariable),
          joiningBonus: numberOrNothing(f.joiningBonus),
          // Sent only where they mean something, so the server's own check
          // that a stipend belongs to an internship never fires on a stale
          // value left behind by a change of employment type.
          stipendPerMonth: internship ? numberOrNothing(f.stipendPerMonth) : undefined,
          internshipMonths: internship ? numberOrNothing(f.internshipMonths) : undefined,
          ppoCtc: converts ? numberOrNothing(f.ppoCtc) : undefined,
          // Turning the bond off clears it, rather than leaving figures
          // behind that no screen shows and nobody remembers entering.
          bondMonths: hasBond ? numberOrNothing(f.bondMonths) : undefined,
          bondAmount: hasBond ? numberOrNothing(f.bondAmount) : undefined,
          bondNote: hasBond ? f.bondNote : '',
          probationMonths: numberOrNothing(f.probationMonths),
          probationCtc: numberOrNothing(f.probationCtc),
          trainingMonths: numberOrNothing(f.trainingMonths),
          trainingLocation: f.trainingLocation,
          trainingStipend: numberOrNothing(f.trainingStipend),
          ctcIncludes,
          ctcNote: f.ctcNote,
          resultDays: numberOrNothing(f.resultDays),
          offerLetterDays: numberOrNothing(f.offerLetterDays),
          offerConditional: conditional,
          offerConditions: conditional === 'YES' ? conditions : [],
          offerConditionNote: conditional === 'YES' ? f.offerConditionNote : '',
        }),
      ),
    );
  }

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  const fixed = Number(f.ctcFixed) || 0;
  const variable = Number(f.ctcVariable) || 0;
  const bonus = Number(f.joiningBonus) || 0;
  const parts = fixed + variable + bonus;

  return (
    <form className="card form-card" onSubmit={onSubmit} noValidate>
      <h2>What it pays</h2>
      <p className="muted">
        Every figure is per year in rupees, except the stipend, which is per month. Leave anything
        you would rather not state blank.
      </p>
      {error && <p className="alert alert-error">{error}</p>}

      <fieldset className="period-choice">
        <legend className="field-label">How is this quoted?</legend>
        {(
          [
            ['YEARLY', 'Per year', 'A CTC, the way most campus roles are advertised.'],
            ['MONTHLY', 'Per month', 'A monthly figure. We work the yearly one out for you.'],
          ] as const
        ).map(([key, label, hint]) => (
          <label key={key} className={`period ${period === key ? 'is-current' : ''}`}>
            <input
              type="radio"
              name="pay-period"
              checked={period === key}
              onChange={() => setPeriod(key)}
              disabled={!editable || busy}
            />
            <span>
              <b>{label}</b>
              <span className="period-hint">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="form-row">
        <label className="field">
          <span className="field-label">{perLabel} from (₹)</span>
          <input
            type="number"
            value={shown(f.ctcMin)}
            onChange={(e) => setF((p) => ({ ...p, ctcMin: String(raw(e.target.value)) }))}
            placeholder={period === 'MONTHLY' ? '30000' : '800000'}
            disabled={!editable || busy}
          />
        </label>
        <label className="field">
          <span className="field-label">{perLabel} to (₹)</span>
          <input
            type="number"
            value={shown(f.ctcMax)}
            onChange={(e) => setF((p) => ({ ...p, ctcMax: String(raw(e.target.value)) }))}
            placeholder={period === 'MONTHLY' ? '45000' : '1200000'}
            disabled={!editable || busy}
          />
        </label>
      </div>

      {/* The other figure, worked out - so nobody is converting by hand and
          nobody is surprised by what the college ends up publishing. */}
      {(f.ctcMin || f.ctcMax) && (
        <p className="muted">
          {period === 'MONTHLY' ? (
            <>
              That is <b>{range(f.ctcMin, f.ctcMax)}</b> per year, which is what a placement report
              will show.
            </>
          ) : (
            <>
              About <b>{range(monthly(f.ctcMin), monthly(f.ctcMax))}</b> per month.
            </>
          )}
        </p>
      )}

      <fieldset className="sub-block">
        <legend>What the headline is made of</legend>
        <p className="muted">
          The fixed figure is the one a student can plan around and the one the college publishes.
        </p>

        <div className="form-row">
          <label className="field">
            <span className="field-label">Fixed (₹)</span>
            <input
              type="number"
              value={f.ctcFixed}
              onChange={set('ctcFixed')}
              placeholder="700000"
              disabled={!editable || busy}
            />
          </label>
          <label className="field">
            <span className="field-label">Variable (₹)</span>
            <input
              type="number"
              value={f.ctcVariable}
              onChange={set('ctcVariable')}
              placeholder="150000"
              disabled={!editable || busy}
            />
          </label>
          <label className="field">
            <span className="field-label">Joining bonus (₹)</span>
            <input
              type="number"
              value={f.joiningBonus}
              onChange={set('joiningBonus')}
              placeholder="50000"
              disabled={!editable || busy}
            />
          </label>
        </div>

        {parts > 0 && (
          <p className="muted">
            Adds up to <b>₹{parts.toLocaleString('en-IN')}</b>
            {f.ctcMax && parts > Number(f.ctcMax) && (
              <> — which is above the top of the range you gave.</>
            )}
          </p>
        )}
      </fieldset>

      {internship && (
        <fieldset className="sub-block">
          <legend>The internship</legend>
          <div className="form-row">
            <label className="field">
              <span className="field-label">Stipend (₹ per month)</span>
              <input
                type="number"
                value={f.stipendPerMonth}
                onChange={set('stipendPerMonth')}
                placeholder="25000"
                disabled={!editable || busy}
              />
            </label>
            <label className="field">
              <span className="field-label">Duration (months)</span>
              <input
                type="number"
                value={f.internshipMonths}
                onChange={set('internshipMonths')}
                placeholder="6"
                disabled={!editable || busy}
              />
            </label>
            {converts && (
              <label className="field">
                <span className="field-label">CTC if it converts (₹)</span>
                <input
                  type="number"
                  value={f.ppoCtc}
                  onChange={set('ppoCtc')}
                  placeholder="900000"
                  disabled={!editable || busy}
                />
                <span className="field-hint">Half of what a student weighs when choosing.</span>
              </label>
            )}
          </div>
        </fieldset>
      )}

      <fieldset className="sub-block">
        <legend>Bond</legend>

        <label className="check-row">
          <input
            type="checkbox"
            checked={hasBond}
            onChange={(e) => setHasBond(e.target.checked)}
            disabled={!editable || busy}
          />
          <span>
            <b>There is a bond on this role</b>
            <span className="check-hint">
              Most roles have none. Leave this off and students are told so plainly.
            </span>
          </span>
        </label>

        {hasBond && (
          <>
            <p className="muted">
              A bond is a length and a figure. One without the other tells a student nothing about
              what they would be signing.
            </p>
            <div className="form-row">
              <label className="field">
                <span className="field-label">Months</span>
                <input
                  type="number"
                  value={f.bondMonths}
                  onChange={set('bondMonths')}
                  placeholder="12"
                  disabled={!editable || busy}
                />
              </label>
              <label className="field">
                <span className="field-label">Amount (₹)</span>
                <input
                  type="number"
                  value={f.bondAmount}
                  onChange={set('bondAmount')}
                  placeholder="100000"
                  disabled={!editable || busy}
                />
              </label>
            </div>

            <label className="field">
              <span className="field-label">When it applies</span>
              <textarea
                value={f.bondNote}
                onChange={set('bondNote')}
                rows={2}
                placeholder="Payable only if you leave within the first year of joining."
                disabled={!editable || busy}
              />
              <span className="field-hint">
                Months and a figure say what it costs. This says when it costs it.
              </span>
            </label>
          </>
        )}
      </fieldset>

      <fieldset className="sub-block">
        <legend>What the CTC includes</legend>
        <p className="muted">
          Tick everything counted inside the CTC above. It is how a student works out real take-home pay and
          compares two offers fairly.
        </p>
        <div className="inc-grid">
          {(meta?.offer.ctcIncludes ?? []).map((c) => (
            <label key={c.key} className={`inc-check ${ctcIncludes.includes(c.key) ? 'is-on' : ''}`}>
              <input
                type="checkbox"
                checked={ctcIncludes.includes(c.key)}
                onChange={() => flip(ctcIncludes, setCtcIncludes, c.key)}
                disabled={!editable || busy}
              />
              <span>{c.label}</span>
            </label>
          ))}
        </div>
        <label className="field">
          <span className="field-label">
            Anything else in the CTC <span className="muted">optional</span>
          </span>
          <input
            value={f.ctcNote}
            onChange={set('ctcNote')}
            placeholder="Includes ₹40,000 in meal cards and a one-time laptop allowance"
            disabled={!editable || busy}
          />
        </label>
      </fieldset>

      <fieldset className="sub-block">
        <legend>Probation and training</legend>
        <p className="muted">
          Leave blank if there is none. A student should not find out after joining that the first months are
          paid differently, or spent in another city.
        </p>
        <div className="form-row">
          <label className="field">
            <span className="field-label">Probation (months)</span>
            <input
              type="number"
              value={f.probationMonths}
              onChange={set('probationMonths')}
              placeholder="6"
              disabled={!editable || busy}
            />
          </label>
          {f.probationMonths && Number(f.probationMonths) > 0 && (
            <label className="field">
              <span className="field-label">CTC during probation (₹)</span>
              <input
                type="number"
                value={f.probationCtc}
                onChange={set('probationCtc')}
                placeholder="600000"
                disabled={!editable || busy}
              />
              <span className="field-hint">Only if it differs from the CTC above.</span>
            </label>
          )}
        </div>
        <div className="form-row">
          <label className="field">
            <span className="field-label">Training (months)</span>
            <input
              type="number"
              value={f.trainingMonths}
              onChange={set('trainingMonths')}
              placeholder="3"
              disabled={!editable || busy}
            />
          </label>
          {f.trainingMonths && Number(f.trainingMonths) > 0 && (
            <>
              <label className="field">
                <span className="field-label">Where training happens</span>
                <input
                  value={f.trainingLocation}
                  onChange={set('trainingLocation')}
                  placeholder="Mysuru training campus"
                  disabled={!editable || busy}
                />
              </label>
              <label className="field">
                <span className="field-label">Stipend during training (₹ per month)</span>
                <input
                  type="number"
                  value={f.trainingStipend}
                  onChange={set('trainingStipend')}
                  placeholder="25000"
                  disabled={!editable || busy}
                />
                <span className="field-hint">Only if it differs from the salary.</span>
              </label>
            </>
          )}
        </div>
      </fieldset>

      <fieldset className="sub-block">
        <legend>
          The offer <span className="req">required to publish</span>
        </legend>
        <div className="form-row">
          <label className="field">
            <span className="field-label">Results within (days of the last round)</span>
            <input
              type="number"
              value={f.resultDays}
              onChange={set('resultDays')}
              placeholder="7"
              disabled={!editable || busy}
            />
          </label>
          <label className="field">
            <span className="field-label">
              Offer letter within (days of results)<span className="req">required</span>
            </span>
            <input
              type="number"
              value={f.offerLetterDays}
              onChange={set('offerLetterDays')}
              placeholder="15"
              disabled={!editable || busy}
            />
            <span className="field-hint">A college cannot count an offer until the letter exists.</span>
          </label>
        </div>

        <p className="field-label inc-sub">
          Is the offer conditional?<span className="req">required</span>
        </p>
        <div className="inc-options" role="radiogroup" aria-label="Is the offer conditional">
          {(
            [
              ['NO', 'No', 'The offer stands once it is made.'],
              ['YES', 'Yes', 'Something can still cancel it - say what below.'],
            ] as const
          ).map(([value, label, hint]) => (
            <label key={value} className={`inc-option ${conditional === value ? 'is-on' : ''}`}>
              <input
                type="radio"
                name="offer-conditional"
                checked={conditional === value}
                onChange={() => setConditional(value)}
                disabled={!editable || busy}
              />
              <span>
                <b>{label}</b>
                <span className="check-hint">{hint}</span>
              </span>
            </label>
          ))}
        </div>

        {conditional === 'YES' && (
          <>
            <p className="field-label inc-sub">Conditional on</p>
            <div className="inc-grid">
              {(meta?.offer.conditions ?? []).map((c) => (
                <label key={c.key} className={`inc-check ${conditions.includes(c.key) ? 'is-on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={conditions.includes(c.key)}
                    onChange={() => flip(conditions, setConditions, c.key)}
                    disabled={!editable || busy}
                  />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
            <label className="field">
              <span className="field-label">
                Anything else <span className="muted">optional</span>
              </span>
              <input
                value={f.offerConditionNote}
                onChange={set('offerConditionNote')}
                placeholder="A minimum of 60% in the final semester"
                disabled={!editable || busy}
              />
            </label>
          </>
        )}
      </fieldset>

      {editable && (
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : saved ? 'Saved' : 'Save & continue'}
        </button>
      )}
    </form>
  );
}

function EligibilityStep({
  job,
  meta,
  editable,
  onSaved,
}: {
  job: JobDetail;
  meta: JobMeta | null;
  editable: boolean;
  onSaved: () => void;
}) {
  const { busy, saved, error, save } = useSave(onSaved, { continues: true });

  const [f, setF] = useState({
    minCgpa: job.minCgpa ?? '',
    minDegreePct: job.minDegreePct ?? '',
    minTenthPct: job.minTenthPct ?? '',
    minTwelfthPct: job.minTwelfthPct ?? '',
    minDiplomaPct: job.minDiplomaPct ?? '',
    minPgCgpa: job.minPgCgpa ?? '',
    minPgPct: job.minPgPct ?? '',
  });

  const [courses, setCourses] = useState<string[]>(job.allowedCourses);
  const [branches, setBranches] = useState<string[]>(job.allowedSpecialisations);

  /*
   * Whether there is a marks bar at all, asked before any of the numbers.
   *
   * Blank boxes already meant "do not filter on this", but they could not
   * tell a role that is deliberately open to everyone from one nobody has got
   * to yet - the step read as unfinished either way, and the student's card
   * said nothing where it should have said "anyone may apply".
   *
   * Only the marks go. Course, branch and year stay askable, because they are
   * who the role is aimed at rather than a bar somebody can fail.
   */
  const [openToAll, setOpenToAll] = useState(job.openToAll);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void save(() =>
      jobApi.update(
        job.id,
        payloadFrom(job, {
          openToAll,
          minCgpa: numberOrNothing(f.minCgpa),
          minDegreePct: numberOrNothing(f.minDegreePct),
          minTenthPct: numberOrNothing(f.minTenthPct),
          minTwelfthPct: numberOrNothing(f.minTwelfthPct),
          minDiplomaPct: numberOrNothing(f.minDiplomaPct),
          minPgCgpa: numberOrNothing(f.minPgCgpa),
          minPgPct: numberOrNothing(f.minPgPct),
          allowedCourses: courses,
          allowedSpecialisations: branches,
        }),
      ),
    );
  }

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  return (
    <form className="card form-card" onSubmit={onSubmit} noValidate>
      <h2>Who among them can apply</h2>
      <p className="muted">
        Sifts the students in the drives and batches above. Those who do not meet these never see
        the role. Leave anything blank to not filter on it &mdash; and a student with nothing on
        record for a criterion fails it, rather than slipping through.
      </p>
      {error && <p className="alert alert-error">{error}</p>}

      <fieldset className="bar-choice">
        <legend className="field-label">Is there a marks bar?</legend>
        {(
          [
            [false, 'Yes, set a bar', 'CGPA or percentages, stage by stage.'],
            [true, 'No, open to everyone', 'Anyone in the courses and branches below may apply.'],
          ] as const
        ).map(([value, title, hint]) => (
          <label key={String(value)} className={`shape ${openToAll === value ? 'is-current' : ''}`}>
            <input
              type="radio"
              name="marks-bar"
              checked={openToAll === value}
              onChange={() => setOpenToAll(value)}
              disabled={!editable || busy}
            />
            <span>
              <b>{title}</b>
              <span className="shape-hint">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {/*
        One section per stage of the ladder a Pune University student actually
        climbs - SSC, then HSC or a diploma, then the degree, then a master's
        if they went on. Criteria sheets are written stage by stage, and a
        single row of boxes made people match them up by eye.
      */}
      {/* The ladder only exists when there is a bar to put on it. */}
      {!openToAll && (
        <>
          <p className="muted stage-intro">Leave a stage blank to not filter on it at all.</p>

          <ol className="stages">
            <li className="stage">
              <div className="stage-mark">10th</div>
              <div className="stage-body">
                <p className="stage-title">
                  SSC <span className="stage-sub">Secondary school certificate</span>
                </p>
                <label className="field">
                  <span className="field-label">Minimum %</span>
                  <input
                    type="number"
                    value={f.minTenthPct}
                    onChange={set('minTenthPct')}
                    placeholder="60"
                    disabled={!editable || busy}
                  />
                </label>
              </div>
            </li>

            <li className="stage">
              <div className="stage-mark">12th</div>
              <div className="stage-body">
                <p className="stage-title">
                  HSC or diploma
                  <span className="stage-sub">
                    A student did one or the other, never both &mdash; whoever came in laterally has
                    a diploma and no 12th at all.
                  </span>
                </p>
                <div className="form-row">
                  <label className="field">
                    <span className="field-label">Minimum 12th %</span>
                    <input
                      type="number"
                      value={f.minTwelfthPct}
                      onChange={set('minTwelfthPct')}
                      placeholder="60"
                      disabled={!editable || busy}
                    />
                  </label>
                  <span className="or-between">or</span>
                  <label className="field">
                    <span className="field-label">Minimum diploma %</span>
                    <input
                      type="number"
                      value={f.minDiplomaPct}
                      onChange={set('minDiplomaPct')}
                      placeholder="60"
                      disabled={!editable || busy}
                    />
                  </label>
                </div>

                {/*
              Unconditional now that lateral entry is not something a role can
              switch off: whoever came in through a diploma has no 12th at all,
              so a 12th bar on its own quietly excludes every one of them.
            */}
                {f.minTwelfthPct && !f.minDiplomaPct && (
                  <p className="alert alert-warn">
                    A 12th bar on its own excludes every lateral-entry student &mdash; they came
                    through a diploma and have no 12th marks. Set a diploma percentage too.
                  </p>
                )}
              </div>
            </li>

            <li className="stage">
              <div className="stage-mark">UG</div>
              <div className="stage-body">
                <p className="stage-title">
                  Graduation
                  <span className="stage-sub">
                    The bachelor&rsquo;s &mdash; B.Tech, B.E., B.Sc, BCA. State the bar in whichever
                    unit your criteria use; a student clears it on whichever one their college
                    records, because the conversion between the two differs by university.
                  </span>
                </p>
                <div className="form-row">
                  <label className="field">
                    <span className="field-label">Minimum CGPA</span>
                    <input
                      type="number"
                      step="0.01"
                      value={f.minCgpa}
                      onChange={set('minCgpa')}
                      placeholder="7.0"
                      disabled={!editable || busy}
                    />
                  </label>
                  <span className="or-between">or</span>
                  <label className="field">
                    <span className="field-label">Minimum %</span>
                    <input
                      type="number"
                      value={f.minDegreePct}
                      onChange={set('minDegreePct')}
                      placeholder="70"
                      disabled={!editable || busy}
                    />
                  </label>
                </div>
              </div>
            </li>

            <li className="stage">
              <div className="stage-mark">PG</div>
              <div className="stage-body">
                <p className="stage-title">
                  Post-graduation
                  <span className="stage-sub">
                    Only for a role aimed at MCA, M.Tech or MBA students. Their bachelor&rsquo;s is
                    the stage above; this is the degree they are on now. Leave it blank for an
                    undergraduate role and it filters nobody.
                  </span>
                </p>
                <div className="form-row">
                  <label className="field">
                    <span className="field-label">Minimum CGPA</span>
                    <input
                      type="number"
                      step="0.01"
                      value={f.minPgCgpa}
                      onChange={set('minPgCgpa')}
                      disabled={!editable || busy}
                    />
                  </label>
                  <span className="or-between">or</span>
                  <label className="field">
                    <span className="field-label">Minimum %</span>
                    <input
                      type="number"
                      value={f.minPgPct}
                      onChange={set('minPgPct')}
                      disabled={!editable || busy}
                    />
                  </label>
                </div>
              </div>
            </li>
          </ol>
        </>
      )}

      <MultiSelect
        label="Courses"
        hint="The courses the university runs — the list operations keeps under Setup, and anything a college has put on a batch. Everything matches on the exact word, so there is one spelling of each."
        options={meta?.courses ?? []}
        selected={courses}
        onChange={setCourses}
        disabled={!editable || busy}
        emptyMeans="Any course"
        noOptions="No courses on the portal yet — neither operations nor any college has set one up."
      />

      <MultiSelect
        label="Branches"
        hint='Within those courses. "B.Tech" is not a criterion; "B.Tech CSE and IT, not Civil" is.'
        options={meta?.specialisations ?? []}
        selected={branches}
        onChange={setBranches}
        disabled={!editable || busy}
        emptyMeans="Any branch"
        noOptions="No branches on the portal yet — neither operations nor any college has set one up."
      />

      <p className="field-hint">
        Which year graduates is not asked for. A batch says it exactly and somebody keeps it up to
        date, so the role is aimed at batches instead &mdash; chosen above, inside each drive.
      </p>

      {editable && (
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : saved ? 'Saved' : 'Save & continue'}
        </button>
      )}
    </form>
  );
}

/**
 * A test taken before anybody applies.
 *
 * Not a round: rounds happen to people who have already applied, and this is
 * the gate in front of that. The company hosts it wherever it already hosts
 * one - the portal carries the link, the instructions and the closing date,
 * and records what the student brings back. Pretending to be an assessment
 * engine would only be a worse version of the tool they already use.
 */
function ScreeningStep({
  job,
  editable,
  onSaved,
}: {
  job: JobDetail;
  editable: boolean;
  onSaved: () => void;
}) {
  const { busy, saved, error, save } = useSave(onSaved);
  const [on, setOn] = useState(Boolean(job.screeningTestUrl));
  const [f, setF] = useState({
    screeningTestName: job.screeningTestName ?? '',
    screeningTestUrl: job.screeningTestUrl ?? '',
    screeningTestInstructions: job.screeningTestInstructions ?? '',
    screeningTestDeadline: job.screeningTestDeadline ? job.screeningTestDeadline.slice(0, 10) : '',
    screeningTestRequired: job.screeningTestRequired,
  });

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void save(() =>
      jobApi.update(
        job.id,
        payloadFrom(job, {
          // Switching it off clears it, rather than leaving a link behind
          // that nothing shows and nobody remembers setting.
          screeningTestName: on ? f.screeningTestName : '',
          screeningTestUrl: on ? f.screeningTestUrl : '',
          screeningTestInstructions: on ? f.screeningTestInstructions : '',
          screeningTestDeadline: on ? endOfDay(f.screeningTestDeadline) : '',
          screeningTestRequired: on ? f.screeningTestRequired : false,
        }),
      ),
    );
  }

  return (
    <form className="card form-card" onSubmit={onSubmit} noValidate>
      <h2>Before they apply</h2>
      <p className="muted">
        A test you want taken first, hosted wherever you already host it. Students see the link on
        the role and bring back whatever it gives them when they finish.
      </p>
      {error && <p className="alert alert-error">{error}</p>}

      <label className="check-row">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
          disabled={!editable || busy}
        />
        <span>
          <b>There is a test before applying</b>
          <span className="check-hint">
            Leave this off and students apply straight away, and your first round is the first thing
            they do.
          </span>
        </span>
      </label>

      {on && (
        <>
          <div className="form-row">
            <label className="field">
              <span className="field-label">What it is called</span>
              <input
                value={f.screeningTestName}
                onChange={set('screeningTestName')}
                placeholder="Zenith aptitude test"
                disabled={!editable || busy}
              />
            </label>
            <label className="field">
              <span className="field-label">Closes on</span>
              <input
                type="date"
                value={f.screeningTestDeadline}
                onChange={set('screeningTestDeadline')}
                disabled={!editable || busy}
              />
              <span className="field-hint">Must not be after applications close.</span>
            </label>
          </div>

          <label className="field">
            <span className="field-label">
              Link<span className="req">required</span>
            </span>
            <input
              type="url"
              value={f.screeningTestUrl}
              onChange={set('screeningTestUrl')}
              placeholder="https://..."
              disabled={!editable || busy}
            />
          </label>

          <label className="field">
            <span className="field-label">What to tell them</span>
            <textarea
              value={f.screeningTestInstructions}
              onChange={set('screeningTestInstructions')}
              rows={3}
              placeholder="60 minutes, one attempt. Copy the submission ID from the last screen - you will need it to apply."
              disabled={!editable || busy}
            />
          </label>

          <label className="check-row">
            <input
              type="checkbox"
              checked={f.screeningTestRequired}
              onChange={(e) => setF((p) => ({ ...p, screeningTestRequired: e.target.checked }))}
              disabled={!editable || busy}
            />
            <span>
              <b>They cannot apply without it</b>
              <span className="check-hint">
                Applying will ask for what the test gave them. Leave this off to offer the test
                without making it a gate.
              </span>
            </span>
          </label>
        </>
      )}

      {editable && (
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : saved ? 'Saved' : 'Save'}
        </button>
      )}
    </form>
  );
}

function RoundsStep({
  job,
  meta,
  editable,
  onSaved,
}: {
  job: JobDetail;
  meta: JobMeta | null;
  editable: boolean;
  onSaved: () => void;
}) {
  const { busy, saved, error, save } = useSave(onSaved);

  /** What a round is on this form: its name, kind, and when and where it runs. */
  type Draft = Pick<
    Round,
    | 'name'
    | 'type'
    | 'isElimination'
    | 'durationMin'
    | 'venue'
    | 'description'
    | 'shortlistCount'
    | 'isOnline'
    | 'addressLine'
    | 'pincode'
    | 'meetingLink'
    | 'mapsLink'
    | 'mapEmbedUrl'
  > & {
    /** A date and a time input, assembled into the instant on save. */
    day: string;
    time: string;
    mode: RoundMode | '';
    /** Per-type settings, carried through a save untouched unless edited here. */
    config: Record<string, unknown>;
  };

  /*
   * The company's simulations, for a round that is one. Fetched once for the
   * step; a failure leaves the picker explaining rather than the form broken.
   */
  const [sims, setSims] = useState<CompanySimulationRow[] | null>(null);
  useEffect(() => {
    proofApi
      .companyList()
      .then(setSims)
      .catch(() => setSims([]));
  }, []);

  const [rounds, setRounds] = useState<Draft[]>(
    job.rounds.length > 0
      ? job.rounds.map((r) => ({
          name: r.name,
          type: r.type,
          isElimination: r.isElimination,
          description: r.description,
          shortlistCount: r.shortlistCount,
          durationMin: r.durationMin,
          venue: r.venue,
          isOnline: r.isOnline,
          addressLine: r.addressLine,
          pincode: r.pincode,
          meetingLink: r.meetingLink,
          mapsLink: r.mapsLink,
          mapEmbedUrl: r.mapEmbedUrl,
          day: r.scheduledAt ? r.scheduledAt.slice(0, 10) : '',
          time: r.scheduledAt ? new Date(r.scheduledAt).toTimeString().slice(0, 5) : '',
          mode: r.mode ?? '',
          config: r.config ?? {},
        }))
      : [
          {
            name: 'Resume screen',
            type: 'RESUME_SCREEN',
            isElimination: true,
            description: null,
            shortlistCount: null,
            durationMin: null,
            venue: null,
            isOnline: false,
            addressLine: null,
            pincode: null,
            meetingLink: null,
            mapsLink: null,
            mapEmbedUrl: null,
            day: '',
            time: '',
            mode: '',
            config: {},
          },
        ],
  );

  /*
   * How the interviews happen, asked once rather than on every round.
   *
   * Most drives are entirely on campus or entirely online, and answering the
   * same question five times is the sort of thing that makes a form feel like
   * paperwork. "It varies" is there because some drives genuinely do - an
   * online test and then interviews in a hall - and then it is asked per round.
   */
  const shape: 'online' | 'person' | 'mixed' =
    rounds.length === 0
      ? 'person'
      : rounds.every((r) => r.isOnline)
        ? 'online'
        : rounds.every((r) => !r.isOnline)
          ? 'person'
          : 'mixed';

  const [asked, setAsked] = useState<'online' | 'person' | 'mixed'>(shape);

  /** Only one round is expanded at a time; the rest read as a summary. */
  const [openRound, setOpenRound] = useState<number | null>(rounds.length === 1 ? 0 : null);

  /*
   * The round as last saved, for the map preview.
   *
   * The embed URL is checked against a host allowlist on the way in - it
   * becomes the src of an iframe on a page students open - so the preview has
   * to come from what came back, never from what is still being typed.
   */
  const savedRound = (i: number): Round | undefined => job.rounds[i];

  /** Edits one round without disturbing the others. */
  const edit = (i: number, patch: Partial<Draft>) =>
    setRounds((prev) => prev.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  /** Answering the question up front settles every round at once. */
  function setShape(next: 'online' | 'person' | 'mixed') {
    setAsked(next);
    if (next === 'mixed') return;

    const online = next === 'online';
    setRounds((prev) =>
      prev.map((r) => ({
        ...r,
        isOnline: online,
        // The half that no longer applies goes, rather than lingering where
        // no screen shows it and somebody later wonders why it is wrong.
        ...(online
          ? {
              addressLine: null,
              pincode: null,
              mapsLink: null,
              mapEmbedUrl: null,
            }
          : { meetingLink: null }),
      })),
    );
  }

  function move(i: number, by: number) {
    const j = i + by;
    if (j < 0 || j >= rounds.length) return;
    const next = [...rounds];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setRounds(next);
  }

  return (
    <section className="card">
      <h2>Rounds, and where each one happens</h2>
      <p className="muted">
        The stages you will actually run, in order. A candidate moves through these one at a time.
        Where a round happens is asked on the round itself, because it moves &mdash; a test online,
        a round in a college hall, a final at the office.
      </p>

      <fieldset className="shape-choice">
        <legend className="field-label">How will the interviews happen?</legend>
        {(
          [
            ['person', 'In person', 'On campus, or at your office.'],
            ['online', 'Online', 'A link, for every round.'],
            ['mixed', 'It varies', 'A test online, interviews in a hall — asked per round.'],
          ] as const
        ).map(([key, title, hint]) => (
          <label key={key} className={`shape ${asked === key ? 'is-current' : ''}`}>
            <input
              type="radio"
              name="interview-shape"
              checked={asked === key}
              onChange={() => setShape(key)}
              disabled={!editable}
            />
            <span>
              <b>{title}</b>
              <span className="shape-hint">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="muted">
        <b>
          {rounds.length} round{rounds.length === 1 ? '' : 's'}
        </b>{' '}
        &mdash; the number students and their college are told.
      </p>
      {error && <p className="alert alert-error">{error}</p>}

      {/*
        The process as a process: a rail down the side, one card per stage,
        and only the stage being edited opened up. Collapsed, a round is the
        line a placement cell reads - what it is, when, where, who it cuts.
      */}
      <ol className="rounds">
        {rounds.map((r, i) => {
          const open = openRound === i;
          const when = r.day
            ? new Date(`${r.day}T00:00:00`).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
              })
            : null;

          return (
            <li key={i} className={`round ${open ? 'is-open' : ''}`}>
              <span className="round-rail" aria-hidden="true">
                <span className="round-dot">{i + 1}</span>
              </span>

              <div className="round-card">
                <div className="round-head">
                  <button
                    type="button"
                    className="round-toggle"
                    aria-expanded={open}
                    onClick={() => setOpenRound(open ? null : i)}
                  >
                    <span className="round-title">{r.name || 'Untitled round'}</span>
                    <span className="round-chips">
                      <span className="round-chip is-kind">{ROUND_LABELS[r.type] ?? r.type}</span>
                      {when && (
                        <span className="round-chip">
                          {when}
                          {r.time ? ` · ${r.time}` : ''}
                        </span>
                      )}
                      <span className="round-chip">{r.isOnline ? 'Online' : 'In person'}</span>
                      {r.durationMin ? (
                        <span className="round-chip">{r.durationMin} min</span>
                      ) : null}
                      <span className={`round-chip ${r.isElimination ? 'is-cut' : 'is-keep'}`}>
                        {r.isElimination ? 'Eliminates' : 'Nobody cut'}
                      </span>
                    </span>
                    <span className="round-chevron" aria-hidden="true">
                      ▾
                    </span>
                  </button>

                  {editable && (
                    <span className="round-actions">
                      <button
                        type="button"
                        onClick={() => move(i, -1)}
                        aria-label="Move up"
                        disabled={i === 0}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => move(i, 1)}
                        aria-label="Move down"
                        disabled={i === rounds.length - 1}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="is-danger"
                        onClick={() => setRounds(rounds.filter((_, k) => k !== i))}
                        aria-label="Remove round"
                        disabled={rounds.length === 1}
                      >
                        ×
                      </button>
                    </span>
                  )}
                </div>

                {open && (
                  <div className="round-edit">
                    <fieldset className="round-group">
                      <legend>What it is</legend>
                      <div className="round-grid">
                        <label className="rf rf-wide">
                          <span>Name</span>
                          <input
                            value={r.name}
                            onChange={(e) => edit(i, { name: e.target.value })}
                            disabled={!editable}
                          />
                        </label>
                        <label className="rf rf-wide">
                          <span>Kind of round</span>
                          <GrowableSelect
                            value={r.type}
                            options={meta?.options.ROUND_TYPE ?? []}
                            onChange={(v) => edit(i, { type: v })}
                            onAdd={(label) => jobApi.addOption('ROUND_TYPE', label)}
                            disabled={!editable}
                            addLabel="Add a kind of round…"
                          />
                        </label>
                      </div>

                      {r.type === 'WORK_SIMULATION' && (
                        <SimulationPicker
                          sims={sims}
                          value={typeof r.config.simulationId === 'string' ? r.config.simulationId : ''}
                          onChange={(simulationId) => edit(i, { config: { ...r.config, simulationId } })}
                          disabled={!editable}
                        />
                      )}

                      <label className="round-check">
                        <input
                          type="checkbox"
                          checked={r.isElimination}
                          onChange={(e) => edit(i, { isElimination: e.target.checked })}
                          disabled={!editable}
                        />
                        <span>
                          <b>This round eliminates</b>
                          <small>Students who do not clear it go no further.</small>
                        </span>
                      </label>
                    </fieldset>

                    <fieldset className="round-group">
                      <legend>When</legend>
                      <div className="round-grid">
                        <label className="rf">
                          <span>Date</span>
                          <input
                            type="date"
                            value={r.day}
                            onChange={(e) => edit(i, { day: e.target.value })}
                            disabled={!editable}
                          />
                        </label>
                        <label className="rf">
                          <span>Starts</span>
                          <input
                            type="time"
                            value={r.time}
                            onChange={(e) => edit(i, { time: e.target.value })}
                            disabled={!editable}
                          />
                        </label>
                        <label className="rf">
                          <span>Minutes</span>
                          <input
                            type="number"
                            value={r.durationMin ?? ''}
                            onChange={(e) =>
                              edit(i, { durationMin: e.target.value ? Number(e.target.value) : null })
                            }
                            placeholder="—"
                            disabled={!editable}
                          />
                        </label>
                        <label className="rf">
                          <span>How many go through</span>
                          <input
                            type="number"
                            value={r.shortlistCount ?? ''}
                            onChange={(e) =>
                              edit(i, { shortlistCount: e.target.value ? Number(e.target.value) : null })
                            }
                            placeholder="—"
                            disabled={!editable}
                          />
                        </label>
                      </div>
                      <p className="round-hint">
                        Leave the date blank until it is settled. With no time, the round is taken
                        to start at 9am &mdash; when a campus drive starts more often than not.
                      </p>
                    </fieldset>

                    <fieldset className="round-group">
                      <legend>Where</legend>
                      <div className="round-modes">
                        {(
                          [
                            ['person', 'In person', 'A hall, or your office.'],
                            ['online', 'Online', 'A link students join.'],
                          ] as const
                        ).map(([key, title, hint]) => (
                          <label
                            key={key}
                            className={`round-mode ${(r.isOnline ? 'online' : 'person') === key ? 'is-current' : ''}`}
                          >
                            <input
                              type="radio"
                              name={`round-mode-${i}`}
                              checked={(r.isOnline ? 'online' : 'person') === key}
                              onChange={() => {
                                const online = key === 'online';
                                // Switching clears the other half. A round moved
                                // online that kept a hall address is how somebody
                                // ends up at an empty building.
                                edit(i, {
                                  isOnline: online,
                                  ...(online
                                    ? { addressLine: null, pincode: null, mapsLink: null, mapEmbedUrl: null }
                                    : { meetingLink: null }),
                                });
                              }}
                              disabled={!editable}
                            />
                            <span>
                              <b>{title}</b>
                              <small>{hint}</small>
                            </span>
                          </label>
                        ))}
                      </div>

                      {/*
                        One half or the other, never both. A student a week out
                        needs to know whether to book a train or bookmark a link,
                        and a round carrying stale remnants of the other answer is
                        worse than one that says nothing.
                      */}
                      {r.isOnline ? (
                        <label className="rf rf-full">
                          <span>Meeting link</span>
                          <input
                            type="url"
                            value={r.meetingLink ?? ''}
                            onChange={(e) => edit(i, { meetingLink: e.target.value || null })}
                            placeholder="https://meet.google.com/…"
                            disabled={!editable}
                          />
                        </label>
                      ) : (
                        <>
                          <label className="rf rf-full">
                            <span>Venue</span>
                            <input
                              value={r.venue ?? ''}
                              onChange={(e) => edit(i, { venue: e.target.value || null })}
                              placeholder="Seminar hall 2, or our Balewadi office"
                              disabled={!editable}
                            />
                          </label>

                          <label className="rf rf-full">
                            <span>Address</span>
                            <textarea
                              rows={2}
                              value={r.addressLine ?? ''}
                              onChange={(e) => edit(i, { addressLine: e.target.value || null })}
                              placeholder="Leave blank if it is at the college. Otherwise the full address students should navigate to."
                              disabled={!editable}
                            />
                          </label>

                          <div className="round-grid">
                            <label className="rf">
                              <span>PIN code</span>
                              <input
                                value={r.pincode ?? ''}
                                onChange={(e) => edit(i, { pincode: e.target.value || null })}
                                placeholder="411045"
                                inputMode="numeric"
                                disabled={!editable}
                              />
                            </label>
                            {/*
                              Not held back until an address is typed. A round
                              at the college has no address to give - that is
                              what the placeholder above tells you to do - and
                              it is exactly the round a student most wants a pin
                              for, because "Seminar hall 2" is not something a
                              phone can navigate to.
                            */}
                            <label className="rf rf-wide">
                              <span>Maps link &mdash; what &ldquo;Open in maps&rdquo; opens</span>
                              <input
                                value={r.mapsLink ?? ''}
                                onChange={(e) => edit(i, { mapsLink: e.target.value || null })}
                                placeholder="https://maps.app.goo.gl/…"
                                disabled={!editable}
                              />
                            </label>
                          </div>

                          <label className="rf rf-full">
                            <span>Map embed &mdash; the map shown on the round</span>
                            <input
                              value={r.mapEmbedUrl ?? ''}
                              onChange={(e) => edit(i, { mapEmbedUrl: e.target.value || null })}
                              placeholder="https://www.google.com/maps/embed?pb=… or paste the whole <iframe> snippet"
                              disabled={!editable}
                            />
                          </label>

                          <p className="round-hint">
                            On Google Maps: <b>Share &rarr; Copy link</b> for the first box, and{' '}
                            <b>Share &rarr; Embed a map</b> for the second &mdash; paste the whole
                            snippet, the link is taken out of it. Give at least the maps link, or a
                            student has an address to read and nothing to tap.
                          </p>

                          {/*
                            Shown from what was pasted rather than from a guess,
                            so a recruiter sees the map a student will get - and
                            sees it on the round it belongs to, since the venue
                            moves between rounds while the office does not.
                          */}
                          {savedRound(i)?.mapEmbedUrl && (
                            <MapEmbed
                              embedUrl={savedRound(i)!.mapEmbedUrl!}
                              mapsLink={savedRound(i)!.mapsLink}
                              label={r.venue || r.addressLine || 'the venue'}
                            />
                          )}
                          {r.mapEmbedUrl && !savedRound(i)?.mapEmbedUrl && (
                            <p className="round-hint">Save to see the map.</p>
                          )}
                        </>
                      )}
                    </fieldset>

                    <fieldset className="round-group">
                      <legend>What happens in it</legend>
                      <label className="rf rf-full">
                        <textarea
                          rows={3}
                          value={r.description ?? ''}
                          onChange={(e) => edit(i, { description: e.target.value || null })}
                          placeholder="60 multiple-choice questions - aptitude, then core subject. No negative marking. Bring a photo ID."
                          disabled={!editable}
                        />
                      </label>
                    </fieldset>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {editable && (
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setOpenRound(rounds.length);
              setRounds([
                ...rounds,
                {
                  name: 'New round',
                  type: 'LIVE_INTERVIEW',
                  isElimination: true,
                  description: null,
                  shortlistCount: null,
                  durationMin: null,
                  venue: null,
                  isOnline: false,
                  addressLine: null,
                  pincode: null,
                  meetingLink: null,
                  mapsLink: null,
                  mapEmbedUrl: null,
                  day: '',
                  time: '',
                  mode: '',
                  config: {},
                },
              ]);
            }}
          >
            + Add round
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() =>
              save(() =>
                jobApi.setRounds(
                  job.id,
                  // The form holds a day; the API wants an instant, and an
                  // unset mode is absent rather than an empty string.
                  rounds.map((r) => ({
                    name: r.name,
                    type: r.type,
                    isElimination: r.isElimination,
                    description: r.description ?? '',
                    shortlistCount: r.shortlistCount ?? undefined,
                    isOnline: r.isOnline,
                    meetingLink: r.meetingLink ?? '',
                    addressLine: r.addressLine ?? '',
                    pincode: r.pincode ?? '',
                    mapsLink: r.mapsLink ?? '',
                    mapEmbedUrl: r.mapEmbedUrl ?? '',
                    durationMin: r.durationMin ?? undefined,
                    venue: r.venue ?? '',
                    // Nine in the morning when nobody said otherwise, which is
                    // when a campus drive starts more often than not.
                    scheduledAt: r.day
                      ? new Date(`${r.day}T${r.time || '09:00'}:00`).toISOString()
                      : '',
                    mode: r.mode || undefined,
                    config: r.config,
                  })),
                ),
              )
            }
          >
            {busy ? 'Saving…' : saved ? 'Saved' : 'Save rounds'}
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * Which of the company's simulations a WORK_SIMULATION round sends students
 * into. Only published ones can be chosen - the server refuses a draft, and
 * a student sent to one would find nothing there - but one already chosen
 * and since taken down still shows, so the recruiter sees why the save fails.
 */
function SimulationPicker({
  sims,
  value,
  onChange,
  disabled,
}: {
  sims: CompanySimulationRow[] | null;
  value: string;
  onChange: (simulationId: string) => void;
  disabled: boolean;
}) {
  if (sims === null) return <p className="muted round-about">Loading your simulations…</p>;

  const published = sims.filter((s) => s.status === 'PUBLISHED');
  const chosen = sims.find((s) => s.id === value);

  if (published.length === 0 && !chosen) {
    return (
      <p className="alert round-about">
        You have no published work simulations yet. Build one and publish it in{' '}
        <Link to="/company/simulations">Simulations</Link>, then come back and pick it here.
      </p>
    );
  }

  return (
    <div className="round-about">
      <label style={{ display: 'grid', gap: 3 }}>
        <span>Work simulation</span>
        <select
          // The same look as the round's other selects, without a stylesheet of its own.
          style={{ padding: '6px 9px', font: 'inherit', fontSize: 13.5, border: '1px solid var(--rule)', borderRadius: 6, background: 'var(--paper-2)', color: 'var(--ink)' }}
          value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
          <option value="">Pick one…</option>
          {published.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} (~{s.estimatedHours} h)
            </option>
          ))}
          {chosen && chosen.status !== 'PUBLISHED' && (
            <option value={chosen.id}>
              {chosen.title} - {chosen.status.toLowerCase()}, publish it first
            </option>
          )}
        </select>
      </label>
      {chosen && (
        <p className="muted">
          <b>{chosen.role}</b> · {chosen.taskCount} task{chosen.taskCount === 1 ? '' : 's'} · about{' '}
          {chosen.estimatedHours} hour{chosen.estimatedHours === 1 ? '' : 's'}. {chosen.summary}
        </p>
      )}
      <p className="muted">
        Students reaching this round start it from their applications page. Build or edit simulations in{' '}
        <Link to="/company/simulations">Simulations</Link>.
      </p>
    </div>
  );
}

/**
 * Who at the company is running this hire.
 *
 * The manual's fourth section. It names the people involved; it does not
 * grant anybody access they did not already have, which is what Role
 * management is for.
 */
function JobTeamStep({
  job,
  editable,
  onSaved,
}: {
  job: JobDetail;
  editable: boolean;
  onSaved: () => void;
}) {
  const { busy, saved, error, save } = useSave(onSaved);
  const [chosen, setChosen] = useState<string[]>(job.team.map((t) => t.id));

  const toggle = (id: string) =>
    setChosen((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <section className="card">
      <h2>Who is running this</h2>
      <p className="muted">
        The people from your side on this particular hire. Everyone at the company can still see the
        role &mdash; this says who is actually working it.
      </p>
      {error && <p className="alert alert-error">{error}</p>}

      {job.colleagues.length === 0 ? (
        <p className="muted">Nobody else has joined your company account yet.</p>
      ) : (
        <ul className="pick-list">
          {job.colleagues.map((m) => (
            <li key={m.id}>
              <label className="pick-row">
                <input
                  type="checkbox"
                  checked={chosen.includes(m.id)}
                  onChange={() => toggle(m.id)}
                  disabled={!editable || busy}
                />
                <span>
                  <b>{m.fullName}</b>
                  <span className="row-sub mono">{m.email}</span>
                </span>
                <span className="pill pill-idle">{m.roleName}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {editable && job.colleagues.length > 0 && (
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => save(() => jobApi.setTeam(job.id, chosen))}
          >
            {busy ? 'Saving…' : saved ? 'Saved' : 'Save the panel'}
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * Does this college teach what the role asks for?
 *
 * Derived, not declared. A college already says what it teaches in the one
 * place it cannot afford to be wrong - the courses on its batches - and that
 * arrives with each drive. A separate "this college is an Arts college" field
 * would be a second copy of the same fact, and the day a college opened a
 * course and forgot to update it, real students would go quietly invisible.
 *
 * It warns and does not block. A recruiter may have a reason to go to a
 * college whose courses do not match on paper, and a rule that refused them
 * would be wrong more often than the warning is. What it prevents is doing it
 * by accident - which today costs an Arts placement officer a posting they
 * have to open and decline by hand.
 *
 * Null means "nothing to say": a role open to every course, or a drive whose
 * batches carry no course at all.
 */
function courseMismatch(job: JobDetail, drive: Drive): string | null {
  if (job.allowedCourses.length === 0) return null;
  if (drive.courses.length === 0) return null;
  const wanted = new Set(job.allowedCourses.map((c) => c.toLowerCase()));
  const overlap = drive.courses.some((c) => wanted.has(c.toLowerCase()));
  if (overlap) return null;
  return `Runs ${drive.courses.slice(0, 3).join(', ')}${drive.courses.length > 3 ? '…' : ''} — none of the courses this role asks for. Nobody here would be eligible.`;
}

function TargetsStep({ job, onSaved }: { job: JobDetail; onSaved: () => void }) {
  const [drives, setDrives] = useState<Drive[] | null>(null);
  const [notOpenYet, setNotOpenYet] = useState<CollegeWaiting[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);

  /**
   * Which batches inside each chosen drive, where the role is aimed at only
   * some of them. A drive missing from this map, or holding an empty list,
   * means the whole of it - the same convention the server stores.
   */
  const [batches, setBatches] = useState<Record<string, string[]>>({});

  const { busy, saved, error, save } = useSave(onSaved);

  useEffect(() => {
    jobApi.targets(job.id).then(({ drives: d, notOpenYet: waiting }) => {
      setDrives(d);
      setNotOpenYet(waiting);
      setChosen(d.filter((x) => x.status !== null).map((x) => x.id));
      setBatches(
        Object.fromEntries(
          d.filter((x) => x.chosenBatchIds.length > 0).map((x) => [x.id, x.chosenBatchIds]),
        ),
      );
    });
  }, [job.id]);

  /** A drive a college has already answered is not ours to add or drop. */
  const decided = (d: Drive) => d.status === 'ACCEPTED' || d.status === 'DECLINED';

  /** Not pickable until the institution approves us; one already sent stays. */
  const locked = (d: Drive) => Boolean(d.needsApproval) && d.status === null;
  const open = useMemo(() => (drives ?? []).filter((d) => !decided(d) && !locked(d)), [drives]);
  const lockedColleges = useMemo(
    () => [...new Set((drives ?? []).filter(locked).map((d) => d.collegeName))],
    [drives],
  );
  const answered = useMemo(() => (drives ?? []).filter(decided), [drives]);

  /*
   * The dropdown deals in labels, the server in ids. Two colleges can run a
   * drive of the same name in the same year, so the label carries the college
   * and the id stays the thing that is saved.
   */
  const labelOf = (d: Drive) => `${d.collegeName} — ${d.name}`;
  const byLabel = useMemo(() => new Map(open.map((d) => [labelOf(d), d.id])), [open]);
  const byId = useMemo(() => new Map((drives ?? []).map((d) => [d.id, d])), [drives]);

  const chosenOpen = chosen.filter((id) => !decided(byId.get(id) ?? ({} as Drive)));

  const allChosen = open.length > 0 && chosenOpen.length === open.length;

  return (
    <section className="card">
      <h2>Which colleges</h2>
      <p className="muted">
        Each placement cell decides separately, so the same role can be live at one college and
        declined at another. Pick the drives, then narrow to particular batches if you need to.
      </p>
      {error && <p className="alert alert-error">{error}</p>}
      {lockedColleges.length > 0 && (
        <p className="alert">
          {lockedColleges.length} college{lockedColleges.length === 1 ? '' : 's'} (
          {lockedColleges.slice(0, 3).join(', ')}
          {lockedColleges.length > 3 ? ` and ${lockedColleges.length - 3} more` : ''}) belong to institutions that
          approve companies first. <Link to="/company/institutions">Request access</Link> to send roles there.
        </p>
      )}

      {drives === null && <p className="muted">Loading drives…</p>}
      {drives?.length === 0 && <p className="muted">No college has an open drive right now.</p>}

      {drives && drives.length > 0 && (
        <>
          <div className="pick-drives">
            <MultiSelect
              label="Seasons"
              hint="Searchable — a university with two hundred colleges is a list nobody scrolls."
              options={[...byLabel.keys()]}
              selected={chosenOpen.map((id) => labelOf(byId.get(id)!)).filter(Boolean)}
              onChange={(labels) =>
                setChosen([
                  // Answered drives stay whatever they were; only the open
                  // ones are the dropdown's to change.
                  ...chosen.filter((id) => decided(byId.get(id) ?? ({} as Drive))),
                  ...labels.map((l) => byLabel.get(l)).filter((id): id is string => Boolean(id)),
                ])
              }
              emptyMeans="None yet"
              searchPlaceholder="Search colleges and drives"
            />

            {open.length > 1 && (
              <button
                type="button"
                className="link-btn"
                onClick={() =>
                  setChosen(
                    allChosen
                      ? chosen.filter((id) => decided(byId.get(id) ?? ({} as Drive)))
                      : [
                          ...chosen.filter((id) => decided(byId.get(id) ?? ({} as Drive))),
                          ...open.map((d) => d.id),
                        ],
                  )
                }
              >
                {allChosen ? 'Clear all' : `Select all ${open.length}`}
              </button>
            )}
          </div>

          {/*
            Only what was chosen is drawn in full. The old grid listed every
            drive on the portal at once, batches and all, which is a wall of
            checkboxes by the twentieth college.
          */}
          {chosenOpen.length > 0 && (
            <ul className="chosen-drives">
              {chosenOpen.map((id) => {
                const d = byId.get(id);
                if (!d) return null;
                const picked = batches[d.id] ?? [];

                return (
                  <li key={d.id}>
                    <div className="chosen-head">
                      <span>
                        <b>{d.collegeName}</b>
                        <span className="row-sub">
                          {d.name} · {d.studentCount} students
                          {d.naacGrade ? ` · NAAC ${d.naacGrade}` : ''}
                        </span>
                        {courseMismatch(job, d) && (
                          <span className="row-warn">{courseMismatch(job, d)}</span>
                        )}
                      </span>
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => setChosen(chosen.filter((x) => x !== d.id))}
                      >
                        Remove
                      </button>
                    </div>

                    {d.batches.length > 1 && (
                      <MultiSelect
                        label="Batches"
                        options={d.batches.map((b) => b.name)}
                        selected={d.batches.filter((b) => picked.includes(b.id)).map((b) => b.name)}
                        onChange={(names) =>
                          setBatches((prev) => ({
                            ...prev,
                            [d.id]: d.batches
                              .filter((b) => names.includes(b.name))
                              .map((b) => b.id),
                          }))
                        }
                        emptyMeans={`Every batch (${d.batches.length})`}
                        searchPlaceholder="Search batches"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Answered drives are shown apart, because they are not editable. */}
          {answered.length > 0 && (
            <div className="answered-drives">
              <p className="field-label">Already answered</p>
              <ul>
                {answered.map((d) => (
                  <li key={d.id}>
                    <span className={`pill ${d.status === 'ACCEPTED' ? 'pill-pass' : 'pill-stop'}`}>
                      {d.status}
                    </span>
                    {d.collegeName} <span className="muted">· {d.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() =>
              save(() =>
                jobApi.setTargets(
                  job.id,
                  chosenOpen.map((placementId) => ({
                    placementId,
                    batchIds: batches[placementId] ?? [],
                  })),
                ),
              )
            }
          >
            {busy ? 'Saving…' : saved ? 'Saved' : 'Save'}
          </button>

          {/*
            Colleges that are on the portal but have no drive open. Without
            this they are simply absent from the list, which looks exactly
            like a college that was never added at all.
          */}
          {notOpenYet.length > 0 && (
            <details className="not-open">
              <summary>
                {notOpenYet.length} more college
                {notOpenYet.length === 1 ? '' : 's'} on the portal with no drive open yet
              </summary>
              <p className="muted">
                A drive is the placement season a cell opens and accepts roles into. Until one of
                these opens theirs, there is nothing to aim a role at.
              </p>
              <ul className="not-open-list">
                {notOpenYet.map((c) => (
                  <li key={c.id}>
                    {c.name}{' '}
                    <span className="muted">
                      ({c.code}
                      {c.where ? ` · ${c.where}` : ''})
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
function PublishStep({
  job,
  readiness,
  reach,
  onPublished,
  onDeleted,
  onDeclared,
}: {
  job: JobDetail;
  readiness: Readiness | null;
  reach: Reach | null;
  onPublished: () => void;
  onDeleted: () => void;
  onDeclared: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [declaring, setDeclaring] = useState(false);

  async function declare() {
    setDeclaring(true);
    setError(null);
    try {
      await jobApi.declareNoFee(job.id);
      onDeclared();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record the declaration.');
    } finally {
      setDeclaring(false);
    }
  }

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      await jobApi.publish(job.id);
      onPublished();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not publish.');
    } finally {
      setBusy(false);
    }
  }

  if (job.status !== 'DRAFT') {
    return (
      <section className="card">
        <h2>Where this role stands</h2>
        {job.postings.length === 0 ? (
          <p className="muted">Not targeted at any college.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>College</th>
                <th>Drive</th>
                <th>Decision</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {job.postings.map((p) => (
                <tr key={p.id}>
                  <td className="row-link">{p.collegeName}</td>
                  <td>{p.placementName}</td>
                  <td>
                    <span
                      className={`pill ${
                        p.status === 'ACCEPTED'
                          ? 'pill-pass'
                          : p.status === 'DECLINED'
                            ? 'pill-stop'
                            : 'pill-hold'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="muted">{p.declineReason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    );
  }

  return (
    <>
      {/*
        Said by a person, in their own name, before anything goes out. The
        scam shield reads every word of the posting too; this is the part a
        college can hold the company to.
      */}
      <section className="card form-card declaration">
        <h2>No fee, at any stage</h2>
        {job.noFeeDeclaredAt ? (
          <p className="alert alert-ok">
            Declared on {new Date(job.noFeeDeclaredAt).toLocaleDateString()}: no student is asked to pay anything
            at any stage of this hiring.
          </p>
        ) : (
          <label className="check-row">
            <input type="checkbox" checked={false} onChange={declare} disabled={declaring} />
            <span>
              <b>
                I confirm that {job.company.name} charges students no fee of any kind - for applying, tests,
                training, uniforms, equipment or joining - at any stage of this hiring.
              </b>
              <span className="check-hint">
                Recorded with your name and the date, and shown to colleges. Required to publish.
              </span>
            </span>
          </label>
        )}
      </section>

      <section className="card">
        <h2>Ready to publish?</h2>
        {error && <p className="alert alert-error">{error}</p>}

        {readiness?.ok ? (
          <>
            <p className="alert alert-ok">
              Everything is in place. Publishing sends this role to{' '}
              <b>
                {job.postings.length} college
                {job.postings.length === 1 ? '' : 's'}
              </b>{' '}
              as a pending request. Students see it only once their placement cell accepts.
            </p>

            {/*
              The last thing said before publishing is who it goes to. A role
              that clears every check and still reaches nobody is the failure
              worth catching on this screen rather than at the deadline.
            */}
            {reach && reach.eligible === 0 && (
              <p className="alert alert-warn">
                As written, <b>no student</b> would be able to see this
                {reach.narrowest
                  ? ` — ${reach.narrowest.label} rules out ${reach.narrowest.cut} of ${reach.inScope}`
                  : ''}
                . You can still publish, but nobody will apply.
              </p>
            )}
            {reach && reach.eligible > 0 && (
              <p className="muted">
                <b>{reach.eligible}</b> student{reach.eligible === 1 ? '' : 's'} will be able to see
                it once their college accepts — {reach.verified} verified so far.
              </p>
            )}
            <button type="button" className="btn btn-primary" onClick={publish} disabled={busy}>
              {busy ? 'Publishing…' : 'Publish role'}
            </button>
          </>
        ) : (
          <>
            <p className="muted">Fix these first:</p>
            <ul className="problem-list">
              {readiness?.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="card">
        <h2>Discard this draft</h2>
        <p className="muted">Nobody has seen it, so it can be deleted outright.</p>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={async () => {
            await jobApi.remove(job.id);
            onDeleted();
          }}
        >
          Delete draft
        </button>
      </section>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Inclusion                                                                   */
/* -------------------------------------------------------------------------- */

const GENDER_CHOICES: { value: GenderEligibility; hint: string }[] = [
  { value: 'ANY', hint: 'Anybody who clears the rest of your criteria can apply. The usual answer.' },
  {
    value: 'WOMEN_PREFERRED',
    hint: 'Shown as a women-first role to encourage applicants. Nobody is excluded.',
  },
  {
    value: 'WOMEN',
    hint: 'A diversity drive. Only students recorded as female see the role.',
  },
  {
    value: 'MEN',
    hint: 'Only students recorded as male see the role. Needs a reason the college will accept.',
  },
];

/**
 * Who beyond the marks: disability, gender, and the support on offer.
 *
 * Disability is informational - the portal holds no disability data about
 * students, and should not - so it filters nobody. It is still worth stating,
 * because "is this job open to me" is the first question a student with a
 * disability has, and campus postings almost never answer it.
 *
 * Gender, by contrast, is enforced when it is a restriction. That is why a
 * restriction needs a reason, and why the college sees it before accepting.
 */
function InclusionStep({
  job,
  meta,
  editable,
  onSaved,
}: {
  job: JobDetail;
  meta: JobMeta | null;
  editable: boolean;
  onSaved: () => void;
}) {
  const { busy, saved, error, save } = useSave(onSaved, { continues: true });

  const [gender, setGender] = useState<GenderEligibility>(job.genderEligibility ?? 'ANY');
  const [genderNote, setGenderNote] = useState(job.genderNote ?? '');
  const [pwd, setPwd] = useState<'' | 'YES' | 'NO'>(job.pwdSuitable ?? '');
  const [categories, setCategories] = useState<string[]>(job.pwdCategories ?? []);
  const [support, setSupport] = useState<string[]>(job.accommodations ?? []);
  const [note, setNote] = useState(job.inclusionNote ?? '');

  const lists = meta?.inclusion ?? { pwdCategories: [], accommodations: [] };
  const restricted = gender === 'WOMEN' || gender === 'MEN';
  const off = !editable || busy;

  const toggle = (list: string[], set: (v: string[]) => void, key: string) =>
    set(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void save(() =>
      jobApi.update(
        job.id,
        payloadFrom(job, {
          genderEligibility: gender,
          genderNote,
          pwdSuitable: pwd,
          pwdCategories: pwd === 'YES' ? categories : [],
          accommodations: pwd === 'YES' ? support : [],
          inclusionNote: note,
        }),
      ),
    );
  }

  return (
    <form className="card form-card inclusion" onSubmit={onSubmit} noValidate>
      {error && <p className="alert alert-error">{error}</p>}

      <fieldset className="sub-block">
        <legend>Can a person with a disability do this job?</legend>
        <p className="muted">
          Shown to every student on the role. It filters nobody out - the portal keeps no disability data - but
          it answers the first question a student with a disability has, which campus postings almost never do.
        </p>

        <div className="inc-options" role="radiogroup" aria-label="Suitable for persons with disabilities">
          {(
            [
              ['YES', 'Yes', 'Choose which disabilities below.'],
              ['NO', 'No', 'The work cannot reasonably be adapted.'],
              ['', 'Not assessed yet', 'Students are told you have not said.'],
            ] as const
          ).map(([value, label, hint]) => (
            <label key={value || 'unset'} className={`inc-option ${pwd === value ? 'is-on' : ''}`}>
              <input
                type="radio"
                name="pwd"
                checked={pwd === value}
                onChange={() => setPwd(value)}
                disabled={off}
              />
              <span>
                <b>{label}</b>
                <span className="check-hint">{hint}</span>
              </span>
            </label>
          ))}
        </div>

        {pwd === 'YES' && (
          <>
            <p className="field-label inc-sub">
              Which disabilities is it suitable for?
              <span className="muted"> The groups of the Rights of Persons with Disabilities Act, 2016.</span>
            </p>
            <div className="inc-grid">
              {lists.pwdCategories.map((c) => (
                <label key={c.key} className={`inc-check ${categories.includes(c.key) ? 'is-on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={categories.includes(c.key)}
                    onChange={() => toggle(categories, setCategories, c.key)}
                    disabled={off}
                  />
                  <span>
                    {c.label}
                    {c.hint && <span className="check-hint">{c.hint}</span>}
                  </span>
                </label>
              ))}
            </div>
            <div className="inc-actions">
              <button
                type="button"
                className="link-btn"
                disabled={off}
                onClick={() => setCategories(lists.pwdCategories.map((c) => c.key))}
              >
                Select all
              </button>
              <button type="button" className="link-btn" disabled={off} onClick={() => setCategories([])}>
                Clear
              </button>
            </div>

            <p className="field-label inc-sub">What support do you offer?</p>
            <div className="inc-grid">
              {lists.accommodations.map((a) => (
                <label key={a.key} className={`inc-check ${support.includes(a.key) ? 'is-on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={support.includes(a.key)}
                    onChange={() => toggle(support, setSupport, a.key)}
                    disabled={off}
                  />
                  <span>{a.label}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </fieldset>

      <fieldset className="sub-block">
        <legend>Who is it open to by gender?</legend>
        <div className="inc-options" role="radiogroup" aria-label="Gender">
          {GENDER_CHOICES.map((g) => (
            <label key={g.value} className={`inc-option ${gender === g.value ? 'is-on' : ''}`}>
              <input
                type="radio"
                name="gender"
                checked={gender === g.value}
                onChange={() => setGender(g.value)}
                disabled={off}
              />
              <span>
                <b>{GENDER_LABELS[g.value]}</b>
                <span className="check-hint">{g.hint}</span>
              </span>
            </label>
          ))}
        </div>

        {restricted && (
          <p className="alert alert-warn inc-warning">
            This hides the role from every other student, and they are told why. Restricting a role by gender is
            lawful only in narrow cases, such as a diversity drive, so the college reads your reason before it
            accepts the request.
          </p>
        )}

        {gender !== 'ANY' && (
          <label className="field">
            <span className="field-label">
              {restricted ? 'Why is it open to one gender only?' : 'Anything to add?'}
              {restricted && <span className="req">required</span>}
            </span>
            <textarea
              rows={2}
              value={genderNote}
              onChange={(e) => setGenderNote(e.target.value)}
              placeholder={
                gender === 'MEN'
                  ? 'Explain the requirement the work genuinely has'
                  : 'Part of our Women in Engineering hiring programme'
              }
              disabled={off}
            />
          </label>
        )}
      </fieldset>

      <label className="field">
        <span className="field-label">
          Anything else about inclusion <span className="muted">optional</span>
        </span>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Our office has a quiet room, and interview schedules can be adjusted on request."
          disabled={off}
        />
      </label>

      {editable && (
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : saved ? 'Saved' : 'Save & continue'}
        </button>
      )}
    </form>
  );
}
