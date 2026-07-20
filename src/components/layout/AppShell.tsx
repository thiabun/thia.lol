import {
  Bell,
  Compass,
  FileText,
  Home,
  LogIn,
  LogOut,
  Menu,
  MessageCircle,
  PenLine,
  Radio,
  Search,
  Settings,
  Shield,
  Sparkles,
  UserRound,
  UserPlus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactNode } from "react";
import { Link, NavLink, Outlet, matchPath, useLocation, useNavigate } from "react-router";
import { BrandLogo, BrandMark } from "../BrandLogo";
import { ThemeToggle } from "../ThemeToggle";
import { ProfilePersonalBackdrop } from "../social/ProfilePersonalBackdrop";
import { Button, ButtonLink } from "../ui/Button";
import { CoffeeSupport } from "./CoffeeSupport";
import { StrokeJokePopup } from "./StrokeJokePopup";
import { WhatsNewModal } from "./WhatsNewModal";
import { getNotifications, getOnboardingState, getRooms } from "../../lib/api";
import { cn } from "../../lib/classNames";
import { desktopNotificationSupport, ensureNotificationServiceWorkerRegistration } from "../../lib/desktopNotifications";
import {
  buttonTap,
  popoverPanel,
  snappySpring,
} from "../../lib/motionPresets";
import { emitPostCreated } from "../../lib/postEvents";
import { notificationsUpdatedEventName } from "../../lib/notificationEvents";
import {
  applyProfileThemeToRoot,
  clearProfileThemeFromRoot,
  normalizeProfileThemeConfig,
} from "../../lib/profileThemes";
import { profileCanvasGlassTreatment } from "../../lib/profileVisualTreatments";
import { useAuth } from "../../lib/useAuth";
import { useTheme } from "../../lib/useTheme";
import type { Room } from "../../lib/types";
import {
  hasSeenCurrentWhatsNewRelease,
  markCurrentWhatsNewReleaseSeen,
} from "../../lib/whatsNew";

const PostComposerModal = lazy(() =>
  import("../social/PostComposerModal").then((module) => ({
    default: module.PostComposerModal,
  })),
);

const publicNavItems = [
  { to: "/", label: "Home", icon: Home },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/search", label: "Search", icon: Search },
  { to: "/rooms", label: "Rooms", icon: Radio },
  { to: "/chat", label: "Chat", icon: MessageCircle },
];

const legalLinks = [
  { to: "/legal", label: "Trust Center" },
  { to: "/terms", label: "Terms" },
  { to: "/privacy", label: "Privacy" },
  { to: "/community-guidelines", label: "Guidelines" },
];

const bugReportUrl =
  "https://github.com/thiabun/thia.lol/issues/new?template=bug_report.yml";
const supportUrl = "https://ko-fi.com/thiabun";

const cookieNoticeStorageKey = "thia_cookie_notice_ack";
const whatsNewAutoOpenDelayMs = 600;
const whatsNewAutoOpenPaths = new Set(["/", "/discover", "/rooms", "/search"]);
const focusedShellPaths = new Set(["/login", "/register", "/onboarding"]);
type ShellOverlay = "coffee" | "composer" | "stroke-joke" | "whats-new" | null;
type OpenWhatsNew = (returnFocusTo?: HTMLElement | null) => void;
type WhatsNewAudienceId = number | "anonymous";
type OnboardingGateState = Awaited<ReturnType<typeof getOnboardingState>>;

function cookieNoticeShouldShow(): boolean {
  try {
    return window.localStorage.getItem(cookieNoticeStorageKey) !== "1";
  } catch {
    return true;
  }
}

function profileOnboardingGateShouldSkip(
  pathname: string,
  search: string,
  userHandle?: string,
): boolean {
  if (
    pathname === "/onboarding" ||
    pathname === "/login" ||
    pathname === "/register"
  ) {
    return true;
  }

  if (userHandle) {
    const normalizedPathname = pathname.replace(/\/+$/, "").toLowerCase();
    const normalizedUserHandle = userHandle.toLowerCase();

    if (
      normalizedPathname === `/@${normalizedUserHandle}` ||
      normalizedPathname === `/@/${normalizedUserHandle}`
    ) {
      return true;
    }
  }

  const params = new URLSearchParams(search);

  return Boolean(params.get("integrationProvider") || params.get("integrationStatus"));
}

function profileOnboardingStateNeedsVisit(state: OnboardingGateState): boolean {
  if (state.finishedAt || state.dismissedAt) {
    return false;
  }

  const handled = new Set([...state.completedSteps, ...state.skippedSteps]);

  return state.steps.some((step) => !handled.has(step));
}

