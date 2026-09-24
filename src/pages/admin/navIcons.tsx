/**
 * One icon per admin section.
 *
 * They exist because the sidebar collapses to a rail: with the labels gone,
 * the icon is the only thing left to recognise a section by, so each has to be
 * distinct at 18px rather than decorative.
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

export const NAV_ICONS: Record<string, (p: IconProps) => JSX.Element> = {
  // Overview: four panes of a dashboard.
  overview: (p) => (
    <svg {...base} {...p}>
      <rect x="3" y="3" width="7" height="8" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="11" width="7" height="10" rx="1.5" />
    </svg>
  ),

  // Colleges: a campus building with a pitched roof.
  colleges: (p) => (
    <svg {...base} {...p}>
      <path d="M12 3 3 7.5h18L12 3Z" />
      <path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8" />
      <path d="M3 21h18" />
    </svg>
  ),

  // Companies: a briefcase.
  companies: (p) => (
    <svg {...base} {...p}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M3 12h18" />
    </svg>
  ),

  // Users: two people.
  users: (p) => (
    <svg {...base} {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 5.5a3.2 3.2 0 0 1 0 6M17.5 20a6 6 0 0 0-2-4.5" />
    </svg>
  ),

  // Students: a mortar board.
  students: (p) => (
    <svg {...base} {...p}>
      <path d="M12 4 2 9l10 5 10-5-10-5Z" />
      <path d="M6 11.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5" />
    </svg>
  ),

  // Invitations: an envelope.
  invites: (p) => (
    <svg {...base} {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  ),

  // Batches: stacked layers.
  batches: (p) => (
    <svg {...base} {...p}>
      <path d="m12 3 9 4.5-9 4.5-9-4.5L12 3Z" />
      <path d="m3 12 9 4.5L21 12" />
      <path d="m3 16.5 9 4.5 9-4.5" />
    </svg>
  ),

  // Drives: a calendar, because a drive is a dated window.
  drives: (p) => (
    <svg {...base} {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  ),

  // Roles: a tag.
  jobs: (p) => (
    <svg {...base} {...p}>
      <path d="M3 11.5V4.5A1.5 1.5 0 0 1 4.5 3h7l9.5 9.5a1.5 1.5 0 0 1 0 2.1l-6.4 6.4a1.5 1.5 0 0 1-2.1 0L3 11.5Z" />
      <circle cx="7.5" cy="7.5" r="1.3" />
    </svg>
  ),

  // Applications: a document with lines.
  applications: (p) => (
    <svg {...base} {...p}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  ),

  // Audit trail: a clock, for "what happened when".
  audit: (p) => (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.5l3.5 2" />
    </svg>
  ),

  // Set up: a numbered checklist, which is what the page is.
  setup: (p) => (
    <svg {...base} {...p}>
      <path d="M9 6h12M9 12h12M9 18h12" />
      <path d="m3 5 1.4 1.4L7 4" />
      <path d="m3 11 1.4 1.4L7 10" />
      <path d="m3 17 1.4 1.4L7 16" />
    </svg>
  ),

  // Logins: a key - who can get in at all.
  logins: (p) => (
    <svg {...base} {...p}>
      <circle cx="8" cy="14" r="4" />
      <path d="m11 11 8-8 2 2-2 2 2 2-2 2-2-2-2 2" />
    </svg>
  ),

  // Roles: a person with a shield - who someone is allowed to be.
  roles: (p) => (
    <svg {...base} {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20a6 6 0 0 1 10.5-3.9" />
      <path d="M18 12.2l3.2 1.2v3.1c0 2-1.4 3.4-3.2 4.1-1.8-.7-3.2-2.1-3.2-4.1v-3.1L18 12.2Z" />
    </svg>
  ),

  // Settings: sliders, not a gear - these are values you set, not machinery.
  settings: (p) => (
    <svg {...base} {...p}>
      <path d="M4 7h11M19 7h1M4 12h4M12 12h8M4 17h9M17 17h3" />
      <circle cx="17" cy="7" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="15" cy="17" r="2" />
    </svg>
  ),
};

/** The rail's own control: a panel with its edge highlighted. */
export function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg {...base} width="18" height="18">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
      {collapsed ? <path d="m13.5 9 3 3-3 3" /> : <path d="m17 9-3 3 3 3" />}
    </svg>
  );
}
