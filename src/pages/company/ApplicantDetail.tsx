import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import CompanyLayout from './CompanyLayout';
import { applicantApi, STATUS_PILL, type ApplicantDetail as Detail } from '../../api/applications';
import { ApiError } from '../../api/client';
import { trackerApi, type TrackedApplication } from '../../api/tracker';
import { WaitingNote } from '../../components/TrackerView';
import { proofApi, type ApplicantRoundSimulation, type EnrolmentStatus, type Passport } from '../../api/proof';
import AfterOfferPanel from './AfterOfferPanel';
import './JobEditor.css';
import './ApplicantDetail.css';

/** A link's host, for one the student never got round to labelling. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** The status as a recruiter would say it out loud. */
const STATUS_SAID: Record<string, string> = {
  APPLIED: 'Applied — nobody has opened it',
  UNDER_REVIEW: 'Being reviewed by you',
  SHORTLISTED: 'Shortlisted — not yet called to a round',
  IN_ROUND: 'In a round',
  WAITLISTED: 'Waitlisted',
  OFFERED: 'Offered — waiting on them',
  ACCEPTED: 'They accepted',
  HIRED: 'Hired',
  DECLINED: 'They declined',
  REJECTED: 'Not taken forward',
  WITHDRAWN: 'Withdrawn',
};

/** An applicant's simulation work, as the recruiter needs to read it. */
const SIM_STATUS: Record<EnrolmentStatus, string> = {
  IN_PROGRESS: 'Working on it',
  NEEDS_WORK: 'Sent back for changes',
  SUBMITTED: 'Submitted - waiting for your review',
  EXPLAIN_BOOKED: 'Explain-your-work call booked',
  COMPLETED: 'Completed',
};