function profileThemeControlsShouldDisable(pathname: string): boolean {
  const directProfile = matchPath({ path: "/:profileHandle", end: true }, pathname);

  if (directProfile?.params.profileHandle?.startsWith("@")) {
    return true;
  }

  const postPermalink = matchPath(
    { path: "/:profileHandle/posts/:postId", end: true },
    pathname,
  );

  if (postPermalink?.params.profileHandle?.startsWith("@")) {
    return true;
  }

  if (matchPath({ path: "/rooms/:slug", end: true }, pathname)) {
    return true;
  }

  return Boolean(
    matchPath({ path: "/@/:handle", end: true }, pathname) ||
      matchPath({ path: "/@/:handle/posts/:postId", end: true }, pathname),
  );
}

export type AppShellOutletContext = {
  openPostComposer: (roomSlug?: string) => void;
  setMobileDockHidden: (hidden: boolean) => void;
  setTopBarAction: (action: ReactNode | undefined) => void;
};

export function AppShell() {
  const { csrfToken, profile, status, user } = useAuth();
  const { themePreference } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeShellOverlay, setActiveShellOverlay] =
    useState<ShellOverlay>(null);
  const [composerActivated, setComposerActivated] = useState(false);
  const [composerRoomSlug, setComposerRoomSlug] = useState<string | undefined>();
  const [composerRooms, setComposerRooms] = useState<Room[]>([]);
  const [composerRoomsLoaded, setComposerRoomsLoaded] = useState(false);
  const [composerKey, setComposerKey] = useState(0);
  const [cookieNoticeVisible, setCookieNoticeVisible] = useState(
    cookieNoticeShouldShow,
  );
  const [whatsNewPromptedAudienceIds, setWhatsNewPromptedAudienceIds] =
    useState<ReadonlySet<WhatsNewAudienceId>>(() => new Set());
  const [whatsNewDismissedAudienceIds, setWhatsNewDismissedAudienceIds] =
    useState<ReadonlySet<WhatsNewAudienceId>>(() => new Set());
  const [whatsNewShownThisSession, setWhatsNewShownThisSession] =
    useState(false);
  const [onboardingGateCheckedUserIds, setOnboardingGateCheckedUserIds] =
    useState<ReadonlySet<number>>(() => new Set());
  const whatsNewReturnFocusRef = useRef<HTMLElement | null>(null);
  const [mobileDockHidden, setMobileDockHidden] = useState(false);
  const [topBarAction, setTopBarAction] = useState<ReactNode | undefined>();
  const [notificationUnreadCount, setNotificationUnreadCount] = useState<
    number | undefined
  >();
  const composerOpen = activeShellOverlay === "composer";
  const coffeeSupportOpen = activeShellOverlay === "coffee";
  const whatsNewOpen = activeShellOverlay === "whats-new";
  const whatsNewAudienceId: WhatsNewAudienceId = user?.id ?? "anonymous";
  const whatsNewPrompted = whatsNewPromptedAudienceIds.has(whatsNewAudienceId);
  const whatsNewSeen =
    whatsNewDismissedAudienceIds.has(whatsNewAudienceId) ||
    hasSeenCurrentWhatsNewRelease(user?.id);
  const postingDisabled = status === "loading";
  const anonymousHome = status === "anonymous" && location.pathname === "/";
  const focusedShellRoute = focusedShellPaths.has(
    location.pathname.replace(/\/+$/, "").toLowerCase() || "/",
  );
  const mobileShellControlsHidden = mobileDockHidden || focusedShellRoute;
  const currentRoomSlug = matchPath(
    { path: "/rooms/:slug", end: true },
    location.pathname,
  )?.params.slug;
  const authorThemeControlsDisabled = profileThemeControlsShouldDisable(
    location.pathname,
  );
  const profileThemeAvailable = status === "authenticated";
  const siteProfileThemeActive =
    profileThemeAvailable &&
    themePreference === "profile" &&
    !authorThemeControlsDisabled;
  const signedInProfileThemeConfig = useMemo(
    () =>
      siteProfileThemeActive
        ? normalizeProfileThemeConfig(profile?.profileThemeConfig)
        : null,
    [profile?.profileThemeConfig, siteProfileThemeActive],
  );
  const profileGlass = profileCanvasGlassTreatment(profile?.profileCanvasGlass);
  const siteProfileThemeStyle = siteProfileThemeActive
    ? ({
        "--site-profile-canvas-alpha": `${profileGlass.canvasSurfacePercent}%`,
        "--site-profile-module-alpha": `${profileGlass.moduleSurfacePercent}%`,
      } as CSSProperties)
    : undefined;

  const openWhatsNew = useCallback(
    (returnFocusTo: HTMLElement | null = null) => {
      whatsNewReturnFocusRef.current = returnFocusTo;
      setWhatsNewPromptedAudienceIds((current) => {
        const next = new Set(current);
        next.add(whatsNewAudienceId);
        return next;
      });
      setWhatsNewShownThisSession(true);
      setActiveShellOverlay("whats-new");
    },
    [whatsNewAudienceId],
  );

  const closeWhatsNew = useCallback(() => {
    markCurrentWhatsNewReleaseSeen(user?.id);
    setWhatsNewDismissedAudienceIds((current) => {
      const next = new Set(current);
      next.add(whatsNewAudienceId);
      return next;
    });
    setActiveShellOverlay((current) =>
      current === "whats-new" ? null : current,
    );
  }, [user?.id, whatsNewAudienceId]);

  const handleCoffeeSupportOpenChange = useCallback((open: boolean) => {
    setActiveShellOverlay((current) => {
      if (open) {
        return current === null || current === "coffee" ? "coffee" : current;
      }

      return current === "coffee" ? null : current;
    });
  }, []);

  const handleStrokeJokeOpenChange = useCallback((open: boolean) => {
    setActiveShellOverlay((current) => {
      if (open) {
        return current === null || current === "stroke-joke"
          ? "stroke-joke"
          : current;
      }

      return current === "stroke-joke" ? null : current;
    });
  }, []);

  const closeComposer = useCallback(() => {
    setActiveShellOverlay((current) =>
      current === "composer" ? null : current,
    );
  }, []);

  useEffect(() => {
    const normalizedPathname =
      location.pathname === "/"
        ? "/"
        : location.pathname.replace(/\/+$/, "").toLowerCase();

    if (
      status !== "authenticated" ||
      !user ||
      !onboardingGateCheckedUserIds.has(user.id) ||
      whatsNewSeen ||
      whatsNewPrompted ||
      cookieNoticeVisible ||
      activeShellOverlay !== null ||
      !whatsNewAutoOpenPaths.has(normalizedPathname)
    ) {
      return;
    }

    let timer: number | undefined;
    const openWhenPageIsClear = () => {
      if (document.querySelector("[role='dialog'][aria-modal='true']")) {
        timer = window.setTimeout(openWhenPageIsClear, 250);
        return;
      }

      openWhatsNew();
    };

    timer = window.setTimeout(openWhenPageIsClear, whatsNewAutoOpenDelayMs);

    return () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [
    activeShellOverlay,
    cookieNoticeVisible,
    location.pathname,
    onboardingGateCheckedUserIds,
    openWhatsNew,
    status,
    user,
    whatsNewPrompted,
    whatsNewSeen,
  ]);

  useLayoutEffect(() => {
    const root = document.documentElement;

    if (siteProfileThemeActive) {
      root.dataset.siteProfileTheme = "true";
      root.style.setProperty(
        "--site-profile-canvas-alpha",
        `${profileGlass.canvasSurfacePercent}%`,
      );
      root.style.setProperty(
        "--site-profile-module-alpha",
        `${profileGlass.moduleSurfacePercent}%`,
      );
    } else {
      delete root.dataset.siteProfileTheme;
      root.style.removeProperty("--site-profile-canvas-alpha");
      root.style.removeProperty("--site-profile-module-alpha");
    }

    return () => {
      delete root.dataset.siteProfileTheme;
      root.style.removeProperty("--site-profile-canvas-alpha");
      root.style.removeProperty("--site-profile-module-alpha");
    };
  }, [
    profileGlass.canvasSurfacePercent,
    profileGlass.moduleSurfacePercent,
    siteProfileThemeActive,
  ]);

  useEffect(() => {
    if (authorThemeControlsDisabled) {
      return undefined;
    }

    if (signedInProfileThemeConfig) {
      return applyProfileThemeToRoot(signedInProfileThemeConfig);
    }

    clearProfileThemeFromRoot();
    return undefined;
  }, [authorThemeControlsDisabled, signedInProfileThemeConfig]);

  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;

    const syncVisualViewport = () => {
      root.style.setProperty(
        "--app-visual-viewport-height",
        `${viewport?.height ?? window.innerHeight}px`,
      );
      root.style.setProperty(
        "--app-visual-viewport-top",
        `${viewport?.offsetTop ?? 0}px`,
      );
    };

    syncVisualViewport();
    window.addEventListener("resize", syncVisualViewport, { passive: true });
    viewport?.addEventListener("resize", syncVisualViewport, { passive: true });
    viewport?.addEventListener("scroll", syncVisualViewport, { passive: true });

    return () => {
      window.removeEventListener("resize", syncVisualViewport);
      viewport?.removeEventListener("resize", syncVisualViewport);
      viewport?.removeEventListener("scroll", syncVisualViewport);
      root.style.removeProperty("--app-visual-viewport-height");
      root.style.removeProperty("--app-visual-viewport-top");
    };
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !user) {
      return undefined;
    }

    if (onboardingGateCheckedUserIds.has(user.id)) {
      return undefined;
    }

    if (profileOnboardingGateShouldSkip(location.pathname, location.search, user.handle)) {
      return undefined;
    }

    let active = true;

    getOnboardingState()
      .then((state) => {
        if (!active) {
          return;
        }

        if (profileOnboardingStateNeedsVisit(state)) {
          setWhatsNewPromptedAudienceIds((current) => {
            const next = new Set(current);
            next.delete(user.id);
            return next;
          });
          setActiveShellOverlay((current) =>
            current === "whats-new" ? null : current,
          );
          navigate("/onboarding", { replace: true });
          return;
        }

        setOnboardingGateCheckedUserIds((current) => {
          const next = new Set(current);
          next.add(user.id);
          return next;
        });
      })
      .catch(() => {
        if (active) {
          setOnboardingGateCheckedUserIds((current) => {
            const next = new Set(current);
            next.add(user.id);
            return next;
          });
        }
      });

    return () => {
      active = false;
    };
  }, [
    location.pathname,
    location.search,
    navigate,
    onboardingGateCheckedUserIds,
    status,
    user,
  ]);

  useEffect(() => {
    if (
      !import.meta.env.PROD ||
      status !== "authenticated" ||
      !desktopNotificationSupport().supported
    ) {
      return;
    }

    void ensureNotificationServiceWorkerRegistration().catch(() => {
      // Registration is retried from the explicit opt-in controls.
    });
  }, [status]);

  useEffect(() => {
    let active = true;

    if (status !== "authenticated") {
      queueMicrotask(() => {
        if (active) {
          setNotificationUnreadCount(undefined);
        }
      });

      return () => {
        active = false;
      };
    }

    getNotifications()
      .then((result) => {
        if (active) {
          setNotificationUnreadCount(result.unreadCount);
        }
      })
      .catch(() => {
        if (active) {
          setNotificationUnreadCount(undefined);
        }
      });

    return () => {
      active = false;
    };
  }, [status, user?.id]);

  useEffect(() => {
    function handleNotificationsUpdated(event: Event) {
      const detail = (event as CustomEvent<{ unreadCount?: number }>).detail;

      if (typeof detail?.unreadCount === "number") {
        setNotificationUnreadCount(detail.unreadCount);
      }
    }

    window.addEventListener(
      notificationsUpdatedEventName,
      handleNotificationsUpdated,
    );

    return () => {
      window.removeEventListener(
        notificationsUpdatedEventName,
        handleNotificationsUpdated,
      );
    };
  }, []);

  useEffect(() => {
    if (
      !composerOpen ||
      status !== "authenticated" ||
      composerRoomsLoaded
    ) {
      return;
    }

    let active = true;

    getRooms()
      .then((rooms) => {
        if (active) {
          setComposerRooms(rooms.filter((room) => room.viewerCanPost));
          setComposerRoomsLoaded(true);
        }
      })
      .catch(() => {
        if (active) {
          setComposerRooms([]);
        }
      });

    return () => {
      active = false;
    };
  }, [composerOpen, composerRoomsLoaded, status]);

  function openPostComposer(roomSlug?: string) {
    if (status === "authenticated" && user && csrfToken) {
      setComposerRoomSlug(roomSlug);
      setComposerKey((current) => current + 1);
      setComposerActivated(true);
      setActiveShellOverlay("composer");
      return;
    }

    navigate("/login");
  }

  function handlePostClick() {
    openPostComposer(currentRoomSlug);
  }

  return (
    <div
      className="relative isolate min-h-dvh min-w-0 max-w-full bg-canvas text-text"
      data-site-profile-canvas-glass={
        siteProfileThemeActive ? profileGlass.normalizedGlass : undefined
      }
      data-site-profile-theme={siteProfileThemeActive ? "true" : undefined}
      style={siteProfileThemeStyle}
    >
      {siteProfileThemeActive && profile ? (
        <>
          <ProfilePersonalBackdrop profile={profile} siteWide />
          <div
            aria-hidden="true"
            className="site-profile-canvas-wash pointer-events-none fixed inset-0 z-[1]"
          />
        </>
      ) : (
        <div className="fixed inset-0 z-0 bg-page-wash" />
      )}
      <div className="relative z-10 flex min-h-dvh min-w-0 max-w-full flex-col">
        <a
          href="#main-content"
          className="fixed left-3 top-3 z-[70] -translate-y-24 rounded-control bg-text px-3 py-2 text-sm font-semibold text-canvas shadow-lift transition focus:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Skip to content
        </a>
        <SiteHeader
          anonymousHome={anonymousHome}
          navItems={publicNavItems}
          notificationUnreadCount={notificationUnreadCount}
          onWhatsNewOpen={openWhatsNew}
          profileThemeAvailable={profileThemeAvailable}
          showNotifications={status === "authenticated"}
          themeControlsDisabled={authorThemeControlsDisabled}
          themeControlsDisabledReason="Profile theme controls this page"
          topBarAction={topBarAction}
        />
        <CookieNotice
          onDismiss={() => setCookieNoticeVisible(false)}
          visible={cookieNoticeVisible}
        />
        <div className="mx-auto flex min-w-0 w-full max-w-7xl flex-1 flex-col px-3 sm:px-5 lg:px-7">
          <main
            id="main-content"
            tabIndex={-1}
            className={cn(
              "min-w-0 flex-1 pt-3 lg:pb-10 lg:pt-4",
              mobileShellControlsHidden || anonymousHome
                ? "pb-0"
                : "pb-[var(--app-mobile-content-bottom)]",
            )}
          >
            <div className="min-h-full min-w-0">
              <Outlet
                context={
                  {
                    openPostComposer,
                    setMobileDockHidden,
                    setTopBarAction,
                  } satisfies AppShellOutletContext
                }
              />
            </div>
          </main>
          {anonymousHome || focusedShellRoute ? null : (
            <MobileDock
              hidden={mobileDockHidden}
              navItems={publicNavItems}
              onPostClick={handlePostClick}
              postDisabled={postingDisabled}
            />
          )}
        </div>
        <SiteFooter onWhatsNewOpen={openWhatsNew} />
        {anonymousHome || focusedShellRoute ? null : (
          <Button
            type="button"
            className="fixed bottom-6 right-6 z-40 hidden min-h-12 rounded-full px-5 text-base font-semibold shadow-lift ring-2 ring-accent/25 lg:inline-flex"
            disabled={postingDisabled}
            icon={<PenLine aria-hidden="true" size={20} />}
            onClick={handlePostClick}
            data-testid="desktop-post-action"
          >
            Post
          </Button>
        )}
        {anonymousHome ? null : (
          <CoffeeSupport
            mobileHidden={mobileShellControlsHidden}
            onOpenChange={handleCoffeeSupportOpenChange}
            open={coffeeSupportOpen}
          />
        )}
        {composerActivated ? (
          <Suspense fallback={composerOpen ? <ComposerLoadingNotice /> : null}>
            <PostComposerModal
              key={composerKey}
              csrfToken={csrfToken}
              initialRoomSlug={composerRoomSlug}
              onClose={closeComposer}
              onCreated={emitPostCreated}
              open={composerOpen}
              rooms={composerRooms}
            />
          </Suspense>
        ) : null}
        <WhatsNewModal
          onClose={closeWhatsNew}
          open={whatsNewOpen}
          returnFocusRef={whatsNewReturnFocusRef}
        />
        <StrokeJokePopup
          blocked={
            cookieNoticeVisible ||
            whatsNewShownThisSession ||
            (activeShellOverlay !== null && activeShellOverlay !== "stroke-joke")
          }
          onOpenChange={handleStrokeJokeOpenChange}
          open={activeShellOverlay === "stroke-joke"}
          pathname={location.pathname}
        />
      </div>
    </div>
  );
}

