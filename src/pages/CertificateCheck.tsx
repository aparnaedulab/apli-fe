import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { proofApi, type Certificate } from '../api/proof';

/**
 * /certificates/:code - anyone can check a work-simulation certificate.
 *
 * No sign-in, because the people who need it - a recruiter elsewhere, a
 * parent - have no account here. It shows only what the certificate itself
 * states, and a code that does not match says so plainly.
 */
export default function CertificateCheck() {
  const { code = '' } = useParams();
  const [cert, setCert] = useState<Certificate | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'invalid'>('loading');

  useEffect(() => {
    proofApi
      .certificate(code)
      .then((c) => {
        setCert(c);
        setState('ok');
      })
      .catch(() => setState('invalid'));
  }, [code]);

  return (
    <main className="status-page">
      <p className="eyebrow">Certificate check</p>
      {state === 'loading' && <h1>Checking…</h1>}
      {state === 'invalid' && (
        <>
          <h1>This is not a valid certificate.</h1>
          <p className="status-lede">
            No completed work simulation carries the code <code>{code.toUpperCase()}</code>. Check it was typed exactly as
            printed.
          </p>
        </>
      )}
      {state === 'ok' && cert && (
        <>
          <h1>✓ This certificate is real.</h1>
          <div className="status-list">
            <div className="status-row">
              <span>Awarded to</span>
              <span className="status-value is-ok">{cert.student}</span>
            </div>
            <div className="status-row">
              <span>For</span>
              <span className="status-value">
                {cert.simulation} · {cert.role}
              </span>
            </div>
            <div className="status-row">
              <span>Reviewed by</span>
              <span className="status-value">{cert.company}</span>
            </div>
            <div className="status-row">
              <span>Completed</span>
              <span className="status-value">
                {new Date(cert.completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
            <div className="status-row">
              <span>Code</span>
              <span className="status-value">{cert.code}</span>
            </div>
          </div>
          <p className="status-lede" style={{ marginTop: 20 }}>
            The company read this work and then heard the student explain it on a call before issuing the certificate.
          </p>
        </>
      )}
      <p className="status-back">
        <Link to="/">← Apli.ai</Link>
      </p>
    </main>
  );
}
