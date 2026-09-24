import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from './StudentLayout';
import { communityApi, type NewStory, type Story, type StoryKind } from '../../api/community';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import './Stories.css';

const KINDS: { value: StoryKind; label: string; hint: string }[] = [
  { value: 'INTERVIEW', label: 'Interview experience', hint: 'The rounds, what was asked, and what you would tell a junior.' },
  { value: 'INTERN_DIARY', label: 'Intern diary', hint: 'A week of your internship - what you did and learnt.' },
  { value: 'FIRST_MONTHS', label: 'My first months', hint: 'What the job is really like after you join.' },
];

const KIND_LABEL: Record<StoryKind, string> = {
  INTERVIEW: 'Interview',
  INTERN_DIARY: 'Intern diary',
  FIRST_MONTHS: 'First months',
};

/** Sessions the student already pressed "Helpful" in; the counter is a soft signal. */
const HELPED_KEY = 'stories.helped';

function readHelped(): Set<string> {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(HELPED_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

/**
 * Campus stories: what seniors at your own college went through.
 *
 * Every college keeps a messy Google Doc of interview experiences; this is that
 * doc, organised by company and year and read in one place. A story is read by
 * the placement cell before juniors see it, and an author can stay anonymous to
 * other students.
 */
export default function Stories() {
  const { hasModule } = useAuth();
  const enabled = hasModule('showcase.stories');
  const [data, setData] = useState<Awaited<ReturnType<typeof communityApi.stories>> | null>(null);
  const [mine, setMine] = useState<Story[]>([]);
  const [filter, setFilter] = useState<{ companyId?: string; kind?: StoryKind; year?: number }>({});
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [helped, setHelped] = useState(readHelped);

  const load = useCallback(() => {
    communityApi
      .stories(filter)
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load stories.'));
    communityApi.myStories().then(setMine).catch(() => setMine([]));
  }, [filter]);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  async function markHelpful(s: Story) {
    try {
      const { helpful } = await communityApi.helpful(s.id);
      setData((d) => d && { ...d, stories: d.stories.map((x) => (x.id === s.id ? { ...x, helpful } : x)) });
      const next = new Set(helped).add(s.id);
      setHelped(next);
      try {
        window.localStorage.setItem(HELPED_KEY, JSON.stringify([...next]));
      } catch {
        // Storage refused: the button simply comes back next visit.
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not record that.');
    }
  }

  if (!enabled) {
    return (
      <StudentLayout>
        <header className="page-head">
          <div>
            <p className="eyebrow">Campus stories</p>
            <h1>From your seniors</h1>
            <p className="page-lede">Your institution has not switched on campus stories yet.</p>
          </div>
        </header>
      </StudentLayout>
    );
  }

  const pending = mine.filter((s) => s.status !== 'PUBLISHED');

  return (
    <StudentLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Campus stories</p>
          <h1>From your seniors</h1>
          <p className="page-lede">
            Interview experiences, intern diaries and first months at work - written by students from your own college.
          </p>
        </div>
        {!writing && (
          <button type="button" className="btn btn-primary" onClick={() => setWriting(true)}>
            Share your experience
          </button>
        )}
      </header>

      {error && <p className="alert alert-error">{error}</p>}

      {writing && (
        <StoryForm
          onCancel={() => setWriting(false)}
          onDone={() => {
            setWriting(false);
            load();
          }}
        />
      )}

      {pending.length > 0 && (
        <section className="card st-mine">
          <h2>Your stories</h2>
          <ul>
            {pending.map((s) => (
              <li key={s.id}>
                <span>
                  <strong>{s.companyName}</strong> · {KIND_LABEL[s.kind]} · {s.year}
                </span>
                <span className={`pill ${s.status === 'HIDDEN' ? 'pill-stop' : 'pill-hold'}`}>
                  {s.status === 'HIDDEN' ? 'Not published' : 'Waiting for your placement cell'}
                </span>
              </li>
            ))}
          </ul>
          {pending.some((s) => s.status === 'HIDDEN') && (
            <p className="muted">Your notifications say why a story was not published.</p>
          )}
        </section>
      )}

      {data && (data.companies.length > 0 || data.years.length > 0) && (
        <div className="st-filters">
          <select
            className="st-select"
            value={filter.companyId ?? ''}
            onChange={(e) => setFilter((f) => ({ ...f, companyId: e.target.value || undefined }))}
            aria-label="Company"
          >
            <option value="">All companies</option>
            {data.companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            className="st-select"
            value={filter.kind ?? ''}
            onChange={(e) => setFilter((f) => ({ ...f, kind: (e.target.value || undefined) as StoryKind | undefined }))}
            aria-label="Kind"
          >
            <option value="">All kinds</option>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <select
            className="st-select"
            value={filter.year ?? ''}
            onChange={(e) => setFilter((f) => ({ ...f, year: e.target.value ? Number(e.target.value) : undefined }))}
            aria-label="Year"
          >
            <option value="">All years</option>
            {data.years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      )}

      {data && data.stories.length === 0 && (
        <div className="st-empty">
          <h2>No stories yet.</h2>
          <p>Be the first. The next batch will prepare from what you write.</p>
        </div>
      )}

      <ul className="st-list">
        {data?.stories.map((s) => (
          <li key={s.id}>
            <StoryCard
              story={s}
              companyLink={hasModule('showcase.company') && s.companyId ? `/student/companies/${s.companyId}` : null}
              canHelp={!s.mine && !helped.has(s.id)}
              onHelpful={() => markHelpful(s)}
            />
          </li>
        ))}
      </ul>
    </StudentLayout>
  );
}

export function StoryCard({
  story: s,
  companyLink,
  canHelp,
  onHelpful,
}: {
  story: Story;
  companyLink?: string | null;
  canHelp?: boolean;
  onHelpful?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const long = s.body.length > 360;
  return (
    <article className="st-card">
      <header className="st-card-head">
        <span className="st-kind">{KIND_LABEL[s.kind]}</span>
        <h3>
          {companyLink ? <Link to={companyLink}>{s.companyName}</Link> : s.companyName}
          <small> · {s.role}</small>
        </h3>
        <p className="muted">
          {s.year} · {s.author ?? 'A senior from your college'}
          {s.difficulty ? ` · difficulty ${s.difficulty}/5` : ''}
          {s.result ? ` · ${s.result}` : ''}
        </p>
      </header>

      {s.rounds.length > 0 && (
        <ol className="st-rounds">
          {s.rounds.map((r, i) => (
            <li key={i}>
              <strong>{r.name}</strong>
              {r.what && <span>{r.what}</span>}
            </li>
          ))}
        </ol>
      )}

      <p className="st-body">{open || !long ? s.body : `${s.body.slice(0, 360)}…`}</p>
      <footer className="st-card-foot">
        {long && (
          <button type="button" className="link-btn" onClick={() => setOpen((v) => !v)}>
            {open ? 'Show less' : 'Read all'}
          </button>
        )}
        <span className="st-spacer" />
        {onHelpful && (
          <button type="button" className="btn btn-ghost st-helpful" onClick={onHelpful} disabled={!canHelp}>
            {canHelp ? 'Helpful' : 'Thanks'}
            {s.helpful > 0 && <span>{s.helpful}</span>}
          </button>
        )}
      </footer>
    </article>
  );
}

function StoryForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const thisYear = new Date().getFullYear();
  const [form, setForm] = useState<NewStory>({
    kind: 'INTERVIEW',
    companyId: '',
    companyName: '',
    role: '',
    year: thisYear,
    rounds: [{ name: '', what: '' }],
    body: '',
    difficulty: 3,
    result: '',
    anonymous: false,
  });
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    communityApi.storyCompanies().then(setCompanies).catch(() => setCompanies([]));
  }, []);

  const set = <K extends keyof NewStory>(k: K, v: NewStory[K]) => setForm((f) => ({ ...f, [k]: v }));
  const interview = form.kind === 'INTERVIEW';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await communityApi.write({
        ...form,
        companyId: form.companyId || undefined,
        companyName: form.companyId ? undefined : form.companyName,
        rounds: interview ? form.rounds.filter((r) => r.name.trim()) : [],
        difficulty: interview ? form.difficulty : undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your story.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card st-form" onSubmit={submit} noValidate>
      <h2>Share your experience</h2>
      <p className="muted">Your placement cell reads it before your juniors do. Don’t name interviewers or share test questions you promised to keep private.</p>

      <div className="st-kinds" role="radiogroup" aria-label="What are you writing?">
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            role="radio"
            aria-checked={form.kind === k.value}
            className={`st-kind-opt ${form.kind === k.value ? 'is-on' : ''}`}
            onClick={() => set('kind', k.value)}
          >
            <strong>{k.label}</strong>
            <span>{k.hint}</span>
          </button>
        ))}
      </div>

      <div className="st-grid">
        <label className="field">
          <span className="field-label">Company</span>
          <select className="st-select" value={form.companyId} onChange={(e) => set('companyId', e.target.value)}>
            <option value="">Not listed - type it below</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {!form.companyId && (
            <input
              className="st-input"
              value={form.companyName}
              onChange={(e) => set('companyName', e.target.value)}
              placeholder="Company name"
            />
          )}
        </label>
        <label className="field">
          <span className="field-label">Role</span>
          <input className="st-input" value={form.role} onChange={(e) => set('role', e.target.value)} placeholder="Graduate Engineer Trainee" />
        </label>
        <label className="field">
          <span className="field-label">Year</span>
          <input
            className="st-input"
            type="number"
            value={form.year}
            onChange={(e) => set('year', Number(e.target.value))}
            min={2000}
            max={2100}
          />
        </label>
        {interview && (
          <label className="field">
            <span className="field-label">Result</span>
            <input className="st-input" value={form.result} onChange={(e) => set('result', e.target.value)} placeholder="Selected / Not selected" />
          </label>
        )}
      </div>

      {interview && (
        <fieldset className="st-rounds-edit">
          <legend className="field-label">The rounds</legend>
          {form.rounds.map((r, i) => (
            <div key={i} className="st-round-row">
              <input
                className="st-input"
                value={r.name}
                onChange={(e) => set('rounds', form.rounds.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                placeholder={`Round ${i + 1} - e.g. Aptitude`}
              />
              <input
                className="st-input"
                value={r.what}
                onChange={(e) => set('rounds', form.rounds.map((x, j) => (j === i ? { ...x, what: e.target.value } : x)))}
                placeholder="What it was like, what was asked"
              />
              {form.rounds.length > 1 && (
                <button type="button" className="btn btn-ghost" aria-label="Remove round" onClick={() => set('rounds', form.rounds.filter((_, j) => j !== i))}>
                  ×
                </button>
              )}
            </div>
          ))}
          {form.rounds.length < 12 && (
            <button type="button" className="link-btn" onClick={() => set('rounds', [...form.rounds, { name: '', what: '' }])}>
              + Add a round
            </button>
          )}
          <div className="st-difficulty" role="radiogroup" aria-label="Difficulty">
            <span className="field-label">Difficulty</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={form.difficulty === n}
                className={form.difficulty === n ? 'is-on' : ''}
                onClick={() => set('difficulty', n)}
              >
                {n}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <label className="field">
        <span className="field-label">{interview ? 'Tips for your juniors' : 'Your story'}</span>
        <textarea
          className="st-input"
          rows={6}
          value={form.body}
          onChange={(e) => set('body', e.target.value)}
          placeholder={interview ? 'What to revise, what surprised you, what you would do differently.' : 'What you did, what you learnt, what it is really like.'}
        />
        <span className="field-hint">{form.body.trim().length} characters · at least 40</span>
      </label>

      <label className="check-line">
        <input type="checkbox" checked={form.anonymous} onChange={(e) => set('anonymous', e.target.checked)} />
        Post without my name. Other students see “a senior from your college”; your placement cell still knows it was you.
      </label>

      {error && <p className="alert alert-error">{error}</p>}
      <div className="btn-row">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Sending…' : 'Send for review'}
        </button>
      </div>
    </form>
  );
}
