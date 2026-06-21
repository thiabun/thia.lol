import { MotionConfig } from "motion/react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router";
import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { AppShell } from "./components/layout/AppShell";
import { PageLoadingProvider } from "./lib/pageLoading";
import { usePageLoadSignal } from "./lib/pageLoadingContext";
import { useAuth } from "./lib/useAuth";

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
const OnboardingPage = lazy(() =>
  import("./pages/OnboardingPage").then((module) => ({
    default: module.OnboardingPage,
  })),
);
const PostPage = lazy(() =>
  import("./pages/PostPage").then((module) => ({ default: module.PostPage })),
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
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })),
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
      <PageLoadingProvider>
        <AuthLoadingSignal />
        <ScrollToTop />
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<RouteSuspense><HomePage /></RouteSuspense>} />
            <Route path="discover" element={<RouteSuspense><DiscoverPage /></RouteSuspense>} />
            <Route path="search" element={<RouteSuspense><SearchPage /></RouteSuspense>} />
            <Route path="rooms" element={<RouteSuspense><RoomsPage /></RouteSuspense>} />
            <Route path="rooms/:slug" element={<RouteSuspense><RoomPage /></RouteSuspense>} />
            <Route path="chat" element={<RouteSuspense><ChatPage /></RouteSuspense>} />
            <Route path="notifications" element={<RouteSuspense><NotificationsPage /></RouteSuspense>} />
            <Route path="settings" element={<RouteSuspense><SettingsPage /></RouteSuspense>} />
            <Route path="onboarding" element={<RouteSuspense><OnboardingPage /></RouteSuspense>} />
            <Route path=":profileHandle/posts/:postId" element={<RouteSuspense><PostPage /></RouteSuspense>} />
            <Route path="@/:handle" element={<RouteSuspense><ProfilePage /></RouteSuspense>} />
            <Route path="terms" element={<RouteSuspense><TermsPage /></RouteSuspense>} />
            <Route path="privacy" element={<RouteSuspense><PrivacyPage /></RouteSuspense>} />
            <Route path="cookies" element={<RouteSuspense><CookiesPage /></RouteSuspense>} />
            <Route path="community-guidelines" element={<RouteSuspense><CommunityGuidelinesPage /></RouteSuspense>} />
            <Route path="copyright" element={<RouteSuspense><CopyrightPage /></RouteSuspense>} />
            <Route path="moderation" element={<RouteSuspense><ModerationPage /></RouteSuspense>} />
            <Route path="legal" element={<RouteSuspense><LegalIndexPage /></RouteSuspense>} />
            <Route path="legal/contact" element={<RouteSuspense><LegalContactRedirect /></RouteSuspense>} />
            <Route path="studio" element={<Navigate to="/discover" replace />} />
            <Route path="admin" element={<RouteSuspense><AdminPage /></RouteSuspense>} />
            <Route path="login" element={<RouteSuspense><AuthPage mode="login" /></RouteSuspense>} />
            <Route path="register" element={<RouteSuspense><AuthPage mode="register" /></RouteSuspense>} />
            <Route path=":profileHandle" element={<RouteSuspense><ProfileHandleRoute /></RouteSuspense>} />
            <Route path="*" element={<Navigate to="/discover" replace />} />
          </Route>
        </Routes>
      </PageLoadingProvider>
    </MotionConfig>
  );
}

function RouteSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

function AuthLoadingSignal() {
  const { status } = useAuth();

  usePageLoadSignal(status === "loading", "auth");

  return null;
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
