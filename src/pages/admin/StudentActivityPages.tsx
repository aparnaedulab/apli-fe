import {
  InterviewsList,
  OffersList,
  SimulationsList,
  StudentsList,
  WorkList,
} from '../shared/StudentActivity';

/**
 * The institution's view of the student app: its own students, the
 * simulations they take, the work they hand in, and the internship offers and
 * interviews that follow. The lists themselves are shared with the platform
 * console; here they are fenced to this institution by the API.
 */
export const AdminStudents = () => <StudentsList base="/admin" />;
export const AdminSimulations = () => <SimulationsList base="/admin" />;
export const AdminWork = () => <WorkList base="/admin" />;
export const AdminOffers = () => <OffersList base="/admin" />;
export const AdminInterviews = () => <InterviewsList base="/admin" />;
