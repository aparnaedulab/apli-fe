import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminTable, { cell, type Column } from './AdminTable';
import { api } from '../../api/client';
import { adminApi } from '../../api/admin';
import BatchForm from '../../components/BatchForm';

/* -------------------------------------------------------------------------- */
/* Users                                                                       */
/* -------------------------------------------------------------------------- */

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'CAMPUS' | 'COMPANY' | 'CANDIDATE';
  isActive: boolean;
  lastLoginAt: string | null;
  organisation: string | null;
  orgRole: string | null;
}

export function Users() {
  // Toggling an account is the one write here, so the row keeps its own state
  // rather than reloading the whole page for a single boolean.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const columns: Column<UserRow>[] = [
    { key: 'name', label: 'Name', render: (u) => cell.primary(u.fullName, u.email) },
    { key: 'role', label: 'Role', render: (u) => cell.pill(u.role) },
    {
      key: 'org',
      label: 'Organisation',
      render: (u) => (u.organisation ? cell.primary(u.organisation, u.orgRole) : '—'),
    },
    { key: 'last', label: 'Last signed in', render: (u) => cell.date(u.lastLoginAt) },
    {
      key: 'status',
      label: 'Status',
      render: (u) => {
        const active = overrides[u.id] ?? u.isActive;
        return active ? cell.pill('Active', 'pass') : cell.pill('Disabled', 'stop');
      },
    },
    {
      key: 'action',
      label: '',
      render: (u) => {
        const active = overrides[u.id] ?? u.isActive;
        return (
          <button
            type="button"
            className={active ? 'link-btn is-danger' : 'link-btn'}
            onClick={async () => {
              await api.patch(`/admin/users/${u.id}`, { isActive: !active });
              setOverrides((o) => ({ ...o, [u.id]: !active }));
            }}
          >
            {active ? 'Disable' : 'Enable'}
          </button>
        );
      },
    },
  ];

  return (
    <AdminTable<UserRow>
      title="Users"
      lede="Everyone on the platform. Disabling an account takes effect on their next request, not when their session expires."
      path="/admin/users"
      searchPlaceholder="Search by name or email…"
      rowKey={(u) => u.id}
      columns={columns}
      filters={[
        {
          key: 'role',
          label: 'Any role',
          options: [
            { value: 'ADMIN', label: 'Operations' },
            { value: 'CAMPUS', label: 'Placement cell' },
            { value: 'COMPANY', label: 'Recruiter' },
            { value: 'CANDIDATE', label: 'Student' },
          ],
        },
      ]}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Students                                                                    */
/* -------------------------------------------------------------------------- */

interface StudentRow {
  id: string;
  name: string;
  email: string;
  college: string | null;
  batch: string | null;
  course: string | null;
  rollNo: string | null;
  isFrozen: boolean;
  cgpa: string | null;
  applications: number;
}

export function Students() {
  const columns: Column<StudentRow>[] = [
    { key: 'name', label: 'Student', render: (s) => cell.primary(s.name, s.email) },
    { key: 'college', label: 'College', render: (s) => s.college ?? '—' },
    {
      key: 'batch',
      label: 'Batch',
      render: (s) => (s.batch ? cell.primary(s.batch, s.rollNo) : '—'),
    },
    { key: 'cgpa', label: 'CGPA', numeric: true, render: (s) => s.cgpa ?? '—' },
    { key: 'apps', label: 'Applications', numeric: true, render: (s) => s.applications },
    {
      key: 'verified',
      label: 'Verified',
      render: (s) => (s.isFrozen ? cell.pill('Frozen', 'pass') : cell.pill('Pending', 'hold')),
    },
  ];

  return (
    <AdminTable<StudentRow>
      title="Students"
      lede="Every student across every college. Only a verified (frozen) record can apply to anything."
      path="/admin/students"
      searchPlaceholder="Search by name or email…"
      rowKey={(s) => s.id}
      columns={columns}
      filters={[
        {
          key: 'verified',
          label: 'Any verification',
          options: [
            { value: 'true', label: 'Verified' },
            { value: 'false', label: 'Not verified' },
          ],
        },
      ]}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Batches                                                                     */
/* -------------------------------------------------------------------------- */

interface BatchRow {
  id: string;
  name: string;
  college: string;
  course: string | null;
  specialisation: string | null;
  graduationYear: number | null;
  studyYear: number | null;
  students: number;
  verified: number;
  drives: number;
}

export function Batches() {
  const [creating, setCreating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const columns: Column<BatchRow>[] = [
    {
      key: 'name',
      label: 'Batch',
      render: (b) => (
        <>
          <Link to={`/admin/batches/${b.id}`} className="row-link">
            {b.name}
          </Link>
          {b.specialisation && <span className="row-sub">{b.specialisation}</span>}
        </>
      ),
    },
    { key: 'college', label: 'College', render: (b) => b.college },
    { key: 'course', label: 'Course', render: (b) => b.course ?? '—' },
    {
      key: 'year',
      label: 'Year',
      render: (b) =>
        b.graduationYear
          ? `Graduating ${b.graduationYear}`
          : b.studyYear
            ? `Year ${b.studyYear}`
            : '—',
    },
    { key: 'students', label: 'Students', numeric: true, render: (b) => b.students },
    {
      key: 'verified',
      label: 'Verified',
      numeric: true,
      render: (b) => (
        <>
          {b.verified}
          {b.students > b.verified && (
            <span className="row-sub">{b.students - b.verified} pending</span>
          )}
        </>
      ),
    },
    { key: 'drives', label: 'Seasons', numeric: true, render: (b) => b.drives },
  ];

  return (
    <AdminTable<BatchRow>
      title="Batches"
      lede="Every group on the platform. A batch is what a drive includes and what a job is aimed at — a degree cohort, a year of study, a department, or a group named for one drive."
      path="/admin/batches"
      searchPlaceholder="Search by batch or college…"
      rowKey={(b) => b.id}
      columns={columns}
      reloadKey={reloadKey}
      action={
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setCreating((v) => !v)}
          aria-expanded={creating}
        >
          {creating ? 'Cancel' : 'Add batch'}
        </button>
      }
      banner={
        creating && (
          <CreateBatchForCollege
            onDone={() => {
              setCreating(false);
              setReloadKey((n) => n + 1);
            }}
            onCancel={() => setCreating(false)}
          />
        )
      }
    />
  );
}

/**
 * Creating a batch from the cross-college list.
 *
 * The college is a choice, not a requirement. A batch like "First year" is
 * defined by the year rather than by a campus, and belongs to the university
 * across every affiliated college; one like "CSE 2026" belongs to one college.
 * Both are batches, so both are made here.
 */
function CreateBatchForCollege({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  const [colleges, setColleges] = useState<{ id: string; name: string; code: string }[]>([]);
  const [scope, setScope] = useState<'university' | 'college'>('college');
  const [collegeId, setCollegeId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .listColleges({ limit: 100, sort: 'name' })
      .then((r) => setColleges(r.colleges.map((c) => ({ id: c.id, name: c.name, code: c.code }))))
      .catch(() => setError('Could not load the college list.'));
  }, []);

  const chosen = colleges.find((c) => c.id === collegeId);
  const ready = scope === 'university' || Boolean(collegeId);

  return (
    <>
      <div className="card form-card">
        <p className="field-label">Who does this batch belong to?</p>

        <div className="scope-choice">
          <label className={`scope ${scope === 'college' ? 'is-current' : ''}`}>
            <input
              type="radio"
              name="batch-scope"
              checked={scope === 'college'}
              onChange={() => setScope('college')}
            />
            <span>
              <b>One college</b>
              <span className="scope-hint">
                Its students, roll numbers and drives all sit inside that college.
              </span>
            </span>
          </label>

          <label className={`scope ${scope === 'university' ? 'is-current' : ''}`}>
            <input
              type="radio"
              name="batch-scope"
              checked={scope === 'university'}
              onChange={() => setScope('university')}
            />
            <span>
              <b>The university</b>
              <span className="scope-hint">
                A year-wise or university-wide group, spanning every affiliated college.
              </span>
            </span>
          </label>
        </div>

        {scope === 'college' && (
          <label className="field">
            <span className="field-label">
              Which college<span className="req">required</span>
            </span>
            <select value={collegeId} onChange={(e) => setCollegeId(e.target.value)} autoFocus>
              <option value="">Choose a college</option>
              {colleges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
            {error && <span className="field-error">{error}</span>}
          </label>
        )}

        {scope === 'university' && (
          <p className="alert alert-warn">
            A university-wide batch holds students from any college. Colleges cannot target it
            with their own drives — their drives only offer their own batches — so use it for
            grouping and reporting until university-level drives exist.
          </p>
        )}
      </div>

      {ready && (
        <BatchForm
          collegeName={scope === 'college' ? chosen?.name : 'the university'}
          onCreate={(batch) =>
            api.post('/admin/batches', {
              ...batch,
              collegeId: scope === 'college' ? collegeId : undefined,
            })
          }
          onDone={onDone}
          onCancel={onCancel}
        />
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Drives                                                                      */
/* -------------------------------------------------------------------------- */

interface DriveRow {
  id: string;
  name: string;
  college: string;
  type: 'FINAL' | 'INTERNSHIP';
  year: number;
  isOpen: boolean;
  oneOfferRule: boolean;
  students: number;
  jobs: number;
  applications: number;
  placed: number;
  placedPercent: number;
}

export function Drives() {
  const columns: Column<DriveRow>[] = [
    {
      key: 'name',
      label: 'Drive',
      render: (d) => cell.primary(d.name, d.oneOfferRule ? 'One offer per student' : 'Multiple offers allowed'),
    },
    { key: 'college', label: 'College', render: (d) => d.college },
    {
      key: 'type',
      label: 'Type',
      render: (d) => (d.type === 'FINAL' ? 'Final placement' : 'Internship'),
    },
    { key: 'students', label: 'Students', numeric: true, render: (d) => d.students },
    { key: 'jobs', label: 'Jobs', numeric: true, render: (d) => d.jobs },
    {
      key: 'placed',
      label: 'Placed',
      numeric: true,
      render: (d) => (
        <>
          {d.placedPercent}%<span className="row-sub">{d.placed} students</span>
        </>
      ),
    },
    {
      key: 'open',
      label: 'Status',
      render: (d) => (d.isOpen ? cell.pill('Open', 'pass') : cell.pill('Closed', 'idle')),
    },
  ];

  return (
    <AdminTable<DriveRow>
      title="Seasons"
      lede="Every placement season across every college, with how each one is doing."
      path="/admin/drives"
      searchPlaceholder="Search by drive or college…"
      rowKey={(d) => d.id}
      columns={columns}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Jobs                                                                        */
/* -------------------------------------------------------------------------- */

interface JobRow {
  id: string;
  title: string;
  company: string;
  companyVerified: boolean;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  deadline: string;
  ctcMin: string | null;
  ctcMax: string | null;
  rounds: number;
  applications: number;
  accepted: number;
  pending: number;
  declined: number;
}

export function Jobs() {
  const columns: Column<JobRow>[] = [
    { key: 'title', label: 'Role', render: (j) => cell.primary(j.title, j.company) },
    {
      key: 'status',
      label: 'Status',
      render: (j) =>
        cell.pill(
          j.status,
          j.status === 'PUBLISHED' ? 'pass' : j.status === 'CLOSED' ? 'stop' : 'idle',
        ),
    },
    {
      key: 'ctc',
      label: 'CTC',
      render: (j) =>
        j.ctcMin || j.ctcMax ? `${cell.lakhs(j.ctcMin)} – ${cell.lakhs(j.ctcMax)}` : '—',
    },
    { key: 'rounds', label: 'Rounds', numeric: true, render: (j) => j.rounds },
    {
      key: 'colleges',
      label: 'Colleges',
      render: (j) =>
        j.accepted + j.pending + j.declined === 0 ? (
          <span className="muted">Not targeted</span>
        ) : (
          <span className="posting-mix">
            {j.accepted > 0 && <b className="is-pass">{j.accepted} live</b>}
            {j.pending > 0 && <b className="is-hold">{j.pending} pending</b>}
            {j.declined > 0 && <b className="is-stop">{j.declined} declined</b>}
          </span>
        ),
    },
    { key: 'apps', label: 'Applicants', numeric: true, render: (j) => j.applications },
    { key: 'deadline', label: 'Deadline', render: (j) => cell.date(j.deadline) },
  ];

  return (
    <AdminTable<JobRow>
      title="Roles"
      lede="Every role posted by every company, and how many colleges have let it through."
      path="/admin/jobs"
      searchPlaceholder="Search by role or company…"
      rowKey={(j) => j.id}
      columns={columns}
      filters={[
        {
          key: 'status',
          label: 'Any status',
          options: [
            { value: 'DRAFT', label: 'Draft' },
            { value: 'PUBLISHED', label: 'Published' },
            { value: 'CLOSED', label: 'Closed' },
          ],
        },
      ]}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Applications                                                                */
/* -------------------------------------------------------------------------- */

const APP_TONE: Record<string, 'pass' | 'hold' | 'stop' | 'idle'> = {
  APPLIED: 'idle',
  UNDER_REVIEW: 'hold',
  IN_ROUND: 'hold',
  WAITLISTED: 'hold',
  OFFERED: 'pass',
  ACCEPTED: 'pass',
  HIRED: 'pass',
  DECLINED: 'stop',
  REJECTED: 'stop',
  WITHDRAWN: 'stop',
};

interface AppRow {
  id: string;
  student: string;
  email: string;
  college: string | null;
  job: string;
  company: string;
  drive: string;
  status: string;
  round: string | null;
  updatedAt: string;
}

export function Applications() {
  const columns: Column<AppRow>[] = [
    { key: 'student', label: 'Student', render: (a) => cell.primary(a.student, a.college) },
    { key: 'job', label: 'Role', render: (a) => cell.primary(a.job, a.company) },
    { key: 'drive', label: 'Drive', render: (a) => a.drive },
    { key: 'round', label: 'Round', render: (a) => a.round ?? '—' },
    {
      key: 'status',
      label: 'Status',
      render: (a) => cell.pill(a.status, APP_TONE[a.status] ?? 'idle'),
    },
    { key: 'updated', label: 'Last change', render: (a) => cell.dateTime(a.updatedAt) },
  ];

  return (
    <AdminTable<AppRow>
      title="Applications"
      lede="The whole pipeline, across every college and company, newest change first."
      path="/admin/applications"
      searchPlaceholder="Search by student or role…"
      rowKey={(a) => a.id}
      columns={columns}
      filters={[
        {
          key: 'status',
          label: 'Any status',
          options: Object.keys(APP_TONE).map((s) => ({ value: s, label: s.replace('_', ' ') })),
        },
      ]}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Audit                                                                       */
/* -------------------------------------------------------------------------- */

interface AuditRow {
  id: string;
  student: string;
  job: string;
  company: string;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  note: string | null;
  actor: string;
  actorRole: string | null;
  createdAt: string;
}

export function Audit() {
  const columns: Column<AuditRow>[] = [
    { key: 'when', label: 'When', render: (e) => cell.dateTime(e.createdAt) },
    { key: 'student', label: 'Student', render: (e) => cell.primary(e.student, e.job) },
    {
      key: 'move',
      label: 'Change',
      render: (e) => (
        <span className="mono">
          {e.fromStatus ? `${e.fromStatus} → ${e.toStatus}` : e.toStatus}
        </span>
      ),
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (e) =>
        e.reason === 'auto_placed'
          ? cell.pill('took another offer', 'hold')
          : (e.reason ?? <span className="muted">—</span>),
    },
    { key: 'actor', label: 'By', render: (e) => cell.primary(e.actor, e.actorRole) },
  ];

  return (
    <AdminTable<AuditRow>
      title="Audit trail"
      lede="Every status change ever made, append-only, newest first. Nothing in this table is editable or deletable — that is the point of it."
      path="/admin/audit"
      searchPlaceholder="Search by student, role or reason…"
      rowKey={(e) => e.id}
      columns={columns}
      emptyMessage="No status changes have been recorded yet."
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Invitations                                                                 */
/* -------------------------------------------------------------------------- */

interface InviteRow {
  id: string;
  email: string;
  kind: string;
  organisation: string | null;
  batch: string | null;
  sentBy: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

export function Invites() {
  const [cancelled, setCancelled] = useState<Record<string, boolean>>({});

  const columns: Column<InviteRow>[] = [
    { key: 'email', label: 'Invited', render: (i) => cell.primary(i.email, i.organisation) },
    { key: 'kind', label: 'As', render: (i) => cell.pill(i.kind.replace('_', ' ')) },
    { key: 'batch', label: 'Batch', render: (i) => i.batch ?? '—' },
    { key: 'sent', label: 'Sent by', render: (i) => i.sentBy ?? '—' },
    { key: 'expires', label: 'Expires', render: (i) => cell.date(i.expiresAt) },
    {
      key: 'state',
      label: 'State',
      render: (i) => {
        if (cancelled[i.id] || i.revokedAt) return cell.pill('Cancelled', 'stop');
        if (i.acceptedAt) return cell.pill('Accepted', 'pass');
        if (new Date(i.expiresAt) < new Date()) return cell.pill('Expired', 'stop');
        return cell.pill('Pending', 'hold');
      },
    },
    {
      key: 'action',
      label: '',
      render: (i) =>
        !i.acceptedAt && !i.revokedAt && !cancelled[i.id] ? (
          <button
            type="button"
            className="link-btn is-danger"
            onClick={async () => {
              await api.delete(`/admin/invites/${i.id}`);
              setCancelled((c) => ({ ...c, [i.id]: true }));
            }}
          >
            Cancel
          </button>
        ) : null,
    },
  ];

  return (
    <AdminTable<InviteRow>
      title="Invitations"
      lede="Every invitation on the platform. The token itself is never shown — only its hash is stored, so not even operations can recover a link."
      path="/admin/invites"
      searchPlaceholder="Search by email…"
      rowKey={(i) => i.id}
      columns={columns}
      filters={[
        {
          key: 'state',
          label: 'Pending',
          options: [
            { value: 'PENDING', label: 'Pending' },
            { value: 'ACCEPTED', label: 'Accepted' },
            { value: 'REVOKED', label: 'Cancelled' },
            { value: 'ALL', label: 'All' },
          ],
        },
      ]}
    >
      <p className="muted" style={{ marginBottom: 18 }}>
        Need to reissue one? Cancel it here, then create a new invitation from the{' '}
        <Link to="/admin/colleges">college</Link> or{' '}
        <Link to="/admin/companies">company</Link>.
      </p>
    </AdminTable>
  );
}
