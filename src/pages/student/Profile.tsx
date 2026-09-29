import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import StudentLayout from './StudentLayout';
import {
  candidateApi,
  MAX_PROJECT_LINKS,
  RESUME_LAYOUTS,
  RESUME_SECTIONS,
  type SavedResume,
  type ResumeLayout,
  type ResumeSection,
  type Profile as ProfileData,
  type ProjectLink,
  type StudentPrograms,
} from '../../api/candidate';
import { catalogueApi, type FullCatalogue } from '../../api/catalogue';
import { ShowcasePanel, ShowcaseStatus } from './Showcase';
import { ApiError } from '../../api/client';
import { useT, type MessageKey } from '../../i18n';
import './Profile.css';

/**
 * `focus` is the Resume or Showcase tab arriving at the same screen.
 *
 * The resume lives on the profile because that is where it is written, and a
 * separate page would be the same three sections with a different heading.
 * The tab scrolls to them and says so, rather than duplicating them.
 *
 * The showcase is here for the same reason from the other side: it is this
 * profile as a recruiter sees it, pitched in the student's own words and
 * pinning the projects this page holds. On a page of its own it was a switch
 * nobody could find - which is what made a company's talent search look
 * empty.
 */
export default function Profile({ focus }: { focus?: 'resume' | 'showcase' } = {}) {
  const { t } = useT();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);

  /*
   * Which batch is open, kept in the address rather than in state.
   *
   * The profile is nine sections long and a student only ever fills one of
   * them at a sitting. Holding the open one in `?s=` means a reload, a back
   * button and a link from somewhere else ("finish your academics") all land
   * on the same batch, and nothing has to be synced with the query the
   * layout already puts there.
   */
  const [params, setParams] = useSearchParams();
  const top = useRef<HTMLDivElement>(null);
  /*
   * Which batch to open when the address does not say - worked out once,
   * from the profile as it first arrived, and then left alone.
   *
   * Re-deciding it on every render would move the page out from under the
   * student: finishing the About batch would tick it, and the next render
   * would helpfully send them to Academics mid-sentence.
   */
  const landed = useRef<BatchKey | null>(null);

  /*
   * The lists operations keeps under Setup, fetched once for the whole page.
   *
   * A student typing "femail", or "B-Tech" where the catalogue says "B.Tech",
   * is a record that matches nothing and reads badly to a recruiter. Failing
   * to load it leaves the fields as plain boxes rather than as empty
   * dropdowns nobody can get past.
   */
  const [lists, setLists] = useState<FullCatalogue | null>(null);

  /*
   * The courses this student may be on, which is not the same list.
   *
   * The catalogue above is every course the platform knows; this is their own
   * college's programmes. A student offered the first can record a course
   * nobody at their college studies, which then matches no role's criteria
   * and tells them nothing about why.
   */
  const [programs, setPrograms] = useState<StudentPrograms | null>(null);

  useEffect(() => {
    candidateApi
      .getProfile()
      .then(setProfile)
      // '' stands for "our own message", which is translated when shown.
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : ''));

    catalogueApi
      .all()
      .then(setLists)
      .catch(() => setLists(null));

    candidateApi
      .programs()
      .then(setPrograms)
      .catch(() => setPrograms(null));
  }, []);

  if (error !== null) {
    return (
      <StudentLayout>
        <p className="alert alert-error">{error || t('profile.loadError')}</p>
      </StudentLayout>
    );
  }

  if (!profile) {
    return (
      <StudentLayout>
        <p className="muted">{t('common.loading')}</p>
      </StudentLayout>
    );
  }

  /*
   * Verified, which locks what the college vouched for - the graduating year
   * and the marks - and nothing else. A student's own account of themselves
   * stays theirs to write: locking it did not make "verified" mean more, it
   * only capped every verified student's profile at the one section their
   * college fills in.
   */
  const locked = profile.batch?.isFrozen ?? false;

  /*
   * The batches, with the completion sections each one answers for.
   *
   * A tick on a batch is the server's own verdict on those sections, not a
   * second count kept here - the two would drift the first time the rule
   * behind one of them changed.
   */
  const done = (key: string) => profile.completion.sections.find((s) => s.key === key)?.done ?? false;
  const batches = BATCHES.map((b) => ({
    ...b,
    label: t(b.labelKey),
    hint: t(b.hintKey),
    done: b.needs.length > 0 && b.needs.every(done),
  }));

  // The one they asked for, else the first that still wants something.
  if (landed.current === null) {
    landed.current = (batches.find((b) => b.needs.length > 0 && !b.done) ?? batches[0]!).key;
  }
  const asked = params.get('s');
  const active = batches.find((b) => b.key === asked)?.key ?? landed.current;

  function go(key: BatchKey) {
    const next = new URLSearchParams(params);
    next.set('s', key);
    setParams(next, { replace: true });
    // The panel is taller than the strip, so the strip is what to come back to.
    top.current?.scrollIntoView({ block: 'start' });
  }

  const at = batches.findIndex((b) => b.key === active);
  const prev = at > 0 ? batches[at - 1]! : null;
  const next = at < batches.length - 1 ? batches[at + 1]! : null;

  return (
    <StudentLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">{t('common.student')}</p>
          <h1>
            {focus === 'resume'
              ? t('resume.pageTitle')
              : focus === 'showcase'
                ? t('showcase.pageTitle')
                : t('profile.title')}
          </h1>
          <p className="page-lede">
            {focus === 'resume'
              ? t('resume.pageLede')
              : focus === 'showcase'
                ? t('showcase.pageLede')
                : locked
                  ? t('profile.lockedLede')
                  : t('profile.openLede')}
          </p>
        </div>
      </header>

      {/*
        The Resume tab is this screen's resume half on its own.
        
        It lives here because this is where it is written - from the
        education, skills and projects below - and a page of its own would be
        the same three sections under a different heading, drifting apart the
        first time one of them changed.
      */}
      {focus === 'showcase' ? (
        <>
          <ShowcasePanel />
          <p className="muted">
            {t('showcase.fromProfile')} <Link to="/student/profile">{t('resume.toProfile')}</Link>
          </p>
        </>
      ) : focus === 'resume' ? (
        <>
          <SavedResumes profile={profile} onChanged={setProfile} />
          <ResumeBuilder profile={profile} onBuilt={setProfile} />
          <p className="muted">
            {t('resume.fromProfile')} <Link to="/student/profile">{t('resume.toProfile')}</Link>
          </p>
        </>
      ) : (
        <>
          {locked && (
            <p className="alert alert-ok">
              <b>{t('profile.verifiedBy', { college: profile.batch?.college ?? '' })}</b>{' '}
              {t('profile.verifiedBody')}
            </p>
          )}

          <CompletionCard profile={profile} onJump={(key) => go(key)} />

          <div ref={top} className="batch-anchor" />
          <BatchNav items={batches} active={active} onPick={go} />

          {/*
            One batch at a time. Everything below used to sit on one scroll -
            nine sections, most of them already answered - and the fields a
            student actually came to fill in were somewhere in the middle of
            it. They are grouped by the question they answer instead, and the
            strip above says which groups are still short of something.
          */}
          <div
            className="batch-panel"
            id={`batch-panel-${active}`}
            role="tabpanel"
            aria-labelledby={`batch-tab-${active}`}
            tabIndex={-1}
          >
            {active === 'about' && (
              <AboutBand profile={profile} locked={locked} lists={lists} onSaved={setProfile} />
            )}

            {active === 'academics' && (
              <>
                <AcademicsBand
                  profile={profile}
                  locked={locked}
                  lists={lists}
                  programs={programs}
                  onSaved={setProfile}
                />
                <EducationCard profile={profile} lists={lists} onSaved={setProfile} />
              </>
            )}

            {active === 'proof' && (
              <>
                {/* A student's own account of themselves, verified or not. */}
                <SkillsCard profile={profile} lists={lists} onSaved={setProfile} />
                <ExperienceCard profile={profile} lists={lists} onSaved={setProfile} />
                <ProjectsCard profile={profile} onSaved={setProfile} />
              </>
            )}

            {active === 'prefs' && (
              <AccessBand profile={profile} locked={locked} lists={lists} onSaved={setProfile} />
            )}

            {active === 'resume' && (
              <>
                <ResumeCard profile={profile} onSaved={setProfile} />
                <SavedResumes profile={profile} onChanged={setProfile} />
                <ResumeBuilder profile={profile} onBuilt={setProfile} />
                {/* Whether any of the above can be found by a company, said
                    plainly at the foot of the thing it is about. */}
                <ShowcaseStatus />
              </>
            )}
          </div>

          <nav className="batch-move" aria-label={t('batch.moveLabel')}>
            {prev ? (
              <button type="button" className="batch-step is-prev" onClick={() => go(prev.key)}>
                <small>{t('batch.prev')}</small>
                <b>{prev.label}</b>
              </button>
            ) : (
              <span />
            )}
            {next && (
              <button type="button" className="batch-step is-next" onClick={() => go(next.key)}>
                <small>{t('batch.next')}</small>
                <b>{next.label}</b>
              </button>
            )}
          </nav>
        </>
      )}
    </StudentLayout>
  );
}

