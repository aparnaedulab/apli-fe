import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ApiError } from '../../../api/client';
import { platformApi } from '../../../api/platform';
import { platformMapping, type MappingCollege, type Offered } from '../../../api/mapping';
import MapData from '../../../components/MapData';
import MappingSummary from '../../../components/MappingSummary';
import type { StepProps } from '../Onboarding';
import { SidePanel, StepFooter } from '../ui';

/**
 * Map courses to colleges: after the university's courses (What they teach)
 * and its colleges (Where they teach), say which college runs which course
 * and branch - and, once students exist, which student is in which.
 *
 * The colleges are a table - a university can have dozens - and mapping one
 * opens it in a side panel, so the list and its progress stay in view.
 *
 * Optional, like batches: a college's own login can pick its courses later
 * from the same list.
 */
export default function MappingStep({ state, onSaved, goto }: StepProps) {
  const t = state!.tenant;
  const api = useMemo(() => platformMapping(t.id), [t.id]);

  const [colleges, setColleges] = useState<MappingCollege[] | null>(null);
  const [offered, setOffered] = useState<Offered | null>(null);
  /** The college open in the side panel. */
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'map' | 'summary'>('map');
  const [query, setQuery] = useState('');
  const [show, setShow] = useState<'all' | 'todo' | 'done'>('all');

  const load = useCallback(async () => {
    try {
      const r = await api.overview();
      setColleges(r.colleges);
      setOffered(r.offered);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the colleges.');
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  // Stable, so the panel's effect does not re-run on every render.
  const close = useCallback(() => setOpenId(null), []);

  const college = colleges?.find((c) => c.id === openId);
  const scope = useMemo(() => (openId ? api.forCollege(openId) : null), [api, openId]);
  const mapped = (colleges ?? []).filter((c) => c.programs > 0).length;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (colleges ?? [])
      .filter((c) => show === 'all' || (show === 'done' ? c.programs > 0 : c.programs === 0))
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q),
      );
  }, [colleges, query, show]);

  async function next(e: FormEvent) {
    e.preventDefault();
    try {
      if (mapped === 0 && !t.completedSteps.includes('mapping')) {
        onSaved(await platformApi.completeStep(t.id, 'mapping'));
      } else {
        onSaved(await platformApi.state(t.id));
      }
      goto('batches');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not continue.');
    }
  }

  return (
    <div>
      {colleges?.length === 0 && (
        <p className="alert alert-warn">
          No colleges yet. Add them in <b>Where they teach</b> first, then come back to map their courses.
        </p>
      )}
      {offered?.fromCatalogue && (
        <div className="alert alert-warn">
          <p>
            <b>{t.shortName || t.name}</b> has not ticked and saved any courses of its own yet, so every course on
            the platform is offered below.
          </p>
          <button type="button" className="btn btn-secondary" onClick={() => goto('academics')}>
            ← Choose the university's courses
          </button>
        </div>
      )}

      {colleges && colleges.length > 0 && (
        <section className="blk cg-blk">
          <div className="cg-bar">
            <div className="cg-tabs" role="tablist" aria-label="What to show">
              <button
                type="button"
                role="tab"
                aria-selected={view === 'map' && show === 'all'}
                className={view === 'map' && show === 'all' ? 'is-on' : ''}
                onClick={() => {
                  setView('map');
                  setShow('all');
                }}
              >
                All colleges <span>{colleges.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === 'map' && show === 'todo'}
                className={view === 'map' && show === 'todo' ? 'is-on' : ''}
                onClick={() => {
                  setView('map');
                  setShow('todo');
                }}
              >
                Not mapped <span>{colleges.length - mapped}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === 'map' && show === 'done'}
                className={view === 'map' && show === 'done' ? 'is-on' : ''}
                onClick={() => {
                  setView('map');
                  setShow('done');
                }}
              >
                Mapped <span>{mapped}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === 'summary'}
                className={view === 'summary' ? 'is-on' : ''}
                onClick={() => setView('summary')}
              >
                Summary
              </button>
            </div>

            {view === 'map' && (
              <div className="search cg-search">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="m20 20-4.2-4.2" />
                </svg>
                <input
                  className="input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find a college by name, code or city"
                  aria-label="Find a college"
                />
              </div>
            )}
          </div>

          {view === 'summary' && (
            <MappingSummary load={api.summary} allColleges={colleges} onEdit={(id) => setOpenId(id)} />
          )}

          {view === 'map' &&
            (shown.length === 0 ? (
              <div className="cg-empty">
                <p>
                  {show === 'todo' && !query
                    ? 'Every college is mapped.'
                    : show === 'done' && !query
                      ? 'No college is mapped yet.'
                      : 'No college matches that.'}
                </p>
              </div>
            ) : (
              <div className="ct-wrap">
                <table className="ct">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>College</th>
                      <th>City</th>
                      <th className="ct-num">Courses</th>
                      <th className="ct-num">Students mapped</th>
                      <th>Status</th>
                      <th className="ct-act">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((c) => (
                      <tr key={c.id} onClick={() => setOpenId(c.id)}>
                        <td className="ct-code">{c.code}</td>
                        <td className="ct-name ct-wrap-text">{c.name}</td>
                        <td className="ct-muted">{c.city || '—'}</td>
                        <td className="ct-num">{c.programs || '—'}</td>
                        <td className="ct-num">{c.students ? `${c.mapped} of ${c.students}` : '—'}</td>
                        <td>
                          {c.programs > 0 ? (
                            <span className="pill pill-pass">Mapped</span>
                          ) : (
                            <span className="pill pill-hold">Not mapped</span>
                          )}
                        </td>
                        <td className="ct-act">
                          <button
                            type="button"
                            className="linkish"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenId(c.id);
                            }}
                          >
                            {c.programs > 0 ? 'Edit' : 'Map courses'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
        </section>
      )}

      {scope && college && offered && (
        <SidePanel title={college.name} subtitle={`${college.code}${college.city ? ` · ${college.city}` : ''}`} onClose={close}>
          <MapData
            key={college.id}
            scope={scope}
            offered={offered}
            collegeName={college.code}
            onChanged={load}
            layout="table"
          />
        </SidePanel>
      )}

      <form onSubmit={next}>
        <StepFooter
          busy={false}
          error={error}
          onBack={() => goto('colleges')}
          submitLabel={mapped ? 'Continue' : 'Skip for now'}
          note={colleges ? `${mapped} of ${colleges.length} colleges mapped` : undefined}
        />
      </form>
    </div>
  );
}
