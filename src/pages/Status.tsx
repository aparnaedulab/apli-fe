import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';

interface Health {
  status: string;
  service: string;
  environment: string;
  database: string;
  time: string;
}

/**
 * Developer-facing check that the whole chain is wired:
 * React -> Vite proxy -> Express -> Prisma -> Postgres.
 */
export default function Status() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Health>('/health')
      .then(setHealth)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'Could not reach the server.');
      });
  }, []);

  return (
    <main className="status-page">
      <p className="eyebrow">System status</p>
      <h1>Everything wired?</h1>

      <div className="status-list" aria-live="polite">
        <Row label="React client" value="running" ok />
        <Row
          label="API server"
          value={health ? 'reachable' : error ? 'unreachable' : 'checking'}
          ok={!!health}
        />
        <Row
          label="PostgreSQL"
          value={health?.database ?? (error ? 'unknown' : 'checking')}
          ok={health?.database === 'connected'}
        />
        <Row label="Environment" value={health?.environment ?? '—'} ok={!!health} />
      </div>

      {error && (
        <p className="status-error">
          {error} Start the API with <code>npm run dev</code> in <code>server/</code>, and make sure
          Postgres is up with <code>docker compose up -d</code>.
        </p>
      )}

      <p className="status-back">
        <Link to="/">← Back to the site</Link>
      </p>
    </main>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="status-row">
      <span>{label}</span>
      <span className={ok ? 'status-value is-ok' : 'status-value'}>{value}</span>
    </div>
  );
}
