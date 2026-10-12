import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { CountryCode } from 'libphonenumber-js';
import ApliLogo from '../../components/ApliLogo';
import { ApiError } from '../../api/client';
import {
  signupApi,
  type CitySuggestion,
  type CollegeOption,
  type DegreeLevel,
  type SignupOptions,
} from '../../api/signup';
import { useAuth } from '../../auth/AuthContext';
import { prefersReducedMotion } from '../../lib/useReveal';
import { Field, Strength } from './parts';
import { guessCountry, isValidMobile } from './phone';
import CountryCodePicker from './CountryCodePicker';
import './signup.css';

/**
 * Student sign-up for the work simulation portal.
 *
 * Open to every student: no college code, no invitation, no approval. Three
 * short steps, because each asks a different kind of question and a student
 * on a phone should only ever see a few fields at once:
 *
 *   1  You              name, email, a password, city, mobile (a country
 *                       code from the list and the number), date of birth,
 *                       gender
 *   2  Your studies     where (picked from the colleges on Apli.ai, or typed
 *                       in if theirs is not one), level, course (only that
 *                       level's), branch, batch, CGPA (optional)
 *   3  Your choice      up to three fields to try, what happens to their
 *                       details, and the terms
 *
 * Then they are signed in and sent to the simulations - the reason they came.
 *
 * The other half of the screen shows what they are joining, so the form is
 * never the only thing to look at.
 */

const STEPS = ['You', 'Your studies', 'Your choice'] as const;
const thisYear = new Date().getFullYear();
const OTHER_COURSE = '__other__';

/** How long a course runs when nobody has said: what most of each level take. */
const USUAL_YEARS: Record<DegreeLevel, number> = { DIPLOMA: 3, UG: 3, PG: 2, PHD: 4 };

/** Used only if the platform's own gender list cannot be loaded. */
const FALLBACK_GENDERS = ['Female', 'Male', 'Other', 'Prefer not to say'];

/** The latest date of birth that is at least 14 years ago, for the date picker. */
const LATEST_DOB = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 14);
  return d.toISOString().slice(0, 10);
})();

/**
 * Batches a student can be in: joined up to six years ago, still studying
 * or finished last year. "2022 - 2026" for a four-year course.
 */
function batchesFor(years: number): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  for (let start = thisYear - 6; start <= thisYear; start += 1) {
    if (start + years >= thisYear - 1) out.push({ start, end: start + years });
  }
  return out.reverse();
}

interface Errors {
  [field: string]: string | undefined;
}

