import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from './useReveal';

/**
 * How far the reader has scrolled through one element, as a number from 0 to 1,
 * published on that element as the custom property `--p`.
 *
 * ---------------------------------------------------------------------------
 * Why a custom property rather than state
 *
 * `SeasonLine` already does this with `useState`, and it is fine there because
 * it only needs a count of lit beats - a dozen re-renders over a screen of
 * scrolling. A scrubbed section is a different thing: it wants a new value on
 * every frame, and re-rendering a subtree sixty times a second to move a
 * gradient is the same mistake `useSpotlight` was written to avoid.
 *
 * So the number is written straight to the node and CSS does the rest. One
 * style write per frame, no React work at all, and the animation belongs to
 * the stylesheet where it can be switched off in one place.
 *
 * ---------------------------------------------------------------------------
 * What the stylesheet gets to do with it
 *
 * Each child can carry its own threshold and derive its own local progress:
 *
 *     --at: 0.32;
 *     --local: clamp(0, calc((var(--p) - var(--at)) / 0.14), 1);
 *
 * which is what makes the sequence scrub rather than snap - a gate is not
 * open or shut, it is four-fifths open, and it got there because the reader
 * scrolled four-fifths of the way through its share of the section.
 *
 * ---------------------------------------------------------------------------
 * When it does nothing
 *
 * Under `prefers-reduced-motion` the property is pinned at 1 and no listener
 * is attached, so every stage renders finished. That is the same contract as
 * `Reveal`: the effect is decoration, and removing it leaves the content whole.
 */
export function useScrollProgress<T extends HTMLElement>(
  /**
   * Where down the viewport the reading line sits, as a fraction of its
   * height. 0.62 is a little below the middle - the same line `SeasonLine`
   * uses, so two scrubbed sections on one page advance in sympathy.
   */
  readLine = 0.62,
) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (prefersReducedMotion()) {
      el.style.setProperty('--p', '1');
      return;
    }

    let frame = 0;

    const measure = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      // 0 when the top of the element reaches the reading line, 1 when its
      // bottom does. Guarded against a zero height, which happens for one
      // frame while fonts land and would otherwise divide by nothing.
      const p = (window.innerHeight * readLine - r.top) / Math.max(r.height, 1);
      el.style.setProperty('--p', Math.max(0, Math.min(1, p)).toFixed(4));
    };

    const onScroll = () => {
      // Coalesce to one write per frame. Scroll fires far more often than the
      // screen refreshes, and the extra calls would all be overwritten.
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [readLine]);

  return ref;
}
