import {
  Check,
  CheckCircle2,
  ExternalLink,
  Link2,
  Music2,
  RefreshCw,
  SkipForward,
  Sparkles,
  UserRound,
} from "lucide-react";
import { motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { PageMeta } from "../components/PageMeta";
import { ProfileConnectionIcon } from "../components/social/ProfileConnectionIcon";
import { ApiStateNotice } from "../components/ui/ApiStateNotice";
import { Badge } from "../components/ui/Badge";
import { Button, ButtonLink } from "../components/ui/Button";
import { Panel } from "../components/ui/Panel";
import {
  getMyProfileIntegrations,
  getOnboardingState,
  resolveProfileIntegrationMetadata,
  startProfileIntegration,
  updateOnboardingState,
  type OnboardingState,
  type OnboardingStep,
  type ProfileIntegrationAccount,
  type ProfileIntegrationProvider,
  type ProfileIntegrationProviderStatus,
} from "../lib/api";
import { cn } from "../lib/classNames";
import { pageEntrance } from "../lib/motionPresets";
import { useAuth } from "../lib/useAuth";

const oauthProviders = ["spotify", "youtube", "twitch", "github"] as const;
const providerSteps = [...oauthProviders, "apple_music"] as const;

type ReturnNotice = {
  kind: "success" | "error";
  message: string;
};

export function OnboardingPage() {
  const { runWithAuth, status, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<OnboardingState | undefined>();
  const [providers, setProviders] = useState<ProfileIntegrationProviderStatus[]>([]);
  const [accounts, setAccounts] = useState<ProfileIntegrationAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<ReturnNotice | undefined>();
  const [busyAction, setBusyAction] = useState<string | undefined>();
  const [appleMusicUrl, setAppleMusicUrl] = useState("");
  const completed = useMemo(
    () => new Set(state?.completedSteps ?? []),
    [state?.completedSteps],
  );
  const skipped = useMemo(
    () => new Set(state?.skippedSteps ?? []),
    [state?.skippedSteps],
  );
  const connectedProviders = useMemo(
    () =>
      new Set(
        accounts
          .filter((account) => !account.revokedAt)
          .map((account) => account.provider),
      ),
    [accounts],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);

    try {
      const [nextState, integrations] = await Promise.all([
        getOnboardingState(),
        getMyProfileIntegrations(),
      ]);

      setState(nextState);
      setProviders(integrations.providers);
      setAccounts(integrations.accounts);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not load onboarding.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    if (status === "authenticated") {
      queueMicrotask(() => {
        if (active) {
          void load();
        }
      });
    }

    return () => {
      active = false;
    };
  }, [load, status]);

  useEffect(() => {
    const provider = normalizeProviderParam(searchParams.get("integrationProvider"));
    const integrationStatus = searchParams.get("integrationStatus");

    if (!provider || !integrationStatus || status !== "authenticated") {
      return;
    }

    let active = true;

    queueMicrotask(() => {
      if (!active) {
        return;
      }

      if (integrationStatus === "connected") {
        setNotice({
          kind: "success",
          message: `${providerLabel(provider)} connected.`,
        });
        void runWithAuth(
          (csrfToken) =>
            updateOnboardingState(
              { action: "complete_step", step: provider },
              csrfToken,
            ),
          { retryOnCsrf: true },
        )
          .then(setState)
          .catch((caught: unknown) => {
            setError(
              caught instanceof Error ? caught.message : "Could not save setup.",
            );
          })
          .finally(() => void load());
      } else {
        setNotice({
          kind: "error",
          message: providerErrorMessage(
            provider,
            searchParams.get("integrationError"),
          ),
        });
        void load();
      }

      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("integrationProvider");
      nextParams.delete("integrationStatus");
      nextParams.delete("integrationError");
      setSearchParams(nextParams, { replace: true });
    });

    return () => {
      active = false;
    };
  }, [load, runWithAuth, searchParams, setSearchParams, status]);

  if (status === "loading") {
    return <OnboardingLoading />;
  }

  if (status === "anonymous") {
    return <Navigate to="/login" replace />;
  }

  const profileUrl = user ? `/@${user.handle}` : "/";

  async function updateStep(action: "complete_step" | "skip_step", step: OnboardingStep) {
    setBusyAction(`${action}:${step}`);
    setError(undefined);

    try {
      const nextState = await runWithAuth(
        (csrfToken) => updateOnboardingState({ action, step }, csrfToken),
        { retryOnCsrf: true },
      );
      setState(nextState);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save setup.");
    } finally {
      setBusyAction(undefined);
    }
  }

  async function finishOnboarding(target: string) {
    setBusyAction("finish");
    setError(undefined);

    try {
      const nextState = await runWithAuth(
        (csrfToken) => updateOnboardingState({ action: "finish" }, csrfToken),
        { retryOnCsrf: true },
      );
      setState(nextState);
      navigate(target);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not finish setup.");
    } finally {
      setBusyAction(undefined);
    }
  }

  async function dismissOnboarding() {
    setBusyAction("dismiss");
    setError(undefined);

    try {
      await runWithAuth(
        (csrfToken) => updateOnboardingState({ action: "dismiss" }, csrfToken),
        { retryOnCsrf: true },
      );
      navigate(profileUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not skip setup.");
    } finally {
      setBusyAction(undefined);
    }
  }

  async function connectProvider(provider: ProfileIntegrationProvider) {
    setBusyAction(`connect:${provider}`);
    setError(undefined);

    try {
      const result = await runWithAuth(
        (csrfToken) => startProfileIntegration(provider, csrfToken, "/onboarding"),
        { retryOnCsrf: true },
      );

      if (result.authorizationUrl) {
        window.location.assign(result.authorizationUrl);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : `Could not connect ${providerLabel(provider)}.`,
      );
      setBusyAction(undefined);
    }
  }

  async function saveAppleMusicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const url = appleMusicUrl.trim();

    if (!url) {
      return;
    }

    setBusyAction("apple_music:url");
    setError(undefined);

    try {
      await runWithAuth(
        (csrfToken) =>
          resolveProfileIntegrationMetadata(
            { provider: "apple_music", url },
            csrfToken,
          ),
        { retryOnCsrf: true },
      );
      const nextState = await runWithAuth(
        (csrfToken) =>
          updateOnboardingState(
            { action: "save_provider_link", provider: "apple_music", url },
            csrfToken,
          ),
        { retryOnCsrf: true },
      );
      setState(nextState);
      setNotice({ kind: "success", message: "Apple Music link saved." });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save Apple Music.",
      );
    } finally {
      setBusyAction(undefined);
    }
  }

  const providerCompleteCount = providerSteps.filter((provider) =>
    providerComplete(provider, completed, connectedProviders, state),
  ).length;
  const profileBasicsDone =
    completed.has("profile_basics") || skipped.has("profile_basics");
  const canvasDone = completed.has("profile_canvas") || skipped.has("profile_canvas");
  const progressDone =
    providerCompleteCount + Number(profileBasicsDone) + Number(canvasDone);
  const progressTotal = providerSteps.length + 2;

  return (
    <motion.div
      className="mx-auto w-full max-w-5xl space-y-4 sm:space-y-5"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <PageMeta
        title="Profile setup"
        description="Set up your thia.lol profile."
        path="/onboarding"
      />

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Badge tone="warm">setup</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-text">
            Profile setup
          </h1>
          <p className="mt-2 text-sm font-medium text-muted">
            {progressDone}/{progressTotal} steps
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={Boolean(busyAction)}
            icon={<RefreshCw aria-hidden="true" size={16} />}
            onClick={() => void load()}
          >
            Refresh
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={Boolean(busyAction)}
            icon={<SkipForward aria-hidden="true" size={16} />}
            data-testid="onboarding-skip-all"
            onClick={() => void dismissOnboarding()}
          >
            Skip
          </Button>
        </div>
      </section>

      {notice ? (
        <p
          className={cn(
            "rounded-card border p-3 text-sm font-semibold",
            notice.kind === "success"
              ? "border-leaf/30 bg-leaf/15 text-leaf-ink"
              : "border-rose/30 bg-rose/15 text-rose-ink",
          )}
          role={notice.kind === "error" ? "alert" : "status"}
        >
          {notice.message}
        </p>
      ) : null}

      {error ? (
        <p
          className="rounded-card border border-rose/30 bg-rose/15 p-3 text-sm font-semibold text-rose-ink"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {loading ? (
        <OnboardingLoading />
      ) : (
        <div className="grid gap-3">
          <OnboardingStepPanel
            complete={profileBasicsDone}
            icon={<UserRound aria-hidden="true" size={18} />}
            skipped={skipped.has("profile_basics")}
            title="Profile basics"
            action={
              <div className="flex flex-wrap gap-2">
                <ButtonLink
                  to={`${profileUrl}?editCanvas=1`}
                  variant="secondary"
                  size="sm"
                  icon={<ExternalLink aria-hidden="true" size={15} />}
                >
                  Open
                </ButtonLink>
                <Button
                  type="button"
                  size="sm"
                  disabled={busyAction === "complete_step:profile_basics"}
                  icon={<Check aria-hidden="true" size={15} />}
                  onClick={() => void updateStep("complete_step", "profile_basics")}
                >
                  Done
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busyAction === "skip_step:profile_basics"}
                  data-testid="onboarding-profile-basics-skip"
                  onClick={() => void updateStep("skip_step", "profile_basics")}
                >
                  Skip
                </Button>
              </div>
            }
          />

          <div className="grid gap-3 md:grid-cols-2">
            {oauthProviders.map((provider) => {
              const statusForProvider = providers.find(
                (item) => item.provider === provider,
              );
              const account = accounts.find(
                (item) => item.provider === provider && !item.revokedAt,
              );
              const complete = providerComplete(
                provider,
                completed,
                connectedProviders,
                state,
              );

              return (
                <ProviderPanel
                  key={provider}
                  account={account}
                  busy={busyAction === `connect:${provider}`}
                  complete={complete}
                  provider={provider}
                  providerStatus={statusForProvider}
                  skipped={skipped.has(provider)}
                  onConnect={() => void connectProvider(provider)}
                  onSkip={() => void updateStep("skip_step", provider)}
                />
              );
            })}

            <AppleMusicPanel
              busy={busyAction === "apple_music:url"}
              complete={providerComplete(
                "apple_music",
                completed,
                connectedProviders,
                state,
              )}
              savedUrl={state?.providerLinks.apple_music?.url}
              skipped={skipped.has("apple_music")}
              value={appleMusicUrl}
              onChange={setAppleMusicUrl}
              onSkip={() => void updateStep("skip_step", "apple_music")}
              onSubmit={saveAppleMusicLink}
            />
          </div>

          <OnboardingStepPanel
            complete={canvasDone}
            icon={<Sparkles aria-hidden="true" size={18} />}
            skipped={skipped.has("profile_canvas")}
            title="Profile canvas"
            action={
              <div className="flex flex-wrap gap-2">
                <ButtonLink
                  to={`${profileUrl}?editCanvas=1`}
                  variant="secondary"
                  size="sm"
                  icon={<ExternalLink aria-hidden="true" size={15} />}
                >
                  Open
                </ButtonLink>
                <Button
                  type="button"
                  size="sm"
                  disabled={busyAction === "finish"}
                  icon={<Check aria-hidden="true" size={15} />}
                  data-testid="onboarding-finish"
                  onClick={() => void finishOnboarding(profileUrl)}
                >
                  Finish
                </Button>
              </div>
            }
          />
        </div>
      )}
    </motion.div>
  );
}

function OnboardingLoading() {
  return (
    <div className="mx-auto max-w-4xl">
      <ApiStateNotice
        kind="loading"
        title="Loading setup"
        text="Loading profile setup."
      />
    </div>
  );
}

function OnboardingStepPanel({
  action,
  complete,
  icon,
  skipped,
  title,
}: {
  action: ReactNode;
  complete: boolean;
  icon: ReactNode;
  skipped: boolean;
  title: string;
}) {
  return (
    <Panel className="grid gap-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
      <span className="grid size-10 place-items-center rounded-card border border-line bg-canvas/55 text-text">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-text">{title}</h2>
          <StepBadge complete={complete} skipped={skipped} />
        </div>
      </div>
      {action}
    </Panel>
  );
}

function ProviderPanel({
  account,
  busy,
  complete,
  provider,
  providerStatus,
  skipped,
  onConnect,
  onSkip,
}: {
  account: ProfileIntegrationAccount | undefined;
  busy: boolean;
  complete: boolean;
  provider: (typeof oauthProviders)[number];
  providerStatus: ProfileIntegrationProviderStatus | undefined;
  skipped: boolean;
  onConnect: () => void;
  onSkip: () => void;
}) {
  const configured = providerStatus?.oauthEnabled === true;

  return (
    <Panel className="flex min-h-36 flex-col justify-between gap-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-card border border-line bg-canvas/55 text-text">
            <ProfileConnectionIcon platform={provider} size={18} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-text">
              {providerLabel(provider)}
            </h2>
            <p className="mt-1 truncate text-xs font-medium text-muted">
              {account
                ? account.displayName ?? account.providerHandle ?? "Connected"
                : configured
                  ? "Ready"
                  : "Setup needed"}
            </p>
          </div>
        </div>
        <StepBadge complete={complete} skipped={skipped} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!configured || busy || Boolean(account)}
          icon={
            account ? (
              <CheckCircle2 aria-hidden="true" size={15} />
            ) : (
              <Link2 aria-hidden="true" size={15} />
            )
          }
          data-testid={`onboarding-connect-${provider}`}
          onClick={onConnect}
        >
          {account ? "Connected" : busy ? "Opening..." : "Connect"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy || Boolean(account)}
          data-testid={`onboarding-skip-${provider}`}
          onClick={onSkip}
        >
          Skip
        </Button>
      </div>
    </Panel>
  );
}

