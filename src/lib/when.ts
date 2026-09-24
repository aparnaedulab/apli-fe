/**
 * How long ago something happened, in words.
 *
 * A feed is read by how fresh it is, and "20 Sep 2026" makes a reader do the
 * arithmetic. The exact moment is never thrown away - every caller puts this
 * inside a <time> element carrying the full date, so hovering or reading the
 * markup gives the precise answer.
 */
export function timeAgo(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const seconds = Math.round((now - then) / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;

  const weeks = Math.round(days / 7);
  if (days < 30) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;

  // Past a month, the date itself is more use than a count of them.
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(new Date(iso).getFullYear() === new Date(now).getFullYear() ? {} : { year: 'numeric' }),
  });
}

/** The full moment, for the tooltip and for anybody reading the markup. */
export function exactly(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