export default function StudentSignup() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [motion] = useState(() => !prefersReducedMotion());

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd');

  // Step 1
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [city, setCity] = useState('');
  // India by default; the student can pick another code.
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>('IN');
  // India, and the browser's country when that is somewhere else.
  const [suggestedCountries] = useState<CountryCode[]>(() => [...new Set<CountryCode>(['IN', guessCountry()])]);
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');

  // Step 2
  const [college, setCollege] = useState<CollegeOption | null>(null);
  const [notListed, setNotListed] = useState(false);
  const [otherCollege, setOtherCollege] = useState('');
  const [options, setOptions] = useState<SignupOptions>({
    courses: [],
    genders: [],
    degreeLevels: [],
    interests: [],
  });
  const [level, setLevel] = useState<DegreeLevel | ''>('');
  const [branch, setBranch] = useState('');
  const [course, setCourse] = useState('');
  const [otherCourse, setOtherCourse] = useState('');
  /** The batch, by the year they joined. */
  const [startYear, setStartYear] = useState<number | ''>('');
  const [cgpa, setCgpa] = useState('');

  // Only the chosen level's courses; one with no level yet is offered at every level.
  const courses = options.courses.filter((c) => !level || !c.level || c.level === level);
  const picked = options.courses.find((c) => c.name === course);
  const courseYears = picked?.years ?? (level ? USUAL_YEARS[level] : 4);
  const batches = batchesFor(courseYears);
  const batch = batches.find((b) => b.start === startYear);
  const genders = options.genders.length ? options.genders : FALLBACK_GENDERS;

  // Step 3
  const [interests, setInterests] = useState<string[]>([]);
  const [agree, setAgree] = useState(false);

  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [welcome, setWelcome] = useState<string | null>(null);

  useEffect(() => {
    signupApi
      .options()
      .then(setOptions)
      .catch(() => undefined);
  }, []);

  /** Checks only the current step, so a student is never told off for what is ahead. */
  function check(at: number): Errors {
    const e: Errors = {};
    if (at === 0) {
      if (fullName.trim().length < 2) e.fullName = 'Enter your full name.';
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'Enter a valid email address.';
      if (password.length < 10) e.password = 'Use at least 10 characters.';
      if (city.trim().length < 2) e.city = 'Enter the city you live in.';
      if (!phone.trim()) e.phone = 'Enter your mobile number.';
      else if (!isValidMobile(phone, phoneCountry)) e.phone = 'Enter a valid mobile number for that country.';
      if (!dob) e.dateOfBirth = 'Enter your date of birth.';
      else if (dob > LATEST_DOB) e.dateOfBirth = 'Check your date of birth.';
      if (!gender) e.gender = 'Choose one, or “Prefer not to say”.';
    }
    if (at === 1) {
      if (!college && !(notListed && otherCollege.trim().length >= 3)) {
        e.college = notListed ? 'Type the name of your college.' : 'Pick your college, or say it is not listed.';
      }
      if (!level) e.level = 'Choose your level of study.';
      if (!course) e.course = 'Choose your course.';
      else if (course === OTHER_COURSE && otherCourse.trim().length < 2) e.course = 'Type your course.';
      if (!batch) e.startYear = 'Pick your batch.';
      if (cgpa.trim() && !(Number(cgpa) >= 0 && Number(cgpa) <= 10)) e.cgpa = 'A CGPA is between 0 and 10.';
    }
    if (at === 2 && !agree) e.agree = 'Agree to the terms to create your account.';
    return e;
  }

  function next() {
    const e = check(step);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setDir('fwd');
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setErrors({});
    setFormError(null);
    setDir('back');
    setStep((s) => Math.max(s - 1, 0));
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (step < STEPS.length - 1) {
      next();
      return;
    }
    const e = check(2);
    setErrors(e);
    if (Object.keys(e).length > 0 || saving) return;

    setSaving(true);
    setFormError(null);
    try {
      await signupApi.student({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        collegeId: college?.source === 'partner' ? college.id : undefined,
        listingId: college?.source === 'listing' ? college.id : undefined,
        otherCollege: college ? undefined : otherCollege.trim(),
        course: course === OTHER_COURSE ? otherCourse.trim() : course,
        degreeLevel: level as DegreeLevel,
        specialisation: branch.trim() || undefined,
        city: city.trim(),
        phoneCountry,
        phone: phone.trim(),
        gender,
        dateOfBirth: dob,
        cgpa: cgpa.trim() ? Number(cgpa) : undefined,
        interests,
        startYear: batch!.start,
        graduationYear: batch!.end,
        agree: true,
      });
      await refresh();
      setWelcome(fullName.trim().split(/\s+/)[0] ?? '');
    } catch (err) {
      setSaving(false);
      if (err instanceof ApiError) {
        // Send the student back to the step that holds the problem.
        const fieldErrors: Errors = {};
        const alias: Record<string, string> = {
          collegeId: 'college',
          listingId: 'college',
          degreeLevel: 'level',
          specialisation: 'branch',
          graduationYear: 'startYear',
        };
        for (const f of err.fields ?? []) fieldErrors[alias[f.path] ?? f.path] = f.message;
        if (err.code === 'CONFLICT') fieldErrors.email = err.message;
        setErrors(fieldErrors);
        const onStep = (fields: string[]) => fields.some((f) => fieldErrors[f]);
        if (onStep(['fullName', 'email', 'password', 'city', 'phone', 'dateOfBirth', 'gender'])) setStep(0);
        else if (onStep(['college', 'level', 'course', 'branch', 'startYear', 'cgpa'])) setStep(1);
        setFormError(Object.keys(fieldErrors).length ? null : err.message);
      } else {
        setFormError('Could not create your account. Check your connection and try again.');
      }
    }
  }

  return (
    <div className={`su ${motion ? 'is-motion' : ''}`}>
      <aside className="su-side" aria-hidden="true">
        <Link to="/" className="su-brand" tabIndex={-1}>
          <ApliLogo className="su-brand-logo" />
        </Link>
        <SidePreview step={step} done={welcome !== null} />
      </aside>

      <main className="su-main">
        <header className="su-top">
          <Link to="/" className="su-brand su-brand-mobile" aria-label="Apli.ai, home">
            <ApliLogo className="su-brand-logo" />
          </Link>
          <p>
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </header>

        {welcome !== null ? (
          <Welcome name={welcome} onGo={() => navigate('/student', { replace: true })} />
        ) : (
          <form className="su-form" onSubmit={submit} noValidate>
            <div className="su-head">
              <p className="su-eyebrow">Free for every student</p>
              <h1>Create your account</h1>
            </div>

            <ol className="su-progress" aria-label="Sign-up steps">
              {STEPS.map((s, i) => (
                <li
                  key={s}
                  className={i < step ? 'is-done' : i === step ? 'is-now' : ''}
                  aria-current={i === step ? 'step' : undefined}
                >
                  <span className="su-progress-dot">{i < step ? '✓' : i + 1}</span>
                  <span className="su-progress-label">{s}</span>
                </li>
              ))}
            </ol>

            {formError && (
              <p className="su-alert" role="alert">
                {formError}
              </p>
            )}

            <div className={`su-step is-${dir}`} key={step}>
              {step === 0 && (
                <>
                  <Field id="su-name" label="Full name" error={errors.fullName}>
                    <input
                      id="su-name"
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="As it should appear on your certificates"
                      autoFocus
                    />
                  </Field>
                  <Field id="su-email" label="Email" error={errors.email}>
                    <input
                      id="su-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </Field>
                  <Field id="su-password" label="Password" error={errors.password} hint="At least 10 characters.">
                    <span className="su-password">
                      <input
                        id="su-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button type="button" onClick={() => setShowPassword((v) => !v)}>
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </span>
                    <Strength password={password} />
                  </Field>
                  <Field id="su-city" label="City you live in" error={errors.city}>
                    <CityInput value={city} onChange={setCity} />
                  </Field>
                  <Field id="su-phone" label="Mobile" error={errors.phone}>
                    <div className="su-phone">
                      <CountryCodePicker value={phoneCountry} onChange={setPhoneCountry} suggested={suggestedCountries} />
                      <input
                        id="su-phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel-national"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Mobile number"
                      />
                    </div>
                  </Field>
                  <div className="su-row">
                    <Field id="su-dob" label="Date of birth" error={errors.dateOfBirth}>
                      <input
                        id="su-dob"
                        type="date"
                        autoComplete="bday"
                        min="1950-01-01"
                        max={LATEST_DOB}
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                      />
                    </Field>
                    <Field id="su-gender" label="Gender" error={errors.gender}>
                      <select id="su-gender" value={gender} onChange={(e) => setGender(e.target.value)}>
                        <option value="">Choose…</option>
                        {genders.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <Field id="su-college" label="Where do you study?" error={errors.college}>
                    {notListed ? (
                      <input
                        id="su-college"
                        value={otherCollege}
                        onChange={(e) => setOtherCollege(e.target.value)}
                        placeholder="Your college's full name"
                        autoFocus
                      />
                    ) : (
                      <CollegePicker value={college} onChange={setCollege} />
                    )}
                    <button
                      type="button"
                      className="su-link"
                      onClick={() => {
                        setNotListed((v) => !v);
                        setCollege(null);
                        setErrors((e) => ({ ...e, college: undefined }));
                      }}
                    >
                      {notListed ? 'Search the list instead' : 'My college is not listed'}
                    </button>
                  </Field>

                  <Field id="su-level" label="Level of study" error={errors.level}>
                    <div className="su-levels" role="radiogroup" aria-label="Level of study">
                      {options.degreeLevels.map((l) => (
                        <button
                          key={l.key}
                          type="button"
                          role="radio"
                          aria-checked={level === l.key}
                          className={level === l.key ? 'is-on' : ''}
                          onClick={() => {
                            setLevel(l.key);
                            const c = options.courses.find((x) => x.name === course);
                            if (c?.level && c.level !== l.key) setCourse('');
                            setStartYear('');
                          }}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <Field id="su-course" label="Course" error={errors.course}>
                    <select
                      id="su-course"
                      value={course}
                      disabled={!level}
                      onChange={(e) => {
                        setCourse(e.target.value);
                        setStartYear('');
                      }}
                    >
                      <option value="">{level ? 'Choose your course' : 'Choose your level first'}</option>
                      {courses.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                      <option value={OTHER_COURSE}>Something else</option>
                    </select>
                  </Field>
                  {course === OTHER_COURSE && (
                    <Field id="su-course-other" label="Your course" error={errors.course}>
                      <input
                        id="su-course-other"
                        value={otherCourse}
                        onChange={(e) => setOtherCourse(e.target.value)}
                        placeholder="For example, B.Des or BBA"
                      />
                    </Field>
                  )}
                  <Field id="su-branch" label="Branch or main subject" error={errors.branch} optional>
                    <input
                      id="su-branch"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="For example, Computer Science or Economics"
                    />
                  </Field>
                  <div className="su-row">
                    <Field id="su-batch" label="Batch" error={errors.startYear}>
                      <select
                        id="su-batch"
                        value={startYear}
                        disabled={!course}
                        onChange={(e) => setStartYear(e.target.value ? Number(e.target.value) : '')}
                      >
                        <option value="">{course ? 'Joined – finishing' : 'Choose your course first'}</option>
                        {batches.map((b) => (
                          <option key={b.start} value={b.start}>
                            {b.start} – {b.end}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field id="su-cgpa" label="CGPA" error={errors.cgpa} optional hint="Your college will verify this.">
                      <input
                        id="su-cgpa"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={10}
                        step={0.01}
                        value={cgpa}
                        onChange={(e) => setCgpa(e.target.value)}
                        placeholder="Out of 10, e.g. 8.2"
                      />
                    </Field>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  {options.interests.length > 0 && (
                    <div className="su-field">
                      <span className="su-label">
                        What would you like to try? <span className="su-optional">Pick up to 3</span>
                      </span>
                      <div className="su-interests" role="group" aria-label="Fields you would like to try">
                        {options.interests.map((i) => {
                          const on = interests.includes(i);
                          const full = !on && interests.length >= 3;
                          return (
                            <button
                              key={i}
                              type="button"
                              aria-pressed={on}
                              disabled={full}
                              className={on ? 'is-on' : ''}
                              onClick={() => setInterests((list) => (on ? list.filter((x) => x !== i) : [...list, i]))}
                            >
                              {on ? '✓ ' : ''}
                              {i}
                            </button>
                          );
                        })}
                      </div>
                      <span className="su-hint">We show you simulations in these first. You can try anything.</span>
                    </div>
                  )}

                  <ul className="su-promises">
                    <li>
                      <b>Your profile is private.</b>
                      <span>No company sees your details until you choose to share them.</span>
                    </li>
                    <li>
                      <b>You choose, company by company.</b>
                      <span>Share with one, keep it from another, and change your mind whenever you like.</span>
                    </li>
                    <li>
                      <b>Free, always.</b>
                      <span>You will never be asked to pay for a simulation or a certificate.</span>
                    </li>
                  </ul>
                  <label className={`su-check ${errors.agree ? 'has-error' : ''}`} htmlFor="su-agree">
                    <input id="su-agree" type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                    <span>
                      I agree to the terms of use and the privacy notice, and I am a student or a recent graduate.
                    </span>
                  </label>
                  {errors.agree && <p className="su-error">{errors.agree}</p>}
                </>
              )}
            </div>

            <div className="su-actions">
              {step > 0 && (
                <button type="button" className="su-btn su-btn-ghost" onClick={back} disabled={saving}>
                  Back
                </button>
              )}
              <button type="submit" className="su-btn su-btn-primary" disabled={saving}>
                {step < STEPS.length - 1 ? 'Continue' : saving ? 'Creating your account…' : 'Create my account'}
              </button>
            </div>

            <p className="su-foot">
              Joining as a company? <Link to="/register/company">Partner with us</Link>
            </p>
          </form>
        )}
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Type two letters, pick from what comes back. Searches as the student types
 * (after a short pause), works from the keyboard, and shows the chosen
 * college as a chip that can be cleared.
 */
function CollegePicker({
  value,
  onChange,
}: {
  value: CollegeOption | null;
  onChange: (c: CollegeOption | null) => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<CollegeOption[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) {
      setResults([]);
      return;
    }
    const ticket = ++latest.current;
    setBusy(true);
    const t = window.setTimeout(() => {
      signupApi
        .colleges(text)
        .then((r) => {
          if (ticket === latest.current) {
            setResults(r);
            setActive(0);
          }
        })
        .catch(() => setResults([]))
        .finally(() => ticket === latest.current && setBusy(false));
    }, 220);
    return () => window.clearTimeout(t);
  }, [q]);

  if (value) {
    return (
      <div className="su-chosen">
        <span className="su-chosen-tile" aria-hidden="true">
          {value.name
            .split(/\s+/)
            .filter((w) => /^[A-Z]/.test(w))
            .slice(0, 2)
            .map((w) => w[0])
            .join('')}
        </span>
        <span>
          <b>{value.name}</b>
          <i>{[value.city, value.institution].filter(Boolean).join(' · ')}</i>
        </span>
        <button type="button" onClick={() => onChange(null)} aria-label="Change college">
          Change
        </button>
      </div>
    );
  }

  const listId = 'su-college-list';
  const showList = open && q.trim().length >= 2;

  return (
    <div className="su-combo">
      <input
        id="su-college"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results[active] ? `su-college-${results[active].id}` : undefined}
        value={q}
        placeholder="Start typing your college's name or city"
        autoComplete="off"
        autoFocus
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!showList || results.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => (a + 1) % results.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => (a - 1 + results.length) % results.length);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            onChange(results[active]!);
          }
        }}
      />
      {busy && <span className="su-spinner" aria-hidden="true" />}
      {showList && (
        <ul className="su-combo-list" id={listId} role="listbox">
          {results.length === 0 && !busy ? (
            <li className="su-combo-empty">No college found. Try another spelling, or say it is not listed.</li>
          ) : (
            results.map((c, i) => (
              <li
                key={c.id}
                id={`su-college-${c.id}`}
                role="option"
                aria-selected={i === active}
                className={i === active ? 'is-active' : ''}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(c);
                }}
                onMouseEnter={() => setActive(i)}
              >
                <b>{c.name}</b>
                <i>{[c.city, c.institution].filter(Boolean).join(' · ')}</i>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * "City you live in": free typing, with Indian cities and towns suggested
 * after two letters. A suggestion fills in the spelling; nothing has to be
 * picked, so a city the lookup does not know is still accepted.
 */
function CityInput({ value, onChange }: { value: string; onChange: (city: string) => void }) {
  const [results, setResults] = useState<CitySuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const latest = useRef(0);
  // A city just picked is not searched for again.
  const picked = useRef<string | null>(null);

  useEffect(() => {
    const text = value.trim();
    if (text.length < 2 || text === picked.current) {
      setResults([]);
      return;
    }
    const ticket = ++latest.current;
    const t = window.setTimeout(() => {
      signupApi
        .cities(text)
        .then((r) => {
          if (ticket === latest.current) {
            setResults(r);
            setActive(-1);
          }
        })
        .catch(() => setResults([]));
    }, 250);
    return () => window.clearTimeout(t);
  }, [value]);

  function choose(c: CitySuggestion) {
    picked.current = c.name;
    onChange(c.name);
    setResults([]);
    setOpen(false);
  }

  const listId = 'su-city-list';
  const showList = open && results.length > 0;

  return (
    <div className="su-combo">
      <input
        id="su-city"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `su-city-${active}` : undefined}
        autoComplete="off"
        value={value}
        placeholder="Start typing, e.g. Nashik"
        onChange={(e) => {
          picked.current = null;
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => (a + 1) % results.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => (a <= 0 ? results.length - 1 : a - 1));
          } else if (e.key === 'Enter' && active >= 0) {
            e.preventDefault();
            choose(results[active]!);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {showList && (
        <ul className="su-combo-list" id={listId} role="listbox">
          {results.map((c, i) => (
            <li
              key={`${c.name}|${c.state ?? ''}`}
              id={`su-city-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'is-active' : ''}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(c);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <b>{c.name}</b>
              {c.state && <i>{c.state}</i>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The other half of the screen: what the student is joining. It follows the
 * form - step one shows simulations to choose from, step two the tasks,
 * step three the certificate and who sees it - so the picture always answers
 * "why am I filling this in?".
 */
function SidePreview({ step, done }: { step: number; done: boolean }) {
  const scenes = [
    {
      title: 'Real work from real companies',
      body: 'A few hours of tasks set by the team that does the job.',
    },
    {
      title: 'Done at your own pace',
      body: 'Save as you go, finish over a few evenings, explain it on a short call.',
    },
    {
      title: 'Proof you control',
      body: 'A certificate anyone can verify, shared only with the companies you choose.',
    },
  ];
  const at = done ? 2 : step;
  const scene = scenes[at]!;

  return (
    <div className="su-preview">
      <div className="su-scene" key={at}>
        {at === 0 && (
          <div className="su-cards">
            {[
              ['IS', 'Software Engineering', 'Indus Systems · 5 hrs', 'blue'],
              ['NA', 'Data Analytics', 'Northwind Analytics · 4 hrs', 'green'],
              ['ZL', 'Product Design', 'Zenith Labs · 4 hrs', 'violet'],
            ].map(([tile, title, meta, tone], i) => (
              <div key={title} className="su-mini" style={{ '--i': i } as CSSProperties}>
                <span className={`su-tile is-${tone}`}>{tile}</span>
                <span>
                  <b>{title}</b>
                  <i>{meta}</i>
                </span>
              </div>
            ))}
          </div>
        )}
        {at === 1 && (
          <div className="su-mini su-tasks">
            <b>Your tasks</b>
            {['Read the brief from the team', 'Build and test the endpoint', 'Explain it on a 10-minute call'].map(
              (t, i) => (
                <span key={t} className={i < 2 ? 'is-done' : ''} style={{ '--i': i } as CSSProperties}>
                  {t}
                </span>
              ),
            )}
          </div>
        )}
        {at === 2 && (
          <div className="su-cert-wrap">
            <div className="su-mini su-cert">
              <span className="su-cert-label">Certificate</span>
              <b>Software Engineering</b>
              <i>Indus Systems · verified by code</i>
              <span className="su-cert-seal">✓</span>
            </div>
            <div className="su-share">
              <span className="is-on">Indus Systems</span>
              <span>Harbour Fintech</span>
              <span className="is-on">Zenith Labs</span>
            </div>
          </div>
        )}
      </div>
      <h2>{scene.title}</h2>
      <p>{scene.body}</p>
      <p className="su-sample">Sample companies from the demo.</p>
    </div>
  );
}

function Welcome({ name, onGo }: { name: string; onGo: () => void }) {
  return (
    <div className="su-welcome" role="status">
      <span className="su-burst" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <i key={i} style={{ '--i': i } as CSSProperties} />
        ))}
        <b>✓</b>
      </span>
      <h1>Welcome{name ? `, ${name}` : ''}.</h1>
      <p>Your account is ready. Pick your first work simulation - most take a few hours.</p>
      <button type="button" className="su-btn su-btn-primary su-btn-lg" onClick={onGo} autoFocus>
        Browse simulations
      </button>
    </div>
  );
}
