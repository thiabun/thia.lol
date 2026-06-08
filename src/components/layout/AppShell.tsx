import {
  Compass,
  Home,
  LogIn,
  PenLine,
  Radio,
  Shield,
  UserPlus,
} from "lucide-react";
import { NavLink, Outlet } from "react-router";
import { ThemeToggle } from "../ThemeToggle";
import { ButtonLink } from "../ui/Button";
import { cn } from "../../lib/classNames";

const navItems = [
  { to: "/", label: "Home", icon: Home },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/rooms", label: "Rooms", icon: Radio },
  { to: "/studio", label: "Studio", icon: PenLine },
  { to: "/admin", label: "Admin", icon: Shield },
];

export function AppShell() {
  return (
    <div className="min-h-dvh bg-canvas text-text">
      <div className="fixed inset-0 -z-10 bg-page-wash" />
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-5 sm:px-6 lg:px-8">
        <Outlet />
      </main>
      <MobileDock />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/78 backdrop-blur-veil">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <NavLink
          to="/"
          className="group flex shrink-0 items-center gap-3 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          aria-label="thia.lol home"
        >
          <span className="grid size-10 place-items-center rounded-full border border-line bg-surface shadow-soft">
            <span className="size-3 rounded-full bg-accent shadow-glow transition duration-fluid group-hover:scale-110" />
          </span>
          <span>
            <span className="block text-sm font-semibold tracking-normal text-text">
              thia.lol
            </span>
            <span className="block text-xs text-muted">soft social</span>
          </span>
        </NavLink>

        <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Primary">
          {navItems.map((item) => (
            <DesktopNavItem key={item.to} {...item} />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="sm:hidden">
            <ThemeToggle compact />
          </div>
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          <ButtonLink
            to="/login"
            variant="secondary"
            size="icon"
            className="sm:hidden"
            aria-label="Login"
            title="Login"
            icon={<LogIn aria-hidden="true" size={17} />}
          />
          <ButtonLink
            to="/register"
            size="icon"
            className="sm:hidden"
            aria-label="Register"
            title="Register"
            icon={<UserPlus aria-hidden="true" size={17} />}
          />
          <ButtonLink
            to="/login"
            variant="ghost"
            className="hidden sm:inline-flex"
            icon={<LogIn aria-hidden="true" size={17} />}
          >
            Login
          </ButtonLink>
          <ButtonLink
            to="/register"
            className="hidden sm:inline-flex"
            icon={<UserPlus aria-hidden="true" size={17} />}
          >
            Register
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}

type NavItemProps = {
  to: string;
  label: string;
  icon: typeof Home;
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

function MobileDock() {
  return (
    <nav
      className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 gap-1 rounded-panel border border-line bg-surface/88 p-2 shadow-lift backdrop-blur-veil lg:hidden"
      aria-label="Primary"
    >
      {navItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
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
      ))}
    </nav>
  );
}
