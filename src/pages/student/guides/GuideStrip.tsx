import { Link } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { ROUND_CUES, STATUS_CUES, guideById, type Cue } from './content';
import '../Guides.css';

/**
 * One guide, offered where it is needed.
 *
 * This is the half of the guides that actually gets read. An index is a place
 * a worried student has to think to visit; a line on the application that is
 * about to go to an interview is a place they already are.
 *
 * One line, never a panel, and never more than one on a card: the strip is
 * competing with an accept button and a joining date, and it should lose that
 * competition every time. It disappears where the institution does not have
 * the module that guide is about.
 */
export default function GuideStrip({
  cue,
  from = 'applications',
}: {
  cue: Cue | null | undefined;
  /** Which section is handing this over, so the guide can offer the way back. */
  from?: 'applications' | 'jobs';
}) {
  const { hasModule } = useAuth();
  if (!cue) return null;

  const guide = guideById(cue.guide);
  if (!guide || (guide.module && !hasModule(guide.module))) return null;

  const at = cue.anchor ? `&s=${cue.anchor}` : '';

  return (
    <p className="gd-strip">
      <span>{cue.cue}</span>
      <Link to={`/student/guides?g=${cue.guide}${at}&from=${from}`}>
        Read this ({guide.minutes} min)
      </Link>
    </p>
  );
}

/** The guide for the round a student has been called to, if there is one. */
export const cueForRound = (type: string | null | undefined): Cue | null =>
  (type && ROUND_CUES[type]) || null;

/** The guide for where an application has got to, if there is one. */
export const cueForStatus = (status: string): Cue | null => STATUS_CUES[status] ?? null;
