import {
  AtSign,
  Check,
  CircleAlert,
  LoaderCircle,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";
import { motion } from "motion/react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { PageMeta } from "../components/PageMeta";
import { IdentityPreview } from "../components/social/IdentityPreview";
import { Button, ButtonLink } from "../components/ui/Button";
import {
  FieldMessage,
  HandleField,
  PasswordField,
  TextField,
} from "../components/ui/Field";
import { Panel } from "../components/ui/Panel";
import { cn } from "../lib/classNames";
import { displayNameMaxLength } from "../lib/displayNames";
import {
  getHandleAvailability,
  verifyTwoFactorLogin,
  type TwoFactorChallenge,
} from "../lib/api";
import {
  clearGrowthAttribution,
  currentGrowthAttribution,
} from "../lib/growthAttribution";
import { cardEntrance, pageEntrance } from "../lib/motionPresets";
import { useAuth } from "../lib/useAuth";

type AuthPageProps = {
  mode: "login" | "register";
};

type AuthFieldName =
  | "displayName"
  | "handle"
  | "email"
  | "identifier"
  | "password";

type AuthFieldError = {
  field: AuthFieldName;
  message: string;
};

type HandleCheckStatus =
  | "idle"
  | "waiting"
  | "checking"
  | "available"
  | "unavailable"
  | "error";

type HandleCheck = {
  handle: string;
  status: HandleCheckStatus;
};

const handlePattern = /^[a-z0-9][a-z0-9_-]{1,38}[a-z0-9]$/u;

export function AuthPage({ mode }: AuthPageProps) {
  const isRegister = mode === "register";
  const location = useLocation();
  const navigate = useNavigate();
  const loginReturnTo = safeLoginReturnTo(
    new URLSearchParams(location.search).get("returnTo"),
  );
  const { login, logout, refreshSession, register, status, user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldError, setFieldError] = useState<AuthFieldError>();
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [handleCheck, setHandleCheck] = useState<HandleCheck>({
    handle: "",
    status: "idle",
  });
  const [twoFactorChallenge, setTwoFactorChallenge] = useState<
    TwoFactorChallenge | undefined
  >();
  const errorRef = useRef<HTMLDivElement>(null);
  const normalizedHandle = normalizeHandleInput(handle).toLowerCase();
  const handleReady = handlePattern.test(normalizedHandle);
  const currentHandleStatus =
    handleCheck.handle === normalizedHandle
      ? handleCheck.status
      : handleReady
        ? "waiting"
        : "idle";

  useEffect(() => {
    if (!isRegister || !handleReady) {
      return;
    }

    let active = true;
    const timeout = window.setTimeout(() => {
      setHandleCheck({ handle: normalizedHandle, status: "checking" });

      getHandleAvailability(normalizedHandle)
        .then((result) => {
          if (!active) {
            return;
          }

          setHandleCheck({
            handle: result.handle,
            status: result.available ? "available" : "unavailable",
          });
        })
        .catch(() => {
          if (active) {
            setHandleCheck({ handle: normalizedHandle, status: "error" });
          }
        });
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [handleReady, isRegister, normalizedHandle]);

  useEffect(() => {
    if (!error) {
      return;
    }

    const frame = window.requestAnimationFrame(() => errorRef.current?.focus());

    return () => window.cancelAnimationFrame(frame);
  }, [error]);

  useEffect(() => {
    if (!fieldError) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(fieldError.field)?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [fieldError]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    setSubmitting(true);
    setError(undefined);
    setFieldError(undefined);

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
          identifier: stringField(form, "identifier"),
          password: stringField(form, "password", false),
        });

        if ("twoFactorRequired" in result && result.twoFactorRequired) {
          setTwoFactorChallenge(result);
          return;
        }
      }

      navigate(isRegister ? "/onboarding" : loginReturnTo, { replace: true });
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Authentication failed.";
      const nextFieldError = authFieldError(message, isRegister);

      if (nextFieldError) {
        setFieldError(nextFieldError);
      } else {
        setError(message);
      }
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
      setError(
        caught instanceof Error
          ? caught.message
          : "Code could not be verified.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function clearFieldError(field: AuthFieldName) {
    setFieldError((current) =>
      current?.field === field ? undefined : current,
    );
  }

  if (status === "authenticated" && user && !twoFactorChallenge) {
    return (
      <SignedInAuthState
        displayName={user.displayName}
        handle={user.handle}
        mode={mode}
        onLogout={() => void logout()}
      />
    );
  }

  const showIdentityPreview = isRegister && !twoFactorChallenge;
  const handleSubmitDisabled =
    submitting ||
    currentHandleStatus === "waiting" ||
    currentHandleStatus === "checking" ||
    currentHandleStatus === "unavailable";

  return (
    <motion.div
      className={cn(
        "mx-auto w-full",
        showIdentityPreview ? "max-w-4xl" : "max-w-2xl",
      )}
      data-testid="auth-page"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <PageMeta
        title={isRegister ? "Create account" : "Sign in"}
        description={
          isRegister
            ? "Create your thia.lol account and public identity."
            : "Sign in to your thia.lol account."
        }
        path={isRegister ? "/register" : "/login"}
      />
      <motion.div
        className="w-full"
        variants={cardEntrance}
        custom={0}
        initial="hidden"
        animate="show"
      >
        <Panel elevated className="w-full overflow-hidden">
          <div
            className={cn(
              "grid",
              showIdentityPreview &&
                "lg:grid-cols-[minmax(0,1fr)_minmax(15rem,0.42fr)]",
            )}
          >
            <AuthHeading
              mode={mode}
              twoFactor={Boolean(twoFactorChallenge)}
            />

            {showIdentityPreview ? (
              <aside
                aria-label="Identity preview"
                className="mx-5 mt-4 border-y border-line bg-canvas/36 px-1 py-3.5 sm:mx-7 lg:col-start-2 lg:row-start-2 lg:mx-0 lg:mr-7 lg:mt-5 lg:border-y lg:px-2"
              >
                <IdentityPreview
                  displayName={displayName}
                  handle={handle}
                  label="This is how you’ll appear"
                />
              </aside>
            ) : null}

            <form
              className={cn(
                "p-5 pt-5 sm:p-7 sm:pt-6",
                showIdentityPreview && "lg:col-start-1 lg:row-start-2",
              )}
              onSubmit={
                twoFactorChallenge ? handleTwoFactorSubmit : handleSubmit
              }
            >
              {error ? (
                <div
                  ref={errorRef}
                  role="alert"
                  tabIndex={-1}
                  className="mb-5 flex items-start gap-2.5 rounded-card border border-rose/30 bg-rose/12 p-3.5 text-sm leading-6 text-rose-ink outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <CircleAlert
                    aria-hidden="true"
                    className="mt-0.5 shrink-0"
                    size={17}
                  />
                  <span>{error}</span>
                </div>
              ) : null}

              <div className="space-y-4">
                {twoFactorChallenge ? (
                  <>
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
                      aria-describedby="code-guidance"
                    />
                    <FieldMessage id="code-guidance">
                      Use a current six-digit code or one of your saved recovery
                      codes.
                    </FieldMessage>
                  </>
                ) : isRegister ? (
                  <RegistrationIdentityFields
                    displayName={displayName}
                    fieldError={fieldError}
                    handle={handle}
                    handleReady={handleReady}
                    handleStatus={currentHandleStatus}
                    normalizedHandle={normalizedHandle}
                    onDisplayNameChange={(value) => {
                      setDisplayName(value);
                      clearFieldError("displayName");
                    }}
                    onHandleChange={(value) => {
                      const normalized = normalizeHandleInput(value).toLowerCase();

                      setHandle(value);
                      setHandleCheck({
                        handle: normalized,
                        status: handlePattern.test(normalized)
                          ? "waiting"
                          : "idle",
                      });
                      clearFieldError("handle");
                    }}
                  />
                ) : null}

                {!twoFactorChallenge ? (
                  <AccountCredentialFields
                    fieldError={fieldError}
                    isRegister={isRegister}
                    onFieldChange={clearFieldError}
                  />
                ) : null}
              </div>

              <Button
                type="submit"
                className="mt-6 min-h-12 w-full text-[0.95rem] font-semibold"
                disabled={isRegister ? handleSubmitDisabled : submitting}
                icon={
                  submitting ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="animate-spin motion-reduce:animate-none"
                      size={17}
                    />
                  ) : undefined
                }
              >
                {submitting
                  ? twoFactorChallenge
                    ? "Verifying…"
                    : isRegister
                      ? "Creating account…"
                      : "Signing in…"
                  : twoFactorChallenge
                    ? "Verify code"
                    : isRegister
                      ? "Create account"
                      : "Sign in"}
              </Button>

              {twoFactorChallenge ? (
                <Button
                  type="button"
                  className="mt-2 min-h-11 w-full"
                  variant="ghost"
                  disabled={submitting}
                  onClick={() => {
                    setTwoFactorChallenge(undefined);
                    setError(undefined);
                  }}
                >
                  Use a different account
                </Button>
              ) : null}

              {!twoFactorChallenge && !isRegister ? (
                <p className="mt-4 text-center text-xs leading-5 text-muted">
                  Can’t access your account? Email{" "}
                  <a
                    href="mailto:hello@thia.lol"
                    className="font-medium text-text underline-offset-4 hover:text-accent-strong hover:underline"
                  >
                    hello@thia.lol
                  </a>
                  .
                </p>
              ) : null}

              {!twoFactorChallenge ? <AuthLegal isRegister={isRegister} /> : null}
            </form>
          </div>
        </Panel>
      </motion.div>
    </motion.div>
  );
}

function AuthHeading({
  mode,
  twoFactor,
}: {
  mode: AuthPageProps["mode"];
  twoFactor: boolean;
}) {
  const isRegister = mode === "register";

  return (
    <header
      className={cn(
        "p-5 pb-0 sm:p-7 sm:pb-0",
        isRegister && "lg:col-span-2 lg:row-start-1",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-[-0.025em] text-text sm:text-[1.7rem]">
            {twoFactor
              ? "Confirm it’s you"
              : isRegister
                ? "Create your account"
                : "Welcome back"}
          </h1>
          <p className="mt-1.5 text-sm leading-6 text-muted">
            {twoFactor
              ? "Enter your authenticator or recovery code to finish signing in."
              : isRegister
                ? "Choose how people will know you."
                : "Use the email or Handle connected to your account."}
          </p>
        </div>
        {twoFactor ? null : <AuthRouteSwitch mode={mode} />}
      </div>
    </header>
  );
}

function AuthRouteSwitch({ mode }: { mode: AuthPageProps["mode"] }) {
  return (
    <nav
      className="grid min-h-11 shrink-0 grid-cols-2 border-b border-line text-sm font-medium"
      aria-label="Authentication"
    >
      <AuthRouteSwitchLink current={mode === "login"} to="/login">
        Sign in
      </AuthRouteSwitchLink>
      <AuthRouteSwitchLink current={mode === "register"} to="/register">
        Create account
      </AuthRouteSwitchLink>
    </nav>
  );
}

function AuthRouteSwitchLink({
  children,
  current,
  to,
}: {
  children: string;
  current: boolean;
  to: string;
}) {
  return (
    <Link
      to={to}
      aria-current={current ? "page" : undefined}
      className={cn(
        "relative inline-flex min-h-11 items-center justify-center px-3 text-center transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        current ? "text-accent-strong" : "text-muted hover:text-text",
      )}
    >
      {children}
      {current ? (
        <motion.span
          layoutId="auth-route-indicator"
          className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent"
        />
      ) : null}
    </Link>
  );
}

function RegistrationIdentityFields({
  displayName,
  fieldError,
  handle,
  handleReady,
  handleStatus,
  normalizedHandle,
  onDisplayNameChange,
  onHandleChange,
}: {
  displayName: string;
  fieldError: AuthFieldError | undefined;
  handle: string;
  handleReady: boolean;
  handleStatus: HandleCheckStatus;
  normalizedHandle: string;
  onDisplayNameChange: (value: string) => void;
  onHandleChange: (value: string) => void;
}) {
  const displayNameError =
    fieldError?.field === "displayName" ? fieldError.message : undefined;
  const handleError =
    fieldError?.field === "handle" ? fieldError.message : undefined;
  const handleMessage = handleStatusMessage(
    normalizedHandle,
    handleReady,
    handleStatus,
    handleError,
  );

  return (
    <>
      <div>
        <TextField
          id="displayName"
          name="displayName"
          label="Display Name"
          type="text"
          placeholder="Thia"
          autoComplete="name"
          icon={UserRound}
          value={displayName}
          onChange={(event) => onDisplayNameChange(event.currentTarget.value)}
          aria-describedby="display-name-guidance display-name-error"
          aria-invalid={Boolean(displayNameError)}
          required
          minLength={1}
          maxLength={displayNameMaxLength}
        />
        <FieldMessage id="display-name-guidance">
          Shown on posts, profiles, and chats. It doesn’t need to be unique.
        </FieldMessage>
        {displayNameError ? (
          <FieldMessage id="display-name-error" tone="error">
            {displayNameError}
          </FieldMessage>
        ) : null}
      </div>

      <div>
        <HandleField
          id="handle"
          name="handle"
          label="Handle"
          type="text"
          placeholder="thia"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          icon={AtSign}
          value={handle}
          onChange={(event) => onHandleChange(event.currentTarget.value)}
          aria-describedby="handle-guidance handle-status"
          aria-invalid={
            (normalizedHandle.length > 0 && !handleReady) ||
            handleStatus === "unavailable" ||
            Boolean(handleError)
          }
          required
          minLength={3}
          maxLength={41}
          pattern="@?[A-Za-z0-9][A-Za-z0-9_-]{1,38}[A-Za-z0-9]"
          title="Use 3-40 letters, numbers, dashes, or underscores. Start and end with a letter or number."
        />
        <FieldMessage id="handle-guidance">
          Your unique @username, profile URL, and account identifier.
        </FieldMessage>
        <p
          id="handle-status"
          className={cn(
            "mt-1.5 flex min-h-5 items-start gap-1.5 text-xs leading-5",
            handleMessage.tone === "success" && "text-leaf-ink",
            handleMessage.tone === "error" && "text-rose-ink",
            handleMessage.tone === "muted" && "text-muted",
          )}
          aria-live="polite"
        >
          {handleMessage.icon}
          <span>{handleMessage.text}</span>
        </p>
      </div>
    </>
  );
}

function AccountCredentialFields({
  fieldError,
  isRegister,
  onFieldChange,
}: {
  fieldError: AuthFieldError | undefined;
  isRegister: boolean;
  onFieldChange: (field: AuthFieldName) => void;
}) {
  const identifierField = isRegister ? "email" : "identifier";
  const identifierError =
    fieldError?.field === identifierField ? fieldError.message : undefined;
  const passwordError =
    fieldError?.field === "password" ? fieldError.message : undefined;

  return (
    <>
      <div>
        <TextField
          id={identifierField}
          name={identifierField}
          label={isRegister ? "Email" : "Email or Handle"}
          type={isRegister ? "email" : "text"}
          inputMode={isRegister ? "email" : undefined}
          placeholder={isRegister ? "you@example.com" : "you@example.com or @handle"}
          autoComplete={isRegister ? "email" : "username"}
          autoCapitalize="none"
          spellCheck={false}
          icon={isRegister ? Mail : AtSign}
          onChange={() => onFieldChange(identifierField)}
          aria-describedby={
            isRegister ? "email-error" : "identifier-guidance identifier-error"
          }
          aria-invalid={Boolean(identifierError)}
          required
          maxLength={191}
        />
        {isRegister ? null : (
          <FieldMessage id="identifier-guidance">
            Use your email address or unique Handle.
          </FieldMessage>
        )}
        {identifierError ? (
          <FieldMessage
            id={isRegister ? "email-error" : "identifier-error"}
            tone="error"
          >
            {identifierError}
          </FieldMessage>
        ) : null}
      </div>

      <div>
        <PasswordField
          id="password"
          name="password"
          label="Password"
          placeholder="••••••••••"
          autoComplete={isRegister ? "new-password" : "current-password"}
          icon={LockKeyhole}
          onChange={() => onFieldChange("password")}
          aria-describedby={
            isRegister ? "password-guidance password-error" : "password-error"
          }
          aria-invalid={Boolean(passwordError)}
          required
          minLength={isRegister ? 10 : undefined}
          maxLength={255}
        />
        {isRegister ? (
          <FieldMessage id="password-guidance">
            Use at least 10 characters.
          </FieldMessage>
        ) : null}
        {passwordError ? (
          <FieldMessage id="password-error" tone="error">
            {passwordError}
          </FieldMessage>
        ) : null}
      </div>
    </>
  );
}

function AuthLegal({ isRegister }: { isRegister: boolean }) {
  return (
    <p className="mt-5 text-center text-[0.7rem] leading-5 text-muted">
      By {isRegister ? "creating an account" : "signing in"}, you agree to our{" "}
      <AuthLegalLink to="/terms">Terms of Service</AuthLegalLink>,{" "}
      <AuthLegalLink to="/privacy">Privacy Policy</AuthLegalLink>, and{" "}
      <AuthLegalLink to="/community-guidelines">
        Community Guidelines
      </AuthLegalLink>
      .
    </p>
  );
}

function AuthLegalLink({ children, to }: { children: string; to: string }) {
  return (
    <Link
      to={to}
      className="font-medium text-text underline-offset-4 hover:text-accent-strong hover:underline"
    >
      {children}
    </Link>
  );
}

function SignedInAuthState({
  displayName,
  handle,
  mode,
  onLogout,
}: {
  displayName: string;
  handle: string;
  mode: AuthPageProps["mode"];
  onLogout: () => void;
}) {
  return (
    <motion.div
      className="mx-auto max-w-2xl"
      data-testid="auth-page"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <PageMeta
        title={mode === "register" ? "Create account" : "Sign in"}
        description="Your thia.lol account is already signed in."
        path={mode === "register" ? "/register" : "/login"}
      />
      <motion.div variants={cardEntrance} initial="hidden" animate="show">
        <Panel elevated className="p-5 sm:p-7">
          <h1 className="text-2xl font-semibold tracking-[-0.025em] text-text">
            You’re already signed in
          </h1>
          <p className="mt-1.5 text-sm leading-6 text-muted">
            Continue as your current thia.lol identity or switch accounts.
          </p>
          <IdentityPreview
            className="mt-5 border-y border-line py-4"
            displayName={displayName}
            handle={handle}
            label="Current account"
          />
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <ButtonLink className="min-h-12" to={`/@${handle}`} variant="primary">
              View profile
            </ButtonLink>
            <ButtonLink className="min-h-12" to="/" variant="secondary">
              Go home
            </ButtonLink>
            <Button className="min-h-12" type="button" variant="ghost" onClick={onLogout}>
              Log out
            </Button>
          </div>
        </Panel>
      </motion.div>
    </motion.div>
  );
}

function handleStatusMessage(
  normalizedHandle: string,
  handleReady: boolean,
  status: HandleCheckStatus,
  fieldError: string | undefined,
): {
  icon: ReactNode;
  text: string;
  tone: "muted" | "success" | "error";
} {
  if (fieldError) {
    return { icon: <CircleAlert aria-hidden="true" size={14} />, text: fieldError, tone: "error" };
  }

  if (normalizedHandle && !handleReady) {
    return {
      icon: <CircleAlert aria-hidden="true" size={14} />,
      text: "Use 3–40 letters, numbers, dashes, or underscores; start and end with a letter or number.",
      tone: "error",
    };
  }

  if (status === "waiting" || status === "checking") {
    return {
      icon: (
        <LoaderCircle
          aria-hidden="true"
          className="animate-spin motion-reduce:animate-none"
          size={14}
        />
      ),
      text: `Checking @${normalizedHandle}…`,
      tone: "muted",
    };
  }

  if (status === "available") {
    return {
      icon: <Check aria-hidden="true" size={14} />,
      text: `@${normalizedHandle} is available.`,
      tone: "success",
    };
  }

  if (status === "unavailable") {
    return {
      icon: <CircleAlert aria-hidden="true" size={14} />,
      text: `@${normalizedHandle} is already in use or reserved.`,
      tone: "error",
    };
  }

  if (status === "error") {
    return {
      icon: <CircleAlert aria-hidden="true" size={14} />,
      text: "Availability couldn’t be checked. We’ll confirm when you create the account.",
      tone: "muted",
    };
  }

  return {
    icon: null,
    text: "Use 3–40 letters, numbers, dashes, or underscores.",
    tone: "muted",
  };
}

function authFieldError(
  message: string,
  isRegister: boolean,
): AuthFieldError | undefined {
  const normalized = message.toLowerCase();

  if (!isRegister) {
    return undefined;
  }

  if (normalized.startsWith("email or handle")) {
    return undefined;
  }

  if (normalized.startsWith("display name")) {
    return { field: "displayName", message };
  }

  if (normalized.startsWith("handle")) {
    return { field: "handle", message };
  }

  if (normalized.startsWith("email")) {
    return { field: "email", message };
  }

  if (normalized.startsWith("password")) {
    return { field: "password", message };
  }

  return undefined;
}

function stringField(form: FormData, name: string, trim = true): string {
  const value = form.get(name);

  if (typeof value !== "string") {
    return "";
  }

  return trim ? value.trim() : value;
}

function normalizeHandleInput(value: string): string {
  return value.trim().replace(/^@/u, "");
}

function safeLoginReturnTo(value: string | null): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return "/";
  }

  const parsed = new URL(value, "https://thia.lol");

  if (parsed.origin !== "https://thia.lol") {
    return "/";
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
