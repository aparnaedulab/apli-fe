import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { ApiError } from '../../api/client';
import {
  platformApi,
  type Catalogue,
  type IdentityInput,
  type OnboardingState,
  type TenantRecord,
} from '../../api/platform';
import { initials } from './steps';

/**
 * The institution's details, one question at a time.
 *
 * Somebody setting up their first university should never face a page of
 * fields. Each screen asks one thing, Enter moves on, and the portal being
 * made builds itself underneath as they answer - so they can see what every
 * answer is for.
 */

type Errors = Partial<Record<keyof IdentityInput | 'form', string>>;

const SWATCHES = ['#1d3b8b', '#2453ff', '#0f7a57', '#7a1f5c', '#b4441e', '#0e7490', '#1f2937'];

type QuestionKey = 'name' | 'place' | 'address' | 'look' | 'contact';

/** Which question asks for each field, so a server error can send people back to it. */
const FIELD_AT: Partial<Record<keyof IdentityInput, QuestionKey>> = {
  name: 'name',
  shortName: 'name',
  city: 'place',
  state: 'place',
  slug: 'address',
  website: 'address',
  logoUrl: 'look',
  brandColor: 'look',
  contactName: 'contact',
  contactEmail: 'contact',
  contactPhone: 'contact',
};

function identityFrom(t: TenantRecord | null): IdentityInput {
  return {
    name: t?.name ?? '',
    shortName: t?.shortName ?? '',
    slug: t?.slug ?? '',
    // Apli.ai sets up universities; colleges are added under them.
    kind: t?.kind ?? 'UNIVERSITY',
    legalName: t?.legalName ?? '',
    website: t?.website ?? '',
    logoUrl: t?.logoUrl ?? '',
    faviconUrl: t?.faviconUrl ?? '',
    brandColor: t?.brandColor ?? '#1d3b8b',
    tagline: t?.tagline ?? '',
    city: t?.city ?? '',
    state: t?.state ?? '',
    address: t?.address ?? '',
    pincode: t?.pincode ?? '',
    contactName: t?.contactName ?? '',
    contactEmail: t?.contactEmail ?? '',
    contactPhone: t?.contactPhone ?? '',
    supportEmail: t?.supportEmail ?? '',
    supportPhone: t?.supportPhone ?? '',
    supportAltPhone: t?.supportAltPhone ?? '',
    supportWhatsapp: t?.supportWhatsapp ?? '',
    officeHours: t?.officeHours ?? '',
  };
}

