import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import LivePipeline from '../components/LivePipeline';
import ApprovalGate from '../components/ApprovalGate';
import Reveal from '../components/Reveal';
import ApliLogo from '../components/ApliLogo';
import { ApliFace } from './student/Apli';
import OfferTruth from './landing/OfferTruth';
import SilenceMeter from './landing/SilenceMeter';
import SeasonLine from './landing/SeasonLine';
import SixGates from './landing/SixGates';
import Ledger from './landing/Ledger';
import Intro from './landing/Intro';
import { useScrollEnergy } from '../lib/useScrollEnergy';
import { useMagnetic, useSpotlight, useTilt } from './landing/useSpotlight';
import { HowItWorks, Inside } from './landing/Inside';
import Supporters from './landing/Supporters';
import { PERSONAS, personaCopy, type Fear, type Persona } from './landing/content';
import './Landing.css';
import './landing/interactive.css';
import './landing/dark.css';
import './landing/motion.css';
import './landing/sixgates.css';
import './landing/ledger.css';
import './landing/intro.css';
import './landing/arrival.css';
import './landing/logo.css';

/**
 * The landing page.
 *
 * Campus hiring is not an admin problem to the people inside it. It is eight
 * months of being measured by strangers on somebody else's timetable, and the
 * feelings that go with that - the silence in October, the number on the offer
 * that turns out not to be the number - are the actual reason this product
 * exists. A page that opens with "streamline your placement workflow" is
 * talking to nobody who has lived it.
 *
 * So the page does three things a feature list cannot.
 *
 * It asks who is reading. One argument, three audiences, and they do not share
 * a fear; the visitor says which they are and the page answers that person
 * throughout - headline, evidence and call to action.
 *
 * It names the fear before the feature, in the second person, because "you
 * applied to forty companies and heard nothing" is recognised while
 * "end-to-end visibility" is skimmed.
 *
 * And it demonstrates rather than asserts. No testimonials, no customer logos,
 * no invented numbers - the product is built on being honest about what
 * exists, and a landing page that was not would be the first broken promise.
 * What persuades instead is the thing working in front of you: a pipeline that
 * moves, a gate that decides, an offer the reader takes apart by hand.
 *
 * On the surface of it
 * --------------------
 * The atmosphere is doing a job too. A trust product that looks like a form
 * is not believed, so the page is built in layers - a fixed grid and grain
 * under everything, brand light that leans towards the cursor, cards that sit
 * above the page rather than printed on it. All of it is decoration in the
 * strict sense: remove every effect here and the words, the demos and the
 * links are untouched, which is why none of it waits on an animation and all
 * of it stops under prefers-reduced-motion.
 */
export default function LandingClassic() {
  const [persona, setPersona] = useState<Persona>('student');
  const copy = personaCopy(persona);

  /**
   * Whether the hero may assemble itself yet. False only until the curtain
   * starts to lift, 1.2 seconds in; true immediately for a returning visitor,
   * for anybody who skips, and for anybody who has asked for less motion.
   *
   * The class it adds is what every rule in arrival.css hangs off, which is why
   * a page whose JavaScript never runs renders finished instead of blank.
   */
  const [entered, setEntered] = useState(false);

  /* Stable, so `Intro`'s effect does not re-run on every parent render. */
  const enter = useCallback(() => setEntered(true), []);

  /** The scroll momentum the backdrop spends. */
  const energy = useScrollEnergy<HTMLDivElement>();

  return (
    <div className={`landing is-${persona} ${entered ? 'has-entered' : ''}`} ref={energy}>
      {/* On top of everything, for 1.8 seconds, on every load. The page below
          is already rendered and does not wait for it. */}
      <Intro onDone={enter} />
      <Backdrop />
      <SiteHeader persona={persona} onPersona={setPersona} />
      <main id="main">
        <Hero persona={persona} onPersona={setPersona} />
        <Promises />
        <Fears copy={copy} />
        <Silence />
        <Offer />
        <Inside />
        <Season />
        <HowItWorks />
        <Gate />
        {/*
          The college's gate, then the other five conditions, then the rule
          that makes any of it auditable. The order is the argument: one
          decision a human makes, six a query makes, and one function that is
          the only thing allowed to write down what happened.
        */}
        <Conditions />
        <Trail />
        <Supporters />
        <ClosingCta copy={copy} />
      </main>
      <SiteFooter />
    </div>
  );
}

