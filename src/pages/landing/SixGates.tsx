import { useState, type CSSProperties } from 'react';
import { useScrollProgress } from '../../lib/useScrollProgress';

/**
 * The six conditions, scrubbed by the scroll.
 *
 * ---------------------------------------------------------------------------
 * Why this section exists
 *
 * "The college keeps the gate" is the claim the page already makes, and
 * `ApprovalGate` above demonstrates it. But the college's acceptance is one of
 * six conditions, and the other five are the ones a student actually collides
 * with - the branch they are not on, the number that is not on their record,
 * the drive they are already placed in. Until now the page mentioned them in
 * passing and showed none of them, which left the most-asked question on any
 * placement portal - "why can this person apply and I cannot" - answered by a
 * sentence rather than by the mechanism.
 *
 * The six are taken from the comment above `visibleJobWhere` in
 * `server/src/modules/jobs/visibility.ts`. They are in that order there
 * because that is the order the single SQL statement applies them, and they
 * are in that order here for the same reason. If that list changes, this one
 * is wrong, which is the correct relationship between a claim and its code.
 *
 * ---------------------------------------------------------------------------
 * The thing worth interacting with
 *
 * One rule in `visibility.ts` surprises everybody who reads it:
 *
 *     A missing number on the student's side fails any criterion that needs
 *     it - "no CGPA on record" is not the same as "meets a 7.5 requirement".
 *
 * It sounds harsh until you see the alternative, which is a portal that shows
 * a student roles they will be thrown out of at the resume screen. So the
 * reader gets a switch: take the CGPA off the record and watch the fifth gate
 * refuse and the sixth never light. Nothing is being simulated - that is the
 * rule, stated where it can be felt rather than read.
 *
 * ---------------------------------------------------------------------------
 * How the motion works
 *
 * `useScrollProgress` publishes `--p` on the rail and each gate carries its
 * own `--at`, so every gate derives a local 0-to-1 from the reader's position
 * and animates continuously. A gate is not open or shut; it is as open as the
 * scroll has made it. Everything the reader needs is real text in the DOM from
 * the first paint, so with the effect off - reduced motion, no JS, a printed
 * page - this is a numbered list of six conditions and a verdict, which is
 * exactly what it is trying to say.
 */

interface Condition {
  /** Its position in the query, which is also its position on screen. */
  n: number;
  title: string;
  detail: string;
  /** Which part of the product decides it. */
  source: string;
}

/** From `visibleJobWhere`, in the order the query applies them. */
const CONDITIONS: Condition[] = [
  {
    n: 1,
    title: 'The company published it',
    detail:
      'A draft reaches nobody. Until a role is published it does not exist outside the company that is writing it.',
    source: 'the role status',
  },
  {
    n: 2,
    title: 'The deadline has not passed',
    detail:
      'A closed role stops being visible rather than staying up to collect applications nobody will read.',
    source: 'the closing date',
  },
  {
    n: 3,
    title: 'Their college accepted the posting',
    detail:
      'Publishing creates one posting per college, each waiting for that placement cell. Declined, with a reason, and it never appears at all.',
    source: 'the posting status',
  },
  {
    n: 4,
    title: 'Their batch sits in that drive, and the posting was aimed at it',
    detail:
      'A role may be aimed at some batches in a drive and not others. Aimed at none of them means the whole drive.',
    source: 'the drive, and the batches named',
  },
  {
    n: 5,
    title: 'They meet every stated criterion',
    detail:
      'Marks, backlogs, gap years, course, branch, graduating year, and whether lateral entrants are taken. A role stating none of them is open to everybody.',
    source: 'the eligibility lists',
  },
  {
    n: 6,
    title: 'They are not already placed in that drive',
    detail:
      'Where the institution runs a one-offer rule, accepting an offer closes that drive for the student and withdraws the rest.',
    source: 'the one-offer rule',
  },
];

/** Where the first gate begins, the gap between them, and how long each takes. */
const FIRST = 0.06;
const STRIDE = 0.128;
const SPAN = 0.135;

/** Custom properties are valid CSS and absent from React's CSSProperties. */
const vars = (v: Record<string, string | number>) => v as CSSProperties;

