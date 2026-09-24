import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from './StudentLayout';
import { ApiError } from '../../api/client';
import { wellbeingApi, type WellbeingState } from '../../api/growth';
import { useAuth } from '../../auth/AuthContext';
import './Wellbeing.css';

/**
 * Confidence and wellbeing: a private corner of the portal for the part of
 * placements nobody grades. A ladder of small practice steps, a ten-minute
 * warm-up for the day itself, a journal of wins, a mood check-in whose trend
 * only the student sees, kind words after a rejection, and a way to reach a
 * real person when it is too much. Nothing here is shared with anyone - there
 * is no campus or company view of it at all, and the page says so.
 */

const date = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

const MOODS = [
  { score: 1, face: '😞', label: 'Rough' },
  { score: 2, face: '😕', label: 'Low' },
  { score: 3, face: '😐', label: 'Okay' },
  { score: 4, face: '🙂', label: 'Good' },
  { score: 5, face: '😄', label: 'Great' },
];

/** Tele-MANAS's official site - the page shows its name and this link, never a number typed in here. */
const TELE_MANAS_URL = 'https://telemanas.mohfw.gov.in/';

export default function Wellbeing() {
  const { hasModule } = useAuth();
  const enabled = hasModule('dev.confidence');
  const [state, setState] = useState<WellbeingState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    wellbeingApi
      .get()
      .then(setState)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load this page.'));
  }, []);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  if (!enabled) {
    return (
      <StudentLayout>
        <header className="page-head">
          <div>
            <p className="eyebrow">You</p>
            <h1>Confidence & wellbeing</h1>
            <p className="page-lede">Your institution has not switched this on yet.</p>
          </div>
        </header>
        <TalkCard />
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">You</p>
          <h1>Confidence & wellbeing</h1>
          <p className="page-lede">Placements are a lot. This is a quiet space to prepare, notice what is going well, and look after yourself.</p>
        </div>
      </header>

      <p className="wb-private" role="note">
        <span aria-hidden="true">🔒</span> Private to you. Nothing on this page is shared with your placement cell, your college or any
        company - not your mood, not your wins, not your progress.
      </p>

      {error && <p className="alert alert-error">{error}</p>}
      {!state && !error && <p className="muted">Loading…</p>}

      {state && (
        <>
          {state.recentRejection && <AfterRejection rejection={state.recentRejection} />}
          <div className="wb-grid">
            <MoodCard moods={state.moods} onSaved={load} />
            <Ladder steps={state.ladder} onChange={load} />
          </div>
          <WarmUp />
          <Wins wins={state.wins} onChange={load} />
        </>
      )}

      <TalkCard />
    </StudentLayout>
  );
}

/* -------------------------------------------------------------------------- */
/* Mood                                                                        */
/* -------------------------------------------------------------------------- */

