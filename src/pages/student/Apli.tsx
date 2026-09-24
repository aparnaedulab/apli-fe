import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './Apli.css';

/**
 * Apli, who is on the student's side.
 *
 * A placement portal is read by somebody who is anxious. They are being
 * measured, repeatedly, by strangers, on a timetable they do not control, and
 * most of what the portal tells them is a refusal: not eligible, not
 * shortlisted, not this time. A screen that only states facts leaves them
 * alone with that.
 *
 * So there is a face here, and it says one true, useful thing at a time -
 * what they have already done, what is one step away, what happens next. It
 * is never cheerful about nothing: every line is drawn from their actual
 * record, because encouragement that ignores the facts is the fastest way to
 * stop being believed.
 */

export type Mood = 'hello' | 'cheer' | 'nudge' | 'think';

/**
 * The character itself.
 *
 * Drawn rather than an image file: it has to sit on a brand colour that an
 * institution chooses, so it takes `currentColor` and cannot clash.
 */
export function ApliFace({ mood = 'hello', size = 44 }: { mood?: Mood; size?: number }) {
  return (
    <svg
      className={`apli-face is-${mood}`}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="Apli"
    >
      {/* The body: a rounded square, because a circle reads as a chat bubble
          and this is somebody, not a message. */}
      <rect x="6" y="8" width="36" height="32" rx="11" className="apli-body" />

      {/* Eyes. They blink; the animation is switched off for anybody who has
          asked for less motion. */}
      <g className="apli-eyes">
        <circle cx="18" cy="23" r="2.6" />
        <circle cx="30" cy="23" r="2.6" />
      </g>

      {/* Mouth, which is the whole of the expression. */}
      <path className="apli-mouth" d="M19 30c1.6 1.6 3.3 2.4 5 2.4s3.4-.8 5-2.4" />

      {/* An antenna, so it reads as friendly rather than as a form field. */}
      <line className="apli-stalk" x1="24" y1="8" x2="24" y2="4" />
      <circle className="apli-dot" cx="24" cy="3" r="2" />
    </svg>
  );
}

export interface ApliSays {
  mood: Mood;
  /** One line. Anything longer stops being read. */
  text: string;
  /** Where the next step actually is, when there is one. */
  action?: { to: string; label: string };
}

/**
 * Apli with something to say, for the top of a page.
 *
 * Shown once per screen at most. A companion that comments on everything is
 * noise; one that speaks when it has something is a colleague.
 */
export default function Apli({ says, name }: { says: ApliSays; name?: string }) {
  // Arrives a moment after the page, so it reads as somebody turning up
  // rather than as part of the furniture.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setShown(true), 120);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className={`apli ${shown ? 'is-in' : ''}`}>
      <span className="apli-avatar">
        <ApliFace mood={says.mood} />
      </span>

      <div className="apli-says">
        <p className="apli-who">
          {name ? `Hi ${name}, I am Apli` : 'I am Apli'}
          <span>here to help</span>
        </p>
        <p className="apli-line">{says.text}</p>
        {says.action && (
          <Link className="apli-do" to={says.action.to}>
            {says.action.label}
          </Link>
        )}
      </div>
    </div>
  );
}
