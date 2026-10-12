import { useState, type CSSProperties, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { partnersApi, type PartnerKind } from '../../api/partners';
import { Done, Field, SignupFrame, Steps, fieldErrors } from './parts';

/**
 * A university or college asking to bring Apli.ai to its students.
 *
 * Institutions are free partners, set up by the Apli.ai team rather than by
 * themselves - so this is a request, not an account. It goes to the platform
 * console, somebody gets in touch, and the institution is onboarded with
 * its colleges and its people. Their students do not have to wait for any
 * of that: they can sign up on their own today.
 *
 *   1  Your institution    university or college, name, where, how many students
 *   2  You                 who to talk to, and anything they want us to know
 */

const STEPS = ['Your institution', 'You'] as const;
type Errors = Record<string, string | undefined>;

export default function InstitutionSignup() {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd');

  const [kind, setKind] = useState<PartnerKind>('UNIVERSITY');
  const [institutionName, setInstitutionName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [students, setStudents] = useState('');

  const [contactName, setContactName] = useState('');
  const [contactRole, setContactRole] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');

  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const noun = kind === 'UNIVERSITY' ? 'university' : 'college';

  function check(at: number): Errors {
    const e: Errors = {};
    if (at === 0) {
      if (institutionName.trim().length < 3) e.institutionName = `Enter the name of your ${noun}.`;
      if (city.trim().length < 2) e.city = 'Enter the city.';
      if (students && !(Number(students) > 0)) e.students = 'Enter a number, or leave it empty.';
    }
    if (at === 1) {
      if (contactName.trim().length < 2) e.contactName = 'Enter your full name.';
      if (contactRole.trim().length < 2) e.contactRole = 'Tell us your role.';
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'Enter a valid email address.';
      if (phone && !/^[+0-9 ()-]{7,20}$/.test(phone.trim())) e.phone = 'Enter a valid phone number.';
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
      await partnersApi.request({
        kind,
        institutionName: institutionName.trim(),
        city: city.trim(),
        state: state.trim() || undefined,
        students: students ? Number(students) : undefined,
        contactName: contactName.trim(),
        contactRole: contactRole.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        message: message.trim() || undefined,
      });
      setDone(true);
    } catch (err) {
      setSaving(false);
      if (err instanceof ApiError) {
        const f = fieldErrors(err.fields);
        setErrors(f);
        if (f.institutionName || f.city || f.state || f.students || f.kind) go(0);
        setFormError(Object.keys(f).length ? null : err.message);
      } else {
        setFormError('Could not send your request. Check your connection and try again.');
      }
    }
  }

  return (
    <SignupFrame
      side={<InstitutionSide />}
      topRight={
        <>
          Already a partner? <Link to="/login">Sign in</Link>
        </>
      }
    >
      {done ? (
        <Done
          title="Thank you. We will be in touch."
          body={
            <>
              Someone from Apli.ai will write to {email.trim()} to set up {institutionName.trim() || `your ${noun}`}. It
              is free for your institution and your students. Your students can already sign up on their own.
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
            <p className="su-eyebrow">For universities and colleges · free</p>
            <h1>Bring Apli.ai to your campus</h1>
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
                <div className="su-seg" role="radiogroup" aria-label="Kind of institution">
                  {(
                    [
                      ['UNIVERSITY', 'University', 'With affiliated colleges'],
                      ['COLLEGE', 'College', 'A single or autonomous college'],
                    ] as const
                  ).map(([value, label, note]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={kind === value}
                      className={kind === value ? 'is-on' : ''}
                      onClick={() => setKind(value)}
                    >
                      <b>{label}</b>
                      <i>{note}</i>
                    </button>
                  ))}
                </div>
                <Field id="in-name" label={`Name of your ${noun}`} error={errors.institutionName}>
                  <input
                    id="in-name"
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                    autoComplete="organization"
                    autoFocus
                  />
                </Field>
                <div className="su-row">
                  <Field id="in-city" label="City" error={errors.city}>
                    <input id="in-city" value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" />
                  </Field>
                  <Field id="in-state" label="State" error={errors.state} optional>
                    <input id="in-state" value={state} onChange={(e) => setState(e.target.value)} autoComplete="address-level1" />
                  </Field>
                </div>
                <Field
                  id="in-students"
                  label="About how many students?"
                  error={errors.students}
                  hint="A rough number is fine."
                  optional
                >
                  <input
                    id="in-students"
                    inputMode="numeric"
                    value={students}
                    onChange={(e) => setStudents(e.target.value.replace(/\D/g, '').slice(0, 7))}
                  />
                </Field>
              </>
            )}

            {step === 1 && (
              <>
                <div className="su-row">
                  <Field id="in-person" label="Your full name" error={errors.contactName}>
                    <input
                      id="in-person"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      autoComplete="name"
                      autoFocus
                    />
                  </Field>
                  <Field id="in-role" label="Your role" error={errors.contactRole}>
                    <input
                      id="in-role"
                      value={contactRole}
                      onChange={(e) => setContactRole(e.target.value)}
                      placeholder="For example, Placement officer"
                      autoComplete="organization-title"
                    />
                  </Field>
                </div>
                <div className="su-row">
                  <Field id="in-email" label="Email" error={errors.email} hint="Your institution's address if you have one.">
                    <input id="in-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                  </Field>
                  <Field id="in-phone" label="Phone" error={errors.phone} optional>
                    <input id="in-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
                  </Field>
                </div>
                <Field id="in-message" label="Anything we should know?" error={errors.message} optional>
                  <textarea
                    id="in-message"
                    className="su-textarea"
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="For example, which courses you would like to start with"
                  />
                </Field>
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
            A student? <Link to="/register/student">Join free</Link> · A company?{' '}
            <Link to="/register/company">Partner with us</Link>
          </p>
        </form>
      )}
    </SignupFrame>
  );
}

/** The dark half: one class's progress, as a teacher would see it. */
function InstitutionSide() {
  return (
    <>
      <div className="su-scene">
        <div className="su-mini su-class">
          <div>
            <b>TE Computer · Division A</b>
            <i>Recommended: Data Analytics · sample</i>
          </div>
          <div className="su-class-bar">
            <span className="is-done" />
            <span className="is-going" />
          </div>
          <div className="su-class-key">
            {[
              ['is-done', 'Finished 29'],
              ['is-going', 'In progress 18'],
              ['', 'Not started 13'],
            ].map(([c, t], i) => (
              <span key={t} style={{ '--i': i } as CSSProperties}>
                <i className={c} /> {t}
              </span>
            ))}
          </div>
        </div>
      </div>
      <h2>Real experience for every student, at no cost</h2>
      <p>Recommend simulations to a class, see who finished, and count them towards NEP internship credits.</p>
      <p className="su-sample">Sample numbers from the demo.</p>
    </>
  );
}
