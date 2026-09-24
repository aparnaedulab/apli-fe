import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import CompanyLayout from './CompanyLayout';
import { ApiError } from '../../api/client';
import {
  companyApi,
  companyPostsApi,
  MAX_MEDIA,
  type CompanyPost,
  type PostMedia,
} from '../../api/company';
import { showcaseApi, type CompanyPageView } from '../../api/showcase';
import { useAuth } from '../../auth/AuthContext';
import { exactly, timeAgo } from '../../lib/when';
import CompanyPageLayers from '../student/CompanyPageView';
import RichText from '../../components/RichText';
import './Profile.css';

const WORDS = 2000;

/**
 * What went wrong, in the words of the field that went wrong.
 *
 * A validation failure arrives as "Some fields need fixing." with the fields
 * beside it. Showing only the sentence leaves nothing to act on, so the field
 * messages are what we read out and the sentence is the fallback.
 */
function reason(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  const said = err.fields?.map((f) => f.message).filter(Boolean) ?? [];
  return said.length ? said.join(' ') : err.message;
}

interface Draft {
  logoUrl: string;
  coverUrl: string;
  headline: string;
  about: string;
}

/**
 * /company/profile - the two things a company keeps up to date.
 *
 * A profile - a cover, a logo, a title and a description - and its posts.
 * Everything else a student reads on the page is either verified by
 * operations or measured from what happens here, so it is not editable and is
 * not on this screen.
 *
 * Left: what they write and upload. Right: the page exactly as a student will
 * read it, repainting as they type.
 */
export default function CompanyProfile() {
  const { can } = useAuth();
  const mayEdit = can('company:profile');

  const [view, setView] = useState<CompanyPageView | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [page, { company }] = await Promise.all([showcaseApi.mine(), companyApi.overview()]);
      setView(page);
      if (!company) return;
      setDraft({
        logoUrl: company.logoUrl ?? '',
        coverUrl: company.coverUrl ?? '',
        headline: company.headline ?? '',
        about: company.about ?? '',
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load your profile.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setSaved(false);
  };

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft || busy || !mayEdit) return;
    setBusy(true);
    setError(null);
    try {
      // A partial save: the fields this screen does not show are left as they are.
      await companyApi.saveProfile({
        logoUrl: draft.logoUrl,
        coverUrl: draft.coverUrl,
        headline: draft.headline,
        about: draft.about,
      });
      await load();
      setSaved(true);
    } catch (err) {
      setError(reason(err, 'Could not save your profile.'));
    } finally {
      setBusy(false);
    }
  }

  // Ctrl/⌘+Enter saves, the same as every other long form here.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        (document.getElementById('cprof-save') as HTMLButtonElement | null)?.click();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* The preview is the student's component fed the unsaved draft, so what is
     on the right is what a student would get if this were saved now. */
  const preview: CompanyPageView | null =
    view && draft
      ? {
          ...view,
          says: {
            ...view.says,
            logoUrl: draft.logoUrl || null,
            coverUrl: draft.coverUrl || null,
            headline: draft.headline.trim() || null,
            about: draft.about.trim() || null,
          },
        }
      : null;

  return (
    <CompanyLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Company profile</p>
          <h1>How students see you</h1>
          <p className="page-lede">
            Your profile and your posts. Students read this before they apply, and placement cells
            read it before they accept a role from you.
          </p>
        </div>
      </header>

      {error && <p className="alert alert-error">{error}</p>}
      {!draft || !view ? (
        !error && <p className="muted">Loading…</p>
      ) : (
        <div className="cprof">
          <form className="cprof-form" onSubmit={save} noValidate>
            {!mayEdit && (
              <p className="notice">
                Your role can read this page but not change it. An owner can edit the profile.
              </p>
            )}

            <section className="cprof-block">
              <h2>Pictures</h2>
              <p className="muted">
                A logo students recognise, and a cover across the top of your page.
              </p>
              <div className="cprof-pics">
                <ImageField
                  label="Logo"
                  value={draft.logoUrl}
                  onChange={(url) => set('logoUrl', url)}
                  kind="logo"
                  hint="PNG, JPG, WebP or SVG. Square works best, under 2 MB."
                  disabled={!mayEdit}
                  square
                  fallback={view.says.name.slice(0, 2).toUpperCase()}
                />
                <ImageField
                  label="Cover"
                  value={draft.coverUrl}
                  onChange={(url) => set('coverUrl', url)}
                  kind="cover"
                  hint="Wide, at least 1200 px across, under 4 MB."
                  disabled={!mayEdit}
                  fallback="No cover yet"
                />
              </div>
            </section>

            <section className="cprof-block">
              <h2>What we say</h2>
              <Field
                label="Headline"
                hint="One line under your name. What you do, in the words you would use."
              >
                <input
                  value={draft.headline}
                  maxLength={140}
                  onChange={(e) => set('headline', e.target.value)}
                  placeholder="We build billing software for small factories."
                  disabled={!mayEdit}
                />
              </Field>
              <Words
                label="About us"
                value={draft.about}
                onChange={(v) => set('about', v)}
                disabled={!mayEdit}
                rows={4}
                placeholder="What the company does, in a sentence or two."
              />
            </section>

            <section className="cprof-block">
              <h2>Posts</h2>
              <p className="muted">
                What you have been doing: a hire, a product, a campus visit. Every student and
                placement cell that can see your page reads these. There are no likes and no
                comments — this is your page, not a feed to keep up with.
              </p>
              <Posts disabled={!mayEdit} onChanged={load} />
            </section>

            {mayEdit && (
              <div className="cprof-foot">
                <span className="muted">{saved ? 'Saved. Students see this now.' : ''}</span>
                <button id="cprof-save" type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Saving…' : 'Save profile'}
                  {!busy && <kbd className="kbd">Ctrl ↵</kbd>}
                </button>
              </div>
            )}
          </form>

          <aside className="cprof-preview" aria-label="Preview of your page">
            <p className="cprof-preview-label">What students see</p>
            {preview && <CompanyPageLayers view={preview} />}
          </aside>
        </div>
      )}
    </CompanyLayout>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="cprof-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function Words({
  label,
  value,
  onChange,
  disabled,
  rows,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  rows: number;
  placeholder: string;
}) {
  return (
    <label className="cprof-field">
      <span>{label}</span>
      <textarea
        rows={rows}
        maxLength={WORDS}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
      />
      <small className="cprof-count">
        {value.length} / {WORDS}
      </small>
    </label>
  );
}

