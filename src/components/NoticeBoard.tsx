import { useEffect, useState } from 'react';
import { noticesApi, type Notice } from '../api/notices';
import './NoticeBoard.css';

/**
 * Notices from the institution, on whichever dashboard is showing.
 *
 * The same component for students, companies and placement cells: the server
 * already decided who a notice was addressed to, so there is nothing here to
 * get wrong about audience. What is here is the manners of an announcement -
 * it says who it is from and when, it never shouts, and when there is nothing
 * to say it renders nothing at all rather than an empty box captioned "no
 * notices", which is a thing nobody has ever needed to be told.
 *
 * The classes are `nb-` prefixed. The obvious names were taken: `.notice` is
 * already a flex banner with a brand-coloured background in the platform
 * console, and inheriting it put each notice's body on the same line as its
 * title.
 */
export default function NoticeBoard() {
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    // A dashboard is useful without this, so a failure is silent: the board
    // simply is not there. It is never the reason a page shows an error.
    noticesApi
      .mine()
      .then((r) => setNotices(r.notices))
      .catch(() => setNotices([]));
  }, []);

  if (!notices || notices.length === 0) return null;

  const toggle = (id: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="noticeboard" aria-label="Notices">
      <h2 className="noticeboard-head">
        From your institution
        <span className="noticeboard-count">{notices.length}</span>
      </h2>

      <ul className="nb-list">
        {notices.map((n) => {
          const isOpen = open.has(n.id);
          // Long notices are folded, because a dashboard is not a letterbox
          // and a five-paragraph circular should not push the work off screen.
          const long = n.body.length > 220;
          return (
            <li key={n.id} className="nb-item">
              <div className="nb-top">
                <h3>{n.title}</h3>
                <time dateTime={n.publishedAt}>
                  {new Date(n.publishedAt).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                  })}
                </time>
              </div>

              <p className={`nb-body ${long && !isOpen ? 'is-folded' : ''}`}>{n.body}</p>

              {long && (
                <button type="button" className="nb-more" onClick={() => toggle(n.id)}>
                  {isOpen ? 'Show less' : 'Read it all'}
                </button>
              )}

              <p className="nb-from">
                {n.tenant?.shortName || n.tenant?.name}
                {n.author ? ` · ${n.author.fullName}` : ''}
                {n.expiresAt && (
                  <span className="nb-until">
                    {' '}
                    · until {new Date(n.expiresAt).toLocaleDateString()}
                  </span>
                )}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
