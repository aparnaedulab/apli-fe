/**
 * What the guides say.
 *
 * Kept as data, apart from the screens, for the same reason the presence
 * guide is (`prepare/content.ts`): a placement cell's correction - "our
 * one-offer rule allows one dream application" - has to be a text change, not
 * a code change. It is also the layer a per-institution override would sit on
 * later.
 *
 * What belongs here and what does not
 * -----------------------------------
 * Only two kinds of writing earn a place: how *this* system works, and what a
 * student is owed inside it. Generic advice ("top ten HR questions") is not
 * here - aptitude practice and the mock interviewer do that better, and prose
 * about them rots within a season. Anything written here should be something
 * no career blog could write, because it is about this portal, this college
 * and this offer.
 *
 * Demo values only in the examples - no real company, no real person, no real
 * phone number.
 */

export type Shelf = 'system' | 'rights' | 'craft';

export const SHELVES: { key: Shelf; name: string; blurb: string }[] = [
  {
    key: 'system',
    name: 'How hiring here works',
    blurb: 'The rules you are standing inside - rounds, eligibility, deadlines, and who sees what.',
  },
  {
    key: 'rights',
    name: 'Know your rights',
    blurb: 'What an offer actually says, what a bond means, and what to do when something goes wrong.',
  },
  {
    key: 'craft',
    name: 'Do it well',
    blurb: 'Short, with examples: the resume, the answers, the email, the choice between two offers.',
  },
];

export interface GuideLink {
  to: string;
  label: string;
  /** Hidden where the institution does not have that module. */
  module?: string;
}

export interface GuideSection {
  /** Stable, so a link can point at one part of a long guide. */
  id: string;
  heading: string;
  body: string[];
  list?: string[];
}

export interface Guide {
  /** The slug in `?g=`. Stable: strips and links elsewhere point at it. */
  id: string;
  shelf: Shelf;
  title: string;
  /** One line, in the words a student would use to ask for it. */
  lede: string;
  minutes: number;
  /** The guide is hidden where the institution has this module switched off. */
  module?: string;
  sections: GuideSection[];
  /**
   * Things to do, ticked by the student and kept in their own browser.
   * Nobody else ever sees them: a guide is not marked.
   */
  checklist?: string[];
  /** Where to go and actually do it. */
  links?: GuideLink[];
}

/* -------------------------------------------------------------------------- */
/* The guides                                                                  */
/* -------------------------------------------------------------------------- */

