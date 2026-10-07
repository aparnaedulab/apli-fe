import { useLoopingSteps } from '../../lib/useReveal';

/**
 * The audit trail, writing itself.
 *
 * ---------------------------------------------------------------------------
 * Why this section exists
 *
 * The strongest technical thing about this product is the least visible, and
 * until now the landing page did not mention it at all. Every other screen
 * shows an outcome - a job appears, a gate opens, an offer is taken apart.
 * This shows the rule underneath all of them:
 *
 *     An application's status changes in exactly one place, and every change
 *     is written down before anybody is told about it.
 *
 * `server/src/modules/applications/state.ts` is one table and one function.
 * The table says which moves are legal; the function validates the move,
 * appends a `StatusEvent`, runs any cascade, and notifies. No route, no
 * screen and no script writes a status directly. That is why the history on a
 * student's application is trustworthy: not because anybody promises not to
 * edit it, but because there is no code path that could.
 *
 * A promise like that is worth demonstrating rather than asserting, so the
 * section does three things in one run:
 *
 *   1. it appends legal moves, one at a time, as a ledger rather than a status
 *   2. it attempts an illegal one and is refused, and nothing is written
 *   3. it shows the one-offer cascade closing the student's other applications
 *      the moment they accept - which is the same `transition()` call, applied
 *      to each sibling, each with its own row
 *
 * ---------------------------------------------------------------------------
 * Every move here is in the real table
 *
 * The sequence is legal under `ALLOWED` in `state.ts`, including the two
 * details a made-up sequence would have got wrong:
 *
 *   IN_ROUND -> IN_ROUND   is permitted, because a role has several rounds and
 *                          each one is a move
 *   ACCEPTED -> SHORTLISTED is not, because ACCEPTED goes only to HIRED or
 *                          WITHDRAWN - which is the refusal shown below
 *
 * ---------------------------------------------------------------------------
 * The motion
 *
 * `useLoopingSteps` already exists for exactly this and is what the other
 * demos on the page use, so the loop, the hold at the end and the
 * reduced-motion behaviour are all inherited rather than reinvented: a visitor
 * who has asked for less motion is put straight on the final step and reads
 * the finished ledger, refusal included.
 */

type Kind = 'append' | 'refused' | 'cascade';

interface Event {
  kind: Kind;
  at: string;
  from: string;
  to: string;
  /** Who caused it. The ledger records the actor, not just the move. */
  by: string;
  note?: string;
}

/**
 * One application's life, in the order `transition()` would have written it.
 * The company and the role are samples; the moves are the real table.
 */
const EVENTS: Event[] = [
  { kind: 'append', at: '02 Oct 09:14', from: '-', to: 'APPLIED', by: 'the student' },
  {
    kind: 'append',
    at: '03 Oct 11:02',
    from: 'APPLIED',
    to: 'UNDER_REVIEW',
    by: 'recruiter, Demo Systems',
  },
  {
    kind: 'append',
    at: '06 Oct 16:40',
    from: 'UNDER_REVIEW',
    to: 'SHORTLISTED',
    by: 'recruiter, Demo Systems',
  },
  {
    kind: 'append',
    at: '11 Oct 10:05',
    from: 'SHORTLISTED',
    to: 'IN_ROUND',
    by: 'drive desk',
    note: 'Round 1, technical',
  },
  {
    kind: 'append',
    at: '11 Oct 14:22',
    from: 'IN_ROUND',
    to: 'IN_ROUND',
    by: 'drive desk',
    note: 'Round 2, managerial - a move, not an edit',
  },
  { kind: 'append', at: '14 Oct 12:30', from: 'IN_ROUND', to: 'OFFERED', by: 'recruiter, Demo Systems' },
  {
    kind: 'append',
    at: '17 Oct 09:58',
    from: 'OFFERED',
    to: 'ACCEPTED',
    by: 'the student',
    note: 'One offer per drive - the cascade runs here',
  },
  {
    kind: 'refused',
    at: '17 Oct 10:01',
    from: 'ACCEPTED',
    to: 'SHORTLISTED',
    by: 'an attempted write',
    note: 'ACCEPTED goes only to HIRED or WITHDRAWN',
  },
  { kind: 'append', at: '06 Jan 09:00', from: 'ACCEPTED', to: 'HIRED', by: 'joining confirmed' },
];

