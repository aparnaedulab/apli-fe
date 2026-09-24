import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { fmtDate, internshipApi, type ReviewPreview } from '../api/internships';
import './MentorReview.css';

const SCORES: { value: number; label: string }[] = [
  { value: 1, label: 'Did not meet expectations' },
  { value: 2, label: 'Met some expectations' },
  { value: 3, label: 'Met expectations' },
  { value: 4, label: 'Above expectations' },
  { value: 5, label: 'Outstanding' },
];

/**
 * The mentor's evaluation - no account, no password, one short form.
 *
 * The mentor owes the platform nothing, so the page asks for exactly two
 * things and says why: a score and a few words, which the student's college
 * reads before awarding the credits. The link works once.
 */
export default function MentorReview() {
  const { token = '' } = useParams();
  const [preview, setPreview] = useState<ReviewPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    internshipApi
      .reviewPreview(token)
      .then(setPreview)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'This link could not be opened.'));
  }, [token]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!score) {
      setError('Choose a score.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await internshipApi.submitReview(token, { score, note });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the evaluation.');
      setBusy(false);
    }
  }

  return (
    <main className="mentor">
      <div className="mentor-panel">
        <Link to="/" className="mentor-brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>Apli.ai</span>
        </Link>

        {loadError && (
          <>
            <h1>This link has closed</h1>
            <p className="mentor-lede">{loadError}</p>
          </>
        )}

        {!loadError && !preview && <p className="mentor-lede">Loading…</p>}

        {done && preview && (
          <>
            <h1>Thank you</h1>
            <p className="mentor-lede">
              Your evaluation of {preview.student} has gone to {preview.college ?? 'their college'}. You can close this page.
            </p>
          </>
        )}

        {preview && !done && (
          <>
            <p className="eyebrow">Internship evaluation</p>
            <h1>How did {preview.student} do?</h1>
            <p className="mentor-lede">
              {preview.student} interned as <b>{preview.role}</b> at <b>{preview.organisation}</b> from{' '}
              {fmtDate(preview.startDate)} to {fmtDate(preview.endDate)}
              {preview.college ? `, for credit at ${preview.college}` : ''}. They logged {preview.hoursLogged} hours over{' '}
              {preview.weeksLogged} week{preview.weeksLogged === 1 ? '' : 's'}. It takes two minutes and needs no account.
            </p>

            <form onSubmit={submit} noValidate>
              <fieldset className="mentor-scores">
                <legend>Overall</legend>
                {SCORES.map((s) => (
                  <label key={s.value} className={`mentor-score ${score === s.value ? 'is-on' : ''}`}>
                    <input type="radio" name="score" value={s.value} checked={score === s.value} onChange={() => setScore(s.value)} />
                    <span className="mentor-score-n">{s.value}</span>
                    <span>{s.label}</span>
                  </label>
                ))}
              </fieldset>

              <label className="mentor-field">
                <span>A few words for the college</span>
                <textarea
                  rows={4}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What they did well, and one thing to work on."
                />
              </label>

              {error && (
                <p className="mentor-error" role="alert">
                  {error}
                </p>
              )}

              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Sending…' : 'Send evaluation'}
              </button>
              <p className="mentor-small">This link works once. Only the student’s college sees what you write.</p>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
