import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { registrationApi, type RegisterOptions } from '../api/registration';
import CompanyFields, {
  emptyCompanyForm,
  toCompanyPayload,
} from '../components/CompanyFields';
import { homeFor, useAuth } from '../auth/AuthContext';
import './Login.css';
import './RegisterCompany.css';

/**
 * The one open front door on the platform.
 *
 * It opens onto a queue, not onto the students: registering creates a pending
 * company that can draft roles and nothing else. Two approvals still stand
 * between here and a student - the university verifying the company, and each
 * college approving each posting - which is what makes it safe to leave open.
 *
 * Two steps, because a single form with sixteen fields reads as a rejection.
 * Step one is what operations needs to make a decision; step two is the
 * account of the person filling it in.
 */
export default function RegisterCompany() {
  const { user, loading } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [options, setOptions] = useState<RegisterOptions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [company, setCompany] = useState(emptyCompanyForm());
  const [contact, setContact] = useState({ fullName: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    registrationApi
      .options()
      .then(setOptions)
      .catch(() => setOptions({ industries: [] }));
  }, []);

  if (!loading && user) return <Navigate to={homeFor(user)} replace />;

  function goToStepTwo(e: FormEvent) {
    e.preventDefault();

    /*
      The same answers companyRegistrationSchema insists on, checked here so
      the person is not sent to step two and bounced back. The server stays
      the authority: this only saves the round trip.
    */
    const missing: Record<string, string> = {};
    if (company.name.trim().length < 2) missing.name = 'Enter the company name.';
    if (company.legalName.trim().length < 2) missing.legalName = 'Enter the registered name.';
    if (!company.industryId && !company.industryOther.trim())
      missing.industryId = 'Choose an industry, or tell us yours.';
    if (!company.sizeBand) missing.sizeBand = 'Choose a size.';
    if (!company.foundedYear.trim()) missing.foundedYear = 'Enter the founding year.';
    if (!company.gstin.trim()) missing.gstin = 'Enter your GSTIN.';
    if (!company.cin.trim()) missing.cin = 'Enter your CIN.';
    if (company.address.trim().length < 5) missing.address = 'Enter the head office address.';

    if (Object.keys(missing).length > 0) {
      setFieldErrors(missing);
      setError('A few answers are still needed before the next step.');
      return;
    }

    setFieldErrors({});
    setError(null);
    setStep(2);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;

    setError(null);
    setFieldErrors({});
    setSubmitting(true);

    try {
      await registrationApi.registerCompany({
        company: toCompanyPayload(company),
        contact,
      });

      // No session: the account cannot sign in until we have verified the
      // company, so the honest end of this form is being told what happens
      // next, not a portal with nothing in it.
      setStep(3);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        const fields = err.fields;
        if (fields) {
          setFieldErrors(Object.fromEntries(fields.map((f) => [f.path.split('.').pop()!, f.message])));
          // A complaint about a company field belongs on the step showing it.
          if (fields.some((f) => f.path.startsWith('company'))) setStep(1);
        }
      } else {
        setError('Could not reach the server. Check that it is running.');
      }
      setSubmitting(false);
    }
  }

  const err = (name: string) =>
    fieldErrors[name] ? <span className="field-error">{fieldErrors[name]}</span> : null;

  return (
    <div className="login register">
      <div className="login-panel register-panel">
        <Link to="/" className="login-brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>Apli.ai</span>
        </Link>

        <h1>{step === 3 ? 'Registration received' : 'Register your company'}</h1>
        <p className="login-sub">
          {step === 3
            ? `We are checking that ${company.name} is who it says it is. Nobody can sign in until that is done.`
            : 'Tell us who you are. The Apli.ai team checks every registration before you can sign in — usually within a working day.'}
        </p>

        {step !== 3 && (
          <ol className="steps" aria-label="Progress">
            <li className={step === 1 ? 'is-current' : 'is-done'}>
              <span className="steps-num">1</span> Company
            </li>
            <li className={step === 2 ? 'is-current' : ''}>
              <span className="steps-num">2</span> Your account
            </li>
          </ol>
        )}

        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}

        {step === 3 ? (
          <div className="register-done">
            <ol className="register-next">
              <li>
                <b>We check you are real</b>
                Registered name, GSTIN, CIN and your head office — the same things a placement cell
                would ask before letting you near its students.
              </li>
              <li>
                <b>You get an email</b>
                Sent to <strong>{contact.email}</strong>, whether the answer is yes or no. A no says
                why.
              </li>
              <li>
                <b>Then you sign in</b>
                With that email and the password you just chose. Until then the account is closed.
              </li>
            </ol>
            <Link to="/login" className="btn btn-secondary">
              Go to sign in
            </Link>
          </div>
        ) : step === 1 ? (
          <form onSubmit={goToStepTwo} noValidate>
            <CompanyFields
              value={company}
              onChange={setCompany}
              industries={options?.industries ?? []}
              errors={fieldErrors}
              tone="register"
            />

            <button type="submit" className="btn btn-primary btn-block">
              Continue
            </button>
          </form>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <p className="register-note">
              This account owns <strong>{company.name}</strong> on the platform. You can invite the
              rest of your team once you are in — no need to wait for the review.
            </p>

            <label className="field">
              <span className="field-label">Your name <em className="field-need">Required</em></span>
              <input
                value={contact.fullName}
                onChange={(e) => setContact((c) => ({ ...c, fullName: e.target.value }))}
                autoFocus
                required
              />
              {err('fullName')}
            </label>

            <label className="field">
              <span className="field-label">Work email <em className="field-need">Required</em></span>
              <input
                type="email"
                autoComplete="username"
                value={contact.email}
                onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                placeholder="you@company.com"
                required
              />
              <span className="field-hint">
                Use your company address. A generic inbox slows the review down.
              </span>
              {err('email')}
            </label>

            <label className="field">
              <span className="field-label">
                Password <em className="field-need">Required</em>
                <button
                  type="button"
                  className="field-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-pressed={showPassword}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={contact.password}
                onChange={(e) => setContact((c) => ({ ...c, password: e.target.value }))}
                required
                minLength={10}
              />
              <span className="field-hint">At least 10 characters.</span>
              {err('password')}
            </label>

            <div className="register-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStep(1)}
                disabled={submitting}
              >
                Back
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create account'}
              </button>
            </div>
          </form>
        )}

        <p className="login-foot">
          Already registered? <Link to="/login">Sign in</Link>. Colleges and students join by
          invitation from their placement cell.
        </p>
      </div>

      <aside className="login-aside" aria-hidden="true">
        <blockquote>
          <p>
            Every company is reviewed before it can post. Every posting is approved by the college
            it targets. Students see only roles they qualify for.
          </p>
        </blockquote>
      </aside>
    </div>
  );
}