function MoodCard({ moods, onSaved }: { moods: WellbeingState['moods']; onSaved: () => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const today = moods.filter((m) => new Date(m.createdAt).toDateString() === new Date().toDateString()).at(-1);

  async function save() {
    if (!picked) return;
    setBusy(true);
    try {
      await wellbeingApi.mood(picked, note.trim() || undefined);
      setSaved(true);
      setPicked(null);
      setNote('');
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  const points = useMemo(() => {
    if (moods.length < 2) return '';
    const w = 280;
    const h = 60;
    return moods.map((m, i) => `${(i / (moods.length - 1)) * w},${h - ((m.score - 1) / 4) * h}`).join(' ');
  }, [moods]);

  return (
    <section className="card wb-mood">
      <h2>How are you feeling today?</h2>
      {today && !picked && (
        <p className="wb-soft">
          You checked in today: {MOODS[today.score - 1]!.face} {MOODS[today.score - 1]!.label}. You can check in again any time.
        </p>
      )}
      <div className="wb-faces" role="radiogroup" aria-label="Mood">
        {MOODS.map((m) => (
          <button
            key={m.score}
            type="button"
            role="radio"
            aria-checked={picked === m.score}
            className={`wb-face ${picked === m.score ? 'is-on' : ''}`}
            onClick={() => {
              setPicked(m.score);
              setSaved(false);
            }}
          >
            <span aria-hidden="true">{m.face}</span>
            <small>{m.label}</small>
          </button>
        ))}
      </div>
      {picked && (
        <div className="wb-mood-save">
          <input
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder="Anything on your mind? (optional)"
            aria-label="A note for yourself"
          />
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
            Save
          </button>
        </div>
      )}
      {saved && <p className="wb-soft">Thanks for checking in.</p>}
      {picked !== null && picked <= 2 && (
        <p className="wb-soft">Rough days happen, especially now. If it keeps feeling this way, the card at the bottom of this page has people who can help.</p>
      )}

      {points ? (
        <figure className="wb-trend">
          <svg viewBox="-6 -6 292 72" role="img" aria-label="Your mood over the last 30 days, oldest to newest">
            <line x1="0" x2="280" y1="30" y2="30" className="wb-trend-mid" />
            <polyline points={points} />
          </svg>
          <figcaption>Your last 30 days - only you can see this.</figcaption>
        </figure>
      ) : (
        <p className="wb-soft">Check in on a few days and your trend appears here - only you can see it.</p>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Practice ladder                                                             */
/* -------------------------------------------------------------------------- */

function Ladder({ steps, onChange }: { steps: WellbeingState['ladder']; onChange: () => void }) {
  const { hasModule } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const done = steps.filter((s) => s.done).length;

  async function toggle(key: string, value: boolean) {
    setBusy(key);
    try {
      await wellbeingApi.tick(key, value);
      onChange();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card wb-ladder">
      <h2>Your practice ladder</h2>
      <p className="wb-soft">
        Small steps, from least scary to the real thing. {done === 0 ? 'Start at the bottom rung.' : `${done} of ${steps.length} done - keep climbing.`}
      </p>
      <ol>
        {steps.map((s) => {
          const linkable = !s.module || hasModule(s.module);
          return (
            <li key={s.key} className={s.done ? 'is-done' : ''}>
              <label>
                <input type="checkbox" checked={s.done} disabled={busy === s.key} onChange={(e) => toggle(s.key, e.target.checked)} />
                <span>{s.label}</span>
              </label>
              {linkable && !s.done && (
                <Link to={s.to} className="wb-go">
                  Go
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Ten-minute warm-up                                                          */
/* -------------------------------------------------------------------------- */

const BREATH = ['Breathe in', 'Hold', 'Breathe out', 'Hold'];
const ROUNDS = 4;

function Breathing() {
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [running]);

  const phase = Math.floor(tick / 4) % 4;
  const round = Math.floor(tick / 16) + 1;
  const count = 4 - (tick % 4);

  useEffect(() => {
    if (round > ROUNDS) {
      setRunning(false);
      setTick(0);
    }
  }, [round]);

  return (
    <div className="wb-breath">
      <div className={`wb-box ${running ? `is-running wb-phase-${phase}` : ''}`} aria-hidden="true">
        <span className="wb-box-dot" />
        <span className="wb-box-core" />
      </div>
      <div>
        <p className="wb-breath-label" aria-live="polite">
          {running ? `${BREATH[phase]} · ${count}` : 'Box breathing: in 4, hold 4, out 4, hold 4.'}
        </p>
        <p className="wb-soft">{running ? `Round ${Math.min(round, ROUNDS)} of ${ROUNDS}` : 'Follow the dot around the square. About a minute.'}</p>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setTick(0);
            setRunning((r) => !r);
          }}
        >
          {running ? 'Stop' : 'Start breathing'}
        </button>
      </div>
    </div>
  );
}

const CHECKLIST = [
  'Printed CV - two copies',
  'College ID and any documents asked for',
  'Phone charged, on silent',
  'Water and something to eat',
  'Route checked - aim to arrive 20 minutes early',
];

function WarmUp() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setDone((d) => ({ ...d, [k]: !d[k] }));

  return (
    <section className="card wb-warmup">
      <div className="wb-warmup-head">
        <div>
          <h2>Ten-minute warm-up</h2>
          <p className="wb-soft">For the morning of an interview or a GD. Do it in the corridor if you need to.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Close' : 'Start warm-up'}
        </button>
      </div>

      {open && (
        <ol className="wb-steps">
          <li>
            <h3>Breathe</h3>
            <Breathing />
          </li>
          <li>
            <h3>Say your introduction once, out loud</h3>
            <p>Your name, what you study, one thing you have done that you are proud of, and what you are looking for. About a minute.</p>
            <label className="wb-check">
              <input type="checkbox" checked={!!done.intro} onChange={() => toggle('intro')} /> Done
            </label>
          </li>
          <li>
            <h3>Look over three stories</h3>
            <p>Have three short stories ready - they answer most questions:</p>
            {['A challenge you handled', 'A time you worked in a team', 'Something you built or improved'].map((s) => (
              <label key={s} className="wb-check">
                <input type="checkbox" checked={!!done[s]} onChange={() => toggle(s)} /> {s}
              </label>
            ))}
          </li>
          <li>
            <h3>Checklist</h3>
            {CHECKLIST.map((c) => (
              <label key={c} className="wb-check">
                <input type="checkbox" checked={!!done[c]} onChange={() => toggle(c)} /> {c}
              </label>
            ))}
          </li>
          <li>
            <h3>Name the feeling</h3>
            <p>
              A racing heart and butterflies feel the same whether you are nervous or excited. Try telling yourself “I’m excited” - it
              points that energy towards the room instead of away from it.
            </p>
          </li>
        </ol>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Wins                                                                        */
/* -------------------------------------------------------------------------- */

function Wins({ wins, onChange }: { wins: WellbeingState['wins']; onChange: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      await wellbeingApi.addWin(text.trim());
      setText('');
      onChange();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save that.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card wb-wins">
      <h2>Wins journal</h2>
      <p className="wb-soft">Cleared a round, finished a practice set, asked a good question? Write it down. On hard days, read this list.</p>
      <div className="wb-win-add">
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="Something that went well, however small"
          aria-label="A win"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && text.trim().length >= 2) add();
          }}
        />
        <button type="button" className="btn btn-primary" onClick={add} disabled={busy || text.trim().length < 2}>
          Add
        </button>
      </div>
      {error && <p className="alert alert-error">{error}</p>}
      {wins.length > 0 && (
        <ul className="wb-win-list">
          {wins.map((w) => (
            <li key={w.id}>
              <span className="wb-star" aria-hidden="true">
                ★
              </span>
              <span className="wb-win-text">
                {w.text}
                <small>{date(w.createdAt)}</small>
              </span>
              <button type="button" className="wb-remove" onClick={() => wellbeingApi.removeWin(w.id).then(onChange)} aria-label={`Remove "${w.text}"`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* After a rejection, and when it is too much                                  */
/* -------------------------------------------------------------------------- */

function AfterRejection({ rejection }: { rejection: NonNullable<WellbeingState['recentRejection']> }) {
  return (
    <section className="card wb-after">
      <h2>Not this time at {rejection.company} - and that is okay.</h2>
      <p>
        A “no” for {rejection.role} is about one role on one day, not about you. Almost everyone who gets placed hears several of these
        first; each one is practice for the one that says yes.
      </p>
      <p className="wb-next">
        <strong>One next step:</strong> write down one thing you would do differently, then add one thing that went well to your wins
        journal below. Tomorrow, pick one rung on your ladder.
      </p>
    </section>
  );
}

function TalkCard() {
  return (
    <section className="card wb-talk">
      <h2>Need to talk?</h2>
      <p>
        If things feel heavy, you do not have to carry it alone. Ask your placement cell for the <strong>college counsellor</strong> -
        talking to someone is a strong thing to do, and it stays confidential.
      </p>
      <p>
        You can also reach <strong>Tele-MANAS</strong>, the Government of India’s free mental-health support service. Its contact details
        are on its{' '}
        <a href={TELE_MANAS_URL} target="_blank" rel="noopener noreferrer">
          official website
        </a>
        .
      </p>
      <p className="wb-soft">If you are in immediate danger, contact local emergency services or go to the nearest hospital.</p>
    </section>
  );
}
