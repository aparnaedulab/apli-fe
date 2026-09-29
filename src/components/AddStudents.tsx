import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../api/client';
import './AddStudents.css';

export interface AddStudentsResult {
  created: {
    name: string;
    email: string;
    rollNo: string | null;
    batch: string;
    link: string;
    /** Went in anyway, but something about it is worth knowing. */
    warning?: string;
  }[];
  skipped: { email: string; reason: string }[];
  batchesCreated: { id: string; name: string; graduationYear: number | null }[];
  /** Nothing was written; this is a report of what would be. */
  dryRun?: boolean;
}

interface Row {
  fullName: string;
  email: string;
  phone: string;
  batch: string;
  course: string;
  specialisation: string;
  graduationYear: string;
  rollNo: string;
  prn: string;
  division: string;
  gender: string;
  dateOfBirth: string;
  cgpa: string;
  degreePct: string;
  tenthPct: string;
  twelfthPct: string;
  diplomaPct: string;
  activeBacklogs: string;
  backlogs: string;
  pgCgpa: string;
  pgPct: string;
  gapYears: string;
  isLateralEntry: string;
}

const BLANK: Row = {
  fullName: '',
  email: '',
  phone: '',
  batch: '',
  course: 'B.Tech',
  specialisation: '',
  graduationYear: '',
  rollNo: '',
  prn: '',
  division: '',
  gender: '',
  dateOfBirth: '',
  cgpa: '',
  degreePct: '',
  tenthPct: '',
  twelfthPct: '',
  diplomaPct: '',
  activeBacklogs: '',
  backlogs: '',
  pgCgpa: '',
  pgPct: '',
  gapYears: '',
  isLateralEntry: '',
};

interface Field {
  key: keyof Row;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}

