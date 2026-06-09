import { MotionConfig } from "motion/react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router";
import { useEffect } from "react";
import { AppShell } from "./components/layout/AppShell";
import { AdminPage } from "./pages/AdminPage";
import { AuthPage } from "./pages/AuthPage";
import { DiscoverPage } from "./pages/DiscoverPage";
import { HomePage } from "./pages/HomePage";
import { ProfilePage } from "./pages/ProfilePage";
import { RoomsPage } from "./pages/RoomsPage";

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ScrollToTop />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="discover" element={<DiscoverPage />} />
          <Route path="rooms" element={<RoomsPage />} />
          <Route path="@/:handle" element={<ProfilePage />} />
          <Route path="studio" element={<Navigate to="/discover" replace />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="login" element={<AuthPage mode="login" />} />
          <Route path="register" element={<AuthPage mode="register" />} />
          <Route path=":profileHandle" element={<ProfileHandleRoute />} />
          <Route path="*" element={<Navigate to="/discover" replace />} />
        </Route>
      </Routes>
    </MotionConfig>
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
