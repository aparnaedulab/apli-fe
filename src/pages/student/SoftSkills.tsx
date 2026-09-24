import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import StudentLayout from './StudentLayout';
import { ApiError } from '../../api/client';
import type { MockFeedback } from '../../api/mockInterview';
import {
  softSkillsApi,
  type EmailFeedback,
  type PitchFeedback,
  type SoftAttempt,
  type SoftKind,
  type SoftSkillsHome,
} from '../../api/growth';
import { useAuth } from '../../auth/AuthContext';
import './SoftSkills.css';

/**
 * The soft skills studio: short, daily practice for the things placements
 * quietly test - speaking to a prompt, a 60-90 second pitch, and the handful
 * of emails every student sends. Speaking and pitch use the same feedback as
 * mock interviews; emails are checked against what makes a work email land.
 * Everything is the student's own; nobody else sees it.
 */

const date = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

const TABS: { key: SoftKind; label: string; blurb: string }[] = [
  { key: 'SPEAKING', label: 'Daily speaking', blurb: 'One prompt a day. About a minute.' },
  { key: 'PITCH', label: 'Your pitch', blurb: '60-90 seconds on who you are and what you want.' },
  { key: 'EMAIL', label: 'Email writing', blurb: 'The emails recruiters actually read.' },
];

export default function SoftSkills() {
  const { hasModule } = useAuth();
  const enabled = hasModule('dev.softSkills');
  const [home, setHome] = useState<SoftSkillsHome | null>(null);
  const [tab, setTab] = useState<SoftKind>('SPEAKING');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    softSkillsApi
      .home()
      .then(setHome)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load the studio.'));
  }, []);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  if (!enabled) {
    return (
      <StudentLayout>
        <header className="page-head">
          <div>
            <p className="eyebrow">Practice</p>
            <h1>Soft skills studio</h1>
            <p className="page-lede">Your institution has not switched on the soft skills studio yet.</p>
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
          <h1>Soft skills studio</h1>
          <p className="page-lede">
            Ten minutes a day on the skills every interview quietly tests. Feedback starts with what worked, and never
            comments on your accent or grammar.
          </p>
        </div>
      </header>

      {error && <p className="alert alert-error">{error}</p>}
      {!home && !error && <p className="muted">Loading…</p>}

      {home && (
        <>
          <div className="ss-tabs" role="tablist" aria-label="What to practise">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                className={`ss-tab ${tab === t.key ? 'is-on' : ''}`}
                onClick={() => setTab(t.key)}
              >
                <strong>{t.label}</strong>
                <span>{t.blurb}</span>
              </button>
            ))}
          </div>

          {tab === 'SPEAKING' && <Spoken key="s" kind="SPEAKING" prompts={[home.dailyPrompt]} aiEnabled={home.aiEnabled} onSaved={load} />}
          {tab === 'PITCH' && <Spoken key="p" kind="PITCH" prompts={home.pitchPrompts} aiEnabled={home.aiEnabled} onSaved={load} />}
          {tab === 'EMAIL' && <Email scenarios={home.scenarios} aiEnabled={home.aiEnabled} onSaved={load} />}

          <History kind={tab} attempts={home.history[tab]} />

          <p className="ss-privacy">
            Only the text is saved - if you speak, your browser turns it into words and no recording is kept or uploaded.
            Your practice is private to you; your placement cell cannot see it.
          </p>
        </>
      )}
    </StudentLayout>
  );
}

/* -------------------------------------------------------------------------- */
/* Speech to text - the browser listens; the page only ever sees the words     */
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

/** Shared with the group discussion page, which lets students speak their turns too. */
export function useDictation(onText: (text: string) => void) {
  const Ctor = useMemo(recognitionCtor, []);
  const ref = useRef<RecognitionLike | null>(null);
  const [listening, setListening] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const stop = useCallback(() => ref.current?.stop(), []);

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
    r.onerror = (e) =>
      setProblem(
        e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? 'Microphone access is blocked. Allow it in your browser, or type instead.'
          : 'Listening stopped. You can start again, or type the rest.',
      );
    r.onend = () => setListening(false);
    ref.current = r;
    r.start();
    setListening(true);
  }, [Ctor, onText]);

  useEffect(() => () => ref.current?.stop(), []);

  return { supported: Boolean(Ctor), listening, problem, start, stop };
}

/* -------------------------------------------------------------------------- */
/* Speaking and pitch                                                          */
/* -------------------------------------------------------------------------- */

