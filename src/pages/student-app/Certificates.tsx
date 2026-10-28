import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { LEVEL_LABEL, studentAppApi, type Certificate, type Dashboard } from '../../api/studentApp';
import { useAuth } from '../../auth/AuthContext';
import Shell, { CompanyTile } from './Shell';
import ShareDialog from './Share';
import { printCertificate } from './printCertificate';

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

/**
 * The student's certificates, each drawn as a certificate: who earned it,
 * for which company's simulation, when, and the code anyone can check.
 *
 * Each one can be verified (the public check page), its link copied, shared
 * with companies, or printed / saved as a PDF on its own.
 */
export default function Certificates() {
  const { user } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState<Certificate | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  const load = () =>
    studentAppApi
      .dashboard()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load your certificates.'));

  useEffect(() => {
    load();
  }, []);

  const certs = data?.certificates ?? [];
  const hours = certs.reduce((n, c) => n + c.simulation.hours, 0);
  const companies = new Set(certs.map((c) => c.simulation.company.name)).size;
  const shared = certs.filter((c) => c.sharedWith.length > 0).length;
  const link = (code: string) => `${window.location.origin}/certificates/${code}`;

  return (
    <Shell>
      <section className="sa-hero is-short">
        <div className="sa-wrap sa-ov-head">
          <div>
            <p className="sa-eyebrow">Certificates</p>
            <h1>
              Proof of <span className="sa-mark">real work</span>
            </h1>
            <p className="sa-lede">
              Each certificate is issued when the company approves your work. Anyone - a recruiter, a college, a parent - can
              check it with its code.
            </p>
          </div>
          <Link to="/student/simulations" className="sa-btn">
            Earn another <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <div className="sa-wrap sa-body">
        {error && <p className="sa-alert">{error}</p>}
        {blocked && (
          <p className="sa-alert">Your browser blocked the certificate window. Allow pop-ups for this site, then try again.</p>
        )}
        {!data && !error && <p className="sa-loading">Loading…</p>}

        {data && certs.length > 0 && (
          <ul className="sa-kpis">
            <li className="sa-kpi is-green">
              <b>{certs.length}</b>
              <span className="sa-kpi-label">Certificates</span>
              <span className="sa-kpi-hint">Verified by the companies</span>
            </li>
            <li className="sa-kpi is-blue">
              <b>{hours}</b>
              <span className="sa-kpi-label">Hours of approved work</span>
              <span className="sa-kpi-hint">Across every simulation</span>
            </li>
            <li className="sa-kpi is-violet">
              <b>{companies}</b>
              <span className="sa-kpi-label">Companies</span>
              <span className="sa-kpi-hint">Whose work you have done</span>
            </li>
            <li className="sa-kpi is-orange">
              <b>
                {shared}/{certs.length}
              </b>
              <span className="sa-kpi-label">Shared</span>
              <span className="sa-kpi-hint">{shared ? 'Companies can see these' : 'Nothing shared yet'}</span>
            </li>
          </ul>
        )}

        {data && certs.length === 0 && (
          <div className="sa-empty cert-empty">
            <span className="cert-empty-seal" aria-hidden="true">
              ✓
            </span>
            <b>No certificates yet</b>
            <span>Finish a simulation and hand it in. When the company approves your work, its certificate appears here.</span>
            <Link to="/student/simulations" className="sa-btn">
              Find a simulation
            </Link>
          </div>
        )}

        <div className="cert-grid">
          {certs.map((c) => (
            <article key={c.runId} className="cert">
              <div className="cert-paper">
                <div className="cert-top">
                  <CompanyTile company={c.simulation.company} />
                  <span className="cert-kind">Certificate of completion</span>
                  <span className="cert-seal" aria-hidden="true">
                    ✓
                  </span>
                </div>
                <p className="cert-awarded">This certifies that</p>
                <p className="cert-name">{user?.fullName}</p>
                <p className="cert-for">
                  completed the <b>{c.simulation.title}</b> work simulation with <b>{c.simulation.company.name}</b>, and the
                  company approved the work.
                </p>
                <ul className="cert-facts">
                  <li>{c.simulation.field}</li>
                  <li>{LEVEL_LABEL[c.simulation.level]}</li>
                  <li>
                    {c.simulation.tasks} task{c.simulation.tasks === 1 ? '' : 's'} · ~{c.simulation.hours} hrs
                  </li>
                </ul>
                {c.simulation.skills.length > 0 && (
                  <p className="cert-skills">
                    Skills: {c.simulation.skills.slice(0, 5).join(' · ')}
                  </p>
                )}
                <div className="cert-foot">
                  <span>
                    <i>Issued</i>
                    <b>{day(c.completedAt)}</b>
                  </span>
                  <span>
                    <i>Certificate code</i>
                    <b className="cert-code">{c.certificateCode}</b>
                  </span>
                  <span>
                    <i>Verify at</i>
                    <b>apli.ai/certificates</b>
                  </span>
                </div>
              </div>

              <div className="cert-actions">
                {c.certificateCode && (
                  <a className="sa-btn is-small" href={`/certificates/${c.certificateCode}`} target="_blank" rel="noreferrer">
                    Verify <span aria-hidden="true">↗</span>
                  </a>
                )}
                {c.certificateCode && (
                  <button
                    type="button"
                    className="sa-btn is-ghost is-small"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(link(c.certificateCode!));
                        setCopied(c.runId);
                        window.setTimeout(() => setCopied(null), 1600);
                      } catch {
                        // Clipboard refused; Verify still opens the link.
                      }
                    }}
                  >
                    {copied === c.runId ? '✓ Link copied' : 'Copy link'}
                  </button>
                )}
                <button type="button" className="sa-btn is-ghost is-small" onClick={() => setSharing(c)}>
                  {c.sharedWith.length ? `Shared with ${c.sharedWith.length}` : 'Share with companies'}
                </button>
                <button
                  type="button"
                  className="sa-btn is-ghost is-small"
                  onClick={() => setBlocked(!printCertificate(c, user?.fullName ?? ''))}
                >
                  Print / save PDF
                </button>
              </div>
              {c.sharedWith.length > 0 && (
                <p className="cert-shared">Companies who can see it: {c.sharedWith.map((x) => x.name).join(', ')}</p>
              )}
            </article>
          ))}
        </div>
      </div>

      {sharing && (
        <ShareDialog
          runId={sharing.runId}
          title={sharing.simulation.title}
          onClose={() => setSharing(null)}
          onSaved={() => {
            setSharing(null);
            load();
          }}
        />
      )}
    </Shell>
  );
}
