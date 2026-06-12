import { MotionConfig } from "motion/react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router";
import { lazy, Suspense, useEffect } from "react";
import { AppShell } from "./components/layout/AppShell";

const AdminPage = lazy(() =>
  import("./pages/AdminPage").then((module) => ({ default: module.AdminPage })),
);
const AuthPage = lazy(() =>
  import("./pages/AuthPage").then((module) => ({ default: module.AuthPage })),
);
const ChatPage = lazy(() =>
  import("./pages/ChatPage").then((module) => ({ default: module.ChatPage })),
);
const DiscoverPage = lazy(() =>
  import("./pages/DiscoverPage").then((module) => ({
    default: module.DiscoverPage,
  })),
);
const HomePage = lazy(() =>
  import("./pages/HomePage").then((module) => ({ default: module.HomePage })),
);
const NotificationsPage = lazy(() =>
  import("./pages/NotificationsPage").then((module) => ({
    default: module.NotificationsPage,
  })),
);
const ProfilePage = lazy(() =>
  import("./pages/ProfilePage").then((module) => ({ default: module.ProfilePage })),
);
const RoomPage = lazy(() =>
  import("./pages/RoomPage").then((module) => ({ default: module.RoomPage })),
);
const RoomsPage = lazy(() =>
  import("./pages/RoomsPage").then((module) => ({ default: module.RoomsPage })),
);
const SearchPage = lazy(() =>
  import("./pages/SearchPage").then((module) => ({ default: module.SearchPage })),
);
const CommunityGuidelinesPage = lazy(() =>
  import("./pages/LegalPage").then((module) => ({
    default: module.CommunityGuidelinesPage,
  })),
);
const CookiesPage = lazy(() =>
  import("./pages/LegalPage").then((module) => ({ default: module.CookiesPage })),
);
const CopyrightPage = lazy(() =>
  import("./pages/LegalPage").then((module) => ({
    default: module.CopyrightPage,
  })),
);
const LegalContactRedirect = lazy(() =>
  import("./pages/LegalPage").then((module) => ({
    default: module.LegalContactRedirect,
  })),
);
const LegalIndexPage = lazy(() =>
  import("./pages/LegalPage").then((module) => ({
    default: module.LegalIndexPage,
  })),
);
const ModerationPage = lazy(() =>
  import("./pages/LegalPage").then((module) => ({
    default: module.ModerationPage,
  })),
);
const PrivacyPage = lazy(() =>
  import("./pages/LegalPage").then((module) => ({ default: module.PrivacyPage })),
);
const TermsPage = lazy(() =>
  import("./pages/LegalPage").then((module) => ({ default: module.TermsPage })),
);

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ScrollToTop />
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="discover" element={<DiscoverPage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="rooms" element={<RoomsPage />} />
            <Route path="rooms/:slug" element={<RoomPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="@/:handle" element={<ProfilePage />} />
            <Route path="terms" element={<TermsPage />} />
            <Route path="privacy" element={<PrivacyPage />} />
            <Route path="cookies" element={<CookiesPage />} />
            <Route path="community-guidelines" element={<CommunityGuidelinesPage />} />
            <Route path="copyright" element={<CopyrightPage />} />
            <Route path="moderation" element={<ModerationPage />} />
            <Route path="legal" element={<LegalIndexPage />} />
            <Route path="legal/contact" element={<LegalContactRedirect />} />
            <Route path="studio" element={<Navigate to="/discover" replace />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="login" element={<AuthPage mode="login" />} />
            <Route path="register" element={<AuthPage mode="register" />} />
            <Route path=":profileHandle" element={<ProfileHandleRoute />} />
            <Route path="*" element={<Navigate to="/discover" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </MotionConfig>
  );
}

function RouteLoading() {
  return (
    <div className="min-h-dvh bg-canvas px-4 py-8 text-sm text-muted">
      Loading thia.lol.
    </div>
  );
}

function ProfileHandleRoute() {
  const { profileHandle = "" } = useParams();

  if (profileHandle.startsWith("@")) {
    return <ProfilePage />;
  }

  return <Navigate to="/discover" replace />;
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