function Spoken({
  kind,
  prompts,
  aiEnabled,
  onSaved,
}: {
  kind: 'SPEAKING' | 'PITCH';
  prompts: string[];
  aiEnabled: boolean;
  onSaved: () => void;
}) {
  const [prompt, setPrompt] = useState(prompts[0] ?? '');
  const [text, setText] = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [spoke, setSpoke] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<MockFeedback | PitchFeedback | null>(null);

  const append = useCallback((t: string) => {
    setSpoke(true);
    setStartedAt((s) => s ?? Date.now());
    setText((a) => (a ? `${a} ${t}` : t));
  }, []);
  const dictation = useDictation(append);

  useEffect(() => {
    if (!startedAt || feedback) return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [startedAt, feedback]);

  const seconds = startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : 0;
  const words = wordCount(text);
  const pitch = kind === 'PITCH';

  async function submit() {
    dictation.stop();
    setBusy(true);
    setError(null);
    try {
      const data = {
        prompt,
        response: text.trim(),
        durationSec: startedAt ? Math.round((Date.now() - startedAt) / 1000) : undefined,
        mode: spoke ? ('voice' as const) : ('typed' as const),
      };
      const res = pitch ? await softSkillsApi.pitch(data) : await softSkillsApi.speaking(data);
      setFeedback(res.feedback);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not get feedback. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function again() {
    setText('');
    setStartedAt(null);
    setSpoke(false);
    setFeedback(null);
  }

  if (feedback) return <SpokenFeedback feedback={feedback} prompt={prompt} onAgain={again} />;

  return (
    <section className="card ss-compose">
      {pitch ? (
        <label className="ss-field">
          <span>Who are you pitching to?</span>
          <select className="input" value={prompt} onChange={(e) => setPrompt(e.target.value)}>
            {prompts.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
      ) : (
        <>
          <p className="ss-kicker">Today’s prompt</p>
          <h2 className="ss-prompt">{prompt}</h2>
        </>
      )}

      {pitch && (
        <ol className="ss-beats" aria-label="The four beats of a pitch">
          <li>Who you are</li>
          <li>One piece of proof</li>
          <li>Why you fit</li>
          <li>What you are asking for</li>
        </ol>
      )}

      <textarea
        className="input ss-text"
        rows={7}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (!startedAt && e.target.value.trim()) setStartedAt(Date.now());
        }}
        placeholder={dictation.supported ? 'Press the microphone and speak, or type.' : 'Type what you would say.'}
        aria-label={pitch ? 'Your pitch' : 'Your answer'}
      />

      <div className="ss-meta">
        <span>{words} words</span>
        {pitch ? (
          <span className={`ss-clock ${seconds === 0 ? '' : seconds < 60 ? 'is-short' : seconds > 90 ? 'is-long' : 'is-good'}`}>
            {clock(seconds)} · aim 1:00-1:30
          </span>
        ) : (
          <span className="ss-clock">{clock(seconds)}</span>
        )}
        {dictation.problem && <span className="ss-problem">{dictation.problem}</span>}
      </div>

      {error && <p className="alert alert-error">{error}</p>}

      <div className="ss-actions">
        {dictation.supported && (
          <button
            type="button"
            className={`btn btn-secondary ss-mic ${dictation.listening ? 'is-on' : ''}`}
            onClick={dictation.listening ? dictation.stop : dictation.start}
            aria-pressed={dictation.listening}
          >
            <span className="ss-mic-dot" aria-hidden="true" />
            {dictation.listening ? 'Stop listening' : 'Speak'}
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={submit} disabled={busy || words < 3}>
          {busy ? (aiEnabled ? 'Reading it…' : 'Checking…') : 'Get feedback'}
        </button>
      </div>
    </section>
  );
}

function SpokenFeedback({ feedback, prompt, onAgain }: { feedback: MockFeedback | PitchFeedback; prompt: string; onAgain: () => void }) {
  const structure = 'structure' in feedback ? feedback.structure : null;
  const m = feedback.metrics;
  return (
    <section className="card ss-feedback">
      <FeedbackHead score={feedback.score} title={prompt} source={feedback.source} fellBack={feedback.fellBack} />
      <Lists strengths={feedback.strengths} improvements={feedback.improvements} />
      {structure && (
        <>
          <h3 className="ss-h">Pitch structure</h3>
          <ul className="ss-checks">
            {structure.map((p) => (
              <li key={p.key} className={p.ok ? 'is-ok' : 'is-miss'}>
                <span aria-hidden="true">{p.ok ? '✓' : '○'}</span>
                <span>
                  <strong>{p.label}</strong>
                  {!p.ok && <small>{p.tip}</small>}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <dl className="ss-metrics">
        <div>
          <dt>Length</dt>
          <dd>{m.words} words</dd>
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
      </dl>
      <div className="ss-actions">
        <button type="button" className="btn btn-primary" onClick={onAgain}>
          Try again
        </button>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Email                                                                       */
/* -------------------------------------------------------------------------- */

function Email({
  scenarios,
  aiEnabled,
  onSaved,
}: {
  scenarios: SoftSkillsHome['scenarios'];
  aiEnabled: boolean;
  onSaved: () => void;
}) {
  const [scenarioId, setScenarioId] = useState(scenarios[0]?.id ?? '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<EmailFeedback | null>(null);
  const scenario = scenarios.find((s) => s.id === scenarioId);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await softSkillsApi.email({ scenarioId, subject: subject.trim(), body: body.trim() });
      setFeedback(res.feedback);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not check the email. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (feedback) {
    return (
      <section className="card ss-feedback">
        <FeedbackHead score={feedback.score} title={scenario?.title ?? 'Your email'} source={feedback.source} fellBack={feedback.fellBack} />
        <ul className="ss-checks">
          {feedback.checks.map((c) => (
            <li key={c.key} className={c.ok ? 'is-ok' : 'is-miss'}>
              <span aria-hidden="true">{c.ok ? '✓' : '○'}</span>
              <span>
                <strong>{c.label}</strong>
                {!c.ok && c.tip && <small>{c.tip}</small>}
              </span>
            </li>
          ))}
        </ul>
        <div className="ss-compare">
          <div>
            <p className="ss-kicker">What you wrote</p>
            <pre className="ss-mail">
              <b>Subject: {subject || '(none)'}</b>
              {'\n\n'}
              {body}
            </pre>
          </div>
          <div>
            <p className="ss-kicker">{feedback.improved.from === 'ai' ? 'Your draft, polished' : 'A model version to compare'}</p>
            <pre className="ss-mail ss-mail-better">
              <b>Subject: {feedback.improved.subject}</b>
              {'\n\n'}
              {feedback.improved.body}
            </pre>
            {feedback.improved.from === 'template' && <small className="ss-note">Fill in the [brackets] with your own details.</small>}
            {feedback.notes && feedback.notes.length > 0 && (
              <ul className="ss-notes">
                {feedback.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="ss-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setFeedback(null)}>
            Edit my draft
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setFeedback(null);
              setSubject('');
              setBody('');
            }}
          >
            Try another
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="card ss-compose">
      <label className="ss-field">
        <span>The situation</span>
        <select className="input" value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
          {scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </label>
      {scenario && <p className="ss-brief">{scenario.brief}</p>}
      <label className="ss-field">
        <span>Subject</span>
        <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
      </label>
      <label className="ss-field">
        <span>Email</span>
        <textarea className="input ss-text" rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      <div className="ss-meta">
        <span>{wordCount(body)} words · aim 50-150</span>
      </div>
      {error && <p className="alert alert-error">{error}</p>}
      <div className="ss-actions">
        <button type="button" className="btn btn-primary" onClick={submit} disabled={busy || wordCount(body) < 2}>
          {busy ? (aiEnabled ? 'Polishing…' : 'Checking…') : 'Check my email'}
        </button>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared pieces                                                               */
/* -------------------------------------------------------------------------- */

function FeedbackHead({ score, title, source, fellBack }: { score: number; title: string; source: 'builtin' | 'ai'; fellBack?: boolean }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="ss-fb-head">
      <svg className="ss-ring" viewBox="0 0 64 64" role="img" aria-label={`Score ${score} out of 100`}>
        <circle cx="32" cy="32" r={r} className="ss-ring-bg" />
        <circle cx="32" cy="32" r={r} className="ss-ring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
        <text x="32" y="37" textAnchor="middle">
          {score}
        </text>
      </svg>
      <div>
        <h2>{title}</h2>
        <span className={`pill ${source === 'ai' ? 'pill-pass' : 'pill-idle'}`}>{source === 'ai' ? 'AI feedback' : 'Built-in feedback'}</span>
        {fellBack && <small className="ss-note"> AI feedback was unavailable this time.</small>}
      </div>
    </div>
  );
}

function Lists({ strengths, improvements }: { strengths: string[]; improvements: { title: string; tip: string }[] }) {
  return (
    <>
      <h3 className="ss-h">What worked</h3>
      <ul className="ss-list ss-good">
        {strengths.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      {improvements.length > 0 && (
        <>
          <h3 className="ss-h">Try next time</h3>
          <ul className="ss-list ss-next">
            {improvements.map((i) => (
              <li key={i.title}>
                <strong>{i.title}.</strong> {i.tip}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function History({ kind, attempts }: { kind: SoftKind; attempts: SoftAttempt[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (attempts.length === 0) return null;
  return (
    <section className="card ss-history">
      <h2>Your {kind === 'SPEAKING' ? 'speaking' : kind === 'PITCH' ? 'pitches' : 'emails'} so far</h2>
      <ul>
        {attempts.map((a) => (
          <li key={a.id}>
            <button type="button" onClick={() => setOpen(open === a.id ? null : a.id)} aria-expanded={open === a.id}>
              <span>
                <strong>{a.prompt}</strong>
                <small>{date(a.createdAt)}</small>
              </span>
              <span className="ss-history-score">{a.feedback.score}</span>
            </button>
            {open === a.id && <pre className="ss-mail">{a.response}</pre>}
          </li>
        ))}
      </ul>
    </section>
  );
}
