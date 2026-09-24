import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import CampusLayout from './CampusLayout';
import { ApiError } from '../../api/client';
import { opsApi, type DriveBoard, type DriveOption, type DriveStudent } from '../../api/ops';
import { useAuth } from '../../auth/AuthContext';
import './DriveDay.css';

type Tab = 'board' | 'checkin' | 'rooms';

const STATUS_TEXT: Record<string, string> = {
  APPLIED: 'Applied',
  UNDER_REVIEW: 'Being reviewed',
  IN_ROUND: 'In a round',
  WAITLISTED: 'Waitlisted',
  OFFERED: 'Offered',
  ACCEPTED: 'Accepted',
  HIRED: 'Hired',
  DECLINED: 'Declined',
  REJECTED: 'Not selected',
  WITHDRAWN: 'Withdrawn',
};

/** How often the board re-reads itself while the page is open. */
const REFRESH_MS = 20_000;

/**
 * Drive day: the control desk for the day companies are on campus.
 *
 * Pick the drive, then everything on one screen - where each applicant is,
 * who has arrived, which room is whose. Students arrive with a pass on their
 * phone; the desk scans it, or types its eight-character code, or ticks the
 * name. All three end in the same check-in, and doing it twice is harmless.
 */
export default function DriveDay() {
  const { hasModule, can } = useAuth();
  const on = hasModule('ops.driveDay') && can('drive:write');
  const [params, setParams] = useSearchParams();
  const driveId = params.get('drive');

  const [drives, setDrives] = useState<DriveOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!on) return;
    opsApi
      .drives()
      .then(setDrives)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load your drives.'));
  }, [on]);

  if (!on) {
    return (
      <CampusLayout>
        <header className="page-head">
          <div>
            <p className="eyebrow">Placement cell</p>
            <h1>Drive day</h1>
            <p className="page-lede">
              {hasModule('ops.driveDay')
                ? 'Your role cannot run drives. Ask your placement officer.'
                : 'Drive day tools are not switched on for your institution.'}
            </p>
          </div>
        </header>
      </CampusLayout>
    );
  }

  if (driveId) {
    return (
      <CampusLayout>
        <DriveDesk placementId={driveId} onBack={() => setParams({}, { replace: true })} />
      </CampusLayout>
    );
  }

  return (
    <CampusLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Placement cell</p>
          <h1>Drive day</h1>
          <p className="page-lede">Pick the drive that is running today.</p>
        </div>
      </header>
      {error && <p className="alert alert-error">{error}</p>}
      {drives === null && !error && <p className="muted">Loading…</p>}
      {drives?.length === 0 && (
        <div className="empty">
          <h2>No open drives</h2>
          <p>
            Open a season first from <Link to="/campus/drives">Seasons</Link>. Its roles and students appear here.
          </p>
        </div>
      )}
      <div className="dd-drives">
        {drives?.map((d) => (
          <button key={d.id} type="button" className="dd-drive" onClick={() => setParams({ drive: d.id })}>
            <strong>{d.name}</strong>
            <span className="muted">
              {d.type === 'INTERNSHIP' ? 'Internships' : 'Final placements'} · {d.year}
            </span>
            <span className="dd-drive-stats">
              {d.roles} role{d.roles === 1 ? '' : 's'} · {d.applications} applications · {d.checkedIn} checked in
            </span>
          </button>
        ))}
      </div>
    </CampusLayout>
  );
}

