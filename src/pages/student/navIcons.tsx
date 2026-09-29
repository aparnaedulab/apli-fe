/**
 * One icon per student section.
 *
 * A student reads this rail on a phone, at speed, between lectures. Words
 * alone make every row look the same; a shape in front of the word is what
 * the eye actually lands on, and it is the only thing left when the rail
 * collapses to the bottom bar on a small screen.
 *
 * Drawn on a 24 grid with a single stroke weight so they read as one set at
 * 18px. `currentColor` throughout, because the rail recolours them with the
 * institution's brand.
 */

type IconProps = { className?: string };

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

/**
 * Keyed by the same English label the menu uses, so a section names its icon
 * by naming itself and nothing has to be kept in step by hand.
 */
export const STUDENT_ICONS: Record<string, (p: IconProps) => JSX.Element> = {
  // Overview: a home, because it is where everything starts.
  Overview: (p) => (
    <svg {...base} {...p}>
      <path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <path d="M9 21v-7h6v7" />
    </svg>
  ),

  // Jobs: a briefcase.
  Jobs: (p) => (
    <svg {...base} {...p}>
      <rect x="2.5" y="7" width="19" height="13" rx="2.5" />
      <path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7" />
      <path d="M2.5 12.5h19" />
    </svg>
  ),

  // My applications: paper sent, with a tick.
  'My applications': (p) => (
    <svg {...base} {...p}>
      <path d="M13.5 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8.5Z" />
      <path d="M13.5 3v5.5H19" />
      <path d="m8.5 15 2 2 4-4" />
    </svg>
  ),

  // Interviews: two people talking.
  Interviews: (p) => (
    <svg {...base} {...p}>
      <circle cx="8.5" cy="8" r="3" />
      <path d="M3 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 6.5h5.5v6H19l-1.5 2v-2H16Z" />
    </svg>
  ),

  // Assessments: a checklist on a clipboard.
  Assessments: (p) => (
    <svg {...base} {...p}>
      <rect x="4" y="4" width="16" height="17" rx="2.5" />
      <path d="M9 3h6v3H9z" />
      <path d="M8.5 11h7M8.5 15.5h4.5" />
    </svg>
  ),

  // Aptitude practice: a target being aimed at.
  'Aptitude practice': (p) => (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  ),

  // Mock interview: a microphone. Rehearsal, out loud.
  'Mock interview': (p) => (
    <svg {...base} {...p}>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5V21M9 21h6" />
    </svg>
  ),

  // Group discussion: three in a circle.
  'Group discussion': (p) => (
    <svg {...base} {...p}>
      <circle cx="12" cy="6" r="2.6" />
      <circle cx="5.5" cy="16" r="2.6" />
      <circle cx="18.5" cy="16" r="2.6" />
      <path d="M10.2 8.2 7.3 13.6M13.8 8.2l2.9 5.4M8.1 17h7.8" />
    </svg>
  ),

  // Soft skills: a spark, for the part that is not on a marksheet.
  'Soft skills': (p) => (
    <svg {...base} {...p}>
      <path d="M12 3l1.9 4.7L18.5 9.6l-4.6 1.9L12 16l-1.9-4.5L5.5 9.6l4.6-1.9Z" />
      <path d="M18 17l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z" />
    </svg>
  ),

  // Events: a calendar with a day marked.
  Events: (p) => (
    <svg {...base} {...p}>
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  ),

  // Guides: an open book.
  Guides: (p) => (
    <svg {...base} {...p}>
      <path d="M12 6.5S10 4.5 4 4.5v13c6 0 8 2 8 2s2-2 8-2v-13c-6 0-8 2-8 2Z" />
      <path d="M12 6.5v13" />
    </svg>
  ),

  // Career counselling: a compass, for somebody deciding a direction.
  'Career counselling': (p) => (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.5 8.5-2 5-5 2 2-5Z" />
    </svg>
  ),

  // My profile: a person.
  'My profile': (p) => (
    <svg {...base} {...p}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  ),

  // Resume: a document with lines.
  Resume: (p) => (
    <svg {...base} {...p}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
      <path d="M8.5 12.5h7M8.5 16.5h5" />
    </svg>
  ),

  // Showcase: work on display.
  Showcase: (p) => (
    <svg {...base} {...p}>
      <rect x="3" y="4.5" width="18" height="13" rx="2.5" />
      <path d="m6.5 14 3.2-3.6 2.6 2.6 2.4-2.6 2.8 3.6" />
      <path d="M9 21h6" />
    </svg>
  ),

  // Feed: what the campus is saying.
  Feed: (p) => (
    <svg {...base} {...p}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M7.5 9h6M7.5 12.5h9M7.5 16h4" />
    </svg>
  ),

  // My badges: an award.
  'My badges': (p) => (
    <svg {...base} {...p}>
      <circle cx="12" cy="9" r="5.5" />
      <path d="m8.5 13.5-1 7 4.5-2.4 4.5 2.4-1-7" />
    </svg>
  ),

  // Privacy: a shield. What is shared, and with whom.
  Privacy: (p) => (
    <svg {...base} {...p}>
      <path d="M12 3 5 6v6c0 4.3 2.9 7.6 7 9 4.1-1.4 7-4.7 7-9V6Z" />
      <path d="m9.5 12 1.8 1.8 3.4-3.6" />
    </svg>
  ),
};

/** The fallback: a dot, for a section that has not been given a shape yet. */
export function FallbackIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

/** The icon for a label, or the fallback if that label has none. */
export function iconFor(label: string): (p: IconProps) => JSX.Element {
  return STUDENT_ICONS[label] ?? FallbackIcon;
}

/* --- icons the shell itself needs, outside the menu ----------------------- */

export function MenuIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function CloseIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function MoreIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Everything there is: the launcher, which opens the portal as a grid. */
export function GridIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </svg>
  );
}

export function SignOutIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M14 20H6.5A1.5 1.5 0 0 1 5 18.5v-13A1.5 1.5 0 0 1 6.5 4H14" />
      <path d="m16.5 8.5 3.5 3.5-3.5 3.5M20 12h-9" />
    </svg>
  );
}
