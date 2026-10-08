import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import ApliLogo from '../components/ApliLogo';
import { prefersReducedMotion, useReveal } from '../lib/useReveal';
import './landing/home.css';

/**
 * The landing page.
 *
 * One job: somebody who arrives here knows within a few seconds what Apli.ai
 * is for. A virtual internship portal that leads to jobs: students do short,
 * real tasks set by companies, explain their work, earn a certificate anyone
 * can check, and get invited to interview. The college verifies who they are,
 * so recruiters trust what they did, and every offer is followed to joining.
 *
 * The hero says it, the problem names the experience trap, the internships
 * show what is on offer, the thread says how it works, the trust section says
 * why a recruiter believes the certificate, the doors say who it is for, the
 * waiting says who else is counting on the offer, the close says what we
 * refuse.
 *
 * Colour
 * ------
 * The people reading are anxious (students), accountable (placement cells)
 * and sceptical (recruiters). So the palette is chosen to calm and reassure,
 * with one warm colour for action:
 *
 *   deep sky blue   - trust and calm; the ink and the dark sections
 *   airy pale blue  - a light, low-stress page instead of clinical white
 *   blush coral     - warm and friendly; spent only on actions
 *   verified sage   - safety; used only where something has been checked
 *
 * ("Sky & Blush", chosen from six palettes tried on the live page.)
 *
 * The tokens are scoped to `.home`, so the signed-in portal and each
 * institution's own colour are untouched.
 *
 * Motion
 * ------
 * The opening is the Apli logo assembling itself: the paper plane flies in
 * and leaves its trails, the letters settle and the dot lands last. The hero's
 * background breathes on a slow six-second cycle. Everything is skippable, and
 * absent for anybody who asked for reduced motion.
 */
