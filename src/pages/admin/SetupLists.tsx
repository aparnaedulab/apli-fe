import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';
import './SetupLists.css';

/**
 * Every list the rest of the portal picks from, in one place.
 *
 * These used to be typed wherever they were needed, which is how "Pune",
 * "pune" and "PUNE" became three cities, and "B.E." and "B.Tech" two courses
 * that never matched each other. Operations keeps them here; every other form
 * offers them and nothing else.
 *
 * Nothing is deleted while records carry it. A city on twelve colleges is
 * retired instead - it leaves the forms and stays on the colleges, because
 * the alternative is twelve colleges somewhere the portal cannot name.
 */

interface Entry {
  id: string;
  name: string;
  isActive: boolean;
  inUse: number;
  /** False where the list has no retired state, like skills. */
  canRetire?: boolean;
  /** Branches, where the list is courses. */
  children?: { id: string; name: string; isActive: boolean }[];
}

type ListKey =
  | 'courses'
  | 'skills'
  | 'cities'
  | 'states'
  | 'naacGrades'
  | 'genders'
  | 'collegeTypes'
  | 'industries';

const LISTS: {
  key: ListKey;
  label: string;
  hint: string;
  /** Where the value is stored, which decides which endpoint edits it. */
  kind?: 'CITY' | 'STATE' | 'NAAC_GRADE' | 'GENDER';
  path?: string;
  placeholder: string;
}[] = [
  {
    key: 'courses',
    label: 'Courses and branches',
    hint: 'What the university runs. A batch, a student and a role all match on these exactly, so one spelling is the whole point.',
    path: '/admin/courses',
    placeholder: 'B.Tech',
  },
  {
    key: 'skills',
    label: 'Skills',
    hint: 'Shared between students and roles - a student lists one and a role asks for it, and they only meet if it is the same entry. Two spellings would be two skills that never match.',
    path: '/admin/skills',
    placeholder: 'Kubernetes',
  },
  {
    key: 'cities',
    label: 'Cities',
    hint: 'Offered on the college form, the company form and a job location.',
    kind: 'CITY',
    placeholder: 'Pune',
  },
  {
    key: 'states',
    label: 'States',
    hint: 'The same three forms.',
    kind: 'STATE',
    placeholder: 'Maharashtra',
  },
  {
    key: 'naacGrades',
    label: 'NAAC grades',
    hint: 'Shown on a college and used by recruiters choosing where to go.',
    kind: 'NAAC_GRADE',
    placeholder: 'A++',
  },
  {
    key: 'genders',
    label: 'Genders',
    hint: 'Offered on the student form and in the class-list spreadsheet.',
    kind: 'GENDER',
    placeholder: 'Prefer not to say',
  },
  {
    key: 'collegeTypes',
    label: 'College types',
    hint: 'Engineering, Management, Pharmacy — whatever the university distinguishes.',
    path: '/admin/college-types',
    placeholder: 'Engineering',
  },
  {
    key: 'industries',
    label: 'Industries',
    hint: 'Offered to a company describing itself when it registers.',
    path: '/admin/industries',
    placeholder: 'Information Technology',
  },
];

