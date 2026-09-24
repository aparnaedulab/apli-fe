import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from './StudentLayout';
import { ApiError } from '../../api/client';
import { practiceApi, type ReadinessView } from '../../api/practice';
import { useAuth } from '../../auth/AuthContext';
import './Readiness.css';

const SCALE = [
  { v: 1, label: 'Not yet' },
  { v: 2, label: 'A little' },
  { v: 3, label: 'Somewhat' },
  { v: 4, label: 'Mostly' },
  { v: 5, label: 'Very much' },
];

const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * Where a student stands, and what to do this week.
 *
 * The score is theirs alone: measured against their own last check, never
 * against classmates. The plan is two areas and four concrete things, each a
 * link to the screen that does it - a plan that says "improve communication"
 * and stops there is a plan nobody follows.
 */
export default function Readiness() {
  const { hasModule } = useAuth();
  const enabled = hasModule('dev.readiness');
  const [view, setView] = useState<ReadinessView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    practiceApi
      .readiness()
      .then((v) => {
        setView(v);
        if (!v.latest) setChecking(true);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load your readiness.'));
  }, [enabled]);

  if (!enabled) {
    return (
      <StudentLayout>
        <header className="page-head">
          <div>
            <p className="eyebrow">Readiness</p>
            <h1>Your readiness</h1>
            <p className="page-lede">Your institution has not switched on the readiness plan yet.</p>
          </div>
        </header>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Readiness</p>
          <h1>{checking ? 'A two-minute check' : 'Where you stand'}</h1>
          <p className="page-lede">
            {checking
              ? 'Answer honestly - this is only for you. Nobody else sees your answers, and you are only ever compared with yourself.'
              : 'Your own progress, and what would help most this week.'}
          </p>
        </div>
        {view?.latest && !checking && (
          <button type="button" className="btn btn-secondary" onClick={() => setChecking(true)}>
            Retake the check
          </button>
        )}
      </header>

      {error && <p className="alert alert-error">{error}</p>}
      {!view && !error && <p className="muted">Loading…</p>}

      {view && checking && (
        <Check
          view={view}
          onCancel={view.latest ? () => setChecking(false) : undefined}
          onSaved={(v) => {
            setView(v);
            setChecking(false);
          }}
        />
      )}

      {view && !checking && view.latest && <Summary view={view} />}
    </StudentLayout>
  );
}

/* -------------------------------------------------------------------------- */
/* The check                                                                   */
/* -------------------------------------------------------------------------- */

function Check({
  view,
  onCancel,
  onSaved,
}: {
  view: ReadinessView;
  onCancel?: () => void;
  onSaved: (v: ReadinessView) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = Object.keys(answers).length;
  const total = view.questions.length;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      onSaved(await practiceApi.submitCheck(answers));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save your answers.');
      setBusy(false);
    }
  }

  return (
    <div className="rd-check">
      <div className="rd-progress" aria-label={`${done} of ${total} answered`}>
        <span style={{ width: `${(done / total) * 100}%` }} />
      </div>
      {view.areas.map((area) => (
        <section key={area.key} className="card rd-area">
          <h2>{area.label}</h2>
          {view.questions
            .filter((q) => q.area === area.key)
            .map((q) => (
              <div key={q.key} className="rd-q">
                <p>{q.text}</p>
                <div className="rd-scale" role="radiogroup" aria-label={q.text}>
                  {SCALE.map((s) => (
                    <button
                      key={s.v}
                      type="button"
                      role="radio"
                      aria-checked={answers[q.key] === s.v}
                      className={answers[q.key] === s.v ? 'is-on' : ''}
                      onClick={() => setAnswers((a) => ({ ...a, [q.key]: s.v }))}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </section>
      ))}
      {error && <p className="alert alert-error">{error}</p>}
      <div className="rd-foot">
        <span className="muted">
          {done} of {total} answered
        </span>
        <span className="rd-foot-actions">
          {onCancel && (
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="button" className="btn btn-primary" disabled={busy || done < total} onClick={save}>
            {busy ? 'Saving…' : done < total ? `${total - done} to go` : 'See my plan'}
          </button>
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The result                                                                  */
/* -------------------------------------------------------------------------- */

function Ring({ value }: { value: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <svg className="rd-ring" viewBox="0 0 120 120" role="img" aria-label={`Readiness ${value} out of 100`}>
      <circle cx="60" cy="60" r={r} className="rd-ring-bg" />
      <circle cx="60" cy="60" r={r} className="rd-ring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
      <text x="60" y="58" textAnchor="middle" className="rd-ring-num">
        {value}
      </text>
      <text x="60" y="78" textAnchor="middle" className="rd-ring-sub">
        out of 100
      </text>
    </svg>
  );
}

/** A line of the student's own scores over time - their progress, nobody else's. */
function Progress({ history }: { history: ReadinessView['history'] }) {
  const points = useMemo(() => {
    if (history.length < 2) return '';
    const w = 240;
    const h = 60;
    return history
      .map((p, i) => `${(i / (history.length - 1)) * w},${h - (p.composite / 100) * h}`)
      .join(' ');
  }, [history]);

  if (history.length < 2) return <p className="muted rd-note">Retake the check in a week or two to see your progress line.</p>;
  const first = history[0]!.composite;
  const last = history.at(-1)!.composite;
  return (
    <div className="rd-progress-line">
      <svg viewBox="-4 -4 248 68" aria-hidden="true">
        <polyline points={points} />
      </svg>
      <p>
        {last > first ? `Up ${last - first} since ${day(history[0]!.at)}.` : last === first ? `Steady since ${day(history[0]!.at)}.` : `Down ${first - last} since ${day(history[0]!.at)} - that happens; the plan below is where to start.`}
      </p>
    </div>
  );
}

function Summary({ view }: { view: ReadinessView }) {
  const latest = view.latest!;
  const weak = new Set(view.plan?.focus.map((f) => f.area));

  return (
    <>
      {view.upcoming.length > 0 && (
        <section className="rd-upcoming">
          {view.upcoming.map((u) => (
            <article key={u.applicationId} className="rd-countdown">
              <div className="rd-countdown-head">
                <span className="rd-days">
                  <strong>{u.daysUntil}</strong>
                  {u.daysUntil === 1 ? 'day' : 'days'}
                </span>
                <div>
                  <p className="eyebrow">Coming up</p>
                  <h2>
                    {u.company} · {u.round.name}
                  </h2>
                  <p className="muted">
                    {u.role} · {when(u.round.at)} · {u.round.isOnline ? 'online' : 'in person'}
                  </p>
                </div>
              </div>
              {u.round.description && <p className="rd-desc">{u.round.description}</p>}
              <ol className="rd-steps">
                {u.steps.map((s, i) => (
                  <li key={i}>
                    <span className="rd-when">{s.when}</span>
                    <Link to={s.to}>{s.task} →</Link>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </section>
      )}

      <div className="rd-grid">
        <section className="card rd-score">
          <Ring value={latest.composite} />
          <div>
            <p className="muted">Checked {day(latest.at)}</p>
            <Progress history={view.history} />
            {view.practice.attempts > 0 && (
              <p className="rd-note">
                {view.practice.attempts} practice answers, {view.practice.accuracy}% right. Your aptitude score now counts
                these, not just how you rated yourself.
              </p>
            )}
          </div>
        </section>

        <section className="card rd-areas">
          <h2>The six areas</h2>
          <ul>
            {view.areas.map((a) => (
              <li key={a.key} className={weak.has(a.key) ? 'is-focus' : ''}>
                <span>{a.label}</span>
                <span className="rd-bar" aria-hidden="true">
                  <span style={{ width: `${latest.scores[a.key]}%` }} />
                </span>
                <strong>{latest.scores[a.key]}</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {view.plan && (
        <section className="card rd-plan">
          <h2>This week</h2>
          <p className="muted">
            Two areas where a little practice will move you most: {view.plan.focus.map((f) => f.label).join(' and ')}.
          </p>
          <ul>
            {view.plan.tasks.map((t) => (
              <li key={t.title}>
                <div>
                  <strong>{t.title}</strong>
                  <span>{t.why}</span>
                </div>
                <Link to={t.to} className="btn btn-secondary">
                  {t.action}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
