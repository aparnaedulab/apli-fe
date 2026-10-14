import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { dateText, OFFER_STATUS, offersApi, placeText, stipendText, type StudentOffer } from '../../api/offers';
import Shell, { CompanyTile } from './Shell';

const message = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

/**
 * Internship offers companies made from the student's work, waiting ones
 * first; each one accepted or declined here. Jobs to browse come later.
 */
export default function Jobs() {
  const [offers, setOffers] = useState<StudentOffer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    offersApi
      .mine()
      .then(setOffers)
      .catch((e) => setError(message(e, 'Could not load your offers.')));
  }, []);

  const waiting = offers?.filter((o) => o.status === 'SENT').length ?? 0;

  return (
    <Shell>
      <section className="sa-hero is-short">
        <div className="sa-wrap">
          <p className="sa-eyebrow">Jobs</p>
          <h1>
            Offers that come from <span className="sa-mark">your work</span>
          </h1>
          <p className="sa-lede">
            {waiting
              ? `${waiting} offer${waiting === 1 ? '' : 's'} waiting for your answer.`
              : 'Companies offer internships to students whose work they have seen. Finish a simulation and show it to them.'}
          </p>
        </div>
      </section>
      <div className="sa-wrap sa-body">
        {error && <p className="sa-alert">{error}</p>}
        {!offers && !error && <p className="sa-loading">Loading…</p>}
        {offers && offers.length > 0 && (
          <ul className="of-cards">
            {offers.map((o) => (
              <OfferCard key={o.id} offer={o} onChange={setOffers} />
            ))}
          </ul>
        )}
        {offers && offers.length === 0 && (
          <section className="sa-panel sa-soon">
            <h2>No offers yet</h2>
            <p>
              Companies see your work when you hand a simulation in, share it with them, or send them a test. That is
              where offers come from.
            </p>
            <Link to="/student/simulations" className="sa-btn">
              Find a simulation <span aria-hidden="true">→</span>
            </Link>
          </section>
        )}
      </div>
    </Shell>
  );
}

function OfferCard({ offer: o, onChange }: { offer: StudentOffer; onChange: (o: StudentOffer[]) => void }) {
  const [answering, setAnswering] = useState<'accept' | 'decline' | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const st = OFFER_STATUS[o.status];

  async function answer() {
    if (!answering) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await offersApi.respond(o.id, answering, note.trim() || undefined));
    } catch (e) {
      setError(message(e, 'Could not send your answer.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={`of-card ${o.status === 'SENT' ? 'is-open' : ''}`}>
      <div className="of-card-head">
        <CompanyTile company={{ id: o.company.name, name: o.company.name, logoUrl: o.company.logoUrl }} />
        <div>
          <h2>{o.role}</h2>
          <p>
            {o.company.name}
            {o.simulation && (
              <>
                {' '}
                · from your work on{' '}
                <Link to={`/student/simulations/${o.simulation.slug}`} className="sa-link">
                  {o.simulation.title}
                </Link>
              </>
            )}
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
            {o.startsOn ? `, from ${dateText(o.startsOn)}` : ''}
          </dd>
        </div>
        <div>
          <dt>Stipend</dt>
          <dd>{stipendText(o.stipend)}</dd>
        </div>
        <div>
          <dt>{o.respondedAt ? 'You answered' : 'Reply by'}</dt>
          <dd>{dateText(o.respondedAt ?? o.respondBy)}</dd>
        </div>
      </dl>

      <p className="of-about">{o.about}</p>
      <p className="of-fee">
        <span aria-hidden="true">✓</span> {o.company.name} has promised you pay nothing to take this internship. If anyone
        asks you for money, do not pay - tell Apli.ai.
      </p>

      {o.status === 'SENT' &&
        (answering ? (
          <div className="of-answer">
            <label>
              <span>
                {answering === 'accept' ? 'A note to the company' : 'Tell them why, if you like'} <i>optional</i>
              </span>
              <textarea rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            {error && <p className="sa-alert">{error}</p>}
            <span className="of-answer-actions">
              <button type="button" className={`sa-btn ${answering === 'decline' ? 'is-ghost' : ''}`} disabled={busy} onClick={answer}>
                {busy ? 'Sending…' : answering === 'accept' ? 'Accept the offer' : 'Decline the offer'}
              </button>
              <button type="button" className="sa-quiet" onClick={() => setAnswering(null)} disabled={busy}>
                Back
              </button>
            </span>
          </div>
        ) : (
          <div className="of-answer-actions">
            <button type="button" className="sa-btn" onClick={() => setAnswering('accept')}>
              Accept
            </button>
            <button type="button" className="sa-btn is-ghost" onClick={() => setAnswering('decline')}>
              Decline
            </button>
          </div>
        ))}

      {o.status === 'ACCEPTED' && o.contact && (
        <p className="of-next">
          <b>Next:</b> {o.contact.name} from {o.company.name} will be in touch. You can also write to them at{' '}
          <a href={`mailto:${o.contact.email}`}>{o.contact.email}</a>.
        </p>
      )}
      {o.status === 'LAPSED' && (
        <p className="of-next">The reply date has passed. If you are still interested, write to the company.</p>
      )}
      {o.studentNote && o.status !== 'SENT' && <p className="of-note">You wrote: “{o.studentNote}”</p>}
    </li>
  );
}
