import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import StudentLayout from './StudentLayout';
import { studentJobsApi } from '../../api/candidate';
import { useAuth } from '../../auth/AuthContext';
import {
  GUIDES,
  SHELVES,
  forYou,
  guideById,
  type Cue,
  type Guide,
  type GuideLink,
} from './guides/content';
import './Guides.css';

/**
 * Guides: how campus hiring works, and what a student is owed inside it.
 *
 * The only reading surface on the student side, which is exactly why it is
 * not a blog. Every other page is for doing something - practising, applying,
 * tracking - and an article library sitting beside them would be read once and
 * then rot. What is here instead is the two things no career website could
 * write: how *this* system works, and what the person is entitled to when it
 * goes wrong.
 *
 * It is one route rather than a route per guide. A guide is opened with `?g=`,
 * and a long one can be opened at one section with `?s=` - so the strips on
 * the application screens can link at the paragraph that applies rather than
 * at a contents page.
 *
 * The block at the top is the point of the whole section: three guides chosen
 * from what is actually happening to this student today - an offer waiting on
 * an answer, a round they have been called to - because a guide nobody is
 * handed at the right moment is read only by the student who was already
 * going to be fine.
 *
 * The section itself is not behind a module: it is writing, it costs nothing
 * to run, and a guide switched off is a student who was not told something
 * they were owed. Each guide carries the module it is *about*, so a portal
 * without the offer card does not explain the offer card.
 */

/** Ticks are the student's own. Nobody is marked on a guide. */
const CHECK_KEY = 'guides.checks';

