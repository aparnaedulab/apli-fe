import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import {
  interviewProcessApi,
  PROCESS_TYPE_LABELS,
  ROUND_TYPE_LABELS,
  ROUND_TYPE_ICONS,
  ROUND_TYPE_HINTS,
  ROUND_TYPES,
  STATUS_LABELS,
  type CreateProcessInput,
  type InterviewProcess,
  type InterviewProcessSummary,
  type InterviewProcessStatus,
  type RoundInput,
  type RoundType,
} from '../../api/companyInterviews';
import Frame from './Frame';
import './interviews.css';

const msg = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

/* ─── List ──────────────────────────────────────────────────────────────── */

export function CompanyInterviewList() {
  const [rows, setRows] = useState<InterviewProcessSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    interviewProcessApi
      .list()
      .then(setRows)
      .catch((e) => setError(msg(e, 'Could not load interview processes.')));
  }, []);

  async function remove(id: string, title: string) {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await interviewProcessApi.remove(id);
      setRows((r) => r?.filter((p) => p.id !== id) ?? null);
    } catch (e) {
      setError(msg(e, 'Could not delete this process.'));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <Frame>
      <section className="sa-hero is-short">
        <div className="sa-wrap sa-ov-head">
          <div>
            <p className="sa-eyebrow">Interviews</p>
            <h1>
              Design your <span className="sa-mark">hiring process</span>
            </h1>
            <p className="sa-lede">
              Build reusable interview pipelines — pick the rounds, set their type, and use them
              across drives and openings.
            </p>
          </div>
          <button type="button" className="sa-btn" onClick={() => navigate('/company/interviews/new')}>
            New process <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>

      <div className="sa-wrap sa-body">
        {error && <p className="sa-alert">{error}</p>}
        {!rows && !error && <p className="sa-loading">Loading…</p>}

        {rows && rows.length === 0 && (
          <div className="ip-empty">
            <span style={{ fontSize: 40 }}>🗂️</span>
            <b>No interview processes yet</b>
            <span>
              Create your first process — decide on the rounds, their type, and whether each one
              eliminates candidates or is just for evaluation.
            </span>
            <button type="button" className="sa-btn" onClick={() => navigate('/company/interviews/new')}>
              Create your first process
            </button>
          </div>
        )}

        {rows && rows.length > 0 && (
          <ul className="ip-list">
            {rows.map((p) => (
              <li key={p.id} className="ip-card">
                <div className="ip-card-left">
                  <div className="ip-card-title">{p.title}</div>
                  <div className="ip-card-meta">
                    <span className={`ip-badge is-${p.status.toLowerCase()}`}>
                      {STATUS_LABELS[p.status]}
                    </span>
                    <span className="ip-meta-dot" />
                    <span>{PROCESS_TYPE_LABELS[p.processType]}</span>
                    <span className="ip-meta-dot" />
                    <span className="ip-rounds-pill">
                      {p.roundCount} round{p.roundCount === 1 ? '' : 's'}
                    </span>
                    <span className="ip-meta-dot" />
                    <span>
                      Updated{' '}
                      {new Date(p.updatedAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
                <div className="ip-card-actions">
                  <Link to={`/company/interviews/${p.id}`} className="sa-btn is-ghost ip-card-edit-btn">
                    Edit
                  </Link>
                  <button
                    type="button"
                    className="ip-card-del-btn"
                    disabled={deleting === p.id}
                    onClick={() => void remove(p.id, p.title)}
                  >
                    {deleting === p.id ? '…' : 'Delete'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Frame>
  );
}

/* ─── Editor ────────────────────────────────────────────────────────────── */

let seq = 0;
const uid = () => `r${seq++}`;

interface RoundDraft extends RoundInput {
  _key: string;
  expanded: boolean;
}

function blankRound(type: RoundType, order: number): RoundDraft {
  return {
    _key: uid(),
    order,
    name: ROUND_TYPE_LABELS[type] ?? type,
    type,
    isElimination: false,
    description: '',
    isOnline: type === 'MCQ_TEST' || type === 'VIDEO_INTERVIEW',
    durationMin: undefined,
    mode: undefined,
    shortlistCount: undefined,
    meetingLink: '',
    addressLine: '',
    expanded: true,
  };
}

/* ── Drag-and-drop round card ─────────────────────────────────────────── */
interface RoundCardProps {
  round: RoundDraft;
  index: number;
  total: number;
  onToggle: () => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onUpdate: (patch: Partial<RoundDraft>) => void;
  onDragStart: (key: string) => void;
  onDragOver: (key: string) => void;
  onDrop: () => void;
  isDragOver: boolean;
}

function RoundCard({
  round: r,
  index: i,
  total,
  onToggle,
  onMove,
  onRemove,
  onUpdate,
  onDragStart,
  onDragOver,
  onDrop,
  isDragOver,
}: RoundCardProps) {
  const dragRef = useRef<HTMLLIElement>(null);

  return (
    <li
      ref={dragRef}
      draggable
      onDragStart={() => onDragStart(r._key)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(r._key); }}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      className={`ip-round ${r.expanded ? 'is-expanded' : ''} ${isDragOver ? 'is-drag-over' : ''}`}
    >
      {/* Drag handle + number */}
      <div className="ip-round-left">
        <span className="ip-drag-handle" title="Drag to reorder">⠿</span>
        <span className="ip-round-num">{i + 1}</span>
      </div>

      <div className="ip-round-main">
        {/* Summary row */}
        <div className="ip-round-summary" onClick={onToggle}>
          <span className="ip-round-type-icon">{ROUND_TYPE_ICONS[r.type]}</span>
          <div className="ip-round-summary-text">
            <b>{r.name || ROUND_TYPE_LABELS[r.type]}</b>
            <span>
              {ROUND_TYPE_LABELS[r.type]}
              {r.durationMin ? ` · ${r.durationMin} min` : ''}
              {r.isElimination ? ' · Eliminating' : ''}
              {r.isOnline ? ' · Online' : ' · In-person'}
            </span>
          </div>
          <span className="ip-round-chevron">{r.expanded ? '▲' : '▼'}</span>
        </div>

        {/* Expanded detail */}
        {r.expanded && (
          <div className="ip-round-detail">
            <div className="ip-round-row">
              <div className="ip-field">
                <label className="ip-label">Round name</label>
                <input
                  type="text"
                  value={r.name}
                  maxLength={80}
                  placeholder={ROUND_TYPE_LABELS[r.type]}
                  onChange={(e) => onUpdate({ name: e.target.value })}
                />
              </div>
              <div className="ip-field">
                <label className="ip-label">Round type</label>
                <select
                  value={r.type}
                  onChange={(e) =>
                    onUpdate({
                      type: e.target.value as RoundType,
                      isOnline: e.target.value === 'MCQ_TEST' || e.target.value === 'VIDEO_INTERVIEW',
                    })
                  }
                >
                  {ROUND_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ROUND_TYPE_ICONS[t]} {ROUND_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="ip-field">
              <label className="ip-label">What this round involves <i>optional</i></label>
              <textarea
                rows={2}
                placeholder={ROUND_TYPE_HINTS[r.type]}
                value={r.description}
                maxLength={400}
                onChange={(e) => onUpdate({ description: e.target.value })}
              />
            </div>

            <div className="ip-round-row ip-round-row-three">
              <div className="ip-field">
                <label className="ip-label">Duration <i>optional</i></label>
                <div className="ip-input-unit">
                  <input
                    type="number"
                    min={5}
                    max={480}
                    placeholder="e.g. 60"
                    value={r.durationMin ?? ''}
                    onChange={(e) => onUpdate({ durationMin: e.target.value ? Number(e.target.value) : undefined })}
                  />
                  <span>min</span>
                </div>
              </div>
              <div className="ip-field">
                <label className="ip-label">Shortlist count <i>optional</i></label>
                <input
                  type="number"
                  min={1}
                  placeholder="How many pass"
                  value={r.shortlistCount ?? ''}
                  onChange={(e) => onUpdate({ shortlistCount: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
              <div className="ip-field">
                <label className="ip-label">Mode</label>
                <select value={r.mode ?? ''} onChange={(e) => onUpdate({ mode: e.target.value || undefined })}>
                  <option value="">Not specified</option>
                  <option value="ON_CAMPUS">On campus</option>
                  <option value="ONLINE">Online</option>
                  <option value="AT_OFFICE">At our office</option>
                </select>
              </div>
            </div>

            {/* Location toggle */}
            <div className="ip-location-row">
              <div className="ip-location-toggle">
                <button
                  type="button"
                  className={`ip-loc-btn ${!r.isOnline ? 'is-on' : ''}`}
                  onClick={() => onUpdate({ isOnline: false })}
                >
                  📍 In-person
                </button>
                <button
                  type="button"
                  className={`ip-loc-btn ${r.isOnline ? 'is-on' : ''}`}
                  onClick={() => onUpdate({ isOnline: true })}
                >
                  🌐 Online
                </button>
              </div>
              <div className="ip-field ip-location-input">
                {r.isOnline ? (
                  <>
                    <label className="ip-label">Meeting link <i>optional</i></label>
                    <input
                      type="url"
                      placeholder="https://meet.google.com/…"
                      value={r.meetingLink}
                      onChange={(e) => onUpdate({ meetingLink: e.target.value })}
                    />
                  </>
                ) : (
                  <>
                    <label className="ip-label">Venue / address <i>optional</i></label>
                    <input
                      type="text"
                      placeholder="Room no., building, or address"
                      value={r.addressLine}
                      onChange={(e) => onUpdate({ addressLine: e.target.value })}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Elimination toggle */}
            <button
              type="button"
              className={`ip-elim-toggle ${r.isElimination ? 'is-on' : ''}`}
              onClick={() => onUpdate({ isElimination: !r.isElimination })}
            >
              <span className="ip-elim-check">{r.isElimination ? '✓' : ''}</span>
              <div>
                <b>Eliminating round</b>
                <span>
                  {r.isElimination
                    ? 'Only candidates who pass this round continue.'
                    : 'All candidates continue — mark as eliminating to gate the next round.'}
                </span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Arrow buttons + delete */}
      <div className="ip-round-tools">
        <button className="ip-icon-btn" title="Move up" disabled={i === 0} onClick={() => onMove(-1)}>↑</button>
        <button className="ip-icon-btn" title="Move down" disabled={i === total - 1} onClick={() => onMove(1)}>↓</button>
        <button className="ip-icon-btn is-danger" title="Remove" onClick={onRemove}>×</button>
      </div>
    </li>
  );
}

/* ── Main editor ──────────────────────────────────────────────────────── */

export function CompanyInterviewEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();

  const [process, setProcess] = useState<InterviewProcess | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [processType, setProcessType] = useState<'HIRING' | 'INTERNSHIP'>('HIRING');
  const [status, setStatus] = useState<InterviewProcessStatus>('DRAFT');
  const [rounds, setRounds] = useState<RoundDraft[]>([]);

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showRoundPicker, setShowRoundPicker] = useState(false);

  // drag state
  const dragKey = useRef<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) return;
    interviewProcessApi
      .get(id!)
      .then((p) => {
        setProcess(p);
        setTitle(p.title);
        setDescription(p.description ?? '');
        setProcessType(p.processType);
        setStatus(p.status);
        setRounds(
          p.rounds.map((r) => ({
            _key: uid(),
            order: r.order,
            name: r.name,
            type: r.type as RoundType,
            isElimination: r.isElimination,
            description: r.description ?? '',
            isOnline: r.isOnline,
            durationMin: r.durationMin ?? undefined,
            mode: r.mode ?? undefined,
            shortlistCount: r.shortlistCount ?? undefined,
            meetingLink: r.meetingLink ?? '',
            addressLine: r.addressLine ?? '',
            expanded: false,
          })),
        );
      })
      .catch((e) => setLoadError(msg(e, 'Could not load this interview process.')));
  }, [id, isNew]);

  function markDirty() { setDirty(true); setSaved(false); }

  /* drag-and-drop */
  function handleDragStart(key: string) { dragKey.current = key; }
  function handleDragOver(key: string) { setDragOverKey(key); }
  function handleDrop() {
    const from = dragKey.current;
    const to = dragOverKey;
    if (!from || !to || from === to) { dragKey.current = null; setDragOverKey(null); return; }
    setRounds((rs) => {
      const list = [...rs];
      const fi = list.findIndex((r) => r._key === from);
      const ti = list.findIndex((r) => r._key === to);
      const [item] = list.splice(fi, 1);
      list.splice(ti, 0, item!);
      return list.map((r, i) => ({ ...r, order: i + 1 }));
    });
    dragKey.current = null;
    setDragOverKey(null);
    markDirty();
  }

  function addRound(type: RoundType) {
    setRounds((rs) => [...rs, blankRound(type, rs.length + 1)]);
    setShowRoundPicker(false);
    markDirty();
  }

  function removeRound(key: string) {
    setRounds((rs) => rs.filter((r) => r._key !== key).map((r, i) => ({ ...r, order: i + 1 })));
    markDirty();
  }

  function moveRound(key: string, dir: -1 | 1) {
    setRounds((rs) => {
      const list = [...rs];
      const i = list.findIndex((r) => r._key === key);
      const j = i + dir;
      if (j < 0 || j >= list.length) return list;
      [list[i], list[j]] = [list[j]!, list[i]!];
      return list.map((r, idx) => ({ ...r, order: idx + 1 }));
    });
    markDirty();
  }

  function toggleExpand(key: string) {
    setRounds((rs) => rs.map((r) => (r._key === key ? { ...r, expanded: !r.expanded } : r)));
  }

  function updateRound(key: string, patch: Partial<RoundDraft>) {
    setRounds((rs) => rs.map((r) => (r._key === key ? { ...r, ...patch } : r)));
    markDirty();
  }

  async function save() {
    if (!title.trim()) { setSaveError('Give this process a name.'); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const payload: CreateProcessInput = {
        title: title.trim(),
        description: description.trim() || undefined,
        processType,
      };
      let saved_process: InterviewProcess;
      if (isNew) {
        saved_process = await interviewProcessApi.create(payload);
      } else {
        saved_process = await interviewProcessApi.update(id!, { ...payload, status });
      }
      const roundPayload: RoundInput[] = rounds.map(({ _key, expanded, ...r }) => ({
        ...r,
        description: r.description || undefined,
        meetingLink: r.meetingLink || undefined,
        addressLine: r.addressLine || undefined,
        durationMin: r.durationMin || undefined,
        shortlistCount: r.shortlistCount || undefined,
        mode: r.mode || undefined,
      }));
      const updated = await interviewProcessApi.setRounds(saved_process.id, roundPayload);
      setProcess(updated);
      setDirty(false);
      setSaved(true);
      if (isNew) navigate(`/company/interviews/${updated.id}`, { replace: true });
    } catch (e) {
      setSaveError(msg(e, 'Could not save. Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <Frame>
        <div className="sa-wrap sa-body">
          <p className="sa-alert">{loadError}</p>
          <Link to="/company/interviews" className="sa-back">← Back to Interviews</Link>
        </div>
      </Frame>
    );
  }

  if (!isNew && !process) {
    return (
      <Frame>
        <div className="sa-wrap sa-body"><p className="sa-loading">Loading…</p></div>
      </Frame>
    );
  }

  return (
    <Frame>
      <div className="sa-wrap sa-body">

        {/* ── Top bar ── */}
        <div className="ip-topbar">
          <div className="ip-topbar-left">
            <Link to="/company/interviews" className="sa-back">
              <span aria-hidden="true">←</span> Interviews
            </Link>
            <h1 className="ip-topbar-title">
              {isNew ? 'New interview process' : (title || 'Edit process')}
            </h1>
            {!isNew && (
              <div className="ip-topbar-meta">
                <span className={`ip-badge is-${status.toLowerCase()}`}>{STATUS_LABELS[status]}</span>
                <span className="ip-topbar-rounds">{rounds.length} round{rounds.length === 1 ? '' : 's'}</span>
              </div>
            )}
          </div>
          <div className="ip-topbar-actions">
            {!isNew && (
              <select
                value={status}
                className="ip-status-select"
                onChange={(e) => { setStatus(e.target.value as InterviewProcessStatus); markDirty(); }}
              >
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            )}
            <button
              type="button"
              className="sa-btn"
              onClick={() => void save()}
              disabled={saving || (!dirty && !isNew)}
            >
              {saving ? 'Saving…' : isNew ? 'Create & save' : 'Save changes'}
            </button>
          </div>
        </div>

        {saveError && <p className="sa-alert" style={{ marginBottom: 16 }}>{saveError}</p>}

        {/* ── Two-column layout ── */}
        <div className="ip-editor-grid">

          {/* ── LEFT: Process details ── */}
          <div className="ip-editor-left">
            <section className="ip-section">
              <div className="ip-section-head">
                <h2>Process details</h2>
                <p>Name this pipeline, describe its purpose, and choose the type of hire.</p>
              </div>
              <div className="ip-section-body">

                <div className="ip-field">
                  <label className="ip-label" htmlFor="ip-title">
                    Process name <i>required</i>
                  </label>
                  <input
                    id="ip-title"
                    type="text"
                    placeholder="e.g. Software Engineer — Campus Hiring 2026"
                    value={title}
                    maxLength={120}
                    onChange={(e) => { setTitle(e.target.value); markDirty(); }}
                  />
                </div>

                <div className="ip-field">
                  <label className="ip-label" htmlFor="ip-desc">
                    Description <i>optional</i>
                  </label>
                  <textarea
                    id="ip-desc"
                    rows={4}
                    placeholder="What is this process used for? Who is it aimed at?"
                    value={description}
                    maxLength={600}
                    onChange={(e) => { setDescription(e.target.value); markDirty(); }}
                  />
                  <span className="ip-char-count">{description.length} / 600</span>
                </div>

                <div className="ip-field">
                  <span className="ip-label">Hiring type</span>
                  <div className="ip-type-grid">
                    {(
                      [
                        { key: 'HIRING' as const, icon: '💼', label: 'Full-time / Lateral hire', hint: 'Permanent roles, contracts, or direct placements' },
                        { key: 'INTERNSHIP' as const, icon: '🎓', label: 'Internship', hint: 'Stipend-based or academic credit internships' },
                      ]
                    ).map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        className={`ip-type-card ${processType === t.key ? 'is-on' : ''}`}
                        onClick={() => { setProcessType(t.key); markDirty(); }}
                      >
                        <span className="ip-type-icon">{t.icon}</span>
                        <span>
                          <b>{t.label}</b>
                          <span>{t.hint}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </section>

            {/* Info card */}
            <div className="ip-info-card">
              <span className="ip-info-icon">💡</span>
              <div>
                <b>How this works</b>
                <p>
                  Build a process once and reuse it across multiple job openings and campus drives.
                  Each round can be marked as eliminating — only candidates who pass will advance.
                </p>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Rounds builder ── */}
          <div className="ip-editor-right">
            <section className="ip-section ip-rounds-section">
              <div className="ip-section-head">
                <div>
                  <h2>Interview rounds</h2>
                  <p>Drag to reorder · use ↑↓ buttons · click a round to edit it</p>
                </div>
                <span className="ip-rounds-count-badge">
                  {rounds.length} round{rounds.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="ip-section-body">
                {rounds.length === 0 && (
                  <div className="ip-rounds-empty">
                    <span>🎯</span>
                    <p>No rounds yet. Add your first one below.</p>
                  </div>
                )}

                {rounds.length > 0 && (
                  <ol className="ip-rounds">
                    {rounds.map((r, i) => (
                      <RoundCard
                        key={r._key}
                        round={r}
                        index={i}
                        total={rounds.length}
                        onToggle={() => toggleExpand(r._key)}
                        onMove={(dir) => moveRound(r._key, dir)}
                        onRemove={() => removeRound(r._key)}
                        onUpdate={(patch) => updateRound(r._key, patch)}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        isDragOver={dragOverKey === r._key}
                      />
                    ))}
                  </ol>
                )}

                {/* Add round picker */}
                {showRoundPicker ? (
                  <div className="ip-add-round-picker">
                    <div className="ip-picker-header">
                      <span>Choose a round type</span>
                      <button type="button" className="ip-icon-btn" onClick={() => setShowRoundPicker(false)}>×</button>
                    </div>
                    <div className="ip-picker-grid">
                      {ROUND_TYPES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          className="ip-picker-card"
                          onClick={() => addRound(t)}
                        >
                          <span className="ip-picker-icon">{ROUND_TYPE_ICONS[t]}</span>
                          <b>{ROUND_TYPE_LABELS[t]}</b>
                          <span>{ROUND_TYPE_HINTS[t]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="ip-add-round-btn"
                    onClick={() => setShowRoundPicker(true)}
                  >
                    <span>＋</span> Add a round
                  </button>
                )}
              </div>
            </section>
          </div>

        </div>

        {/* ── Sticky save bar ── */}
        <div className="ip-save-bar">
          <span className={`ip-save-hint ${dirty ? 'is-dirty' : saved ? 'is-saved' : ''}`}>
            {saving
              ? 'Saving…'
              : dirty
              ? '● Unsaved changes'
              : saved
              ? '✓ Saved successfully'
              : isNew
              ? 'Fill in the details above and save.'
              : 'No unsaved changes.'}
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/company/interviews" className="sa-btn is-ghost" style={{ fontSize: 13 }}>
              Cancel
            </Link>
            <button
              type="button"
              className="sa-btn"
              onClick={() => void save()}
              disabled={saving || (!dirty && !isNew)}
            >
              {saving ? 'Saving…' : isNew ? 'Create process' : 'Save changes'}
            </button>
          </div>
        </div>

      </div>
    </Frame>
  );
}
