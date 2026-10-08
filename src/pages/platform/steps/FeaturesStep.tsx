import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ApiError } from '../../../api/client';
import { platformApi, type Audience, type ModuleCategory, type ModuleDefinition } from '../../../api/platform';
import type { StepProps } from '../Onboarding';
import { StepFooter, Toggle } from '../ui';

const AUDIENCES: { key: Audience | 'all'; label: string }[] = [
  { key: 'all', label: 'Everything' },
  { key: 'student', label: 'For students' },
  { key: 'college', label: 'For colleges' },
  { key: 'company', label: 'For recruiters' },
];

const AUDIENCE_TAG: Record<Audience, string> = { student: 'Students', college: 'Colleges', company: 'Recruiters' };

/**
 * Plan first, then fine-tuning.
 *
 * Most people choose a plan and stop, so the plans come first and do all the
 * work. Switching a module on also switches on what it depends on, and
 * switching one off also switches off what depends on it - each time with a
 * sentence saying so, because a toggle that silently moves other toggles is
 * the fastest way to lose somebody's trust in a screen.
 */
export default function FeaturesStep({ state, catalogue, onSaved, goto }: StepProps) {
  const t = state!.tenant;
  const { modules, plans, categories } = catalogue;
  const byKey = useMemo(() => new Map(modules.map((m) => [m.key, m])), [modules]);

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(state!.modules.length ? state!.modules : plans[0]!.modules),
  );
  const [audience, setAudience] = useState<Audience | 'all'>('all');
  // Which recruiters get in at all, asked beside what they get once inside.
  const [openDoor, setOpenDoor] = useState(t.unverifiedCompanyAccess ?? false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentPlan = useMemo(() => {
    for (const p of plans) {
      if (p.modules.length === selected.size && p.modules.every((k) => selected.has(k))) return p.key;
    }
    return 'CUSTOM';
  }, [plans, selected]);

  /** Everything `key` needs, transitively. */
  function requirementsOf(key: string, acc = new Set<string>()): Set<string> {
    for (const dep of byKey.get(key)?.requires ?? []) {
      if (!acc.has(dep)) {
        acc.add(dep);
        requirementsOf(dep, acc);
      }
    }
    return acc;
  }

  /** Everything that needs `key`, transitively, among what is switched on. */
  function dependentsOf(key: string, on: Set<string>, acc = new Set<string>()): Set<string> {
    for (const m of modules) {
      if (on.has(m.key) && m.requires?.includes(key) && !acc.has(m.key)) {
        acc.add(m.key);
        dependentsOf(m.key, on, acc);
      }
    }
    return acc;
  }

  const names = (keys: Iterable<string>) => [...keys].map((k) => byKey.get(k)?.name ?? k).join(', ');

  function toggle(m: ModuleDefinition, on: boolean) {
    const next = new Set(selected);
    if (on) {
      next.add(m.key);
      const added = [...requirementsOf(m.key)].filter((k) => !next.has(k));
      added.forEach((k) => next.add(k));
      setNotice(added.length ? `Also switched on ${names(added)}, because ${m.name} needs ${added.length === 1 ? 'it' : 'them'}.` : null);
    } else {
      next.delete(m.key);
      const dropped = [...dependentsOf(m.key, next)];
      dropped.forEach((k) => next.delete(k));
      setNotice(dropped.length ? `Also switched off ${names(dropped)}, which ${dropped.length === 1 ? 'needs' : 'need'} ${m.name}.` : null);
    }
    setSelected(next);
  }

  function choosePlan(keys: string[]) {
    setSelected(new Set(keys));
    setNotice(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const next = await platformApi.saveFeatures(t.id, [...selected], openDoor);
      onSaved(next, 'help');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const liveCount = [...selected].filter((k) => byKey.get(k)?.status === 'live').length;
  const grouped = (Object.keys(categories) as ModuleCategory[])
    .map((cat) => ({
      cat,
      items: modules.filter((m) => m.category === cat && (audience === 'all' || m.audience.includes(audience))),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <form onSubmit={submit} noValidate>
      <section className="blk">
        <h2 className="blk-title">Start from a plan</h2>
        <div className="plans">
          {plans.map((p) => {
            const live = p.modules.filter((k) => byKey.get(k)?.status === 'live').length;
            const on = currentPlan === p.key;
            return (
              <button
                key={p.key}
                type="button"
                className={`plan ${on ? 'is-on' : ''}`}
                aria-pressed={on}
                onClick={() => choosePlan(p.modules)}
              >
                <span className="plan-name">{p.name}</span>
                <span className="plan-pitch">{p.pitch}</span>
                <span className="plan-count">
                  <strong>{p.modules.length}</strong> modules · {live} live today
                </span>
                <span className="plan-check" aria-hidden="true">
                  {on ? 'Selected' : 'Choose'}
                </span>
              </button>
            );
          })}
        </div>
        {currentPlan === 'CUSTOM' && (
          <p className="f-hint">
            <span className="pill pill-hold">Custom</span> Fine-tuned from a plan. That is fine - it is saved exactly as
            chosen.
          </p>
        )}
      </section>

      <section className="blk">
        <div className="blk-head">
          <div>
            <h2 className="blk-title">Fine-tune</h2>
            <p className="blk-sub">
              <strong>Live</strong> modules work today. Phased ones switch on for this institution the day they ship.
            </p>
          </div>
          <div className="seg seg-sm" role="radiogroup" aria-label="Show modules for">
            {AUDIENCES.map((a) => (
              <button
                key={a.key}
                type="button"
                role="radio"
                aria-checked={audience === a.key}
                className={`seg-opt ${audience === a.key ? 'is-on' : ''}`}
                onClick={() => setAudience(a.key)}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {notice && (
          <p className="notice ob-in" role="status">
            {notice}
          </p>
        )}

        <div className="cats">
          {grouped.map(({ cat, items }) => {
            const onCount = items.filter((m) => selected.has(m.key)).length;
            return (
              <div key={cat} className="cat">
                <div className="cat-head">
                  <h3>{categories[cat].name}</h3>
                  <span className="muted">
                    {onCount} of {items.length}
                  </span>
                  <p>{categories[cat].blurb}</p>
                </div>
                <ul className="mods">
                  {items.map((m) => (
                    <li key={m.key} className={`mod ${selected.has(m.key) ? 'is-on' : ''}`}>
                      <Toggle
                        checked={selected.has(m.key)}
                        disabled={m.core}
                        onChange={(v) => toggle(m, v)}
                        label={
                          <>
                            {m.name}
                            {m.status === 'live' ? (
                              <span className="pill pill-pass">Live</span>
                            ) : (
                              <span className="pill pill-idle">Phase {m.phase}</span>
                            )}
                          </>
                        }
                        description={
                          <>
                            {m.summary}
                            <span className="mod-meta">
                              {m.core ? 'Always included · ' : ''}
                              {m.audience.map((a) => AUDIENCE_TAG[a]).join(' · ')}
                              {m.requires?.length ? ` · needs ${names(m.requires)}` : ''}
                            </span>
                          </>
                        }
                      />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section className="blk">
        <h2 className="blk-title">Who gets in</h2>
        <p className="blk-sub">
          Every company on Apli.ai is checked by us before it can hire anywhere — registration
          numbers, website, address. What you decide here is only whether a company may look around
          while that check is happening.
        </p>
        <Toggle
          checked={openDoor}
          onChange={setOpenDoor}
          label="Companies can sign in while we check them"
          description="Off (usual): a company that registers cannot sign in until we have verified it. On: it signs in at once and can draft a role — it still reaches none of your colleges, and your placement cells see nothing from it, until the check is done."
        />
        <p className="blk-sub">
          {openDoor
            ? 'Recruiters will not be kept waiting, and nothing of yours is exposed either way.'
            : 'Recruiters wait for our check, which is the stricter of the two and what most institutions choose.'}
        </p>
      </section>

      <StepFooter
        busy={busy}
        error={error}
        onBack={() => goto('batches')}
        submitLabel="Save & continue"
        note={`${selected.size} modules · ${liveCount} live today`}
      />
    </form>
  );
}
