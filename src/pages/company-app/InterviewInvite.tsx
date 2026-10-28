import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { companyInviteApi, INVITE_STATUS, roundIcon, type CompanyInvite } from '../../api/interviewInvites';
import Frame from './Frame';
import { OfferButton } from './Offers';
import './interviews.css';

const msg = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);
const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const OUTCOME: Record<string, { label: string; tone: string }> = {
  PASSED: { label: 'Passed', tone: 'is-verified' },
  FAILED: { label: 'Did not pass', tone: 'is-changes' },
  SKIPPED: { label: 'Skipped', tone: '' },
};

/**
 * One student going through one of the company's interview processes: every
 * round with where they are, their recorded answers, and the company's
 * verdict on the round they are in.
 */
export default function CompanyInterviewInvite() {
  const { inviteId = '' } = useParams();
  const [inv, setInv] = useState<CompanyInvite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    companyInviteApi
      .get(inviteId)
      .then(setInv)
      .catch((e) => setError(msg(e, 'Could not load this invite.')));
  }, [inviteId]);

  async function withdraw() {
    if (!inv) return;
    setBusy(true);
    setError(null);
    try {
      await companyInviteApi.withdraw(inv.id);
      setInv(await companyInviteApi.get(inv.id));
    } catch (e) {
      setError(msg(e, 'Could not withdraw it.'));
    } finally {
      setBusy(false);
    }
  }

  if (!inv) {
    return (
      <Frame>
        <div className="sa-wrap sa-body">
          {error ? <p className="sa-alert">{error}</p> : <p className="sa-loading">Loading…</p>}
        </div>
      </Frame>
    );
  }

  const st = INVITE_STATUS[inv.status];
  const total = inv.process.rounds.length;
  const verdict = new Map(inv.roundFeedbacks.map((f) => [f.roundOrder, f]));

  return (
    <Frame>
      <section className="sa-hero is-short">
        <div className="sa-wrap">
          <p className="sa-eyebrow">
            <Link to="/company/interviews" className="sa-link">
              Interviews
            </Link>{' '}
            · {inv.process.title}
          </p>
          <div className="iv-head">
            <h1>{inv.candidate.name}</h1>
            <span className={`sa-status ${st.tone}`}>{st.label}</span>
          </div>
          <p className="sa-lede">
            {inv.role}
            {inv.candidate.college ? ` · ${inv.candidate.college}` : ''}
            {inv.candidate.course ? ` · ${inv.candidate.course}` : ''}
          </p>
          <p className="ca-contact">
            <a href={`mailto:${inv.candidate.email}`}>{inv.candidate.email}</a>
            {inv.candidate.phone && <span>{inv.candidate.phone}</span>}
            <span>
              Invited {day(inv.createdAt)}
              {inv.sentBy ? ` by ${inv.sentBy}` : ''}
              {inv.respondedAt ? ` · answered ${day(inv.respondedAt)}` : ''}
            </span>
          </p>
        </div>
      </section>

      <div className="sa-wrap sa-body">
        {error && <p className="sa-alert">{error}</p>}
        {inv.status === 'PENDING' && (
          <p className="iv-note">Waiting for {inv.candidate.name} to accept. You can give verdicts once they do.</p>
        )}
        {inv.status === 'OFFERED' && (
          <div className="iv-note is-good">
            <span>
              <b>{inv.candidate.name} cleared every round.</b> Offer them the internship when you are ready.
            </span>
            <OfferButton candidateId={inv.candidate.id} name={inv.candidate.name} defaultRole={inv.role} />
          </div>
        )}

        <ol className="iv-rounds">
          {inv.process.rounds.map((r) => {
            const v = verdict.get(r.order);
            const current = inv.status === 'ACCEPTED' && r.order === inv.currentRoundOrder;
            const state = v ? OUTCOME[v.outcome] : current ? { label: 'In this round', tone: 'is-working' } : null;
            return (
              <li key={r.order} className={`iv-round ${current ? 'is-current' : ''} ${v ? 'is-done' : ''}`}>
                <div className="iv-round-head">
                  <span className="iv-round-icon" aria-hidden="true">
                    {roundIcon(r.type)}
                  </span>
                  <div>
                    <h2>
                      Round {r.order} of {total}: {r.name}
                    </h2>
                    <p>
                      {r.typeLabel}
                      {r.durationMin ? ` · ${r.durationMin} min` : ''}
                      {r.isElimination ? ' · eliminating' : ''}
                    </p>
                  </div>
                  {state && <span className={`sa-status ${state.tone}`}>{state.label}</span>}
                </div>

                {r.questions.length > 0 && (inv.status !== 'PENDING' || v) && (
                  <ol className="iv-answers">
                    {r.questions.map((q, k) => (
                      <li key={q.id}>
                        <p>
                          <b>{k + 1}.</b> {q.text}
                        </p>
                        {q.answer ? (
                          <>
                            <video src={q.answer.fileUrl} controls preload="metadata" className="iv-video" />
                            <small>
                              {q.answer.seconds ? `${q.answer.seconds} s · ` : ''}recorded {day(q.answer.at)}
                            </small>
                          </>
                        ) : (
                          <small className="iv-muted">Not recorded yet.</small>
                        )}
                      </li>
                    ))}
                  </ol>
                )}

                {v && (v.score !== null || v.notes) && (
                  <p className="iv-verdict-note">
                    {v.score !== null && <b>Score {v.score}/100. </b>}
                    {v.notes}
                  </p>
                )}

                {current && <Verdict inv={inv} round={r} onSaved={setInv} />}
              </li>
            );
          })}
        </ol>

        {(inv.status === 'PENDING' || inv.status === 'ACCEPTED') && (
          <button type="button" className="sa-quiet" disabled={busy} onClick={() => void withdraw()}>
            {busy ? 'Withdrawing…' : 'Withdraw the invite'}
          </button>
        )}
      </div>
    </Frame>
  );
}

