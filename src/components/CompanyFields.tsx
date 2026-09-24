import { useState } from 'react';
import type { CompanySize } from '../api/company';
import './CompanyFields.css';

/**
 * The company profile form, once.
 *
 * Two screens collect it - a company registering itself, and operations
 * entering one by hand - and they were drifting apart: the admin form asked
 * for a name and a website while registration asked for fifteen fields, so the
 * same company looked complete on one screen and empty on the other. The
 * server has had one schema for both since the beginning; this is its
 * counterpart on the client.
 */

/** The enum is the contract; this wording is presentation, and lives only here. */
export const COMPANY_SIZES: { value: CompanySize; label: string }[] = [
  { value: 'STARTUP', label: '1–50 people' },
  { value: 'SMALL', label: '51–200 people' },
  { value: 'MID', label: '201–1,000 people' },
  { value: 'LARGE', label: '1,001–5,000 people' },
  { value: 'ENTERPRISE', label: 'More than 5,000 people' },
];

/** Not an id, so it cannot collide with one. */
const OTHER = 'other';

/** Mirrors companyRegistrationSchema on the server, which is what enforces it. */
const REGISTRATION_REQUIRED = [
  'name',
  'legalName',
  'industryId',
  'industryOther',
  'sizeBand',
  'foundedYear',
  'gstin',
  'cin',
  'address',
];

export const SIZE_LABEL: Record<CompanySize, string> = Object.fromEntries(
  COMPANY_SIZES.map((s) => [s.value, s.label]),
) as Record<CompanySize, string>;

export interface CompanyForm {
  name: string;
  legalName: string;
  industryId: string;
  /** Set only when the list has nothing that fits. */
  industryOther: string;
  sizeBand: string;
  foundedYear: string;
  gstin: string;
  cin: string;
  website: string;
  careersUrl: string;
  linkedinUrl: string;
  logoUrl: string;
  about: string;
  city: string;
  state: string;
  address: string;
  pincode: string;
}

export function emptyCompanyForm(overrides: Partial<CompanyForm> = {}): CompanyForm {
  return {
    name: '',
    legalName: '',
    industryId: '',
    industryOther: '',
    sizeBand: '',
    foundedYear: '',
    gstin: '',
    cin: '',
    website: '',
    careersUrl: '',
    linkedinUrl: '',
    logoUrl: '',
    about: '',
    city: '',
    // Most of this university's recruiters are in Maharashtra; it is a default,
    // not an assumption - the field is editable like any other.
    state: 'Maharashtra',
    address: '',
    pincode: '',
    ...overrides,
  };
}

/**
 * Blank means "not given". The server turns empty strings into NULL, but
 * sending `undefined` keeps a PATCH from touching fields nobody edited.
 */
export function toCompanyPayload(f: CompanyForm) {
  const text = (v: string) => (v.trim() ? v.trim() : undefined);
  return {
    name: f.name.trim(),
    legalName: text(f.legalName),
    industryId: text(f.industryId),
    industryOther: text(f.industryOther),
    sizeBand: (text(f.sizeBand) ?? undefined) as CompanySize | undefined,
    foundedYear: f.foundedYear.trim() ? Number(f.foundedYear) : undefined,
    gstin: text(f.gstin),
    cin: text(f.cin),
    website: text(f.website),
    careersUrl: text(f.careersUrl),
    linkedinUrl: text(f.linkedinUrl),
    logoUrl: text(f.logoUrl),
    about: text(f.about),
    city: text(f.city),
    state: text(f.state),
    address: text(f.address),
    pincode: text(f.pincode),
  };
}

export interface CompanyFieldsProps {
  value: CompanyForm;
  onChange: (next: CompanyForm) => void;
  industries: { id: string; name: string }[];
  /** Per-field messages from the server, keyed by field name. */
  errors?: Record<string, string>;
  disabled?: boolean;
  /** Operations already knows the company; a registrant is being told why we ask. */
  tone?: 'register' | 'admin';
}

