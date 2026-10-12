import { Link, Navigate, Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import TenantLogin from './pages/TenantLogin';
import CampusConsent from './pages/campus/Consent';
import CampusAlumni from './pages/campus/Alumni';
import CampusFlags from './pages/campus/Flags';
import AdminInstitutionRules from './pages/admin/InstitutionRules';
import AdminInterviewQuestions from './pages/admin/InterviewQuestions';
import AdminCompanyAccess from './pages/admin/CompanyAccess';
import Status from './pages/Status';
import AdminDashboard from './pages/admin/AdminDashboard';
import Colleges from './pages/admin/Colleges';
import CollegeDetail from './pages/admin/CollegeDetail';
import AdminBatchDetail from './pages/admin/BatchDetail';
import Setup from './pages/admin/Setup';
import MapDataPage from './pages/admin/MapDataPage';
import CampusPrograms from './pages/campus/Programs';
import { Companies, CompanyDetailPage } from './pages/admin/Companies';
import {
  Applications as AdminApplications,
  Audit,
  Batches as AdminBatches,
  Drives as AdminDrives,
  Invites,
  Jobs as AdminJobs,
  Students as AdminStudents,
  Users,
} from './pages/admin/Operations';
import Settings from './pages/admin/Settings';
import Roles from './pages/admin/Roles';
import Logins from './pages/admin/Logins';
import AcceptInvite from './pages/AcceptInvite';
import JoinBatch from './pages/JoinBatch';
import StudentSignup from './pages/signup/StudentSignup';
import StudentHome from './pages/student-app/Home';
import { StudentSimulationDetail, StudentSimulationList } from './pages/student-app/Simulations';
import StudentJobsSoon from './pages/student-app/Jobs';
import StudentProfilePage from './pages/student-app/Profile';
import StudentTaskPlayer from './pages/student-app/TaskPlayer';
import CompanyOverview from './pages/company-app/Overview';
import { CompanySimulationList } from './pages/company-app/Simulations';
import CompanySimulationEditor from './pages/company-app/Editor';
import { CompanyReviews, CompanyShared } from './pages/company-app/Work';
import CompanySignup from './pages/signup/CompanySignup';
import InstitutionSignup from './pages/signup/InstitutionSignup';
import Join from './pages/signup/Join';
import ConsoleRequests from './pages/platform/ConsoleRequests';
import ConsoleData from './pages/platform/ConsoleData';
import ConsoleReviews from './pages/platform/ConsoleReviews';
import CampusDashboard from './pages/campus/CampusDashboard';
import Batches from './pages/campus/Batches';
import BatchDetail from './pages/campus/BatchDetail';
import Drives from './pages/campus/Drives';
import CampusDrives from './pages/campus/CampusDrives';
import DriveDetail from './pages/campus/DriveDetail';
import JobRequests from './pages/campus/JobRequests';
import JobRequestDetail from './pages/campus/JobRequestDetail';
import CampusTeam from './pages/campus/Team';
import CampusCounselling from './pages/campus/Counselling';
import RequireAuth from './auth/RequireAuth';
import SuperHome from './pages/super/SuperHome';
import Onboarding from './pages/platform/Onboarding';
import ConsoleCompanies from './pages/platform/ConsoleCompanies';
import CampusReports from './pages/campus/Reports';
import AdminReports from './pages/admin/Reports';
import AdminPulse from './pages/admin/Pulse';
import AdminNotices from './pages/admin/Notices';
import CampusInternships from './pages/campus/Internships';
import CampusReadiness from './pages/campus/Readiness';
import CampusStories from './pages/campus/Stories';
import CampusEmployers from './pages/campus/Employers';
import CampusDriveDay from './pages/campus/DriveDay';
import CampusAtRisk from './pages/campus/AtRisk';
import MentorReview from './pages/MentorReview';
import CertificateCheck from './pages/CertificateCheck';
import CampusOffers from './pages/campus/Offers';
import CampusPools from './pages/campus/Pools';
import CampusSkills from './pages/campus/Skills';
import AdminSkillDemand from './pages/admin/SkillDemand';
import CampusMessages from './pages/campus/Messages';
import CampusCampusWeeks from './pages/campus/CampusWeeks';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      {/* An institution's own address: its branded sign-in and Contact us. */}
      <Route path="/t/:slug" element={<TenantLogin />} />
      <Route path="/register/company" element={<CompanySignup />} />
      <Route path="/register/institution" element={<InstitutionSignup />} />
      <Route path="/join" element={<Join />} />
      <Route path="/status" element={<Status />} />

      <Route path="/invite/:token" element={<AcceptInvite />} />
      {/* No login: the link or code is the credential. */}
      <Route path="/internship-review/:token" element={<MentorReview />} />
      <Route path="/certificates/:code" element={<CertificateCheck />} />

      {/* Phase 1 - the trust core. Each page checks its own module and says so
          plainly when an institution has it switched off. */}
      {(
        [
          ['/campus/reports', 'CAMPUS', <CampusReports key="cr" />],
          ['/admin/pulse', 'ADMIN', <AdminPulse key="apu" />],
          ['/admin/notices', 'ADMIN', <AdminNotices key="ano" />],
          ['/admin/reports', 'ADMIN', <AdminReports key="ar" />],
          // Phase 2
          ['/campus/internships', 'CAMPUS', <CampusInternships key="ci" />],
          ['/campus/readiness', 'CAMPUS', <CampusReadiness key="crd" />],
          ['/campus/stories', 'CAMPUS', <CampusStories key="cs" />],
          ['/campus/employers', 'CAMPUS', <CampusEmployers key="ce" />],
          ['/campus/drive-day', 'CAMPUS', <CampusDriveDay key="cd" />],
          ['/campus/at-risk', 'CAMPUS', <CampusAtRisk key="ca" />],
          // Gaps closed after Phase 3
          ['/campus/consent', 'CAMPUS', <CampusConsent key="ccn" />],
          ['/campus/alumni', 'CAMPUS', <CampusAlumni key="cal" />],
          ['/campus/flags', 'CAMPUS', <CampusFlags key="cfl" />],
          ['/admin/institution-rules', 'ADMIN', <AdminInstitutionRules key="air" />],
          ['/admin/interview-questions', 'ADMIN', <AdminInterviewQuestions key="aiq" />],
          ['/admin/company-access', 'ADMIN', <AdminCompanyAccess key="aca" />],
          // Phase 3
          ['/campus/offers', 'CAMPUS', <CampusOffers key="co" />],
          ['/campus/pools', 'CAMPUS', <CampusPools key="cpo" />],
          ['/campus/skills', 'CAMPUS', <CampusSkills key="csk" />],
          ['/admin/skill-demand', 'ADMIN', <AdminSkillDemand key="ask" />],
          ['/campus/messages', 'CAMPUS', <CampusMessages key="cms" />],
          ['/campus/events', 'CAMPUS', <CampusCampusWeeks key="caw" />],
          ['/campus/campus-weeks', 'CAMPUS', <Navigate key="cawo" to="/campus/events" replace />],
        ] as const
      ).map(([path, role, page]) => (
        <Route key={path} path={path} element={<RequireAuth roles={[role]}>{page}</RequireAuth>} />
      ))}
      <Route path="/join/:code" element={<JoinBatch />} />
      {/* Open sign-up: any student, from any college, no code and no approval. */}
      <Route path="/register/student" element={<StudentSignup />} />

      {/* The platform console: onboarding institutions. Operations accounts
          that belong to an institution are refused, not redirected. */}
      <Route
        path="/platform"
        element={
          <RequireAuth roles={['ADMIN']} platform>
            <SuperHome />
          </RequireAuth>
        }
      />
      <Route
        path="/platform/companies"
        element={
          <RequireAuth roles={['ADMIN']} platform>
            <ConsoleCompanies />
          </RequireAuth>
        }
      />
      <Route
        path="/platform/requests"
        element={
          <RequireAuth roles={['ADMIN']} platform>
            <ConsoleRequests />
          </RequireAuth>
        }
      />
      <Route
        path="/platform/reviews"
        element={
          <RequireAuth roles={['ADMIN']} platform>
            <ConsoleReviews />
          </RequireAuth>
        }
      />
      <Route
        path="/platform/data"
        element={
          <RequireAuth roles={['ADMIN']} platform>
            <ConsoleData />
          </RequireAuth>
        }
      />
      {['/platform/new', '/platform/tenants/:id', '/platform/tenants/:id/:step'].map((path) => (
        <Route
          key={path}
          path={path}
          element={
            <RequireAuth roles={['ADMIN']} platform>
              <Onboarding />
            </RequireAuth>
          }
        />
      ))}

      <Route
        path="/admin"
        element={
          <RequireAuth roles={['ADMIN']}>
            <AdminDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/setup"
        element={
          <RequireAuth roles={['ADMIN']}>
            <Setup />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/map-data"
        element={
          <RequireAuth roles={['ADMIN']}>
            <MapDataPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/colleges"
        element={
          <RequireAuth roles={['ADMIN']}>
            <Colleges />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/colleges/:id"
        element={
          <RequireAuth roles={['ADMIN']}>
            <CollegeDetail />
          </RequireAuth>
        }
      />

      {/* The other three roles have no screens yet, but the guard is real -
          signing in as one of them lands here rather than anywhere unprotected. */}
      <Route
        path="/campus"
        element={
          <RequireAuth roles={['CAMPUS']}>
            <CampusDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/campus/programs"
        element={
          <RequireAuth roles={['CAMPUS']}>
            <CampusPrograms />
          </RequireAuth>
        }
      />
      <Route
        path="/campus/batches"
        element={
          <RequireAuth roles={['CAMPUS']}>
            <Batches />
          </RequireAuth>
        }
      />
      <Route
        path="/campus/batches/:id"
        element={
          <RequireAuth roles={['CAMPUS']}>
            <BatchDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/campus/campus-drives"
        element={
          <RequireAuth roles={['CAMPUS']}>
            <CampusDrives />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/companies"
        element={
          <RequireAuth roles={['ADMIN']}>
            <Companies />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/companies/:id"
        element={
          <RequireAuth roles={['ADMIN']}>
            <CompanyDetailPage />
          </RequireAuth>
        }
      />

      <Route
        path="/admin/users"
        element={
          <RequireAuth roles={['ADMIN']}>
            <Users />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/students"
        element={
          <RequireAuth roles={['ADMIN']}>
            <AdminStudents />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/invites"
        element={
          <RequireAuth roles={['ADMIN']}>
            <Invites />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/batches"
        element={
          <RequireAuth roles={['ADMIN']}>
            <AdminBatches />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/batches/:id"
        element={
          <RequireAuth roles={['ADMIN']}>
            <AdminBatchDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/drives"
        element={
          <RequireAuth roles={['ADMIN']}>
            <AdminDrives />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/jobs"
        element={
          <RequireAuth roles={['ADMIN']}>
            <AdminJobs />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/applications"
        element={
          <RequireAuth roles={['ADMIN']}>
            <AdminApplications />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/audit"
        element={
          <RequireAuth roles={['ADMIN']}>
            <Audit />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/roles"
        element={
          <RequireAuth roles={['ADMIN']}>
            <Roles />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/logins"
        element={
          <RequireAuth roles={['ADMIN']}>
            <Logins />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <RequireAuth roles={['ADMIN']}>
            <Settings />
          </RequireAuth>
        }
      />

      <Route
        path="/campus/drives"
        element={
          <RequireAuth roles={['CAMPUS']}>
            <Drives />
          </RequireAuth>
        }
      />
      <Route
        path="/campus/drives/:id"
        element={
          <RequireAuth roles={['CAMPUS']}>
            <DriveDetail />
          </RequireAuth>
        }
      />

      <Route
        path="/campus/requests"
        element={
          <RequireAuth roles={['CAMPUS']}>
            <JobRequests />
          </RequireAuth>
        }
      />
      <Route
        path="/campus/requests/:id"
        element={
          <RequireAuth roles={['CAMPUS']}>
            <JobRequestDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/campus/team"
        element={
          <RequireAuth roles={['CAMPUS']}>
            <CampusTeam />
          </RequireAuth>
        }
      />

      <Route
        path="/campus/counselling"
        element={
          <RequireAuth roles={['CAMPUS']}>
            <CampusCounselling />
          </RequireAuth>
        }
      />

      {/* The student app: Dashboard, Simulations, Jobs. Old student
          addresses from before the rebuild land on the dashboard. */}
      <Route
        path="/student"
        element={
          <RequireAuth roles={['CANDIDATE']}>
            <StudentHome />
          </RequireAuth>
        }
      />
      <Route
        path="/student/simulations"
        element={
          <RequireAuth roles={['CANDIDATE']}>
            <StudentSimulationList />
          </RequireAuth>
        }
      />
      <Route
        path="/student/simulations/:slug"
        element={
          <RequireAuth roles={['CANDIDATE']}>
            <StudentSimulationDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/student/jobs"
        element={
          <RequireAuth roles={['CANDIDATE']}>
            <StudentJobsSoon />
          </RequireAuth>
        }
      />
      <Route
        path="/student/simulations/:slug/tasks/:taskId"
        element={
          <RequireAuth roles={['CANDIDATE']}>
            <StudentTaskPlayer />
          </RequireAuth>
        }
      />
      <Route
        path="/student/profile"
        element={
          <RequireAuth roles={['CANDIDATE']}>
            <StudentProfilePage />
          </RequireAuth>
        }
      />
      <Route path="/student/*" element={<Navigate to="/student" replace />} />

      {/* The company app: simulations, students' work, and work shared with them.
          Old company addresses from before the rebuild land on the overview. */}
      <Route
        path="/company"
        element={
          <RequireAuth roles={['COMPANY']}>
            <CompanyOverview />
          </RequireAuth>
        }
      />
      <Route
        path="/company/simulations"
        element={
          <RequireAuth roles={['COMPANY']}>
            <CompanySimulationList />
          </RequireAuth>
        }
      />
      <Route
        path="/company/simulations/new"
        element={
          <RequireAuth roles={['COMPANY']}>
            <CompanySimulationEditor />
          </RequireAuth>
        }
      />
      <Route
        path="/company/simulations/:id"
        element={
          <RequireAuth roles={['COMPANY']}>
            <CompanySimulationEditor />
          </RequireAuth>
        }
      />
      <Route
        path="/company/reviews"
        element={
          <RequireAuth roles={['COMPANY']}>
            <CompanyReviews />
          </RequireAuth>
        }
      />
      <Route
        path="/company/shared"
        element={
          <RequireAuth roles={['COMPANY']}>
            <CompanyShared />
          </RequireAuth>
        }
      />
      <Route path="/company/*" element={<Navigate to="/company" replace />} />

      <Route path="/signup" element={<GetStarted />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function ComingSoon({ role }: { role: string }) {
  return (
    <main className="status-page">
      <p className="eyebrow">{role}</p>
      <h1>Your dashboard is not built yet.</h1>
      <p className="status-lede">
        Sign-in works and your role is recognised. This area arrives with the next milestone.
      </p>
      <p className="status-back">
        <Link to="/">← Back to the site</Link>
      </p>
    </main>
  );
}

/**
 * Who can create an account, and how. There is exactly one open door - a
 * company registering itself - and everyone else arrives by invitation, so
 * this page routes people rather than pretending there is one signup for all.
 */
function GetStarted() {
  return (
    <main className="status-page">
      <p className="eyebrow">Accounts</p>
      <h1>How you get an account.</h1>
      <p className="status-lede">
        It depends on who you are. Only companies sign themselves up; everyone else is invited by
        the college or company they belong to.
      </p>

      <div className="paths">
        <section className="path">
          <h2>You are hiring</h2>
          <p>
            Register your company. You can draft roles straight away; the Apli.ai team verifies the
            registration before anything reaches a student.
          </p>
          <Link to="/register/company" className="btn btn-primary">
            Register your company
          </Link>
        </section>

        <section className="path">
          <h2>You are a college</h2>
          <p>
            Your university, or the Apli.ai team, sets up your placement cell and sends the first
            login. Your placement officer adds the rest of the team and the student roster.
          </p>
          <a href="mailto:hello@apli.example" className="btn btn-secondary">
            Ask to be set up
          </a>
        </section>

        <section className="path">
          <h2>You are a student</h2>
          <p>
            Your placement cell adds you to your batch and sends you a link. Nobody else can create
            a student account, which is what makes the roster worth trusting.
          </p>
          <span className="path-note">Ask your placement cell for your link.</span>
        </section>
      </div>

      <p className="status-back">
        <Link to="/login">← Sign in instead</Link>
      </p>
    </main>
  );
}

function NotFound() {
  return (
    <main className="status-page">
      <p className="eyebrow">404</p>
      <h1>No page here.</h1>
      <p className="status-lede">The link may be out of date, or the page may not exist yet.</p>
      <p className="status-back">
        <Link to="/">← Back to the site</Link>
      </p>
    </main>
  );
}
