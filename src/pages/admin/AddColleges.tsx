import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api/client';
import '../../components/AddStudents.css';

export interface AddCollegesResult {
  created: {
    id: string;
    name: string;
    code: string;
    city: string;
    type: string | null;
    affiliation: string | null;
  }[];
  skipped: { code: string; name: string; reason: string }[];
  /** Present on an upload, so the result names the file it came from. */
  fileName?: string;
  rowsRead?: number;
}

/**
 * Onboarding an affiliation list.
 *
 * A university does not add three hundred colleges through a form, and the
 * two answers that would otherwise be repeated on every single line - the
 * state, and which university they are affiliated to - are set once above the
 * upload instead. A row carrying its own State or Affiliation column still
 * wins over them.
 */
export default function AddColleges({
  onDone,
  bare = false,
}: {
  onDone: () => void;
  /** Drops this component's own card, heading and intro - see AddStudents. */
  bare?: boolean;
}) {
  // Bulk add always comes from the Excel template - its dropdowns are what
  // keep types and affiliations spelt one way.
  const [file, setFile] = useState<File | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [defaultState, setDefaultState] = useState('Maharashtra');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AddCollegesResult | null>(null);

  const ready = file !== null;

  async function downloadTemplate() {
    setError(null);
    setDownloading(true);
    try {
      await api.download('/admin/colleges/bulk/template', 'apli-colleges.xlsx');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not download the template.');
    } finally {
      setDownloading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving || !ready) return;

    setError(null);
    setSaving(true);
    try {
      const form = new FormData();
      form.append('file', file!);
      form.append('defaultState', defaultState);
      const res = await api.upload<AddCollegesResult>('/admin/colleges/bulk/file', form);

      setResult(res);
      setFile(null);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add these colleges.');
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    return <ResultCard result={result} onAddMore={() => setResult(null)} />;
  }

  return (
    <form
      className={bare ? 'bare-form' : 'card form-card form-wide'}
      onSubmit={onSubmit}
      noValidate
    >
      {!bare && (
        <>
          <h2>Add colleges in bulk</h2>
          <p className="muted">
            Upload an affiliation list from the Excel template. Only the name and a short code are required on each row —
            everything else can be filled in later, per college.
          </p>
        </>
      )}

      {error && <p className="alert alert-error">{error}</p>}

      {/*
        The template comes first, because filling in the right columns is the
        whole difficulty here. It is generated fresh each time, so the Type
        column is a dropdown of the types that exist today.
      */}
      <div className="template-strip">
        <div>
          <p className="template-title">Start from the template</p>
          <p className="template-note">
            An Excel file with the columns laid out, three example rows, dropdowns for the college
            type and for Affiliated, and a sheet explaining the rules.
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
        <span className="field-label">State</span>
        <input
          value={defaultState}
          onChange={(e) => setDefaultState(e.target.value)}
          disabled={saving}
        />
        <span className="field-hint">
          Used only for rows that leave the State column blank. Affiliation is answered per row,
          in the file&rsquo;s Affiliated column.
        </span>
      </label>

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

      <button type="submit" className="btn btn-primary" disabled={saving || !ready}>
        {saving ? 'Adding…' : file ? `Upload ${file.name}` : 'Upload colleges'}
      </button>
    </form>
  );
}

/**
 * Partial success is the normal case, so both halves are shown. Hiding the
 * failures would leave colleges quietly missing from the portal with nobody
 * aware of it.
 */
function ResultCard({ result, onAddMore }: { result: AddCollegesResult; onAddMore: () => void }) {
  return (
    <section className="card form-wide">
      <div className="card-head">
        <h2>
          {result.created.length} college{result.created.length === 1 ? '' : 's'} added
          {result.skipped.length > 0 && `, ${result.skipped.length} skipped`}
        </h2>
        {result.fileName && (
          <span className="muted">
            {result.fileName} · {result.rowsRead} row{result.rowsRead === 1 ? '' : 's'} read
          </span>
        )}
      </div>

      {result.created.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>College</th>
              <th>City</th>
              <th>Type</th>
              <th>Affiliated</th>
            </tr>
          </thead>
          <tbody>
            {result.created.map((c) => (
              <tr key={c.id}>
                <td className="mono">{c.code}</td>
                <td>{c.name}</td>
                <td>{c.city}</td>
                <td>{c.type ?? '—'}</td>
                <td>
                  {/* Shown because a blank Affiliated column reads as No, and
                      that is worth noticing straight away rather than later. */}
                  {c.affiliation ? (
                    <span className="pill pill-pass">Yes</span>
                  ) : (
                    <span className="pill pill-idle">Autonomous</span>
                  )}
                  {c.affiliation && <span className="row-sub">{c.affiliation}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {result.skipped.length > 0 && (
        <div className="skipped">
          <p className="skipped-title">Skipped {result.skipped.length}</p>
          <ul>
            {result.skipped.map((s, i) => (
              <li key={`${s.code}-${i}`}>
                <span className="mono">{s.code}</span> {s.name !== '—' && `(${s.name})`} —{' '}
                {s.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="btn-row">
        <button type="button" className="btn btn-secondary" onClick={onAddMore}>
          Add more
        </button>
      </div>
    </section>
  );
}