function DriveDesk({ placementId, onBack }: { placementId: string; onBack: () => void }) {
  const [board, setBoard] = useState<DriveBoard | null>(null);
  const [students, setStudents] = useState<DriveStudent[] | null>(null);
  const [tab, setTab] = useState<Tab>('board');
  const [scanning, setScanning] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'again' | 'bad'; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [b, s] = await Promise.all([opsApi.board(placementId), opsApi.students(placementId)]);
      setBoard(b);
      setStudents(s);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this drive.');
    }
  }, [placementId]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(t);
  }, [load]);

  const showToast = useCallback((t: { kind: 'ok' | 'again' | 'bad'; text: string }) => {
    setToast(t);
    window.setTimeout(() => setToast((cur) => (cur === t ? null : cur)), 3500);
  }, []);

  const checkIn = useCallback(
    async (data: { token?: string; code?: string; candidateId?: string }) => {
      try {
        const r = await opsApi.checkIn(placementId, data);
        showToast(
          r.alreadyCheckedIn ? { kind: 'again', text: `${r.name} was already checked in` } : { kind: 'ok', text: `${r.name} checked in` },
        );
        void load();
      } catch (err) {
        showToast({ kind: 'bad', text: err instanceof ApiError ? err.message : 'Could not check that pass.' });
      }
    },
    [placementId, load, showToast],
  );

  const total = students?.length ?? 0;
  const arrived = students?.filter((s) => s.checkedInAt).length ?? 0;

  return (
    <>
      <header className="page-head">
        <div>
          <button type="button" className="link-btn" onClick={onBack}>
            ← All drives
          </button>
          <h1>{board?.drive.name ?? 'Drive day'}</h1>
          <p className="page-lede">
            {arrived} of {total} students checked in. The board refreshes by itself.
          </p>
        </div>
        <div className="dd-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => board && opsApi.attendanceCsv(placementId, board.drive.name).catch(() => setError('Could not download.'))}
          >
            Attendance CSV
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setScanning((v) => !v)} aria-expanded={scanning}>
            {scanning ? 'Close scanner' : 'Check students in'}
          </button>
        </div>
      </header>

      {error && <p className="alert alert-error">{error}</p>}
      {toast && (
        <p className={`dd-toast is-${toast.kind}`} role="status">
          {toast.text}
        </p>
      )}

      {scanning && <Scanner onToken={(token) => checkIn({ token })} onCode={(code) => checkIn({ code })} />}

      <div className="dd-tabs" role="tablist">
        {(
          [
            ['board', 'Live board'],
            ['checkin', `Check-in list (${arrived}/${total})`],
            ['rooms', `Rooms (${board?.rooms.length ?? 0})`],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'is-on' : ''} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'board' && board && <Board board={board} />}
      {tab === 'checkin' && students && (
        <CheckInList
          students={students}
          onCheck={(candidateId) => checkIn({ candidateId })}
          onUndo={(candidateId) =>
            opsApi
              .undoCheckIn(placementId, candidateId)
              .then(load)
              .catch(() => setError('Could not undo that.'))
          }
        />
      )}
      {tab === 'rooms' && board && <Rooms placementId={placementId} board={board} onChanged={load} onError={setError} />}
    </>
  );
}

