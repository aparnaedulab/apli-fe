import { useLoopingSteps } from '../lib/useReveal';

const ROUNDS = [
  { name: 'Resume screen', note: 'Auto-checked against eligibility' },
  { name: 'Online test', note: 'Scored out of 100' },
  { name: 'Technical interview', note: 'Panel of two' },
  { name: 'Offer', note: 'Letter attached' },
] as const;

/** What the application header reads at each step of the loop. */
const STAGE_LABEL = ['Applied', 'In round 1', 'In round 2', 'In round 3', 'Offered'] as const;

const TOAST = [
  null,
  'Resume screen cleared',
  'Test score recorded: 82',
  'Interview passed',
  'Offer sent to Ananya',
] as const;

/**
 * The hero demo. Runs one candidate through a job's rounds on a loop so a
 * visitor sees the product working within a few seconds of arriving.
 *
 * Sample data - not a real candidate.
 */
export default function LivePipeline() {
  const step = useLoopingSteps(5, 1600, 2800);
  const toast = TOAST[step];

  return (
    <aside className="pipeline" aria-label="Example: a candidate moving through hiring rounds">
      <div className="pipeline-head">
        <div>
          <p className="pipeline-role">Software Engineer</p>
          <p className="pipeline-org">Zenith Labs &middot; 2026 Final Placements</p>
        </div>
        <span className={`pill ${step === 4 ? 'pill-pass' : 'pill-hold'}`}>{STAGE_LABEL[step]}</span>
      </div>

      <div className="pipeline-progress" aria-hidden="true">
        <span className="pipeline-progress-fill" style={{ width: `${(step / 4) * 100}%` }} />
      </div>

      <ol className="pipeline-rounds">
        {ROUNDS.map((round, i) => {
          const state = i < step ? 'pass' : i === step ? 'active' : 'idle';
          return (
            <li key={round.name} className={`pipeline-round is-${state}`}>
              <span className="round-index" aria-hidden="true">
                {state === 'pass' ? <Tick /> : i + 1}
              </span>
              <span className="round-body">
                <span className="round-name">{round.name}</span>
                <span className="round-note">{round.note}</span>
              </span>
              <span
                className={`pill ${
                  state === 'pass' ? 'pill-pass' : state === 'active' ? 'pill-hold' : 'pill-idle'
                }`}
              >
                {state === 'pass' ? 'Passed' : state === 'active' ? 'In progress' : 'Waiting'}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="pipeline-toast-slot" aria-live="polite">
        {toast && (
          <p key={step} className="pipeline-toast">
            <BellIcon />
            {toast}
          </p>
        )}
      </div>
    </aside>
  );
}

function Tick() {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
      <path
        d="M2.5 8.5 L6 12 L13.5 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
      <path
        d="M8 2a3.5 3.5 0 0 0-3.5 3.5c0 3-1.2 4-1.2 4h9.4s-1.2-1-1.2-4A3.5 3.5 0 0 0 8 2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M6.6 12a1.5 1.5 0 0 0 2.8 0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
