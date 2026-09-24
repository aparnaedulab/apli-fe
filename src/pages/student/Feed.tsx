import { useCallback, useEffect, useRef, useState } from 'react';
import StudentLayout from './StudentLayout';
import { feedApi, type FeedMedia, type FeedPost } from '../../api/feed';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import RichText from '../../components/RichText';
import { ApliFace } from './Apli';
import './Feed.css';

/**
 * The campus feed.
 *
 * One college's, and only ever that one. A student reads their own college's
 * posts and nobody else's, which is the fence every other part of this
 * platform keeps - a story is read only by its own college's juniors, a job
 * is seen only where the cell accepted it, a student is findable by a
 * recruiter only having chosen it and consented.
 *
 * Recruiters are not here at all. The moment a feed is recruiter-visible,
 * students stop talking to each other and start performing, and the portal
 * already has a place for the performance: the showcase, with its own
 * consent behind it.
 */

/** How many photographs or clips one post may carry. */
const MAX_MEDIA = 4;

/** How long ago, in the words somebody would use. */
function ago(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const initialsOf = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')).toUpperCase() || '?';
};

export default function Feed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [asCollege, setAsCollege] = useState(false);
  const [mayPostAsCollege, setMayPostAsCollege] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    feedApi
      .list()
      .then((r) => {
        setPosts(r.posts);
        setMayPostAsCollege(r.canPostAsCollege);
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Could not load the feed.'),
      );
  }, []);

  useEffect(load, [load]);

  return (
    <StudentLayout>
      <div className="fd">
        <header className="fd-head">
          <h1>Feed</h1>
          <p>
            Your college, talking to itself. Only people at your college can see what you post
            here, and no recruiter can.
          </p>
        </header>

        {error && <p className="alert alert-error">{error}</p>}

        <Composer
          name={user?.fullName ?? ''}
          mayPostAsCollege={mayPostAsCollege}
          asCollege={asCollege}
          setAsCollege={setAsCollege}
          onPosted={(p) => setPosts((prev) => [p, ...(prev ?? [])])}
          onError={setError}
        />

        {posts === null && !error && <p className="muted">Loading…</p>}

        {posts?.length === 0 && (
          <div className="fd-empty">
            <ApliFace mood="hello" size={48} />
            <h2>Nothing here yet</h2>
            <p>
              Be the first. An interview that went well, a question nobody wants to ask out loud, a
              thing you built — it all counts.
            </p>
          </div>
        )}

        {posts && posts.length > 0 && (
          <ul className="fd-list">
            {posts.map((p) => (
              <Post
                key={p.id}
                p={p}
                onChanged={(next) =>
                  setPosts((prev) => (prev ?? []).map((x) => (x.id === next.id ? next : x)))
                }
                onRemoved={() => setPosts((prev) => (prev ?? []).filter((x) => x.id !== p.id))}
                onError={setError}
              />
            ))}
          </ul>
        )}
      </div>
    </StudentLayout>
  );
}

