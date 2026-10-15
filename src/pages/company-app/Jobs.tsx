/**
 * Company Job Creation & Management
 *
 * /company/jobs      → CompanyJobList
 * /company/jobs/new  → CompanyJobEditor (create)
 * /company/jobs/:id  → CompanyJobEditor (edit)
 *
 * Layout: LEFT — numbered step nav  |  MIDDLE — step form
 *
 * Steps:
 *   1  Job details      title, type, pay, location, description
 *   2  Eligibility      CGPA, courses, graduation years, skills
 *   3  Interview rounds the full recruitment workflow
 *   4  Student results  students who completed a test/simulation for this company
 *   5  Publish          readiness check + no-fee declaration
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import {
  jobApi,
  ROUND_LABELS,
  type JobMeta,
  type JobSummary,
  type Round,
  type RoundType,
} from '../../api/jobs';
import { companyAppApi, type SharedWork, type SentTest } from '../../api/companyApp';
import { companyInviteApi } from '../../api/interviewInvites';
import { interviewProcessApi, type InterviewProcessSummary } from '../../api/companyInterviews';
import Frame from './Frame';
import './jobs.css';

/* ─── helpers ────────────────────────────────────────────────────────── */
const apiErr = (ex: unknown, fb: string) => (ex instanceof ApiError ? ex.message : fb);
let _seq = 0;
const uid = () => `k${++_seq}`;

/* ─── round metadata ─────────────────────────────────────────────────── */
const ROUND_ICONS: Record<string, string> = {
  RESUME_SCREEN: '📄', MCQ_TEST: '📝', VIDEO_INTERVIEW: '🎥',
  LIVE_INTERVIEW: '🎙️', GROUP_DISCUSSION: '🗣️', ASSIGNMENT: '📋', WORK_SIMULATION: '💼',
};
const ROUND_HINTS: Record<string, string> = {
  RESUME_SCREEN:   'Shortlist candidates by reviewing their CVs and profile.',
  MCQ_TEST:        'Timed aptitude, technical or logical reasoning test.',
  VIDEO_INTERVIEW: 'Candidate records answers to your questions — you review later.',
  LIVE_INTERVIEW:  'Real-time one-on-one or panel interview.',
  GROUP_DISCUSSION:'Candidates discuss a topic together; you observe and score.',
  ASSIGNMENT:      'Take-home case study, project or practical task.',
  WORK_SIMULATION: 'Hands-on work sample via Apli.ai simulation.',
};
const ROUND_TYPES: RoundType[] = [
  'RESUME_SCREEN', 'MCQ_TEST', 'VIDEO_INTERVIEW',
  'LIVE_INTERVIEW', 'GROUP_DISCUSSION', 'ASSIGNMENT', 'WORK_SIMULATION',
];
const Q_TYPES = [
  { value: 'intro',       label: 'Introduction' },
  { value: 'behavioural', label: 'Behavioural' },
  { value: 'technical',   label: 'Technical' },
  { value: 'situational', label: 'Situational' },
  { value: 'motivation',  label: 'Motivation' },
];

/* ─── steps ──────────────────────────────────────────────────────────── */
const STEPS = [
  { label: 'Job details',      sub: 'Title, type, pay' },
  { label: 'Eligibility',      sub: 'CGPA, courses, skills' },
  { label: 'Rounds',           sub: 'Interview workflow' },
  { label: 'Student results',  sub: 'Who completed tests' },
  { label: 'Publish',          sub: 'Review & go live' },
];

/* ─── types ──────────────────────────────────────────────────────────── */
interface VideoQuestion { _key: string; text: string; hint: string; type: string; }

interface RoundDraft {
  _key: string; order: number; name: string; type: RoundType;
  isElimination: boolean; description: string; isOnline: boolean;
  meetingLink: string; addressLine: string; durationMin: string;
  shortlistCount: string; mode: string; scheduledAt: string; venue: string;
  prepTimeSec: number; answerTimeSec: number;
  questions: VideoQuestion[]; open: boolean;
}

function blankRound(type: RoundType, order: number): RoundDraft {
  return {
    _key: uid(), order, type, name: ROUND_LABELS[type] ?? type,
    isElimination: true, description: '',
    isOnline: type === 'MCQ_TEST' || type === 'VIDEO_INTERVIEW',
    meetingLink: '', addressLine: '', durationMin: '', shortlistCount: '',
    mode: '', scheduledAt: '', venue: '',
    prepTimeSec: 30, answerTimeSec: 60,
    questions: type === 'VIDEO_INTERVIEW'
      ? [{ _key: uid(), text: 'Tell us about yourself and your interest in this role.', hint: '', type: 'intro' }]
      : [],
    open: true,
  };
}

function fromApi(r: Round): RoundDraft {
  const cfg = (r.config ?? {}) as Record<string, unknown>;
  return {
    _key: uid(), order: r.order, type: r.type as RoundType,
    name: r.name, isElimination: r.isElimination,
    description: r.description ?? '', isOnline: r.isOnline,
    meetingLink: r.meetingLink ?? '', addressLine: r.addressLine ?? '',
    durationMin: r.durationMin != null ? String(r.durationMin) : '',
    shortlistCount: r.shortlistCount != null ? String(r.shortlistCount) : '',
    mode: r.mode ?? '',
    scheduledAt: r.scheduledAt ? r.scheduledAt.slice(0, 16) : '',
    venue: r.venue ?? '',
    prepTimeSec: typeof cfg.prepTimeSec === 'number' ? cfg.prepTimeSec : 30,
    answerTimeSec: typeof cfg.answerTimeSec === 'number' ? cfg.answerTimeSec : 60,
    questions: Array.isArray(cfg.questions)
      ? (cfg.questions as VideoQuestion[]).map((q) => ({ ...q, _key: uid() }))
      : [],
    open: false,
  };
}

/* student result shape unified from tests + shared */
interface StudentResult {
  candidateId: string;
  name: string;
  email: string;
  college: string | null;
  course: string | null;
  batch: string | null;
  kind: 'test' | 'simulation';
  label: string;    // test name or simulation title
  score: string | null;  // e.g. "18/20" for tests
  completedAt: string | null;
}

