import { useCallback, useEffect, useState, type FormEvent } from 'react';
import StudentLayout from './StudentLayout';
import { networkApi, type AlumniQuestion, type Mentor, type MentorProfile, type Referral } from '../../api/network';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import './Alumni.css';

type Tab = 'ask' | 'seniors' | 'help';

const date = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/**
 * Seniors from your own college.
 *
 * Three things, one per tab: ask a question every senior can answer, find a
 * senior at a company you want and ask them for a referral, and - once you
 * have graduated or accepted an offer - help the juniors coming after you.
 * Nobody's phone number or email is ever shown; everything goes through here.
 */
export default function Alumni() {
  const { hasModule } = useAuth();
  const enabled = hasModule('community.alumni');
  const [tab, setTab] = useState<Tab>('ask');
  const [me, setMe] = useState<Awaited<ReturnType<typeof networkApi.me>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    networkApi
      .me()
      .then(setMe)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load alumni connect.'));
  }, [enabled]);

  if (!enabled) {
    return (
      <StudentLayout>
        <header className="page-head">
          <div>
            <h1>Ask seniors</h1>
            <p className="page-lede">Your institution has not switched on alumni connect yet.</p>
          </div>
        </header>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Alumni connect</p>
          <h1>Ask seniors</h1>
          <p className="page-lede">
            Seniors from {me?.collegeName ?? 'your college'} who have been where you are. Ask openly, or ask one of them
            for a referral.
          </p>
        </div>
      </header>

      {error && <p className="alert alert-error">{error}</p>}

      <div className="nw-tabs" role="tablist" aria-label="Alumni connect">
        <button type="button" role="tab" aria-selected={tab === 'ask'} className={tab === 'ask' ? 'is-on' : ''} onClick={() => setTab('ask')}>
          Questions
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'seniors'}
          className={tab === 'seniors' ? 'is-on' : ''}
          onClick={() => setTab('seniors')}
        >
          Seniors &amp; referrals
        </button>
        {me?.isAlumnus && (
          <button type="button" role="tab" aria-selected={tab === 'help'} className={tab === 'help' ? 'is-on' : ''} onClick={() => setTab('help')}>
            Help juniors
          </button>
        )}
      </div>

      {tab === 'ask' && <Questions isAlumnus={Boolean(me?.isAlumnus)} />}
      {tab === 'seniors' && <Seniors maxOpen={me?.maxOpenReferrals ?? 3} />}
      {tab === 'help' && me?.isAlumnus && <HelpJuniors profile={me.profile} onSaved={(profile) => setMe({ ...me, profile })} />}
    </StudentLayout>
  );
}

/* -------------------------------------------------------------------------- */
/* Questions                                                                   */
/* -------------------------------------------------------------------------- */

