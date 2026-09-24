import { useEffect, useState, type FormEvent } from 'react';
import AdminLayout from './AdminLayout';
import { ApiError } from '../../api/client';
import { noticesApi, type AdminNotice } from '../../api/notices';
import './Notices.css';

/**
 * Posting a notice, and the record of the ones already posted.
 *
 * The whole form is one question with a second half: what do you want to say,
 * and who is it for. The audience is three checkboxes rather than a dropdown
 * of the seven combinations, because "students and companies but not the
 * cells" is a thing somebody will want and a list of named combinations is a
 * list somebody has to read.
 *
 * Nothing here can be edited after posting. A notice is a thing that was said
 * on a day - quietly rewriting one that people have already read is how a
 * noticeboard stops being believed. It can be taken down, which is honest, and
 * the record keeps it.
 */

const AUDIENCES = [
  {
    key: 'toStudents' as const,
    label: 'Students',
    hint: 'Everyone on a batch at your colleges.',
  },
  {
    key: 'toColleges' as const,
    label: 'Placement cells',
    hint: 'The staff who run your colleges.',
  },
  {
    key: 'toCompanies' as const,
    label: 'Companies',
    hint: 'Only those that have posted a role to one of your seasons.',
  },
];

export default function Notices() {
  const [list, setList] = useState<AdminNotice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [posted, setPosted] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [to, setTo] = useState({ toStudents: false, toColleges: false, toCompanies: false });
  const [expiresAt, setExpiresAt] = useState('');

  const chosen = AUDIENCES.filter((a) => to[a.key]);
  const all = chosen.length === AUDIENCES.length;

  function load() {
    noticesApi
      .all()
      .then((r) => setList(r.notices))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load the notices.'));
  }

  useEffect(load, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (chosen.length === 0) {
      setError('Choose who this notice is for.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await noticesApi.post({
        title,
        body,
        ...to,
        // The input gives a local date; the API wants an instant. End of that
        // day, so "until the 30th" includes the 30th.
        expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
      });
      setPosted(title);
      setTitle('');
      setBody('');
      setTo({ toStudents: false, toColleges: false, toCompanies: false });
      setExpiresAt('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not post that notice.');
    } finally {
      setBusy(false);
    }
  }

  async function retract(n: AdminNotice) {
    setError(null);
    try {
      await noticesApi.retract(n.id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not take that down.');
    }
  }

  return (
    <AdminLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Super admin</p>
          <h1>Notices</h1>
          <p className="page-lede">
            Something from the university, shown on the dashboard of whoever it is addressed to.
          </p>
        </div>
      </header>

      {error && <p className="alert alert-error">{error}</p>}
      {posted && (
        <p className="alert alert-ok">
          “{posted}” is up. It is on their dashboard from now.
        </p>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Post a notice</h2>
        </div>

        <form onSubmit={submit} noValidate className="notice-form">
          <label className="field">
            <span className="field-label">Title</span>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={160}
              placeholder="Holiday on 2 October"
              required
            />
          </label>

          <label className="field">
            <span className="field-label">What it says</span>
            <textarea
              className="input"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              maxLength={8000}
              placeholder="The placement cell is closed on Thursday. Anything due that day is due on Friday instead."
              required
            />
            <span className="field-hint">Line breaks are kept.</span>
          </label>

          <fieldset className="who">
            <legend>
              Who is it for?
              <button
                type="button"
                className="who-all"
                onClick={() =>
                  setTo(
                    all
                      ? { toStudents: false, toColleges: false, toCompanies: false }
                      : { toStudents: true, toColleges: true, toCompanies: true },
                  )
                }
              >
                {all ? 'Clear' : 'Everyone'}
              </button>
            </legend>

            <div className="who-row">
              {AUDIENCES.map((a) => (
                <label key={a.key} className={`who-opt ${to[a.key] ? 'is-on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={to[a.key]}
                    onChange={(e) => setTo((t) => ({ ...t, [a.key]: e.target.checked }))}
                  />
                  <span>
                    <b>{a.label}</b>
                    <small>{a.hint}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="field field-short">
            <span className="field-label">Take it down on</span>
            <input
              type="date"
              className="input"
              value={expiresAt}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
            <span className="field-hint">
              Leave blank and it stands until you take it down. A deadline should have a date.
            </span>
          </label>

          <div className="notice-form-foot">
            <p className="muted">
              {chosen.length === 0
                ? 'Nobody will see this until you choose an audience.'
                : all
                  ? 'Everyone: students, placement cells and your recruiters.'
                  : `Goes to ${chosen.map((c) => c.label.toLowerCase()).join(' and ')}.`}
            </p>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Posting…' : 'Post the notice'}
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Posted</h2>
        </div>

        {list === null && <p className="muted">Loading…</p>}
        {list?.length === 0 && <p className="muted">Nothing has been posted yet.</p>}

        {list && list.length > 0 && (
          <ul className="posted">
            {list.map((n) => (
              <li key={n.id} className={`posted-item is-${n.status}`}>
                <div className="posted-main">
                  <div className="posted-top">
                    <h3>{n.title}</h3>
                    <span className={`pill pill-${n.status === 'live' ? 'pass' : 'idle'}`}>
                      {n.status}
                    </span>
                  </div>
                  <p className="posted-body">{n.body}</p>
                  <p className="posted-meta">
                    {[
                      n.toStudents && 'students',
                      n.toColleges && 'placement cells',
                      n.toCompanies && 'companies',
                    ]
                      .filter(Boolean)
                      .join(', ')}
                    {' · '}
                    {new Date(n.publishedAt).toLocaleDateString()}
                    {n.expiresAt && ` · until ${new Date(n.expiresAt).toLocaleDateString()}`}
                    {n.author && ` · ${n.author.fullName}`}
                  </p>
                </div>
                {n.status === 'live' && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => retract(n)}>
                    Take down
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminLayout>
  );
}
