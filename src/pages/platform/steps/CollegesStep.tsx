import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../../../api/client';
import GrowableSelect from '../../../components/GrowableSelect';
import { platformApi, type CollegeForm, type CollegeRow, type OfficerOutcome } from '../../../api/platform';
import type { StepProps } from '../Onboarding';
import { Field, Segmented, StepFooter, Toggle, fieldErrors } from '../ui';
import { BulkColleges } from './BulkAdd';

/** "Pune Institute of Computer Technology" → "PICT". */
function suggestCode(name: string): string {
  const words = name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w) && !/^(of|and|the|for|&)$/i.test(w));
  return words.map((w) => w[0]!.toUpperCase()).join('').slice(0, 8);
}

/**
 * The colleges, one at a time.
 *
 * The same shape as adding a course: the list of what is there, and an "Add a
 * college" form that holds every detail a college has. Each college is saved
 * - and checked - on its own, so a clashing code or a bad PIN shows up on the
 * college it belongs to.
 */
export default function CollegesStep({ state, catalogue, onSaved, goto, updateCatalogue }: StepProps) {
  const t = state!.tenant;
  const single = t.kind === 'COLLEGE';
  const colleges = state!.colleges;

  // Straight into the form when there is nothing yet to list.
  const [editing, setEditing] = useState<CollegeRow | 'new' | null>(colleges.length === 0 ? 'new' : null);
  const [notice, setNotice] = useState<{ college: string; officer: OfficerOutcome } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bulk, setBulk] = useState(false);

  async function remove(c: CollegeRow) {
    setError(null);
    try {
      const next = await platformApi.deleteCollege(t.id, c.id);
      onSaved(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove that college.');
    }
  }

  function next(e: FormEvent) {
    e.preventDefault();
    if (colleges.length === 0) {
      setError(single ? 'Add the college first.' : 'Add at least one college.');
      return;
    }
    goto('mapping');
  }

  return (
    <form onSubmit={next} noValidate>
      <section className="blk">
        <div className="blk-head">
          <div>
            <h2 className="blk-title">{single ? 'The college' : 'Colleges'}</h2>
            <p className="blk-sub">
              {colleges.length === 0
                ? 'Add each college with its details. You can invite its placement officer at the same time.'
                : `${colleges.length} college${colleges.length === 1 ? '' : 's'} · ${colleges.filter((c) => c.officer).length} with a placement officer`}
            </p>
          </div>
          <span className="blk-actions">
            {!single && !bulk && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setBulk(true);
                  setEditing(null);
                }}
              >
                Bulk upload (Excel)
              </button>
            )}
            {editing === null && !(single && colleges.length > 0) && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setEditing('new');
                  setBulk(false);
                }}
              >
                + Add a college
              </button>
            )}
          </span>
        </div>

        {notice && (
          <div className="notice ob-in" role="status">
            <span>
              <strong>{notice.college}</strong> saved.
              {notice.officer && ` ${officerLine(notice.officer)}`}
            </span>
            {notice.officer?.status === 'link' && <CopyLink link={notice.officer.link} />}
            <button type="button" className="icon-btn" onClick={() => setNotice(null)} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}

        {bulk && (
          <BulkColleges
            tenantId={t.id}
            onClose={() => setBulk(false)}
            onDone={(saved) => {
              onSaved(saved);
            }}
          />
        )}

        {editing !== null && (
          <CollegeEditor
            key={editing === 'new' ? 'new' : editing.id}
            tenantId={t.id}
            tenantName={t.name}
            tenantCity={t.city ?? ''}
            tenantState={t.state ?? ''}
            college={editing === 'new' ? null : editing}
            seedName={single && colleges.length === 0 ? t.name : ''}
            seedCode={single && colleges.length === 0 ? (t.shortName ?? '') : ''}
            catalogue={catalogue}
            updateCatalogue={updateCatalogue}
            onCancel={colleges.length > 0 || editing !== 'new' ? () => setEditing(null) : undefined}
            onSaved={(saved, officer, name) => {
              onSaved(saved);
              setNotice({ college: name, officer });
              setEditing(null);
            }}
          />
        )}

        {colleges.length > 0 && (
          <ul className="college-list">
            {colleges.map((c) => (
              <li key={c.id} className={editing !== null && editing !== 'new' && editing.id === c.id ? 'is-editing' : ''}>
                <span className="college-code">{c.code}</span>
                <span className="college-main">
                  <strong>
                    {c.name}
                    {c.isVerified && (
                      <span className="pill pill-pass" title="Checked by the platform team">
                        Verified
                      </span>
                    )}
                  </strong>
                  <small>
                    {[c.city, c.state].filter(Boolean).join(', ')}
                    {c.naacGrade ? ` · NAAC ${c.naacGrade}` : ''}
                    {` · ${c.affiliation ? `Affiliated to ${c.affiliation}` : 'Autonomous'}`}
                  </small>
                </span>
                <span className="college-officer">
                  {c.officer ? (
                    <>
                      <span className={`pill ${c.officer.status === 'active' ? 'pill-pass' : 'pill-hold'}`}>
                        {c.officer.status === 'active' ? 'Officer active' : 'Officer invited'}
                      </span>
                      <small>{c.officer.email}</small>
                    </>
                  ) : (
                    <small className="muted">No placement officer</small>
                  )}
                </span>
                <span className="row-tools">
                  <button type="button" className="linkish" onClick={() => setEditing(c)}>
                    Edit
                  </button>
                  {c.students === 0 && (
                    <button type="button" className="icon-btn" onClick={() => remove(c)} aria-label={`Remove ${c.name}`} title="Remove">
                      ×
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <StepFooter
        busy={false}
        error={error}
        onBack={() => goto('academics')}
        submitLabel="Continue to batches"
        note={colleges.length ? `${colleges.length} college${colleges.length === 1 ? '' : 's'}` : null}
      />
    </form>
  );
}

function officerLine(o: NonNullable<OfficerOutcome>): string {
  switch (o.status) {
    case 'emailed':
      return `Invitation emailed to ${o.email}.`;
    case 'link':
      return `No email was sent - share the invite link with ${o.email}.`;
    case 'already invited':
      return `${o.email} was already invited.`;
    case 'active':
      return `${o.email} is already the placement officer.`;
    case 'failed':
      return `Could not invite ${o.email}: ${o.note}`;
  }
}

/* -------------------------------------------------------------------------- */
/* The form                                                                    */
/* -------------------------------------------------------------------------- */

type SavedState = Awaited<ReturnType<typeof platformApi.createCollege>>;

function CollegeEditor({
  tenantId,
  tenantName,
  tenantCity,
  tenantState,
  college,
  seedName,
  seedCode,
  catalogue,
  updateCatalogue,
  onCancel,
  onSaved,
}: {
  tenantId: string;
  tenantName: string;
  tenantCity: string;
  tenantState: string;
  college: CollegeRow | null;
  seedName: string;
  seedCode: string;
  catalogue: StepProps['catalogue'];
  updateCatalogue: StepProps['updateCatalogue'];
  onCancel?: () => void;
  onSaved: (state: SavedState, officer: OfficerOutcome, name: string) => void;
}) {
  const [form, setForm] = useState<CollegeForm>(() =>
    college
      ? {
          name: college.name,
          code: college.code,
          collegeTypeId: college.collegeTypeId ?? '',
          affiliation: !college.affiliation
            ? 'AUTONOMOUS'
            : college.affiliation === tenantName
              ? 'THIS_UNIVERSITY'
              : 'OTHER',
          affiliationName: college.affiliation && college.affiliation !== tenantName ? college.affiliation : '',
          city: college.city,
          state: college.state,
          address: college.address ?? '',
          pincode: college.pincode ?? '',
          naacGrade: college.naacGrade ?? '',
          isVerified: college.isVerified,
          officerName: college.officer?.name ?? '',
          officerEmail: college.officer?.email ?? '',
        }
      : {
          name: seedName,
          code: seedCode.toUpperCase().replace(/[^A-Z0-9.-]/g, ''),
          collegeTypeId: '',
          affiliation: 'THIS_UNIVERSITY',
          affiliationName: '',
          city: tenantCity,
          state: tenantState,
          address: '',
          pincode: '',
          naacGrade: '',
          isVerified: false,
          officerName: '',
          officerEmail: '',
        },
  );
  const [codeTouched, setCodeTouched] = useState(Boolean(college || seedCode));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const officerLocked = college?.officer?.status === 'active';

  function set<K extends keyof CollegeForm>(key: K, value: CollegeForm[K]) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === 'name' && !codeTouched) next.code = suggestCode(String(value));
      return next;
    });
    setErrors((e) => ({ ...e, [key]: '' }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      const res = college
        ? await platformApi.updateCollege(tenantId, college.id, form)
        : await platformApi.createCollege(tenantId, form);
      onSaved(res, res.result.officer, form.name);
    } catch (err) {
      const fe = fieldErrors(err);
      const field = err instanceof ApiError ? (err.details as { field?: string } | undefined)?.field : undefined;
      if (field && err instanceof ApiError) fe[field] = err.message;
      setErrors(fe);
      setError(err instanceof ApiError ? err.message : 'Could not save this college.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="college-form ob-in">
      <p className="invite-card-title">{college ? `Edit ${college.name}` : 'Add a college'}</p>

      <p className="form-group-title">The college</p>
      <div className="grid">
        <Field label="College name" error={errors.name} wide>
          {(id) => (
            <input
              id={id}
              className="input"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Demo Institute of Technology"
              autoFocus
            />
          )}
        </Field>
        <Field label="Code" hint="The short name recruiters know it by. Unique on the platform." error={errors.code}>
          {(id) => (
            <input
              id={id}
              className="input input-mono"
              value={form.code}
              onChange={(e) => {
                setCodeTouched(true);
                set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9.-]/g, ''));
              }}
              placeholder="DIT"
              maxLength={16}
            />
          )}
        </Field>
        <Field label="Type" error={errors.collegeTypeId} optional>
          {(id) => (
            // A type the list does not have yet is added right here, once, for
            // every institution - not typed free-hand on this one college.
            <GrowableSelect
              id={id}
              className="input"
              value={form.collegeTypeId}
              onChange={(v) => set('collegeTypeId', v)}
              includeBlank
              blankLabel="—"
              addLabel="Add a new type…"
              options={catalogue.collegeTypes.map((ct) => ({ value: ct.id, label: ct.name }))}
              onAdd={async (label) => {
                const known = catalogue.collegeTypes.find((ct) => ct.name.toLowerCase() === label.toLowerCase());
                if (known) return { value: known.id, label: known.name };
                const { type } = await api.post<{ type: { id: string; name: string } }>('/admin/college-types', {
                  name: label,
                });
                updateCatalogue((c) => ({
                  ...c,
                  collegeTypes: [...c.collegeTypes.filter((ct) => ct.id !== type.id), { id: type.id, name: type.name }].sort(
                    (a, z) => a.name.localeCompare(z.name),
                  ),
                }));
                return { value: type.id, label: type.name };
              }}
            />
          )}
        </Field>
        <Field label="NAAC grade" error={errors.naacGrade} optional>
          {(id) => (
            <select id={id} className="input" value={form.naacGrade} onChange={(e) => set('naacGrade', e.target.value)}>
              <option value="">Not graded</option>
              {catalogue.naacGrades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <Field label="Affiliation" error={errors.affiliationName}>
        {() => (
          <div className="affiliation">
            <Segmented
              label="Affiliation"
              value={form.affiliation}
              onChange={(v) => set('affiliation', v)}
              options={[
                { value: 'THIS_UNIVERSITY', label: `Affiliated to ${tenantName.length > 28 ? 'this university' : tenantName}` },
                { value: 'AUTONOMOUS', label: 'Autonomous' },
                { value: 'OTHER', label: 'Another university' },
              ]}
            />
            {form.affiliation === 'OTHER' && (
              <input
                className="input"
                value={form.affiliationName}
                onChange={(e) => set('affiliationName', e.target.value)}
                placeholder="Name of the university"
              />
            )}
          </div>
        )}
      </Field>

      <p className="form-group-title">Where it is</p>
      <div className="grid">
        <Field label="City" error={errors.city}>
          {(id) => <input id={id} className="input" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Demo City" />}
        </Field>
        <Field label="State" error={errors.state}>
          {(id) => (
            <>
              <input
                id={id}
                className="input"
                list="ob-states-college"
                value={form.state}
                onChange={(e) => set('state', e.target.value)}
                placeholder="Maharashtra"
              />
              <datalist id="ob-states-college">
                {catalogue.states.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field label="Address" error={errors.address} optional wide>
          {(id) => (
            <input id={id} className="input" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Demo Road, Demo Area" />
          )}
        </Field>
        <Field label="PIN code" error={errors.pincode} optional>
          {(id) => (
            <input
              id={id}
              className="input input-mono"
              inputMode="numeric"
              maxLength={6}
              value={form.pincode}
              onChange={(e) => set('pincode', e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
            />
          )}
        </Field>
      </div>

      <p className="form-group-title">Placement officer</p>
      <div className="grid">
        <Field label="Name" error={errors.officerName} optional>
          {(id) => (
            <input
              id={id}
              className="input"
              value={form.officerName}
              onChange={(e) => set('officerName', e.target.value)}
              placeholder="Demo Officer"
              disabled={officerLocked}
            />
          )}
        </Field>
        <Field
          label="Email"
          hint={officerLocked ? 'Already signed in - manage them from the college’s team page.' : 'They get an invite to set their own password.'}
          error={errors.officerEmail}
          optional
        >
          {(id) => (
            <input
              id={id}
              type="email"
              className="input"
              value={form.officerEmail}
              onChange={(e) => set('officerEmail', e.target.value.trim())}
              placeholder="officer@demo-college.example"
              disabled={officerLocked}
            />
          )}
        </Field>
      </div>

      <Toggle
        checked={form.isVerified}
        onChange={(v) => set('isVerified', v)}
        label="Verified by our team"
        description="We have checked this college is real and its details are right. Recruiters see a verified badge."
      />

      {error && (
        <p className="step-error" role="alert">
          {error}
        </p>
      )}
      <div className="invite-card-foot">
        <span />
        <span className="new-course-actions">
          {onCancel && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : college ? 'Save changes' : 'Add college'}
          </button>
        </span>
      </div>
    </div>
  );
}

export function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      onClick={() => {
        void navigator.clipboard?.writeText(link).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        });
      }}
      title={link}
    >
      {copied ? 'Copied ✓' : 'Copy invite link'}
    </button>
  );
}
