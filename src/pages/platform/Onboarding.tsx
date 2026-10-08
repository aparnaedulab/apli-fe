import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import {
  platformApi,
  type Catalogue,
  type OnboardingState,
  type StepKey,
  type TenantKind,
} from '../../api/platform';
import { SavedAgo } from './ui';
import IdentityStep from './steps/IdentityStep';
import AcademicsStep from './steps/AcademicsStep';
import CollegesStep from './steps/CollegesStep';
import BatchesStep from './steps/BatchesStep';
import StudentsStep from './steps/StudentsStep';
import MappingStep from './steps/MappingStep';
import FeaturesStep from './steps/FeaturesStep';
import HelpStep from './steps/HelpStep';
import PeopleStep from './steps/PeopleStep';
import ReviewStep from './steps/ReviewStep';
import './Platform.css';
import '../../components/MapData.css';

export interface StepProps {
  /** Null only while creating: the identity step before a tenant exists. */
  state: OnboardingState | null;
  catalogue: Catalogue;
  onSaved: (next: OnboardingState, goTo?: StepKey) => void;
  goto: (step: StepKey) => void;
  /** For a step that adds to the shared lists, e.g. a new course. */
  updateCatalogue: (fn: (c: Catalogue) => Catalogue) => void;
}

interface StepMeta {
  key: StepKey;
  title: string;
  /** Said once, at the top of the step: what this is for, in a sentence. */
  lede: string;
  /**
   * What to actually do, in order.
   *
   * Onboarding is done a handful of times a year by somebody who has not
   * done it recently, against an institution whose answers they are reading
   * off an email. A sentence explaining the step is not enough on its own -
   * the question is always "so what do I type". These are that.
   */
  todo: string[];
  /** The one thing worth knowing that is not an instruction. */
  note?: string;
}

export const STEPS: StepMeta[] = [
  {
    key: 'identity',
    title: 'Who they are',
    lede: 'The university’s name, its address on the platform, and how its portal looks.',
    todo: [
      'Name it as students and recruiters should see it.',
      'Pick its web address. It ends up in bookmarks and on printed posters, so it is not meant to change later.',
      'Add the person we deal with at the institution.',
    ],
    note: 'That contact is not a login. The people who sign in are invited at “Who runs it”.',
  },
  {
    key: 'academics',
    title: 'What they teach',
    lede: 'The courses and branches they run.',
    todo: [
      'Tick every course this university runs - search to find one, or tick all from the header. A ticked course runs all its branches.',
      'If it runs only some branches of a course, click “Choose branches” in its row.',
      'A course missing from the list? Use “New course”, or upload a list from Excel.',
    ],
    note: 'Colleges pick only from this list, so every college spells B.E. — Computer Engineering the same way.',
  },
  {
    key: 'colleges',
    title: 'Where they teach',
    lede: 'Every college in the university, with its details and who runs its placement cell.',
    todo: [
      'Add each college with a short code — PICT, COEP. The code is unique across the whole platform.',
      'Give each one a placement officer’s email address.',
      'Set the passing years. One batch per year is created in each college.',
    ],
    note: 'Each officer is sent an invitation the moment you save. Saving the same list again sends nothing twice.',
  },
  {
    key: 'mapping',
    title: 'Map courses to colleges',
    lede: 'Which college runs which of the courses and branches above.',
    todo: [
      'Click a college in the table - “Not mapped” shows the ones still to do.',
      'In the panel, tick the course-and-branch pairs it runs, add seats if known, and save.',
    ],
    note: 'Optional — a college can do its own once it signs in. But a roster uploaded before this is done lands unmapped, and an unmapped student is invisible to every role that filters on a course.',
  },
  {
    key: 'batches',
    title: 'Their batches',
    lede: 'Group students the way this university does.',
    todo: [
      'Click “Create from mapping”, pick the passing years, and create - one batch per college, course, branch and year.',
      'For any other group, use “Make one by hand”. Filter the table by college or year to check what exists.',
    ],
    note: 'Optional — placement cells can create their own later.',
  },
  {
    key: 'students',
    title: 'Student details',
    lede: 'What this university records about a student, and who may put one on the roster.',
    todo: [
      'Mark each detail Not collected, Optional or Required.',
      'Say who adds students: the university, its colleges, or the students themselves.',
      'If students may register, tick what the registration form asks them.',
    ],
    note: 'Optional. Left alone, this university gets what every institution got before there was a choice: name, email and mobile required, and both the university and its colleges able to add.',
  },
  {
    key: 'features',
    title: 'What they get',
    lede: 'Start from a plan, then switch individual modules on or off.',
    todo: [
      'Pick the plan closest to what they bought.',
      'Switch individual modules on or off from there.',
    ],
    note: 'Some modules need others to work. Anything pulled in is listed when you save.',
  },
  {
    key: 'help',
    title: 'Student help',
    lede: 'The questions and answers students see in the help panel on every page.',
    todo: [
      'Start from the standard questions - keep, reword or hide each one.',
      'Add the questions your students actually ask, such as when the season starts.',
    ],
    note: 'Optional. Until this is saved, students see the standard questions.',
  },
  {
    key: 'people',
    title: 'Who runs it',
    lede: 'Invite the people who will run this university’s portal day to day.',
    todo: [
      'Invite at least one institution admin — usually the placement head or a registrar.',
      'Choose whether we email the invitation or you copy the link and send it yourself.',
    ],
    note: 'Placement officers for each college were already invited at “Where they teach”. These are the people who run the university’s own console.',
  },
  {
    key: 'review',
    title: 'Go live',
    lede: 'Check everything is in place, then open the portal to its people.',
    todo: [
      'Work down the list. Anything marked required has to be done before you can launch.',
      'Launch. The portal becomes reachable straight away, and the invitations you sent start working.',
    ],
  },
];

