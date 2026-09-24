import { useEffect, useRef, useState } from 'react';
import { SEASON } from './content';
import { prefersReducedMotion } from '../../lib/useReveal';

/**
 * The season as a year, scrolled through rather than listed.
 *
 * A placement season is eight months long and it has a shape: hope, then
 * noise, then silence, then doubt, then - usually - relief, and then the part
 * nobody warns anybody about, which is the wait between an offer and a
 * joining date. Listing features never conveys that. Walking somebody through
 * their own year, with the month they are dreading named honestly, does.
 *
 * The line fills as the section passes the middle of the screen, so the
 * reader is doing the season rather than reading about it. If the observer
 * never fires, or the visitor has asked for less motion, every beat is simply
 * lit: nothing here is hidden behind an animation.
 */
export default function SeasonLine() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    const onScroll = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const middle = window.innerHeight * 0.62;
      // 0 when the top of the list reaches the reading line, 1 when the
      // bottom does.
      const p = (middle - r.top) / Math.max(r.height, 1);
      setProgress(Math.max(0, Math.min(1, p)));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const lit = Math.round(progress * SEASON.length);

  return (
    <div className="sl" ref={ref}>
      <div className="sl-rail" aria-hidden="true">
        <span className="sl-rail-fill" style={{ height: `${progress * 100}%` }} />
      </div>

      <ol className="sl-beats">
        {SEASON.map((b, i) => (
          <li key={b.when} className={`sl-beat ${i < lit ? 'is-lit' : ''}`}>
            <span className="sl-dot" aria-hidden="true" />
            <div className="sl-when">
              <b>{b.when}</b>
              <em>{b.mood}</em>
            </div>
            <div className="sl-body">
              <p className="sl-what">{b.what}</p>
              <p className="sl-does">{b.does}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
