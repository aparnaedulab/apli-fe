import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '../../api/client';
import { demoLoginsApi, type DemoGroup, type DemoLogins } from '../../api/demoLogins';
import ConsoleHeader from './ConsoleHeader';
import './Platform.css';
import './demoLogins.css';

/**
 * Demo logins: one account for every situation worth showing - a student
 * mid-interview, a company with work to review, a placement officer with a
 * job request waiting - and one button that puts every one of them back
 * where it started, however much a demo has changed them.
 */

const GROUPS: (DemoGroup | 'All')[] = ['All', 'University', 'Placement cell', 'Company', 'Student'];

function since(iso: string | null) {
  if (!iso) return null;
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export default function ConsoleDemoLogins() {
  const [data, setData] = useState<DemoLogins | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useState<DemoGroup | 'All'>('All');
  const [q, setQ] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(() => {
    demoLoginsApi
      .list()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load the demo logins.'));
  }, []);
  useEffect(load, [load]);

  async function reset() {
    setResetting(true);
    setError(null);
    setDone(null);
    try {
      const r = await demoLoginsApi.reset();
      setData(r);
      setDone(`All ${r.result.logins} demo logins are back to where they started (took ${r.result.seconds}s).`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The reset did not finish. Try again.');
    } finally {
      setResetting(false);
      setConfirming(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(text);
        window.setTimeout(() => setCopied((c) => (c === text ? null : c)), 1500);
      },
      () => undefined,
    );
  }

  const used = useMemo(() => (data?.logins ?? []).filter((l) => l.lastLoginAt).length, [data]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.logins ?? []).filter(
      (l) =>
        (group === 'All' || l.group === group) &&
        (!needle || `${l.name} ${l.email} ${l.situation}`.toLowerCase().includes(needle)),
    );
  }, [data, group, q]);

  return (
    <div className="console">
      <ConsoleHeader />

      <main className="console-main">
        <section className="console-hero">
          <div>
            <p className="eyebrow">Demo logins</p>
            <h1>One login for every situation.</h1>
            <p className="console-lede">
              {data
                ? `${data.logins.length} logins · ${used} used since the last reset${data.builtAt ? ` · last reset ${since(data.builtAt)}` : ''}`
                : 'Loading…'}
            </p>
          </div>
        </section>

        {data && !data.enabled && (
          <p className="notice notice-warn">
            Demo logins are switched off on this server, so they can't be reset from here. To switch them on, set{' '}
            <code>DEMO_LOGINS=true</code> in the server settings and restart it. Use this on a demo server only: the demo
            companies' simulations are shown to every student on the server.
          </p>
        )}
        {error && <p className="notice notice-stop">{error}</p>}
        {done && <p className="notice dl-done">{done}</p>}

        {data && (
          <section className="dl-panel">
            <div className="dl-pass">
              <span className="dl-label">Password for every login</span>
              <code>{data.password}</code>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => copy(data.password)}>
                {copied === data.password ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div className="dl-reset">
              {!confirming ? (
                <>
                  <p>
                    Used a login and changed something? Reset puts <b>every</b> demo login back to its starting
                    situation. It only touches the demo pack (Apli Demo University and the four demo companies),
                    never real data.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!data.enabled || resetting}
                    onClick={() => setConfirming(true)}
                  >
                    {data.built ? 'Reset demo logins' : 'Create demo logins'}
                  </button>
                </>
              ) : (
                <>
                  <p>
                    <b>Reset all {data.logins.length} demo logins now?</b> Anything done with them since the last reset
                    is undone, and anyone signed in as a demo login will need to sign in again.
                  </p>
                  <div className="dl-confirm">
                    <button type="button" className="btn btn-primary" disabled={resetting} onClick={reset}>
                      {resetting ? 'Resetting…' : 'Yes, reset'}
                    </button>
                    <button type="button" className="btn btn-secondary" disabled={resetting} onClick={() => setConfirming(false)}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {data && (
          <div className="console-bar dl-bar">
            <div className="seg" role="radiogroup" aria-label="Show">
              {GROUPS.map((g) => (
                <button
                  key={g}
                  type="button"
                  role="radio"
                  aria-checked={group === g}
                  className={`seg-opt ${group === g ? 'is-on' : ''}`}
                  onClick={() => setGroup(g)}
                >
                  {g}{' '}
                  <span className="seg-count">
                    {g === 'All' ? data.logins.length : data.logins.filter((l) => l.group === g).length}
                  </span>
                </button>
              ))}
            </div>
            <input
              className="input dl-search"
              type="search"
              placeholder="Search: interview, offer, round 2…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search the demo logins"
            />
          </div>
        )}

        {data && !data.built && (
          <p className="co-empty">The demo logins have not been created on this server yet. Press "Create demo logins".</p>
        )}

        <ul className="dl-list">
          {shown.map((l) => (
            <li key={l.email} className={`dl-card ${l.exists ? '' : 'is-missing'}`}>
              <div className="dl-head">
                <span className={`dl-group dl-${l.group.replace(' ', '-').toLowerCase()}`}>{l.group}</span>
                {l.lastLoginAt ? (
                  <span className="dl-used" title="Signed in since the last reset">
                    Used {since(l.lastLoginAt)}
                  </span>
                ) : (
                  <span className="dl-fresh">Untouched</span>
                )}
              </div>
              <h3>{l.name}</h3>
              <p className="dl-situation">{l.situation}</p>
              <button type="button" className="dl-email" onClick={() => copy(l.email)} title="Copy the email">
                <code>{l.email}</code>
                <span>{copied === l.email ? 'Copied' : 'Copy'}</span>
              </button>
              <p className="dl-label">Try this</p>
              <ol className="dl-try">
                {l.tryThis.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
        {data && shown.length === 0 && <p className="co-empty">No login matches that.</p>}
      </main>
    </div>
  );
}
