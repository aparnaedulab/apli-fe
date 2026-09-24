import {
  ACCOMMODATION_LABELS,
  CTC_INCLUDE_LABELS,
  EMPLOYER_LABELS,
  OFFER_CONDITION_LABELS,
  EMPLOYMENT_LABELS,
  GENDER_LABELS,
  PWD_LABELS,
  SHIFT_LABELS,
  TRAVEL_LABELS,
  ROUND_LABELS,
  type JobDetail,
  type Reach,
  type Round,
} from '../../api/jobs';
import './JobPreview.css';

/**
 * The role as a student will see it, beside the form that writes it.
 *
 * A recruiter filling in seven steps otherwise has no idea what any of it
 * amounts to. This is the thing being made, shown while it is being made -
 * and it is where a half-written posting looks half-written, which is a
 * better place to notice than after publishing.
 *
 * It follows the saved role rather than the keystroke, because each step
 * saves explicitly. What you see here is what is actually stored.
 */

const rupees = (v: string | null) => (v ? `₹${Number(v).toLocaleString('en-IN')}` : null);

const lakhs = (v: string | null) => (v ? `₹${(Number(v) / 100000).toFixed(1)}L` : null);

function pay(job: JobDetail): string | null {
  if (job.payPeriod === 'MONTHLY') {
    const lo = job.ctcMin ? rupees(String(Math.round(Number(job.ctcMin) / 12))) : null;
    const hi = job.ctcMax ? rupees(String(Math.round(Number(job.ctcMax) / 12))) : null;
    if (lo && hi) return `${lo} – ${hi} a month`;
    return lo ? `${lo} a month` : hi ? `up to ${hi} a month` : null;
  }

  const lo = lakhs(job.ctcMin);
  const hi = lakhs(job.ctcMax);
  if (lo && hi) return `${lo} – ${hi}`;
  return lo ? `from ${lo}` : hi ? `up to ${hi}` : null;
}

/** The criteria, in the words a criteria sheet would use. */
function criteriaOf(job: JobDetail): string[] {
  const out: string[] = [];

  const aggregate = [
    job.minCgpa ? `${job.minCgpa} CGPA` : null,
    job.minDegreePct ? `${job.minDegreePct}%` : null,
  ].filter(Boolean);
  if (aggregate.length) out.push(`${aggregate.join(' or ')} in graduation`);

  if (job.minTenthPct) out.push(`${job.minTenthPct}% in 10th`);

  const afterTenth = [
    job.minTwelfthPct ? `${job.minTwelfthPct}% in 12th` : null,
    job.minDiplomaPct ? `${job.minDiplomaPct}% in diploma` : null,
  ].filter(Boolean);
  if (afterTenth.length) out.push(afterTenth.join(' or '));

  if (job.minPgCgpa || job.minPgPct) {
    out.push(
      `${[job.minPgCgpa ? `${job.minPgCgpa} CGPA` : null, job.minPgPct ? `${job.minPgPct}%` : null]
        .filter(Boolean)
        .join(' or ')} in post-graduation`,
    );
  }

  if (job.maxActiveBacklogs !== null) {
    out.push(
      job.maxActiveBacklogs === 0
        ? 'No live backlogs'
        : `At most ${job.maxActiveBacklogs} live backlogs`,
    );
  }
  if (job.maxBacklogs !== null) out.push(`At most ${job.maxBacklogs} backlogs in total`);
  if (job.maxGapYears !== null) {
    out.push(job.maxGapYears === 0 ? 'No gap in education' : `At most ${job.maxGapYears} gap years`);
  }

  if (job.allowedCourses.length) out.push(job.allowedCourses.join(', '));
  if (job.allowedSpecialisations.length) out.push(job.allowedSpecialisations.join(', '));
  if (job.graduationYears.length) out.push(`Graduating ${job.graduationYears.join(', ')}`);

  return out;
}

/**
 * Where one round happens, from the round rather than from the role.
 *
 * Rounds move: a test at home, an interview in a college hall, a final at the
 * office. What a student needs a week out is whether to book a train or
 * bookmark a link, so that is what this answers - and it says nothing at all
 * rather than guessing when the round has not been told.
 */
function whereRound(r: Round): string | null {
  if (r.isOnline) return r.meetingLink ? 'online, link sent' : 'online';
  if (r.venue) return r.venue;
  if (r.addressLine) return r.addressLine.split(/\r?\n/)[0]!.trim();
  return 'at your college';
}

