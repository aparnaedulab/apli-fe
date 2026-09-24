import { useCallback, useEffect, useState, type ReactNode } from 'react';
import AdminLayout from './AdminLayout';
import { api } from '../../api/client';
import { ApiError } from '../../api/client';

export interface Paged<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface Column<T> {
  key: string;
  label: string;
  /** Right-aligned and tabular. */
  numeric?: boolean;
  render: (row: T) => ReactNode;
}

export interface Filter {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

interface AdminTableProps<T> {
  title: string;
  lede: string;
  /** API path without query string, e.g. "/admin/users". */
  path: string;
  columns: Column<T>[];
  filters?: Filter[];
  searchPlaceholder?: string;
  emptyMessage?: string;
  rowKey: (row: T) => string;
  /** Rendered above the table — used for stat strips. */
  children?: ReactNode;
  /** Rendered in the header, beside the row count. For a create button. */
  action?: ReactNode;
  /** Between the header and the search bar. For a create form the action opens. */
  banner?: ReactNode;
  /** Bumped by a caller to force a reload after it changed something. */
  reloadKey?: number;
}

/**
 * Every operations list is the same object: search, optional filters, a table
 * and paging. Writing it once means the eight screens differ only in their
 * columns, which is the only thing that actually differs.
 */
export default function AdminTable<T>({
  title,
  lede,
  path,
  columns,
  filters = [],
  searchPlaceholder = 'Search…',
  emptyMessage = 'Nothing here.',
  rowKey,
  children,
  action,
  banner,
  reloadKey = 0,
}: AdminTableProps<T>) {
  const [data, setData] = useState<Paged<T> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [active, setActive] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: '25' });
    if (q.trim()) params.set('q', q.trim());
    for (const [k, v] of Object.entries(active)) if (v) params.set(k, v);

    try {
      setData(await api.get<Paged<T>>(`${path}?${params.toString()}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this list.');
    }
  }, [path, page, q, active]);

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    const t = window.setTimeout(load, q ? 300 : 0);
    return () => window.clearTimeout(t);
    // reloadKey lets a caller that created a row pull the list again.
  }, [load, q, reloadKey]);

  return (
    <AdminLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>{title}</h1>
          <p className="page-lede">{lede}</p>
        </div>
        <div className="btn-row">
          {data && (
            <span className="count-chip">
              {data.total} {data.total === 1 ? 'row' : 'rows'}
            </span>
          )}
          {action}
        </div>
      </header>

      {banner}

      {children}

      <div className="list-controls">
        <input
          className="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
        />
        {filters.map((f) => (
          <select
            key={f.key}
            value={active[f.key] ?? ''}
            onChange={(e) => {
              setActive((a) => ({ ...a, [f.key]: e.target.value }));
              setPage(1);
            }}
            aria-label={f.label}
          >
            <option value="">{f.label}</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ))}
      </div>

      {error && <p className="alert alert-error">{error}</p>}
      {!data && !error && <p className="muted">Loading…</p>}

      {data?.rows.length === 0 && (
        <div className="empty">
          <h2>Nothing to show</h2>
          <p>{emptyMessage}</p>
        </div>
      )}

      {data && data.rows.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} className={c.numeric ? 'num' : undefined}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={rowKey(row)}>
                    {columns.map((c) => (
                      <td key={c.key} className={c.numeric ? 'num' : undefined}>
                        {c.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.pageCount > 1 && (
            <nav className="pager" aria-label="Pages">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span className="muted">
                Page {data.page} of {data.pageCount}
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={page >= data.pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </AdminLayout>
  );
}

/** Shared cell helpers, so formatting is consistent across every list. */
export const cell = {
  date: (v: string | null) => (v ? new Date(v).toLocaleDateString() : '—'),
  dateTime: (v: string | null) => (v ? new Date(v).toLocaleString() : '—'),
  lakhs: (v: string | null) => (v ? `₹${(Number(v) / 100000).toFixed(1)}L` : '—'),
  pill: (text: string, tone: 'pass' | 'hold' | 'stop' | 'idle' = 'idle') => (
    <span className={`pill pill-${tone}`}>{text}</span>
  ),
  primary: (text: string, sub?: string | null) => (
    <>
      <span className="row-link">{text}</span>
      {sub && <span className="row-sub">{sub}</span>}
    </>
  ),
};
