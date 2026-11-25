import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { companyAdminApi } from '../../api/admin';
import { reviewApi } from '../../api/studentApp';
import { simulationCheckApi } from '../../api/companyApp';
import { AppHeader } from '../student-app/Shell';
import './console-app.css';

/**
 * The platform console's header: the same one the student, company and
 * admin apps wear, with the console's own places to go.
 *
 * Companies and Reviews carry the number waiting on the platform team,
 * because a company nobody has verified cannot reach a single student, and
 * a simulation nobody has checked never goes live.
 */
export default function ConsoleHeader() {
  const { tenant: acting } = useAuth();
  const [companies, setCompanies] = useState(0);
  const [reviews, setReviews] = useState(0);

  useEffect(() => {
    companyAdminApi
      .list('PENDING')
      .then((r) => setCompanies(r.counts.PENDING ?? 0))
      .catch(() => undefined);
    Promise.all([reviewApi.queue().catch(() => null), simulationCheckApi.queue().catch(() => null)]).then(
      ([work, sims]) => setReviews((work?.reviews.length ?? 0) + (sims?.length ?? 0)),
    );
  }, []);

  return (
    <div className="sa sa-head-only">
      <AppHeader
        home="/platform"
        nav={[
          { to: '/platform', label: 'Institutions', end: true },
          { to: '/platform/students', label: 'Students' },
          { to: '/platform/companies', label: 'Companies', badge: companies },
          { to: '/platform/reviews', label: 'Reviews', badge: reviews },
          { to: '/platform/requests', label: 'Partner requests' },
          { to: '/platform/data', label: 'Onboard data' },
          { to: '/platform/demo-logins', label: 'Demo logins' },
        ]}
        extra={
          acting ? (
            // Straight into whichever institution is being acted on.
            <Link to="/admin" className="con-acting" title="Open this institution's admin">
              <span className="con-acting-label">In</span>
              <b>{acting.shortName || acting.name}</b>
              <span aria-hidden="true">→</span>
            </Link>
          ) : undefined
        }
      />
    </div>
  );
}
