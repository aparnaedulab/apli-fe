import { useState } from 'react';
import StudentLayout from './StudentLayout';
import { useAuth } from '../../auth/AuthContext';
import { BUDGET_KIT, DAY_CHECKLIST, DRESS, GROOMING, LESSONS } from './prepare/content';
import SetupCheck from './prepare/SetupCheck';
import './Prepare.css';

type Tab = 'dress' | 'etiquette' | 'day' | 'setup';

const TABS: { key: Tab; label: string }[] = [
  { key: 'dress', label: 'What to wear' },
  { key: 'etiquette', label: 'Etiquette' },
  { key: 'day', label: 'Interview day' },
  { key: 'setup', label: 'Camera & mic check' },
];

const CHECK_KEY = 'prepare.dayChecklist';

function readChecks(): Record<string, boolean> {
  try {
    return JSON.parse(window.localStorage.getItem(CHECK_KEY) ?? '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
}

/**
 * Professional presence: the things students are often too shy to ask.
 *
 * What to wear for the kind of company, how to write to HR, what to carry on
 * the day, and whether the camera and light are right for an online round.
 * Written to reassure, not to judge - nobody is marked on any of it.
 */
export default function Prepare() {
  const { hasModule } = useAuth();
  const [tab, setTab] = useState<Tab>('dress');

  if (!hasModule('dev.presence')) {
    return (
      <StudentLayout>
        <header className="page-head">
          <div>
            <p className="eyebrow">Prepare</p>
            <h1>Prepare</h1>
            <p className="page-lede">Your institution has not switched on interview preparation yet.</p>
          </div>
        </header>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Prepare</p>
          <h1>Walk in ready</h1>
          <p className="page-lede">What to wear, what to say, what to carry - and a quick check before an online round.</p>
        </div>
      </header>

      <div className="prep-tabs" role="tablist" aria-label="Preparation topics">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? 'is-on' : ''}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="prep-body" key={tab}>
        {tab === 'dress' && <Dress />}
        {tab === 'etiquette' && <Etiquette />}
        {tab === 'day' && <Day />}
        {tab === 'setup' && <SetupCheck />}
      </div>
    </StudentLayout>
  );
}

function Dress() {
  const [pick, setPick] = useState(DRESS[0]!.key);
  const guide = DRESS.find((d) => d.key === pick)!;
  return (
    <>
      <p className="prep-lede">Pick the kind of company. There is no single right answer - dress for the room you are walking into.</p>
      <div className="prep-chips">
        {DRESS.map((d) => (
          <button key={d.key} type="button" className={`prep-chip ${pick === d.key ? 'is-on' : ''}`} onClick={() => setPick(d.key)}>
            {d.industry}
          </button>
        ))}
      </div>

      <section className="prep-card">
        <p className="prep-card-kicker">
          {guide.standard} · {guide.examples}
        </p>
        <div className="prep-looks">
          {guide.looks.map((l) => (
            <div key={l.who}>
              <h3>{l.who}</h3>
              <ul>
                {l.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="prep-avoid">
          <strong>Skip:</strong> {guide.avoid.join(' · ')}
        </p>
      </section>

      <div className="prep-two">
        <section className="prep-card">
          <h3>{BUDGET_KIT.title}</h3>
          <table className="prep-kit">
            <tbody>
              {BUDGET_KIT.items.map((i) => (
                <tr key={i.item}>
                  <td>{i.item}</td>
                  <td>{i.cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">{BUDGET_KIT.tip}</p>
        </section>
        <section className="prep-card">
          <h3>Grooming, the night before</h3>
          <ul className="prep-ticks">
            {GROOMING.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

function Etiquette() {
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <div className="prep-lessons">
      {LESSONS.map((l) => (
        <section key={l.key} className="prep-card">
          <h3>{l.title}</h3>
          <ul>
            {l.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          {l.template && (
            <div className="prep-template">
              <pre>{l.template}</pre>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  void navigator.clipboard?.writeText(l.template!).then(() => {
                    setCopied(l.key);
                    window.setTimeout(() => setCopied(null), 1600);
                  });
                }}
              >
                {copied === l.key ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function Day() {
  const [checks, setChecks] = useState<Record<string, boolean>>(readChecks);
  const done = DAY_CHECKLIST.filter((c) => checks[c.key]).length;

  function toggle(key: string) {
    setChecks((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        window.localStorage.setItem(CHECK_KEY, JSON.stringify(next));
      } catch {
        // Ticks still work for this visit; they just will not be remembered.
      }
      return next;
    });
  }

  function reset() {
    setChecks({});
    try {
      window.localStorage.removeItem(CHECK_KEY);
    } catch {
      // Nothing to clear.
    }
  }

  return (
    <section className="prep-card">
      <div className="prep-day-head">
        <h3>
          {done === DAY_CHECKLIST.length ? 'All set. You have done the work - go and enjoy the conversation.' : `${done} of ${DAY_CHECKLIST.length} ready`}
        </h3>
        {done > 0 && (
          <button type="button" className="prep-reset" onClick={reset}>
            Start over
          </button>
        )}
      </div>
      <div className="prep-bar" aria-hidden="true">
        <span style={{ width: `${(done / DAY_CHECKLIST.length) * 100}%` }} />
      </div>
      <ul className="prep-day">
        {DAY_CHECKLIST.map((c) => (
          <li key={c.key}>
            <label>
              <input type="checkbox" checked={Boolean(checks[c.key])} onChange={() => toggle(c.key)} />
              <span>{c.text}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="muted">Nervous? That is your body getting ready. Slow breath in for four, out for six - twice - before you walk in.</p>
    </section>
  );
}
