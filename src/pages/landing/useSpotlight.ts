import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../../lib/useReveal';

/**
 * Light that follows the pointer.
 *
 * The hero is the only place on the site where a visitor is not trying to do
 * anything, so it is the one place worth spending atmosphere on. The element
 * gets `--mx` and `--my` as percentages and paints whatever it likes with
 * them - here, a warm brand glow that leans towards the cursor, so the page
 * feels lit rather than printed.
 *
 * Written straight to the node's style rather than through React state: this
 * fires on every mouse move, and re-rendering a section sixty times a second
 * to move a gradient would be the most expensive light in history.
 */
export function useSpotlight<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    // Coarse pointers have no hover, so there is nothing to follow.
    if (window.matchMedia && !window.matchMedia('(pointer: fine)').matches) return;

    let frame = 0;
    const onMove = (e: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
        el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
      });
    };

    el.addEventListener('pointermove', onMove);
    return () => {
      el.removeEventListener('pointermove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return ref;
}

/**
 * A control that leans towards the pointer before it is clicked.
 *
 * The page's primary buttons already lift 2px on hover, which happens the
 * instant the pointer crosses the edge and says nothing on the way there. This
 * reaches further: from a short distance out the button drifts towards the
 * cursor, so the reader feels it noticing them a moment before they arrive.
 *
 * Kept deliberately small - six pixels of travel over a hundred of approach.
 * A button that chases the cursor is a toy and, worse, a moving target; a
 * button that leans is a button that was waiting for you.
 *
 * The listener is on the window rather than the element, because the whole
 * point is to react outside the element's own bounds, where it would never see
 * a pointer event of its own. One shared rAF, one style write, no React work -
 * the same contract as `useSpotlight` above.
 */
export function useMagnetic<T extends HTMLElement>(pull = 6, reach = 110) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    if (window.matchMedia && !window.matchMedia('(pointer: fine)').matches) return;

    let frame = 0;

    const onMove = (e: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const distance = Math.hypot(dx, dy);

        // Beyond reach the control sits still. Inside it, the lean grows as
        // the pointer closes, and the unit vector keeps the direction honest
        // for a wide button approached from the side.
        if (distance > reach) {
          el.style.setProperty('--tx', '0px');
          el.style.setProperty('--ty', '0px');
          return;
        }

        const strength = (1 - distance / reach) * pull;
        // Guard the origin: dx and dy are both zero when the pointer is dead
        // centre, and normalising that is a division by zero.
        const unit = distance || 1;
        el.style.setProperty('--tx', `${((dx / unit) * strength).toFixed(2)}px`);
        el.style.setProperty('--ty', `${((dy / unit) * strength).toFixed(2)}px`);
      });
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [pull, reach]);

  return ref;
}

/**
 * A card that leans towards the pointer.
 *
 * Small angles on purpose - four degrees, not fifteen. Enough that the demo
 * reads as an object sitting in the page rather than a picture printed on it,
 * not so much that anybody notices the trick and starts playing with it
 * instead of reading.
 */
export function useTilt<T extends HTMLElement>(max = 4) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    if (window.matchMedia && !window.matchMedia('(pointer: fine)').matches) return;

    let frame = 0;
    const onMove = (e: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty('--rx', `${(-y * max).toFixed(2)}deg`);
        el.style.setProperty('--ry', `${(x * max).toFixed(2)}deg`);
      });
    };
    const reset = () => {
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', reset);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', reset);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [max]);

  return ref;
}
