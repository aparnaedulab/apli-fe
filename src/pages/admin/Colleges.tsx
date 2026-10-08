import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import {
  adminApi,
  type CollegeList,
  type CollegeQuery,
  type CollegeSort,
  type CollegeSummary,
} from '../../api/admin';
import CollegeForm from './CollegeForm';
import AddColleges from './AddColleges';
import { ApiError } from '../../api/client';
import './Colleges.css';

const SORTS: { value: CollegeSort; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'code', label: 'Code' },
  { value: 'city', label: 'City' },
  { value: 'students', label: 'Most students' },
  { value: 'newest', label: 'Recently added' },
];

const EMPTY_QUERY: CollegeQuery = {
  q: '',
  typeId: '',
  city: '',
  affiliated: '',
  hasTeam: '',
  sort: 'name',
  page: 1,
  limit: 25,
};

export default function Colleges() {
  const [adding, setAdding] = useState<'one' | 'bulk' | null>(null);
  const [query, setQuery] = useState<CollegeQuery>(EMPTY_QUERY);

  // What the box shows, kept apart from what has been searched for: typing
  // must not fire a request per keystroke.
  const [typed, setTyped] = useState('');

  const [data, setData] = useState<CollegeList | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = window.setTimeout(
      () => setQuery((q) => (q.q === typed ? q : { ...q, q: typed, page: 1 })),
      250,
    );
    return () => window.clearTimeout(id);
  }, [typed]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await adminApi.listColleges(query));
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load colleges.');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Any change to a filter sends you back to the first page. */
  function set<K extends keyof CollegeQuery>(key: K, value: CollegeQuery[K]) {
    setQuery((q) => ({ ...q, [key]: value, page: key === 'page' ? (value as number) : 1 }));
  }

  const filtering =
    Boolean(query.q) ||
    Boolean(query.typeId) ||
    Boolean(query.city) ||
    Boolean(query.affiliated) ||
    Boolean(query.hasTeam);

  function clearFilters() {
    setTyped('');
    setQuery({ ...EMPTY_QUERY, sort: query.sort, limit: query.limit });
  }

  const colleges = data?.colleges ?? [];
  const types = data?.filters.types ?? [];
  const cities = data?.filters.cities ?? [];

  // The portal is empty, as opposed to the filters matching nothing - two
  // situations that deserve completely different screens.
  const portalIsEmpty = data !== null && data.total === 0 && !filtering;

  return (
    <AdminLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>Colleges</h1>
          <p className="page-lede">
            Every college on the platform. Add one, then invite its placement officer — that invite
            is how the college gets its first account.
          </p>
        </div>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setAdding((v) => (v === 'bulk' ? null : 'bulk'))}
            aria-expanded={adding === 'bulk'}
          >
            {adding === 'bulk' ? 'Cancel' : 'Add in bulk'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setAdding((v) => (v === 'one' ? null : 'one'))}
            aria-expanded={adding === 'one'}
          >
            {adding === 'one' ? 'Cancel' : 'Add college'}
          </button>
        </div>
      </header>

      {adding === 'one' && (
        <CollegeForm
          onDone={() => {
            setAdding(null);
            void refresh();
          }}
          onCancel={() => setAdding(null)}
        />
      )}

      {adding === 'bulk' && <AddColleges onDone={refresh} />}

      {loadError && <p className="alert alert-error">{loadError}</p>}

      {!portalIsEmpty && data !== null && (
        <>
          <Summary summary={data.summary} filtering={filtering} onNeedsTeam={() => set('hasTeam', 'no')} />

          <Toolbar
            typed={typed}
            onTyped={setTyped}
            query={query}
            onSet={set}
            types={types}
            cities={cities}
            filtering={filtering}
            onClear={clearFilters}
          />

          {colleges.length === 0 ? (
            <div className="empty">
              <h2>Nothing matches</h2>
              <p>
                No college matches {query.q ? <b>&ldquo;{query.q}&rdquo;</b> : 'these filters'}.
                Try a different search, or clear the filters.
              </p>
              <button type="button" className="btn btn-secondary" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          ) : (
            <ul className={`ecards ${loading ? 'is-loading' : ''}`}>
              {colleges.map((c) => (
                <CollegeCard key={c.id} college={c} />
              ))}
            </ul>
          )}

          <Pager
            page={data.page}
            pages={data.pages}
            total={data.total}
            limit={data.limit}
            shown={colleges.length}
            onPage={(p) => set('page', p)}
            onLimit={(n) => set('limit', n)}
          />
        </>
      )}

      {portalIsEmpty && (
        <div className="empty">
          <h2>No colleges yet</h2>
          <p>
            Nothing else in the platform can happen until a college exists — students belong to
            batches, and batches belong to a college.
          </p>
        </div>
      )}

      {data === null && !loadError && <p className="muted">Loading…</p>}
    </AdminLayout>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The four numbers, on one line.
 *
 * They were four tiles with 27px figures, which spent about ninety pixels of
 * screen restating what the table below already shows. They are context, not
 * the point of the page - so they sit on a single strip, and only the one
 * that is a job to do keeps any colour.
 */
