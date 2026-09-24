import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import StudentLayout from './StudentLayout';
import { ApiError } from '../../api/client';
import {
  mockInterviewApi,
  type InterviewKind,
  type MockFeedback,
  type MockOptions,
  type MockSession,
  type MockSessionSummary,
} from '../../api/mockInterview';
import { useAuth } from '../../auth/AuthContext';
import './MockInterview.css';

/**
 * Mock interviews: a safe place to practise answering out loud.
 *
 * One question at a time, answered by typing or by speaking - speech is turned
 * into text by the browser and only that text is kept. Feedback leads with
 * what went well and asks for at most two changes, because a student who
 * feels judged stops practising, and practising is what builds confidence.
 */

const KIND_LABEL: Record<InterviewKind, string> = { HR: 'HR round', TECHNICAL: 'Technical round', MANAGERIAL: 'Managerial round' };

const date = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export default function MockInterview() {
  const { hasModule } = useAuth();
  const enabled = hasModule('dev.mockInterview');
  const [options, setOptions] = useState<MockOptions | null>(null);
  const [history, setHistory] = useState<MockSessionSummary[] | null>(null);
  const [session, setSession] = useState<MockSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(() => {
    mockInterviewApi
      .sessions()
      .then(setHistory)
      .catch(() => setHistory([]));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    mockInterviewApi
      .options()
      .then(setOptions)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load mock interviews.'));
    loadHistory();
  }, [enabled, loadHistory]);

  async function open(id: string) {
    setError(null);
    try {
      setSession(await mockInterviewApi.get(id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not open that session.');
    }
  }

  if (!enabled) {
    return (
      <StudentLayout>
        <header className="page-head">
          <div>
            <p className="eyebrow">Practice</p>
            <h1>Mock interview</h1>
            <p className="page-lede">Your institution has not switched on mock interviews yet.</p>
          </div>
        </header>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Practice</p>
          <h1>Mock interview</h1>
          <p className="page-lede">
            Five questions, one at a time. Answer as you would in the room - then see what worked and one or two things to
            try next time.
          </p>
        </div>
        {session && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setSession(null);
              loadHistory();
            }}
          >
            End session
          </button>
        )}
      </header>

      {error && <p className="alert alert-error">{error}</p>}

      {!options && !error && <p className="muted">Loading…</p>}

      {options && !session && (
        <>
          <Setup options={options} onStarted={setSession} onError={setError} />
          <History sessions={history} onOpen={open} />
        </>
      )}

      {options && session && (
        <Practice
          session={session}
          aiEnabled={options.aiEnabled}
          roleLabel={options.roles.find((r) => r.key === session.role)?.label ?? session.role}
          onUpdate={setSession}
          onAgain={() => {
            setSession(null);
            loadHistory();
          }}
        />
      )}
    </StudentLayout>
  );
}

/* -------------------------------------------------------------------------- */
/* Choosing what to practise                                                   */
/* -------------------------------------------------------------------------- */

