import { useRef, useState, type ReactNode } from 'react';
import { ApiError } from '../../../api/client';
import {
  platformApi,
  type BulkBranchesResult,
  type BulkCollegesResult,
  type BulkCoursesResult,
  type BulkKind,
  type Catalogue,
  type OnboardingState,
} from '../../../api/platform';

type Branch = Catalogue['branches'][number];
type Course = Catalogue['courses'][number];

const message = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/* -------------------------------------------------------------------------- */
/* The shared panel: download, fill, upload, check, add                       */
/* -------------------------------------------------------------------------- */

/**
 * Bulk add is always from Excel. The panel walks the same three steps for
 * branches, courses and colleges: download a template whose dropdowns carry
 * today's lists, fill it in, drop it back. What comes back is a preview, row
 * by row, and nothing is saved until the one primary button is pressed.
 */
function ExcelPanel({
  kind,
  title,
  hint,
  file,
  onFile,
  busy,
  error,
  onClose,
  children,
}: {
  kind: BulkKind;
  title: string;
  hint: ReactNode;
  file: File | null;
  onFile: (f: File) => void;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  children?: ReactNode;
}) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function download() {
    setDownloading(true);
    setDownloadError(null);
    try {
      await platformApi.bulkTemplate(kind);
    } catch (err) {
      setDownloadError(message(err, 'Could not download the template.'));
    } finally {
      setDownloading(false);
    }
  }

  function take(files: FileList | null) {
    const f = files?.[0];
    if (f) onFile(f);
  }

  return (
    <div className="bulk ob-in">
      <div className="bulk-head">
        <p className="invite-card-title">{title}</p>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <ol className="xl-steps">
        <li>
          <span className="xl-num">1</span>
          <span className="xl-step-body">
            <span className="xl-step-title">Download the template</span>
            <span className="f-hint">{hint}</span>
          </span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={download} disabled={downloading}>
            {downloading ? 'Preparing…' : 'Download .xlsx'}
          </button>
        </li>
        <li>
          <span className="xl-num">2</span>
          <span className="xl-step-body">
            <span className="xl-step-title">Upload it filled in</span>
            <div
              className={`upl-drop xl-drop ${over ? 'is-over' : ''}`}
              role="button"
              tabIndex={0}
              aria-label="Choose the filled-in template"
              onClick={() => input.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  input.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                take(e.dataTransfer.files);
              }}
            >
              <svg className="xl-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 16V4m0 0-4 4m4-4 4 4M5 16v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="xl-drop-text">
                {busy ? (
                  'Reading the file…'
                ) : file ? (
                  <>
                    <strong>{file.name}</strong> <span className="muted">· drop another file to replace it</span>
                  </>
                ) : (
                  <>
                    <strong>Drop the .xlsx here</strong> <span className="muted">or click to choose it</span>
                  </>
                )}
              </span>
              <input
                ref={input}
                type="file"
                hidden
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => {
                  take(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>
          </span>
        </li>
      </ol>

      {(error || downloadError) && <p className="f-error">{error ?? downloadError}</p>}
      {children}
    </div>
  );
}

