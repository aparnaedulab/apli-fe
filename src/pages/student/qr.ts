/**
 * A small QR code encoder: byte mode, error correction level M, versions 1-10.
 *
 * Written here rather than added as a dependency because a drive pass only
 * ever encodes one short signed token (well under 100 characters), and that
 * needs a few hundred lines, not a library. Level M survives a phone camera
 * held at an angle in a crowded corridor, which is where these get scanned.
 *
 * `encodeQr` returns a square grid, true = dark. The caller draws it.
 */

/** Per version at level M: [total codewords, EC codewords per block, [blocks, data per block][]]. */
const VERSIONS: [number, number, [number, number][]][] = [
  [26, 10, [[1, 16]]],
  [44, 16, [[1, 28]]],
  [70, 26, [[1, 44]]],
  [100, 18, [[2, 32]]],
  [134, 24, [[2, 43]]],
  [172, 16, [[4, 27]]],
  [196, 18, [[4, 31]]],
  [242, 22, [[2, 38], [2, 39]]],
  [292, 22, [[3, 36], [2, 37]]],
  [346, 26, [[4, 43], [1, 44]]],
];

const ALIGNMENT: number[][] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

/* --- Reed-Solomon over GF(256), primitive polynomial 0x11D ----------------- */

const EXP = new Array<number>(512);
const LOG = new Array<number>(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]!;
})();

const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a]! + LOG[b]!]!);

/** Error-correction codewords for one block of data. Exported for tests. */
export function reedSolomon(data: number[], ecLength: number): number[] {
  // Generator: product of (x - a^i) for i in 0..ecLength-1, highest degree first.
  let gen = [1];
  for (let i = 0; i < ecLength; i++) {
    const next = new Array<number>(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      next[j] = next[j]! ^ gen[j]!;
      next[j + 1] = next[j + 1]! ^ mul(gen[j]!, EXP[i]!);
    }
    gen = next;
  }
  const rem = new Array<number>(ecLength).fill(0);
  for (const d of data) {
    const factor = d ^ rem[0]!;
    rem.shift();
    rem.push(0);
    for (let j = 0; j < ecLength; j++) rem[j] = rem[j]! ^ mul(gen[j + 1]!, factor);
  }
  return rem;
}

/* --- building the data -------------------------------------------------- */

function utf8(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

function dataCodewords(bytes: number[], version: number): number[] {
  const [total, ec, groups] = VERSIONS[version - 1]!;
  const blocks = groups.reduce((n, [count]) => n + count, 0);
  const capacity = total - ec * blocks;

  const bits: number[] = [];
  const put = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  put(0b0100, 4); // byte mode
  put(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) put(b, 8);

  const room = capacity * 8;
  put(0, Math.min(4, room - bits.length)); // terminator
  while (bits.length % 8) bits.push(0);

  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    out.push(bits.slice(i, i + 8).reduce((v, b) => (v << 1) | b, 0));
  }
  for (let pad = 0xec; out.length < capacity; pad = pad === 0xec ? 0x11 : 0xec) out.push(pad);
  return out;
}

/** Splits into blocks, adds error correction, and interleaves - the final codeword stream. */
function finalCodewords(data: number[], version: number): number[] {
  const [, ec, groups] = VERSIONS[version - 1]!;
  const blocks: number[][] = [];
  let at = 0;
  for (const [count, size] of groups) {
    for (let i = 0; i < count; i++) {
      blocks.push(data.slice(at, at + size));
      at += size;
    }
  }
  const ecBlocks = blocks.map((b) => reedSolomon(b, ec));

  const out: number[] = [];
  const longest = Math.max(...blocks.map((b) => b.length));
  for (let i = 0; i < longest; i++) for (const b of blocks) if (i < b.length) out.push(b[i]!);
  for (let i = 0; i < ec; i++) for (const b of ecBlocks) out.push(b[i]!);
  return out;
}

/* --- the matrix ---------------------------------------------------------- */

type Grid = boolean[][];

