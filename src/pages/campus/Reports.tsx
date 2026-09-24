import { useCallback, useEffect, useState } from 'react';
import CampusLayout from './CampusLayout';
import { ApiError } from '../../api/client';
import { reportsApi, type PlacementReport, type ReportQuery, type ReportScope } from '../../api/reports';
import { useAuth } from '../../auth/AuthContext';
import './Reports.css';

/** "7,00,000" → "₹7.0 L", the way a placement cell reads a package. */
export function lakhs(rupees: number | null): string {
  if (rupees === null) return '—';
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(rupees % 100000 === 0 ? 0 : 1)} L`;
  return `₹${rupees.toLocaleString('en-IN')}`;
}

const full = (rupees: number | null) => (rupees === null ? '' : `₹${rupees.toLocaleString('en-IN')} a year`);
const pct = (v: number | null) => (v === null ? '—' : `${v}%`);

/**
 * One placement report, for a college or a whole institution.
 *
 * The page answers the question an accreditation form asks - how many of
 * this year's students were placed, and at what pay - in one glance, and
 * offers one action: the workbook to attach to the filing. What the portal
 * cannot know is said plainly at the foot, never filled with a guess.
 */
export function ReportView({ scope }: { scope: ReportScope }) {
  const { can, hasModule } = useAuth();
  const [query, setQuery] = useState<ReportQuery>({});
  const [report, setReport] = useState<PlacementReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const enabled = hasModule('compliance.reports');
  const allowed = can('report:read');

  const load = useCallback(
    (q: ReportQuery) => {
      setLoading(true);
      setError(null);
      reportsApi
        .get(scope, q)
        .then(setReport)
        .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load the report.'))
        .finally(() => setLoading(false));
    },
    [scope],
  );

  useEffect(() => {
    if (enabled && allowed) load(query);
  }, [enabled, allowed, load, query]);

  async function download() {
    if (!report) return;
    setDownloading(true);
    try {
      const tag = report.filter.placement ? report.filter.placement.name : String(report.filter.year);
      await reportsApi.download(scope, query, `Placement report - ${report.scope.name} - ${tag}.xlsx`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not download the workbook.');
    } finally {
      setDownloading(false);
    }
  }

  if (!enabled) {
    return (
      <div className="empty">
        <h2>Reports are not switched on</h2>
        <p>NAAC / NIRF / NBA reports are part of the Growth and Complete plans. Ask the platform team to switch them on.</p>
      </div>
    );
  }
  if (!allowed) {
    return (
      <div className="empty">
        <h2>Your role cannot see reports</h2>
        <p>Ask your placement officer or institution admin for the “See placement statistics” permission.</p>
      </div>
    );
  }

  const f = report?.final;
  const period = report?.filter.placement ? report.filter.placement.name : report?.filter.year ? `Passing out in ${report.filter.year}` : '';
  const byDrive = Boolean(query.placementId);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">{scope === 'college' ? 'Placement cell' : 'Institution'} · Reports</p>
          <h1>Placement report</h1>
          <p className="page-lede">
            {report ? `${report.scope.name} · ${period}` : 'How this year’s students were placed, ready for NAAC, NIRF and NBA.'}
          </p>
        </div>
        {can('report:export') && (
          <button type="button" className="btn btn-primary" onClick={download} disabled={!report || downloading || report.pool === 0}>
            {downloading ? 'Preparing…' : 'Download NAAC/NIRF workbook'}
          </button>
        )}
      </header>

      <div className="rp-picker">
        <div className="rp-seg" role="radiogroup" aria-label="Report by">
          <button
            type="button"
            role="radio"
            aria-checked={!byDrive}
            className={!byDrive ? 'is-on' : ''}
            onClick={() => setQuery({ year: report?.filter.year ?? report?.years[0] })}
          >
            By passing year
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={byDrive}
            className={byDrive ? 'is-on' : ''}
            disabled={!report?.drives.length}
            onClick={() => report?.drives[0] && setQuery({ placementId: report.drives[0].id })}
          >
            By drive
          </button>
        </div>
        {!byDrive ? (
          <select
            aria-label="Passing year"
            value={report?.filter.year ?? ''}
            onChange={(e) => setQuery({ year: Number(e.target.value) })}
          >
            {(report?.years ?? []).map((y) => (
              <option key={y} value={y}>
                Passing out in {y}
              </option>
            ))}
          </select>
        ) : (
          <select aria-label="Drive" value={query.placementId} onChange={(e) => setQuery({ placementId: e.target.value })}>
            {(report?.drives ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} · {d.type === 'INTERNSHIP' ? 'internship' : 'final'}
                {scope === 'tenant' ? ` · ${d.college}` : ''}
              </option>
            ))}
          </select>
        )}
        {loading && <span className="muted">Counting…</span>}
      </div>

      {error && <p className="alert alert-error">{error}</p>}

      {report && f && (
        <>
          {report.pool === 0 ? (
            <div className="empty">
              <h2>No students in this report</h2>
              <p>
                Nobody is recorded as passing out in this year{scope === 'college' ? ' at your college' : ''}. Pick another year, or check the
                passing year on your batches.
              </p>
            </div>
          ) : (
            <>
              <div className="rp-hero">
                <div className="rp-headline">
                  <span className="rp-big">{pct(f.placedPct)}</span>
                  <span>
                    placed · <strong>{f.placed}</strong> of <strong>{report.pool}</strong> students
                  </span>
                </div>
                <div className="rp-bar" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, f.placedPct ?? 0)}%` }} />
                </div>
              </div>

              <div className="stat-row">
                <Stat label="Students in the pool" value={report.pool} />
                <Stat label="Applied at least once" value={f.applied} />
                <Stat label="Offers made" value={f.offersMade} />
                <Stat label="Median package" value={lakhs(f.pay.median)} title={full(f.pay.median)} />
                <Stat label="Highest package" value={lakhs(f.pay.highest)} title={full(f.pay.highest)} />
                <Stat label="Recruiting companies" value={f.recruiters} />
              </div>

              <p className="rp-intern">
                <strong>Internships</strong>, counted separately: {report.internship.placed} student
                {report.internship.placed === 1 ? '' : 's'} accepted one
                {report.internship.pay.median !== null && ` · median stipend ₹${report.internship.pay.median.toLocaleString('en-IN')} a month`}.
              </p>

              {report.byCollege.length > 0 && (
                <section className="card">
                  <h2>By college</h2>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>College</th>
                          <th className="num">Students</th>
                          <th className="num">Placed</th>
                          <th className="num">% placed</th>
                          <th className="num">Median package</th>
                          <th className="num">Companies</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.byCollege.map((c) => (
                          <tr key={c.collegeId ?? 'university'}>
                            <td>
                              {c.college}
                              {c.code && <span className="row-sub"> {c.code}</span>}
                            </td>
                            <td className="num">{c.pool}</td>
                            <td className="num">{c.placed}</td>
                            <td className="num">
                              <Meter value={c.placedPct} />
                            </td>
                            <td className="num">{lakhs(c.medianCtc)}</td>
                            <td className="num">{c.recruiters}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              <section className="card">
                <h2>By course and branch</h2>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Course</th>
                        <th>Branch</th>
                        <th className="num">Students</th>
                        <th className="num">Placed</th>
                        <th className="num">% placed</th>
                        <th className="num">Median</th>
                        <th className="num">Highest</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byBranch.map((b) => (
                        <tr key={`${b.course}|${b.branch}`}>
                          <td>{b.course ?? <span className="muted">Not recorded</span>}</td>
                          <td>{b.branch ?? <span className="muted">All branches</span>}</td>
                          <td className="num">{b.pool}</td>
                          <td className="num">{b.placed}</td>
                          <td className="num">
                            <Meter value={b.placedPct} />
                          </td>
                          <td className="num">{lakhs(b.medianCtc)}</td>
                          <td className="num">{lakhs(b.highestCtc)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="card">
                <h2>By company</h2>
                {report.byCompany.length === 0 ? (
                  <p className="muted">No offers yet in this report.</p>
                ) : (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Company</th>
                          <th className="num">Offers made</th>
                          <th className="num">Accepted</th>
                          <th className="num">Median</th>
                          <th className="num">Highest</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.byCompany.map((c) => (
                          <tr key={c.company}>
                            <td>{c.company}</td>
                            <td className="num">{c.offers}</td>
                            <td className="num">{c.accepted}</td>
                            <td className="num">{lakhs(c.medianCtc)}</td>
                            <td className="num">{lakhs(c.highestCtc)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

          <section className="card rp-notes">
            <h2>What these numbers are - and are not</h2>
            <ul>
              <li>
                <strong>Placed</strong> means a student accepted an offer that stood. Someone with two offers counts once, at their
                better one.
              </li>
              <li>
                <strong>Package</strong> is the fixed annual CTC on the role.
                {f.payBasis.fromRangeMin > 0 &&
                  ` For ${f.payBasis.fromRangeMin} offer${f.payBasis.fromRangeMin === 1 ? '' : 's'} with no fixed figure, the bottom of the advertised range is used.`}
                {f.payBasis.missing > 0 &&
                  ` ${f.payBasis.missing} offer${f.payBasis.missing === 1 ? ' has' : 's have'} no pay stated and ${f.payBasis.missing === 1 ? 'is' : 'are'} left out.`}
              </li>
              {report.notTracked.map((n) => (
                <li key={n} className="rp-gap">
                  <strong>Not tracked:</strong> {n}
                </li>
              ))}
              <li className="muted">{report.consentNote}</li>
            </ul>
          </section>
        </>
      )}
    </>
  );
}

function Stat({ label, value, title }: { label: string; value: string | number; title?: string }) {
  return (
    <div className="stat" title={title}>
      <p className="stat-value">{value}</p>
      <p className="stat-label">{label}</p>
    </div>
  );
}

/** A percentage with a small bar, so a table of them can be read by shape. */
function Meter({ value }: { value: number | null }) {
  return (
    <span className="rp-meter">
      {pct(value)}
      <span className="rp-meter-track" aria-hidden="true">
        <span style={{ width: `${Math.min(100, value ?? 0)}%` }} />
      </span>
    </span>
  );
}

/** The placement cell's page: its own college. */
export default function Reports() {
  return (
    <CampusLayout>
      <ReportView scope="college" />
    </CampusLayout>
  );
}