function Board({ board }: { board: DriveBoard }) {
  if (board.jobs.length === 0) {
    return (
      <div className="empty">
        <h2>No roles in this drive yet</h2>
        <p>Roles appear here once you accept a company's request for this drive.</p>
      </div>
    );
  }
  return (
    <div className="dd-jobs">
      {board.jobs.map((j) => (
        <section key={j.jobId} className="card dd-job">
          <div className="dd-job-head">
            <div>
              <h2>{j.title}</h2>
              <p className="muted">{j.company}</p>
            </div>
            <p className="dd-job-totals">
              <strong>{j.totals.checkedIn}</strong>/{j.totals.applicants} here · {j.totals.offered} offered
            </p>
          </div>
          <div className="dd-rounds">
            {j.rounds.map((r) => (
              <span key={r.id} className="dd-round">
                {r.name} <strong>{r.count}</strong>
              </span>
            ))}
            {j.rooms.map((r) => (
              <span key={r.id} className="dd-room">
                {r.name}
                {r.panel ? ` · ${r.panel}` : ''}
              </span>
            ))}
          </div>
          {j.applicants.length > 0 && (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Where</th>
                    <th>Status</th>
                    <th>Arrived</th>
                  </tr>
                </thead>
                <tbody>
                  {j.applicants.map((a) => (
                    <tr key={a.applicationId}>
                      <td>{a.name}</td>
                      <td>{a.failedIn ? `Stopped at ${a.failedIn}` : (a.round ?? '—')}</td>
                      <td>{STATUS_TEXT[a.status] ?? a.status}</td>
                      <td>
                        {a.checkedInAt ? (
                          <span className="pill pill-pass">
                            {new Date(a.checkedInAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <span className="pill pill-idle">Not yet</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function CheckInList({
  students,
  onCheck,
  onUndo,
}: {
  students: DriveStudent[];
  onCheck: (id: string) => void;
  onUndo: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return students.filter((x) => !s || x.name.toLowerCase().includes(s) || (x.rollNo ?? '').toLowerCase().includes(s));
  }, [students, q]);

  return (
    <div className="card">
      <input className="dd-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find by name or roll number" aria-label="Find a student" />
      <ul className="dd-roster">
        {shown.map((s) => (
          <li key={s.candidateId} className={s.checkedInAt ? 'is-in' : ''}>
            <label>
              <input type="checkbox" checked={Boolean(s.checkedInAt)} onChange={() => (s.checkedInAt ? onUndo(s.candidateId) : onCheck(s.candidateId))} />
              <span>
                <strong>{s.name}</strong>
                <small>
                  {[s.rollNo, s.batch].filter(Boolean).join(' · ')}
                  {s.checkedInAt &&
                    ` · in at ${new Date(s.checkedInAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}${s.method === 'QR' ? ' (pass)' : ''}`}
                </small>
              </span>
            </label>
          </li>
        ))}
        {shown.length === 0 && <li className="muted">Nobody matches that.</li>}
      </ul>
    </div>
  );
}

function Rooms({
  placementId,
  board,
  onChanged,
  onError,
}: {
  placementId: string;
  board: DriveBoard;
  onChanged: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const [form, setForm] = useState({ name: '', panel: '', jobId: '' });

  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await opsApi.addRoom(placementId, form);
      setForm({ name: '', panel: '', jobId: '' });
      await onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not add that room.');
    }
  }

  const jobTitle = new Map(board.jobs.map((j) => [j.jobId, `${j.title} · ${j.company}`]));

  return (
    <div className="card">
      <form className="dd-room-form" onSubmit={add}>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Room or hall - e.g. Seminar Hall 2" />
        <select value={form.jobId} onChange={(e) => setForm({ ...form, jobId: e.target.value })}>
          <option value="">Any role</option>
          {board.jobs.map((j) => (
            <option key={j.jobId} value={j.jobId}>
              {j.title} · {j.company}
            </option>
          ))}
        </select>
        <input value={form.panel} onChange={(e) => setForm({ ...form, panel: e.target.value })} placeholder="Panel - e.g. Technical panel A" />
        <button type="submit" className="btn btn-primary btn-sm" disabled={!form.name.trim()}>
          Add room
        </button>
      </form>
      {board.rooms.length === 0 ? (
        <p className="muted">No rooms yet. Add one per interview panel or test hall.</p>
      ) : (
        <ul className="dd-room-list">
          {board.rooms.map((r) => (
            <li key={r.id}>
              <strong>{r.name}</strong>
              <span className="muted">
                {r.jobId ? jobTitle.get(r.jobId) : 'Any role'}
                {r.panel ? ` · ${r.panel}` : ''}
              </span>
              <button
                type="button"
                className="link-btn is-danger"
                onClick={() => opsApi.removeRoom(placementId, r.id).then(onChanged).catch(() => onError('Could not remove that room.'))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The scanner                                                                 */
/* -------------------------------------------------------------------------- */

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike;

/**
 * Scans passes with the device camera where the browser can read QR codes
 * itself (the BarcodeDetector API - Chrome on Android and most desktops), and
 * always offers the typed eight-character code, which works everywhere.
 * Nothing from the camera leaves the device.
 */
function Scanner({ onToken, onCode }: { onToken: (t: string) => void; onCode: (c: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<'starting' | 'live' | 'unsupported' | 'denied'>('starting');
  const [code, setCode] = useState('');
  const recent = useRef(new Map<string, number>());
  // Held in a ref so a re-render of the page (the board refreshes itself)
  // does not restart the camera.
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
      setState('unsupported');
      return;
    }
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    const detector = new Ctor({ formats: ['qr_code'] });

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = s;
        void v.play();
        setState('live');
        timer = window.setInterval(async () => {
          if (!v.videoWidth) return;
          try {
            for (const b of await detector.detect(v)) {
              const now = Date.now();
              // The same pass held in front of the camera fires once, not every frame.
              if ((recent.current.get(b.rawValue) ?? 0) > now - 4000) continue;
              recent.current.set(b.rawValue, now);
              onTokenRef.current(b.rawValue);
            }
          } catch {
            // A frame that cannot be read is simply skipped.
          }
        }, 400);
      })
      .catch(() => setState('denied'));

    return () => {
      stopped = true;
      window.clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <section className="card dd-scanner">
      <div className="dd-camera">
        {state === 'live' || state === 'starting' ? (
          <video ref={videoRef} muted playsInline aria-label="Camera view for scanning passes" />
        ) : (
          <p className="muted">
            {state === 'denied'
              ? 'The camera was blocked. Allow it in the browser, or type the code instead.'
              : 'This browser cannot read QR codes from the camera. Type the code from the student’s pass instead.'}
          </p>
        )}
        {state === 'live' && <span className="dd-scan-hint">Hold the student’s pass steady in the frame</span>}
      </div>
      <form
        className="dd-code"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) onCode(code);
          setCode('');
        }}
      >
        <label htmlFor="dd-code">Or type the code on their pass</label>
        <div>
          <input
            id="dd-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD1234"
            maxLength={9}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="btn btn-primary" disabled={code.replace(/[^0-9A-Z]/g, '').length < 8}>
            Check in
          </button>
        </div>
      </form>
    </section>
  );
}
