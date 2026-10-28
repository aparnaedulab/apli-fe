import { useState } from 'react';
import type { StudentPage, StudentQuestion } from '../../api/taskPages';
import { Choice, Order, Sort, Written } from './QuestionInputs';

type Check = Extract<StudentPage, { kind: 'check' }>;
export type KindKey = 'text' | 'one' | 'many' | 'sort' | 'order';

/** Which of the five ways of answering a question uses. */
export function kindOf(q: StudentQuestion): KindKey {
  if (q.kind === 'choice') return q.multiple ? 'many' : 'one';
  return q.kind;
}

/** Each kind of question, how to answer it, and a small picture of doing it. */
export const KINDS: {
  key: KindKey;
  title: string;
  how: string;
  /** The same, as short steps - shown beside each question in the test. */
  steps: string[];
  phone?: string;
  picture: JSX.Element;
}[] = [
  {
    key: 'text',
    title: 'Written answer',
    how: 'Type your answer in your own words. Some ask for a few words at least - the count is under the box. A person reads it; it is not marked straight away.',
    steps: ['Click in the box and type your answer.', 'Watch the word count under the box.', 'Your reviewer reads it - it is not marked here.'],
    picture: (
      <span className="ti-pic is-text">
        <i />
        <i />
        <i className="is-short" />
      </span>
    ),
  },
  {
    key: 'one',
    title: 'Pick one',
    how: 'Click the one right answer. Click another to change your mind.',
    steps: ['Click the answer you think is right.', 'Click another one to change it.', 'Keys A, B, C… pick an answer too.'],
    picture: (
      <span className="ti-pic is-options">
        <i>A</i>
        <i className="is-on">B</i>
        <i>C</i>
      </span>
    ),
  },
  {
    key: 'many',
    title: 'Pick all that apply',
    how: 'More than one answer is right. Click every one of them; click again to untick.',
    steps: ['More than one answer can be right.', 'Click each one that applies.', 'Click again to untick.'],
    picture: (
      <span className="ti-pic is-options">
        <i className="is-on">A</i>
        <i>B</i>
        <i className="is-on">C</i>
      </span>
    ),
  },
  {
    key: 'sort',
    title: 'Put cards into groups',
    how: 'Each card belongs in one of the groups. Drag a card from the left into its group on the right - or, easier, click the card and then click the group.',
    steps: [
      'Click a card on the left - it lights up.',
      'Click the group it belongs in ("Put here").',
      'Or drag the card across with the mouse.',
      'Wrong group? Click × on the card to take it out.',
    ],
    phone: 'On a phone: tap a card, then tap the group.',
    picture: (
      <span className="ti-pic is-sort">
        <span className="ti-cards">
          <i />
          <i />
        </span>
        <span className="ti-arrow">→</span>
        <span className="ti-boxes">
          <i>
            <b />
          </i>
          <i />
        </span>
      </span>
    ),
  },
  {
    key: 'order',
    title: 'Put cards in order',
    how: 'Put the cards in the right order, first at the top. Use the ↑ ↓ arrows on each card, or drag a card up or down by its ⋮⋮ handle.',
    steps: ['First goes at the top.', 'Click ↑ or ↓ on a card to move it.', 'Or drag it by the ⋮⋮ handle.', 'Leaving it as shown also counts as an answer.'],
    phone: 'On a phone: use the ↑ ↓ arrows.',
    picture: (
      <span className="ti-pic is-order">
        <i>1</i>
        <i className="is-moving">3</i>
        <i>2</i>
      </span>
    ),
  },
];

