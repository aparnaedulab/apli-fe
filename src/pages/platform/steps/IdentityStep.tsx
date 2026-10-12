import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../../../api/client';
import { platformApi, type IdentityInput } from '../../../api/platform';
import { monogram } from '../../../lib/brand';
import type { StepProps } from '../Onboarding';
import { Field, ImageUpload, StepFooter, fieldErrors } from '../ui';

/**
 * Only universities are onboarded for now. Single colleges and groups are
 * supported underneath - the data model and the rest of the wizard handle
 * them - but are held back from new onboardings until they have been tried
 * with a real customer. An institution already saved as one keeps its type.
 */
const blank: IdentityInput = {
  name: '',
  shortName: '',
  slug: '',
  kind: 'UNIVERSITY',
  legalName: '',
  website: '',
  logoUrl: '',
  faviconUrl: '',
  brandColor: '#1d3b8b',
  tagline: '',
  city: '',
  state: '',
  address: '',
  pincode: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  supportEmail: '',
  supportPhone: '',
  supportAltPhone: '',
  supportWhatsapp: '',
  officeHours: '',
};

/** "Savitribai Phule Pune University" → "SPPU". */
function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w) && !/^(of|and|the|for|&)$/i.test(w));
  return words.length >= 2 ? words.map((w) => w[0]!.toUpperCase()).join('').slice(0, 6) : '';
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

type SlugStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'ok' }
  | { state: 'taken'; suggestion: string | null }
  | { state: 'invalid'; message: string };

