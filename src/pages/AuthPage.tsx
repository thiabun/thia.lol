import { LockKeyhole, Mail, UserRound, UserPlus } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { PageMeta } from "../components/PageMeta";
import { AmbientImage } from "../components/ui/AmbientImage";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/Field";
import { Panel } from "../components/ui/Panel";
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

      navigate("/", { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto grid min-h-[calc(100dvh-9rem)] max-w-5xl place-items-center">
      <PageMeta
        title={isRegister ? "Register" : "Login"}
        description={
          isRegister
            ? "Create a thia.lol profile."
            : "Return to thia.lol."
        }
        path={isRegister ? "/register" : "/login"}
      />
      <Panel className="grid w-full overflow-hidden lg:grid-cols-[minmax(0,1fr)_360px]">
        <form className="p-5 sm:p-8" onSubmit={handleSubmit}>
          <Badge tone={isRegister ? "warm" : "cool"}>
            {isRegister ? "register" : "login"}
          </Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-normal text-text">
            {isRegister ? "Create your profile." : "Welcome back."}
          </h1>
          <p className="mt-3 text-base leading-7 text-muted">
            {isRegister
              ? "Choose a handle and start posting when you are ready."
              : "Sign in to post, react, and keep your place."}
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
                Logout
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
                  placeholder="Thia"
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
            {submitting ? "Working..." : isRegister ? "Register" : "Login"}
          </Button>

          <p className="mt-5 text-center text-sm text-muted">
            {isRegister ? "Already have an account?" : "New here?"}{" "}
            <Link
              to={isRegister ? "/login" : "/register"}
              className="font-medium text-accent-strong underline-offset-4 hover:underline"
            >
              {isRegister ? "Login" : "Register"}
            </Link>
          </p>
        </form>

        <div className="relative min-h-72 overflow-hidden border-t border-line lg:border-l lg:border-t-0">
          <AmbientImage className="absolute inset-0" overlay />
          <div className="absolute inset-x-5 bottom-5 rounded-card border border-white/35 bg-surface/72 p-4 shadow-soft backdrop-blur-veil">
            <p className="text-sm font-semibold text-text">Your corner of thia.lol</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              Keep your profile, rooms, and posts close at hand.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function stringField(form: FormData, name: string, trim = true): string {
  const value = form.get(name);

  if (typeof value !== "string") {
    return "";
  }

  return trim ? value.trim() : value;
}
