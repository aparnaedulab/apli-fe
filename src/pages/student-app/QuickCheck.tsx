import { useEffect, useState } from 'react';
import type { Answers, CheckTry, MarkedCheck, StudentPage, StudentQuestion } from '../../api/taskPages';
import TestIntro, { KINDS, kindOf } from './TestIntro';
import { Choice, LETTERS, Order, Sort, Written } from './QuestionInputs';

type Check = Extract<StudentPage, { kind: 'check' }>;

const nums = (a: number[] | string | undefined): number[] | undefined => (Array.isArray(a) ? a : undefined);
const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

/** An order question's answer: the shown items, in the order the student has them. Untouched is as shown. */
const orderOf = (q: Extract<StudentQuestion, { kind: 'order' }>, answers: Answers) => nums(answers[q.id]) ?? q.items.map((_, i) => i);

function answered(q: StudentQuestion, answers: Answers): boolean {
  const a = answers[q.id];
  if (q.kind === 'text') return typeof a === 'string' && a.trim().length > 0 && words(a) >= q.minWords;
  const n = nums(a);
  if (q.kind === 'choice') return Boolean(n?.length);
  if (q.kind === 'sort') return Boolean(n && n.length === q.items.length && !n.includes(-1));
  return true;
}

/**
 * One quick check, across the screen.
 *
 * Left: every question - its number, a line of it, and whether it is
 * answered (or, once checked, right or not); click to jump. Centre: the
 * question in hand, with Previous / Next (or Check my answers) pinned to the
 * bottom so nothing needs scrolling to move on. Right: how to answer this
 * kind of question, in short steps - and, once checked, the score and tries.
 *
 * Choose-the-answer questions are lettered cards. The two kinds that are
 * about arranging things are dragged: cards into groups, or cards into
 * order. Every drag also works without one - tap a card, then where it goes;
 * or use the arrows - so a phone or a keyboard is never stuck.
 *
 * The whole check is marked by the server at once. Afterwards each question
 * says right or not - but not what the right answer is - and the test can be
 * taken again as often as the student likes. When they are done they can
 * see the answers, which closes the test. Any try can be sent to the company.
 */
