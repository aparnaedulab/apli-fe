import { useEffect, useState } from 'react';
import { prefersReducedMotion } from '../../lib/useReveal';

/**
 * What waiting feels like, on the left. What it looks like here, on the right.
 *
 * Ghosting is the most common complaint in campus hiring and the hardest to
 * argue with in prose, because the damage is not the rejection - it is not
 * knowing. A paragraph saying "we show you the status" is forgettable. A
 * counter ticking upwards next to the word *nothing* is not, and it costs the
 * reader no effort to feel it.
 *
 * The right-hand side is the same application under this product: who it is
 * waiting on, and how long they have left to answer.
 */

/** Days of silence the left-hand card climbs through before it loops. */
const CLIMB_TO = 63;

export default function SilenceMeter() {
  const [day, setDay] = useState(0);
  const [reduced] = useState(prefersReducedMotion);

  useEffect(() => {
    if (reduced) {
      setDay(CLIMB_TO);
      return;
    }
    // Slower as it climbs, which is also how it feels.
    const wait = day === 0 ? 900 : day >= CLIMB_TO ? 2600 : 40 + day * 1.5;
    const t = window.setTimeout(() => setDay(day >= CLIMB_TO ? 0 : day + 1), wait);
    return () => window.clearTimeout(t);
  }, [day, reduced]);

  /* The right-hand card moves on while the left one is still counting. */
  const stage = day > 46 ? 2 : day > 22 ? 1 : 0;

  return (
    <div className="sm">
      <div className="sm-side is-dark">
        <p className="sm-side-label">Anywhere else</p>
        <div className="sm-card">
          <p className="sm-role">Software Engineer · Zenith Labs</p>
          <p className="sm-applied">Applied 14 August</p>
          <p className="sm-count">
            <span className="sm-days">{day}</span>
            <span>day{day === 1 ? '' : 's'} of silence</span>
          </p>
          <p className="sm-status">
            Status: <em>—</em>
          </p>
          <p className="sm-nothing">No update. No rejection. Nothing to plan around.</p>
        </div>
      </div>

      <div className="sm-side">
        <p className="sm-side-label">Apli.ai</p>
        <div className="sm-card is-live">
          <p className="sm-role">Software Engineer · Zenith Labs</p>
          <p className="sm-applied">Applied 14 August</p>

          <ol className="sm-track" aria-live="polite">
            <li className="is-done">
              <b>Resume screen</b>
              <small>Cleared, 16 August</small>
            </li>
            <li className={stage >= 1 ? 'is-done' : 'is-now'}>
              <b>Online test</b>
              <small>{stage >= 1 ? 'Cleared, 2 September' : 'Sat on 28 August · being marked'}</small>
            </li>
            <li className={stage >= 2 ? 'is-now' : ''}>
              <b>Technical interview</b>
              <small>{stage >= 2 ? 'Thursday, 10:30 · Hall B' : 'Not scheduled yet'}</small>
            </li>
          </ol>

          <p className={`sm-waiting ${stage >= 2 ? 'is-you' : ''}`}>
            {stage >= 2 ? (
              <>
                <b>Waiting on you.</b> Confirm your slot by Tuesday.
              </>
            ) : (
              <>
                <b>Waiting on Zenith Labs.</b> {stage >= 1 ? '2' : '4'} days left of the {' '}
                {stage >= 1 ? '7' : '7'}-day window your college set.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