export default function JobPreview({
  job,
  reach,
  companyName,
}: {
  job: JobDetail;
  reach: Reach | null;
  companyName: string;
}) {
  const criteria = criteriaOf(job);
  const money = pay(job);
  const internship = job.stipendPerMonth !== null;

  return (
    <aside className="preview" aria-label="What a student sees">
      <p className="preview-tag">What a student sees</p>

      <article className="preview-card">
        <header>
          <p className="preview-company">
            {companyName}
            {job.employerType && job.employerType !== 'DIRECT' && job.employerName && (
              <span className="preview-employer"> · on the payroll of {job.employerName}</span>
            )}
          </p>
          <h3>{job.title || <span className="preview-gap"></span>}</h3>
          {job.designation && job.designation !== job.title && (
            <p className="preview-designation">Designation: {job.designation}</p>
          )}

          <p className="preview-facts">
            <span>{EMPLOYMENT_LABELS[job.jobType] ?? job.jobType.replace('_', ' ')}</span>
            {job.location && <span>{job.location}</span>}
            {job.openings !== null && <span>{job.openings} openings</span>}
            {job.shift && <span>{SHIFT_LABELS[job.shift] ?? job.shift}</span>}
            {job.travel && job.travel !== 'NONE' && <span>{TRAVEL_LABELS[job.travel] ?? job.travel}</span>}
            {job.relocationRequired && <span>Relocation required</span>}
          </p>

          {(job.genderEligibility !== 'ANY' || job.pwdSuitable === 'YES') && (
            <p className="preview-badges">
              {job.genderEligibility !== 'ANY' && (
                <span className={job.genderEligibility === 'WOMEN_PREFERRED' ? '' : 'is-restricted'}>
                  {GENDER_LABELS[job.genderEligibility]}
                </span>
              )}
              {job.pwdSuitable === 'YES' && <span>Open to persons with disabilities</span>}
            </p>
          )}
        </header>

        {/*
          Pay first, because it is the first thing anybody reads, and a role
          without it says so rather than leaving a gap to be guessed at.
        */}
        <p className={`preview-pay ${money || internship ? '' : 'is-gap'}`}>
          {internship
            ? `${rupees(job.stipendPerMonth)} a month${job.internshipMonths ? ` for ${job.internshipMonths} months` : ''}`
            : (money ?? 'Pay not stated yet')}
          {job.ctcFixed && <span className="preview-fixed">{lakhs(job.ctcFixed)} fixed</span>}
        </p>

        {job.description ? (
          <p className="preview-body">{job.description}</p>
        ) : (
          <p className="preview-body is-gap">No description yet.</p>
        )}

        <dl className="preview-rows">
          <div>
            <dt>Apply by</dt>
            <dd>
              {job.deadline ? (
                new Date(job.deadline).toLocaleDateString()
              ) : (
                <span className="preview-gap">not set</span>
              )}
            </dd>
          </div>
          <div>
            <dt>Process</dt>
            <dd>
              {job.rounds.length > 0 ? (
                `${job.rounds.length} round${job.rounds.length === 1 ? '' : 's'}`
              ) : (
                <span className="preview-gap">no rounds yet</span>
              )}
            </dd>
          </div>
          {job.bondMonths !== null && (
            <div>
              <dt>Bond</dt>
              <dd>{job.bondMonths} months</dd>
            </div>
          )}
          <div>
            <dt>Employer</dt>
            <dd>
              {job.employerType ? (
                EMPLOYER_LABELS[job.employerType]?.replace('Our own company', 'Direct hire')
              ) : (
                <span className="preview-gap">not stated</span>
              )}
            </dd>
          </div>
          <div>
            <dt>Offer letter</dt>
            <dd>
              {job.offerLetterDays !== null ? (
                `within ${job.offerLetterDays} days of results`
              ) : (
                <span className="preview-gap">not stated</span>
              )}
            </dd>
          </div>
          {job.probationMonths ? (
            <div>
              <dt>Probation</dt>
              <dd>
                {job.probationMonths} months
                {job.probationCtc ? ` at ${lakhs(job.probationCtc)}` : ''}
              </dd>
            </div>
          ) : null}
          {job.trainingMonths ? (
            <div>
              <dt>Training</dt>
              <dd>
                {job.trainingMonths} months{job.trainingLocation ? ` in ${job.trainingLocation}` : ''}
                {job.trainingStipend ? `, ${rupees(job.trainingStipend)}/month` : ''}
              </dd>
            </div>
          ) : null}
          {job.sector && (
            <div>
              <dt>Sector</dt>
              <dd>{job.sector}</dd>
            </div>
          )}
        </dl>

        {(job.offerConditional === 'YES' || (job.ctcIncludes ?? []).length > 0) && (
          <section className="preview-block">
            <h4>About the offer</h4>
            {(job.ctcIncludes ?? []).length > 0 && (
              <p>CTC includes: {(job.ctcIncludes ?? []).map((k) => CTC_INCLUDE_LABELS[k] ?? k).join(', ')}.</p>
            )}
            {job.offerConditional === 'YES' && (
              <>
                <p>The offer is conditional on:</p>
                <ul>
                  {(job.offerConditions ?? []).map((k) => (
                    <li key={k}>{OFFER_CONDITION_LABELS[k] ?? k}</li>
                  ))}
                  {job.offerConditionNote && <li>{job.offerConditionNote}</li>}
                </ul>
              </>
            )}
          </section>
        )}

        {/*
          A role with no bar says so. Silence here read as "criteria not
          written yet" to every student who saw it, which is the opposite of
          what an open role is trying to tell them.
        */}
        {job.openToAll ? (
          <section className="preview-block">
            <h4>Who can apply</h4>
            <p className="preview-open">
              No marks bar &mdash; anyone in the courses and years below may apply.
            </p>
            {criteria.length > 0 && (
              <ul>
                {criteria.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          criteria.length > 0 && (
            <section className="preview-block">
              <h4>Who can apply</h4>
              <ul>
                {criteria.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </section>
          )
        )}

        {job.rounds.length > 0 && (
          <section className="preview-block">
            <h4>The process</h4>
            <ol className="preview-rounds">
              {job.rounds.map((r) => (
                <li key={r.id}>
                  <b>{r.name}</b>
                  <span>
                    {ROUND_LABELS[r.type] ?? r.type}
                    {r.scheduledAt ? ` · ${new Date(r.scheduledAt).toLocaleDateString()}` : ''}
                  </span>
                  <span className="preview-where">{whereRound(r)}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {(job.pwdSuitable || job.inclusionNote || job.genderNote) && (
          <section className="preview-block">
            <h4>Inclusion</h4>
            {job.pwdSuitable === 'NO' && <p>Not suitable for persons with disabilities.</p>}
            {job.pwdSuitable === 'YES' && (
              <>
                <p>Suitable for persons with:</p>
                <ul>
                  {(job.pwdCategories ?? []).map((k) => (
                    <li key={k}>{PWD_LABELS[k] ?? k}</li>
                  ))}
                </ul>
                {(job.accommodations ?? []).length > 0 && (
                  <>
                    <p>Support offered:</p>
                    <ul>
                      {(job.accommodations ?? []).map((k) => (
                        <li key={k}>{ACCOMMODATION_LABELS[k] ?? k}</li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
            {job.genderNote && <p className="preview-note">{job.genderNote}</p>}
            {job.inclusionNote && <p className="preview-note">{job.inclusionNote}</p>}
          </section>
        )}

        {job.terms.length > 0 && (
          <section className="preview-block">
            <h4>Conditions</h4>
            <ul>
              {job.terms.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>
        )}

        {job.skills.length > 0 && (
          <section className="preview-block">
            <h4>Looking for</h4>
            <p className="preview-skills">
              {job.skills.map((s) => (
                <span key={s.id} className={s.isRequired ? 'is-asked' : ''}>
                  {s.name}
                </span>
              ))}
            </p>
          </section>
        )}
      </article>

      {/*
        Who would actually get this card, under the card itself - the two
        belong together, since a perfect posting nobody can see is still a
        posting nobody can see.
      */}
      {reach && reach.targeted > 0 && (
        <p className={`preview-reach ${reach.eligible === 0 ? 'is-none' : ''}`}>
          {reach.eligible === 0
            ? 'No student can see this yet.'
            : `${reach.eligible} student${reach.eligible === 1 ? '' : 's'} would see this.`}
        </p>
      )}
    </aside>
  );
}
