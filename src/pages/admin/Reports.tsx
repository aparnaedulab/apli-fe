import AdminLayout from './AdminLayout';
import { ReportView } from '../campus/Reports';

/**
 * The institution's placement report: every college, with a row each, and
 * the same NAAC / NIRF workbook a placement cell downloads - for the whole
 * university at once.
 */
export default function Reports() {
  return (
    <AdminLayout>
      <ReportView scope="tenant" />
    </AdminLayout>
  );
}