function Questions({ isAlumnus }: { isAlumnus: boolean }) {
  const [questions, setQuestions] = useState<AlumniQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ body: '', companyName: '', anonymous: false });
  const [busy, setBusy] = useState(false);
  const [answering, setAnswering] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');

  const load = useCallback(() => {
    networkApi
      .questions()
      .then((r) => setQuestions(r.questions))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load questions.'));
  }, []);
  useEffect(load, [load]);

  async function ask(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await networkApi.ask(form);
      setForm({ body: '', companyName: '', anonymous: false });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not post your question.');
    } finally {
      setBusy(false);
    }
  }

  async function sendAnswer(questionId: string) {
    setBusy(true);
    setError(null);
    try {
      await networkApi.answer(questionId, answer);
      setAnswering(null);
      setAnswer('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not post your answer.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form className="card nw-ask" onSubmit={ask}>
        <label className="nw-field">
          <span>Your question</span>
          <textarea
            rows={3}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder="How many rounds does Demo Systems run, and what did the technical interview cover?"
            maxLength={1500}
          />
        </label>
        <div className="nw-row">
          <label className="nw-field">
            <span>
              About a company <em>optional</em>
            </span>
            <input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="Demo Systems" />
          </label>
          <label className="nw-check">
            <input type="checkbox" checked={form.anonymous} onChange={(e) => setForm({ ...form, anonymous: e.target.checked })} />
            Ask without my name
            <small>Other students won't see who asked. Your placement cell still can.</small>
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy || form.body.trim().length < 10}>
            Ask seniors
          </button>
        </div>
      </form>

      {error && <p className="alert alert-error">{error}</p>}

      {questions === null ? (
        <p className="muted">Loading…</p>
      ) : questions.length === 0 ? (
        <p className="nw-empty">No questions yet. Be the first to ask - seniors are waiting to help.</p>
      ) : (
        <ul className="nw-questions">
          {questions.map((q) => (
            <li key={q.id} className="card nw-q">
              <div className="nw-q-head">
                <span className="nw-q-who">{q.askedBy ?? 'A junior'}</span>
                {q.companyName && <span className="pill pill-idle">{q.companyName}</span>}
                <span className="muted">{date(q.createdAt)}</span>
              </div>
              <p className="nw-q-body">{q.body}</p>

              {q.answers.length > 0 && (
                <ul className="nw-answers">
                  {q.answers.map((a) => (
                    <li key={a.id}>
                      <p>{a.body}</p>
                      <small>
                        {a.by}
                        {a.byLine ? ` · ${a.byLine}` : ''} · {date(a.createdAt)}
                      </small>
                    </li>
                  ))}
                </ul>
              )}

              {isAlumnus && !q.mine && (
                answering === q.id ? (
                  <div className="nw-answer-form">
                    <textarea rows={3} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="What you would tell your younger self." autoFocus />
                    <div className="nw-actions">
                      <button type="button" className="btn btn-ghost" onClick={() => setAnswering(null)}>
                        Cancel
                      </button>
                      <button type="button" className="btn btn-primary" disabled={busy || answer.trim().length < 10} onClick={() => sendAnswer(q.id)}>
                        Post answer
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="link-btn" onClick={() => { setAnswering(q.id); setAnswer(''); }}>
                    Answer this
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Seniors and referrals                                                       */
/* -------------------------------------------------------------------------- */

function Seniors({ maxOpen }: { maxOpen: number }) {
  const [mentors, setMentors] = useState<Mentor[] | null>(null);
  const [referrals, setReferrals] = useState<{ sent: Referral[]; open: number } | null>(null);
  const [asking, setAsking] = useState<Mentor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(() => {
    networkApi.mentors().then(setMentors).catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load seniors.'));
    networkApi.referrals().then((r) => setReferrals({ sent: r.sent, open: r.open })).catch(() => setReferrals(null));
  }, []);
  useEffect(load, [load]);

  const q = query.trim().toLowerCase();
  const shown = (mentors ?? []).filter(
    (m) => !q || [m.name, m.currentCompany, m.currentRole, ...m.topics].filter(Boolean).some((s) => String(s).toLowerCase().includes(q)),
  );
  const pendingWith = new Set((referrals?.sent ?? []).filter((r) => r.status === 'SENT').map((r) => r.other?.name));
  const atLimit = (referrals?.open ?? 0) >= maxOpen;

  return (
    <>
      {error && <p className="alert alert-error">{error}</p>}

      <div className="nw-toolbar">
        <input className="nw-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by company, role or topic" aria-label="Search seniors" />
        <span className="muted">
          {referrals ? `${referrals.open} of ${maxOpen} referral requests waiting` : ''}
        </span>
      </div>

      {mentors === null ? (
        <p className="muted">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="nw-empty">{mentors.length === 0 ? 'No seniors have opted in yet.' : 'Nobody matches that search.'}</p>
      ) : (
        <ul className="nw-mentors">
          {shown.map((m) => (
            <li key={m.candidateId} className="card nw-mentor">
              <span className="nw-avatar" aria-hidden="true">
                {m.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="nw-mentor-main">
                <strong>{m.name}</strong>
                <small>
                  {[m.currentRole, m.currentCompany].filter(Boolean).join(' at ') || 'Senior'}
                  {m.graduationYear ? ` · Class of ${m.graduationYear}` : ''}
                  {m.course ? ` · ${m.course}${m.specialisation ? ` ${m.specialisation}` : ''}` : ''}
                </small>
                {m.topics.length > 0 && (
                  <div className="nw-topics">
                    {m.topics.map((t) => (
                      <span key={t} className="pill pill-idle">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {m.canRefer ? (
                pendingWith.has(m.name) ? (
                  <span className="pill pill-hold">Request waiting</span>
                ) : (
                  <button type="button" className="btn btn-secondary" disabled={atLimit} title={atLimit ? 'Wait for an answer first' : undefined} onClick={() => setAsking(m)}>
                    Ask for a referral
                  </button>
                )
              ) : (
                <span className="muted nw-small">Answers questions</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {asking && (
        <ReferralForm
          mentor={asking}
          onClose={() => setAsking(null)}
          onSent={() => {
            setAsking(null);
            load();
          }}
        />
      )}

      {referrals && referrals.sent.length > 0 && (
        <section className="card">
          <h2>Your referral requests</h2>
          <ul className="nw-referrals">
            {referrals.sent.map((r) => (
              <li key={r.id}>
                <span>
                  <strong>
                    {r.role} at {r.company}
                  </strong>
                  <small>to {r.other?.name ?? 'a senior'} · {date(r.createdAt)}</small>
                </span>
                <ReferralPill status={r.status} />
              </li>
            ))}
          </ul>
          <p className="muted nw-small">
            A “yes” means the senior will refer you through their company's own process - the referral itself happens
            outside Apli.ai.
          </p>
        </section>
      )}
    </>
  );
}

function ReferralPill({ status }: { status: Referral['status'] }) {
  if (status === 'ACCEPTED') return <span className="pill pill-pass">Agreed</span>;
  if (status === 'DECLINED') return <span className="pill pill-idle">Not this time</span>;
  return <span className="pill pill-hold">Waiting</span>;
}

function ReferralForm({ mentor, onClose, onSent }: { mentor: Mentor; onClose: () => void; onSent: () => void }) {
  const [form, setForm] = useState({ company: mentor.currentCompany ?? '', role: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await networkApi.requestReferral({ toCandidateId: mentor.candidateId, ...form });
      onSent();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send your request.');
      setBusy(false);
    }
  }

  return (
    <div className="nw-modal" role="dialog" aria-modal="true" aria-label={`Ask ${mentor.name} for a referral`}>
      <form className="nw-modal-card" onSubmit={send}>
        <h2>Ask {mentor.name} for a referral</h2>
        <p className="muted">Be specific and brief. Seniors refer people they can picture in the role.</p>
        <div className="nw-row">
          <label className="nw-field">
            <span>Company</span>
            <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Demo Systems" />
          </label>
          <label className="nw-field">
            <span>Role</span>
            <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Graduate Engineer" />
          </label>
        </div>
        <label className="nw-field">
          <span>Message ({500 - form.message.length} left)</span>
          <textarea
            rows={4}
            maxLength={500}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            placeholder="Who you are, what you have built, and why this role."
          />
        </label>
        {error && <p className="alert alert-error">{error}</p>}
        <div className="nw-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || form.message.trim().length < 20 || !form.role.trim() || !form.company.trim()}>
            Send request
          </button>
        </div>
      </form>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Help juniors (alumni only)                                                  */
/* -------------------------------------------------------------------------- */

function HelpJuniors({ profile, onSaved }: { profile: MentorProfile | null; onSaved: (p: MentorProfile) => void }) {
  const [form, setForm] = useState<MentorProfile>(
    profile ?? { available: true, currentCompany: '', currentRole: '', canRefer: false, topics: [] },
  );
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [received, setReceived] = useState<Referral[] | null>(null);

  const loadReceived = useCallback(() => {
    networkApi.referrals().then((r) => setReceived(r.received)).catch(() => setReceived([]));
  }, []);
  useEffect(loadReceived, [loadReceived]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { profile: p } = await networkApi.saveProfile({
        ...form,
        currentCompany: form.currentCompany ?? '',
        currentRole: form.currentRole ?? '',
      });
      onSaved({ ...p, topics: Array.isArray(p.topics) ? p.topics : [] });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  async function respond(id: string, status: 'ACCEPTED' | 'DECLINED') {
    try {
      await networkApi.respondReferral(id, status);
      loadReceived();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not answer that request.');
    }
  }

  function addTopic() {
    const t = topic.trim();
    if (t && !form.topics.includes(t) && form.topics.length < 10) setForm({ ...form, topics: [...form.topics, t] });
    setTopic('');
  }

  const waiting = (received ?? []).filter((r) => r.status === 'SENT');

  return (
    <>
      {waiting.length > 0 && (
        <section className="card nw-incoming">
          <h2>Referral requests for you</h2>
          <ul className="nw-referrals">
            {waiting.map((r) => (
              <li key={r.id}>
                <span>
                  <strong>
                    {r.other?.name ?? 'A junior'} · {r.role} at {r.company}
                  </strong>
                  <small>{r.message}</small>
                </span>
                <span className="nw-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => respond(r.id, 'DECLINED')}>
                    Not this time
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => respond(r.id, 'ACCEPTED')}>
                    I'll refer them
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <p className="muted nw-small">Saying yes tells them you'll refer them through your company's own process.</p>
        </section>
      )}

      <form className="card nw-profile" onSubmit={save}>
        <h2>Help juniors from your college</h2>
        <p className="muted">Juniors see your name, role, company and topics - never your email or phone.</p>
        <div className="nw-row">
          <label className="nw-field">
            <span>Where you work</span>
            <input value={form.currentCompany ?? ''} onChange={(e) => { setSaved(false); setForm({ ...form, currentCompany: e.target.value }); }} placeholder="Demo Systems" />
          </label>
          <label className="nw-field">
            <span>Your role</span>
            <input value={form.currentRole ?? ''} onChange={(e) => { setSaved(false); setForm({ ...form, currentRole: e.target.value }); }} placeholder="Software Engineer" />
          </label>
        </div>
        <label className="nw-field">
          <span>Happy to talk about</span>
          <div className="nw-topics nw-topics-edit">
            {form.topics.map((t) => (
              <span key={t} className="pill pill-idle">
                {t}
                <button type="button" aria-label={`Remove ${t}`} onClick={() => setForm({ ...form, topics: form.topics.filter((x) => x !== t) })}>
                  ×
                </button>
              </span>
            ))}
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTopic();
                }
              }}
              onBlur={addTopic}
              placeholder="Interviews, DSA, core jobs… press Enter"
            />
          </div>
        </label>
        <label className="nw-check">
          <input type="checkbox" checked={form.canRefer} onChange={(e) => { setSaved(false); setForm({ ...form, canRefer: e.target.checked }); }} />
          I can refer juniors at my company
          <small>Juniors can then ask you. You decide each request, and a “no” is always fine.</small>
        </label>
        <label className="nw-check">
          <input type="checkbox" checked={form.available} onChange={(e) => { setSaved(false); setForm({ ...form, available: e.target.checked }); }} />
          Show me to juniors
          <small>Switch off any time - you'll disappear from the list at once.</small>
        </label>
        {error && <p className="alert alert-error">{error}</p>}
        <div className="nw-actions">
          {saved && <span className="nw-saved">Saved</span>}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {profile ? 'Save' : 'Start helping juniors'}
          </button>
        </div>
      </form>
    </>
  );
}
