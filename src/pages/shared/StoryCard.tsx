import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Story, StoryKind } from '../../api/community';
import './Stories.css';

/**
 * One campus story, as students, the placement cell and companies see it.
 */

const KIND_LABEL: Record<StoryKind, string> = {
  INTERVIEW: 'Interview',
  INTERN_DIARY: 'Intern diary',
  FIRST_MONTHS: 'First months',
};

export function StoryCard({
  story: s,
  companyLink,
  canHelp,
  onHelpful,
}: {
  story: Story;
  companyLink?: string | null;
  canHelp?: boolean;
  onHelpful?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const long = s.body.length > 360;
  return (
    <article className="st-card">
      <header className="st-card-head">
        <span className="st-kind">{KIND_LABEL[s.kind]}</span>
        <h3>
          {companyLink ? <Link to={companyLink}>{s.companyName}</Link> : s.companyName}
          <small> · {s.role}</small>
        </h3>
        <p className="muted">
          {s.year} · {s.author ?? 'A senior from your college'}
          {s.difficulty ? ` · difficulty ${s.difficulty}/5` : ''}
          {s.result ? ` · ${s.result}` : ''}
        </p>
      </header>

      {s.rounds.length > 0 && (
        <ol className="st-rounds">
          {s.rounds.map((r, i) => (
            <li key={i}>
              <strong>{r.name}</strong>
              {r.what && <span>{r.what}</span>}
            </li>
          ))}
        </ol>
      )}

      <p className="st-body">{open || !long ? s.body : `${s.body.slice(0, 360)}…`}</p>
      <footer className="st-card-foot">
        {long && (
          <button type="button" className="link-btn" onClick={() => setOpen((v) => !v)}>
            {open ? 'Show less' : 'Read all'}
          </button>
        )}
        <span className="st-spacer" />
        {onHelpful && (
          <button type="button" className="btn btn-ghost st-helpful" onClick={onHelpful} disabled={!canHelp}>
            {canHelp ? 'Helpful' : 'Thanks'}
            {s.helpful > 0 && <span>{s.helpful}</span>}
          </button>
        )}
      </footer>
    </article>
  );
}
