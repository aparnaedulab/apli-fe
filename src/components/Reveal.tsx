import type { ReactNode } from 'react';
import { useReveal } from '../lib/useReveal';

interface RevealProps {
  children: ReactNode;
  /** Stagger index — each step adds 70ms to the delay. */
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li';
}

/**
 * Fades and lifts its children into place the first time they scroll into view.
 * Purely additive: if the observer never fires or motion is reduced, the
 * content simply renders in its final state.
 */
export default function Reveal({ children, delay = 0, className = '', as = 'div' }: RevealProps) {
  const { ref, revealed } = useReveal<HTMLDivElement>();
  const Tag = as;

  return (
    <Tag
      ref={ref as never}
      className={`reveal ${revealed ? 'is-in' : ''} ${className}`.trim()}
      style={{ transitionDelay: `${delay * 70}ms` }}
    >
      {children}
    </Tag>
  );
}
