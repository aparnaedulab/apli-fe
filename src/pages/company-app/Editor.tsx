import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { signupApi } from '../../api/signup';
import {
  companyAppApi,
  STATUS_LABEL,
  type CompanySim,
  type SimInput,
  type SimLevel,
  type TaskDraft,
} from '../../api/companyApp';
import { Cover, toneOf } from '../student-app/Shell';
import Frame from './Frame';
import PagesEditor, { pageGaps } from './PagesEditor';
import { HAND_IN_KINDS, type HandInKind } from '../../api/taskPages';

const LEVELS: { key: SimLevel; label: string }[] = [
  { key: 'BEGINNER', label: 'Beginner' },
  { key: 'INTERMEDIATE', label: 'Intermediate' },
  { key: 'ADVANCED', label: 'Advanced' },
];

const MAX_TASKS = 8;
const EMPTY_TASK: TaskDraft = {
  title: '',
  brief: '',
  handIn: '',
  learn: [],
  steps: [],
  pages: [],
  handInKinds: ['text', 'link', 'file'],
  minutes: 45,
};

const message = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

/** Where the editor is: the overview, one task by its index, or the final check. */
type Place = 'overview' | 'check' | number;

/** What a task still needs before it can be sent. */
function taskGaps(t: TaskDraft): string[] {
  const gaps: string[] = [];
  if (t.title.trim().length < 3) gaps.push('a title');
  if (t.brief.trim().length < 20) gaps.push('what to do (a few sentences)');
  if (!(t.minutes >= 10 && t.minutes <= 480)) gaps.push('minutes between 10 and 480');
  if (!t.handInKinds.length) gaps.push('a way to hand it in');
  t.pages.forEach((p, i) => {
    if (pageGaps(p).length) gaps.push(`page ${i + 1} finished`);
  });
  return gaps;
}

/**
 * Writing a work simulation, one part at a time.
 *
 * On the left, an outline: the overview, each task, and the final check.
 * In the middle, only the part being written. On the right, what a student
 * will see - updating as the company types - so nobody has to imagine it.
 *
 * Saved as a draft as often as the company likes; "Send to Apli.ai" hands
 * it over to be checked. Once live it is read-only - students are part way
 * through it - and can only be retired.
 */
