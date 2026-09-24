import { api } from './client';

/**
 * Roles, which are data now rather than an enum.
 *
 * A screen never hard-codes a role name. It asks which roles it may hand out
 * and shows those, so a role operations invents tomorrow appears without a
 * deploy — which is the entire point of moving them out of the code.
 */

export type RoleScope = 'CAMPUS' | 'COMPANY' | 'ADMIN';

/** Just enough to put a role in a dropdown and say what it does. */
export interface AssignableRole {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
}

export interface PlatformRole extends AssignableRole {
  key: string | null;
  scope: RoleScope;
  isSystem: boolean;
  isActive: boolean;
  /** The full-power role of its world: renameable, never weakened. */
  isLocked: boolean;
  memberCount: number;
}

export interface PermissionEntry {
  key: string;
  label: string;
  scopes: RoleScope[];
}

export interface RoleInput {
  name: string;
  description?: string;
  scope?: RoleScope;
  permissions?: string[];
  isActive?: boolean;
}

export const rolesApi = {
  /** Everything, for the role-management screen. Needs `role:manage`. */
  list: () => api.get<{ roles: PlatformRole[]; catalogue: PermissionEntry[] }>('/admin/roles'),

  create: (data: RoleInput) => api.post<{ role: PlatformRole }>('/admin/roles', data),

  update: (id: string, data: RoleInput) =>
    api.patch<{ role: PlatformRole }>(`/admin/roles/${id}`, data),

  remove: (id: string) => api.delete<void>(`/admin/roles/${id}`),

  /**
   * What this caller may hand out. A college gets college roles whatever it
   * asks for; only operations may name a scope.
   */
  assignable: (scope?: RoleScope) =>
    api
      .get<{ roles: AssignableRole[] }>(`/admin/roles/assignable${scope ? `?scope=${scope}` : ''}`)
      .then((r) => r.roles),

  /**
   * The same call, keeping the catalogue beside the roles.
   *
   * A screen that only fills a dropdown wants `assignable`; one that explains
   * what a role lets somebody do needs every capability this kind of account
   * can hold, so it can show what the role does *not* carry as well.
   */
  assignableWithCatalogue: (scope?: RoleScope) =>
    api.get<{ roles: AssignableRole[]; catalogue: { key: string; label: string }[] }>(
      `/admin/roles/assignable${scope ? `?scope=${scope}` : ''}`,
    ),
};
