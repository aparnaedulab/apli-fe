import { useState, type DragEvent } from 'react';
import type { Answers, MarkedCheck, StudentPage, StudentQuestion } from '../../api/taskPages';
import TestIntro from './TestIntro';

type Check = Extract<StudentPage, { kind: 'check' }>;

const LETTERS = 'ABCDEFGH';

const HINT: Record<StudentQuestion['kind'], (q: StudentQuestion) => string> = {
  text: () => 'Write your answer',
  choice: (q) => (q.kind === 'choice' && q.multiple ? 'Pick all that apply' : 'Pick one'),
  sort: () => 'Drag each card into a group',
  order: () => 'Drag into the right order',
};

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
 * One quick check, a question at a time.
 *
 * Choose-the-answer questions are lettered cards. The two kinds that are
 * about arranging things are dragged: cards into groups, or cards into
 * order. Every drag also works without one - tap a card, then where it goes;
 * or use the arrows - so a phone or a keyboard is never stuck.
 *
 * The whole check is marked by the server at once. Afterwards each question
 * shows what was right and why, and it can be tried again.
 */
export default function QuickCheck({
  page,
  marked,
  canAnswer,
  busy,
  onSubmit,
}: {
  page: Check;
  marked: MarkedCheck | undefined;
  canAnswer: boolean;
  busy: boolean;
  onSubmit: (answers: Answers) => Promise<boolean>;
}) {
  const [answers, setAnswers] = useState<Answers>(() => marked?.answers ?? {});
  const [reviewing, setReviewing] = useState(Boolean(marked));
  const [at, setAt] = useState(0);
  // The how-to comes first, unless they have already answered this test.
  const [intro, setIntro] = useState(!marked);

  const q = page.questions[at]!;
  const total = page.questions.length;
  const result = reviewing ? marked : undefined;
  const r = result?.questions[q.id];
  const allAnswered = page.questions.every((x) => answered(x, answers));
  const locked = Boolean(result) || !canAnswer;

  const set = (qid: string, value: number[] | string) => setAnswers((a) => ({ ...a, [qid]: value }));
  const graded = page.questions.some((x) => x.kind !== 'text');

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

  if (intro) return <TestIntro page={page} onStart={() => setIntro(false)} again={Object.keys(answers).length > 0} />;

  return (
    <section className="qc">
      <header className="qc-head">
        <div>
          <h2>{page.title}</h2>
          <p className="qc-count">
            Question {at + 1} of {total} ·{' '}
            <button type="button" className="qc-howto" onClick={() => setIntro(true)}>
              How this test works
            </button>
          </p>
        </div>
        {result && (
          <span className={`qc-score ${!graded || result.score === result.total ? 'is-full' : ''}`}>
            {graded ? `${result.score} of ${result.total} right` : 'Sent to your reviewer'}
          </span>
        )}
      </header>

      {/* One segment per question: where they are, and what is answered or right. */}
      <ol className="qc-strip" aria-label="Questions">
        {page.questions.map((x, i) => {
          const res = result?.questions[x.id];
          return (
            <li key={x.id}>
              <button
                type="button"
                className={[
                  i === at ? 'is-on' : '',
                  res
                    ? res.correct === null
                      ? 'is-sent'
                      : res.correct
                        ? 'is-right'
                        : 'is-wrong'
                    : answered(x, answers) && x.kind !== 'order'
                      ? 'is-answered'
                      : '',
                ].join(' ')}
                onClick={() => setAt(i)}
                aria-label={`Question ${i + 1}${res ? (res.correct ? ', right' : ', not right') : ''}`}
                aria-current={i === at ? 'step' : undefined}
              />
            </li>
          );
        })}
      </ol>

      <div className={`qc-card ${r && r.correct !== null ? (r.correct ? 'is-right' : 'is-wrong') : ''}`} key={q.id}>
        <span className="qc-hint">{HINT[q.kind](q)}</span>
        <p className="qc-prompt">{q.prompt}</p>

        {q.kind === 'text' && (
          <Written q={q} given={typeof answers[q.id] === 'string' ? (answers[q.id] as string) : ''} locked={locked} onChange={(v) => set(q.id, v)} />
        )}
        {q.kind === 'choice' && (
          <Choice q={q} given={nums(answers[q.id]) ?? []} solution={r?.solution} locked={locked} onChange={(v) => set(q.id, v)} />
        )}
        {q.kind === 'sort' && (
          <Sort q={q} given={nums(answers[q.id])} solution={r?.solution} locked={locked} onChange={(v) => set(q.id, v)} />
        )}
        {q.kind === 'order' && (
          <Order q={q} given={orderOf(q, answers)} solution={r?.solution} locked={locked} onChange={(v) => set(q.id, v)} />
        )}

        {r && r.correct === null && (
          <p className="qc-feedback is-sent">
            <b>Sent to your reviewer.</b> Written answers are read by a person, not marked here.
            {r.explain ? ` What they are looking for: ${r.explain}` : ''}
          </p>
        )}
        {r && r.correct !== null && (
          <p className={`qc-feedback ${r.correct ? 'is-right' : 'is-wrong'}`}>
            <b>{r.correct ? 'Right.' : 'Not quite.'}</b> {r.explain ?? (r.correct ? '' : 'The right answer is shown.')}
          </p>
        )}
      </div>

      <footer className="qc-foot">
        <button type="button" className="sa-quiet" onClick={() => setAt(at - 1)} disabled={at === 0}>
          <span aria-hidden="true">←</span> Previous
        </button>
        <span className="qc-foot-mid">
          {result && canAnswer && (
            <button
              type="button"
              className="sa-btn is-ghost is-small"
              onClick={() => {
                setReviewing(false);
                setAnswers({});
                setAt(0);
              }}
            >
              Try again
            </button>
          )}
        </span>
        {at < total - 1 ? (
          <button type="button" className="sa-btn is-ghost" onClick={() => setAt(at + 1)}>
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
    </section>
  );
}

/** A written answer, with the company's hint and a word count. */
function Written({
  q,
  given,
  locked,
  onChange,
}: {
  q: Extract<StudentQuestion, { kind: 'text' }>;
  given: string;
  locked: boolean;
  onChange: (v: string) => void;
}) {
  const n = words(given);
  return (
    <div className="qc-written">
      <textarea
        rows={6}
        value={given}
        readOnly={locked}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write your answer here, in your own words."
        aria-label="Your answer"
      />
      <span className="qc-written-foot">
        {q.hint && <span>{q.hint}</span>}
        <b className={q.minWords && n < q.minWords ? 'is-short' : ''}>
          {n} word{n === 1 ? '' : 's'}
          {q.minWords ? ` · at least ${q.minWords}` : ''}
        </b>
      </span>
    </div>
  );
}

/** Lettered cards; one or several, as the question says. */
function Choice({
  q,
  given,
  solution,
  locked,
  onChange,
}: {
  q: Extract<StudentQuestion, { kind: 'choice' }>;
  given: number[];
  solution?: number[];
  locked: boolean;
  onChange: (v: number[]) => void;
}) {
  return (
    <div className="qc-options" role={q.multiple ? 'group' : 'radiogroup'}>
      {q.options.map((o, i) => {
        const chosen = given.includes(i);
        const right = solution?.includes(i);
        return (
          <button
            key={i}
            type="button"
            role={q.multiple ? 'checkbox' : 'radio'}
            aria-checked={chosen}
            disabled={locked}
            className={[
              'qc-option',
              chosen ? 'is-chosen' : '',
              solution && right ? 'is-solution' : '',
              solution && chosen && !right ? 'is-miss' : '',
            ].join(' ')}
            onClick={() => onChange(q.multiple ? (chosen ? given.filter((x) => x !== i) : [...given, i]) : [i])}
          >
            <span className="qc-letter">{solution ? (right ? '✓' : chosen ? '✗' : LETTERS[i]) : LETTERS[i]}</span>
            <span>{o}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Cards into groups. Drag a card into a group, or tap it and then the group.
 * A placed card can be dragged elsewhere, or sent back with ×.
 */
function Sort({
  q,
  given,
  solution,
  locked,
  onChange,
}: {
  q: Extract<StudentQuestion, { kind: 'sort' }>;
  given: number[] | undefined;
  solution?: number[];
  locked: boolean;
  onChange: (v: number[]) => void;
}) {
  const placed = given && given.length === q.items.length ? given : q.items.map(() => -1);
  const [picked, setPicked] = useState<number | null>(null);
  const [over, setOver] = useState<number | 'tray' | null>(null);

  const place = (item: number, group: number) => {
    const next = [...placed];
    next[item] = group;
    onChange(next);
    setPicked(null);
  };

  const drop = (target: number) => (e: DragEvent) => {
    e.preventDefault();
    const item = Number(e.dataTransfer.getData('text/plain'));
    if (!Number.isNaN(item)) place(item, target);
    setOver(null);
  };

  const card = (i: number) => {
    const inGroup = placed[i]!;
    const wrong = solution && inGroup !== solution[i];
    return (
      <span
        key={i}
        className={[
          'qc-card-item',
          picked === i ? 'is-picked' : '',
          solution ? (wrong ? 'is-wrong' : 'is-right') : '',
        ].join(' ')}
        draggable={!locked}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', String(i));
          e.dataTransfer.effectAllowed = 'move';
        }}
      >
        <button
          type="button"
          className="qc-card-text"
          disabled={locked}
          onClick={() => setPicked(picked === i ? null : i)}
          aria-pressed={picked === i}
          aria-label={`${q.items[i]}${picked === i ? ' - picked, now choose a group' : ''}`}
        >
          {!locked && (
            <span className="qc-grip" aria-hidden="true">
              ⋮⋮
            </span>
          )}
          {q.items[i]}
        </button>
        {solution && wrong && <span className="qc-should">Belongs in: {q.groups[solution[i]!]}</span>}
        {!locked && inGroup >= 0 && (
          <button type="button" className="qc-unplace" onClick={() => place(i, -1)} aria-label={`Take ${q.items[i]} out`}>
            ×
          </button>
        )}
      </span>
    );
  };

  const tray = q.items.map((_, i) => i).filter((i) => placed[i] === -1);

  return (
    // Cards on the left, groups stacked on the right: drag across.
    <div className="qc-match">
      <div
        className={`qc-tray ${over === 'tray' ? 'is-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver('tray');
        }}
        onDragLeave={() => setOver(null)}
        onDrop={drop(-1)}
      >
        <span className="qc-zone-label">
          {locked ? 'Your answers' : tray.length ? 'Drag from here' : 'All placed - drag to move'}
        </span>
        <div className="qc-zone-cards">
          {tray.map(card)}
          {!tray.length && <span className="qc-zone-empty">{locked ? 'Every card was placed.' : 'Drop a card back here to take it out.'}</span>}
        </div>
      </div>
      <div className="qc-groups">
        {q.groups.map((g, gi) => {
          const here = q.items.map((_, i) => i).filter((i) => placed[i] === gi);
          return (
            <div
              key={gi}
              className={`qc-group ${over === gi ? 'is-over' : ''} ${picked !== null ? 'is-target' : ''} ${here.length ? 'has-cards' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(gi);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={drop(gi)}
            >
              <button
                type="button"
                className="qc-group-name"
                disabled={locked || picked === null}
                onClick={() => picked !== null && place(picked, gi)}
              >
                <span>{g}</span>
                {picked !== null && !locked ? <em>Put here</em> : !here.length && <i aria-hidden="true">?</i>}
              </button>
              {here.length > 0 && <div className="qc-zone-cards">{here.map(card)}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Cards into order. Drag a card up or down by its handle, or use the arrows. */
function Order({
  q,
  given,
  solution,
  locked,
  onChange,
}: {
  q: Extract<StudentQuestion, { kind: 'order' }>;
  given: number[];
  solution?: number[];
  locked: boolean;
  onChange: (v: number[]) => void;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= given.length) return;
    const next = [...given];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it!);
    onChange(next);
  };

  return (
    <ol className="qc-order">
      {given.map((item, pos) => {
        const rightPos = solution ? solution.indexOf(item) : -1;
        const wrong = solution && rightPos !== pos;
        return (
          <li
            key={item}
            className={[
              dragging === pos ? 'is-dragging' : '',
              over === pos && dragging !== null && dragging !== pos ? 'is-over' : '',
              solution ? (wrong ? 'is-wrong' : 'is-right') : '',
            ].join(' ')}
            draggable={!locked}
            onDragStart={(e) => {
              setDragging(pos);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', String(pos));
            }}
            onDragEnd={() => {
              setDragging(null);
              setOver(null);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(pos);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const from = Number(e.dataTransfer.getData('text/plain'));
              if (!Number.isNaN(from)) move(from, pos);
              setDragging(null);
              setOver(null);
            }}
          >
            <span className="qc-pos">{pos + 1}</span>
            {!locked && (
              <span className="qc-grip" aria-hidden="true">
                ⋮⋮
              </span>
            )}
            <span className="qc-order-text">{q.items[item]}</span>
            {solution && wrong && <span className="qc-should">Should be {rightPos + 1}</span>}
            {!locked && (
              <span className="qc-arrows">
                <button type="button" onClick={() => move(pos, pos - 1)} disabled={pos === 0} aria-label={`Move "${q.items[item]}" up`}>
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(pos, pos + 1)}
                  disabled={pos === given.length - 1}
                  aria-label={`Move "${q.items[item]}" down`}
                >
                  ↓
                </button>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
