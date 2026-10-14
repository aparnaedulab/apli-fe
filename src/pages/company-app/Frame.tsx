import { useEffect, useState, type ReactNode } from 'react';
import { companyAppApi } from '../../api/companyApp';
import { AppFrame } from '../student-app/Shell';
import './company-app.css';

/**
 * The company app's frame: the same header as the student app, with the
 * company's own places to go. "Students' work" carries a count of what is
 * waiting for the company, because that is the one thing that should not wait.
 */
export default function Frame({ children }: { children: ReactNode }) {
  const [waiting, setWaiting] = useState(0);

  useEffect(() => {
    companyAppApi
      .overview()
      .then((o) => setWaiting(o.students.toReview))
      .catch(() => undefined);
  }, []);

  return (
    <AppFrame
      home="/company"
      nav={[
        { to: '/company', label: 'Overview', end: true },
        { to: '/company/simulations', label: 'Simulations' },
        { to: '/company/interviews', label: 'Interviews' },
        { to: '/company/reviews', label: "Students' work", badge: waiting },
        { to: '/company/shared', label: 'Shared with you' },
        { to: '/company/offers', label: 'Offers' },
      ]}
    >
      {children}
    </AppFrame>
  );
}
