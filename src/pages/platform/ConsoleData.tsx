import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import type { PartnerKind } from '../../api/partners';
import {
  onboardDataApi,
  type CourseEntry,
  type InterestEntry,
  type Listing,
  type ListingInput,
  type ListingPage,
} from '../../api/onboardData';
import ConsoleHeader from './ConsoleHeader';
import './Platform.css';

/**
 * Onboard data: what the student sign-up dropdowns offer.
 *
 * "Where do you study?" searches the directory kept here plus every partner
 * college; "Course" is the shared course list; "Year you finish" is worked
 * out from today. Each has to be filled before students arrive, or the
 * dropdowns have nothing to say.
 */

type Tab = 'colleges' | 'courses' | 'interests' | 'years';

const TABS: { key: Tab; label: string }[] = [
  { key: 'colleges', label: 'Colleges & universities' },
  { key: 'courses', label: 'Courses' },
  { key: 'interests', label: 'Career interests' },
  { key: 'years', label: 'Years' },
];

const message = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

export default function ConsoleData() {
  const [tab, setTab] = useState<Tab>('colleges');

  return (
    <div className="console">
      <ConsoleHeader />

      <main className="console-main">
        <section className="console-hero">
          <div>
            <p className="eyebrow">Onboard data</p>
            <h1>What students pick from.</h1>
            <p className="console-lede">
              The lists behind the student sign-up: where they study, what they study, and when they finish.
            </p>
          </div>
        </section>

        <div className="console-bar">
          <div className="seg" role="tablist" aria-label="Lists">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                className={`seg-opt ${tab === t.key ? 'is-on' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'colleges' && <Colleges />}
        {tab === 'courses' && <Courses />}
        {tab === 'interests' && <Interests />}
        {tab === 'years' && <Years />}
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Colleges and universities                                                   */
/* -------------------------------------------------------------------------- */

const EMPTY: ListingInput = { kind: 'COLLEGE', name: '', city: '', state: '', affiliation: '' };

/**
 * One row per line: name, city, state, affiliated university. Tabs work too,
 * so a block copied out of a spreadsheet pastes straight in.
 */
function parsePaste(text: string, kind: PartnerKind): { rows: ListingInput[]; bad: number } {
  const rows: ListingInput[] = [];
  let bad = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const cells = (line.includes('\t') ? line.split('\t') : line.split(',')).map((c) => c.trim());
    const [name = '', city = '', state = '', affiliation = ''] = cells;
    if (name.length < 3 || city.length < 2) {
      bad += 1;
      continue;
    }
    rows.push({
      kind: /universit|vidyapeeth|vishwavidyalaya/i.test(name) ? 'UNIVERSITY' : kind,
      name,
      city,
      state: state || null,
      affiliation: affiliation || null,
    });
  }
  return { rows, bad };
}

function Colleges() {
  const [show, setShow] = useState<'active' | 'hidden'>('active');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<ListingPage | null>(null);
  const [more, setMore] = useState<Listing[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [mode, setMode] = useState<'one' | 'paste'>('one');

  const load = useCallback(() => {
    setError(null);
    onboardDataApi
      .listings(query, show)
      .then((d) => {
        setData(d);
        setMore([]);
      })
      .catch((e) => setError(message(e, 'Could not load the list.')));
  }, [query, show]);

  useEffect(load, [load]);

  // Search as people type, without a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const rows = [...(data?.listings ?? []), ...more];
  const page = data ? data.page + Math.ceil(more.length / 50) : 1;

  async function loadMore() {
    if (!data) return;
    try {
      const next = await onboardDataApi.listings(query, show, page + 1);
      setMore((m) => [...m, ...next.listings]);
    } catch (e) {
      setError(message(e, 'Could not load more.'));
    }
  }

  async function toggle(l: Listing) {
    setBusy(l.id);
    try {
      await onboardDataApi.updateListing(l.id, { isActive: !l.isActive });
      load();
    } catch (e) {
      setError(message(e, 'Could not change that one.'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="od">
      <section className="od-card">
        <div className="od-card-head">
          <div>
            <h2>Add to the list</h2>
            <p className="muted">
              Partner colleges appear on their own once their university is live. Add every other college and
              university students may come from.
            </p>
          </div>
          <div className="seg seg-sm" role="radiogroup" aria-label="How to add">
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'one'}
              className={`seg-opt ${mode === 'one' ? 'is-on' : ''}`}
              onClick={() => setMode('one')}
            >
              One at a time
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'paste'}
              className={`seg-opt ${mode === 'paste' ? 'is-on' : ''}`}
              onClick={() => setMode('paste')}
            >
              Paste a list
            </button>
          </div>
        </div>
        {mode === 'one' ? <AddOne onAdded={load} /> : <AddMany onAdded={load} />}
      </section>

      <section className="od-card">
        <div className="od-card-head">
          <div>
            <h2>On the list</h2>
            <p className="muted">
              {data
                ? `${data.counts.active.toLocaleString('en-IN')} shown to students · ${data.counts.hidden.toLocaleString('en-IN')} hidden`
                : 'Loading…'}
            </p>
          </div>
          <div className="od-tools">
            <input
              className="input"
              type="search"
              placeholder="Search name, city, state or university"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search the list"
            />
            <div className="seg seg-sm" role="radiogroup" aria-label="Which to show">
              {(['active', 'hidden'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={show === s}
                  className={`seg-opt ${show === s ? 'is-on' : ''}`}
                  onClick={() => setShow(s)}
                >
                  {s === 'active' ? 'Shown' : 'Hidden'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="notice notice-stop">{error}</p>}

        {data && rows.length === 0 && (
          <p className="co-empty">
            {query
              ? `Nothing matches “${query}”.`
              : show === 'active'
                ? 'Nothing on the list yet. Add a college above, or paste a list of them.'
                : 'Nothing hidden.'}
          </p>
        )}

        {rows.length > 0 && (
          <div className="od-table-wrap">
            <table className="od-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Where</th>
                  <th>Affiliated to</th>
                  <th className="is-num">Students</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id}>
                    <td className="od-name">{l.name}</td>
                    <td>
                      <span className={`od-kind ${l.kind === 'UNIVERSITY' ? 'is-uni' : ''}`}>
                        {l.kind === 'UNIVERSITY' ? 'University' : 'College'}
                      </span>
                    </td>
                    <td>{[l.city, l.state].filter(Boolean).join(', ')}</td>
                    <td className="muted">{l.affiliation ?? '—'}</td>
                    <td className="is-num">{l.students}</td>
                    <td className="od-act">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={busy === l.id}
                        onClick={() => toggle(l)}
                      >
                        {l.isActive ? 'Hide' : 'Show'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && rows.length < data.total && (
          <div className="od-more">
            <span className="muted">
              Showing {rows.length.toLocaleString('en-IN')} of {data.total.toLocaleString('en-IN')}
            </span>
            <button type="button" className="btn btn-secondary" onClick={loadMore}>
              Show more
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function AddOne({ onAdded }: { onAdded: () => void }) {
  const [form, setForm] = useState<ListingInput>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof ListingInput) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setNote(null);
    try {
      const { listing, revived } = await onboardDataApi.addListing({
        ...form,
        state: form.state || null,
        affiliation: form.affiliation || null,
      });
      setNote(revived ? `${listing.name} was hidden; it is shown again.` : `Added ${listing.name}.`);
      setForm((f) => ({ ...EMPTY, kind: f.kind, state: f.state, affiliation: f.affiliation }));
      onAdded();
    } catch (err) {
      if (err instanceof ApiError && err.fields?.length) {
        setErrors(Object.fromEntries(err.fields.map((f) => [f.path, f.message])));
      } else {
        setErrors({ form: message(err, 'Could not add it.') });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="od-form" onSubmit={submit} noValidate>
      <div className="od-kinds" role="radiogroup" aria-label="Type">
        {(['COLLEGE', 'UNIVERSITY'] as const).map((k) => (
          <label key={k} className={`od-kind-pick ${form.kind === k ? 'is-on' : ''}`}>
            <input
              type="radio"
              name="kind"
              checked={form.kind === k}
              onChange={() => setForm((f) => ({ ...f, kind: k }))}
            />
            {k === 'COLLEGE' ? 'College' : 'University'}
          </label>
        ))}
      </div>
      <div className="od-grid">
        <label className="od-field is-wide">
          <span>Name</span>
          <input
            className={`input ${errors.name ? 'is-bad' : ''}`}
            value={form.name}
            onChange={set('name')}
            placeholder={form.kind === 'COLLEGE' ? 'Full name of the college' : 'Full name of the university'}
          />
          {errors.name && <em>{errors.name}</em>}
        </label>
        <label className="od-field">
          <span>City</span>
          <input className={`input ${errors.city ? 'is-bad' : ''}`} value={form.city} onChange={set('city')} />
          {errors.city && <em>{errors.city}</em>}
        </label>
        <label className="od-field">
          <span>State</span>
          <input className="input" value={form.state ?? ''} onChange={set('state')} />
        </label>
        {form.kind === 'COLLEGE' && (
          <label className="od-field is-wide">
            <span>Affiliated to (optional)</span>
            <input
              className="input"
              value={form.affiliation ?? ''}
              onChange={set('affiliation')}
              placeholder="The university, as students say it"
            />
          </label>
        )}
      </div>
      {errors.form && <p className="notice notice-stop">{errors.form}</p>}
      <div className="od-foot">
        {note && <span className="od-ok">✓ {note}</span>}
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Adding…' : 'Add to the list'}
        </button>
      </div>
    </form>
  );
}

function AddMany({ onAdded }: { onAdded: () => void }) {
  const [text, setText] = useState('');
  const [kind, setKind] = useState<PartnerKind>('COLLEGE');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const parsed = useMemo(() => parsePaste(text, kind), [text, kind]);

  async function submit() {
    if (!parsed.rows.length) return;
    setSaving(true);
    setError(null);
    setResult(null);
    try {
      const { added, skipped } = await onboardDataApi.addListings(parsed.rows);
      setResult(
        `Added ${added.toLocaleString('en-IN')}${skipped ? `, skipped ${skipped} already on the list` : ''}.`,
      );
      setText('');
      onAdded();
    } catch (e) {
      setError(message(e, 'Could not add the list.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="od-form">
      <p className="od-hint">
        One per line: <b>name, city, state, affiliated university</b>. Copying rows out of a spreadsheet works too.
        Names with “University” are added as universities.
      </p>
      <textarea
        className="input od-paste"
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'Sample College of Engineering, Pune, Maharashtra, Sample University\nSample Arts and Commerce College, Nashik, Maharashtra, Sample University'}
        aria-label="Paste a list"
      />
      {error && <p className="notice notice-stop">{error}</p>}
      <div className="od-foot">
        <label className="od-inline">
          Others are
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as PartnerKind)}>
            <option value="COLLEGE">Colleges</option>
            <option value="UNIVERSITY">Universities</option>
          </select>
        </label>
        <span className="muted">
          {parsed.rows.length ? `${parsed.rows.length.toLocaleString('en-IN')} ready` : 'Nothing to add yet'}
          {parsed.bad ? ` · ${parsed.bad} line${parsed.bad === 1 ? '' : 's'} missing a name or city` : ''}
        </span>
        {result && <span className="od-ok">✓ {result}</span>}
        <button type="button" className="btn btn-primary" disabled={saving || !parsed.rows.length} onClick={submit}>
          {saving ? 'Adding…' : `Add ${parsed.rows.length || ''}`.trim()}
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Courses                                                                     */
/* -------------------------------------------------------------------------- */

function Courses() {
  const [list, setList] = useState<CourseEntry[] | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    onboardDataApi
      .courses()
      .then(setList)
      .catch((e) => setError(message(e, 'Could not load the courses.')));
  }, []);

  useEffect(load, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy('add');
    setError(null);
    try {
      await onboardDataApi.addCourse(name.trim());
      setName('');
      load();
    } catch (err) {
      setError(message(err, 'Could not add the course.'));
    } finally {
      setBusy(null);
    }
  }

  async function act(c: CourseEntry, what: 'toggle' | 'remove') {
    setBusy(c.id);
    setError(null);
    try {
      if (what === 'remove') await onboardDataApi.removeCourse(c.id);
      else await onboardDataApi.setCourseActive(c.id, !c.isActive);
      load();
    } catch (err) {
      setError(message(err, 'Could not change that course.'));
    } finally {
      setBusy(null);
    }
  }

  const active = (list ?? []).filter((c) => c.isActive);
  const retired = (list ?? []).filter((c) => !c.isActive);

  return (
    <div className="od">
      <section className="od-card">
        <div className="od-card-head">
          <div>
            <h2>Courses</h2>
            <p className="muted">
              The “Course” dropdown. Students whose course is missing can still type it in. A course in use is
              retired rather than deleted, so it stays on the records that have it.
            </p>
          </div>
        </div>

        <form className="od-addline" onSubmit={add}>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. B.Tech, MBA, B.Com"
            aria-label="Course name"
          />
          <button type="submit" className="btn btn-primary" disabled={busy === 'add' || !name.trim()}>
            Add course
          </button>
        </form>

        {error && <p className="notice notice-stop">{error}</p>}
        {!list && !error && <p className="muted">Loading…</p>}

        {list && (
          <ul className="od-chips">
            {active.map((c) => (
              <li key={c.id} className="od-chip">
                <span>{c.name}</span>
                {c.inUse > 0 && <small>{c.inUse} using it</small>}
                <button
                  type="button"
                  disabled={busy === c.id}
                  onClick={() => act(c, c.inUse > 0 ? 'toggle' : 'remove')}
                  aria-label={c.inUse > 0 ? `Retire ${c.name}` : `Remove ${c.name}`}
                  title={c.inUse > 0 ? 'Retire' : 'Remove'}
                >
                  ×
                </button>
              </li>
            ))}
            {active.length === 0 && <li className="muted">No courses yet.</li>}
          </ul>
        )}

        {retired.length > 0 && (
          <>
            <h3 className="od-sub">Retired</h3>
            <ul className="od-chips">
              {retired.map((c) => (
                <li key={c.id} className="od-chip is-off">
                  <span>{c.name}</span>
                  <button type="button" disabled={busy === c.id} onClick={() => act(c, 'toggle')}>
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Career interests                                                            */
/* -------------------------------------------------------------------------- */

/**
 * "What would you like to try?" at sign-up. Up to three are picked; they
 * decide which work simulations a student is shown first.
 */
function Interests() {
  const [list, setList] = useState<InterestEntry[] | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    onboardDataApi
      .interests()
      .then(setList)
      .catch((e) => setError(message(e, 'Could not load the interests.')));
  }, []);

  useEffect(load, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy('add');
    setError(null);
    try {
      await onboardDataApi.addInterest(name.trim());
      setName('');
      load();
    } catch (err) {
      setError(message(err, 'Could not add that interest.'));
    } finally {
      setBusy(null);
    }
  }

  async function act(i: InterestEntry, what: 'toggle' | 'remove') {
    setBusy(i.id);
    setError(null);
    try {
      if (what === 'remove') await onboardDataApi.removeInterest(i.id);
      else await onboardDataApi.setInterestActive(i.id, !i.isActive);
      load();
    } catch (err) {
      setError(message(err, 'Could not change that interest.'));
    } finally {
      setBusy(null);
    }
  }

  const shown = (list ?? []).filter((i) => i.isActive);
  const hidden = (list ?? []).filter((i) => !i.isActive);

  return (
    <div className="od">
      <section className="od-card">
        <div className="od-card-head">
          <div>
            <h2>Career interests</h2>
            <p className="muted">
              “What would you like to try?” at sign-up. Students pick up to three, and see work simulations in those
              fields first. One students already picked is hidden rather than deleted.
            </p>
          </div>
        </div>

        <form className="od-addline" onSubmit={add}>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Marketing, Data, Law"
            aria-label="Interest"
          />
          <button type="submit" className="btn btn-primary" disabled={busy === 'add' || !name.trim()}>
            Add interest
          </button>
        </form>

        {error && <p className="notice notice-stop">{error}</p>}
        {!list && !error && <p className="muted">Loading…</p>}

        {list && (
          <ul className="od-chips">
            {shown.map((i) => (
              <li key={i.id} className="od-chip">
                <span>{i.value}</span>
                {i.inUse > 0 && <small>{i.inUse} picked it</small>}
                <button
                  type="button"
                  disabled={busy === i.id}
                  onClick={() => act(i, i.inUse > 0 ? 'toggle' : 'remove')}
                  aria-label={i.inUse > 0 ? `Hide ${i.value}` : `Remove ${i.value}`}
                  title={i.inUse > 0 ? 'Hide' : 'Remove'}
                >
                  ×
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="muted">None yet. Students will not be asked.</li>}
          </ul>
        )}

        {hidden.length > 0 && (
          <>
            <h3 className="od-sub">Hidden</h3>
            <ul className="od-chips">
              {hidden.map((i) => (
                <li key={i.id} className="od-chip is-off">
                  <span>{i.value}</span>
                  <button type="button" disabled={busy === i.id} onClick={() => act(i, 'toggle')}>
                    Show
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Years                                                                       */
/* -------------------------------------------------------------------------- */

function Years() {
  const now = new Date().getFullYear();
  const years = Array.from({ length: 8 }, (_, i) => now - 1 + i);

  return (
    <div className="od">
      <section className="od-card">
        <div className="od-card-head">
          <div>
            <h2>Year you finish</h2>
            <p className="muted">
              Nothing to keep here: the years move on by themselves. Students see last year, this year and the
              six after it.
            </p>
          </div>
        </div>
        <ul className="od-chips">
          {years.map((y) => (
            <li key={y} className="od-chip">
              <span>{y}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
