import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../../lib/useReveal';

/**
 * The number, taken apart.
 *
 * Campus hiring runs on one figure that is not true. "12 LPA" is what a
 * student repeats to their family, and what arrives in their account is a
 * little over half of it. Every part of that gap is legal, disclosed
 * somewhere, and almost never explained before somebody accepts.
 *
 * So this is the one thing on the page a visitor operates rather than reads.
 * The slider is the whole argument: drag the variable pay down to what last
 * year's batch actually received, and watch the headline figure stop being
 * the headline figure. Nobody argues with a number they moved themselves.
 *
 * Demo values. A made-up offer, arithmetic that is real.
 */

/** A fictional offer, in rupees per year. */
const FIXED = 900_000;
const VARIABLE = 300_000;
const JOINING_BONUS = 50_000;

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const lakhs = (n: number) => `₹${(n / 100_000).toFixed(1).replace(/\.0$/, '')} LPA`;

/**
 * Take-home, roughly: the new regime's slabs on the fixed part, employee
 * provident fund at 12% of a notional basic, and professional tax.
 *
 * It is an estimate and the component says so - the point is the shape of the
 * gap, not a payslip.
 */
function inHandMonthly(fixedAnnual: number) {
  const taxable = Math.max(0, fixedAnnual - 75_000); // standard deduction
  let tax = 0;
  const slabs: [number, number][] = [
    [400_000, 0],
    [800_000, 0.05],
    [1_200_000, 0.1],
    [1_600_000, 0.15],
  ];
  let last = 0;
  for (const [ceiling, rate] of slabs) {
    if (taxable > last) tax += (Math.min(taxable, ceiling) - last) * rate;
    last = ceiling;
  }
  if (taxable > last) tax += (taxable - last) * 0.2;
  // A rebate wipes out the tax on modest incomes; below the threshold there is
  // nothing to deduct.
  if (taxable <= 1_200_000) tax = 0;

  const epf = fixedAnnual * 0.5 * 0.12; // 12% of a basic taken as half of fixed
  const professionalTax = 2_500;
  return (fixedAnnual - tax - epf - professionalTax) / 12;
}

/** Counts a number towards its target, or jumps there for reduced motion. */
function useCounted(target: number) {
  const [shown, setShown] = useState(target);
  const frame = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(target);
      return;
    }
    const from = shown;
    const started = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / 420);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(from + (target - from) * eased);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
    // `shown` is deliberately not a dependency: it is the starting point of
    // each run, not a trigger for another one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return shown;
}

export default function OfferTruth() {
  /** How much of the variable pay actually lands, as the student sets it. */
  const [payout, setPayout] = useState(100);
  const variable = (VARIABLE * payout) / 100;
  const ctc = FIXED + VARIABLE + JOINING_BONUS;
  const real = FIXED + variable + JOINING_BONUS;
  const monthly = inHandMonthly(FIXED);

  const shownCtc = useCounted(real);
  const shownMonthly = useCounted(monthly);

  const touched = payout !== 100;

  return (
    <div className="ot">
      <div className="ot-head">
        <div>
          <p className="ot-role">Software Engineer · Zenith Labs</p>
          <p className="ot-claim">
            The poster said <strong>{lakhs(ctc)}</strong>
          </p>
        </div>
        <span className="pill pill-hold">Sample offer</span>
      </div>

      <div className="ot-bar" aria-hidden="true">
        <span className="ot-seg is-fixed" style={{ flexGrow: FIXED }}>
          <b>Fixed</b>
        </span>
        <span className="ot-seg is-var" style={{ flexGrow: Math.max(variable, 1) }}>
          <b>{payout > 12 ? 'Variable' : ''}</b>
        </span>
        <span className="ot-seg is-gone" style={{ flexGrow: Math.max(VARIABLE - variable, 0.0001) }} />
        <span className="ot-seg is-bonus" style={{ flexGrow: JOINING_BONUS }} />
      </div>

      <label className="ot-slider">
        <span className="ot-slider-label">
          How much of the variable pay does a first-year actually receive?
          <b>{payout}%</b>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={payout}
          onChange={(e) => setPayout(Number(e.target.value))}
          aria-label="Share of variable pay actually received"
        />
        <span className="ot-slider-ends" aria-hidden="true">
          <i>None of it</i>
          <i>All of it</i>
        </span>
      </label>

      <dl className="ot-rows">
        <div>
          <dt>Fixed, whatever happens</dt>
          <dd>{rupees(FIXED)}</dd>
        </div>
        <div className={touched ? 'is-cut' : ''}>
          <dt>
            Variable <small>up to {rupees(VARIABLE)}</small>
          </dt>
          <dd>{rupees(variable)}</dd>
        </div>
        <div>
          <dt>
            Joining bonus <small>once</small>
          </dt>
          <dd>{rupees(JOINING_BONUS)}</dd>
        </div>
      </dl>

      <div className="ot-out">
        <div>
          <p className="ot-out-label">What the year is really worth</p>
          <p className="ot-out-big">{lakhs(shownCtc)}</p>
          {touched && (
            <p className="ot-out-note">
              {lakhs(ctc - real)} of the headline was a maybe.
            </p>
          )}
        </div>
        <div>
          <p className="ot-out-label">What arrives each month</p>
          <p className="ot-out-big is-hand">≈ {rupees(shownMonthly)}</p>
          <p className="ot-out-note">After tax, provident fund and professional tax.</p>
        </div>
      </div>

      <p className="ot-foot">
        Apli.ai shows this split on every role <strong>before a student applies</strong>, with the
        working behind the monthly figure. An estimate, and it says so - but nobody finds out at the
        first payslip.
      </p>
    </div>
  );
}
