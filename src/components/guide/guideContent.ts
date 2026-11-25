/**
 * What the Guide knows: for each portal, a short tour of where things are,
 * and answers to the questions people ask once they are inside - each with
 * the page it is about, so the Guide can take them there.
 *
 * Written answers, not a model: the same question always gets the same,
 * checked answer. To teach the Guide something new, add an entry here with
 * the words people would use to ask for it.
 */

export type Area = 'student' | 'company' | 'admin' | 'platform' | 'campus';

export interface TourStep {
  title: string;
  text: string;
  /** Where "Show me" goes. */
  link?: string;
}

export interface GuideEntry {
  title: string;
  answer: string;
  link?: string;
  /** Words people use when asking for this. */
  keywords: string[];
  /** Pages this entry explains, for "On this page". A path or a path prefix. */
  pages?: string[];
}

export interface AreaGuide {
  name: string;
  welcome: string;
  tour: TourStep[];
  entries: GuideEntry[];
  /** Questions offered before anything is typed. */
  suggestions: string[];
}

export const GUIDES: Record<Area, AreaGuide> = {
  /* ------------------------------------------------------------------ */
  student: {
    name: 'Student',
    welcome:
      'Apli.ai is where you do short pieces of real work for companies, earn certificates they verify, and get interviews, internship offers and jobs from that work.',
    tour: [
      { title: 'Dashboard', text: 'Your home: what is in progress, what is waiting on you, simulations picked for your interests, and your latest activity.', link: '/student' },
      { title: 'Simulations', text: 'Short sets of real tasks from companies like JPMorgan, BCG and Accenture. Start one, do the tasks at your own pace, and hand it in.', link: '/student/simulations' },
      { title: 'Certificates', text: 'When the company approves your work you get a certificate with a code anyone can check. Share it with companies or print it as a PDF.', link: '/student/certificates' },
      { title: 'Interviews', text: 'Companies who like your work invite you here. Accept, then go round by round - some rounds are recorded videos you do in the browser.', link: '/student/interviews' },
      { title: 'Jobs', text: 'Jobs and internships posted to your college that you are eligible for. Apply in one click, track every application, and answer internship offers.', link: '/student/jobs' },
      { title: 'The bell', text: 'Top right. Every update - work approved, an interview invite, an offer - shows here, and as a number on the menu section it belongs to.' },
    ],
    suggestions: ['How do I start a simulation?', 'Where are my certificates?', 'How do I apply for a job?', 'Where is my interview?', 'How do I accept an offer?'],
    entries: [
      { title: 'Your dashboard', answer: 'The Dashboard shows everything on the go, what each one is waiting for, simulations picked for you, your certificates and recent activity.', link: '/student', keywords: ['dashboard', 'home', 'start', 'overview', 'main'], pages: ['/student'] },
      { title: 'Find and start a simulation', answer: 'Go to Simulations, open one that interests you and press Start. Each one is a few short tasks; most take an afternoon or two.', link: '/student/simulations', keywords: ['simulation', 'simulations', 'start', 'begin', 'task', 'tasks', 'internship', 'virtual', 'work', 'browse', 'find'], pages: ['/student/simulations'] },
      { title: 'Doing a task', answer: 'Open a task from the simulation. Read the brief, tick off the steps on the right, take any quick check, then hand in your answer as text, a link or a file. Your draft saves itself. Press F for focus mode.', link: '/student/simulations', keywords: ['task', 'hand in', 'handin', 'submit', 'answer', 'upload', 'file', 'draft', 'focus', 'notes'], pages: ['/student/simulations/'] },
      { title: 'Taking a quick check (test)', answer: 'Inside a task, press "Start the test". A short how-to with practice questions comes first. Questions are on the left, the question in the middle, and how to answer it on the right. Use Next and Previous at the bottom, then "Check my answers".', link: '/student/simulations', keywords: ['test', 'quiz', 'check', 'question', 'questions', 'drag', 'order', 'group', 'mcq', 'exam'] },
      { title: 'Send your work for review', answer: 'When every task is handed in, open the simulation and explain your work in two short answers. It then goes to the company to review - you are told when it is approved or if changes are asked.', link: '/student/simulations', keywords: ['review', 'explain', 'send', 'finish', 'complete', 'submit work', 'approval'] },
      { title: 'Changes asked on your work', answer: 'Open the simulation: the reviewer\'s note says what to fix. Change the task, then send it back for review.', link: '/student/simulations', keywords: ['changes', 'fix', 'rejected', 'sent back', 'note', 'redo', 'needs work'] },
      { title: 'Your certificates', answer: 'Certificates (top menu) lists every certificate with its code. Verify opens the public check page, Copy link gives a link to send anyone, and Print / save PDF makes a one-page certificate.', link: '/student/certificates', keywords: ['certificate', 'certificates', 'cert', 'proof', 'verify', 'code', 'pdf', 'print', 'download'], pages: ['/student/certificates'] },
      { title: 'Share your work with companies', answer: 'On Certificates (or the Dashboard), press Share on a certificate and tick the companies that may see it. They find you under "Shared with you" and can invite you or offer an internship.', link: '/student/certificates', keywords: ['share', 'sharing', 'show', 'companies see', 'visible', 'private'] },
      { title: 'Your interviews', answer: 'Interviews (top menu) shows every invite. Accept to begin; each round says what it is. A recorded round is done in the browser - allow your camera and microphone.', link: '/student/interviews', keywords: ['interview', 'interviews', 'invite', 'invitation', 'round', 'rounds', 'video', 'record', 'camera'], pages: ['/student/interviews'] },
      { title: 'Find and apply for jobs', answer: 'Jobs > Jobs for you lists roles posted to your college that you are eligible for. Open one to see pay, eligibility and rounds, then press Apply now.', link: '/student/jobs', keywords: ['job', 'jobs', 'apply', 'application', 'vacancy', 'opening', 'role', 'placement', 'hiring', 'search'], pages: ['/student/jobs'] },
      { title: 'Track your applications', answer: 'Jobs > My applications shows where each application has got to: applied, reviewed, shortlisted, and each interview round.', link: '/student/jobs?tab=applications', keywords: ['my applications', 'applied', 'status', 'track', 'shortlisted', 'progress'] },
      { title: 'Internship offers', answer: 'Jobs > Internship offers shows offers companies made from your work. Read the terms, then Accept or Decline - the company is told straight away.', link: '/student/jobs?tab=offers', keywords: ['offer', 'offers', 'offer letter', 'accept', 'decline', 'stipend'] },
      { title: 'Your profile', answer: 'Your name menu (top right) > Your profile. Fill in your branch, CGPA, city and the fields you want to try - it decides what you are shown first.', link: '/student/profile', keywords: ['profile', 'cgpa', 'details', 'edit', 'interests', 'phone', 'city'], pages: ['/student/profile'] },
      { title: 'Notifications', answer: 'The bell at the top right lists every update. A number on a menu item means something new is in that section; opening it clears the number.', keywords: ['notification', 'notifications', 'bell', 'update', 'updates', 'new', 'alert'] },
      { title: 'Sign out', answer: 'Your name at the top right > Sign out.', keywords: ['sign out', 'logout', 'log out', 'exit'] },
    ],
  },

  /* ------------------------------------------------------------------ */
  company: {
    name: 'Company',
    welcome:
      'Write work simulations students do, review what they hand in, post jobs, interview the students you like and offer them internships.',
    tour: [
      { title: 'Overview', text: 'Your simulations, students working on them, work waiting for your review and students who shared verified work with you.', link: '/company' },
      { title: 'Jobs', text: 'Post full-time roles and internships to colleges. "N applicants" on each job opens its applicants - invite them to interview or mark not shortlisted.', link: '/company/jobs' },
      { title: 'Simulations', text: 'Write a simulation: a few tasks from a real week in the job. Apli.ai checks it, then students can start it.', link: '/company/simulations' },
      { title: 'Interviews', text: 'Your interview processes (the rounds) and every student you invited. Open a student to watch recorded answers and give a verdict per round.', link: '/company/interviews' },
      { title: "Students' work", text: 'Simulations students handed in. Read each task and their explanation, then approve (which issues the certificate) or ask for changes.', link: '/company/reviews' },
      { title: 'Shared with you', text: 'Students who chose to show you their verified work. Invite them to interview or offer an internship from here.', link: '/company/shared' },
      { title: 'Offers', text: 'Every internship offer you sent and the student\'s answer.', link: '/company/offers' },
    ],
    suggestions: ['How do I post a job?', 'Where are my applicants?', 'How do I invite a student to interview?', 'How do I review student work?', 'How do I make an offer?'],
    entries: [
      { title: 'Overview', answer: 'Your simulations at a glance, what is waiting for you, and four numbers on your students.', link: '/company', keywords: ['overview', 'home', 'dashboard', 'main'], pages: ['/company'] },
      { title: 'Post a job', answer: 'Jobs > Post a role. Fill in the role, pay, eligibility and rounds, then publish it to colleges.', link: '/company/jobs/new', keywords: ['post', 'job', 'jobs', 'create job', 'new job', 'role', 'vacancy', 'opening', 'hire'], pages: ['/company/jobs'] },
      { title: 'See applicants for a job', answer: 'Jobs, then the "N applicants" button under a job. You see each applicant\'s college, course, CGPA and stage, and can invite them to interview or mark them not shortlisted.', link: '/company/jobs', keywords: ['applicant', 'applicants', 'application', 'applications', 'candidates', 'who applied', 'shortlist'], pages: ['/company/jobs/'] },
      { title: 'Invite a student to interview', answer: 'From a job\'s applicants, from Shared with you, or from Students\' work, press "Invite to interview", choose the process and send. The student is told and accepts under their Interviews.', link: '/company/shared', keywords: ['invite', 'interview', 'invitation', 'shortlist', 'call'] },
      { title: 'Run the interview rounds', answer: 'Interviews > Students you invited > the student. Under the round they are in, give your verdict - Passed, Did not pass or Skip - with a score and notes. Recorded answers play right there.', link: '/company/interviews', keywords: ['round', 'rounds', 'verdict', 'feedback', 'pass', 'fail', 'video', 'recorded', 'score', 'interviews'], pages: ['/company/interviews'] },
      { title: 'Create an interview process', answer: 'Interviews > New process. Add the rounds in order - CV screen, test, recorded video, live interview - and which ones eliminate.', link: '/company/interviews/new', keywords: ['process', 'create process', 'rounds setup', 'workflow', 'new process'] },
      { title: 'Write a simulation', answer: 'Simulations > New simulation. Give it a title and a few tasks; send it to Apli.ai to check. Once live, students can start it.', link: '/company/simulations/new', keywords: ['simulation', 'simulations', 'create', 'write', 'new simulation', 'task', 'tasks'], pages: ['/company/simulations'] },
      { title: "Review students' work", answer: "Students' work lists hand-ins waiting for you. Read every task and the explanation, then Approve (the student gets a certificate) or Ask for changes with a note.", link: '/company/reviews', keywords: ['review', 'reviews', 'hand in', 'work', 'approve', 'changes', 'submission', 'students work'], pages: ['/company/reviews'] },
      { title: 'Students who shared work with you', answer: 'Shared with you lists students who chose to show you their verified work, with their certificate and contact.', link: '/company/shared', keywords: ['shared', 'share', 'talent', 'students', 'certificate', 'verified'], pages: ['/company/shared'] },
      { title: 'Offer an internship', answer: 'Shared with you > the student > "Offer an internship". Set the role, months, stipend and reply-by date. You see their answer under Offers.', link: '/company/shared', keywords: ['offer', 'offers', 'internship', 'offer letter', 'stipend', 'hire'], pages: ['/company/offers'] },
      { title: 'Analytics for a simulation', answer: 'Simulations > a simulation > Analytics: who started, finished and how they did.', link: '/company/simulations', keywords: ['analytics', 'report', 'reports', 'stats', 'numbers'] },
      { title: 'Notifications', answer: 'The bell at the top right lists applications, acceptances and hand-ins. A number on a menu item means something new is there.', keywords: ['notification', 'notifications', 'bell', 'update', 'alert', 'new'] },
    ],
  },

  /* ------------------------------------------------------------------ */
  admin: {
    name: 'University admin',
    welcome:
      'Your institution\'s view of its students on Apli.ai: what they are doing in simulations, the certificates they earn, and the offers and interviews that follow.',
    tour: [
      { title: 'Overview', text: 'Your students in numbers: active, certified, offers, interviews, and what needs a look.', link: '/admin' },
      { title: 'Students', text: 'Every student. Click a name to see their simulations, certificates, offers and interviews.', link: '/admin/students' },
      { title: 'Simulations', text: 'The simulations on Apli.ai and how many of your students started and finished each.', link: '/admin/simulations' },
      { title: 'Student work', text: 'Every simulation a student started: progress, waiting for review, certified - with the certificate code.', link: '/admin/work' },
      { title: 'Offers and Interviews', text: 'Internship offers your students received and the interviews they are in, round by round.', link: '/admin/offers' },
      { title: 'Your name menu', text: 'Colleges, Batches, Companies, Set up, Map data, Users, Invitations, Logins, Roles and Settings live here.' },
    ],
    suggestions: ['Where can I see a student?', 'How many certificates have we earned?', 'Which students have offers?', 'How do I add a college?', 'How do I invite a placement officer?'],
    entries: [
      { title: 'Overview', answer: 'Students, certificates, offers and interviews for your institution, and anything waiting on a reviewer.', link: '/admin', keywords: ['overview', 'home', 'dashboard', 'numbers', 'summary', 'stats'], pages: ['/admin'] },
      { title: 'Look up a student', answer: 'Students > search by name or email > click the name. The panel shows their college, course, simulations, certificates, offers and interviews.', link: '/admin/students', keywords: ['student', 'students', 'search', 'find', 'profile', 'record'], pages: ['/admin/students'] },
      { title: 'Simulations and take-up', answer: 'Simulations lists every simulation with how many of your students started it, are in review and are certified.', link: '/admin/simulations', keywords: ['simulation', 'simulations', 'take-up', 'started', 'popular'], pages: ['/admin/simulations'] },
      { title: 'Student work and certificates', answer: 'Student work lists every simulation a student started. Filter by Certified to see certificates; the code opens the public check page.', link: '/admin/work', keywords: ['work', 'certificate', 'certificates', 'certified', 'progress', 'review', 'hand in'], pages: ['/admin/work'] },
      { title: 'Internship offers', answer: 'Offers lists every internship offer your students received and whether they accepted.', link: '/admin/offers', keywords: ['offer', 'offers', 'internship', 'accepted', 'placed', 'placement'], pages: ['/admin/offers'] },
      { title: 'Interviews', answer: 'Interviews lists students companies invited, which round each is in, and the outcome.', link: '/admin/interviews', keywords: ['interview', 'interviews', 'round', 'invite', 'selected'], pages: ['/admin/interviews'] },
      { title: 'Colleges', answer: 'Your name menu > Colleges. Add a college, see its students and batches, and invite its placement officer.', link: '/admin/colleges', keywords: ['college', 'colleges', 'add college', 'institute', 'placement officer', 'tpo'], pages: ['/admin/colleges'] },
      { title: 'Batches', answer: 'Your name menu > Batches. Each programme and passing year, with its students.', link: '/admin/batches', keywords: ['batch', 'batches', 'year', 'class'], pages: ['/admin/batches'] },
      { title: 'Companies', answer: 'Your name menu > Companies. The companies on Apli.ai, their simulations and verification state.', link: '/admin/companies', keywords: ['company', 'companies', 'employer', 'recruiter'], pages: ['/admin/companies'] },
      { title: 'Invite people', answer: 'Your name menu > Invitations to invite admins; a college\'s page to invite its placement officer.', link: '/admin/invites', keywords: ['invite', 'invitation', 'add user', 'admin', 'access'], pages: ['/admin/invites'] },
      { title: 'Users, logins and roles', answer: 'Your name menu > Users (accounts), Logins (who signed in) and Role management (what each role may do).', link: '/admin/users', keywords: ['user', 'users', 'login', 'logins', 'role', 'roles', 'permission', 'disable'] },
      { title: 'Set up and map data', answer: 'Your name menu > Set up for courses and lists; Map data to place students into programmes and batches.', link: '/admin/setup', keywords: ['setup', 'set up', 'map', 'mapping', 'courses', 'programme', 'import'] },
      { title: 'Settings', answer: 'Your name menu > Settings: your institution\'s name, logo and options.', link: '/admin/settings', keywords: ['settings', 'logo', 'name', 'options', 'configure'] },
    ],
  },

  /* ------------------------------------------------------------------ */
  platform: {
    name: 'Platform team',
    welcome: 'The platform console: every institution, every company, every student, and the checks that keep Apli.ai trustworthy.',
    tour: [
      { title: 'Institutions', text: 'Every university and college group. Open one\'s portal to work inside it, or set up a new one.', link: '/platform' },
      { title: 'Students', text: 'Every student on Apli.ai - including those whose college is not on the platform yet - with their work, offers and interviews.', link: '/platform/students' },
      { title: 'Companies', text: 'Companies waiting to be verified, and every company\'s state. Verify, reject or suspend.', link: '/platform/companies' },
      { title: 'Reviews', text: 'Simulations companies sent to be checked before students see them, and student work that needs a hand.', link: '/platform/reviews' },
      { title: 'Partner requests and Onboard data', text: 'Colleges asking to join, and the lists institutions are set up from.', link: '/platform/requests' },
    ],
    suggestions: ['How do I verify a company?', 'Where are all the students?', 'How do I check a simulation?', 'How do I open an institution?'],
    entries: [
      { title: 'Institutions', answer: 'Institutions lists every institution. "Open portal" enters its admin; "Settings" or "Checklist" continues its set-up.', link: '/platform', keywords: ['institution', 'institutions', 'university', 'tenant', 'open portal', 'onboard'], pages: ['/platform'] },
      { title: 'All students', answer: 'Students (top menu) lists every student, with tabs for their work, offers, interviews and simulations. Filter "Signed up on their own" for students with no partner college.', link: '/platform/students', keywords: ['student', 'students', 'search', 'self signup', 'unattached'], pages: ['/platform/students'] },
      { title: 'Verify a company', answer: 'Companies > Waiting for review > open the company, check its details, then Verify, Reject (with a reason) or Suspend.', link: '/platform/companies', keywords: ['company', 'companies', 'verify', 'verification', 'approve', 'reject', 'suspend'], pages: ['/platform/companies'] },
      { title: 'Check simulations and work', answer: 'Reviews > Simulations to check: approve a company\'s simulation so students can start it, or send it back. The other tab is student work.', link: '/platform/reviews', keywords: ['review', 'reviews', 'simulation', 'check', 'approve', 'work'], pages: ['/platform/reviews'] },
      { title: 'Partner requests', answer: 'Partner requests lists colleges and universities asking to join.', link: '/platform/requests', keywords: ['request', 'requests', 'partner', 'join'], pages: ['/platform/requests'] },
      { title: 'Onboard data', answer: 'Onboard data holds the lists institutions are set up from: colleges, courses and fields of interest.', link: '/platform/data', keywords: ['data', 'lists', 'courses', 'colleges list', 'reference'], pages: ['/platform/data'] },
    ],
  },

  /* ------------------------------------------------------------------ */
  campus: {
    name: 'College placement cell',
    welcome: 'Your college\'s placement cell: students and batches, the jobs companies post to you, placement seasons and offers.',
    tour: [
      { title: 'Overview', text: 'Your college at a glance: students, batches, verification and what needs you.', link: '/campus' },
      { title: 'Job requests', text: 'Jobs companies want to post to your students. Accept or decline each one.', link: '/campus/requests' },
      { title: 'Placement seasons', text: 'Your placement drives (final placements, summer internships), the jobs in each and how many applied.', link: '/campus/drives' },
      { title: 'Students and Batches', text: 'Your students by programme and batch. Verify records so students can apply.', link: '/campus/programs' },
      { title: 'Team', text: 'Invite your placement team and choose what each may do.', link: '/campus/team' },
    ],
    suggestions: ['Where are our students?', 'How do I approve a job?', 'Where are the placement drives?', 'How do I add a team member?'],
    entries: [
      { title: 'Overview', answer: 'Your college at a glance and what needs you.', link: '/campus', keywords: ['overview', 'home', 'dashboard'], pages: ['/campus'] },
      { title: 'Approve jobs for your students', answer: 'Job requests lists roles companies want to post to your college. Open one to check it, then accept or decline.', link: '/campus/requests', keywords: ['job', 'jobs', 'request', 'requests', 'approve', 'accept', 'decline', 'posting'], pages: ['/campus/requests'] },
      { title: 'Placement seasons', answer: 'Placement seasons lists your drives - final placements and summer internships - with their jobs and applications.', link: '/campus/drives', keywords: ['drive', 'drives', 'season', 'placement', 'placements', 'applications'], pages: ['/campus/drives'] },
      { title: 'Students', answer: 'Students shows your students by programme; Batches by passing year. Verify a record so the student can apply.', link: '/campus/programs', keywords: ['student', 'students', 'verify', 'record', 'programme'], pages: ['/campus/programs'] },
      { title: 'Batches', answer: 'Batches lists each programme and passing year; open one to see and verify its students.', link: '/campus/batches', keywords: ['batch', 'batches', 'year', 'class'], pages: ['/campus/batches'] },
      { title: 'Your team', answer: 'Team: invite colleagues to the placement cell and set their role.', link: '/campus/team', keywords: ['team', 'invite', 'colleague', 'member', 'coordinator'], pages: ['/campus/team'] },
      { title: 'Counselling', answer: 'Counselling: students who asked for guidance, and your notes.', link: '/campus/counselling', keywords: ['counselling', 'counseling', 'guidance', 'help student'], pages: ['/campus/counselling'] },
    ],
  },
};

