import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CampusOverview } from '../../api/campus';
import './GettingStarted.css';

interface Item {
  key: string;
  title: string;
  /** What to do, or - once done - what is there. */
  detail: string;
  done: boolean;
  optional?: boolean;
  to: string;
  action: string;
}

const HIDE_KEY = 'campus.gettingStarted.hidden';

/**
 * The placement cell's first week, as a checklist.
 *
 * Every item is a fact about the college read fresh from the server - a batch
 * exists, students are verified, a drive is open - so an item ticks itself the
 * moment the work is done, from whichever screen and by whoever did it. There
 * is nothing to mark by hand and nothing to fall out of step.
 *
 * The next thing to do is always the one highlighted, so a new placement
 * officer never has to wonder where to start.
 */
export default function GettingStarted({ stats }: { stats: CampusOverview['stats'] }) {
  const [hidden, setHidden] = useState(() => {
    try {
      return window.localStorage.getItem(HIDE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const items: Item[] = [
    {
      key: 'team',
      title: 'Invite your team',
      detail:
        stats.teamMembers > 1
          ? `${stats.teamMembers} people have a login`
          : stats.teamInvites > 0
            ? `${stats.teamInvites} invitation${stats.teamInvites === 1 ? '' : 's'} waiting to be accepted`
            : 'Coordinators and verifiers, so the work is not all on you.',
      done: stats.teamMembers > 1 || stats.teamInvites > 0,
      optional: true,
      to: '/campus/team',
      action: 'Invite',
    },
    {
      key: 'batches',
      title: 'Create your batches',
      detail: stats.batches > 0 ? `${stats.batches} batch${stats.batches === 1 ? '' : 'es'}` : 'One per class and passing year - “B.Tech 2027”.',
      done: stats.batches > 0,
      to: '/campus/batches',
      action: 'Create',
    },
    {
      key: 'students',
      title: 'Add your students',
      detail:
        stats.students > 0
          ? `${stats.students} student${stats.students === 1 ? '' : 's'}${stats.pendingInvites ? ` · ${stats.pendingInvites} yet to accept` : ''}`
          : 'Upload the class list, or share one join link with the class.',
      done: stats.students > 0,
      to: '/campus/batches',
      action: 'Add',
    },
    {
      key: 'verify',
      title: 'Verify and lock their records',
      detail:
        stats.students === 0
          ? 'Check marks once. Only locked students can apply.'
          : stats.unverified === 0
            ? `All ${stats.frozen} verified`
            : `${stats.frozen} of ${stats.students} verified - ${stats.unverified} to go`,
      done: stats.students > 0 && stats.unverified === 0,
      to: '/campus/batches',
      action: 'Verify',
    },
    {
      key: 'drive',
      title: 'Open a placement drive',
      detail:
        stats.drivesEver > 0
          ? `${stats.drives} open drive${stats.drives === 1 ? '' : 's'}`
          : 'A season - “2027 Final Placements”. Companies post their roles into it.',
      done: stats.drivesEver > 0,
      to: '/campus/drives',
      action: 'Open',
    },
    {
      key: 'requests',
      title: 'Accept company requests',
      detail:
        stats.pendingPostings > 0
          ? `${stats.pendingPostings} waiting on you`
          : stats.acceptedPostings > 0
            ? `${stats.acceptedPostings} accepted`
            : 'When companies send roles to your drive, you decide what reaches students.',
      done: stats.acceptedPostings > 0 && stats.pendingPostings === 0,
      to: '/campus/requests',
      action: 'Review',
    },
  ];

  const required = items.filter((i) => !i.optional);
  const doneCount = required.filter((i) => i.done).length;
  const allDone = doneCount === required.length;
  const next = items.find((i) => !i.done && !i.optional) ?? items.find((i) => !i.done);

  function setHide(v: boolean) {
    setHidden(v);
    try {
      window.localStorage.setItem(HIDE_KEY, v ? '1' : '0');
    } catch {
      // A browser that refuses storage simply shows the checklist again next time.
    }
  }

  if (hidden) {
    return allDone ? null : (
      <button type="button" className="gs-reopen" onClick={() => setHide(false)}>
        Getting started · {doneCount} of {required.length} done
      </button>
    );
  }

  return (
    <section className={`gs ${allDone ? 'is-done' : ''}`} aria-labelledby="gs-title">
      <div className="gs-head">
        <div>
          <p className="eyebrow">Getting started</p>
          <h2 id="gs-title">{allDone ? 'Your placement cell is set up.' : 'Set up your placement cell'}</h2>
          <p className="gs-lede">
            {allDone
              ? 'Students can see and apply for every role you accept. This list will stay out of your way.'
              : `${doneCount} of ${required.length} done. Each step ticks itself when it is finished.`}
          </p>
        </div>
        <button type="button" className="gs-hide" onClick={() => setHide(true)}>
          {allDone ? 'Dismiss' : 'Hide'}
        </button>
      </div>

      <div className="gs-bar" aria-hidden="true">
        <span style={{ width: `${(doneCount / required.length) * 100}%` }} />
      </div>

      <ol className="gs-list">
        {items.map((i, n) => {
          const isNext = next?.key === i.key;
          return (
            <li key={i.key} className={`${i.done ? 'is-done' : ''} ${isNext ? 'is-next' : ''}`}>
              <span className="gs-dot" aria-hidden="true">
                {i.done ? '✓' : n + 1}
              </span>
              <span className="gs-text">
                <strong>
                  {i.title}
                  {i.optional && <small> optional</small>}
                </strong>
                <span>{i.detail}</span>
              </span>
              {!i.done && (
                <Link to={i.to} className={`btn ${isNext ? 'btn-primary' : 'btn-secondary'} gs-go`}>
                  {i.action}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