/* -------------------------------------------------------------------------- */

type BatchKey = 'about' | 'academics' | 'proof' | 'prefs' | 'resume';

/**
 * The profile in five sittings.
 *
 * `needs` is the completion sections a batch is responsible for, which is
 * what draws its tick. A batch with none - preferences, which nothing is
 * scored on - simply never claims to be finished.
 */
const BATCHES: {
  key: BatchKey;
  labelKey: MessageKey;
  hintKey: MessageKey;
  /** Completion sections this batch holds the fields for. */
  needs: string[];
}[] = [
  { key: 'about', labelKey: 'batch.about', hintKey: 'batch.aboutHint', needs: ['basics'] },
  {
    key: 'academics',
    labelKey: 'batch.academics',
    hintKey: 'batch.academicsHint',
    needs: ['academics', 'education'],
  },
  { key: 'proof', labelKey: 'batch.proof', hintKey: 'batch.proofHint', needs: ['skills', 'evidence'] },
  { key: 'prefs', labelKey: 'batch.prefs', hintKey: 'batch.prefsHint', needs: [] },
  { key: 'resume', labelKey: 'batch.resume', hintKey: 'batch.resumeHint', needs: ['resume'] },
];

/** Which batch a completion section is filled in on, for the chips above. */
const BATCH_OF: Record<string, BatchKey> = {
  basics: 'about',
  academics: 'academics',
  education: 'academics',
  skills: 'proof',
  evidence: 'proof',
  resume: 'resume',
};

type Batch = { key: BatchKey; label: string; hint: string; done: boolean };

/**
 * The strip that switches batches.
 *
 * A row of tabs rather than a stepper: these are five places to go, not five
 * steps in an order, and a student who only wants to change their phone
 * number should not have to walk past their marks to reach it.
 */
