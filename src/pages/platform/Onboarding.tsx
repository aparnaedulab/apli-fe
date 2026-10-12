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
import SimpleCoursesStep from './steps/SimpleCoursesStep';
import SimpleCollegesStep from './steps/SimpleCollegesStep';
import FeaturesPending from './steps/FeaturesPending';
import InterestsStep from './steps/InterestsStep';
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
    title: 'University details',
    lede: 'The university’s name, its address on the platform, and how its portal looks.',
    todo: [
      'Name it as students and recruiters should see it.',
      'Pick its web address. It ends up in bookmarks and on printed posters, so it is not meant to change later.',
      'Add the person we deal with at the university.',
    ],
    note: 'That contact is not a login.',
  },
  {
    key: 'colleges',
    title: 'Colleges',
    lede: 'Every college under the university.',
    todo: [
      'Type the college’s name - a short code is suggested from it - and its city, then Add.',
      'Many colleges? Use “Paste many”: one per line, name, code, city.',
    ],
  },
  {
    key: 'academics',
    title: 'Courses',
    lede: 'The courses the university runs.',
    todo: ['Type a course and pick it from the list, or type a new one and press Add.', 'Save when the list is complete.'],
    note: 'Students choose their course from this list when they sign up.',
  },
  {
    key: 'interests',
    title: 'Skills & interests',
    lede: 'The fields of work students say they want to try.',
    todo: ['Type a field, for example Marketing or Data, and press Add.', 'Remove any that do not fit with ×.'],
    note: 'One list for every university. Students pick up to three at sign-up.',
  },
  {
    key: 'features',
    title: 'Features',
    lede: 'What the university switches on, one tab per group of people.',
    todo: ['Students: choose whether a new student gets a welcome email.', 'More tabs arrive as the rest is decided.'],
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
          const finished = new Set([...s.tenant.completedSteps, ...s.checklist.filter((c) => c.done).map((c) => c.step)]);
          const next = STEPS.find((m) => !finished.has(m.key))?.key ?? 'features';
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
  // What the server recorded, plus what the checklist can see is done - a
  // college added on its own does not mark its step.
  const done = new Set<StepKey>([
    ...(state?.tenant.completedSteps ?? []),
    ...(state?.checklist.filter((c) => c.done).map((c) => c.step) ?? []),
  ]);
  for (const k of [...done]) if (!STEPS.some((s) => s.key === k)) done.delete(k);
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
            <small>University onboarding</small>
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
            {step === 'academics' && <SimpleCoursesStep {...stepProps} />}
            {step === 'colleges' && <SimpleCollegesStep {...stepProps} />}
            {step === 'interests' && <InterestsStep {...stepProps} />}
            {step === 'features' && <FeaturesPending {...stepProps} />}
          </div>
        )}
      </main>
    </div>
  );
}
