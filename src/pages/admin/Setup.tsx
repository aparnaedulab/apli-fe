import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { api, ApiError } from '../../api/client';
import { adminApi, type CollegeSummary } from '../../api/admin';
import type { NewBatch } from '../../api/campus';
import CollegeForm from './CollegeForm';
import AddColleges from './AddColleges';
import BatchForm from '../../components/BatchForm';
import SetupLists from './SetupLists';
import AddStudents from '../../components/AddStudents';
import StudentIntake from './StudentIntake';
import MapData from '../../components/MapData';
import UniversityPrograms from './UniversityPrograms';
import { adminMapping, type Offered } from '../../api/mapping';
import './Setup.css';

interface SetupBatch {
  id: string;
  name: string;
  course: string | null;
  specialisation: string | null;
  graduationYear: number | null;
  studyYear: number | null;
  studentCount: number;
  /** Null for a batch that belongs to the university rather than a college. */
  collegeId: string | null;
  collegeName: string;
}

/** The Students step's choice for a file that spans colleges. */
const UNIVERSITY_LIST = 'university';

interface Totals {
  colleges: number;
  batches: number;
  students: number;
}

/**
 * Setting a university up, one screen at a time.
 *
 * The data is a chain - university, colleges, batches, students - and each
 * link needs the one before it. An earlier version put all four on the page at
 * once and it read as a wall: four forms, three levels of nesting, and no way
 * to tell which part you were meant to be looking at.
 *
 * So: a rail on the left showing the four steps and where you are, and one
 * pane on the right showing exactly one of them. Nothing stacks, nothing
 * collapses, and the pane always ends with the one sensible next thing.
 *
 * Everything here is also its own screen elsewhere. This is the same forms and
 * the same endpoints, in the order they depend on each other.
 */
