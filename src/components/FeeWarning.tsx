import type { ReactNode } from 'react';
import './FeeWarning.css';

interface Hit {
  phrase: string;
  snippet: string;
}

/**
 * Sentences in a role that look like a demand for money, shown where each
 * reader needs them: the company while writing, the college before accepting,
 * the student before applying. The headline changes with the reader; the
 * evidence - the exact words - is the same for all three.
 */
export default function FeeWarning({ hits, title, children }: { hits: Hit[]; title: string; children?: ReactNode }) {
  if (hits.length === 0) return null;
  return (
    <div className="fee-warning" role="alert">
      <p className="fee-warning-title">
        <span aria-hidden="true">⚠</span> {title}
      </p>
      {children && <p className="fee-warning-body">{children}</p>}
      <ul>
        {hits.map((h, i) => (
          <li key={i}>
            <HighlightedSnippet snippet={h.snippet} phrase={h.phrase} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The snippet with the words that tripped the check marked. */
function HighlightedSnippet({ snippet, phrase }: { snippet: string; phrase: string }) {
  const at = snippet.toLowerCase().indexOf(phrase.toLowerCase());
  if (at < 0) return <>{snippet}</>;
  return (
    <>
      {snippet.slice(0, at)}
      <mark>{snippet.slice(at, at + phrase.length)}</mark>
      {snippet.slice(at + phrase.length)}
    </>
  );
}
