import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { Link } from 'react-router-dom';
import ApliLogo from '../components/ApliLogo';
import { prefersReducedMotion } from '../lib/useReveal';
import './landing/portal.css';

/**
 * The landing page of the work simulation portal.
 *
 * Who it speaks to, in order of how many of them arrive:
 *
 *   students       free, open to every student; they pick a simulation, do
 *                  real tasks, explain their work, earn a certificate anyone
 *                  can verify, and choose which companies may see them
 *   companies      the paying side; simulations are built with our team, and
 *                  they meet the students who finished and chose to share
 *   universities   free partners; they recommend simulations to classes and
 *                  follow progress
 *
 * Order: the hero, the companies, the idea (work first), the catalogue, how
 * the three sides connect (a diagram), what the student gains (confidence),
 * the employers, what students say, then one band each for companies and
 * universities, questions, and a last call.
 *
 * Nothing is invented. The companies are the demo companies, the numbers in
 * the pictures are samples, and the reviews are marked as sample reviews to
 * be replaced by real ones before launch. Every one of those says so on the
 * page.
 *
 * Motion
 * ------
 * Each animation shows how the product works rather than decorating it. All
 * of it is switched on by one class, `is-motion`, added only when the
 * visitor has not asked for reduced motion - so without JavaScript, or with
 * motion off, every element is simply there, finished.
 */
export default function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const [motion] = useState(() => typeof window !== 'undefined' && !prefersReducedMotion());

  useScrollState(root);
  useReveals(root, motion);

  return (
    <div className={`lp ${motion ? 'is-motion' : ''}`} ref={root}>
      <Intro motion={motion} />
      <a href="#main" className="lp-skip">
        Skip to content
      </a>
      <span className="lp-scrollbar" aria-hidden="true" />
      <Header />
      <main id="main">
        <Hero motion={motion} />
        <CompanyWall motion={motion} />
        <WorkFirst />
        <Catalogue />
        <Flow motion={motion} />
        <Confidence />
        <FeaturedEmployers />
        <Reviews motion={motion} />
        <ForCompanies />
        <ForUniversities />
        <Faq />
        <FinalCall />
      </main>
      <Footer />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Motion helpers                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Scroll position as CSS, with no React re-render: `--scroll` (0 to 1) drives
 * the progress bar, and `is-scrolled` tightens the header.
 */
function useScrollState(root: RefObject<HTMLDivElement>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const y = window.scrollY;
      el.style.setProperty('--scroll', String(max > 0 ? Math.min(1, y / max) : 0));
      el.classList.toggle('is-scrolled', y > 12);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [root]);
}

/**
 * One observer for the whole page: anything marked `data-reveal` gets
 * `is-in` the first time it scrolls into view. Elements added later (the
 * catalogue re-renders on every filter) are picked up by a mutation watch.
 */
function useReveals(root: RefObject<HTMLDivElement>, motion: boolean) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const all = () => el.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-in)');

    if (!motion || typeof IntersectionObserver === 'undefined') {
      all().forEach((n) => n.classList.add('is-in'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.18, rootMargin: '0px 0px -40px 0px' },
    );
    const watch = () => all().forEach((n) => io.observe(n));
    watch();
    const mo = new MutationObserver(watch);
    mo.observe(el, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [root, motion]);
}

/** True once the element has scrolled into view; true at once without motion. */
function useInView<T extends HTMLElement>(threshold = 0.3) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(() => typeof window === 'undefined' || prefersReducedMotion());

  useEffect(() => {
    if (seen) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen, threshold]);

  return { ref, seen };
}