function formatBits(mask: number): number {
  const data = (0 << 3) | mask; // level M is 00
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

function versionBits(version: number): number {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (version << 12) | rem;
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function build(codewords: number[], version: number, mask: number): Grid {
  const size = version * 4 + 17;
  const grid: Grid = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fixed: Grid = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (x: number, y: number, dark: boolean) => {
    grid[y]![x] = dark;
    fixed[y]![x] = true;
  };

  // Timing patterns.
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  // Finder patterns with their white separators.
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, d !== 2 && d !== 4);
      }
    }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);

  // Alignment patterns, skipping the three that would sit on a finder.
  const pos = ALIGNMENT[version - 1]!;
  for (let i = 0; i < pos.length; i++) {
    for (let j = 0; j < pos.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          set(pos[i]! + dx, pos[j]! + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }

  // Format information, both copies, and the always-dark module.
  const drawFormat = () => {
    const bits = formatBits(mask);
    const bit = (i: number) => ((bits >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6));
    set(8, 8, bit(7));
    set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  drawFormat();

  // Version information, from version 7.
  if (version >= 7) {
    const bits = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, dark);
      set(b, a, dark);
    }
  }

  // Data, in the zig-zag from the bottom right, then the mask on data modules only.
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (fixed[y]![x]) continue;
        if (i < codewords.length * 8) {
          grid[y]![x] = ((codewords[i >>> 3]! >>> (7 - (i & 7))) & 1) === 1;
          i++;
        }
      }
    }
  }
  const m = MASKS[mask]!;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!fixed[y]![x] && m(x, y)) grid[y]![x] = !grid[y]![x];
    }
  }
  return grid;
}

/** The standard penalty score; the mask with the lowest wins. */
function penalty(grid: Grid): number {
  const size = grid.length;
  let score = 0;

  const lines = (get: (a: number, b: number) => boolean) => {
    for (let a = 0; a < size; a++) {
      let run = 1;
      for (let b = 1; b <= size; b++) {
        if (b < size && get(a, b) === get(a, b - 1)) run++;
        else {
          if (run >= 5) score += 3 + (run - 5);
          run = 1;
        }
      }
      // Finder-like 1:1:3:1:1 with four light modules on one side.
      for (let b = 0; b + 10 < size; b++) {
        const seq = Array.from({ length: 11 }, (_, k) => get(a, b + k));
        const p1 = [true, false, true, true, true, false, true, false, false, false, false];
        const p2 = [false, false, false, false, true, false, true, true, true, false, true];
        if (p1.every((v, k) => seq[k] === v) || p2.every((v, k) => seq[k] === v)) score += 40;
      }
    }
  };
  lines((y, x) => grid[y]![x]!);
  lines((x, y) => grid[y]![x]!);

  for (let y = 0; y + 1 < size; y++) {
    for (let x = 0; x + 1 < size; x++) {
      const c = grid[y]![x];
      if (c === grid[y]![x + 1] && c === grid[y + 1]![x] && c === grid[y + 1]![x + 1]) score += 3;
    }
  }

  const dark = grid.reduce((n, row) => n + row.filter(Boolean).length, 0);
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;
  return score;
}

/**
 * Encodes text as a QR code. `mask` forces a mask pattern (for tests);
 * otherwise the one with the lowest penalty is chosen, as the standard says.
 */
export function encodeQr(text: string, opts: { mask?: number } = {}): Grid {
  const bytes = utf8(text);
  let version = 0;
  for (let v = 1; v <= VERSIONS.length; v++) {
    const [total, ec, groups] = VERSIONS[v - 1]!;
    const blocks = groups.reduce((n, [count]) => n + count, 0);
    const capacityBits = (total - ec * blocks) * 8;
    const needed = 4 + (v < 10 ? 8 : 16) + bytes.length * 8;
    if (needed <= capacityBits) {
      version = v;
      break;
    }
  }
  if (!version) throw new Error('Text is too long for this QR encoder.');

  const codewords = finalCodewords(dataCodewords(bytes, version), version);
  if (opts.mask !== undefined) return build(codewords, version, opts.mask);

  let best: Grid | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const grid = build(codewords, version, mask);
    const s = penalty(grid);
    if (s < bestScore) {
      bestScore = s;
      best = grid;
    }
  }
  return best!;
}

/** Draws the grid as an SVG path string, one unit per module, with a quiet zone of 4. */
export function qrSvgPath(grid: Grid): { path: string; size: number } {
  const quiet = 4;
  let path = '';
  grid.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) path += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    }),
  );
  return { path, size: grid.length + quiet * 2 };
}
