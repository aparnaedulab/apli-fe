import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationApi, type Notification } from '../api/notifications';
import './NotificationBell.css';

/** Polls quietly. A websocket would be nicer; this is enough and far simpler. */
const POLL_MS = 30_000;

export default function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const { notifications, unreadCount } = await notificationApi.list();
      setItems(notifications);
      setUnread(unreadCount);
    } catch {
      /* a failed poll is not worth showing anyone */
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  // Close when clicking anywhere else.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await notificationApi.markRead();
      setUnread(0);
      void load();
    }
  }

  return (
    <div className="bell-wrap" ref={wrapRef}>
      <button
        type="button"
        className="bell"
        onClick={toggle}
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
          <path
            d="M6.6 12a1.5 1.5 0 0 0 2.8 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
        {unread > 0 && <span className="bell-count">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="bell-panel" role="dialog" aria-label="Notifications">
          <div className="bell-head">
            <b>Notifications</b>
          </div>
          {items.length === 0 ? (
            <p className="bell-empty">Nothing yet.</p>
          ) : (
            <ul className="bell-list">
              {items.map((n) => (
                <li key={n.id} className={n.readAt ? '' : 'is-unread'}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      if (n.link) navigate(n.link);
                    }}
                  >
                    <b>{n.title}</b>
                    {n.body && <span>{n.body}</span>}
                    <time>{new Date(n.createdAt).toLocaleString()}</time>
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
