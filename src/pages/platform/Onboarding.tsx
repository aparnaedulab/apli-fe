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
import Preview, { type PreviewModel } from './Preview';
import { SavedAgo } from './ui';
import IdentityStep from './steps/IdentityStep';
import AcademicsStep from './steps/AcademicsStep';
import CollegesStep from './steps/CollegesStep';
import BatchesStep from './steps/BatchesStep';
import MappingStep from './steps/MappingStep';
import FeaturesStep from './steps/FeaturesStep';
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
  setPreview: (p: Partial<PreviewModel>) => void;
  /** For a step that adds to the shared lists, e.g. a new course. */
  updateCatalogue: (fn: (c: Catalogue) => Catalogue) => void;
}

interface StepMeta {
  key: StepKey;
  title: string;
  /** Said once, at the top of the step: what this is for, in a sentence. */
  lede: string;
}

export const STEPS: StepMeta[] = [
  {
    key: 'identity',
    title: 'Who they are',
    lede: 'The university’s name, its address on the platform, and how its portal looks.',
  },
  {
    key: 'academics',
    title: 'What they teach',
    lede: 'The courses and branches they run, and their placement rules. Every roster and job reads from this.',
  },
  {
    key: 'colleges',
    title: 'Where they teach',
    lede: 'Every college in the university, with its details and who runs its placement cell.',
  },
  {
    key: 'mapping',
    title: 'Map courses to colleges',
    lede: 'Which college runs which of the courses and branches above - and, once students are on the roster, which student is in which.',
  },
  {
    key: 'batches',
    title: 'Their batches',
    lede: 'Group students the way this university does - “2026 Batch” for everyone, or “B.Tech 2026” in each college.',
  },
  {
    key: 'features',
    title: 'What they get',
    lede: 'Start from a plan, then switch individual modules on or off.',
  },
  {
    key: 'people',
    title: 'Who runs it',
    lede: 'Invite the people who will run this university’s portal day to day.',
  },
  {
    key: 'review',
    title: 'Go live',
    lede: 'Check everything is in place, then open the portal to its people.',
  },
];

const EMPTY_PREVIEW: PreviewModel = {
  name: '',
  shortName: '',
  brandColor: '#1d3b8b',
  logoUrl: '',
  faviconUrl: '',
  kind: 'UNIVERSITY' as TenantKind,
  modules: [],
  colleges: 0,
  tagline: '',
};

/**
 * The onboarding wizard.
 *
 * Three columns: the journey on the left, the step in the middle, and on the
 * right the portal as the institution will see it, repainting as you type.
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
  const [preview, setPreviewState] = useState<PreviewModel>(EMPTY_PREVIEW);
  const [showPreview, setShowPreview] = useState(false);

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

  // The preview follows what is saved, and steps overlay what is being typed.
  useEffect(() => {
    if (!state) return;
    const t = state.tenant;
    setPreviewState({
      name: t.name,
      shortName: t.shortName ?? '',
      brandColor: t.brandColor,
      logoUrl: t.logoUrl ?? '',
      faviconUrl: t.faviconUrl ?? '',
      kind: t.kind,
      tagline: t.tagline ?? '',
      modules: state.modules,
      colleges: state.colleges.length,
    });
  }, [state]);

  const setPreview = useCallback((p: Partial<PreviewModel>) => {
    setPreviewState((prev) => ({ ...prev, ...p }));
  }, []);

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
    ? { state, catalogue: catalogue!, onSaved, goto, setPreview, updateCatalogue }
    : null;

  return (
    <div className={`ob ${showPreview ? 'show-preview' : ''}`}>
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
              <button type="button" className="btn btn-ghost ob-preview-toggle" onClick={() => setShowPreview((v) => !v)}>
                {showPreview ? 'Hide preview' : 'Preview'}
              </button>
              <Link to="/platform" className="btn btn-ghost">
                Exit
              </Link>
            </div>
          </div>
          <h1>{meta.title}</h1>
          <p className="ob-lede">{meta.lede}</p>
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
            {step === 'features' && <FeaturesStep {...stepProps} />}
            {step === 'people' && <PeopleStep {...stepProps} />}
            {step === 'review' && <ReviewStep {...stepProps} />}
          </div>
        )}
      </main>

      <aside className="ob-preview" aria-label="Preview of the university’s portal">
        <Preview model={preview} catalogue={catalogue} />
      </aside>
    </div>
  );
}