/* A tiny practice question for each kind, with its right answer. */
type Practice = { q: StudentQuestion; right: (a: number[] | string) => boolean };
const PRACTICE: Record<KindKey, Practice> = {
  text: {
    q: { id: 'p-text', kind: 'text', prompt: 'In a few words: what is one thing you want to learn here?', hint: null, minWords: 4 },
    right: (a) => typeof a === 'string' && a.trim().split(/\s+/).filter(Boolean).length >= 4,
  },
  one: {
    q: { id: 'p-one', kind: 'choice', prompt: 'Which of these would an analyst use to clean a data file?', options: ['A spreadsheet', 'A kettle', 'A sofa'], multiple: false },
    right: (a) => Array.isArray(a) && a.length === 1 && a[0] === 0,
  },
  many: {
    q: { id: 'p-many', kind: 'choice', prompt: 'Which of these are programming languages? Pick all that apply.', options: ['Python', 'Stapler', 'Java'], multiple: true },
    right: (a) => Array.isArray(a) && a.length === 2 && a.includes(0) && a.includes(2),
  },
  sort: {
    q: { id: 'p-sort', kind: 'sort', prompt: 'Is each one money coming in, or money going out?', groups: ['Money in', 'Money out'], items: ['Salary', 'Rent', 'Bonus', 'Electricity bill'] },
    right: (a) => Array.isArray(a) && a.join(',') === '0,1,0,1',
  },
  order: {
    q: { id: 'p-order', kind: 'order', prompt: 'Put the steps of a task in order, first at the top.', items: ['Hand in your work', 'Read the brief', 'Do the work'] },
    right: (a) => Array.isArray(a) && a.join(',') === '1,2,0',
  },
};

/**
 * The onboarding before a test, a step at a time:
 *
 *   1. What to expect, and how the test screen is laid out.
 *   2. One step for each kind of question in this test: how to answer it,
 *      and a small practice question using the real controls.
 *   3. Ready: moving around, shortcuts, and Start.
 *
 * Practice answers are not saved or marked; they are only there to try the
 * controls. "Skip to the questions" is always one click away.
 */
