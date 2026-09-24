import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { communityApi, type MyShowcase, type ShowcaseVisibility } from '../../api/community';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import './Stories.css';
import './Showcase.css';

const VISIBILITY: { value: ShowcaseVisibility; title: string; body: string }[] = [
  { value: 'PRIVATE', title: 'Only me', body: 'Nobody else sees your showcase.' },
  { value: 'COLLEGE', title: 'My college', body: 'Your placement cell can see it. Recruiters cannot.' },
  {
    value: 'RECRUITERS',
    title: 'Verified recruiters',
    body: 'Verified companies can find you and invite you to apply. They never see your phone or email.',
  },
];

const when = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/**
 * The student's showcase: a short pitch, their best work, and who may see it.
 *
 * It exists for the student whose work is strong but who does not interview
 * loudly - a recruiter can find the work and invite them, rather than the
 * student having to find every recruiter. Being findable needs two yeses, the
 * switch here and the consent on the privacy page, and the screen says so.
 *
 * It sits inside the profile rather than on a page of its own, because it is
 * the same record seen from the recruiter's side: the pitch is about the
 * person the profile describes, and the projects it pins are the projects the
 * profile holds. On its own it was a switch nobody found, which is the whole
 * reason a company's talent search looked empty.
 */
export function ShowcasePanel() {
  const { hasModule } = useAuth();
  const enabled = hasModule('showcase.student');
  const [data, setData] = useState<MyShowcase | null>(null);
  const [draft, setDraft] = useState<MyShowcase['profile'] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [needsConsent, setNeedsConsent] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    communityApi
      .showcase()
      .then((d) => {
        setData(d);
        setDraft(d.profile);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load your showcase.'));
  }, [enabled]);

  function set<K extends keyof MyShowcase['profile']>(k: K, v: MyShowcase['profile'][K]) {
    setDraft((d) => d && { ...d, [k]: v });
    setSaved(false);
    setNeedsConsent(false);
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const next = await communityApi.saveShowcase(draft);
      setData(next);
      setDraft(next.profile);
      setSaved(true);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'CONSENT_REQUIRED') setNeedsConsent(true);
      else setError(e instanceof ApiError ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  async function respond(id: string, action: 'SEEN' | 'DECLINED') {
    try {
      setData(await communityApi.respond(id, action));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save that.');
    }
  }

  if (!enabled) {
    return <p className="muted">Your institution has not switched on the student showcase yet.</p>;
  }

  const changed = data && draft && JSON.stringify(data.profile) !== JSON.stringify(draft);
  const pinnedProjects = (draft?.pinned ?? [])
    .map((id) => data?.projects.find((p) => p.id === id))
    .filter(Boolean) as MyShowcase['projects'];
  const open = data?.invites.filter((i) => i.status === 'SENT' || i.status === 'SEEN') ?? [];

  return (
    <>
      {error && <p className="alert alert-error">{error}</p>}

      {open.length > 0 && (
        <section className="card sc-invites">
          <h2>
            {open.length} invitation{open.length === 1 ? '' : 's'} to apply
          </h2>
          <ul>
            {open.map((i) => (
              <li key={i.id}>
                <div>
                  <strong>{i.company.name}</strong>
                  {i.jobTitle && <span> · {i.jobTitle}</span>}
                  <small> · {when(i.createdAt)}</small>
                  <p>{i.message}</p>
                </div>
                <span className="sc-invite-actions">
                  {i.jobId && (
                    <Link to={`/student/jobs/${i.jobId}`} className="btn btn-primary" onClick={() => respond(i.id, 'SEEN')}>
                      See the role
                    </Link>
                  )}
                  <button type="button" className="btn btn-ghost" onClick={() => respond(i.id, 'DECLINED')}>
                    Not for me
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {draft && data && (
        <div className="sc-layout">
          <section className="card sc-edit">
            <label className="field sc-field">
              <span className="field-label">Your pitch</span>
              <textarea
                className="st-input"
                rows={4}
                maxLength={600}
                value={draft.pitch}
                onChange={(e) => set('pitch', e.target.value)}
                placeholder="Who you are, what you are good at, what you want to do next - in three or four lines."
              />
              <span className="field-hint">{600 - draft.pitch.length} characters left</span>
            </label>

            <label className="field sc-field">
              <span className="field-label">
                Video introduction <span className="muted">optional</span>
              </span>
              <input
                className="st-input"
                value={draft.videoUrl}
                onChange={(e) => set('videoUrl', e.target.value.trim())}
                placeholder="https://… (a 60-second video on YouTube or Drive)"
              />
            </label>

            <div className="field sc-field">
              <span className="field-label">Pin up to three projects</span>
              {data.projects.length === 0 ? (
                <p className="muted">
                  Add projects on <Link to="/student/profile">your profile</Link> first, then pin the best ones here.
                </p>
              ) : (
                <div className="sc-projects">
                  {data.projects.map((p) => {
                    const on = draft.pinned.includes(p.id);
                    const full = !on && draft.pinned.length >= 3;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`sc-project ${on ? 'is-on' : ''}`}
                        aria-pressed={on}
                        disabled={full}
                        onClick={() => set('pinned', on ? draft.pinned.filter((x) => x !== p.id) : [...draft.pinned, p.id])}
                      >
                        <strong>{p.title}</strong>
                        {p.description && <span>{p.description.slice(0, 90)}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="field sc-field">
              <span className="field-label">Who can see it</span>
              <div className="sc-vis" role="radiogroup" aria-label="Who can see your showcase">
                {VISIBILITY.map((v) => (
                  <button
                    key={v.value}
                    type="button"
                    role="radio"
                    aria-checked={draft.visibility === v.value}
                    className={`sc-vis-opt ${draft.visibility === v.value ? 'is-on' : ''}`}
                    onClick={() => set('visibility', v.value)}
                  >
                    <strong>{v.title}</strong>
                    <span>{v.body}</span>
                  </button>
                ))}
              </div>
              {draft.visibility === 'RECRUITERS' && !data.consentGranted && (
                <p className="alert alert-warn">
                  Recruiters can only find you once you allow it in your privacy choices.{' '}
                  <Link to="/student/privacy">Open privacy choices →</Link>
                </p>
              )}
            </div>

            {needsConsent && (
              <p className="alert alert-warn">
                Allow “Let verified recruiters find my profile” first, then save again.{' '}
                <Link to="/student/privacy">Open privacy choices →</Link>
              </p>
            )}

            <div className="btn-row">
              {saved && !changed && <span className="muted">Saved.</span>}
              <button type="button" className="btn btn-primary" onClick={save} disabled={busy || !changed}>
                {busy ? 'Saving…' : 'Save showcase'}
              </button>
            </div>
          </section>

          <aside className="sc-preview" aria-label="What a recruiter sees">
            <p className="sc-preview-label">What a recruiter sees</p>
            <div className="sc-preview-card">
              <p className="sc-preview-pitch">{draft.pitch || <span className="muted">Your pitch appears here.</span>}</p>
              {draft.videoUrl && <p className="muted">▶ Video introduction</p>}
              {pinnedProjects.length > 0 && (
                <ul>
                  {pinnedProjects.map((p) => (
                    <li key={p.id}>{p.title}</li>
                  ))}
                </ul>
              )}
              <p className="sc-preview-note">
                Also shown: your name, college, course, skills and whether your college verified your record. Never your
                phone or email.
              </p>
            </div>
            <p className="sc-status">
              {draft.visibility !== 'RECRUITERS'
                ? 'Recruiters cannot find you.'
                : data.consentGranted
                  ? 'Verified recruiters can find you.'
                  : 'Recruiters cannot find you yet - consent needed.'}
            </p>
          </aside>
        </div>
      )}
    </>
  );
}

/**
 * Where the profile says whether a recruiter can find this person.
 *
 * One line, at the foot of the profile, because that is where somebody is
 * already thinking about how they look to a company. It states the answer
 * either way: a student who has not switched it on should learn that from
 * their profile rather than from never hearing from anybody.
 */
export function ShowcaseStatus() {
  const { hasModule } = useAuth();
  const enabled = hasModule('showcase.student');
  const [data, setData] = useState<MyShowcase | null>(null);

  useEffect(() => {
    if (!enabled) return;
    communityApi
      .showcase()
      .then(setData)
      .catch(() => setData(null));
  }, [enabled]);

  if (!enabled || !data) return null;

  const findable = data.profile.visibility === 'RECRUITERS' && data.consentGranted;
  const waiting = data.profile.visibility === 'RECRUITERS' && !data.consentGranted;
  const open = data.invites.filter((i) => i.status === 'SENT' || i.status === 'SEEN').length;

  return (
    <section className={`card sc-find ${findable ? 'is-on' : ''}`}>
      <div>
        <h2>Can a recruiter find you?</h2>
        <p className="muted">
          {findable
            ? 'Yes - verified companies can see your showcase and invite you to apply.'
            : waiting
              ? 'Not yet. Your showcase is set to recruiters, but the consent for it is still off.'
              : 'No. Your showcase is not open to recruiters, so companies browsing for students will not see you.'}
          {open > 0 && ` You have ${open} invitation${open === 1 ? '' : 's'} waiting.`}
        </p>
      </div>
      <Link className="btn btn-secondary" to="/student/showcase">
        {findable ? 'Edit your showcase' : 'Open your showcase'}
      </Link>
    </section>
  );
}