function AppleMusicPanel({
  busy,
  complete,
  onChange,
  onSkip,
  onSubmit,
  savedUrl,
  skipped,
  value,
}: {
  busy: boolean;
  complete: boolean;
  onChange: (value: string) => void;
  onSkip: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  savedUrl: string | undefined;
  skipped: boolean;
  value: string;
}) {
  return (
    <Panel className="flex min-h-36 flex-col justify-between gap-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-card border border-line bg-canvas/55 text-text">
            <Music2 aria-hidden="true" size={18} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-text">
              Apple Music
            </h2>
            <p className="mt-1 truncate text-xs font-medium text-muted">
              {savedUrl ?? "Paste a music.apple.com link"}
            </p>
          </div>
        </div>
        <StepBadge complete={complete} skipped={skipped} />
      </div>
      <form className="grid gap-2" onSubmit={onSubmit}>
        <input
          className="min-h-10 w-full rounded-control border border-line bg-canvas/55 px-3 text-sm text-text outline-none transition placeholder:text-muted focus:border-line-strong focus:outline-2 focus:outline-focus"
          value={value}
          placeholder="https://music.apple.com/..."
          data-testid="onboarding-apple-music-url"
          onChange={(event) => onChange(event.currentTarget.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={busy || value.trim().length === 0}
            icon={<Check aria-hidden="true" size={15} />}
            data-testid="onboarding-apple-music-save"
          >
            {busy ? "Checking..." : "Save"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            data-testid="onboarding-skip-apple_music"
            onClick={onSkip}
          >
            Skip
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function StepBadge({ complete, skipped }: { complete: boolean; skipped: boolean }) {
  if (complete) {
    return <Badge tone="leaf">done</Badge>;
  }

  if (skipped) {
    return <Badge tone="cool">skipped</Badge>;
  }

  return <Badge>open</Badge>;
}

function providerComplete(
  provider: (typeof providerSteps)[number],
  completed: Set<OnboardingStep>,
  connectedProviders: Set<ProfileIntegrationProvider>,
  state: OnboardingState | undefined,
) {
  return (
    completed.has(provider) ||
    connectedProviders.has(provider) ||
    Boolean(state?.providerLinks[provider])
  );
}

function providerLabel(provider: ProfileIntegrationProvider): string {
  const labels: Record<ProfileIntegrationProvider, string> = {
    apple_music: "Apple Music",
    github: "GitHub",
    spotify: "Spotify",
    twitch: "Twitch",
    youtube: "YouTube",
  };

  return labels[provider];
}

function normalizeProviderParam(value: string | null): ProfileIntegrationProvider | undefined {
  return value === "spotify" ||
    value === "youtube" ||
    value === "twitch" ||
    value === "github" ||
    value === "apple_music"
    ? value
    : undefined;
}

function providerErrorMessage(
  provider: ProfileIntegrationProvider,
  error: string | null,
) {
  const suffix = error ? ` (${error})` : "";

  return `${providerLabel(provider)} did not connect${suffix}.`;
}
