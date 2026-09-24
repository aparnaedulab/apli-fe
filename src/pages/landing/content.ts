/**
 * What the landing page says, and to whom.
 *
 * The page has one argument and three audiences, and they do not share a
 * feeling. A student arrives anxious: they are being measured, repeatedly, by
 * strangers, on a timetable they do not control. A placement officer arrives
 * tired and accountable. A recruiter arrives sceptical, because they have
 * been sent forty resumes a model wrote. A page that addresses all three at
 * once addresses none of them, so the visitor says which they are and the
 * page answers that person.
 *
 * Two rules run through every line here.
 *
 * Nothing is invented. There are no testimonials, no logos, no "trusted by
 * 500 colleges" - the product is honest about what exists, and a landing page
 * that is not would be the first broken promise. What persuades instead is
 * demonstration: the thing working, in front of you.
 *
 * And the fears are written in the second person, not as quotes. "You applied
 * to forty companies and heard nothing" is something the reader recognises;
 * the same sentence in quotation marks under a stock photograph is a person
 * we made up.
 *
 * Demo values only: no real company, no real salary, no real person.
 */

export type Persona = 'student' | 'college' | 'company';

export interface Fear {
  /** The feeling, in the words the reader would use. */
  fear: string;
  /** What the portal actually does about it. Mechanism, not comfort. */
  answer: string;
  /** The part of the product that is, so it can be checked. */
  proof: string;
}

export interface PersonaCopy {
  key: Persona;
  /** On the switch. */
  label: string;
  /** How they would say it about themselves. */
  pick: string;
  eyebrow: string;
  /** Split so the second half can be set in the display face. */
  headline: [string, string];
  lede: string;
  /** What the hero demo is showing them. */
  caption: string;
  cta: { to: string; label: string };
  fearsTitle: string;
  fears: Fear[];
  closing: { title: string; body: string };
}

