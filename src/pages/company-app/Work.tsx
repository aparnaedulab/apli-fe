import { useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { companyAppApi, type SentTest, type SharedWork } from '../../api/companyApp';
import type { ReviewItem } from '../../api/studentApp';
import Frame from './Frame';
import { OfferButton } from './Offers';

const message = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

/**
 * Students' work on the company's simulations, waiting for its decision.
 * Approving issues a verified certificate; asking for changes sends it back
 * with a note, so the student knows what to fix.
 */
export function CompanyReviews() {
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    companyAppApi
      .reviews()
      .then(setItems)
      .catch((e) => setError(message(e, 'Could not load the work.')));
  }, []);

  return (
    <Frame>
      <section className="sa-hero is-short">
        <div className="sa-wrap">
          <p className="sa-eyebrow">Students' work</p>
          <h1>
            Read it, <span className="sa-mark">decide</span>
          </h1>
          <p className="sa-lede">
            Every task they handed in and how they explain it. Approve to issue a verified certificate, or send it back with a
            note.
          </p>
        </div>
      </section>
      <div className="sa-wrap sa-body">
        {error && <p className="sa-alert">{error}</p>}
        {!items && !error && <p className="sa-loading">Loading…</p>}
        {items && items.length === 0 && (
          <p className="sa-empty">Nothing waiting. When students hand in work on your simulations, it appears here.</p>
        )}
        {items && items.length > 0 && (
          <ul className="ca-reviews">
            {items.map((r) => (
              <ReviewCard key={r.runId} item={r} onDone={setItems} />
            ))}
          </ul>
        )}
      </div>
    </Frame>
  );
}

function ReviewCard({ item: r, onDone }: { item: ReviewItem; onDone: (next: ReviewItem[]) => void }) {
  const [note, setNote] = useState('');
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: 'approve' | 'changes') {
    setBusy(true);
    setError(null);
    try {
      onDone(await companyAppApi.decide(r.runId, decision, note.trim() || undefined));
    } catch (e) {
      setError(message(e, 'Could not save the decision.'));
      setBusy(false);
    }
  }

  return (
    <li className="ca-review">
      <header>
        <div>
          <h2>{r.simulation.title}</h2>
          <p className="sa-panel-empty">Sent {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString('en-IN') : ''}</p>
        </div>
        <div className="ca-review-who">
          <b>{r.student.name}</b>
          {r.student.college && <span>{r.student.college}</span>}
        </div>
      </header>

      <ol className="ca-review-tasks">
        {r.tasks.map((t) => (
          <li key={t.id}>
            <h3>
              {t.position}. {t.title}
            </h3>
            {t.handIn && <p className="ca-review-ask">Asked for: {t.handIn}</p>}
            {t.checks.length > 0 && (
              <p className="ca-review-ask">
                Quick checks:{' '}
                {t.checks.map((c) => `${c.title} ${c.score === null ? 'not answered' : c.total ? `${c.score}/${c.total}` : 'written'}`).join(' · ')}
              </p>
            )}
            {t.checks.flatMap((c) => c.written).filter((w) => w.answer).map((w, i) => (
              <div key={i} className="ca-written">
                <b>{w.prompt}</b>
                <p>{w.answer}</p>
              </div>
            ))}
            {t.answer && <p className="ca-review-answer">{t.answer}</p>}
            {t.link && (
              <a href={t.link} target="_blank" rel="noreferrer" className="sa-link is-small">
                {t.link} ↗
              </a>
            )}
            {t.fileUrl && (
              <a href={t.fileUrl} target="_blank" rel="noreferrer" className="sa-link is-small">
                File: {t.fileName ?? 'attached'} ↗
              </a>
            )}
          </li>
        ))}
      </ol>

      <div className="ca-review-explain">
        <h3>How they went about it</h3>
        <p>{r.explainHow}</p>
        <h3>What they would do differently</h3>
        <p>{r.explainChange}</p>
      </div>

      {error && <p className="sa-alert">{error}</p>}
      {asking ? (
        <div className="ca-review-ask-box">
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What needs changing, and in which task. The student sees this exactly."
            autoFocus
          />
          <div className="ca-review-actions">
            <button type="button" className="sa-btn is-ghost" onClick={() => setAsking(false)} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="sa-btn" onClick={() => decide('changes')} disabled={busy || !note.trim()}>
              Send back to the student
            </button>
          </div>
        </div>
      ) : (
        <div className="ca-review-actions">
          <OfferButton candidateId={r.student.id} runId={r.runId} name={r.student.name} />
          <button type="button" className="sa-btn is-ghost" onClick={() => setAsking(true)} disabled={busy}>
            Ask for changes
          </button>
          <button type="button" className="sa-btn" onClick={() => decide('approve')} disabled={busy}>
            {busy ? 'Saving…' : 'Approve and issue certificate'}
          </button>
        </div>
      )}
    </li>
  );
}