function ComposerLoadingNotice() {
  return (
    <div
      className="site-profile-glass-surface fixed inset-x-4 bottom-20 z-50 mx-auto max-w-xs rounded-panel border border-line bg-surface/96 px-3 py-2 text-sm text-muted shadow-soft lg:bottom-5 lg:right-5 lg:left-auto"
      role="status"
    >
      Opening composer.
    </div>
  );
}

function SiteHeader({
  anonymousHome,
  navItems,
  notificationUnreadCount,
  onWhatsNewOpen,
  profileThemeAvailable,
  showNotifications,
  themeControlsDisabled,
  themeControlsDisabledReason,
  topBarAction,
}: {
  anonymousHome: boolean;
  navItems: NavItemProps[];
  notificationUnreadCount: number | undefined;
  onWhatsNewOpen: OpenWhatsNew;
  profileThemeAvailable: boolean;
  showNotifications: boolean;
  themeControlsDisabled: boolean;
  themeControlsDisabledReason: string;
  topBarAction?: ReactNode | undefined;
}) {
  if (anonymousHome) {
    return (
      <AnonymousHomeHeader
        onWhatsNewOpen={onWhatsNewOpen}
        themeControlsDisabled={themeControlsDisabled}
        themeControlsDisabledReason={themeControlsDisabledReason}
      />
    );
  }

  return (
    <header className="site-profile-glass-surface sticky top-0 z-40 border-b border-line bg-canvas/86 backdrop-blur-veil">
      <div className="mx-auto flex min-h-14 w-full max-w-7xl items-center gap-2 px-3 sm:px-5 lg:px-7">
        <NavLink
          to="/"
          className="flex min-w-0 shrink-0 items-center rounded-md px-1 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          aria-label="thia.lol home"
        >
          <BrandLogo />
        </NavLink>

        <nav
          className="ml-3 hidden items-center gap-0.5 lg:flex"
          aria-label="Primary"
          data-testid="desktop-nav"
        >
          {navItems.map((item) => (
            <DesktopNavItem key={item.to} {...item} />
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
          {topBarAction ? <div className="shrink-0">{topBarAction}</div> : null}
          <ButtonLink
            to="/search"
            variant="secondary"
            size="icon"
            aria-label="Search"
            title="Search"
            className="lg:hidden"
            icon={<Search aria-hidden="true" size={18} />}
          />
          {showNotifications ? (
            <NotificationBell unreadCount={notificationUnreadCount} />
          ) : null}
          <ThemeToggle
            compact
            disabled={themeControlsDisabled}
            disabledReason={themeControlsDisabledReason}
            profileThemeAvailable={profileThemeAvailable}
          />
          <AccountMenu onWhatsNewOpen={onWhatsNewOpen} />
        </div>
      </div>
    </header>
  );
}

function AnonymousHomeHeader({
  onWhatsNewOpen,
  themeControlsDisabled,
  themeControlsDisabledReason,
}: {
  onWhatsNewOpen: OpenWhatsNew;
  themeControlsDisabled: boolean;
  themeControlsDisabledReason: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <header
      className="site-profile-glass-surface sticky top-0 z-40 border-b border-line bg-canvas/86 backdrop-blur-veil"
      data-testid="anonymous-home-header"
    >
      <div className="mx-auto flex min-h-14 w-full max-w-7xl items-center gap-2 px-3 sm:px-5 lg:px-7">
        <NavLink
          to="/"
          className="flex min-w-0 shrink-0 items-center rounded-md px-1 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          aria-label="thia.lol home"
        >
          <BrandLogo />
        </NavLink>

        <nav
          className="ml-auto hidden items-center gap-1 lg:flex"
          aria-label="Primary"
          data-testid="desktop-nav"
        >
          <ButtonLink to="/discover" variant="ghost" size="sm">
            Discover
          </ButtonLink>
          <ButtonLink to="/rooms" variant="ghost" size="sm">
            Rooms
          </ButtonLink>
          <ButtonLink to="/login" variant="ghost" size="sm">
            Sign in
          </ButtonLink>
          <ButtonLink to="/register" size="sm">
            Create account
          </ButtonLink>
        </nav>

        <div className="hidden lg:block">
          <ThemeToggle
            compact
            disabled={themeControlsDisabled}
            disabledReason={themeControlsDisabledReason}
          />
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-1.5 lg:hidden">
          <ButtonLink
            to="/register"
            size="sm"
            className="min-h-11 shrink-0 px-2 text-xs sm:px-2.5 sm:text-sm"
          >
            Create account
          </ButtonLink>
          <div ref={menuRef} className="relative shrink-0">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              data-anonymous-home-menu-trigger="true"
              aria-label="Open navigation menu"
              aria-controls="anonymous-home-menu"
              aria-expanded={menuOpen}
              aria-haspopup="dialog"
              className="size-11"
              icon={<Menu aria-hidden="true" size={19} />}
              onClick={() => setMenuOpen((current) => !current)}
            />
            <AnimatePresence>
              {menuOpen ? (
                <motion.div
                  id="anonymous-home-menu"
                  variants={popoverPanel}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="site-profile-glass-surface absolute right-0 z-50 mt-2 w-44 origin-top-right rounded-panel border border-line bg-surface/96 p-1 shadow-lift backdrop-blur-veil"
                  aria-label="Navigation and theme"
                  role="dialog"
                  data-testid="anonymous-home-menu"
                >
                  <AccountMenuItem
                    to="/discover"
                    withinMenu={false}
                    onSelect={() => setMenuOpen(false)}
                  >
                    <Compass aria-hidden="true" size={16} />
                    Discover
                  </AccountMenuItem>
                  <AccountMenuItem
                    to="/rooms"
                    withinMenu={false}
                    onSelect={() => setMenuOpen(false)}
                  >
                    <Radio aria-hidden="true" size={16} />
                    Rooms
                  </AccountMenuItem>
                  <AccountMenuItem
                    to="/login"
                    withinMenu={false}
                    onSelect={() => setMenuOpen(false)}
                  >
                    <LogIn aria-hidden="true" size={16} />
                    Sign in
                  </AccountMenuItem>
                  <AccountMenuItem
                    withinMenu={false}
                    onClick={() => {
                      const returnTarget =
                        menuRef.current?.querySelector<HTMLElement>(
                          "[data-anonymous-home-menu-trigger='true']",
                        ) ?? null;

                      setMenuOpen(false);
                      onWhatsNewOpen(returnTarget);
                    }}
                  >
                    <Sparkles aria-hidden="true" size={16} />
                    What’s new
                  </AccountMenuItem>
                  <div
                    className="mt-1 flex items-center justify-between gap-2 border-t border-line px-2 pt-1.5 text-sm font-medium text-muted"
                    role="none"
                  >
                    <span>Theme</span>
                    <ThemeToggle
                      compact
                      disabled={themeControlsDisabled}
                      disabledReason={themeControlsDisabledReason}
                    />
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}

function NotificationBell({ unreadCount }: { unreadCount: number | undefined }) {
  const label =
    unreadCount && unreadCount > 0
      ? `Notifications, ${unreadCount} unread`
      : "Notifications";

  return (
    <ButtonLink
      to="/notifications"
      variant="secondary"
      size="icon"
      aria-label={label}
      title={label}
      className="relative"
      icon={<Bell aria-hidden="true" size={18} />}
    >
      {unreadCount && unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-accent px-1.5 py-0.5 text-center text-[0.65rem] font-semibold leading-none text-accent-ink shadow-soft">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </ButtonLink>
  );
}

function AccountMenu({ onWhatsNewOpen }: { onWhatsNewOpen: OpenWhatsNew }) {
  const { logout, status, user } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isAuthenticated = status === "authenticated" && Boolean(user);
  const isLoading = status === "loading";

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const label = isAuthenticated
    ? `Account menu for @${user?.handle}`
    : "Account menu";

  return (
    <div ref={menuRef} className="relative shrink-0">
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="size-11"
        data-account-menu-trigger="true"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={isLoading}
        title={label}
        icon={
          isAuthenticated ? (
            <UserRound aria-hidden="true" size={18} />
          ) : (
            <LogIn aria-hidden="true" size={18} />
          )
        }
        onClick={() => setOpen((current) => !current)}
      />

      <AnimatePresence>
        {open ? (
          <motion.div
            variants={popoverPanel}
            initial="hidden"
            animate="show"
            exit="exit"
            className="site-profile-glass-surface absolute right-0 z-50 mt-2 w-40 origin-top-right rounded-panel border border-line bg-surface/96 p-1 shadow-lift backdrop-blur-veil sm:w-44"
            role="menu"
            data-testid="account-menu"
          >
            {isAuthenticated && user ? (
              <>
                <AccountMenuItem to={`/@${user.handle}`} onSelect={() => setOpen(false)}>
                  <UserRound aria-hidden="true" size={16} />
                  Profile
                </AccountMenuItem>
                <AccountMenuItem to="/settings" onSelect={() => setOpen(false)}>
                  <Settings aria-hidden="true" size={16} />
                  Settings
                </AccountMenuItem>
                <AccountMenuItem
                  onClick={() => {
                    const returnTarget =
                      menuRef.current?.querySelector<HTMLElement>(
                        "[data-account-menu-trigger='true']",
                      ) ?? null;

                    setOpen(false);
                    onWhatsNewOpen(returnTarget);
                  }}
                >
                  <Sparkles aria-hidden="true" size={16} />
                  What’s new
                </AccountMenuItem>
                <AccountMenuItem to="/legal" onSelect={() => setOpen(false)}>
                  <FileText aria-hidden="true" size={16} />
                  Legal
                </AccountMenuItem>
                {user.role === "admin" ? (
                  <AccountMenuItem to="/admin" onSelect={() => setOpen(false)}>
                    <Shield aria-hidden="true" size={16} />
                    Admin
                  </AccountMenuItem>
                ) : null}
                <AccountMenuItem
                  onClick={() => {
                    setOpen(false);
                    void logout();
                  }}
                >
                  <LogOut aria-hidden="true" size={16} />
                  Log Out
                </AccountMenuItem>
              </>
            ) : (
              <>
                <AccountMenuItem to="/login" onSelect={() => setOpen(false)}>
                  <LogIn aria-hidden="true" size={16} />
                  Sign in
                </AccountMenuItem>
                <AccountMenuItem to="/register" onSelect={() => setOpen(false)}>
                  <UserPlus aria-hidden="true" size={16} />
                  Create account
                </AccountMenuItem>
                <AccountMenuItem
                  onClick={() => {
                    const returnTarget =
                      menuRef.current?.querySelector<HTMLElement>(
                        "[data-account-menu-trigger='true']",
                      ) ?? null;

                    setOpen(false);
                    onWhatsNewOpen(returnTarget);
                  }}
                >
                  <Sparkles aria-hidden="true" size={16} />
                  What’s new
                </AccountMenuItem>
                <AccountMenuItem to="/legal" onSelect={() => setOpen(false)}>
                  <FileText aria-hidden="true" size={16} />
                  Legal
                </AccountMenuItem>
              </>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

const accountMenuItemClass =
  "app-control flex min-h-11 w-full items-center gap-2 rounded-card px-2.5 text-left text-sm font-medium text-muted transition duration-fluid ease-fluid hover:bg-surface-strong hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

function AccountMenuItem({
  children,
  onClick,
  onSelect,
  to,
  withinMenu = true,
}: {
  children: ReactNode;
  onClick?: () => void;
  onSelect?: () => void;
  to?: string;
  withinMenu?: boolean;
}) {
  if (to) {
    return (
      <NavLink
        to={to}
        className={accountMenuItemClass}
        role={withinMenu ? "menuitem" : undefined}
        onClick={onSelect}
      >
        {children}
      </NavLink>
    );
  }

  return (
    <button
      type="button"
      className={accountMenuItemClass}
      role={withinMenu ? "menuitem" : undefined}
      onClick={onClick ?? onSelect}
    >
      {children}
    </button>
  );
}

type NavItemProps = {
  to: string;
  label: string;
  icon: LucideIcon;
};

function DesktopNavItem({ to, label, icon: Icon }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        cn(
          "inline-flex min-h-[2.125rem] items-center gap-1.5 rounded-control px-2.5 text-sm font-medium transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
          isActive
            ? "bg-surface-strong text-text"
            : "text-muted hover:bg-surface hover:text-text",
        )
      }
    >
      <Icon aria-hidden="true" size={17} />
      {label}
    </NavLink>
  );
}

function MobileDock({
  hidden,
  navItems,
  onPostClick,
  postDisabled,
}: {
  hidden: boolean;
  navItems: NavItemProps[];
  onPostClick: () => void;
  postDisabled: boolean;
}) {
  const mobileNavItems = navItems.filter((item) => item.to !== "/search");
  const mobilePositions = ["col-start-1", "col-start-2", "col-start-4", "col-start-5"];

  if (hidden) {
    return null;
  }

  return (
    <motion.nav
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={snappySpring}
      className="site-profile-glass-surface fixed inset-x-3 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-30 mx-auto grid w-auto max-w-sm grid-cols-5 items-center gap-0.5 rounded-panel border border-line/80 bg-surface/92 px-1.5 py-1 shadow-soft backdrop-blur-veil lg:hidden"
      aria-label="Primary"
      data-app-mobile-nav="true"
      data-testid="mobile-nav"
    >
      {mobileNavItems.map(({ to, label, icon: Icon }, index) => (
        <motion.div
          key={to}
          className={cn("flex justify-center", mobilePositions[index])}
          whileTap={buttonTap}
        >
          <NavLink
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "grid min-h-11 w-full max-w-[4.25rem] place-items-center rounded-control px-1 py-1 text-[0.66rem] font-medium leading-none transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                isActive
                  ? "bg-accent/16 text-text ring-1 ring-accent/20"
                  : "text-muted hover:bg-surface-strong/70 hover:text-text",
              )
            }
          >
            <Icon aria-hidden="true" size={18} />
            <span className="mt-1">{label}</span>
          </NavLink>
        </motion.div>
      ))}
      <div className="relative col-start-3 row-start-1 mx-auto flex h-14 items-center justify-center">
        <Button
          type="button"
          className="size-14 rounded-full border-2 border-white/50 p-0 shadow-lift ring-2 ring-accent/30"
          disabled={postDisabled}
          aria-label="Post"
          data-testid="mobile-post-action"
          title="Post"
          icon={<PenLine aria-hidden="true" size={20} />}
          onClick={onPostClick}
        />
      </div>
    </motion.nav>
  );
}

function SiteFooter({ onWhatsNewOpen }: { onWhatsNewOpen: OpenWhatsNew }) {
  return (
    <footer
      className="mx-auto w-full max-w-7xl px-4 pb-[var(--app-mobile-content-bottom)] pt-1 sm:px-6 lg:px-8 lg:pb-8"
      data-testid="site-footer"
    >
      <div className="flex flex-col gap-4 border-t border-line py-4 text-xs text-muted sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-3xl space-y-3 leading-5">
          <div className="space-y-1">
            <p>
              © 2026 Thia Markussen. Alle rettigheter forbeholdt / All rights
              reserved.
            </p>
            <p>
              Beskyttet etter norsk opphavsrett og internasjonal opphavsrett /
              Protected under Norwegian and international copyright law.
            </p>
          </div>
        </div>
        <div className="space-y-2 sm:max-w-sm sm:text-right">
          <nav
            aria-label="Legal and trust"
            className="flex flex-wrap gap-x-3 gap-y-2 sm:justify-end"
            data-testid="legal-footer-links"
          >
            {legalLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="font-medium underline-offset-4 transition duration-fluid hover:text-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {link.label}
              </Link>
            ))}
            <button
              type="button"
              className="font-medium underline-offset-4 transition duration-fluid hover:text-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              onClick={(event) => onWhatsNewOpen(event.currentTarget)}
            >
              What’s new
            </button>
            <a
              href={supportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline-offset-4 transition duration-fluid hover:text-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Hey, want to support thia.lol?
            </a>
            <a
              href={bugReportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-text underline-offset-4 transition duration-fluid hover:text-accent-strong hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Report a bug
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}

function CookieNotice({
  onDismiss,
  visible,
}: {
  onDismiss: () => void;
  visible: boolean;
}) {
  function handleContinue() {
    try {
      window.localStorage.setItem(cookieNoticeStorageKey, "1");
    } catch {
      // If localStorage is unavailable, hide the notice for this page view.
    }

    onDismiss();
  }

  if (!visible) {
    return null;
  }

  return (
    <div
      className="site-profile-glass-surface fixed inset-x-3 top-[4.25rem] z-50 mx-auto max-w-2xl rounded-panel border border-line bg-surface/96 p-4 text-sm text-muted shadow-lift backdrop-blur-veil lg:bottom-5 lg:top-auto"
      data-testid="cookie-notice"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <BrandMark
          className="shadow-soft"
          data-testid="cookie-brand-mark"
          shape="squircle"
          size="sm"
          variant="pink"
        />
        <p className="leading-6">
          thia.lol uses necessary cookies for sign-in and security. No analytics or
          marketing cookies are currently used.
          <Link
            to="/cookies"
            className="ml-1 font-medium text-text underline-offset-4 hover:text-accent-strong hover:underline"
          >
            Cookie policy
          </Link>
        </p>
        <Button
          type="button"
          size="sm"
          className="shrink-0 self-start sm:ml-auto"
          onClick={handleContinue}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
