import { api } from './client';

/**
 * What an institution collects about a student, who may add one, and what a
 * student is asked if they register themselves.
 *
 * The field list comes from the server rather than being written out here,
 * so a field added to the platform appears on the screen with its own help
 * text and nobody has to keep two lists in step.
 */

export type FieldRule = 'off' | 'optional' | 'required';

export interface IntakePolicy {
  fields: Record<string, FieldRule>;
  universityMayAdd: boolean;
  collegeMayAdd: boolean;
  selfRegister: boolean;
  selfFields: string[];
  selfNeedsApproval: boolean;
}

export interface IntakeField {
  key: string;
  label: string;
  note: string;
  /** A role's eligibility reads this, which is what makes it costly to drop. */
  readsEligibility: boolean;
  /** The account itself - shown, but not switchable. */
  locked: boolean;
  /** May be asked on a registration form. */
  selfAskable: boolean;
  /** Settled by how the student got here, so never a question. */
  structural: boolean;
}

export interface IntakeView {
  policy: IntakePolicy;
  fields: IntakeField[];
  /** What this policy costs the students it covers, said before it is saved. */
  warnings: string[];
}

export const intakeApi = {
  get: () => api.get<IntakeView>('/admin/student-intake'),
  save: (policy: Partial<IntakePolicy>) => api.put<IntakeView>('/admin/student-intake', policy),
};