/**
 * What the page sits on: a ruled grid, a slow brand aurora and a film grain.
 *
 * Fixed rather than per-section, so scrolling moves the content across a
 * surface that stays put - the thing that separates a page with depth from a
 * stack of boxes. Entirely inert: no pointer events, no layout, nothing
 * announced.
 */
function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <span className="backdrop-grid" />
      <span className="backdrop-aurora" />
      <span className="backdrop-grain" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Chrome                                                                      */
/* -------------------------------------------------------------------------- */

function SiteHeader({ persona, onPersona }: { persona: Persona; onPersona: (p: Persona) => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [past, setPast] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 12);
      // The switch follows the reader down the page, but only once the one in
      // the hero has gone: two of the same control on screen is a puzzle.
      setPast(window.scrollY > window.innerHeight * 0.75);
      const total = document.body.scrollHeight - window.innerHeight;
      setProgress(total > 0 ? Math.min(1, window.scrollY / total) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`site-header ${scrolled ? 'is-scrolled' : ''}`}>
      <span className="site-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />
      <div className="container site-header-inner">
        {/* The lockup carries the name, so the text wordmark beside it would
            only say "Apli" twice. The link keeps the full name for anybody
            not looking at it. */}
        <Link to="/" className="brand" aria-label="Apli.ai, home">
          <ApliLogo className="brand-logo" />
        </Link>

        {/* No section links up here - the header is for getting in. The page's
            sections are listed in the footer. */}
        {past && <PersonaSwitch persona={persona} onPersona={onPersona} compact />}

        <div className="site-header-actions">
          <Link to="/login" className="btn btn-ghost">
            Sign in
          </Link>
          <Link to="/register/student" className="btn btn-secondary">
            Student sign-up
          </Link>
          <Link to="/register/company" className="btn btn-primary">
            Register a company
          </Link>
        </div>
      </div>
    </header>
  );
}

/**
 * Who is reading.
 *
 * Deliberately the first thing asked and the last thing taken away: a student
 * and a placement officer want opposite reassurances, and a page that hedges
 * between them convinces neither. A radio group, so a keyboard moves through
 * it the way it moves through any other choice. The lit pill slides between
 * options rather than blinking, which is what makes it read as one control
 * and not three buttons.
 */