export default function IdentityStep({ state, catalogue, onSaved }: StepProps) {
  const t = state?.tenant;
  const [form, setForm] = useState<IdentityInput>(() =>
    t
      ? {
          name: t.name,
          shortName: t.shortName ?? '',
          slug: t.slug,
          kind: t.kind,
          legalName: t.legalName ?? '',
          website: t.website ?? '',
          logoUrl: t.logoUrl ?? '',
          faviconUrl: t.faviconUrl ?? '',
          brandColor: t.brandColor,
          tagline: t.tagline ?? '',
          city: t.city ?? '',
          state: t.state ?? '',
          address: t.address ?? '',
          pincode: t.pincode ?? '',
          contactName: t.contactName ?? '',
          contactEmail: t.contactEmail ?? '',
          contactPhone: t.contactPhone ?? '',
          supportEmail: t.supportEmail ?? '',
          supportPhone: t.supportPhone ?? '',
          supportAltPhone: t.supportAltPhone ?? '',
          supportWhatsapp: t.supportWhatsapp ?? '',
          officeHours: t.officeHours ?? '',
        }
      : blank,
  );

  // Derived fields follow the name until somebody types in them - then they
  // are theirs, and the name stops overwriting them.
  const touched = useRef({ shortName: Boolean(t?.shortName), slug: Boolean(t) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slug, setSlug] = useState<SlugStatus>({ state: 'idle' });
  const locked = Boolean(t?.launchedAt);

  function set<K extends keyof IdentityInput>(key: K, value: IdentityInput[K]) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === 'name') {
        if (!touched.current.shortName) next.shortName = initials(String(value));
        if (!touched.current.slug) next.slug = slugify(next.shortName || String(value));
      }
      if (key === 'shortName' && !touched.current.slug) next.slug = slugify(String(value) || next.name);
      return next;
    });
    setErrors((e) => ({ ...e, [key]: '' }));
  }

  // Address availability, checked as it is typed rather than on submit.
  useEffect(() => {
    if (!form.slug || locked) {
      setSlug({ state: 'idle' });
      return;
    }
    setSlug({ state: 'checking' });
    const handle = window.setTimeout(() => {
      platformApi
        .checkSlug(form.slug, t?.id)
        .then((r) => {
          if (!r.valid) setSlug({ state: 'invalid', message: r.message ?? 'Not a usable address.' });
          else if (r.available) setSlug({ state: 'ok' });
          else setSlug({ state: 'taken', suggestion: r.suggestion ?? null });
        })
        .catch(() => setSlug({ state: 'idle' }));
    }, 350);
    return () => window.clearTimeout(handle);
  }, [form.slug, t?.id, locked]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (t) {
        const next = await platformApi.saveIdentity(t.id, form);
        onSaved(next, 'colleges');
      } else {
        const { tenant } = await platformApi.create(form);
        const next = await platformApi.state(tenant.id);
        onSaved(next, 'colleges');
      }
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(err instanceof ApiError ? err.message : 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <section className="blk">
        <h2 className="blk-title">Name and place</h2>
        <div className="grid">
          <Field label="Full name" error={errors.name} wide>
            {(id) => (
              <input
                id={id}
                className="input input-lg"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Savitribai Phule Pune University"
                autoFocus={!t}
                autoComplete="off"
              />
            )}
          </Field>
          <Field label="Short name" hint="What students actually call it." error={errors.shortName} optional>
            {(id) => (
              <input
                id={id}
                className="input"
                value={form.shortName}
                onChange={(e) => {
                  touched.current.shortName = true;
                  set('shortName', e.target.value);
                }}
                placeholder="SPPU"
              />
            )}
          </Field>
          <Field
            label="Portal address"
            error={errors.slug}
            hint={
              locked ? (
                'Live institutions keep their address - it is already printed and bookmarked.'
              ) : (
                <SlugHint status={slug} onUse={(s) => ((touched.current.slug = true), set('slug', s))} slug={form.slug} />
              )
            }
          >
            {(id) => (
              <div className="affix">
                <span className="affix-pre portal-base" title={`${catalogue.portalBase}/t/`}>
                  {catalogue.portalBase}/t/
                </span>
                <input
                  id={id}
                  className="input input-mono"
                  value={form.slug}
                  disabled={locked}
                  onChange={(e) => {
                    touched.current.slug = true;
                    set('slug', slugify(e.target.value) + (e.target.value.endsWith('-') ? '-' : ''));
                  }}
                  spellCheck={false}
                />
              </div>
            )}
          </Field>
          <Field label="City" error={errors.city} optional>
            {(id) => (
              <input id={id} className="input" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Pune" />
            )}
          </Field>
          <Field label="State" error={errors.state} optional>
            {(id) => (
              <>
                <input
                  id={id}
                  className="input"
                  list="ob-states"
                  value={form.state}
                  onChange={(e) => set('state', e.target.value)}
                  placeholder="Maharashtra"
                />
                <datalist id="ob-states">
                  {catalogue.states.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field label="Website" error={errors.website} optional>
            {(id) => (
              <input id={id} className="input" value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://" />
            )}
          </Field>
        </div>
      </section>

      <section className="blk">
        <h2 className="blk-title">How their portal looks</h2>
        <p className="blk-sub">Optional. Their logo, shown on their portal.</p>
        <div className="grid">
          <Field label="Logo" error={errors.logoUrl} optional>
            {() => (
              <ImageUpload
                value={form.logoUrl}
                onChange={(v) => set('logoUrl', v)}
                upload={(file) => platformApi.uploadImage('logo', file).then((r) => r.url)}
                accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                hint="Square PNG or SVG, up to 2 MB. Without one we use their initials."
                fallback={
                  <span className="logo-well" style={{ background: form.brandColor, border: 0 }}>
                    {monogram(form.name || 'New Institution', form.shortName)}
                  </span>
                }
              />
            )}
          </Field>
        </div>
      </section>

      <section className="blk">
        <h2 className="blk-title">Who we talk to there</h2>
        <p className="blk-sub">
          Our contact at the university. Private, and not a login.
        </p>
        <div className="grid">
          <Field label="Name" error={errors.contactName}>
            {(id) => (
              <input id={id} className="input" value={form.contactName} onChange={(e) => set('contactName', e.target.value)} placeholder="Dr. A. Kulkarni" />
            )}
          </Field>
          <Field label="Email" error={errors.contactEmail}>
            {(id) => (
              <input
                id={id}
                type="email"
                className="input"
                value={form.contactEmail}
                onChange={(e) => set('contactEmail', e.target.value)}
                placeholder="registrar@demo-university.example"
              />
            )}
          </Field>
          <Field label="Phone" error={errors.contactPhone} optional>
            {(id) => (
              <input id={id} type="tel" className="input" value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} />
            )}
          </Field>
        </div>
      </section>

      <StepFooter busy={busy} error={error} submitLabel={t ? 'Save & continue' : 'Create & continue'} note={t ? null : 'Nothing is visible to anyone until you launch.'} />
    </form>
  );
}

function SlugHint({ status, onUse, slug }: { status: SlugStatus; onUse: (s: string) => void; slug: string }) {
  switch (status.state) {
    case 'checking':
      return <span className="slug slug-wait">Checking /t/{slug}…</span>;
    case 'ok':
      return <span className="slug slug-ok">✓ /t/{slug} is free</span>;
    case 'taken':
      return (
        <span className="slug slug-bad">
          Taken.
          {status.suggestion && (
            <>
              {' '}
              <button type="button" className="linkish" onClick={() => onUse(status.suggestion!)}>
                Use /t/{status.suggestion}
              </button>
            </>
          )}
        </span>
      );
    case 'invalid':
      return <span className="slug slug-bad">{status.message}</span>;
    default:
      return <span>Where their people sign in. Lower case, no spaces.</span>;
  }
}
