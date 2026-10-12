import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import {
  LEVEL_LABEL,
  studentAppApi,
  type SimulationCard,
  type SimulationDetail,
  type SimulationReview,
  type HandInBody,
} from '../../api/studentApp';
import Shell, { CompanyTile, Cover, MY_STATUS, SimulationTile } from './Shell';
import { Progress } from './Home';
import ShareDialog from './Share';

const message = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

/** Every open simulation, by field and by words. The field is kept in the address. */
export function StudentSimulationList() {
  const [params, setParams] = useSearchParams();
  const field = params.get('field') ?? '';
  const [q, setQ] = useState('');
  const [data, setData] = useState<{ simulations: SimulationCard[]; fields: { field: string; count: number }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      studentAppApi
        .simulations(field || undefined, q.trim() || undefined)
        .then(setData)
        .catch((e) => setError(message(e, 'Could not load the simulations.')));
    }, 200);
    return () => window.clearTimeout(t);
  }, [field, q]);

  const total = data?.fields.reduce((n, f) => n + f.count, 0) ?? 0;

  return (
    <Shell>
      <section className="sa-hero is-short">
        <div className="sa-wrap">
          <p className="sa-eyebrow">Work simulations</p>
          <h1>
            Try the work <span className="sa-mark">before</span> the job
          </h1>
          <p className="sa-lede">Short sets of real tasks from the teams that do them. Your own pace; a certificate at the end.</p>
        </div>
      </section>

      <div className="sa-wrap sa-body">
        <div className="sa-filters">
          <div className="sa-chips" role="group" aria-label="Field">
            <button type="button" className={`sa-chip ${field ? '' : 'is-on'}`} onClick={() => setParams({})}>
              All fields
            </button>
            {data?.fields.map((f) => (
              <button
                key={f.field}
                type="button"
                className={`sa-chip ${field === f.field ? 'is-on' : ''}`}
                onClick={() => setParams({ field: f.field })}
              >
                {f.field}
              </button>
            ))}
          </div>
          <input
            type="search"
            className="sa-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, company or skill"
            aria-label="Search simulations"
          />
        </div>

        {error && <p className="sa-alert">{error}</p>}
        {!data && !error && <p className="sa-loading">Loading…</p>}
        {data && (
          <p className="sa-count">
            Showing {data.simulations.length} of {total} simulation{total === 1 ? '' : 's'}
          </p>
        )}
        {data && data.simulations.length === 0 && (
          <p className="sa-empty">Nothing matches that yet. Try another field or word.</p>
        )}
        {data && data.simulations.length > 0 && (
          <div className="sa-grid is-four">
            {data.simulations.map((s, i) => (
              <SimulationTile key={s.id} i={s} index={i} />
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

/**
 * One simulation: what it is, its tasks in order, and the one thing to do
 * next.
 *
 * Each task is handed in - an answer, a link to what they made, or both -
 * in order. Then the student explains their work in their own words, and a
 * reviewer reads it all. If the reviewer asks for changes, any task can be
 * handed in again. Approved work is verified and can be shared.
 */
export function StudentSimulationDetail() {
  const { slug = '' } = useParams();
  const [data, setData] = useState<SimulationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const load = useCallback(() => {
    studentAppApi
      .simulation(slug)
      .then(setData)
      .catch((e) => setError(message(e, 'Could not load this simulation.')));
  }, [slug]);

  useEffect(load, [load]);

  async function act(key: string, call: () => Promise<SimulationDetail>): Promise<boolean> {
    setBusy(key);
    setError(null);
    setFieldErrors({});
    try {
      setData(await call());
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.fields?.length) {
        setFieldErrors(Object.fromEntries(e.fields.map((f) => [f.path, f.message])));
      } else {
        setError(message(e, 'That did not work. Try again.'));
      }
      return false;
    } finally {
      setBusy(null);
    }
  }

  const s = data?.simulation;
  const run = data?.run;
  const status = run?.status;
  const next = data?.tasks.find((t) => !t.done);
  const done = data?.tasks.filter((t) => t.done).length ?? 0;
  const total = data?.tasks.length ?? 0;
  const canEdit = status === 'NEEDS_WORK';
  const readyToExplain = (status === 'ACTIVE' && !next) || (status === 'NEEDS_WORK' && !next);

  // Which tasks are opened up. The one to do next starts open.
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const isOpen = (id: string) => opened.has(id) || (status !== 'COMPLETED' && next?.id === id) || editing === id;
  const toggle = (id: string) =>
    setOpened((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // The tab lives in the address (#overview, #company, #tasks, #reviews), so a link opens the right one.
  const location = useLocation();
  const navigate = useNavigate();
  const tab: Tab = TABS.some((t) => `#${t.key}` === location.hash) ? (location.hash.slice(1) as Tab) : 'overview';
  const go = (t: Tab) => navigate({ hash: t }, { replace: true });

  const embed = s?.videoUrl ? videoEmbed(s.videoUrl) : null;
  const mine = s?.myStatus ? MY_STATUS[s.myStatus] : null;

  return (
    <Shell>
      {data && s && (
        <section className="sd-head">
          <div className="sa-wrap">
            <nav className="sa-crumbs" aria-label="Breadcrumb">
              <Link to="/student">Dashboard</Link>
              <span aria-hidden="true">/</span>
              <Link to="/student/simulations">Simulations</Link>
              <span aria-hidden="true">/</span>
              <span>{s.title}</span>
            </nav>
            <div className="sd-title">
              <CompanyTile company={s.company} big />
              <div>
                <h1>{s.title}</h1>
                <p>
                  {s.company.name} · {s.field} · {LEVEL_LABEL[s.level]} · ~{s.hours} hrs · {total} task{total === 1 ? '' : 's'}
                  {data.reviews.average !== null && (
                    <>
                      {' '}
                      · <span className="sd-stars-inline">★ {data.reviews.average}</span> ({data.reviews.count})
                    </>
                  )}
                </p>
              </div>
              {mine && <span className={`sa-sim-state is-${mine.tone} is-static`}>{mine.label}</span>}
            </div>
            <div className="sd-tabs" role="tablist" aria-label="About this simulation">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  className={tab === t.key ? 'is-on' : ''}
                  onClick={() => go(t.key)}
                >
                  {t.key === 'tasks' ? `Tasks (${total})` : t.key === 'reviews' ? `Reviews (${data.reviews.count})` : t.label}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="sa-wrap sa-body">
        {error && <p className="sa-alert">{error}</p>}
        {!data && !error && <p className="sa-loading">Loading…</p>}
        {data && s && (
          <div className="sa-layout sd-layout">
            <div className="sa-main-col">
              {status === 'NEEDS_WORK' && run?.reviewNote && (
                <blockquote className="sa-note is-big">
                  <b>The reviewer asked for changes</b>
                  {run.reviewNote}
                  <span>Change any task in Tasks, then send it back with your explanation.</span>
                </blockquote>
              )}

              {tab === 'overview' && (
                <section className="sd-panel">
                  <p className="sd-lead">{s.summary}</p>
                  {s.about && (
                    <>
                      <h2>Why this work matters</h2>
                      <div className="sa-prose sa-about">
                        {s.about.split(/\n{2,}/).map((p, i) => (
                          <p key={i}>{p}</p>
                        ))}
                      </div>
                    </>
                  )}
                  {s.skills.length > 0 && (
                    <>
                      <h2>Skills you will practise</h2>
                      <div className="sa-skills is-big">
                        {s.skills.map((k) => (
                          <i key={k}>{k}</i>
                        ))}
                      </div>
                    </>
                  )}
                  <h2>What you get</h2>
                  <ul className="sd-gets">
                    <li>A verified certificate, issued when {s.company.name} approves your work</li>
                    <li>Feedback from the reviewer on every task</li>
                    <li>Work you can share with the companies you choose</li>
                  </ul>
                  {s.fromCollege > 0 && (
                    <p className="sa-peers">
                      <span aria-hidden="true">●</span> {s.fromCollege} from your college finished this
                    </p>
                  )}
                </section>
              )}

              {tab === 'company' && (
                <section className="sd-panel">
                  <div className="sd-company">
                    <CompanyTile company={s.company} big />
                    <div>
                      <h2>{data.company.name}</h2>
                      {data.company.headline && <p className="sd-muted">{data.company.headline}</p>}
                    </div>
                  </div>
                  <dl className="sd-facts">
                    {data.company.industry && (
                      <div>
                        <dt>Industry</dt>
                        <dd>{data.company.industry}</dd>
                      </div>
                    )}
                    {data.company.size && (
                      <div>
                        <dt>Size</dt>
                        <dd>{data.company.size}</dd>
                      </div>
                    )}
                    {data.company.city && (
                      <div>
                        <dt>Based in</dt>
                        <dd>{data.company.city}</dd>
                      </div>
                    )}
                    {data.company.founded && (
                      <div>
                        <dt>Founded</dt>
                        <dd>{data.company.founded}</dd>
                      </div>
                    )}
                  </dl>
                  {data.company.about ? (
                    <div className="sa-prose sa-about">
                      {data.company.about.split(/\n{2,}/).map((p, i) => (
                        <p key={i}>{p}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="sd-muted">{data.company.name} has not written about itself yet.</p>
                  )}
                  {data.company.website && (
                    <a className="sa-link" href={data.company.website} target="_blank" rel="noreferrer">
                      Visit their website ↗
                    </a>
                  )}
                  {data.company.more.length > 0 && (
                    <>
                      <h2>More from {data.company.name}</h2>
                      <ul className="sd-more">
                        {data.company.more.map((m) => (
                          <li key={m.slug}>
                            <Link to={`/student/simulations/${m.slug}`}>{m.title}</Link>
                            <span>
                              {m.field} · ~{m.hours} hrs
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </section>
              )}

              {tab === 'tasks' && (
                <>
                  <ol className="sa-path-tasks">
                    {data.tasks.map((t) => {
                      const isNext = status === 'ACTIVE' && next?.id === t.id;
                      const form = isNext || editing === t.id || (canEdit && !t.done);
                      const open = isOpen(t.id) || form;
                      return (
                        <li key={t.id} className={`${t.done ? 'is-done' : ''} ${isNext ? 'is-next' : ''} ${open ? 'is-open' : ''}`}>
                          <button type="button" className="sa-pt-head" onClick={() => toggle(t.id)} aria-expanded={open}>
                            <span className="sa-task-n" aria-hidden="true">
                              {t.done ? '✓' : t.position}
                            </span>
                            <span className="sa-pt-title">
                              <b>{t.title}</b>
                              <span>
                                ~{t.minutes} min
                                {t.done ? ' · handed in' : isNext ? ' · next' : ''}
                              </span>
                            </span>
                            <span className="sa-pt-caret" aria-hidden="true">
                              ▾
                            </span>
                          </button>

                          {open && (
                            <div className="sa-pt-body">
                              {t.learn.length > 0 && (
                                <div className="sa-pt-learn">
                                  <h4>What you will learn</h4>
                                  <ul>
                                    {t.learn.map((l) => (
                                      <li key={l}>{l}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              <p className="sa-pt-brief">{t.brief}</p>
                              {t.steps.length > 0 && (
                                <div className="sa-pt-steps">
                                  <h4>What you will do</h4>
                                  <ol>
                                    {t.steps.map((l) => (
                                      <li key={l}>{l}</li>
                                    ))}
                                  </ol>
                                </div>
                              )}
                              {t.handIn && (
                                <p className="sa-task-handin">
                                  <b>Hand in:</b> {t.handIn}
                                </p>
                              )}
                              {!run && <p className="sa-pt-hint">Start the simulation to hand this in.</p>}
                              {t.handedIn && !form && (
                                <div className="sa-handed">
                                  <span className="sa-handed-label">You handed in</span>
                                  {t.handedIn.answer && <p>{t.handedIn.answer}</p>}
                                  {t.handedIn.link && (
                                    <a href={t.handedIn.link} target="_blank" rel="noreferrer" className="sa-link is-small">
                                      {t.handedIn.link} ↗
                                    </a>
                                  )}
                                  {t.handedIn.fileUrl && (
                                    <a href={t.handedIn.fileUrl} target="_blank" rel="noreferrer" className="sa-link is-small">
                                      File: {t.handedIn.fileName ?? 'attached'} ↗
                                    </a>
                                  )}
                                  {canEdit && (
                                    <button type="button" className="sa-quiet" onClick={() => setEditing(t.id)}>
                                      Change this
                                    </button>
                                  )}
                                </div>
                              )}
                              {t.pages.length > 0 && (
                                <p className="sd-muted">
                                  {t.pages.filter((p) => p.kind === 'read').length} page
                                  {t.pages.filter((p) => p.kind === 'read').length === 1 ? '' : 's'} to read ·{' '}
                                  {t.pages.filter((p) => p.kind === 'check').length} quick check
                                  {t.pages.filter((p) => p.kind === 'check').length === 1 ? '' : 's'}
                                </p>
                              )}
                              {run && (form || t.done) && (
                                <Link to={`/student/simulations/${slug}/tasks/${t.id}`} className="sa-btn is-small sd-open">
                                  {t.done && !form ? 'Open task' : t.handedIn ? 'Change your hand-in' : 'Open task'}{' '}
                                  <span aria-hidden="true">→</span>
                                </Link>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>

                  {run && readyToExplain && (
                    <Explain
                      initial={run}
                      busy={busy === 'explain'}
                      errors={fieldErrors}
                      again={status === 'NEEDS_WORK'}
                      onSubmit={(body) => act('explain', () => studentAppApi.explain(slug, body))}
                    />
                  )}

                  {run && (status === 'IN_REVIEW' || status === 'COMPLETED') && run.explainHow && (
                    <section className="sd-panel">
                      <h2>How you explained it</h2>
                      <div className="sa-handed">
                        <span className="sa-handed-label">How you went about it</span>
                        <p>{run.explainHow}</p>
                        <span className="sa-handed-label">What you would do differently</span>
                        <p>{run.explainChange}</p>
                      </div>
                    </section>
                  )}
                </>
              )}

              {tab === 'reviews' && (
                <Reviews
                  slug={slug}
                  summary={data.reviews}
                  onSaved={(d) => setData(d)}
                />
              )}
            </div>

            <aside className="sa-aside sd-aside">
              {embed ? (
                <div className="sa-video">
                  <iframe
                    src={embed}
                    title={`${s.company.name} - introduction`}
                    loading="lazy"
                    allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="sd-cover">
                  <Cover sim={s} />
                </div>
              )}

              <section className="sa-panel is-white sd-cta">
                {!run && (
                  <>
                    <h2>Ready when you are</h2>
                    <p>
                      {total} tasks, about {s.hours} hours. Self-paced: stop whenever you like.
                    </p>
                    <button
                      type="button"
                      className="sa-btn is-wide"
                      disabled={busy !== null}
                      onClick={async () => {
                        if (await act('start', () => studentAppApi.start(slug)) && data.tasks[0]) {
                          navigate(`/student/simulations/${slug}/tasks/${data.tasks[0].id}`);
                        }
                      }}
                    >
                      {busy === 'start' ? 'Starting…' : 'Start this simulation'}
                    </button>
                  </>
                )}
                {status === 'ACTIVE' && (
                  <>
                    <h2>
                      {done} of {total} tasks handed in
                    </h2>
                    <Progress done={done} total={total} />
                    <p>{next ? `Next: ${next.title}, ~${next.minutes} min.` : 'Every task is in. Explain your work to send it.'}</p>
                    {next ? (
                      <Link to={`/student/simulations/${slug}/tasks/${next.id}`} className="sa-btn is-wide">
                        Continue
                      </Link>
                    ) : (
                      <button type="button" className="sa-btn is-wide" onClick={() => go('tasks')}>
                        Explain your work
                      </button>
                    )}
                  </>
                )}
                {status === 'NEEDS_WORK' && (
                  <>
                    <h2>Changes asked</h2>
                    <p>Make the changes, then send it back with your explanation.</p>
                    <button type="button" className="sa-btn is-wide" onClick={() => go('tasks')}>
                      Make changes
                    </button>
                  </>
                )}
                {status === 'IN_REVIEW' && (
                  <>
                    <h2>With {s.company.name}</h2>
                    <p>
                      Sent {run?.submittedAt ? shortDate(run.submittedAt) : ''}. You will see their answer here and on your
                      dashboard.
                    </p>
                  </>
                )}
                {status === 'COMPLETED' && run && (
                  <>
                    <h2>
                      <span className="sa-seal" aria-hidden="true">
                        ✓
                      </span>{' '}
                      Verified
                    </h2>
                    <a className="sa-code is-link" href={`/certificates/${run.certificateCode}`} target="_blank" rel="noreferrer">
                      <code>{run.certificateCode}</code>
                      <span>Public page ↗</span>
                    </a>
                    <button
                      type="button"
                      className={`sa-share-btn ${run.sharedWith.length ? 'is-on' : ''}`}
                      onClick={() => setSharing(true)}
                    >
                      <span>
                        {run.sharedWith.length
                          ? `Shared with ${run.sharedWith.map((c) => c.name).join(', ')}`
                          : 'Private · not shared yet'}
                      </span>
                      <b>{run.sharedWith.length ? 'Change' : 'Share'}</b>
                    </button>
                    {!data.reviews.mine && (
                      <button type="button" className="sa-quiet" onClick={() => go('reviews')}>
                        Say what it was like →
                      </button>
                    )}
                  </>
                )}
                {status === 'LEFT' && (
                  <button
                    type="button"
                    className="sa-btn is-wide"
                    disabled={busy !== null}
                    onClick={() => act('start', () => studentAppApi.start(slug))}
                  >
                    Pick it back up
                  </button>
                )}
              </section>
            </aside>
          </div>
        )}
      </div>

      {sharing && run && s && (
        <ShareDialog runId={run.id} title={s.title} onClose={() => setSharing(false)} onSaved={() => load()} />
      )}
    </Shell>
  );
}

type Tab = 'overview' | 'company' | 'tasks' | 'reviews';
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'company', label: 'About the company' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'reviews', label: 'Reviews' },
];

/**
 * What students who finished it said. Someone who finished it - and only
 * them - can add their own stars and a line for the next student.
 */
function Reviews({
  slug,
  summary,
  onSaved,
}: {
  slug: string;
  summary: SimulationDetail['reviews'];
  onSaved: (d: SimulationDetail) => void;
}) {
  const [list, setList] = useState<SimulationReview[] | null>(null);
  const [stars, setStars] = useState(summary.mine?.stars ?? 0);
  const [comment, setComment] = useState(summary.mine?.comment ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    studentAppApi
      .reviews(slug)
      .then(setList)
      .catch((e) => setError(message(e, 'Could not load the reviews.')));
  }, [slug]);

  useEffect(load, [load]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!stars) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await studentAppApi.saveReview(slug, { stars, comment: comment.trim() || undefined }));
      setSaved(true);
      load();
    } catch (err) {
      setError(message(err, 'Could not save your review.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="sd-panel">
      <div className="sd-rating">
        <b>{summary.average ?? '–'}</b>
        <div>
          <Stars value={summary.average ?? 0} />
          <span className="sd-muted">
            {summary.count ? `${summary.count} review${summary.count === 1 ? '' : 's'} from students who finished it` : 'No reviews yet'}
          </span>
        </div>
      </div>

      {summary.canReview && (
        <form className="sd-review-form" onSubmit={save}>
          <h2>{summary.mine ? 'Your review' : 'What was it like?'}</h2>
          <div className="sd-star-pick" role="radiogroup" aria-label="Stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={stars === n}
                aria-label={`${n} star${n === 1 ? '' : 's'}`}
                className={n <= stars ? 'is-on' : ''}
                onClick={() => setStars(n)}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="A line or two for the next student: how clear it was, how long it really took, what you learnt."
          />
          <div className="sa-handin-foot">
            {saved && <span className="sa-saved">Saved</span>}
            <button type="submit" className="sa-btn is-small" disabled={busy || !stars}>
              {busy ? 'Saving…' : summary.mine ? 'Update review' : 'Post review'}
            </button>
          </div>
        </form>
      )}

      {error && <p className="sa-alert">{error}</p>}
      {list && list.length > 0 && (
        <ul className="sd-reviews">
          {list.map((r, i) => (
            <li key={i}>
              <div className="sd-review-top">
                <Stars value={r.stars} />
                <span className="sd-muted">{shortDate(r.at)}</span>
              </div>
              {r.comment && <p>{r.comment}</p>}
              <span className="sd-by">
                {r.by}
                {r.college ? ` · ${r.college}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      {list && list.length === 0 && !summary.canReview && (
        <p className="sd-muted">Students who finish it can say what it was like. Be the first.</p>
      )}
    </section>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="sd-stars" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= Math.round(value) ? 'is-on' : ''} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  );
}

/**
 * A YouTube or Vimeo address, as the player's own embed address. Anything
 * else is not shown: the page only ever frames those two players.
 */
function videoEmbed(url: string): string | null {
  const yt = url.match(/^https:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/i);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vimeo = url.match(/^https:\/\/(?:www\.)?vimeo\.com\/(\d+)/i);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

/** The hand-in form for one task: an answer, a link, or both. */
export function HandIn({
  initial,
  busy,
  errors,
  onSubmit,
  onCancel,
  kinds = ['text', 'link', 'file'],
}: {
  /** The ways the company allows; all three when not said. */
  kinds?: ('text' | 'link' | 'file')[];
  initial: { answer: string | null; link: string | null; fileUrl?: string | null; fileName?: string | null } | null;
  busy: boolean;
  errors: Record<string, string>;
  onSubmit: (body: HandInBody) => void;
  onCancel?: () => void;
}) {
  const [answer, setAnswer] = useState(initial?.answer ?? '');
  const [link, setLink] = useState(initial?.link ?? '');
  const [file, setFile] = useState<{ url: string; name: string } | null>(
    initial?.fileUrl ? { url: initial.fileUrl, name: initial.fileName ?? 'Your file' } : null,
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const empty = !answer.trim() && !link.trim() && !file;

  async function pick(f: File | undefined) {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      setUploadError('Keep the file under 5 MB.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      setFile(await studentAppApi.upload(f));
    } catch (e) {
      setUploadError(e instanceof ApiError ? e.message : 'Could not upload that file.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      className="sa-handin"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (!empty) {
          onSubmit({
            answer: answer.trim() || undefined,
            link: link.trim() || undefined,
            fileUrl: file?.url ?? null,
            fileName: file?.name ?? null,
          });
        }
      }}
    >
      {kinds.includes('text') && (
      <label>
        <span>Your answer</span>
        <textarea
          rows={5}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="What you did and what you found. Write it the way you would to the team that set it."
        />
        {errors.answer && <em>{errors.answer}</em>}
      </label>
      )}
      <div className={`sa-handin-row ${kinds.includes('link') && kinds.includes('file') ? '' : 'is-one'}`}>
        {kinds.includes('link') && (
        <label>
          <span>
            Link to your work {kinds.length > 1 && <i>optional</i>}
          </span>
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https:// - a sheet, a doc, a repository, slides"
          />
          {errors.link && <em>{errors.link}</em>}
        </label>
        )}
        {kinds.includes('file') && (
        <div className="sa-upload">
          <span>
            Upload a file <i>{kinds.length > 1 ? 'optional - ' : ''}PDF or picture, up to 5 MB</i>
          </span>
          {file ? (
            <span className="sa-file">
              <span className="sa-file-icon" aria-hidden="true">
                {/\.pdf$/i.test(file.url) ? 'PDF' : 'IMG'}
              </span>
              <a href={file.url} target="_blank" rel="noreferrer">
                {file.name}
              </a>
              <button type="button" onClick={() => setFile(null)} aria-label="Remove the file">
                ×
              </button>
            </span>
          ) : (
            <label className={`sa-drop ${uploading ? 'is-busy' : ''}`}>
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                hidden
                onChange={(e) => pick(e.target.files?.[0])}
              />
              {uploading ? 'Uploading…' : 'Choose a file'}
            </label>
          )}
          {(uploadError || errors.fileUrl) && <em>{uploadError ?? errors.fileUrl}</em>}
        </div>
        )}
      </div>
      <div className="sa-handin-foot">
        <span>{kinds.includes('text') ? `${answer.trim().split(/\s+/).filter(Boolean).length} words` : ''}</span>
        {onCancel && (
          <button type="button" className="sa-quiet" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="sa-btn is-small" disabled={busy || uploading || empty}>
          {busy ? 'Handing in…' : initial ? 'Hand in again' : 'Hand in this task'}
        </button>
      </div>
    </form>
  );
}

/** The last step before review: the work, in the student's own words. */
function Explain({
  initial,
  busy,
  errors,
  again,
  onSubmit,
}: {
  initial: { explainHow: string | null; explainChange: string | null } | null | undefined;
  busy: boolean;
  errors: Record<string, string>;
  again: boolean;
  onSubmit: (body: { how: string; change: string }) => void;
}) {
  const [how, setHow] = useState(initial?.explainHow ?? '');
  const [change, setChange] = useState(initial?.explainChange ?? '');
  return (
    <section className="sa-block sa-explain">
      <p className="sa-eyebrow">Last step</p>
      <h2>Explain your work</h2>
      <p className="sa-prose">
        A reviewer reads this beside what you handed in. It is how they know the work is yours - write it plainly, in your
        own words.
      </p>
      <form
        className="sa-handin"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          onSubmit({ how, change });
        }}
      >
        <label>
          <span>How did you go about it?</span>
          <textarea rows={4} value={how} onChange={(e) => setHow(e.target.value)} placeholder="The steps you took, and why in that order." />
          {errors.how && <em>{errors.how}</em>}
        </label>
        <label>
          <span>What would you do differently next time?</span>
          <textarea rows={3} value={change} onChange={(e) => setChange(e.target.value)} placeholder="One thing you would change, and why." />
          {errors.change && <em>{errors.change}</em>}
        </label>
        <div className="sa-handin-foot">
          <span>Once sent, it stays as it is unless the reviewer asks for changes.</span>
          <button type="submit" className="sa-btn" disabled={busy || !how.trim() || !change.trim()}>
            {busy ? 'Sending…' : again ? 'Send it back for review' : 'Send for review'}
          </button>
        </div>
      </form>
    </section>
  );
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
