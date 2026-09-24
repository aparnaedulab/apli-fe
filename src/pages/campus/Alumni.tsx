import { useCallback, useEffect, useState } from 'react';
import CampusLayout from './CampusLayout';
import { ApiError } from '../../api/client';
import { gapsApi, shortDate, type ModQuestion } from '../../api/gaps';
import { useAuth } from '../../auth/AuthContext';
import './Alumni.css';

type Filter = 'all' | 'OPEN' | 'ANSWERED' | 'HIDDEN';

/**
 * Moderating the alumni board: every question students asked, hidden ones
 * included, with the asker's real name even when students see "Anonymous".
 *
 * Hiding is reversible and is the usual tool - a question naming a
 * recruiter, or one asked twice. Deleting is kept for answers only, and only
 * for the ones that should never have been written; a hidden question can
 * always be brought back, a deleted answer cannot.
 */
export default function Alumni() {
  const { hasModule, can } = useAuth();
  const on = hasModule('community.alumni');
  const allowed = can('student:read');
  const moderate = can('posting:decide');
  const [data, setData] = useState<{ questions: ModQuestion[]; mentors: number } | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!on || !allowed) return;
    gapsApi
      .alumniQuestions()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load the alumni board.'));
  }, [on, allowed]);

  useEffect(load, [load]);

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not go through. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const head = (lede: string) => (
    <header className="page-head">
      <div>
        <p className="eyebrow">Placement cell</p>
        <h1>Alumni board</h1>
        <p className="page-lede">{lede}</p>
      </div>
    </header>
  );

  if (!on) {
    return <CampusLayout>{head('Alumni connect is not switched on for your institution.')}</CampusLayout>;
  }
  if (!allowed) {
    return <CampusLayout>{head('Your role does not include reading student records, so the board is not shown.')}</CampusLayout>;
  }

  const all = data?.questions ?? [];
  const count = (s: Filter) => (s === 'all' ? all.length : all.filter((q) => q.status === s).length);
  const shown = filter === 'all' ? all : all.filter((q) => q.status === filter);

  return (
    <CampusLayout>
      {head(
        'Questions your students asked your graduates, and the answers. Hide anything that should not be there; students never see who hid it.',
      )}

      {error && <p className="alert alert-error">{error}</p>}
      {data && (
        <p className="muted">
          {data.mentors} {data.mentors === 1 ? 'graduate is' : 'graduates are'} available to answer.
          {!moderate && ' Your role can read the board but not hide or remove anything.'}
        </p>
      )}

      <div className="alm-tabs" role="tablist" aria-label="Show">
        {(['all', 'OPEN', 'ANSWERED', 'HIDDEN'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            className={`seg-opt ${filter === f ? 'is-on' : ''}`}
            onClick={() => setFilter(f)}
          >
            {FILTER_LABEL[f]} <span className="alm-count">{count(f)}</span>
          </button>
        ))}
      </div>

      {data === null ? (
        <p className="muted">Loading…</p>
      ) : shown.length === 0 ? (
        <section className="card">
          <p className="muted">{filter === 'all' ? 'No questions yet.' : 'Nothing here.'}</p>
        </section>
      ) : (
        shown.map((q) => (
          <article key={q.id} className={`card alm-q ${q.status === 'HIDDEN' ? 'is-hidden' : ''}`}>
            <header className="alm-q-head">
              <div>
                <p className="alm-q-meta">
                  {q.askedBy}
                  {q.anonymous && <span className="pill pill-idle">Shown as anonymous</span>}
                  {q.companyName && <span className="muted"> · about {q.companyName}</span>}
                  <span className="muted"> · {shortDate(q.createdAt)}</span>
                </p>
                <p className="alm-q-body">{q.body}</p>
              </div>
              <span className={`pill ${STATUS_PILL[q.status]}`}>{STATUS_LABEL[q.status]}</span>
            </header>

            {q.answers.length > 0 && (
              <ul className="alm-answers">
                {q.answers.map((a) => (
                  <li key={a.id}>
                    <p className="alm-a-meta">
                      {a.by}
                      {a.byLine && <span className="muted"> · {a.byLine}</span>}
                      <span className="muted"> · {shortDate(a.createdAt)}</span>
                    </p>
                    <p className="alm-a-body">{a.body}</p>
                    {moderate && (
                      <button
                        type="button"
                        className="btn btn-ghost alm-btn"
                        disabled={busy !== null}
                        onClick={() => {
                          if (window.confirm('Delete this answer for good? It cannot be brought back.')) {
                            void act(`a-${a.id}`, () => gapsApi.deleteAnswer(a.id));
                          }
                        }}
                      >
                        {busy === `a-${a.id}` ? 'Deleting…' : 'Delete answer'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {moderate && (
              <div className="alm-actions">
                <button
                  type="button"
                  className="btn btn-secondary alm-btn"
                  disabled={busy !== null}
                  onClick={() => void act(`q-${q.id}`, () => gapsApi.setQuestionHidden(q.id, q.status !== 'HIDDEN'))}
                >
                  {busy === `q-${q.id}` ? 'Saving…' : q.status === 'HIDDEN' ? 'Show again' : 'Hide question'}
                </button>
              </div>
            )}
          </article>
        ))
      )}
    </CampusLayout>
  );
}

const FILTER_LABEL: Record<Filter, string> = { all: 'All', OPEN: 'Waiting', ANSWERED: 'Answered', HIDDEN: 'Hidden' };
const STATUS_LABEL: Record<ModQuestion['status'], string> = { OPEN: 'Waiting', ANSWERED: 'Answered', HIDDEN: 'Hidden' };
const STATUS_PILL: Record<ModQuestion['status'], string> = { OPEN: 'pill-hold', ANSWERED: 'pill-pass', HIDDEN: 'pill-idle' };
