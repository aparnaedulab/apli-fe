import AdminLayout from './AdminLayout';
import { SkillDemandView } from '../campus/Skills';

/**
 * Skill demand for the whole institution: every college's drives together,
 * with a row per college - the view a university's board of studies needs.
 */
export default function SkillDemand() {
  return (
    <AdminLayout>
      <SkillDemandView scope="tenant" />
    </AdminLayout>
  );
}