export default function InstitutionFlow({
  catalogue,
  tenant,
  onSaved,
}: {
  catalogue: Catalogue;
  tenant: TenantRecord | null;
  onSaved: (tenantId: string, fresh?: OnboardingState) => void;
}) {
  const [form, setForm] = useState<IdentityInput>(() => identityFrom(tenant));
  const [errors, setErrors] = useState<Errors>({});
  const [at, setAt] = useState(0);
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  // The address follows the name until somebody types one of their own.
  const [slugTouched, setSlugTouched] = useState(Boolean(tenant));
  const [slugNote, setSlugNote] = useState<{ ok: boolean; text: string } | null>(null);
  const stage = useRef<HTMLDivElement>(null);

  const set = <K extends keyof IdentityInput>(k: K, v: IdentityInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined, form: undefined }));
  };

  useEffect(() => {
    if (slugTouched) return;
    const base = (form.shortName || initials(form.name) || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    setForm((f) => ({ ...f, slug: base.replace(/^-+|-+$/g, '') }));
  }, [form.name, form.shortName, slugTouched]);

  useEffect(() => {
    if (form.slug.length < 3) {
      setSlugNote(null);
      return;
    }
    const t = setTimeout(() => {
      platformApi
        .checkSlug(form.slug, tenant?.id)
        .then((r) =>
          setSlugNote(
            r.valid && r.available
              ? { ok: true, text: 'Free to use' }
              : { ok: false, text: r.message ?? (r.suggestion ? `Taken. Try ${r.suggestion}.` : 'Already taken.') },
          ),
        )
        .catch(() => setSlugNote(null));
    }, 300);
    return () => clearTimeout(t);
  }, [form.slug, tenant?.id]);

  // Each new question puts the cursor in its first box.
  useEffect(() => {
    const el = stage.current?.querySelector<HTMLElement>('input:not([type=file]):not([type=color]), select');
    el?.focus({ preventScroll: true });
  }, [at]);

  async function upload(file: File) {
    setUploading(true);
    try {
      const { url } = await platformApi.uploadImage('logo', file);
      set('logoUrl', url);
    } catch (e) {
      setErrors((x) => ({ ...x, logoUrl: e instanceof ApiError ? e.message : 'Could not upload that image.' }));
    } finally {
      setUploading(false);
    }
  }

  const base = catalogue.portalBase.replace(/^https?:\/\//, '');
  const mark = (form.shortName || initials(form.name) || '?').slice(0, 2).toUpperCase();
  const short = form.shortName || form.name;

  const questions: { key: QuestionKey; ask: string; help?: string; check: () => Errors; body: ReactNode }[] = [
    {
      key: 'name',
      ask: 'What is the university called?',
      help: 'The full name as it appears on certificates, and what people call it day to day.',
      check: () => (form.name.trim().length < 3 ? { name: 'Enter the full name.' } : {}),
      body: (
        <div className="gf-fields">
          <Box label="Full name" error={errors.name} big>
            <input
              value={form.name}
              placeholder="Sample State University"
              onChange={(e) => set('name', e.target.value)}
            />
          </Box>
          <Box label="Short name" hint="Optional · e.g. the initials" error={errors.shortName}>
            <input value={form.shortName} placeholder="SSU" onChange={(e) => set('shortName', e.target.value)} />
          </Box>
        </div>
      ),
    },
    {
      key: 'place',
      ask: `Where is ${short || 'it'}?`,
      check: () => ({
        ...(form.city.trim().length < 2 ? { city: 'Enter the city.' } : {}),
        ...(!form.state ? { state: 'Choose the state.' } : {}),
      }),
      body: (
        <div className="gf-fields is-pair">
          <Box label="City" error={errors.city}>
            <input value={form.city} placeholder="Pune" onChange={(e) => set('city', e.target.value)} />
          </Box>
          <Box label="State" error={errors.state}>
            <select value={form.state} onChange={(e) => set('state', e.target.value)}>
              <option value="">Choose…</option>
              {catalogue.states.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Box>
        </div>
      ),
    },
    {
      key: 'address',
      ask: 'Where will its portal live?',
      help: 'Its students and colleges sign in here. We suggested one from the name; change it if you like.',
      check: () =>
        form.slug.length < 3
          ? { slug: 'Use at least 3 characters.' }
          : slugNote && !slugNote.ok
            ? { slug: slugNote.text }
            : {},
      body: (
        <div className="gf-fields">
          <Box label="Portal address" error={errors.slug ?? (slugNote && !slugNote.ok ? slugNote.text : undefined)} big>
            <div className={`gf-url ${slugNote?.ok ? 'is-ok' : ''}`}>
              <span>{base}/t/</span>
              <input
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'));
                }}
                aria-label="Portal address"
              />
              {slugNote?.ok && <em>✓ {slugNote.text}</em>}
            </div>
          </Box>
          <Box label="Its own website" hint="Optional" error={errors.website}>
            <input value={form.website} placeholder="https://" onChange={(e) => set('website', e.target.value)} />
          </Box>
        </div>
      ),
    },
    {
      key: 'look',
      ask: 'Make it look like theirs',
      help: 'Optional. A logo and one colour, used across their portal. You can skip this.',
      check: () => ({}),
      body: (
        <div className="gf-look">
          <label className="gf-upload">
            <span className="gf-mark" style={{ background: form.brandColor }}>
              {form.logoUrl ? <img src={form.logoUrl} alt="" /> : mark}
            </span>
            <span>
              <b>{uploading ? 'Uploading…' : form.logoUrl ? 'Change the logo' : 'Upload a logo'}</b>
              <small>PNG, JPG or SVG</small>
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              hidden
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
          </label>
          {errors.logoUrl && <p className="gf-error">{errors.logoUrl}</p>}
          <div className="gf-swatches" role="radiogroup" aria-label="Colour">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={form.brandColor.toLowerCase() === c}
                className={form.brandColor.toLowerCase() === c ? 'is-on' : ''}
                style={{ background: c }}
                onClick={() => set('brandColor', c)}
                aria-label={`Colour ${c}`}
              />
            ))}
            <label className="gf-any" title="Any colour">
              <input type="color" value={form.brandColor} onChange={(e) => set('brandColor', e.target.value)} />
              <span>Other</span>
            </label>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      ask: 'Who do we talk to there?',
      help: 'Your contact at the institution. This does not give them a login.',
      check: () => ({
        ...(form.contactName.trim().length < 2 ? { contactName: 'Enter their name.' } : {}),
        ...(!/^\S+@\S+\.\S+$/.test(form.contactEmail.trim()) ? { contactEmail: 'Enter a valid email address.' } : {}),
      }),
      body: (
        <div className="gf-fields">
          <Box label="Name" error={errors.contactName} big>
            <input value={form.contactName} placeholder="Full name" onChange={(e) => set('contactName', e.target.value)} />
          </Box>
          <div className="gf-fields is-pair">
            <Box label="Email" error={errors.contactEmail}>
              <input
                type="email"
                value={form.contactEmail}
                placeholder="name@institution.example"
                onChange={(e) => set('contactEmail', e.target.value)}
              />
            </Box>
            <Box label="Phone" hint="Optional" error={errors.contactPhone}>
              <input value={form.contactPhone} placeholder="+91" onChange={(e) => set('contactPhone', e.target.value)} />
            </Box>
          </div>
        </div>
      ),
    },
  ];

  const last = questions.length - 1;
  const q = questions[at]!;

  function move(by: number) {
    setDir(by > 0 ? 'fwd' : 'back');
    setAt((i) => Math.max(0, Math.min(last, i + by)));
  }

  function jump(i: number) {
    setDir(i > at ? 'fwd' : 'back');
    setAt(i);
  }

  async function next(e?: FormEvent) {
    e?.preventDefault();
    const found = q.check();
    if (Object.keys(found).length) {
      setErrors((x) => ({ ...x, ...found }));
      return;
    }
    if (at < last) {
      move(1);
      return;
    }
    await save();
  }

  async function save() {
    setSaving(true);
    setErrors({});
    try {
      if (tenant) onSaved(tenant.id, await platformApi.saveIdentity(tenant.id, form));
      else onSaved((await platformApi.create(form)).tenant.id);
    } catch (err) {
      setSaving(false);
      if (err instanceof ApiError && err.fields?.length) {
        const found: Errors = {};
        for (const f of err.fields) found[(f.path.split('.').pop() ?? f.path) as keyof IdentityInput] = f.message;
        setErrors(found);
        // Back to the first question holding a problem.
        const firstBad = questions.findIndex((x) =>
          Object.keys(found).some((k) => FIELD_AT[k as keyof IdentityInput] === x.key),
        );
        if (firstBad >= 0) jump(firstBad);
      } else {
        setErrors({ form: err instanceof ApiError ? err.message : 'Could not save. Check your connection and try again.' });
      }
    }
  }

  // Enter in a text box moves on; Shift+Enter or a select keeps the usual behaviour.
  function onKey(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key === 'Enter' && !e.shiftKey && (e.target as HTMLElement).tagName === 'INPUT') {
      e.preventDefault();
      void next();
    }
  }

  return (
    <form className="gf" onSubmit={next} onKeyDown={onKey} noValidate>
      <div className={`gf-stage is-${dir}`} key={q.key} ref={stage}>
        <p className="gf-count">
          {at + 1} of {questions.length}
        </p>
        <h2 className="gf-ask">{q.ask}</h2>
        {q.help && <p className="gf-help">{q.help}</p>}
        <div className="gf-body">{q.body}</div>
      </div>

      {errors.form && (
        <p className="notice notice-stop gf-alert" role="alert">
          {errors.form}
        </p>
      )}

      <div className="gf-nav">
        {at > 0 ? (
          <button type="button" className="btn btn-ghost" onClick={() => move(-1)}>
            ← Back
          </button>
        ) : (
          <span />
        )}
        <button type="submit" className="btn btn-primary gf-next" disabled={saving}>
            {at < last
              ? q.key === 'look' && !form.logoUrl
                ? 'Skip for now →'
                : 'Continue'
              : saving
                ? 'Saving…'
                : tenant
                  ? 'Save and go to colleges →'
                  : `Create ${short || 'it'} →`}
          </button>
      </div>

      <Portal form={form} mark={mark} base={base} />
    </form>
  );
}

function Box({
  label,
  hint,
  error,
  big,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  big?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`gf-box ${big ? 'is-big' : ''} ${error ? 'has-error' : ''}`}>
      <span className="gf-label">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      {children}
      {error && <span className="gf-error">{error}</span>}
    </label>
  );
}

/** A small card of the institution as it will appear, from the answers so far. */
function Portal({ form, mark, base }: { form: IdentityInput; mark: string; base: string }) {
  return (
    <div className="gf-portal" aria-label="Preview">
      <span className="gf-mark" style={{ background: form.brandColor }}>
        {form.logoUrl ? <img src={form.logoUrl} alt="" /> : mark}
      </span>
      <div>
        <b className={form.name ? '' : 'is-blank'}>{form.name || 'Institution name'}</b>
        <small>
          {[form.city, form.state].filter(Boolean).join(', ') || 'City, State'} · {base}/t/{form.slug || '…'}
        </small>
      </div>
    </div>
  );
}
