import { useLoopingSteps } from '../lib/useReveal';

/**
 * Animates the decision that separates this product from a job board:
 * a company publishes, the posting waits at the college, the placement
 * officer accepts it, and only then do eligible students see it.
 */
export default function ApprovalGate() {
  // 0 draft · 1 published, pending · 2 accepted · 3 visible to students
  const step = useLoopingSteps(4, 1900, 2600);

  const gateState = step === 0 ? 'idle' : step === 1 ? 'pending' : 'accepted';

  return (
    <div className="gate" aria-label="How a job reaches students">
      <div className="gate-track">
        {/* Company */}
        <div className={`gate-node ${step >= 0 ? 'is-on' : ''}`}>
          <p className="gate-node-label">Company</p>
          <div className="gate-card">
            <p className="gate-card-title">Software Engineer</p>
            <p className="gate-card-meta">Zenith Labs &middot; 4 rounds</p>
            <span className={`pill ${step === 0 ? 'pill-idle' : 'pill-pass'}`}>
              {step === 0 ? 'Draft' : 'Published'}
            </span>
          </div>
        </div>

        <Connector active={step >= 1} />

        {/* The gate */}
        <div className={`gate-node gate-node-decision is-${gateState}`}>
          <p className="gate-node-label">Placement cell</p>
          <div className="gate-card gate-card-decision">
            <p className="gate-card-title">Approval queue</p>
            <p className="gate-card-meta">Ramrao Adik Institute</p>
            <span
              className={`pill ${
                gateState === 'accepted'
                  ? 'pill-pass'
                  : gateState === 'pending'
                    ? 'pill-hold'
                    : 'pill-idle'
              }`}
            >
              {gateState === 'accepted' ? 'Accepted' : gateState === 'pending' ? 'Pending' : 'Empty'}
            </span>
          </div>
        </div>

        <Connector active={step >= 3} />

        {/* Students */}
        <div className={`gate-node ${step >= 3 ? 'is-on' : ''}`}>
          <p className="gate-node-label">Students</p>
          <div className="gate-card gate-card-students">
            <div className="gate-avatars" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className={`gate-avatar ${step >= 3 ? 'is-lit' : ''}`}
                  style={{ transitionDelay: `${i * 70}ms` }}
                />
              ))}
            </div>
            <p className="gate-card-title">{step >= 3 ? '238 eligible' : 'Nothing yet'}</p>
            <p className="gate-card-meta">
              {step >= 3 ? 'Batch matched, records frozen' : 'No job visible'}
            </p>
          </div>
        </div>
      </div>

      <p className="gate-caption" aria-live="polite">
        {step === 0 && 'A recruiter builds the role and its rounds.'}
        {step === 1 && 'Publishing sends it to each targeted college as a pending request.'}
        {step === 2 && 'The placement officer accepts it — or declines it, with a reason.'}
        {step === 3 && 'Only now is it visible, and only to students who actually qualify.'}
      </p>
    </div>
  );
}

function Connector({ active }: { active: boolean }) {
  return (
    <div className={`gate-connector ${active ? 'is-active' : ''}`} aria-hidden="true">
      <span className="gate-connector-line" />
      <span className="gate-connector-dot" />
    </div>
  );
}
