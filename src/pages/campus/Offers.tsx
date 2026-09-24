import { useCallback, useEffect, useState } from 'react';
import CampusLayout from './CampusLayout';
import { ApiError } from '../../api/client';
import {
  afterOfferApi,
  JOINING_LABEL,
  JOINING_PILL,
  prettyDate,
  relativeDays,
  type CollegeCompanyRow,
  type CollegeOfferRow,
  type CollegeOffers,
  type ReliabilityRow,
} from '../../api/afterOffer';
import { useAuth } from '../../auth/AuthContext';
import { JoiningHistory } from '../student/AfterOffer';
import '../student/AfterOffer.css';
import './Offers.css';

type Tab = 'offers' | 'companies' | 'reliability';

const RELIABILITY_LABEL: Record<string, string> = {
  NO_SHOW: 'Did not turn up',
  RENEGED: 'Went back on an acceptance',
};

/**
 * Accepted offers at this college, all the way to the first day.
 *
 * The rows a placement officer should act on - a date that has passed, a
 * delay, a withdrawal - are coloured and sorted first; the rest is there to
 * look up. The Companies tab is the same promise seen from the other side:
 * which recruiters keep their offers, and how students found their process.
 */
export default function Offers() {
  const { hasModule, can } = useAuth();
  const on = hasModule('trust.offerProtection');
  const showReliability = hasModule('trust.reputation') && can('student:read');
  const [tab, setTab] = useState<Tab>('offers');
  const [companyId, setCompanyId] = useState('');
  const [data, setData] = useState<CollegeOffers | null>(null);
  const [companies, setCompanies] = useState<{ rows: CollegeCompanyRow[]; ratingsShown: boolean } | null>(null);
  const [marks, setMarks] = useState<ReliabilityRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!on) return;
    afterOfferApi
      .collegeOffers(companyId || undefined)
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load offers.'));
  }, [on, companyId]);

  useEffect(load, [load]);

  useEffect(() => {
    if (!on) return;
    if (tab === 'companies' && !companies) {
      afterOfferApi
        .collegeCompanies()
        .then((r) => setCompanies({ rows: r.companies, ratingsShown: r.ratingsShown }))
        .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load companies.'));
    }
    if (tab === 'reliability' && !marks && showReliability) {
      afterOfferApi
        .collegeReliability()
        .then(setMarks)
        .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load this.'));
    }
  }, [on, tab, companies, marks, showReliability]);

  if (!on) {
    return (
      <CampusLayout>
        <header className="page-head">
          <div>
            <p className="eyebrow">Placement cell</p>
            <h1>Offers</h1>
            <p className="page-lede">Offer protection is not switched on for your institution.</p>
          </div>
        </header>
      </CampusLayout>
    );
  }

  const s = data?.summary;
  // What needs attention first: withdrawn, then overdue, then delayed.
  const weight = (r: CollegeOfferRow) =>
    r.tracker.status === 'REVOKED' ? 0 : r.tracker.overdue ? 1 : r.tracker.status === 'DELAYED' ? 2 : 3;
  const rows = [...(data?.offers ?? [])].sort((a, b) => weight(a) - weight(b));

  return (
    <CampusLayout>
      <header className="page-head">
        <div>
          <p className="eyebrow">Placement cell</p>
          <h1>Offers</h1>
          <p className="page-lede">
            Every accepted offer until the student's first day. Companies update the joining date here; students can tell you
            when they hear nothing.
          </p>
        </div>
      </header>

      {error && <p className="alert alert-error">{error}</p>}

      <div className="stat-row">
        <Stat label="Accepted offers" value={s?.total} />
        <Stat label="Joined" value={s?.joined} />
        <Stat label="Past the date" value={s?.overdue} warn={Boolean(s?.overdue)} />
        <Stat label="Delayed" value={s?.delayed} warn={Boolean(s?.delayed)} />
        <Stat label="Withdrawn" value={s?.revoked} stop={Boolean(s?.revoked)} />
      </div>

      <div className="seg offers-tabs" role="tablist" aria-label="View">
        <button type="button" role="tab" aria-selected={tab === 'offers'} className={`seg-opt ${tab === 'offers' ? 'is-on' : ''}`} onClick={() => setTab('offers')}>
          Offers
        </button>
        <button type="button" role="tab" aria-selected={tab === 'companies'} className={`seg-opt ${tab === 'companies' ? 'is-on' : ''}`} onClick={() => setTab('companies')}>
          Companies
        </button>
        {showReliability && (
          <button type="button" role="tab" aria-selected={tab === 'reliability'} className={`seg-opt ${tab === 'reliability' ? 'is-on' : ''}`} onClick={() => setTab('reliability')}>
            Students to talk to
          </button>
        )}
      </div>

      {tab === 'offers' && (
        <section className="card">
          <div className="offers-bar">
            <label className="muted" htmlFor="offers-company">
              Company
            </label>
            <select id="offers-company" className="input offers-select" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">All companies</option>
              {data?.companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {data === null ? (
            <p className="muted">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="muted">No accepted offers yet.</p>
          ) : (
            <table className="offers-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Company and role</th>
                  <th>Joining</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <OfferRow key={r.applicationId} row={r} canNote={can('application:advance')} onNoted={load} />
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {tab === 'companies' && (
        <section className="card">
          <p className="muted">
            Offer-honour rate counts only offers whose outcome is known (joined or withdrawn), and is shown from five up.
            {companies?.ratingsShown && ' Process ratings are students’ totals, also shown from five ratings up.'}
          </p>
          {companies === null ? (
            <p className="muted">Loading…</p>
          ) : companies.rows.length === 0 ? (
            <p className="muted">No company has made an offer here yet.</p>
          ) : (
            <table className="offers-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Offers / accepted</th>
                  <th>Offers honoured</th>
                  {companies.ratingsShown && <th>Process rating</th>}
                </tr>
              </thead>
              <tbody>
                {companies.rows.map((c) => (
                  <tr key={c.id} className={c.honour.revoked > 0 ? 'is-flagged' : ''}>
                    <td>{c.name}</td>
                    <td>
                      {c.offers} / {c.accepted}
                    </td>
                    <td>
                      {c.honour.enough ? `${c.honour.rate}%` : <span className="muted">Not enough data yet</span>}
                      <small>
                        {c.honour.joined} joined · {c.honour.revoked} withdrawn
                      </small>
                    </td>
                    {companies.ratingsShown && (
                      <td>
                        {c.rating?.enough ? (
                          <>
                            {c.rating.overall} / 5
                            <small>
                              communication {c.rating.communication} · clarity {c.rating.clarity} · fairness {c.rating.fairness}
                            </small>
                          </>
                        ) : (
                          <span className="muted">{c.rating?.count ? `${c.rating.count} so far` : 'No ratings yet'}</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {tab === 'reliability' && showReliability && (
        <section className="card">
          <p className="muted">
            Companies told us these students missed a round or did not join after accepting. Worth a conversation - there is
            often a reason. Never shared with other companies.
          </p>
          {marks === null ? (
            <p className="muted">Loading…</p>
          ) : marks.length === 0 ? (
            <p className="muted">Nothing here. Good.</p>
          ) : (
            <table className="offers-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Company and role</th>
                  <th>What happened</th>
                </tr>
              </thead>
              <tbody>
                {marks.map((m) => (
                  <tr key={m.applicationId}>
                    <td>{m.student}</td>
                    <td>
                      {m.company}
                      <small>{m.job}</small>
                    </td>
                    <td>
                      {RELIABILITY_LABEL[m.kind] ?? m.kind}
                      <small>
                        {new Date(m.at).toLocaleDateString('en-IN')}
                        {m.note ? ` · ${m.note}` : ''}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </CampusLayout>
  );
}

function OfferRow({ row, canNote, onNoted }: { row: CollegeOfferRow; canNote: boolean; onNoted: () => void }) {
  const t = row.tracker;
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await afterOfferApi.collegeNote(row.applicationId, note.trim());
      setNote('');
      setOpen(false);
      onNoted();
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className={t.status === 'REVOKED' ? 'is-revoked' : t.overdue || t.status === 'DELAYED' ? 'is-flagged' : ''}>
      <td>{row.student}</td>
      <td>
        {row.company.name}
        <small>{row.job.title}</small>
      </td>
      <td>
        {prettyDate(t.expectedJoiningDate)}
        {t.daysToJoining !== null && <small>{relativeDays(t.daysToJoining)}</small>}
      </td>
      <td>
        <span className={`pill ${JOINING_PILL[t.status]}`}>{t.overdue ? 'Past the date' : JOINING_LABEL[t.status]}</span>
        {t.reason && <small>{t.reason}</small>}
        {t.history.length > 0 && <JoiningHistory entries={t.history} />}
        {canNote &&
          (open ? (
            <div className="offers-note">
              <input className="input" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="e.g. called HR, joining confirmed for next month" />
              <button type="button" className="btn btn-primary btn-sm" disabled={busy || note.trim().length < 2} onClick={save}>
                Add
              </button>
            </div>
          ) : (
            <button type="button" className="link-btn" onClick={() => setOpen(true)}>
              Add a note
            </button>
          ))}
      </td>
    </tr>
  );
}

function Stat({ label, value, warn, stop }: { label: string; value?: number; warn?: boolean; stop?: boolean }) {
  return (
    <div className={`stat ${warn ? 'is-warn' : ''} ${stop ? 'is-stop' : ''}`}>
      <p className="stat-value">{value ?? '—'}</p>
      <p className="stat-label">{label}</p>
    </div>
  );
}