/** The counts above a preview, each in its own colour. */
function Counts({ items }: { items: [number, string, 'pass' | 'idle' | 'hold' | 'stop'][] }) {
  return (
    <p className="xl-counts">
      {items
        .filter(([n], i) => n > 0 || i === 0)
        .map(([n, label, tone]) => (
          <span key={label} className={`pill pill-${tone}`}>
            {n} {label}
          </span>
        ))}
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/* Branches                                                                    */
/* -------------------------------------------------------------------------- */

type Held = { name: string; similar: Branch[]; decided?: string };

/**
 * Branches from Excel. Every name gets the same spelling check as one typed
 * by hand; look-alikes are held back and, after the rest are added, listed
 * with the two ways out - use the existing branch, or add it anyway.
 */
export function BulkBranches({ onAdded, onClose }: { onAdded: (b: Branch) => void; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<BulkBranchesResult | null>(null);
  const [done, setDone] = useState<{ added: string[]; held: Held[] } | null>(null);

  async function read(f: File) {
    setFile(f);
    setPreview(null);
    setDone(null);
    setBusy(true);
    setError(null);
    try {
      setPreview(await platformApi.bulkBranches(f, true));
    } catch (err) {
      setError(message(err, 'Could not read that file.'));
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const res = await platformApi.bulkBranches(file, false);
      const added = (res.added ?? []).filter((r) => r.status === 'added' && r.branch);
      added.forEach((r) => onAdded(r.branch!));
      setDone({
        added: added.map((r) => r.branch!.name),
        held: res.rows.flatMap((r) => (r.status === 'similar' ? [{ name: r.name, similar: r.similar }] : [])),
      });
      setPreview(null);
      setFile(null);
    } catch (err) {
      setError(message(err, 'Could not add those branches.'));
    } finally {
      setBusy(false);
    }
  }

  async function addAnyway(i: number, name: string) {
    try {
      const { branch } = await platformApi.addBranch(name, true);
      onAdded(branch);
      setDone((d) => d && { ...d, held: d.held.map((h, j) => (j === i ? { ...h, decided: `Added ${branch.name}` } : h)) });
    } catch (err) {
      setError(message(err, 'Could not add that branch.'));
    }
  }

  function useExisting(i: number, b: Branch) {
    setDone((d) => d && { ...d, held: d.held.map((h, j) => (j === i ? { ...h, decided: `Using ${b.name}` } : h)) });
  }

  const s = preview?.summary;

  return (
    <ExcelPanel
      kind="branches"
      title="Upload branches from Excel"
      hint="One column, one branch per row, spelt in full."
      file={file}
      onFile={read}
      busy={busy}
      error={error}
      onClose={onClose}
    >
      {preview && s && (
        <div className="xl-preview ob-in">
          <Counts
            items={[
              [s.add, 'to add', 'pass'],
              [s.exists, 'already on the list', 'idle'],
              [s.held, 'look-alikes held back', 'hold'],
              [s.skipped, 'skipped', 'stop'],
            ]}
          />
          <div className="xl-table-wrap">
            <table className="xl-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Branch</th>
                  <th>What happens</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.row} className={`xl-${r.status}`}>
                    <td className="xl-row">{r.row}</td>
                    <td>{r.name || <span className="muted">(blank)</span>}</td>
                    <td>
                      {r.status === 'add' && 'Added to the branch list'}
                      {r.status === 'exists' &&
                        (r.branch.name === r.name ? 'Already there' : `Already there as ${r.branch.name}`)}
                      {r.status === 'similar' &&
                        `Held back - looks like ${r.similar.map((b) => b.name).join(', ')}. You decide after adding.`}
                      {(r.status === 'invalid' || r.status === 'duplicate') && r.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bulk-foot">
            <span className="muted">Nothing is saved until you add.</span>
            <button type="button" className="btn btn-primary btn-sm" onClick={commit} disabled={busy || s.add === 0}>
              {busy ? 'Adding…' : s.add === 0 ? 'Nothing new to add' : `Add ${plural(s.add, 'branch', 'branches')}`}
            </button>
          </div>
        </div>
      )}

      {done && (
        <div className="xl-preview ob-in">
          <p className="notice notice-pass">
            {done.added.length > 0
              ? `Added ${plural(done.added.length, 'branch', 'branches')}: ${done.added.join(', ')}.`
              : 'No new branches were added.'}
          </p>
          {done.held.length > 0 && (
            <>
              <p className="f-hint">These look like branches already on the list. Decide each one:</p>
              <ul className="bulk-results">
                {done.held.map((h, i) => (
                  <li key={h.name}>
                    <span className="bulk-name">{h.name}</span>
                    {h.decided ? (
                      <span className="pill pill-idle">{h.decided}</span>
                    ) : (
                      <span className="bulk-choice">
                        {h.similar.map((b) => (
                          <button key={b.id} type="button" className="btn btn-secondary btn-sm" onClick={() => useExisting(i, b)}>
                            Use “{b.name}”
                          </button>
                        ))}
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => addAnyway(i, h.name)}>
                          Add anyway
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="bulk-foot">
            <span />
            <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      )}
    </ExcelPanel>
  );
}

/* -------------------------------------------------------------------------- */
/* Courses                                                                     */
/* -------------------------------------------------------------------------- */

const COURSE_STATUS: Record<string, string> = {
  matched: 'On the branch list',
  similar: 'Read as',
  new: 'New branch - will be added',
  missing: 'Not on the branch list - skipped',
  none: 'No branch',
};

/**
 * Courses from Excel, one row per course and branch. The Branch column is a
 * dropdown of the master list, so most rows simply match; anything typed over
 * it is shown as it was read before a thing is saved.
 */
export function BulkCourses({
  onDone,
  onClose,
}: {
  onDone: (courses: Course[], branches: Branch[]) => void;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [addMissing, setAddMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<BulkCoursesResult | null>(null);

  async function read(f: File, missing = addMissing) {
    setFile(f);
    setBusy(true);
    setError(null);
    try {
      setPreview(await platformApi.bulkCourses(f, missing, true));
    } catch (err) {
      setPreview(null);
      setError(message(err, 'Could not read that file.'));
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const res = await platformApi.bulkCourses(file, addMissing, false);
      onDone(res.courses ?? [], res.branches ?? []);
    } catch (err) {
      setError(message(err, 'Could not add those courses.'));
    } finally {
      setBusy(false);
    }
  }

  const s = preview?.summary;

  return (
    <ExcelPanel
      kind="courses"
      title="Upload courses from Excel"
      hint="One row per course and branch - B.Tech on three rows gives B.Tech three branches. Branch is a dropdown of the branch list."
      file={file}
      onFile={(f) => read(f)}
      busy={busy}
      error={error}
      onClose={onClose}
    >
      {preview && s && (
        <div className="xl-preview ob-in">
          <Counts
            items={[
              [s.courses, `course${s.courses === 1 ? '' : 's'} (${s.newCourses} new)`, 'pass'],
              [s.newBranches, 'new branches', 'pass'],
              [s.mapped, 'spellings read as a listed branch', 'hold'],
              [s.missing, 'unknown branches skipped', 'stop'],
              [preview.skipped, 'rows skipped', 'stop'],
            ]}
          />
          {(s.missing > 0 || addMissing) && (
            <label className="check">
              <input
                type="checkbox"
                checked={addMissing}
                onChange={(e) => {
                  setAddMissing(e.target.checked);
                  if (file) void read(file, e.target.checked);
                }}
              />
              Add branches that are not on the list yet (look-alikes of existing ones are never added)
            </label>
          )}
          <div className="xl-table-wrap">
            <table className="xl-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Course</th>
                  <th>Branch</th>
                  <th>What happens</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.row} className={`xl-${r.status}`}>
                    <td className="xl-row">{r.row}</td>
                    <td>
                      {r.course}
                      {r.course && r.newCourse && <small className="xl-new"> new</small>}
                    </td>
                    <td>{r.status === 'similar' ? <s>{r.branch}</s> : r.branch}</td>
                    <td>
                      {r.status === 'invalid'
                        ? r.reason
                        : r.status === 'similar'
                          ? `${COURSE_STATUS.similar} ${r.readAs}`
                          : COURSE_STATUS[r.status]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bulk-foot">
            <span className="muted">Nothing is saved until you add.</span>
            <button type="button" className="btn btn-primary btn-sm" onClick={commit} disabled={busy || s.courses === 0}>
              {busy ? 'Adding…' : `Add ${plural(s.courses, 'course')}`}
            </button>
          </div>
        </div>
      )}
    </ExcelPanel>
  );
}

/* -------------------------------------------------------------------------- */
/* Colleges                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Colleges from Excel. Each row is checked on its own, by the rules the
 * "Add a college" form uses; a row with a problem is skipped with its row
 * number and reason, and the rest are added.
 */
export function BulkColleges({
  tenantId,
  onDone,
  onClose,
}: {
  tenantId: string;
  onDone: (state: OnboardingState) => void;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<BulkCollegesResult | null>(null);
  const [result, setResult] = useState<BulkCollegesResult | null>(null);

  async function read(f: File) {
    setFile(f);
    setResult(null);
    setBusy(true);
    setError(null);
    try {
      setPreview(await platformApi.bulkColleges(tenantId, f, true));
    } catch (err) {
      setPreview(null);
      setError(message(err, 'Could not read that file.'));
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const res = await platformApi.bulkColleges(tenantId, file, false);
      setResult(res);
      setPreview(null);
      setFile(null);
      onDone(res.state ?? (await platformApi.state(tenantId)));
    } catch (err) {
      setError(message(err, 'Could not add those colleges.'));
    } finally {
      setBusy(false);
    }
  }

  const s = preview?.summary;

  return (
    <ExcelPanel
      kind="colleges"
      title="Upload colleges from Excel"
      hint="One college per row. Name, Code, City and State are required; Type, State, NAAC grade and Affiliation are dropdowns."
      file={file}
      onFile={read}
      busy={busy}
      error={error}
      onClose={onClose}
    >
      {preview && s && (
        <div className="xl-preview ob-in">
          <Counts
            items={[
              [s.valid, 'ready to add', 'pass'],
              [s.officers, 'officers to invite', 'idle'],
              [s.invalid, 'with a problem - skipped', 'stop'],
            ]}
          />
          <div className="xl-table-wrap">
            <table className="xl-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>College</th>
                  <th>Code</th>
                  <th>What happens</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.row} className={r.status === 'valid' ? 'xl-add' : 'xl-invalid'}>
                    <td className="xl-row">{r.row}</td>
                    <td>{r.name || <span className="muted">(no name)</span>}</td>
                    <td className="xl-code">{r.code}</td>
                    <td>
                      {r.status === 'valid' ? (
                        <>
                          Added · {r.city}, {r.state}
                          {r.officerEmail && <span className="muted"> · invites {r.officerEmail}</span>}
                        </>
                      ) : (
                        r.problems.join(' ')
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bulk-foot">
            <span className="muted">
              {s.invalid > 0 ? 'Rows with a problem are skipped - fix them and upload just those again.' : 'Nothing is saved until you add.'}
            </span>
            <button type="button" className="btn btn-primary btn-sm" onClick={commit} disabled={busy || s.valid === 0}>
              {busy ? 'Adding…' : s.valid === 0 ? 'No rows ready' : `Add ${plural(s.valid, 'college')}`}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="xl-preview ob-in">
          <p className="notice notice-pass">
            Added {plural(result.added?.length ?? 0, 'college')}
            {result.added && result.added.length > 0 && `: ${result.added.map((a) => a.name).join(', ')}`}.
          </p>
          {result.skipped && result.skipped.length > 0 && (
            <>
              <p className="f-hint">Skipped - fix these rows and upload them again:</p>
              <ul className="bulk-results">
                {result.skipped.map((k) => (
                  <li key={k.row}>
                    <span className="bulk-name">
                      Row {k.row} · {k.name || k.code || 'blank'}
                    </span>
                    <span className="pill pill-stop">{k.problems.join(' ')}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="bulk-foot">
            <span />
            <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      )}
    </ExcelPanel>
  );
}
