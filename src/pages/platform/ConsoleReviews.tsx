import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { reviewApi, type ReviewItem } from '../../api/studentApp';
import { simulationCheckApi, type SimToCheck } from '../../api/companyApp';
import ConsoleHeader from './ConsoleHeader';
import './Platform.css';

/**
 * Work simulations waiting for a reviewer.
 *
 * Every task's answer and link, then the student's own explanation, then
 * the decision. Approving issues a verified certificate; asking for changes
 * needs a note, because the student has to know what to fix.
 */
export default function ConsoleReviews() {
  const [tab, setTab] = useState<'simulations' | 'work'>('simulations');
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [sims, setSims] = useState<SimToCheck[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    reviewApi
      .queue()
      .then((r) => setItems(r.reviews))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load the reviews.'));
    simulationCheckApi
      .queue()
      .then(setSims)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load the simulations.'));
  }, []);

  useEffect(load, [load]);

  return (
    <div className="console">
      <ConsoleHeader />
      <main className="console-main">
        <section className="console-hero">
          <div>
            <p className="eyebrow">Reviews</p>
            <h1>Waiting for a decision.</h1>
            <p className="console-lede">
              Companies&apos; simulations before students see them, and students&apos; work - which each company reviews
              itself; step in here when one is stuck.
            </p>
          </div>
        </section>

        <div className="console-bar">
          <div className="seg" role="tablist" aria-label="Reviews">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'simulations'}
              className={`seg-opt ${tab === 'simulations' ? 'is-on' : ''}`}
              onClick={() => setTab('simulations')}
            >
              Simulations to check {sims ? `(${sims.length})` : ''}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'work'}
              className={`seg-opt ${tab === 'work' ? 'is-on' : ''}`}
              onClick={() => setTab('work')}
            >
              Students&apos; work {items ? `(${items.length})` : ''}
            </button>
          </div>
        </div>

        {error && <p className="notice notice-stop">{error}</p>}

        {tab === 'simulations' && (
          <>
            {!sims && !error && <p className="muted">Loading…</p>}
            {sims && sims.length === 0 && (
              <p className="rv-empty">No simulations waiting. When a company sends one, it appears here.</p>
            )}
            {sims && sims.length > 0 && (
              <ul className="rv-list">
                {sims.map((s) => (
                  <SimulationCheck key={s.id} sim={s} onDone={setSims} />
                ))}
              </ul>
            )}
          </>
        )}

        {tab === 'work' && (
          <>
            {!items && !error && <p className="muted">Loading…</p>}
            {items && items.length === 0 && <p className="rv-empty">Nothing waiting. New hand-ins appear here.</p>}
            {items && items.length > 0 && (
              <ul className="rv-list">
                {items.map((r) => (
                  <Review key={r.runId} item={r} onDone={setItems} />
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Review({ item: r, onDone }: { item: ReviewItem; onDone: (next: ReviewItem[]) => void }) {
  const [note, setNote] = useState('');
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: 'approve' | 'changes') {
    setBusy(true);
    setError(null);
    try {
      onDone((await reviewApi.decide(r.runId, decision, note.trim() || undefined)).reviews);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save the decision.');
      setBusy(false);
    }
  }

  return (
    <li className="rv-item">
      <header className="rv-head">
        <div>
          <h2>{r.simulation.title}</h2>
          <p className="muted">
            {r.simulation.company} · sent {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString('en-IN') : ''}
          </p>
        </div>
        <div className="rv-who">
          <b>{r.student.name}</b>
          <span>{r.student.email}</span>
          {r.student.college && <span>{r.student.college}</span>}
        </div>
      </header>

      <ol className="rv-tasks">
        {r.tasks.map((t) => (
          <li key={t.id}>
            <h3>
              {t.position}. {t.title}
            </h3>
            <p className="rv-brief">{t.brief}</p>
            {t.checks.length > 0 && (
              <p className="rv-brief">
                Quick checks:{' '}
                {t.checks.map((c) => `${c.title} ${c.score === null ? 'not answered' : c.total ? `${c.score}/${c.total}` : 'written'}`).join(' · ')}
              </p>
            )}
            {t.checks.flatMap((c) => c.written).filter((w) => w.answer).map((w, i) => (
              <div key={i} className="rv-written">
                <b>{w.prompt}</b>
                <p>{w.answer}</p>
              </div>
            ))}
            {t.answer && <p className="rv-answer">{t.answer}</p>}
            {t.link && (
              <a href={t.link} target="_blank" rel="noreferrer" className="rv-link">
                {t.link} ↗
              </a>
            )}
            {t.fileUrl && (
              <a href={t.fileUrl} target="_blank" rel="noreferrer" className="rv-link">
                File: {t.fileName ?? 'attached'} ↗
              </a>
            )}
          </li>
        ))}
      </ol>

      <div className="rv-explain">
        <h3>How they went about it</h3>
        <p>{r.explainHow}</p>
        <h3>What they would do differently</h3>
        <p>{r.explainChange}</p>
      </div>

      {error && <p className="notice notice-stop">{error}</p>}
      {asking ? (
        <div className="rv-ask">
          <textarea
            className="input"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What needs changing, and in which task."
            autoFocus
          />
          <div className="rv-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setAsking(false)} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={() => decide('changes')} disabled={busy || !note.trim()}>
              Send back to the student
            </button>
          </div>
        </div>
      ) : (
        <div className="rv-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setAsking(true)} disabled={busy}>
            Ask for changes
          </button>
          <button type="button" className="btn btn-primary" onClick={() => decide('approve')} disabled={busy}>
            {busy ? 'Saving…' : 'Approve and issue certificate'}
          </button>
        </div>
      )}
    </li>
  );
}

/**
 * A company's simulation before students see it: is it clear, fair, and the
 * size it says? Make it live, or send it back to the company with a note.
 */
function SimulationCheck({ sim: s, onDone }: { sim: SimToCheck; onDone: (next: SimToCheck[]) => void }) {
  const [note, setNote] = useState('');
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const minutes = s.tasks.reduce((n, t) => n + t.minutes, 0);

  async function decide(decision: 'approve' | 'changes') {
    setBusy(true);
    setError(null);
    try {
      onDone(await simulationCheckApi.decide(s.id, decision, note.trim() || undefined));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save the decision.');
      setBusy(false);
    }
  }

  return (
    <li className="rv-item">
      <header className="rv-head">
        <div>
          <h2>{s.title}</h2>
          <p className="muted">
            {s.field} · {s.level.toLowerCase()} · says {s.hours} hrs, tasks add up to {Math.round(minutes / 6) / 10} hrs
          </p>
        </div>
        <div className="rv-who">
          <b>{s.company.name}</b>
          <span>{s.company.status === 'VERIFIED' ? 'Verified company' : `Company ${s.company.status.toLowerCase()}`}</span>
          <span>sent {s.submittedAt ? new Date(s.submittedAt).toLocaleDateString('en-IN') : ''}</span>
        </div>
      </header>

      <p className="rv-answer">{s.summary}</p>
      {s.skills.length > 0 && <p className="muted">Skills: {s.skills.join(', ')}</p>}

      <ol className="rv-tasks">
        {s.tasks.map((t) => (
          <li key={t.position}>
            <h3>
              {t.position}. {t.title} <span className="muted">· {t.minutes} min</span>
            </h3>
            <p className="rv-answer">{t.brief}</p>
            {t.learn.length > 0 && <p className="rv-brief">Learn: {t.learn.join(' · ')}</p>}
            {t.steps.length > 0 && <p className="rv-brief">Steps: {t.steps.map((x, i) => `${i + 1}. ${x}`).join('  ')}</p>}
            {t.handIn && <p className="rv-brief">Hand in: {t.handIn}</p>}
          </li>
        ))}
      </ol>

      {error && <p className="notice notice-stop">{error}</p>}
      {asking ? (
        <div className="rv-ask">
          <textarea
            className="input"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What the company should change before it goes live."
            autoFocus
          />
          <div className="rv-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setAsking(false)} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={() => decide('changes')} disabled={busy || !note.trim()}>
              Send back to the company
            </button>
          </div>
        </div>
      ) : (
        <div className="rv-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setAsking(true)} disabled={busy}>
            Ask for changes
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => decide('approve')}
            disabled={busy || s.company.status !== 'VERIFIED'}
            title={s.company.status !== 'VERIFIED' ? 'Verify the company first, in Companies' : undefined}
          >
            {busy ? 'Saving…' : 'Make it live'}
          </button>
        </div>
      )}
    </li>
  );
}