/** Where the "what to do here" preference is kept. */
const GUIDE_KEY = 'apli.onboarding.guide';

/**
 * The onboarding wizard.
 *
 * Two columns: the journey on the left and the step beside it. There was a
 * third - a live repaint of the institution's portal - and it cost a third
 * of the screen for something nobody was doing this job to look at. Its
 * absence is what lets everything else have room.
 *
 * Steps can be visited in any order - the rail shows which are done and what
 * each holds - but "Save & continue" always walks forward, so somebody who
 * simply follows the button never has to think about where to go next.
 */
export default function Onboarding() {
  const { id, step: stepParam } = useParams();
  const navigate = useNavigate();

  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const step: StepKey = !id
    ? 'identity'
    : STEPS.some((s) => s.key === stepParam)
      ? (stepParam as StepKey)
      : 'identity';

  useEffect(() => {
    platformApi
      .catalogue()
      .then(setCatalogue)
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : 'Could not load the catalogue.'));
  }, []);

  useEffect(() => {
    if (!id) {
      setState(null);
      return;
    }
    platformApi
      .state(id)
      .then((s) => {
        setState(s);
        // No step in the URL: resume at the first one not yet done.
        if (!stepParam) {
          const next = STEPS.find((m) => !s.tenant.completedSteps.includes(m.key))?.key ?? 'review';
          navigate(`/platform/tenants/${id}/${next}`, { replace: true });
        }
      })
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : 'Could not load this university.'));
    // stepParam is read only to decide the first landing; re-running on every
    // step change would refetch for nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const updateCatalogue = useCallback((fn: (c: Catalogue) => Catalogue) => {
    setCatalogue((c) => (c ? fn(c) : c));
  }, []);

  const goto = useCallback(
    (key: StepKey) => {
      if (!id) return;
      navigate(`/platform/tenants/${id}/${key}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [id, navigate],
  );

  const onSaved = useCallback(
    (next: OnboardingState, goTo?: StepKey) => {
      setState(next);
      setSavedAt(Date.now());
      if (goTo) {
        navigate(`/platform/tenants/${next.tenant.id}/${goTo}`, { replace: !id });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [id, navigate],
  );

  /*
   * Whether the instructions are open, remembered across steps and visits.
   * Open the first time somebody ever sees this, because that is who needs
   * them; closed thereafter if they closed it.
   */
  const [guide, setGuide] = useState(() => {
    try {
      return window.localStorage.getItem(GUIDE_KEY) !== 'shut';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(GUIDE_KEY, guide ? 'open' : 'shut');
    } catch {
      /* a browser that refuses storage still gets the default */
    }
  }, [guide]);

  const meta = STEPS.find((s) => s.key === step)!;
  const index = STEPS.indexOf(meta);
  const done = new Set(state?.tenant.completedSteps ?? []);
  const summaries = useMemo(() => {
    const map = new Map<StepKey, string>();
    state?.checklist.forEach((c) => c.done && map.set(c.step, c.detail));
    return map;
  }, [state]);

  if (loadError) {
    return (
      <main className="status-page">
        <p className="eyebrow">Onboarding</p>
        <h1>Something went wrong.</h1>
        <p className="status-lede">{loadError}</p>
        <p className="status-back">
          <Link to="/platform">← Back to universities</Link>
        </p>
      </main>
    );
  }

  const ready = catalogue && (!id || state);
  const stepProps: StepProps | null = ready
    ? { state, catalogue: catalogue!, onSaved, goto, updateCatalogue }
    : null;

  return (
    <div className="ob">
      <aside className="ob-rail">
        <Link to="/platform" className="ob-home">
          <span className="brand-mark" aria-hidden="true" />
          <span>
            <strong>Launchpad</strong>
            <small>Institution onboarding</small>
          </span>
        </Link>

        <ol className="ob-steps">
          {STEPS.map((s, i) => {
            const isDone = done.has(s.key);
            const isCurrent = s.key === step;
            const reachable = Boolean(id);
            return (
              <li key={s.key} className={`ob-step ${isCurrent ? 'is-current' : ''} ${isDone ? 'is-done' : ''}`}>
                <button
                  type="button"
                  onClick={() => goto(s.key)}
                  disabled={!reachable}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <span className="ob-step-dot" aria-hidden="true">
                    {isDone && !isCurrent ? (
                      <svg viewBox="0 0 16 16">
                        <path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="ob-step-text">
                    <span className="ob-step-title">{s.title}</span>
                    <span className="ob-step-sum">
                      {summaries.get(s.key) ?? (isCurrent ? 'In progress' : reachable ? 'Not started' : 'After step one')}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="ob-progress" aria-label={`${done.size} of ${STEPS.length} steps done`}>
          <div className="ob-progress-bar">
            <span style={{ width: `${(done.size / STEPS.length) * 100}%` }} />
          </div>
          <p>
            {done.size} of {STEPS.length} done
            {state?.tenant.status === 'ACTIVE' && <span className="pill pill-pass">Live</span>}
          </p>
        </div>
      </aside>

      <main className="ob-main">
        <header className="ob-head">
          <div className="ob-head-top">
            <p className="eyebrow">
              Step {index + 1} of {STEPS.length}
              {state && <span className="ob-head-tenant"> · {state.tenant.shortName || state.tenant.name}</span>}
            </p>
            <div className="ob-head-tools">
              <SavedAgo at={savedAt} />
              <Link to="/platform" className="btn btn-ghost">
                Exit
              </Link>
            </div>
          </div>
          <h1>{meta.title}</h1>
          <p className="ob-lede">{meta.lede}</p>

          {/*
            What to actually do, in order.

            Onboarding happens a handful of times a year, by somebody who
            has not done it recently, reading an institution's answers off
            an email. "What is this step for" is not the question they have
            - "so what do I type" is. Shown by default for that reason, and
            foldable because the third time through it is in the way.
          */}
          <div className={`ob-guide ${guide ? '' : 'is-shut'}`}>
            <button
              type="button"
              className="ob-guide-tag"
              onClick={() => setGuide((v) => !v)}
              aria-expanded={guide}
            >
              What to do here
            </button>

            {guide && (
              <>
                <ol>
                  {meta.todo.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ol>
                {meta.note && <p className="ob-guide-note">{meta.note}</p>}
              </>
            )}
          </div>
        </header>

        {!stepProps ? (
          <div className="ob-loading" role="status">
            <span className="spinner" aria-hidden="true" /> Loading…
          </div>
        ) : (
          <div className="ob-body" key={step}>
            {step === 'identity' && <IdentityStep {...stepProps} />}
            {step === 'academics' && <AcademicsStep {...stepProps} />}
            {step === 'colleges' && <CollegesStep {...stepProps} />}
            {step === 'mapping' && <MappingStep {...stepProps} />}
            {step === 'batches' && <BatchesStep {...stepProps} />}
            {step === 'students' && <StudentsStep {...stepProps} />}
            {step === 'features' && <FeaturesStep {...stepProps} />}
            {step === 'help' && <HelpStep {...stepProps} />}
            {step === 'people' && <PeopleStep {...stepProps} />}
            {step === 'review' && <ReviewStep {...stepProps} />}
          </div>
        )}
      </main>
    </div>
  );
}