export const GUIDES: Guide[] = [
  /* --- how hiring here works --------------------------------------------- */
  {
    id: 'rounds',
    shelf: 'system',
    title: 'What each round is really testing',
    lede: 'Seven kinds of round, and the one thing each is actually looking for.',
    minutes: 4,
    sections: [
      {
        id: 'resume-screen',
        heading: 'Resume screen',
        body: [
          'Nobody meets you. A person or a filter decides in well under a minute whether your record matches what the role needs.',
          'It is testing whether your resume states the things the role asks for, in words somebody can find. It is not testing how hard you worked.',
        ],
      },
      {
        id: 'mcq-test',
        heading: 'Online test',
        body: [
          'Aptitude, or aptitude and a technical section, under a clock. Most students who do badly here run out of time rather than out of knowledge.',
          'It is testing speed on questions you already know how to do. Practice is worth more than revision.',
        ],
      },
      {
        id: 'assignment',
        heading: 'Assignment',
        body: [
          'A task to take away and submit. The deadline is part of the test, and a late excellent submission usually scores below a punctual good one.',
          'It is testing whether you can finish something unsupervised and explain what you did.',
        ],
      },
      {
        id: 'work-simulation',
        heading: 'Work simulation',
        body: [
          'A piece of the actual job, set by the company as a hiring round. You open it from the application it belongs to.',
          'It is testing judgement, not output alone - expect to be asked to explain your choices afterwards. Say what you tried and what you rejected.',
        ],
      },
      {
        id: 'group-discussion',
        heading: 'Group discussion',
        body: [
          'Six to twelve of you on one topic. The loudest voice is rarely the one selected.',
          'It is testing whether a group works better because you are in it: entering cleanly, building on somebody, summarising at the end.',
        ],
      },
      {
        id: 'video-interview',
        heading: 'Recorded interview',
        body: [
          'Questions on screen, your answer recorded, nobody on the other side. It feels strange, and that is normal.',
          'It is testing structure and clarity under mild pressure. Answer the question that was asked, in about a minute, and stop.',
        ],
      },
      {
        id: 'live-interview',
        heading: 'Live interview',
        body: [
          'HR, technical or managerial, on campus or online. The only round where you can ask questions back, and the only one where not knowing something is survivable if you say so plainly.',
          'It is testing whether your record is really yours. Every line on the resume you sent is fair game, so be ready to talk about all of it.',
        ],
      },
    ],
    checklist: [
      'I know which round is next on each live application',
      'I have practised the round that is next, not the one I enjoy',
      'I can talk about every line on the resume I actually sent',
    ],
    links: [
      { to: '/student/applications', label: 'See which round each application is at' },
      { to: '/student/practice', label: 'Practise an online test', module: 'dev.aptitude' },
      { to: '/student/interview', label: 'Practise an interview', module: 'dev.mockInterview' },
      { to: '/student/gd', label: 'Practise a group discussion', module: 'dev.gd' },
      {
        to: '/student/stories',
        label: 'Read what seniors faced at the same company',
        module: 'showcase.stories',
      },
    ],
  },
  {
    id: 'eligibility',
    shelf: 'system',
    title: 'Why a job can be closed to you',
    lede: 'Six things decide it, and none of them is a judgement on you.',
    minutes: 3,
    sections: [
      {
        id: 'who-decides',
        heading: 'Two gates, not one',
        body: [
          'A company posts a role. Your college accepts or declines that posting for its students. Only then does it reach you.',
          'So a job your friend at another college can apply to may never appear for you - and that is your college deciding, not the company rejecting you.',
        ],
      },
      {
        id: 'conditions',
        heading: 'What the conditions are',
        body: ['A posting can require any of these, and the portal checks them before it lets you apply:'],
        list: [
          'Your course and branch',
          'Your batch, or year of passing',
          'A marks or CGPA floor, sometimes across all of 10th, 12th and degree',
          'A limit on active backlogs, and sometimes on past ones',
          'Your college, where a posting goes to only some of them',
          'Whether you already hold an offer, under your institution’s one-offer rule',
        ],
      },
      {
        id: 'frozen',
        heading: 'Your record is frozen by the college',
        body: [
          'The marks the eligibility check reads are the ones your college verified, not the ones you typed. That is the point of the portal: a company can trust the number without asking you to prove it.',
          'If a verified number is wrong, your placement cell corrects it - and it is worth doing before the season rather than during it.',
        ],
      },
      {
        id: 'told',
        heading: 'You are told which condition it was',
        body: [
          'Where a role is closed to you, the reason sits on the role itself rather than being hidden. One missing condition is a fact you can plan around; "not eligible" on its own is not.',
        ],
      },
    ],
    checklist: [
      'My verified marks and backlog count are right',
      'I have read the reason on a role I could not apply to',
      'I have asked the placement cell about anything that looks wrong',
    ],
    links: [
      { to: '/student/jobs', label: 'See what is open to you now' },
      { to: '/student/profile', label: 'Check what your college has verified' },
    ],
  },
  {
    id: 'one-offer',
    shelf: 'system',
    title: 'The one-offer rule',
    lede: 'Why the list goes quiet after you accept, and what to settle before it does.',
    minutes: 2,
    sections: [
      {
        id: 'what',
        heading: 'What it is',
        body: [
          'Most institutions run a one-offer rule: once you hold an offer you stop being eligible for further campus postings. It exists so that a hundred offers reach a hundred students instead of ten.',
          'It is your institution’s rule, not a law and not Apli.ai’s. The shape differs - some allow a further attempt above a salary threshold, some allow one "dream" application declared in advance.',
        ],
      },
      {
        id: 'before',
        heading: 'What to settle before you accept',
        body: [
          'Accepting is the moment the rule applies, so the questions worth asking are the ones that are awkward afterwards:',
        ],
        list: [
          'Does my institution allow a further application after this, and on what condition?',
          'Is this offer’s in-hand pay what I think it is?',
          'Is there a bond, and for how long?',
          'When does the company say I join, and what happens if that slips?',
        ],
      },
      {
        id: 'declining',
        heading: 'Declining is allowed, and it is recorded',
        body: [
          'You may decline. It does not count against your eligibility, but it is part of the record your placement cell sees - so decline for a reason you would say out loud.',
        ],
      },
    ],
    checklist: [
      'I know my institution’s exact one-offer rule',
      'I have read this offer’s in-hand pay and bond before answering',
      'I have asked the placement cell anything I was unsure of',
    ],
    links: [
      { to: '/student/applications', label: 'See where your applications stand' },
      { to: '/student/guides?g=offer-letter', label: 'Read an offer properly' },
    ],
  },
  {
    id: 'deadlines',
    shelf: 'system',
    title: 'Deadlines, in both directions',
    lede: 'The clock on you, and the clock on the company.',
    minutes: 2,
    module: 'trust.tracker',
    sections: [
      {
        id: 'on-you',
        heading: 'The clock on you',
        body: [
          'An offer or an invitation carries a date by which you must answer. Silence is not neutral - a lapsed offer is a declined offer, and your institution’s rules may treat it exactly that way.',
          'If you need longer, ask the placement cell before the date rather than after it. That conversation is normal and usually possible.',
        ],
      },
      {
        id: 'on-them',
        heading: 'The clock on them',
        body: [
          'Your institution sets how many days a company has to respond after a round. The tracker shows where each application is waiting, and who it is waiting on.',
          'Ghosting is the most common complaint in campus hiring, so it is measured here: a company that lets applications go quiet builds that into its own record, where the next batch can see it.',
        ],
      },
      {
        id: 'quiet',
        heading: 'When nothing has moved',
        body: [
          'A long quiet is worth raising with the placement cell rather than with the company directly. They hold the relationship and the response deadline, and one chase from them lands better than thirty from students.',
        ],
      },
    ],
    checklist: [
      'I have answered anything that is waiting on me',
      'I know which of my applications are waiting on the company',
      'I have told the placement cell about anything quiet for weeks',
    ],
    links: [{ to: '/student/applications', label: 'See what is waiting on you' }],
  },
  {
    id: 'what-they-see',
    shelf: 'system',
    title: 'What a company sees of you',
    lede: 'Exactly what leaves this portal, and what never does.',
    minutes: 3,
    sections: [
      {
        id: 'sees',
        heading: 'What a company you applied to can see',
        body: [
          'Your verified academic record, the resume you sent with that application, your profile as you wrote it, and anything you chose to show - projects, a skills passport, work you completed here.',
        ],
      },
      {
        id: 'never',
        heading: 'What it never sees',
        body: [
          'Your practice. Mock interviews, aptitude attempts, the readiness check, the soft-skills studio and anything you tick on a guide are yours alone.',
          'Rehearsal that is marked stops being rehearsal, so none of it is reported to anybody.',
        ],
      },
      {
        id: 'college',
        heading: 'What your college sees',
        body: [
          'Your placement cell sees your applications and where each one stands, because running placements is their job.',
          'Some development modules report to them in aggregate - how a batch is doing, not what you answered.',
        ],
      },
      {
        id: 'control',
        heading: 'What you control',
        body: [
          'Whether you appear in the showcase companies browse, what is on your profile, and what consent you have given for your data.',
          'All of it is changeable, and changing it does not affect an application already sent.',
        ],
      },
    ],
    links: [
      { to: '/student/privacy', label: 'See and change your consent', module: 'compliance.consent' },
      { to: '/student/showcase', label: 'Decide what companies can browse', module: 'showcase.student' },
      { to: '/student/profile', label: 'Edit your profile' },
    ],
  },

  /* --- know your rights --------------------------------------------------- */
  {
    id: 'offer-letter',
    shelf: 'rights',
    title: 'Reading an offer, properly',
    lede: 'The number they announce is not the number that arrives.',
    minutes: 4,
    module: 'trust.offerCard',
    sections: [
      {
        id: 'ctc',
        heading: 'CTC is not salary',
        body: [
          'CTC is what the company spends on you, including things that never reach your account. The figure that matters to you is monthly in-hand.',
          'Apli.ai splits every offer into fixed, variable, joining bonus and bond so the parts cannot hide inside one big number, and estimates in-hand from the fixed part.',
        ],
      },
      {
        id: 'fixed',
        heading: 'Fixed',
        body: [
          'What you are paid regardless of your performance, the team’s results or how the year goes. Build your plans on this and nothing else.',
        ],
      },
      {
        id: 'variable',
        heading: 'Variable',
        body: [
          'A bonus that depends on something - your rating, a team target, company profit. It is shown as "up to", because up to is what it is.',
          'A fair question in the interview, and a fair question to the placement cell: what did last year’s batch actually receive?',
        ],
      },
      {
        id: 'in-hand',
        heading: 'In-hand',
        body: [
          'Fixed pay less income tax, provident fund and professional tax. The portal shows its working, so you can see which assumptions it made rather than trusting a number.',
          'It is an estimate. Your own figure moves with the tax regime you pick and what your employer deducts.',
        ],
      },
      {
        id: 'not-stated',
        heading: 'When a company has not stated it',
        body: [
          'Some postings leave the split out. That is shown as not stated rather than guessed, and it is the right thing to ask the placement cell before a round - not after an offer.',
        ],
      },
    ],
    checklist: [
      'I know the fixed part of this offer, not just the CTC',
      'I know whether the variable part is realistic or decorative',
      'I have read the bond line',
      'I know roughly what lands in my account each month',
    ],
    links: [
      { to: '/student/guides?g=bonds', label: 'What a bond actually commits you to' },
      { to: '/student/applications', label: 'Open the offer waiting on you' },
    ],
  },
  {
    id: 'bonds',
    shelf: 'rights',
    title: 'Bonds and service agreements',
    lede: 'What you are signing, what is normal, and what to ask before you sign it.',
    minutes: 4,
    sections: [
      {
        id: 'what',
        heading: 'What a bond is',
        body: [
          'An agreement to stay for a period - commonly one to three years - or to pay a stated amount if you leave earlier. It is usually justified by training the company pays for.',
          'Where a posting carries one it is on the offer card before you apply, with the months and the amount. It should never be first mentioned on the day you sign.',
        ],
      },
      {
        id: 'legal',
        heading: 'What is generally enforceable, and what is not',
        body: [
          'Indian courts have broadly upheld a bond that recovers a genuine, provable training cost, and have been unwilling to enforce one that is really a penalty or that stops a person working elsewhere.',
          'Holding your original certificates as security is a practice regularly criticised by courts and regulators. You are entitled to refuse it and to ask for the requirement in writing.',
          'This is a guide, not legal advice. For a large amount, half an hour of a lawyer’s time costs less than a year of the bond.',
        ],
      },
      {
        id: 'ask',
        heading: 'Ask these before you sign',
        body: [],
        list: [
          'How long is the period, and when does it start - joining, or the end of training?',
          'What exactly do I pay if I leave, and is it reduced for time already served?',
          'Does it apply if the company terminates me, or delays my joining?',
          'Are my original documents being asked for, and on what basis?',
          'May I read the full agreement now, rather than on joining day?',
        ],
      },
      {
        id: 'tell',
        heading: 'Tell the placement cell',
        body: [
          'A bond that was not on the posting, or that grows between the offer and the agreement, is something your cell wants to know - for you, and for the batch behind you.',
        ],
      },
    ],
    checklist: [
      'I have the bond period and amount in writing',
      'I have asked what happens if joining is delayed',
      'I have not handed over original documents',
      'The placement cell knows the terms I was given',
    ],
    links: [
      { to: '/student/applications', label: 'See the offer this applies to' },
      { to: '/student/guides?g=offer-trouble', label: 'If the offer is delayed or withdrawn' },
    ],
  },
  {
    id: 'offer-trouble',
    shelf: 'rights',
    title: 'If an offer is delayed or withdrawn',
    lede: 'The thing this portal was built to stop - and what happens when it still happens.',
    minutes: 3,
    module: 'trust.offerProtection',
    sections: [
      {
        id: 'tracked',
        heading: 'An offer is tracked to joining',
        body: [
          'Accepting is not the end of the record here. The joining date is held, you confirm what actually happened, and a company’s offer-honour rate is built from that.',
          'It is the number a company cannot talk its way past, and the reason the next batch can tell a reliable employer from a confident one.',
        ],
      },
      {
        id: 'delayed',
        heading: 'If joining slips',
        body: [
          'Record it here and tell your placement cell the same week. Delay is common enough to have its own name on campuses, and a cell that learns in March can negotiate; one that learns in August cannot.',
          'Ask for the revised date in writing, and ask whether the offer is confirmed or merely not yet cancelled. They are different answers.',
        ],
      },
      {
        id: 'withdrawn',
        heading: 'If it is withdrawn',
        body: [
          'Keep everything - the offer, your acceptance, the emails. Tell the placement cell immediately, because your institution can usually reopen your eligibility once an offer is gone, and that is what gets you back into the season.',
          'A withdrawn offer is recorded against the company, not against you.',
        ],
      },
      {
        id: 'nothing',
        heading: 'If nobody replies at all',
        body: [
          'Chase through the placement cell rather than alone. They hold the relationship, and a company that ignores a cell risks every future batch - which is leverage you do not have by yourself.',
        ],
      },
    ],
    checklist: [
      'My offer letter and acceptance are saved somewhere that is not this portal',
      'My joining status here matches what is actually happening',
      'The placement cell knows about any delay',
    ],
    links: [{ to: '/student/applications', label: 'Update what happened at joining' }],
  },
  {
    id: 'no-fees',
    shelf: 'rights',
    title: 'Nobody legitimate asks you for money',
    lede: 'The five shapes a campus hiring scam takes.',
    minutes: 3,
    module: 'trust.scamShield',
    sections: [
      {
        id: 'rule',
        heading: 'The rule, with no exceptions',
        body: [
          'A real employer pays you. It does not charge a registration fee, a training fee, a security deposit, a laptop deposit or a certification fee, and it does not ask you to pay somebody to be placed.',
          'No money moves through Apli.ai at all. Any request for payment connected to a posting here is wrong, whatever it is called.',
        ],
      },
      {
        id: 'shapes',
        heading: 'What it usually looks like',
        body: [],
        list: [
          'An offer that arrives without any round, for money paid first',
          'A "paid training programme" that becomes a job at the end, one day',
          'A refundable deposit for equipment or documents',
          'An interview moved to a personal chat app, at odd hours, with urgency',
          'A request for your bank details, an OTP, or original certificates before joining',
        ],
      },
      {
        id: 'verified',
        heading: 'What verification here means',
        body: [
          'Every company is checked by the platform team before it can hire anywhere, and your college accepts each posting separately. Your institution may add a third gate of its own.',
          'That is three checks - and it is still worth reading a posting with your own eyes.',
        ],
      },
      {
        id: 'report',
        heading: 'Report it',
        body: [
          'Every role has a quiet way to report it, and the report goes to your own placement cell. Reporting something that turns out to be fine costs nothing; staying silent about something that is not costs the whole batch.',
        ],
      },
    ],
    checklist: [
      'I have paid nothing to anybody for a placement',
      'I have not shared an OTP or a bank password with a "recruiter"',
      'I have reported anything that asked me to pay',
    ],
    links: [{ to: '/student/jobs', label: 'Report a role that asked for money' }],
  },
  {
    id: 'your-data',
    shelf: 'rights',
    title: 'Your data, and the consent you gave',
    lede: 'What is held about you, why, and how to take it back.',
    minutes: 3,
    module: 'compliance.consent',
    sections: [
      {
        id: 'held',
        heading: 'What is held',
        body: [
          'Your verified academic record, the profile and resumes you wrote, your applications and their history, and whatever you produced in the development modules.',
        ],
      },
      {
        id: 'consent',
        heading: 'Consent is specific, and it can be withdrawn',
        body: [
          'Under India’s data protection law each purpose is consented to separately, and any of them can be withdrawn. The consent centre lists every purpose in plain words, with the date you agreed.',
          'Withdrawing a consent changes what happens next. It does not undo an application already sent to a company, and the portal says so rather than pretending otherwise.',
        ],
      },
      {
        id: 'rights',
        heading: 'What you can ask for',
        body: [],
        list: [
          'A copy of what is held about you',
          'Correction of anything wrong - marks go through the college that verified them',
          'Withdrawal of a consent you gave',
          'An answer on who your data was shared with, and why',
        ],
      },
    ],
    links: [{ to: '/student/privacy', label: 'Open your consent centre' }],
  },

  /* --- do it well --------------------------------------------------------- */
  {
    id: 'resume',
    shelf: 'craft',
    title: 'A resume somebody can read in twenty seconds',
    lede: 'One page, verbs first, numbers wherever an honest one exists.',
    minutes: 4,
    sections: [
      {
        id: 'twenty',
        heading: 'Twenty seconds is the real budget',
        body: [
          'At a screen your resume is read fast, or filtered by software. Both reward the same thing: the relevant fact placed where it is found.',
          'One page. Nothing that needs a second page has yet happened to any of us at twenty-one.',
        ],
      },
      {
        id: 'lines',
        heading: 'Write lines, not duties',
        body: [
          'Each line is one thing you did, what you did it with, and what came of it. A number belongs in it wherever an honest one exists.',
        ],
        list: [
          'Weak: "Worked on a web development project using React."',
          'Better: "Built the attendance module of a college portal in React; used daily by 4 staff across 6 classes."',
          'Weak: "Responsible for social media."',
          'Better: "Ran the department fest’s Instagram for 6 weeks; posts went from 40 to 300 views."',
        ],
      },
      {
        id: 'order',
        heading: 'Order it by what this role cares about',
        body: [
          'Projects above hobbies, and the project nearest the role at the top. For a data role your data project leads, even if the app was more fun to build.',
          'List skills you would defend in an interview, and no others. "Familiar with" is an invitation to be asked.',
        ],
      },
      {
        id: 'proof',
        heading: 'Let the proof do the arguing',
        body: [
          'Where your work is verified in this portal - a completed simulation, a skills passport, an internship logged and signed - link it. A claim somebody can check is worth several a recruiter has to take on trust.',
        ],
      },
      {
        id: 'ai',
        heading: 'Do not let a model write it',
        body: [
          'AI-written resumes read alike, and recruiters have become fast at spotting the sameness. Worse, it writes claims you then have to defend in a live interview.',
          'Using it to tighten a line you wrote is fine. Using it to invent the line is how interviews end early.',
        ],
      },
    ],
    checklist: [
      'One page',
      'Every line has a verb and, where honest, a number',
      'The project nearest the role is first',
      'I can defend every skill listed',
      'Verified work is linked, not just claimed',
    ],
    links: [
      { to: '/student/resume', label: 'Edit the resume you send' },
      { to: '/student/passport', label: 'Link verified skills', module: 'proof.passport' },
      { to: '/student/projects', label: 'Show work you completed here', module: 'proof.simulations' },
    ],
  },
  {
    id: 'answers',
    shelf: 'craft',
    title: 'The four questions that always come',
    lede: 'Not scripts - shapes, so you are not composing from nothing.',
    minutes: 4,
    sections: [
      {
        id: 'yourself',
        heading: '"Tell me about yourself"',
        body: [
          'Ninety seconds, three beats: where you are now, the one or two things you have done that matter to this role, and why you are sitting here.',
          'Not your school, not your family, not your date of birth. They have the form; they are asking for what the form cannot say.',
        ],
      },
      {
        id: 'why-us',
        heading: '"Why this company?"',
        body: [
          'They are testing whether you know what they do. One specific, true sentence about the work beats any amount of admiration.',
          'Read the company’s page in the portal first - what it says about itself, what it is measured on, and what seniors from your college said after interviewing there.',
        ],
      },
      {
        id: 'failure',
        heading: '"Tell me about something that went wrong"',
        body: [
          'They want to know whether you notice, own and learn. Pick a real one, small and finished: what happened, what you did about it, what you changed after.',
          'A polished non-answer ("I work too hard") reads as either unaware or evasive, and both cost more than the mistake would have.',
        ],
      },
      {
        id: 'questions',
        heading: '"Do you have any questions for us?"',
        body: [
          'Always yes. Two, prepared, about the work itself - what a first six months looks like, how the team is arranged, what this role is measured on.',
          'Save pay and bond for the offer conversation with your placement cell, which is where they get answered properly anyway.',
        ],
      },
      {
        id: 'unknown',
        heading: 'When you do not know',
        body: [
          'Say so, then say how you would find out. Interviewers have seen bluffing before and it ends the topic badly; "I have not used that, but here is how I would approach it" keeps you in the conversation.',
        ],
      },
    ],
    checklist: [
      'I have a ninety-second answer I have said out loud',
      'I know one specific true thing about this company',
      'I have a real failure story that ends in a change',
      'I have two questions ready to ask them',
    ],
    links: [
      { to: '/student/interview', label: 'Practise it with feedback', module: 'dev.mockInterview' },
      { to: '/student/stories', label: 'Read what this company asked last year', module: 'showcase.stories' },
      { to: '/student/prepare', label: 'What to wear, and the camera check', module: 'dev.presence' },
    ],
  },
  {
    id: 'writing',
    shelf: 'craft',
    title: 'Writing to a recruiter',
    lede: 'Short, specific, and signed with your name - that is the whole skill.',
    minutes: 2,
    sections: [
      {
        id: 'shape',
        heading: 'The shape of it',
        body: [
          'A subject line that says what it is about. One line on who you are, one on what you want, one on what you have attached. Your name, course, college and phone at the foot.',
          'Under a hundred words. A recruiter is reading four hundred of these.',
        ],
      },
      {
        id: 'example',
        heading: 'An example',
        body: [
          'Subject: Thank you - Backend Intern interview, 14 March',
          '"Thank you for the conversation this morning. I enjoyed the question about handling retries, and I have since read up on the approach you mentioned. I have attached the resume we discussed, and would be glad to answer anything further."',
          'Aparna Rao · B.Tech CSE 2026 · Demo Institute of Technology · +91 90000 00000',
        ],
      },
      {
        id: 'dont',
        heading: 'Things that cost you',
        body: [],
        list: [
          'Writing at 2am from an address like coolguy2004',
          '"Respected sir" to somebody the email names as Priya',
          'Chasing daily - once after a week is fine, and through the placement cell is better',
          'A message where the resume is mentioned and not attached',
        ],
      },
    ],
    links: [
      { to: '/student/prepare', label: 'More on etiquette', module: 'dev.presence' },
      { to: '/student/soft-skills', label: 'Practise written English', module: 'dev.softSkills' },
    ],
  },
  {
    id: 'two-offers',
    shelf: 'craft',
    title: 'Choosing between two offers',
    lede: 'Compare in-hand, not CTC - then compare what money does not say.',
    minutes: 3,
    sections: [
      {
        id: 'compare',
        heading: 'Compare like for like',
        body: [
          'Put both on the same six lines: fixed, realistic variable, in-hand per month, bond, joining date, and what the city costs.',
          'A higher CTC with a large variable and a two-year bond regularly loses to a lower one with neither.',
        ],
      },
      {
        id: 'beyond',
        heading: 'What the number does not say',
        body: [],
        list: [
          'What you will actually do for a year, and whether anybody will teach you',
          'Whether the company kept its offers last year - the offer-honour rate is here for that',
          'The team and the manager, as far as the interview let you tell',
          'Where it leaves you in two years, which matters more than the first salary',
        ],
      },
      {
        id: 'negotiate',
        heading: 'On negotiating a campus offer',
        body: [
          'Campus packages are usually fixed for the whole batch, so there is often nothing to negotiate on pay - and trying can read badly. What is sometimes movable: the joining date, the location, and the team you land in.',
          'Negotiate through your placement cell. They know what this company has agreed to before.',
        ],
      },
      {
        id: 'rule',
        heading: 'Remember the one-offer rule',
        body: [
          'Accepting one usually closes the rest of the season. Decide with that in front of you rather than behind you.',
        ],
      },
    ],
    checklist: [
      'Both offers written out on the same six lines',
      'I have looked at each company’s offer-honour record',
      'I have talked it through with the placement cell',
    ],
    links: [
      { to: '/student/guides?g=one-offer', label: 'The one-offer rule' },
      { to: '/student/applications', label: 'See both offers side by side' },
    ],
  },
];

