import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import {
  dateText,
  OFFER_STATUS,
  offersApi,
  placeText,
  stipendText,
  WORK_MODE_LABEL,
  type CompanyOffer,
  type WorkMode,
} from '../../api/offers';
import Frame from './Frame';

const message = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

/**
 * "Offer an internship" for one student, opening into a short form in place.
 * Shown only beside students who have shown the company their work - the
 * server checks it again.
 */
export function OfferButton({
  candidateId,
  runId,
  name,
  defaultRole,
}: {
  candidateId: string;
  runId?: string | null;
  name: string;
  defaultRole?: string;
}) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  if (sent) {
    return (
      <p className="of-sent">
        <span aria-hidden="true">✓</span> Offer sent to {name}. Track it under <Link to="/company/offers">Offers</Link>.
      </p>
    );
  }
  return open ? (
    <OfferForm
      candidateId={candidateId}
      runId={runId}
      name={name}
      defaultRole={defaultRole}
      onCancel={() => setOpen(false)}
      onSent={() => setSent(true)}
    />
  ) : (
    <button type="button" className="sa-btn is-small" onClick={() => setOpen(true)}>
      Offer an internship
    </button>
  );
}

function OfferForm({
  candidateId,
  runId,
  name,
  defaultRole,
  onCancel,
  onSent,
}: {
  candidateId: string;
  runId?: string | null;
  name: string;
  defaultRole?: string;
  onCancel: () => void;
  onSent: () => void;
}) {
  const [role, setRole] = useState(defaultRole ?? '');
  const [about, setAbout] = useState('');
  const [workMode, setWorkMode] = useState<WorkMode>('HYBRID');
  const [city, setCity] = useState('');
  const [months, setMonths] = useState('3');
  const [startsOn, setStartsOn] = useState('');
  const [paid, setPaid] = useState(true);
  const [stipend, setStipend] = useState('');
  const [respondBy, setRespondBy] = useState(inDays(7));
  const [noFee, setNoFee] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await offersApi.send({
        candidateId,
        runId: runId ?? null,
        role,
        about,
        workMode,
        city: city || null,
        months: Number(months),
        startsOn: startsOn || null,
        stipend: paid ? Number(stipend || 0) : null,
        respondBy,
        noFee,
      });
      onSent();
    } catch (err) {
      if (err instanceof ApiError && err.fields?.length) setFields(Object.fromEntries(err.fields.map((f) => [f.path, f.message])));
      else setError(message(err, 'Could not send the offer.'));
    } finally {
      setBusy(false);
    }
  }

  const err = (k: string) => (fields[k] ? <em>{fields[k]}</em> : null);

  return (
    <form className="of-form" onSubmit={submit}>
      <h3>Offer {name} an internship</h3>
      <label className="of-wide">
        <span>Role</span>
        <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Finance intern" maxLength={120} />
        {err('role')}
      </label>
      <label className="of-wide">
        <span>What they will do</span>
        <textarea
          rows={4}
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          placeholder="The work, who they will work with, and what they will learn."
          maxLength={4000}
        />
        {err('about')}
      </label>
      <fieldset className="of-modes">
        <legend>Where</legend>
        {(Object.keys(WORK_MODE_LABEL) as WorkMode[]).map((m) => (
          <label key={m} className={workMode === m ? 'is-on' : ''}>
            <input type="radio" name="workMode" checked={workMode === m} onChange={() => setWorkMode(m)} />
            {WORK_MODE_LABEL[m]}
          </label>
        ))}
      </fieldset>
      <label>
        <span>City {workMode === 'REMOTE' && <i>optional</i>}</span>
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Pune" maxLength={80} />
        {err('city')}
      </label>
      <label>
        <span>How long</span>
        <select value={months} onChange={(e) => setMonths(e.target.value)}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} month{n === 1 ? '' : 's'}
            </option>
          ))}
        </select>
        {err('months')}
      </label>
      <label>
        <span>
          Starts on <i>optional</i>
        </span>
        <input type="date" value={startsOn} min={respondBy} onChange={(e) => setStartsOn(e.target.value)} />
        {err('startsOn')}
      </label>
      <label>
        <span>Reply by</span>
        <input type="date" value={respondBy} min={inDays(0)} onChange={(e) => setRespondBy(e.target.value)} />
        {err('respondBy')}
      </label>
      <div className="of-pay">
        <label className="of-check">
          <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
          It is paid
        </label>
        {paid && (
          <label>
            <span>Stipend, ₹ a month</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={stipend}
              onChange={(e) => setStipend(e.target.value)}
              placeholder="e.g. 15000"
            />
            {err('stipend')}
          </label>
        )}
      </div>
      <label className="of-check of-wide of-promise">
        <input type="checkbox" checked={noFee} onChange={(e) => setNoFee(e.target.checked)} />
        <span>
          <b>We will not charge {name} any fee</b> - for training, a deposit, a certificate or anything else - to take
          this internship.
        </span>
      </label>
      {err('noFee')}
      {error && <p className="sa-alert of-wide">{error}</p>}
      <div className="of-actions of-wide">
        <button type="submit" className="sa-btn" disabled={busy || !noFee}>
          {busy ? 'Sending…' : 'Send the offer'}
        </button>
        <button type="button" className="sa-quiet" onClick={onCancel}>
          Cancel
        </button>
        <small>{name} sees it in their app and can accept or decline. You can withdraw it until they answer.</small>
      </div>
    </form>
  );
}

