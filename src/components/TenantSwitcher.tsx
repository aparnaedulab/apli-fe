import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { platformApi, type TenantCard } from '../api/platform';
import { useAuth } from '../auth/AuthContext';
import { lightTokens, monogram } from '../lib/brand';
import './TenantSwitcher.css';

/**
 * Whose portal this is, at the top of the sidebar.
 *
 * For an institution's own staff it is a name badge and nothing more - they
 * belong to one institution and there is nowhere else to go. For the platform
 * team it is also a switcher: they step between institutions here, and every
 * screen below repaints and re-reads for the one they picked.
 */
export default function TenantSwitcher({ collapsed }: { collapsed: boolean }) {
  const { user, tenant, actAs } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tenants, setTenants] = useState<TenantCard[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const platform = Boolean(user?.isPlatform);

  useEffect(() => {
    if (!open || tenants || !platform) return;
    platformApi
      .tenants()
      .then((r) => setTenants(r.tenants.filter((t) => t.status !== 'SUSPENDED')))
      .catch(() => setTenants([]));
  }, [open, tenants, platform]);

  // Closes on a click anywhere else, and on Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function pick(id: string) {
    setOpen(false);
    await actAs(id);
    navigate('/admin');
  }

  const name = tenant ? tenant.shortName || tenant.name : platform ? 'No institution' : 'Apli.ai';

  const badge = (
    <>
      <span className="ts-logo" aria-hidden="true">
        {tenant?.logoUrl ? <img src={tenant.logoUrl} alt="" /> : tenant ? monogram(tenant.name, tenant.shortName) : '—'}
      </span>
      <span className="ts-text">
        <strong>{name}</strong>
        <small>{platform ? 'Platform team' : tenant?.kind === 'COLLEGE' ? 'College portal' : 'Institution portal'}</small>
      </span>
    </>
  );

  if (!platform) {
    return (
      <div className="ts" title={tenant?.name}>
        <div className="ts-badge">{badge}</div>
      </div>
    );
  }

  return (
    <div className="ts" ref={ref}>
      <button
        type="button"
        className="ts-badge ts-button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={collapsed ? name : 'Switch institution'}
      >
        {badge}
        <svg className="ts-caret" viewBox="0 0 16 16" aria-hidden="true">
          <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="ts-menu" role="menu">
          <p className="ts-menu-label">Step into</p>
          {!tenants && <p className="ts-menu-empty">Loading…</p>}
          {tenants?.length === 0 && <p className="ts-menu-empty">No institutions yet.</p>}
          {tenants?.map((t) => {
            const tokens = lightTokens(t.brandColor);
            return (
              <button key={t.id} type="button" role="menuitem" className={`ts-item ${tenant?.id === t.id ? 'is-on' : ''}`} onClick={() => pick(t.id)}>
                <span className="ts-dot" style={{ background: tokens?.brand ?? t.brandColor }} />
                <span className="ts-item-name">{t.shortName || t.name}</span>
                {t.status === 'DRAFT' && <span className="ts-draft">draft</span>}
                {tenant?.id === t.id && <span className="ts-here">✓</span>}
              </button>
            );
          })}
          <div className="ts-menu-foot">
            <Link to="/platform" role="menuitem" onClick={() => setOpen(false)}>
              ← Platform console
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/** Shown instead of an admin screen when the platform team is standing in no institution. */
export function PickTenantFirst() {
  return (
    <div className="ts-pick">
      <p className="eyebrow">Platform team</p>
      <h1>Choose an institution to work in.</h1>
      <p>
        Every screen here shows one institution’s colleges, students and drives. Pick one from the switcher at the top of
        the sidebar, or open the console to onboard a new one.
      </p>
      <Link to="/platform" className="btn btn-primary">
        Open the platform console
      </Link>
    </div>
  );
}