export default function SetupLists() {
  const [open, setOpen] = useState<ListKey>('courses');
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [adding, setAdding] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const list = LISTS.find((l) => l.key === open)!;

  const load = useCallback(async () => {
    setEntries(null);
    setError(null);
    try {
      if (list.key === 'courses') {
        const r = await api.get<{
          courses: { id: string; name: string; isActive: boolean; inUse: number; branches: { id: string; name: string; isActive: boolean }[] }[];
        }>('/admin/courses?includeRetired=true');
        setEntries(
          r.courses.map((c) => ({
            id: c.id,
            name: c.name,
            isActive: c.isActive,
            inUse: c.inUse,
            children: c.branches,
          })),
        );
        return;
      }

      if (list.kind) {
        const r = await api.get<{
          values: { id: string; value: string; isActive: boolean; inUse: number }[];
        }>(`/admin/reference?kind=${list.kind}&includeRetired=true`);
        setEntries(
          r.values.map((v) => ({ id: v.id, name: v.value, isActive: v.isActive, inUse: v.inUse })),
        );
        return;
      }

      // College types and industries answer under their own key.
      const r = await api.get<
        Record<
          string,
          {
            id: string;
            name: string;
            isActive?: boolean;
            collegeCount?: number;
            companyCount?: number;
            inUse?: number;
          }[]
        >
      >(`${list.path}?includeRetired=true`);
      const rows = r.types ?? r.industries ?? r.skills ?? [];
      setEntries(
        rows.map((t) => ({
          id: t.id,
          name: t.name,
          // A skill has no retired state: one nobody uses is noise, and one
          // somebody uses should stay.
          isActive: t.isActive ?? true,
          inUse: t.inUse ?? t.collegeCount ?? t.companyCount ?? 0,
          canRetire: t.isActive !== undefined,
        })),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load that list.');
      setEntries([]);
    }
  }, [list]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(fn: () => Promise<unknown>, said?: string) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await fn();
      if (said) setNote(said);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  function add() {
    const value = adding.trim();
    if (!value) return;

    void act(async () => {
      if (list.key === 'courses') await api.post('/admin/courses', { name: value });
      else if (list.kind) await api.post(`/admin/reference/${list.kind}`, { value });
      else await api.post(list.path!, { name: value });
      setAdding('');
    });
  }

  const retire = (e: Entry) =>
    act(() => {
      const body = { isActive: !e.isActive };
      if (list.key === 'courses') return api.patch(`/admin/courses/${e.id}`, body);
      if (list.kind) return api.patch(`/admin/reference/${e.id}`, body);
      return api.patch(`${list.path}/${e.id}`, body);
    }, e.isActive ? `${e.name} retired. It stays on the records that already have it.` : `${e.name} is back on the forms.`);

  const remove = (e: Entry) =>
    act(() => {
      if (list.key === 'courses') return api.delete(`/admin/courses/${e.id}`);
      if (list.kind) return api.delete(`/admin/reference/${e.id}`);
      return api.delete(`${list.path}/${e.id}`);
    }, `${e.name} removed.`);

  return (
    <div className="setup-lists">
      <p className="pane-note">
        Every dropdown on the portal is filled from here. Anything typed by hand somewhere else is
        how one course ends up spelled two ways and a filter quietly stops matching.
      </p>

      <div className="list-tabs">
        {LISTS.map((l) => (
          <button
            key={l.key}
            type="button"
            className={`list-tab ${l.key === open ? 'is-current' : ''}`}
            onClick={() => {
              setOpen(l.key);
              setAdding('');
              setNote(null);
            }}
          >
            {l.label}
          </button>
        ))}
      </div>

      <p className="list-hint">{list.hint}</p>

      {error && <p className="alert alert-error">{error}</p>}
      {note && <p className="alert alert-ok">{note}</p>}

      <div className="list-add">
        <input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          placeholder={list.placeholder}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="btn btn-primary" onClick={add} disabled={busy || !adding.trim()}>
          Add
        </button>
      </div>

      {entries === null && <p className="muted">Loading…</p>}
      {entries?.length === 0 && <p className="muted">Nothing on this list yet.</p>}

      {entries && entries.length > 0 && (
        <ul className="list-rows">
          {entries.map((e) => (
            <li key={e.id} className={e.isActive ? '' : 'is-retired'}>
              <span className="list-name">
                {e.name}
                {!e.isActive && <span className="pill pill-idle">Retired</span>}
                {e.children && e.children.length > 0 && (
                  <span className="list-children">
                    {e.children.map((c) => c.name).join(' · ')}
                  </span>
                )}
              </span>

              <span className="list-use">
                {e.inUse > 0 ? `${e.inUse} using it` : 'unused'}
              </span>

              <span className="list-actions">
                {e.canRetire !== false && (
                  <button
                    type="button"
                    className="link-btn"
                    disabled={busy}
                    onClick={() => retire(e)}
                  >
                    {e.isActive ? 'Retire' : 'Restore'}
                  </button>
                )}
                {/* Only ever offered where nothing would be orphaned. */}
                {e.inUse === 0 && (
                  <button
                    type="button"
                    className="link-btn is-danger"
                    disabled={busy}
                    onClick={() => remove(e)}
                  >
                    Remove
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
