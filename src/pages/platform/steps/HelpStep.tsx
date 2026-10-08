import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../../api/client';
import { platformApi, type HelpQuestionInput } from '../../../api/platform';
import type { StepProps } from '../Onboarding';
import { StepFooter } from '../ui';

/** A question being edited, with a local key for React. */
interface Row extends HelpQuestionInput {
  key: string;
}

let next = 0;
const keyed = (q: HelpQuestionInput): Row => ({ ...q, key: `q${next++}` });

/**
 * Student help: the questions and answers in the help panel on every student
 * page.
 *
 * It starts from the platform's standard questions, so nobody begins with a
 * blank page; the institution keeps, rewords, hides or adds to them. Beside
 * the editor is the panel as a student will see it, so a change is checked
 * where it will be read.
 */
export default function HelpStep({ state, onSaved, goto }: StepProps) {
  const t = state!.tenant;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [isDefault, setIsDefault] = useState(false);
  const [preview, setPreview] = useState<number | null>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    platformApi
      .help(t.id)
      .then((r) => {
        setRows(r.questions.map(keyed));
        setIsDefault(r.isDefault);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load the questions.'));
  }, [t.id]);

  function update(key: string, patch: Partial<HelpQuestionInput>) {
    setRows((rs) => rs!.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function move(key: string, by: -1 | 1) {
    setRows((rs) => {
      const list = [...rs!];
      const i = list.findIndex((r) => r.key === key);
      const j = i + by;
      if (j < 0 || j >= list.length) return list;
      [list[i], list[j]] = [list[j]!, list[i]!];
      return list;
    });
  }

  function remove(key: string) {
    setRows((rs) => rs!.filter((r) => r.key !== key));
  }

  function add() {
    setRows((rs) => [...rs!, keyed({ question: '', answer: '', isVisible: true })]);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!rows) return;
    const incomplete = rows.find((r) => r.question.trim().length < 5 || r.answer.trim().length < 5);
    if (incomplete) {
      setError('Every question needs both a question and an answer - or remove the empty one.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await platformApi.saveHelp(
        t.id,
        rows.map(({ question, answer, isVisible }) => ({ question: question.trim(), answer: answer.trim(), isVisible })),
      );
      onSaved(res, 'people');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const visible = (rows ?? []).filter((r) => r.isVisible && r.question.trim());

  return (
    <form onSubmit={submit} noValidate>
      <section className="blk cg-blk">
        <div className="cg-bar">
          <div>
            <h2 className="blk-title">Questions students see</h2>
            <p className="blk-sub hs-sub">
              {isDefault
                ? 'These are the standard questions. Keep, reword or hide any, and add your own.'
                : `${visible.length} shown to students${rows && rows.length > visible.length ? ` · ${rows.length - visible.length} hidden` : ''}.`}
            </p>
          </div>
          <span className="cg-tools">
            <button type="button" className="btn btn-secondary btn-sm" onClick={add}>
              + Add a question
            </button>
          </span>
        </div>

        {!rows ? (
          <p className="muted">Loading…</p>
        ) : (
          <div className="hs">
            {/* --- the editor ------------------------------------------- */}
            <ol className="hs-list">
              {rows.map((r, i) => (
                <li key={r.key} className={`hs-item ${r.isVisible ? '' : 'is-hidden'}`}>
                  <div className="hs-item-head">
                    <span className="hs-n">{i + 1}</span>
                    <label className="hs-show">
                      <input
                        type="checkbox"
                        checked={r.isVisible}
                        onChange={(e) => update(r.key, { isVisible: e.target.checked })}
                      />
                      {r.isVisible ? 'Shown' : 'Hidden'}
                    </label>
                    <span className="hs-tools">
                      <button type="button" className="icon-btn" onClick={() => move(r.key, -1)} disabled={i === 0} aria-label="Move up">
                        ↑
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => move(r.key, 1)}
                        disabled={i === rows.length - 1}
                        aria-label="Move down"
                      >
                        ↓
                      </button>
                      <button type="button" className="icon-btn hs-del" onClick={() => remove(r.key)} aria-label="Remove">
                        ×
                      </button>
                    </span>
                  </div>
                  <input
                    className="input hs-q"
                    value={r.question}
                    onChange={(e) => update(r.key, { question: e.target.value })}
                    onFocus={() => setPreview(visible.findIndex((v) => v.key === r.key))}
                    placeholder="The question, as a student would ask it"
                    maxLength={300}
                  />
                  <textarea
                    className="input hs-a"
                    value={r.answer}
                    onChange={(e) => update(r.key, { answer: e.target.value })}
                    onFocus={() => setPreview(visible.findIndex((v) => v.key === r.key))}
                    placeholder="A short, plain answer"
                    rows={3}
                    maxLength={3000}
                  />
                </li>
              ))}
              {rows.length === 0 && (
                <li className="hs-empty">
                  No questions. Students will see the standard ones until you add some.
                </li>
              )}
            </ol>

            {/* --- what a student sees ----------------------------------- */}
            <aside className="hs-preview" aria-label="Preview">
              <p className="hs-preview-tag">What students see</p>
              <div className="hs-panel">
                <p className="hs-panel-tag">Questions &amp; answers</p>
                <ul>
                  {visible.map((v, i) => (
                    <li key={v.key} className={preview === i ? 'is-open' : ''}>
                      <button type="button" onClick={() => setPreview(preview === i ? null : i)}>
                        <span>{v.question}</span>
                        <i aria-hidden="true" />
                      </button>
                      {preview === i && <p>{v.answer || '…'}</p>}
                    </li>
                  ))}
                  {visible.length === 0 && <li className="hs-panel-none">Nothing shown yet.</li>}
                </ul>
              </div>
            </aside>
          </div>
        )}
      </section>

      <StepFooter
        busy={busy}
        error={error}
        onBack={() => goto('features')}
        submitLabel="Save & continue"
        note={rows ? `${visible.length} question${visible.length === 1 ? '' : 's'} shown` : null}
      />
    </form>
  );
}
