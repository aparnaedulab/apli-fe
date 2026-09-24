import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import StudentLayout from './StudentLayout';
import { ApiError } from '../../api/client';
import {
  practiceApi,
  SECTION_LABEL,
  type AptitudeOverview,
  type PracticeQuestion,
  type PracticeSession,
  type Section,
  type SessionMode,
} from '../../api/practice';
import { useAuth } from '../../auth/AuthContext';
import './Practice.css';

interface Result {
  questionId: string;
  topic: string;
  correct: boolean;
}

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/**
 * Aptitude practice.
 *
 * Three ways in, chosen from one screen: a topic, a timed test shaped like a
 * real first round, or a review that brings back what went wrong. Every answer
 * is checked on the spot with the working shown, because the explanation is
 * where the learning is - a score on its own teaches nothing.
 *
 * A link can start a mode directly (?mode=MIXED, ?mode=REVIEW), so the
 * readiness plan and a countdown to a real test can drop a student straight in.
 */
export default function Practice() {
  const { hasModule } = useAuth();
  const enabled = hasModule('dev.aptitude');
  const [params, setParams] = useSearchParams();
  const [overview, setOverview] = useState<AptitudeOverview | null>(null);
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const autoStarted = useRef(false);

  const loadOverview = useCallback(() => {
    practiceApi
      .aptitude()
      .then(setOverview)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load practice.'));
  }, []);

  useEffect(() => {
    if (enabled) loadOverview();
  }, [enabled, loadOverview]);

  const start = useCallback(async (input: { mode: SessionMode; section?: Section; topic?: string }) => {
    setStarting(true);
    setError(null);
    try {
      setSession(await practiceApi.start(input));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not start that practice.');
    } finally {
      setStarting(false);
    }
  }, []);

  // Deep links from the readiness plan start straight away, once.
  useEffect(() => {
    const mode = params.get('mode');
    if (!enabled || autoStarted.current || (mode !== 'MIXED' && mode !== 'REVIEW')) return;
    autoStarted.current = true;
    void start({ mode });
  }, [enabled, params, start]);

  if (!enabled) {
    return (
      <StudentLayout>
        <header className="page-head">
          <div>
            <p className="eyebrow">Practice</p>
            <h1>Aptitude practice</h1>
            <p className="page-lede">Your institution has not switched on aptitude practice yet.</p>
          </div>
        </header>
      </StudentLayout>
    );
  }

  if (session) {
    return (
      <StudentLayout>
        <Runner
          session={session}
          onExit={() => {
            setSession(null);
            setParams({}, { replace: true });
            loadOverview();
          }}
          onAgain={() => void start({ mode: session.mode, topic: session.questions[0]?.topic })}
        />
      </StudentLayout>
    );
  }

  const focus = params.get('section') as Section | null;

  return (
    <StudentLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Practice</p>
          <h1>Aptitude practice</h1>
          <p className="page-lede">
            {overview && overview.totals.attempts > 0
              ? `${overview.totals.attempts} answered so far, ${overview.totals.accuracy}% right. Keep going - the topics you miss come back until they stick.`
              : 'Pick a topic, or try a timed test like the first round of a campus drive.'}
          </p>
        </div>
      </header>

      {error && <p className="alert alert-error">{error}</p>}
      {!overview && !error && <p className="muted">Loading…</p>}

      {overview && (
        <>
          <div className="pr-modes">
            <button type="button" className="pr-mode is-primary" disabled={starting} onClick={() => start({ mode: 'MIXED' })}>
              <strong>Timed test</strong>
              <span>20 questions in 20 minutes - quant, reasoning and verbal, like a real first round.</span>
            </button>
            <button
              type="button"
              className="pr-mode"
              disabled={starting || overview.totals.attempts === 0}
              onClick={() => start({ mode: 'REVIEW' })}
              title={overview.totals.attempts === 0 ? 'Practise a topic first' : undefined}
            >
              <strong>Review weak topics</strong>
              <span>
                {overview.totals.attempts === 0
                  ? 'Unlocks after your first practice - it brings back what you found hard.'
                  : `${overview.toRetry} question${overview.toRetry === 1 ? '' : 's'} to try again, then your weakest topics.`}
              </span>
            </button>
          </div>

          {overview.weakTopics.length > 0 && (
            <section className="card pr-weak">
              <h2>Worth another look</h2>
              <ul>
                {overview.weakTopics.map((w) => (
                  <li key={w.topic}>
                    <span>{w.topic}</span>
                    <span className="pr-acc" aria-hidden="true">
                      <span style={{ width: `${w.accuracy}%` }} />
                    </span>
                    <small>{w.accuracy}%</small>
                    <button type="button" className="btn btn-ghost btn-sm" disabled={starting} onClick={() => start({ mode: 'TOPIC', topic: w.topic })}>
                      Practise
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {overview.sections
            .filter((s) => !focus || s.section === focus)
            .map((s) => (
              <section key={s.section} className="card pr-section">
                <h2>{SECTION_LABEL[s.section]}</h2>
                <div className="pr-topics">
                  {s.topics.map((t) => (
                    <button
                      key={t.topic}
                      type="button"
                      className="pr-topic"
                      disabled={starting}
                      onClick={() => start({ mode: 'TOPIC', section: s.section, topic: t.topic })}
                    >
                      <strong>{t.topic}</strong>
                      <small>
                        {t.attempts ? `${t.accuracy}% right · ${t.attempts} answered` : `${t.questions} question${t.questions === 1 ? '' : 's'}`}
                      </small>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          {focus && (
            <button type="button" className="btn btn-ghost" onClick={() => setParams({}, { replace: true })}>
              Show every section
            </button>
          )}
        </>
      )}
    </StudentLayout>
  );
}

/* -------------------------------------------------------------------------- */
/* Answering                                                                   */
/* -------------------------------------------------------------------------- */

function Runner({ session, onExit, onAgain }: { session: PracticeSession; onExit: () => void; onAgain: () => void }) {
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [verdict, setVerdict] = useState<{ correct: boolean; answerIndex: number; explanation: string | null } | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [remaining, setRemaining] = useState(session.timeLimitSec);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shownAt = useRef(Date.now());

  const q: PracticeQuestion | undefined = session.questions[index];

  // The timer, for the timed test only. When it runs out the test ends where it is.
  useEffect(() => {
    if (session.timeLimitSec === null || finished) return;
    const t = window.setInterval(() => {
      setRemaining((r) => {
        if (r === null) return r;
        if (r <= 1) {
          setFinished(true);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [session.timeLimitSec, finished]);

  async function answer(i: number) {
    if (!q || verdict) return;
    setChosen(i);
    setError(null);
    try {
      const v = await practiceApi.answer(q.id, i, Date.now() - shownAt.current);
      setVerdict(v);
      setResults((r) => [...r, { questionId: q.id, topic: q.topic, correct: v.correct }]);
    } catch (e) {
      setChosen(null);
      setError(e instanceof ApiError ? e.message : 'Could not check that answer.');
    }
  }

  function next() {
    if (index + 1 >= session.questions.length) {
      setFinished(true);
      return;
    }
    setIndex(index + 1);
    setChosen(null);
    setVerdict(null);
    shownAt.current = Date.now();
  }

  if (finished || !q) {
    const right = results.filter((r) => r.correct).length;
    const byTopic = new Map<string, { right: number; total: number }>();
    for (const r of results) {
      const t = byTopic.get(r.topic) ?? { right: 0, total: 0 };
      t.total++;
      if (r.correct) t.right++;
      byTopic.set(r.topic, t);
    }
    return (
      <section className="card pr-done">
        <p className="eyebrow">{session.timeLimitSec !== null && remaining === 0 ? 'Time is up' : 'Done'}</p>
        <h1>
          {right} of {results.length} right
        </h1>
        <p className="muted">
          {results.length === 0
            ? 'No answers this time.'
            : right === results.length
              ? 'Every one. Try a timed test next.'
              : 'The ones you missed will come back in “Review weak topics” until they stick.'}
        </p>
        {byTopic.size > 0 && (
          <ul className="pr-done-topics">
            {[...byTopic.entries()].map(([topic, t]) => (
              <li key={topic}>
                <span>{topic}</span>
                <strong>
                  {t.right}/{t.total}
                </strong>
              </li>
            ))}
          </ul>
        )}
        <div className="pr-done-actions">
          <button type="button" className="btn btn-ghost" onClick={onExit}>
            Back to practice
          </button>
          <button type="button" className="btn btn-primary" onClick={onAgain}>
            Another set
          </button>
        </div>
      </section>
    );
  }

  const options = q.options;
  return (
    <div className="pr-run">
      <div className="pr-run-head">
        <span className="muted">
          Question {index + 1} of {session.questions.length} · {SECTION_LABEL[q.section]} · {q.topic}
        </span>
        {remaining !== null && <span className={`pr-timer ${remaining < 60 ? 'is-low' : ''}`}>{clock(remaining)}</span>}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFinished(true)}>
          Finish
        </button>
      </div>
      <div className="pr-run-bar" aria-hidden="true">
        <span style={{ width: `${(index / session.questions.length) * 100}%` }} />
      </div>

      <section className="card pr-card">
        <p className="pr-stem">{q.stem}</p>
        <div className="pr-options" role="radiogroup" aria-label="Answer">
          {options.map((o, i) => {
            const state = !verdict
              ? ''
              : i === verdict.answerIndex
                ? 'is-right'
                : i === chosen
                  ? 'is-wrong'
                  : 'is-dim';
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={chosen === i}
                className={`pr-option ${state}`}
                disabled={Boolean(verdict)}
                onClick={() => answer(i)}
              >
                <span className="pr-letter">{String.fromCharCode(65 + i)}</span>
                {o}
              </button>
            );
          })}
        </div>

        {verdict && (
          <div className={`pr-verdict ${verdict.correct ? 'is-right' : 'is-wrong'}`} role="status">
            <strong>{verdict.correct ? 'Right.' : `Not quite - it is ${String.fromCharCode(65 + verdict.answerIndex)}.`}</strong>
            {verdict.explanation && <p>{verdict.explanation}</p>}
          </div>
        )}
        {error && <p className="alert alert-error">{error}</p>}

        {verdict && (
          <div className="pr-next">
            <button type="button" className="btn btn-primary" onClick={next} autoFocus>
              {index + 1 >= session.questions.length ? 'See how you did' : 'Next question'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
