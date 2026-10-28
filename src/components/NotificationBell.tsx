import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { markNotificationsRead, useNotifications } from './useNotifications';
import './NotificationBell.css';

const ago = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  return days < 7 ? `${days} day${days === 1 ? '' : 's'} ago` : new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

/**
 * The bell: how many things are new, and the list of them.
 *
 * Opening it does not clear everything - the menu's section counts still show
 * where the new things are. A notification is marked read when it is opened
 * (or its section is visited); "Mark all read" clears the lot.
 */
export default function NotificationBell() {
  const { items, unread } = useNotifications();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close when clicking anywhere else, or on Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !wrapRef.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="bell-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`bell ${unread > 0 ? 'has-new' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path
            d="M8 2a3.5 3.5 0 0 0-3.5 3.5c0 3-1.2 4-1.2 4h9.4s-1.2-1-1.2-4A3.5 3.5 0 0 0 8 2Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M6.6 12a1.5 1.5 0 0 0 2.8 0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        {unread > 0 && <span className="bell-count">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="bell-panel" role="dialog" aria-label="Notifications">
          <div className="bell-head">
            <b>Notifications{unread > 0 ? ` · ${unread} new` : ''}</b>
            {unread > 0 && (
              <button type="button" className="bell-markall" onClick={() => void markNotificationsRead()}>
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="bell-empty">Nothing yet. Updates about your work show up here.</p>
          ) : (
            <ul className="bell-list">
              {items.map((n) => (
                <li key={n.id} className={n.readAt ? '' : 'is-unread'}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      if (!n.readAt) void markNotificationsRead([n.id]);
                      if (n.link) navigate(n.link);
                    }}
                  >
                    <b>{n.title}</b>
                    {n.body && <span>{n.body}</span>}
                    <time dateTime={n.createdAt}>{ago(n.createdAt)}</time>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
