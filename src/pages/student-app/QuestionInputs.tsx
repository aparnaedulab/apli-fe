import { useState, type DragEvent } from 'react';
import type { StudentQuestion } from '../../api/taskPages';

/**
 * The ways a student answers a question: writing, picking, dragging cards
 * into groups, and dragging cards into order. Used by the test itself and by
 * the practice in the test's onboarding, so both behave the same.
 */

export const LETTERS = 'ABCDEFGH';
const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

/** A written answer, with the company's hint and a word count. */
export function Written({
  q,
  given,
  locked,
  onChange,
}: {
  q: Extract<StudentQuestion, { kind: 'text' }>;
  given: string;
  locked: boolean;
  onChange: (v: string) => void;
}) {
  const n = words(given);
  return (
    <div className="qc-written">
      <textarea
        rows={6}
        value={given}
        readOnly={locked}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write your answer here, in your own words."
        aria-label="Your answer"
      />
      <span className="qc-written-foot">
        {q.hint && <span>{q.hint}</span>}
        <b className={q.minWords && n < q.minWords ? 'is-short' : ''}>
          {n} word{n === 1 ? '' : 's'}
          {q.minWords ? ` · at least ${q.minWords}` : ''}
        </b>
      </span>
    </div>
  );
}

/** Lettered cards; one or several, as the question says. */
export function Choice({
  q,
  given,
  solution,
  locked,
  onChange,
}: {
  q: Extract<StudentQuestion, { kind: 'choice' }>;
  given: number[];
  solution?: number[];
  locked: boolean;
  onChange: (v: number[]) => void;
}) {
  return (
    <div className="qc-options" role={q.multiple ? 'group' : 'radiogroup'}>
      {q.options.map((o, i) => {
        const chosen = given.includes(i);
        const right = solution?.includes(i);
        return (
          <button
            key={i}
            type="button"
            role={q.multiple ? 'checkbox' : 'radio'}
            aria-checked={chosen}
            disabled={locked}
            className={[
              'qc-option',
              chosen ? 'is-chosen' : '',
              solution && right ? 'is-solution' : '',
              solution && chosen && !right ? 'is-miss' : '',
            ].join(' ')}
            onClick={() => onChange(q.multiple ? (chosen ? given.filter((x) => x !== i) : [...given, i]) : [i])}
          >
            <span className="qc-letter">{solution ? (right ? '✓' : chosen ? '✗' : LETTERS[i]) : LETTERS[i]}</span>
            <span>{o}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Cards into groups. Drag a card into a group, or tap it and then the group.
 * A placed card can be dragged elsewhere, or sent back with ×.
 */
export function Sort({
  q,
  given,
  solution,
  locked,
  onChange,
}: {
  q: Extract<StudentQuestion, { kind: 'sort' }>;
  given: number[] | undefined;
  solution?: number[];
  locked: boolean;
  onChange: (v: number[]) => void;
}) {
  const placed = given && given.length === q.items.length ? given : q.items.map(() => -1);
  const [picked, setPicked] = useState<number | null>(null);
  const [over, setOver] = useState<number | 'tray' | null>(null);

  const place = (item: number, group: number) => {
    const next = [...placed];
    next[item] = group;
    onChange(next);
    setPicked(null);
  };

  const drop = (target: number) => (e: DragEvent) => {
    e.preventDefault();
    const item = Number(e.dataTransfer.getData('text/plain'));
    if (!Number.isNaN(item)) place(item, target);
    setOver(null);
  };

  const card = (i: number) => {
    const inGroup = placed[i]!;
    const wrong = solution && inGroup !== solution[i];
    return (
      <span
        key={i}
        className={[
          'qc-card-item',
          picked === i ? 'is-picked' : '',
          solution ? (wrong ? 'is-wrong' : 'is-right') : '',
        ].join(' ')}
        draggable={!locked}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', String(i));
          e.dataTransfer.effectAllowed = 'move';
        }}
      >
        <button
          type="button"
          className="qc-card-text"
          disabled={locked}
          onClick={() => setPicked(picked === i ? null : i)}
          aria-pressed={picked === i}
          aria-label={`${q.items[i]}${picked === i ? ' - picked, now choose a group' : ''}`}
        >
          {!locked && (
            <span className="qc-grip" aria-hidden="true">
              ⋮⋮
            </span>
          )}
          {q.items[i]}
        </button>
        {solution && wrong && <span className="qc-should">Belongs in: {q.groups[solution[i]!]}</span>}
        {!locked && inGroup >= 0 && (
          <button type="button" className="qc-unplace" onClick={() => place(i, -1)} aria-label={`Take ${q.items[i]} out`}>
            ×
          </button>
        )}
      </span>
    );
  };

  const tray = q.items.map((_, i) => i).filter((i) => placed[i] === -1);

  return (
    // Cards on the left, groups stacked on the right: drag across.
    <div className="qc-match">
      <div
        className={`qc-tray ${over === 'tray' ? 'is-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver('tray');
        }}
        onDragLeave={() => setOver(null)}
        onDrop={drop(-1)}
      >
        <span className="qc-zone-label">
          {locked ? 'Your answers' : tray.length ? 'Drag from here' : 'All placed - drag to move'}
        </span>
        <div className="qc-zone-cards">
          {tray.map(card)}
          {!tray.length && <span className="qc-zone-empty">{locked ? 'Every card was placed.' : 'Drop a card back here to take it out.'}</span>}
        </div>
      </div>
      <div className="qc-groups">
        {q.groups.map((g, gi) => {
          const here = q.items.map((_, i) => i).filter((i) => placed[i] === gi);
          return (
            <div
              key={gi}
              className={`qc-group ${over === gi ? 'is-over' : ''} ${picked !== null ? 'is-target' : ''} ${here.length ? 'has-cards' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(gi);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={drop(gi)}
            >
              <button
                type="button"
                className="qc-group-name"
                disabled={locked || picked === null}
                onClick={() => picked !== null && place(picked, gi)}
              >
                <span>{g}</span>
                {picked !== null && !locked ? <em>Put here</em> : !here.length && <i aria-hidden="true">?</i>}
              </button>
              {here.length > 0 && <div className="qc-zone-cards">{here.map(card)}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Cards into order. Drag a card up or down by its handle, or use the arrows. */
export function Order({
  q,
  given,
  solution,
  locked,
  onChange,
}: {
  q: Extract<StudentQuestion, { kind: 'order' }>;
  given: number[];
  solution?: number[];
  locked: boolean;
  onChange: (v: number[]) => void;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= given.length) return;
    const next = [...given];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it!);
    onChange(next);
  };

  return (
    <ol className="qc-order">
      {given.map((item, pos) => {
        const rightPos = solution ? solution.indexOf(item) : -1;
        const wrong = solution && rightPos !== pos;
        return (
          <li
            key={item}
            className={[
              dragging === pos ? 'is-dragging' : '',
              over === pos && dragging !== null && dragging !== pos ? 'is-over' : '',
              solution ? (wrong ? 'is-wrong' : 'is-right') : '',
            ].join(' ')}
            draggable={!locked}
            onDragStart={(e) => {
              setDragging(pos);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', String(pos));
            }}
            onDragEnd={() => {
              setDragging(null);
              setOver(null);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(pos);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const from = Number(e.dataTransfer.getData('text/plain'));
              if (!Number.isNaN(from)) move(from, pos);
              setDragging(null);
              setOver(null);
            }}
          >
            <span className="qc-pos">{pos + 1}</span>
            {!locked && (
              <span className="qc-grip" aria-hidden="true">
                ⋮⋮
              </span>
            )}
            <span className="qc-order-text">{q.items[item]}</span>
            {solution && wrong && <span className="qc-should">Should be {rightPos + 1}</span>}
            {!locked && (
              <span className="qc-arrows">
                <button type="button" onClick={() => move(pos, pos - 1)} disabled={pos === 0} aria-label={`Move "${q.items[item]}" up`}>
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(pos, pos + 1)}
                  disabled={pos === given.length - 1}
                  aria-label={`Move "${q.items[item]}" down`}
                >
                  ↓
                </button>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
