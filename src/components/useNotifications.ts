import { useEffect, useState } from 'react';
import { notificationApi, type Notification } from '../api/notifications';

/**
 * The signed-in person's notifications, shared by everything that shows them:
 * the bell, and the count on each section of the menu (Interviews, Jobs...).
 *
 * One poll for the whole page, however many places read it, so the bell and
 * the badges always agree. Marking something read updates them all at once.
 */

/** Polls quietly. A websocket would be nicer; this is enough and far simpler. */
const POLL_MS = 20_000;

interface State {
  items: Notification[];
  unread: number;
}

let state: State = { items: [], unread: 0 };
const listeners = new Set<(s: State) => void>();
let timer: number | null = null;
let inFlight: Promise<void> | null = null;

function emit(next: State) {
  state = next;
  for (const l of listeners) l(state);
}

/** Fetch now. Safe to call often: calls made while one is running share it. */
export function refreshNotifications(): Promise<void> {
  inFlight ??= notificationApi
    .list()
    .then(({ notifications, unreadCount }) => emit({ items: notifications, unread: unreadCount }))
    .catch(() => undefined) // a failed poll is not worth showing anyone
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Mark these read (or everything, with no ids), here at once and then on the server. */
export async function markNotificationsRead(ids?: string[]) {
  const now = new Date().toISOString();
  const hits = (n: Notification) => !n.readAt && (!ids || ids.includes(n.id));
  const changed = state.items.filter(hits).length;
  if (!changed && ids) return;
  emit({
    items: state.items.map((n) => (hits(n) ? { ...n, readAt: now } : n)),
    unread: ids ? Math.max(0, state.unread - changed) : 0,
  });
  try {
    await notificationApi.markRead(ids);
  } finally {
    void refreshNotifications();
  }
}

export function useNotifications(): State {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    if (listeners.size === 1) {
      void refreshNotifications();
      timer = window.setInterval(() => void refreshNotifications(), POLL_MS);
    } else {
      setS(state);
    }
    return () => {
      listeners.delete(setS);
      if (listeners.size === 0 && timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    };
  }, []);
  return s;
}

/**
 * Whether a notification belongs to a menu section: its link is the section's
 * page or a page under it. "/student" (the dashboard) owns only itself, or it
 * would claim everything under /student/.
 */
export function inSection(link: string | null, to: string, exact?: boolean): boolean {
  if (!link) return false;
  const path = link.split(/[?#]/)[0]!;
  return exact ? path === to : path === to || path.startsWith(`${to}/`);
}
