import { useEffect, useRef, useState } from 'react';

/** True when the visitor has asked for less motion. Checked at call time. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Reveals an element once it scrolls into view, then stops observing.
 *
 * Falls straight to "revealed" when IntersectionObserver is unavailable or the
 * visitor prefers reduced motion, so content is never trapped behind an
 * animation that will not run.
 */
export function useReveal<T extends HTMLElement>(threshold = 0.12) {
  const ref = useRef<T | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (revealed) return;

    if (typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) {
      setRevealed(true);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin: '0px 0px -60px 0px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [revealed, threshold]);

  return { ref, revealed };
}

/**
 * Drives a looping demo: advances `step` from 0 to steps-1, holds at the end,
 * then restarts. Freezes on the final step for reduced-motion visitors so they
 * still see the finished state.
 */
export function useLoopingSteps(steps: number, intervalMs = 1500, holdMs = 2600) {
  const [step, setStep] = useState(0);
  const [reduced] = useState(prefersReducedMotion);

  useEffect(() => {
    if (reduced) {
      setStep(steps - 1);
      return;
    }

    const atEnd = step >= steps - 1;
    const timer = window.setTimeout(
      () => setStep(atEnd ? 0 : step + 1),
      atEnd ? holdMs : intervalMs,
    );

    return () => window.clearTimeout(timer);
  }, [step, steps, intervalMs, holdMs, reduced]);

  return step;
}
