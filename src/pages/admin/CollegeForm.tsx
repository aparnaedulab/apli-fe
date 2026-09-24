import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api/client';

/**
 * Shown until the real value arrives, and only ever for the instant before it
 * does. The university this deployment is set up for is a server setting -
 * it also decides what "Yes" means in the bulk-upload spreadsheet, so the two
 * must not be able to disagree.
 */
const FALLBACK_UNIVERSITY = 'Savitribai Phule Pune University';

export interface CollegeFields {
  name: string;
  code: string;
  city: string;
  state: string;
  collegeTypeId: string;
  affiliation: string;
  address: string;
  pincode: string;
  naacGrade: string;
}

const EMPTY: CollegeFields = {
  name: '',
  code: '',
  city: '',
  state: 'Maharashtra',
  collegeTypeId: '',
  affiliation: FALLBACK_UNIVERSITY,
  address: '',
  pincode: '',
  naacGrade: '',
};

const NAAC = ['A++', 'A+', 'A', 'B++', 'B+', 'B', 'C'];

interface CollegeType {
  id: string;
  name: string;
  isActive: boolean;
  collegeCount: number;
}

export default function CollegeForm({
  initial,
  collegeId,
  onDone,
  onCancel,
  bare = false,
}: {
  initial?: Partial<CollegeFields>;
  collegeId?: string;
  onDone: () => void;
  onCancel?: () => void;
  /** Drops this component's own card and heading - see AddStudents. */
  bare?: boolean;
}) {
  const [f, setF] = useState<CollegeFields>({ ...EMPTY, ...initial });
  const [types, setTypes] = useState<CollegeType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [homeUniversity, setHomeUniversity] = useState(FALLBACK_UNIVERSITY);

  // Affiliation is a toggle because almost every college here belongs to the
  // same university; turning it off reveals a field for whatever it is instead.
  const [affiliated, setAffiliated] = useState(
    (initial?.affiliation ?? FALLBACK_UNIVERSITY) === FALLBACK_UNIVERSITY,
  );
  const [otherAffiliation, setOtherAffiliation] = useState(
    initial?.affiliation && initial.affiliation !== FALLBACK_UNIVERSITY
      ? initial.affiliation
      : '',
  );

  // Set once the server says what the university is called - but never over
  // the top of a choice the person editing has already made.
  const touchedAffiliation = useRef(false);

  useEffect(() => {
    let cancelled = false;

    api
      .get<{ homeUniversity: string }>('/admin/meta')
      .then(({ homeUniversity: name }) => {
        if (cancelled || !name) return;
        setHomeUniversity(name);

        if (touchedAffiliation.current) return;
        const current = initial?.affiliation;
        setAffiliated(current === undefined || current === null || current === name);
        setOtherAffiliation(current && current !== name ? current : '');
      })
      .catch(() => {
        // The fallback is already in place; a college form should not be
        // unusable because one settings call failed.
      });

    return () => {
      cancelled = true;
    };
  }, [initial?.affiliation]);

  const [addingType, setAddingType] = useState(false);
  const [newType, setNewType] = useState('');
  const [typeError, setTypeError] = useState<string | null>(null);

  async function loadTypes() {
    try {
      const { types: list } = await api.get<{ types: CollegeType[] }>('/admin/college-types');
      setTypes(list);
    } catch {
      setTypes([]);
    }
  }

  useEffect(() => {
    void loadTypes();
  }, []);

  const set =
    (k: keyof CollegeFields) =>
    (e: { target: { value: string } }) =>
      setF((p) => ({ ...p, [k]: e.target.value }));

  async function addType(e: FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    setTypeError(null);
    try {
      const { type } = await api.post<{ type: CollegeType }>('/admin/college-types', {
        name: newType,
      });
      await loadTypes();
      setF((p) => ({ ...p, collegeTypeId: type.id }));
      setNewType('');
      setAddingType(false);
    } catch (err) {
      setTypeError(err instanceof ApiError ? err.message : 'Could not add that type.');
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError(null);
    setFields({});
    setSaving(true);

    const payload = {
      ...f,
      affiliation: affiliated ? homeUniversity : otherAffiliation.trim(),
    };

    try {
      if (collegeId) await api.patch(`/admin/colleges/${collegeId}`, payload);
      else await api.post('/admin/colleges', payload);
      onDone();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.fields) setFields(Object.fromEntries(err.fields.map((x) => [x.path, x.message])));
      } else {
        setError('Could not save the college.');
      }
      setSaving(false);
    }
  }

  const Field = ({
    name,
    label,
    hint,
    ...rest
  }: {
    name: keyof CollegeFields;
    label: string;
    hint?: string;
  } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        value={f[name]}
        onChange={set(name)}
        disabled={saving}
        aria-invalid={Boolean(fields[name])}
        {...rest}
      />
      {fields[name] ? (
        <span className="field-error">{fields[name]}</span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </label>
  );

  return (
    <form className={bare ? 'bare-form' : 'card form-card'} onSubmit={onSubmit} noValidate>
      {!bare && <h2>{collegeId ? 'Edit college' : 'Add a college'}</h2>}
      {error && <p className="alert alert-error">{error}</p>}

      <fieldset className="form-section">
        <legend>Identity</legend>
        <div className="form-row">
          <Field
            name="name"
            label="College name"
            required
            autoFocus
            placeholder="Pune Institute of Computer Technology"
          />
          <Field
            name="code"
            label="Short code"
            required
            placeholder="PICT"
            hint="Unique. Used in tables and roll numbers."
          />
        </div>

        <div className="form-row">
          <label className="field">
            <span className="field-label">
              Type
              {!addingType && (
                <button
                  type="button"
                  className="field-toggle"
                  onClick={() => {
                    setAddingType(true);
                    setTypeError(null);
                  }}
                >
                  + Add new
                </button>
              )}
            </span>
            {addingType ? (
              <span className="inline-add">
                <input
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  placeholder="Polytechnic"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void addType(e);
                    if (e.key === 'Escape') setAddingType(false);
                  }}
                />
                <button type="button" className="btn btn-secondary" onClick={addType}>
                  Add
                </button>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    setAddingType(false);
                    setTypeError(null);
                  }}
                >
                  Cancel
                </button>
              </span>
            ) : (
              <select value={f.collegeTypeId} onChange={set('collegeTypeId')} disabled={saving}>
                <option value="">Not recorded</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            {typeError ? (
              <span className="field-error">{typeError}</span>
            ) : (
              <span className="field-hint">
                Managed under <b>Settings</b>. Anything added here is available everywhere.
              </span>
            )}
          </label>

          <label className="field">
            <span className="field-label">NAAC grade</span>
            <select value={f.naacGrade} onChange={set('naacGrade')} disabled={saving}>
              <option value="">Not recorded</option>
              {NAAC.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <span className="field-hint">Recruiters filter on this.</span>
          </label>
        </div>

        <div className="toggle-field">
          <label className="switch">
            <input
              type="checkbox"
              checked={affiliated}
              onChange={(e) => {
                touchedAffiliation.current = true;
                setAffiliated(e.target.checked);
              }}
              disabled={saving}
            />
            <span className="switch-track" aria-hidden="true">
              <span className="switch-thumb" />
            </span>
            <span className="switch-text">
              Affiliated to {homeUniversity}
              <span className="check-sub">
                {affiliated
                  ? 'The usual case for colleges on this platform.'
                  : 'Turn on if this college is affiliated to the university.'}
              </span>
            </span>
          </label>

          {!affiliated && (
            <label className="field">
              <span className="field-label">Affiliated to instead</span>
              <input
                value={otherAffiliation}
                onChange={(e) => setOtherAffiliation(e.target.value)}
                placeholder="Autonomous, or another university"
                disabled={saving}
              />
              <span className="field-hint">Leave blank if the college is autonomous.</span>
            </label>
          )}
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Where it is</legend>
        <div className="form-row">
          <Field name="city" label="City" required placeholder="Pune" />
          <Field name="state" label="State" required placeholder="Maharashtra" />
          <Field name="pincode" label="PIN code" placeholder="411043" />
        </div>
        <Field
          name="address"
          label="Address"
          placeholder="Survey No. 27, Dhankawadi"
          hint="Recruiters visiting for a campus drive need this."
        />
      </fieldset>

      <div className="btn-row">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : collegeId ? 'Save changes' : 'Create college'}
        </button>
        {onCancel && (
          <button type="button" className="link-btn" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
