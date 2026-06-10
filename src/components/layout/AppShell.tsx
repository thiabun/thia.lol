import {
  Compass,
  Home,
  LogIn,
  LogOut,
  PenLine,
  Radio,
  Shield,
  UserRound,
  UserPlus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import { PostComposerModal } from "../social/PostComposerModal";
import { ThemeToggle } from "../ThemeToggle";
import { Button } from "../ui/Button";
import { getRooms } from "../../lib/api";
import { cn } from "../../lib/classNames";
import {
  buttonTap,
  popoverPanel,
  sectionItem,
  snappySpring,
} from "../../lib/motionPresets";
import { emitPostCreated } from "../../lib/postEvents";
import { useAsyncData } from "../../lib/useAsyncData";
import { useAuth } from "../../lib/useAuth";

const publicNavItems = [
  { to: "/", label: "Home", icon: Home },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/rooms", label: "Rooms", icon: Radio },
];

const adminNavItem = { to: "/admin", label: "Admin", icon: Shield };

export type AppShellOutletContext = {
  openPostComposer: (roomSlug?: string) => void;
};

export function AppShell() {
  const { csrfToken, status, user } = useAuth();
  const navigate = useNavigate();
  const roomsState = useAsyncData(getRooms);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerRoomSlug, setComposerRoomSlug] = useState<string | undefined>();
  const [composerKey, setComposerKey] = useState(0);
  const navItems =
    status === "authenticated" && user?.role === "admin"
      ? [...publicNavItems, adminNavItem]
      : publicNavItems;
  const postingDisabled = status === "loading";
  const rooms = roomsState.data ?? [];

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
    openPostComposer();
  }

  return (
    <div className="min-h-dvh bg-canvas text-text">
      <div className="fixed inset-0 -z-10 bg-page-wash" />
      <SiteHeader navItems={navItems} />
      <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-5 sm:px-6 lg:px-8">
        <Outlet context={{ openPostComposer } satisfies AppShellOutletContext} />
      </main>
      <Button
        type="button"
        className="fixed bottom-6 right-6 z-40 hidden rounded-full px-5 shadow-lift lg:inline-flex"
        disabled={postingDisabled}
        icon={<PenLine aria-hidden="true" size={18} />}
        onClick={handlePostClick}
      >
        Post
      </Button>
      <MobileDock
        navItems={navItems}
        onPostClick={handlePostClick}
        postDisabled={postingDisabled}
      />
      <PostComposerModal
        key={composerKey}
        csrfToken={csrfToken}
        initialRoomSlug={composerRoomSlug}
        onClose={() => setComposerOpen(false)}
        onCreated={emitPostCreated}
        open={composerOpen}
        rooms={rooms}
      />
    </div>
  );
}

function SiteHeader({ navItems }: { navItems: NavItemProps[] }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/78 backdrop-blur-veil">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        <NavLink
          to="/"
          className="group flex min-w-0 shrink items-center gap-2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:gap-3"
          aria-label="thia.lol home"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface shadow-soft sm:size-10">
            <span className="size-3 rounded-full bg-accent shadow-glow transition duration-fluid group-hover:scale-110" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold tracking-normal text-text">
              thia.lol
            </span>
            <span className="block truncate text-xs text-muted">social app</span>
          </span>
        </NavLink>

        <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Primary">
          {navItems.map((item) => (
            <DesktopNavItem key={item.to} {...item} />
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <ThemeToggle compact />
          <AccountMenu />
        </div>
      </div>
    </header>
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
                <AccountMenuLink to={`/@${user.handle}`} onSelect={() => setOpen(false)}>
                  <UserRound aria-hidden="true" size={16} />
                  View profile
                </AccountMenuLink>
                {user.role === "admin" ? (
                  <AccountMenuLink to="/admin" onSelect={() => setOpen(false)}>
                    <Shield aria-hidden="true" size={16} />
                    Admin
                  </AccountMenuLink>
                ) : null}
                <motion.button
                  type="button"
                  className="flex min-h-10 w-full items-center gap-2 rounded-card px-3 text-left text-sm font-medium text-muted transition duration-fluid ease-fluid hover:bg-surface-strong hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  role="menuitem"
                  variants={sectionItem}
                  whileHover={{ x: 2, transition: snappySpring }}
                  whileTap={buttonTap}
                  onClick={() => {
                    setOpen(false);
                    void logout();
                  }}
                >
                  <LogOut aria-hidden="true" size={16} />
                  Log out
                </motion.button>
              </>
            ) : (
              <>
                <AccountMenuLink to="/login" onSelect={() => setOpen(false)}>
                  <LogIn aria-hidden="true" size={16} />
                  Sign in
                </AccountMenuLink>
                <AccountMenuLink to="/register" onSelect={() => setOpen(false)}>
                  <UserPlus aria-hidden="true" size={16} />
                  Create account
                </AccountMenuLink>
              </>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function AccountMenuLink({
  children,
  onSelect,
  to,
}: {
  children: ReactNode;
  onSelect: () => void;
  to: string;
}) {
  return (
    <motion.div
      variants={sectionItem}
      whileHover={{ x: 2, transition: snappySpring }}
      whileTap={buttonTap}
    >
      <NavLink
        to={to}
        className="flex min-h-10 w-full items-center gap-2 rounded-card px-3 text-sm font-medium text-muted transition duration-fluid ease-fluid hover:bg-surface-strong hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        role="menuitem"
        onClick={onSelect}
      >
        {children}
      </NavLink>
    </motion.div>
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
  const mobilePositions =
    navItems.length === 4
      ? ["col-start-1", "col-start-2", "col-start-4", "col-start-5"]
      : ["col-start-1", "col-start-2", "col-start-4"];

  return (
    <motion.nav
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={snappySpring}
      className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 gap-1 rounded-panel border border-line bg-surface/88 p-2 shadow-lift backdrop-blur-veil lg:hidden"
      aria-label="Primary"
      data-testid="mobile-nav"
    >
      {navItems.map(({ to, label, icon: Icon }, index) => (
        <motion.div
          key={to}
          className={mobilePositions[index]}
          whileTap={buttonTap}
        >
          <NavLink
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "grid min-h-12 place-items-center rounded-card text-xs font-medium transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                isActive
                  ? "bg-accent text-accent-ink shadow-soft"
                  : "text-muted hover:bg-surface-strong hover:text-text",
              )
            }
          >
            <Icon aria-hidden="true" size={18} />
            <span className="mt-1">{label}</span>
          </NavLink>
        </motion.div>
      ))}
      <Button
        type="button"
        className="absolute left-1/2 top-0 size-14 -translate-x-1/2 -translate-y-5 rounded-full shadow-lift"
        disabled={postDisabled}
        aria-label="Create post"
        title="Post"
        icon={<PenLine aria-hidden="true" size={21} />}
        onClick={onPostClick}
      />
    </motion.nav>
  );
}