export const PERSONAS: PersonaCopy[] = [
  {
    key: 'student',
    label: 'Student',
    pick: 'I am looking for a job',
    eyebrow: 'For students',
    headline: ['Every job here is real.', 'So is every offer.'],
    lede:
      'Your college verifies your record once, so you never prove it again. You see only the roles you actually qualify for, you are told why when you do not, and the offer is tracked all the way to the day you join.',
    caption: 'Your application, and every move somebody makes on it.',
    cta: { to: '/login', label: 'Sign in with your college email' },
    fearsTitle: 'The part nobody puts on a placement website',
    fears: [
      {
        fear: 'You applied to forty companies and heard nothing back from most of them.',
        answer:
          'Every application says where it is and who it is waiting on. Your institution sets how many days a company has to answer, and the clock is visible to both of you.',
        proof: 'Live tracker with response deadlines',
      },
      {
        fear: 'The poster said 12 LPA. You have no idea what arrives in your account.',
        answer:
          'Every offer is split into fixed, variable, joining bonus and bond before you apply, and the monthly in-hand is estimated with its working shown.',
        proof: 'The honest offer card',
      },
      {
        fear: 'Somebody asked you for eight thousand rupees to confirm a training slot.',
        answer:
          'No money moves through this platform, ever. A company is verified by the platform, then accepted by your college, and any role can be reported in one tap.',
        proof: 'Scam shield and two verification gates',
      },
      {
        fear: 'You signed a two-year bond you were shown on the day you signed it.',
        answer:
          'Bonds, relocation and service agreements are stated on the role before you apply, and acknowledged on the application itself. Nobody can say you were told later.',
        proof: 'Non-negotiable terms, shown up front',
      },
      {
        fear: 'You accepted an offer in March and were still waiting to join in October.',
        answer:
          'An offer is tracked to the joining date. You record what actually happened, and the company carries an offer-honour rate that the next batch can see.',
        proof: 'Offer protection and joining tracker',
      },
      {
        fear: 'You do not know why that role will not let you apply.',
        answer:
          'It names the condition - the CGPA floor, the backlog limit, the branch, your institution’s one-offer rule - instead of a grey button with no explanation.',
        proof: '"Why can’t I apply?"',
      },
    ],
    closing: {
      title: 'Your college sets this up. Then it is yours.',
      body:
        'If your institution is on Apli.ai, sign in with the email they invited you on. If it is not, this is the part where you send them the link.',
    },
  },
  {
    key: 'college',
    label: 'Placement cell',
    pick: 'I run placements',
    eyebrow: 'For placement cells',
    headline: ['You decide who reaches', 'your students.'],
    lede:
      'One verified roster instead of eleven spreadsheets. Every posting waits for you before a student ever sees it. And the numbers NAAC, NIRF and NBA ask for are already counted, because the season produced them.',
    caption: 'A posting waiting at your gate, and what happens when you accept.',
    cta: { to: '/login', label: 'Sign in to your cell' },
    fearsTitle: 'The part of the season nobody thanks you for',
    fears: [
      {
        fear: 'It is March, and the accreditation numbers live in eleven spreadsheets and one person’s memory.',
        answer:
          'The reports are produced from the season as it ran - offers, medians, branch-wise placement - because every move was recorded when it happened.',
        proof: 'NAAC, NIRF and NBA reports',
      },
      {
        fear: 'A company you have never heard of wants to talk to your final years.',
        answer:
          'Every company is verified by the platform before it can hire anywhere, and you accept or decline each posting yourself. You can add your own approval gate on top.',
        proof: 'The approval gate, and institution rules',
      },
      {
        fear: 'Three students accepted offers and quietly kept interviewing.',
        answer:
          'The one-offer rule is enforced by the portal rather than by trust, in the shape your institution chooses, and every acceptance is on the record.',
        proof: 'One-offer rule, enforced',
      },
      {
        fear: 'A student stopped applying in November and nobody noticed until February.',
        answer:
          'At-risk students surface while there is still a season left to fix it, and you can open a conversation without the portal ever telling the student they were flagged.',
        proof: 'At-risk alerts and counselling',
      },
      {
        fear: 'A company made forty offers and honoured thirty-one.',
        answer:
          'Offers are tracked to joining and a company carries its record with it, so next year’s decision about who to invite is made on evidence rather than on lunch.',
        proof: 'Offer-honour rate',
      },
      {
        fear: 'Your best students are the ones who interview loudest.',
        answer:
          'A student showcase lets recruiters find the quiet one whose work is strong, and you run your own preparation sessions and invite exactly the people who need them.',
        proof: 'Showcase, events and readiness',
      },
    ],
    closing: {
      title: 'Start with one batch.',
      body:
        'Your university onboards the institution, you add a batch and open a drive, and the first posting can arrive the same week.',
    },
  },
  {
    key: 'company',
    label: 'Recruiter',
    pick: 'I am hiring',
    eyebrow: 'For recruiters',
    headline: ['Every student here', 'is who they say they are.'],
    lede:
      'Academic records are frozen by the college, not typed by the candidate. You set your own rounds, see where each applicant stands, and reach several institutions without a single spreadsheet being emailed anywhere.',
    caption: 'Your role, the college that accepted it, and the students it reached.',
    cta: { to: '/register/company', label: 'Register your company' },
    fearsTitle: 'What campus hiring costs you today',
    fears: [
      {
        fear: 'Half the resumes read the same, because the same model wrote them.',
        answer:
          'What a student claims sits beside what a college verified and what they actually produced - a completed work simulation, a signed internship, a skills passport.',
        proof: 'Verified records and proof of work',
      },
      {
        fear: 'You shortlist two hundred and sixty turn up.',
        answer:
          'Students see the role only if they qualify, they are told what each round is, and the placement cell runs the day with you on the same screen.',
        proof: 'Eligibility, and the drive-day desk',
      },
      {
        fear: 'You have no idea which colleges are worth the trip.',
        answer:
          'One posting reaches the institutions you target, each accepting for itself, and you see which ones answered, applied and turned up.',
        proof: 'Multi-college postings',
      },
      {
        fear: 'Your best candidate had never heard of you.',
        answer:
          'A company page you write, measured against what actually happened - your offer-honour rate and what students said afterwards - plus campus weeks and invitations to your own applicants.',
        proof: 'Company showcase and campus events',
      },
    ],
    closing: {
      title: 'Registering takes about two minutes.',
      body:
        'The platform verifies your company once. After that, every institution on Apli.ai is a posting away - and each one still decides for itself.',
    },
  },
];

export const personaCopy = (p: Persona): PersonaCopy => PERSONAS.find((x) => x.key === p)!;

/* -------------------------------------------------------------------------- */
/* The season, as it is actually lived                                         */
/* -------------------------------------------------------------------------- */

export interface Beat {
  when: string;
  /** One word for how it feels. The honest one, not the brochure one. */
  mood: string;
  /** What is happening to the student. */
  what: string;
  /** What this portal does at that exact moment. */
  does: string;
}

export const SEASON: Beat[] = [
  {
    when: 'July',
    mood: 'Hope',
    what: 'The list goes up. Everybody is suddenly rewriting a resume at 2am.',
    does: 'Your record is verified once by the college and frozen. You never prove your marks again.',
  },
  {
    when: 'August',
    mood: 'Noise',
    what: 'Forty companies, six eligibility rules each, and a WhatsApp group nobody can read.',
    does: 'You see the roles you qualify for. The rest say which condition closed them, not just no.',
  },
  {
    when: 'October',
    mood: 'Silence',
    what: 'You have applied to everything and heard back from almost nothing.',
    does: 'Every application says who it is waiting on, and the company has a deadline to answer.',
  },
  {
    when: 'December',
    mood: 'Doubt',
    what: 'Your friends have offers. You are wondering what is wrong with you.',
    does: 'Your readiness is measured against your own last check, never against your classmates.',
  },
  {
    when: 'February',
    mood: 'Relief',
    what: 'An offer. Twelve lakhs, it says, in a letter you read four times.',
    does: 'Fixed, variable, in-hand and bond, separated before you answer - and a guide to what you are signing.',
  },
  {
    when: 'The August after',
    mood: 'The part everybody forgets',
    what: 'You are still waiting for a joining date.',
    does: 'The offer is tracked to the day you join, and the company carries whether it kept it.',
  },
];