/** A number that counts up to its value once `run` turns true. */
function CountUp({ to, run }: { to: number; run: boolean }) {
  const [n, setN] = useState(() => (prefersReducedMotion() ? to : 0));

  useEffect(() => {
    if (!run || prefersReducedMotion()) {
      if (run) setN(to);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const ms = 1200;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      // Ease out, so the last few numbers settle rather than snap.
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [run, to]);

  return <>{n}</>;
}

/** Writes the pointer position into `--mx`/`--my` and `--px`/`--py` on the element. */
function trackPointer(e: ReactPointerEvent<HTMLElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--mx', `${e.clientX - r.left}px`);
  el.style.setProperty('--my', `${e.clientY - r.top}px`);
  el.style.setProperty('--px', String((e.clientX - r.left) / r.width - 0.5));
  el.style.setProperty('--py', String((e.clientY - r.top) / r.height - 0.5));
}

/* -------------------------------------------------------------------------- */
/* Opening: the logo assembles itself                                          */
/* -------------------------------------------------------------------------- */

/** The logo's own sequence ends here; must match the delays in portal.css. */
const INTRO_HOLD_MS = 2200;
const INTRO_LEAVE_MS = 600;

/**
 * The Apli mark is a paper plane with three speed trails, and those are
 * separate shapes in the artwork - so the plane flies in and leaves its
 * trails, the letters rise behind it, and the dot of the i drops last, in
 * orange, as the full stop. Then the curtain lifts.
 *
 * It plays every time the landing page is opened, is skippable with a
 * click or any key, and is never shown to anybody who asked for reduced
 * motion.
 */
function Intro({ motion }: { motion: boolean }) {
  const [show, setShow] = useState(motion);
  const [leaving, setLeaving] = useState(false);

  const leave = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => setShow(false), INTRO_LEAVE_MS);
  }, []);

  useEffect(() => {
    if (!show) return;
    const t = window.setTimeout(leave, INTRO_HOLD_MS);
    window.addEventListener('keydown', leave, { once: true });
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', leave);
    };
  }, [show, leave]);

  if (!show) return null;

  return (
    <div className={`lp-intro ${leaving ? 'is-leaving' : ''}`} onClick={leave} aria-hidden="true">
      <div className="lp-intro-stage">
        <span className="lp-intro-ring" />
        <ApliLogo className="lp-intro-logo" />
      </div>
      <p className="lp-intro-line">
        Experience first. <span>The job follows.</span>
      </p>
      <p className="lp-intro-skip">Click or press any key to skip</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Header                                                                      */
/* -------------------------------------------------------------------------- */

function Header() {
  return (
    <header className="lp-header">
      <div className="lp-wrap lp-header-in">
        <Link to="/" className="lp-brand" aria-label="Apli.ai, home">
          <ApliLogo className="lp-brand-logo" />
        </Link>
        <nav className="lp-nav" aria-label="Sections">
          <a href="#simulations">Simulations</a>
          <a href="#how">How it works</a>
          <a href="#employers">Employers</a>
          <a href="#companies">For companies</a>
          <a href="#universities">For universities</a>
        </nav>
        <div className="lp-account">
          <Link to="/login" className="lp-btn lp-btn-ghost">
            Sign in
          </Link>
          <Link to="/register/student" className="lp-btn lp-btn-primary">
            Join free
          </Link>
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero                                                                        */
/* -------------------------------------------------------------------------- */

function Hero({ motion }: { motion: boolean }) {
  return (
    <section className="lp-hero">
      <div className="lp-blobs" aria-hidden="true">
        <span className="is-a" />
        <span className="is-b" />
        <span className="is-c" />
      </div>
      <div className="lp-wrap lp-hero-in">
        <div className="lp-hero-copy">
          <p className="lp-eyebrow lp-rise" style={{ '--d': 0 } as CSSProperties}>
            <span className="lp-live" aria-hidden="true" />
            Free work simulations for students in India
          </p>
          <h1 className="lp-title">
            <span className="lp-line lp-rise" style={{ '--d': 1 } as CSSProperties}>
              Experience first.
            </span>
            <span className="lp-line lp-rise" style={{ '--d': 2 } as CSSProperties}>
              <span className="lp-mark">The job follows.</span>
            </span>
          </h1>
          <p className="lp-lede lp-rise" style={{ '--d': 3 } as CSSProperties}>
            Spend a few hours on real work set by a real company. Talk it through with their team, and leave with a
            certificate anyone can verify. Open to every student, from every college.
          </p>
          <div className="lp-hero-actions lp-rise" style={{ '--d': 4 } as CSSProperties}>
            <a href="#simulations" className="lp-btn lp-btn-primary lp-btn-lg">
              Browse simulations
            </a>
            <Link to="/register/student" className="lp-btn lp-btn-outline lp-btn-lg">
              Create a free account
            </Link>
          </div>
          <ul className="lp-ticks lp-rise" style={{ '--d': 5 } as CSSProperties}>
            <li>Free for students</li>
            <li>3 to 6 hours each</li>
            <li>Verifiable certificate</li>
          </ul>
        </div>

        <WorkStack motion={motion} />
      </div>
    </section>
  );
}

/**
 * How many beats the hero's simulation plays, and how long each lasts.
 *
 *   0  just started        3  call done, all tasks ticked
 *   1  first task ticked   4  certificate stamped
 *   2  second task ticked  5  profile shared with the company
 *
 * It then holds on the finished desk and starts again.
 */
const BEATS = 6;
const BEAT_MS = 1500;
const HOLD_BEATS = 3;

/**
 * The hero's picture: one simulation played from the inside, as three cards
 * stacked like a desk - the role, the tasks, the certificate - and a note
 * that the student shared their profile with one company. It tilts towards
 * the pointer, and without motion it simply shows the finished desk.
 */
function WorkStack({ motion }: { motion: boolean }) {
  const [beat, setBeat] = useState(motion ? 0 : BEATS - 1);

  useEffect(() => {
    if (!motion) return;
    let n = 0;
    const t = window.setInterval(() => {
      n = (n + 1) % (BEATS + HOLD_BEATS);
      setBeat(Math.min(n, BEATS - 1));
    }, BEAT_MS);
    return () => window.clearInterval(t);
  }, [motion]);

  const tasks = ['Read the brief from the team', 'Design and build the endpoint', 'Explain your work on a 10-minute call'];
  const done = Math.min(beat, 3);
  const pct = Math.round((done / tasks.length) * 100);

  return (
    <div
      className="lp-stack"
      aria-hidden="true"
      onPointerMove={motion ? trackPointer : undefined}
      onPointerLeave={(e) => {
        e.currentTarget.style.setProperty('--px', '0');
        e.currentTarget.style.setProperty('--py', '0');
      }}
    >
      <div className="lp-stack-tilt">
        <div className="lp-card lp-card-role">
          <span className="lp-co-tile is-blue">IS</span>
          <div>
            <b>Software Engineering</b>
            <i>Indus Systems · 5 hrs · 3 tasks</i>
          </div>
          <span className="lp-pill">Software</span>
        </div>

        <div className="lp-card lp-card-tasks">
          <div className="lp-card-head">
            <b>Your tasks</b>
            <i>
              {done} of {tasks.length} done
            </i>
          </div>
          <div className="lp-progress">
            <span style={{ width: `${pct}%` }} />
          </div>
          <ul>
            {tasks.map((t, i) => (
              <li key={t} className={i < done ? 'is-done' : i === done ? 'is-now' : ''}>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className={`lp-card lp-card-cert ${beat >= 4 ? 'is-stamped' : ''}`}>
          <span className="lp-cert-label">Certificate</span>
          <b>Software Engineering</b>
          <i>Indus Systems · verified by code</i>
          <span className="lp-cert-code">Q9VT URDE 69</span>
          <span className="lp-cert-seal">✓</span>
        </div>

        <div className={`lp-note ${beat >= 5 ? 'is-on' : ''}`}>
          <span className="lp-note-dot" />
          Profile shared with Indus Systems
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The companies                                                               */
/* -------------------------------------------------------------------------- */

interface Employer {
  name: string;
  tile: string;
  tone: 'blue' | 'green' | 'orange' | 'violet';
  sector: string;
  simulations: number;
  fields: string[];
  line: string;
}

/** The demo companies, as seeded. Shown as samples everywhere they appear. */
const EMPLOYERS: Employer[] = [
  { name: 'Indus Systems', tile: 'IS', tone: 'blue', sector: 'IT services', simulations: 2, fields: ['Software', 'Testing'], line: 'Build and test the services their clients run on.' },
  { name: 'Northwind Analytics', tile: 'NA', tone: 'green', sector: 'Data and analytics', simulations: 1, fields: ['Data'], line: 'Turn a messy sales file into a story a manager can act on.' },
  { name: 'Harbour Fintech', tile: 'HF', tone: 'orange', sector: 'Payments', simulations: 2, fields: ['Product', 'Security'], line: 'Improve a UPI flow, then defend it against a phishing attempt.' },
  { name: 'Vertex Motors', tile: 'VM', tone: 'violet', sector: 'Electric vehicles', simulations: 1, fields: ['Engineering'], line: 'Find out why a battery pack runs hot, and say how to fix it.' },
  { name: 'Zenith Labs', tile: 'ZL', tone: 'violet', sector: 'Product and design', simulations: 1, fields: ['Design'], line: 'Research, sketch and test a better first-time experience.' },
  { name: 'Solace Health', tile: 'SH', tone: 'green', sector: 'Healthcare', simulations: 1, fields: ['Operations'], line: 'Cut the waiting time at a busy outpatient desk.' },
];

/** A wall of company tiles that rolls past; the second copy is only for the seam. */
function CompanyWall({ motion }: { motion: boolean }) {
  const tiles = (copy: boolean) =>
    EMPLOYERS.map((e) => (
      <li key={`${e.name}${copy ? '-again' : ''}`} aria-hidden={copy || undefined}>
        <span className={`lp-co-tile is-${e.tone}`}>{e.tile}</span>
        <span className="lp-wall-name">
          <b>{e.name}</b>
          <i>{e.sector}</i>
        </span>
      </li>
    ));

  return (
    <section className="lp-wall" aria-label="Companies with simulations">
      <div className="lp-wrap lp-wall-head">
        <p>Simulations built with companies like these</p>
        <span>Sample companies</span>
      </div>
      <div className="lp-marquee">
        <ul className="lp-marquee-track">
          {tiles(false)}
          {motion && tiles(true)}
        </ul>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Work first                                                                  */
/* -------------------------------------------------------------------------- */

const USUAL = ['Send a CV', 'Wait to hear back', 'Get asked for experience', 'Start again'];
const WORK_FIRST = ['Do real work', 'Explain it to the team', 'Earn proof anyone can check', 'Get invited to apply'];

function WorkFirst() {
  return (
    <section className="lp-section lp-workfirst">
      <div className="lp-wrap">
        <div className="lp-section-head is-center" data-reveal>
          <p className="lp-eyebrow">Work first</p>
          <h2>Work first. CV second.</h2>
          <p>Most applications ask what you studied. The companies here get to see what you did.</p>
        </div>

        <div className="lp-compare">
          <div className="lp-route is-usual" data-reveal>
            <h3>The usual way</h3>
            <ol>
              {USUAL.map((s, i) => (
                <li key={s} style={{ '--d': i } as CSSProperties}>
                  {s}
                </li>
              ))}
            </ol>
            <p className="lp-route-end">↺ Round and round, without the one thing they ask for.</p>
          </div>

          <div className="lp-route is-ours" data-reveal style={{ '--d': 1 } as CSSProperties}>
            <h3>Work first</h3>
            <ol>
              {WORK_FIRST.map((s, i) => (
                <li key={s} style={{ '--d': i } as CSSProperties}>
                  {s}
                </li>
              ))}
            </ol>
            <p className="lp-route-end">→ The experience comes first, so the conversation starts there.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                   */
/* -------------------------------------------------------------------------- */

type Level = 'Beginner' | 'Intermediate';

interface Simulation {
  field: string;
  company: string;
  tile: string;
  tone: 'blue' | 'green' | 'orange' | 'violet';
  title: string;
  hours: number;
  tasks: number;
  level: Level;
  skills: string[];
}

/** The demo companies' simulations, as seeded. Shown as samples. */
const SIMULATIONS: Simulation[] = [
  { field: 'Software', company: 'Indus Systems', tile: 'IS', tone: 'blue', title: 'Software Engineering', hours: 5, tasks: 3, level: 'Intermediate', skills: ['Java', 'REST APIs', 'SQL'] },
  { field: 'Software', company: 'Indus Systems', tile: 'IS', tone: 'blue', title: 'Quality Assurance', hours: 3, tasks: 3, level: 'Beginner', skills: ['Test design', 'Bug reporting', 'Edge cases'] },
  { field: 'Data', company: 'Northwind Analytics', tile: 'NA', tone: 'green', title: 'Data Analytics', hours: 4, tasks: 3, level: 'Beginner', skills: ['Excel', 'SQL', 'Visualisation'] },
  { field: 'Finance', company: 'Harbour Fintech', tile: 'HF', tone: 'orange', title: 'Fintech Product Analyst', hours: 5, tasks: 3, level: 'Intermediate', skills: ['Product thinking', 'UPI', 'Writing specs'] },
  { field: 'Security', company: 'Harbour Fintech', tile: 'HF', tone: 'orange', title: 'Cybersecurity', hours: 4, tasks: 3, level: 'Intermediate', skills: ['Log analysis', 'Incident response', 'Phishing'] },
  { field: 'Engineering', company: 'Vertex Motors', tile: 'VM', tone: 'violet', title: 'EV Battery Engineering', hours: 6, tasks: 4, level: 'Intermediate', skills: ['Battery systems', 'Thermal analysis', 'MATLAB'] },
  { field: 'Design', company: 'Zenith Labs', tile: 'ZL', tone: 'violet', title: 'Product Design', hours: 4, tasks: 3, level: 'Beginner', skills: ['UX research', 'Figma', 'Prototyping'] },
  { field: 'Healthcare', company: 'Solace Health', tile: 'SH', tone: 'green', title: 'Healthcare Operations', hours: 3, tasks: 3, level: 'Beginner', skills: ['Process mapping', 'Operations', 'Patient experience'] },
];

const FIELDS = ['All fields', ...Array.from(new Set(SIMULATIONS.map((x) => x.field)))];
const LENGTHS = [
  { key: 'any', label: 'Any length' },
  { key: 'short', label: 'Under 4 hours' },
  { key: 'long', label: '4 hours or more' },
] as const;

function Catalogue() {
  const [field, setField] = useState('All fields');
  const [length, setLength] = useState<(typeof LENGTHS)[number]['key']>('any');

  const shown = useMemo(
    () =>
      SIMULATIONS.filter((x) => field === 'All fields' || x.field === field).filter((x) =>
        length === 'any' ? true : length === 'short' ? x.hours < 4 : x.hours >= 4,
      ),
    [field, length],
  );

  return (
    <section className="lp-section lp-catalogue" id="simulations">
      <div className="lp-wrap">
        <div className="lp-section-head" data-reveal>
          <p className="lp-eyebrow">Work simulations</p>
          <h2>Pick a role. Start today.</h2>
          <p>
            Every simulation is a short set of real tasks from the team that does the job. Do one, or do ten. Nobody
            has to approve you, and nothing is due by a date.
          </p>
        </div>

        <div className="lp-filters" data-reveal>
          <div className="lp-chips" role="group" aria-label="Field">
            {FIELDS.map((f) => (
              <button
                key={f}
                type="button"
                className={`lp-chip ${field === f ? 'is-on' : ''}`}
                aria-pressed={field === f}
                onClick={() => setField(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <label className="lp-select">
            <span className="lp-visually-hidden">Length</span>
            <select id="lp-length" value={length} onChange={(e) => setLength(e.target.value as typeof length)}>
              {LENGTHS.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="lp-count" aria-live="polite">
          Showing {shown.length} sample simulation{shown.length === 1 ? '' : 's'}
        </p>

        {shown.length === 0 ? (
          <p className="lp-empty">Nothing matches both filters. Try another length.</p>
        ) : (
          // Keyed on the filters, so a new selection deals the cards in again.
          <ul className="lp-grid" key={`${field}-${length}`}>
            {shown.map((x, i) => (
              <li key={x.title} data-reveal style={{ '--d': i } as CSSProperties}>
                <Link to="/register/student" className="lp-intern" onPointerMove={trackPointer}>
                  <span className="lp-intern-top">
                    <span className={`lp-co-tile is-${x.tone}`}>{x.tile}</span>
                    <span className="lp-intern-co">{x.company}</span>
                    <span className="lp-level">{x.level}</span>
                  </span>
                  <b className="lp-intern-title">{x.title}</b>
                  <span className="lp-intern-meta">
                    {x.field} · {x.hours} hrs · {x.tasks} tasks
                  </span>
                  <span className="lp-skills">
                    {x.skills.map((k) => (
                      <i key={k}>{k}</i>
                    ))}
                  </span>
                  <span className="lp-intern-go">
                    Start this simulation <span aria-hidden="true">→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* How it all connects: the flow                                               */
/* -------------------------------------------------------------------------- */

type Lane = 'student' | 'company' | 'university';

const LANES: { key: Lane; label: string }[] = [
  { key: 'student', label: 'Student' },
  { key: 'company', label: 'Company' },
  { key: 'university', label: 'University' },
];

/**
 * Five stages, three sides. Each cell says what that side does at that
 * stage; a blank cell means that side is not involved. `meet` marks the
 * stages where the student and the company actually meet.
 */
const STAGES: { title: string; meet?: string; cells: Record<Lane, string | null> }[] = [
  {
    title: 'Start',
    cells: {
      student: 'Signs up free and picks a simulation',
      company: 'Builds the simulation with the Apli.ai team',
      university: 'Recommends it to a class',
    },
  },
  {
    title: 'Do the work',
    cells: {
      student: 'Works through the tasks at their own pace',
      company: null,
      university: 'Sees who has started',
    },
  },
  {
    title: 'Explain',
    meet: 'They meet: a 10-minute call',
    cells: {
      student: 'Walks the team through the work',
      company: 'A reviewer takes the call and checks the work',
      university: null,
    },
  },
  {
    title: 'Prove',
    cells: {
      student: 'Gets a certificate anyone can verify',
      company: 'Issues it in the company’s name',
      university: 'Counts it towards NEP credits',
    },
  },
  {
    title: 'Connect',
    meet: 'They meet again: an invitation',
    cells: {
      student: 'Shares the profile with chosen companies',
      company: 'Invites the strongest to apply, and hires',
      university: 'Sees outcomes for each college',
    },
  },
];

const FLOW_STEP_MS = 2200;

function Flow({ motion }: { motion: boolean }) {
  const { ref, seen } = useInView<HTMLDivElement>(0.25);
  const [active, setActive] = useState(motion ? 0 : -1);

  // Walk the stages one at a time once the diagram is on screen.
  useEffect(() => {
    if (!motion || !seen) return;
    const t = window.setInterval(() => setActive((a) => (a + 1) % STAGES.length), FLOW_STEP_MS);
    return () => window.clearInterval(t);
  }, [motion, seen]);

  return (
    <section className="lp-section lp-soft" id="how">
      <div className="lp-wrap">
        <div className="lp-section-head" data-reveal>
          <p className="lp-eyebrow">How it works</p>
          <h2>How the three sides connect.</h2>
          <p>
            One simulation, five stages. Follow the student along the top; see what the company and the university do
            at the same moment.
          </p>
        </div>

        <div
          className={`lp-flow ${seen ? 'is-in' : ''}`}
          ref={ref}
          style={{ '--active': Math.max(active, 0), '--stages': STAGES.length } as CSSProperties}
        >
          <div className="lp-flow-track" aria-hidden="true">
            <span className="lp-flow-fill" />
            <span className="lp-flow-dot" />
          </div>

          <div className="lp-flow-lanes" aria-hidden="true">
            {LANES.map((l) => (
              <span key={l.key} className={`lp-lane-tag is-${l.key}`}>
                {l.label}
              </span>
            ))}
          </div>

          <ol className="lp-flow-stages">
            {STAGES.map((st, i) => (
              <li
                key={st.title}
                className={`lp-stage ${active === i ? 'is-active' : ''} ${active > i ? 'is-past' : ''}`}
                style={{ '--d': i } as CSSProperties}
                onPointerEnter={motion ? () => setActive(i) : undefined}
              >
                <span className="lp-stage-num">{i + 1}</span>
                <h3>{st.title}</h3>
                {LANES.map((l) => (
                  <p key={l.key} className={`lp-cell is-${l.key} ${st.cells[l.key] ? '' : 'is-empty'}`}>
                    <span className="lp-cell-lane">{l.label}</span>
                    {st.cells[l.key] ?? '—'}
                  </p>
                ))}
                {st.meet && <span className="lp-meet">{st.meet}</span>}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Confidence                                                                  */
/* -------------------------------------------------------------------------- */

const CONFIDENCE = [
  {
    title: 'You know what the job is really like',
    body: 'Not the job title, the actual Tuesday: the brief, the files, the problem the team needs solved.',
    tone: 'blue',
    icon: '◎',
  },
  {
    title: 'You have explained your work out loud',
    body: 'To a real person from the company, before any interview. The second time is always easier.',
    tone: 'orange',
    icon: '“',
  },
  {
    title: 'You have proof, and you control it',
    body: 'A certificate anyone can verify, shared only with the companies you choose.',
    tone: 'green',
    icon: '✓',
  },
] as const;

function Confidence() {
  const { ref, seen } = useInView<HTMLDivElement>();

  return (
    <section className="lp-section">
      <div className="lp-wrap lp-split">
        <div data-reveal>
          <p className="lp-eyebrow">Confidence</p>
          <h2>Walk into the interview having done the job once.</h2>
          <ul className="lp-confidence">
            {CONFIDENCE.map((c, i) => (
              <li
                key={c.title}
                className={`is-${c.tone}`}
                style={{ '--d': i } as CSSProperties}
                onPointerMove={trackPointer}
              >
                <span className="lp-take-icon" aria-hidden="true">
                  {c.icon}
                </span>
                <span>
                  <b>{c.title}</b>
                  <i>{c.body}</i>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className={`lp-meter ${seen ? 'is-in' : ''}`} ref={ref} aria-hidden="true">
          <p className="lp-meter-q">How ready do you feel for this interview?</p>
          <div className="lp-meter-row">
            <span className="lp-meter-label">Before</span>
            <div className="lp-meter-bar">
              <span className="is-before" />
            </div>
            <span className="lp-meter-say">“I have never done this.”</span>
          </div>
          <div className="lp-meter-row">
            <span className="lp-meter-label">After</span>
            <div className="lp-meter-bar">
              <span className="is-after" />
            </div>
            <span className="lp-meter-say is-strong">“I did this for Indus Systems. Let me show you.”</span>
          </div>
          <p className="lp-meter-note">An illustration of the idea, not a measurement.</p>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Featured employers                                                          */
/* -------------------------------------------------------------------------- */

function FeaturedEmployers() {
  return (
    <section className="lp-section lp-soft" id="employers">
      <div className="lp-wrap">
        <div className="lp-section-head" data-reveal>
          <p className="lp-eyebrow">Featured employers</p>
          <h2>Work on what these teams actually do.</h2>
          <p>Each company writes its simulations around a real problem from its own week.</p>
        </div>
        <ul className="lp-employers">
          {EMPLOYERS.map((e, i) => (
            <li key={e.name} data-reveal style={{ '--d': i } as CSSProperties}>
              <a href="#simulations" className={`lp-employer is-${e.tone}`} onPointerMove={trackPointer}>
                <span className="lp-employer-top">
                  <span className={`lp-co-tile is-${e.tone} is-big`}>{e.tile}</span>
                  <span>
                    <b>{e.name}</b>
                    <i>{e.sector}</i>
                  </span>
                </span>
                <span className="lp-employer-line">{e.line}</span>
                <span className="lp-employer-foot">
                  <span className="lp-skills">
                    {e.fields.map((f) => (
                      <i key={f}>{f}</i>
                    ))}
                  </span>
                  <span className="lp-employer-count">
                    {e.simulations} simulation{e.simulations === 1 ? '' : 's'}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
        <p className="lp-small is-center">Sample companies from the demo.</p>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Reviews                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * What students say. There are no real students yet, so these are written
 * as samples and labelled as such on the page - to be replaced by real,
 * attributed reviews before launch. They describe the experience only and
 * claim no outcome (no "got hired"), so even as samples they promise nothing
 * the product has not shown.
 */
const REVIEWS = [
  { quote: 'The brief read like a real ticket. I finally understood what a backend developer does all day.', who: 'B.E. Computer, 3rd year', on: 'Software Engineering' },
  { quote: 'The call was ten minutes. I was nervous for the first two, then I was just explaining my own work.', who: 'BCA, final year', on: 'Quality Assurance' },
  { quote: 'Putting a code on my CV that anyone can check felt better than attaching another screenshot.', who: 'B.Sc Data Science, 2nd year', on: 'Data Analytics' },
  { quote: 'I did it across three evenings after classes. Nobody chased me and nothing expired.', who: 'B.Com, final year', on: 'Fintech Product Analyst' },
  { quote: 'I chose which companies could see me. That mattered more than I expected.', who: 'B.Des, 3rd year', on: 'Product Design' },
  { quote: 'It was the first time anyone asked me why I did something, not just whether it was right.', who: 'B.E. Mechanical, final year', on: 'EV Battery Engineering' },
];

function Reviews({ motion }: { motion: boolean }) {
  const card = (r: (typeof REVIEWS)[number], copy: boolean, key: string) => (
    <li key={key} className="lp-review" aria-hidden={copy || undefined}>
      <span className="lp-stars" role="img" aria-label="5 out of 5">
        ★★★★★
      </span>
      <p>“{r.quote}”</p>
      <span className="lp-review-who">
        <b>Sample student · {r.who}</b>
        <i>{r.on}</i>
      </span>
    </li>
  );

  const rowA = REVIEWS.slice(0, 3);
  const rowB = REVIEWS.slice(3);

  return (
    <section className="lp-section lp-reviews">
      <div className="lp-wrap">
        <div className="lp-section-head is-center" data-reveal>
          <p className="lp-eyebrow">Reviews</p>
          <h2>What it feels like to do one.</h2>
          <p className="lp-sample-flag">Sample reviews for the demo. Real student reviews will replace these.</p>
        </div>
      </div>
      <div className="lp-review-rows">
        {[rowA, rowB].map((row, r) => (
          <div key={r} className={`lp-marquee lp-review-row ${r === 1 ? 'is-reverse' : ''}`}>
            <ul className="lp-marquee-track">
              {row.map((x) => card(x, false, `${r}-${x.on}`))}
              {motion && row.map((x) => card(x, true, `${r}-${x.on}-again`))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* For companies                                                               */
/* -------------------------------------------------------------------------- */

const COMPANY_POINTS = [
  { title: 'Built with our team', body: 'Tell us what the role really involves. We turn it into a short simulation in your words, with your people.' },
  { title: 'Reach students everywhere', body: 'Students from colleges across India take it, not only the few campuses you visit.' },
  { title: 'Meet the ones who finished', body: 'See every student who completed it and chose to share their profile with you.' },
  { title: 'Invite them to apply', body: 'Send an invitation to the students whose work stood out, straight from your dashboard.' },
];

function ForCompanies() {
  const { ref, seen } = useInView<HTMLDivElement>();

  return (
    <section className="lp-section lp-dark" id="companies">
      <div className="lp-wrap lp-split">
        <div data-reveal>
          <p className="lp-eyebrow is-light">For companies</p>
          <h2>Hire students who have already done the work.</h2>
          <ul className="lp-points">
            {COMPANY_POINTS.map((p, i) => (
              <li key={p.title} style={{ '--d': i } as CSSProperties}>
                <b>{p.title}</b>
                <span>{p.body}</span>
              </li>
            ))}
          </ul>
          <div className="lp-hero-actions">
            <Link to="/register/company" className="lp-btn lp-btn-primary lp-btn-lg">
              Partner with us
            </Link>
            <Link to="/login" className="lp-btn lp-btn-outline-light lp-btn-lg">
              Company sign in
            </Link>
          </div>
        </div>

        <div className={`lp-dash ${seen ? 'is-in' : ''}`} ref={ref} aria-hidden="true">
          <div className="lp-dash-head">
            <b>Software Engineering</b>
            <i>Your simulation · sample</i>
          </div>
          <div className="lp-dash-stats">
            <span>
              <b>
                <CountUp to={128} run={seen} />
              </b>
              <i>started</i>
            </span>
            <span>
              <b>
                <CountUp to={64} run={seen} />
              </b>
              <i>finished</i>
            </span>
            <span>
              <b>
                <CountUp to={41} run={seen} />
              </b>
              <i>shared with you</i>
            </span>
          </div>
          <ul className="lp-dash-list">
            {[
              ['AK', 'B.E. Computer · 2026'],
              ['RP', 'B.Sc Data Science · 2027'],
              ['SM', 'BCA · 2026'],
            ].map(([initials, course], i) => (
              <li key={initials} style={{ '--d': i } as CSSProperties}>
                <span className="lp-avatar">{initials}</span>
                <span>
                  <b>Sample Student</b>
                  <i>{course}</i>
                </span>
                <span className="lp-invite">Invite</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* For universities                                                            */
/* -------------------------------------------------------------------------- */

const UNI_POINTS = [
  { title: 'Free for your institution', body: 'No fee for the university, its colleges, its teachers or its students.' },
  { title: 'Recommend to a class', body: 'Teachers share a simulation with a class and see who started and who finished.' },
  { title: 'Count it towards credits', body: 'Use completed simulations as evidence for NEP internship credits and your own records.' },
];

function ForUniversities() {
  const { ref, seen } = useInView<HTMLDivElement>();

  return (
    <section className="lp-section lp-soft" id="universities">
      <div className="lp-wrap lp-split is-reverse">
        <div data-reveal>
          <p className="lp-eyebrow">For universities and colleges</p>
          <h2>Real experience for every student, at no cost.</h2>
          <ul className="lp-points is-dark">
            {UNI_POINTS.map((p, i) => (
              <li key={p.title} style={{ '--d': i } as CSSProperties}>
                <b>{p.title}</b>
                <span>{p.body}</span>
              </li>
            ))}
          </ul>
          <div className="lp-hero-actions">
            <Link to="/login" className="lp-btn lp-btn-primary lp-btn-lg">
              University sign in
            </Link>
            <Link to="/register/institution" className="lp-btn lp-btn-outline lp-btn-lg">
              Bring it to your campus
            </Link>
          </div>
          <p className="lp-small">Free for your institution. Or write to hello@apli.example</p>
        </div>

        <div className={`lp-class ${seen ? 'is-in' : ''}`} ref={ref} aria-hidden="true">
          <div className="lp-dash-head">
            <b>TE Computer · Division A</b>
            <i>Recommended: Data Analytics · sample</i>
          </div>
          <div className="lp-class-bar">
            <span className="is-done" style={{ '--w': '48%' } as CSSProperties} />
            <span className="is-going" style={{ '--w': '30%' } as CSSProperties} />
          </div>
          <div className="lp-class-key">
            <span>
              <i className="is-done" /> Finished <CountUp to={29} run={seen} />
            </span>
            <span>
              <i className="is-going" /> In progress <CountUp to={18} run={seen} />
            </span>
            <span>
              <i /> Not started <CountUp to={13} run={seen} />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Questions                                                                   */
/* -------------------------------------------------------------------------- */

const QUESTIONS = [
  {
    q: 'Is it really free?',
    a: 'Yes, for students, always. Universities and colleges do not pay either. Companies pay us to build their simulations and to meet the students who choose to share.',
  },
  {
    q: 'Do I need experience or good marks?',
    a: 'No. Any student can start any simulation. The point is to give you experience you do not have yet.',
  },
  {
    q: 'How long does one take?',
    a: 'Most take 3 to 6 hours in total. There is no deadline, so you can spread it over a few evenings.',
  },
  {
    q: 'What is the explain-your-work call?',
    a: 'A short call with someone from the company. You talk them through your work. It is not an exam; it is what makes your certificate mean something.',
  },
  {
    q: 'Who can see my profile?',
    a: 'Only the companies you share it with. Nobody else sees your details, and you can stop sharing whenever you like.',
  },
  {
    q: 'Is it a real internship?',
    a: 'No - it is a work simulation: real tasks from a real team, done in a few hours. Nobody is hired or paid. Put it on your CV and LinkedIn as exactly that.',
  },
];

function Faq() {
  return (
    <section className="lp-section" id="faq">
      <div className="lp-wrap lp-faq-in">
        <div className="lp-section-head" data-reveal>
          <h2>Questions students ask</h2>
          <p>Anything else, write to hello@apli.example.</p>
        </div>
        <div className="lp-faq">
          {QUESTIONS.map((x, i) => (
            <details key={x.q} data-reveal style={{ '--d': i } as CSSProperties}>
              <summary>{x.q}</summary>
              <div className="lp-faq-body">
                <p>{x.a}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Final call and footer                                                       */
/* -------------------------------------------------------------------------- */

function FinalCall() {
  return (
    <section className="lp-final">
      <span className="lp-final-glow" aria-hidden="true" />
      <div className="lp-wrap lp-final-in" data-reveal>
        <h2>Your first piece of real work is a few hours away.</h2>
        <div className="lp-hero-actions is-center">
          <Link to="/register/student" className="lp-btn lp-btn-primary lp-btn-lg">
            Create a free account
          </Link>
          <a href="#simulations" className="lp-btn lp-btn-outline-light lp-btn-lg">
            Browse simulations
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-wrap lp-footer-in">
        <div className="lp-footer-brand">
          <ApliLogo className="lp-footer-logo" title="Apli.ai" />
          <p>Work simulations that lead to jobs.</p>
        </div>
        <nav aria-label="Students">
          <b>Students</b>
          <a href="#simulations">Browse simulations</a>
          <Link to="/register/student">Create an account</Link>
          <Link to="/login">Sign in</Link>
        </nav>
        <nav aria-label="Companies">
          <b>Companies</b>
          <Link to="/register/company">Partner with us</Link>
          <Link to="/login">Company sign in</Link>
        </nav>
        <nav aria-label="Universities">
          <b>Universities</b>
          <a href="#universities">How it works for you</a>
          <Link to="/register/institution">Bring it to your campus</Link>
          <Link to="/login">University sign in</Link>
        </nav>
        <nav aria-label="Apli.ai">
          <b>Apli.ai</b>
          <Link to="/join">Join Apli.ai</Link>
          <Link to="/status">System status</Link>
          <a href="mailto:hello@apli.example">hello@apli.example</a>
        </nav>
      </div>
      <p className="lp-wrap lp-footer-note">
        Sample companies, names, reviews and numbers only. Nothing here is a real customer.
      </p>
    </footer>
  );
}
