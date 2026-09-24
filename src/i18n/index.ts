import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { api } from '../api/client';
import { en } from './en';
import { hi } from './hi';
import { mr } from './mr';
import type { Locale, MessageKey, Messages } from './types';

/**
 * The reading language, for the student screens.
 *
 * A tiny store rather than a React provider: a student page calls its hooks
 * before it renders the layout, so anything the layout provided would not yet
 * be there. Any component can read the language, and it repaints the moment
 * the student changes it.
 *
 * Two languages are tracked: the one the student *chose*, and the one being
 * *shown*. They differ when an institution does not have regional languages
 * switched on - the choice is kept, and English is shown.
 */

export type { Locale, MessageKey };

export const LOCALES: { value: Locale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'mr', label: 'मराठी' },
];

const DICTS: Record<Locale, Messages> = { en, hi, mr };
const INTL: Record<Locale, string> = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };
const STORAGE_KEY = 'apli.locale';
const NOTE_KEY = 'apli.locale.partialNoteSeen';

const isLocale = (v: unknown): v is Locale => v === 'en' || v === 'hi' || v === 'mr';

function readStored(): Locale | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return isLocale(v) ? v : null;
  } catch {
    return null;
  }
}

let chosen: Locale = readStored() ?? 'en';
let shown: Locale = chosen;
const listeners = new Set<() => void>();

function emit() {
  document.documentElement.lang = shown;
  for (const l of listeners) l();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** What is on screen now. */
export function getLocale(): Locale {
  return shown;
}

/** The student's own choice, even while English is being shown. */
export function getChosenLocale(): Locale {
  return chosen;
}

/**
 * Whether the institution has regional languages. Called by the layout;
 * off means English is shown whatever was chosen.
 */
export function setVernacularAllowed(allowed: boolean) {
  const next = allowed ? chosen : 'en';
  if (next !== shown) {
    shown = next;
    emit();
  }
}

/** The student picked a language: show it, remember it here and on the account. */
export function chooseLocale(locale: Locale) {
  chosen = locale;
  shown = locale;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // A browser that refuses storage still gets it from the account next time.
  }
  emit();
  void api.put('/locale', { locale }).catch(() => undefined);
}

/**
 * Reads the account's saved choice, so a new device starts in the student's
 * language. Only overrides this browser when the account has an answer.
 */
let loaded = false;

export async function loadSavedLocale(allowed: boolean): Promise<void> {
  // Every student page mounts the layout afresh; the account only needs asking once.
  if (loaded) {
    setVernacularAllowed(allowed);
    return;
  }
  loaded = true;
  try {
    const { locale } = await api.get<{ locale: string | null }>('/locale');
    if (isLocale(locale) && locale !== chosen) {
      chosen = locale;
      try {
        window.localStorage.setItem(STORAGE_KEY, locale);
      } catch {
        // Fine - the account holds it.
      }
    }
  } catch {
    // Signed out or offline: keep whatever this browser had.
  }
  setVernacularAllowed(allowed);
}

/** Whether the one-time "some pages are still in English" note has been seen. */
export function partialNoteSeen(): boolean {
  try {
    return window.localStorage.getItem(NOTE_KEY) === '1';
  } catch {
    return true;
  }
}

export function markPartialNoteSeen() {
  try {
    window.localStorage.setItem(NOTE_KEY, '1');
  } catch {
    // Seeing the note twice is harmless.
  }
}

const warned = new Set<string>();
/** Vite's dev flag, read without depending on its type declarations. */
const isDev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true;

/** The message for a key in a language, English when it has none, with {vars} filled in. */
export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  const own = DICTS[locale][key];
  if (own === undefined && locale !== 'en' && isDev && !warned.has(`${locale}:${key}`)) {
    warned.add(`${locale}:${key}`);
    console.warn(`[i18n] no ${locale} text for "${key}" - showing English`);
  }
  const text = own ?? en[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m)) : text;
}

/** The current language, repainting whoever reads it when it changes. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale, () => 'en');
}

/**
 * The hook screens use: `t` for text, plus dates and numbers in the reader's
 * own format (Hindi and Marathi dates read naturally, and digits stay the
 * familiar ones Indian students use).
 */
export function useT() {
  const locale = useLocale();
  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  );
  /** A menu label, keyed by its English text; unknown labels stay as they are. */
  const tNav = useCallback(
    (label: string) => {
      const key = `nav.${label}` as MessageKey;
      return key in en ? translate(locale, key) : label;
    },
    [locale],
  );
  return useMemo(() => {
    const tag = INTL[locale];
    return {
      t,
      tNav,
      locale,
      date: (d: string | number | Date) =>
        new Date(d).toLocaleDateString(tag, { day: 'numeric', month: 'short', year: 'numeric', numberingSystem: 'latn' }),
      time: (d: string | number | Date) =>
        new Date(d).toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit', numberingSystem: 'latn' }),
      number: (n: number) => n.toLocaleString(tag, { numberingSystem: 'latn' }),
    };
  }, [t, tNav, locale]);
}
