import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, ApiError } from '../api/client';
import { applyTenantFavicon, applyTenantTheme } from '../lib/brand';

export type Role = 'ADMIN' | 'CAMPUS' | 'COMPANY' | 'CANDIDATE';

/**
 * A capability, named exactly as the server names it.
 *
 * Kept as a plain string rather than a union of all thirty-odd: roles are
 * data, the catalogue moves with releases, and a client that hard-coded the
 * list would need a deploy every time one was added.
 */
export type Permission = string;

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  collegeId?: string;
  companyId?: string;
  candidateId?: string;
  /** The institution this session is standing in. */
  tenantId?: string;
  /** The platform team: operations with no institution of their own. */
  isPlatform?: boolean;

  /**
   * What this person may do. Sent by the server so a screen can stop
   * offering what would be refused anyway.
   *
   * This is a courtesy, never a control - every one of these is checked
   * again on the way in, so hiding a button is about not wasting somebody's
   * time, not about security.
   */
  permissions: Permission[];
  /** The role's name, so a refusal can say which role came up short. */
  roleName: string | null;
}

/** The institution whose portal this is, enough to paint it. */
export interface TenantSummary {
  id: string;
  name: string;
  shortName: string | null;
  slug: string;
  kind: 'UNIVERSITY' | 'COLLEGE' | 'GROUP';
  status: 'DRAFT' | 'ACTIVE' | 'SUSPENDED';
  brandColor: string;
  logoUrl: string | null;
  faviconUrl: string | null;
}

/** What every endpoint that opens or reads a session returns. */
export interface SessionView {
  user: AuthUser;
  tenant: TenantSummary | null;
  modules: string[];
}

interface AuthState {
  user: AuthUser | null;
  /** The institution the session stands in. Null for companies. */
  tenant: TenantSummary | null;
  /** Module keys switched on for that institution. */
  modules: string[];
  /** True until the first /me has settled, so guards do not redirect early. */
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  /**
   * Adopt a session the server has already opened. Registration signs the
   * person in as part of creating them, so there is nothing left to log in
   * with - the cookie is set and this tells the app who it belongs to.
   */
  adopt: (session: SessionView | AuthUser) => void;
  logout: () => Promise<void>;
  /** Whether the signed-in person holds a capability. False while loading. */
  can: (permission: Permission) => boolean;
  /** Whether the current institution has a module switched on. */
  hasModule: (key: string) => boolean;
  /**
   * Platform team only: step into an institution, or out of all of them with
   * null. Every admin screen then shows that institution's rows.
   */
  actAs: (tenantId: string | null) => Promise<void>;
  /** Re-reads the session, after something changed what it should say. */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Where each role belongs after signing in. */
export const HOME_FOR: Record<Role, string> = {
  ADMIN: '/admin',
  CAMPUS: '/campus',
  COMPANY: '/company',
  CANDIDATE: '/student',
};

/**
 * Where this particular person belongs. The platform team lands on the
 * console - their job is institutions, not one institution's rows.
 */
export function homeFor(user: Pick<AuthUser, 'role' | 'isPlatform'>): string {
  return user.isPlatform ? '/platform' : HOME_FOR[user.role];
}

function isSessionView(v: SessionView | AuthUser): v is SessionView {
  return 'user' in v;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenant, setTenant] = useState<TenantSummary | null>(null);
  const [modules, setModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const take = useCallback((view: SessionView | null) => {
    setUser(view?.user ?? null);
    setTenant(view?.tenant ?? null);
    setModules(view?.modules ?? []);
  }, []);

  // The portal wears the institution's colour, and goes back to the
  // platform's own the moment nobody is standing in one.
  useEffect(() => {
    applyTenantTheme(tenant?.brandColor ?? null);
  }, [tenant?.brandColor]);

  // And shows its icon in the browser tab.
  useEffect(() => {
    applyTenantFavicon(tenant?.faviconUrl ?? null);
  }, [tenant?.faviconUrl]);

  // Restore the session on first load. A 401 here is the normal signed-out
  // case, not an error worth surfacing.
  useEffect(() => {
    let cancelled = false;

    api
      .get<SessionView>('/auth/me')
      .then((view) => {
        if (!cancelled) take(view);
      })
      .catch(() => {
        if (!cancelled) take(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [take]);

  const login = useCallback(
    async (email: string, password: string) => {
      const view = await api.post<SessionView>('/auth/login', { email, password });
      take(view);
      return view.user;
    },
    [take],
  );

  const adopt = useCallback(
    (signedIn: SessionView | AuthUser) => {
      if (isSessionView(signedIn)) take(signedIn);
      else take({ user: signedIn, tenant: null, modules: [] });
    },
    [take],
  );

  const refresh = useCallback(async () => {
    take(await api.get<SessionView>('/auth/me'));
  }, [take]);

  const actAs = useCallback(
    async (tenantId: string | null) => {
      take(await api.post<SessionView>('/platform/act-as', { tenantId }));
    },
    [take],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      // A failed logout still means this browser should forget the user.
      if (!(err instanceof ApiError)) throw err;
    }
    take(null);
  }, [take]);

  /*
   * Students hold no permissions at all and never will - their reach is their
   * own record, fenced by the account type rather than by a capability. So a
   * screen must not ask `can(...)` about a student and expect a useful answer.
   */
  const can = useCallback(
    (permission: Permission) => user?.permissions?.includes(permission) ?? false,
    [user],
  );

  const hasModule = useCallback((key: string) => modules.includes(key), [modules]);

  const value = useMemo(
    () => ({ user, tenant, modules, loading, login, adopt, logout, can, hasModule, actAs, refresh }),
    [user, tenant, modules, loading, login, adopt, logout, can, hasModule, actAs, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
