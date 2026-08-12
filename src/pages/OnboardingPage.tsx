import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  LayoutGrid,
  Link2,
  Save,
  Sparkles,
  UserRound,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { PageMeta } from "../components/PageMeta";
import { DesktopNotificationsCard } from "../components/notifications/DesktopNotificationsCard";
import { ProfileConnectionIcon } from "../components/social/ProfileConnectionIcon";
import { ApiStateNotice } from "../components/ui/ApiStateNotice";
import { Button, ButtonLink } from "../components/ui/Button";
import { Panel } from "../components/ui/Panel";
import {
  getMyProfileIntegrations,
  getOnboardingState,
  getProfileIntegrationDiagnostics,
  resolveProfileIntegrationMetadata,
  startProfileIntegration,
  updateOnboardingState,
  type OnboardingState,
  type OnboardingStep,
  type ProfileIntegrationAccount,
  type ProfileIntegrationDiagnostics,
  type ProfileIntegrationProvider,
  type ProfileIntegrationProviderStatus,
} from "../lib/api";
import { cn } from "../lib/classNames";
import { pageEntrance } from "../lib/motionPresets";
import { useAuth } from "../lib/useAuth";

const oauthProviders = ["spotify", "youtube", "twitch", "github"] as const;
const providerSteps = [...oauthProviders, "apple_music"] as const;
type WizardStep =
  | "profile_basics"
  | "integrations"
  | "apple_music"
  | "profile_canvas"
  | "desktop_notifications"
  | "finish";

type ReturnNotice = {
  kind: "success" | "error";
  message: string;
};

type ProviderProblemMap = Partial<Record<ProfileIntegrationProvider, string>>;
type SetupPathId = "identity" | "connect" | "module" | "save";

type SetupPathItem = {
  icon: ReactNode;
  id: SetupPathId;
  label: string;
  step: WizardStep;
};

const onboardingPathItems: SetupPathItem[] = [
  {
    icon: <UserRound aria-hidden="true" size={17} />,
    id: "identity",
    label: "Identity",
    step: "profile_basics",
  },
  {
    icon: <Link2 aria-hidden="true" size={17} />,
    id: "connect",
    label: "Connect",
    step: "integrations",
  },
  {
    icon: <LayoutGrid aria-hidden="true" size={17} />,
    id: "module",
    label: "Place a module",
    step: "profile_canvas",
  },
  {
    icon: <Save aria-hidden="true" size={17} />,
    id: "save",
    label: "Save",
    step: "finish",
  },
];

