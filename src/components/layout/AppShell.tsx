import {
  Bell,
  Cookie,
  Compass,
  FileText,
  Home,
  LogIn,
  LogOut,
  MessageCircle,
  PenLine,
  Radio,
  Search,
  Shield,
  UserRound,
  UserPlus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, NavLink, Outlet, matchPath, useLocation, useNavigate } from "react-router";
import { PostComposerModal } from "../social/PostComposerModal";
import { ThemeToggle } from "../ThemeToggle";
import { Button, ButtonLink } from "../ui/Button";
import { getNotifications, getRooms } from "../../lib/api";
import { cn } from "../../lib/classNames";
import {
  buttonTap,
  popoverPanel,
  snappySpring,
} from "../../lib/motionPresets";
import { emitPostCreated } from "../../lib/postEvents";
import { notificationsUpdatedEventName } from "../../lib/notificationEvents";
import { useAsyncData } from "../../lib/useAsyncData";
import { useAuth } from "../../lib/useAuth";

const publicNavItems = [
  { to: "/", label: "Home", icon: Home },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/search", label: "Search", icon: Search },
  { to: "/rooms", label: "Rooms", icon: Radio },
  { to: "/chat", label: "Chat", icon: MessageCircle },
];

const legalLinks = [
  { to: "/terms", label: "Terms" },
  { to: "/privacy", label: "Privacy" },
  { to: "/cookies", label: "Cookies" },
  { to: "/community-guidelines", label: "Guidelines" },
  { to: "/copyright", label: "Copyright" },
  { to: "/moderation", label: "Moderation" },
  { to: "/legal", label: "Legal" },
];

const bugReportUrl =
  "https://github.com/thiabun/thia.lol/issues/new?template=bug_report.yml";

const cookieNoticeStorageKey = "thia_cookie_notice_ack";

export type AppShellOutletContext = {
  openPostComposer: (roomSlug?: string) => void;
};

export function AppShell() {
  const { csrfToken, status, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const roomsState = useAsyncData(getRooms);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerRoomSlug, setComposerRoomSlug] = useState<string | undefined>();
  const [composerKey, setComposerKey] = useState(0);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState<
    number | undefined
  >();
  const postingDisabled = status === "loading";
  const rooms = roomsState.data ?? [];
  const currentRoomSlug = matchPath(
    { path: "/rooms/:slug", end: true },
    location.pathname,
  )?.params.slug;

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

  function openPostComposer(roomSlug?: string) {
    if (status === "authenticated" && user && csrfToken) {
      setComposerRoomSlug(roomSlug);
      setComposerKey((current) => current + 1);
      setComposerOpen(true);
      return;
    }

    navigate("/login");
  }

  function handlePostClick() {
    openPostComposer(currentRoomSlug);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-text">
      <div className="fixed inset-0 -z-10 bg-page-wash" />
      <SiteHeader
        navItems={publicNavItems}
        notificationUnreadCount={notificationUnreadCount}
        showNotifications={status === "authenticated"}
      />
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 sm:px-6 lg:px-8">
        <main className="flex-1 pb-6 pt-5 lg:pb-16">
          <Outlet context={{ openPostComposer } satisfies AppShellOutletContext} />
        </main>
        <MobileDock
          navItems={publicNavItems}
          onPostClick={handlePostClick}
          postDisabled={postingDisabled}
        />
      </div>
      <SiteFooter />
      <Button
        type="button"
        className="fixed bottom-6 right-6 z-40 hidden rounded-full px-5 shadow-lift lg:inline-flex"
        disabled={postingDisabled}
        icon={<PenLine aria-hidden="true" size={18} />}
        onClick={handlePostClick}
      >
        Post
      </Button>
      <PostComposerModal
        key={composerKey}
        csrfToken={csrfToken}
        initialRoomSlug={composerRoomSlug}
        onClose={() => setComposerOpen(false)}
        onCreated={emitPostCreated}
        open={composerOpen}
        rooms={rooms}
      />
      <CookieNotice />
    </div>
  );
}

