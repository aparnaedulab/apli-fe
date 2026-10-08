import { useCallback, useEffect, useState } from 'react';
import AdminLayout from './AdminLayout';
import { ApiError } from '../../api/client';
import { interviewBankApi, type BankQuestion, type BankRound, type InterviewKind } from '../../api/interviewBank';
import { useAuth } from '../../auth/AuthContext';
import './InterviewQuestions.css';

/** What each answer type is, in words an admin writing a question will use. */
const TYPE_LABEL: Record<string, string> = {
  intro: 'Introduction',
  behavioural: 'Past experience',
  motivation: 'Motivation',
  technical: 'Subject knowledge',
  situational: 'What would you do',
};

interface Row extends BankQuestion {
  key: string;
}

let seq = 0;
const keyed = (q: BankQuestion): Row => ({ ...q, key: `r${seq++}` });

/**
 * The questions students are asked in mock interviews.
 *
 * Round by round: HR, managerial, and technical for each role. A round this
 * institution has not edited uses the built-in questions; editing it starts
 * from those, and saving makes the list this institution's own. Each session
 * a student starts takes five questions from the round's shown questions.
 */
export default function InterviewQuestions() {
  const { can } = useAuth();
  const canEdit = can('college:write');

  const [kind, setKind] = useState<InterviewKind>('HR');
  const [role, setRole] = useState('software');
  const [meta, setMeta] = useState<Pick<BankRound, 'kinds' | 'roles' | 'types'> | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [isDefault, setIsDefault] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const roundRole = kind === 'TECHNICAL' ? role : '';

  const load = useCallback(() => {
    setRows(null);
    setError(null);
    setSaved(false);
    interviewBankApi
      .round(kind, roundRole)
      .then((r) => {
        setMeta({ kinds: r.kinds, roles: r.roles, types: r.types });
        setRows(r.questions.map(keyed));
        setIsDefault(r.isDefault);
        setDirty(false);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load the questions.'));
  }, [kind, roundRole]);

  useEffect(load, [load]);

  function change(fn: (rs: Row[]) => Row[]) {
    setRows((rs) => fn(rs ?? []));
    setDirty(true);
    setSaved(false);
  }

  const update = (key: string, patch: Partial<BankQuestion>) =>
    change((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const move = (key: string, by: -1 | 1) =>
    change((rs) => {
      const list = [...rs];
      const i = list.findIndex((r) => r.key === key);
      const j = i + by;
      if (j < 0 || j >= list.length) return list;
      [list[i], list[j]] = [list[j]!, list[i]!];
      return list;
    });

  async function save() {
    if (!rows) return;
    if (rows.some((r) => r.text.trim().length < 8)) {
      setError('Every question needs its text - or remove the empty one.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await interviewBankApi.save(
        kind,
        roundRole,
        rows.map(({ text, type, isVisible }) => ({ text: text.trim(), type, isVisible })),
      );
      setRows(r.questions.map(keyed));
      setIsDefault(r.isDefault);
      setDirty(false);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  /** Switching round with unsaved changes asks first. */
  function pick(next: () => void) {
    if (dirty && !window.confirm('You have unsaved changes in this round. Leave without saving?')) return;
    next();
  }

  const shown = (rows ?? []).filter((r) => r.isVisible).length;

  return (
    <AdminLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Student preparation</p>
          <h1>Interview questions</h1>
          <p className="page-lede">
            The questions students are asked when they practise a mock interview. Each practice session picks five
            from the round they choose.
          </p>
        </div>
      </header>

      {/* Which round. */}
      <div className="iq-rounds" role="tablist" aria-label="Round">
        {(meta?.kinds ?? [
          { key: 'HR', label: 'HR round' },
          { key: 'TECHNICAL', label: 'Technical round' },
          { key: 'MANAGERIAL', label: 'Managerial round' },
        ]).map((k) => (
          <button
            key={k.key}
            type="button"
            role="tab"
            aria-selected={kind === k.key}
            className={`iq-round ${kind === k.key ? 'is-on' : ''}`}
            onClick={() => pick(() => setKind(k.key as InterviewKind))}
          >
            {k.label}
          </button>
        ))}
      </div>

      {kind === 'TECHNICAL' && meta && (
        <div className="iq-roles" role="tablist" aria-label="Role">
          {meta.roles.map((r) => (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={role === r.key}
              className={`iq-role ${role === r.key ? 'is-on' : ''}`}
              onClick={() => pick(() => setRole(r.key))}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {error && <p className="alert alert-error">{error}</p>}
      {saved && <p className="alert alert-ok">Saved. New practice sessions use this list.</p>}

      <section className="card iq-card">
        <div className="iq-bar">
          <p className="iq-status">
            {isDefault ? (
              <span className="iq-badge">Standard questions</span>
            ) : (
              <span className="iq-badge is-own">Your questions</span>
            )}
            {rows && (
              <span className="muted">
                {shown} shown to students{rows.length > shown ? ` · ${rows.length - shown} hidden` : ''}
              </span>
            )}
          </p>
          {canEdit && (
            <span className="iq-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => change((rs) => [...rs, keyed({ text: '', type: kind === 'TECHNICAL' ? 'technical' : 'behavioural', isVisible: true })])}
              >
                + Add a question
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={busy || !dirty}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </span>
          )}
        </div>

        {isDefault && rows && (
          <p className="iq-note">
            These are the built-in questions. Change, hide or add to them and press Save - the list then becomes your
            institution’s own.
          </p>
        )}

        {rows === null ? (
          <p className="muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="iq-empty">No questions in this round. Add some, or students get the built-in ones.</p>
        ) : (
          <ol className="iq-list">
            {rows.map((r, i) => (
              <li key={r.key} className={`iq-item ${r.isVisible ? '' : 'is-hidden'}`}>
                <span className="iq-n">{i + 1}</span>
                <div className="iq-main">
                  <input
                    className="iq-text"
                    value={r.text}
                    onChange={(e) => update(r.key, { text: e.target.value })}
                    placeholder="The question, as an interviewer would ask it"
                    disabled={!canEdit}
                    maxLength={400}
                  />
                  <div className="iq-meta">
                    <label>
                      <span className="sr-only">Kind of answer</span>
                      <select
                        value={r.type}
                        onChange={(e) => update(r.key, { type: e.target.value })}
                        disabled={!canEdit}
                      >
                        {(meta?.types ?? Object.keys(TYPE_LABEL)).map((t) => (
                          <option key={t} value={t}>
                            {TYPE_LABEL[t] ?? t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="iq-show">
                      <input
                        type="checkbox"
                        checked={r.isVisible}
                        onChange={(e) => update(r.key, { isVisible: e.target.checked })}
                        disabled={!canEdit}
                      />
                      {r.isVisible ? 'Shown' : 'Hidden'}
                    </label>
                  </div>
                </div>
                {canEdit && (
                  <span className="iq-tools">
                    <button type="button" onClick={() => move(r.key, -1)} disabled={i === 0} aria-label="Move up">
                      ↑
                    </button>
                    <button type="button" onClick={() => move(r.key, 1)} disabled={i === rows.length - 1} aria-label="Move down">
                      ↓
                    </button>
                    <button
                      type="button"
                      className="iq-del"
                      onClick={() => change((rs) => rs.filter((x) => x.key !== r.key))}
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </AdminLayout>
  );
}
