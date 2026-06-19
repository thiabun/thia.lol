import { LockKeyhole, Mail, UserRound, UserPlus } from "lucide-react";
import { motion } from "motion/react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { BrandLogoMain } from "../components/BrandLogo";
import { PageMeta } from "../components/PageMeta";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/Field";
import { Panel } from "../components/ui/Panel";
import { cardEntrance, pageEntrance } from "../lib/motionPresets";
import { useAuth } from "../lib/useAuth";

type AuthPageProps = {
  mode: "login" | "register";
};

export function AuthPage({ mode }: AuthPageProps) {
  const isRegister = mode === "register";
  const navigate = useNavigate();
  const { login, logout, register, status, user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    setSubmitting(true);
    setError(undefined);

    try {
      if (isRegister) {
        await register({
          displayName: stringField(form, "displayName"),
          handle: stringField(form, "handle"),
          email: stringField(form, "email"),
          password: stringField(form, "password", false),
        });
      } else {
        await login({
          email: stringField(form, "email"),
          password: stringField(form, "password", false),
        });
      }

      navigate(isRegister ? "/onboarding" : "/", { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      className="mx-auto grid min-h-[calc(100dvh-9rem)] max-w-5xl place-items-center"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <PageMeta
        title={isRegister ? "Create account" : "Sign in"}
        description={isRegister ? "Create account." : "Sign in."}
        path={isRegister ? "/register" : "/login"}
      />
      <motion.div
        className="w-full max-w-xl"
        variants={cardEntrance}
        custom={0}
        initial="hidden"
        animate="show"
      >
        <Panel className="w-full overflow-hidden">
          <form className="p-5 sm:p-6" onSubmit={handleSubmit}>
            <BrandLogoMain
              className="mb-5"
              data-testid="auth-brand-logo-main"
              size="md"
            />
            <Badge tone={isRegister ? "warm" : "cool"}>
              {isRegister ? "create account" : "sign in"}
            </Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-normal text-text">
              {isRegister ? "Create account" : "Sign in"}
            </h1>
            <p className="mt-3 text-base leading-7 text-muted">
              {isRegister
                ? "Choose a handle."
                : "Use your account."}
            </p>

            {status === "authenticated" && user ? (
              <div className="mt-5 rounded-card border border-line bg-surface-strong p-4">
                <p className="text-sm font-semibold text-text">
                  Signed in as {user.displayName}
                </p>
                <p className="mt-1 text-sm text-muted">@{user.handle}</p>
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-4"
                  onClick={() => void logout()}
                >
                  Log out
                </Button>
              </div>
            ) : null}

            {error ? (
              <div
                role="alert"
                className="mt-5 rounded-card border border-rose/30 bg-rose/15 p-4 text-sm leading-6 text-rose-ink"
              >
                {error}
              </div>
            ) : null}

            <div className="mt-6 space-y-4">
              {isRegister ? (
                <>
                  <TextField
                    id="displayName"
                    name="displayName"
                    label="Display name"
                    type="text"
                    placeholder="Alex"
                    autoComplete="name"
                    icon={UserRound}
                    required
                    minLength={1}
                    maxLength={120}
                  />
                  <TextField
                    id="handle"
                    name="handle"
                    label="Handle"
                    type="text"
                    placeholder="@handle"
                    autoComplete="username"
                    icon={UserPlus}
                    required
                    minLength={3}
                    maxLength={40}
                    pattern="[A-Za-z0-9][A-Za-z0-9_-]{1,38}[A-Za-z0-9]"
                  />
                </>
              ) : null}
              <TextField
                id="email"
                name="email"
                label="Email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                icon={Mail}
                required
              />
              <TextField
                id="password"
                name="password"
                label="Password"
                type="password"
                placeholder="••••••••"
                autoComplete={isRegister ? "new-password" : "current-password"}
                icon={LockKeyhole}
                required
                minLength={isRegister ? 10 : undefined}
                maxLength={255}
              />
            </div>

            <Button type="submit" className="mt-6 w-full" disabled={submitting}>
              {submitting ? "Working..." : isRegister ? "Create account" : "Sign in"}
            </Button>

            <p className="mt-4 text-center text-xs leading-5 text-muted">
              By {isRegister ? "creating an account" : "signing in"}, you agree to
              the{" "}
              <Link
                to="/terms"
                className="font-medium text-text underline-offset-4 hover:text-accent-strong hover:underline"
              >
                Terms of Service
              </Link>
              ,{" "}
              <Link
                to="/privacy"
                className="font-medium text-text underline-offset-4 hover:text-accent-strong hover:underline"
              >
                Privacy Policy
              </Link>
              , and{" "}
              <Link
                to="/community-guidelines"
                className="font-medium text-text underline-offset-4 hover:text-accent-strong hover:underline"
              >
                Community Guidelines
              </Link>
              .
            </p>

            <p className="mt-5 text-center text-sm text-muted">
              {isRegister ? "Already have an account?" : "New here?"}{" "}
              <Link
                to={isRegister ? "/login" : "/register"}
                className="font-medium text-accent-strong underline-offset-4 hover:underline"
              >
                {isRegister ? "Sign in" : "Create account"}
              </Link>
            </p>
          </form>
        </Panel>
      </motion.div>
    </motion.div>
  );
}

function stringField(form: FormData, name: string, trim = true): string {
  const value = form.get(name);

  if (typeof value !== "string") {
    return "";
  }

  return trim ? value.trim() : value;
}