function SiteHeader({
  navItems,
  notificationUnreadCount,
  showNotifications,
}: {
  navItems: NavItemProps[];
  notificationUnreadCount: number | undefined;
  showNotifications: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/78 backdrop-blur-veil">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        <NavLink
          to="/"
          className="flex min-w-0 shrink items-center rounded-md px-1 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          aria-label="thia.lol home"
        >
          <span className="min-w-0">
            <span className="block truncate text-base font-semibold leading-none tracking-normal text-text">
              thia.lol
            </span>
          </span>
        </NavLink>

        <nav
          className="ml-4 hidden items-center gap-1 lg:flex"
          aria-label="Primary"
          data-testid="desktop-nav"
        >
          {navItems.map((item) => (
            <DesktopNavItem key={item.to} {...item} />
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
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
          <ThemeToggle compact />
          <AccountMenu />
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

function AccountMenu() {
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
            className="absolute right-0 z-50 mt-2 w-40 origin-top-right rounded-panel border border-line bg-surface/96 p-1 shadow-lift backdrop-blur-veil sm:w-44"
            role="menu"
            data-testid="account-menu"
          >
            {isAuthenticated && user ? (
              <>
                <AccountMenuItem to={`/@${user.handle}`} onSelect={() => setOpen(false)}>
                  <UserRound aria-hidden="true" size={16} />
                  Profile
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
                  Log out
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
  "flex min-h-10 w-full items-center gap-2 rounded-card px-3 text-left text-sm font-medium text-muted transition duration-fluid ease-fluid hover:bg-surface-strong hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

function AccountMenuItem({
  children,
  onClick,
  onSelect,
  to,
}: {
  children: ReactNode;
  onClick?: () => void;
  onSelect?: () => void;
  to?: string;
}) {
  if (to) {
    return (
      <NavLink
        to={to}
        className={accountMenuItemClass}
        role="menuitem"
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
      role="menuitem"
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
          "inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-medium transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
          isActive
            ? "bg-surface-strong text-text shadow-soft"
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
  navItems,
  onPostClick,
  postDisabled,
}: {
  navItems: NavItemProps[];
  onPostClick: () => void;
  postDisabled: boolean;
}) {
  const mobileNavItems = navItems.filter((item) => item.to !== "/search");
  const mobilePositions = ["col-start-1", "col-start-2", "col-start-4", "col-start-5"];

  return (
    <motion.nav
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={snappySpring}
      className="sticky bottom-[calc(0.55rem+env(safe-area-inset-bottom))] z-30 mx-auto mb-[calc(0.75rem+env(safe-area-inset-bottom))] grid w-full max-w-md grid-cols-5 items-center gap-0.5 rounded-[1.35rem] border border-line/80 bg-surface/82 px-2 py-1.5 shadow-[0_16px_44px_oklch(0_0_0_/_0.13)] backdrop-blur-veil lg:hidden"
      aria-label="Primary"
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
                "grid min-h-11 w-full max-w-[4.9rem] place-items-center rounded-full px-1 py-1 text-[0.69rem] font-medium leading-none transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                isActive
                  ? "bg-accent/18 text-text shadow-inner-soft ring-1 ring-accent/25"
                  : "text-muted hover:bg-surface-strong/70 hover:text-text",
              )
            }
          >
            <Icon aria-hidden="true" size={18} />
            <span className="mt-1.5">{label}</span>
          </NavLink>
        </motion.div>
      ))}
      <div className="relative col-start-3 row-start-1 mx-auto flex h-[3.25rem] items-center justify-center">
        <Button
          type="button"
          className="size-11 rounded-full border border-white/45 p-0 shadow-[0_14px_34px_color-mix(in_oklab,var(--app-accent)_38%,transparent)] ring-1 ring-accent/20"
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

function SiteFooter() {
  return (
    <footer
      className="mx-auto w-full max-w-7xl px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-1 sm:px-6 lg:px-8 lg:pb-8"
      data-testid="site-footer"
    >
      <div className="flex flex-col gap-4 border-t border-line py-4 text-xs text-muted sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-3xl space-y-1 leading-5">
          <p>
            © 2026 Thia Markussen. Alle rettigheter forbeholdt / All rights
            reserved.
          </p>
          <p>
            Beskyttet etter norsk opphavsrett og internasjonal opphavsrett /
            Protected under Norwegian and international copyright law.
          </p>
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

function CookieNotice() {
  const [visible, setVisible] = useState(() => {
    try {
      return window.localStorage.getItem(cookieNoticeStorageKey) !== "1";
    } catch {
      return true;
    }
  });

  function handleContinue() {
    try {
      window.localStorage.setItem(cookieNoticeStorageKey, "1");
    } catch {
      // If localStorage is unavailable, hide the notice for this page view.
    }

    setVisible(false);
  }

  if (!visible) {
    return null;
  }

  return (
    <div
      className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-2xl rounded-panel border border-line bg-surface/96 p-4 text-sm text-muted shadow-lift backdrop-blur-veil lg:bottom-5"
      data-testid="cookie-notice"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <Cookie aria-hidden="true" className="mt-0.5 shrink-0 text-muted" size={18} />
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