export default function QuickCheck({
  page,
  marked,
  company,
  canAnswer,
  busy,
  onSubmit,
  onReveal,
  onSend,
}: {
  page: Check;
  marked: MarkedCheck | undefined;
  /** The company behind the simulation: tries are sent to it. */
  company: string;
  canAnswer: boolean;
  busy: boolean;
  onSubmit: (answers: Answers) => Promise<boolean>;
  onReveal: () => Promise<boolean>;
  onSend: (attempt: number) => Promise<boolean>;
}) {
  const [answers, setAnswers] = useState<Answers>(() => marked?.answers ?? {});
  const [reviewing, setReviewing] = useState(Boolean(marked));
  const [at, setAt] = useState(0);
  // The onboarding comes first, unless they have already answered this test.
  const [intro, setIntro] = useState(!marked);

  const q = page.questions[at]!;
  const total = page.questions.length;
  const result = reviewing ? marked : undefined;
  const r = result?.questions[q.id];
  const allAnswered = page.questions.every((x) => answered(x, answers));
  const answeredCount = page.questions.filter((x) => answered(x, answers)).length;
  const locked = Boolean(result) || !canAnswer;
  const kind = KINDS.find((k) => k.key === kindOf(q))!;

  const set = (qid: string, value: number[] | string) => setAnswers((a) => ({ ...a, [qid]: value }));
  const graded = page.questions.some((x) => x.kind !== 'text');
  // The right answers are drawn only once the student has asked to see them.
  const solution = result?.revealed ? r?.solution : undefined;

  function again() {
    setReviewing(false);
    setAnswers({});
    setAt(0);
  }

  async function check() {
    // An order question left as shown is still an answer.
    const full = { ...answers };
    for (const x of page.questions) if (x.kind === 'order' && !full[x.id]) full[x.id] = orderOf(x, answers);
    if (await onSubmit(full)) {
      setAnswers(full);
      setReviewing(true);
      setAt(0);
    }
  }

  // Keyboard: ← → move between questions; A-H (or 1-8) pick an answer.
  useEffect(() => {
    if (intro) return;
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight' && at < total - 1) {
        e.preventDefault();
        setAt(at + 1);
      } else if (e.key === 'ArrowLeft' && at > 0) {
        e.preventDefault();
        setAt(at - 1);
      } else if (q.kind === 'choice' && !locked) {
        const k = e.key.toUpperCase();
        const i = LETTERS.indexOf(k) >= 0 && k.length === 1 ? LETTERS.indexOf(k) : /^[1-8]$/.test(e.key) ? Number(e.key) - 1 : -1;
        if (i >= 0 && i < q.options.length) {
          e.preventDefault();
          const given = nums(answers[q.id]) ?? [];
          set(q.id, q.multiple ? (given.includes(i) ? given.filter((x) => x !== i) : [...given, i]) : [i]);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (intro) return <TestIntro page={page} onStart={() => setIntro(false)} again={Object.keys(answers).length > 0} />;

  const stateOf = (x: StudentQuestion) => {
    const res = result?.questions[x.id];
    if (res) return res.correct === null ? 'is-sent' : res.correct ? 'is-right' : 'is-wrong';
    return answered(x, answers) && (x.kind !== 'order' || answers[x.id]) ? 'is-answered' : '';
  };

  return (
    <section className="qc is-wide">
      {/* Every question, and where they are. */}
      <aside className="qc-nav" aria-label="Questions">
        <div className="qc-nav-head">
          <b>{result ? (graded ? `${result.score} of ${result.total} right` : 'Checked') : `${answeredCount} of ${total} answered`}</b>
          <div className="tp-bar">
            <span style={{ width: `${Math.round(((result ? result.score : answeredCount) / Math.max(1, result ? result.total : total)) * 100)}%` }} />
          </div>
        </div>
        <ol className="qc-nav-list">
          {page.questions.map((x, i) => {
            const st = stateOf(x);
            return (
              <li key={x.id}>
                <button
                  type="button"
                  className={`${i === at ? 'is-on' : ''} ${st}`}
                  onClick={() => setAt(i)}
                  aria-current={i === at ? 'step' : undefined}
                >
                  <span className="qc-nav-n">
                    {st === 'is-right' ? '✓' : st === 'is-wrong' ? '✗' : st === 'is-answered' ? '✓' : i + 1}
                  </span>
                  <span className="qc-nav-text">
                    <b>Question {i + 1}</b>
                    <span>{x.prompt}</span>
                    <i>{KINDS.find((k) => k.key === kindOf(x))!.title}</i>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <button type="button" className="qc-howto" onClick={() => setIntro(true)}>
          ? How this test works
        </button>
      </aside>

      {/* The question in hand. */}
      <div className="qc-stage">
        <header className="qc-head">
          <div>
            <p className="qc-count">
              Question {at + 1} of {total}
            </p>
            <h2>{page.title}</h2>
          </div>
          {result && (
            <span className={`qc-score ${!graded || result.score === result.total ? 'is-full' : ''}`}>
              {graded ? `${result.score} of ${result.total} right` : 'Sent to your reviewer'}
            </span>
          )}
        </header>

        <div className={`qc-card ${r && r.correct !== null ? (r.correct ? 'is-right' : 'is-wrong') : ''}`} key={q.id}>
          <span className="qc-hint">
            {kind.picture}
            {kind.title}
            {q.kind === 'choice' && q.multiple ? ' - more than one can be right' : ''}
          </span>
          <p className="qc-prompt">{q.prompt}</p>

          {q.kind === 'text' && (
            <Written q={q} given={typeof answers[q.id] === 'string' ? (answers[q.id] as string) : ''} locked={locked} onChange={(v) => set(q.id, v)} />
          )}
          {q.kind === 'choice' && (
            <Choice q={q} given={nums(answers[q.id]) ?? []} solution={solution} locked={locked} onChange={(v) => set(q.id, v)} />
          )}
          {q.kind === 'sort' && (
            <Sort q={q} given={nums(answers[q.id])} solution={solution} locked={locked} onChange={(v) => set(q.id, v)} />
          )}
          {q.kind === 'order' && (
            <Order q={q} given={orderOf(q, answers)} solution={solution} locked={locked} onChange={(v) => set(q.id, v)} />
          )}

          {r && r.correct === null && (
            <p className="qc-feedback is-sent">
              <b>Sent to your reviewer.</b> Written answers are read by a person, not marked here.
              {result?.revealed && r.explain ? ` What they are looking for: ${r.explain}` : ''}
            </p>
          )}
          {r && r.correct !== null && (
            <p className={`qc-feedback ${r.correct ? 'is-right' : 'is-wrong'}`}>
              <b>{r.correct ? 'Right.' : 'Not quite.'}</b>{' '}
              {result?.revealed
                ? (r.explain ?? (r.correct ? '' : 'The right answer is shown.'))
                : r.correct
                  ? ''
                  : 'Take the test again, or see the answers when you are done.'}
            </p>
          )}
        </div>

        {!result && canAnswer && at === total - 1 && !allAnswered && (
          <p className="qc-left">
            Still to answer:{' '}
            {page.questions
              .map((x, i) => (answered(x, answers) ? null : i))
              .filter((i): i is number => i !== null)
              .map((i) => (
                <button key={i} type="button" className="sa-link is-small" onClick={() => setAt(i)}>
                  Question {i + 1}
                </button>
              ))}
          </p>
        )}

        {/* Always at the bottom of the screen: no scrolling to move on. */}
        <footer className="qc-foot">
          <button type="button" className="sa-quiet" onClick={() => setAt(at - 1)} disabled={at === 0}>
            <span aria-hidden="true">←</span> Previous
          </button>
          <span className="qc-foot-mid">
            {!result && canAnswer ? `${answeredCount} of ${total} answered` : `Question ${at + 1} of ${total}`}
          </span>
          {at < total - 1 ? (
            <button type="button" className="sa-btn" onClick={() => setAt(at + 1)}>
              Next question <span aria-hidden="true">→</span>
            </button>
          ) : !result && canAnswer ? (
            <button
              type="button"
              className="sa-btn"
              onClick={check}
              disabled={busy || !allAnswered}
              title={allAnswered ? undefined : 'Answer every question first'}
            >
              {busy ? 'Checking…' : 'Check my answers'}
            </button>
          ) : (
            <span />
          )}
        </footer>
      </div>

      {/* Beside the question: how to answer it, and - once checked - the result. */}
      <aside className="qc-side" aria-label="Help">
        {result && (
          <Results
            marked={result}
            graded={graded}
            company={company}
            canRetake={canAnswer && !result.revealed}
            busy={busy}
            onRetake={again}
            onReveal={onReveal}
            onSend={onSend}
          />
        )}
        <div className="tp-card qc-how">
          <h3>
            How to answer <span className="tp-card-count">{kind.title}</span>
          </h3>
          <div className="qc-how-pic">{kind.picture}</div>
          <ol className="qc-how-steps">
            {kind.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          {kind.phone && <p className="tp-card-hint">{kind.phone}</p>}
        </div>
        <div className="tp-card tp-keys">
          <h3>Shortcuts</h3>
          <p>
            <kbd>←</kbd> <kbd>→</kbd> previous / next question
          </p>
          {q.kind === 'choice' && (
            <p>
              <kbd>A</kbd>–<kbd>{LETTERS[q.options.length - 1]}</kbd> pick an answer
            </p>
          )}
        </div>
      </aside>
    </section>
  );
}

const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/**
 * After a try: the score, every try so far, and what can be done next -
 * take it again, see the answers (which closes the test), or send a try to
 * the company.
 */
function Results({
  marked,
  graded,
  company,
  canRetake,
  busy,
  onRetake,
  onReveal,
  onSend,
}: {
  marked: MarkedCheck;
  graded: boolean;
  company: string;
  canRetake: boolean;
  busy: boolean;
  onRetake: () => void;
  onReveal: () => Promise<boolean>;
  onSend: (attempt: number) => Promise<boolean>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pick, setPick] = useState<number | null>(null);
  const tries = marked.tries;
  const latest: CheckTry | undefined = tries[tries.length - 1];
  const unsent = tries.filter((t) => !t.sentAt);
  // The latest unsent try, unless they picked another.
  const chosen = pick ?? unsent[unsent.length - 1]?.number ?? null;
  const scoreOf = (t: CheckTry) => (graded ? `${t.score} of ${t.total}` : 'written');

  return (
    <div className="qc-results">
      <div className="qc-results-top">
        <div>
          <b>
            {latest ? `Try ${latest.number}` : 'Your answers'}
            {graded ? ` · ${marked.score} of ${marked.total} right` : ''}
          </b>
          <span>
            {marked.revealed
              ? 'You have seen the answers, so this test is closed. Go through each question below.'
              : graded
                ? 'Each question says if you had it right. Take the test as often as you like - your latest try counts.'
                : 'Your written answers go to your reviewer. You can still change them by taking the test again.'}
          </span>
        </div>
        <div className="qc-results-actions">
          {canRetake && (
            <button type="button" className="sa-btn is-small" onClick={onRetake}>
              Take it again
            </button>
          )}
          {!marked.revealed && !confirming && (
            <button type="button" className="sa-btn is-ghost is-small" onClick={() => setConfirming(true)}>
              Show answers
            </button>
          )}
        </div>
      </div>

      {confirming && !marked.revealed && (
        <div className="qc-confirm" role="alertdialog" aria-label="See the answers?">
          <p>
            <b>See the right answers?</b> After this you cannot take this test again. Your latest score stays as it is.
          </p>
          <span>
            <button
              type="button"
              className="sa-btn is-small"
              disabled={busy}
              onClick={async () => {
                if (await onReveal()) setConfirming(false);
              }}
            >
              {busy ? 'Opening…' : 'Show me the answers'}
            </button>
            <button type="button" className="sa-quiet" onClick={() => setConfirming(false)}>
              Not yet
            </button>
          </span>
        </div>
      )}

      {tries.length > 0 && (
        <div className="qc-tries">
          <span className="qc-tries-label">Your tries</span>
          <ul>
            {tries.map((t) => (
              <li key={t.number} className={t.sentAt ? 'is-sent' : ''}>
                Try {t.number} · {scoreOf(t)} · {day(t.at)}
                {t.sentAt && <em>Sent</em>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="qc-send">
        {unsent.length ? (
          <>
            <label>
              <span>Send a try to {company}</span>
              <select value={chosen ?? ''} onChange={(e) => setPick(Number(e.target.value))} disabled={busy}>
                {unsent.map((t) => (
                  <option key={t.number} value={t.number}>
                    Try {t.number} - {scoreOf(t)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="sa-btn is-ghost is-small"
              disabled={busy || chosen === null}
              onClick={async () => {
                if (chosen !== null && (await onSend(chosen))) setPick(null);
              }}
            >
              {busy ? 'Sending…' : `Send to ${company}`}
            </button>
            <small>They see every answer in that try, and which try it was. Once sent, it stays sent.</small>
          </>
        ) : (
          <p className="qc-send-done">
            <span aria-hidden="true">✓</span> Every try is sent to {company}.
          </p>
        )}
      </div>
    </div>
  );
}