function Summary({
  summary,
  filtering,
  onNeedsTeam,
}: {
  summary: CollegeList['summary'];
  filtering: boolean;
  onNeedsTeam: () => void;
}) {
  const stats = [
    { value: summary.colleges, label: `college${summary.colleges === 1 ? '' : 's'}` },
    { value: summary.students, label: 'students' },
    { value: summary.batches, label: `batch${summary.batches === 1 ? '' : 'es'}` },
  ];

  return (
    <div className="stat-strip" aria-label={filtering ? 'Totals for these filters' : 'Totals'}>
      {stats.map((s) => (
        <span key={s.label} className="stat-item">
          <b>{s.value.toLocaleString()}</b> {s.label}
        </span>
      ))}

      {summary.withoutTeam > 0 && (
        <button type="button" className="stat-flag" onClick={onNeedsTeam}>
          <b>{summary.withoutTeam}</b> waiting for a login
        </button>
      )}

      {filtering && <span className="stat-note">matching your filters</span>}
    </div>
  );
}

function Toolbar({
  typed,
  onTyped,
  query,
  onSet,
  types,
  cities,
  filtering,
  onClear,
}: {
  typed: string;
  onTyped: (v: string) => void;
  query: CollegeQuery;
  onSet: <K extends keyof CollegeQuery>(key: K, value: CollegeQuery[K]) => void;
  types: { id: string; name: string; count: number }[];
  cities: { name: string; count: number }[];
  filtering: boolean;
  onClear: () => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);

  // "/" focuses the search box, which is the only thing on this screen that
  // gets used on every visit.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <section className="toolbar" aria-label="Search and filter">
      <div className="toolbar-row">
        <div className="search">
          <svg className="search-icon" viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M13.5 13.5 L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            ref={searchRef}
            type="search"
            value={typed}
            onChange={(e) => onTyped(e.target.value)}
            placeholder="Search by name, code or city"
            aria-label="Search colleges"
          />
          {!typed && <kbd className="search-kbd">/</kbd>}
        </div>

        <label className="filter">
          <span className="sr-only">Type</span>
          <select value={query.typeId ?? ''} onChange={(e) => onSet('typeId', e.target.value)}>
            <option value="">All types</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.count})
              </option>
            ))}
          </select>
        </label>

        <label className="filter">
          <span className="sr-only">City</span>
          <select value={query.city ?? ''} onChange={(e) => onSet('city', e.target.value)}>
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.count})
              </option>
            ))}
          </select>
        </label>

        <label className="filter">
          <span className="sr-only">Affiliation</span>
          <select
            value={query.affiliated ?? ''}
            onChange={(e) => onSet('affiliated', e.target.value as 'yes' | 'no' | '')}
          >
            <option value="">Affiliated or not</option>
            <option value="yes">Affiliated</option>
            <option value="no">Autonomous</option>
          </select>
        </label>

        <label className="filter">
          <span className="sr-only">Placement cell</span>
          <select
            value={query.hasTeam ?? ''}
            onChange={(e) => onSet('hasTeam', e.target.value as 'yes' | 'no' | '')}
          >
            <option value="">Any placement cell</option>
            <option value="no">No login yet</option>
            <option value="yes">Has a login</option>
          </select>
        </label>

        <label className="filter">
          <span className="sr-only">Sort</span>
          <select
            value={query.sort ?? 'name'}
            onChange={(e) => onSet('sort', e.target.value as CollegeSort)}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                Sort: {s.label}
              </option>
            ))}
          </select>
        </label>

        {filtering && (
          <button type="button" className="link-btn toolbar-clear" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function CollegeCard({ college: c }: { college: CollegeSummary }) {
  return (
    <li>
      <Link to={`/admin/colleges/${c.id}`} className="ecard">
        <span className="ecard-top">
          <span className="ecard-tag mono">{c.code}</span>
          {/*
            The one thing on this card that needs acting on. A college with no
            account cannot verify a student or run a drive, so it is not just a
            count of zero - it is work outstanding.
          */}
          {c.memberCount === 0 ? (
            <span className="pill pill-hold">No login yet</span>
          ) : (
            <span className="pill pill-pass">
              {c.memberCount} {c.memberCount === 1 ? 'person' : 'people'}
            </span>
          )}
        </span>
        <b className="ecard-title">{c.name}</b>
        <span className="ecard-sub">
          {c.city}
          {c.state && <>, {c.state}</>}
          {c.type && <> · {c.type}</>}
          {c.naacGrade && <> · NAAC {c.naacGrade}</>}
        </span>
        <dl className="ecard-facts">
          <div>
            <dt>Students</dt>
            <dd>{c.studentCount.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Batches</dt>
            <dd>{c.batchCount}</dd>
          </div>
          <div>
            <dt>Seasons</dt>
            <dd>{c.placementCount}</dd>
          </div>
        </dl>
        <span className="ecard-note affil" title={c.affiliation ?? undefined}>
          {c.affiliation ?? 'Autonomous'}
        </span>
        <span className="ecard-foot">
          <small>
            {c.memberCount === 0 ? 'Invite its placement officer' : 'Placement cell can sign in'}
          </small>
          <span className="ecard-go">{c.memberCount === 0 ? 'Invite →' : 'Open →'}</span>
        </span>
      </Link>
    </li>
  );
}

/* -------------------------------------------------------------------------- */

function Pager({
  page,
  pages,
  total,
  limit,
  shown,
  onPage,
  onLimit,
}: {
  page: number;
  pages: number;
  total: number;
  limit: number;
  shown: number;
  onPage: (p: number) => void;
  onLimit: (n: number) => void;
}) {
  // Numbers around the current page, with gaps rather than three hundred
  // buttons. First and last are always reachable.
  const numbers = useMemo(() => {
    const out: (number | 'gap')[] = [];
    const near = (n: number) => Math.abs(n - page) <= 1;

    for (let n = 1; n <= pages; n++) {
      if (n === 1 || n === pages || near(n)) out.push(n);
      else if (out[out.length - 1] !== 'gap') out.push('gap');
    }
    return out;
  }, [page, pages]);

  if (total === 0) return null;

  const from = (page - 1) * limit + 1;

  return (
    <nav className="pager" aria-label="Pages">
      <p className="pager-count">
        {/* A page past the end has no range to state - only a total. */}
        {shown > 0 ? `${from}–${from + shown - 1} of ${total}` : `${total} in total`}
      </p>

      {pages > 1 && (
        <div className="pager-pages">
          <button
            type="button"
            className="pager-btn"
            onClick={() => onPage(page - 1)}
            disabled={page === 1}
            aria-label="Previous page"
          >
            ‹
          </button>

          {numbers.map((n, i) =>
            n === 'gap' ? (
              <span key={`gap-${i}`} className="pager-gap" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={n}
                type="button"
                className={`pager-btn ${n === page ? 'is-current' : ''}`}
                onClick={() => onPage(n)}
                aria-current={n === page ? 'page' : undefined}
              >
                {n}
              </button>
            ),
          )}

          <button
            type="button"
            className="pager-btn"
            onClick={() => onPage(page + 1)}
            disabled={page === pages}
            aria-label="Next page"
          >
            ›
          </button>
        </div>
      )}

      <label className="pager-size">
        <span className="sr-only">Rows per page</span>
        <select value={limit} onChange={(e) => onLimit(Number(e.target.value))}>
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n} per page
            </option>
          ))}
        </select>
      </label>
    </nav>
  );
}