function PersonaSwitch({
  persona,
  onPersona,
  compact = false,
}: {
  persona: Persona;
  onPersona: (p: Persona) => void;
  compact?: boolean;
}) {
  const track = useRef<HTMLDivElement>(null);
  const opts = useRef(new Map<Persona, HTMLButtonElement>());

  /**
   * Where the lit pill sits, measured from the button it belongs to.
   *
   * It used to be a third of the track, moved a third at a time - which is
   * only right if the three options are the same width, and they never are:
   * the labels are set `nowrap`, so each option is as wide as its own words
   * and "I am looking for a job" is half again the width of "I am hiring".
   * The pill ended in the middle of the word it was meant to be lighting.
   *
   * So it is measured instead. That also survives the things a fraction
   * cannot: the display font landing after first paint and changing every
   * width, the shorter labels in the compact variant, and translation.
   */
  const [lit, setLit] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = opts.current.get(persona);
      // offsetLeft and the pill's own `left` are both resolved against the
      // track's padding box, so the two agree without correcting for padding.
      if (el) setLit({ left: el.offsetLeft, width: el.offsetWidth });
    };

    measure();

    // The webfont arrives after the first paint and every label changes width
    // when it does.
    document.fonts?.ready.then(measure).catch(() => {});

    const ro = new ResizeObserver(measure);
    if (track.current) ro.observe(track.current);
    return () => ro.disconnect();
  }, [persona, compact]);

  const index = PERSONAS.findIndex((p) => p.key === persona);

  return (
    <div
      className={`psw ${compact ? 'is-compact' : ''}`}
      role="radiogroup"
      aria-label="Who are you?"
      ref={track}
    >
      <span
        className="psw-lit"
        aria-hidden="true"
        style={
          lit
            ? { transform: `translateX(${lit.left}px)`, width: `${lit.width}px` }
            : // Before the first measurement - equal thirds, which is wrong by
              // a few pixels but is never seen: useLayoutEffect corrects it
              // before the browser paints.
              { transform: `translateX(${index * 100}%)`, width: `${100 / PERSONAS.length}%` }
        }
      />
      {PERSONAS.map((p) => (
        <button
          key={p.key}
          type="button"
          role="radio"
          aria-checked={persona === p.key}
          className={`psw-opt ${persona === p.key ? 'is-on' : ''}`}
          onClick={() => onPersona(p.key)}
          ref={(el) => {
            if (el) opts.current.set(p.key, el);
            else opts.current.delete(p.key);
          }}
        >
          {compact ? p.label : p.pick}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero                                                                        */
/* -------------------------------------------------------------------------- */

/** Floating annotations round the demo - the claims, pinned to the thing. */
const PINS: Record<Persona, { text: string; tone: string; at: string }[]> = {
  student: [
    { text: 'Verified by your college', tone: 'pass', at: 'tl' },
    { text: '4 days left to answer you', tone: 'hold', at: 'br' },
  ],
  college: [
    { text: 'Nothing reaches a student without you', tone: 'pass', at: 'tl' },
    { text: 'Counted for NAAC as it happens', tone: 'brand', at: 'br' },
  ],
  company: [
    { text: 'Records frozen by the college', tone: 'pass', at: 'tl' },
    { text: 'Your rounds, your order', tone: 'brand', at: 'br' },
  ],
};

function Hero({ persona, onPersona }: { persona: Persona; onPersona: (p: Persona) => void }) {
  const copy = personaCopy(persona);
  const lit = useSpotlight<HTMLElement>();
  const tilt = useTilt<HTMLDivElement>();
  const magnet = useMagnetic<HTMLSpanElement>();

  return (
    <section className="hero" ref={lit}>
      <span className="hero-light" aria-hidden="true" />
      <div className="container hero-inner">
        <div className="hero-copy">
          <p className="hero-ask">
            <span className="hero-ask-rule" aria-hidden="true" />
            Before we say anything, who is reading?
          </p>
          <PersonaSwitch persona={persona} onPersona={onPersona} />

          {/* Keyed on the persona so the words are re-animated, not swapped
              silently underneath somebody mid-sentence. */}
          <div className="hero-said" key={persona}>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1>
              {copy.headline[0]} <em>{copy.headline[1]}</em>
            </h1>
            <p className="hero-lede">{copy.lede}</p>
            <div className="hero-actions">
              <span className="mag" ref={magnet}>
                <Link to={copy.cta.to} className="btn btn-primary btn-lg btn-arrow">
                  {copy.cta.label}
                </Link>
              </span>
              <a href="#fears" className="btn btn-secondary btn-lg">
                What goes wrong today
              </a>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-stage" ref={tilt}>
            <span className="hero-glow" aria-hidden="true" />
            <LivePipeline />
            {PINS[persona].map((pin) => (
              <span key={pin.text} className={`pin is-${pin.tone} at-${pin.at}`} aria-hidden="true">
                {pin.text}
              </span>
            ))}
          </div>
          <p className="hero-caption" key={persona}>
            {copy.caption}
          </p>
        </div>
      </div>

      <p className="hero-scroll" aria-hidden="true">
        <span />
      </p>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* The refusals                                                                */
/* -------------------------------------------------------------------------- */

/** What the product will not do. A promise is sharper stated as a refusal. */
const REFUSALS = [
  'No fee, ever',
  'No job we have not verified',
  'No silence without a clock on it',
  'No offer we stop watching at the offer',
  'No practice score sent to anybody',
  'No student data leaving the college',
  'No number without its working',
  'No round nobody explained',
];

function Promises() {
  return (
    <section className="ticker" aria-label="What Apli.ai refuses to do">
      {/* Two identical runs so the loop has no seam. The copy is hidden from
          assistive technology, which reads the list once. */}
      {[0, 1].map((run) => (
        <div className="ticker-run" key={run} aria-hidden={run === 1}>
          {REFUSALS.map((r) => (
            <span key={r} className="ticker-item">
              {r}
              <i aria-hidden="true" />
            </span>
          ))}
        </div>
      ))}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* The fears                                                                   */
/* -------------------------------------------------------------------------- */

function Fears({ copy }: { copy: ReturnType<typeof personaCopy> }) {
  return (
    <section className="band band-alt" id="fears">
      <div className="container">
        <Reveal className="section-head">
          <p className="eyebrow">
            <span className="eyebrow-rule" aria-hidden="true" />
            Start here
          </p>
          <h2>{copy.fearsTitle}</h2>
          <p className="section-sub">
            The things that go wrong every season. Turn each one over for what this portal does
            about it - the mechanism, not a reassurance.
          </p>
        </Reveal>

        <div className="fear-grid" key={copy.key}>
          {copy.fears.map((f, i) => (
            <Reveal key={f.fear} delay={i % 3} as="div">
              <FearCard fear={f} index={i + 1} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * One fear, with its answer on the back.
 *
 * A real turn rather than a disclosure: the two sides are the same object
 * seen from either side, which is the point being made. It is a button, so a
 * keyboard and a phone get exactly what a mouse gets, and the face that is
 * away is hidden from assistive technology rather than read out twice.
 */
function FearCard({ fear, index }: { fear: Fear; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <button
      type="button"
      className={`fear ${open ? 'is-open' : ''}`}
      aria-expanded={open}
      onClick={() => setOpen((v) => !v)}
    >
      <span className="fear-inner">
        <span className="fear-side is-front" aria-hidden={open}>
          <span className="fear-num" aria-hidden="true">
            {String(index).padStart(2, '0')}
          </span>
          <span className="fear-text">{fear.fear}</span>
          <span className="fear-hint">What happens here</span>
        </span>

        <span className="fear-side is-back" aria-hidden={!open}>
          <span className="fear-answer">{fear.answer}</span>
          <span className="fear-proof">{fear.proof}</span>
        </span>
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* The demonstrations                                                          */
/* -------------------------------------------------------------------------- */

function Silence() {
  return (
    <section className="band band-dark">
      <div className="container">
        <Reveal className="section-head">
          <p className="eyebrow">
            <span className="eyebrow-rule" aria-hidden="true" />
            The one that hurts most
          </p>
          <h2>
            Nobody minds a no. <em>Everybody minds nothing.</em>
          </h2>
          <p className="section-sub">
            Ghosting is the most common complaint in campus hiring. Here it is measured: your
            institution sets how long a company has to answer, and both sides can see the clock.
          </p>
        </Reveal>
        <Reveal delay={1}>
          <SilenceMeter />
        </Reveal>
      </div>
    </section>
  );
}

function Offer() {
  return (
    <section className="band band-alt" id="offer">
      <div className="container">
        <Reveal className="section-head">
          <p className="eyebrow">
            <span className="eyebrow-rule" aria-hidden="true" />
            Take it apart yourself
          </p>
          <h2>
            The number on the poster <em>is not the number in your account.</em>
          </h2>
          <p className="section-sub">
            Move the slider to what a first-year actually receives of their variable pay. A made-up
            offer; the arithmetic is the real thing.
          </p>
        </Reveal>
        <Reveal delay={1}>
          <OfferTruth />
        </Reveal>
      </div>
    </section>
  );
}

function Season() {
  return (
    <section className="band band-dark" id="season">
      <div className="container">
        <Reveal className="section-head">
          <p className="eyebrow">
            <span className="eyebrow-rule" aria-hidden="true" />
            Eight months
          </p>
          <h2>A placement season has a shape. Somebody should say so.</h2>
          <p className="section-sub">
            What it feels like, month by month, and what this portal is doing at that exact point.
          </p>
        </Reveal>
        <SeasonLine />
      </div>
    </section>
  );
}

function Gate() {
  return (
    <section className="band band-alt" id="gate">
      <div className="container">
        <Reveal className="section-head section-head-center">
          <p className="eyebrow">
            <span className="eyebrow-rule" aria-hidden="true" />
            Why any of this is possible
          </p>
          <h2>The college keeps the gate.</h2>
          <p className="section-sub">
            Publishing a job does not make it visible. Every posting waits for the placement cell,
            and that one decision is what makes this a placement system rather than a job board.
          </p>
        </Reveal>
        <Reveal delay={1}>
          <ApprovalGate />
        </Reveal>
      </div>
    </section>
  );
}

/**
 * The six conditions.
 *
 * Placed immediately after the college's gate because it answers the question
 * that one raises. `ApprovalGate` shows a placement officer deciding; a reader
 * who believes it then asks the obvious next thing - fine, it reached my
 * college, so why can she apply and I cannot - and this is that answer, in the
 * order the query itself applies them.
 */
function Conditions() {
  return (
    <section className="band" id="gates">
      <div className="container">
        <Reveal className="section-head">
          <p className="eyebrow">
            <span className="eyebrow-rule" aria-hidden="true" />
            Six, in this order
          </p>
          <h2>
            A role is not visible because it exists. <em>It is visible because six things are true.</em>
          </h2>
          <p className="section-sub">
            Scroll and they open one at a time - the same six the database applies, in the same
            order, on one query. Then take a number off the record and watch where it stops.
          </p>
        </Reveal>
        <Reveal delay={1}>
          <SixGates />
        </Reveal>
      </div>
    </section>
  );
}

/**
 * The audit trail.
 *
 * Last of the demonstrations and the one that underwrites the others. Every
 * claim made further up this page - the deadline that is enforced, the offer
 * that is tracked to joining, the drive that closes when a student accepts -
 * is only worth anything if the record behind it cannot be quietly rewritten.
 * So the page ends its argument by showing the write path, including the write
 * that gets refused.
 */
function Trail() {
  return (
    <section className="band band-alt" id="trail">
      <div className="container">
        <Reveal className="section-head">
          <p className="eyebrow">
            <span className="eyebrow-rule" aria-hidden="true" />
            One function, one table
          </p>
          <h2>
            Nothing here is edited. <em>Things are only ever added.</em>
          </h2>
          <p className="section-sub">
            An application&rsquo;s status changes in exactly one place in the code, and that place
            writes the history before it tells anybody. Watch it fill, watch an illegal move get
            turned away, and watch one acceptance close three other applications on its own.
          </p>
        </Reveal>
        <Reveal delay={1}>
          <Ledger />
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Closing                                                                     */
/* -------------------------------------------------------------------------- */

function ClosingCta({ copy }: { copy: ReturnType<typeof personaCopy> }) {
  const magnet = useMagnetic<HTMLSpanElement>();

  return (
    <section className="cta">
      <span className="cta-light" aria-hidden="true" />
      <div className="container cta-inner">
        <span className="cta-face" aria-hidden="true">
          <ApliFace mood="cheer" size={58} />
        </span>
        <div key={copy.key} className="cta-said">
          <h2>{copy.closing.title}</h2>
          <p>{copy.closing.body}</p>
        </div>
        <div className="cta-actions">
          <span className="mag" ref={magnet}>
            <Link to={copy.cta.to} className="btn btn-primary btn-lg btn-arrow">
              {copy.cta.label}
            </Link>
          </span>
          <Link to="/login" className="btn btn-secondary btn-lg">
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container foot-grid">
        <div className="foot-about">
          <div className="footer-brand">
            <ApliLogo className="brand-logo is-footer" title="Apli.ai" />
          </div>
          <p className="foot-line">
            The campus hiring platform where every student is real, every job is real, and every
            offer is kept.
          </p>
          <address className="foot-address">
            Demo Institute of Technology campus
            <br />
            Mumbai, Maharashtra
            <br />
            <a href="mailto:hello@apli.example">hello@apli.example</a>
            <br />
            +91 90000 00000
          </address>
          <p className="foot-demo">Placeholder contact details - this is a university project.</p>
        </div>

        <nav className="foot-col" aria-label="The product">
          <h2>The product</h2>
          <a href="#fears">What goes wrong</a>
          <a href="#offer">The real number</a>
          <a href="#inside">Inside</a>
          <a href="#season">The season</a>
          <a href="#gates">The six gates</a>
          <a href="#trail">The record</a>
          <a href="#how">How it works</a>
        </nav>

        <nav className="foot-col" aria-label="For you">
          <h2>For you</h2>
          <Link to="/login">Students, sign in</Link>
          <Link to="/register/student">Students, join your college</Link>
          <Link to="/login">Placement cells</Link>
          <Link to="/register/company">Register a company</Link>
          <a href="#behind">Who backed this</a>
        </nav>

        <nav className="foot-col" aria-label="More">
          <h2>More</h2>
          <Link to="/status">System status</Link>
          <Link to="/login">Sign in</Link>
          <a href="#main">Back to the top</a>
        </nav>
      </div>

      <div className="container foot-bottom">
        <p>
          Every figure and every name on this page is a sample. No testimonials, no logos we do not
          hold, no counts of anything we have not done.
        </p>
        <p className="foot-stack">React, Node and MySQL.</p>
      </div>
    </footer>
  );
}
