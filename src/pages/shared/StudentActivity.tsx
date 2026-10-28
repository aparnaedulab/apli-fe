import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import AdminTable, { cell, type Column, type Filter } from '../admin/AdminTable';
import { ApiError } from '../../api/client';
import {
  INVITE_LABEL,
  LEVEL_LABEL,
  OFFER_LABEL,
  RUN_LABEL,
  options,
  studentActivityApi,
  type ActivityBase,
  type InterviewRow,
  type OfferRow,
  type SimulationRow,
  type StudentDetail,
  type StudentRow,
  type WorkRow,
} from '../../api/studentActivity';
import './StudentActivity.css';

/**
 * The student app, seen from the other side.
 *
 * Every list here takes `base`: '/admin' shows one institution's students,
 * '/platform/activity' shows every student on the platform. `bare` drops the
 * admin frame so the platform console can host the same list.
 */
interface ListProps {
  base: ActivityBase;
  bare?: boolean;
  /** Rendered above the list - a stat strip, say. */
  children?: ReactNode;
}

const rupees = (n: number | null) => (n == null ? 'Unpaid' : `₹${n.toLocaleString('en-IN')}/mo`);
const fmt = (v: string | null) =>
  v ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/** A student's name that opens their panel. */
function StudentName({ name, sub, onOpen }: { name: string; sub?: string | null; onOpen: () => void }) {
  return (
    <button type="button" className="sv-name" onClick={onOpen}>
      {cell.primary(name, sub)}
    </button>
  );
}

/** The list plus the panel it opens, so every list behaves the same. */
function useStudentPanel(base: ActivityBase) {
  const [open, setOpen] = useState<string | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const panel = open ? <StudentPanel base={base} id={open} onClose={close} /> : null;
  return { openStudent: setOpen, panel };
}

/* -------------------------------------------------------------------------- */
/* Students                                                                    */
/* -------------------------------------------------------------------------- */

