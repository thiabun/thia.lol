import {
  ArrowLeft,
  ArrowRight,
  BellRing,
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
import { AnimatePresence, motion } from "motion/react";
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
import { DesktopNotificationsCard } from "../components/notifications/DesktopNotificationsCard";
import { ProfileConnectionIcon } from "../components/social/ProfileConnectionIcon";
import { ApiStateNotice } from "../components/ui/ApiStateNotice";
import { Badge } from "../components/ui/Badge";
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
const wizardSteps = [
  "welcome",
  "profile_basics",
  "integrations",
  "apple_music",
  "profile_canvas",
  "desktop_notifications",
  "finish",
] as const;

type WizardStep = (typeof wizardSteps)[number];

type ReturnNotice = {
  kind: "success" | "error";
  message: string;
};

type ProviderProblemMap = Partial<Record<ProfileIntegrationProvider, string>>;

export function OnboardingPage() {
  const { runWithAuth, status, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<OnboardingState | undefined>();
  const [providers, setProviders] = useState<ProfileIntegrationProviderStatus[]>([]);
  const [diagnostics, setDiagnostics] = useState<
    ProfileIntegrationDiagnostics | undefined
  >();
  const [accounts, setAccounts] = useState<ProfileIntegrationAccount[]>([]);
  const [loadingState, setLoadingState] = useState(true);
  const [loadingIntegrations, setLoadingIntegrations] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [integrationError, setIntegrationError] = useState<string | undefined>();
  const [providerProblems, setProviderProblems] = useState<ProviderProblemMap>({});
  const [notice, setNotice] = useState<ReturnNotice | undefined>();
  const [busyAction, setBusyAction] = useState<string | undefined>();
  const [appleMusicUrl, setAppleMusicUrl] = useState("");
  const [activeStep, setActiveStep] = useState<WizardStep>("welcome");
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
        current === "welcome" ? defaultWizardStep(nextState) : current,
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
      setIntegrationError((current) =>
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

      setActiveStep(provider === "apple_music" ? "apple_music" : "integrations");

      if (integrationStatus === "connected") {
        setNotice({
          kind: "success",
          message: `${providerLabel(provider)} connected.`,
        });
        setProviderProblems((current) => ({ ...current, [provider]: undefined }));
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
      setSearchParams(nextParams, { replace: true });
    });

    return () => {
      active = false;
    };
  }, [
    loadIntegrations,
    runWithAuth,
    searchParams,
    setSearchParams,
    status,
  ]);

  if (status === "loading") {
    return <OnboardingLoading />;
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
    setProviderProblems((current) => ({ ...current, [provider]: undefined }));

    try {
      const result = await runWithAuth(
        (csrfToken) => startProfileIntegration(provider, csrfToken, "/onboarding"),
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
  const desktopNotificationsDone =
    completed.has("desktop_notifications") || skipped.has("desktop_notifications");
  const progressDone =
    providerCompleteCount +
    Number(profileBasicsDone) +
    Number(canvasDone) +
    Number(desktopNotificationsDone);
  const progressTotal = providerSteps.length + 3;
  const activeStepIndex = wizardSteps.indexOf(activeStep);

  return (
    <motion.div
      className="mx-auto w-full max-w-6xl space-y-4 sm:space-y-5"
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
          <Badge tone="warm">guided setup</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-text">
            Profile setup
          </h1>
          <p className="mt-2 text-sm font-medium text-muted">
            {progressDone}/{progressTotal} setup items handled
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={Boolean(busyAction)}
            icon={<RefreshCw aria-hidden="true" size={16} />}
            onClick={reloadAll}
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
            Skip setup
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

      {loadingState ? (
        <OnboardingLoading />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <OnboardingProgressRail
            activeStep={activeStep}
            canvasDone={canvasDone}
            desktopNotificationsDone={desktopNotificationsDone}
            connectedProviders={connectedProviders}
            profileBasicsDone={profileBasicsDone}
            state={state}
            onSelect={setActiveStep}
          />

          <Panel className="min-h-[34rem] overflow-hidden p-0">
            <div className="border-b border-line bg-canvas/42 px-4 py-3 sm:px-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                  Step {activeStepIndex + 1} of {wizardSteps.length}
                </p>
                <div className="flex min-w-0 flex-1 justify-end lg:hidden">
                  <span className="truncate text-xs font-semibold text-muted">
                    {wizardStepLabel(activeStep)}
                  </span>
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line/45">
                <motion.div
                  className="h-full rounded-full bg-accent"
                  initial={false}
                  animate={{
                    width: `${((activeStepIndex + 1) / wizardSteps.length) * 100}%`,
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
                {activeStep === "welcome" ? (
                  <WelcomeStep
                    onContinue={() => setActiveStep("profile_basics")}
                    onSkip={() => void dismissOnboarding()}
                  />
                ) : null}

                {activeStep === "profile_basics" ? (
                  <ProfileBasicsStep
                    busyAction={busyAction}
                    done={profileBasicsDone}
                    profileTourUrl={profileTourUrl}
                    profileUrl={profileUrl}
                    onComplete={() =>
                      void updateStep(
                        "complete_step",
                        "profile_basics",
                        "integrations",
                      )
                    }
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
                    completed={completed}
                    connectedProviders={connectedProviders}
                    diagnostics={diagnostics}
                    integrationError={integrationError}
                    loading={loadingIntegrations}
                    providerProblems={providerProblems}
                    providers={providers}
                    skipped={skipped}
                    state={state}
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
                    complete={providerComplete(
                      "apple_music",
                      completed,
                      connectedProviders,
                      state,
                    )}
                    savedUrl={state?.providerLinks.apple_music?.url}
                    skipped={skipped.has("apple_music")}
                    value={appleMusicUrl}
                    onBack={() => setActiveStep("integrations")}
                    onChange={setAppleMusicUrl}
                    onContinue={() => setActiveStep("profile_canvas")}
                    onSkip={() =>
                      void updateStep("skip_step", "apple_music", "profile_canvas")
                    }
                    onSubmit={saveAppleMusicLink}
                  />
                ) : null}

                {activeStep === "profile_canvas" ? (
                  <ProfileCanvasStep
                    busyAction={busyAction}
                    done={canvasDone}
                    profileTourUrl={profileTourUrl}
                    profileUrl={profileUrl}
                    onBack={() => setActiveStep("apple_music")}
                    onComplete={() =>
                      void updateStep(
                        "complete_step",
                        "profile_canvas",
                        "desktop_notifications",
                      )
                    }
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
                    done={desktopNotificationsDone}
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
                    progressDone={progressDone}
                    progressTotal={progressTotal}
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
      <ApiStateNotice
        kind="loading"
        title="Loading setup"
        text="Loading profile setup."
      />
    </div>
  );
}

function OnboardingProgressRail({
  activeStep,
  canvasDone,
  desktopNotificationsDone,
  connectedProviders,
  onSelect,
  profileBasicsDone,
  state,
}: {
  activeStep: WizardStep;
  canvasDone: boolean;
  desktopNotificationsDone: boolean;
  connectedProviders: Set<ProfileIntegrationProvider>;
  onSelect: (step: WizardStep) => void;
  profileBasicsDone: boolean;
  state: OnboardingState | undefined;
}) {
  return (
    <aside className="hidden lg:block">
      <Panel className="sticky top-24 grid gap-2 p-3" data-testid="onboarding-progress-rail">
        {wizardSteps.map((step, index) => {
          const complete = wizardStepComplete(
            step,
            profileBasicsDone,
            canvasDone,
            desktopNotificationsDone,
            connectedProviders,
            state,
          );
          const active = activeStep === step;

          return (
            <button
              key={step}
              type="button"
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-control px-3 text-left text-sm font-semibold transition",
                active
                  ? "bg-accent text-accent-ink shadow-soft"
                  : "text-muted hover:bg-surface hover:text-text",
              )}
              data-testid={`onboarding-nav-${step}`}
              onClick={() => onSelect(step)}
            >
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full border text-xs",
                  complete
                    ? "border-leaf/35 bg-leaf/18 text-leaf-ink"
                    : active
                      ? "border-accent-ink/30 bg-accent-ink/10"
                      : "border-line",
                )}
              >
                {complete ? <Check aria-hidden="true" size={13} /> : index + 1}
              </span>
              <span className="truncate">{wizardStepLabel(step)}</span>
            </button>
          );
        })}
      </Panel>
    </aside>
  );
}

function WelcomeStep({
  onContinue,
  onSkip,
}: {
  onContinue: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="grid min-h-[27rem] content-center gap-6">
      <div className="max-w-2xl">
        <Badge tone="warm">start here</Badge>
        <h2 className="mt-3 text-3xl font-semibold text-text">
          Make your profile feel like yours.
        </h2>
        <p className="mt-3 text-base leading-7 text-muted">
          This setup walks through the pieces that make a profile useful:
          identity, connected accounts, music links, and the canvas editor.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <SetupPreviewCard icon={<UserRound size={18} />} title="Basics" />
        <SetupPreviewCard icon={<Link2 size={18} />} title="Integrations" />
        <SetupPreviewCard icon={<Sparkles size={18} />} title="Profile canvas" />
        <SetupPreviewCard icon={<BellRing size={18} />} title="Notifications" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          icon={<ArrowRight aria-hidden="true" size={16} />}
          data-testid="onboarding-start"
          onClick={onContinue}
        >
          Start setup
        </Button>
        <Button type="button" variant="ghost" onClick={onSkip}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}

function SetupPreviewCard({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="rounded-card border border-line bg-canvas/45 p-4">
      <span className="grid size-10 place-items-center rounded-card border border-line bg-surface text-text">
        {icon}
      </span>
      <p className="mt-3 text-sm font-semibold text-text">{title}</p>
    </div>
  );
}

function ProfileBasicsStep({
  busyAction,
  done,
  onComplete,
  onSkip,
  profileTourUrl,
  profileUrl,
}: {
  busyAction: string | undefined;
  done: boolean;
  onComplete: () => void;
  onSkip: () => void;
  profileTourUrl: string;
  profileUrl: string;
}) {
  return (
    <StepScaffold
      badge={done ? "done" : "profile"}
      title="Start with your identity"
      text="Add a profile picture, banner, name, and a short bio. You can do the full canvas tour now or just mark this step done."
      icon={<UserRound aria-hidden="true" size={20} />}
      footer={
        <WizardActions
          back={undefined}
          primary={
            <Button
              type="button"
              icon={<Check aria-hidden="true" size={16} />}
              disabled={busyAction === "complete_step:profile_basics"}
              onClick={onComplete}
            >
              Done
            </Button>
          }
          secondary={
            <>
              <ButtonLink
                to={profileTourUrl}
                variant="secondary"
                icon={<Sparkles aria-hidden="true" size={16} />}
                data-testid="onboarding-open-profile-tour"
              >
                Open editor guide
              </ButtonLink>
              <ButtonLink
                to={profileUrl}
                variant="ghost"
                icon={<ExternalLink aria-hidden="true" size={16} />}
              >
                View profile
              </ButtonLink>
              <Button
                type="button"
                variant="ghost"
                disabled={busyAction === "skip_step:profile_basics"}
                data-testid="onboarding-profile-basics-skip"
                onClick={onSkip}
              >
                Skip
              </Button>
            </>
          }
        />
      }
    />
  );
}

function IntegrationsStep({
  accounts,
  busyAction,
  completed,
  connectedProviders,
  diagnostics,
  integrationError,
  loading,
  providerProblems,
  providers,
  skipped,
  state,
  onConnect,
  onContinue,
  onSkip,
}: {
  accounts: ProfileIntegrationAccount[];
  busyAction: string | undefined;
  completed: Set<OnboardingStep>;
  connectedProviders: Set<ProfileIntegrationProvider>;
  diagnostics: ProfileIntegrationDiagnostics | undefined;
  integrationError: string | undefined;
  loading: boolean;
  providerProblems: ProviderProblemMap;
  providers: ProfileIntegrationProviderStatus[];
  skipped: Set<OnboardingStep>;
  state: OnboardingState | undefined;
  onConnect: (provider: ProfileIntegrationProvider) => void;
  onContinue: () => void;
  onSkip: (provider: (typeof oauthProviders)[number]) => void;
}) {
  return (
    <StepScaffold
      badge="accounts"
      title="Connect the accounts you want to show off"
      text="These connections power richer modules and suggestions. You can skip any provider and come back later from profile editing."
      icon={<Link2 aria-hidden="true" size={20} />}
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
  complete,
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
  complete: boolean;
  diagnostics: ProfileIntegrationDiagnostics | undefined;
  loading: boolean;
  problem: string | undefined;
  provider: (typeof oauthProviders)[number];
  providerStatus: ProfileIntegrationProviderStatus | undefined;
  skipped: boolean;
  onConnect: () => void;
  onSkip: () => void;
}) {
  const availability = providerAvailability(providerStatus, diagnostics, loading, account);
  const disabled = Boolean(account) || availability.disabled || busy;
  const helper = problem ?? availability.message;

  return (
    <Panel className="flex min-h-44 flex-col justify-between gap-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-card border border-line bg-canvas/55 text-text">
            <ProfileConnectionIcon platform={provider} size={19} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-text">
              {providerLabel(provider)}
            </h2>
            <p className="mt-1 truncate text-xs font-medium text-muted">
              {account
                ? account.displayName ?? account.providerHandle ?? "Connected"
                : availability.label}
            </p>
          </div>
        </div>
        <StepBadge complete={complete} skipped={skipped} />
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
          title={disabled ? helper : undefined}
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

function AppleMusicStep({
  busy,
  complete,
  onBack,
  onChange,
  onContinue,
  onSkip,
  onSubmit,
  savedUrl,
  skipped,
  value,
}: {
  busy: boolean;
  complete: boolean;
  onBack: () => void;
  onChange: (value: string) => void;
  onContinue: () => void;
  onSkip: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  savedUrl: string | undefined;
  skipped: boolean;
  value: string;
}) {
  return (
    <StepScaffold
      badge="music"
      title="Add Apple Music by link"
      text="Apple Music stays manual for now. Paste a public music.apple.com song, album, playlist, or artist URL and we will validate it before saving."
      icon={<Music2 aria-hidden="true" size={20} />}
      body={
        <Panel className="grid gap-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-text">Apple Music</h2>
              <p className="mt-1 text-sm font-medium text-muted">
                {savedUrl ?? "Paste a music.apple.com link"}
              </p>
            </div>
            <StepBadge complete={complete} skipped={skipped} />
          </div>
          <form className="grid gap-2" onSubmit={onSubmit}>
            <input
              className="min-h-11 w-full rounded-control border border-line bg-canvas/55 px-3 text-sm text-text outline-none transition placeholder:text-muted focus:border-line-strong focus:outline-2 focus:outline-focus"
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
  done,
  onBack,
  onComplete,
  onSkip,
  profileTourUrl,
  profileUrl,
}: {
  busyAction: string | undefined;
  done: boolean;
  onBack: () => void;
  onComplete: () => void;
  onSkip: () => void;
  profileTourUrl: string;
  profileUrl: string;
}) {
  return (
    <StepScaffold
      badge={done ? "done" : "editor"}
      title="Learn the profile canvas"
      text="The editor lets you place modules, resize them, connect providers, upload media, and save the whole profile canvas."
      icon={<Sparkles aria-hidden="true" size={20} />}
      body={
        <div className="grid gap-3 md:grid-cols-2">
          {[
            "Pick a rectangle on the grid.",
            "Choose a module that fits that size.",
            "Use settings to connect, upload, or write.",
            "Drag, pin, resize, then save.",
          ].map((item) => (
            <div
              key={item}
              className="rounded-card border border-line bg-canvas/45 p-4 text-sm font-semibold text-muted"
            >
              {item}
            </div>
          ))}
        </div>
      }
      footer={
        <WizardActions
          back={onBack}
          primary={
            <Button
              type="button"
              icon={<Check aria-hidden="true" size={16} />}
              disabled={busyAction === "complete_step:profile_canvas"}
              onClick={onComplete}
            >
              Done
            </Button>
          }
          secondary={
            <>
              <ButtonLink
                to={profileTourUrl}
                variant="secondary"
                icon={<Sparkles aria-hidden="true" size={16} />}
                data-testid="onboarding-open-profile-tour"
              >
                Open guided editor
              </ButtonLink>
              <ButtonLink
                to={profileUrl}
                variant="ghost"
                icon={<ExternalLink aria-hidden="true" size={16} />}
              >
                View profile
              </ButtonLink>
              <Button
                type="button"
                variant="ghost"
                disabled={busyAction === "skip_step:profile_canvas"}
                onClick={onSkip}
              >
                Skip
              </Button>
            </>
          }
        />
      }
    />
  );
}

function DesktopNotificationsStep({
  busyAction,
  done,
  onBack,
  onComplete,
  onSkip,
}: {
  busyAction: string | undefined;
  done: boolean;
  onBack: () => void;
  onComplete: () => void;
  onSkip: () => void;
}) {
  return (
    <StepScaffold
      badge={done ? "done" : "desktop"}
      title="Turn on desktop notifications"
      text="Desktop notifications are optional. Enable this browser to get follows, mentions, messages, and other chosen notification categories outside the app."
      icon={<BellRing aria-hidden="true" size={20} />}
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
  progressDone,
  progressTotal,
}: {
  busy: boolean;
  onBack: () => void;
  onFinish: () => void;
  profileUrl: string;
  progressDone: number;
  progressTotal: number;
}) {
  return (
    <StepScaffold
      badge="ready"
      title="You are ready to move in"
      text={`${progressDone}/${progressTotal} setup items are handled. You can finish now and keep tuning your profile whenever you want.`}
      icon={<CheckCircle2 aria-hidden="true" size={20} />}
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
  badge,
  body,
  footer,
  icon,
  text,
  title,
}: {
  badge: string;
  body?: ReactNode;
  footer: ReactNode;
  icon: ReactNode;
  text: string;
  title: string;
}) {
  return (
    <div className="grid gap-5">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-card border border-line bg-surface text-text shadow-soft">
          {icon}
        </span>
        <div className="min-w-0">
          <Badge>{badge}</Badge>
          <h2 className="mt-3 text-2xl font-semibold text-text">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-muted">
            {text}
          </p>
        </div>
      </div>
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

function wizardStepComplete(
  step: WizardStep,
  profileBasicsDone: boolean,
  canvasDone: boolean,
  desktopNotificationsDone: boolean,
  connectedProviders: Set<ProfileIntegrationProvider>,
  state: OnboardingState | undefined,
): boolean {
  if (step === "welcome") {
    return true;
  }

  if (step === "profile_basics") {
    return profileBasicsDone;
  }

  if (step === "integrations") {
    return oauthProviders.some((provider) =>
      providerComplete(provider, new Set(state?.completedSteps ?? []), connectedProviders, state),
    );
  }

  if (step === "apple_music") {
    return providerComplete(
      "apple_music",
      new Set(state?.completedSteps ?? []),
      connectedProviders,
      state,
    );
  }

  if (step === "profile_canvas") {
    return canvasDone;
  }

  if (step === "desktop_notifications") {
    return desktopNotificationsDone;
  }

  return Boolean(state?.finishedAt);
}

function defaultWizardStep(state: OnboardingState): WizardStep {
  const completed = new Set(state.completedSteps);
  const skipped = new Set(state.skippedSteps);

  if (!completed.has("profile_basics") && !skipped.has("profile_basics")) {
    return "welcome";
  }

  if (!oauthProviders.some((provider) => completed.has(provider) || skipped.has(provider))) {
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

function wizardStepLabel(step: WizardStep): string {
  const labels: Record<WizardStep, string> = {
    apple_music: "Apple Music",
    desktop_notifications: "Notifications",
    finish: "Finish",
    integrations: "Integrations",
    profile_basics: "Profile basics",
    profile_canvas: "Profile editor",
    welcome: "Welcome",
  };

  return labels[step];
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
    return { disabled: true, label: "Checking", message: "Checking connection setup." };
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
      message: "Enable PHP Sodium or OpenSSL for OAuth token storage.",
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
  const messages: Record<string, string> = {
    invalid_or_expired_state: "The connection expired. Try connecting again.",
    missing_callback_parameters: "The provider returned an incomplete response.",
    oauth_callback_failed: "The provider approved access, but thia could not finish saving it.",
    provider_error: "The provider cancelled or rejected the connection.",
  };
  const detail = error ? messages[error] ?? error.replaceAll("_", " ") : "Try again.";

  return `${providerLabel(provider)} did not connect. ${detail}`;
}
