import { useState, type FormEvent } from 'react';
import { ApiError } from '../../../api/client';
import { platformApi } from '../../../api/platform';
import type { StepProps } from '../Onboarding';
import { Field, fieldErrors } from '../ui';
import { CopyLink } from './CollegesStep';

/**
 * Who runs the institution's portal.
 *
 * Invitations rather than accounts: the person sets their own password from
 * the link, the same way every other account on the platform is born. The
 * link is shown here once, so a mail server that is down costs a
 * copy-and-paste, never an account.
 */
export default function PeopleStep({ state, catalogue, onSaved, goto }: StepProps) {
  const t = state!.tenant;
  const roles = catalogue.adminRoles;
  const defaultRole = roles.find((r) => r.key === 'admin.super') ?? roles[0];

  const [form, setForm] = useState({ fullName: '', email: '', phone: '', roleId: defaultRole?.id ?? '', sendEmail: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [last, setLast] = useState<{ email: string; link: string; emailed: string; reason?: string } | null>(null);

  const role = roles.find((r) => r.id === form.roleId);
  const admins = state!.admins;
  const officers = state!.colleges.filter((c) => c.officer);
  const missingOfficers = state!.colleges.filter((c) => !c.officer);

  async function invite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      const next = await platformApi.inviteAdmin(t.id, form);
      onSaved(next);
      setLast({ email: form.email, link: next.result.link, emailed: next.result.emailed, reason: next.result.reason });
      setForm((f) => ({ ...f, fullName: '', email: '', phone: '' }));
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(err instanceof ApiError ? err.message : 'Could not send the invitation.');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(inviteId: string) {
    try {
      onSaved(await platformApi.revokeInvite(t.id, inviteId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not cancel that invitation.');
    }
  }

  return (
    <div>
      <section className="blk">
        <h2 className="blk-title">Institution admins</h2>
        <p className="blk-sub">
          They run {t.shortName || t.name}’s portal: colleges, rosters, reports and their own staff logins. They never see
          any other institution.
        </p>

        {admins.length > 0 && (
          <ul className="people">
            {admins.map((a) => (
              <li key={`${a.kind}-${a.id}`}>
                <span className="avatar" aria-hidden="true">
                  {(a.fullName || a.email)[0]!.toUpperCase()}
                </span>
                <span className="people-who">
                  <strong>{a.fullName || a.email}</strong>
                  <small>
                    {a.email}
                    {a.roleName ? ` · ${a.roleName}` : ''}
                  </small>
                </span>
                {a.kind === 'member' ? (
                  <span className="pill pill-pass">{a.lastLoginAt ? 'Active' : 'Joined'}</span>
                ) : a.expired ? (
                  <span className="pill pill-stop">Expired</span>
                ) : (
                  <span className="pill pill-hold">Invited</span>
                )}
                {a.kind === 'invite' && (
                  <button type="button" className="linkish" onClick={() => revoke(a.id)}>
                    Cancel
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {last && (
          <div className="notice ob-in" role="status">
            {last.emailed === 'sent' ? (
              <>Invitation emailed to {last.email}.</>
            ) : (
              <>
                {last.emailed === 'failed' ? 'The email could not be sent' : 'No email sent'} - share this link with{' '}
                {last.email} yourself. <CopyLink link={last.link} />
              </>
            )}
          </div>
        )}

        <form className="invite-card" onSubmit={invite} noValidate>
          <p className="invite-card-title">{admins.length ? 'Invite another admin' : 'Invite the first admin'}</p>
          <div className="grid">
            <Field label="Name" error={errors.fullName}>
              {(id) => (
                <input id={id} className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              )}
            </Field>
            <Field label="Email" error={errors.email}>
              {(id) => (
                <input
                  id={id}
                  type="email"
                  className="input"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder={t.contactEmail ?? ''}
                />
              )}
            </Field>
            <Field label="Role" hint={role?.description ?? undefined}>
              {(id) => (
                <select id={id} className="input" value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Phone" optional>
              {(id) => (
                <input id={id} type="tel" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              )}
            </Field>
          </div>
          {t.contactEmail && !admins.some((a) => a.email === t.contactEmail) && !form.email && (
            <button
              type="button"
              className="linkish"
              onClick={() => setForm({ ...form, email: t.contactEmail!, fullName: t.contactName ?? '' })}
            >
              Use the contact person, {t.contactName || t.contactEmail}
            </button>
          )}
          <div className="invite-card-foot">
            <label className="check">
              <input type="checkbox" checked={form.sendEmail} onChange={(e) => setForm({ ...form, sendEmail: e.target.checked })} />
              Email the invitation
            </label>
            {error && (
              <span className="step-error" role="alert">
                {error}
              </span>
            )}
            <button type="submit" className="btn btn-secondary" disabled={busy || !form.email}>
              {busy ? 'Inviting…' : 'Send invitation'}
            </button>
          </div>
        </form>
      </section>

      <section className="blk">
        <h2 className="blk-title">Placement officers</h2>
        <p className="blk-sub">
          {officers.length} of {state!.colleges.length} colleges have one.
          {missingOfficers.length > 0 && ' The rest can be invited later by the institution’s admins.'}
        </p>
        <ul className="people people-compact">
          {state!.colleges.map((c) => (
            <li key={c.id}>
              <span className="people-who">
                <strong>{c.name}</strong>
                <small>{c.officer ? c.officer.email : 'No placement officer yet'}</small>
              </span>
              {c.officer ? (
                <span className={`pill ${c.officer.status === 'active' ? 'pill-pass' : 'pill-hold'}`}>
                  {c.officer.status === 'active' ? 'Active' : 'Invited'}
                </span>
              ) : (
                <button type="button" className="linkish" onClick={() => goto('colleges')}>
                  Add
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className="step-foot">
        <div className="step-foot-row">
          <button type="button" className="btn btn-ghost" onClick={() => goto('features')}>
            ← Back
          </button>
          <span className="step-foot-note">
            {admins.length} admin{admins.length === 1 ? '' : 's'}
          </span>
          <button type="button" className="btn btn-primary" onClick={() => goto('review')} disabled={admins.length === 0}>
            Continue to review
          </button>
        </div>
      </div>
    </div>
  );
}