export default function TestIntro({ page, onStart, again }: { page: Check; onStart: () => void; again?: boolean }) {
  const kinds = KINDS.filter((k) => page.questions.some((q) => kindOf(q) === k.key));
  const n = page.questions.length;
  const minutes = Math.max(2, Math.round(n * 1.5));
  const written = page.questions.every((q) => q.kind === 'text');
  const slides = ['welcome', ...kinds.map((k) => k.key), 'ready'] as const;
  const [at, setAt] = useState(0);
  const slide = slides[at]!;
  const kind = kinds.find((k) => k.key === slide);
  const last = at === slides.length - 1;

  return (
    <section className="ti ti-onboard">
      <header className="ti-top">
        <div>
          <p className="sa-eyebrow">{again ? 'How this test works' : 'Before you begin'}</p>
          <h2>{page.title}</h2>
        </div>
        <button type="button" className="sa-quiet" onClick={onStart}>
          {again ? 'Back to the questions' : 'Skip to the questions'} <span aria-hidden="true">→</span>
        </button>
      </header>

      {/* Where they are in the onboarding. */}
      <ol className="ti-dots" aria-label="Onboarding steps">
        {slides.map((sl, i) => (
          <li key={sl}>
            <button
              type="button"
              className={`${i === at ? 'is-on' : ''} ${i < at ? 'is-done' : ''}`}
              onClick={() => setAt(i)}
              aria-current={i === at ? 'step' : undefined}
            >
              <span className="ti-dot-n">{i < at ? '✓' : i + 1}</span>
              <span className="ti-dot-label">
                {sl === 'welcome' ? 'What to expect' : sl === 'ready' ? 'Ready' : KINDS.find((k) => k.key === sl)!.title}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div className="ti-slide" key={slide}>
        {slide === 'welcome' && (
          <>
            <ul className="ti-facts">
              <li>
                <b>{n}</b> question{n === 1 ? '' : 's'}
              </li>
              <li>
                about <b>{minutes}</b> min
              </li>
              <li>{written ? 'read by your reviewer' : 'marked when you press Check'}</li>
              <li>try again as often as you like</li>
            </ul>
            <h3>How the test screen works</h3>
            <div className="ti-layout" aria-hidden="true">
              <div>
                <b>Questions</b>
                <span>Every question, numbered. Green once answered. Click one to jump to it.</span>
              </div>
              <div className="is-main">
                <b>The question</b>
                <span>One at a time. Previous and Next stay at the bottom - no scrolling needed.</span>
              </div>
              <div>
                <b>How to answer</b>
                <span>Short steps for the kind of question you are on, always beside it.</span>
              </div>
            </div>
            <p className="ti-note">
              This test has {kinds.length === 1 ? 'one kind' : `${kinds.length} kinds`} of question. Next, we show you how each
              works, with a quick practice - it is not marked.
            </p>
          </>
        )}

        {kind && <KindSlide kind={kind} count={page.questions.filter((q) => kindOf(q) === kind.key).length} />}

        {slide === 'ready' && (
          <>
            <h3>You are ready</h3>
            <ul className="ti-ready">
              <li>
                <b>Move around freely.</b> Previous / Next at the bottom, or click any question on the left. Nothing is
                marked until you press <i>Check my answers</i>.
              </li>
              <li>
                <b>Check my answers</b> appears on the last question once every question is answered. The list on the left
                shows what is still to do.
              </li>
              <li>
                <b>See how you did.</b> Each question says right or not. Not happy? Take it again - your latest try counts.
              </li>
              <li>
                <b>Shortcuts:</b> <kbd>←</kbd> <kbd>→</kbd> previous / next question, <kbd>A</kbd>–<kbd>H</kbd> pick an answer.
              </li>
            </ul>
          </>
        )}
      </div>

      <footer className="ti-foot">
        <button type="button" className="sa-quiet" onClick={() => setAt(at - 1)} disabled={at === 0}>
          <span aria-hidden="true">←</span> Back
        </button>
        <span className="ti-foot-where">
          Step {at + 1} of {slides.length}
        </span>
        {last ? (
          <button type="button" className="sa-btn" onClick={onStart}>
            {again ? 'Back to the questions' : 'Start the test'} <span aria-hidden="true">→</span>
          </button>
        ) : (
          <button type="button" className="sa-btn" onClick={() => setAt(at + 1)}>
            Next <span aria-hidden="true">→</span>
          </button>
        )}
      </footer>
    </section>
  );
}

/** One kind of question: how it works, beside a practice question to try it on. */
function KindSlide({ kind, count }: { kind: (typeof KINDS)[number]; count: number }) {
  const practice = PRACTICE[kind.key];
  const q = practice.q;
  const [answer, setAnswer] = useState<number[] | string | undefined>(undefined);
  const touched = answer !== undefined;
  const ok = touched && practice.right(answer);
  const full =
    q.kind === 'sort' ? Array.isArray(answer) && !answer.includes(-1) && answer.length === q.items.length : touched;

  return (
    <div className="ti-kind">
      <div className="ti-kind-how">
        <div className="ti-kind-title">
          {kind.picture}
          <div>
            <h3>{kind.title}</h3>
            <span className="ti-kind-count">
              {count} question{count === 1 ? '' : 's'} like this in the test
            </span>
          </div>
        </div>
        <p>{kind.how}</p>
        <ol className="ti-kind-steps">
          {kind.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        {kind.phone && <p className="ti-phone">{kind.phone}</p>}
      </div>

      <div className="ti-practice">
        <span className="ti-practice-label">Try it - not marked</span>
        <p className="qc-prompt">{q.prompt}</p>
        {q.kind === 'text' && <Written q={q} given={typeof answer === 'string' ? answer : ''} locked={false} onChange={setAnswer} />}
        {q.kind === 'choice' && <Choice q={q} given={Array.isArray(answer) ? answer : []} locked={false} onChange={setAnswer} />}
        {q.kind === 'sort' && <Sort q={q} given={Array.isArray(answer) ? answer : undefined} locked={false} onChange={setAnswer} />}
        {q.kind === 'order' && (
          <Order q={q} given={Array.isArray(answer) ? answer : q.items.map((_, i) => i)} locked={false} onChange={setAnswer} />
        )}
        {ok ? (
          <p className="ti-practice-fb is-ok">✓ That is it - you have got the hang of it.</p>
        ) : full && touched ? (
          <p className="ti-practice-fb is-no">Not quite - have another go. (This one does not count.)</p>
        ) : (
          <p className="ti-practice-fb">{kind.steps[0]}</p>
        )}
      </div>
    </div>
  );
}

const WAYS = {
  text: { icon: '✎', label: 'write your answer' },
  link: { icon: '🔗', label: 'paste a link anyone can open' },
  file: { icon: '⇪', label: 'upload a PDF or picture (5 MB)' },
} as const;

/** How to hand a task in, in one line: the ways this task allows. */
export function HandInHow({ kinds = ['text', 'link', 'file'] }: { kinds?: (keyof typeof WAYS)[] }) {
  return (
    <p className="ti-handin">
      <span>{kinds.length > 1 ? 'Hand in any one of these, or more:' : 'Hand it in this way:'}</span>
      {kinds.map((k) => (
        <span key={k} className="ti-handin-way">
          <i aria-hidden="true">{WAYS[k].icon}</i> {WAYS[k].label}
        </span>
      ))}
    </p>
  );
}
