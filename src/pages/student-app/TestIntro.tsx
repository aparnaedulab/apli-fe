import type { StudentPage, StudentQuestion } from '../../api/taskPages';

type Check = Extract<StudentPage, { kind: 'check' }>;

/** Each kind of question, and how to answer it - with a small picture of doing it. */
const KINDS: {
  key: 'text' | 'one' | 'many' | 'sort' | 'order';
  matches: (q: StudentQuestion) => boolean;
  title: string;
  how: string;
  phone?: string;
  picture: JSX.Element;
}[] = [
  {
    key: 'text',
    matches: (q) => q.kind === 'text',
    title: 'Written answer',
    how: 'Type your answer in your own words. Some ask for a few words at least - the count is under the box. A person reads it; it is not marked straight away.',
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
    matches: (q) => q.kind === 'choice' && !q.multiple,
    title: 'Pick one',
    how: 'Tap the one right answer. Tap another to change your mind.',
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
    matches: (q) => q.kind === 'choice' && q.multiple,
    title: 'Pick all that apply',
    how: 'More than one answer is right. Tap every one of them; tap again to untick.',
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
    matches: (q) => q.kind === 'sort',
    title: 'Drag into groups',
    how: 'Drag each card from the left into the box on the right where it belongs. Drag it back to the left to take it out.',
    phone: 'On a phone: tap a card, then tap the box.',
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
    matches: (q) => q.kind === 'order',
    title: 'Drag into order',
    how: 'Drag the cards up or down by the ⋮⋮ handle until they are in the right order - first at the top.',
    phone: 'Or use the ↑ ↓ arrows on each card.',
    picture: (
      <span className="ti-pic is-order">
        <i>1</i>
        <i className="is-moving">3</i>
        <i>2</i>
      </span>
    ),
  },
];

/**
 * What a student sees when a test opens, before the first question: how many
 * questions, how long, how each kind in this test is answered, and how
 * marking works. Nothing else - the questions come after "Start".
 */
export default function TestIntro({ page, onStart, again }: { page: Check; onStart: () => void; again?: boolean }) {
  const kinds = KINDS.filter((k) => page.questions.some(k.matches));
  const n = page.questions.length;
  const minutes = Math.max(2, Math.round(n * 1.5));
  return (
    <section className="ti">
      <p className="sa-eyebrow">Before you begin</p>
      <h2>How this test works</h2>

      <ul className="ti-facts">
        <li>
          <b>{n}</b> question{n === 1 ? '' : 's'}
        </li>
        <li>
          about <b>{minutes}</b> min
        </li>
        <li>{page.questions.every((q) => q.kind === 'text') ? 'read by your reviewer' : 'marked as soon as you check'}</li>
        <li>you can try again</li>
      </ul>

      <h3>{kinds.length === 1 ? 'The kind of question' : 'The kinds of question'} in this test</h3>
      <ul className="ti-kinds">
        {kinds.map((k) => (
          <li key={k.key}>
            {k.picture}
            <div>
              <b>{k.title}</b>
              <p>{k.how}</p>
              {k.phone && <p className="ti-phone">{k.phone}</p>}
            </div>
          </li>
        ))}
      </ul>

      <h3>Moving around</h3>
      <ol className="ti-steps">
        <li>One question at a time. Use Next and Previous, or tap the bar at the top to jump.</li>
        <li>On the last question, press Check my answers - it appears once every question is answered.</li>
        <li>You see what was right and why. Not happy with your score? Try again.</li>
      </ol>

      <div className="ti-start">
        <button type="button" className="sa-btn" onClick={onStart}>
          {again ? 'Back to the questions' : 'Start the test'} <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
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