/** The company's verdict on the round the student is in. */
function Verdict({
  inv,
  round,
  onSaved,
}: {
  inv: CompanyInvite;
  round: CompanyInvite['process']['rounds'][number];
  onSaved: (i: CompanyInvite) => void;
}) {
  const [outcome, setOutcome] = useState<'PASSED' | 'FAILED' | 'SKIPPED' | null>(null);
  const [score, setScore] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const last = round.order === inv.process.rounds.length;
  const waitingOnVideo = round.questions.length > 0 && round.questions.some((q) => !q.answer);

  async function save() {
    if (!outcome) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(
        await companyInviteApi.feedback(inv.id, {
          roundOrder: round.order,
          outcome,
          score: score === '' ? undefined : Number(score),
          notes: notes.trim() || undefined,
        }),
      );
    } catch (e) {
      setError(msg(e, 'Could not save your verdict.'));
    } finally {
      setBusy(false);
    }
  }

  const next =
    outcome === 'FAILED'
      ? round.isElimination
        ? 'This round eliminates: the interview ends here for them.'
        : 'This round does not eliminate: they still go on to the next one.'
      : outcome
        ? last
          ? 'That was the last round: they will have cleared every round.'
          : `They move on to round ${round.order + 1}.`
        : null;

  return (
    <div className="iv-verdict">
      <h3>Your verdict on this round</h3>
      {waitingOnVideo && <p className="iv-muted">They have not recorded every answer yet. You can still decide.</p>}
      <div className="iv-outcomes" role="radiogroup" aria-label="Verdict">
        {(['PASSED', 'FAILED', 'SKIPPED'] as const).map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={outcome === o}
            className={`iv-outcome ${outcome === o ? 'is-on' : ''} is-${o.toLowerCase()}`}
            onClick={() => setOutcome(o)}
          >
            {o === 'PASSED' ? 'Passed' : o === 'FAILED' ? 'Did not pass' : 'Skip this round'}
          </button>
        ))}
      </div>
      <div className="iv-verdict-fields">
        <label>
          <span>
            Score <i>optional, out of 100</i>
          </span>
          <input type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} />
        </label>
        <label className="is-wide">
          <span>
            Notes <i>only your team sees these</i>
          </span>
          <textarea rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
      {next && <p className="iv-muted">{next} The student is told the verdict, not your score or notes.</p>}
      {error && <p className="sa-alert">{error}</p>}
      <button type="button" className="sa-btn" disabled={!outcome || busy} onClick={() => void save()}>
        {busy ? 'Saving…' : 'Save the verdict'}
      </button>
    </div>
  );
}
