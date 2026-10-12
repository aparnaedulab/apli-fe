import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import { ApiError } from '../../api/client';
import { signupApi } from '../../api/signup';
import { studentAppApi, type StudentProfile } from '../../api/studentApp';
import CountryCodePicker from '../signup/CountryCodePicker';
import { isValidMobile } from '../signup/phone';
import Shell from './Shell';
import '../signup/signup.css';

const LEVEL: Record<string, string> = { DIPLOMA: 'Diploma', UG: 'Undergraduate', PG: 'Postgraduate', PHD: 'PhD' };

/**
 * What companies read about a student, and what decides which simulations
 * they are shown first. Kept short: the fields they want to try, where they
 * live, how to reach them, their branch and CGPA. What they study and their
 * batch were set at sign-up and are shown, not edited, here.
 */
export default function Profile() {
  const [data, setData] = useState<StudentProfile | null>(null);
  const [fields, setFields] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const [interests, setInterests] = useState<string[]>([]);
  const [city, setCity] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>('IN');
  const [phone, setPhone] = useState('');
  const [branch, setBranch] = useState('');
  const [cgpa, setCgpa] = useState('');

  function take(p: StudentProfile) {
    setData(p);
    setInterests(p.interests);
    setCity(p.city ?? '');
    const parsed = p.phone ? parsePhoneNumberFromString(p.phone) : undefined;
    setPhoneCountry((parsed?.country as CountryCode | undefined) ?? 'IN');
    setPhone(parsed ? parsed.formatNational() : (p.phone ?? ''));
    setBranch(p.specialisation ?? '');
    setCgpa(p.cgpa === null ? '' : String(p.cgpa));
  }

  useEffect(() => {
    studentAppApi
      .profile()
      .then(take)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load your profile.'));
    signupApi
      .options()
      .then((o) => setFields(o.interests))
      .catch(() => undefined);
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (city.trim().length < 2) local.city = 'Enter the city you live in.';
    if (phone.trim() && !isValidMobile(phone, phoneCountry)) local.phone = 'Enter a valid mobile number for that country.';
    if (cgpa.trim() && !(Number(cgpa) >= 0 && Number(cgpa) <= 10)) local.cgpa = 'A CGPA is between 0 and 10.';
    setErrors(local);
    if (Object.keys(local).length) return;

    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      take(
        await studentAppApi.saveProfile({
          interests,
          city: city.trim(),
          phoneCountry,
          phone: phone.trim() || undefined,
          specialisation: branch.trim() || undefined,
          cgpa: cgpa.trim() ? Number(cgpa) : '',
        }),
      );
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.fields?.length) setErrors(Object.fromEntries(err.fields.map((f) => [f.path, f.message])));
      else setError(err instanceof ApiError ? err.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <section className="sa-hero is-short">
        <div className="sa-wrap">
          <Link to="/student" className="sa-back">
            <span aria-hidden="true">←</span> Your board
          </Link>
          <p className="sa-eyebrow">Your profile</p>
          <h1>
            {data?.fullName ?? 'Your profile'}
            {data && data.complete === 100 && <span className="sa-status is-verified is-inline">Complete</span>}
          </h1>
          <p className="sa-lede">
            What companies read when you share your work with them, and what decides which simulations you see first.
          </p>
        </div>
      </section>

      <div className="sa-wrap sa-body">
        {error && <p className="sa-alert">{error}</p>}
        {!data && !error && <p className="sa-loading">Loading…</p>}
        {data && (
          <div className="sa-layout">
            <form className="sa-main-col sa-form" onSubmit={save} noValidate>
              <section className="sa-block">
                <h2>Fields you want to try</h2>
                <p className="sa-prose">Up to three. Simulations in these come first on your board.</p>
                <div className="sa-chips is-pick" role="group" aria-label="Fields you want to try">
                  {fields.map((f) => {
                    const on = interests.includes(f);
                    return (
                      <button
                        key={f}
                        type="button"
                        aria-pressed={on}
                        disabled={!on && interests.length >= 3}
                        className={`sa-chip ${on ? 'is-on' : ''}`}
                        onClick={() => setInterests((l) => (on ? l.filter((x) => x !== f) : [...l, f]))}
                      >
                        {on ? '✓ ' : ''}
                        {f}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="sa-block">
                <h2>About you</h2>
                <div className="sa-fields-grid">
                  <label className="sa-field">
                    <span>City you live in</span>
                    <input value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" />
                    {errors.city && <em>{errors.city}</em>}
                  </label>
                  <div className="sa-field">
                    <span>Mobile</span>
                    <div className="su-phone">
                      <CountryCodePicker value={phoneCountry} onChange={setPhoneCountry} suggested={['IN']} />
                      <input
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel-national"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Mobile number"
                        aria-label="Mobile number"
                      />
                    </div>
                    {errors.phone && <em>{errors.phone}</em>}
                  </div>
                </div>
              </section>

              <section className="sa-block">
                <h2>Your studies</h2>
                <dl className="sa-facts">
                  <div>
                    <dt>College</dt>
                    <dd>{data.college ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Course</dt>
                    <dd>
                      {data.course ?? '—'}
                      {data.degreeLevel ? ` · ${LEVEL[data.degreeLevel] ?? data.degreeLevel}` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>Batch</dt>
                    <dd>{data.batch ?? '—'}</dd>
                  </div>
                </dl>
                <div className="sa-fields-grid">
                  <label className="sa-field">
                    <span>Branch or main subject</span>
                    <input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="e.g. Computer Science" />
                  </label>
                  <label className="sa-field">
                    <span>
                      CGPA <i>your college will verify this</i>
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={10}
                      step={0.01}
                      value={cgpa}
                      onChange={(e) => setCgpa(e.target.value)}
                      placeholder="Out of 10"
                    />
                    {errors.cgpa && <em>{errors.cgpa}</em>}
                  </label>
                </div>
              </section>

              <div className="sa-form-foot">
                {saved && <span className="sa-saved">Saved</span>}
                <button type="submit" className="sa-btn" disabled={busy}>
                  {busy ? 'Saving…' : 'Save profile'}
                </button>
              </div>
            </form>

            <aside className="sa-aside">
              <section className="sa-panel sa-cta">
                <h2>{data.complete}% complete</h2>
                <div className="sa-bar">
                  <span style={{ width: `${data.complete}%` }} />
                </div>
                {data.missing.length ? (
                  <>
                    <p>Still to add:</p>
                    <ul className="sa-missing">
                      {data.missing.map((m) => (
                        <li key={m.key}>{m.label}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p>Everything a company looks for is here.</p>
                )}
                <p className="sa-panel-empty">{data.email} · only companies you share work with see these details.</p>
              </section>
            </aside>
          </div>
        )}
      </div>
    </Shell>
  );
}