export default function CompanyFields({
  value,
  onChange,
  industries,
  errors = {},
  disabled = false,
  tone = 'register',
}: CompanyFieldsProps) {
  const [other, setOther] = useState(Boolean(value.industryOther));
  /** Registration needs these; the same form used by operations does not. */
  const need = (field: string) =>
    tone === 'register' && REGISTRATION_REQUIRED.includes(field) ? (
      <em className="field-need">Required</em>
    ) : (
      <em className="field-opt">Optional</em>
    );
  const set = (k: keyof CompanyForm) => (v: string) => onChange({ ...value, [k]: v });

  const err = (name: string) =>
    errors[name] ? <span className="field-error">{errors[name]}</span> : null;

  const digits = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max);

  return (
    <>
      <label className="field">
        <span className="field-label">Company name {need('name')}</span>
        <input
          value={value.name}
          onChange={(e) => set('name')(e.target.value)}
          placeholder="Trellix Systems"
          required
          disabled={disabled}
        />
        <span className="field-hint">
          The name students will see. Use the one people recognise, not the registered entity.
        </span>
        {err('name')}
      </label>

      <div className="field-row">
        <label className="field">
          <span className="field-label">Registered name {need('legalName')}</span>
          <input
            value={value.legalName}
            onChange={(e) => set('legalName')(e.target.value)}
            placeholder="Trellix Systems India Private Limited"
            disabled={disabled}
          />
          {err('legalName')}
        </label>
        {/*
          The list is shared by every institution, so a company cannot add to
          it - but a company whose industry is missing has to be able to finish
          registering. It says what it does; operations either adds it to the
          list or points it at the industry that already covers it.
        */}
        <label className="field">
          <span className="field-label">Industry {need('industryId')}</span>
          <select
            value={other ? OTHER : value.industryId}
            onChange={(e) => {
              const picked = e.target.value === OTHER;
              setOther(picked);
              onChange({
                ...value,
                industryId: picked ? '' : e.target.value,
                industryOther: picked ? value.industryOther : '',
              });
            }}
            disabled={disabled}
          >
            <option value="">Choose one</option>
            {industries.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
            <option value={OTHER}>Other — tell us</option>
          </select>
          {err('industryId')}
        </label>
        {other && (
          <label className="field">
            <span className="field-label">Your industry {need('industryOther')}</span>
            <input
              value={value.industryOther}
              onChange={(e) => set('industryOther')(e.target.value)}
              placeholder="Agricultural machinery"
              disabled={disabled}
              autoFocus
            />
            <span className="field-hint">
              {tone === 'register'
                ? 'We add it to the list, or tell you which one already covers it. It does not hold up your registration.'
                : 'Operations resolves this against the shared list.'}
            </span>
            {err('industryOther')}
          </label>
        )}
      </div>

      <div className="field-row">
        <label className="field">
          <span className="field-label">Size {need('sizeBand')}</span>
          <select
            value={value.sizeBand}
            onChange={(e) => set('sizeBand')(e.target.value)}
            disabled={disabled}
          >
            <option value="">Choose one</option>
            {COMPANY_SIZES.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Founded {need('foundedYear')}</span>
          <input
            value={value.foundedYear}
            onChange={(e) => set('foundedYear')(digits(e.target.value, 4))}
            placeholder="2018"
            inputMode="numeric"
            disabled={disabled}
          />
          {err('foundedYear')}
        </label>
      </div>

      <fieldset className="field-group" disabled={disabled}>
        <legend>
          Registration
          <span className="field-hint">
            {tone === 'register'
              ? 'This is what the university checks you against, so both are asked for up front.'
              : 'What a reviewer checks the company against. Worth filling in even for a recruiter you already know.'}
          </span>
        </legend>
        <div className="field-row">
          <label className="field">
            <span className="field-label">GSTIN {need('gstin')}</span>
            <input
              value={value.gstin}
              onChange={(e) => set('gstin')(e.target.value.toUpperCase())}
              placeholder="27AABCT1332L1ZT"
              maxLength={15}
              className="mono"
            />
            {err('gstin')}
          </label>
          <label className="field">
            <span className="field-label">CIN {need('cin')}</span>
            <input
              value={value.cin}
              onChange={(e) => set('cin')(e.target.value.toUpperCase())}
              placeholder="U72900PN2018PTC176543"
              maxLength={21}
              className="mono"
            />
            {err('cin')}
          </label>
        </div>
      </fieldset>

      <div className="field-row">
        <label className="field">
          <span className="field-label">Website {need('website')}</span>
          <input
            value={value.website}
            onChange={(e) => set('website')(e.target.value)}
            placeholder="https://example.com"
            disabled={disabled}
          />
          {err('website')}
        </label>
        {/*
          A careers page, LinkedIn and a logo say nothing about whether a
          company is real, and registration already asks for the things that
          do. They belong on the company's own page, which it fills in once it
          is inside - asking twice is what makes a sign-up feel like a form.
        */}
        {tone === 'admin' && (
          <label className="field">
            <span className="field-label">Careers page {need('careersUrl')}</span>
            <input
              value={value.careersUrl}
              onChange={(e) => set('careersUrl')(e.target.value)}
              placeholder="https://example.com/careers"
              disabled={disabled}
            />
            {err('careersUrl')}
          </label>
        )}
      </div>

      {tone === 'admin' && (
        <div className="field-row">
          <label className="field">
            <span className="field-label">LinkedIn {need('linkedinUrl')}</span>
            <input
              value={value.linkedinUrl}
              onChange={(e) => set('linkedinUrl')(e.target.value)}
              placeholder="https://linkedin.com/company/example"
              disabled={disabled}
            />
            {err('linkedinUrl')}
          </label>
          <label className="field">
            <span className="field-label">Logo URL {need('logoUrl')}</span>
            <input
              value={value.logoUrl}
              onChange={(e) => set('logoUrl')(e.target.value)}
              placeholder="https://example.com/logo.png"
              disabled={disabled}
            />
            {err('logoUrl')}
          </label>
        </div>
      )}

      <label className="field">
        <span className="field-label">Head office address {need('address')}</span>
        <input
          value={value.address}
          onChange={(e) => set('address')(e.target.value)}
          placeholder="Level 4, Amar Tech Park, Balewadi"
          disabled={disabled}
        />
        {err('address')}
      </label>

      <div className="field-row">
        <label className="field">
          <span className="field-label">City {need('city')}</span>
          <input
            value={value.city}
            onChange={(e) => set('city')(e.target.value)}
            disabled={disabled}
          />
        </label>
        <label className="field">
          <span className="field-label">State {need('state')}</span>
          <input
            value={value.state}
            onChange={(e) => set('state')(e.target.value)}
            disabled={disabled}
          />
        </label>
        <label className="field">
          <span className="field-label">PIN code {need('pincode')}</span>
          <input
            value={value.pincode}
            onChange={(e) => set('pincode')(digits(e.target.value, 6))}
            inputMode="numeric"
            placeholder="411045"
            disabled={disabled}
          />
          {err('pincode')}
        </label>
      </div>

      <label className="field">
        <span className="field-label">What they do {need('about')}</span>
        <textarea
          value={value.about}
          onChange={(e) => set('about')(e.target.value)}
          rows={3}
          placeholder="One or two sentences. Students read this before they apply."
          disabled={disabled}
        />
        {err('about')}
      </label>
    </>
  );
}