/** Which portal a page belongs to. */
export function areaFor(pathname: string): Area | null {
  if (pathname.startsWith('/student')) return 'student';
  if (pathname.startsWith('/company')) return 'company';
  if (pathname.startsWith('/platform')) return 'platform';
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/campus')) return 'campus';
  return null;
}

const STOP = new Set(['how', 'do', 'i', 'can', 'the', 'a', 'an', 'my', 'to', 'is', 'are', 'where', 'what', 'see', 'find', 'of', 'in', 'on', 'for', 'and', 'me', 'we', 'our', 'it', 'this', 'which', 'who', 'have', 'has', 'get', 'go', 'show', 'please', 'want']);
const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w));
/** "certificates" and "certificate" are the same word to someone asking. */
const stem = (w: string) => w.replace(/(ies)$/, 'y').replace(/(es|s)$/, '');

/** The entries that best answer a question, best first. */
export function answer(area: Area, question: string, limit = 3): GuideEntry[] {
  const q = [...new Set(words(question).map(stem))];
  if (!q.length) return [];
  const phrase = question.toLowerCase();
  const entries = GUIDES[area].entries;

  // How strongly one asked-for word points at one entry: 3 for a keyword, 2
  // for a word of its title, 1 for a near miss ("certif" for "certificate").
  const hit = (e: GuideEntry, w: string) => {
    let best = 0;
    for (const k of e.keywords) {
      const kl = stem(k.toLowerCase());
      if (kl === w) best = Math.max(best, 3);
      else if (w.length > 3 && (kl.startsWith(w) || w.startsWith(kl))) best = Math.max(best, 1);
    }
    if (words(e.title).map(stem).includes(w)) best = Math.max(best, 2);
    return best;
  };

  const scored = entries.map((e) => {
    let score = 0;
    for (const w of q) {
      const h = hit(e, w);
      if (!h) continue;
      // A word most entries share ("student" in the student portal) tells
      // less than one only a few have ("offer"), so it counts for less.
      const spread = entries.filter((x) => hit(x, w) > 0).length;
      score += h / spread;
    }
    // A whole phrase asked for ("offer letter", "hand in") is a strong sign.
    for (const k of e.keywords) if (k.includes(' ') && phrase.includes(k.toLowerCase())) score += 3;
    return { e, score };
  });
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.e);
}

/** What the page someone is on is for. */
export function onThisPage(area: Area, pathname: string): GuideEntry | null {
  const hits = GUIDES[area].entries
    .flatMap((e) => (e.pages ?? []).map((p) => ({ e, p })))
    .filter(({ p }) => (p.endsWith('/') ? pathname.startsWith(p) : pathname === p || pathname === `${p}/`));
  hits.sort((a, b) => b.p.length - a.p.length);
  return hits[0]?.e ?? null;
}
