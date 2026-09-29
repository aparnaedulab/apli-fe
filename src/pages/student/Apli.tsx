import { useEffect, useId, useRef, useState } from 'react';
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
 *
 * The line it walks is the hard part. Somebody of twenty reads a cartoon as
 * being talked down to, and reads a grey form as not caring. So Apli is
 * drawn with real craft - gradient, depth, an expression that changes - and
 * speaks like a final-year who has already been through it, not like a
 * mascot.
 */

export type Mood = 'hello' | 'cheer' | 'nudge' | 'think' | 'proud' | 'sorry';

/** The mouth, which carries nearly all of the expression. */
const MOUTHS: Record<Mood, string> = {
  hello: 'M19 30.5c1.5 1.7 3.1 2.5 5 2.5s3.5-.8 5-2.5',
  cheer: 'M18 29.5c1.7 2.8 3.7 4.2 6 4.2s4.3-1.4 6-4.2',
  nudge: 'M19.5 31.3h9',
  think: 'M20 31.5c1.1-1.1 2.4-1.7 4-1.7s2.9.6 4 1.7',
  proud: 'M18.5 29.8c1.6 2.5 3.5 3.7 5.5 3.7s3.9-1.2 5.5-3.7',
  sorry: 'M19.5 32.6c1.2-1.6 2.7-2.4 4.5-2.4s3.3.8 4.5 2.4',
};

/**
 * The character itself.
 *
 * Drawn rather than an image file for two reasons: it has to sit on a brand
 * colour that an institution chooses, and the expression has to change with
 * what is being said. Both are impossible with a PNG.
 */
export function ApliFace({
  mood = 'hello',
  size = 44,
  idle = false,
}: {
  mood?: Mood;
  /** Pixel size. The drawing scales; the stroke weights are relative. */
  size?: number;
  /** Whether it breathes on the spot. On for the companion, off in a rail. */
  idle?: boolean;
}) {
  // Gradients are document-scoped, so two Aplis on one page would otherwise
  // fight over the same ids.
  const uid = useId().replace(/:/g, '');
  const shell = `apli-shell-${uid}`;
  const glass = `apli-glass-${uid}`;

  return (
    <svg
      className={`apli-face is-${mood} ${idle ? 'is-idle' : ''}`}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="Apli"
    >
      <defs>
        {/* The body catches light from the top left, which is what stops it
            reading as a flat sticker. */}
        <linearGradient id={shell} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.74" />
        </linearGradient>
        <linearGradient id={glass} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0b1020" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#0b1020" stopOpacity="0.72" />
        </linearGradient>
      </defs>

      {/* An antenna, so it reads as somebody rather than as a form field. */}
      <line className="apli-stalk" x1="24" y1="9" x2="24" y2="4.5" />
      <circle className="apli-dot" cx="24" cy="3.2" r="2.1" />

      {/* The body: a rounded square, because a circle reads as a chat bubble
          and this is somebody, not a message. */}
      <rect x="5.5" y="8.5" width="37" height="32" rx="11.5" fill={`url(#${shell})`} />

      {/* Ears, which is what makes it a head instead of a tile. */}
      <rect className="apli-ear" x="2.6" y="19" width="3.4" height="9" rx="1.7" />
      <rect className="apli-ear" x="42" y="19" width="3.4" height="9" rx="1.7" />

      {/* The visor. Dark glass means the eyes can be bright without the whole
          face going pale, and it is the single detail that lifts this out of
          cartoon territory. */}
      <rect className="apli-visor" x="10" y="16" width="28" height="16.5" rx="8.2" fill={`url(#${glass})`} />

      {/* A highlight along the top of the glass. */}
      <path className="apli-gleam" d="M13.5 20.5c1.6-2 4.4-3.2 7.5-3.2" />

      {/* Eyes. They blink; the animation is off for anybody who asked for
          less motion. */}
      <g className="apli-eyes">
        <circle cx="18.6" cy="23.6" r="2.9" />
        <circle cx="29.4" cy="23.6" r="2.9" />
        {/* A catchlight in each, which is the difference between looking at
            you and looking through you. */}
        <circle className="apli-spark" cx="19.6" cy="22.5" r="0.85" />
        <circle className="apli-spark" cx="30.4" cy="22.5" r="0.85" />
      </g>

      {/* Colour in the cheeks, only when there is something to be pleased
          about. */}
      <g className="apli-blush">
        <ellipse cx="12.8" cy="29.5" rx="2.9" ry="1.8" />
        <ellipse cx="35.2" cy="29.5" rx="2.9" ry="1.8" />
      </g>

      <path className="apli-mouth" d={MOUTHS[mood]} />
    </svg>
  );
}

/**
 * Apli in the corner, on every student page.
 *
 * The speech card at the top of the overview only exists on the overview. A
 * student stuck three screens deep - on an assessment they do not understand,
 * on a rejection - has nowhere to turn without going back. This is the thing
 * that is always there.
 *
 * It says what this particular page is for and where the next step is, and
 * it is silent until it is asked. A helper that opens itself is an
 * interruption; one that waits is a door.
 */
export default function ApliBubble({ tips }: { tips: { title: string; body: string; to?: string; cta?: string } }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  // Close on a click anywhere else, and on Escape, which is what everybody
  // reaches for first.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={`apli-bubble ${open ? 'is-open' : ''}`} ref={wrap}>
      {open && (
        <div className="apli-pop" role="dialog" aria-label="Apli">
          <p className="apli-pop-tag">Apli</p>
          <p className="apli-pop-title">{tips.title}</p>
          <p className="apli-pop-body">{tips.body}</p>
          {tips.to && tips.cta && (
            <Link className="apli-pop-do" to={tips.to} onClick={() => setOpen(false)}>
              {tips.cta}
            </Link>
          )}
        </div>
      )}

      <button
        type="button"
        className="apli-tab"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Close Apli' : 'Ask Apli what this page is for'}
      >
        <ApliFace mood={open ? 'cheer' : 'hello'} size={34} idle={!open} />
      </button>
    </div>
  );
}