/**
 * One picture: drop it, or click to pick one.
 *
 * It uploads the moment it is chosen, so the preview beside it is the stored
 * file rather than a local one that might never reach us.
 */
function ImageField({
  label,
  value,
  onChange,
  kind,
  hint,
  fallback,
  disabled,
  square,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  kind: 'logo' | 'cover';
  hint: string;
  fallback: ReactNode;
  disabled: boolean;
  square?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  async function take(file: File | undefined) {
    if (!file || disabled) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await companyApi.uploadImage(kind, file));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That upload did not work.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="cprof-pic">
      <span className="cprof-pic-label">{label}</span>
      <div
        className={`cprof-drop ${over ? 'is-over' : ''} ${square ? 'is-square' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void take(e.dataTransfer.files[0]);
        }}
      >
        {value ? (
          <img src={value} alt="" />
        ) : (
          <span className="cprof-fallback">{fallback}</span>
        )}
      </div>
      <div className="cprof-pic-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => input.current?.click()}
          disabled={disabled || busy}
        >
          {busy ? 'Uploading…' : value ? 'Replace' : 'Upload'}
        </button>
        {value && !busy && (
          <button type="button" className="linkish" onClick={() => onChange('')} disabled={disabled}>
            Remove
          </button>
        )}
      </div>
      <small>{hint}</small>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        hidden
        onChange={(e) => void take(e.target.files?.[0])}
      />
    </div>
  );
}

/** The gallery: add, caption, remove. Order is the order they were added. */
function Posts({ disabled, onChanged }: { disabled: boolean; onChanged: () => void }) {
  const [posts, setPosts] = useState<CompanyPost[] | null>(null);
  const [editing, setEditing] = useState<CompanyPost | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPosts(await companyPostsApi.mine());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load your posts.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(run: () => Promise<unknown>) {
    setError(null);
    try {
      await run();
      await load();
      // The preview beside this shows the newest three, so it has changed too.
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not work.');
    }
  }

  return (
    <div className="cpost">
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      {!disabled && (
        <Composer
          key={editing?.id ?? 'new'}
          post={editing}
          onCancel={() => setEditing(null)}
          onDone={async () => {
            setEditing(null);
            await load();
            onChanged();
          }}
        />
      )}

      {posts === null ? (
        <p className="muted">Loading…</p>
      ) : posts.length === 0 ? (
        <p className="muted">Nothing posted yet.</p>
      ) : (
        <ul className="cpost-list">
          {posts.map((p) => (
            <li key={p.id}>
              <div className="cpost-row">
                <span className="cpost-when">
                  {p.publishedAt ? (
                    <time dateTime={p.publishedAt} title={exactly(p.publishedAt)}>
                      {timeAgo(p.publishedAt)}
                    </time>
                  ) : (
                    <span className="pill pill-idle">Draft</span>
                  )}
                  {p.pinned && <span className="pill pill-pass">Pinned</span>}
                </span>
                {!disabled && (
                  <span className="cpost-acts">
                    <button type="button" className="linkish" onClick={() => setEditing(p)}>
                      Edit
                    </button>
                    {p.publishedAt && (
                      <button
                        type="button"
                        className="linkish"
                        onClick={() => void act(() => companyPostsApi.pin(p.id, !p.pinned))}
                      >
                        {p.pinned ? 'Unpin' : 'Pin to top'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="linkish"
                      onClick={() => {
                        if (window.confirm('Delete this post? Students will stop seeing it.')) {
                          void act(() => companyPostsApi.remove(p.id));
                        }
                      }}
                    >
                      Delete
                    </button>
                  </span>
                )}
              </div>
              {p.title && <strong className="cpost-title">{p.title}</strong>}
              {/* Sanitised by the server before it was stored. */}
              <div className="cpost-body" dangerouslySetInnerHTML={{ __html: p.bodyHtml }} />
              {p.media.length > 0 && (
                <span className="muted">
                  {p.media.length} {p.media.length === 1 ? 'attachment' : 'attachments'}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Writing one post: the words, what is attached, and whether it goes out. */
function Composer({
  post,
  onDone,
  onCancel,
}: {
  post: CompanyPost | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(post?.title ?? '');
  const [body, setBody] = useState(post?.bodyHtml ?? '');
  const [media, setMedia] = useState<PostMedia[]>(post?.media ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(publish: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = { title, bodyHtml: body, media, publish };
      if (post) await companyPostsApi.update(post.id, data);
      else await companyPostsApi.create(data);
      setTitle('');
      setBody('');
      setMedia([]);
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save that post.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cpost-write">
      <label className="cprof-field">
        <span>Title (optional)</span>
        <input
          value={title}
          maxLength={140}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="We are hiring 12 graduates this season"
          disabled={busy}
        />
      </label>

      <RichText
        value={body}
        onChange={setBody}
        disabled={busy}
        placeholder="What has your team been doing?"
      />

      <MediaList media={media} onChange={setMedia} disabled={busy} />

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      <div className="cpost-foot">
        <span className="muted">Every student and placement cell that can see your page.</span>
        <span className="cpost-buttons">
          {post && (
            <button type="button" className="linkish" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void save(false)}
            disabled={busy}
          >
            Save draft
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void save(true)}
            disabled={busy}
          >
            {post?.publishedAt ? 'Save changes' : 'Post'}
          </button>
        </span>
      </div>
    </div>
  );
}

/** Pictures and videos on a post: add, caption, remove. */
function MediaList({
  media,
  onChange,
  disabled,
}: {
  media: PostMedia[];
  onChange: (media: PostMedia[]) => void;
  disabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = media.length >= MAX_MEDIA;

  async function take(files: FileList | null) {
    if (!files || disabled) return;
    setBusy(true);
    setError(null);
    try {
      const room = MAX_MEDIA - media.length;
      const chosen = [...files].slice(0, room);
      const added = await Promise.all(
        chosen.map((f) =>
          companyPostsApi.uploadMedia(f.type.startsWith('video/') ? 'video' : 'image', f),
        ),
      );
      onChange([...media, ...added.map((a) => ({ kind: a.kind, url: a.url }))]);
      if (files.length > room) setError(`A post carries ${MAX_MEDIA}, so the rest were left out.`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That upload did not work.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="cpost-media">
      {media.length > 0 && (
        <ul>
          {media.map((m, i) => (
            <li key={m.url}>
              {m.kind === 'video' ? (
                <video src={m.url} controls preload="metadata" />
              ) : (
                <img src={m.url} alt="" />
              )}
              <input
                value={m.caption ?? ''}
                maxLength={120}
                placeholder="Caption (optional)"
                disabled={disabled}
                aria-label={`Caption for attachment ${i + 1}`}
                onChange={(e) =>
                  onChange(media.map((n, j) => (j === i ? { ...n, caption: e.target.value } : n)))
                }
              />
              <button
                type="button"
                className="linkish"
                disabled={disabled}
                onClick={() => onChange(media.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="cprof-pic-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => input.current?.click()}
          disabled={disabled || busy || full}
        >
          {busy ? 'Uploading…' : full ? `That is all ${MAX_MEDIA}` : 'Add picture or video'}
        </button>
        <span className="muted">Pictures up to 4 MB, video up to 50 MB.</span>
      </div>

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
        multiple
        hidden
        onChange={(e) => void take(e.target.files)}
      />
    </div>
  );
}