function Setup({
  options,
  onStarted,
  onError,
}: {
  options: MockOptions;
  onStarted: (s: MockSession) => void;
  onError: (m: string | null) => void;
}) {
  const [kind, setKind] = useState<InterviewKind>('HR');
  const [role, setRole] = useState(options.roles[0]?.key ?? 'software');
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    onError(null);
    try {
      onStarted(await mockInterviewApi.start(kind, role));
    } catch (e) {
      onError(e instanceof ApiError ? e.message : 'Could not start a session.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card mi-setup">
      <h2>What do you want to practise?</h2>
      <div className="mi-kinds" role="radiogroup" aria-label="Interview round">
        {options.kinds.map((k) => (
          <button
            key={k.key}
            type="button"
            role="radio"
            aria-checked={kind === k.key}
            className={`mi-kind ${kind === k.key ? 'is-on' : ''}`}
            onClick={() => setKind(k.key)}
          >
            <strong>{k.label}</strong>
            <span>{k.blurb}</span>
          </button>
        ))}
      </div>

      <label className="mi-role">
        <span>The kind of role you are preparing for</span>
        <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
          {options.roles.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>
        {kind !== 'TECHNICAL' && <small>HR and managerial questions are the same for every role.</small>}
      </label>

      <div className="mi-start">
        <p className="mi-privacy">
          {options.aiEnabled ? 'Feedback is written by AI, checked against a fixed guide.' : 'Feedback comes from built-in guidelines.'} Only
          the text of your answers is saved. If you speak, your browser turns it into text - no recording is stored or
          uploaded.
        </p>
        <button type="button" className="btn btn-primary" onClick={start} disabled={busy}>
          {busy ? 'Starting…' : 'Start practising'}
        </button>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Speech to text                                                              */
/* -------------------------------------------------------------------------- */

interface RecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<RecognitionResultLike> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
}

type RecognitionCtor = new () => RecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Dictation into the answer box. The browser does the listening; this page
 * only ever sees the words, which join whatever has already been typed.
 */
function useDictation(onText: (text: string) => void) {
  const Ctor = useMemo(recognitionCtor, []);
  const ref = useRef<RecognitionLike | null>(null);
  const [listening, setListening] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const stop = useCallback(() => {
    ref.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (!Ctor) return;
    setProblem(null);
    const r = new Ctor();
    r.lang = 'en-IN';
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      let text = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        if (res.isFinal) text += res[0].transcript;
      }
      if (text.trim()) onText(text.trim());
    };
    r.onerror = (e) => {
      setProblem(
        e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? 'Microphone access is blocked. Allow it in your browser, or type your answer instead.'
          : 'Listening stopped. You can start again, or type the rest.',
      );
    };
    r.onend = () => setListening(false);
    ref.current = r;
    r.start();
    setListening(true);
  }, [Ctor, onText]);

  useEffect(() => () => ref.current?.stop(), []);

  return { supported: Boolean(Ctor), listening, problem, start, stop };
}

/* -------------------------------------------------------------------------- */
/* One question at a time                                                      */
/* -------------------------------------------------------------------------- */

function Practice({
  session,
  aiEnabled,
  roleLabel,
  onUpdate,
  onAgain,
}: {
  session: MockSession;
  aiEnabled: boolean;
  roleLabel: string;
  onUpdate: (s: MockSession) => void;
  onAgain: () => void;
}) {
  const answeredTexts = new Set(session.answers.map((a) => a.question));
  const nextIndex = session.questions.findIndex((q) => !answeredTexts.has(q.text));
  const [showing, setShowing] = useState<{ feedback: MockFeedback; question: string } | null>(null);

  if (showing) {
    return (
      <FeedbackCard
        question={showing.question}
        feedback={showing.feedback}
        position={`${session.answers.length} of ${session.questions.length}`}
        onNext={() => setShowing(null)}
        last={nextIndex === -1}
      />
    );
  }

  if (nextIndex === -1) return <Summary session={session} roleLabel={roleLabel} onAgain={onAgain} />;

  return (
    <QuestionView
      key={session.questions[nextIndex]!.id}
      session={session}
      index={nextIndex}
      aiEnabled={aiEnabled}
      onAnswered={(feedback, updated, question) => {
        onUpdate(updated);
        setShowing({ feedback, question });
      }}
    />
  );
}

function QuestionView({
  session,
  index,
  aiEnabled,
  onAnswered,
}: {
  session: MockSession;
  index: number;
  aiEnabled: boolean;
  onAnswered: (f: MockFeedback, s: MockSession, question: string) => void;
}) {
  const question = session.questions[index]!;
  const [answer, setAnswer] = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [spoke, setSpoke] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const append = useCallback((text: string) => {
    setSpoke(true);
    setStartedAt((s) => s ?? Date.now());
    setAnswer((a) => (a ? `${a} ${text}` : text));
  }, []);
  const dictation = useDictation(append);

  useEffect(() => {
    if (!startedAt) return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [startedAt]);

  const seconds = startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : 0;
  const words = answer.trim() ? answer.trim().split(/\s+/).length : 0;
  const [lo, hi] = question.idealWords;

  async function submit() {
    dictation.stop();
    setBusy(true);
    setError(null);
    try {
      const res = await mockInterviewApi.answer(session.id, {
        questionId: question.id,
        answer: answer.trim(),
        durationSec: startedAt ? Math.round((Date.now() - startedAt) / 1000) : undefined,
        mode: spoke ? 'voice' : 'typed',
      });
      onAnswered(res.feedback, res.session, question.text);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not get feedback. Try again.');
      setBusy(false);
    }
  }

  return (
    <section className="card mi-question">
      <div className="mi-q-top">
        <span className="mi-step">
          Question {index + 1} of {session.questions.length}
        </span>
        <span className="mi-dots" aria-hidden="true">
          {session.questions.map((q, i) => (
            <span key={q.id} className={i < index ? 'is-done' : i === index ? 'is-now' : ''} />
          ))}
        </span>
        <span className={`mi-timer ${startedAt ? 'is-running' : ''}`} aria-label="Time on this answer">
          {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
        </span>
      </div>

      <h2 className="mi-q-text">{question.text}</h2>
      <p className="mi-q-hint">
        {question.type === 'behavioural' || question.type === 'situational'
          ? 'Tell it as a story: the situation, what you did, and how it turned out.'
          : question.type === 'intro'
            ? 'About a minute: what you study, one thing you have done, and what you are looking for.'
            : question.type === 'technical'
              ? 'Explain your reasoning out loud, as you would to the interviewer.'
              : 'Be specific about why - general answers sound like everyone else’s.'}
      </p>

      <textarea
        className="input mi-answer"
        rows={8}
        value={answer}
        onChange={(e) => {
          setAnswer(e.target.value);
          if (!startedAt && e.target.value.trim()) setStartedAt(Date.now());
        }}
        placeholder={dictation.supported ? 'Type your answer, or press the microphone and speak.' : 'Type your answer.'}
        aria-label="Your answer"
      />

      <div className="mi-answer-meta">
        <span className={words === 0 ? '' : words < lo ? 'is-short' : words > hi ? 'is-long' : 'is-good'}>
          {words} words · aim for {lo}-{hi}
        </span>
        {dictation.problem && <span className="mi-problem">{dictation.problem}</span>}
      </div>

      {error && <p className="alert alert-error">{error}</p>}

      <div className="mi-actions">
        {dictation.supported && (
          <button
            type="button"
            className={`btn btn-secondary mi-mic ${dictation.listening ? 'is-on' : ''}`}
            onClick={dictation.listening ? dictation.stop : dictation.start}
            aria-pressed={dictation.listening}
          >
            <span className="mi-mic-dot" aria-hidden="true" />
            {dictation.listening ? 'Stop listening' : 'Speak your answer'}
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={submit} disabled={busy || words < 3}>
          {busy ? (aiEnabled ? 'Reading your answer…' : 'Checking…') : 'Get feedback'}
        </button>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Feedback, summary, history                                                  */
/* -------------------------------------------------------------------------- */

function ScoreRing({ score }: { score: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg className="mi-ring" viewBox="0 0 64 64" role="img" aria-label={`Score ${score} out of 100`}>
      <circle cx="32" cy="32" r={r} className="mi-ring-bg" />
      <circle cx="32" cy="32" r={r} className="mi-ring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      <text x="32" y="37" textAnchor="middle">
        {score}
      </text>
    </svg>
  );
}

function FeedbackCard({
  question,
  feedback,
  position,
  onNext,
  last,
}: {
  question: string;
  feedback: MockFeedback;
  position: string;
  onNext: () => void;
  last: boolean;
}) {
  const m = feedback.metrics;
  return (
    <section className="card mi-feedback">
      <div className="mi-fb-head">
        <ScoreRing score={feedback.score} />
        <div>
          <p className="mi-step">Answered {position}</p>
          <h2>{question}</h2>
          <span className={`pill ${feedback.source === 'ai' ? 'pill-pass' : 'pill-idle'}`}>
            {feedback.source === 'ai' ? 'AI feedback' : 'Built-in feedback'}
          </span>
          {feedback.fellBack && <small className="mi-fellback"> AI feedback was unavailable this time.</small>}
        </div>
      </div>

      <h3 className="mi-h">What worked</h3>
      <ul className="mi-list mi-good">
        {feedback.strengths.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>

      {feedback.improvements.length > 0 && (
        <>
          <h3 className="mi-h">Try next time</h3>
          <ul className="mi-list mi-next">
            {feedback.improvements.map((i) => (
              <li key={i.title}>
                <strong>{i.title}.</strong> {i.tip}
              </li>
            ))}
          </ul>
        </>
      )}

      {feedback.betterOpening && (
        <div className="mi-opening">
          <span>A stronger way to open</span>
          <p>“{feedback.betterOpening}”</p>
        </div>
      )}

      <dl className="mi-metrics">
        <div>
          <dt>Length</dt>
          <dd>
            {m.words} words <small>(aim {m.idealWords[0]}-{m.idealWords[1]})</small>
          </dd>
        </div>
        <div>
          <dt>Filler words</dt>
          <dd>{m.fillerTotal === 0 ? 'None' : m.fillers.map((f) => `${f.word} ×${f.count}`).join(', ')}</dd>
        </div>
        {m.wpm !== null && (
          <div>
            <dt>Pace</dt>
            <dd>{m.wpm} words/min</dd>
          </div>
        )}
        {m.star && (
          <div>
            <dt>Story</dt>
            <dd className="mi-star">
              {(['situation', 'task', 'action', 'result'] as const).map((k) => (
                <span key={k} className={m.star![k] ? 'is-on' : ''}>
                  {k}
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>

      <div className="mi-actions">
        <button type="button" className="btn btn-primary" onClick={onNext}>
          {last ? 'See your summary' : 'Next question'}
        </button>
      </div>
    </section>
  );
}

function Summary({ session, roleLabel, onAgain }: { session: MockSession; roleLabel: string; onAgain: () => void }) {
  return (
    <section className="card mi-summary">
      <p className="mi-step">
        {KIND_LABEL[session.kind]} · {roleLabel}
      </p>
      <h2>Session complete{session.averageScore !== null ? ` - average ${session.averageScore}` : ''}</h2>
      <p className="page-lede">
        Every answer you practise makes the real one easier. Pick the lowest score below and try that kind of question again
        tomorrow.
      </p>
      <ul className="mi-summary-list">
        {session.answers.map((a) => (
          <li key={a.id}>
            <span className="mi-summary-score">{a.feedback.score}</span>
            <span>
              <strong>{a.question}</strong>
              <small>{a.feedback.improvements[0] ? `Next time: ${a.feedback.improvements[0].title.toLowerCase()}` : 'Nothing to change - keep it up.'}</small>
            </span>
          </li>
        ))}
      </ul>
      <div className="mi-actions">
        <button type="button" className="btn btn-primary" onClick={onAgain}>
          Practise again
        </button>
      </div>
    </section>
  );
}

function History({ sessions, onOpen }: { sessions: MockSessionSummary[] | null; onOpen: (id: string) => void }) {
  const scored = (sessions ?? []).filter((s) => s.averageScore !== null).reverse();
  const points = useMemo(() => {
    if (scored.length < 2) return '';
    const w = 240;
    const h = 48;
    return scored
      .map((s, i) => `${(i / (scored.length - 1)) * w},${h - ((s.averageScore ?? 0) / 100) * h}`)
      .join(' ');
  }, [scored]);

  if (!sessions || sessions.length === 0) return null;

  return (
    <section className="card mi-history">
      <div className="mi-history-head">
        <h2>Your practice so far</h2>
        {points && (
          <svg className="mi-trend" viewBox="-4 -4 248 56" role="img" aria-label="Average score across sessions, oldest to newest">
            <polyline points={points} />
          </svg>
        )}
      </div>
      <ul className="mi-history-list">
        {sessions.map((s) => (
          <li key={s.id}>
            <button type="button" onClick={() => onOpen(s.id)}>
              <span>
                <strong>{KIND_LABEL[s.kind]}</strong>
                <small>
                  {date(s.createdAt)} · {s.answered} answered
                </small>
              </span>
              <span className="mi-history-score">{s.averageScore ?? '—'}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
