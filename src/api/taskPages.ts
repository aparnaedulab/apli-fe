/**
 * The pages inside a task: what a student reads and the quick checks they
 * answer before handing it in.
 *
 * Companies write `PageDraft`s, with the answers. Students receive
 * `StudentPage`s, with the answers taken out, and get each check marked by
 * the server as a `MarkedCheck`.
 */

/** A written answer, in the student's words; the reviewer reads it. */
export interface TextDraft {
  id?: string;
  kind: 'text';
  prompt: string;
  /** Shown under the box: what a good answer covers. */
  hint?: string | null;
  /** The fewest words that count; 0 for any. */
  minWords?: number;
  explain?: string | null;
}

export interface ChoiceDraft {
  id?: string;
  kind: 'choice';
  prompt: string;
  options: string[];
  /** "Pick several" when true, "pick one" when false. */
  multiple: boolean;
  /** Which options are right, by position. */
  correct: number[];
  explain?: string | null;
}

export interface SortDraft {
  id?: string;
  kind: 'sort';
  prompt: string;
  groups: string[];
  /** Each item and the group it belongs in, by position. */
  items: { text: string; group: number }[];
  explain?: string | null;
}

export interface OrderDraft {
  id?: string;
  kind: 'order';
  prompt: string;
  /** The items in the right order; students get them shuffled. */
  items: string[];
  explain?: string | null;
}

export type QuestionDraft = TextDraft | ChoiceDraft | SortDraft | OrderDraft;

/** The kinds of question a company can choose from, in the order the picker shows them. */
export type QuestionKind = 'text' | 'one' | 'many' | 'order' | 'sort';

export interface ReadDraft {
  id?: string;
  kind: 'read';
  title: string;
  body: string;
  videoUrl?: string | null;
}

export interface CheckDraft {
  id?: string;
  kind: 'check';
  title: string;
  questions: QuestionDraft[];
}

export type PageDraft = ReadDraft | CheckDraft;

export type StudentQuestion =
  | { id: string; kind: 'text'; prompt: string; hint: string | null; minWords: number }
  | { id: string; kind: 'choice'; prompt: string; options: string[]; multiple: boolean }
  | { id: string; kind: 'sort'; prompt: string; groups: string[]; items: string[] }
  | { id: string; kind: 'order'; prompt: string; items: string[] };

export type StudentPage =
  | { id: string; kind: 'read'; title: string; body: string; videoUrl: string | null }
  | { id: string; kind: 'check'; title: string; questions: StudentQuestion[] };

/**
 * For a choice, the options picked; for a sort, the group picked for each
 * item; for an order, the items as shown, in the order the student put them.
 */
export type Answers = Record<string, number[] | string>;

/** One try at a test: its number, its score, and whether it was sent to the company. */
export interface CheckTry {
  number: number;
  score: number;
  total: number;
  at: string;
  sentAt: string | null;
}

export interface MarkedCheck {
  answers: Answers;
  score: number;
  total: number;
  /**
   * `correct` is null for a written answer: the reviewer reads it. The right
   * answer and the explanation are empty until the student chooses to see them.
   */
  questions: Record<string, { correct: boolean | null; solution: number[]; explain: string | null }>;
  /** They chose to see the answers; the test cannot be taken again. */
  revealed: boolean;
  /** Every try, first to latest. The latest is the one that counts. */
  tries: CheckTry[];
}

export const newText = (): TextDraft => ({ kind: 'text', prompt: '', hint: '', minWords: 0, explain: '' });
export const newChoice = (multiple = false): ChoiceDraft => ({
  kind: 'choice',
  prompt: '',
  options: ['', '', ''],
  multiple,
  correct: [],
  explain: '',
});

/** A blank question of the chosen kind. */
export function newQuestion(kind: QuestionKind): QuestionDraft {
  if (kind === 'text') return newText();
  if (kind === 'one') return newChoice(false);
  if (kind === 'many') return newChoice(true);
  if (kind === 'order') return newOrder();
  return newSort();
}

/** The kind of question, as the picker names it. */
export function kindOf(q: QuestionDraft): QuestionKind {
  if (q.kind === 'choice') return q.multiple ? 'many' : 'one';
  return q.kind;
}

/** Each kind, as a company sees it when choosing. */
export const QUESTION_KINDS: { key: QuestionKind; label: string; does: string; marked: string; icon: string }[] = [
  { key: 'text', label: 'Written answer', does: 'They write an answer in their own words.', marked: 'Read by the reviewer', icon: '✎' },
  { key: 'one', label: 'Pick one', does: 'They choose the one right option.', marked: 'Marked automatically', icon: '◉' },
  { key: 'many', label: 'Pick several', does: 'They tick every right option.', marked: 'Marked automatically', icon: '☑' },
  { key: 'order', label: 'Drag into order', does: 'They drag cards into the right sequence.', marked: 'Marked automatically', icon: '⇅' },
  { key: 'sort', label: 'Drag into groups', does: 'They drag each card into the right box.', marked: 'Marked automatically', icon: '⇄' },
];

/** The ways a task can be handed in. */
export type HandInKind = 'text' | 'link' | 'file';
export const HAND_IN_KINDS: { key: HandInKind; label: string; does: string }[] = [
  { key: 'text', label: 'Written answer', does: 'They type their answer.' },
  { key: 'link', label: 'Link', does: 'A sheet, doc, slides or code they made.' },
  { key: 'file', label: 'File upload', does: 'A PDF or a picture, up to 5 MB.' },
];
export const newSort = (): SortDraft => ({
  kind: 'sort',
  prompt: '',
  groups: ['', ''],
  items: [
    { text: '', group: 0 },
    { text: '', group: 1 },
  ],
  explain: '',
});
export const newOrder = (): OrderDraft => ({ kind: 'order', prompt: '', items: ['', '', ''], explain: '' });
export const newRead = (): ReadDraft => ({ kind: 'read', title: '', body: '', videoUrl: '' });
export const newCheck = (): CheckDraft => ({ kind: 'check', title: 'Quick check', questions: [] });

/**
 * A YouTube or Vimeo address, as the player's own embed address. Anything
 * else is not shown: the app only ever frames those two players.
 */
export function videoEmbed(url: string | null | undefined): string | null {
  if (!url) return null;
  const yt = url.match(/^https:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/i);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vimeo = url.match(/^https:\/\/(?:www\.)?vimeo\.com\/(\d+)/i);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}
