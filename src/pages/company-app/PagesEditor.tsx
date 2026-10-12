import { useState } from 'react';
import {
  kindOf,
  newCheck,
  newQuestion,
  newRead,
  QUESTION_KINDS,
  type ChoiceDraft,
  type OrderDraft,
  type PageDraft,
  type QuestionDraft,
  type QuestionKind,
  type SortDraft,
  type TextDraft,
} from '../../api/taskPages';

const MAX_PAGES = 10;
const MAX_QUESTIONS = 8;

/** What a page still needs before the simulation can be sent. */
export function pageGaps(p: PageDraft): string[] {
  if (p.kind === 'read') {
    const gaps: string[] = [];
    if (p.title.trim().length < 2) gaps.push('a title');
    if (p.body.trim().length < 20) gaps.push('a few sentences');
    return gaps;
  }
  const gaps: string[] = [];
  if (!p.questions.length) gaps.push('a question');
  p.questions.forEach((q, i) => {
    const n = `question ${i + 1}`;
    if (q.prompt.trim().length < 5) gaps.push(`${n} written`);
    if (q.kind === 'choice') {
      if (q.options.some((o) => !o.trim())) gaps.push(`${n}: fill every option`);
      if (!q.correct.length) gaps.push(`${n}: mark the right answer`);
      if (!q.multiple && q.correct.length > 1) gaps.push(`${n}: only one right answer`);
    } else if (q.kind === 'sort') {
      if (q.groups.some((g) => !g.trim())) gaps.push(`${n}: name every group`);
      if (q.items.some((it) => !it.text.trim())) gaps.push(`${n}: fill every item`);
    } else if (q.kind === 'order' && q.items.some((it) => !it.trim())) {
      gaps.push(`${n}: fill every step`);
    }
  });
  return gaps;
}

/**
 * The pages inside one task, in the order a student goes through them:
 * pages to read, and quick checks. A question is added by first choosing
 * its kind - written, pick one, pick several, drag into order, drag into
 * groups - so what the student will do is decided before it is written.
 */