export default function CompanySimulationEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;

  const [sim, setSim] = useState<CompanySim | null>(null);
  const [fields, setFields] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [place, setPlace] = useState<Place>('overview');
  const [uploading, setUploading] = useState(false);
  const [company, setCompany] = useState<{ id: string; name: string; logoUrl: string | null }>({
    id: 'preview',
    name: 'Your company',
    logoUrl: null,
  });

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [about, setAbout] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [field, setField] = useState('');
  const [level, setLevel] = useState<SimLevel>('BEGINNER');
  const [hours, setHours] = useState(4);
  const [skills, setSkills] = useState<string[]>([]);
  const [tasks, setTasks] = useState<TaskDraft[]>([{ ...EMPTY_TASK }, { ...EMPTY_TASK }]);

  /** What was last saved, to tell "unsaved changes" from "all saved". */
  const savedSnapshot = useRef<string>('');

  function take(s: CompanySim) {
    setSim(s);
    setTitle(s.title);
    setSummary(s.summary);
    setAbout(s.about ?? '');
    setCoverUrl(s.coverUrl ?? '');
    setVideoUrl(s.videoUrl ?? '');
    setField(s.field);
    setLevel(s.level);
    setHours(s.hours);
    setSkills(s.skills);
    const t = s.tasks.map((x) => ({
      title: x.title,
      brief: x.brief,
      handIn: x.handIn ?? '',
      learn: x.learn,
      steps: x.steps,
      pages: x.pages,
      handInKinds: x.handInKinds,
      minutes: x.minutes,
    }));
    setTasks(t);
    savedSnapshot.current = JSON.stringify(
      shape(s.title, s.summary, s.about ?? '', s.coverUrl ?? '', s.videoUrl ?? '', s.field, s.level, s.hours, s.skills, t),
    );
  }

  useEffect(() => {
    signupApi
      .options()
      .then((o) => setFields(o.interests))
      .catch(() => undefined);
    companyAppApi
      .overview()
      .then((o) => setCompany(o.company))
      .catch(() => undefined);
    if (id) {
      companyAppApi
        .simulation(id)
        .then(take)
        .catch((e) => setError(message(e, 'Could not load this simulation.')));
    }
  }, [id]);

  const editable = isNew || Boolean(sim?.editable);
  const body = shape(title, summary, about, coverUrl, videoUrl, field, level, hours, skills, tasks);
  const dirty = JSON.stringify(body) !== savedSnapshot.current;

  // Leaving with unsaved work asks first.
  useEffect(() => {
    if (!dirty || !editable) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, editable]);

  const totalMinutes = tasks.reduce((n, t) => n + (Number(t.minutes) || 0), 0);

  /** Everything that stands between this draft and "Send to Apli.ai". */
  const checks = useMemo(() => {
    const list: { ok: boolean; label: string; at: Place; note?: string }[] = [
      { ok: title.trim().length >= 5, label: 'A title of a few words', at: 'overview' },
      { ok: summary.trim().length >= 40, label: 'What the student will do, in two or three sentences', at: 'overview' },
      { ok: Boolean(field), label: 'The field it belongs to', at: 'overview' },
      { ok: tasks.length >= 2, label: 'At least two tasks', at: tasks.length },
      ...tasks.map((t, i) => {
        const gaps = taskGaps(t);
        return {
          ok: gaps.length === 0,
          label: `Task ${i + 1}${t.title.trim() ? `: ${t.title.trim()}` : ''}`,
          at: i as Place,
          note: gaps.length ? `Needs ${gaps.join(', ')}` : undefined,
        };
      }),
    ];
    return list;
  }, [title, summary, field, tasks]);
  const missing = checks.filter((c) => !c.ok).length;

  // Gentle suggestions: not required, but they make it better.
  const hints: { label: string; at: Place }[] = [];
  if (Math.abs(totalMinutes / 60 - hours) > Math.max(1, hours * 0.3)) {
    hints.push({
      label: `The tasks add up to about ${Math.round(totalMinutes / 6) / 10} hours, but it says ${hours}. Make them agree.`,
      at: 'overview',
    });
  }
  if (!about.trim()) hints.push({ label: 'Say why this work matters to your team - students read it first.', at: 'overview' });
  if (!coverUrl) hints.push({ label: 'Add a cover picture - simulations with one stand out in the list.', at: 'overview' });
  if (tasks.some((t) => t.learn.filter((l) => l.trim()).length === 0)) {
    hints.push({ label: 'Add "what they will learn" to every task.', at: tasks.findIndex((t) => t.learn.filter((l) => l.trim()).length === 0) });
  }

  function showErrors(e: unknown) {
    if (e instanceof ApiError && e.fields?.length) {
      setErrors(Object.fromEntries(e.fields.map((f) => [f.path, f.message])));
      setError('Some fields need fixing - see the marks in the outline.');
    } else {
      setError(message(e, 'That did not work. Try again.'));
    }
  }

  async function save(): Promise<CompanySim | null> {
    setBusy('save');
    setError(null);
    setErrors({});
    try {
      const next = isNew ? await companyAppApi.create(body) : await companyAppApi.update(id!, body);
      take(next);
      if (isNew) navigate(`/company/simulations/${next.id}`, { replace: true });
      return next;
    } catch (err) {
      showErrors(err);
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function act(action: 'submit' | 'withdraw' | 'retire') {
    if (action === 'submit') {
      if (missing) {
        setPlace('check');
        return;
      }
      if (!(await save())) return;
    }
    setBusy(action);
    setError(null);
    try {
      take(await companyAppApi.act(sim?.id ?? id!, action));
    } catch (err) {
      showErrors(err);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!sim) return;
    setBusy('delete');
    try {
      await companyAppApi.remove(sim.id);
      navigate('/company/simulations', { replace: true });
    } catch (err) {
      showErrors(err);
      setBusy(null);
    }
  }

  async function pickCover(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setErrors((e) => ({ ...e, coverUrl: '' }));
    try {
      setCoverUrl(await companyAppApi.uploadCover(file));
    } catch (err) {
      setErrors((e) => ({ ...e, coverUrl: message(err, 'Could not upload that picture.') }));
    } finally {
      setUploading(false);
    }
  }

  function setTask(i: number, patch: Partial<TaskDraft>) {
    setTasks((list) => list.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  }

  function addTask() {
    if (tasks.length >= MAX_TASKS) return;
    setTasks((l) => [...l, { ...EMPTY_TASK }]);
    setPlace(tasks.length);
  }

  function moveTask(i: number, by: -1 | 1) {
    setTasks((list) => {
      const next = [...list];
      const [t] = next.splice(i, 1);
      next.splice(i + by, 0, t!);
      return next;
    });
    setPlace(i + by);
  }

  function removeTask(i: number) {
    if (tasks.length <= 1) return;
    setTasks((l) => l.filter((_, j) => j !== i));
    setPlace(Math.max(0, i - 1));
  }

  const err = (path: string) => errors[path];
  const taskHasServerError = (i: number) => Object.keys(errors).some((k) => k.startsWith(`tasks.${i}.`));
  const overviewHasServerError = ['title', 'summary', 'about', 'field', 'hours', 'skills', 'coverUrl', 'videoUrl'].some((k) => errors[k]);


  return (
    <Frame>
      {/* The top bar: what it is, where it stands, and the two actions. */}
      <section className="ce-top">
        <div className="sa-wrap ce-top-in">
          <div className="ce-top-title">
            <Link to="/company/simulations" className="sa-back">
              <span aria-hidden="true">←</span> Simulations
            </Link>
            <h1>{title.trim() || 'Untitled simulation'}</h1>
            <div className="ce-top-meta">
              {sim ? <span className={`ca-chip is-${sim.status.toLowerCase()}`}>{STATUS_LABEL[sim.status]}</span> : <span className="ca-chip">New</span>}
              {editable && (
                <span className={`ce-saved ${dirty ? 'is-dirty' : ''}`}>
                  {busy === 'save' ? 'Saving…' : dirty ? 'Unsaved changes' : isNew ? 'Not saved yet' : 'All changes saved'}
                </span>
              )}
              <span className="ce-total">
                {tasks.length} task{tasks.length === 1 ? '' : 's'} · ~{Math.round(totalMinutes / 6) / 10} hrs of work
              </span>
            </div>
          </div>
          <div className="ce-top-actions">
            {editable && (
              <>
                <button type="button" className="sa-btn is-ghost" onClick={() => save()} disabled={busy !== null || (!dirty && !isNew)}>
                  Save draft
                </button>
                <button type="button" className="sa-btn" onClick={() => act('submit')} disabled={busy !== null}>
                  {busy === 'submit' ? 'Sending…' : 'Send to Apli.ai'}
                </button>
              </>
            )}
            {sim?.status === 'SUBMITTED' && (
              <button type="button" className="sa-btn is-ghost" onClick={() => act('withdraw')} disabled={busy !== null}>
                Withdraw to edit
              </button>
            )}
            {sim?.status === 'LIVE' && (
              <>
                <Link to="/company/reviews" className="sa-btn is-ghost">
                  Students&apos; work
                </Link>
                <button type="button" className="sa-quiet" onClick={() => act('retire')} disabled={busy !== null}>
                  Retire
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="sa-wrap ce-body">
        {error && <p className="sa-alert">{error}</p>}
        {sim?.status === 'CHANGES_ASKED' && sim.reviewNote && (
          <blockquote className="sa-note is-big">
            <b>Apli.ai asked for changes</b>
            {sim.reviewNote}
            <span>Make the changes, then send it again.</span>
          </blockquote>
        )}
        {sim && !editable && (
          <p className="ce-locked">
            {sim.status === 'SUBMITTED'
              ? 'Apli.ai is checking this. Withdraw it to make changes.'
              : sim.status === 'LIVE'
                ? 'This is live. Students may be part way through it, so it cannot change. Retire it and write a new version instead.'
                : 'Retired. Closed to new students.'}
          </p>
        )}
        {!isNew && !sim && !error && <p className="sa-loading">Loading…</p>}

        {(isNew || sim) && (
          <div className="ce-grid">
            {/* Outline. */}
            <nav className="ce-rail" aria-label="Outline">
              <button
                type="button"
                className={`ce-rail-item ${place === 'overview' ? 'is-on' : ''}`}
                onClick={() => setPlace('overview')}
              >
                <span className={`ce-dot ${checks.slice(0, 3).every((c) => c.ok) && !overviewHasServerError ? 'is-ok' : ''}`} aria-hidden="true" />
                Overview
              </button>

              <p className="ce-rail-label">Tasks</p>
              <ol className="ce-rail-tasks">
                {tasks.map((t, i) => {
                  const ok = taskGaps(t).length === 0 && !taskHasServerError(i);
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        className={`ce-rail-item ${place === i ? 'is-on' : ''}`}
                        onClick={() => setPlace(i)}
                      >
                        <span className="ce-rail-n">{i + 1}</span>
                        <span className="ce-rail-text">{t.title.trim() || 'Untitled task'}</span>
                        <span className={`ce-dot ${ok ? 'is-ok' : ''}`} aria-label={ok ? 'Complete' : 'Needs work'} />
                      </button>
                    </li>
                  );
                })}
              </ol>
              {editable && tasks.length < MAX_TASKS && (
                <button type="button" className="ce-rail-add" onClick={addTask}>
                  + Add a task
                </button>
              )}

              <button
                type="button"
                className={`ce-rail-item is-check ${place === 'check' ? 'is-on' : ''}`}
                onClick={() => setPlace('check')}
              >
                <span className={`ce-dot ${missing === 0 ? 'is-ok' : ''}`} aria-hidden="true" />
                Check &amp; send
                {missing > 0 && <span className="ce-count">{missing}</span>}
              </button>
            </nav>

            {/* The part being written. */}
            <fieldset className="ce-main" disabled={!editable}>
              {place === 'overview' && (
                <>
                  <Part title="The basics" hint="What a student sees in the list.">
                    <Field label="Title" error={err('title')}>
                      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Check a small-business loan" />
                    </Field>
                    <Field
                      label="What the student will do"
                      error={err('summary')}
                      counter={`${summary.trim().length} / 1500`}
                    >
                      <textarea
                        rows={3}
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        placeholder="Two or three sentences a student reads before starting."
                      />
                    </Field>
                    <div className="ce-row is-three">
                      <Field label="Field" error={err('field')}>
                        <select value={field} onChange={(e) => setField(e.target.value)}>
                          <option value="">Choose…</option>
                          {fields.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Level">
                        <select value={level} onChange={(e) => setLevel(e.target.value as SimLevel)}>
                          {LEVELS.map((l) => (
                            <option key={l.key} value={l.key}>
                              {l.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Hours in all" error={err('hours')}>
                        <input type="number" min={1} max={20} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
                      </Field>
                    </div>
                    <Field label="Skills it uses" hint="Press Enter after each one. Up to six." error={err('skills')}>
                      <ChipInput values={skills} onChange={setSkills} max={6} placeholder="e.g. Spreadsheets" />
                    </Field>
                  </Part>

                  <Part title="The story" hint="Why this work matters - on the simulation's page.">
                    <Field label="Why this work matters" optional error={err('about')}>
                      <textarea
                        rows={6}
                        value={about}
                        onChange={(e) => setAbout(e.target.value)}
                        placeholder="What this job is really like at your company, why this problem matters to you, and what a student will take away."
                      />
                    </Field>
                  </Part>

                  <Part title="Picture and video" hint="Both optional, both make it feel real.">
                    <div className="ce-row">
                      <div className="ce-field">
                        <span className="ce-label">
                          Cover picture <i>wide, at least 1200 px</i>
                        </span>
                        <div className={`ca-cover ${coverUrl ? 'has-image' : ''}`}>
                          {coverUrl ? <img src={coverUrl} alt="" /> : <span>No picture yet</span>}
                        </div>
                        {editable && (
                          <span className="ca-cover-tools">
                            <label className="sa-btn is-ghost is-small">
                              {uploading ? 'Uploading…' : coverUrl ? 'Change picture' : 'Upload a picture'}
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                hidden
                                onChange={(e) => pickCover(e.target.files?.[0])}
                              />
                            </label>
                            {coverUrl && (
                              <button type="button" className="sa-quiet" onClick={() => setCoverUrl('')}>
                                Remove
                              </button>
                            )}
                          </span>
                        )}
                        {err('coverUrl') && <em className="ce-error">{err('coverUrl')}</em>}
                      </div>
                      <Field label="Intro video" optional hint="A YouTube or Vimeo link. A minute or two is enough." error={err('videoUrl')}>
                        <input
                          type="url"
                          value={videoUrl}
                          onChange={(e) => setVideoUrl(e.target.value)}
                          placeholder="https://www.youtube.com/watch?v=…"
                        />
                      </Field>
                    </div>
                  </Part>

                  <div className="ce-next">
                    <span />
                    <button type="button" className="sa-btn is-ghost" onClick={() => setPlace(0)}>
                      Write the tasks <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </>
              )}

              {typeof place === 'number' && tasks[place] && (
                <TaskPart
                  index={place}
                  total={tasks.length}
                  task={tasks[place]!}
                  errors={errors}
                  editable={editable}
                  onChange={(patch) => setTask(place, patch)}
                  onMove={(by) => moveTask(place, by)}
                  onRemove={() => removeTask(place)}
                  onPrev={() => setPlace(place === 0 ? 'overview' : place - 1)}
                  onNext={() => (place === tasks.length - 1 ? (editable && tasks.length < MAX_TASKS ? addTask() : setPlace('check')) : setPlace(place + 1))}
                  nextLabel={
                    place === tasks.length - 1
                      ? editable && tasks.length < MAX_TASKS
                        ? '+ Add another task'
                        : 'Check & send'
                      : `Task ${place + 2}`
                  }
                />
              )}

              {place === 'check' && (
                <Part title="Check & send" hint="Everything Apli.ai needs to make it live.">
                  <ul className="ce-checks">
                    {checks.map((c, i) => (
                      <li key={i} className={c.ok ? 'is-ok' : ''}>
                        <span aria-hidden="true">{c.ok ? '✓' : '!'}</span>
                        <div>
                          <b>{c.label}</b>
                          {c.note && <em>{c.note}</em>}
                        </div>
                        {!c.ok && (
                          <button type="button" className="sa-link is-small" onClick={() => setPlace(c.at)}>
                            Fix
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {hints.length > 0 && (
                    <>
                      <h3 className="ce-sub">Worth doing</h3>
                      <ul className="ce-hints">
                        {hints.map((h, i) => (
                          <li key={i}>
                            {h.label}{' '}
                            <button type="button" className="sa-link is-small" onClick={() => setPlace(h.at)}>
                              Go
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <div className="ce-send">
                    <p>
                      {missing
                        ? `${missing} thing${missing === 1 ? '' : 's'} to finish before it can be sent.`
                        : 'Ready. Apli.ai checks it reads clearly and is fair to students, then makes it live - or tells you what to change.'}
                    </p>
                    {editable && (
                      <button type="button" className="sa-btn" onClick={() => act('submit')} disabled={busy !== null || missing > 0}>
                        {busy === 'submit' ? 'Sending…' : 'Send to Apli.ai'}
                      </button>
                    )}
                  </div>
                  {editable && sim && (
                    <button type="button" className="sa-quiet ca-delete" onClick={remove} disabled={busy !== null}>
                      Delete this draft
                    </button>
                  )}
                </Part>
              )}
            </fieldset>

            {/* What a student will see. */}
            <aside className="ce-preview" aria-label="What students see">
              <p className="ce-preview-label">What students see</p>
              {typeof place === 'number' && tasks[place] ? (
                <TaskPreview index={place} task={tasks[place]!} />
              ) : (
                <CardPreview
                  title={title}
                  summary={summary}
                  field={field}
                  level={level}
                  hours={hours}
                  tasks={tasks.length}
                  coverUrl={coverUrl}
                  company={company}
                />
              )}
            </aside>
          </div>
        )}
      </div>
    </Frame>
  );
}

/** The body sent to the server, from the editor's fields. */
function shape(
  title: string,
  summary: string,
  about: string,
  coverUrl: string,
  videoUrl: string,
  field: string,
  level: SimLevel,
  hours: number,
  skills: string[],
  tasks: TaskDraft[],
): SimInput {
  return {
    title: title.trim(),
    summary: summary.trim(),
    about: about.trim() || null,
    coverUrl: coverUrl || null,
    videoUrl: videoUrl.trim() || null,
    field,
    level,
    hours: Number(hours),
    skills,
    tasks: tasks.map((t) => ({
      title: t.title.trim(),
      brief: t.brief.trim(),
      handIn: t.handIn?.trim() || null,
      learn: t.learn.map((l) => l.trim()).filter(Boolean),
      steps: t.steps.map((l) => l.trim()).filter(Boolean),
      pages: t.pages,
      handInKinds: t.handInKinds,
      minutes: Number(t.minutes),
    })),
  };
}

/** One task, being written. */
function TaskPart({
  index,
  total,
  task: t,
  errors,
  editable,
  onChange,
  onMove,
  onRemove,
  onPrev,
  onNext,
  nextLabel,
}: {
  index: number;
  total: number;
  task: TaskDraft;
  errors: Record<string, string>;
  editable: boolean;
  onChange: (patch: Partial<TaskDraft>) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
  onPrev: () => void;
  onNext: () => void;
  nextLabel: string;
}) {
  const e = (k: string) => errors[`tasks.${index}.${k}`];
  return (
    <>
      <Part
        title={`Task ${index + 1} of ${total}`}
        hint="One step of the work, as you would brief a new joiner."
        tools={
          editable && (
            <span className="ce-tools">
              <button type="button" onClick={() => onMove(-1)} disabled={index === 0} title="Move earlier">
                ↑
              </button>
              <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} title="Move later">
                ↓
              </button>
              <button type="button" onClick={onRemove} disabled={total <= 1} title="Remove this task" className="is-danger">
                Remove
              </button>
            </span>
          )
        }
      >
        <Field label="Title" error={e('title')}>
          <input value={t.title} onChange={(ev) => onChange({ title: ev.target.value })} placeholder="e.g. Read the accounts" />
        </Field>
        <Field
          label="The brief"
          hint="The situation and the material, as you would brief a new joiner."
          error={e('brief')}
          counter={`${t.brief.trim().length} / 4000`}
        >
          <textarea
            rows={5}
            value={t.brief}
            onChange={(ev) => onChange({ brief: ev.target.value })}
            placeholder="A bakery wants a ₹5 lakh loan. You have two years of its accounts and need to say whether it can repay."
          />
        </Field>
        <div className="ce-row">
          <Field label="What they will learn" optional hint="Short points. Up to six.">
            <ListInput values={t.learn} onChange={(learn) => onChange({ learn })} max={6} placeholder="e.g. Reading a balance sheet" />
          </Field>
          <Field label="What they will do" optional hint="The steps, in order. Up to eight.">
            <ListInput
              values={t.steps}
              onChange={(steps) => onChange({ steps })}
              max={8}
              placeholder="e.g. Pull revenue and costs for both years"
              numbered
            />
          </Field>
        </div>
        <div className="ce-field">
          <span className="ce-label">
            How students hand this in <i>pick one or more</i>
          </span>
          <div className="ce-handin-kinds" role="group" aria-label="How students hand this in">
            {HAND_IN_KINDS.map((k) => {
              const on = t.handInKinds.includes(k.key);
              return (
                <button
                  key={k.key}
                  type="button"
                  aria-pressed={on}
                  className={on ? 'is-on' : ''}
                  onClick={() =>
                    onChange({
                      handInKinds: on
                        ? t.handInKinds.filter((x) => x !== k.key)
                        : (['text', 'link', 'file'] as HandInKind[]).filter((x) => x === k.key || t.handInKinds.includes(x)),
                    })
                  }
                >
                  <span className="ce-check" aria-hidden="true">
                    {on ? '✓' : ''}
                  </span>
                  <span>
                    <b>{k.label}</b>
                    <i>{k.does}</i>
                  </span>
                </button>
              );
            })}
          </div>
          {!t.handInKinds.length && <em className="ce-error">Allow at least one way to hand it in.</em>}
          {e('handInKinds') && <em className="ce-error">{e('handInKinds')}</em>}
        </div>
        <div className="ce-row">
          <Field label="What to hand in" optional error={e('handIn')}>
            <input
              value={t.handIn ?? ''}
              onChange={(ev) => onChange({ handIn: ev.target.value })}
              placeholder="e.g. A one-page note, or a link to your sheet"
            />
          </Field>
          <Field label="Minutes it takes" error={e('minutes')}>
            <input type="number" min={10} max={480} value={t.minutes} onChange={(ev) => onChange({ minutes: Number(ev.target.value) })} />
          </Field>
        </div>
      </Part>
      <Part
        title="Pages and tests before the hand-in"
        hint="Optional. Pages to read, and tests with the kinds of question you choose."
      >
        <PagesEditor pages={t.pages} onChange={(pages) => onChange({ pages })} />
      </Part>
      <div className="ce-next">
        <button type="button" className="sa-quiet" onClick={onPrev}>
          <span aria-hidden="true">←</span> {index === 0 ? 'Overview' : `Task ${index}`}
        </button>
        <button type="button" className="sa-btn is-ghost" onClick={onNext}>
          {nextLabel} {nextLabel.startsWith('+') ? null : <span aria-hidden="true">→</span>}
        </button>
      </div>
    </>
  );
}

/** The simulation's card in the list, as a student will see it. */
function CardPreview(props: {
  title: string;
  summary: string;
  field: string;
  level: SimLevel;
  hours: number;
  tasks: number;
  coverUrl: string;
  company: { id: string; name: string; logoUrl: string | null };
}) {
  const level = LEVELS.find((l) => l.key === props.level)?.label;
  const sim = {
    coverUrl: props.coverUrl || null,
    field: props.field || 'Field',
    company: props.company,
  } as Parameters<typeof Cover>[0]['sim'];
  return (
    <div className="sa-sim ce-card">
      <span className="sa-sim-cover">
        <Cover sim={sim} />
        <span className="sa-sim-badge">
          <span className={`sa-tile is-${toneOf(props.company.name)}`}>
            {props.company.name
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0])
              .join('')}
          </span>
        </span>
      </span>
      <span className="sa-sim-body">
        <span className="sa-sim-co">{props.company.name}</span>
        <b className="sa-sim-title">{props.title.trim() || 'Your title'}</b>
        <span className="sa-sim-summary">{props.summary.trim() || 'What the student will do appears here.'}</span>
        <span className="sa-sim-facts">
          <span>{props.field || 'Field'}</span>
          <span>{level}</span>
          <span>~{props.hours} hrs</span>
          <span>
            {props.tasks} task{props.tasks === 1 ? '' : 's'}
          </span>
        </span>
      </span>
    </div>
  );
}

/** One task, opened, as a student will see it. */
function TaskPreview({ index, task: t }: { index: number; task: TaskDraft }) {
  const learn = t.learn.map((l) => l.trim()).filter(Boolean);
  const steps = t.steps.map((l) => l.trim()).filter(Boolean);
  return (
    <ol className="sa-path-tasks ce-task-preview">
      <li className="is-next is-open">
        <div className="sa-pt-head">
          <span className="sa-task-n" aria-hidden="true">
            {index + 1}
          </span>
          <span className="sa-pt-title">
            <b>{t.title.trim() || 'Task title'}</b>
            <span>~{t.minutes || 0} min</span>
          </span>
        </div>
        <div className="sa-pt-body">
          {learn.length > 0 && (
            <div className="sa-pt-learn">
              <h4>What you will learn</h4>
              <ul>
                {learn.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="sa-pt-brief">{t.brief.trim() || 'The brief appears here.'}</p>
          {steps.length > 0 && (
            <div className="sa-pt-steps">
              <h4>What you will do</h4>
              <ol>
                {steps.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ol>
            </div>
          )}
          {t.pages.length > 0 && (
            <p className="ce-preview-pages">
              Then {t.pages.filter((p) => p.kind === 'read').length} page
              {t.pages.filter((p) => p.kind === 'read').length === 1 ? '' : 's'} to read and{' '}
              {t.pages.filter((p) => p.kind === 'check').length} quick check
              {t.pages.filter((p) => p.kind === 'check').length === 1 ? '' : 's'}, before the hand-in.
            </p>
          )}
          {t.handIn?.trim() && (
            <p className="sa-task-handin">
              <b>Hand in:</b> {t.handIn.trim()}
            </p>
          )}
        </div>
      </li>
    </ol>
  );
}

function Part({ title, hint, tools, children }: { title: string; hint?: string; tools?: ReactNode; children: ReactNode }) {
  return (
    <section className="ce-part">
      <header>
        <div>
          <h2>{title}</h2>
          {hint && <p>{hint}</p>}
        </div>
        {tools}
      </header>
      <div className="ce-part-body">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  optional,
  error,
  counter,
  children,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  error?: string;
  counter?: string;
  children: ReactNode;
}) {
  return (
    <label className={`ce-field ${error ? 'has-error' : ''}`}>
      <span className="ce-label">
        {label} {optional && <i>optional</i>}
        {counter && <small>{counter}</small>}
      </span>
      {children}
      {error ? <em className="ce-error">{error}</em> : hint ? <span className="ce-hint">{hint}</span> : null}
    </label>
  );
}

/** Skills as chips: type, press Enter; Backspace on an empty box takes the last one off. */
function ChipInput({
  values,
  onChange,
  max,
  placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  max: number;
  placeholder: string;
}) {
  const [text, setText] = useState('');
  function add() {
    const v = text.trim().replace(/,$/, '');
    if (!v || values.length >= max || values.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    onChange([...values, v]);
    setText('');
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add();
    } else if (e.key === 'Backspace' && !text && values.length) {
      onChange(values.slice(0, -1));
    }
  }
  return (
    <span className="ce-chips">
      {values.map((v) => (
        <span key={v} className="ce-chip">
          {v}
          <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`}>
            ×
          </button>
        </span>
      ))}
      {values.length < max && (
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} onBlur={add} placeholder={values.length ? '' : placeholder} />
      )}
    </span>
  );
}

/** A short list, one line per point, each removable. */
function ListInput({
  values,
  onChange,
  max,
  placeholder,
  numbered,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  max: number;
  placeholder: string;
  /** Steps are numbered; points are not. */
  numbered?: boolean;
}) {
  const rows = values.length ? values : [''];
  return (
    <span className="ce-list">
      {rows.map((v, i) => (
        <span key={i} className="ce-list-row">
          {numbered ? (
            <span className="ce-list-n" aria-hidden="true">
              {i + 1}
            </span>
          ) : (
            <span className="ce-list-mark" aria-hidden="true" />
          )}
          <input
            value={v}
            onChange={(e) => onChange(rows.map((x, j) => (j === i ? e.target.value : x)))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (rows.length < max) onChange([...rows.slice(0, i + 1), '', ...rows.slice(i + 1)]);
              }
            }}
            placeholder={i === 0 ? placeholder : ''}
          />
          {rows.length > 1 && (
            <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Remove point">
              ×
            </button>
          )}
        </span>
      ))}
      {rows.length < max && (
        <button type="button" className="ce-list-add" onClick={() => onChange([...rows, ''])}>
          {numbered ? '+ Add a step' : '+ Add a point'}
        </button>
      )}
    </span>
  );
}
