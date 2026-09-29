import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { ApliFace } from './student/Apli';
import './RegisterStudent.css';

/**
 * A student putting themselves on their college's roster.
 *
 * ---------------------------------------------------------------------------
 * Why it starts with a code
 *
 * The obvious design is a dropdown of institutions. The platform
 * deliberately does not have one: its public tenant lookup is rate limited
 * precisely so nobody can walk it and list every university here, and a
 * dropdown would hand that over in a single request.
 *
 * So the first thing asked is the college's short code - PICT, COEP - which
 * is unique across the platform, printed on everything a student owns, and
 * enough to fetch the institution, its branding, what it wants to know and
 * its batches in one go. A code that is wrong, an institution that is not
 * live, and one that does not take registrations all answer the same way, so
 * this page discloses nothing to somebody guessing.
 *
 * ---------------------------------------------------------------------------
 * Why the form is not fixed
 *
 * It asks exactly what the institution said to ask. The old way in - a batch
 * join code - took a name, an email and a password, and produced a student
 * with no course. A student with no course matches only roles that state no
 * course criterion, so they were invisible to essentially the whole drive
 * with nothing on screen explaining it. Every field here exists because
 * somebody at their university decided it should.
 */

interface Field {
  key: string;
  label: string;
  note: string;
  type: string;
  required: boolean;
  min?: number;
  max?: number;
}

interface Opening {
  college: { name: string; city: string; code: string };
  institution: { name: string; shortName: string | null; brandColor: string; logoUrl: string | null };
  needsApproval: boolean;
  batches: { id: string; name: string }[];
  programmes: { id: string; label: string }[];
  genders: string[];
  fields: Field[];
}

export default function RegisterStudent() {
  const navigate = useNavigate();

  const [code, setCode] = useState('');
  const [opening, setOpening] = useState<Opening | null>(null);
  const [looking, setLooking] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [batchId, setBatchId] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function findCollege(e: FormEvent) {
    e.preventDefault();
    if (looking) return;
    setError(null);
    setLooking(true);
    try {
      setOpening(await api.get<Opening>(`/public/register/${encodeURIComponent(code.trim())}`));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not reach the server. Check your connection and try again.',
      );
    } finally {
      setLooking(false);
    }
  }

  async function register(e: FormEvent) {
    e.preventDefault();
    if (saving || !opening) return;
    setError(null);
    setSaving(true);
    try {
      await api.post('/public/register', {
        code: opening.college.code,
        fullName,
        email,
        password,
        batchId: batchId || undefined,
        answers,
      });
      navigate('/student', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create your account.');
      setSaving(false);
    }
  }

  /* --- step one: which college ------------------------------------------- */

  if (!opening) {
    return (
      <div className="rg">
        <div className="rg-panel">
          <Link to="/" className="rg-brand">
            <ApliFace size={26} />
            <span>
              Apli<i>.ai</i>
            </span>
          </Link>

          <h1>Join your college’s placement portal</h1>
          <p className="rg-sub">
            Start with your college’s short code — the one on your ID card and your notices, like
            PICT or COEP. Your placement cell can tell you if you are not sure.
          </p>

          <form onSubmit={findCollege} noValidate>
            {error && (
              <p className="rg-error" role="alert">
                {error}
              </p>
            )}

            <label className="field">
              <span className="field-label">College code</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="PICT"
                autoCapitalize="characters"
                autoFocus
                required
              />
            </label>

            <button type="submit" className="btn btn-primary rg-go" disabled={looking || !code.trim()}>
              {looking ? 'Looking…' : 'Continue'}
            </button>
          </form>

          <p className="rg-foot">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
          <p className="rg-note">
            Some colleges enter their students themselves. If yours does, you will have been sent an
            activation link instead — check your college email.
          </p>
        </div>
      </div>
    );
  }

  /* --- step two: the form their institution asked for --------------------- */

  const set = (key: string, value: string) => setAnswers((a) => ({ ...a, [key]: value }));

  return (
    <div className="rg">
      <div className="rg-panel is-wide">
        <Link to="/" className="rg-brand">
          <ApliFace size={26} />
          <span>
            Apli<i>.ai</i>
          </span>
        </Link>

        <p className="rg-where">
          {opening.college.name}
          {opening.college.city && ` · ${opening.college.city}`}
          <button type="button" className="link-btn" onClick={() => setOpening(null)}>
            Not your college?
          </button>
        </p>
        <h1>Create your account</h1>
        <p className="rg-sub">
          {opening.needsApproval
            ? `${opening.institution.shortName ?? opening.institution.name} checks new students before they count. You can fill in the rest of your profile while you wait.`
            : 'Your placement cell still verifies your record before you can apply — that part is the same for everybody.'}
        </p>

        <form onSubmit={register} noValidate>
          {error && (
            <p className="rg-error" role="alert">
              {error}
            </p>
          )}

          <div className="rg-grid">
            <label className="field">
              <span className="field-label">Full name</span>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </label>

            <label className="field">
              <span className="field-label">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <span className="field-hint">Use your college address if you have one.</span>
            </label>

            <label className="field">
              <span className="field-label">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={10}
                required
              />
              <span className="field-hint">At least 10 characters.</span>
            </label>

            {opening.batches.length > 0 && (
              <label className="field">
                <span className="field-label">Your class</span>
                <select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                  <option value="">Not sure — my college can set it</option>
                  {opening.batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {/* Whatever their institution said to ask, and nothing else. */}
            {opening.fields.map((f) => (
              <label className="field" key={f.key}>
                <span className="field-label">
                  {f.label}
                  {f.required && <i className="rg-req"> required</i>}
                </span>

                {f.key === 'programme' && opening.programmes.length > 0 ? (
                  <select
                    value={answers[f.key] ?? ''}
                    onChange={(e) => set(f.key, e.target.value)}
                    required={f.required}
                  >
                    <option value="">Choose your programme</option>
                    {opening.programmes.map((p) => (
                      <option key={p.id} value={p.label}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                ) : f.key === 'gender' && opening.genders.length > 0 ? (
                  <select
                    value={answers[f.key] ?? ''}
                    onChange={(e) => set(f.key, e.target.value)}
                    required={f.required}
                  >
                    <option value="">Rather not say</option>
                    {opening.genders.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                ) : f.type === 'bool' ? (
                  <select
                    value={answers[f.key] ?? ''}
                    onChange={(e) => set(f.key, e.target.value)}
                    required={f.required}
                  >
                    <option value="">—</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                ) : (
                  <input
                    type={f.type === 'date' ? 'date' : 'text'}
                    inputMode={f.type === 'int' || f.type === 'decimal' ? 'decimal' : undefined}
                    value={answers[f.key] ?? ''}
                    onChange={(e) => set(f.key, e.target.value)}
                    required={f.required}
                  />
                )}

                <span className="field-hint">{f.note}</span>
              </label>
            ))}
          </div>

          <button type="submit" className="btn btn-primary rg-go" disabled={saving}>
            {saving ? 'Creating your account…' : 'Create my account'}
          </button>
        </form>

        <p className="rg-foot">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
