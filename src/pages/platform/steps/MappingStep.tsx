import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ApiError } from '../../../api/client';
import { platformApi } from '../../../api/platform';
import { platformMapping, type MappingCollege, type Offered } from '../../../api/mapping';
import MapData from '../../../components/MapData';
import MappingSummary from '../../../components/MappingSummary';
import type { StepProps } from '../Onboarding';
import { StepFooter } from '../ui';

/**
 * Map courses to colleges: after the university's courses (What they teach)
 * and its colleges (Where they teach), say which college runs which course
 * and branch - and, once students exist, which student is in which.
 *
 * Optional, like batches: a college's own login can pick its courses later
 * from the same list.
 */
export default function MappingStep({ state, onSaved, goto }: StepProps) {
  const t = state!.tenant;
  const api = useMemo(() => platformMapping(t.id), [t.id]);

  const [colleges, setColleges] = useState<MappingCollege[] | null>(null);
  const [offered, setOffered] = useState<Offered | null>(null);
  const [collegeId, setCollegeId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'map' | 'summary'>('map');

  const load = useCallback(async () => {
    try {
      const r = await api.overview();
      setColleges(r.colleges);
      setOffered(r.offered);
      setCollegeId((current) => current || r.colleges[0]?.id || '');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the colleges.');
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const college = colleges?.find((c) => c.id === collegeId);
  const scope = useMemo(() => (collegeId ? api.forCollege(collegeId) : null), [api, collegeId]);
  const mapped = (colleges ?? []).filter((c) => c.programs > 0).length;

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
            <b>{t.shortName || t.name}</b> has not ticked and saved any courses of its own yet. The courses you see
            in <b>What they teach</b> are the platform's shared list; until some are added to this university
            there, every course on the platform is offered below.
          </p>
          <button type="button" className="btn btn-secondary" onClick={() => goto('academics')}>
            ← Choose the university's courses
          </button>
        </div>
      )}

      {colleges && colleges.length > 0 && (
        <div className="md-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'map'}
            className={`md-tab ${view === 'map' ? 'is-current' : ''}`}
            onClick={() => setView('map')}
          >
            Map a college
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'summary'}
            className={`md-tab ${view === 'summary' ? 'is-current' : ''}`}
            onClick={() => setView('summary')}
          >
            View mapped data
            <span className="md-tab-count">
              {mapped}/{colleges.length}
            </span>
          </button>
        </div>
      )}

      {view === 'summary' && colleges && (
        <section className="blk">
          <MappingSummary
            load={api.summary}
            allColleges={colleges}
            onEdit={(id) => {
              setCollegeId(id);
              setView('map');
            }}
          />
        </section>
      )}

      {view === 'map' && colleges && colleges.length > 0 && (
        <section className="blk">
          <h2 className="blk-title">Choose a college</h2>
          <div className="map-college-chips" role="listbox" aria-label="Colleges">
            {colleges.map((c) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={c.id === collegeId}
                className={`map-college-chip ${c.id === collegeId ? 'is-current' : ''}`}
                onClick={() => setCollegeId(c.id)}
              >
                <b>{c.code}</b>
                <span>
                  {c.programs ? `${c.programs} course/branch${c.programs === 1 ? '' : 'es'}` : 'Not mapped'}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {view === 'map' && scope && college && offered && (
        <section className="blk">
          <h2 className="blk-title">{college.name}</h2>
          <MapData
            key={college.id}
            scope={scope}
            offered={offered}
            collegeName={college.code}
            onChanged={load}
          />
        </section>
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
