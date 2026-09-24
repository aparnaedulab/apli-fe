import { useCallback, useEffect, useRef, useState } from 'react';
import StudentLayout from './StudentLayout';
import { ApiError } from '../../api/client';
import { gdApi, type GdFeedback, type GdPersona, type GdSession, type GdSessionSummary, type GdTopic } from '../../api/growth';
import { useAuth } from '../../auth/AuthContext';
import { useDictation } from './SoftSkills';
import './GroupDiscussion.css';

/**
 * Group discussion practice. A GD is the round students can least practise
 * alone, so the group is simulated: four participants, each a type everyone
 * meets on the day. The student joins in by typing (or speaking), and at the
 * end is invited to summarise - then sees how they took part: when they came
 * in, whether they built on others, kept it on track, and pulled it together.
 */

const MINUTES = 10;
const date = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

const TYPE_LABEL: Record<GdTopic['type'], string> = { TECH: 'Technology', SOCIAL: 'Society', BUSINESS: 'Business', ABSTRACT: 'Abstract' };

export default function GroupDiscussion() {
  const { hasModule } = useAuth();
  const enabled = hasModule('dev.gd');
  const [topics, setTopics] = useState<GdTopic[] | null>(null);
  const [personas, setPersonas] = useState<GdPersona[]>([]);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [history, setHistory] = useState<GdSessionSummary[]>([]);
  const [session, setSession] = useState<GdSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(() => {
    gdApi
      .sessions()
      .then(setHistory)
      .catch(() => setHistory([]));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    gdApi
      .topics()
      .then((r) => {
        setTopics(r.topics);
        setPersonas(r.personas);
        setAiEnabled(r.aiEnabled);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load group discussions.'));
    loadHistory();
  }, [enabled, loadHistory]);

  async function open(id: string) {
    setError(null);
    try {
      setSession(await gdApi.get(id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not open that discussion.');
    }
  }

  if (!enabled) {
    return (
      <StudentLayout>
        <header className="page-head">
          <div>
            <p className="eyebrow">Practice</p>
            <h1>Group discussion</h1>
            <p className="page-lede">Your institution has not switched on group discussion practice yet.</p>
          </div>
        </header>
      </StudentLayout>
    );
  }

  const leave = () => {
    setSession(null);
    loadHistory();
  };

  return (
    <StudentLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Practice</p>
          <h1>Group discussion</h1>
          <p className="page-lede">
            A ten-minute discussion with four practice participants. Get a point in early, build on what others say, and
            offer the summary at the end.
          </p>
        </div>
        {session && (
          <button type="button" className="btn btn-secondary" onClick={leave}>
            Back to topics
          </button>
        )}
      </header>

      {error && <p className="alert alert-error">{error}</p>}
      {!topics && !error && <p className="muted">Loading…</p>}

      {topics && !session && (
        <Lobby topics={topics} personas={personas} aiEnabled={aiEnabled} history={history} onStarted={setSession} onOpen={open} onError={setError} />
      )}

      {session && session.phase === 'ended' && session.feedback && (
        <Feedback session={session} feedback={session.feedback} personas={personas} onAgain={leave} />
      )}

      {session && session.phase !== 'ended' && <Room session={session} personas={personas} onUpdate={setSession} />}
    </StudentLayout>
  );
}

/* -------------------------------------------------------------------------- */
/* Choosing a topic                                                            */
/* -------------------------------------------------------------------------- */

function Lobby({
  topics,
  personas,
  aiEnabled,
  history,
  onStarted,
  onOpen,
  onError,
}: {
  topics: GdTopic[];
  personas: GdPersona[];
  aiEnabled: boolean;
  history: GdSessionSummary[];
  onStarted: (s: GdSession) => void;
  onOpen: (id: string) => void;
  onError: (m: string | null) => void;
}) {
  const [topicId, setTopicId] = useState('');
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    onError(null);
    try {
      onStarted(await gdApi.start(topicId || undefined));
    } catch (e) {
      onError(e instanceof ApiError ? e.message : 'Could not start a discussion.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="card gd-lobby">
        <h2>Who is in the room</h2>
        <ul className="gd-people">
          {personas.map((p) => (
            <li key={p.key}>
              <Avatar speaker={p.key} name={p.name} />
              <span>
                <strong>{p.name}</strong>
                <small>{p.trait}</small>
              </span>
            </li>
          ))}
        </ul>

        <label className="gd-field">
          <span>Topic</span>
          <select className="input" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
            <option value="">Surprise me - like the real thing</option>
            {(['TECH', 'SOCIAL', 'BUSINESS', 'ABSTRACT'] as const).map((type) => (
              <optgroup key={type} label={TYPE_LABEL[type]}>
                {topics
                  .filter((t) => t.type === type)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>

        <div className="gd-start">
          <p className="gd-privacy">
            {aiEnabled ? 'The participants are played by AI.' : 'The participants follow built-in scripts that react to you.'} Only the
            text is saved, and only you can see it. Feedback is about how you took part - never your accent or grammar.
          </p>
          <button type="button" className="btn btn-primary" onClick={start} disabled={busy}>
            {busy ? 'Opening the room…' : 'Start the discussion'}
          </button>
        </div>
      </section>

      {history.length > 0 && (
        <section className="card gd-history">
          <h2>Your discussions</h2>
          <ul>
            {history.map((h) => (
              <li key={h.id}>
                <button type="button" onClick={() => onOpen(h.id)}>
                  <span>
                    <strong>{h.topic}</strong>
                    <small>
                      {date(h.createdAt)} · {h.endedAt ? 'finished' : 'not finished'}
                    </small>
                  </span>
                  <span className="gd-history-score">{h.score ?? '—'}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* The room                                                                    */
/* -------------------------------------------------------------------------- */

function Avatar({ speaker, name }: { speaker: string; name: string }) {
  return (
    <span className={`gd-avatar gd-av-${speaker}`} aria-hidden="true">
      {name.slice(0, 1)}
    </span>
  );
}

function Room({ session, personas, onUpdate }: { session: GdSession; personas: GdPersona[]; onUpdate: (s: GdSession) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const endRef = useRef<HTMLDivElement | null>(null);

  const append = useCallback((t: string) => setText((a) => (a ? `${a} ${t}` : t)), []);
  const dictation = useDictation(append);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [session.transcript.length]);

  const left = Math.max(0, MINUTES * 60 - Math.round((now - new Date(session.createdAt).getTime()) / 1000));
  const summarising = session.phase === 'summary' || left === 0;
  const nameOf = (speaker: string) =>
    speaker === 'you' ? 'You' : speaker === 'moderator' ? 'Moderator' : (personas.find((p) => p.key === speaker)?.name ?? speaker);
  const lastSpeaker = session.transcript.at(-1)?.speaker;
  const myTurns = session.transcript.filter((t) => t.speaker === 'you').length;

  async function run(action: () => Promise<GdSession>) {
    dictation.stop();
    setBusy(true);
    setError(null);
    try {
      onUpdate(await action());
      setText('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card gd-room">
      <div className="gd-room-top">
        <div>
          <p className="gd-kicker">{TYPE_LABEL[session.topic.type]}</p>
          <h2 className="gd-topic">{session.topic.title}</h2>
        </div>
        <span className={`gd-timer ${left < 60 ? 'is-low' : ''}`} aria-label="Time left">
          {clock(left)}
        </span>
      </div>

      <ul className="gd-seats" aria-label="Participants">
        {personas.map((p) => (
          <li key={p.key} className={lastSpeaker === p.key ? 'is-speaking' : ''}>
            <Avatar speaker={p.key} name={p.name} />
            <span>{p.name}</span>
          </li>
        ))}
        <li className={lastSpeaker === 'you' ? 'is-speaking' : ''}>
          <Avatar speaker="you" name="You" />
          <span>You · {myTurns}</span>
        </li>
      </ul>

      <div className="gd-log" aria-live="polite">
        {session.transcript.map((t, i) => (
          <div key={i} className={`gd-turn gd-turn-${t.speaker === 'you' ? 'you' : t.speaker === 'moderator' ? 'mod' : 'them'}`}>
            {t.speaker !== 'you' && t.speaker !== 'moderator' && <Avatar speaker={t.speaker} name={nameOf(t.speaker)} />}
            <div className="gd-bubble">
              <span className="gd-who">{t.kind === 'summary' ? 'Your summary' : nameOf(t.speaker)}</span>
              <p>{t.text}</p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {summarising && (
        <p className="gd-cue">
          {left === 0 && session.phase !== 'summary' ? 'Time is up. ' : ''}
          Offer the summary: both sides in a sentence each, then where the group landed. Taking the summary is one of the
          strongest things you can do in a GD.
        </p>
      )}
      {!summarising && myTurns === 0 && (
        <p className="gd-cue gd-cue-soft">Tip: come in within the first few turns - a short point is enough. Try “Building on Arjun’s point…”.</p>
      )}

      <textarea
        className="input gd-input"
        rows={summarising ? 5 : 3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={summarising ? 'To summarise, we heard…' : dictation.supported ? 'Make your point - type, or press Speak.' : 'Make your point.'}
        aria-label={summarising ? 'Your summary' : 'Your point'}
      />
      {dictation.problem && <p className="gd-problem">{dictation.problem}</p>}
      {error && <p className="alert alert-error">{error}</p>}

      <div className="gd-actions">
        {dictation.supported && (
          <button
            type="button"
            className={`btn btn-secondary gd-mic ${dictation.listening ? 'is-on' : ''}`}
            onClick={dictation.listening ? dictation.stop : dictation.start}
            aria-pressed={dictation.listening}
          >
            <span className="gd-mic-dot" aria-hidden="true" />
            {dictation.listening ? 'Stop' : 'Speak'}
          </button>
        )}
        <span className="gd-spacer" />
        {summarising ? (
          <>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => run(() => gdApi.finish(session.id))}>
              Finish without summary
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || text.trim().length < 2}
              onClick={() => run(() => gdApi.finish(session.id, text.trim()))}
            >
              {busy ? 'Reviewing…' : 'Give summary & finish'}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => run(() => gdApi.pass(session.id))}>
              Listen - let others speak
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || text.trim().length < 2}
              onClick={() => run(() => gdApi.speak(session.id, text.trim()))}
            >
              {busy ? 'Speaking…' : 'Say it'}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Feedback                                                                    */
/* -------------------------------------------------------------------------- */

function Feedback({
  session,
  feedback,
  personas,
  onAgain,
}: {
  session: GdSession;
  feedback: GdFeedback;
  personas: GdPersona[];
  onAgain: () => void;
}) {
  const m = feedback.metrics;
  const r = 26;
  const c = 2 * Math.PI * r;
  const signals: { label: string; ok: boolean }[] = [
    { label: m.enteredAt ? `Came in at turn ${m.enteredAt}` : 'Did not come in', ok: m.enteredAt !== null && m.enteredAt <= 3 },
    { label: m.referencedOthers ? `Built on others ×${m.referencedOthers}` : 'Built on others', ok: m.referencedOthers > 0 },
    { label: 'Brought it back on topic', ok: m.broughtBackOnTopic },
    { label: 'Used an example', ok: m.usedExamples },
    { label: 'Gave the summary', ok: m.summarised },
  ];
  const balance = m.share > 45 ? 'Dominated' : m.share < 10 ? 'Too quiet' : 'Balanced';

  return (
    <section className="card gd-feedback">
      <div className="gd-fb-head">
        <svg className="gd-ring" viewBox="0 0 64 64" role="img" aria-label={`Score ${feedback.score} out of 100`}>
          <circle cx="32" cy="32" r={r} className="gd-ring-bg" />
          <circle cx="32" cy="32" r={r} className="gd-ring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - feedback.score / 100)} />
          <text x="32" y="37" textAnchor="middle">
            {feedback.score}
          </text>
        </svg>
        <div>
          <p className="gd-kicker">How you took part</p>
          <h2>{session.topic.title}</h2>
          <span className={`pill ${feedback.source === 'ai' ? 'pill-pass' : 'pill-idle'}`}>
            {feedback.source === 'ai' ? 'AI feedback' : 'Built-in feedback'}
          </span>
          {feedback.fellBack && <small className="gd-note"> AI feedback was unavailable this time.</small>}
        </div>
      </div>

      <h3 className="gd-h">What worked</h3>
      <ul className="gd-list gd-good">
        {feedback.strengths.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>

      {feedback.improvements.length > 0 && (
        <>
          <h3 className="gd-h">Try next time</h3>
          <ul className="gd-list gd-next">
            {feedback.improvements.map((i) => (
              <li key={i.title}>
                <strong>{i.title}.</strong> {i.tip}
              </li>
            ))}
          </ul>
        </>
      )}

      <ul className="gd-signals">
        {signals.map((s) => (
          <li key={s.label} className={s.ok ? 'is-ok' : ''}>
            <span aria-hidden="true">{s.ok ? '✓' : '○'}</span> {s.label}
          </li>
        ))}
      </ul>

      <div className="gd-share">
        <div className="gd-share-label">
          <span>Your share of the talking</span>
          <strong>
            {m.share}% · {balance}
          </strong>
        </div>
        <div className="gd-share-bar" aria-hidden="true">
          <span className="gd-share-zone" />
          <span className="gd-share-you" style={{ width: `${Math.min(100, m.share)}%` }} />
        </div>
        <small>
          {m.contributions} contributions, about {m.avgWords} words each. With five people, 15-35% is a good share.
        </small>
      </div>

      <details className="gd-transcript">
        <summary>Read the discussion again</summary>
        {session.transcript.map((t, i) => (
          <p key={i}>
            <b>{t.speaker === 'you' ? (t.kind === 'summary' ? 'Your summary' : 'You') : t.speaker === 'moderator' ? 'Moderator' : (personas.find((p) => p.key === t.speaker)?.name ?? t.speaker)}:</b> {t.text}
          </p>
        ))}
      </details>

      <div className="gd-actions">
        <span className="gd-spacer" />
        <button type="button" className="btn btn-primary" onClick={onAgain}>
          Try another topic
        </button>
      </div>
    </section>
  );
}