/* ═══════════════════════════════════════════════════════════════════════
   JOB LIST
═══════════════════════════════════════════════════════════════════════ */
export function CompanyJobList() {
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    jobApi.list().then(setJobs).catch((ex) => setError(apiErr(ex, 'Could not load jobs.')));
  }, []);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <Frame>
      <section className="sa-hero is-short">
        <div className="sa-wrap sa-ov-head">
          <div>
            <p className="sa-eyebrow">Jobs</p>
            <h1>Your open <span className="sa-mark">roles</span></h1>
            <p className="sa-lede">Post a role, define the interview workflow, and publish.</p>
          </div>
          <button type="button" className="sa-btn" onClick={() => navigate('/company/jobs/new')}>
            Post a role <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>

      <div className="sa-wrap sa-body">
        {error && <p className="sa-alert">{error}</p>}
        {!jobs && !error && <p className="sa-loading">Loading…</p>}

        {jobs?.length === 0 && (
          <div className="jl-empty">
            <div className="jl-empty-icon">💼</div>
            <b>No roles yet</b>
            <p>Post your first role and define the interview rounds candidates go through.</p>
            <button type="button" className="sa-btn" onClick={() => navigate('/company/jobs/new')}>
              Post your first role →
            </button>
          </div>
        )}

        {jobs && jobs.length > 0 && (
          <ul className="jl-grid">
            {jobs.map((j) => (
              <li key={j.id}>
                <Link to={`/company/jobs/${j.id}`} className="jl-card">
                  <div className="jl-card-icon">💼</div>
                  <div className="jl-card-body">
                    <div className="jl-card-title">{j.title}</div>
                    <div className="jl-card-meta">
                      <span className={`jl-pill is-${j.status.toLowerCase()}`}>
                        {j.status.charAt(0) + j.status.slice(1).toLowerCase()}
                      </span>
                      <span className="jl-dot" />
                      <span>{j.jobType.replace(/_/g, ' ')}</span>
                      {j.location && <><span className="jl-dot" /><span>📍 {j.location}</span></>}
                      <span className="jl-dot" />
                      <span>Closes {fmt(j.deadline)}</span>
                      <span className="jl-dot" />
                      <span className="jl-round-pill">{j.roundCount} round{j.roundCount === 1 ? '' : 's'}</span>
                      {j.applicationCount > 0 && <><span className="jl-dot" /><span>{j.applicationCount} applied</span></>}
                    </div>
                  </div>
                  <span className="jl-arrow">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Frame>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   JOB EDITOR
═══════════════════════════════════════════════════════════════════════ */
export function CompanyJobEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();

  const [step, setStep]       = useState(0);
  const [jobId, setJobId]     = useState<string | null>(isNew ? null : (id ?? null));
  const [meta, setMeta]       = useState<JobMeta | null>(null);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  /* field-level errors shown inline under the specific input */
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const clearFieldErr = (k: string) => setFieldErr((fe) => { const n = { ...fe }; delete n[k]; return n; });
  const fe = (k: string) => fieldErr[k] ?? null;

  /* step 0 */
  const [title, setTitle]         = useState('');
  const [description, setDesc]    = useState('');
  const [responsibilities, setResps] = useState('');
  const [jobType, setJobType]     = useState('FULL_TIME');
  const [workMode, setWorkMode]   = useState('');
  const [location, setLoc]        = useState('');
  const [openings, setOpenings]   = useState('');
  const [deadline, setDeadline]   = useState('');
  const [payPeriod, setPayPeriod] = useState<'YEARLY'|'MONTHLY'>('YEARLY');
  const [ctcMin, setCtcMin]       = useState('');
  const [ctcMax, setCtcMax]       = useState('');
  const [stipend, setStipend]     = useState('');
  const [intMonths, setIntMo]     = useState('');
  const [screenUrl, setScreenUrl] = useState('');
  const [screenReq, setScreenReq] = useState(false);

  /* step 1 */
  const [openToAll, setOpenToAll]   = useState(false);
  const [minCgpa, setMinCgpa]       = useState('');
  const [minPct, setMinPct]         = useState('');
  const [maxBacklogs, setMaxBL]     = useState('');
  const [courses, setCourses]       = useState<string[]>([]);
  const [gradYears, setGradYears]   = useState<number[]>([]);
  const [skillIds, setSkillIds]     = useState<string[]>([]);

  /* step 2 */
  const [rounds, setRounds]         = useState<RoundDraft[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const dragKey = useRef<string | null>(null);
  const [dragOver, setDragOver]     = useState<string | null>(null);

  /* step 3 — student results */
  const [students, setStudents]         = useState<StudentResult[] | null>(null);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [studentSearch, setStudentSearch]   = useState('');
  const [scoreFilter, setScoreFilter]       = useState<'all'|'tests'|'simulations'>('all');
  /* invite flow per-student */
  const [inviting, setInviting]             = useState<string | null>(null); // candidateId
  const [ivProcesses, setIvProcesses]       = useState<InterviewProcessSummary[] | null>(null);
  const [ivProcessId, setIvProcessId]       = useState('');
  const [ivRole, setIvRole]                 = useState('');
  const [ivMsg, setIvMsg]                   = useState('');
  const [ivSending, setIvSending]           = useState(false);
  const [ivSent, setIvSent]                 = useState<Set<string>>(new Set());
  const [ivError, setIvError]               = useState<string | null>(null);

  /* step 4 — publish */
  const [readiness, setReadiness] = useState<{ ok: boolean; problems: string[] } | null>(null);
  const [noFeeDecl, setNoFeeDecl] = useState(false);
  const [published, setPublished] = useState(false);

  const [doneMask, setDoneMask] = useState<boolean[]>(Array(STEPS.length).fill(false));
  const markDone = (s: number) => setDoneMask((m) => { const n = [...m]; n[s] = true; return n; });

  /* ── load ── */
  useEffect(() => { jobApi.meta().then(setMeta).catch(() => undefined); }, []);

  useEffect(() => {
    if (isNew) return;
    jobApi.get(id!).then(({ job, readiness: r }) => {
      setTitle(job.title); setDesc(job.description); setResps(job.responsibilities ?? '');
      setJobType(job.jobType); setWorkMode(job.workMode ?? ''); setLoc(job.location ?? '');
      setOpenings(job.openings != null ? String(job.openings) : '');
      setDeadline(job.deadline ? job.deadline.slice(0, 16) : '');
      setPayPeriod(job.payPeriod as 'YEARLY'|'MONTHLY');
      setCtcMin(job.ctcMin ?? ''); setCtcMax(job.ctcMax ?? '');
      setStipend(job.stipendPerMonth ?? '');
      setIntMo(job.internshipMonths != null ? String(job.internshipMonths) : '');
      setScreenUrl(job.screeningTestUrl ?? ''); setScreenReq(job.screeningTestRequired);
      setOpenToAll(job.openToAll);
      setMinCgpa(job.minCgpa ?? ''); setMinPct(job.minDegreePct ?? '');
      setMaxBL(job.maxBacklogs != null ? String(job.maxBacklogs) : '');
      setCourses(job.allowedCourses); setGradYears(job.graduationYears);
      setSkillIds(job.skills.map((s) => s.id));
      setRounds(job.rounds.map(fromApi));
      setReadiness(r);
      if (job.noFeeDeclaredAt) setNoFeeDecl(true);
      setDoneMask([true, true, job.rounds.length > 0, false, false]);
    }).catch(() => undefined);
  }, [id, isNew]);

  /* load students when reaching step 3 */
  const loadStudents = useCallback(() => {
    if (studentsLoaded) return;
    Promise.all([
      companyAppApi.tests().catch((): SentTest[] => []),
      companyAppApi.shared().catch((): SharedWork[] => []),
    ]).then(([tests, shared]) => {
      const seen = new Map<string, StudentResult>();

      for (const t of tests) {
        const key = t.student.id;
        const score = `${t.score}/${t.total}`;
        const prev = seen.get(key);
        if (!prev || (prev.kind === 'simulation')) {
          seen.set(key, {
            candidateId: t.student.id,
            name: t.student.name,
            email: t.student.email,
            college: t.student.college,
            course: t.student.course,
            batch: t.student.batch,
            kind: 'test',
            label: `${t.simulation} — ${t.test}`,
            score,
            completedAt: t.takenAt,
          });
        }
      }

      for (const s of shared) {
        const key = s.student.id;
        if (!seen.has(key)) {
          seen.set(key, {
            candidateId: s.student.id,
            name: s.student.name,
            email: s.student.email,
            college: s.student.college,
            course: s.student.course,
            batch: s.student.batch,
            kind: 'simulation',
            label: s.simulation.title,
            score: null,
            completedAt: s.completedAt,
          });
        }
      }

      setStudents([...seen.values()]);
      setStudentsLoaded(true);
    });
  }, [studentsLoaded]);

  useEffect(() => { if (step === 3) loadStudents(); }, [step, loadStudents]);

  /* reload readiness at step 4 */
  useEffect(() => {
    if (step !== 4 || !jobId) return;
    jobApi.get(jobId).then(({ readiness: r }) => setReadiness(r)).catch(() => undefined);
  }, [step, jobId]);

  /* load interview processes for the invite form */
  useEffect(() => {
    if (inviting && !ivProcesses) {
      interviewProcessApi.list()
        .then((ps) => {
          const active = ps.filter((p) => p.status === 'ACTIVE' || p.status === 'DRAFT');
          setIvProcesses(active);
          if (active.length === 1) setIvProcessId(active[0]!.id);
        })
        .catch(() => setIvProcesses([]));
    }
  }, [inviting, ivProcesses]);

  /* ── derived ── */
  const isStipend = meta?.options?.EMPLOYMENT_TYPE?.find((o) => o.value === jobType)?.paysStipend ?? false;

  /* ── filtered student list ── */
  const visibleStudents = (students ?? []).filter((s) => {
    if (scoreFilter === 'tests' && s.kind !== 'test') return false;
    if (scoreFilter === 'simulations' && s.kind !== 'simulation') return false;
    if (studentSearch.trim()) {
      const q = studentSearch.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.college ?? '').toLowerCase().includes(q) ||
        s.label.toLowerCase().includes(q)
      );
    }
    return true;
  });

  /* ── save functions ── */
  async function save0(): Promise<boolean> {
    /* ── client-side validation: collect ALL problems first ── */
    const errs: Record<string, string> = {};

    if (!title.trim())
      errs.title = 'Enter the role title.';
    else if (title.trim().length < 2)
      errs.title = 'Title must be at least 2 characters.';

    if (!description.trim())
      errs.description = 'Write a description for the role.';
    else if (description.trim().length < 10)
      errs.description = 'Description must be at least 10 characters.';

    if (!deadline)
      errs.deadline = 'Pick an application deadline.';
    else if (isNaN(new Date(deadline).getTime()))
      errs.deadline = 'Invalid date — pick one from the calendar.';
    else if (new Date(deadline).getTime() <= Date.now())
      errs.deadline = 'Deadline must be in the future.';

    if (isStipend) {
      if (!stipend || Number(stipend) <= 0)
        errs.stipend = 'Enter the monthly stipend amount.';
    } else {
      // CTC: at least max must be filled for the role to make sense
      if (!ctcMax || Number(ctcMax) <= 0)
        errs.ctcMax = 'Enter the maximum CTC so students know what this role pays.';
      if (ctcMin && ctcMax && Number(ctcMin) > Number(ctcMax))
        errs.ctcMin = 'Minimum CTC cannot be higher than the maximum.';
    }

    if (screenUrl.trim() && !/^https?:\/\//i.test(screenUrl.trim()))
      errs.screenUrl = 'Test link must start with https:// or http://';

    if (Object.keys(errs).length > 0) {
      setFieldErr(errs);
      /* Set a short top-level banner pointing to the first problem */
      const first = Object.values(errs)[0]!;
      setError(first);
      return false;
    }

    setFieldErr({});
    setError(null);
    setSaving(true);

    const screenReqSafe = screenReq && screenUrl.trim().length > 0;
    const base: Record<string, unknown> = {
      title: title.trim(), description: description.trim(),
      responsibilities: responsibilities.trim() || undefined,
      jobType, workMode: workMode || undefined,
      location: location.trim() || undefined,
      openings: openings ? Number(openings) : undefined,
      deadline: new Date(deadline).toISOString(), payPeriod,
      screeningTestUrl: screenUrl.trim() || undefined,
      screeningTestRequired: screenReqSafe,
      openToAll, allowedCourses: courses, allowedSpecialisations: [],
      graduationYears: gradYears, skillIds, requiredSkillIds: [],
      genderEligibility: 'ANY', allowsLateralEntry: true, relocationRequired: false,
      terms: [], pwdCategories: [], accommodations: [], offerConditions: [], ctcIncludes: [],
    };
    if (isStipend) {
      base.stipendPerMonth = stipend ? Number(stipend) : undefined;
      base.internshipMonths = intMonths ? Number(intMonths) : undefined;
    } else {
      base.ctcMin = ctcMin ? Number(ctcMin) : undefined;
      base.ctcMax = ctcMax ? Number(ctcMax) : undefined;
    }
    try {
      if (!jobId) {
        const j = await jobApi.create(base);
        setJobId(j.id);
        navigate(`/company/jobs/${j.id}`, { replace: true });
      } else {
        await jobApi.update(jobId, base);
      }
      setSaving(false); setSavedAt(new Date().toLocaleTimeString()); markDone(0); return true;
    } catch (ex) { setError(apiErr(ex, 'Could not save. Check the fields above.')); setSaving(false); return false; }
  }

  async function save1(): Promise<boolean> {
    if (!jobId) return false;
    setError(null); setSaving(true);
    const screenReqSafe = screenReq && screenUrl.trim().length > 0;
    try {
      await jobApi.update(jobId, {
        title, description, jobType, workMode: workMode || undefined,
        location: location.trim() || undefined,
        openings: openings ? Number(openings) : undefined,
        deadline: new Date(deadline).toISOString(), payPeriod,
        screeningTestUrl: screenUrl.trim() || undefined,
        screeningTestRequired: screenReqSafe,
        openToAll,
        minCgpa: !openToAll && minCgpa ? Number(minCgpa) : undefined,
        minDegreePct: !openToAll && minPct ? Number(minPct) : undefined,
        maxBacklogs: !openToAll && maxBacklogs ? Number(maxBacklogs) : undefined,
        allowedCourses: courses, allowedSpecialisations: [],
        graduationYears: gradYears, skillIds, requiredSkillIds: [],
        genderEligibility: 'ANY', allowsLateralEntry: true, relocationRequired: false,
        terms: [], pwdCategories: [], accommodations: [], offerConditions: [], ctcIncludes: [],
        ...(isStipend
          ? { stipendPerMonth: stipend ? Number(stipend) : undefined, internshipMonths: intMonths ? Number(intMonths) : undefined }
          : { ctcMin: ctcMin ? Number(ctcMin) : undefined, ctcMax: ctcMax ? Number(ctcMax) : undefined }),
      });
      setSaving(false); setSavedAt(new Date().toLocaleTimeString()); markDone(1); return true;
    } catch (ex) { setError(apiErr(ex, 'Could not save.')); setSaving(false); return false; }
  }

  async function save2(): Promise<boolean> {
    if (!jobId) return false;
    if (rounds.length === 0) { setError('Add at least one hiring round.'); return false; }
    setError(null); setSaving(true);
    try {
      await jobApi.setRounds(jobId, rounds.map((r, idx) => ({
        name: r.name || ROUND_LABELS[r.type] || r.type,
        type: r.type, isElimination: r.isElimination,
        description: r.description || undefined, isOnline: r.isOnline,
        meetingLink: r.isOnline ? r.meetingLink || undefined : undefined,
        addressLine: !r.isOnline ? r.addressLine || undefined : undefined,
        durationMin: r.durationMin ? Number(r.durationMin) : undefined,
        shortlistCount: r.shortlistCount ? Number(r.shortlistCount) : undefined,
        mode: r.mode || undefined,
        scheduledAt: r.scheduledAt ? new Date(r.scheduledAt).toISOString() : undefined,
        venue: r.venue || undefined, order: idx + 1,
        config: r.type === 'VIDEO_INTERVIEW'
          ? { prepTimeSec: r.prepTimeSec, answerTimeSec: r.answerTimeSec,
              questions: r.questions.map((q, qi) => ({ order: qi + 1, text: q.text, hint: q.hint || undefined, type: q.type })) }
          : {},
      })));
      setSaving(false); setSavedAt(new Date().toLocaleTimeString()); markDone(2); return true;
    } catch (ex) { setError(apiErr(ex, 'Could not save rounds.')); setSaving(false); return false; }
  }

  /* step 3 is view-only — no save, just mark done and move on */
  function save3(): boolean { markDone(3); return true; }

  async function declareNoFee(): Promise<boolean> {
    if (!jobId) return false;
    try { await jobApi.declareNoFee(jobId); setNoFeeDecl(true); return true; }
    catch (ex) { setError(apiErr(ex, 'Could not record declaration.')); return false; }
  }

  async function publish() {
    if (!noFeeDecl && !(await declareNoFee())) return;
    setSaving(true); setError(null);
    try { await jobApi.publish(jobId!); setPublished(true); }
    catch (ex) { setError(apiErr(ex, 'Could not publish.')); }
    finally { setSaving(false); }
  }

  async function goNext() {
    let ok = false;
    if (step === 0) ok = await save0();
    else if (step === 1) ok = await save1();
    else if (step === 2) ok = await save2();
    else if (step === 3) ok = save3();
    else ok = true;
    if (ok) { setError(null); setStep((s) => s + 1); }
  }

  /* ── invite helpers ── */
  function openInvite(candidateId: string, name: string) {
    setInviting(candidateId);
    setIvRole(title || '');
    setIvMsg('');
    setIvError(null);
    setIvProcessId(ivProcesses?.length === 1 ? ivProcesses[0]!.id : '');
    _ = name; // suppress unused warning
  }
  let _ = '';

  async function sendInvite(candidateId: string) {
    if (!ivProcessId) { setIvError('Choose an interview process first.'); return; }
    if (!ivRole.trim()) { setIvError('Enter the role name.'); return; }
    setIvSending(true); setIvError(null);
    try {
      await companyInviteApi.send({
        candidateId,
        processId: ivProcessId,
        role: ivRole.trim(),
        message: ivMsg.trim() || undefined,
      });
      setIvSent((s) => new Set(s).add(candidateId));
      setInviting(null);
    } catch (ex) {
      setIvError(apiErr(ex, 'Could not send the invite.'));
    } finally {
      setIvSending(false);
    }
  }

  /* ── round helpers ── */
  const addRound    = (type: RoundType) => { setRounds((rs) => [...rs, blankRound(type, rs.length + 1)]); setShowPicker(false); };
  const removeRound = (k: string) => setRounds((rs) => rs.filter((r) => r._key !== k).map((r, i) => ({ ...r, order: i + 1 })));
  const toggleRound = (k: string) => setRounds((rs) => rs.map((r) => r._key === k ? { ...r, open: !r.open } : r));
  const patchRound  = (k: string, p: Partial<RoundDraft>) => setRounds((rs) => rs.map((r) => r._key === k ? { ...r, ...p } : r));
  const moveRound   = (k: string, dir: -1|1) =>
    setRounds((rs) => {
      const ls = [...rs]; const i = ls.findIndex((r) => r._key === k); const j = i + dir;
      if (j < 0 || j >= ls.length) return ls;
      [ls[i], ls[j]] = [ls[j]!, ls[i]!];
      return ls.map((r, idx) => ({ ...r, order: idx + 1 }));
    });
  const onDragStart = (k: string) => { dragKey.current = k; };
  const onDragOver  = (k: string) => setDragOver(k);
  const onDrop = () => {
    const from = dragKey.current, to = dragOver;
    if (!from || !to || from === to) { dragKey.current = null; setDragOver(null); return; }
    setRounds((rs) => {
      const ls = [...rs];
      const fi = ls.findIndex((r) => r._key === from);
      const ti = ls.findIndex((r) => r._key === to);
      const [item] = ls.splice(fi, 1);
      ls.splice(ti, 0, item!);
      return ls.map((r, i) => ({ ...r, order: i + 1 }));
    });
    dragKey.current = null; setDragOver(null);
  };
  const addQ    = (rk: string) => setRounds((rs) => rs.map((r) => r._key !== rk ? r : { ...r, questions: [...r.questions, { _key: uid(), text: '', hint: '', type: 'behavioural' }] }));
  const patchQ  = (rk: string, qk: string, p: Partial<VideoQuestion>) => setRounds((rs) => rs.map((r) => r._key !== rk ? r : { ...r, questions: r.questions.map((q) => q._key === qk ? { ...q, ...p } : q) }));
  const removeQ = (rk: string, qk: string) => setRounds((rs) => rs.map((r) => r._key !== rk ? r : { ...r, questions: r.questions.filter((q) => q._key !== qk) }));

  /* ── success ── */
  if (published) {
    return (
      <Frame>
        <div className="sa-wrap sa-body">
          <div className="jw-success">
            <div className="jw-success-ico">🎉</div>
            <h1>Role published!</h1>
            <p>It goes to each targeted college's approval queue. Once they accept, eligible students can see and apply.</p>
            <div className="jw-success-acts">
              <button type="button" className="sa-btn" onClick={() => navigate('/company/jobs')}>← Back to jobs</button>
              <button type="button" className="sa-btn is-ghost" onClick={() => navigate('/company/jobs/new')}>Post another role</button>
            </div>
          </div>
        </div>
      </Frame>
    );
  }

  /* ═══════════════════ RENDER ══════════════════════════════════════ */
  return (
    <Frame>
      <div className="sa-wrap sa-body">
        <div className="jw-shell">

          <Link to="/company/jobs" className="jw-back">← Jobs</Link>

          {/* ── Left nav ── */}
          <nav className="jn-nav" aria-label="Job creation steps">
            <div className="jn-nav-title">Create a job</div>
            {STEPS.map((s, i) => {
              const isDone = doneMask[i]!;
              const isActive = i === step;
              const canClick = isDone && !isActive;
              return (
                <button key={s.label} type="button"
                  className={`jn-step ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`}
                  onClick={() => { if (canClick) { setError(null); setStep(i); } }}
                  aria-current={isActive ? 'step' : undefined}
                  title={canClick ? `Go to ${s.label}` : s.label}
                >
                  <span className="jn-num">{isDone && !isActive ? '✓' : i + 1}</span>
                  <div className="jn-text">
                    <div className="jn-label">{s.label}</div>
                    <div className="jn-sub">{s.sub}</div>
                  </div>
                  {isDone && !isActive && <span className="jn-done-badge">✓</span>}
                </button>
              );
            })}
            <div className="jn-nav-footer">
              {savedAt
                ? <span className="jn-save-status">✓ Saved {savedAt}</span>
                : jobId ? <span>Draft · {jobId.slice(0, 10)}…</span>
                : <span>Not yet saved</span>}
            </div>
          </nav>

          {/* ── Form col ── */}
          <div className="jf-col">
            {error && <p className="sa-alert" role="alert">{error}</p>}

            {/* ══════ STEP 0: Job details ══════ */}
            {step === 0 && (
              <>
                <Sec title="1 · Role details" sub="Title, type, location and deadline.">
                  <Fld label="Role title" req ferr={fe('title')}>
                    <input value={title}
                      onChange={(ev) => { setTitle(ev.target.value); clearFieldErr('title'); }}
                      className={fe('title') ? 'has-err' : ''}
                      placeholder="e.g. Software Engineer Intern" maxLength={160} autoFocus />
                  </Fld>
                  <div className="jf-row c3">
                    <Fld label="Employment type">
                      <select value={jobType} onChange={(ev) => setJobType(ev.target.value)}>
                        {(meta?.options?.EMPLOYMENT_TYPE ?? [{ value: 'FULL_TIME', label: 'Full-time' }]).map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </Fld>
                    <Fld label="Work mode">
                      <select value={workMode} onChange={(ev) => setWorkMode(ev.target.value)}>
                        <option value="">Not specified</option>
                        {(meta?.options?.WORK_MODE ?? []).map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </Fld>
                    <Fld label="Location">
                      <input value={location} onChange={(ev) => setLoc(ev.target.value)}
                        placeholder="City or 'Remote'" maxLength={160} />
                    </Fld>
                  </div>
                  <div className="jf-row c2">
                    <Fld label="Openings">
                      <input type="number" min={1} max={100000} value={openings}
                        onChange={(ev) => setOpenings(ev.target.value)} placeholder="e.g. 10" />
                    </Fld>
                    <Fld label="Application deadline" req ferr={fe('deadline')}>
                      <input type="datetime-local" value={deadline}
                        className={fe('deadline') ? 'has-err' : ''}
                        onChange={(ev) => { setDeadline(ev.target.value); clearFieldErr('deadline'); }} />
                    </Fld>
                  </div>
                </Sec>

                <Sec title="Compensation" sub="What the role pays — required before you can publish.">
                  <div className="jf-pay-period-row">
                    <span className="jf-pay-period-label">Quoted as</span>
                    <div className="jf-tabs">
                      <button type="button" className={`jf-tab ${payPeriod === 'YEARLY' ? 'on' : ''}`} onClick={() => setPayPeriod('YEARLY')}>Per year (LPA)</button>
                      <button type="button" className={`jf-tab ${payPeriod === 'MONTHLY' ? 'on' : ''}`} onClick={() => setPayPeriod('MONTHLY')}>Per month</button>
                    </div>
                  </div>

                  {isStipend ? (
                    <div className="jf-row c2">
                      <Fld label="Stipend per month" hint="₹" req ferr={fe('stipend')}>
                        <input type="number" min={0} value={stipend}
                          className={fe('stipend') ? 'has-err' : ''}
                          onChange={(ev) => { setStipend(ev.target.value); clearFieldErr('stipend'); }}
                          placeholder="e.g. 20000" />
                      </Fld>
                      <Fld label="Duration">
                        <div className="jf-unit">
                          <input type="number" min={1} max={36} value={intMonths}
                            onChange={(ev) => setIntMo(ev.target.value)} placeholder="e.g. 6" />
                          <span>months</span>
                        </div>
                      </Fld>
                    </div>
                  ) : (
                    <div className="jf-row c2">
                      <Fld label={payPeriod === 'YEARLY' ? 'Min CTC' : 'Min pay'} hint="₹" ferr={fe('ctcMin')}>
                        <input type="number" min={0} value={ctcMin}
                          className={fe('ctcMin') ? 'has-err' : ''}
                          onChange={(ev) => { setCtcMin(ev.target.value); clearFieldErr('ctcMin'); }}
                          placeholder={payPeriod === 'YEARLY' ? 'e.g. 600000' : 'e.g. 50000'} />
                      </Fld>
                      <Fld label={payPeriod === 'YEARLY' ? 'Max CTC' : 'Max pay'} hint="₹" req ferr={fe('ctcMax')}>
                        <input type="number" min={0} value={ctcMax}
                          className={fe('ctcMax') ? 'has-err' : ''}
                          onChange={(ev) => { setCtcMax(ev.target.value); clearFieldErr('ctcMax'); }}
                          placeholder={payPeriod === 'YEARLY' ? 'e.g. 800000' : 'e.g. 70000'} />
                      </Fld>
                    </div>
                  )}
                </Sec>

                <Sec title="Description & responsibilities" sub="What the role is and what they will work on.">
                  <Fld label="Role description" req ferr={fe('description')}>
                    <p className="jf-field-hint">Overview of the role, the team, and why this position matters.</p>
                    <textarea rows={5} value={description} maxLength={6000}
                      className={fe('description') ? 'has-err' : ''}
                      onChange={(ev) => { setDesc(ev.target.value); clearFieldErr('description'); }}
                      placeholder="Describe the role, the team, and why this position matters…" />
                  </Fld>
                  <Fld label="Key responsibilities">
                    <p className="jf-field-hint">Optional — specific things they will work on day-to-day.</p>
                    <textarea rows={3} value={responsibilities} maxLength={4000}
                      onChange={(ev) => setResps(ev.target.value)}
                      placeholder="• Design and build …&#10;• Collaborate with the product team on …" />
                  </Fld>
                </Sec>

                <Sec title="Pre-application test" sub="Optional — a test students take before they can apply.">
                  <div className="jf-row c2">
                    <Fld label="Test link" ferr={fe('screenUrl')}>
                      <input type="url" value={screenUrl}
                        className={fe('screenUrl') ? 'has-err' : ''}
                        onChange={(ev) => { setScreenUrl(ev.target.value); clearFieldErr('screenUrl'); }}
                        placeholder="https://your-test-platform.com/…" />
                    </Fld>
                    <Fld label=" ">
                      <Tog on={screenReq && screenUrl.trim().length > 0}
                        onTog={() => setScreenReq((v) => !v)}
                        title="Required to apply"
                        sub="Students must complete it before Apply appears." />
                    </Fld>
                  </div>
                  {screenReq && !screenUrl.trim() && (
                    <p className="jf-warn">Add a test link to enable the required-to-apply option.</p>
                  )}
                </Sec>
              </>
            )}

            {/* ══════ STEP 1: Eligibility ══════ */}
            {step === 1 && (
              <>
                <Sec title="2 · Academic criteria" sub="Set minimum bars. Leave blank to accept every score.">
                  <Tog on={openToAll} onTog={() => setOpenToAll((v) => !v)}
                    title="Open to all — no marks bar"
                    sub="Any eligible student may apply, regardless of CGPA or percentage." />
                  {!openToAll && (
                    <div className="jf-row c3">
                      <Fld label="Min CGPA" hint="e.g. 6.5">
                        <input type="number" min={0} max={10} step={0.1} value={minCgpa}
                          onChange={(ev) => setMinCgpa(ev.target.value)} placeholder="—" />
                      </Fld>
                      <Fld label="Min degree %" hint="e.g. 60">
                        <input type="number" min={0} max={100} value={minPct}
                          onChange={(ev) => setMinPct(ev.target.value)} placeholder="—" />
                      </Fld>
                      <Fld label="Max backlogs" hint="0 = none">
                        <input type="number" min={0} max={50} value={maxBacklogs}
                          onChange={(ev) => setMaxBL(ev.target.value)} placeholder="—" />
                      </Fld>
                    </div>
                  )}
                </Sec>

                <Sec title="Eligible courses" sub="Leave all blank for any course.">
                  <div className="jf-chips">
                    {(meta?.courses ?? []).length === 0 && <p className="jf-hint">No courses configured yet.</p>}
                    {(meta?.courses ?? []).map((c) => (
                      <button key={c} type="button" className={`jf-chip ${courses.includes(c) ? 'on' : ''}`}
                        onClick={() => setCourses((cs) => cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c])}>
                        {c}
                      </button>
                    ))}
                  </div>
                </Sec>

                <Sec title="Graduating years" sub="Leave blank for any year.">
                  <div className="jf-chips">
                    {(meta?.graduationYears ?? []).map((y) => (
                      <button key={y} type="button" className={`jf-chip ${gradYears.includes(y) ? 'on' : ''}`}
                        onClick={() => setGradYears((ys) => ys.includes(y) ? ys.filter((x) => x !== y) : [...ys, y])}>
                        {y}
                      </button>
                    ))}
                  </div>
                </Sec>

                <Sec title="Skills" sub="Tag the skills relevant to this role.">
                  <div className="jf-chips">
                    {(meta?.skills ?? []).map((s) => (
                      <button key={s.id} type="button" className={`jf-chip ${skillIds.includes(s.id) ? 'on' : ''}`}
                        onClick={() => setSkillIds((ss) => ss.includes(s.id) ? ss.filter((x) => x !== s.id) : [...ss, s.id])}>
                        {s.name}
                      </button>
                    ))}
                  </div>
                </Sec>
              </>
            )}

            {/* ══════ STEP 2: Interview rounds ══════ */}
            {step === 2 && (
              <div className="jf-section">
                <div className="jf-section-head">
                  <div>
                    <h2>3 · Interview rounds — recruitment workflow</h2>
                    <p>Define every stage a candidate goes through. For <strong>Recorded Interview</strong> rounds, write the exact questions. Drag ⠿ to reorder.</p>
                  </div>
                  <span className="jf-section-badge">{rounds.length} round{rounds.length === 1 ? '' : 's'}</span>
                </div>
                <div className="jf-section-body">
                  <div className="jf-info">
                    <span className="jf-info-icon">💡</span>
                    <span>Mark each round as <strong>eliminating</strong> to gate who moves forward. Video interview rounds let you specify exactly which questions candidates answer on camera.</span>
                  </div>

                  {rounds.length > 0 && (
                    <ol className="jr-list">
                      {rounds.map((r, i) => (
                        <RoundCard
                          key={r._key} round={r} index={i} total={rounds.length} meta={meta}
                          onToggle={() => toggleRound(r._key)}
                          onMove={(dir) => moveRound(r._key, dir)}
                          onRemove={() => removeRound(r._key)}
                          onUpdate={(p) => patchRound(r._key, p)}
                          onDragStart={() => onDragStart(r._key)}
                          onDragOver={() => onDragOver(r._key)}
                          onDrop={onDrop}
                          isDragOver={dragOver === r._key}
                          onAddQ={() => addQ(r._key)}
                          onPatchQ={(qk, p) => patchQ(r._key, qk, p)}
                          onRemoveQ={(qk) => removeQ(r._key, qk)}
                        />
                      ))}
                    </ol>
                  )}

                  {rounds.length === 0 && !showPicker && (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--sa-ink-3)' }}>
                      <div style={{ fontSize: 36, marginBottom: 8 }}>🗂️</div>
                      <p style={{ margin: 0 }}>No rounds yet. Add your first one below.</p>
                    </div>
                  )}

                  {showPicker ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700 }}>Choose a round type</span>
                        <button type="button" className="jr-btn" onClick={() => setShowPicker(false)}>×</button>
                      </div>
                      <div className="jr-type-grid">
                        {ROUND_TYPES.map((t) => (
                          <button key={t} type="button" className="jr-type-card" onClick={() => addRound(t)}>
                            <span className="jr-type-icon">{ROUND_ICONS[t]}</span>
                            <span className="jr-type-name">{ROUND_LABELS[t]}</span>
                            <span className="jr-type-hint">{ROUND_HINTS[t]}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <button type="button" className="jr-add-btn" onClick={() => setShowPicker(true)}>
                      <span style={{ fontSize: 18 }}>＋</span> Add a round
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ══════ STEP 3: Student results ══════ */}
            {step === 3 && (
              <Sec
                title="4 · Student results"
                sub="Students who have completed a test or simulation for your company. Invite promising ones directly to interview."
                badge={visibleStudents.length > 0 ? `${visibleStudents.length} student${visibleStudents.length === 1 ? '' : 's'}` : undefined}
              >
                {/* toolbar */}
                <div className="sr-toolbar">
                  <div className="sr-search-wrap">
                    <span className="sr-search-icon">🔍</span>
                    <input
                      className="sr-search"
                      type="text"
                      placeholder="Search by name, email, college or test…"
                      value={studentSearch}
                      onChange={(ev) => setStudentSearch(ev.target.value)}
                    />
                    {studentSearch && (
                      <button type="button" className="sr-search-clear" onClick={() => setStudentSearch('')}>×</button>
                    )}
                  </div>
                  <div className="sr-filter-tabs">
                    {(['all', 'tests', 'simulations'] as const).map((f) => (
                      <button key={f} type="button"
                        className={`sr-filter-tab ${scoreFilter === f ? 'on' : ''}`}
                        onClick={() => setScoreFilter(f)}>
                        {f === 'all' ? 'All' : f === 'tests' ? '📝 Tests' : '💼 Simulations'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* loading */}
                {!studentsLoaded && <p className="sa-loading">Loading student results…</p>}

                {/* empty states */}
                {studentsLoaded && (students ?? []).length === 0 && (
                  <div className="sr-empty">
                    <div style={{ fontSize: 40 }}>🎓</div>
                    <b>No student results yet</b>
                    <p>Students who complete a test or simulation from your company appear here. Create a simulation or share a test to start seeing results.</p>
                  </div>
                )}

                {studentsLoaded && (students ?? []).length > 0 && visibleStudents.length === 0 && (
                  <div className="sr-empty" style={{ padding: '24px 0' }}>
                    <p style={{ margin: 0 }}>No students match your search.</p>
                  </div>
                )}

                {/* student list */}
                {visibleStudents.length > 0 && (
                  <ul className="sr-list">
                    {visibleStudents.map((s) => {
                      const alreadySent = ivSent.has(s.candidateId);
                      const isOpenInvite = inviting === s.candidateId;
                      return (
                        <li key={s.candidateId} className={`sr-card ${isOpenInvite ? 'is-inviting' : ''}`}>
                          <div className="sr-card-top">
                            {/* avatar */}
                            <div className="sr-avatar">
                              {s.name.charAt(0).toUpperCase()}
                            </div>

                            {/* info */}
                            <div className="sr-info">
                              <div className="sr-name">{s.name}</div>
                              <div className="sr-meta">
                                <span>{s.email}</span>
                                {s.college && <><span className="sr-dot" /><span>{s.college}</span></>}
                                {s.course && <><span className="sr-dot" /><span>{s.course}</span></>}
                                {s.batch && <><span className="sr-dot" /><span>{s.batch}</span></>}
                              </div>
                            </div>

                            {/* test/sim badge + score */}
                            <div className="sr-result">
                              <span className={`sr-kind-badge ${s.kind}`}>
                                {s.kind === 'test' ? '📝 Test' : '💼 Simulation'}
                              </span>
                              <span className="sr-label" title={s.label}>{s.label}</span>
                              {s.score && <span className="sr-score">{s.score}</span>}
                              {s.completedAt && (
                                <span className="sr-date">
                                  {new Date(s.completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                              )}
                            </div>

                            {/* action */}
                            <div className="sr-actions">
                              {alreadySent ? (
                                <span className="sr-sent">✓ Invited</span>
                              ) : isOpenInvite ? (
                                <button type="button" className="sa-btn is-ghost is-small"
                                  onClick={() => setInviting(null)}>Cancel</button>
                              ) : (
                                <button type="button" className="sa-btn is-small"
                                  onClick={() => openInvite(s.candidateId, s.name)}>
                                  Invite to interview
                                </button>
                              )}
                            </div>
                          </div>

                          {/* inline invite form */}
                          {isOpenInvite && (
                            <div className="sr-invite-form">
                              <div className="sr-invite-form-title">
                                Send {s.name} an interview invite
                              </div>

                              <div className="jf-row c2">
                                <Fld label="Interview process">
                                  {ivProcesses === null ? (
                                    <p className="jf-hint">Loading…</p>
                                  ) : ivProcesses.length === 0 ? (
                                    <p className="jf-warn">
                                      No active processes.{' '}
                                      <a href="/company/interviews/new" target="_blank" rel="noreferrer">Create one →</a>
                                    </p>
                                  ) : (
                                    <select value={ivProcessId} onChange={(ev) => setIvProcessId(ev.target.value)}>
                                      <option value="">— choose a process —</option>
                                      {ivProcesses.map((p) => (
                                        <option key={p.id} value={p.id}>
                                          {p.title} ({p.roundCount} round{p.roundCount === 1 ? '' : 's'})
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </Fld>
                                <Fld label="Role">
                                  <input value={ivRole} maxLength={120}
                                    placeholder="e.g. Software Engineer Intern"
                                    onChange={(ev) => setIvRole(ev.target.value)} />
                                </Fld>
                              </div>

                              <Fld label="Message to candidate" hint="optional">
                                <textarea rows={2} value={ivMsg} maxLength={1000}
                                  placeholder="What to expect, when, any preparation…"
                                  onChange={(ev) => setIvMsg(ev.target.value)} />
                              </Fld>

                              {ivError && <p className="jf-warn">{ivError}</p>}

                              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                                <button type="button" className="sa-btn"
                                  disabled={ivSending || !ivProcessId || !ivRole.trim()}
                                  onClick={() => void sendInvite(s.candidateId)}>
                                  {ivSending ? 'Sending…' : 'Send invite'}
                                </button>
                                <button type="button" className="sa-btn is-ghost"
                                  onClick={() => setInviting(null)} disabled={ivSending}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                <p className="jf-hint" style={{ marginTop: 12 }}>
                  This is a view-only step — you can skip it and come back any time from the Jobs list.
                </p>
              </Sec>
            )}

            {/* ══════ STEP 4: Publish ══════ */}
            {step === 4 && (
              <Sec title="5 · Review & publish" sub="Check everything is in order, declare no fee, and go live.">
                {readiness && (
                  <div className="jf-checklist">
                    {readiness.ok
                      ? <div className="jf-check ok"><span className="jf-check-ic">✓</span><span>Everything looks good — ready to publish.</span></div>
                      : readiness.problems.map((p) => (
                        <div key={p} className="jf-check err"><span className="jf-check-ic">✗</span><span>{p}</span></div>
                      ))
                    }
                  </div>
                )}

                {!noFeeDecl ? (
                  <div className="jf-fee">
                    <div className="jf-fee-hd"><span>⚠️</span><b>No-fee declaration required</b></div>
                    <p>Confirm your company charges students nothing at any stage of recruitment. Required to publish on Apli.ai.</p>
                    <button type="button" className="sa-btn" onClick={declareNoFee}>
                      I confirm — we charge no fee to students
                    </button>
                  </div>
                ) : (
                  <div className="jf-check ok" style={{ marginBottom: 16 }}>
                    <span className="jf-check-ic">✓</span>
                    <span>No-fee declaration recorded.</span>
                  </div>
                )}

                {readiness?.ok && noFeeDecl && (
                  <button type="button" className="sa-btn" disabled={saving} onClick={publish}
                    style={{ fontSize: 15, padding: '13px 32px' }}>
                    {saving ? 'Publishing…' : '🚀 Publish role'}
                  </button>
                )}
                {readiness && !readiness.ok && (
                  <p style={{ fontSize: 13, color: 'var(--sa-ink-3)', marginTop: 10 }}>
                    Fix the issues above by going back to the relevant step, then return here to publish.
                  </p>
                )}
              </Sec>
            )}
          </div>

          {/* ── Footer bar ── */}
          <div className="jw-footer-col">
            <div className="jw-footer-bar">
              {savedAt
                ? <span className="jw-footer-hint saved">✓ Saved at {savedAt}</span>
                : jobId
                  ? <span className="jw-footer-hint">Draft · {jobId.slice(0, 8)}…</span>
                  : <span className="jw-footer-hint">Fill in the details above.</span>
              }
              {step > 0 && (
                <button type="button" className="sa-btn is-ghost"
                  onClick={() => { setError(null); setStep((s) => s - 1); }}>
                  ← Back
                </button>
              )}
              {step < 4 && (
                <button type="button" className="sa-btn" disabled={saving} onClick={goNext}>
                  {saving ? 'Saving…' : step === 3 ? 'Continue to Publish →' : 'Save & continue →'}
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </Frame>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   ROUND CARD
═══════════════════════════════════════════════════════════════════════ */
function RoundCard({
  round: r, index: i, total, meta,
  onToggle, onMove, onRemove, onUpdate,
  onDragStart, onDragOver, onDrop, isDragOver,
  onAddQ, onPatchQ, onRemoveQ,
}: {
  round: RoundDraft; index: number; total: number; meta: JobMeta | null;
  onToggle: () => void; onMove: (d: -1|1) => void; onRemove: () => void;
  onUpdate: (p: Partial<RoundDraft>) => void;
  onDragStart: () => void; onDragOver: () => void; onDrop: () => void; isDragOver: boolean;
  onAddQ: () => void;
  onPatchQ: (qk: string, p: Partial<VideoQuestion>) => void;
  onRemoveQ: (qk: string) => void;
}) {
  return (
    <li draggable
      onDragStart={onDragStart}
      onDragOver={(ev) => { ev.preventDefault(); onDragOver(); }}
      onDrop={(ev) => { ev.preventDefault(); onDrop(); }}
      className={`jr-card ${r.open ? 'open' : ''} ${isDragOver ? 'over' : ''}`}
    >
      <div className="jr-hd" onClick={onToggle}>
        <span className="jr-drag" onClick={(ev) => ev.stopPropagation()}>⠿</span>
        <span className="jr-num">{i + 1}</span>
        <span className="jr-type-ico">{ROUND_ICONS[r.type]}</span>
        <div className="jr-sum">
          <div className="jr-sum-title">{r.name || ROUND_LABELS[r.type]}</div>
          <div className="jr-sum-sub">
            <span>{ROUND_LABELS[r.type]}</span>
            {r.durationMin && <><span className="jr-dot" /><span>{r.durationMin} min</span></>}
            {r.isElimination && <><span className="jr-dot" /><span className="jr-badge elim">Eliminating</span></>}
            {r.isOnline && <><span className="jr-dot" /><span className="jr-badge online">Online</span></>}
            {r.type === 'VIDEO_INTERVIEW' && <><span className="jr-dot" /><span className="jr-badge vid">🎥 {r.questions.length}Q</span></>}
          </div>
        </div>
        <div className="jr-tools" onClick={(ev) => ev.stopPropagation()}>
          <button className="jr-btn" title="Move up" disabled={i === 0} onClick={() => onMove(-1)}>↑</button>
          <button className="jr-btn" title="Move down" disabled={i === total - 1} onClick={() => onMove(1)}>↓</button>
          <button className="jr-btn del" title="Remove" onClick={onRemove}>×</button>
        </div>
        <span className="jr-chev">▼</span>
      </div>

      {r.open && (
        <div className="jr-body">
          <div className="jr-row c2" style={{ paddingTop: 12 }}>
            <Fld label="Round name">
              <input value={r.name} maxLength={80} placeholder={ROUND_LABELS[r.type]}
                onChange={(ev) => onUpdate({ name: ev.target.value })} />
            </Fld>
            <Fld label="Round type">
              <select value={r.type} onChange={(ev) => onUpdate({
                type: ev.target.value as RoundType,
                isOnline: ev.target.value === 'MCQ_TEST' || ev.target.value === 'VIDEO_INTERVIEW',
                questions: ev.target.value === 'VIDEO_INTERVIEW' && r.questions.length === 0
                  ? [{ _key: uid(), text: 'Tell us about yourself.', hint: '', type: 'intro' }]
                  : r.questions,
              })}>
                {ROUND_TYPES.map((t) => <option key={t} value={t}>{ROUND_ICONS[t]} {ROUND_LABELS[t]}</option>)}
              </select>
            </Fld>
          </div>

          <Fld label="What this round involves" hint="Shown to candidates so they know how to prepare. Optional.">
            <textarea rows={2} value={r.description} maxLength={400}
              placeholder={ROUND_HINTS[r.type]}
              onChange={(ev) => onUpdate({ description: ev.target.value })} />
          </Fld>

          <div className="jr-row c3">
            <Fld label="Duration" hint="optional">
              <div className="jf-unit">
                <input type="number" min={5} max={480} value={r.durationMin} placeholder="60"
                  onChange={(ev) => onUpdate({ durationMin: ev.target.value })} />
                <span>min</span>
              </div>
            </Fld>
            <Fld label="Shortlist target" hint="optional">
              <input type="number" min={1} value={r.shortlistCount} placeholder="How many pass"
                onChange={(ev) => onUpdate({ shortlistCount: ev.target.value })} />
            </Fld>
            <Fld label="Mode">
              <select value={r.mode} onChange={(ev) => onUpdate({ mode: ev.target.value })}>
                <option value="">Not specified</option>
                {(meta?.options?.ROUND_MODE ?? []).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Fld>
          </div>

          <div>
            <div className="jr-loc-tabs">
              <button type="button" className={`jr-loc-tab ${!r.isOnline ? 'on' : ''}`} onClick={() => onUpdate({ isOnline: false })}>📍 In-person</button>
              <button type="button" className={`jr-loc-tab ${r.isOnline ? 'on' : ''}`} onClick={() => onUpdate({ isOnline: true })}>🌐 Online</button>
            </div>
            {r.isOnline ? (
              <Fld label="Meeting link" hint="optional">
                <input type="url" value={r.meetingLink} placeholder="https://meet.google.com/…"
                  onChange={(ev) => onUpdate({ meetingLink: ev.target.value })} />
              </Fld>
            ) : (
              <div className="jr-row c2">
                <Fld label="Venue / address" hint="optional">
                  <input value={r.addressLine} placeholder="Hall or address"
                    onChange={(ev) => onUpdate({ addressLine: ev.target.value })} />
                </Fld>
                <Fld label="Scheduled date & time" hint="optional">
                  <input type="datetime-local" value={r.scheduledAt}
                    onChange={(ev) => onUpdate({ scheduledAt: ev.target.value })} />
                </Fld>
              </div>
            )}
          </div>

          <button type="button" className={`jr-elim ${r.isElimination ? 'on' : ''}`}
            onClick={() => onUpdate({ isElimination: !r.isElimination })}>
            <span className="jr-elim-box">{r.isElimination ? '✓' : ''}</span>
            <div>
              <b>Eliminating round</b>
              <span>{r.isElimination
                ? 'Only candidates who pass this round continue to the next.'
                : 'All candidates proceed — mark as eliminating to gate the next round.'}</span>
            </div>
          </button>

          {r.type === 'VIDEO_INTERVIEW' && (
            <div className="jr-vid">
              <div className="jr-vid-hd">
                <div className="jr-vid-ico">🎥</div>
                <div>
                  <b>Recorded video interview questions</b>
                  <em>Candidates read, prepare, then record each answer on camera.</em>
                </div>
              </div>
              <div className="jr-vid-body">
                <div className="jr-vid-times">
                  <div className="jr-vid-timer">
                    <span className="jr-vid-t-ico">⏱</span>
                    <div>
                      <div className="jr-vid-t-lbl">Prep time per question</div>
                      <div className="jr-vid-t-row">
                        <input type="number" min={10} max={300} value={r.prepTimeSec}
                          onChange={(ev) => onUpdate({ prepTimeSec: Number(ev.target.value) || 30 })} />
                        <span className="jr-vid-t-unit">sec</span>
                      </div>
                    </div>
                  </div>
                  <div className="jr-vid-timer">
                    <span className="jr-vid-t-ico">🔴</span>
                    <div>
                      <div className="jr-vid-t-lbl">Recording time per question</div>
                      <div className="jr-vid-t-row">
                        <input type="number" min={10} max={600} value={r.answerTimeSec}
                          onChange={(ev) => onUpdate({ answerTimeSec: Number(ev.target.value) || 60 })} />
                        <span className="jr-vid-t-unit">sec</span>
                      </div>
                    </div>
                  </div>
                </div>

                <hr className="jf-divider" />

                <div className="jr-qs-head">
                  <b>Questions</b>
                  <span className="jr-qs-count">{r.questions.length} question{r.questions.length === 1 ? '' : 's'}</span>
                </div>

                {r.questions.length === 0 && (
                  <p style={{ fontSize: 13, color: 'var(--sa-ink-3)', margin: 0 }}>No questions yet. Add at least one.</p>
                )}

                <ul className="jr-qs-list">
                  {r.questions.map((q, qi) => (
                    <li key={q._key} className="jr-q">
                      <span className="jr-q-num">{qi + 1}</span>
                      <div className="jr-q-fields">
                        <input value={q.text} maxLength={600}
                          placeholder="Enter the interview question the candidate will see…"
                          onChange={(ev) => onPatchQ(q._key, { text: ev.target.value })} />
                        <div className="jr-q-row2">
                          <input value={q.hint} maxLength={400}
                            placeholder="Optional hint shown before recording"
                            onChange={(ev) => onPatchQ(q._key, { hint: ev.target.value })} />
                          <select value={q.type} onChange={(ev) => onPatchQ(q._key, { type: ev.target.value })}>
                            {Q_TYPES.map((qt) => <option key={qt.value} value={qt.value}>{qt.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <button type="button" className="jr-q-del" onClick={() => onRemoveQ(q._key)}>×</button>
                    </li>
                  ))}
                </ul>

                <button type="button" className="jr-add-q" onClick={onAddQ}>
                  <span>＋</span> Add a question
                </button>

                <p className="jr-vid-note">
                  🕐 Candidate gets <strong>{r.prepTimeSec}s</strong> to prepare, then <strong>{r.answerTimeSec}s</strong> to record. Answers cannot be re-done. You review all videos after submission.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SHARED MICRO COMPONENTS
═══════════════════════════════════════════════════════════════════════ */
function Sec({ title, sub, badge, children }: { title: string; sub: string; badge?: string; children: ReactNode }) {
  return (
    <div className="jf-section">
      <div className="jf-section-head">
        <div><h2>{title}</h2><p>{sub}</p></div>
        {badge && <span className="jf-section-badge">{badge}</span>}
      </div>
      <div className="jf-section-body">{children}</div>
    </div>
  );
}

function Fld({ label, req, hint, ferr, children }: {
  label: string; req?: boolean; hint?: string; ferr?: string | null; children: ReactNode;
}) {
  return (
    <div className={`jf-field ${ferr ? 'has-field-err' : ''}`}>
      {label && label.trim() && (
        <span className="jf-label">
          {label}
          {req && <span className="rq">*</span>}
          {hint && <i>{hint}</i>}
        </span>
      )}
      {children}
      {ferr && <span className="jf-field-err-msg">{ferr}</span>}
    </div>
  );
}

function Tog({ on, onTog, title, sub }: { on: boolean; onTog: () => void; title: string; sub: string }) {
  return (
    <button type="button" className={`jf-toggle ${on ? 'on' : ''}`} onClick={onTog}>
      <span className="jf-toggle-box">{on ? '✓' : ''}</span>
      <div className="jf-toggle-text"><b>{title}</b><span>{sub}</span></div>
    </button>
  );
}