/** Writing one. */
function Composer({
  name,
  mayPostAsCollege,
  asCollege,
  setAsCollege,
  onPosted,
  onError,
}: {
  name: string;
  mayPostAsCollege: boolean;
  asCollege: boolean;
  setAsCollege: (v: boolean) => void;
  onPosted: (p: FeedPost) => void;
  onError: (m: string) => void;
}) {
  const [body, setBody] = useState('');
  const [media, setMedia] = useState<FeedMedia[]>([]);
  /* What the reader would see, with the tags taken away - which is what
     "empty" has to be judged on once the box produces HTML. */
  const words = body.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  const [busy, setBusy] = useState(false);
  /* The editor writes its contents once and owns them after that, so
     emptying the state does not empty the box. Bumping this remounts it. */
  const [fresh, setFresh] = useState(0);
  const file = useRef<HTMLInputElement>(null);

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_MEDIA - media.length;
    if (room <= 0) return;
    setBusy(true);
    onError('');
    try {
      const added: FeedMedia[] = [];
      for (const f of [...files].slice(0, room)) added.push(await feedApi.upload(f));
      setMedia((prev) => [...prev, ...added]);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'That file did not upload.');
    } finally {
      setBusy(false);
      if (file.current) file.current.value = '';
    }
  }

  async function send() {
    setBusy(true);
    onError('');
    try {
      onPosted(await feedApi.post(body, media, asCollege));
      setBody('');
      setMedia([]);
      setFresh((n) => n + 1);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'That did not post.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="fd-write">
      <div className="fd-write-top">
        <span className="fd-face" aria-hidden="true">
          {asCollege ? 'PC' : initialsOf(name)}
        </span>
        <div className="fd-editor">
          <RichText
            key={fresh}
            value={body}
            onChange={setBody}
            disabled={busy}
            placeholder="Say something to your college…"
          />
        </div>
      </div>

      {media.length > 0 && (
        <ul className="fd-picked">
          {media.map((m) => (
            <li key={m.url}>
              {m.kind === 'video' ? (
                <video src={m.url} muted />
              ) : (
                <img src={m.url} alt="" />
              )}
              <button
                type="button"
                onClick={() => setMedia((prev) => prev.filter((x) => x.url !== m.url))}
                aria-label="Remove"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="fd-write-foot">
        <input
          ref={file}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          onChange={(e) => void pick(e.target.files)}
        />
        <button
          type="button"
          className="link-btn"
          disabled={busy || media.length >= MAX_MEDIA}
          onClick={() => file.current?.click()}
        >
          {media.length >= MAX_MEDIA ? `${MAX_MEDIA} is the limit` : 'Photo or video'}
        </button>

        {/*
          Only the placement cell sees this, and only because the server said
          so. The college speaks as itself rather than as whoever happened to
          be logged in - an announcement signed by one coordinator reads as
          their opinion rather than the cell's.
        */}
        {mayPostAsCollege && (
          <label className="fd-as">
            <input
              type="checkbox"
              checked={asCollege}
              onChange={(e) => setAsCollege(e.target.checked)}
              disabled={busy}
            />
            Post as the placement cell
          </label>
        )}

        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={busy || (words === '' && media.length === 0)}
          onClick={() => void send()}
        >
          {busy ? 'Posting…' : 'Post'}
        </button>
      </div>
    </section>
  );
}

/** One post, with what can be done to it. */
function Post({
  p,
  onChanged,
  onRemoved,
  onError,
}: {
  p: FeedPost;
  onChanged: (p: FeedPost) => void;
  onRemoved: () => void;
  onError: (m: string) => void;
}) {
  const [saying, setSaying] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function like() {
    try {
      const r = await feedApi.like(p.id, !p.likedByMe);
      onChanged({ ...p, likes: r.likes, likedByMe: r.likedByMe });
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'That did not work.');
    }
  }

  async function comment() {
    setBusy(true);
    try {
      const c = await feedApi.comment(p.id, saying.trim());
      onChanged({ ...p, comments: [...p.comments, c] });
      setSaying('');
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'That did not post.');
    } finally {
      setBusy(false);
    }
  }

  const shown = open ? p.comments : p.comments.slice(-2);

  return (
    <li className={`fd-post ${p.authorKind === 'COLLEGE' ? 'is-cell' : ''}`}>
      <header>
        <span className="fd-face" aria-hidden="true">
          {p.authorKind === 'COLLEGE' ? 'PC' : initialsOf(p.author.name)}
        </span>
        <span className="fd-who">
          <b>{p.author.name}</b>
          <small>{ago(p.createdAt)}</small>
        </span>
        {p.mine && (
          <button
            type="button"
            className="link-btn is-danger fd-x"
            onClick={() => void feedApi.remove(p.id).then(onRemoved).catch(() => onError('That did not work.'))}
          >
            Delete
          </button>
        )}
      </header>

      {/* Sanitised on the way in against an allowlist of tags, so what is
          rendered here is what the server already allowed - the same
          reasoning as a company post. */}
      <div className="fd-body" dangerouslySetInnerHTML={{ __html: p.bodyHtml }} />

      {p.media.length > 0 && (
        <div className={`fd-media is-${Math.min(p.media.length, 4)}`}>
          {p.media.map((m) =>
            m.kind === 'video' ? (
              <video key={m.url} src={m.url} controls playsInline />
            ) : (
              <img key={m.url} src={m.url} alt="" loading="lazy" />
            ),
          )}
        </div>
      )}

      <div className="fd-acts">
        <button
          type="button"
          className={`fd-like ${p.likedByMe ? 'is-on' : ''}`}
          onClick={() => void like()}
          aria-pressed={p.likedByMe}
        >
          {p.likedByMe ? '♥' : '♡'} {p.likes > 0 ? p.likes : ''}
        </button>
        <span className="fd-count">
          {p.comments.length === 0
            ? 'No replies'
            : `${p.comments.length} ${p.comments.length === 1 ? 'reply' : 'replies'}`}
        </span>
      </div>

      {p.comments.length > 2 && !open && (
        <button type="button" className="link-btn fd-more" onClick={() => setOpen(true)}>
          Show all {p.comments.length}
        </button>
      )}

      {shown.length > 0 && (
        <ul className="fd-comments">
          {shown.map((c) => (
            <li key={c.id}>
              <b>{c.author.name}</b>
              <span>{c.body}</span>
              <small>{ago(c.createdAt)}</small>
            </li>
          ))}
        </ul>
      )}

      <div className="fd-reply">
        <input
          value={saying}
          onChange={(e) => setSaying(e.target.value)}
          placeholder="Reply…"
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && saying.trim() !== '') void comment();
          }}
        />
        <button
          type="button"
          className="link-btn"
          disabled={busy || saying.trim() === ''}
          onClick={() => void comment()}
        >
          Reply
        </button>
      </div>
    </li>
  );
}
