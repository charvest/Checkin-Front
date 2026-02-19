import { Routes, Route } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";

import LandingPage from "../pages/LandingPage";
import Login from "../pages/Login";
import Signup from "../pages/Signup";
import ForgotPassword from "../pages/ForgotPassword";
import AboutUs from "../pages/AboutUs";
import PrivacyPolicy from "../pages/PrivacyPolicy";

import RequireLoginModal from "./RequireLoginModal";

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

export default function AppRoutes() {
  return (
    <>
      <ScrollToTop />

      <Routes>
        {/* PUBLIC */}
        <Route path="/counselor/dashboard" element={<CounselorDashboard />} />

        <Route element={<MainLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/sign-up" element={<Signup />} />
          <Route path="/forgotpassword" element={<ForgotPassword />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
        </Route>

        {/* APP */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/about-us" element={<AboutUs />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />

          {/* 🔒 Login required — shows modal */}
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

          {/* Public service */}
          <Route path="/services/emergency" element={<Emergency />} />

          <Route path="/profile-settings" element={<ProfileSettings />} />
        </Route>
      </Routes>
    </>
  );
}