function readChecks(): Record<string, boolean> {
  try {
    return JSON.parse(window.localStorage.getItem(CHECK_KEY) ?? '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
}

function writeChecks(next: Record<string, boolean>) {
  try {
    window.localStorage.setItem(CHECK_KEY, JSON.stringify(next));
  } catch {
    /* A browser that refuses storage still gets to read the guide. */
  }
}

export default function Guides() {
  const { hasModule } = useAuth();
  const [params, setParams] = useSearchParams();

  /* A guide whose module an institution has switched off is not on the shelf
     and cannot be opened by typing its name into the address bar either. */
  const visible = useMemo(
    () => GUIDES.filter((g) => !g.module || hasModule(g.module)),
    [hasModule],
  );

  const open = useMemo(() => {
    const g = guideById(params.get('g'));
    return g && visible.includes(g) ? g : null;
  }, [params, visible]);

  if (open) {
    return (
      <StudentLayout>
        <Reader
          guide={open}
          anchor={params.get('s')}
          shelfMates={visible.filter((g) => g.shelf === open.shelf)}
          onClose={() => setParams({}, { replace: true })}
        />
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Guides</p>
          <h1>How this works, and what you are owed</h1>
          <p className="page-lede">
            Written by the people who run campus hiring, about this portal and this season. Short -
            none of it is longer than four minutes.
          </p>
        </div>
      </header>

      <ForYou guides={visible} />

      {SHELVES.map((shelf) => {
        const items = visible.filter((g) => g.shelf === shelf.key);
        if (items.length === 0) return null;
        return (
          <section key={shelf.key} className="gd-shelf">
            <div className="gd-shelf-head">
              <h2>{shelf.name}</h2>
              <p className="muted">{shelf.blurb}</p>
            </div>
            <ul className="gd-grid">
              {items.map((g) => (
                <li key={g.id}>
                  <Link className="gd-card" to={`/student/guides?g=${g.id}`}>
                    <b>{g.title}</b>
                    <span>{g.lede}</span>
                    <small>{g.minutes} min read</small>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <p className="gd-foot muted">
        Something here wrong, or missing for your college? Tell your placement cell - these are
        meant to be corrected.
      </p>
    </StudentLayout>
  );
}

/* -------------------------------------------------------------------------- */
/* What is worth reading today                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Three guides, chosen from what is actually happening to this student.
 *
 * It reads the applications the student already has - no new endpoint, and
 * nothing is stored about what they read. If that call fails, the block falls
 * back to the three everybody should read before the season, which is a worse
 * answer than a personal one and a much better one than an empty box.
 */
function ForYou({ guides }: { guides: Guide[] }) {
  const [cues, setCues] = useState<Cue[] | null>(null);

  useEffect(() => {
    let alive = true;
    studentJobsApi
      .applications()
      .then((apps) => {
        const statuses = apps.map((a) => a.status);
        /* The round each live application is actually sitting at. */
        const rounds = apps
          .filter((a) => ['SHORTLISTED', 'IN_ROUND', 'UNDER_REVIEW', 'APPLIED'].includes(a.status))
          .map((a) => {
            const at = Math.max(a.currentRound?.order ?? 0, 1);
            return a.rounds.find((r) => r.order === at)?.type ?? null;
          })
          .filter((t): t is string => Boolean(t));
        if (alive) setCues(forYou({ statuses, rounds }));
      })
      .catch(() => {
        if (alive) setCues(forYou({ statuses: [], rounds: [] }));
      });
    return () => {
      alive = false;
    };
  }, []);

  const shown = (cues ?? []).filter((c) => guides.some((g) => g.id === c.guide));
  if (shown.length === 0) return null;

  return (
    <section className="gd-now">
      <h2>Worth reading today</h2>
      <ul>
        {shown.map((c) => {
          const g = guides.find((x) => x.id === c.guide)!;
          return (
            <li key={c.guide + (c.anchor ?? '')}>
              <Link to={`/student/guides?g=${c.guide}${c.anchor ? `&s=${c.anchor}` : ''}`}>
                <span className="gd-now-cue">{c.cue}</span>
                <small>
                  {g.title} · {g.minutes} min
                </small>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Reading one                                                                 */
/* -------------------------------------------------------------------------- */

function Reader({
  guide,
  anchor,
  shelfMates,
  onClose,
}: {
  guide: Guide;
  anchor: string | null;
  shelfMates: Guide[];
  onClose: () => void;
}) {
  const { hasModule } = useAuth();
  const [checks, setChecks] = useState<Record<string, boolean>>(readChecks);

  /* Opened at a section, because the strip that sent them here knew which
     part applied. The heading is still above it, so nobody lands mid-sentence
     without knowing what they are reading. */
  useEffect(() => {
    if (!anchor) {
      window.scrollTo({ top: 0 });
      return;
    }
    const el = document.getElementById(`gd-${anchor}`);
    if (el) el.scrollIntoView({ block: 'start' });
  }, [anchor, guide.id]);

  const links = (guide.links ?? []).filter((l: GuideLink) => !l.module || hasModule(l.module));
  const next = shelfMates[shelfMates.findIndex((g) => g.id === guide.id) + 1];

  function tick(key: string, on: boolean) {
    const updated = { ...checks, [key]: on };
    setChecks(updated);
    writeChecks(updated);
  }

  return (
    <article className="gd-read">
      <button type="button" className="link-btn gd-back" onClick={onClose}>
        All guides
      </button>

      <header className="page-head">
        <div>
          <p className="eyebrow">{SHELVES.find((s) => s.key === guide.shelf)?.name}</p>
          <h1>{guide.title}</h1>
          <p className="page-lede">{guide.lede}</p>
          <p className="gd-time">{guide.minutes} min read</p>
        </div>
      </header>

      {guide.sections.map((s) => (
        <section
          key={s.id}
          id={`gd-${s.id}`}
          className={`gd-section ${anchor === s.id ? 'is-aimed' : ''}`}
        >
          <h2>{s.heading}</h2>
          {s.body.map((p) => (
            <p key={p}>{p}</p>
          ))}
          {s.list && (
            <ul className="gd-list">
              {s.list.map((li) => (
                <li key={li}>{li}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {guide.checklist && (
        <section className="card gd-check">
          <h2>Before you close this</h2>
          <p className="muted">Yours alone - nobody sees these, and nothing here is marked.</p>
          <ul>
            {guide.checklist.map((item, i) => {
              const key = `${guide.id}:${i}`;
              return (
                <li key={item}>
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(checks[key])}
                      onChange={(e) => tick(key, e.target.checked)}
                    />
                    <span>{item}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {links.length > 0 && (
        <section className="gd-do">
          <h2>Now go and do it</h2>
          <ul>
            {links.map((l) => (
              <li key={l.to + l.label}>
                <Link to={l.to}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {next && (
        <p className="gd-next">
          Next in {SHELVES.find((s) => s.key === guide.shelf)?.name.toLowerCase()}:{' '}
          <Link to={`/student/guides?g=${next.id}`}>{next.title}</Link>
        </p>
      )}
    </article>
  );
}