export function OnboardingPage() {
  const { runWithAuth, status, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const integrationReturnHandledRef = useRef<string | undefined>(undefined);
  const [state, setState] = useState<OnboardingState | undefined>();
  const [providers, setProviders] = useState<
    ProfileIntegrationProviderStatus[]
  >([]);
  const [diagnostics, setDiagnostics] = useState<
    ProfileIntegrationDiagnostics | undefined
  >();
  const [accounts, setAccounts] = useState<ProfileIntegrationAccount[]>([]);
  const [loadingState, setLoadingState] = useState(true);
  const [loadingIntegrations, setLoadingIntegrations] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [integrationError, setIntegrationError] = useState<
    string | undefined
  >();
  const [providerProblems, setProviderProblems] = useState<ProviderProblemMap>(
    {},
  );
  const [notice, setNotice] = useState<ReturnNotice | undefined>();
  const [busyAction, setBusyAction] = useState<string | undefined>();
  const [appleMusicUrl, setAppleMusicUrl] = useState("");
  const [activeStep, setActiveStep] = useState<WizardStep>("profile_basics");
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
  const profileUrl = user ? `/@${user.handle}` : "/";
  const profileTourUrl = `${profileUrl}?editCanvas=1&tour=profile-editor`;
  const loadOnboarding = useCallback(async () => {
    setLoadingState(true);
    setError(undefined);

    try {
      const nextState = await getOnboardingState();

      setState(nextState);
      setActiveStep((current) =>
        current === "profile_basics" ? defaultWizardStep(nextState) : current,
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not load onboarding.",
      );
    } finally {
      setLoadingState(false);
    }
  }, []);

  const loadIntegrations = useCallback(async () => {
    setLoadingIntegrations(true);
    setIntegrationError(undefined);

    const [integrationsResult, diagnosticsResult] = await Promise.allSettled([
      getMyProfileIntegrations(),
      getProfileIntegrationDiagnostics(),
    ]);

    if (integrationsResult.status === "fulfilled") {
      setProviders(integrationsResult.value.providers);
      setAccounts(integrationsResult.value.accounts);
    } else {
      setProviders([]);
      setAccounts([]);
      setIntegrationError(
        integrationsResult.reason instanceof Error
          ? integrationsResult.reason.message
          : "Could not load integration accounts.",
      );
    }

    if (diagnosticsResult.status === "fulfilled") {
      setDiagnostics(diagnosticsResult.value);
      setProviders((current) =>
        current.length > 0 ? current : diagnosticsResult.value.providers,
      );
    } else {
      setDiagnostics(undefined);
      setIntegrationError(
        (current) =>
          current ??
          (diagnosticsResult.reason instanceof Error
            ? diagnosticsResult.reason.message
            : "Could not load integration diagnostics."),
      );
    }

    setLoadingIntegrations(false);
  }, []);

  const reloadAll = useCallback(() => {
    void loadOnboarding();
    void loadIntegrations();
  }, [loadIntegrations, loadOnboarding]);

  useEffect(() => {
    let active = true;

    if (status === "authenticated") {
      queueMicrotask(() => {
        if (active) {
          reloadAll();
        }
      });
    }

    return () => {
      active = false;
    };
  }, [reloadAll, status]);

  useEffect(() => {
    const provider = normalizeProviderParam(
      searchParams.get("integrationProvider"),
    );
    const integrationStatus = searchParams.get("integrationStatus");

    if (!provider || !integrationStatus || status !== "authenticated") {
      return;
    }

    const returnKey = `${provider}:${integrationStatus}:${
      searchParams.get("integrationError") ?? ""
    }`;

    if (integrationReturnHandledRef.current === returnKey) {
      return;
    }

    let active = true;

    queueMicrotask(() => {
      if (!active) {
        return;
      }

      integrationReturnHandledRef.current = returnKey;
      setActiveStep(
        provider === "apple_music" ? "apple_music" : "integrations",
      );

      if (integrationStatus === "connected") {
        setNotice({
          kind: "success",
          message: `${providerLabel(provider)} connected.`,
        });
        setProviderProblems((current) => ({
          ...current,
          [provider]: undefined,
        }));
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
              caught instanceof Error
                ? caught.message
                : "Could not save setup.",
            );
          })
          .finally(() => void loadIntegrations());
      } else {
        const message = providerErrorMessage(
          provider,
          searchParams.get("integrationError"),
        );

        setNotice({ kind: "error", message });
        setProviderProblems((current) => ({ ...current, [provider]: message }));
        void loadIntegrations();
      }

      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("integrationProvider");
      nextParams.delete("integrationStatus");
      nextParams.delete("integrationError");
      const nextSearch = nextParams.toString();
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${
          window.location.hash
        }`,
      );
    });

    return () => {
      active = false;
    };
  }, [loadIntegrations, runWithAuth, searchParams, status]);

  if (status === "loading") {
    return (
      <div data-testid="onboarding-page">
        <OnboardingLoading />
      </div>
    );
  }

  if (status === "anonymous") {
    return <Navigate to="/login" replace />;
  }

  async function updateStep(
    action: "complete_step" | "skip_step",
    step: OnboardingStep,
    nextStep?: WizardStep,
  ) {
    setBusyAction(`${action}:${step}`);
    setError(undefined);

    try {
      const nextState = await runWithAuth(
        (csrfToken) => updateOnboardingState({ action, step }, csrfToken),
        { retryOnCsrf: true },
      );
      setState(nextState);

      if (nextStep) {
        setActiveStep(nextStep);
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save setup.",
      );
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
      setError(
        caught instanceof Error ? caught.message : "Could not finish setup.",
      );
    } finally {
      setBusyAction(undefined);
    }
  }

  async function connectProvider(provider: ProfileIntegrationProvider) {
    setBusyAction(`connect:${provider}`);
    setError(undefined);
    setProviderProblems((current) => ({ ...current, [provider]: undefined }));

    try {
      const result = await runWithAuth(
        (csrfToken) =>
          startProfileIntegration(provider, csrfToken, "/onboarding"),
        { retryOnCsrf: true },
      );

      if (result.authorizationUrl) {
        window.location.assign(result.authorizationUrl);
      }
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : `Could not connect ${providerLabel(provider)}.`;

      setProviderProblems((current) => ({ ...current, [provider]: message }));
      setNotice({ kind: "error", message });
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
      setActiveStep("profile_canvas");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not save Apple Music.",
      );
    } finally {
      setBusyAction(undefined);
    }
  }

  const profileBasicsDone =
    completed.has("profile_basics") || skipped.has("profile_basics");
  const canvasDone =
    completed.has("profile_canvas") || skipped.has("profile_canvas");
  const connectionsDone = providerSteps.some(
    (provider) =>
      providerComplete(provider, completed, connectedProviders, state) ||
      skipped.has(provider),
  );
  const progressDone =
    Number(profileBasicsDone) +
    Number(connectionsDone) +
    Number(canvasDone) +
    Number(Boolean(state?.finishedAt));
  const progressTotal = onboardingPathItems.length;

  return (
    <motion.div
      className="mx-auto w-full max-w-6xl space-y-4 sm:space-y-5"
      data-testid="onboarding-page"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <PageMeta
        title="Build your first profile"
        description="Build your first thia.lol profile."
        path="/onboarding"
      />
      <h1 className="sr-only">Profile setup</h1>

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

      {loadingState ? (
        <OnboardingLoading />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <OnboardingProgressRail
            activeStep={activeStep}
            canvasDone={canvasDone}
            connectionsDone={connectionsDone}
            profileBasicsDone={profileBasicsDone}
            state={state}
            onSelect={setActiveStep}
          />

          <Panel className="overflow-hidden p-0">
            <div className="border-b border-line bg-canvas/42 px-4 py-3 sm:px-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-muted">
                  {progressDone} of {progressTotal}
                </p>
              </div>
              <div
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-line/45"
                role="progressbar"
                aria-label="Profile setup progress"
                aria-valuemin={0}
                aria-valuemax={progressTotal}
                aria-valuenow={progressDone}
              >
                <motion.div
                  className="h-full rounded-full bg-accent"
                  initial={false}
                  animate={{
                    width: `${(progressDone / progressTotal) * 100}%`,
                  }}
                />
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                className="p-4 sm:p-5"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                data-testid={`onboarding-step-${activeStep}`}
              >
                {activeStep === "profile_basics" ? (
                  <ProfileBasicsStep
                    busyAction={busyAction}
                    profileTourUrl={profileTourUrl}
                    onSkip={() =>
                      void updateStep(
                        "skip_step",
                        "profile_basics",
                        "integrations",
                      )
                    }
                  />
                ) : null}

                {activeStep === "integrations" ? (
                  <IntegrationsStep
                    accounts={accounts}
                    busyAction={busyAction}
                    diagnostics={diagnostics}
                    integrationError={integrationError}
                    loading={loadingIntegrations}
                    providerProblems={providerProblems}
                    providers={providers}
                    skipped={skipped}
                    onConnect={(provider) => void connectProvider(provider)}
                    onContinue={() => setActiveStep("apple_music")}
                    onSkip={(provider) =>
                      void updateStep("skip_step", provider, "integrations")
                    }
                  />
                ) : null}

                {activeStep === "apple_music" ? (
                  <AppleMusicStep
                    busy={busyAction === "apple_music:url"}
                    savedUrl={state?.providerLinks.apple_music?.url}
                    value={appleMusicUrl}
                    onBack={() => setActiveStep("integrations")}
                    onChange={setAppleMusicUrl}
                    onContinue={() => setActiveStep("profile_canvas")}
                    onSkip={() =>
                      void updateStep(
                        "skip_step",
                        "apple_music",
                        "profile_canvas",
                      )
                    }
                    onSubmit={saveAppleMusicLink}
                  />
                ) : null}

                {activeStep === "profile_canvas" ? (
                  <ProfileCanvasStep
                    busyAction={busyAction}
                    profileTourUrl={profileTourUrl}
                    onBack={() => setActiveStep("apple_music")}
                    onSkip={() =>
                      void updateStep(
                        "skip_step",
                        "profile_canvas",
                        "desktop_notifications",
                      )
                    }
                  />
                ) : null}

                {activeStep === "desktop_notifications" ? (
                  <DesktopNotificationsStep
                    busyAction={busyAction}
                    onBack={() => setActiveStep("profile_canvas")}
                    onComplete={() =>
                      void updateStep(
                        "complete_step",
                        "desktop_notifications",
                        "finish",
                      )
                    }
                    onSkip={() =>
                      void updateStep(
                        "skip_step",
                        "desktop_notifications",
                        "finish",
                      )
                    }
                  />
                ) : null}

                {activeStep === "finish" ? (
                  <FinishStep
                    busy={busyAction === "finish"}
                    profileUrl={profileUrl}
                    onBack={() => setActiveStep("desktop_notifications")}
                    onFinish={() => void finishOnboarding(profileUrl)}
                  />
                ) : null}
              </motion.div>
            </AnimatePresence>
          </Panel>
        </div>
      )}
    </motion.div>
  );
}

function OnboardingLoading() {
  return (
    <div className="mx-auto max-w-4xl">
      <ApiStateNotice kind="loading" title="Loading setup" />
    </div>
  );
}

function OnboardingProgressRail({
  activeStep,
  canvasDone,
  connectionsDone,
  onSelect,
  profileBasicsDone,
  state,
}: {
  activeStep: WizardStep;
  canvasDone: boolean;
  connectionsDone: boolean;
  onSelect: (step: WizardStep) => void;
  profileBasicsDone: boolean;
  state: OnboardingState | undefined;
}) {
  return (
    <aside className="hidden lg:block">
      <Panel
        className="sticky top-24 grid gap-2 p-3"
        data-testid="onboarding-progress-rail"
      >
        {onboardingPathItems.map((item, index) => {
          const complete = onboardingPathComplete(
            item.id,
            profileBasicsDone,
            connectionsDone,
            canvasDone,
            state,
          );
          const active = onboardingPathItemForStep(activeStep).id === item.id;

          return (
            <button
              key={item.id}
              type="button"
              className={cn(
                "flex min-h-12 items-center gap-3 rounded-control px-3 text-left text-sm font-semibold transition",
                active
                  ? "bg-accent text-accent-ink shadow-soft"
                  : "text-muted hover:bg-surface hover:text-text",
              )}
              data-testid={`onboarding-nav-${item.step}`}
              onClick={() => onSelect(item.step)}
            >
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full border text-xs",
                  complete
                    ? "border-leaf/35 bg-leaf/18 text-leaf-ink"
                    : active
                      ? "border-accent-ink/30 bg-accent-ink/10"
                      : "border-line",
                )}
              >
                {complete ? <Check aria-hidden="true" size={14} /> : index + 1}
              </span>
              <span className="min-w-0 truncate">{item.label}</span>
            </button>
          );
        })}
      </Panel>
    </aside>
  );
}

function ProfileBasicsStep({
  busyAction,
  onSkip,
  profileTourUrl,
}: {
  busyAction: string | undefined;
  onSkip: () => void;
  profileTourUrl: string;
}) {
  return (
    <StepScaffold
      title="Profile basics"
      footer={
        <WizardActions
          back={undefined}
          primary={
            <ButtonLink
              to={profileTourUrl}
              icon={<Sparkles aria-hidden="true" size={16} />}
              data-testid="onboarding-open-profile-tour"
            >
              Open guided editor
            </ButtonLink>
          }
          secondary={
            <Button
              type="button"
              variant="ghost"
              disabled={busyAction === "skip_step:profile_basics"}
              data-testid="onboarding-profile-basics-skip"
              onClick={onSkip}
            >
              Skip
            </Button>
          }
        />
      }
    />
  );
}

function IntegrationsStep({
  accounts,
  busyAction,
  diagnostics,
  integrationError,
  loading,
  providerProblems,
  providers,
  skipped,
  onConnect,
  onContinue,
  onSkip,
}: {
  accounts: ProfileIntegrationAccount[];
  busyAction: string | undefined;
  diagnostics: ProfileIntegrationDiagnostics | undefined;
  integrationError: string | undefined;
  loading: boolean;
  providerProblems: ProviderProblemMap;
  providers: ProfileIntegrationProviderStatus[];
  skipped: Set<OnboardingStep>;
  onConnect: (provider: ProfileIntegrationProvider) => void;
  onContinue: () => void;
  onSkip: (provider: (typeof oauthProviders)[number]) => void;
}) {
  return (
    <StepScaffold
      title="Connections"
      body={
        <div className="grid gap-3 md:grid-cols-2">
          {integrationError ? (
            <p
              className="md:col-span-2 rounded-card border border-rose/30 bg-rose/12 p-3 text-sm font-semibold text-rose-ink"
              role="alert"
              data-testid="onboarding-integrations-error"
            >
              {integrationError}
            </p>
          ) : null}
          {oauthProviders.map((provider) => {
            const statusForProvider =
              providers.find((item) => item.provider === provider) ??
              diagnostics?.providers.find((item) => item.provider === provider);
            const account = accounts.find(
              (item) => item.provider === provider && !item.revokedAt,
            );

            return (
              <ProviderPanel
                key={provider}
                account={account}
                busy={busyAction === `connect:${provider}`}
                diagnostics={diagnostics}
                loading={loading}
                problem={providerProblems[provider]}
                provider={provider}
                providerStatus={statusForProvider}
                skipped={skipped.has(provider)}
                onConnect={() => onConnect(provider)}
                onSkip={() => onSkip(provider)}
              />
            );
          })}
        </div>
      }
      footer={
        <WizardActions
          back={undefined}
          primary={
            <Button
              type="button"
              icon={<ArrowRight aria-hidden="true" size={16} />}
              onClick={onContinue}
            >
              Continue
            </Button>
          }
        />
      }
    />
  );
}

function ProviderPanel({
  account,
  busy,
  diagnostics,
  loading,
  problem,
  provider,
  providerStatus,
  skipped,
  onConnect,
  onSkip,
}: {
  account: ProfileIntegrationAccount | undefined;
  busy: boolean;
  diagnostics: ProfileIntegrationDiagnostics | undefined;
  loading: boolean;
  problem: string | undefined;
  provider: (typeof oauthProviders)[number];
  providerStatus: ProfileIntegrationProviderStatus | undefined;
  skipped: boolean;
  onConnect: () => void;
  onSkip: () => void;
}) {
  const availability = providerAvailability(
    providerStatus,
    diagnostics,
    loading,
    account,
  );
  const disabled = Boolean(account) || availability.disabled || busy;
  const helper = problem ?? availability.message;
  const providerMeta = account
    ? (account.displayName ?? account.providerHandle)
    : undefined;

  return (
    <Panel className="flex flex-col justify-between gap-4 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-card border border-line bg-canvas/55 text-text">
          <ProfileConnectionIcon platform={provider} size={19} />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-text">
            {providerLabel(provider)}
          </h2>
          {providerMeta ? (
            <p className="mt-1 truncate text-xs font-medium text-muted">
              {providerMeta}
            </p>
          ) : null}
        </div>
      </div>
      {helper ? (
        <p
          className={cn(
            "text-xs font-semibold leading-5",
            problem ? "text-rose-ink" : "text-muted",
          )}
          data-testid={`onboarding-provider-message-${provider}`}
        >
          {helper}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={disabled}
          title={disabled ? (helper ?? availability.label) : undefined}
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
        {skipped ? null : (
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
        )}
      </div>
    </Panel>
  );
}

function AppleMusicStep({
  busy,
  onBack,
  onChange,
  onContinue,
  onSkip,
  onSubmit,
  savedUrl,
  value,
}: {
  busy: boolean;
  onBack: () => void;
  onChange: (value: string) => void;
  onContinue: () => void;
  onSkip: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  savedUrl: string | undefined;
  value: string;
}) {
  return (
    <StepScaffold
      title="Apple Music"
      body={
        <Panel className="grid gap-4 p-4">
          {savedUrl ? (
            <p className="break-all text-sm font-medium text-muted">
              Saved: {savedUrl}
            </p>
          ) : null}
          <form className="grid gap-2" onSubmit={onSubmit}>
            <label
              className="text-sm font-semibold text-text"
              htmlFor="onboarding-apple-music-url"
            >
              Apple Music URL
            </label>
            <input
              id="onboarding-apple-music-url"
              type="url"
              className="min-h-11 w-full rounded-control border border-line bg-canvas/55 px-3 text-sm text-text outline-none transition placeholder:text-muted focus:border-line-strong focus:outline-2 focus:outline-focus"
              value={value}
              placeholder="https://music.apple.com/..."
              required
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
                {busy ? "Checking..." : "Save link"}
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
      }
      footer={
        <WizardActions
          back={onBack}
          primary={
            <Button
              type="button"
              icon={<ArrowRight aria-hidden="true" size={16} />}
              onClick={onContinue}
            >
              Continue
            </Button>
          }
        />
      }
    />
  );
}

function ProfileCanvasStep({
  busyAction,
  onBack,
  onSkip,
  profileTourUrl,
}: {
  busyAction: string | undefined;
  onBack: () => void;
  onSkip: () => void;
  profileTourUrl: string;
}) {
  return (
    <StepScaffold
      title="Profile canvas"
      text="This step completes after you finish the editor guide or save the canvas."
      footer={
        <WizardActions
          back={onBack}
          primary={
            <ButtonLink
              to={profileTourUrl}
              icon={<Sparkles aria-hidden="true" size={16} />}
              data-testid="onboarding-open-profile-tour"
            >
              Open guided editor
            </ButtonLink>
          }
          secondary={
            <Button
              type="button"
              variant="ghost"
              disabled={busyAction === "skip_step:profile_canvas"}
              data-testid="onboarding-skip-profile_canvas"
              onClick={onSkip}
            >
              Skip
            </Button>
          }
        />
      }
    />
  );
}

function DesktopNotificationsStep({
  busyAction,
  onBack,
  onComplete,
  onSkip,
}: {
  busyAction: string | undefined;
  onBack: () => void;
  onComplete: () => void;
  onSkip: () => void;
}) {
  return (
    <StepScaffold
      title={null}
      body={
        <DesktopNotificationsCard
          onHandled={(kind) => {
            if (kind === "enabled") {
              onComplete();
            }
          }}
        />
      }
      footer={
        <WizardActions
          back={onBack}
          primary={
            <Button
              type="button"
              icon={<ArrowRight aria-hidden="true" size={16} />}
              disabled={busyAction === "complete_step:desktop_notifications"}
              onClick={onComplete}
            >
              Continue
            </Button>
          }
          secondary={
            <Button
              type="button"
              variant="ghost"
              disabled={busyAction === "skip_step:desktop_notifications"}
              data-testid="onboarding-skip-desktop-notifications"
              onClick={onSkip}
            >
              Skip
            </Button>
          }
        />
      }
    />
  );
}

function FinishStep({
  busy,
  onBack,
  onFinish,
  profileUrl,
}: {
  busy: boolean;
  onBack: () => void;
  onFinish: () => void;
  profileUrl: string;
}) {
  return (
    <StepScaffold
      title="Finish"
      footer={
        <WizardActions
          back={onBack}
          primary={
            <Button
              type="button"
              disabled={busy}
              icon={<Check aria-hidden="true" size={16} />}
              data-testid="onboarding-finish"
              onClick={onFinish}
            >
              {busy ? "Finishing..." : "Finish setup"}
            </Button>
          }
          secondary={
            <ButtonLink
              to={profileUrl}
              variant="ghost"
              icon={<ExternalLink aria-hidden="true" size={16} />}
            >
              Preview first
            </ButtonLink>
          }
        />
      }
    />
  );
}

function StepScaffold({
  body,
  footer,
  text,
  title,
}: {
  body?: ReactNode;
  footer: ReactNode;
  text?: string;
  title: ReactNode;
}) {
  return (
    <div className="grid gap-4">
      {title || text ? (
        <div className="min-w-0">
          {title ? <h2 className="text-lg font-semibold text-text">{title}</h2> : null}
          {text ? (
            <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-muted">
              {text}
            </p>
          ) : null}
        </div>
      ) : null}
      {body}
      {footer}
    </div>
  );
}

function WizardActions({
  back,
  primary,
  secondary,
}: {
  back?: (() => void) | undefined;
  primary: ReactNode;
  secondary?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
      <div>
        {back ? (
          <Button
            type="button"
            variant="ghost"
            icon={<ArrowLeft aria-hidden="true" size={16} />}
            onClick={back}
          >
            Back
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {secondary}
        {primary}
      </div>
    </div>
  );
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

function defaultWizardStep(state: OnboardingState): WizardStep {
  const completed = new Set(state.completedSteps);
  const skipped = new Set(state.skippedSteps);

  if (!completed.has("profile_basics") && !skipped.has("profile_basics")) {
    return "profile_basics";
  }

  if (
    !oauthProviders.some(
      (provider) => completed.has(provider) || skipped.has(provider),
    )
  ) {
    return "integrations";
  }

  if (!completed.has("apple_music") && !skipped.has("apple_music")) {
    return "apple_music";
  }

  if (!completed.has("profile_canvas") && !skipped.has("profile_canvas")) {
    return "profile_canvas";
  }

  if (
    !completed.has("desktop_notifications") &&
    !skipped.has("desktop_notifications")
  ) {
    return "desktop_notifications";
  }

  return "finish";
}

function onboardingPathItemForStep(step: WizardStep): SetupPathItem {
  if (step === "profile_basics") {
    return onboardingPathItems[0]!;
  }

  if (step === "integrations" || step === "apple_music") {
    return onboardingPathItems[1]!;
  }

  if (step === "profile_canvas") {
    return onboardingPathItems[2]!;
  }

  return onboardingPathItems[3]!;
}

function onboardingPathComplete(
  id: SetupPathId,
  profileBasicsDone: boolean,
  connectionsDone: boolean,
  canvasDone: boolean,
  state: OnboardingState | undefined,
): boolean {
  if (id === "identity") {
    return profileBasicsDone;
  }

  if (id === "connect") {
    return connectionsDone;
  }

  if (id === "module") {
    return canvasDone;
  }

  return Boolean(state?.finishedAt);
}

function providerAvailability(
  status: ProfileIntegrationProviderStatus | undefined,
  diagnostics: ProfileIntegrationDiagnostics | undefined,
  loading: boolean,
  account: ProfileIntegrationAccount | undefined,
): { disabled: boolean; label: string; message?: string } {
  if (account) {
    return { disabled: true, label: "Connected" };
  }

  if (loading) {
    return {
      disabled: true,
      label: "Checking",
      message: "Checking connection setup.",
    };
  }

  if (diagnostics && !diagnostics.storageReady) {
    return {
      disabled: true,
      label: "Storage unavailable",
      message: "Integration tables are not ready. Run pending migrations.",
    };
  }

  if (diagnostics && !diagnostics.encryptionConfigured) {
    return {
      disabled: true,
      label: "Encryption setup needed",
      message: "Integration encryption is missing from server config.",
    };
  }

  if (diagnostics && !diagnostics.encryptionAvailable) {
    return {
      disabled: true,
      label: "Encryption unavailable",
      message: "Enable server-side encryption support for OAuth token storage.",
    };
  }

  if (status?.oauthEnabled) {
    return { disabled: false, label: "Ready to connect" };
  }

  if (status) {
    const missing = status.missingConfigKeys?.length
      ? ` Missing: ${status.missingConfigKeys.join(", ")}.`
      : "";

    return {
      disabled: true,
      label: "Server setup needed",
      message: `OAuth is not configured for this provider.${missing}`,
    };
  }

  return {
    disabled: true,
    label: "Temporarily unavailable",
    message: "Could not load this provider's connection status.",
  };
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

function normalizeProviderParam(
  value: string | null,
): ProfileIntegrationProvider | undefined {
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
  const messages: Record<string, string> = {
    invalid_or_expired_state: "The connection expired. Try connecting again.",
    missing_callback_parameters:
      "The provider returned an incomplete response.",
    oauth_callback_failed:
      "The provider approved access, but thia could not finish saving it.",
    provider_error: "The provider cancelled or rejected the connection.",
  };
  const detail = error
    ? (messages[error] ?? error.replaceAll("_", " "))
    : "Try again.";

  return `${providerLabel(provider)} did not connect. ${detail}`;
}