export function StudentsList({ base, bare, children }: ListProps) {
  const { openStudent, panel } = useStudentPanel(base);
  const platform = base === '/platform/activity';

  const columns: Column<StudentRow>[] = [
    {
      key: 'name',
      label: 'Student',
      render: (s) => <StudentName name={s.name} sub={s.email} onOpen={() => openStudent(s.id)} />,
    },
    {
      key: 'college',
      label: 'College',
      render: (s) =>
        s.college ? (
          <>
            <span>{s.college}</span>
            {!s.onPartnerCollege && <span className="row-sub">Not on Apli.ai yet</span>}
          </>
        ) : (
          '—'
        ),
    },
    {
      key: 'course',
      label: 'Course',
      render: (s) => (s.course ? cell.primary(s.course, s.graduationYear ? `Class of ${s.graduationYear}` : null) : '—'),
    },
    { key: 'started', label: 'Simulations', numeric: true, render: (s) => s.started },
    { key: 'certified', label: 'Certified', numeric: true, render: (s) => s.certified },
    { key: 'offers', label: 'Offers', numeric: true, render: (s) => s.offers },
    { key: 'interviews', label: 'Interviews', numeric: true, render: (s) => s.interviews },
    { key: 'joined', label: 'Joined', render: (s) => fmt(s.joinedAt) },
  ];

  const filters: Filter[] = [
    {
      key: 'status',
      label: 'Any activity',
      options: [
        { value: 'active', label: 'Working on a simulation' },
        { value: 'certified', label: 'Has a certificate' },
        { value: 'idle', label: 'Not started yet' },
      ],
    },
  ];
  if (platform)
    filters.push({
      key: 'attached',
      label: 'Any college',
      options: [
        { value: 'true', label: 'At a partner institution' },
        { value: 'false', label: 'Signed up on their own' },
      ],
    });

  return (
    <>
      <AdminTable<StudentRow>
        bare={bare}
        title="Students"
        lede={
          platform
            ? 'Every student on Apli.ai, including those whose college is not on the platform yet.'
            : 'Your students and how far they have got in the student app. Open one to see their simulations, offers and interviews.'
        }
        path={`${base}/students`}
        searchPlaceholder="Search by name or email…"
        rowKey={(s) => s.id}
        columns={columns}
        filters={filters}
        emptyMessage="No students match."
      >
        {children}
      </AdminTable>
      {panel}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Simulations                                                                 */
/* -------------------------------------------------------------------------- */

export function SimulationsList({ base, bare, children }: ListProps) {
  const columns: Column<SimulationRow>[] = [
    { key: 'title', label: 'Simulation', render: (s) => cell.primary(s.title, s.company) },
    { key: 'field', label: 'Field', render: (s) => cell.primary(s.field, `${LEVEL_LABEL[s.level]} · ${s.hours} h`) },
    { key: 'tasks', label: 'Tasks', numeric: true, render: (s) => s.tasks },
    { key: 'started', label: 'Started', numeric: true, render: (s) => s.started },
    { key: 'review', label: 'In review', numeric: true, render: (s) => s.inReview },
    { key: 'certified', label: 'Certified', numeric: true, render: (s) => s.certified },
    {
      key: 'status',
      label: 'Status',
      render: (s) => (s.status === 'LIVE' ? cell.pill('Live', 'pass') : cell.pill('Retired', 'idle')),
    },
  ];

  return (
    <AdminTable<SimulationRow>
      bare={bare}
      title="Simulations"
      lede={
        base === '/admin'
          ? 'The work simulations students can take, with how many of your students started and finished each.'
          : 'Every simulation students can take, and how students are getting on in each.'
      }
      path={`${base}/simulations`}
      searchPlaceholder="Search by title, field or company…"
      rowKey={(s) => s.id}
      columns={columns}
      filters={[
        {
          key: 'status',
          label: 'Live and retired',
          options: [
            { value: 'LIVE', label: 'Live' },
            { value: 'RETIRED', label: 'Retired' },
          ],
        },
      ]}
      emptyMessage="No simulations are live yet."
    >
      {children}
    </AdminTable>
  );
}

/* -------------------------------------------------------------------------- */
/* Student work                                                                */
/* -------------------------------------------------------------------------- */

export function WorkList({ base, bare, children }: ListProps) {
  const { openStudent, panel } = useStudentPanel(base);

  const columns: Column<WorkRow>[] = [
    {
      key: 'student',
      label: 'Student',
      render: (r) => <StudentName name={r.student} sub={r.college ?? r.email} onOpen={() => openStudent(r.studentId)} />,
    },
    { key: 'sim', label: 'Simulation', render: (r) => cell.primary(r.simulation, r.company) },
    {
      key: 'progress',
      label: 'Tasks',
      render: (r) => <Progress done={r.tasksDone} total={r.tasks} />,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => {
        const [label, tone] = RUN_LABEL[r.status];
        return cell.pill(label, tone);
      },
    },
    { key: 'shared', label: 'Shared with', numeric: true, render: (r) => r.sharedWith },
    { key: 'active', label: 'Last active', render: (r) => fmt(r.lastActiveAt) },
    {
      key: 'cert',
      label: 'Certificate',
      render: (r) =>
        r.certificateCode ? (
          <a className="sv-cert" href={`/certificates/${r.certificateCode}`} target="_blank" rel="noreferrer">
            {r.certificateCode}
          </a>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <>
      <AdminTable<WorkRow>
        bare={bare}
        title="Student work"
        lede="Every simulation a student has started: how far they are, whether it is waiting on a reviewer, and the certificate once it is approved."
        path={`${base}/work`}
        searchPlaceholder="Search by student name or email…"
        rowKey={(r) => r.id}
        columns={columns}
        filters={[{ key: 'status', label: 'Any status', options: options(RUN_LABEL) }]}
        emptyMessage="No student has started a simulation yet."
      >
        {children}
      </AdminTable>
      {panel}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Internship offers                                                           */
/* -------------------------------------------------------------------------- */

export function OffersList({ base, bare, children }: ListProps) {
  const { openStudent, panel } = useStudentPanel(base);

  const columns: Column<OfferRow>[] = [
    {
      key: 'student',
      label: 'Student',
      render: (o) => <StudentName name={o.student} sub={o.college ?? o.email} onOpen={() => openStudent(o.studentId)} />,
    },
    { key: 'role', label: 'Internship', render: (o) => cell.primary(o.role, o.company) },
    {
      key: 'terms',
      label: 'Terms',
      render: (o) =>
        cell.primary(
          `${o.months} ${o.months === 1 ? 'month' : 'months'} · ${rupees(o.stipend)}`,
          o.workMode === 'REMOTE' || !o.city ? workMode(o.workMode) : `${workMode(o.workMode)} · ${o.city}`,
        ),
    },
    { key: 'from', label: 'From simulation', render: (o) => o.fromSimulation ?? '—' },
    {
      key: 'status',
      label: 'Status',
      render: (o) => {
        const [label, tone] = OFFER_LABEL[o.status];
        return cell.pill(label, tone);
      },
    },
    { key: 'sent', label: 'Sent', render: (o) => fmt(o.sentAt) },
    { key: 'by', label: 'Reply by', render: (o) => fmt(o.respondBy) },
  ];

  return (
    <>
      <AdminTable<OfferRow>
        bare={bare}
        title="Internship offers"
        lede="Internships companies have offered students, usually on the strength of their simulation work, and what each student said."
        path={`${base}/offers`}
        searchPlaceholder="Search by student name or email…"
        rowKey={(o) => o.id}
        columns={columns}
        filters={[{ key: 'status', label: 'Any status', options: options(OFFER_LABEL) }]}
        emptyMessage="No internship offers yet."
      >
        {children}
      </AdminTable>
      {panel}
    </>
  );
}

function workMode(m: string) {
  return m === 'REMOTE' ? 'Remote' : m === 'HYBRID' ? 'Hybrid' : m === 'OFFICE' ? 'In office' : m;
}

/* -------------------------------------------------------------------------- */
/* Interviews                                                                  */
/* -------------------------------------------------------------------------- */

export function InterviewsList({ base, bare, children }: ListProps) {
  const { openStudent, panel } = useStudentPanel(base);

  const columns: Column<InterviewRow>[] = [
    {
      key: 'student',
      label: 'Student',
      render: (i) => <StudentName name={i.student} sub={i.college ?? i.email} onOpen={() => openStudent(i.studentId)} />,
    },
    { key: 'role', label: 'Role', render: (i) => cell.primary(i.role, i.company) },
    {
      key: 'round',
      label: 'Round',
      render: (i) =>
        i.rounds ? cell.primary(`${Math.min(i.round, i.rounds)} of ${i.rounds}`, i.roundName) : '—',
    },
    {
      key: 'status',
      label: 'Status',
      render: (i) => {
        const [label, tone] = INVITE_LABEL[i.status];
        return cell.pill(label, tone);
      },
    },
    { key: 'sent', label: 'Invited', render: (i) => fmt(i.sentAt) },
    { key: 'updated', label: 'Last change', render: (i) => fmt(i.updatedAt) },
  ];

  return (
    <>
      <AdminTable<InterviewRow>
        bare={bare}
        title="Interviews"
        lede="Students companies have invited to interview, and which round each one has reached."
        path={`${base}/interviews`}
        searchPlaceholder="Search by student name or email…"
        rowKey={(i) => i.id}
        columns={columns}
        filters={[{ key: 'status', label: 'Any status', options: options(INVITE_LABEL) }]}
        emptyMessage="No interview invitations yet."
      >
        {children}
      </AdminTable>
      {panel}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* One student                                                                 */
/* -------------------------------------------------------------------------- */

function Progress({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((Math.min(done, total) / total) * 100) : 0;
  return (
    <span className="sv-progress" title={`${done} of ${total} tasks handed in`}>
      <span className="sv-progress-bar">
        <span style={{ width: `${pct}%` }} />
      </span>
      <span className="sv-progress-text">
        {done}/{total}
      </span>
    </span>
  );
}

export function StudentPanel({ base, id, onClose }: { base: ActivityBase; id: string; onClose: () => void }) {
  const [s, setS] = useState<StudentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setS(null);
    setError(null);
    studentActivityApi
      .student(base, id)
      .then(setS)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load this student.'));
  }, [base, id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    box.current?.focus();
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = before;
    };
  }, [onClose]);

  return (
    <div className="sv-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sv-panel" role="dialog" aria-modal="true" aria-labelledby="sv-title" tabIndex={-1} ref={box}>
        <header className="sv-head">
          <div>
            <h2 id="sv-title">{s?.name ?? 'Student'}</h2>
            {s && <p>{s.email}</p>}
          </div>
          <button type="button" className="sv-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="sv-body">
          {error && <p className="alert alert-error">{error}</p>}
          {!s && !error && <p className="muted">Loading…</p>}

          {s && (
            <>
              <dl className="sv-facts">
                <Fact label="College" value={s.college ? `${s.college}${s.onPartnerCollege ? '' : ' (not on Apli.ai yet)'}` : null} />
                <Fact label="Course" value={[s.degreeLevel, s.course, s.specialisation].filter(Boolean).join(' · ') || null} />
                <Fact label="Graduates" value={s.graduationYear ? String(s.graduationYear) : null} />
                <Fact label="City" value={s.city} />
                <Fact label="Phone" value={s.phone} />
                <Fact label="Batch" value={s.batches.map((b) => (b.rollNo ? `${b.name} (${b.rollNo})` : b.name)).join(', ') || null} />
                <Fact label="Joined" value={fmt(s.joinedAt)} />
                <Fact label="Last signed in" value={fmt(s.lastLoginAt)} />
                <Fact label="Account" value={s.isActive ? 'Active' : 'Disabled'} />
              </dl>

              {s.headline && <p className="sv-headline">“{s.headline}”</p>}
              {s.interests.length > 0 && (
                <div className="sv-chips" aria-label="Interests">
                  {s.interests.map((i) => (
                    <span key={i} className="sv-chip">
                      {i}
                    </span>
                  ))}
                </div>
              )}

              <section className="sv-section">
                <h3>Simulations ({s.runs.length})</h3>
                {s.runs.length === 0 ? (
                  <p className="muted">Has not started a simulation yet.</p>
                ) : (
                  <ul className="sv-items">
                    {s.runs.map((r) => {
                      const [label, tone] = RUN_LABEL[r.status];
                      return (
                        <li key={r.id}>
                          <div className="sv-item-main">
                            <b>{r.simulation}</b>
                            <span>
                              {r.company} · {r.field}
                            </span>
                            {r.status === 'NEEDS_WORK' && r.reviewNote && (
                              <span className="sv-note">Reviewer: {r.reviewNote}</span>
                            )}
                          </div>
                          <div className="sv-item-side">
                            {cell.pill(label, tone)}
                            <Progress done={r.tasksDone} total={r.tasks} />
                            {r.certificateCode ? (
                              <a className="sv-cert" href={`/certificates/${r.certificateCode}`} target="_blank" rel="noreferrer">
                                {r.certificateCode}
                              </a>
                            ) : (
                              <span className="row-sub">Active {fmt(r.lastActiveAt)}</span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="sv-section">
                <h3>Internship offers ({s.offers.length})</h3>
                {s.offers.length === 0 ? (
                  <p className="muted">No offers yet.</p>
                ) : (
                  <ul className="sv-items">
                    {s.offers.map((o) => {
                      const [label, tone] = OFFER_LABEL[o.status];
                      return (
                        <li key={o.id}>
                          <div className="sv-item-main">
                            <b>{o.role}</b>
                            <span>
                              {o.company} · {o.months} {o.months === 1 ? 'month' : 'months'} · {rupees(o.stipend)}
                            </span>
                          </div>
                          <div className="sv-item-side">
                            {cell.pill(label, tone)}
                            <span className="row-sub">Sent {fmt(o.sentAt)}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="sv-section">
                <h3>Interviews ({s.interviews.length})</h3>
                {s.interviews.length === 0 ? (
                  <p className="muted">No interview invitations yet.</p>
                ) : (
                  <ul className="sv-items">
                    {s.interviews.map((i) => {
                      const [label, tone] = INVITE_LABEL[i.status];
                      return (
                        <li key={i.id}>
                          <div className="sv-item-main">
                            <b>{i.role}</b>
                            <span>
                              {i.company}
                              {i.rounds ? ` · round ${Math.min(i.round, i.rounds)} of ${i.rounds}` : ''}
                            </span>
                          </div>
                          <div className="sv-item-side">
                            {cell.pill(label, tone)}
                            <span className="row-sub">Invited {fmt(i.sentAt)}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || '—'}</dd>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Stat strip                                                                  */
/* -------------------------------------------------------------------------- */

export function StatStrip({ items }: { items: { label: string; value: number; hint?: string }[] }) {
  return (
    <div className="sv-stats">
      {items.map((i) => (
        <div key={i.label} className="sv-stat">
          <p className="sv-stat-value">{i.value.toLocaleString('en-IN')}</p>
          <p className="sv-stat-label">{i.label}</p>
          {i.hint && <p className="sv-stat-hint">{i.hint}</p>}
        </div>
      ))}
    </div>
  );
}