/**
 * Students who chose to show the company their verified work: who they are,
 * how to reach them, and the work itself. Only while they keep it shared.
 */
export function CompanyShared() {
  const [items, setItems] = useState<SharedWork[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const [tests, setTests] = useState<SentTest[] | null>(null);

  useEffect(() => {
    companyAppApi
      .shared()
      .then(setItems)
      .catch((e) => setError(message(e, 'Could not load the shared work.')));
    companyAppApi
      .tests()
      .then(setTests)
      .catch((e) => setError(message(e, 'Could not load the tests sent to you.')));
  }, []);

  return (
    <Frame>
      <section className="sa-hero is-short">
        <div className="sa-wrap">
          <p className="sa-eyebrow">Shared with you</p>
          <h1>
            Students who <span className="sa-mark">chose you</span>
          </h1>
          <p className="sa-lede">
            Verified work students decided to show your company. They can take it back at any time, so reach out while it is
            here.
          </p>
        </div>
      </section>
      <div className="sa-wrap sa-body">
        {error && <p className="sa-alert">{error}</p>}
        {tests && tests.length > 0 && <SentTests tests={tests} />}
        {!items && !error && <p className="sa-loading">Loading…</p>}
        {items && items.length > 0 && tests && tests.length > 0 && <h2 className="ca-section-title">Finished simulations</h2>}
        {items && items.length === 0 && (tests?.length ?? 0) === 0 && (
          <p className="sa-empty">
            No one has shared work with you yet. Students choose to, company by company, once a simulation is approved.
          </p>
        )}
        {items && items.length > 0 && (
          <ul className="ca-shared">
            {items.map((w) => {
              const isOpen = open === w.runId;
              return (
                <li key={w.runId}>
                  <div className="ca-shared-head">
                    <div>
                      <h2>{w.student.name}</h2>
                      <p>
                        {[w.student.college, w.student.course, w.student.batch].filter(Boolean).join(' · ') || 'Student'}
                      </p>
                    </div>
                    <span className="sa-status is-verified">Verified</span>
                  </div>
                  <dl className="sa-facts">
                    <div>
                      <dt>Simulation</dt>
                      <dd>{w.simulation.title}</dd>
                    </div>
                    <div>
                      <dt>CGPA</dt>
                      <dd>{w.student.cgpa ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>City</dt>
                      <dd>{w.student.city ?? '—'}</dd>
                    </div>
                  </dl>
                  <p className="ca-contact">
                    <a href={`mailto:${w.student.email}`}>{w.student.email}</a>
                    {w.student.phone && <span>{w.student.phone}</span>}
                    {w.certificateCode && (
                      <a href={`/certificates/${w.certificateCode}`} target="_blank" rel="noreferrer">
                        Certificate {w.certificateCode} ↗
                      </a>
                    )}
                  </p>
                  <div className="of-row">
                    <button type="button" className="sa-quiet" onClick={() => setOpen(isOpen ? null : w.runId)}>
                      {isOpen ? 'Hide their work' : 'See their work'}
                    </button>
                    <OfferButton candidateId={w.student.id} runId={w.runId} name={w.student.name} />
                  </div>
                  {isOpen && (
                    <div className="ca-shared-work">
                      {w.tasks.map((t, i) => (
                        <div key={i}>
                          <h3>
                            {i + 1}. {t.title}
                          </h3>
                          {t.answer && <p>{t.answer}</p>}
                          {t.link && (
                            <a href={t.link} target="_blank" rel="noreferrer" className="sa-link is-small">
                              {t.link} ↗
                            </a>
                          )}
                          {t.fileUrl && (
                            <a href={t.fileUrl} target="_blank" rel="noreferrer" className="sa-link is-small">
                              File: {t.fileName ?? 'attached'} ↗
                            </a>
                          )}
                        </div>
                      ))}
                      <div className="ca-review-explain">
                        <h3>How they went about it</h3>
                        <p>{w.explainHow}</p>
                        <h3>What they would do differently</h3>
                        <p>{w.explainChange}</p>
                      </div>
                    </div>
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

const when = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Tries at tests students sent from the company's simulations: the score,
 * which try it was, and every answer beside the right one.
 */
function SentTests({ tests }: { tests: SentTest[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <h2 className="ca-section-title">Tests sent to you</h2>
      <ul className="ca-shared ca-tests">
        {tests.map((t) => {
          const isOpen = open === t.id;
          const graded = t.total > 0;
          return (
            <li key={t.id}>
              <div className="ca-shared-head">
                <div>
                  <h2>{t.student.name}</h2>
                  <p>{[t.student.college, t.student.course, t.student.batch].filter(Boolean).join(' · ') || 'Student'}</p>
                </div>
                <span className={`ca-test-score ${graded && t.score === t.total ? 'is-full' : ''}`}>
                  {graded ? `${t.score} of ${t.total} right` : 'Written answers'}
                </span>
              </div>
              <dl className="sa-facts">
                <div>
                  <dt>Test</dt>
                  <dd>{t.test}</dd>
                </div>
                <div>
                  <dt>Task</dt>
                  <dd>
                    {t.task} · {t.simulation}
                  </dd>
                </div>
                <div>
                  <dt>Try</dt>
                  <dd>
                    {t.attempt} of {t.tries}
                    {t.attempt === 1 ? ' (first try)' : ''}
                  </dd>
                </div>
                <div>
                  <dt>Sent</dt>
                  <dd>{when(t.sentAt)}</dd>
                </div>
              </dl>
              <p className="ca-contact">
                <a href={`mailto:${t.student.email}`}>{t.student.email}</a>
                {t.student.phone && <span>{t.student.phone}</span>}
              </p>
              <div className="of-row">
                <button type="button" className="sa-quiet" onClick={() => setOpen(isOpen ? null : t.id)}>
                  {isOpen ? 'Hide their answers' : 'See their answers'}
                </button>
                <OfferButton candidateId={t.student.id} runId={t.runId} name={t.student.name} />
              </div>
              {isOpen && (
                <ol className="ca-test-answers">
                  {t.questions.map((q, i) => (
                    <li
                      key={i}
                      className={q.correct === null ? 'is-written' : q.correct ? 'is-right' : 'is-wrong'}
                    >
                      <p className="ca-test-q">
                        <b>{i + 1}.</b> {q.prompt}
                        <span>{q.correct === null ? 'For you to judge' : q.correct ? 'Right' : 'Not right'}</span>
                      </p>
                      {q.kind === 'text' ? (
                        <p className="ca-test-written">{q.answer[0] || 'No answer.'}</p>
                      ) : (
                        <div className="ca-test-cols">
                          <div>
                            <h4>Their answer</h4>
                            <AnswerList kind={q.kind} items={q.answer} />
                          </div>
                          {!q.correct && (
                            <div>
                              <h4>Right answer</h4>
                              <AnswerList kind={q.kind} items={q.right} />
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** An order is numbered; anything else is a plain list. */
export function AnswerList({ kind, items }: { kind: SentTest['questions'][number]['kind']; items: string[] }) {
  if (!items.length) return <p className="ca-test-none">Nothing given.</p>;
  return kind === 'order' ? (
    <ol>
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ol>
  ) : (
    <ul>
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  );
}
