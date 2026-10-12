import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { registrationApi } from '../../api/registration';
import type { CompanySize } from '../../api/company';
import { COMPANY_SIZES } from '../../components/CompanyFields';
import { Done, Field, PasswordInput, SignupFrame, Steps, fieldErrors } from './parts';

/**
 * A company asking to partner with Apli.ai.
 *
 * Companies are the paying side, and every one is checked by the Apli.ai
 * team before it can reach a single student. So this creates the account
 * and the company as "waiting to be verified", asks for the details that
 * check needs, and says plainly what happens next. Nobody is signed in: there
 * is nothing to do until the company is verified, and then the team builds
 * the first simulation with them.
 *
 *   1  Your company        name, industry, size, website, city
 *   2  Registration        legal name, GSTIN, CIN, year founded, head office
 *   3  You                 the person who will own the account
 */

const STEPS = ['Your company', 'Registration', 'You'] as const;
const OTHER = '__other__';
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CIN = /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;

type Errors = Record<string, string | undefined>;

export default function CompanySignup() {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd');
  const [industries, setIndustries] = useState<{ id: string; name: string }[]>([]);

  const [name, setName] = useState('');
  const [industryId, setIndustryId] = useState('');
  const [industryOther, setIndustryOther] = useState('');
  const [sizeBand, setSizeBand] = useState<CompanySize | ''>('');
  const [website, setWebsite] = useState('');
  const [city, setCity] = useState('');

  const [legalName, setLegalName] = useState('');
  const [gstin, setGstin] = useState('');
  const [cin, setCin] = useState('');
  const [foundedYear, setFoundedYear] = useState('');
  const [address, setAddress] = useState('');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);

  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    registrationApi
      .options()
      .then((r) => setIndustries(r.industries))
      .catch(() => setIndustries([]));
  }, []);

  function check(at: number): Errors {
    const e: Errors = {};
    if (at === 0) {
      if (name.trim().length < 2) e.name = 'Enter the company name.';
      if (!industryId) e.industryId = 'Choose an industry.';
      if (industryId === OTHER && industryOther.trim().length < 2) e.industryId = 'Tell us your industry.';
      if (!sizeBand) e.sizeBand = 'Choose a size.';
      if (website && !/^https?:\/\/\S+\.\S+/.test(website.trim())) e.website = 'Start with https://';
    }
    if (at === 1) {
      if (legalName.trim().length < 2) e.legalName = 'Enter the registered name.';
      if (!GSTIN.test(gstin.trim().toUpperCase())) e.gstin = 'That does not look like a GSTIN.';
      if (!CIN.test(cin.trim().toUpperCase())) e.cin = 'That does not look like a CIN.';
      const y = Number(foundedYear);
      if (!y || y < 1800 || y > new Date().getFullYear()) e.foundedYear = 'Enter the year the company was founded.';
      if (address.trim().length < 5) e.address = 'Enter the head office address.';
    }
    if (at === 2) {
      if (fullName.trim().length < 2) e.fullName = 'Enter your full name.';
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'Enter a valid work email address.';
      if (password.length < 10) e.password = 'Use at least 10 characters.';
      if (!agree) e.agree = 'Agree to the terms to continue.';
    }
    return e;
  }

  function go(to: number) {
    setDir(to > step ? 'fwd' : 'back');
    setStep(to);
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const e = check(step);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    if (step < STEPS.length - 1) {
      go(step + 1);
      return;
    }
    if (saving) return;

    setSaving(true);
    setFormError(null);
    try {
      await registrationApi.registerCompany({
        company: {
          name: name.trim(),
          legalName: legalName.trim(),
          industryId: industryId === OTHER ? '' : industryId,
          ...(industryId === OTHER ? { industryOther: industryOther.trim() } : {}),
          sizeBand,
          foundedYear: Number(foundedYear),
          gstin: gstin.trim().toUpperCase(),
          cin: cin.trim().toUpperCase(),
          website: website.trim() || undefined,
          city: city.trim() || undefined,
          address: address.trim(),
        },
        contact: { fullName: fullName.trim(), email: email.trim(), password },
      });
      setDone(true);
    } catch (err) {
      setSaving(false);
      if (err instanceof ApiError) {
        const f = fieldErrors(err.fields);
        if (err.code === 'CONFLICT') {
          if (/email/i.test(err.message)) f.email = err.message;
          else f.name = err.message;
        }
        setErrors(f);
        if (f.name || f.industryId || f.sizeBand || f.website || f.city) go(0);
        else if (f.legalName || f.gstin || f.cin || f.foundedYear || f.address) go(1);
        setFormError(Object.keys(f).length ? null : err.message);
      } else {
        setFormError('Could not send your request. Check your connection and try again.');
      }
    }
  }

  return (
    <SignupFrame
      side={<CompanySide />}
      topRight={
        <>
          Already a partner? <Link to="/login">Sign in</Link>
        </>
      }
    >
      {done ? (
        <Done
          title="Thank you. We have your request."
          body={
            <>
              Our team checks every company before it can reach students. When {name.trim() || 'your company'} is
              verified, we will write to {email.trim()} and build your first work simulation with you.
            </>
          }
        >
          <Link to="/" className="su-btn su-btn-primary su-btn-lg">
            Back to the home page
          </Link>
        </Done>
      ) : (
        <form className="su-form" onSubmit={submit} noValidate>
          <div className="su-head">
            <p className="su-eyebrow">For companies</p>
            <h1>Partner with Apli.ai</h1>
          </div>

          <Steps steps={STEPS} at={step} />

          {formError && (
            <p className="su-alert" role="alert">
              {formError}
            </p>
          )}

          <div className={`su-step is-${dir}`} key={step}>
            {step === 0 && (
              <>
                <Field id="co-name" label="Company name" error={errors.name} hint="As students will see it.">
                  <input id="co-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="organization" autoFocus />
                </Field>
                <div className="su-row">
                  <Field id="co-industry" label="Industry" error={errors.industryId}>
                    <select id="co-industry" value={industryId} onChange={(e) => setIndustryId(e.target.value)}>
                      <option value="">Choose one</option>
                      {industries.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                      <option value={OTHER}>Something else</option>
                    </select>
                  </Field>
                  <Field id="co-size" label="Size" error={errors.sizeBand}>
                    <select id="co-size" value={sizeBand} onChange={(e) => setSizeBand(e.target.value as CompanySize | '')}>
                      <option value="">Choose one</option>
                      {COMPANY_SIZES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                {industryId === OTHER && (
                  <Field id="co-industry-other" label="Your industry" error={errors.industryId}>
                    <input id="co-industry-other" value={industryOther} onChange={(e) => setIndustryOther(e.target.value)} />
                  </Field>
                )}
                <div className="su-row">
                  <Field id="co-website" label="Website" error={errors.website} optional>
                    <input
                      id="co-website"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://"
                      autoComplete="url"
                    />
                  </Field>
                  <Field id="co-city" label="City" error={errors.city} optional>
                    <input id="co-city" value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" />
                  </Field>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <p className="su-note">Our team uses these to check your company is real before it goes live.</p>
                <Field id="co-legal" label="Registered name" error={errors.legalName}>
                  <input id="co-legal" value={legalName} onChange={(e) => setLegalName(e.target.value)} autoFocus />
                </Field>
                <div className="su-row">
                  <Field id="co-gstin" label="GSTIN" error={errors.gstin}>
                    <input
                      id="co-gstin"
                      value={gstin}
                      onChange={(e) => setGstin(e.target.value.toUpperCase())}
                      placeholder="15 characters"
                      maxLength={15}
                    />
                  </Field>
                  <Field id="co-year" label="Year founded" error={errors.foundedYear}>
                    <input
                      id="co-year"
                      inputMode="numeric"
                      value={foundedYear}
                      onChange={(e) => setFoundedYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="YYYY"
                    />
                  </Field>
                </div>
                <Field id="co-cin" label="CIN" error={errors.cin}>
                  <input
                    id="co-cin"
                    value={cin}
                    onChange={(e) => setCin(e.target.value.toUpperCase())}
                    placeholder="21 characters"
                    maxLength={21}
                  />
                </Field>
                <Field id="co-address" label="Head office address" error={errors.address}>
                  <textarea
                    id="co-address"
                    className="su-textarea"
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    autoComplete="street-address"
                  />
                </Field>
              </>
            )}

            {step === 2 && (
              <>
                <Field id="co-person" label="Your full name" error={errors.fullName}>
                  <input id="co-person" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" autoFocus />
                </Field>
                <Field id="co-email" label="Work email" error={errors.email} hint="Use your company address, not a personal one.">
                  <input id="co-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </Field>
                <Field id="co-password" label="Password" error={errors.password} hint="At least 10 characters.">
                  <PasswordInput id="co-password" value={password} onChange={setPassword} />
                </Field>
                <label className={`su-check ${errors.agree ? 'has-error' : ''}`} htmlFor="co-agree">
                  <input id="co-agree" type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                  <span>I agree to the terms of use and the privacy notice, and I am allowed to act for this company.</span>
                </label>
                {errors.agree && <p className="su-error">{errors.agree}</p>}
              </>
            )}
          </div>

          <div className="su-actions">
            {step > 0 && (
              <button type="button" className="su-btn su-btn-ghost" onClick={() => go(step - 1)} disabled={saving}>
                Back
              </button>
            )}
            <button type="submit" className="su-btn su-btn-primary" disabled={saving}>
              {step < STEPS.length - 1 ? 'Continue' : saving ? 'Sending…' : 'Send request'}
            </button>
          </div>

          <p className="su-foot">
            A student? <Link to="/register/student">Join free</Link> · A university or college?{' '}
            <Link to="/register/institution">Partner with us</Link>
          </p>
        </form>
      )}
    </SignupFrame>
  );
}

/** The dark half: what a partner company gets, as its own dashboard would show it. */
function CompanySide() {
  return (
    <>
      <div className="su-scene">
        <div className="su-mini su-dash">
          <div>
            <b>Software Engineering</b>
            <i>Your simulation · sample</i>
          </div>
          <div className="su-dash-stats">
            {[
              ['128', 'started'],
              ['64', 'finished'],
              ['41', 'shared with you'],
            ].map(([n, l], i) => (
              <span key={l} style={{ '--i': i } as CSSProperties}>
                <b>{n}</b>
                <i>{l}</i>
              </span>
            ))}
          </div>
          {['B.E. Computer · 2026', 'B.Sc Data Science · 2027'].map((c, i) => (
            <span key={c} className="su-dash-row" style={{ '--i': i + 3 } as CSSProperties}>
              <span className="su-tile is-violet">{['AK', 'RP'][i]}</span>
              <span>
                <b>Sample Student</b>
                <i>{c}</i>
              </span>
              <em>Invite</em>
            </span>
          ))}
        </div>
      </div>
      <h2>Meet students who have already done the work</h2>
      <p>We build your simulation with you. You see who finished it and chose to share, and invite them to apply.</p>
      <p className="su-sample">Sample numbers from the demo.</p>
    </>
  );
}
