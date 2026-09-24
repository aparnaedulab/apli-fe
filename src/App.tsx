import { Link, Navigate, Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import TenantLogin from './pages/TenantLogin';
import CampusConsent from './pages/campus/Consent';
import CampusAlumni from './pages/campus/Alumni';
import CampusFlags from './pages/campus/Flags';
import AdminInstitutionRules from './pages/admin/InstitutionRules';
import AdminCompanyAccess from './pages/admin/CompanyAccess';
import CompanyInstitutions from './pages/company/Institutions';
import CompanyProfile from './pages/company/Profile';
import RegisterCompany from './pages/RegisterCompany';
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
import CompanyDashboard from './pages/company/CompanyDashboard';
import CompanyTeam from './pages/company/Team';
import Jobs from './pages/company/Jobs';
import JobEditor from './pages/company/JobEditor';
import Applicants from './pages/company/Applicants';
import CompanyAssessments from './pages/company/Assessments';
import ApplicantDetail from './pages/company/ApplicantDetail';
import AcceptInvite from './pages/AcceptInvite';
import JoinBatch from './pages/JoinBatch';
import CampusDashboard from './pages/campus/CampusDashboard';
import Batches from './pages/campus/Batches';
import BatchDetail from './pages/campus/BatchDetail';
import Drives from './pages/campus/Drives';
import CampusDrives from './pages/campus/CampusDrives';
import DriveInvitations from './pages/company/DriveInvitations';
import DriveDetail from './pages/campus/DriveDetail';
import JobRequests from './pages/campus/JobRequests';
import JobRequestDetail from './pages/campus/JobRequestDetail';
import CampusTeam from './pages/campus/Team';
import StudentDashboard from './pages/student/StudentDashboard';
import StudentProfile from './pages/student/Profile';
import StudentInterviews from './pages/student/Interviews';
import StudentAssessments from './pages/student/Assessments';
import StudentBadges from './pages/student/Badges';
import StudentFeed from './pages/student/Feed';
import StudentCounselling from './pages/student/Counselling';
import StudentGuides from './pages/student/Guides';
import CampusCounselling from './pages/campus/Counselling';
import { StudentJobs, StudentJobDetailPage } from './pages/student/Jobs';
import StudentApplications from './pages/student/Applications';
import RequireAuth from './auth/RequireAuth';
import Console from './pages/platform/Console';
import Onboarding from './pages/platform/Onboarding';
import ConsoleCompanies from './pages/platform/ConsoleCompanies';
import StudentPrivacy from './pages/student/Privacy';
import StudentPrepare from './pages/student/Prepare';
import StudentCompanyPage from './pages/student/CompanyPage';
import CampusReports from './pages/campus/Reports';
import AdminReports from './pages/admin/Reports';
import AdminPulse from './pages/admin/Pulse';
import AdminNotices from './pages/admin/Notices';
import StudentInternships from './pages/student/Internships';
import StudentReadiness from './pages/student/Readiness';
import StudentPractice from './pages/student/Practice';
import StudentMockInterview from './pages/student/MockInterview';
import StudentProjects from './pages/student/Projects';
import StudentPassport from './pages/student/Passport';
import StudentStories from './pages/student/Stories';
import StudentDrivePass from './pages/student/DrivePass';
import CampusInternships from './pages/campus/Internships';
import CampusReadiness from './pages/campus/Readiness';
import CampusStories from './pages/campus/Stories';
import CampusEmployers from './pages/campus/Employers';
import CampusDriveDay from './pages/campus/DriveDay';
import CampusAtRisk from './pages/campus/AtRisk';
import CompanySimulations from './pages/company/Simulations';
import CompanyTalent from './pages/company/Talent';
import MentorReview from './pages/MentorReview';
import CertificateCheck from './pages/CertificateCheck';
import CampusOffers from './pages/campus/Offers';
import StudentAlumni from './pages/student/Alumni';
import CampusPools from './pages/campus/Pools';
import CompanyPools from './pages/company/Pools';
import CampusSkills from './pages/campus/Skills';
import AdminSkillDemand from './pages/admin/SkillDemand';
import CampusMessages from './pages/campus/Messages';
import CompanyMicroProjects from './pages/company/MicroProjects';
import CompanyCampusWeeks from './pages/company/CampusWeeks';
import StudentMicroProjects from './pages/student/MicroProjects';
import StudentCampusWeeks from './pages/student/CampusWeeks';
import CampusCampusWeeks from './pages/campus/CampusWeeks';
import StudentGroupDiscussion from './pages/student/GroupDiscussion';
import StudentWellbeing from './pages/student/Wellbeing';
import StudentSoftSkills from './pages/student/SoftSkills';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      {/* An institution's own address: its branded sign-in and Contact us. */}
      <Route path="/t/:slug" element={<TenantLogin />} />
      <Route path="/register/company" element={<RegisterCompany />} />
      <Route path="/status" element={<Status />} />

      <Route path="/invite/:token" element={<AcceptInvite />} />
      {/* No login: the link or code is the credential. */}
      <Route path="/internship-review/:token" element={<MentorReview />} />
      <Route path="/certificates/:code" element={<CertificateCheck />} />

      {/* Phase 1 - the trust core. Each page checks its own module and says so
          plainly when an institution has it switched off. */}
      {(
        [
          ['/student/privacy', 'CANDIDATE', <StudentPrivacy key="p" />],
          ['/student/prepare', 'CANDIDATE', <StudentPrepare key="pr" />],
          ['/student/companies/:id', 'CANDIDATE', <StudentCompanyPage key="c" />],
          ['/company/profile', 'COMPANY', <CompanyProfile key="cpf" />],
          // The page editor was split in two - words here, links on the
          // dashboard - and is now one screen. Old links still land somewhere.
          ['/company/page', 'COMPANY', <Navigate key="cp" to="/company/profile" replace />],
          ['/campus/reports', 'CAMPUS', <CampusReports key="cr" />],
          ['/admin/pulse', 'ADMIN', <AdminPulse key="apu" />],
          ['/admin/notices', 'ADMIN', <AdminNotices key="ano" />],
          ['/admin/reports', 'ADMIN', <AdminReports key="ar" />],
          // Phase 2
          ['/student/internships', 'CANDIDATE', <StudentInternships key="si" />],
          ['/student/readiness', 'CANDIDATE', <StudentReadiness key="sr" />],
          ['/student/practice', 'CANDIDATE', <StudentPractice key="sp" />],
          ['/student/interview', 'CANDIDATE', <StudentMockInterview key="sm" />],
          ['/student/projects', 'CANDIDATE', <StudentProjects key="sj" />],
          ['/student/passport', 'CANDIDATE', <StudentPassport key="ss" />],
          ['/student/stories', 'CANDIDATE', <StudentStories key="st" />],
          ['/student/drive-pass', 'CANDIDATE', <StudentDrivePass key="sd" />],
          ['/campus/internships', 'CAMPUS', <CampusInternships key="ci" />],
          ['/campus/readiness', 'CAMPUS', <CampusReadiness key="crd" />],
          ['/campus/stories', 'CAMPUS', <CampusStories key="cs" />],
          ['/campus/employers', 'CAMPUS', <CampusEmployers key="ce" />],
          ['/campus/drive-day', 'CAMPUS', <CampusDriveDay key="cd" />],
          ['/campus/at-risk', 'CAMPUS', <CampusAtRisk key="ca" />],
          ['/company/simulations', 'COMPANY', <CompanySimulations key="cm" />],
          ['/company/talent', 'COMPANY', <CompanyTalent key="ct" />],
          // Gaps closed after Phase 3
          ['/campus/consent', 'CAMPUS', <CampusConsent key="ccn" />],
          ['/campus/alumni', 'CAMPUS', <CampusAlumni key="cal" />],
          ['/campus/flags', 'CAMPUS', <CampusFlags key="cfl" />],
          ['/admin/institution-rules', 'ADMIN', <AdminInstitutionRules key="air" />],
          ['/admin/company-access', 'ADMIN', <AdminCompanyAccess key="aca" />],
          ['/company/institutions', 'COMPANY', <CompanyInstitutions key="cin" />],
          // Phase 3
          ['/campus/offers', 'CAMPUS', <CampusOffers key="co" />],
          ['/student/alumni', 'CANDIDATE', <StudentAlumni key="sa" />],
          ['/campus/pools', 'CAMPUS', <CampusPools key="cpo" />],
          ['/company/pools', 'COMPANY', <CompanyPools key="cpl" />],
          ['/campus/skills', 'CAMPUS', <CampusSkills key="csk" />],
          ['/admin/skill-demand', 'ADMIN', <AdminSkillDemand key="ask" />],
          ['/campus/messages', 'CAMPUS', <CampusMessages key="cms" />],
          ['/company/micro-projects', 'COMPANY', <CompanyMicroProjects key="cmp" />],
          ['/company/campus-weeks', 'COMPANY', <CompanyCampusWeeks key="ccw" />],
          ['/student/micro-projects', 'CANDIDATE', <StudentMicroProjects key="smp" />],
          ['/student/events', 'CANDIDATE', <StudentCampusWeeks key="scw" />],
          // What it was called when only companies could put one on.
          ['/student/campus-weeks', 'CANDIDATE', <Navigate key="scwo" to="/student/events" replace />],
          ['/campus/events', 'CAMPUS', <CampusCampusWeeks key="caw" />],
          ['/campus/campus-weeks', 'CAMPUS', <Navigate key="cawo" to="/campus/events" replace />],
          ['/student/gd', 'CANDIDATE', <StudentGroupDiscussion key="sgd" />],
          ['/student/wellbeing', 'CANDIDATE', <StudentWellbeing key="swb" />],
          ['/student/soft-skills', 'CANDIDATE', <StudentSoftSkills key="sss" />],
        ] as const
      ).map(([path, role, page]) => (
        <Route key={path} path={path} element={<RequireAuth roles={[role]}>{page}</RequireAuth>} />
      ))}
      <Route path="/join/:code" element={<JoinBatch />} />

      {/* The platform console: onboarding institutions. Operations accounts
          that belong to an institution are refused, not redirected. */}
      <Route
        path="/platform"
        element={
          <RequireAuth roles={['ADMIN']} platform>
            <Console />
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
        path="/company"
        element={
          <RequireAuth roles={['COMPANY']}>
            <CompanyDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/company/jobs"
        element={
          <RequireAuth roles={['COMPANY']}>
            <Jobs />
          </RequireAuth>
        }
      />
      <Route
        path="/company/invitations"
        element={
          <RequireAuth roles={['COMPANY']}>
            <DriveInvitations />
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
        path="/company/jobs/:id"
        element={
          <RequireAuth roles={['COMPANY']}>
            <JobEditor />
          </RequireAuth>
        }
      />
      <Route
        path="/company/applicants"
        element={
          <RequireAuth roles={['COMPANY']}>
            <Applicants />
          </RequireAuth>
        }
      />
      <Route
        path="/company/assessments"
        element={
          <RequireAuth roles={['COMPANY']}>
            <CompanyAssessments />
          </RequireAuth>
        }
      />
      <Route
        path="/company/applicants/:id"
        element={
          <RequireAuth roles={['COMPANY']}>
            <ApplicantDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/company/team"
        element={
          <RequireAuth roles={['COMPANY']}>
            <CompanyTeam />
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
        path="/student"
        element={
          <RequireAuth roles={['CANDIDATE']}>
            <StudentDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/student/profile"
        element={
          <RequireAuth roles={['CANDIDATE']}>
            <StudentProfile />
          </RequireAuth>
        }
      />
      <Route
        path="/student/resume"
        element={
          <RequireAuth roles={['CANDIDATE']}>
            <StudentProfile focus="resume" />
          </RequireAuth>
        }
      />
      {/* The showcase is the profile seen from the recruiter's side, so it is
          a tab of the profile rather than a page somebody has to find. */}
      <Route
        path="/student/showcase"
        element={
          <RequireAuth roles={['CANDIDATE']}>
            <StudentProfile focus="showcase" />
          </RequireAuth>
        }
      />
      <Route
        path="/student/interviews"
        element={
          <RequireAuth roles={['CANDIDATE']}>
            <StudentInterviews />
          </RequireAuth>
        }
      />
      <Route
        path="/student/assessments"
        element={
          <RequireAuth roles={['CANDIDATE']}>
            <StudentAssessments />
          </RequireAuth>
        }
      />
      <Route
        path="/student/badges"
        element={
          <RequireAuth roles={['CANDIDATE']}>
            <StudentBadges />
          </RequireAuth>
        }
      />
      <Route
        path="/student/feed"
        element={
          <RequireAuth roles={['CANDIDATE']}>
            <StudentFeed />
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
      <Route
        path="/student/counselling"
        element={
          <RequireAuth roles={['CANDIDATE']}>
            <StudentCounselling />
          </RequireAuth>
        }
      />

      {/*
        Guides was the last of the sections that said "not here yet". It now
        says the three things it promised: what each round tests, what a good
        resume and answer look like, and what you are owed in an offer.

        `ComingSoon` is kept for the next section that is on the menu before it
        is built - the menu should still show the shape of the thing.
      */}
      <Route
        path="/student/guides"
        element={
          <RequireAuth roles={['CANDIDATE']}>
            <StudentGuides />
          </RequireAuth>
        }
      />


      <Route
        path="/student/jobs"
        element={
          <RequireAuth roles={['CANDIDATE']}>
            <StudentJobs />
          </RequireAuth>
        }
      />
      <Route
        path="/student/jobs/:id"
        element={
          <RequireAuth roles={['CANDIDATE']}>
            <StudentJobDetailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/student/applications"
        element={
          <RequireAuth roles={['CANDIDATE']}>
            <StudentApplications />
          </RequireAuth>
        }
      />

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
