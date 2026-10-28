import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import {
  INVITE_STATUS,
  roundIcon,
  studentInviteApi,
  type StudentInvite,
  type StudentRound,
} from '../../api/interviewInvites';
import Shell, { CompanyTile } from './Shell';

const message = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);
const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

const VERDICT: Record<string, { label: string; tone: string }> = {
  PASSED: { label: 'Passed', tone: 'is-verified' },
  FAILED: { label: 'Did not pass', tone: 'is-changes' },
  SKIPPED: { label: 'Skipped', tone: '' },
};

/**
 * Interviews companies invited the student to, from their work: accept or
 * decline, then go through the rounds. A recorded interview is done right
 * here; a work simulation links to it; anything else the company runs, and
 * this says where and how long.
 */
export default function Interviews() {
  const [invites, setInvites] = useState<StudentInvite[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    studentInviteApi
      .list()
      .then(setInvites)
      .catch((e) => setError(message(e, 'Could not load your interviews.')));
  }, []);

  const waiting = invites?.filter((i) => i.status === 'PENDING').length ?? 0;

  return (
    <Shell>
      <section className="sa-hero is-short">
        <div className="sa-wrap">
          <p className="sa-eyebrow">Interviews</p>
          <h1>
            Companies that want to <span className="sa-mark">talk to you</span>
          </h1>
          <p className="sa-lede">
            {waiting
              ? `${waiting} invite${waiting === 1 ? '' : 's'} waiting for your answer.`
              : 'Companies invite students whose work they have seen. Hand in a simulation, share it, or send a test to be seen.'}
          </p>
        </div>
      </section>
      <div className="sa-wrap sa-body">
        {error && <p className="sa-alert">{error}</p>}
        {!invites && !error && <p className="sa-loading">Loading…</p>}
        {invites && invites.length === 0 && (
          <section className="sa-panel sa-soon">
            <h2>No interviews yet</h2>
            <p>When a company likes your work, its invite to interview shows up here.</p>
            <Link to="/student/simulations" className="sa-btn">
              Find a simulation <span aria-hidden="true">→</span>
            </Link>
          </section>
        )}
        {invites && invites.length > 0 && (
          <ul className="iv-cards">
            {invites.map((i) => (
              <InviteCard key={i.id} invite={i} onChange={setInvites} />
            ))}
          </ul>
        )}
      </div>
    </Shell>
  );
}

