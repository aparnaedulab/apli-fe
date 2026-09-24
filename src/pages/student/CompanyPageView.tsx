import { useState } from 'react';
import { Link } from 'react-router-dom';
import { showcaseApi, SIZE_LABEL, type CompanyPageView as View, type StudentCompanyPage } from '../../api/showcase';
import type { CompanyPost } from '../../api/company';
import { exactly, timeAgo } from '../../lib/when';
import './CompanyPage.css';

/**
 * Everything the portal knows about a company, as a student reads it.
 *
 * Three kinds of thing, kept visibly apart because they are worth different
 * amounts. What the company says about itself, which is a claim. What it has
 * been posting, which is a claim with a date on it. And what we measured from
 * how it actually behaves here - how fast it replies, whether it honours its
 * offers - which is the only part nobody can write for themselves.
 *
 * Shared by the student's page and the company's own editor preview, so the
 * preview is exactly what students get rather than an approximation of it.
 */
export default function CompanyPageLayers({
  view,
  roles,
}: {
  view: View;
  roles?: StudentCompanyPage['roles'];
}) {
  const s = view.says;
  const facts = [
    s.industry,
    s.sizeBand ? SIZE_LABEL[s.sizeBand] : null,
    s.city,
    s.foundedYear ? `Founded ${s.foundedYear}` : null,
  ].filter(Boolean);

  return (
    <div className="cp">
      {/* A cover only when there is one: an empty grey band says nothing and
          pushes everything that matters below the fold. */}
      {s.coverUrl && (
        <div className="cp-cover">
          <img src={s.coverUrl} alt="" />
        </div>
      )}

      <header className="cp-head">
        <span className="cp-logo" aria-hidden="true">
          {s.logoUrl ? <img src={s.logoUrl} alt="" /> : s.name.slice(0, 2).toUpperCase()}
        </span>
        <div>
          <h1>{s.name}</h1>
          {s.headline && <p className="cp-headline">{s.headline}</p>}
          <p className="cp-sub">
            {facts.join(' · ')}
            {s.website && (
              <>
                {facts.length ? ' · ' : ''}
                <a href={s.website} target="_blank" rel="noreferrer noopener">
                  Website
                </a>
              </>
            )}
            {s.careersUrl && (
              <>
                {' · '}
                <a href={s.careersUrl} target="_blank" rel="noreferrer noopener">
                  Careers
                </a>
              </>
            )}
            {s.linkedinUrl && (
              <>
                {' · '}
                <a href={s.linkedinUrl} target="_blank" rel="noreferrer noopener">
                  LinkedIn
                </a>
              </>
            )}
          </p>
        </div>
      </header>

      <section className="cp-layer cp-says" aria-labelledby="cp-says">
        <p className="cp-tag" id="cp-says">
          In their words
        </p>
        {!s.about && !s.whyJoin && !s.howWeHire ? (
          <p className="cp-empty">They have not written anything about themselves yet.</p>
        ) : (
          <>
            {s.about && <p className="cp-text">{s.about}</p>}
            {s.whyJoin && (
              <>
                <h3>Why join us</h3>
                <p className="cp-text">{s.whyJoin}</p>
              </>
            )}
            {s.howWeHire && (
              <>
                <h3>How we hire</h3>
                <p className="cp-text">{s.howWeHire}</p>
              </>
            )}
          </>
        )}
      </section>

      {s.photos.length > 0 && (
        <section className="cp-layer cp-shots" aria-labelledby="cp-shots">
          <p className="cp-tag" id="cp-shots">
            Where you would work
          </p>
          <ul className="cp-gallery">
            {s.photos.map((p) => (
              <li key={p.url}>
                <img src={p.url} alt={p.caption ?? ''} />
                {p.caption && <span>{p.caption}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <CompanyFeed
        companyId={s.id}
        name={s.name}
        logoUrl={s.logoUrl}
        posts={view.posts}
        cursor={view.postsCursor}
      />

      {/*
        The part a company cannot write for itself.
        
        Worked out from what actually happens here - how fast they reply,
        whether offers are honoured - which is why it is marked as ours and
        sits apart from everything above it.
      */}
      <section className="cp-layer cp-measured" aria-labelledby="cp-measured">
        <p className="cp-tag" id="cp-measured">
          What we measure <span>— they can’t edit this</span>
        </p>
        <dl className="cp-facts">
          {view.measured.map((f) => (
            <div key={f.key} className={f.enough ? '' : 'is-thin'}>
              <dt>{f.label}</dt>
              <dd>{f.display ?? '—'}</dd>
              <p>{f.sentence}</p>
            </div>
          ))}
        </dl>
      </section>

      <section className="cp-layer cp-seniors" aria-labelledby="cp-seniors">
        <p className="cp-tag" id="cp-seniors">
          What seniors say
        </p>
        <p className="cp-empty">{view.seniors.note}</p>
      </section>

      {roles && (
        <section className="cp-layer" aria-labelledby="cp-roles">
          <p className="cp-tag" id="cp-roles">
            Open to you
          </p>
          {roles.length === 0 ? (
            <p className="cp-empty">No roles from them are open to you right now.</p>
          ) : (
            <ul className="cp-roles">
              {roles.map((r) => (
                <li key={r.id}>
                  <Link to={`/student/jobs/${r.id}`}>
                    <strong>{r.title}</strong>
                    <small>
                      {[r.location, `Apply by ${new Date(r.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </small>
                    <span aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

/**
 * What the company has been saying lately.
 *
 * Read-only by design: no likes, no comments, nobody to follow. A student
 * reading this is deciding whether to apply, and the useful question is what
 * this company has been doing - not how many people approved of it.
 */
function CompanyFeed({
  companyId,
  name,
  logoUrl,
  posts,
  cursor,
}: {
  companyId: string;
  name: string;
  logoUrl: string | null;
  posts: CompanyPost[];
  cursor: string | null;
}) {
  const [extra, setExtra] = useState<CompanyPost[]>([]);
  const [next, setNext] = useState(cursor);
  const [busy, setBusy] = useState(false);

  const all = [...posts, ...extra];

  async function more() {
    if (!next || busy) return;
    setBusy(true);
    try {
      const page = await showcaseApi.posts(companyId, next);
      setExtra((e) => [...e, ...page.posts]);
      setNext(page.nextCursor);
    } catch {
      // A feed that will not extend is a disappointment, not an error worth
      // taking over the page: the button simply stops offering.
      setNext(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="cp-layer cp-feed" aria-labelledby="cp-feed">
      <p className="cp-tag" id="cp-feed">
        Updates
      </p>

      {all.length === 0 ? (
        <p className="cp-empty">They have not posted anything yet.</p>
      ) : (
        <ol className="cp-posts">
          {all.map((post) => (
            <li key={post.id} className="cp-post">
              <div className="cp-post-head">
                <span className="cp-post-logo" aria-hidden="true">
                  {logoUrl ? <img src={logoUrl} alt="" /> : name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <strong>{name}</strong>
                  {post.publishedAt && (
                    <time dateTime={post.publishedAt} title={exactly(post.publishedAt)}>
                      {timeAgo(post.publishedAt)}
                    </time>
                  )}
                </div>
                {post.pinned && <span className="pill pill-idle">Pinned</span>}
              </div>

              {post.title && <h3 className="cp-post-title">{post.title}</h3>}

              {/* Stored sanitised: the server strips everything but a small
                  set of tags before it ever reaches this column, so what is
                  rendered here is what it allowed. */}
              <div className="cp-post-body" dangerouslySetInnerHTML={{ __html: post.bodyHtml }} />

              {post.media.length > 0 && (
                <ul className="cp-post-media">
                  {post.media.map((m) => (
                    <li key={m.url}>
                      {m.kind === 'video' ? (
                        <video src={m.url} controls preload="metadata" />
                      ) : (
                        <img src={m.url} alt={m.caption ?? ''} />
                      )}
                      {m.caption && <span>{m.caption}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}

      {next && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void more()} disabled={busy}>
          {busy ? 'Loading…' : 'Show more'}
        </button>
      )}
    </section>
  );
}
