import { LockKeyhole, Mail, UserRound, UserPlus } from "lucide-react";
import { motion } from "motion/react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { BrandLogoMain } from "../components/BrandLogo";
import { PageMeta } from "../components/PageMeta";
import { Badge } from "../components/ui/Badge";
import { Button, ButtonLink } from "../components/ui/Button";
import { HandleField, TextField } from "../components/ui/Field";
import { Panel } from "../components/ui/Panel";
import { cardEntrance, pageEntrance } from "../lib/motionPresets";
import { verifyTwoFactorLogin, type TwoFactorChallenge } from "../lib/api";
import {
  clearGrowthAttribution,
  currentGrowthAttribution,
} from "../lib/growthAttribution";
import { useAuth } from "../lib/useAuth";

type AuthPageProps = {
  mode: "login" | "register";
};

export function AuthPage({ mode }: AuthPageProps) {
  const isRegister = mode === "register";
  const location = useLocation();
  const navigate = useNavigate();
  const loginReturnTo = safeLoginReturnTo(
    new URLSearchParams(location.search).get("returnTo"),
  );
  const { login, logout, refreshSession, register, status, user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [twoFactorChallenge, setTwoFactorChallenge] =
    useState<TwoFactorChallenge | undefined>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    setSubmitting(true);
    setError(undefined);

    try {
      if (isRegister) {
        const attribution = currentGrowthAttribution();

        await register({
          displayName: stringField(form, "displayName"),
          handle: normalizeHandleInput(stringField(form, "handle")),
          email: stringField(form, "email"),
          password: stringField(form, "password", false),
          ...(attribution ? { attribution } : {}),
        });
        clearGrowthAttribution();
      } else {
        const result = await login({
          email: stringField(form, "email"),
          password: stringField(form, "password", false),
        });

        if ("twoFactorRequired" in result && result.twoFactorRequired) {
          setTwoFactorChallenge(result);
          return;
        }
      }

      navigate(isRegister ? "/onboarding" : loginReturnTo, { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTwoFactorSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!twoFactorChallenge) {
      return;
    }

    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(undefined);

    try {
      await verifyTwoFactorLogin({
        challengeId: twoFactorChallenge.challengeId,
        code: stringField(form, "code"),
      });
      await refreshSession();
      navigate(loginReturnTo, { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Code could not be verified.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "authenticated" && user && !twoFactorChallenge) {
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
          className="w-full max-w-lg"
          variants={cardEntrance}
          custom={0}
          initial="hidden"
          animate="show"
        >
          <Panel className="w-full p-5 text-center sm:p-6">
            <BrandLogoMain
              className="mx-auto mb-5"
              data-testid="auth-brand-logo-main"
              size="md"
            />
            <Badge tone="leaf">Signed in</Badge>
            <h1 className="mt-4 text-2xl font-semibold tracking-normal text-text">
              You are signed in as {user.displayName}
            </h1>
            <p className="mt-2 text-sm text-muted">@{user.handle}</p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <ButtonLink to={`/@${user.handle}`} variant="primary">
                View profile
              </ButtonLink>
              <ButtonLink to="/" variant="secondary">
                Home
              </ButtonLink>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void logout()}
              >
                Log out
              </Button>
            </div>
          </Panel>
        </motion.div>
      </motion.div>
    );
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
          <form
            className="p-5 sm:p-6"
            onSubmit={twoFactorChallenge ? handleTwoFactorSubmit : handleSubmit}
          >
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
                : twoFactorChallenge
                  ? "Enter your authenticator or recovery code."
                  : "Use your account."}
            </p>

            {error ? (
              <div
                role="alert"
                className="mt-5 rounded-card border border-rose/30 bg-rose/15 p-4 text-sm leading-6 text-rose-ink"
              >
                {error}
              </div>
            ) : null}

            <div className="mt-6 space-y-4">
              {twoFactorChallenge ? (
                <TextField
                  id="code"
                  name="code"
                  label="Authenticator or recovery code"
                  type="text"
                  placeholder="123456"
                  autoComplete="one-time-code"
                  icon={LockKeyhole}
                  required
                  minLength={6}
                  maxLength={20}
                />
              ) : isRegister ? (
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
                  <HandleField
                    id="handle"
                    name="handle"
                    label="Handle"
                    type="text"
                    placeholder="handle"
                    autoComplete="username"
                    icon={UserPlus}
                    required
                    minLength={3}
                    maxLength={41}
                    pattern="@?[A-Za-z0-9][A-Za-z0-9_-]{1,38}[A-Za-z0-9]"
                    title="Use 3-40 letters, numbers, underscores, or hyphens."
                  />
                </>
              ) : null}
              {!twoFactorChallenge ? (
                <>
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
                </>
              ) : null}
            </div>

            <Button type="submit" className="mt-6 w-full" disabled={submitting}>
              {submitting
                ? "Working..."
                : twoFactorChallenge
                  ? "Verify code"
                  : isRegister
                    ? "Create account"
                    : "Sign in"}
            </Button>
            {twoFactorChallenge ? (
              <Button
                type="button"
                className="mt-3 w-full"
                variant="ghost"
                onClick={() => {
                  setTwoFactorChallenge(undefined);
                  setError(undefined);
                }}
              >
                Use a different account
              </Button>
            ) : null}

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

function normalizeHandleInput(value: string): string {
  return value.trim().replace(/^@/, "");
}

function safeLoginReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}