function InviteCard({ invite: i, onChange }: { invite: StudentInvite; onChange: (l: StudentInvite[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const st = INVITE_STATUS[i.status];
  const rounds = i.process.rounds;
  const verdict = new Map(i.roundFeedbacks.map((f) => [f.roundOrder, f]));
  const current = i.status === 'ACCEPTED' ? rounds.find((r) => r.order === i.currentRoundOrder) : undefined;

  async function respond(decision: 'ACCEPTED' | 'DECLINED') {
    setBusy(true);
    setError(null);
    try {
      onChange(await studentInviteApi.respond(i.id, decision));
    } catch (e) {
      setError(message(e, 'Could not send your answer.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={`iv-card ${i.status === 'PENDING' || i.status === 'ACCEPTED' ? 'is-open' : ''}`}>
      <div className="of-card-head">
        <CompanyTile company={{ id: i.company.name, name: i.company.name, logoUrl: i.company.logoUrl }} />
        <div>
          <h2>{i.role}</h2>
          <p>
            {i.company.name} · {rounds.length} round{rounds.length === 1 ? '' : 's'} · invited {day(i.createdAt)}
          </p>
        </div>
        <span className={`sa-status ${st.tone}`}>{st.label}</span>
      </div>

      {i.message && <p className="iv-message">“{i.message}”</p>}

      <ol className="iv-steps" aria-label="Rounds">
        {rounds.map((r) => {
          const v = verdict.get(r.order);
          const here = current?.order === r.order;
          return (
            <li key={r.order} className={`${here ? 'is-here' : ''} ${v ? `is-${v.outcome.toLowerCase()}` : ''}`}>
              <span className="iv-step-icon" aria-hidden="true">
                {v ? (v.outcome === 'FAILED' ? '✕' : '✓') : roundIcon(r.type)}
              </span>
              <span>
                <b>{r.name}</b>
                <small>
                  {r.typeLabel}
                  {r.durationMin ? ` · ${r.durationMin} min` : ''}
                  {v ? ` · ${VERDICT[v.outcome]?.label ?? v.outcome}` : here ? ' · you are here' : ''}
                </small>
              </span>
            </li>
          );
        })}
      </ol>

      {i.status === 'PENDING' && (
        <div className="of-answer-actions">
          <button type="button" className="sa-btn" disabled={busy} onClick={() => void respond('ACCEPTED')}>
            Accept the invite
          </button>
          <button type="button" className="sa-btn is-ghost" disabled={busy} onClick={() => void respond('DECLINED')}>
            Decline
          </button>
          <small className="iv-muted">Accept to see where and when each round happens.</small>
        </div>
      )}
      {error && <p className="sa-alert">{error}</p>}

      {current && <CurrentRound invite={i} round={current} onChange={onChange} />}

      {i.status === 'OFFERED' && (
        <p className="of-next">
          <b>You cleared every round.</b> {i.company.name} will be in touch - an internship offer shows up under{' '}
          <Link to="/student/jobs">Jobs</Link>.
        </p>
      )}
      {i.status === 'REJECTED' && (
        <p className="of-next">
          {i.company.name} decided not to go further this time. Your work is still yours - keep building it.
        </p>
      )}
    </li>
  );
}

/** What to do in the round the student is in. */
function CurrentRound({
  invite,
  round: r,
  onChange,
}: {
  invite: StudentInvite;
  round: StudentRound;
  onChange: (l: StudentInvite[]) => void;
}) {
  return (
    <section className="iv-current">
      <h3>
        Round {r.order}: {r.name}
      </h3>
      {r.description && <p className="iv-desc">{r.description}</p>}

      {r.video ? (
        <VideoRound invite={invite} round={r} onChange={onChange} />
      ) : r.simulation ? (
        <p>
          Do the simulation <b>{r.simulation.title}</b> and hand it in - the company sees your work when you do.{' '}
          <Link to={`/student/simulations/${r.simulation.slug}`} className="sa-btn is-small">
            Open the simulation →
          </Link>
        </p>
      ) : (
        <dl className="sa-facts">
          <div>
            <dt>Where</dt>
            <dd>
              {r.isOnline ? (
                r.meetingLink ? (
                  <a href={r.meetingLink} target="_blank" rel="noreferrer">
                    Join online ↗
                  </a>
                ) : (
                  'Online - the company will send the link'
                )
              ) : (
                r.addressLine || 'In person - the company will tell you where'
              )}
            </dd>
          </div>
          <div>
            <dt>How long</dt>
            <dd>{r.durationMin ? `${r.durationMin} minutes` : 'The company will say'}</dd>
          </div>
          <div>
            <dt>What next</dt>
            <dd>The company runs this round and tells you how it went here.</dd>
          </div>
        </dl>
      )}
    </section>
  );
}

/* ── Recorded interview ─────────────────────────────────────────────────── */

type Stage = 'idle' | 'prep' | 'recording' | 'review' | 'saving';

/** The first recording format this browser can make. */
function recordingType(): string | undefined {
  const options = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  return typeof MediaRecorder === 'undefined' ? undefined : options.find((t) => MediaRecorder.isTypeSupported(t));
}

/**
 * A recorded interview, one question at a time: time to think, then a
 * recording that stops by itself when the time is up. Each take can be
 * watched and recorded again before it is kept; a kept answer can be
 * replaced until the company gives its verdict.
 */
function VideoRound({
  invite,
  round: r,
  onChange,
}: {
  invite: StudentInvite;
  round: StudentRound;
  onChange: (l: StudentInvite[]) => void;
}) {
  const v = r.video!;
  const firstOpen = Math.max(0, v.questions.findIndex((q) => !q.answer));
  const [at, setAt] = useState(firstOpen);
  const [stage, setStage] = useState<Stage>('idle');
  const [left, setLeft] = useState(0);
  const [take, setTake] = useState<{ blob: Blob; url: string; seconds: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const live = useRef<HTMLVideoElement | null>(null);
  const started = useRef(0);
  const q = v.questions[at];
  const done = v.questions.filter((x) => x.answer).length;

  // The camera goes off when they leave.
  useEffect(
    () => () => {
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  // One clock for both countdowns.
  useEffect(() => {
    if (stage !== 'prep' && stage !== 'recording') return;
    if (left <= 0) {
      if (stage === 'prep') void startRecording();
      else stopRecording();
      return;
    }
    const t = window.setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [stage, left]);

  // The live picture is a new element once a countdown starts; give it the camera.
  useEffect(() => {
    if ((stage === 'prep' || stage === 'recording') && live.current && stream.current) {
      live.current.srcObject = stream.current;
    }
  }, [stage]);

  async function camera() {
    if (stream.current) return stream.current;
    const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: true });
    stream.current = s;
    return s;
  }

  async function begin() {
    setError(null);
    if (take) URL.revokeObjectURL(take.url);
    setTake(null);
    try {
      const s = await camera();
      if (live.current) live.current.srcObject = s;
    } catch {
      setError('Allow the camera and microphone for this site, then try again.');
      return;
    }
    if (v.prepTimeSec > 0) {
      setStage('prep');
      setLeft(v.prepTimeSec);
    } else {
      void startRecording();
    }
  }

  async function startRecording() {
    const s = await camera();
    if (live.current) live.current.srcObject = s;
    const type = recordingType();
    if (!type) {
      setError('This browser cannot record video. Try Chrome, Edge or Firefox on a computer or phone.');
      setStage('idle');
      return;
    }
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(s, { mimeType: type, videoBitsPerSecond: 1_000_000 });
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: type.split(';')[0] });
      setTake({ blob, url: URL.createObjectURL(blob), seconds: (Date.now() - started.current) / 1000 });
      setStage('review');
    };
    recorder.current = rec;
    started.current = Date.now();
    rec.start(1000);
    setStage('recording');
    setLeft(v.questionTimeSec);
  }

  function stopRecording() {
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }

  async function keep() {
    if (!take || !q) return;
    setStage('saving');
    setError(null);
    try {
      const list = await studentInviteApi.answer(invite.id, q.id, take.blob, take.seconds);
      URL.revokeObjectURL(take.url);
      setTake(null);
      onChange(list);
      const fresh = list.find((x) => x.id === invite.id)?.process.rounds.find((x) => x.order === r.order)?.video;
      const next = fresh ? fresh.questions.findIndex((x) => !x.answer) : -1;
      setAt(next >= 0 ? next : at);
      setStage('idle');
    } catch (e) {
      setError(message(e, 'Could not save that answer. Try again.'));
      setStage('review');
    }
  }

  if (v.locked) {
    return <p className="iv-muted">The company has looked at this round. Your answers are final.</p>;
  }
  if (!q) return null;

  return (
    <div className="iv-video-round">
      <p className="iv-muted">
        {v.count} question{v.count === 1 ? '' : 's'} · {v.prepTimeSec ? `${v.prepTimeSec} s to think, then ` : ''}
        {v.questionTimeSec} s to answer each · {done} of {v.count} recorded
      </p>

      <ol className="iv-q-tabs" aria-label="Questions">
        {v.questions.map((x, k) => (
          <li key={x.id}>
            <button
              type="button"
              className={`${k === at ? 'is-on' : ''} ${x.answer ? 'is-done' : ''}`}
              disabled={stage !== 'idle'}
              onClick={() => setAt(k)}
              aria-current={k === at ? 'step' : undefined}
            >
              {x.answer ? '✓' : k + 1}
            </button>
          </li>
        ))}
      </ol>

      <div className="iv-stage">
        <div className="iv-question">
          <span className="iv-q-label">
            Question {at + 1} of {v.count}
          </span>
          <p>{q.text}</p>
          {q.hint && <small>{q.hint}</small>}
        </div>

        <div className="iv-screen">
          {stage === 'review' && take ? (
            <video src={take.url} controls className="iv-video" />
          ) : stage === 'idle' && q.answer ? (
            <video src={q.answer.fileUrl} controls preload="metadata" className="iv-video" />
          ) : (
            <video ref={live} autoPlay muted playsInline className={`iv-video ${stage === 'idle' ? 'is-off' : ''}`} />
          )}
          {stage === 'prep' && <span className="iv-clock is-prep">Think · {left}s</span>}
          {stage === 'recording' && <span className="iv-clock is-rec">● Recording · {left}s</span>}
        </div>

        <div className="iv-controls">
          {stage === 'idle' && (
            <button type="button" className="sa-btn" onClick={() => void begin()}>
              {q.answer ? 'Record this answer again' : v.prepTimeSec ? 'I am ready - start' : 'Start recording'}
            </button>
          )}
          {stage === 'prep' && (
            <button type="button" className="sa-btn" onClick={() => void startRecording()}>
              Start recording now
            </button>
          )}
          {stage === 'recording' && (
            <button type="button" className="sa-btn" onClick={stopRecording}>
              Stop - I am done
            </button>
          )}
          {(stage === 'review' || stage === 'saving') && (
            <>
              <button type="button" className="sa-btn" disabled={stage === 'saving'} onClick={() => void keep()}>
                {stage === 'saving' ? 'Saving…' : 'Use this answer'}
              </button>
              <button type="button" className="sa-btn is-ghost" disabled={stage === 'saving'} onClick={() => void begin()}>
                Record again
              </button>
            </>
          )}
        </div>
        {error && <p className="sa-alert">{error}</p>}
        {done === v.count && stage === 'idle' && (
          <p className="of-next">
            <b>All {v.count} answers are in.</b> The company will watch them and tell you how it went. You can still
            re-record any answer until then.
          </p>
        )}
      </div>
    </div>
  );
}