const REQUIRED: Field[] = [
  { key: 'fullName', label: 'Full name' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Mobile', placeholder: '9000000000' },
];

/** Hidden when adding from inside one batch - the batch is already known. */
const BATCH_FIELDS: Field[] = [
  { key: 'batch', label: 'Batch', placeholder: 'CSE 2026 or Second year', required: true },
  { key: 'course', label: 'Course', placeholder: 'B.Tech' },
  { key: 'specialisation', label: 'Branch', placeholder: 'Computer Science' },
  { key: 'graduationYear', label: 'Graduating year', placeholder: '2026' },
];

/*
 * The same columns the spreadsheet carries, in the same order.
 *
 * Six of these were on the template and not on this form - the diploma and
 * postgraduate marks, live backlogs, gap years and lateral entry - so the
 * same student entered by hand and entered by upload ended up with different
 * records. Five of the six are bars a role can set, which meant a
 * hand-entered student was quietly invisible to any role that set one.
 */
const OPTIONAL: Field[] = [
  { key: 'rollNo', label: 'Roll no.', placeholder: 'CS22-101' },
  { key: 'prn', label: 'PRN', placeholder: '72012345K' },
  { key: 'division', label: 'Division', placeholder: 'A' },
  { key: 'gender', label: 'Gender' },
  { key: 'dateOfBirth', label: 'Date of birth', type: 'date' },
  { key: 'cgpa', label: 'CGPA', placeholder: '8.6' },
  { key: 'degreePct', label: 'Degree %', placeholder: '81.5' },
  { key: 'tenthPct', label: '10th %', placeholder: '91' },
  { key: 'twelfthPct', label: '12th %', placeholder: '88' },
  // For a lateral entrant, who has no 12th. Without it, every role that
  // sets a 12th bar is invisible to them.
  { key: 'diplomaPct', label: 'Diploma %', placeholder: '78' },
  { key: 'isLateralEntry', label: 'Lateral entry', placeholder: 'Yes / No' },
  // "No live backlogs, at most two ever" is one sentence asking for both.
  { key: 'activeBacklogs', label: 'Live backlogs', placeholder: '0' },
  { key: 'backlogs', label: 'Backlogs (total)', placeholder: '0' },
  // The master's on top of the bachelor's, blank for most of a roster.
  { key: 'pgCgpa', label: 'PG CGPA', placeholder: '8.1' },
  { key: 'pgPct', label: 'PG %', placeholder: '76' },
  { key: 'gapYears', label: 'Gap years', placeholder: '0' },
];

/**
 * Entering a class list. The same component serves the placement cell and
 * operations - only the endpoint differs - because it is the same job either
 * way, and a second copy would drift.
 */
export default function AddStudents({
  endpoint,
  extra,
  onDone,
  /** Set when adding from inside one batch; then the batch columns disappear. */
  batchName,
  bare = false,
}: {
  endpoint: string;
  /** Merged into the request body. For fields the endpoint needs beyond rows. */
  extra?: Record<string, string | undefined>;
  onDone: () => void;
  batchName?: string;
  /**
   * Drops this component's own card, heading and intro.
   *
   * On its own screen it is a card with a title. Inside a section that already
   * has both, repeating them gives a card inside a card and the same thing
   * said twice - which is most of what makes a stacked page feel cluttered.
   */
  bare?: boolean;
}) {
  // Excel first: it is how a placement cell already holds a class list. Typing
  // one student is the other real case - a late admission, a correction.
  const [mode, setMode] = useState<'file' | 'rows'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [rows, setRows] = useState<Row[]>([{ ...BLANK }]);
  const [result, setResult] = useState<AddStudentsResult | null>(null);
  /** What the file would do, before it does it. */
  const [preview, setPreview] = useState<AddStudentsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filledRows = rows.filter(
    (r) =>
      r.email.trim() &&
      r.fullName.trim() &&
      r.phone.trim() &&
      // A batch name is enough; the year is optional now that a batch need
      // not be a graduating cohort.
      (batchName || r.batch.trim()),
  );
  const count = mode === 'rows' ? filledRows.length : 0;
  const ready = mode === 'file' ? file !== null : count > 0;

  async function downloadTemplate() {
    setError(null);
    setDownloading(true);
    try {
      // The template is generated for this exact context, so it carries this
      // college's batches - or none at all when a batch is already chosen.
      await api.download(`${endpoint}/template`, 'apli-students.xlsx');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not download the template.');
    } finally {
      setDownloading(false);
    }
  }

  /**
   * One call, run twice: once to see, once to do.
   *
   * The first pass writes nothing. It is here because the checks are strict
   * now - a programme the college does not run, a CGPA out of range, a batch
   * name one character off - and finding that out after two hundred and
   * ninety-two students have been created and invited is not finding out in
   * time. The same request with `dryRun` off is what commits it.
   */
  async function send(opts: { dryRun?: boolean; allowUnmapped?: boolean } = {}) {
    const query = new URLSearchParams();
    if (opts.dryRun) query.set('dryRun', '1');
    if (opts.allowUnmapped) query.set('allowUnmapped', '1');
    const url = query.size > 0 ? `${endpoint}?${query}` : endpoint;

    if (mode === 'file' && file) {
      const form = new FormData();
      form.append('file', file);
      for (const [k, v] of Object.entries(extra ?? {})) if (v) form.append(k, v);
      return api.upload<AddStudentsResult>(url, form);
    }
    return api.post<AddStudentsResult>(url, { students: filledRows, ...extra });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      setPreview(await send({ dryRun: true }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not check the list.');
    } finally {
      setSaving(false);
    }
  }

  /** The commit, from the preview screen. */
  async function commit(allowUnmapped: boolean) {
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      const added = await send({ allowUnmapped });
      setResult(added);
      setPreview(null);
      setFile(null);
      setRows([{ ...BLANK }]);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add the students.');
    } finally {
      setSaving(false);
    }
  }

  if (result) return <ResultCard result={result} onDismiss={() => setResult(null)} />;

  if (preview) {
    return (
      <PreviewCard
        preview={preview}
        busy={saving}
        error={error}
        onBack={() => setPreview(null)}
        onCommit={commit}
      />
    );
  }

  return (
    <form className={bare ? 'bare-form' : 'card form-card'} onSubmit={onSubmit} noValidate>
      <div className="card-head">
        {!bare && <h2>Add students</h2>}
        <div className="tabs-bar compact">
          <button
            type="button"
            className={`tabs-btn ${mode === 'file' ? 'is-active' : ''}`}
            onClick={() => setMode('file')}
          >
            Excel file
          </button>
          <button
            type="button"
            className={`tabs-btn ${mode === 'rows' ? 'is-active' : ''}`}
            onClick={() => setMode('rows')}
          >
            One at a time
          </button>
        </div>
      </div>

      <p className="muted">
        {batchName ? (
          <>
            Adding to <b>{batchName}</b>. <b>Name, email and mobile are required</b> — everything
            else is optional.
          </>
        ) : (
          <>
            <b>Name, email, mobile and the batch are required</b> — everything else is optional. You
            do not need to create batches first: any batch that does not exist yet is created from
            what you enter.
          </>
        )}{' '}
        Records appear on the roster straight away, and each student gets a one-time link to set
        their own password.
      </p>

      {error && <p className="alert alert-error">{error}</p>}

      {mode === 'file' && (
        <>
          {/*
            The template comes first, because knowing which columns to fill in
            is the whole difficulty. It is generated for this context, so it
            carries this college's batches - or no Batch column at all when a
            batch is already chosen.
          */}
          <div className="template-strip">
            <div>
              <p className="template-title">Start from the template</p>
              <p className="template-note">
                An Excel file with the columns laid out, two example rows
                {batchName
                  ? ', already fixed to this batch'
                  : ', a dropdown of your existing batches'}
                , and a sheet explaining the rules.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={downloadTemplate}
              disabled={downloading}
            >
              {downloading ? 'Preparing…' : 'Download Excel template'}
            </button>
          </div>

          <label className="field">
            <span className="field-label">Filled-in file</span>
            <input
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={saving}
              className="file-input"
            />
            <span className="field-hint">
              {file
                ? `${file.name} · ${(file.size / 1024).toFixed(0)} KB`
                : 'An .xlsx from the template above, or a .csv export. Up to 5 MB.'}
            </span>
          </label>
        </>
      )}

      {mode === 'rows' && (
        <div className="student-rows">
          {rows.map((r, i) => (
            <fieldset key={i} className="student-card">
              <legend>
                Student {i + 1}
                {rows.length > 1 && (
                  <button
                    type="button"
                    className="link-btn is-danger"
                    onClick={() => setRows(rows.filter((_, k) => k !== i))}
                  >
                    Remove
                  </button>
                )}
              </legend>

              <div className="student-grid">
                {!batchName &&
                  BATCH_FIELDS.map((f) => (
                    <label key={f.key} className="field">
                      <span className="field-label">
                        {f.label}
                        {f.required && <span className="req">required</span>}
                      </span>
                      <input
                        value={r[f.key]}
                        onChange={(e) => {
                          const next = [...rows];
                          next[i] = { ...r, [f.key]: e.target.value };
                          setRows(next);
                        }}
                        placeholder={f.placeholder}
                        disabled={saving}
                      />
                    </label>
                  ))}
                {REQUIRED.map((f) => (
                  <label key={f.key} className="field">
                    <span className="field-label">
                      {f.label}
                      <span className="req">required</span>
                    </span>
                    <input
                      type={f.type ?? 'text'}
                      value={r[f.key]}
                      onChange={(e) => {
                        const next = [...rows];
                        next[i] = { ...r, [f.key]: e.target.value };
                        setRows(next);
                      }}
                      placeholder={f.placeholder}
                      required
                      disabled={saving}
                    />
                  </label>
                ))}
                {OPTIONAL.map((f) => (
                  <label key={f.key} className="field">
                    <span className="field-label">{f.label}</span>
                    <input
                      type={f.type ?? 'text'}
                      value={r[f.key]}
                      onChange={(e) => {
                        const next = [...rows];
                        next[i] = { ...r, [f.key]: e.target.value };
                        setRows(next);
                      }}
                      placeholder={f.placeholder}
                      disabled={saving}
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <button
            type="button"
            className="link-btn"
            onClick={() => setRows([...rows, { ...BLANK }])}
          >
            + Another student
          </button>
        </div>
      )}

      <button type="submit" className="btn btn-primary" disabled={saving || !ready}>
        {saving
          ? 'Checking…'
          : mode === 'file'
            ? file
              ? `Check ${file.name}`
              : 'Check the file'
            : `Check ${count || ''} student${count === 1 ? '' : 's'}`}
      </button>
    </form>
  );
}

/**
 * What the file would do, before it does it.
 *
 * Nothing on this screen has been written. It exists because the checks are
 * strict: a programme the college does not run is refused rather than filed
 * as unmapped, and a batch name one character off makes a second class. Both
 * are right, and both are infuriating to discover afterwards - so they are
 * discovered here, with the row and the reason, while the spreadsheet is
 * still open in the other window.
 */
function PreviewCard({
  preview,
  busy,
  error,
  onBack,
  onCommit,
}: {
  preview: AddStudentsResult;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onCommit: (allowUnmapped: boolean) => void;
}) {
  const ok = preview.created.length;
  const bad = preview.skipped.length;

  /*
   * A programme that matched nothing is the one refusal worth offering a way
   * past. Everything else - a malformed mark, a duplicate email - is a
   * mistake in the sheet, and letting it through would only write the
   * mistake down.
   */
  const unmapped = preview.skipped.filter((s) => /does not run|needs a branch|Did you mean/.test(s.reason));

  return (
    <section className="card">
      <h2>
        {ok} student{ok === 1 ? '' : 's'} ready
        {bad > 0 && `, ${bad} need${bad === 1 ? 's' : ''} attention`}
      </h2>

      <p className="muted">
        Nothing has been added yet. This is what the file would do.
      </p>

      {error && <p className="alert alert-error">{error}</p>}

      {preview.batchesCreated.length > 0 && (
        <p className="alert alert-warn">
          This will create {preview.batchesCreated.length} new batch
          {preview.batchesCreated.length === 1 ? '' : 'es'}:{' '}
          <b>{preview.batchesCreated.map((b) => b.name).join(', ')}</b>. If one of those is a
          spelling of a batch you already have, fix the sheet rather than adding it twice.
        </p>
      )}

      {bad > 0 && (
        <div className="skipped">
          <p className="skipped-title">
            {bad} row{bad === 1 ? '' : 's'} will not be added
          </p>
          <ul>
            {preview.skipped.map((row, i) => (
              <li key={`${row.email}-${i}`}>
                <b>{row.email || '(blank row)'}</b> — {row.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {preview.created.length > 0 && (
        <p className="muted">
          Ready: {preview.created.slice(0, 6).map((c) => c.name).join(', ')}
          {preview.created.length > 6 && ` and ${preview.created.length - 6} more`}
        </p>
      )}

      <div className="btn-row">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || ok === 0}
          onClick={() => onCommit(false)}
        >
          {busy ? 'Adding…' : `Add ${ok} student${ok === 1 ? '' : 's'}`}
        </button>

        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onBack}>
          Back
        </button>
      </div>

      {unmapped.length > 0 && (
        <p className="path-note">
          {unmapped.length} of those are about a programme this college does not run. You can add
          them anyway and map them later — but until they are mapped they will not appear for any
          role that filters on a course.{' '}
          <button
            type="button"
            className="link-btn"
            disabled={busy}
            onClick={() => onCommit(true)}
          >
            Add all {ok + unmapped.length} anyway
          </button>
        </p>
      )}
    </section>
  );
}

/**
 * Both outcomes are shown together. Partial success is the normal case with a
 * pasted list, and hiding the failures would leave someone quietly missing from
 * the roster.
 */
function ResultCard({ result, onDismiss }: { result: AddStudentsResult; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);
  const allLinks = result.created.map((c) => `${c.name}\t${c.email}\t${c.link}`).join('\n');

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(allLinks);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="card invite-link">
      <h2>
        {result.created.length} student{result.created.length === 1 ? '' : 's'} added
      </h2>

      {result.created.some((c) => c.warning) && (
        <p className="alert alert-warn">
          {result.created.filter((c) => c.warning).length} of them went in without a programme.
          They will not appear for any role that filters on a course until they are mapped.
        </p>
      )}

      {result.batchesCreated.length > 0 && (
        <p className="alert alert-ok">
          Created {result.batchesCreated.length} new batch
          {result.batchesCreated.length === 1 ? '' : 'es'}:{' '}
          <b>{result.batchesCreated.map((b) => b.name).join(', ')}</b>
        </p>
      )}

      <p>
        They are on the roster now. Send each one their activation link so they can set a password —
        the links work once, expire in seven days, and <b>cannot be shown again</b>.
      </p>

      {result.created.length > 0 && (
        <>
          <div className="link-list">
            {result.created.map((c) => (
              <div key={c.email} className="link-list-row three">
                <span>
                  {c.name}
                  <span className="row-sub">{c.batch}</span>
                </span>
                <span className="mono">{c.rollNo ?? '—'}</span>
                <span className="mono link-list-url">{c.link}</span>
              </div>
            ))}
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={copyAll}>
              {copied ? 'Copied' : 'Copy all links'}
            </button>
            <button type="button" className="link-btn" onClick={onDismiss}>
              Done
            </button>
          </div>
        </>
      )}

      {result.skipped.length > 0 && (
        <div className="skipped">
          <p className="skipped-title">Skipped {result.skipped.length}</p>
          <ul>
            {result.skipped.map((s, i) => (
              <li key={`${s.email}-${i}`}>
                <span className="mono">{s.email}</span> — {s.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
