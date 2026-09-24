/**
 * What the professional-presence guide says.
 *
 * Kept as data, apart from the screens, so a placement cell's feedback ("our
 * recruiters expect blazers") is a text change rather than a code change.
 * Demo names and addresses only in the templates - a student copies the
 * shape, never somebody's real details.
 */

export interface DressGuide {
  key: string;
  industry: string;
  examples: string;
  standard: string;
  looks: { who: string; items: string[] }[];
  avoid: string[];
}

export const DRESS: DressGuide[] = [
  {
    key: 'formal',
    industry: 'IT services & banking',
    examples: 'Service companies, banks, consulting, insurance',
    standard: 'Formal',
    looks: [
      { who: 'Shirt & trousers', items: ['Plain light shirt - white or pale blue', 'Dark trousers - navy, grey or black', 'Leather belt matching the shoes', 'Black or brown formal shoes, polished', 'Tie optional; a plain one if you wear one'] },
      { who: 'Western formal', items: ['Plain shirt or blouse', 'Dark trousers or knee-length skirt', 'A blazer if you have one', 'Closed shoes or low heels'] },
      { who: 'Indian formal', items: ['Plain or lightly printed salwar-kurta or a cotton / silk saree', 'Muted colours', 'A neat dupatta, pinned if it tends to slip', 'Closed sandals or flats'] },
    ],
    avoid: ['Bright prints and logos', 'Jeans and sneakers', 'Heavy jewellery or strong fragrance'],
  },
  {
    key: 'smart',
    industry: 'Startups & product companies',
    examples: 'Software products, fintech, e-commerce, SaaS',
    standard: 'Smart casual',
    looks: [
      { who: 'Any', items: ['Collared shirt, polo or a plain kurta', 'Chinos or dark jeans without rips', 'Clean sneakers or loafers', 'Neat and ironed matters more than formal'] },
    ],
    avoid: ['Gym wear and slogans', 'A full suit - it can look out of place', 'Crumpled clothes'],
  },
  {
    key: 'core',
    industry: 'Core engineering & manufacturing',
    examples: 'Automotive, construction, plants, energy',
    standard: 'Formal, practical',
    looks: [
      { who: 'Any', items: ['Formal shirt and trousers, or a formal kurta', 'Sturdy closed shoes - a plant visit may follow', 'Carry a light jacket for air-conditioned halls'] },
    ],
    avoid: ['Open footwear on a site visit', 'Loose accessories near machinery'],
  },
  {
    key: 'creative',
    industry: 'Creative & media',
    examples: 'Design, advertising, content, media',
    standard: 'Neat, with a little personality',
    looks: [
      { who: 'Any', items: ['What you would wear to present your work - clean and put-together', 'One thoughtful touch is fine: a colour, a print, an accessory', 'Bring your portfolio on a charged device'] },
    ],
    avoid: ['Anything you keep adjusting', 'Clothes that pull attention from your work'],
  },
];

export const BUDGET_KIT = {
  title: 'A complete interview look for under ₹2,000',
  items: [
    { item: 'One well-fitted plain shirt or kurta', cost: '₹500–700' },
    { item: 'Dark trousers', cost: '₹600–800' },
    { item: 'Plain belt', cost: '₹150–250' },
    { item: 'Shoe polish for shoes you already own', cost: '₹60–100' },
    { item: 'A clear folder for documents', cost: '₹50–80' },
  ],
  tip: 'One shirt that fits well beats three that do not. Local tailors will take in a shirt for very little.',
};

export const GROOMING = [
  'Hair neat and away from your face',
  'Nails short and clean',
  'Shaved or beard trimmed neatly',
  'Light fragrance or none',
  'Clothes ironed the night before',
  'Shoes clean, and socks that match',
];

export interface Lesson {
  key: string;
  title: string;
  points: string[];
  template?: string;
}

export const LESSONS: Lesson[] = [
  {
    key: 'reply-hr',
    title: 'Replying to an HR email',
    points: ['Reply within a day, even just to confirm', 'Keep their subject line; add nothing clever', 'Confirm date, time and mode in your own words'],
    template: `Subject: Re: Interview for Graduate Engineer Trainee

Dear Ms. Demo,

Thank you for the invitation. I confirm that I will attend the interview on Monday at 10:00 AM at your office. I will bring a printed copy of my resume and my college ID.

Regards,
Riya Demo
B.Tech Computer Engineering, Demo College
riya.demo@demo-college.example`,
  },
  {
    key: 'reporting',
    title: 'Reporting time',
    points: ['Arrive 15 minutes early - not 45', 'For an online round, join 5 minutes early with your camera tested', 'Save the HR contact in your phone before you leave'],
  },
  {
    key: 'greeting',
    title: 'Greeting & introducing yourself',
    points: ['A calm “Good morning” and your name is enough', 'Wait to be offered a seat', 'Keep your phone silent and out of sight'],
    template: `Good morning. I am Riya, a final-year Computer Engineering student at Demo College. Thank you for having me.`,
  },
  {
    key: 'salary',
    title: 'Asking about salary, politely',
    points: ['Ask once the company raises it, or near the end', 'Ask about the breakdown, not just the headline number', 'Ask about any bond before you accept'],
    template: `Could you share how the CTC is structured - the fixed part, any variable pay, and whether there is a service agreement?`,
  },
  {
    key: 'thanks',
    title: 'Thank-you note after an interview',
    points: ['Send it the same day', 'Three or four lines is plenty', 'Mention one thing you discussed'],
    template: `Subject: Thank you - interview on Monday

Dear Mr. Demo,

Thank you for your time today. I enjoyed our conversation about the data pipeline your team is building, and I am even more interested in the role.

Regards,
Riya Demo`,
  },
  {
    key: 'offer',
    title: 'Accepting or declining an offer',
    points: ['Reply within the time they give you', 'Declining politely keeps the door open', 'Once you accept, honour it - backing out later hurts your juniors too'],
    template: `Dear Ms. Demo,

Thank you for the offer for the Graduate Engineer Trainee role. After careful thought, I have decided to accept another offer that fits my plans more closely. I am grateful for your time and hope our paths cross again.

Regards,
Riya Demo`,
  },
];

export const DAY_CHECKLIST = [
  { key: 'resume', text: 'Two printed copies of your resume' },
  { key: 'id', text: 'College ID and one government photo ID' },
  { key: 'marksheets', text: 'Copies of marksheets, in a clear folder' },
  { key: 'photo', text: 'Two passport-size photos' },
  { key: 'route', text: 'Route, travel time and reporting time checked' },
  { key: 'hr', text: 'HR contact saved in your phone' },
  { key: 'intro', text: '“Tell me about yourself” said out loud once' },
  { key: 'company', text: 'Read the company’s website and the job description again' },
  { key: 'questions', text: 'Two questions ready to ask them' },
  { key: 'phone', text: 'Phone charged, and on silent in the room' },
];
