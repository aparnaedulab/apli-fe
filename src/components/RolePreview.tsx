import type { AssignableRole } from '../api/roles';
import './RolePreview.css';

export interface PermissionLabel {
  key: string;
  label: string;
}

/**
 * What a role actually lets somebody do, in the words the platform uses.
 *
 * A role name is a summary somebody else wrote. "Recruiter" does not say
 * whether they can publish a role or make an offer, and the person choosing
 * is deciding exactly that - so the choice was being made on a guess, and the
 * only way to check was to ask whoever built it.
 *
 * Both halves are shown on purpose. What a role cannot do is the half that
 * decides whether it is the right one, and a list of ticks alone reads as
 * "everything" however short it is.
 */
export default function RolePreview({
  role,
  catalogue,
  open = false,
}: {
  role: AssignableRole | undefined;
  /** Every capability an account of this kind can hold. */
  catalogue: PermissionLabel[];
  /** Start expanded, where the choice is the whole point of the screen. */
  open?: boolean;
}) {
  if (!role || catalogue.length === 0) return null;

  const has = catalogue.filter((p) => role.permissions.includes(p.key));
  const hasNot = catalogue.filter((p) => !role.permissions.includes(p.key));

  return (
    <details className="role-preview" open={open}>
      <summary>
        What can {role.name} do?
        <span className="role-preview-count">
          {has.length} of {catalogue.length}
        </span>
      </summary>

      {role.description && <p className="role-preview-lede">{role.description}</p>}

      <div className="role-preview-cols">
        <div>
          <p className="role-preview-head is-can">They will be able to</p>
          {has.length === 0 ? (
            <p className="role-preview-none">Nothing — this role can only sign in.</p>
          ) : (
            <ul>
              {has.map((p) => (
                <li key={p.key} className="is-can">
                  {p.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="role-preview-head is-cannot">They will not be able to</p>
          {hasNot.length === 0 ? (
            <p className="role-preview-none">Nothing is held back — this role can do everything.</p>
          ) : (
            <ul>
              {hasNot.map((p) => (
                <li key={p.key} className="is-cannot">
                  {p.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </details>
  );
}
