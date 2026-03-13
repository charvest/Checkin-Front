import { Routes, Route } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";

import LandingPage from "../pages/LandingPage";
import Login from "../pages/Login";
import Signup from "../pages/Signup";
import ForgotPassword from "../pages/ForgotPassword";
import LoginOtp from "../pages/LoginOtp";
import ResetPassword from "../pages/ResetPassword";
import AboutUs from "../pages/AboutUs";
import PrivacyPolicy from "../pages/PrivacyPolicy";

import RequireLoginModal from "./RequireLoginModal";
import RequireRole from "./RequireRole";

import GuidanceCounseling from "../pages/Services/GuidanceCounseling";
import Request from "../pages/Services/SessionType/Request";
import ViewRequest from "../pages/Services/SessionType/ViewRequest";

import Journal from "../pages/Services/Journal";
import Assessment from "../pages/Services/Assessment";
import Emergency from "../pages/Services/Emergency";

import ScrollToTop from "../components/ScrollToTop";
import Unauthorized from "../pages/Unauthorized";

import ProfileSettings from "../pages/Student/ProfileSettings";
import CounselorDashboard from "../pages/CounselorDashboard/CounselorDashboard";
import AdminDashboard from "../pages/AdminDashboard/AdminDashboard";

export default function AppRoutes() {
  return (
    <>
      <ScrollToTop />

      <Routes>
        {/* ✅ COUNSELOR DASHBOARD (protected) */}
        <Route element={<RequireRole allowedRoles={["Counselor"]} />}>
          <Route path="/counselor/dashboard" element={<CounselorDashboard />} />
        </Route>

        <Route element={<MainLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/sign-up" element={<Signup />} />
          <Route path="/forgotpassword" element={<ForgotPassword />} />
          <Route path="/login-otp" element={<LoginOtp />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
        </Route>

        {/* ✅ ADMIN DASHBOARD (protected) */}
        <Route element={<RequireRole allowedRoles={["Admin"]} />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
        </Route>

        {/* APP (MainLayout pages) */}
        <Route element={<MainLayout />}>
          {/* ✅ Allowed for everyone (including pending/terminated) */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/about-us" element={<AboutUs />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/services/emergency" element={<Emergency />} />

          {/* 🔒 Services: login required + status gate */}
          <Route element={<RequireLoginModal featureName="Guidance Counseling" />}>
            <Route path="/services/counseling" element={<GuidanceCounseling />} />
            <Route path="/services/counseling/request" element={<Request />} />
            <Route path="/services/counseling/requests" element={<ViewRequest />} />
          </Route>

          <Route element={<RequireLoginModal featureName="Mood Tracker Journal" />}>
            <Route path="/services/journal" element={<Journal />} />
          </Route>

          <Route element={<RequireLoginModal featureName="Wellness Check (PHQ-9)" />}>
            <Route path="/services/assessment" element={<Assessment />} />
          </Route>

          {/* 🔒 Profile settings must be blocked for pending/terminated */}
          <Route element={<RequireLoginModal featureName="Profile Settings" />}>
            <Route path="/profile-settings" element={<ProfileSettings />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}
