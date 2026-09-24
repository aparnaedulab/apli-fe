import { useEffect, useState } from 'react';
import { prefersReducedMotion } from '../../lib/useReveal';
import Reveal from '../../components/Reveal';
import './supporters.css';

/**
 * Who backed this, and what the people inside a season say.
 *
 * Both structures come from apli.ai: a supporter strip, and a carousel of
 * quotes with a name and a company under each one.
 *
 * The supporters are apli.ai's own, restated. Keep this list true - it is the
 * one place on the page making a claim about somebody who is not us, and a
 * wall of logos is the oldest way on the internet to look bigger than you
 * are.
 *
 * The quotes are *not* apli.ai's. The three testimonials on that site are real
 * people, named, with their real employers, praising the virtual-experience
 * product from 2021 - not this portal, which they have never used. Moving
 * their words onto this page would put an endorsement of something else in a
 * real person's mouth, which is precisely the dishonesty this product was
 * built to remove. So the carousel carries what the product actually holds:
 * campus stories, which seniors write for their juniors after an interview.
 * These are samples and every card says so, with demo names.
 */

interface Supporter {
  name: string;
  /** What they are, so the strip is not four words with no meaning. */
  what: string;
}

const SUPPORTERS: Supporter[] = [
  { name: 'IIT Startups', what: 'IIT Bombay' },
  { name: 'DSSE', what: 'Desai Sethi School of Entrepreneurship' },
  { name: 'Rajesh Nair', what: 'Angel investor' },
  { name: 'Alsisar', what: 'Alsisar Impact' },
];

interface Story {
  kind: string;
  quote: string;
  who: string;
  what: string;
}

/** Samples. Demo names, demo companies - the shape of a real campus story. */
const STORIES: Story[] = [
  {
    kind: 'Interview experience',
    quote:
      'Four rounds. The online test was the one that decided it - 45 questions in 40 minutes, and I lost the first ten to reading too carefully. Nobody is marking you on being thorough there.',
    who: 'Aparna R.',
    what: 'B.Tech CSE 2026 · after Zenith Labs',
  },
  {
    kind: 'Intern diary',
    quote:
      'Week three and I have finally stopped apologising for asking questions. The thing nobody tells you is that the first month is meant to look like this.',
    who: 'Kabir S.',
    what: 'B.Tech IT 2026 · Northwind Analytics',
  },
  {
    kind: 'My first months',
    quote:
      'The offer said twelve. What lands is about sixty-four thousand a month, and I wish somebody had shown me that split before I told my parents a number.',
    who: 'Meera J.',
    what: 'B.E. ECE 2025 · six months in',
  },
];

export default function Supporters() {
  return (
    <section className="band supporters" id="behind">
      <div className="container">
        {/* Wrapped so the names arrive as the section is reached. Unwrapped,
            the entrance fired on page load - eight screens above here - and
            nobody ever saw it. */}
        <Reveal>
          <p className="sup-label">We are supported by</p>
          <ul className="sup-strip">
            {SUPPORTERS.map((s) => (
              <li key={s.name}>
                <b>{s.name}</b>
                <small>{s.what}</small>
              </li>
            ))}
          </ul>
        </Reveal>

        <Stories />
      </div>
    </section>
  );
}

/**
 * The carousel, carrying campus stories rather than testimonials.
 *
 * It advances on its own so the section has life, stops the moment anybody
 * touches it or tabs into it, and never moves at all for a visitor who has
 * asked for less motion.
 */
function Stories() {
  const [at, setAt] = useState(0);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (held || prefersReducedMotion()) return;
    const t = window.setTimeout(() => setAt((i) => (i + 1) % STORIES.length), 7000);
    return () => window.clearTimeout(t);
  }, [at, held]);

  const story = STORIES[at]!;

  return (
    <div
      className="sup-stories"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
    >
      <div className="sup-head">
        <div>
          <p className="eyebrow">
            <span className="eyebrow-rule" aria-hidden="true" />
            Campus stories
          </p>
          <h2>Seniors leave notes for the batch behind them.</h2>
          <p className="section-sub">
            Every college keeps a messy document of interview experiences. In here it is organised
            by company and year, read by the placement cell before juniors see it, and the author
            can stay anonymous.
          </p>
        </div>
        <span className="sup-sample">Samples, with demo names</span>
      </div>

      <figure className="sup-card" key={at}>
        <span className="sup-kind">{story.kind}</span>
        <blockquote>{story.quote}</blockquote>
        <figcaption>
          <span className="sup-avatar" aria-hidden="true">
            {story.who.slice(0, 1)}
          </span>
          <span>
            <b>{story.who}</b>
            <small>{story.what}</small>
          </span>
        </figcaption>
      </figure>

      <div className="sup-controls">
        <button
          type="button"
          className="sup-arrow"
          aria-label="Previous story"
          onClick={() => setAt((i) => (i - 1 + STORIES.length) % STORIES.length)}
        >
          ‹
        </button>
        <span className="sup-dots" role="tablist" aria-label="Choose a story">
          {STORIES.map((s, i) => (
            <button
              key={s.who}
              type="button"
              role="tab"
              aria-selected={i === at}
              aria-label={`Story ${i + 1} of ${STORIES.length}`}
              className={i === at ? 'is-on' : ''}
              onClick={() => setAt(i)}
            />
          ))}
        </span>
        <button
          type="button"
          className="sup-arrow"
          aria-label="Next story"
          onClick={() => setAt((i) => (i + 1) % STORIES.length)}
        >
          ›
        </button>
      </div>
    </div>
  );
}