export default function Landing() {
  const [entered, setEntered] = useState(false);
  const enter = useCallback(() => setEntered(true), []);

  return (
    <div className={`home ${entered ? 'has-entered' : ''}`}>
      <Intro onDone={enter} />
      <Header />
      <main id="main">
        <Hero entered={entered} />
        <Problem />
        <Internships />
        <Thread />
        <Trust />
        <Doors />
        <Waiting />
        <Close />
      </main>
      <Footer />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Opening                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The opening is the logo performing itself. The Apli mark is a paper plane
 * with three speed lines, and those lines are separate paths in the artwork,
 * so the plane can fly in and leave its own trails behind. The letters settle
 * after it and the dot of the i lands last, in coral, as the full stop. Then
 * the promise appears under it and the curtain lifts.
 */

/** Must match the end of `homeVeil` in home.css. */
const INTRO_MS = 2700;
/** The veil starts lifting here, so the hero assembles behind it. */
const INTRO_REVEAL_MS = 1950;

function Intro({ onDone }: { onDone: () => void }) {
  const [running, setRunning] = useState(() => typeof window !== 'undefined' && !prefersReducedMotion());

  const finish = useCallback(() => {
    onDone();
    setRunning(false);
  }, [onDone]);

  useEffect(() => {
    if (!running) {
      onDone();
      return;
    }
    const reveal = window.setTimeout(onDone, INTRO_REVEAL_MS);
    const end = window.setTimeout(() => setRunning(false), INTRO_MS);
    window.addEventListener('keydown', finish, { once: true });
    return () => {
      window.clearTimeout(reveal);
      window.clearTimeout(end);
      window.removeEventListener('keydown', finish);
    };
  }, [running, onDone, finish]);

  if (!running) return null;

  return (
    <div className="h-intro" aria-hidden="true" onClick={finish}>
      <div className="h-intro-stage">
        <span className="h-intro-halo" />
        <ApliLogo className="h-intro-logo" />
      </div>
      <p className="h-intro-line">
        Real work. Real proof. <span>A real job.</span>
      </p>
      <p className="h-intro-skip">Click or press any key to skip</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Header                                                                      */
/* -------------------------------------------------------------------------- */

function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`h-header ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="h-wrap h-header-inner">
        <Link to="/" className="h-brand" aria-label="Apli.ai, home">
          <ApliLogo className="h-brand-logo" />
        </Link>
        <nav className="h-header-actions" aria-label="Account">
          <Link to="/login" className="h-btn h-btn-quiet">
            Sign in
          </Link>
          <Link to="/register/student" className="h-btn h-btn-line">
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero                                                                        */
/* -------------------------------------------------------------------------- */

function Hero({ entered }: { entered: boolean }) {
  return (
    <section className="h-hero">
      <div className="h-breath" aria-hidden="true">
        <span className="h-orb is-a" />
        <span className="h-orb is-b" />
        <span className="h-orb is-c" />
      </div>

      <div className="h-wrap h-hero-inner">
        <div className="h-hero-copy">
          <p className="h-kicker h-arrive" style={{ '--i': 0 } as CSSProperties}>
            <span className="h-kicker-dot" aria-hidden="true" />
            Virtual internships that lead to jobs
          </p>
          <h1 className="h-title h-arrive" style={{ '--i': 1 } as CSSProperties}>
            Real work.
            <br />
            Real proof.
            <br />
            <span className="h-title-warm">A real job.</span>
          </h1>
          <p className="h-lede h-arrive" style={{ '--i': 2 } as CSSProperties}>
            Virtual internships set by companies, free for students. Do the tasks, explain your work on a
            short call, and earn a certificate anyone can check. Your college vouches for who you are, so
            recruiters trust what you did, and the interviews follow.
          </p>
          <div className="h-actions h-arrive" style={{ '--i': 3 } as CSSProperties}>
            <Link to="/register/student" className="h-btn h-btn-go h-btn-lg">
              Start an internship
              <span className="h-arrow" aria-hidden="true">
                →
              </span>
            </Link>
            <Link to="/register/company" className="h-btn h-btn-line h-btn-lg">
              I’m hiring
              <span className="h-arrow" aria-hidden="true">
                →
              </span>
            </Link>
          </div>
          <ul className="h-assure h-arrive" style={{ '--i': 4 } as CSSProperties}>
            <li>Free for students</li>
            <li>A few hours each</li>
            <li>Certificates anyone can check</li>
          </ul>
        </div>

        <div className="h-hero-art h-arrive" style={{ '--i': 2 } as CSSProperties}>
          <ApplicationStory started={entered} />
        </div>
      </div>

      <a href="#why" className="h-scroll" aria-label="Scroll to learn more">
        <span />
      </a>
    </section>
  );
}

/**
 * The idea, as it happens to one student: a phone receiving the updates of a
 * single virtual internship, from starting it to the offer it led to. Every
 * step is something Apli.ai makes true, so the reader sees the purpose rather
 * than being told it. Loops; frozen on the finished story for anybody who
 * asked for reduced motion.
 */
const STORY = [
  { tone: 'indigo', icon: '▶', title: 'Started: Software Engineering', sub: 'Sample Tech · virtual internship · 5 hrs' },
  { tone: 'coral', icon: '✎', title: 'Task 3 of 4 submitted', sub: 'Build and test an API endpoint' },
  { tone: 'indigo', icon: '☎', title: 'Explain-your-work call booked', sub: '10 minutes · Friday, 11:00' },
  { tone: 'sage', icon: '✓', title: 'Certificate earned', sub: 'On your skills passport · anyone can check it' },
  { tone: 'coral', icon: '★', title: 'Sample Tech invited you to apply', sub: 'They saw your work first' },
  { tone: 'sage', icon: '₹', title: 'Offer received', sub: '₹6.2 LPA fixed · no bond · shown in full' },
] as const;

const STORY_STEP_MS = 2200;
/** How many updates the phone shows at once. */
const WINDOW = 3;

function ApplicationStory({ started }: { started: boolean }) {
  const [reduced] = useState(prefersReducedMotion);
  // A counter that only ever goes up: the newest update is STORY[(tick - 1) % 6].
  // It starts with a full screen, so the phone never looks empty, and loops
  // forever without a jump back to a blank start.
  const [tick, setTick] = useState(WINDOW);

  useEffect(() => {
    if (reduced || !started) return;
    const t = window.setInterval(() => setTick((n) => n + 1), STORY_STEP_MS);
    return () => window.clearInterval(t);
  }, [started, reduced]);

  // Newest on top, the way a phone shows notifications.
  const visible = Array.from({ length: WINDOW }, (_, k) => {
    const n = tick - k;
    return { ...STORY[(n - 1) % STORY.length]!, n };
  });
  const step = ((tick - 1) % STORY.length) + 1;

  return (
    <div
      className="h-story"
      role="img"
      aria-label="A student's phone receiving updates: a virtual internship started, a task submitted, an explain-your-work call booked, a certificate earned, an invitation to apply, and an offer shown in full."
    >
      <span className="h-story-glow" aria-hidden="true" />

      {/* Two facts pinned to the phone's edges: they overlap it, which is
          what ties the phone to the copy instead of leaving it on an island. */}
      <span className="h-float is-offer" aria-hidden="true">
        <span className="h-float-icon">✓</span>
        <span>
          <b>Certificate earned</b>
          <i>anyone can check it</i>
        </span>
      </span>
      <span className="h-float is-clock" aria-hidden="true">
        <span className="h-float-icon">⏱</span>
        <span>
          <b>5 hours of real work</b>
          <i>set by the company itself</i>
        </span>
      </span>

      <div className="h-phone" aria-hidden="true">
        <span className="h-phone-notch" />
        <div className="h-phone-top">
          <ApliLogo className="h-phone-logo" />
          <span className="h-phone-live">
            <i /> Live
          </span>
        </div>
        <p className="h-phone-hello">Your internship</p>
        <div className="h-phone-bar">
          <span style={{ width: `${(step / STORY.length) * 100}%` }} />
        </div>
        <p className="h-phone-step">
          Step {step} of {STORY.length}
        </p>
        <ul className="h-feed">
          {visible.map((s) => (
            <li key={s.n} className={`h-note is-${s.tone}`}>
              <span className="h-note-icon">{s.icon}</span>
              <span className="h-note-text">
                <b>{s.title}</b>
                <i>{s.sub}</i>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The problem                                                                 */
/* -------------------------------------------------------------------------- */

const PROBLEM =
  'Every job asks for experience. Every internship asks for experience. Nobody tells you where you are supposed to get it.';

/**
 * The problem, read into focus. Each word goes from faint to full ink as the
 * section scrolls through the screen, so the reader's own scrolling is what
 * brings it into focus - from fog to clarity, which is what the product does.
 */
function Problem() {
  const ref = useRef<HTMLParagraphElement>(null);
  const words = useMemo(() => PROBLEM.split(' '), []);
  const [lit, setLit] = useState(() => (prefersReducedMotion() ? words.length : 0));

  useEffect(() => {
    if (prefersReducedMotion()) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when the paragraph's top reaches 85% of the screen, 1 when its
      // bottom reaches 45%.
      const start = vh * 0.85;
      const end = vh * 0.45;
      const span = start - end + rect.height;
      const p = Math.min(1, Math.max(0, (start - rect.top) / span));
      setLit(Math.round(p * words.length));
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
  }, [words.length]);

  return (
    <section className="h-problem" id="why">
      <div className="h-wrap h-narrow">
        <p className="h-label">Why we exist</p>
        <p className="h-focus" ref={ref} aria-label={PROBLEM}>
          {words.map((w, i) => (
            <span key={i} className={i < lit ? 'is-lit' : ''} aria-hidden="true">
              {w}{' '}
            </span>
          ))}
        </p>
        <p className={`h-answer ${lit >= words.length ? 'is-in' : ''}`}>
          So start here. <strong>Apli.ai gives you the experience first.</strong>
        </p>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* The internships                                                             */
/* -------------------------------------------------------------------------- */

/**
 * What a virtual internship actually is, shown rather than described: a row
 * of them, the way a student meets them inside the portal. Sample companies
 * only, and labelled as such - the page never invents an employer.
 */
const INTERNSHIPS = [
  { company: 'Indus Systems', title: 'Software Engineering', hours: 5, tasks: 3, skills: ['Java', 'REST APIs', 'SQL'], tone: 'indigo' },
  { company: 'Northwind Analytics', title: 'Data Analytics', hours: 4, tasks: 3, skills: ['Excel', 'SQL', 'Visualisation'], tone: 'sage' },
  { company: 'Harbour Fintech', title: 'Fintech Product Analyst', hours: 5, tasks: 3, skills: ['Product thinking', 'UPI', 'Writing specs'], tone: 'coral' },
  { company: 'Vertex Motors', title: 'EV Battery Engineering', hours: 6, tasks: 4, skills: ['Battery systems', 'Thermal analysis', 'MATLAB'], tone: 'indigo' },
  { company: 'Zenith Labs', title: 'Product Design', hours: 4, tasks: 3, skills: ['UX research', 'Figma', 'Prototyping'], tone: 'coral' },
  { company: 'Solace Health', title: 'Healthcare Operations', hours: 3, tasks: 3, skills: ['Process mapping', 'Operations', 'Patient experience'], tone: 'sage' },
] as const;

function Internships() {
  const { ref, revealed } = useReveal<HTMLUListElement>();

  return (
    <section className="h-interns" id="internships">
      <div className="h-wrap">
        <div className="h-head h-head-row">
          <div>
            <p className="h-label">Virtual internships</p>
            <h2 className="h-h2">Show what you can do, not just what you studied.</h2>
          </div>
          <p className="h-interns-lede">
            Each one is a few hours of real tasks, written by the company that hires for the role, and checked by a
            person before it counts.
          </p>
        </div>

        <ul className={`h-intern-grid ${revealed ? 'is-in' : ''}`} ref={ref}>
          {INTERNSHIPS.map((x, i) => (
            <li key={x.title} className={`h-intern is-${x.tone}`} style={{ '--i': i } as CSSProperties}>
              <span className="h-intern-co">
                <span className="h-intern-logo" aria-hidden="true">
                  {x.company
                    .split(' ')
                    .map((w) => w[0])
                    .join('')}
                </span>
                {x.company}
              </span>
              <b className="h-intern-title">{x.title}</b>
              <span className="h-intern-meta">
                {x.hours} hrs · {x.tasks} tasks · certificate
              </span>
              <span className="h-intern-skills">
                {x.skills.map((k) => (
                  <i key={k}>{k}</i>
                ))}
              </span>
            </li>
          ))}
        </ul>

        <div className="h-interns-foot">
          <Link to="/register/student" className="h-btn h-btn-go">
            Start one free
            <span className="h-arrow" aria-hidden="true">
              →
            </span>
          </Link>
          <p>Sample internships from our demo companies.</p>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* How it works                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Four steps on one thread, from picking an internship to the interview it
 * leads to. The thread draws itself as the reader scrolls, and each step
 * lights up when the thread reaches it.
 */
function Thread() {
  const ref = useRef<HTMLOListElement>(null);
  const [progress, setProgress] = useState(() => (prefersReducedMotion() ? 1 : 0));

  useEffect(() => {
    if (prefersReducedMotion()) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const mid = window.innerHeight * 0.6;
      setProgress(Math.min(1, Math.max(0, (mid - rect.top) / rect.height)));
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
  }, []);

  const steps = [
    {
      title: 'Pick a virtual internship.',
      body: 'Choose a role you are curious about. Each one is built by a company and shows what the job is really like, in a few hours rather than a few months.',
      art: <PickArt />,
    },
    {
      title: 'Do the real tasks.',
      body: 'Work through the same kind of problems the team solves every week, with the briefs and resources they wrote. Save as you go and submit when you are ready.',
      art: <TasksArt />,
    },
    {
      title: 'Explain your work.',
      body: 'A short call with the company: walk them through what you did and why. It is how a certificate here stays worth something when anyone can copy an answer.',
      art: <ClockArt />,
    },
    {
      title: 'Get certified. Get hired.',
      body: 'The certificate goes on your skills passport, and anyone can check it. Recruiters see it when you apply, and every offer you get is tracked to your first day.',
      art: <JourneyArt />,
    },
  ];

  return (
    <section className="h-how" id="how">
      <div className="h-wrap">
        <div className="h-head">
          <p className="h-label">How it works</p>
          <h2 className="h-h2">From your first task to your first job.</h2>
        </div>

        <ol className="h-thread" ref={ref} style={{ '--p': progress } as CSSProperties}>
          <span className="h-thread-line" aria-hidden="true" />
          {steps.map((s, i) => (
            <li key={s.title} className={`h-step ${progress >= (i + 0.15) / steps.length ? 'is-on' : ''}`}>
              <span className="h-step-num" aria-hidden="true">
                {i + 1}
              </span>
              <div className="h-step-text">
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
              <div className="h-step-art" aria-hidden="true">
                {s.art}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function PickArt() {
  return (
    <div className="a-card">
      <div className="a-row">
        <span className="a-avatar">ST</span>
        <span className="a-lines">
          <b>Software Engineering</b>
          <i>Sample Tech · 5 hrs · 4 tasks</i>
        </span>
      </div>
      <span className="a-start">Start internship →</span>
    </div>
  );
}

function TasksArt() {
  return (
    <div className="a-card a-tasks">
      {['Read the brief', 'Design the endpoint', 'Write the tests', 'Submit your work'].map((t, i) => (
        <span key={t} className={`a-task ${i < 3 ? 'is-done' : ''}`} style={{ '--i': i } as CSSProperties}>
          <i aria-hidden="true">{i < 3 ? '✓' : ''}</i>
          {t}
        </span>
      ))}
    </div>
  );
}

function StampArt() {
  return (
    <div className="a-card">
      <div className="a-row">
        <span className="a-avatar">AK</span>
        <span className="a-lines">
          <b>Sample Student</b>
          <i>B.Tech CSE · CGPA 8.4</i>
        </span>
      </div>
      <span className="a-stamp">✓ Verified by college</span>
    </div>
  );
}

function ClockArt() {
  return (
    <div className="a-card a-clock">
      <svg viewBox="0 0 64 64" className="a-ring">
        <circle cx="32" cy="32" r="26" className="a-ring-track" />
        <circle cx="32" cy="32" r="26" className="a-ring-fill" pathLength={1} />
      </svg>
      <span className="a-lines">
        <b>Explain-your-work call</b>
        <i>10 minutes · Friday, 11:00</i>
      </span>
    </div>
  );
}

function JourneyArt() {
  return (
    <div className="a-card a-journey">
      {['Certificate', 'Applied', 'Interview', 'Offer'].map((s) => (
        <span key={s} className="a-stop">
          <i />
          {s}
        </span>
      ))}
      <span className="a-runner" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Why recruiters trust it                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The answer to the recruiter's first question - "anyone can fake a project" -
 * in three mechanisms, each one something the product actually does.
 */
const TRUST = [
  {
    title: 'Copied work does not pass.',
    body: 'Nothing is certified on the written answer alone. The company talks to the student about the work first, and AI-made answers rarely survive five minutes of "why did you do it this way?".',
  },
  {
    title: 'The student is who they say they are.',
    body: 'Their college verifies and locks their academic record, and approves every company that hires its students. No fake profiles, no fake jobs.',
  },
  {
    title: 'Anyone can check the certificate.',
    body: 'Every certificate carries a code, and a public page confirms who earned it, for which internship and when. A screenshot is not proof. This is.',
  },
] as const;

function Trust() {
  const { ref, revealed } = useReveal<HTMLDivElement>();

  return (
    <section className="h-trust" id="trust">
      <div className={`h-wrap h-trust-inner ${revealed ? 'is-in' : ''}`} ref={ref}>
        <div className="h-head">
          <p className="h-label">Why recruiters trust it</p>
          <h2 className="h-h2">A certificate that means something.</h2>
        </div>
        <ul className="h-trust-list">
          {TRUST.map((t, i) => (
            <li key={t.title} style={{ '--i': i } as CSSProperties}>
              <TrustTick />
              <h3>{t.title}</h3>
              <p>{t.body}</p>
            </li>
          ))}
        </ul>
        <div className="h-trust-card" aria-hidden="true">
          <StampArt />
        </div>
      </div>
    </section>
  );
}

function TrustTick() {
  return (
    <span className="h-trust-tick" aria-hidden="true">
      ✓
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Who it is for                                                               */
/* -------------------------------------------------------------------------- */

const DOORS = [
  {
    key: 'student',
    who: 'Students',
    line: 'Get the experience every job asks for.',
    body: 'Free virtual internships from real companies, a certificate anyone can check, and jobs you qualify for, with every application tracked.',
    to: '/register/student',
    cta: 'Start an internship',
  },
  {
    key: 'college',
    who: 'Placement cells',
    line: 'Give every student experience, not just the toppers.',
    body: 'Virtual internships for the whole batch, a verified roster, every company approved by you, and NAAC and NIRF numbers that build themselves.',
    to: '/login',
    cta: 'Sign in to your portal',
  },
  {
    key: 'company',
    who: 'Companies',
    line: 'See real work before you interview.',
    body: 'Build a virtual internship once, reach students across colleges, and invite the ones whose work stood out. Use it as a round in your own hiring.',
    to: '/register/company',
    cta: 'Register your company',
  },
] as const;

/**
 * Three doors, one per reader. On a wide screen the one you point at opens
 * and the others narrow; on a phone they simply stack, all open.
 */
function Doors() {
  const [open, setOpen] = useState<string>('student');
  const { ref, revealed } = useReveal<HTMLDivElement>();

  return (
    <section className="h-doors-band" id="for">
      <div className="h-wrap">
        <div className="h-head">
          <p className="h-label">Who it is for</p>
          <h2 className="h-h2">One platform. Three sides of the same first job.</h2>
        </div>

        <div className={`h-doors ${revealed ? 'is-in' : ''}`} ref={ref}>
          {DOORS.map((d, i) => (
            <article
              key={d.key}
              className={`h-door is-${d.key} ${open === d.key ? 'is-open' : ''}`}
              style={{ '--i': i } as CSSProperties}
              onMouseEnter={() => setOpen(d.key)}
              onFocus={() => setOpen(d.key)}
            >
              <p className="h-door-who">{d.who}</p>
              <h3 className="h-door-line">{d.line}</h3>
              <div className="h-door-more">
                <p>{d.body}</p>
                <Link to={d.to} className="h-door-cta">
                  {d.cta} <span aria-hidden="true">→</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Who is waiting                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The feeling the rest of the page is careful around: a first job is a whole
 * household's news. Written in the second person, like the fears in
 * `landing/content.ts` - no quotes, no invented families, no stock faces.
 * Each moment is paired with the part of the product that answers it, so the
 * emotion is never left without a mechanism.
 */
const MOMENTS = [
  {
    moment: 'You are the first in your family to sit a campus interview.',
    answer: 'A virtual internship shows you what the job is really like before the interview, so you walk in having done it once.',
  },
  {
    moment: 'Every evening, someone at home asks if there is any news.',
    answer: 'Every application shows where it stands and who it is waiting on. “I don’t know” stops being the answer.',
  },
  {
    moment: 'This degree was paid for with a loan someone is still repaying.',
    answer: 'Fixed pay, variable pay and any bond are shown before you apply. The number you tell them is the number that arrives.',
  },
  {
    moment: 'By November the silence got loud, and you stopped applying.',
    answer: 'Your placement cell notices while there is still a season left, without the portal ever labelling you.',
  },
] as const;

function Waiting() {
  const { ref, revealed } = useReveal<HTMLDivElement>();

  return (
    <section className="h-waiting" id="waiting">
      <div className={`h-wrap h-waiting-inner ${revealed ? 'is-in' : ''}`} ref={ref}>
        <div className="h-head">
          <p className="h-label">Who is waiting on this offer</p>
          <h2 className="h-h2">A first job is never only yours.</h2>
          <p className="h-waiting-lede">
            Behind every application is a phone being checked at home, a fee receipt kept in a drawer, and a
            student trying not to hope too much. We built for them too.
          </p>
        </div>

        <ul className="h-moments">
          {MOMENTS.map((m, i) => (
            <li key={m.moment} className="h-moment" style={{ '--i': i } as CSSProperties}>
              <p className="h-moment-feel">{m.moment}</p>
              <p className="h-moment-answer">
                <span aria-hidden="true">✓</span>
                {m.answer}
              </p>
            </li>
          ))}
        </ul>

        <p className="h-waiting-end">
          So when the offer comes, it is one you can <em>tell them about</em> and one that is still there on the
          day you join.
        </p>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Close                                                                       */
/* -------------------------------------------------------------------------- */

const REFUSALS = ['No fees, ever.', 'No fake jobs.', 'No experience? Start here.'];

function Close() {
  const { ref, revealed } = useReveal<HTMLDivElement>();

  return (
    <section className="h-close">
      <div className={`h-wrap h-close-inner ${revealed ? 'is-in' : ''}`} ref={ref}>
        <ul className="h-refuse">
          {REFUSALS.map((r, i) => (
            <li key={r} style={{ '--i': i } as CSSProperties}>
              {r}
            </li>
          ))}
        </ul>
        <p className="h-close-sub">The first job should be a beginning, not a gamble.</p>
        <div className="h-actions is-center">
          <Link to="/register/student" className="h-btn h-btn-go h-btn-lg">
            Start an internship
            <span className="h-arrow" aria-hidden="true">
              →
            </span>
          </Link>
          <Link to="/login" className="h-btn h-btn-line-light h-btn-lg">
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="h-footer">
      <div className="h-wrap h-footer-inner">
        <div>
          <ApliLogo className="h-foot-logo" title="Apli.ai" />
          <p className="h-foot-line">Virtual internships that lead to real jobs.</p>
        </div>
        <nav className="h-foot-links" aria-label="Footer">
          <a href="#internships">Virtual internships</a>
          <a href="#how">How it works</a>
          <a href="#for">Who it is for</a>
          <Link to="/status">System status</Link>
          <a href="mailto:hello@apli.example">hello@apli.example</a>
        </nav>
      </div>
      <p className="h-wrap h-foot-note">Sample names and contact details only. This is a university project.</p>
    </footer>
  );
}
