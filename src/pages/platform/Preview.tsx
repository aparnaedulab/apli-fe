import { useEffect, useMemo, useState } from 'react';
import type { Audience, Catalogue, TenantKind } from '../../api/platform';
import { lightTokens, monogram } from '../../lib/brand';

export interface PreviewModel {
  name: string;
  shortName: string;
  brandColor: string;
  logoUrl: string;
  faviconUrl: string;
  kind: TenantKind;
  tagline: string;
  modules: string[];
  colleges: number;
}

const VIEWS: { key: Audience; label: string }[] = [
  { key: 'student', label: 'Student' },
  { key: 'college', label: 'Placement cell' },
  { key: 'company', label: 'Recruiter' },
];

/**
 * The institution's portal, drawn small, as each audience will see it.
 *
 * The menu holds screens, not features. A feature appears inside the screen it
 * belongs to - the honest offer card inside Jobs - and a screen of its own
 * ("Prepare", "Reports") only shows up once a switched-on feature needs it.
 * Below the window, the switched-on features are simply listed by name.
 */
export default function Preview({ model, catalogue }: { model: PreviewModel; catalogue: Catalogue | null }) {
  const [view, setView] = useState<Audience>('student');
  const [tab, setTab] = useState('dashboard');
  const tokens = lightTokens(model.brandColor) ?? lightTokens('#1d3b8b')!;
  const [logoFailed, setLogoFailed] = useState<string | null>(null);

  /** Every switched-on feature, grouped by the screen it sits on for this audience. */
  const byScreen = useMemo(() => {
    const map = new Map<string, Catalogue['modules']>();
    if (!catalogue) return map;
    const on = new Set(model.modules);
    for (const m of catalogue.modules) {
      if (!(m.core || on.has(m.key))) continue;
      const screen = catalogue.moduleScreens[m.key]?.[view];
      if (!screen) continue;
      map.set(screen, [...(map.get(screen) ?? []), m]);
    }
    return map;
  }, [catalogue, model.modules, view]);

  const tabs = useMemo(
    () => (catalogue?.screens[view] ?? []).filter((s) => s.core || byScreen.has(s.key)),
    [catalogue, view, byScreen],
  );

  // A tab that disappears (its only feature switched off) hands back to Dashboard.
  useEffect(() => {
    if (tabs.length && !tabs.some((t) => t.key === tab)) setTab('dashboard');
  }, [tabs, tab]);

  const current = tabs.find((t) => t.key === tab) ?? tabs[0];
  const added = catalogue ? catalogue.modules.filter((m) => model.modules.includes(m.key)) : [];
  const display = model.shortName || model.name || 'Your institution';
  const showLogo = model.logoUrl && logoFailed !== model.logoUrl;
  const live = catalogue ? catalogue.modules.filter((m) => model.modules.includes(m.key) && m.status === 'live').length : 0;

  return (
    <div className="pv">
      <p className="pv-caption">Live preview</p>

      <div className="pv-tabs" role="tablist" aria-label="Whose view">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={view === v.key}
            className={view === v.key ? 'is-on' : ''}
            onClick={() => {
              setView(v.key);
              setTab('dashboard');
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div
        className="pv-window"
        style={{ ['--pv-brand' as string]: tokens.brand, ['--pv-on' as string]: tokens.onBrand, ['--pv-soft' as string]: tokens.soft }}
      >
        <div className="pv-chrome" aria-hidden="true">
          <span />
          <span />
          <span />
          {model.faviconUrl && <img className="pv-favicon" src={model.faviconUrl} alt="" />}
          <em>
            {(catalogue?.portalBase ?? '').replace(/^https?:\/\//, '')}/t/{slugHint(model) || '…'}
          </em>
        </div>

        <div className="pv-app">
          <div className="pv-side">
            <div className="pv-brand">
              {showLogo ? (
                <img src={model.logoUrl} alt="" onError={() => setLogoFailed(model.logoUrl)} />
              ) : (
                <span className="pv-mono">{monogram(model.name || 'Your Institution', model.shortName)}</span>
              )}
              <span className="pv-brand-name">{display}</span>
            </div>
            <ul className="pv-menu">
              {tabs.map((t) => {
                const items = byScreen.get(t.key) ?? [];
                const allPlanned = !t.core && items.every((m) => m.status === 'planned');
                return (
                  <li key={t.key}>
                    <button
                      type="button"
                      className={current?.key === t.key ? 'is-on' : ''}
                      onClick={() => setTab(t.key)}
                      title={`${items.length} feature${items.length === 1 ? '' : 's'} here`}
                    >
                      {t.label}
                      {allPlanned && <span className="pv-soon">soon</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="pv-page">
            <div className="pv-hero">
              <p>{current?.key === 'dashboard' ? greeting(view) : display}</p>
              <strong>{current?.key === 'dashboard' ? model.tagline || headline(view, model) : current?.label}</strong>
            </div>
            <div className="pv-cards" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>

      <dl className="pv-facts">
        <div>
          <dt>Features</dt>
          <dd>{model.modules.length || '—'}</dd>
        </div>
        <div>
          <dt>Live today</dt>
          <dd>{model.modules.length ? live : '—'}</dd>
        </div>
        <div>
          <dt>{model.kind === 'COLLEGE' ? 'College' : 'Colleges'}</dt>
          <dd>{model.colleges || '—'}</dd>
        </div>
      </dl>

      {added.length > 0 && (
        <div className="pv-added">
          <p className="pv-caption pv-caption-plain">Features</p>
          <ul>
            {added.map((m) => (
              <li key={m.key}>{m.name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function slugHint(model: PreviewModel): string {
  return (model.shortName || model.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

function greeting(view: Audience): string {
  return view === 'student' ? 'Good morning, Riya' : view === 'college' ? 'Placement cell' : 'Welcome back';
}

function headline(view: Audience, model: PreviewModel): string {
  const who = model.shortName || model.name || 'your institution';
  if (view === 'student') return `3 new roles at ${who} this week`;
  if (view === 'college') return '2 company requests waiting for you';
  return `Hire from ${who}`;
}