const BY_ID = new Map(GUIDES.map((g) => [g.id, g]));

export const guideById = (id: string | null | undefined): Guide | undefined =>
  id ? BY_ID.get(id) : undefined;

/* -------------------------------------------------------------------------- */
/* What to put in front of somebody, and when                                  */
/* -------------------------------------------------------------------------- */

/**
 * A guide, at the moment it is worth reading.
 *
 * A guide nobody is handed at the right time is read once, by the student who
 * was already going to be fine. So the index is the smaller half of this: the
 * cues below are what the application screens and the "for you now" block use
 * to put one guide - never three - where the student already is.
 */
export interface Cue {
  guide: string;
  /** A section id, where the guide is long and only one part of it applies. */
  anchor?: string;
  /** The line on the strip, in the words of the moment. */
  cue: string;
}

/** By the round a student has been called to. */
export const ROUND_CUES: Record<string, Cue> = {
  RESUME_SCREEN: {
    guide: 'resume',
    cue: 'This one starts at a resume screen. Twenty seconds is the real budget.',
  },
  MCQ_TEST: {
    guide: 'rounds',
    anchor: 'mcq-test',
    cue: 'An online test is next. It is testing speed, not knowledge.',
  },
  VIDEO_INTERVIEW: {
    guide: 'rounds',
    anchor: 'video-interview',
    cue: 'A recorded interview is next. Answer in about a minute, and stop.',
  },
  LIVE_INTERVIEW: {
    guide: 'answers',
    cue: 'A live interview is next. Four questions always come - here they are.',
  },
  GROUP_DISCUSSION: {
    guide: 'rounds',
    anchor: 'group-discussion',
    cue: 'A group discussion is next. The loudest voice is rarely the one selected.',
  },
  ASSIGNMENT: {
    guide: 'rounds',
    anchor: 'assignment',
    cue: 'An assignment is next. The deadline is part of the test.',
  },
  WORK_SIMULATION: {
    guide: 'rounds',
    anchor: 'work-simulation',
    cue: 'A work simulation is next. Expect to explain your choices afterwards.',
  },
};

