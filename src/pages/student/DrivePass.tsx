import { useEffect, useMemo, useState } from 'react';
import StudentLayout from './StudentLayout';
import { ApiError } from '../../api/client';
import { opsApi, type DrivePass as Pass } from '../../api/ops';
import { useAuth } from '../../auth/AuthContext';
import { encodeQr, qrSvgPath } from './qr';
import './DrivePass.css';

/**
 * The student's pass for drive day: a QR code the desk scans, and an
 * eight-character code to read out when a camera will not cooperate.
 *
 * Nothing about the pass is secret from the student - it is signed, so it
 * cannot be forged or carried to another drive - and it works offline once
 * the page has loaded, which matters in a crowded hall with poor signal.
 */
export default function DrivePass() {
  const { hasModule } = useAuth();
  const on = hasModule('ops.driveDay');
  const [passes, setPasses] = useState<Pass[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!on) return;
    opsApi
      .passes()
      .then(setPasses)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load your passes.'));
  }, [on]);

  return (
    <StudentLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Drive day</p>
          <h1>Your drive pass</h1>
          <p className="page-lede">
            {on
              ? 'Show this at the placement cell desk when you arrive. Turn your screen brightness up.'
              : 'Drive passes are not switched on for your college.'}
          </p>
        </div>
      </header>

      {error && <p className="alert alert-error">{error}</p>}
      {on && passes === null && !error && <p className="muted">Loading…</p>}
      {passes?.length === 0 && (
        <div className="empty">
          <h2>No drive is open for you</h2>
          <p>When your college opens a placement drive that includes your batch, your pass appears here.</p>
        </div>
      )}

      <div className="dp-list">
        {passes?.map((p) => (
          <PassCard key={p.id} pass={p} />
        ))}
      </div>
    </StudentLayout>
  );
}

function PassCard({ pass }: { pass: Pass }) {
  const qr = useMemo(() => {
    try {
      return qrSvgPath(encodeQr(pass.token));
    } catch {
      return null;
    }
  }, [pass.token]);

  return (
    <article className="dp-card">
      <div className="dp-head">
        <div>
          <strong>{pass.name}</strong>
          <small>
            {pass.college} · {pass.year}
          </small>
        </div>
        {pass.checkedInAt ? (
          <span className="pill pill-pass">
            Checked in {new Date(pass.checkedInAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        ) : (
          <span className="pill pill-idle">Not checked in</span>
        )}
      </div>

      <div className="dp-body">
        {qr && (
          <svg className="dp-qr" viewBox={`0 0 ${qr.size} ${qr.size}`} role="img" aria-label="Your drive pass QR code" shapeRendering="crispEdges">
            <rect width={qr.size} height={qr.size} fill="#fff" />
            <path d={qr.path} fill="#000" />
          </svg>
        )}
        <div className="dp-code">
          <span>Pass code</span>
          <strong>
            {pass.code.slice(0, 4)} {pass.code.slice(4)}
          </strong>
          <small>Read this out if the scanner cannot see the QR code.</small>
        </div>
      </div>

      {pass.roles.length > 0 && (
        <ul className="dp-roles">
          {pass.roles.map((r, i) => (
            <li key={i}>
              <strong>{r.title}</strong>
              <span>
                {r.company}
                {r.round ? ` · next: ${r.round}` : ''}
                {r.scheduledAt
                  ? ` · ${new Date(r.scheduledAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                  : ''}
                {r.venue ? ` · ${r.venue}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
