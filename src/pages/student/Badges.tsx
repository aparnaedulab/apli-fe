import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from './StudentLayout';
import { api, ApiError } from '../../api/client';
import { ApliFace } from './Apli';
import './Badges.css';

/**
 * My badges.
 *
 * A record of movement that does not depend on a company replying. Most of
 * what this portal has to tell somebody is a refusal, and on a week where
 * nothing has come back a student has no evidence they are getting anywhere -
 * but "you finished your profile, sent ten applications and cleared a round"
 * stays true through a silent fortnight.
 *
 * Two rules keep it honest, and both are visible in how the page is built.
 *
 * Nothing is invented: every badge comes from a row that already exists and
 * carries that row's own date, so a badge cannot claim more than the record.
 *
 * And nothing is comparative. No counts against the cohort, no ranking, no
 * "you are ahead of 40% of your batch". The rest of the student side refuses
 * to keep score and one page doing it would undo all of it.
 */

interface Badge {
  key: string;
  label: string;
  how: string;
  at: string | null;
  earned: boolean;
  to: string;
}

const dateOf = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

export default function Badges() {
  const [badges, setBadges] = useState<Badge[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAhead, setShowAhead] = useState(false);

  useEffect(() => {
    api
      .get<{ badges: Badge[] }>('/candidate/badges')
      .then((r) => setBadges(r.badges))
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Could not load your badges.'),
      );
  }, []);

  const won = useMemo(() => (badges ?? []).filter((b) => b.earned), [badges]);
  const ahead = useMemo(() => (badges ?? []).filter((b) => !b.earned), [badges]);

  return (
    <StudentLayout>
      <div className="bg">
        <header className="bg-head">
          <h1>My badges</h1>
          <p>
            Things you have actually done, with the date they happened. None of it depends on
            anybody writing back.
          </p>
        </header>

        {error && <p className="alert alert-error">{error}</p>}
        {badges === null && !error && <p className="muted">Loading…</p>}

        {badges && (
          <p className="bg-apli">
            <ApliFace mood={won.length > 0 ? 'cheer' : 'hello'} size={34} />
            <span>
              {won.length === 0
                ? 'Nothing here yet. The first one is a resume, and that is entirely yours to do.'
                : won.length === 1
                  ? 'One so far. Every one of these is something you did.'
                  : `${won.length} so far — and every one of them is something you did.`}
            </span>
          </p>
        )}

        {won.length > 0 && (
          <ul className="bg-won">
            {won.map((b) => (
              <li key={b.key}>
                <Link to={`${b.to}?from=badges`}>
                  <span className="bg-mark" aria-hidden="true">
                    ✓
                  </span>
                  <span className="bg-what">
                    <b>{b.label}</b>
                    {/* The date the record itself carries. Where there is no
                        date to be had, nothing is guessed. */}
                    <small>{b.at ? dateOf(b.at) : b.how}</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/*
          What is still ahead, folded away.

          Eleven grey circles above a student who has earned two is a page
          saying "you have not got a job" in nine different ways. Opened on
          purpose it is a map of what comes next; left open it is a scoreboard
          against themselves.
        */}
        {ahead.length > 0 && badges && (
          <section className="bg-ahead">
            <button
              type="button"
              className="link-btn"
              onClick={() => setShowAhead((v) => !v)}
              aria-expanded={showAhead}
            >
              {showAhead ? 'Hide what is still ahead' : `What is still ahead · ${ahead.length}`}
            </button>

            {showAhead && (
              <ul>
                {ahead.map((b) => (
                  <li key={b.key}>
                    <Link to={`${b.to}?from=badges`}>
                      <span className="bg-what">
                        <b>{b.label}</b>
                        <small>{b.how}</small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </StudentLayout>
  );
}