export default function PagesEditor({ pages, onChange }: { pages: PageDraft[]; onChange: (p: PageDraft[]) => void }) {
  const [open, setOpen] = useState<number | null>(pages.length ? 0 : null);
  /** The check whose "add a question" picker is open. */
  const [picking, setPicking] = useState<number | null>(null);

  const set = (i: number, p: PageDraft) => onChange(pages.map((x, j) => (j === i ? p : x)));
  const add = (p: PageDraft) => {
    if (pages.length >= MAX_PAGES) return;
    onChange([...pages, p]);
    setOpen(pages.length);
    // A new check opens straight onto choosing its first question.
    if (p.kind === 'check') setPicking(pages.length);
  };
  const move = (i: number, by: -1 | 1) => {
    const next = [...pages];
    const [p] = next.splice(i, 1);
    next.splice(i + by, 0, p!);
    onChange(next);
    setOpen(i + by);
  };
  const remove = (i: number) => {
    onChange(pages.filter((_, j) => j !== i));
    setOpen(null);
  };

  return (
    <div className="pe">
      {pages.length === 0 && (
        <p className="pe-empty">
          No pages yet. A student goes straight from the brief to handing in. Add a page to explain something first, or a test
          to make sure they have understood.
        </p>
      )}
      <ol className="pe-list">
        {pages.map((p, i) => {
          const gaps = pageGaps(p);
          const isOpen = open === i;
          return (
            <li key={p.id ?? `new-${i}`} className={`pe-page is-${p.kind} ${isOpen ? 'is-open' : ''}`}>
              <div className="pe-head">
                <button type="button" className="pe-toggle" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen}>
                  <span className="pe-kind">{p.kind === 'read' ? 'Read' : 'Test'}</span>
                  <b>{p.title.trim() || (p.kind === 'read' ? 'Untitled page' : 'Test')}</b>
                  <span className="pe-meta">
                    {p.kind === 'check' ? `${p.questions.length} question${p.questions.length === 1 ? '' : 's'}` : ''}
                  </span>
                  <span className={`ce-dot ${gaps.length ? '' : 'is-ok'}`} aria-label={gaps.length ? 'Needs work' : 'Complete'} />
                </button>
                <span className="ce-tools">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title="Move earlier">
                    ↑
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === pages.length - 1} title="Move later">
                    ↓
                  </button>
                  <button type="button" onClick={() => remove(i)} title="Remove this page" className="is-danger">
                    ×
                  </button>
                </span>
              </div>
              {isOpen && (
                <div className="pe-body">
                  {gaps.length > 0 && <p className="pe-gaps">Still needs: {gaps.join(', ')}.</p>}
                  {p.kind === 'read' ? (
                    <>
                      <label className="ce-field">
                        <span className="ce-label">Page title</span>
                        <input value={p.title} onChange={(e) => set(i, { ...p, title: e.target.value })} placeholder="e.g. How lenders read accounts" />
                      </label>
                      <label className="ce-field">
                        <span className="ce-label">
                          What to read <small>{p.body.trim().length} / 8000</small>
                        </span>
                        <textarea
                          rows={6}
                          value={p.body}
                          onChange={(e) => set(i, { ...p, body: e.target.value })}
                          placeholder="Explain the idea the student needs for this task, the way you would to a new joiner. A blank line starts a new paragraph."
                        />
                      </label>
                      <label className="ce-field">
                        <span className="ce-label">
                          Video <i>optional - YouTube or Vimeo</i>
                        </span>
                        <input
                          type="url"
                          value={p.videoUrl ?? ''}
                          onChange={(e) => set(i, { ...p, videoUrl: e.target.value })}
                          placeholder="https://www.youtube.com/watch?v=…"
                        />
                      </label>
                    </>
                  ) : (
                    <>
                      <label className="ce-field">
                        <span className="ce-label">Test title</span>
                        <input value={p.title} onChange={(e) => set(i, { ...p, title: e.target.value })} />
                      </label>
                      <ol className="pe-questions">
                        {p.questions.map((q, qi) => (
                          <li key={q.id ?? `q-${qi}`}>
                            <QuestionEditor
                              index={qi}
                              q={q}
                              onChange={(nq) => set(i, { ...p, questions: p.questions.map((x, k) => (k === qi ? nq : x)) })}
                              onRemove={() => set(i, { ...p, questions: p.questions.filter((_, k) => k !== qi) })}
                            />
                          </li>
                        ))}
                      </ol>
                      {p.questions.length < MAX_QUESTIONS &&
                        (picking === i ? (
                          <KindPicker
                            first={p.questions.length === 0}
                            onPick={(kind) => {
                              set(i, { ...p, questions: [...p.questions, newQuestion(kind)] });
                              setPicking(null);
                            }}
                            onCancel={p.questions.length ? () => setPicking(null) : undefined}
                          />
                        ) : (
                          <button type="button" className="pe-addq" onClick={() => setPicking(i)}>
                            + Add a question
                          </button>
                        ))}
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {pages.length < MAX_PAGES && (
        <div className="pe-add is-main">
          <button type="button" onClick={() => add(newRead())}>
            + Page to read
          </button>
          <button type="button" onClick={() => add(newCheck())}>
            + Test
          </button>
        </div>
      )}
    </div>
  );
}

/** Choosing what kind of question to write: what the student does, and how it is marked. */
function KindPicker({ first, onPick, onCancel }: { first: boolean; onPick: (k: QuestionKind) => void; onCancel?: () => void }) {
  return (
    <div className="pe-picker">
      <div className="pe-picker-head">
        <b>{first ? 'What kind of question is the first one?' : 'What kind of question?'}</b>
        {onCancel && (
          <button type="button" className="sa-quiet" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
      <div className="pe-kinds">
        {QUESTION_KINDS.map((k) => (
          <button key={k.key} type="button" className={`pe-kind-card is-${k.key}`} onClick={() => onPick(k.key)}>
            <span className="pe-kind-icon" aria-hidden="true">
              {k.icon}
            </span>
            <b>{k.label}</b>
            <span>{k.does}</span>
            <i>{k.marked}</i>
          </button>
        ))}
      </div>
    </div>
  );
}

function QuestionEditor({
  index,
  q,
  onChange,
  onRemove,
}: {
  index: number;
  q: QuestionDraft;
  onChange: (q: QuestionDraft) => void;
  onRemove: () => void;
}) {
  const kind = QUESTION_KINDS.find((k) => k.key === kindOf(q))!;
  return (
    <div className={`pe-q is-${kind.key}`}>
      <div className="pe-q-head">
        <span className="pe-q-n">Q{index + 1}</span>
        <span className="pe-q-kind">
          <span aria-hidden="true">{kind.icon}</span> {kind.label} <i>· {kind.marked.toLowerCase()}</i>
        </span>
        <button type="button" className="sa-quiet" onClick={onRemove}>
          Remove
        </button>
      </div>
      <label className="ce-field">
        <span className="ce-label">Question</span>
        <textarea rows={2} value={q.prompt} onChange={(e) => onChange({ ...q, prompt: e.target.value })} />
      </label>
      {q.kind === 'text' ? (
        <TextEditor q={q} onChange={onChange} />
      ) : q.kind === 'choice' ? (
        <ChoiceEditor q={q} onChange={onChange} />
      ) : q.kind === 'sort' ? (
        <SortEditor q={q} onChange={onChange} />
      ) : (
        <OrderEditor q={q} onChange={onChange} />
      )}
      <label className="ce-field">
        <span className="ce-label">
          {q.kind === 'text' ? 'What a good answer covers' : 'Why'}{' '}
          <i>optional - shown once they have answered</i>
        </span>
        <input
          value={q.explain ?? ''}
          onChange={(e) => onChange({ ...q, explain: e.target.value })}
          placeholder={q.kind === 'text' ? 'The points you hoped to see.' : 'One line on why the answer is right.'}
        />
      </label>
    </div>
  );
}

/** A written answer: a hint under the box, and the fewest words that count. */
function TextEditor({ q, onChange }: { q: TextDraft; onChange: (q: TextDraft) => void }) {
  return (
    <div className="ce-row">
      <label className="ce-field">
        <span className="ce-label">
          Hint under the box <i>optional</i>
        </span>
        <input value={q.hint ?? ''} onChange={(e) => onChange({ ...q, hint: e.target.value })} placeholder="e.g. Two or three sentences is enough." />
      </label>
      <label className="ce-field">
        <span className="ce-label">
          Fewest words <i>0 for any</i>
        </span>
        <input type="number" min={0} max={500} value={q.minWords ?? 0} onChange={(e) => onChange({ ...q, minWords: Number(e.target.value) })} />
      </label>
    </div>
  );
}

/**
 * Options, with the right answer marked. "Pick one" marks exactly one, with
 * round markers; "pick several" ticks every right one.
 */
function ChoiceEditor({ q, onChange }: { q: ChoiceDraft; onChange: (q: ChoiceDraft) => void }) {
  const mark = (i: number) =>
    onChange({
      ...q,
      correct: q.multiple ? (q.correct.includes(i) ? q.correct.filter((c) => c !== i) : [...q.correct, i].sort((a, b) => a - b)) : [i],
    });
  const removeOption = (i: number) =>
    onChange({
      ...q,
      options: q.options.filter((_, j) => j !== i),
      correct: q.correct.filter((c) => c !== i).map((c) => (c > i ? c - 1 : c)),
    });
  return (
    <div className="pe-options">
      <span className="ce-label">
        Options <i>{q.multiple ? 'tick every right answer' : 'mark the one right answer'}</i>
      </span>
      {q.options.map((o, i) => (
        <span key={i} className={`pe-option ${q.correct.includes(i) ? 'is-right' : ''}`}>
          <input
            type={q.multiple ? 'checkbox' : 'radio'}
            name={q.multiple ? undefined : `right-${q.id ?? q.prompt}`}
            checked={q.correct.includes(i)}
            onChange={() => mark(i)}
            aria-label={`Option ${i + 1} is right`}
          />
          <input
            value={o}
            onChange={(e) => onChange({ ...q, options: q.options.map((x, j) => (j === i ? e.target.value : x)) })}
            placeholder={`Option ${i + 1}`}
          />
          {q.options.length > 2 && (
            <button type="button" onClick={() => removeOption(i)} aria-label="Remove option">
              ×
            </button>
          )}
        </span>
      ))}
      {q.options.length < 6 && (
        <button type="button" className="ce-list-add" onClick={() => onChange({ ...q, options: [...q.options, ''] })}>
          + Add an option
        </button>
      )}
    </div>
  );
}

/** Groups, then items each placed in the group it belongs in. */
function SortEditor({ q, onChange }: { q: SortDraft; onChange: (q: SortDraft) => void }) {
  const removeGroup = (g: number) =>
    onChange({
      ...q,
      groups: q.groups.filter((_, j) => j !== g),
      items: q.items.map((it) => ({ ...it, group: it.group === g ? 0 : it.group > g ? it.group - 1 : it.group })),
    });
  return (
    <div className="pe-sort">
      <div className="pe-groups">
        <span className="ce-label">Groups</span>
        {q.groups.map((g, i) => (
          <span key={i} className="pe-option">
            <span className="pe-group-n">{String.fromCharCode(65 + i)}</span>
            <input
              value={g}
              onChange={(e) => onChange({ ...q, groups: q.groups.map((x, j) => (j === i ? e.target.value : x)) })}
              placeholder={`Group ${String.fromCharCode(65 + i)}`}
            />
            {q.groups.length > 2 && (
              <button type="button" onClick={() => removeGroup(i)} aria-label="Remove group">
                ×
              </button>
            )}
          </span>
        ))}
        {q.groups.length < 6 && (
          <button type="button" className="ce-list-add" onClick={() => onChange({ ...q, groups: [...q.groups, ''] })}>
            + Add a group
          </button>
        )}
      </div>
      <div className="pe-items">
        <span className="ce-label">Items and where each belongs</span>
        {q.items.map((it, i) => (
          <span key={i} className="pe-option">
            <input
              value={it.text}
              onChange={(e) => onChange({ ...q, items: q.items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
              placeholder={`Item ${i + 1}`}
            />
            <select
              value={it.group}
              onChange={(e) =>
                onChange({ ...q, items: q.items.map((x, j) => (j === i ? { ...x, group: Number(e.target.value) } : x)) })
              }
              aria-label={`Group for item ${i + 1}`}
            >
              {q.groups.map((g, gi) => (
                <option key={gi} value={gi}>
                  {String.fromCharCode(65 + gi)}
                  {g.trim() ? ` - ${g.trim()}` : ''}
                </option>
              ))}
            </select>
            {q.items.length > 2 && (
              <button
                type="button"
                onClick={() => onChange({ ...q, items: q.items.filter((_, j) => j !== i) })}
                aria-label="Remove item"
              >
                ×
              </button>
            )}
          </span>
        ))}
        {q.items.length < 10 && (
          <button type="button" className="ce-list-add" onClick={() => onChange({ ...q, items: [...q.items, { text: '', group: 0 }] })}>
            + Add an item
          </button>
        )}
      </div>
    </div>
  );
}

/** The items in the right order. Students get them shuffled and drag them back. */
function OrderEditor({ q, onChange }: { q: OrderDraft; onChange: (q: OrderDraft) => void }) {
  const move = (i: number, by: -1 | 1) => {
    const items = [...q.items];
    const [it] = items.splice(i, 1);
    items.splice(i + by, 0, it!);
    onChange({ ...q, items });
  };
  return (
    <div className="pe-options">
      <span className="ce-label">
        Steps <i>in the right order - students see them shuffled</i>
      </span>
      {q.items.map((it, i) => (
        <span key={i} className="pe-option">
          <span className="pe-group-n">{i + 1}</span>
          <input
            value={it}
            onChange={(e) => onChange({ ...q, items: q.items.map((x, j) => (j === i ? e.target.value : x)) })}
            placeholder={`Step ${i + 1}`}
          />
          <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
            ↑
          </button>
          <button type="button" onClick={() => move(i, 1)} disabled={i === q.items.length - 1} aria-label="Move down">
            ↓
          </button>
          {q.items.length > 3 && (
            <button type="button" onClick={() => onChange({ ...q, items: q.items.filter((_, j) => j !== i) })} aria-label="Remove step">
              ×
            </button>
          )}
        </span>
      ))}
      {q.items.length < 8 && (
        <button type="button" className="ce-list-add" onClick={() => onChange({ ...q, items: [...q.items, ''] })}>
          + Add a step
        </button>
      )}
    </div>
  );
}