export default function SixGates() {
  /**
   * Whether the college recorded this student's CGPA. It starts recorded,
   * because the point is made by taking it away rather than by opening broken.
   */
  const [onRecord, setOnRecord] = useState(true);

  const rail = useScrollProgress<HTMLDivElement>();

  /** The criteria gate is the one a missing number closes. */
  const refusedAt = onRecord ? null : 5;

  return (
    <div className={`sg ${onRecord ? '' : 'is-refused'}`}>
      <div className="sg-switch">
        <p className="sg-switch-q">What happens when a number is simply not there?</p>
        <button
          type="button"
          className={`sg-toggle ${onRecord ? 'is-on' : ''}`}
          aria-pressed={onRecord}
          onClick={() => setOnRecord((v) => !v)}
        >
          <span className="sg-toggle-track" aria-hidden="true">
            <span className="sg-toggle-knob" />
          </span>
          <span className="sg-toggle-label">
            CGPA on the college record
            <em>{onRecord ? 'Recorded' : 'Blank'}</em>
          </span>
        </button>
        <p className="sg-switch-note" key={String(onRecord)}>
          {onRecord
            ? 'A role asking for 7.0 can be checked against this record, so it can be offered.'
            : 'Nothing on record is not the same as meeting the bar, so the fifth gate refuses rather than guessing. This is the rule itself, not an illustration of it.'}
        </p>
      </div>

      <div className="sg-rail" ref={rail}>
        {/*
          The beam behind the gates: the reader's own scroll position drawn
          back to them. It is what ties the sequence to the act of reading it,
          rather than to a timer the reader is not in control of.
        */}
        <span className="sg-beam" aria-hidden="true">
          <span className="sg-beam-fill" />
          <span className="sg-beam-head" />
        </span>

        <ol className="sg-list">
          {CONDITIONS.map((c, i) => {
            const refused = refusedAt === c.n;
            const unreachable = refusedAt !== null && c.n > refusedAt;

            return (
              <li
                key={c.n}
                className={`sg-gate ${refused ? 'is-stop' : ''} ${unreachable ? 'is-dark' : ''}`}
                /*
                  `--rate` is 1/span rather than the span itself, so the
                  stylesheet can multiply. Dividing by a var() inside calc() is
                  newer CSS than multiplying by one, and there is no reason to
                  spend a browser version on it when the reciprocal is free.
                */
                style={vars({ '--at': FIRST + i * STRIDE, '--rate': 1 / SPAN })}
              >
                <span className="sg-mark" aria-hidden="true">
                  <Lock />
                  <b className="sg-n">{c.n}</b>
                </span>

                <div className="sg-body">
                  <h3 className="sg-title">{c.title}</h3>
                  <p className="sg-detail">{c.detail}</p>
                  <p className="sg-source">
                    <span aria-hidden="true" className="sg-source-dot" />
                    Decided by {c.source}
                  </p>

                  {refused ? (
                    <p className="sg-refusal">
                      Refused here. The role asks for a CGPA and this record has none, so it is not
                      shown - and the student is told which condition closed it.
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/*
        The verdict. Both outcomes are real: one is the role appearing, the
        other is the "Why can't I apply?" explainer, which is a module that
        exists and not a consolation message invented for this page.
      */}
      <div className={`sg-verdict ${onRecord ? 'is-pass' : 'is-stop'}`} role="status">
        {onRecord ? (
          <>
            <p className="sg-verdict-k">All six clear</p>
            <p className="sg-verdict-v">
              The role appears on this student&rsquo;s list, and they can apply.
            </p>
          </>
        ) : (
          <>
            <p className="sg-verdict-k">Closed at condition five</p>
            <p className="sg-verdict-v">
              The role stays hidden, and the student sees the reason rather than a grey button -
              which condition, what it asked for, and whether anything would change it.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * A padlock whose shackle lifts as its gate opens.
 *
 * Driven entirely by `--local`, the gate's own share of the scroll, so it
 * travels with the reader instead of running on its own clock. Inert: the
 * condition beside it is the content.
 */
function Lock() {
  return (
    <svg className="sg-lock" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        className="sg-shackle"
        d="M8 10V7a4 4 0 0 1 8 0v3"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect className="sg-case" x="4.5" y="10" width="15" height="10.5" rx="2.5" strokeWidth="2" />
      <path
        className="sg-tick"
        d="M9 15.4l2.2 2.2 4-4.2"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