function BatchNav({
  items,
  active,
  onPick,
}: {
  items: Batch[];
  active: BatchKey;
  onPick: (key: BatchKey) => void;
}) {
  const { t } = useT();

  // Left and right walk the strip, as a tab list is expected to.
  function onKey(e: React.KeyboardEvent, i: number) {
    const by = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!by) return;
    e.preventDefault();
    onPick(items[(i + by + items.length) % items.length]!.key);
  }

  return (
    <div className="batch-nav" role="tablist" aria-label={t('batch.navLabel')}>
      {items.map((b, i) => {
        const on = b.key === active;
        return (
          <button
            key={b.key}
            type="button"
            role="tab"
            id={`batch-tab-${b.key}`}
            aria-selected={on}
            aria-controls={`batch-panel-${b.key}`}
            tabIndex={on ? 0 : -1}
            className={`batch-tab ${on ? 'is-on' : ''} ${b.done ? 'is-done' : ''}`}
            onClick={() => onPick(b.key)}
            onKeyDown={(e) => onKey(e, i)}
          >
            <span className="batch-no" aria-hidden="true">
              {b.done ? '✓' : i + 1}
            </span>
            <span className="batch-text">
              <b>{b.label}</b>
              <small>{b.hint}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * How far along they are, in one line.
 *
 * This used to tick off all six sections underneath, which meant the first
 * screen of the profile was a list of things the student had already done.
 * The finished ones are now a number; what is left is a row of chips that
 * open the batch the missing field is on, so the summary is also the way in.
 */
function CompletionCard({
  profile,
  onJump,
}: {
  profile: ProfileData;
  onJump: (key: BatchKey) => void;
}) {
  const { t } = useT();
  const { percent, sections } = profile.completion;
  const outstanding = sections.filter((s) => !s.done);

  return (
    <section className="card completion">
      <div
        className="completion-ring"
        style={{ '--pct': `${percent}` } as React.CSSProperties}
        role="img"
        aria-label={t('completion.percent', { n: percent })}
      >
        <span aria-hidden="true">{percent}%</span>
      </div>

      <div className="completion-say">
        <h2>{t('completion.percent', { n: percent })}</h2>
        <p className="muted">
          {outstanding.length === 0
            ? t('completion.allDone')
            : outstanding.length === 1
              ? t('completion.leftOne')
              : t('completion.leftMany', { n: outstanding.length })}
        </p>

        {outstanding.length > 0 && (
          <div className="completion-chips">
            {outstanding.map((s) => (
              <button
                key={s.key}
                type="button"
                className="completion-chip"
                title={s.hint}
                onClick={() => onJump(BATCH_OF[s.key] ?? 'about')}
              >
                {s.label}
                <span aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

interface CardProps {
  profile: ProfileData;
  /** Verified by the college: the graduating year and the marks, nothing else. */
  locked: boolean;
  /** Null while it loads, or if it could not be fetched. */
  lists: FullCatalogue | null;
  onSaved: (p: ProfileData) => void;
}

/**
 * A section a student owns outright, so there is nothing to lock. The lists
 * are optional here: skills and projects have nothing to offer from Setup.
 */
type OwnCardProps = Omit<CardProps, 'locked' | 'lists'> & { lists?: FullCatalogue | null };

/**
 * The resumes a student keeps, and which one is in use.
 *
 * More than one because a student applying for two kinds of role writes two
 * kinds of resume. One of them is the current one - that is what an
 * application carries and what a recruiter opens - and the rest sit here
 * until they are wanted.
 */
function SavedResumes({
  profile,
  onChanged,
}: {
  profile: ProfileData;
  onChanged: (p: ProfileData) => void;
}) {
  const { t } = useT();
  const [list, setList] = useState<SavedResume[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [look, setLook] = useState<string | null>(null);

  const load = () =>
    candidateApi
      .resumes()
      .then(setList)
      .catch(() => setList([]));

  // Reloaded whenever the profile changes, because building one, uploading
  // one and deleting one all change this list.
  useEffect(() => {
    void load();
  }, [profile.resumeUrl]);

  async function run(fn: () => Promise<{ profile: ProfileData }>) {
    setBusy(true);
    setError(null);
    try {
      onChanged((await fn()).profile);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('resume.listError'));
    } finally {
      setBusy(false);
    }
  }

  if (list === null) return null;
  if (list.length === 0) {
    return (
      <section className="card">
        <h2>{t('resume.listTitle')}</h2>
        <p className="muted">{t('resume.listEmpty')}</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>{t('resume.listTitle')}</h2>
      <p className="muted">{t('resume.listLede')}</p>
      {error && <p className="alert alert-error">{error}</p>}

      <ul className="res-list">
        {list.map((r) => {
          const inUse = r.url === profile.resumeUrl;
          const open = look === r.id;
          return (
            <li key={r.id} className={inUse ? 'is-current' : ''}>
              <div className="res-row">
                <label className="res-pick">
                  <input
                    type="radio"
                    name="current-resume"
                    checked={inUse}
                    disabled={busy}
                    onChange={() => void run(() => candidateApi.updateResume(r.id, { use: true }))}
                  />
                  <span>
                    <b>{r.name}</b>
                    <small>
                      {r.source === 'BUILT' ? t('resume.sourceBuilt') : t('resume.sourceUploaded')} ·{' '}
                      {new Date(r.createdAt).toLocaleDateString()}
                      {inUse ? ` · ${t('resume.inUse')}` : ''}
                    </small>
                  </span>
                </label>

                <span className="res-acts">
                  {/* Checked before it is chosen, which is the whole point of
                      keeping more than one. */}
                  <button type="button" className="link-btn" onClick={() => setLook(open ? null : r.id)}>
                    {open ? t('resume.hide') : t('resume.check')}
                  </button>
                  <a className="link-btn" href={`${r.url}?download`}>
                    {t('resume.download')}
                  </a>
                  <button
                    type="button"
                    className="link-btn is-danger"
                    disabled={busy}
                    onClick={() => void run(() => candidateApi.deleteResume(r.id))}
                  >
                    {t('common.remove')}
                  </button>
                </span>
              </div>

              {open && <iframe className="res-look" title={r.name} src={r.url} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const LAYOUT_LABEL: Record<ResumeLayout, { name: string; why: string }> = {
  classic: { name: 'Classic', why: 'One column, generous. The safe answer.' },
  compact: { name: 'Compact', why: 'The same, tightened, when it stops fitting on one page.' },
  sidebar: { name: 'Sidebar', why: 'Contact, marks and skills down the left; the story on the right.' },
};

const SECTION_LABEL: Record<ResumeSection, string> = {
  summary: 'Summary',
  education: 'Education',
  experience: 'Experience',
  projects: 'Projects',
  skills: 'Skills',
};

/**
 * A resume made out of the profile they have already filled in.
 *
 * Nothing is typed twice: a campus student's marks, education, projects and
 * skills are on here because a recruiter filters on them. What is left to
 * decide is what to leave out and what order to put it in, which is the part
 * of writing a resume people actually get wrong.
 */
function ResumeBuilder({
  profile,
  onBuilt,
}: {
  profile: ProfileData;
  onBuilt: (p: ProfileData) => void;
}) {
  const { t } = useT();
  const saved = profile.resumeBuild;

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [built, setBuilt] = useState<string | null>(null);

  const [summary, setSummary] = useState(saved?.summary ?? profile.about ?? '');
  const [order, setOrder] = useState<ResumeSection[]>(saved?.sections ?? [...RESUME_SECTIONS]);
  const [off, setOff] = useState<ResumeSection[]>(
    saved?.sections ? RESUME_SECTIONS.filter((x) => !saved.sections!.includes(x)) : [],
  );
  const [hide, setHide] = useState<string[]>(saved?.hide ?? []);
  const [showMarks, setShowMarks] = useState(saved?.showMarks ?? true);
  const [layout, setLayout] = useState<ResumeLayout>(saved?.layout ?? 'classic');

  const build_ = useMemo(
    () => ({ summary, sections: order.filter((x) => !off.includes(x)), hide, showMarks, layout }),
    [summary, order, off, hide, showMarks, layout],
  );

  /*
   * The preview is the real PDF, fetched and shown from a blob.
   *
   * Rendering it again on every keystroke would be a request per character,
   * so it settles for a moment first. The object URL is revoked when it is
   * replaced - a preview left behind holds its bytes in memory for as long
   * as the page is open.
   */
  const [preview, setPreview] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    if (!open) return;
    let dropped = false;
    const id = window.setTimeout(async () => {
      setDrawing(true);
      try {
        const blob = await candidateApi.previewResume(build_);
        if (dropped) return;
        setPreview((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(blob);
        });
      } catch {
        // A preview that will not draw is not worth taking the form over.
      } finally {
        if (!dropped) setDrawing(false);
      }
    }, 500);

    return () => {
      dropped = true;
      window.clearTimeout(id);
    };
  }, [open, build_]);

  // And once for good when the builder closes or the page goes.
  useEffect(() => () => setPreview((old) => (old && URL.revokeObjectURL(old), null)), []);

  const toggleSection = (x: ResumeSection) =>
    setOff((prev) => (prev.includes(x) ? prev.filter((k) => k !== x) : [...prev, x]));

  const toggleEntry = (id: string) =>
    setHide((prev) => (prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]));

  function move(i: number, by: number) {
    const j = i + by;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setOrder(next);
  }

  async function build() {
    setBusy(true);
    setError(null);
    try {
      const { url, profile: fresh } = await candidateApi.buildResume(build_);
      setBuilt(url);
      onBuilt(fresh);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('resume.buildError'));
    } finally {
      setBusy(false);
    }
  }

  /** What each section will actually contain, so nothing is built blind. */
  const entriesFor = (x: ResumeSection): { id: string; label: string }[] => {
    if (x === 'education') return profile.educations.map((e) => ({ id: e.id, label: e.degree }));
    if (x === 'experience')
      return profile.experiences.map((e) => ({ id: e.id, label: `${e.title}, ${e.organisation}` }));
    if (x === 'projects') return profile.projects.map((p) => ({ id: p.id, label: p.title }));
    return [];
  };

  return (
    <section className="card">
      <div className="card-head">
        <h2>{t('resume.builderTitle')}</h2>
        <button type="button" className="link-btn" onClick={() => setOpen((v) => !v)}>
          {open ? t('common.cancel') : t('resume.builderOpen')}
        </button>
      </div>
      <p className="muted">{t('resume.builderLede')}</p>
      {error && <p className="alert alert-error">{error}</p>}

      {open && (
        <div className="rb">
          <div className="rb-choices">
          <fieldset className="rb-layouts">
            <legend className="field-label">{t('resume.layout')}</legend>
            {RESUME_LAYOUTS.map((x) => (
              <label key={x} className={`rb-layout ${layout === x ? 'is-current' : ''}`}>
                <input
                  type="radio"
                  name="rb-layout"
                  checked={layout === x}
                  onChange={() => setLayout(x)}
                  disabled={busy}
                />
                <span>
                  <b>{LAYOUT_LABEL[x].name}</b>
                  <small>{LAYOUT_LABEL[x].why}</small>
                </span>
              </label>
            ))}
          </fieldset>

          <label className="field">
            <span className="field-label">{t('resume.summary')}</span>
            <textarea
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={600}
              placeholder={t('resume.summaryPlaceholder')}
              disabled={busy}
            />
            <span className="field-hint">{t('resume.summaryHint')}</span>
          </label>

          <ol className="rb-sections">
            {order.map((x, i) => {
              const on = !off.includes(x);
              const entries = entriesFor(x);
              return (
                <li key={x} className={on ? '' : 'is-off'}>
                  <div className="rb-head">
                    <label className="rb-toggle">
                      <input type="checkbox" checked={on} onChange={() => toggleSection(x)} disabled={busy} />
                      <b>{SECTION_LABEL[x]}</b>
                    </label>
                    <span className="round-actions">
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t('resume.moveUp')}>
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => move(i, 1)}
                        disabled={i === order.length - 1}
                        aria-label={t('resume.moveDown')}
                      >
                        ↓
                      </button>
                    </span>
                  </div>

                  {/* Which entries go in, so a weaker project can be dropped
                      without deleting it from the profile itself. */}
                  {on && entries.length > 0 && (
                    <div className="rb-entries">
                      {entries.map((e) => (
                        <label key={e.id}>
                          <input
                            type="checkbox"
                            checked={!hide.includes(e.id)}
                            onChange={() => toggleEntry(e.id)}
                            disabled={busy}
                          />
                          {e.label}
                        </label>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          <label className="round-check">
            <input
              type="checkbox"
              checked={showMarks}
              onChange={(e) => setShowMarks(e.target.checked)}
              disabled={busy}
            />
            <span>
              <b>{t('resume.marks')}</b>
              <small>{t('resume.marksHint')}</small>
            </span>
          </label>

          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={() => void build()} disabled={busy}>
              {busy ? t('resume.building') : t('resume.build')}
            </button>
            {built && (
              <a className="entry-link" href={built} target="_blank" rel="noreferrer noopener">
                {t('resume.builtOpen')}
              </a>
            )}
            {built && (
              <a className="entry-link" href={`${built}?download`}>
                {t('resume.download')}
              </a>
            )}
          </div>
          {built && <p className="field-hint">{t('resume.builtNote')}</p>}
          </div>

          {/*
            The preview is the PDF itself, not a drawing of it: the same
            renderer, shown from bytes the browser already has. There is only
            one layout engine, so there is nothing to drift.
          */}
          <aside className="rb-preview">
            <p className="rb-preview-label">
              {t('resume.preview')}
              {drawing && <span className="rb-drawing"> {t('resume.drawing')}</span>}
            </p>
            {preview ? (
              <iframe title={t('resume.preview')} src={preview} />
            ) : (
              <div className="rb-preview-empty">{t('resume.drawing')}</div>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}

/**
 * The resume: upload the file, or link to one hosted elsewhere.
 *
 * Both, because neither covers everybody. A student with the PDF on their
 * phone should not have to put it on a drive first and work out the sharing
 * settings; a student who already keeps it on a drive should not have to
 * re-upload it every time they change a line.
 *
 * The upload only mints an address - the profile changes when the block is
 * saved - so a file chosen and then thought better of leaves the old resume
 * where it was.
 */
function ResumeField({
  value,
  onChange,
  disabled,
  onUploaded,
}: {
  value: string;
  onChange: (url: string) => void;
  disabled: boolean;
  /** An upload joins the saved list, so the page reloads with it. */
  onUploaded: (p: ProfileData) => void;
}) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function take(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { url, profile } = await candidateApi.uploadResume(file);
      onChange(url);
      onUploaded(profile);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('resume.uploadError'));
    } finally {
      setBusy(false);
      // Cleared so choosing the same file again still counts as a change.
      if (input.current) input.current.value = '';
    }
  }

  const ours = value.startsWith('/api/files/');

  return (
    <label className="field resume-field">
      <span className="field-label">{t('basics.resume')}</span>

      <div className="resume-row">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('resume.linkPlaceholder')}
          disabled={disabled || busy}
        />
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => input.current?.click()}
          disabled={disabled || busy}
        >
          {busy ? t('resume.uploading') : t('resume.upload')}
        </button>
        <input
          ref={input}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => void take(e.target.files?.[0])}
        />
      </div>

      {error && <span className="field-error">{error}</span>}
      <span className="field-hint">
        {ours ? t('resume.stored') : t('resume.hint')}
      </span>
      {value && (
        <span className="resume-links">
          <a className="entry-link" href={value} target="_blank" rel="noreferrer noopener">
            {t('resume.open')}
          </a>
          {/* Ours, so it can be asked for as a file rather than a page. */}
          {ours && (
            <a className="entry-link" href={`${value}?download`}>
              {t('resume.download')}
            </a>
          )}
        </span>
      )}
    </label>
  );
}

/**
 * Bringing a resume they already have: the PDF, or a link to it.
 *
 * This lived among the contact fields, which put an upload and a file link
 * on the first thing a student saw and left the batch actually called Resume
 * able to build one but not to receive one. It is one card here with the
 * list it feeds and the builder that writes the alternative.
 *
 * It saves on its own rather than as part of a block: nothing else on this
 * batch is a field, so there was no block left to belong to.
 */
function ResumeCard({ profile, onSaved }: OwnCardProps) {
  const { t } = useT();
  const { busy, error, run } = useSaver(onSaved);
  const [saved, flag] = useSavedFlag();
  const [url, setUrl] = useState(profile.resumeUrl ?? '');

  return (
    <section className="card">
      <h2>{t('resume.addTitle')}</h2>
      <p className="muted">{t('resume.addLede')}</p>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => candidateApi.saveBasics({ resumeUrl: url }))) flag();
        }}
        noValidate
      >
        <ResumeField
          value={url}
          onChange={setUrl}
          disabled={busy}
          /* An upload mints an address and joins the saved list; the profile
             itself only changes when this is saved, so a file chosen and
             then thought better of leaves the old resume where it was. */
          onUploaded={onSaved}
        />
        <SaveRow busy={busy} saved={saved} error={error} />
      </form>
    </section>
  );
}

/**
 * A box that offers the list but still takes a typed answer.
 *
 * Used where the list is the usual answer and not the only one - a school is
 * not on the portal's roll of colleges, and a first job may be in a town
 * nobody has entered yet. A closed `select` there would leave a student
 * unable to record something true about themselves.
 */
/**
 * A dropdown that is a dropdown.
 *
 * This was a `<datalist>`, which a browser draws as a plain text box with a
 * faint arrow and a suggestion popup in its own house style - so it neither
 * looked like the selects beside it nor behaved like one, and on a phone it
 * read as a text field that had opinions. It is a real `<select>` now.
 *
 * The catalogue is not always the whole world, though: a student went to a
 * school that is on nobody's list. So the last option opens a text box rather
 * than the list being a gate. Whatever is already on record stays selectable
 * even if operations has since retired it, so opening the form and saving it
 * cannot silently drop what was there.
 */
function Select({
  options,
  value,
  onChange,
  otherLabel,
  placeholder,
  disabled,
  required,
  id,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  /** Offer a free-text escape under this label. Omitted means a closed list. */
  otherLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}) {
  const { t } = useT();
  const known = value === '' || options.includes(value);
  const [free, setFree] = useState(!known && value !== '');

  return (
    <>
      <select
        id={id}
        className="sel"
        value={free ? '__other' : value}
        disabled={disabled}
        required={required && !free}
        onChange={(e) => {
          if (e.target.value === '__other') {
            setFree(true);
            onChange('');
          } else {
            setFree(false);
            onChange(e.target.value);
          }
        }}
      >
        <option value="">{placeholder ?? t('common.choose')}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        {otherLabel && <option value="__other">{otherLabel}</option>}
      </select>
      {free && (
        <input
          className="sel-other"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required={required}
          autoFocus
          placeholder={otherLabel}
        />
      )}
    </>
  );
}

/**
 * One band of the form.
 *
 * It used to be an accordion, shut until it was wanted, because twenty-odd
 * fields on one scroll is a wall rather than a form. The batches above do
 * that job now and do it better, so what is left here is the heading and the
 * count of what is still blank - which updates as it is typed, rather than
 * waiting for a save to tell them.
 */
function Band({
  title,
  hint,
  todo,
  children,
}: {
  title: string;
  hint?: string;
  /** How many fields here are still blank. 0 draws a tick. */
  todo: number;
  children: ReactNode;
}) {
  const { t } = useT();

  return (
    <section className="card band">
      <div className="band-head">
        <h2 className="band-title">
          {title}
          {hint && <span className="band-hint">{hint}</span>}
        </h2>
        <span className={`band-todo ${todo === 0 ? 'is-done' : ''}`}>
          {todo === 0 ? t('band.done') : t('band.todo', { n: todo })}
        </span>
      </div>
      <div className="band-body">{children}</div>
    </section>
  );
}

/** A yes / no / not-said answer. Null is a real value here, not a blank. */
function Tri({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  disabled?: boolean;
}) {
  const { t } = useT();
  const opts: [string, boolean | null][] = [
    [t('common.yes'), true],
    [t('common.no'), false],
    [t('common.notSaid'), null],
  ];
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="tri" role="group" aria-label={label}>
        {opts.map(([text, v]) => (
          <button
            key={text}
            type="button"
            className={`tri-opt ${value === v ? 'is-on' : ''}`}
            aria-pressed={value === v}
            disabled={disabled}
            onClick={() => onChange(v)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A list of keys the student ticks, drawn from a fixed catalogue list. */
function KeyChecks({
  items,
  chosen,
  onChange,
  disabled,
}: {
  items: { key: string; label: string; hint?: string }[];
  chosen: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="checks">
      {items.map((i) => {
        const on = chosen.includes(i.key);
        return (
          <label key={i.key} className={`check ${on ? 'is-on' : ''}`}>
            <input
              type="checkbox"
              checked={on}
              disabled={disabled}
              onChange={() => onChange(on ? chosen.filter((k) => k !== i.key) : [...chosen, i.key])}
            />
            <span>
              {i.label}
              {i.hint && <em className="check-hint">{i.hint}</em>}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** Shared save/error plumbing so each section stays about its own fields. */
function useSaver(onSaved: (p: ProfileData) => void) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<ProfileData>) {
    setBusy(true);
    setError(null);
    try {
      onSaved(await fn());
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('profile.saveError'));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, run };
}

/** Courses whose students also hold a bachelor's, so the PG marks matter. */
const PG_COURSES = /^(m\.?tech|m\.?e\b|mca|mba|m\.?sc|m\.?com|pgdm|m\.?a\b)/i;

const str = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v));
/** Sent only when it was actually typed, so a blank never clears a mark. */
const num = (v: string) => (v.trim() === '' ? undefined : Number(v));

/**
 * A `<input type="month">` value as the instant the API stores.
 *
 * Noon rather than midnight, so a browser in IST and a server reading UTC
 * cannot disagree about which month it was.
 */
const monthStart = (v: string) => (v ? new Date(`${v}-01T12:00:00`).toISOString() : '');

/** When a project ran, in the words its card has room for. */
function projectWhen(p: { startDate: string | null; endDate: string | null }): string {
  const month = (d: string) =>
    new Date(d).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  if (p.startDate && p.endDate) {
    const from = month(p.startDate);
    const to = month(p.endDate);
    return from === to ? from : `${from} – ${to}`;
  }
  return p.startDate ? month(p.startDate) : p.endDate ? month(p.endDate) : '';
}

/*
 * Everything a role reads, across three bands - About, Academics and
 * Preferences - each on the batch it belongs to.
 *
 * This was one card of six fields, which was the whole problem: a company can
 * set a bar on eleven different numbers and the profile offered four of them,
 * so a student could be refused by a criterion they had no box to answer. The
 * fields are the job editor's, from the other side.
 *
 * Each band saves on its own and sends only what it holds - the API treats an
 * absent field as "not mentioned" - so a student fixing their phone number
 * does not rewrite their marks.
 */

/** The save button every band ends with, and the state behind it. */
function SaveRow({ busy, saved, error }: { busy: boolean; saved: boolean; error: string | null }) {
  const { t } = useT();
  return (
    <>
      {error && <p className="alert alert-error">{error}</p>}
      <div className="band-save">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? t('basics.saving') : saved ? t('basics.saved') : t('common.save')}
        </button>
      </div>
    </>
  );
}

/** Ticks the moment it saves, and stops saying so a couple of seconds later. */
function useSavedFlag() {
  const [saved, setSaved] = useState(false);
  return [saved, () => { setSaved(true); window.setTimeout(() => setSaved(false), 2000); }] as const;
}

/* --- Band 1: who they are ------------------------------------------------- */

function AboutBand({ profile, lists, onSaved }: CardProps) {
  const { t } = useT();
  const { busy, error, run } = useSaver(onSaved);
  const [saved, flag] = useSavedFlag();
  const [f, setF] = useState({
    phone: profile.phone ?? '',
    dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : '',
    gender: profile.gender ?? '',
    headline: profile.headline ?? '',
    about: profile.about ?? '',
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  const todo = [f.phone, f.gender, f.headline].filter((v) => !v).length;

  return (
    <Band title={t('band.about')} hint={t('band.aboutHint')} todo={todo}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await run(() =>
            candidateApi.saveBasics({
              ...f,
              // A date input gives a day; the API wants an instant.
              dateOfBirth: f.dateOfBirth ? new Date(f.dateOfBirth).toISOString() : '',
            }),
          );
          if (ok) flag();
        }}
        noValidate
      >
        <div className="grid">
          <label className="field">
            <span className="field-label">{t('basics.fullName')}</span>
            <input value={profile.fullName} readOnly disabled />
          </label>
          <label className="field">
            <span className="field-label">{t('basics.email')}</span>
            <input value={profile.email} readOnly disabled className="mono" />
          </label>
          <label className="field">
            <span className="field-label">{t('basics.phone')}</span>
            <input value={f.phone} onChange={set('phone')} placeholder={t('basics.phonePlaceholder')} disabled={busy} />
          </label>
          <label className="field">
            <span className="field-label">{t('basics.dob')}</span>
            <input type="date" value={f.dateOfBirth} onChange={set('dateOfBirth')} disabled={busy} />
          </label>
          <div className="field">
            <span className="field-label">{t('basics.gender')}</span>
            {/* A role may be open to one gender only, and this is the field
                that decides whether the student ever sees it. */}
            <Select
              options={lists?.genders ?? []}
              value={f.gender}
              onChange={(gender) => setF((p) => ({ ...p, gender }))}
              disabled={busy}
            />
            <span className="field-hint">{t('basics.genderHint')}</span>
          </div>
        </div>

        <label className="field">
          <span className="field-label">{t('basics.headline')}</span>
          <input value={f.headline} onChange={set('headline')} placeholder={t('basics.headlinePlaceholder')} disabled={busy} />
        </label>

        <label className="field">
          <span className="field-label">{t('basics.about')}</span>
          <textarea value={f.about} onChange={set('about')} rows={3} placeholder={t('basics.aboutPlaceholder')} disabled={busy} />
        </label>

        <SaveRow busy={busy} saved={saved} error={error} />
      </form>

      <OnRecord profile={profile} />
    </Band>
  );
}

/**
 * The numbers the college holds them by.
 *
 * A PRN, a roll number and a division are all typed in by somebody else,
 * during an import the student never sees, and all three appear on a hall
 * ticket, a result and every list a placement cell circulates. Showing them
 * is not a courtesy: it is the only chance a student gets to notice the digit
 * that was mistyped, and it is why this sits outside the form - nothing here
 * is theirs to correct, only to report.
 */
function OnRecord({ profile }: { profile: ProfileData }) {
  const { t } = useT();
  const rows: [string, string | null][] = [
    [t('record.prn'), profile.prn],
    [t('record.rollNo'), profile.batch?.rollNo ?? null],
    [t('record.division'), profile.batch?.division ?? null],
    [t('record.batch'), profile.batch?.name ?? null],
  ];
  const shown = rows.filter(([, v]) => v);
  if (shown.length === 0) return null;

  return (
    <>
      <hr className="band-rule" />
      <p className="field-label">{t('record.title')}</p>
      <dl className="record">
        {shown.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className="mono">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="field-hint">{t('record.hint')}</p>
    </>
  );
}

/* --- Band 2: what a marks bar reads --------------------------------------- */

function AcademicsBand({
  profile,
  locked,
  lists,
  programs,
  onSaved,
}: CardProps & { programs: StudentPrograms | null }) {
  const { t } = useT();
  const { busy, error, run } = useSaver(onSaved);
  const [saved, flag] = useSavedFlag();
  const [f, setF] = useState({
    course: profile.course ?? profile.batch?.course ?? '',
    specialisation: profile.specialisation ?? '',
    graduationYear: str(profile.graduationYear),
    cgpa: str(profile.cgpa),
    degreePct: str(profile.degreePct),
    tenthPct: str(profile.tenthPct),
    twelfthPct: str(profile.twelfthPct),
    diplomaPct: str(profile.diplomaPct),
    pgCgpa: str(profile.pgCgpa),
    pgPct: str(profile.pgPct),
    backlogs: str(profile.backlogs),
    activeBacklogs: str(profile.activeBacklogs),
    gapYears: str(profile.gapYears),
    isLateralEntry: profile.isLateralEntry,
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  /*
   * The courses to offer, and whether anything else may be typed.
   *
   * Their college's programmes when it has mapped any, the university's when
   * it has not, and only then the whole platform catalogue. The first two are
   * somebody's deliberate selection, so the list is closed: a course the
   * college does not run is a course that fails every role's criterion, and a
   * free-text box is how a student gets there without being told.
   */
  const offered: { name: string; branches: { name: string }[] }[] =
    programs?.courses ??
    // The catalogue states branches as bare names; the same shape, so one
    // reader below serves whichever list arrived.
    (lists?.courses ?? []).map((c) => ({ name: c.name, branches: c.branches.map((name) => ({ name })) }));
  const closed = programs !== null && programs.source !== 'catalogue';

  /* Branches of the course they picked, or every loose one if it is not on
     the list - a student on an unlisted course still has a branch. */
  const branches = useMemo(() => {
    const course = offered.find((c) => c.name === f.course);
    if (course && course.branches.length > 0) return course.branches.map((b) => b.name);
    // A closed list offers nothing rather than everything: the branches of
    // some other college's course are not this student's answer.
    return closed ? [] : (lists?.looseBranches ?? []);
  }, [offered, closed, lists, f.course]);

  const isPg = PG_COURSES.test(f.course);
  const todo = [f.course, f.specialisation, f.graduationYear, f.cgpa || f.degreePct, f.tenthPct, f.twelfthPct]
    .filter((v) => !v).length;

  return (
    <Band title={t('band.academics')} hint={t('band.academicsHint')} todo={todo}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await run(() =>
            candidateApi.saveBasics({
              // Off the roster once the college has verified it, so it is not
              // restated here - a field nobody can edit should not be posted
              // back as though they had.
              ...(locked ? {} : { course: f.course, specialisation: f.specialisation }),
              graduationYear: num(f.graduationYear),
              cgpa: num(f.cgpa),
              degreePct: num(f.degreePct),
              tenthPct: num(f.tenthPct),
              twelfthPct: num(f.twelfthPct),
              // Only sent when the question was asked, so a student who is
              // not a lateral entrant never stores a diploma mark.
              ...(f.isLateralEntry ? { diplomaPct: num(f.diplomaPct) } : {}),
              ...(isPg ? { pgCgpa: num(f.pgCgpa), pgPct: num(f.pgPct) } : {}),
              backlogs: num(f.backlogs),
              activeBacklogs: num(f.activeBacklogs),
              gapYears: num(f.gapYears),
              isLateralEntry: f.isLateralEntry,
            }),
          );
          if (ok) flag();
        }}
        noValidate
      >
        <div className="grid">
          <div className="field">
            <span className="field-label">{t('acad.course')}</span>
            {/* Locked with the marks once the college has verified them: the
                course is off the same roster, and it is what a role's course
                criterion and the college's own reports both read. */}
            <Select
              options={offered.map((c) => c.name)}
              value={f.course}
              onChange={(course) => setF((p) => ({ ...p, course, specialisation: '' }))}
              otherLabel={closed ? undefined : t('common.otherEnter')}
              disabled={locked || busy}
            />
            {/* Why it cannot be changed, said where it cannot be changed -
                a greyed-out box with no reason reads as a broken one. */}
            {locked ? (
              <span className="field-hint">{t('acad.courseLocked')}</span>
            ) : (
              closed && <span className="field-hint">{t('acad.courseFromCollege')}</span>
            )}
          </div>
          <div className="field">
            <span className="field-label">{t('acad.branch')}</span>
            <Select
              options={branches}
              value={f.specialisation}
              onChange={(specialisation) => setF((p) => ({ ...p, specialisation }))}
              otherLabel={closed ? undefined : t('common.otherEnter')}
              disabled={locked || busy}
            />
            {closed && f.course && branches.length === 0 && (
              <span className="field-hint">{t('acad.branchNone')}</span>
            )}
          </div>
          <label className="field">
            <span className="field-label">{t('basics.gradYear')}</span>
            <input
              type="number"
              value={f.graduationYear}
              onChange={set('graduationYear')}
              placeholder={String(new Date().getFullYear() + 1)}
              disabled={locked || busy}
            />
          </label>
        </div>

        <p className="band-note">{t('acad.marksNote')}</p>

        <div className="grid">
          <label className="field">
            <span className="field-label">{t('acad.cgpa')}</span>
            <input type="number" step="0.01" max="10" value={f.cgpa} onChange={set('cgpa')} disabled={locked || busy} />
          </label>
          <label className="field">
            <span className="field-label">{t('acad.degreePct')}</span>
            <input type="number" step="0.01" max="100" value={f.degreePct} onChange={set('degreePct')} disabled={busy} />
          </label>
          <label className="field">
            <span className="field-label">{t('acad.tenth')}</span>
            <input type="number" step="0.01" max="100" value={f.tenthPct} onChange={set('tenthPct')} disabled={locked || busy} />
          </label>
          <label className="field">
            <span className="field-label">{t('acad.twelfth')}</span>
            <input type="number" step="0.01" max="100" value={f.twelfthPct} onChange={set('twelfthPct')} disabled={locked || busy} />
          </label>
        </div>

        {locked && <p className="field-hint">{t('basics.gradYearLocked')}</p>}

        {/* Asked, then answered. A lateral entrant has no 12th standard mark,
            and a role that sets a 12th bar would exclude everybody it just
            invited if there were nowhere to put the diploma instead. */}
        <label className="check is-inline">
          <input
            type="checkbox"
            checked={f.isLateralEntry}
            disabled={busy}
            onChange={(e) => setF((p) => ({ ...p, isLateralEntry: e.target.checked }))}
          />
          <span>{t('acad.lateral')}</span>
        </label>

        {f.isLateralEntry && (
          <label className="field is-revealed">
            <span className="field-label">{t('acad.diploma')}</span>
            <input type="number" step="0.01" max="100" value={f.diplomaPct} onChange={set('diplomaPct')} disabled={busy} />
          </label>
        )}

        {isPg && (
          <div className="grid is-revealed">
            <label className="field">
              <span className="field-label">{t('acad.pgCgpa')}</span>
              <input type="number" step="0.01" max="10" value={f.pgCgpa} onChange={set('pgCgpa')} disabled={busy} />
            </label>
            <label className="field">
              <span className="field-label">{t('acad.pgPct')}</span>
              <input type="number" step="0.01" max="100" value={f.pgPct} onChange={set('pgPct')} disabled={busy} />
            </label>
          </div>
        )}

        <div className="grid">
          <label className="field">
            <span className="field-label">{t('acad.backlogs')}</span>
            <input type="number" min="0" value={f.backlogs} onChange={set('backlogs')} disabled={locked || busy} />
          </label>
          <label className="field">
            <span className="field-label">{t('acad.activeBacklogs')}</span>
            <input type="number" min="0" value={f.activeBacklogs} onChange={set('activeBacklogs')} disabled={busy} />
            <span className="field-hint">{t('acad.activeHint')}</span>
          </label>
          <label className="field">
            <span className="field-label">{t('acad.gapYears')}</span>
            <input type="number" min="0" value={f.gapYears} onChange={set('gapYears')} disabled={busy} />
          </label>
        </div>

        <SaveRow busy={busy} saved={saved} error={error} />
      </form>
    </Band>
  );
}

/* --- Band 3: what they will take, and what they need ---------------------- */

function AccessBand({ profile, lists, onSaved }: CardProps) {
  const { t } = useT();
  const { busy, error, run } = useSaver(onSaved);
  const [saved, flag] = useSavedFlag();
  const [f, setF] = useState({
    openToRelocate: profile.openToRelocate,
    openToNightShift: profile.openToNightShift,
    openToTravel: profile.openToTravel ?? '',
    isPwd: profile.isPwd,
    pwdCategories: profile.pwdCategories ?? [],
    pwdPct: str(profile.pwdPct),
    accommodations: profile.accommodations ?? [],
  });

  const todo = [f.openToRelocate, f.openToNightShift].filter((v) => v === null).length + (f.openToTravel ? 0 : 1);

  return (
    <Band title={t('band.access')} hint={t('band.accessHint')} todo={todo}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await run(() =>
            candidateApi.saveBasics({
              openToRelocate: f.openToRelocate ?? undefined,
              openToNightShift: f.openToNightShift ?? undefined,
              openToTravel: f.openToTravel,
              isPwd: f.isPwd,
              // Cleared rather than kept when the declaration is withdrawn -
              // leaving the detail behind would be holding it without one.
              pwdCategories: f.isPwd ? f.pwdCategories : [],
              ...(f.isPwd ? { pwdPct: num(f.pwdPct) } : {}),
              accommodations: f.isPwd ? f.accommodations : [],
            }),
          );
          if (ok) flag();
        }}
        noValidate
      >
        <div className="grid">
          <Tri
            label={t('pref.relocate')}
            value={f.openToRelocate}
            onChange={(openToRelocate) => setF((p) => ({ ...p, openToRelocate }))}
            disabled={busy}
          />
          <Tri
            label={t('pref.nightShift')}
            value={f.openToNightShift}
            onChange={(openToNightShift) => setF((p) => ({ ...p, openToNightShift }))}
            disabled={busy}
          />
          <div className="field">
            <span className="field-label">{t('pref.travel')}</span>
            <Select
              options={lists?.travel ?? []}
              value={f.openToTravel}
              onChange={(openToTravel) => setF((p) => ({ ...p, openToTravel }))}
              disabled={busy}
            />
          </div>
        </div>

        <hr className="band-rule" />

        {/* Optional, and said so before it is asked. Nothing here narrows what
            a student can apply to; it only lets a role that was written for
            them reach them, and a company see that its support was needed. */}
        <label className="check is-inline">
          <input
            type="checkbox"
            checked={f.isPwd}
            disabled={busy}
            onChange={(e) => setF((p) => ({ ...p, isPwd: e.target.checked }))}
          />
          <span>{t('pwd.declare')}</span>
        </label>
        <p className="field-hint">{t('pwd.why')}</p>

        {f.isPwd && (
          <div className="is-revealed">
            <p className="field-label">{t('pwd.categories')}</p>
            <KeyChecks
              items={lists?.pwdCategories ?? []}
              chosen={f.pwdCategories}
              onChange={(pwdCategories) => setF((p) => ({ ...p, pwdCategories }))}
              disabled={busy}
            />

            <label className="field is-narrow">
              <span className="field-label">{t('pwd.pct')}</span>
              <input
                type="number"
                min="0"
                max="100"
                value={f.pwdPct}
                onChange={(e) => setF((p) => ({ ...p, pwdPct: e.target.value }))}
                disabled={busy}
              />
              <span className="field-hint">{t('pwd.pctHint')}</span>
            </label>

            <p className="field-label">{t('pwd.support')}</p>
            <KeyChecks
              items={lists?.accommodations ?? []}
              chosen={f.accommodations}
              onChange={(accommodations) => setF((p) => ({ ...p, accommodations }))}
              disabled={busy}
            />
          </div>
        )}

        <SaveRow busy={busy} saved={saved} error={error} />
      </form>
    </Band>
  );
}
function SkillsCard({ profile, lists, onSaved }: OwnCardProps) {
  const { t } = useT();
  const { busy, error, run } = useSaver(onSaved);
  const [draft, setDraft] = useState('');

  const mine = profile.skills;
  const has = (name: string) => mine.some((s) => s.toLowerCase() === name.toLowerCase());

  function save(next: string[]) {
    return run(() => candidateApi.saveSkills(next));
  }

  async function addOne(name: string) {
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!clean || has(clean)) return;
    if (await save([...mine, clean])) setDraft('');
  }

  function remove(skill: string) {
    void save(mine.filter((s) => s !== skill));
  }

  /*
   * What the portal already knows, minus what they already have.
   *
   * Offered rather than typed because a skill is only useful when it is the
   * same row on both sides: a student's "Node.js" and a role asking for
   * "Node.js" meet, and a freshly typed "NodeJS" beside it would match
   * nobody. Typing is still allowed - a student knows what they learnt
   * better than the catalogue does - and the server folds it into an
   * existing skill when one already answers to that name.
   */
  const typed = draft.trim().toLowerCase();
  const offered = (lists?.skills ?? []).filter((s) => !has(s));
  const matches = typed ? offered.filter((s) => s.toLowerCase().includes(typed)) : offered;
  const exact = (lists?.skills ?? []).some((s) => s.toLowerCase() === typed);
  const canInvent = typed.length > 0 && !exact && !has(draft);

  return (
    <section className="card">
      <h2>{t('skills.title')}</h2>
      <p className="muted">{t('skills.lede')}</p>
      {error && <p className="alert alert-error">{error}</p>}

      {mine.length === 0 ? (
        <p className="muted">{t('skills.empty')}</p>
      ) : (
        <div className="chip-row">
          {mine.map((sk) => (
            <span key={sk} className="chip">
              {sk}
              <button
                type="button"
                onClick={() => remove(sk)}
                aria-label={t('skills.removeOne', { skill: sk })}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          // Enter takes the one obvious match before inventing anything.
          void addOne(matches.length === 1 ? matches[0]! : draft);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('skills.search')}
          disabled={busy}
        />
        {canInvent && (
          <button type="submit" className="btn btn-secondary" disabled={busy}>
            {t('skills.addNew', { skill: draft.trim() })}
          </button>
        )}
      </form>

      {/* The shared list, narrowed as they type. */}
      {matches.length > 0 ? (
        <div className="chip-row">
          {matches.slice(0, 24).map((sk) => (
            <button
              key={sk}
              type="button"
              className="skill-add"
              disabled={busy}
              onClick={() => void addOne(sk)}
            >
              + {sk}
            </button>
          ))}
        </div>
      ) : (
        lists && !canInvent && <p className="muted">{t('skills.noneLeft')}</p>
      )}
    </section>
  );
}

/** A section that lists rows and can add or delete them. */
function ListCard({
  title,
  empty,
  error,
  children,
  form,
}: {
  title: string;
  empty: string;
  error: string | null;
  children: ReactNode;
  form: ReactNode;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);

  return (
    <section className="card">
      <div className="card-head">
        <h2>{title}</h2>
        <button type="button" className="link-btn" onClick={() => setOpen((v) => !v)}>
          {open ? t('common.cancel') : t('list.add')}
        </button>
      </div>
      {error && <p className="alert alert-error">{error}</p>}
      {open && <div className="sub-form">{form}</div>}
      {children ?? <p className="muted">{empty}</p>}
    </section>
  );
}

/**
 * What a student finished before their degree.
 *
 * The degree list on its own could not say it: the first two rows anybody
 * adds are their 10th and 12th, and neither is a course a university runs.
 * Fixed here rather than kept in Setup for the same reason the RPwD groups
 * are - these are the qualifications the Indian school system awards, not a
 * list any one university gets to edit.
 */
const SCHOOL_QUALIFICATIONS = [
  'Secondary (10th / SSC)',
  'Higher Secondary (12th / HSC)',
  'Diploma',
];

const BLANK_EDUCATION = {
  degree: '',
  institution: '',
  board: '',
  startYear: '',
  endYear: '',
  cgpa: '',
  percentage: '',
};

function EducationCard({ profile, lists, onSaved }: OwnCardProps) {
  const { t } = useT();
  const { busy, error, run } = useSaver(onSaved);
  const [f, setF] = useState(BLANK_EDUCATION);
  /*
   * Which college-entered row they just tried to remove.
   *
   * The button stays where it is and answers instead of disappearing: a row
   * that quietly has no Remove where every other row has one reads as a bug,
   * and the student is left guessing. The server refuses it too - this is
   * the explanation, not the enforcement.
   */
  const [refused, setRefused] = useState<string | null>(null);

  // A school row has a board; a degree has a university, which the college
  // field already names. Asked only where it is a real question.
  const isSchool = SCHOOL_QUALIFICATIONS.includes(f.degree);

  return (
    <ListCard
      title={t('education.title')}
      empty={t('education.empty')}
      error={error}
      form={
        <form
          className="form-row"
          onSubmit={async (e) => {
            e.preventDefault();
            await run(() =>
              candidateApi.addEducation({
                degree: f.degree,
                institution: f.institution,
                ...(isSchool ? { board: f.board } : {}),
                startYear: Number(f.startYear),
                endYear: f.endYear ? Number(f.endYear) : undefined,
                cgpa: f.cgpa ? Number(f.cgpa) : undefined,
                percentage: f.percentage ? Number(f.percentage) : undefined,
              }),
            );
            setF(BLANK_EDUCATION);
          }}
        >
          <div className="field">
            <span className="field-label">{t('education.degree')}</span>
            {/* School first, because that is the row a student adds first and
                the one the degree catalogue could never offer. */}
            <Select
              options={[...SCHOOL_QUALIFICATIONS, ...(lists?.courses ?? []).map((c) => c.name)]}
              value={f.degree}
              onChange={(degree) => setF({ ...f, degree })}
              otherLabel={t('common.otherEnter')}
              required
            />
          </div>
          <div className="field">
            <span className="field-label">{t('education.college')}</span>
            {/* Their own university's colleges, their own first. A school is
                on nobody's roll, so the list ends in a box to type one. */}
            <Select
              options={[
                ...(profile.batch?.college ? [profile.batch.college] : []),
                ...(lists?.colleges ?? []).filter((c) => c !== profile.batch?.college),
              ]}
              value={f.institution}
              onChange={(institution) => setF({ ...f, institution })}
              otherLabel={t('education.collegeOther')}
              required
            />
          </div>
          {isSchool && (
            <label className="field">
              <span className="field-label">{t('education.board')}</span>
              <input
                value={f.board}
                onChange={(e) => setF({ ...f, board: e.target.value })}
                placeholder={t('education.boardPlaceholder')}
              />
            </label>
          )}
          <label className="field">
            <span className="field-label">{t('education.started')}</span>
            <input
              type="number"
              value={f.startYear}
              onChange={(e) => setF({ ...f, startYear: e.target.value })}
              placeholder={String(new Date().getFullYear() - 3)}
              required
            />
          </label>
          <label className="field">
            <span className="field-label">{t('education.finished')}</span>
            <input
              type="number"
              value={f.endYear}
              onChange={(e) => setF({ ...f, endYear: e.target.value })}
              placeholder={String(new Date().getFullYear() + 1)}
            />
            <span className="field-hint">{t('education.finishedHint')}</span>
          </label>
          {/* Both, because Indian boards and universities are split between
              them and converting one into the other needs a factor that
              differs by university. A guessed number is worse than none. */}
          <label className="field">
            <span className="field-label">CGPA</span>
            <input
              type="number"
              step="0.01"
              max="10"
              value={f.cgpa}
              onChange={(e) => setF({ ...f, cgpa: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field-label">{t('education.percentage')}</span>
            <input
              type="number"
              step="0.01"
              max="100"
              value={f.percentage}
              onChange={(e) => setF({ ...f, percentage: e.target.value })}
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {t('common.add')}
          </button>
        </form>
      }
    >
      {profile.educations.length > 0 ? (
        <ul className="entry-list">
          {profile.educations.map((ed) => {
            const theirs = ed.source === 'COLLEGE';
            return (
              <li key={ed.id}>
                <div>
                  <b>{ed.degree}</b>
                  {theirs && <span className="pill entry-pill">{t('education.fromCollege')}</span>}
                  <span className="entry-meta">
                    {ed.institution}
                    {ed.board ? ` · ${ed.board}` : ''} · {ed.startYear}–
                    {ed.endYear ?? t('common.present')}
                    {ed.cgpa ? ` · CGPA ${ed.cgpa}` : ''}
                    {ed.percentage ? ` · ${ed.percentage}%` : ''}
                  </span>
                  {refused === ed.id && (
                    <span className="entry-locked">{t('education.cannotRemove')}</span>
                  )}
                </div>
                <button
                  type="button"
                  className={`link-btn ${theirs ? 'is-locked' : 'is-danger'}`}
                  aria-disabled={theirs}
                  onClick={() =>
                    theirs
                      ? setRefused(refused === ed.id ? null : ed.id)
                      : run(() => candidateApi.removeEducation(ed.id))
                  }
                >
                  {t('common.remove')}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </ListCard>
  );
}

function ExperienceCard({ profile, lists, onSaved }: OwnCardProps) {
  const { t } = useT();
  const { busy, error, run } = useSaver(onSaved);
  const blank = { title: '', organisation: '', location: '', startDate: '', endDate: '', description: '' };
  const [f, setF] = useState(blank);

  return (
    <ListCard
      title={t('experience.title')}
      empty={t('experience.empty')}
      error={error}
      form={
        <form
          className="form-row"
          onSubmit={async (e) => {
            e.preventDefault();
            await run(() =>
              candidateApi.addExperience({
                title: f.title,
                organisation: f.organisation,
                location: f.location,
                startDate: new Date(f.startDate).toISOString(),
                endDate: f.endDate ? new Date(f.endDate).toISOString() : '',
                isCurrent: !f.endDate,
                description: f.description,
              }),
            );
            setF(blank);
          }}
        >
          <label className="field">
            <span className="field-label">{t('experience.role')}</span>
            <input
              value={f.title}
              onChange={(e) => setF({ ...f, title: e.target.value })}
              required
              placeholder="Backend intern"
            />
          </label>
          <label className="field">
            <span className="field-label">{t('experience.organisation')}</span>
            <input
              value={f.organisation}
              onChange={(e) => setF({ ...f, organisation: e.target.value })}
              placeholder={t('experience.organisationPlaceholder')}
              required
            />
          </label>
          <div className="field">
            <span className="field-label">{t('experience.location')}</span>
            {/* The cities operations keeps, and anywhere else typed - a first
                job is often in a town nobody has entered yet. */}
            <Select
              options={lists?.cities ?? []}
              value={f.location}
              onChange={(location) => setF({ ...f, location })}
              otherLabel={t('common.otherEnter')}
            />
          </div>
          <label className="field">
            <span className="field-label">{t('experience.started')}</span>
            <input
              type="date"
              value={f.startDate}
              onChange={(e) => setF({ ...f, startDate: e.target.value })}
              required
            />
          </label>
          <label className="field">
            <span className="field-label">{t('experience.finished')}</span>
            <input
              type="date"
              value={f.endDate}
              onChange={(e) => setF({ ...f, endDate: e.target.value })}
            />
            <span className="field-hint">{t('experience.finishedHint')}</span>
          </label>
          {/* What they actually did. Without it an internship on a resume is
              a company name and two dates, which is the line a recruiter
              skips. The builder prints this under the row. */}
          <label className="field is-wide">
            <span className="field-label">{t('experience.description')}</span>
            <textarea
              rows={2}
              value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })}
              placeholder={t('experience.descriptionPlaceholder')}
              maxLength={2000}
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {t('common.add')}
          </button>
        </form>
      }
    >
      {profile.experiences.length > 0 ? (
        <ul className="entry-list">
          {profile.experiences.map((ex) => (
            <li key={ex.id}>
              <div>
                <b>{ex.title}</b>
                <span className="entry-meta">
                  {ex.organisation} · {new Date(ex.startDate).getFullYear()}–
                  {ex.isCurrent || !ex.endDate ? t('common.present') : new Date(ex.endDate).getFullYear()}
                </span>
                {ex.description && <span className="entry-meta">{ex.description}</span>}
              </div>
              <button
                  type="button"
                  className="link-btn is-danger"
                  onClick={() => run(() => candidateApi.removeExperience(ex.id))}
                >
                  {t('common.remove')}
                </button>
            </li>
          ))}
        </ul>
      ) : null}
    </ListCard>
  );
}

function ProjectsCard({ profile, onSaved }: OwnCardProps) {
  const { t } = useT();
  const { busy, error, run } = useSaver(onSaved);
  const blank = { title: '', description: '', startDate: '', endDate: '' };
  const [f, setF] = useState(blank);

  /*
   * The links start as one empty row rather than none.
   *
   * A project with nowhere to look at it is the common case this section
   * exists to stop, so the first box is already there to be filled in; the
   * rest are added when there is something to put in them.
   */
  const [links, setLinks] = useState<ProjectLink[]>([{ url: '', label: '' }]);

  const setLink = (i: number, patch: Partial<ProjectLink>) =>
    setLinks((prev) => prev.map((l, k) => (k === i ? { ...l, ...patch } : l)));

  function reset() {
    setF(blank);
    setLinks([{ url: '', label: '' }]);
  }

  return (
    <ListCard
      title={t('projects.title')}
      empty={t('projects.empty')}
      error={error}
      form={
        <form
          className="form-row"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await run(() =>
              candidateApi.addProject({
                ...f,
                // A month input gives a month; the API wants an instant. The
                // first of it, since nobody dates a project to the day.
                startDate: monthStart(f.startDate),
                endDate: monthStart(f.endDate),
                // Empty rows are not links; a label nobody typed is dropped.
                links: links
                  .filter((l) => l.url.trim())
                  .map((l) => ({ url: l.url.trim(), label: l.label?.trim() || undefined })),
              }),
            );
            if (ok) reset();
          }}
        >
          <label className="field">
            <span className="field-label">{t('projects.name')}</span>
            <input
              value={f.title}
              onChange={(e) => setF({ ...f, title: e.target.value })}
              placeholder={t('projects.namePlaceholder')}
              required
            />
          </label>
          <label className="field">
            <span className="field-label">{t('projects.description')}</span>
            <input
              value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })}
              placeholder={t('projects.descriptionPlaceholder')}
            />
          </label>

          {/* When, so a reader can tell last month's work from first year's.
              Months rather than days: nobody remembers the day, and the
              resume prints the month anyway. */}
          <label className="field">
            <span className="field-label">{t('projects.started')}</span>
            <input
              type="month"
              value={f.startDate}
              onChange={(e) => setF({ ...f, startDate: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field-label">{t('projects.finished')}</span>
            <input
              type="month"
              value={f.endDate}
              onChange={(e) => setF({ ...f, endDate: e.target.value })}
            />
            <span className="field-hint">{t('projects.finishedHint')}</span>
          </label>

          <div className="field proj-links">
            <span className="field-label">{t('projects.links')}</span>
            {links.map((l, i) => (
              <div className="proj-link-row" key={i}>
                <input
                  value={l.url}
                  onChange={(e) => setLink(i, { url: e.target.value })}
                  placeholder="https://github.com/…"
                  aria-label={t('projects.linkUrl', { n: i + 1 })}
                />
                <input
                  className="proj-link-label"
                  value={l.label ?? ''}
                  onChange={(e) => setLink(i, { label: e.target.value })}
                  placeholder={t('projects.linkLabelPlaceholder')}
                  aria-label={t('projects.linkLabel', { n: i + 1 })}
                />
                <button
                  type="button"
                  className="link-btn is-danger"
                  onClick={() => setLinks(links.filter((_, k) => k !== i))}
                  disabled={links.length === 1}
                  aria-label={t('projects.removeLink', { n: i + 1 })}
                >
                  ×
                </button>
              </div>
            ))}
            {links.length < MAX_PROJECT_LINKS && (
              <button
                type="button"
                className="link-btn"
                onClick={() => setLinks([...links, { url: '', label: '' }])}
              >
                {t('projects.addLink')}
              </button>
            )}
          </div>

          <button type="submit" className="btn btn-primary" disabled={busy}>
            {t('common.add')}
          </button>
        </form>
      }
    >
      {profile.projects.length > 0 ? (
        <ul className="entry-list">
          {profile.projects.map((p) => (
            <li key={p.id}>
              <div>
                <b>{p.title}</b>
                {projectWhen(p) && <span className="entry-meta">{projectWhen(p)}</span>}
                {p.description && <span className="entry-meta">{p.description}</span>}
                {p.links.length > 0 && (
                  <span className="proj-link-list">
                    {p.links.map((l) => (
                      <a
                        key={l.url}
                        className="entry-link"
                        href={l.url}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        {l.label || l.url}
                      </a>
                    ))}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="link-btn is-danger"
                onClick={() => run(() => candidateApi.removeProject(p.id))}
              >
                {t('common.remove')}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </ListCard>
  );
}
