import { MotionConfig } from "motion/react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router";
import { lazy, Suspense, useEffect, useRef, type ReactNode } from "react";
import { AppShell } from "./components/layout/AppShell";
import { captureGrowthAttribution } from "./lib/growthAttribution";

const AdminPage = lazy(() =>
  import("./pages/AdminPage").then((module) => ({ default: module.AdminPage })),
);
const AuthPage = lazy(() =>
  import("./pages/AuthPage").then((module) => ({ default: module.AuthPage })),
);
const ChatPage = lazy(() =>
  import("./pages/ChatPage").then((module) => ({ default: module.ChatPage })),
);
const ConnectionsPage = lazy(() =>
  import("./pages/ConnectionsPage").then((module) => ({
    default: module.ConnectionsPage,
  })),
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
const ShareRenderPostPage = lazy(() =>
  import("./pages/ShareRenderPage").then((module) => ({
    default: module.ShareRenderPostPage,
  })),
);
const ShareRenderProfilePage = lazy(() =>
  import("./pages/ShareRenderPage").then((module) => ({
    default: module.ShareRenderProfilePage,
  })),
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })),
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
const PolicyRoutePage = lazy(() =>
  import("./pages/LegalPage").then((module) => ({
    default: module.PolicyRoutePage,
  })),
);

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ScrollToTop />
      <GrowthAttributionCapture />
      <Routes>
        <Route path="share-render/post/:postId" element={<RouteSuspense fallback={null}><ShareRenderPostPage /></RouteSuspense>} />
        <Route path="share-render/profile/:handle" element={<RouteSuspense fallback={null}><ShareRenderProfilePage /></RouteSuspense>} />
        <Route element={<AppShell />}>
          <Route index element={<RouteSuspense><HomePage /></RouteSuspense>} />
          <Route path="discover" element={<RouteSuspense><DiscoverPage /></RouteSuspense>} />
          <Route path="search" element={<RouteSuspense><SearchPage /></RouteSuspense>} />
          <Route path="rooms" element={<RouteSuspense><RoomsPage /></RouteSuspense>} />
          <Route path="rooms/:slug" element={<RouteSuspense><RoomPage /></RouteSuspense>} />
          <Route path="chat" element={<RouteSuspense><ChatPage /></RouteSuspense>} />
          <Route path="notifications" element={<RouteSuspense><NotificationsPage /></RouteSuspense>} />
          <Route path="settings" element={<RouteSuspense><SettingsPage /></RouteSuspense>} />
          <Route path="settings/connections" element={<RouteSuspense><ConnectionsPage /></RouteSuspense>} />
          <Route path="onboarding" element={<RouteSuspense><OnboardingPage /></RouteSuspense>} />
          <Route path=":profileHandle/posts/:postId" element={<RouteSuspense><PostPage /></RouteSuspense>} />
          <Route path="@/:handle" element={<RouteSuspense><ProfilePage /></RouteSuspense>} />
          <Route path="terms" element={<RouteSuspense><PolicyRoutePage slug="terms" /></RouteSuspense>} />
          <Route path="privacy" element={<RouteSuspense><PolicyRoutePage slug="privacy" /></RouteSuspense>} />
          <Route path="cookies" element={<RouteSuspense><PolicyRoutePage slug="cookies" /></RouteSuspense>} />
          <Route path="community-guidelines" element={<RouteSuspense><PolicyRoutePage slug="community-guidelines" /></RouteSuspense>} />
          <Route path="copyright" element={<RouteSuspense><PolicyRoutePage slug="copyright" /></RouteSuspense>} />
          <Route path="moderation" element={<RouteSuspense><PolicyRoutePage slug="moderation" /></RouteSuspense>} />
          <Route path="data-export" element={<RouteSuspense><PolicyRoutePage slug="data-export" /></RouteSuspense>} />
          <Route path="account-deletion" element={<RouteSuspense><PolicyRoutePage slug="account-deletion" /></RouteSuspense>} />
          <Route path="refunds" element={<RouteSuspense><PolicyRoutePage slug="refunds" /></RouteSuspense>} />
          <Route path="appeals" element={<RouteSuspense><PolicyRoutePage slug="appeals" /></RouteSuspense>} />
          <Route path="safety" element={<RouteSuspense><PolicyRoutePage slug="safety" /></RouteSuspense>} />
          <Route path="content-ownership" element={<RouteSuspense><PolicyRoutePage slug="content-ownership" /></RouteSuspense>} />
          <Route path="no-dark-patterns" element={<RouteSuspense><PolicyRoutePage slug="no-dark-patterns" /></RouteSuspense>} />
          <Route path="monetization-ethics" element={<RouteSuspense><PolicyRoutePage slug="monetization-ethics" /></RouteSuspense>} />
          <Route path="ai-policy" element={<RouteSuspense><PolicyRoutePage slug="ai-policy" /></RouteSuspense>} />
          <Route path="security" element={<RouteSuspense><PolicyRoutePage slug="security" /></RouteSuspense>} />
          <Route path="vulnerability-disclosure" element={<RouteSuspense><PolicyRoutePage slug="vulnerability-disclosure" /></RouteSuspense>} />
          <Route path="transparency" element={<RouteSuspense><PolicyRoutePage slug="transparency" /></RouteSuspense>} />
          <Route path="law-enforcement" element={<RouteSuspense><PolicyRoutePage slug="law-enforcement" /></RouteSuspense>} />
          <Route path="creator-marketplace" element={<RouteSuspense><PolicyRoutePage slug="creator-marketplace" /></RouteSuspense>} />
          <Route path="accessibility" element={<RouteSuspense><PolicyRoutePage slug="accessibility" /></RouteSuspense>} />
          <Route path="incident-response" element={<RouteSuspense><PolicyRoutePage slug="incident-response" /></RouteSuspense>} />
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
    </MotionConfig>
  );
}

function RouteSuspense({
  children,
  fallback = <RouteLoadingFallback />,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}

function RouteLoadingFallback() {
  return (
    <div className="mx-auto w-full max-w-4xl px-1 py-3" role="status">
      <div className="rounded-panel border border-line bg-surface/78 px-3 py-2 text-sm text-muted">
        Loading page.
      </div>
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
  const previousPathnameRef = useRef(pathname);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });

    if (previousPathnameRef.current !== pathname) {
      previousPathnameRef.current = pathname;
      const focusFrame = window.requestAnimationFrame(() => {
        document.getElementById("main-content")?.focus({ preventScroll: true });
      });

      return () => window.cancelAnimationFrame(focusFrame);
    }

    previousPathnameRef.current = pathname;
  }, [pathname]);

  return null;
}

function GrowthAttributionCapture() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    captureGrowthAttribution();
  }, [pathname, search]);

  return null;
}
