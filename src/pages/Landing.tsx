import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import ApliLogo from '../components/ApliLogo';
import { prefersReducedMotion, useReveal } from '../lib/useReveal';
import './landing/home.css';

/**
 * The landing page.
 *
 * One job: somebody who arrives here knows within a few seconds what Apli.ai
 * is for. Campus hiring between three parties - students, the college's
 * placement cell and companies - where the college verifies every student and
 * approves every job, and every offer is followed until the student joins.
 *
 * Six sections and no more: the hero says it, the problem says why, the
 * thread says how, the doors say who it is for, the waiting says who else
 * is counting on the offer, the close says what we refuse.
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
        <Thread />
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
        Every student real. Every job real. <span>Every offer kept.</span>
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
            Campus hiring, built on trust
          </p>
          <h1 className="h-title h-arrive" style={{ '--i': 1 } as CSSProperties}>
            Every student real.
            <br />
            Every job real.
            <br />
            <span className="h-title-warm">Every offer kept.</span>
          </h1>
          <p className="h-lede h-arrive" style={{ '--i': 2 } as CSSProperties}>
            Apli.ai brings students, placement cells and companies onto one honest platform. Your
            college verifies every student and approves every job, and we follow every offer until
            the day you join.
          </p>
          <div className="h-actions h-arrive" style={{ '--i': 3 } as CSSProperties}>
            <Link to="/register/student" className="h-btn h-btn-go h-btn-lg">
              I’m a student
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
            <li>Verified by your college</li>
            <li>Offers tracked to day one</li>
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
 * single application, from the college verifying the profile to the joining
 * day. Every step is something Apli.ai makes true, so the reader sees the
 * purpose rather than being told it. Loops; frozen on the finished story for
 * anybody who asked for reduced motion.
 */
const STORY = [
  { tone: 'sage', icon: '✓', title: 'Profile verified by your college', sub: 'Marks and record confirmed once' },
  { tone: 'indigo', icon: '★', title: 'New job approved for you', sub: 'Software Engineer · Sample Tech' },
  { tone: 'coral', icon: '⏱', title: 'Sample Tech saw your application', sub: 'They must reply within 4 days' },
  { tone: 'indigo', icon: '✎', title: 'Interview on Friday, 11:00', sub: 'Round 2 of 3 · Technical' },
  { tone: 'coral', icon: '₹', title: 'Offer received', sub: '₹6.2 LPA fixed · no bond · shown in full' },
  { tone: 'sage', icon: '✓', title: 'Joining confirmed', sub: 'We followed it all the way to day one' },
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
      aria-label="A student's phone receiving updates: profile verified by the college, a job approved, a reply deadline, an interview, an offer shown in full, and joining confirmed."
    >
      <span className="h-story-glow" aria-hidden="true" />

      {/* Two facts pinned to the phone's edges: they overlap it, which is
          what ties the phone to the copy instead of leaving it on an island. */}
      <span className="h-float is-offer" aria-hidden="true">
        <span className="h-float-icon">₹</span>
        <span>
          <b>₹6.2 LPA</b>
          <i>shown in full, before you apply</i>
        </span>
      </span>
      <span className="h-float is-clock" aria-hidden="true">
        <span className="h-float-icon">⏱</span>
        <span>
          <b>Reply due in 4 days</b>
          <i>no more ghosting</i>
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
        <p className="h-phone-hello">Your application</p>
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
  'Forty applications. Weeks of silence. A job that turned out not to exist. An offer that changed after you said yes.';

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
          That is campus hiring today. <strong>Apli.ai is built to end it.</strong>
        </p>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* How it works                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Three promises on one thread. The thread draws itself as the reader scrolls,
 * and each promise lights up when the thread reaches it.
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
      title: 'Your college verifies you, once.',
      body: 'The placement cell confirms your marks and record. Companies see facts, not claims, and you never prove the same thing twice.',
      art: <StampArt />,
    },
    {
      title: 'Only real jobs reach you, with a clock on every reply.',
      body: 'Every posting is approved by your college before you see it. Every company has a deadline to answer, and both sides can see it.',
      art: <ClockArt />,
    },
    {
      title: 'Your offer is followed to your first day.',
      body: 'Salary split honestly before you apply. After you accept, we keep tracking until you have joined, and companies are measured on keeping their word.',
      art: <JourneyArt />,
    },
  ];

  return (
    <section className="h-how" id="how">
      <div className="h-wrap">
        <div className="h-head">
          <p className="h-label">How it works</p>
          <h2 className="h-h2">Three promises, kept in order.</h2>
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
        <b>Reply due in 4 days</b>
        <i>Approved by placement cell</i>
      </span>
    </div>
  );
}

function JourneyArt() {
  return (
    <div className="a-card a-journey">
      {['Offer', 'Accepted', 'Documents', 'Joined'].map((s) => (
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
/* Who it is for                                                               */
/* -------------------------------------------------------------------------- */

const DOORS = [
  {
    key: 'student',
    who: 'Students',
    line: 'Find a job you can trust.',
    body: 'See only roles you qualify for, know why when you do not, and always know where your application stands.',
    to: '/register/student',
    cta: 'Join your college',
  },
  {
    key: 'college',
    who: 'Placement cells',
    line: 'Run the season without spreadsheets.',
    body: 'Verify your students, approve every company, and watch placement numbers build themselves for NAAC and NIRF.',
    to: '/login',
    cta: 'Sign in to your portal',
  },
  {
    key: 'company',
    who: 'Companies',
    line: 'Hire students who are who they say.',
    body: 'Records frozen by the college, your own rounds in your own order, and a reputation for keeping offers.',
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
          <h2 className="h-h2">One platform. Three sides of the same table.</h2>
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
    answer: 'Every round is named before it starts, so nobody has to guess what “technical round” means.',
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

const REFUSALS = ['No fees, ever.', 'No fake jobs.', 'No silence without a deadline.'];

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
            Get started
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
          <p className="h-foot-line">Campus hiring where every student, job and offer is real.</p>
        </div>
        <nav className="h-foot-links" aria-label="Footer">
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