export default function ApplicantDetail() {
  const { id = '' } = useParams();
  const [a, setA] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [tracked, setTracked] = useState<TrackedApplication | null>(null);
  const [passport, setPassport] = useState<Passport | null>(null);
  const [simRounds, setSimRounds] = useState<ApplicantRoundSimulation[]>([]);

  const refresh = useCallback(async () => {
    try {
      const detail = await applicantApi.get(id);
      setA(detail);
      setError(null);
      // What others have vouched for, beside what the student wrote. Loaded
      // quietly: if it fails, the rest of the page is unaffected.
      proofApi.applicantPassport(detail.candidate.id).then(setPassport).catch(() => setPassport(null));
      // The shared tracker picture - stages, the wait, the history. Loaded
      // alongside, never in the way: if it fails the page still works.
      trackerApi.companyApplication(id).then(setTracked).catch(() => setTracked(null));
      // Work-simulation rounds and how far this applicant has got in each.
      proofApi.applicantRounds(id).then(setSimRounds).catch(() => setSimRounds([]));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this applicant.');
    }
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function act(fn: () => Promise<unknown>, message?: string) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      if (message) {
        setFlash(message);
        window.setTimeout(() => setFlash(null), 3000);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  if (error && !a) {
    return (
      <CompanyLayout>
        <p className="alert alert-error">{error}</p>
        <p className="crumb">
          <Link to="/company/applicants">← All applicants</Link>
        </p>
      </CompanyLayout>
    );
  }

  if (!a) {
    return (
      <CompanyLayout>
        <p className="muted">Loading…</p>
      </CompanyLayout>
    );
  }

  const c = a.candidate;
  const currentOrder = a.currentRound?.order ?? 0;
  const isLastRound = currentOrder > 0 && currentOrder === a.rounds.length;

  /*
   * The passport, split into the half that is new and the half that is not.
   *
   * Everything a student says about themselves is already written out below
   * with its dates and links, so repeating it under a "self-reported" heading
   * told a recruiter nothing and cost them a second read of the same list.
   * What no other section knows is who stands behind a claim.
   */
  const vouched = (passport?.claims ?? []).filter((v) => v.evidence !== 'SELF_REPORTED');

  /** Skills an employer watched them use, by name, for the tick on the chip. */
  const shownIn = new Map<string, string>();
  for (const v of passport?.claims ?? []) {
    if (v.kind === 'SKILL' && v.evidence === 'EMPLOYER_VERIFIED') {
      shownIn.set(v.label.toLowerCase(), v.source);
    }
  }

  return (
    <CompanyLayout>
      <p className="crumb">
        <Link to="/company/applicants">← All applicants</Link>
      </p>

      <header className="page-head">
        <div>
          <p className="eyebrow">{a.job.title}</p>
          <h1>{c.name}</h1>
          {c.headline && <p className="ad-headline">{c.headline}</p>}
          <p className="page-lede">
            {[
              c.collegeName,
              c.course ?? c.batch?.course,
              c.specialisation,
              c.batch?.name,
              c.batch?.rollNo,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {/*
            How to reach them, which was being fetched and thrown away. A
            recruiter who has decided to talk to somebody should not have to
            open the resume to find a phone number.
          */}
          <p className="ad-reach">
            <a href={`mailto:${c.email}`}>{c.email}</a>
            {c.phone && (
              <>
                {' · '}
                <a href={`tel:${c.phone}`}>{c.phone}</a>
              </>
            )}
            {c.prn && <span className="ad-prn">PRN {c.prn}</span>}
          </p>
        </div>
        <span className={`pill ad-pill ${STATUS_PILL[a.status]}`}>
          {a.status.replace(/_/g, ' ')}
        </span>
      </header>

      {error && <p className="alert alert-error">{error}</p>}
      {flash && <p className="alert alert-ok">{flash}</p>}

      {/*
        Reading on the left, deciding on the right.

        The record is long - marks, education, four jobs, six projects - and
        with the buttons stacked on top of it a recruiter had to scroll back
        up to act on what they had just read, or worse, decide from the top
        of the page without reading. The rail follows the scroll, so the
        decision is always one movement away from the evidence for it.
      */}
      <div className="ad-split">
        <aside className="ad-rail">
          <div className="ad-rail-in">
            <Decide
              a={a}
              busy={busy}
              isLastRound={isLastRound}
              onAct={act}
              waiting={
                tracked ? (
                  <WaitingNote
                    waiting={tracked.waiting}
                    company={tracked.company.name}
                    audience="company"
                  />
                ) : null
              }
            />

            <AfterOfferPanel applicationId={a.id} />
          </div>
        </aside>

        <div className="ad-main">
          {simRounds.length > 0 && (
            <section className="card">
              <h2>Work simulation</h2>
              {/*
                Status only. Passing the round stays the recruiter's call, made
                in the panel beside this - a certificate is strong evidence, not a
                verdict.
              */}
              {simRounds.map((r) => (
                <div key={r.roundId}>
                  <p>
                    <b>{r.simulation.title}</b>{' '}
                    <span className="muted">
                      · {r.roundName}
                      {r.isCurrent ? ' (current round)' : ''} · ~{r.simulation.estimatedHours} h
                    </span>
                  </p>
                  <p className="muted">
                    {r.enrolment ? SIM_STATUS[r.enrolment.status] : 'Not started yet'}
                    {r.enrolment?.status === 'EXPLAIN_BOOKED' && r.enrolment.explainAt &&
                      ` for ${new Date(r.enrolment.explainAt).toLocaleString()}`}
                    {r.enrolment && (
                      <>
                        {' · '}
                        <Link to={`/company/simulations?tab=review&review=${r.enrolment.id}`}>Review in Simulations</Link>
                      </>
                    )}
                  </p>
                  {r.enrolment?.status === 'COMPLETED' && r.enrolment.certificateCode && (
                    <p className="alert alert-ok">
                      Simulation completed (certificate {r.enrolment.certificateCode}) — you can pass this round.
                    </p>
                  )}
                </div>
              ))}
            </section>
          )}

          {/*
            What somebody other than the student stands behind.

            The passport restates the whole profile labelled by who vouches
            for each line - so printed next to the profile it said every
            skill, project, experience and mark twice. Self-reported claims
            are dropped here: they are the sections below this one, written
            out properly with their dates and links. What is left is the part
            only the passport knows.
          */}
          {vouched.length > 0 && (
            <section className="card">
              <h2>Vouched for by someone else</h2>
              <p className="muted">
                Everything else on this page is the student&rsquo;s own account. These lines are
                not.
              </p>
              <ul className="ad-vouched">
                {vouched.map((v, i) => (
                  <li key={`${v.kind}-${v.label}-${i}`} className={`is-${v.evidence}`}>
                    <span className="ad-vouch-by">
                      {v.evidence === 'COLLEGE_VERIFIED' ? 'College' : 'Employer'}
                    </span>
                    <span className="ad-vouch-what">
                      <b>{v.label}</b>
                      <small>
                        {v.source}
                        {v.detail ? ` · ${v.detail}` : ''}
                        {v.certificateCode ? ` · ${v.certificateCode}` : ''}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/*
            What the student wrote about themselves. Fetched since this page was
            built and never shown - which left a recruiter reading a column of
            marks with no idea what the person was aiming at.
          */}
          {c.about && (
            <section className="card">
              <h2>In their own words</h2>
              <p className="ad-about">{c.about}</p>
            </section>
          )}

          <section className="card">
            <h2>Academic record</h2>
            {c.batch?.isFrozen ? (
              <p className="muted">
                Verified and locked by {c.batch.name}&rsquo;s placement cell &mdash; the student cannot
                change these.
              </p>
            ) : (
              <p className="muted">Entered by the student; their college has not locked them yet.</p>
            )}

            {/*
              Everything a criteria sheet asks for, and nothing invented. A blank
              shows as a dash rather than a zero: a college that does not track
              live backlogs separately leaves it empty, and printing "0" there
              would be a claim nobody made.
            */}
            <dl className="facts-grid">
              <Fact label="Degree CGPA" value={c.cgpa ?? '—'} />
              {c.degreePct && <Fact label="Degree %" value={`${c.degreePct}%`} />}
              <Fact label="10th" value={c.tenthPct ? `${c.tenthPct}%` : '—'} />
              {/* A lateral entrant has a diploma where a 12th percentage would be. */}
              {c.diplomaPct ? (
                <Fact label="Diploma" value={`${c.diplomaPct}%`} />
              ) : (
                <Fact label="12th" value={c.twelfthPct ? `${c.twelfthPct}%` : '—'} />
              )}
              {(c.pgCgpa || c.pgPct) && (
                <Fact label="Post-graduate" value={c.pgCgpa ? `${c.pgCgpa} CGPA` : `${c.pgPct}%`} />
              )}
              <Fact
                label="Backlogs live"
                value={c.activeBacklogs !== null ? String(c.activeBacklogs) : '—'}
              />
              <Fact label="Backlogs ever" value={c.backlogs !== null ? String(c.backlogs) : '—'} />
              <Fact label="Course" value={c.course ?? c.batch?.course ?? '—'} />
              {c.specialisation && <Fact label="Branch" value={c.specialisation} />}
              <Fact
                label="Graduating"
                value={String(c.graduationYear ?? c.batch?.graduationYear ?? '—')}
              />
              {c.gapYears ? <Fact label="Gap years" value={String(c.gapYears)} /> : null}
              {c.isLateralEntry && <Fact label="Entry" value="Lateral (2nd year)" />}
            </dl>

            {c.resumeUrl && (
              <a className="entry-link" href={c.resumeUrl} target="_blank" rel="noreferrer">
                Open the resume they applied with →
              </a>
            )}
          </section>

          {c.skills.length > 0 && (
            <section className="card">
              <h2>Skills</h2>
              <p className="muted">
                Listed by the student. A ticked one has been shown in work somebody watched.
              </p>
              <div className="ad-skills">
                {c.skills.map((name) => {
                  const shown = shownIn.get(name.toLowerCase());
                  return (
                    <span
                      key={name}
                      className={`ad-skill ${shown ? 'is-shown' : ''}`}
                      title={shown ?? undefined}
                    >
                      {shown && (
                        <i aria-hidden="true">✓</i>
                      )}
                      {name}
                    </span>
                  );
                })}
              </div>
            </section>
          )}

          {c.educations.length > 0 && (
            <section className="card">
              <h2>Education</h2>
              <ul className="entry-list">
                {c.educations.map((e) => (
                  <li key={e.id}>
                    <div>
                      <b>{e.degree}</b>
                      <span className="entry-meta">
                        {[
                          e.institution,
                          e.board,
                          `${e.startYear}–${e.endYear ?? 'present'}`,
                          e.cgpa ? `CGPA ${e.cgpa}` : null,
                          e.percentage ? `${e.percentage}%` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(c.experiences.length > 0 || c.projects.length > 0) && (
            <section className="card">
              <h2>Experience and projects</h2>
              <ul className="entry-list">
                {c.experiences.map((e) => (
                  <li key={e.id}>
                    <div>
                      <b>{e.title}</b>
                      <span className="entry-meta">
                        {[
                          e.organisation,
                          e.location,
                          `${new Date(e.startDate).getFullYear()}–${
                            e.isCurrent || !e.endDate ? 'present' : new Date(e.endDate).getFullYear()
                          }`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      {/* What they actually did there. Held all along, never shown. */}
                      {e.description && <span className="ad-body">{e.description}</span>}
                    </div>
                  </li>
                ))}
                {c.projects.map((p) => (
                  <li key={p.id}>
                    <div>
                      <b>{p.title}</b>
                      {p.startDate && (
                        <span className="entry-meta">
                          {new Date(p.startDate).getFullYear()}
                          {p.endDate ? `–${new Date(p.endDate).getFullYear()}` : ''}
                        </span>
                      )}
                      {p.description && <span className="ad-body">{p.description}</span>}
                      {/*
                        Every place it can be seen. One project is routinely the
                        repository, a live demo and a write-up, and sending one of
                        them made the student choose which the recruiter got.
                      */}
                      {p.links.length > 0 && (
                        <span className="ad-links">
                          {p.links.map((l) => (
                            <a key={l.url} href={l.url} target="_blank" rel="noreferrer">
                              {l.label || hostOf(l.url)}
                            </a>
                          ))}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card">
            <h2>History</h2>
            <ol className="timeline">
              {a.events.map((e) => (
                <li key={e.id}>
                  <span className="timeline-dot" aria-hidden="true" />
                  <div>
                    <b>
                      {e.fromStatus ? `${e.fromStatus} → ${e.toStatus}` : `Applied`}
                      {e.reason === 'auto_placed' && (
                        <span className="pill pill-hold">took another offer</span>
                      )}
                    </b>
                    {e.note && <span className="entry-meta">{e.note}</span>}
                    <span className="entry-meta">
                      {e.actor} · {new Date(e.createdAt).toLocaleString()}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </CompanyLayout>
  );
}

/**
 * The rounds, as a rail.
 *
 * Small on purpose. It is read in a glance to answer one question - where
 * have they got to - and it sits directly above the button that moves them,
 * so the answer and the act are never more than an eye movement apart.
 */
function RoundRail({ a }: { a: Detail }) {
  const at = a.currentRound?.order ?? 0;
  if (a.rounds.length === 0) return <p className="ad-none">This role has no rounds.</p>;

  return (
    <ol className="ad-rounds">
      {a.rounds.map((r) => {
        const result = a.results.find((x) => x.roundOrder === r.order);
        const state =
          result?.outcome === 'PASSED'
            ? 'pass'
            : result?.outcome === 'FAILED'
              ? 'fail'
              : r.order === at
                ? 'now'
                : 'todo';

        const said =
          state === 'pass'
            ? 'Cleared'
            : state === 'fail'
              ? 'Did not clear'
              : state === 'now'
                ? 'Here now'
                : 'Not reached';

        return (
          <li key={r.id} className={`ad-round is-${state}`}>
            <span className="ad-round-n" aria-hidden="true">
              {state === 'pass' ? '✓' : state === 'fail' ? '✕' : r.order}
            </span>
            <span className="ad-round-main">
              <b>{r.name}</b>
              <small>
                {said}
                {result?.score !== null && result?.score !== undefined
                  ? ` · scored ${result.score}`
                  : ''}
              </small>
              {/* What the interviewer wrote, in full - it is the reason the
                  next decision goes the way it goes. */}
              {result?.feedback && <em>{result.feedback}</em>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Where they are, and what to do about it.
 *
 * One panel, because these are one thought. The rounds say where they have
 * got to, the sentence says whose move it is, and the buttons are the move -
 * and only the moves the state machine allows from here are offered. The
 * server is still the authority; this just avoids a button that would come
 * back as an illegal transition.
 */
function Decide({
  a,
  busy,
  isLastRound,
  onAct,
  waiting,
}: {
  a: Detail;
  busy: boolean;
  isLastRound: boolean;
  onAct: (fn: () => Promise<unknown>, message?: string) => void;
  waiting: ReactNode;
}) {
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');

  const terminal = ['HIRED', 'REJECTED', 'DECLINED', 'WITHDRAWN'].includes(a.status);

  return (
    <section className={`card decide ad-decide ${terminal ? 'is-closed' : ''}`}>
      {/* Where they stand, said once and said plainly. It is the first thing
          the panel has to answer before it asks for a decision. */}
      <p className="ad-now">
        <span>Right now</span>
        <b>{STATUS_SAID[a.status] ?? a.status.replace(/_/g, ' ').toLowerCase()}</b>
      </p>

      <RoundRail a={a} />

      {waiting}

      {terminal ? (
        <p className="ad-shut">
          This application is closed. Nothing further can be done with it.
        </p>
      ) : (
        <>
          {a.status === 'IN_ROUND' && (
            <div className="ad-mark">
              <label>
                <span>Score</span>
                <input
                  type="number"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  placeholder="82"
                  disabled={busy}
                />
              </label>
              <label>
                <span>Feedback</span>
                <input
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Strong on system design."
                  disabled={busy}
                />
              </label>
              <p className="ad-mark-hint">
                Both optional, and both go onto the round and into what the student sees.
              </p>
            </div>
          )}

          <div className="btn-row">
        {a.status === 'APPLIED' && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => onAct(() => applicantApi.review(a.id), 'Opened for review.')}
          >
            Start reviewing
          </button>
        )}

            {a.status === 'UNDER_REVIEW' && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() =>
                  onAct(() => applicantApi.shortlist(a.id), 'Shortlisted. They have been told.')
                }
              >
                Shortlist
              </button>
            )}

            {/* Calling them to a round is what releases its date and place. */}
            {a.status === 'SHORTLISTED' && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() =>
                  onAct(
                    () => applicantApi.invite(a.id),
                    `Called to ${a.rounds[0]?.name ?? 'the first round'}.`,
                  )
                }
              >
                Call to {a.rounds[0]?.name ?? 'the first round'}
              </button>
            )}

        {(a.status === 'IN_ROUND' || a.status === 'WAITLISTED') && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || a.status === 'WAITLISTED'}
            onClick={() =>
              onAct(async () => {
                const r = await applicantApi.advance(a.id, {
                  score: score ? Number(score) : undefined,
                  feedback: feedback || undefined,
                });
                setScore('');
                setFeedback('');
                return r;
              }, isLastRound ? 'Offer extended.' : 'Moved to the next round.')
            }
          >
            {isLastRound ? 'Pass and make an offer' : 'Pass this round'}
          </button>
        )}

        {a.status === 'OFFERED' && (
          <p className="muted">
            Waiting for the student to accept or decline. You can confirm joining once they accept.
          </p>
        )}

        {a.status === 'ACCEPTED' && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => onAct(() => applicantApi.hire(a.id), 'Confirmed as hired.')}
          >
            Confirm they joined
          </button>
        )}

            {['UNDER_REVIEW', 'SHORTLISTED', 'IN_ROUND'].includes(a.status) && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => onAct(() => applicantApi.waitlist(a.id), 'Waitlisted.')}
              >
                Waitlist
              </button>
            )}

            {!['OFFERED', 'ACCEPTED'].includes(a.status) && (
              <button
                type="button"
                className="link-btn is-danger"
                disabled={busy}
                onClick={() =>
                  onAct(
                    () => applicantApi.reject(a.id, { feedback: feedback || undefined }),
                    'Application closed.',
                  )
                }
              >
                Reject
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