export default function Setup() {
  const [step, setStep] = useState(1);

  const [university, setUniversity] = useState('');
  const [totals, setTotals] = useState<Totals | null>(null);

  const [colleges, setColleges] = useState<CollegeSummary[]>([]);
  const [collegeId, setCollegeId] = useState('');
  const [adding, setAdding] = useState<'one' | 'bulk' | 'batch' | null>(null);

  const [batches, setBatches] = useState<SetupBatch[] | null>(null);
  /** How many exist, which is not always how many came back. */
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchId, setBatchId] = useState('');

  /**
   * What a new batch will belong to, asked here rather than inherited.
   *
   * Step 2 is about which college you are *setting up*; this is about which
   * college a batch is *for*, and they are not always the same - a university
   * -wide batch belongs to no college at all. Asking in the place the batch is
   * made removes the guess.
   */
  const [batchScope, setBatchScope] = useState<'college' | 'university'>('college');
  const [batchCollegeId, setBatchCollegeId] = useState('');

  const [error, setError] = useState<string | null>(null);

  /** What the university runs - step 2 - and so what step 4 offers each college. */
  const [offered, setOffered] = useState<Offered | null>(null);
  /** The college steps 4 and 7 are mapping. Starts from step 3's choice. */
  const [mapCollegeId, setMapCollegeId] = useState('');

  const loadOffered = useCallback(async () => {
    try {
      setOffered((await adminMapping.overview()).offered);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the courses.');
    }
  }, []);

  useEffect(() => {
    void loadOffered();
  }, [loadOffered]);

  const college = colleges.find((c) => c.id === collegeId);
  const batch = (batches ?? []).find((b) => b.id === batchId);

  const [intakeCollegeId, setIntakeCollegeId] = useState('');

  /**
   * Which college the students being added belong to.
   *
   * A college-owned batch answers it by itself. A university-wide batch does
   * not - its members come from anywhere - and neither does "no batch", so in
   * those two cases step 4 has to ask. Step 2's college stands in when it can.
   */
  const impliedCollegeId = batch ? (batch.collegeId ?? '') : collegeId;
  const needsCollege = !impliedCollegeId;
  // The university's list is only a choice when no batch is; a batch needs a real college.
  const targetCollegeId =
    impliedCollegeId || (batch && intakeCollegeId === UNIVERSITY_LIST ? '' : intakeCollegeId);
  /**
   * The university's own list: one file across every college, each row naming
   * its college by code - or not yet, in which case Map data places it later.
   */
  const universityIntake = !batch && targetCollegeId === UNIVERSITY_LIST;

  const loadColleges = useCallback(async () => {
    try {
      const r = await adminApi.listColleges({ limit: 100, sort: 'name' });
      setColleges(r.colleges);
      setTotals(r.summary);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the colleges.');
    }
  }, []);

  /**
   * Every batch on the platform, in one list.
   *
   * Not just the chosen college's: a batch may belong to the university rather
   * than to any college, and you cannot pick what you cannot see. They are
   * grouped by owner below, with whichever college you are working on first.
   */
  const loadBatches = useCallback(async () => {
    try {
      // Unfiltered on purpose: a chosen college does not narrow this, because
      // the university-wide batches apply to its students too and would vanish
      // from the list. The endpoint caps a page at 100; past that the pane says
      // so rather than quietly showing a slice.
      const paged = await api.get<{
        total: number;
        rows: (Omit<SetupBatch, 'studentCount' | 'collegeName'> & {
          students: number;
          college: string;
        })[];
      }>('/admin/batches?pageSize=100');

      setBatchTotal(paged.total);
      setBatches(
        paged.rows.map((b) => ({ ...b, studentCount: b.students, collegeName: b.college })),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the batches.');
    }
  }, []);

  useEffect(() => {
    void loadColleges();
    api
      .get<{ homeUniversity: string }>('/admin/meta')
      .then((m) => setUniversity(m.homeUniversity))
      .catch(() => setUniversity(''));
  }, [loadColleges]);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  /**
   * Every batch, grouped by who owns it.
   *
   * The college being set up comes first, then the university's own - those
   * apply to its students too - then everyone else, so the list is complete
   * without burying what you are working on.
   */
  const grouped = useMemo(() => {
    const all = batches ?? [];
    const byOwner = new Map<string, { key: string; title: string; items: SetupBatch[] }>();

    for (const b of all) {
      const key = b.collegeId ?? 'university';
      if (!byOwner.has(key)) {
        byOwner.set(key, {
          key,
          title: b.collegeId ? b.collegeName : 'University-wide',
          items: [],
        });
      }
      byOwner.get(key)!.items.push(b);
    }

    const rank = (key: string) => (key === collegeId ? 0 : key === 'university' ? 1 : 2);

    return [...byOwner.values()].sort(
      (a, z) => rank(a.key) - rank(z.key) || a.title.localeCompare(z.title),
    );
  }, [batches, collegeId]);

  /** Moving step closes whatever form was open on the one you left. */
  function goTo(n: number) {
    setAdding(null);
    if ((n === 4 || n === 8) && !mapCollegeId && collegeId) setMapCollegeId(collegeId);
    setStep(n);
  }

  /** Opening the batch form starts from the college step 2 is on, if any. */
  function openBatchForm() {
    setBatchScope(collegeId ? 'college' : 'university');
    setBatchCollegeId(collegeId);
    setAdding('batch');
  }

  const newBatchCollegeId = batchScope === 'college' ? batchCollegeId : '';
  const newBatchCollege = colleges.find((c) => c.id === newBatchCollegeId);

  const mapCollege = colleges.find((c) => c.id === mapCollegeId);
  const mapScope = useMemo(
    () => (mapCollegeId ? adminMapping.forCollege(mapCollegeId) : null),
    [mapCollegeId],
  );

  const steps = [
    { n: 0, title: 'Lists', state: 'What every form offers', ready: true },
    { n: 1, title: 'University', state: university || '—', ready: true },
    {
      n: 2,
      title: 'Courses & branches',
      state: offered
        ? offered.fromCatalogue
          ? 'Not chosen yet'
          : `${offered.courses.length} course${offered.courses.length === 1 ? '' : 's'}`
        : '…',
      ready: true,
    },
    {
      n: 3,
      title: 'Colleges',
      state: college ? college.code : `${colleges.length} on the portal`,
      ready: true,
    },
    {
      n: 4,
      title: 'Map courses to colleges',
      state: mapCollege ? mapCollege.code : 'College → course → branch',
      ready: true,
    },
    {
      n: 5,
      title: 'Batches',
      state: `${batchTotal} on the platform`,
      // Never blocked: a batch can belong to the university rather than to any
      // college, so there is nothing to wait for.
      ready: true,
    },
    {
      n: 6,
      title: 'Student details',
      state: 'What to collect, and who adds',
      ready: true,
    },
    {
      n: 7,
      title: 'Students',
      state: batch ? `Into ${batch.name}` : targetCollegeId ? 'Batch from each row' : 'Choose where',
      // Never blocked: where the students go is chosen inside this step.
      ready: true,
    },
    { n: 8, title: 'Map students', state: 'Into each course and branch', ready: true },
  ];

  return (
    <AdminLayout>
      <header className="page-head">
        <div>
          <h1>Set up</h1>
          <p className="page-lede">
            Colleges, their batches, then the students in them — one step at a time, each
            remembering the last.
          </p>
        </div>
      </header>

      {error && <p className="alert alert-error">{error}</p>}

      <div className="setup">
        <nav className="setup-rail" aria-label="Set-up steps">
          {steps.map((s) => (
            <button
              key={s.n}
              type="button"
              className={`rail-step ${s.n === step ? 'is-current' : ''}`}
              onClick={() => s.ready && goTo(s.n)}
              disabled={!s.ready}
              aria-current={s.n === step ? 'step' : undefined}
            >
              <span className="rail-n">{s.n}</span>
              <span className="rail-text">
                {s.title}
                <span className="rail-state">{s.state}</span>
              </span>
            </button>
          ))}
        </nav>

        <section className="setup-pane">
          {step === 0 && (
            <Pane
              title="Lists"
              todo={[
                'Open each list and check it holds what this university uses.',
                'Add anything missing — a course, a city, a NAAC grade.',
                'Retire anything nobody uses. It leaves the forms and stays on the records that already carry it.',
              ]}
              note='Everything else in set-up picks from these, so a batch, a student and a job all mean the same thing by the same word.'
              lede="The courses, cities, grades and types every other form offers. Kept here so a batch, a student and a role all mean the same thing by the same word."
              next={{ label: 'University', onClick: () => goTo(1) }}
            >
              <SetupLists />
            </Pane>
          )}

          {step === 1 && (
            <Pane
              title={university || 'University'}
              todo={[
                'Check the name and contact details students and recruiters will see.',
                'Set the grading scale and when the academic year turns over.',
              ]}
              lede="Everything sits under this one university. Colleges are affiliated to it, and a batch can belong to it directly rather than to any single college."
              next={{ label: 'Courses & branches', onClick: () => goTo(2) }}
            >
              {totals && (
                <div className="tiles">
                  <Tile value={totals.colleges} label="Colleges" />
                  <Tile value={totals.batches} label="Batches" />
                  <Tile value={totals.students} label="Students" />
                </div>
              )}
              <p className="pane-note">
                The name is a server setting, so it reads the same on the college form, in the
                bulk-upload spreadsheet and on every college record.
              </p>
            </Pane>
          )}

          {step === 2 && (
            <Pane
              title="Courses & branches"
              todo={[
                'Tick the courses this university runs.',
                'Inside each course, tick its branches.',
                'Anything missing can be added from the Lists step.',
              ]}
              note='Colleges choose only from this list in the next-but-one step, so every college spells B.E. – Computer Engineering the same way.'
              lede="Tick the courses the university runs and, inside each, its branches. Colleges choose only from this list in step 4, so every college spells B.E. – Computer Engineering the same way."
              next={{ label: 'Colleges', onClick: () => goTo(3) }}
            >
              <UniversityPrograms onSaved={loadOffered} />
            </Pane>
          )}

          {step === 3 && (
            <Pane
              title="Colleges"
              todo={[
                'Add each college with its short code — PICT, COEP. The code is unique across the whole platform.',
                "Give each one a placement officer's email. They are sent an invitation as soon as you save.",
                'A college with no officer has nobody who can add its students.',
              ]}
              lede="Add the colleges this university affiliates, then choose the one you are setting up. Leave it blank to work on the university's own batches instead — a year group spanning every college, say."
              next={{ label: 'Map courses to colleges', onClick: () => goTo(4) }}
              more={{ to: '/admin/colleges', label: 'Open the full colleges screen' }}
            >
              <div className="pane-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setAdding((v) => (v === 'one' ? null : 'one'))}
                >
                  {adding === 'one' ? 'Cancel' : 'Add a college'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setAdding((v) => (v === 'bulk' ? null : 'bulk'))}
                >
                  {adding === 'bulk' ? 'Cancel' : 'Add many from Excel'}
                </button>
              </div>

              {adding === 'one' && (
                <CollegeForm
                  bare
                  onDone={() => {
                    setAdding(null);
                    void loadColleges();
                  }}
                  onCancel={() => setAdding(null)}
                />
              )}

              {adding === 'bulk' && <AddColleges bare onDone={loadColleges} />}

              {/* Adding and choosing are different jobs; only one at a time. */}
              {!adding && (
                <label className="pane-field">
                  <span className="pane-field-label">
                    Which college are you setting up? <span className="pane-optional">optional</span>
                  </span>
                  <select value={collegeId} onChange={(e) => setCollegeId(e.target.value)}>
                    <option value="">No college — the university itself</option>
                    {colleges.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code}) — {c.studentCount} student
                        {c.studentCount === 1 ? '' : 's'}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </Pane>
          )}

          {step === 4 && (
            <Pane
              title="Map courses to colleges"
              todo={[
                'Pick a college.',
                'Tick the course-and-branch pairs it actually runs.',
              ]}
              note='Worth doing before any roster is uploaded: a student whose programme is not on this list lands unmapped, and an unmapped student is invisible to every role that filters on a course.'
              context={mapCollege?.name}
              lede="Choose a college, then tick which of the university's courses and branches it runs. Do this for each college; the college's own login can add to it later."
              next={{ label: 'Batches', onClick: () => goTo(5) }}
              more={{ to: '/admin/map-data', label: 'See every college at once in Map data' }}
            >
              <MapCollegePicker colleges={colleges} value={mapCollegeId} onChange={setMapCollegeId} />
              {mapScope && mapCollege && offered && (
                <MapData
                  key={`p-${mapCollege.id}`}
                  only="programs"
                  scope={mapScope}
                  offered={offered}
                  collegeName={mapCollege.code}
                  onChanged={loadColleges}
                />
              )}
            </Pane>
          )}

          {step === 5 && (
            <Pane
              title="Batches"
              todo={[
                'Choose whether the batch belongs to the whole university or to one college.',
                'Name it the way this university does — “2026 Batch”, or “B.Tech CSE 2026”.',
              ]}
              note='A batch can also be created on the way in: a class list that names a batch nobody has made yet makes it.'
              context={`${batchTotal} on the platform`}
              lede="Every batch on the platform, grouped by what it belongs to. A batch is whichever students should be treated together — a degree cohort, a year of study, a department, or a group made for one drive. You choose which one students go into in step 4."
              next={{ label: 'Student details', onClick: () => goTo(6) }}
              more={{ to: '/admin/batches', label: 'Open the full batches screen' }}
            >
              <div className="pane-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => (adding === 'batch' ? setAdding(null) : openBatchForm())}
                >
                  {adding === 'batch' ? 'Cancel' : 'Add a batch'}
                </button>
              </div>

              {adding === 'batch' && (
                <>
                  <fieldset className="scope-choice">
                    <legend className="pane-field-label">What does this batch belong to?</legend>

                    <label className={`scope ${batchScope === 'college' ? 'is-current' : ''}`}>
                      <input
                        type="radio"
                        name="batch-scope"
                        checked={batchScope === 'college'}
                        onChange={() => setBatchScope('college')}
                      />
                      <span>
                        <b>One college</b>
                        <span className="scope-hint">
                          Its students, roll numbers and drives all sit inside that college.
                        </span>
                      </span>
                    </label>

                    <label className={`scope ${batchScope === 'university' ? 'is-current' : ''}`}>
                      <input
                        type="radio"
                        name="batch-scope"
                        checked={batchScope === 'university'}
                        onChange={() => setBatchScope('university')}
                      />
                      <span>
                        <b>The university</b>
                        <span className="scope-hint">
                          A year group or shortlist spanning every affiliated college.
                        </span>
                      </span>
                    </label>
                  </fieldset>

                  {batchScope === 'college' && (
                    <label className="pane-field">
                      <span className="pane-field-label">Which college is it for?</span>
                      <select
                        value={batchCollegeId}
                        onChange={(e) => setBatchCollegeId(e.target.value)}
                      >
                        <option value="">Choose a college</option>
                        {colleges.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.code})
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {(batchScope === 'university' || batchCollegeId) && (
                    <BatchForm
                      bare
                      collegeName={newBatchCollege?.name ?? 'the university'}
                      // One endpoint for both: it takes a college or leaves it out.
                      onCreate={(b: NewBatch) =>
                        api.post('/admin/batches', {
                          ...b,
                          collegeId: newBatchCollegeId || undefined,
                        })
                      }
                      onDone={() => {
                        setAdding(null);
                        // Show the new batch under whatever it was made for.
                        if (newBatchCollegeId !== collegeId) setCollegeId(newBatchCollegeId);
                        void loadBatches();
                      }}
                      onCancel={() => setAdding(null)}
                    />
                  )}
                </>
              )}

              {!adding && grouped.length > 0 && (
                <div className="groups">
                  {grouped.map((g) => (
                    <div key={g.key} className="group">
                      <p className="group-head">
                        {g.title}
                        <span className="group-count">
                          {g.items.length} batch{g.items.length === 1 ? '' : 'es'}
                        </span>
                      </p>
                      {/*
                        A list, not a chooser. Which batch students go into is
                        asked once, in step 4, where the students are - asking
                        it here as well left the same question in two places
                        with two answers.
                      */}
                      <ul className="picks">
                        {g.items.map((b) => (
                          <li key={b.id} className="pick is-static">
                            <span className="pick-name">{b.name}</span>
                            <span className="pick-meta">
                              {[
                                b.course,
                                b.graduationYear
                                  ? `graduating ${b.graduationYear}`
                                  : b.studyYear
                                    ? `year ${b.studyYear}`
                                    : null,
                              ]
                                .filter(Boolean)
                                .join(' · ') || 'no course or year set'}
                            </span>
                            <span className="pick-count">
                              {b.studentCount} student{b.studentCount === 1 ? '' : 's'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {!adding && batches && batches.length < batchTotal && (
                <p className="pane-note">
                  Showing {batches.length} of {batchTotal}. The full batches screen pages through
                  the rest.
                </p>
              )}

              {!adding && batches?.length === 0 && (
                <p className="pane-note">
                  No batches on the platform yet. Add one, or carry on — step 4 creates whatever
                  batches your student list names.
                </p>
              )}
            </Pane>
          )}

          {step === 6 && (
            <Pane
              title="Student details"
              todo={[
                'Mark each detail Not collected, Optional or Required.',
                'Say who adds students: the university, its colleges, or the students themselves.',
                'If students may register, tick what the registration form asks them.',
              ]}
              note="Everything after this follows: the spreadsheet prints these columns, the upload holds rows to them, and a student's own profile asks for the same things."
              lede="What this university records about a student, which of those it insists on, and who is allowed to put one on the roster. Settle it here and every screen after this follows: the spreadsheet prints these columns, the upload holds rows to them, and a student's own profile asks for the same things."
              next={{ label: 'Students', onClick: () => goTo(7) }}
            >
              <StudentIntake bare />
            </Pane>
          )}

          {step === 7 && (
            <Pane
              title="Students"
              todo={[
                'Choose which batch they go into, or let each row name its own.',
                "Download the template — it carries this college's batches and programmes as dropdowns.",
                'Upload it. You get a check of what would happen before anything is written.',
              ]}
              note='Each student is sent a one-time activation link, shown once after the upload. Nobody can sign in until they use it.'
              context={
                batch ? `${batch.collegeName} · ${batch.name}` : college?.name ?? 'No batch chosen'
              }
              lede={
                batch
                  ? 'Every row goes into this batch, so the file needs no batch column.'
                  : 'Each row names its own batch, and any batch that does not exist yet is created — so a whole college can be set up from one file.'
              }
              more={
                targetCollegeId && !universityIntake
                  ? { to: `/admin/colleges/${targetCollegeId}`, label: 'Open this college' }
                  : undefined
              }
              next={{ label: 'Map students', onClick: () => goTo(8) }}
            >
              {/*
                The one question this step turns on, asked here and nowhere
                else: which batch. "None" is a real answer - the file then
                names a batch per row, and any that do not exist get made.
              */}
              <label className="pane-field">
                <span className="pane-field-label">Where do these students go?</span>
                <select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                  <option value="">No particular batch — take it from each row</option>
                  {grouped.map((g) => (
                    <optgroup key={g.key} label={g.title}>
                      {g.items.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.studentCount})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>

              {/*
                A student always belongs to a college even when their batch does
                not, so a university-wide batch has to be told which college
                this particular list comes from.
              */}
              {needsCollege && (
                <label className="pane-field">
                  <span className="pane-field-label">
                    {batch
                      ? 'Which college are these students from?'
                      : 'Which college are you adding to?'}
                  </span>
                  <select
                    value={intakeCollegeId}
                    onChange={(e) => setIntakeCollegeId(e.target.value)}
                  >
                    <option value="">Choose a college</option>
                    {!batch && (
                      <option value={UNIVERSITY_LIST}>
                        The university's list — college per row, or map later
                      </option>
                    )}
                    {colleges.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {universityIntake && (
                <p className="pane-note">
                  Each row can name its college in a <b>College code</b> column. Rows without one are
                  added to the university and wait in <Link to="/admin/map-data">Map data</Link> until you
                  place them in a college.
                </p>
              )}

              {universityIntake ? (
                <AddStudents
                  bare
                  key="university"
                  endpoint="/admin/mapping/students"
                  onDone={() => {
                    void loadBatches();
                    void loadColleges();
                  }}
                />
              ) : targetCollegeId ? (
                <AddStudents
                  bare
                  key={`${batch?.id ?? 'none'}-${targetCollegeId}`}
                  endpoint={
                    batch
                      ? `/admin/batches/${batch.id}/students`
                      : `/admin/colleges/${targetCollegeId}/students`
                  }
                  batchName={batch?.name}
                  // Only a university-wide batch needs telling; the others
                  // carry the college in the path.
                  extra={batch && !batch.collegeId ? { collegeId: targetCollegeId } : undefined}
                  onDone={() => {
                    void loadBatches();
                    void loadColleges();
                  }}
                />
              ) : (
                <p className="pane-note">
                  Choose a college above, and the list of students follows.
                </p>
              )}
            </Pane>
          )}
          {step === 8 && (
            <Pane
              title="Map students"
              todo={[
                'Pick a college and look at its unmapped students.',
                'Put each into the programme they are actually on.',
              ]}
              note='A student here is on the roster but invisible to any role that filters on a course, so this list is worth emptying.'
              context={mapCollege?.name}
              lede="Choose a college and one of its courses and branches, then tick the students who belong in it. Students the university added without a college can be pulled in here too."
              more={{ to: '/admin/map-data', label: 'Open Map data' }}
            >
              <MapCollegePicker colleges={colleges} value={mapCollegeId} onChange={setMapCollegeId} />
              {mapScope && mapCollege && offered && (
                <MapData
                  key={`s-${mapCollege.id}`}
                  only="students"
                  scope={mapScope}
                  offered={offered}
                  collegeName={mapCollege.code}
                  onChanged={loadColleges}
                />
              )}
            </Pane>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The working pane: a title, one sentence saying what this step is for, the
 * controls, and the next thing. Every step has the same shape, so moving
 * between them never moves the furniture.
 */
function Pane({
  title,
  context,
  lede,
  todo,
  note,
  next,
  nextHint,
  more,
  children,
}: {
  title: string;
  context?: string;
  lede: string;
  /**
   * What to actually do on this step, in order.
   *
   * Set-up is worked through once, by somebody who has not done it before,
   * and the question they have is never "what is this screen for" - it is
   * "so what do I type". A sentence of explanation does not answer that.
   */
  todo?: string[];
  /** The one thing worth knowing that is not an instruction. */
  note?: string;
  next?: { label: string; onClick: () => void };
  nextHint?: string;
  more?: { to: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="pane-head">
        {context && <p className="pane-context">{context}</p>}
        <h2>{title}</h2>
        <p className="pane-lede">{lede}</p>

        {todo && todo.length > 0 && (
          <div className="pane-guide">
            <p className="pane-guide-tag">What to do here</p>
            <ol>
              {todo.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
            {note && <p className="pane-guide-note">{note}</p>}
          </div>
        )}
      </header>

      <div className="pane-body">{children}</div>

      <footer className="pane-foot">
        {more ? (
          <Link to={more.to} className="pane-more">
            {more.label} →
          </Link>
        ) : (
          <span />
        )}

        {next && (
          <button type="button" className="btn btn-primary" onClick={next.onClick}>
            Next: {next.label} →
          </button>
        )}
        {!next && nextHint && <span className="pane-hint">{nextHint}</span>}
      </footer>
    </>
  );
}

function MapCollegePicker({
  colleges,
  value,
  onChange,
}: {
  colleges: CollegeSummary[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="pane-field">
      <span className="pane-field-label">Which college?</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose a college</option>
        {colleges.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.code})
          </option>
        ))}
      </select>
    </label>
  );
}

function Tile({ value, label }: { value: number; label: string }) {
  return (
    <div className="tile">
      <p className="tile-value">{value.toLocaleString()}</p>
      <p className="tile-label">{label}</p>
    </div>
  );
}
