import { useCallback, useEffect, useState, type FormEvent } from 'react';
import AdminLayout from './AdminLayout';
import { api, ApiError } from '../../api/client';

interface CollegeType {
  id: string;
  name: string;
  isActive: boolean;
  collegeCount: number;
}

/**
 * Reference data operations maintains. Kept out of the code so a new college
 * type does not need a deploy, and out of free-text fields so the values stay
 * consistent enough to filter on.
 */
export default function Settings() {
  const [types, setTypes] = useState<CollegeType[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const load = useCallback(async () => {
    try {
      const { types: list } = await api.get<{ types: CollegeType[] }>(
        '/admin/college-types?includeRetired=true',
      );
      setTypes(list);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the list.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await run(async () => {
      await api.post('/admin/college-types', { name });
      setName('');
    });
  }

  return (
    <AdminLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>Settings</h1>
          <p className="page-lede">
            Lists the rest of the platform chooses from. Changing one here changes it everywhere,
            with no deploy.
          </p>
        </div>
      </header>

      {error && <p className="alert alert-error">{error}</p>}

      <section className="card">
        <h2>College types</h2>
        <p className="muted">
          What appears in the Type dropdown when adding a college. A type already in use cannot be
          deleted — retire it instead, and it stays on those colleges while disappearing from the
          form.
        </p>

        {types === null && <p className="muted">Loading…</p>}

        {types && types.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th className="num">Colleges</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.id}>
                  <td>
                    {editing === t.id ? (
                      <span className="inline-add">
                        <input
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setEditing(null);
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              await api.patch(`/admin/college-types/${t.id}`, { name: draft });
                              setEditing(null);
                            })
                          }
                        >
                          Save
                        </button>
                        <button type="button" className="link-btn" onClick={() => setEditing(null)}>
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <span className="row-link">{t.name}</span>
                    )}
                  </td>
                  <td className="num">{t.collegeCount}</td>
                  <td>
                    {t.isActive ? (
                      <span className="pill pill-pass">In use</span>
                    ) : (
                      <span className="pill pill-idle">Retired</span>
                    )}
                  </td>
                  <td className="right">
                    {editing !== t.id && (
                      <span className="btn-row">
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => {
                            setEditing(t.id);
                            setDraft(t.name);
                          }}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="link-btn"
                          disabled={busy}
                          onClick={() =>
                            run(() =>
                              api.patch(`/admin/college-types/${t.id}`, { isActive: !t.isActive }),
                            )
                          }
                        >
                          {t.isActive ? 'Retire' : 'Restore'}
                        </button>
                        {t.collegeCount === 0 && (
                          <button
                            type="button"
                            className="link-btn is-danger"
                            disabled={busy}
                            onClick={() => run(() => api.delete(`/admin/college-types/${t.id}`))}
                          >
                            Delete
                          </button>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <form className="inline-add add-row" onSubmit={add}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add a type, for example Polytechnic"
            disabled={busy}
          />
          <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
            Add type
          </button>
        </form>
      </section>
    </AdminLayout>
  );
}