/** The same student's other live applications, which the cascade closes. */
const SIBLINGS = [
  { role: 'Graduate Engineer', org: 'Demo Robotics', was: 'IN_ROUND' },
  { role: 'Analyst', org: 'Sample Analytics', was: 'SHORTLISTED' },
  { role: 'Backend Intern', org: 'Placeholder Labs', was: 'UNDER_REVIEW' },
];

/** Which event triggers the cascade, found rather than hard-coded. */
const ACCEPT_INDEX = EVENTS.findIndex((e) => e.to === 'ACCEPTED');

export default function Ledger() {
  /**
   * One extra step past the end so the finished ledger is held and read before
   * the run restarts. The hold in `useLoopingSteps` does the rest.
   */
  const step = useLoopingSteps(EVENTS.length + 1, 1150, 4200);

  /*
    On the same tick as the ACCEPTED row, not the one after it. The cascade is
    not a consequence that happens later - it is inside the same `transition()`
    call, in the same database transaction, which is the reason a student can
    never hold two live offers in one drive even for a moment.
  */
  const cascaded = step > ACCEPT_INDEX;

  return (
    <div className="lg">
      <div className="lg-main">
        <header className="lg-head">
          <div>
            <p className="lg-head-k">Application history</p>
            <p className="lg-head-v">Junior Developer &middot; Demo Systems</p>
          </div>
          <p className="lg-head-badge">
            <span aria-hidden="true" className="lg-dot" />
            Append only
          </p>
        </header>

        <ol className="lg-rows">
          {EVENTS.map((e, i) => {
            const written = i < step;
            const refused = e.kind === 'refused';

            return (
              <li
                key={`${e.at}-${e.to}`}
                className={`lg-row ${written ? 'is-in' : ''} ${refused ? 'is-refused' : ''}`}
              >
                <span className="lg-at">{e.at}</span>

                <span className="lg-move">
                  <span className="lg-from">{e.from}</span>
                  <span className="lg-arrow" aria-hidden="true">
                    &rarr;
                  </span>
                  <span className={`lg-to ${refused ? 'is-refused' : ''}`}>{e.to}</span>
                </span>

                <span className="lg-by">
                  {e.by}
                  {e.note ? <em className="lg-note">{e.note}</em> : null}
                </span>

                <span className={`lg-stamp ${refused ? 'is-refused' : ''}`}>
                  {refused ? 'refused' : 'written'}
                </span>
              </li>
            );
          })}
        </ol>

        <footer className="lg-foot">
          <p>
            {EVENTS.filter((e) => e.kind === 'append').length} rows written, one refused. Nothing in
            this list can be altered afterwards, and nothing reached it except through the one
            function that validates the move first.
          </p>
        </footer>
      </div>

      {/*
        The cascade, beside the ledger rather than inside it, because it happens
        to different applications. Each closure is its own `transition()` call
        and gets its own row in its own history - which is why the student can
        later see why an application they never touched is closed.
      */}
      <aside className={`lg-side ${cascaded ? 'is-closed' : ''}`}>
        <p className="lg-side-k">The same student, elsewhere</p>
        <p className="lg-side-sub">
          {cascaded
            ? 'Closed by the one-offer rule the moment the offer was accepted, each with its own recorded reason.'
            : 'Three other applications still live, in three other drives.'}
        </p>

        <ul className="lg-sibs">
          {SIBLINGS.map((s, i) => (
            <li
              key={s.role}
              className={`lg-sib ${cascaded ? 'is-withdrawn' : ''}`}
              style={{ transitionDelay: `${i * 110}ms` }}
            >
              <span className="lg-sib-role">
                {s.role}
                <em>{s.org}</em>
              </span>
              <span className="lg-sib-state">{cascaded ? 'WITHDRAWN' : s.was}</span>
            </li>
          ))}
        </ul>

        <p className="lg-side-note">
          The student is not asked to withdraw three applications by hand, and a recruiter is not
          left interviewing somebody who has already accepted elsewhere.
        </p>
      </aside>
    </div>
  );
}