/** By where the application itself has got to. */
export const STATUS_CUES: Record<string, Cue> = {
  OFFERED: {
    guide: 'offer-letter',
    cue: 'Before you answer: the number they announced is not the number that arrives.',
  },
  ACCEPTED: {
    guide: 'offer-trouble',
    cue: 'What to do if joining slips, and what is recorded when it does.',
  },
  HIRED: { guide: 'offer-trouble', cue: 'What to do if your joining date moves.' },
};

/** When nothing is happening yet, which is most of the year. */
export const STARTER_CUES: Cue[] = [
  { guide: 'eligibility', cue: 'Start here: why a job can be closed to you, and what decides it.' },
  { guide: 'resume', cue: 'Your resume is read in twenty seconds. Make those count.' },
  { guide: 'no-fees', cue: 'Nobody legitimate asks you for money. The five shapes a scam takes.' },
];

/**
 * The three guides worth reading today, from what is actually happening.
 *
 * Offers first - they carry a deadline and a rule that closes the season.
 * Then the round somebody has been called to. Then, only if neither applies,
 * the ones everybody should read before the season starts.
 */
export function forYou(signals: { statuses: string[]; rounds: string[] }): Cue[] {
  const out: Cue[] = [];
  const seen = new Set<string>();

  const add = (c: Cue | undefined) => {
    if (!c || out.length >= 3) return;
    const key = c.guide + (c.anchor ?? '');
    if (seen.has(key)) return;
    seen.add(key);
    out.push(c);
  };

  for (const s of ['OFFERED', 'ACCEPTED', 'HIRED']) {
    if (signals.statuses.includes(s)) add(STATUS_CUES[s]);
  }
  for (const r of signals.rounds) add(ROUND_CUES[r]);
  for (const c of STARTER_CUES) add(c);

  return out;
}
