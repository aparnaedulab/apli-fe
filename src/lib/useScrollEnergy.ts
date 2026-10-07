import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from './useReveal';

/**
 * How hard the reader is scrolling, published as `--sv`, and how far, as `--sy`.
 *
 * ---------------------------------------------------------------------------
 * Why velocity and not just position
 *
 * `useScrollProgress` answers "where am I", which is what a scrubbed sequence
 * needs. This answers "how fast am I going", which is what atmosphere needs.
 *
 * The difference is worth the second hook. A backdrop that reacts to position
 * is a parallax, and parallax alone reads as a flat image on rails. A backdrop
 * that reacts to speed feels like a material: it sharpens when the reader moves
 * and settles when they stop to read, so the page appears to respond to
 * attention rather than to pixels. Nothing about the content changes - this
 * only ever drives blur, saturation and a few pixels of drift on layers that
 * are already decorative and already inert.
 *
 * `--sv` rises fast and falls slowly, on purpose. Momentum that vanished the
 * instant the reader stopped would flicker on every small correction of the
 * wheel; momentum that decays over about a second reads as the page coasting
 * to a halt behind them.
 *
 * ---------------------------------------------------------------------------
 * What it costs
 *
 * Nothing while the page is still. The loop is started by a scroll event and
 * stops itself once the energy has decayed and the page is no longer moving, so
 * an idle tab is doing no work at all - which is the whole reason this is a
 * self-terminating loop rather than a permanent `requestAnimationFrame`.
 *
 * Two custom-property writes per frame while scrolling, on one element, and no
 * React re-render ever. The same contract as `useSpotlight` and
 * `useScrollProgress`.
 *
 * Absent entirely under `prefers-reduced-motion`: no listener, no loop, and the
 * properties keep their stylesheet defaults, which are the values that mean
 * "still".
 */
export function useScrollEnergy<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    let last = window.scrollY;
    let energy = 0;
    let frame = 0;

    const write = () => {
      // Rounded: a fractional pixel of parallax is not visible and the shorter
      // string is one less thing for the style engine to parse each frame.
      el.style.setProperty('--sy', String(Math.round(window.scrollY)));
      el.style.setProperty('--sv', energy.toFixed(3));
    };

    const tick = () => {
      const y = window.scrollY;
      const moved = Math.abs(y - last);
      last = y;

      /*
        55px in a frame is taken as full speed - about the fastest a trackpad
        flick produces. Beyond that the value clamps, so a violent scroll and a
        very violent scroll look the same, which is correct: there is no more
        atmosphere to give.
      */
      const impulse = Math.min(1, moved / 55);
      energy = Math.max(impulse, energy * 0.9);
      write();

      // Keep going while there is either movement or momentum left to spend.
      if (moved > 0 || energy > 0.004) {
        frame = requestAnimationFrame(tick);
        return;
      }

      // Settled. Land exactly on zero rather than leaving a residue, and let
      // the loop end so an idle page costs nothing.
      energy = 0;
      write();
      frame = 0;
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    write();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return ref;
}
