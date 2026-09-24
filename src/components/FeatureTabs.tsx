import { useState } from 'react';

interface Feature {
  title: string;
  body: string;
}

interface RoleFeatures {
  id: string;
  role: string;
  headline: string;
  features: Feature[];
}

const ROLES: RoleFeatures[] = [
  {
    id: 'campus',
    role: 'Placement cells',
    headline: 'Run the season from one screen instead of twelve spreadsheets.',
    features: [
      {
        title: 'Roster you own',
        body: 'Create batches, invite students by link or email, and watch profiles fill in. No more collecting CVs over WhatsApp.',
      },
      {
        title: 'Verify once, freeze',
        body: 'Check a student record and freeze it. That locks it against edits and is what makes them eligible to apply.',
      },
      {
        title: 'Approval queue',
        body: 'Every incoming job waits for you. Accept it and it reaches your students; decline it with a reason and it never does.',
      },
      {
        title: 'Drive reporting',
        body: 'Students sitting, companies visiting, offers made, percentage placed — for the season, live, without building a sheet.',
      },
      {
        title: 'Scoped team access',
        body: 'Add coordinators and limit them to their own batches. Everyone works without anyone stepping on anyone.',
      },
    ],
  },
  {
    id: 'recruiter',
    role: 'Recruiters',
    headline: 'Post once, reach every campus you target, decide faster.',
    features: [
      {
        title: 'Rounds you define',
        body: 'Resume screen, online test, interviews, offer — build the exact sequence for the role, in the order you run it.',
      },
      {
        title: 'One post, many colleges',
        body: 'Target by course, specialisation and graduation year. Each college gets its own posting and its own decision.',
      },
      {
        title: 'Pre-filtered applicants',
        body: 'Everyone who applies already meets your CGPA, backlog and course criteria, and their college verified the record.',
      },
      {
        title: 'Advance in one click',
        body: 'Move a candidate to the next round, waitlist them, or make an offer. The student is notified the moment you do.',
      },
      {
        title: 'No wasted interviews',
        body: 'When a candidate accepts an offer elsewhere in that drive, their application closes automatically. You see it immediately.',
      },
    ],
  },
  {
    id: 'student',
    role: 'Students',
    headline: 'One profile your college stands behind, and only the roles you qualify for.',
    features: [
      {
        title: 'Guided profile',
        body: 'Education, experience, projects and skills in structured sections — filled once, reused for every application.',
      },
      {
        title: 'No wasted applications',
        body: 'You only ever see roles your batch is eligible for. If your CGPA does not clear the bar, the job never appears.',
      },
      {
        title: 'Apply in one click',
        body: 'Your verified profile goes across as it stands. No re-uploading a CV for every company.',
      },
      {
        title: 'Know where you stand',
        body: 'Every application shows the round you are in and what happened in the last one. No more guessing after an interview.',
      },
      {
        title: 'Told the moment it changes',
        body: 'Shortlisted, scheduled, offered, rejected — a notification the second the recruiter acts, not a week later.',
      },
    ],
  },
];

export default function FeatureTabs() {
  const [activeId, setActiveId] = useState(ROLES[0]!.id);
  const active = ROLES.find((r) => r.id === activeId) ?? ROLES[0]!;

  return (
    <div className="tabs">
      <div className="tabs-bar" role="tablist" aria-label="Features by role">
        {ROLES.map((r) => (
          <button
            key={r.id}
            role="tab"
            type="button"
            id={`tab-${r.id}`}
            aria-selected={r.id === activeId}
            aria-controls={`panel-${r.id}`}
            className={`tabs-btn ${r.id === activeId ? 'is-active' : ''}`}
            onClick={() => setActiveId(r.id)}
          >
            {r.role}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`panel-${active.id}`}
        aria-labelledby={`tab-${active.id}`}
        className="tabs-panel"
        key={active.id}
      >
        <p className="tabs-headline">{active.headline}</p>

        <div className="feature-grid">
          {active.features.map((f, i) => (
            <article
              key={f.title}
              className="feature"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
