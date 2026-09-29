import { useEffect, useState } from 'react';
import { candidateApi, type Profile } from '../../api/candidate';

/**
 * The signed-in student's own record, shared by every screen that frames one.
 *
 * The shell is mounted by each page rather than by a parent route, so moving
 * from Jobs to Applications tears it down and builds it again. Without a
 * cache that is one profile fetch per click, and a header that blinks empty
 * every time somebody navigates - which is the single thing that makes a
 * portal feel like a stack of documents instead of an application.
 *
 * So the answer is held here, module-wide, and handed to the next mount
 * immediately. It is refetched in the background when it is older than the
 * window below, and any screen that changes the profile calls `refreshMe()`
 * so the header is not left stating something that is no longer true.
 */

/** How long a held answer is served before it is fetched again. */
const FRESH_MS = 60_000;

let cached: Profile | null = null;
let fetchedAt = 0;
let inFlight: Promise<Profile> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

function fetchMe(): Promise<Profile> {
  if (inFlight) return inFlight;
  inFlight = candidateApi
    .getProfile()
    .then((p) => {
      cached = p;
      fetchedAt = Date.now();
      emit();
      return p;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Fetch again now, whatever the age, and tell everybody watching. */
export function refreshMe(): void {
  fetchedAt = 0;
  void fetchMe().catch(() => {
    /* a header that cannot refresh keeps the last thing it knew */
  });
}

/** Drop it entirely - on sign-out, so the next account starts clean. */
export function forgetMe(): void {
  cached = null;
  fetchedAt = 0;
  emit();
}

/**
 * The student, as far as we know them.
 *
 * Returns whatever is held straight away - `null` only before the first
 * answer has ever arrived - so a header renders once and then fills in,
 * rather than flashing a skeleton on every navigation.
 */
export function useMe(): Profile | null {
  const [, bump] = useState(0);

  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    listeners.add(fn);
    if (!cached || Date.now() - fetchedAt > FRESH_MS) {
      void fetchMe().catch(() => {
        /* the shell is not the place to report this; the page will */
      });
    }
    return () => {
      listeners.delete(fn);
    };
  }, []);

  return cached;
}

/** Two letters for an avatar, from whatever name we were given. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

/** The part of a name somebody is actually called. */
export function firstNameOf(name: string | undefined | null): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? '';
}