/** Every internship the company has offered, and where each stands. */
export function CompanyOffers() {
  const [offers, setOffers] = useState<CompanyOffer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    offersApi
      .company()
      .then(setOffers)
      .catch((e) => setError(message(e, 'Could not load your offers.')));
  }, []);

  async function withdraw(id: string) {
    setBusy(id);
    setError(null);
    try {
      setOffers(await offersApi.withdraw(id));
    } catch (e) {
      setError(message(e, 'Could not withdraw it.'));
    } finally {
      setBusy(null);
    }
  }

  const counts = offers
    ? {
        waiting: offers.filter((o) => o.status === 'SENT').length,
        accepted: offers.filter((o) => o.status === 'ACCEPTED').length,
      }
    : null;

  return (
    <Frame>
      <section className="sa-hero is-short">
        <div className="sa-wrap">
          <p className="sa-eyebrow">Offers</p>
          <h1>
            Internships you <span className="sa-mark">offered</span>
          </h1>
          <p className="sa-lede">
            Offer one from a student's work - under Students' work, Shared with you, or a simulation's analytics.
            {counts ? ` ${counts.waiting} waiting for an answer, ${counts.accepted} accepted.` : ''}
          </p>
        </div>
      </section>
      <div className="sa-wrap sa-body">
        {error && <p className="sa-alert">{error}</p>}
        {!offers && !error && <p className="sa-loading">Loading…</p>}
        {offers && offers.length === 0 && (
          <p className="sa-empty">
            No offers yet. When a student shows you work you like, open their work and press Offer an internship.
          </p>
        )}
        {offers && offers.length > 0 && (
          <ul className="of-list">
            {offers.map((o) => {
              const st = OFFER_STATUS[o.status];
              return (
                <li key={o.id}>
                  <div className="of-list-head">
                    <div>
                      <h2>{o.role}</h2>
                      <p>
                        To <b>{o.student.name}</b>
                        {o.student.college ? ` · ${o.student.college}` : ''}
                        {o.simulation ? ` · from their work on ${o.simulation.title}` : ''}
                      </p>
                    </div>
                    <span className={`sa-status ${st.tone}`}>{st.label}</span>
                  </div>
                  <dl className="sa-facts">
                    <div>
                      <dt>Where</dt>
                      <dd>{placeText(o)}</dd>
                    </div>
                    <div>
                      <dt>How long</dt>
                      <dd>
                        {o.months} month{o.months === 1 ? '' : 's'}
                        {o.startsOn ? ` from ${dateText(o.startsOn)}` : ''}
                      </dd>
                    </div>
                    <div>
                      <dt>Stipend</dt>
                      <dd>{stipendText(o.stipend)}</dd>
                    </div>
                    <div>
                      <dt>{o.respondedAt ? 'Answered' : 'Reply by'}</dt>
                      <dd>{dateText(o.respondedAt ?? o.respondBy)}</dd>
                    </div>
                  </dl>
                  {o.studentNote && <p className="of-note">“{o.studentNote}”</p>}
                  <p className="ca-contact">
                    <a href={`mailto:${o.student.email}`}>{o.student.email}</a>
                    {o.student.phone && <span>{o.student.phone}</span>}
                    <span>
                      Sent by {o.sentBy} on {dateText(o.createdAt)}
                    </span>
                  </p>
                  {o.status === 'SENT' && (
                    <button type="button" className="sa-quiet" disabled={busy === o.id} onClick={() => withdraw(o.id)}>
                      {busy === o.id ? 'Withdrawing…' : 'Withdraw the offer'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Frame>
  );
}
