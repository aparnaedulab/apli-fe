/**
 * What is actually inside, and how the season runs.
 *
 * Two structures borrowed from the Apli that came before this one: a gallery
 * of cards you can look into, and a four-step strip that says how the thing
 * works. What is not borrowed is the testimonial carousel and the wall of
 * supporter logos, because we have neither and inventing them is exactly the
 * dishonesty this product exists to remove.
 *
 * So the cards carry drawn miniatures of the real screens rather than
 * photographs or invented praise. They are illustrations and they say so -
 * small, honest, and enough to answer the question a visitor actually has at
 * this point on the page, which is "what does it look like in there?".
 */

import './inside.css';

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function Inside() {
  return (
    <section className="band" id="inside">
      <div className="container">
        <div className="section-head">
          <p className="eyebrow">
            <span className="eyebrow-rule" aria-hidden="true" />
            What it looks like in there
          </p>
          <h2>
            Four screens that do not exist anywhere else.
          </h2>
          <p className="section-sub">
            Drawn here, working in the product. Each one is the answer to a
            question students have been asking placement cells for twenty years.
          </p>
        </div>

        <div className="inside-grid">
          <article className="inside-card">
            <div className="inside-art" aria-hidden="true">
              <div className="mini mini-offer">
                <span className="mini-label">What arrives each month</span>
                <span className="mini-big">≈ {rupees(64_000)}</span>
                <span className="mini-bar">
                  <i style={{ flexGrow: 9 }} className="is-fixed" />
                  <i style={{ flexGrow: 3 }} className="is-var" />
                  <i style={{ flexGrow: 0.5 }} className="is-bonus" />
                </span>
                <span className="mini-legend">
                  <b>Fixed 9L</b>
                  <b>Variable up to 3L</b>
                </span>
              </div>
            </div>
            <h3>The honest offer card</h3>
            <p>
              Fixed, variable, joining bonus and bond, separated on every role before anybody
              applies - with the monthly in-hand and the working behind it.
            </p>
          </article>

          <article className="inside-card">
            <div className="inside-art" aria-hidden="true">
              <div className="mini mini-track">
                <span className="mini-row is-done">
                  <i />
                  Resume screen
                </span>
                <span className="mini-row is-done">
                  <i />
                  Online test
                </span>
                <span className="mini-row is-now">
                  <i />
                  Technical interview
                </span>
                <span className="mini-wait">Waiting on the company · 3 days left</span>
              </div>
            </div>
            <h3>The tracker with a clock</h3>
            <p>
              Every application says which round it is at, who it is waiting on, and how long they
              have left to answer. Silence becomes a number somebody is accountable for.
            </p>
          </article>

          <article className="inside-card">
            <div className="inside-art" aria-hidden="true">
              <div className="mini mini-pass">
                <span className="mini-chip">
                  React <b>✓</b>
                </span>
                <span className="mini-chip">
                  SQL <b>✓</b>
                </span>
                <span className="mini-chip is-soft">Figma</span>
                <span className="mini-chip">
                  Work simulation <b>✓</b>
                </span>
                <span className="mini-note">Verified by the college and by work done here</span>
              </div>
            </div>
            <h3>Proof instead of claims</h3>
            <p>
              A skills passport, completed work simulations and signed internship logs sit beside
              what a student wrote about themselves. A recruiter can tell the difference.
            </p>
          </article>

          <article className="inside-card">
            <div className="inside-art" aria-hidden="true">
              <div className="mini mini-event">
                <span className="mini-when">
                  <b>Thu</b>
                  <em>14</em>
                </span>
                <span className="mini-ev">
                  <b>Aptitude preparation</b>
                  <small>Before the Zenith Labs drive · Hall B</small>
                  <span className="mini-pill">You were invited</span>
                </span>
              </div>
            </div>
            <h3>Events people are asked to</h3>
            <p>
              The cell runs its own sessions and invites a batch or a role's applicants. Anybody
              else can still put their own name down.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

const STEPS = [
  {
    title: 'The college verifies once',
    body: 'Batches, invitations, then each record checked and frozen. A frozen profile is one a recruiter never has to question.',
    icon: 'shield',
  },
  {
    title: 'A company posts a role',
    body: 'Details, the honest pay split, the non-negotiable terms and the ordered rounds - aimed at the institutions it wants.',
    icon: 'post',
  },
  {
    title: 'The placement cell decides',
    body: 'Accept and it reaches eligible students. Decline, with a reason, and it never appears at all.',
    icon: 'gate',
  },
  {
    title: 'And nobody is left guessing',
    body: 'Students apply, rounds move, everyone is told as it happens - and the offer stays tracked until the day somebody joins.',
    icon: 'track',
  },
] as const;

export function HowItWorks() {
  return (
    <section className="band band-alt" id="how">
      <div className="container">
        <div className="section-head">
          <p className="eyebrow">
            <span className="eyebrow-rule" aria-hidden="true" />
            How it works
          </p>
          <h2>Four steps, from a spreadsheet to an offer that is kept.</h2>
        </div>

        <ol className="how">
          {STEPS.map((s, i) => (
            <li key={s.title} className="how-step">
              <span className="how-ico" aria-hidden="true">
                <StepIcon name={s.icon} />
              </span>
              <span className="how-num" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function StepIcon({ name }: { name: (typeof STEPS)[number]['icon'] }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      {name === 'shield' && (
        <>
          <path d="M12 3l7 3v5c0 4.4-3 8.2-7 10-4-1.8-7-5.6-7-10V6l7-3z" {...common} />
          <path d="M9 12l2.2 2.2L15.5 10" {...common} />
        </>
      )}
      {name === 'post' && (
        <>
          <rect x="4" y="4" width="16" height="16" rx="3" {...common} />
          <path d="M8 9h8M8 13h8M8 17h5" {...common} />
        </>
      )}
      {name === 'gate' && (
        <>
          <path d="M5 20V7l7-3 7 3v13" {...common} />
          <path d="M12 20v-6" {...common} />
          <path d="M5 12h4M15 12h4" {...common} />
        </>
      )}
      {name === 'track' && (
        <>
          <circle cx="6" cy="7" r="2.2" {...common} />
          <circle cx="6" cy="17" r="2.2" {...common} />
          <path d="M6 9.2v5.6" {...common} />
          <path d="M11 7h8M11 17h5" {...common} />
        </>
      )}
    </svg>
  );
}
