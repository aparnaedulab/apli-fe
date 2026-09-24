/**
 * An institution's colour, turned into the handful of tokens the portal uses.
 *
 * A tenant picks one colour. The portal needs four from it - the colour, a
 * hover shade, a soft wash for selected rows, and whatever text can sit on it
 * - in both light and dark mode. Deriving them here means a university that
 * chose a pale yellow still gets readable buttons, because the text colour is
 * chosen by contrast rather than assumed to be white.
 */

interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1]!.length === 3 ? m[1]!.replace(/./g, (c) => c + c) : m[1]!;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

const toHex = ({ r, g, b }: Rgb) =>
  `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;

/** Mixes `a` towards `b` by `t` (0 = a, 1 = b). */
function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}

/** WCAG relative luminance. */
function luminance({ r, g, b }: Rgb): number {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const INK: Rgb = { r: 20, g: 22, b: 28 };
const NIGHT: Rgb = { r: 14, g: 17, b: 22 };

/** Whether white text on this colour is readable (WCAG AA for UI text). */
export function readableOnWhiteText(hex: string): boolean {
  const c = parseHex(hex);
  return c ? contrast(c, WHITE) >= 4.5 : true;
}

export interface BrandTokens {
  brand: string;
  hover: string;
  soft: string;
  onBrand: string;
}

/** The light-mode tokens for a colour. */
export function lightTokens(hex: string): BrandTokens | null {
  const c = parseHex(hex);
  if (!c) return null;
  // A colour too pale to carry white text is deepened until it can, so a
  // button in "sunflower" is still a button somebody can read.
  let brand = c;
  for (let i = 0; i < 12 && contrast(brand, WHITE) < 4.5 && contrast(brand, INK) < 7; i++) {
    brand = mix(brand, INK, 0.12);
  }
  const onBrand = contrast(brand, WHITE) >= 4.5 ? WHITE : INK;
  return {
    brand: toHex(brand),
    hover: toHex(mix(brand, INK, 0.18)),
    soft: toHex(mix(brand, WHITE, 0.9)),
    onBrand: toHex(onBrand),
  };
}

/** The dark-mode tokens: the same hue, lifted to read on a dark page. */
export function darkTokens(hex: string): BrandTokens | null {
  const c = parseHex(hex);
  if (!c) return null;
  let brand = c;
  for (let i = 0; i < 12 && contrast(brand, NIGHT) < 5; i++) brand = mix(brand, WHITE, 0.15);
  return {
    brand: toHex(brand),
    hover: toHex(mix(brand, WHITE, 0.15)),
    soft: toHex(mix(brand, NIGHT, 0.82)),
    onBrand: toHex(NIGHT),
  };
}

const STYLE_ID = 'tenant-theme';

/**
 * Paints the whole app in a tenant's colour, or restores the platform's own.
 *
 * A <style> element rather than inline variables on <html>, because inline
 * values would also win inside the dark-mode media query and leave a dark page
 * with light-mode buttons.
 */
export function applyTenantTheme(hex: string | null): void {
  const existing = document.getElementById(STYLE_ID);
  const light = hex ? lightTokens(hex) : null;
  const dark = hex ? darkTokens(hex) : null;

  if (!light || !dark) {
    existing?.remove();
    return;
  }

  const block = (t: BrandTokens) =>
    `--brand:${t.brand};--brand-hover:${t.hover};--brand-soft:${t.soft};--on-brand:${t.onBrand};`;

  const css = `:root{${block(light)}}@media (prefers-color-scheme: dark){:root{${block(dark)}}}`;

  const el = existing ?? Object.assign(document.createElement('style'), { id: STYLE_ID });
  el.textContent = css;
  if (!existing) document.head.appendChild(el);
}

/** Two letters for an institution with no logo: "SPPU" → "SP", "Pune Institute" → "PI". */
export function monogram(name: string, shortName?: string | null): string {
  const source = (shortName || name).trim();
  if (shortName && shortName.length <= 4) return shortName.slice(0, 2).toUpperCase();
  const words = source.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w) && !/^(of|and|the|for)$/i.test(w));
  return (words.length >= 2 ? words[0]![0]! + words[1]![0]! : source.slice(0, 2)).toUpperCase();
}

/**
 * Puts an institution's favicon in the browser tab, or restores the
 * platform's own. The original link is remembered the first time, so going
 * back is exact rather than a guess at what it was.
 */
let defaultFavicon: string | null | undefined;

export function applyTenantFavicon(href: string | null): void {
  let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (defaultFavicon === undefined) defaultFavicon = link?.getAttribute('href') ?? null;

  const target = href ?? defaultFavicon;
  if (!target) {
    link?.remove();
    return;
  }
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = target;
}
