import { useCallback, useEffect, useState } from 'react';
import CompanyLayout from './CompanyLayout';
import { communityApi, type TalentCard, type TalentResult } from '../../api/community';
import { ApiError } from '../../api/client';
import '../student/Stories.css';
import './Talent.css';

type Filter = { course?: string; branch?: string; year?: number; skill?: string; collegeId?: string; q?: string };

/**
 * Students who chose to be found.
 *
 * Every student here switched their showcase to recruiters and said yes on
 * their privacy page; withdrawing either takes them off this list at once.
 * There are no phone numbers or emails here, and the one thing a recruiter can
 * send is an invitation to apply - a student who is interested replies by
 * applying.
 */
export default function Talent() {
  const [filter, setFilter] = useState<Filter>({});
  const [data, setData] = useState<TalentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviting, setInviting] = useState<TalentCard | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    communityApi
      .talent(filter)
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load students.'));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const set = <K extends keyof Filter>(k: K, v: Filter[K]) => setFilter((f) => ({ ...f, [k]: v || undefined }));

  return (
    <CompanyLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Talent</p>
          <h1>Students open to invitations</h1>
          <p className="page-lede">
            Each of them chose to be found and agreed to it. Invite the ones whose work fits - they reply by applying.
          </p>
        </div>
      </header>

      {error && <p className="alert alert-error">{error}</p>}

      {data && (
        <div className="st-filters">
          <input
            className="st-input tl-search"
            value={filter.q ?? ''}
            onChange={(e) => set('q', e.target.value)}
            placeholder="Search name or headline"
            aria-label="Search"
          />
          <select className="st-select" value={filter.course ?? ''} onChange={(e) => set('course', e.target.value)} aria-label="Course">
            <option value="">Any course</option>
            {data.options.courses.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select className="st-select" value={filter.branch ?? ''} onChange={(e) => set('branch', e.target.value)} aria-label="Branch">
            <option value="">Any branch</option>
            {data.options.branches.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            className="st-select"
            value={filter.year ?? ''}
            onChange={(e) => set('year', e.target.value ? Number(e.target.value) : undefined)}
            aria-label="Passing year"
          >
            <option value="">Any year</option>
            {data.options.years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select className="st-select" value={filter.skill ?? ''} onChange={(e) => set('skill', e.target.value)} aria-label="Skill">
            <option value="">Any skill</option>
            {data.options.skills.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select className="st-select" value={filter.collegeId ?? ''} onChange={(e) => set('collegeId', e.target.value)} aria-label="College">
            <option value="">Any college</option>
            {data.options.colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {data && data.students.length === 0 && (
        <div className="st-empty">
          <h2>Nobody matches yet.</h2>
          <p>Students appear here once they switch their showcase on for recruiters.</p>
        </div>
      )}

      <ul className="tl-grid">
        {data?.students.map((s) => (
          <li key={s.candidateId} className="tl-card">
            <header>
              <strong>{s.name}</strong>
              {s.verified && (
                <span className="pill pill-pass" title="Their college checked and locked their marks">
                  Verified
                </span>
              )}
            </header>
            <p className="muted tl-meta">
              {[s.college?.name, s.course, s.branch, s.graduationYear].filter(Boolean).join(' · ')}
            </p>
            {s.pitch && <p className="tl-pitch">{s.pitch}</p>}
            {s.projects.length > 0 && (
              <ul className="tl-projects">
                {s.projects.map((p) => (
                  <li key={p.id}>
                    {p.link && /^https?:\/\//.test(p.link) ? (
                      <a href={p.link} target="_blank" rel="noreferrer noopener">
                        {p.title}
                      </a>
                    ) : (
                      p.title
                    )}
                  </li>
                ))}
              </ul>
            )}
            {s.skills.length > 0 && (
              <div className="tl-skills">
                {s.skills.slice(0, 8).map((k) => (
                  <span key={k}>{k}</span>
                ))}
              </div>
            )}
            <footer>
              {s.videoUrl && /^https:\/\//.test(s.videoUrl) && (
                <a className="link-btn" href={s.videoUrl} target="_blank" rel="noreferrer noopener">
                  ▶ Video
                </a>
              )}
              <span className="st-spacer" />
              {sent.has(s.candidateId) ? (
                <span className="pill pill-pass">Invited</span>
              ) : (
                <button type="button" className="btn btn-primary" onClick={() => setInviting(s)}>
                  Invite to apply
                </button>
              )}
            </footer>
          </li>
        ))}
      </ul>

      {inviting && data && (
        <InviteDialog
          student={inviting}
          jobs={data.jobs}
          onClose={() => setInviting(null)}
          onSent={() => {
            setSent((x) => new Set(x).add(inviting.candidateId));
            setInviting(null);
          }}
        />
      )}
    </CompanyLayout>
  );
}

function InviteDialog({
  student,
  jobs,
  onClose,
  onSent,
}: {
  student: TalentCard;
  jobs: { id: string; title: string }[];
  onClose: () => void;
  onSent: () => void;
}) {
  const [jobId, setJobId] = useState(jobs[0]?.id ?? '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await communityApi.invite(student.candidateId, { jobId: jobId || undefined, message: message.trim() });
      onSent();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send the invitation.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tl-overlay" role="dialog" aria-modal="true" aria-label={`Invite ${student.name}`} onClick={onClose}>
      <div className="tl-dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Invite {student.name} to apply</h2>
        <p className="muted">They get a notification with your message. You never see their contact details, and they reply by applying.</p>
        <label className="field tl-field">
          <span className="field-label">For which role</span>
          <select className="st-select" value={jobId} onChange={(e) => setJobId(e.target.value)}>
            <option value="">No particular role</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field tl-field">
          <span className="field-label">Your message</span>
          <textarea
            className="st-input"
            rows={4}
            maxLength={500}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What in their work caught your eye, and why they would fit."
            autoFocus
          />
          <span className="field-hint">{500 - message.length} characters left</span>
        </label>
        {error && <p className="alert alert-error">{error}</p>}
        <div className="btn-row">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={send} disabled={busy || message.trim().length < 10}>
            {busy ? 'Sending…' : 'Send invitation'}
          </button>
        </div>
      </div>
    </div>
  );
}
