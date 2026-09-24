import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import StudentLayout from './StudentLayout';
import { ApiError } from '../../api/client';
import { showcaseApi, type StudentCompanyPage } from '../../api/showcase';
import { useAuth } from '../../auth/AuthContext';
import CompanyPageLayers from './CompanyPageView';

/**
 * /student/companies/:id - a company's page, as a student reads it.
 *
 * Only where the institution has the company page switched on; elsewhere the
 * screen says so instead of showing a refusal.
 */
export default function CompanyPage() {
  const { id } = useParams();
  const { hasModule } = useAuth();
  const enabled = hasModule('showcase.company');
  const [page, setPage] = useState<StudentCompanyPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !enabled) return;
    showcaseApi
      .company(id)
      .then(setPage)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load this company.'));
  }, [id, enabled]);

  return (
    <StudentLayout>
      <p className="cp-back">
        <Link to="/student/jobs">← Jobs</Link>
      </p>
      {!enabled ? (
        <p className="alert">Company pages are not switched on for your institution.</p>
      ) : error ? (
        <p className="alert alert-error">{error}</p>
      ) : !page ? (
        <p className="muted">Loading…</p>
      ) : (
        <CompanyPageLayers view={page} roles={page.roles} />
      )}
    </StudentLayout>
  );
}
