import { useCallback, useEffect, useState } from 'react';
import ApliLogo from '../../components/ApliLogo';
import { prefersReducedMotion } from '../../lib/useReveal';

/**
 * What the portal does when you open it.
 *
 * ---------------------------------------------------------------------------
 * The logo, then the record
 *
 * Two beats, and each earns its place.
 *
 * First the mark performs itself. The Apli lockup is a paper plane with three
 * speed lines behind it, and - this is the part nobody had noticed - the trails
 * are separate paths in the artwork. So the plane can fly in from the lower
 * left and leave its own trails behind it. Nothing was invented to make that
 * happen; the logo has been drawing this animation from the beginning and was
 * simply never allowed to run it. The letters settle after the plane, and the
 * dot of the i lands last, as the full stop. It is in logo.css.
 *
 * Then the stamp. APPLIED is the first row of the state machine this entire
 * product is built around - the moment a student becomes a candidate, and the
 * first thing `transition()` ever writes about them. So the opening is not
 * decoration in front of the argument; its second beat is the argument's first
 * frame, a record being made in ink that nobody can go back and tidy. The
 * ledger section much further down the page is the same idea at length.
 *
 * The order matters. Who we are, then what we do. A logo alone would be a
 * company clearing its throat.
 *
 * ---------------------------------------------------------------------------
 * The rules it obeys
 *
 * An intro is the easiest thing on a site to get wrong, so this one is
 * deliberately hemmed in:
 *
 *   It never blocks. The page renders underneath from the first frame - this
 *   is an overlay, not a loading gate. Nothing waits for it, and if the
 *   JavaScript never runs the visitor simply gets the page.
 *
 *   It is short. 1.8 seconds, end to end. Long intros are a tax the visitor
 *   pays for somebody else's showreel.
 *
 *   It is skippable. A click, a tap or any key ends it immediately, and it
 *   says so on screen. An animation you cannot escape is a door that sticks.
 *
 *   It plays on every load of the landing page, so every arrival opens the
 *   same way.
 *
 *   It is silent to assistive technology, and absent entirely for anybody who
 *   has asked for less motion - the page's standing policy everywhere else.
 */

/** Must match the wipe finishing in intro.css. */
const RUN_MS = 1800;

/**
 * When the veil starts to lift, and therefore when the hero must begin
 * assembling: two-thirds of the way through `introVeil` in intro.css.
 *
 * These two numbers have to be told apart, and getting them confused is a bug
 * that was in here already. If the page is only told "done" when the overlay
 * unmounts, the curtain rises on a finished hero, and the arrival choreography
 * then blinks it out and rebuilds it - a flicker that reads as a fault rather
 * than as a sequence. The hero has to start moving while the curtain is still
 * on its way up, which is what a curtain is for.
 */
const REVEAL_MS = 1200;

export default function Intro({
  /**
   * Called when the stamp has lifted, or straight away when there is no intro
   * to play. The hero's arrival choreography waits on this, so it must fire in
   * every case - a visitor who skipped the intro, or never had one, still gets
   * the page assembling itself rather than a hero frozen at opacity zero.
   */
  onDone,
}: {
  onDone: () => void;
}) {
  /*
    Decided once, before the first paint, from the initialiser rather than in
    an effect - an effect would run after the overlay had already been painted
    and would flash it at the very people who asked not to see it.
  */
  const [running, setRunning] = useState(
    () => typeof window !== 'undefined' && !prefersReducedMotion(),
  );

  /** Skipping does both jobs at once: release the page, remove the overlay. */
  const finish = useCallback(() => {
    onDone();
    setRunning(false);
  }, [onDone]);

  useEffect(() => {
    if (!running) {
      onDone();
      return;
    }

    // Two moments, not one. The page is released as the curtain starts to lift
    // so the hero assembles behind it; the overlay is removed once the curtain
    // has gone.
    const reveal = window.setTimeout(onDone, REVEAL_MS);
    const end = window.setTimeout(() => setRunning(false), RUN_MS);

    // Any key, anywhere. Escape is the obvious one, but somebody reaching for
    // Tab to start navigating has also told us they are finished watching.
    window.addEventListener('keydown', finish, { once: true });

    return () => {
      window.clearTimeout(reveal);
      window.clearTimeout(end);
      window.removeEventListener('keydown', finish);
    };
  }, [running, onDone, finish]);

  if (!running) return null;

  return (
    <div
      className="intro"
      /* Nothing here is content. The page beneath is the content, and it is
         already there. */
      aria-hidden="true"
      onClick={finish}
    >
      <div className="intro-stage">
        {/*
          The logo flies itself in. The plane, its three trails and each letter
          are separate paths in the artwork, so this is the mark performing what
          it already depicts rather than a picture being faded up - see logo.css.
        */}
        <ApliLogo className="intro-logo" title="Apli.ai" />

        {/* The stamp and its shockwave, wrapped so the rings are centred on
            the stamp itself rather than on the whole stage. */}
        <span className="intro-seal">
          <span className="intro-ring" />
          <span className="intro-ring is-second" />

          {/* The first row of the record. */}
          <span className="intro-stamp">
            <span className="intro-stamp-word">APPLIED</span>
            <span className="intro-stamp-sub">recorded, and not editable</span>
          </span>
        </span>
      </div>

      {/* The brand beam that carries the veil away with it. */}
      <span className="intro-sweep" />

      <p className="intro-skip">Click, or press any key, to skip</p>
    </div>
  );
}
