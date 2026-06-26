import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  Check,
  CheckCircle2,
  ExternalLink,
  LayoutGrid,
  Link2,
  Music2,
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
import { usePageLoadSignal } from "../lib/pageLoadingContext";
import { useAuth } from "../lib/useAuth";

const oauthProviders = ["spotify", "youtube", "twitch", "github"] as const;
const providerSteps = [...oauthProviders, "apple_music"] as const;
type WizardStep =
  | "welcome"
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
  description: string;
  icon: ReactNode;
  id: SetupPathId;
  label: string;
  step: WizardStep;
};

const onboardingPathItems: SetupPathItem[] = [
  {
    description: "Tell the world who you are.",
    icon: <UserRound aria-hidden="true" size={17} />,
    id: "identity",
    label: "Identity",
    step: "profile_basics",
  },
  {
    description: "Link the places you are on.",
    icon: <Link2 aria-hidden="true" size={17} />,
    id: "connect",
    label: "Connect",
    step: "integrations",
  },
  {
    description: "Add something to your canvas.",
    icon: <LayoutGrid aria-hidden="true" size={17} />,
    id: "module",
    label: "Place a module",
    step: "profile_canvas",
  },
  {
    description: "Publish your space to the world.",
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
  usePageLoadSignal(
    status === "loading" ||
      (status === "authenticated" && (loadingState || loadingIntegrations)),
    "setup",
  );

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
  }, [
    loadIntegrations,
    runWithAuth,
    searchParams,
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

  const profileBasicsDone =
    completed.has("profile_basics") || skipped.has("profile_basics");
  const canvasDone = completed.has("profile_canvas") || skipped.has("profile_canvas");
  const desktopNotificationsDone =
    completed.has("desktop_notifications") || skipped.has("desktop_notifications");
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
  const activePathItem = onboardingPathItemForStep(activeStep);
  const welcomeActive = activeStep === "welcome";

  return (
    <motion.div
      className="mx-auto w-full max-w-6xl space-y-4 sm:space-y-5"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <PageMeta
        title="Build your first profile"
        description="Build your first thia.lol profile."
        path="/onboarding"
      />

      <section>
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-normal text-text">
            Build your first profile
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-muted">
            Your profile is a space you compose: start with who you are,
            connect what matters, then place modules on your canvas.
          </p>
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
        <div
          className={cn(
            "grid gap-4",
            welcomeActive
              ? "mx-auto max-w-5xl"
              : "lg:grid-cols-[17rem_minmax(0,1fr)]",
          )}
        >
          {welcomeActive ? null : (
            <OnboardingProgressRail
              activeStep={activeStep}
              canvasDone={canvasDone}
              connectionsDone={connectionsDone}
              profileBasicsDone={profileBasicsDone}
              state={state}
              onSelect={setActiveStep}
            />
          )}

          <Panel
            className={cn(
              "overflow-hidden p-0",
              welcomeActive ? "min-h-0" : "min-h-[34rem]",
            )}
          >
            {welcomeActive ? null : (
              <div className="border-b border-line bg-canvas/42 px-4 py-3 sm:px-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    {progressDone}/{progressTotal} profile moves handled
                  </p>
                  <div className="flex min-w-0 flex-1 justify-end lg:hidden">
                    <span className="truncate text-xs font-semibold text-muted">
                      {activePathItem.label}
                    </span>
                  </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line/45">
                  <motion.div
                    className="h-full rounded-full bg-accent"
                    initial={false}
                    animate={{
                      width: `${Math.max(
                        8,
                        ((onboardingPathItems.indexOf(activePathItem) + 1) /
                          onboardingPathItems.length) *
                          100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

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
                    displayName={user?.displayName ?? user?.handle ?? "you"}
                    handle={user?.handle ?? "you"}
                    profileTourUrl={profileTourUrl}
                    onContinue={() => setActiveStep("profile_basics")}
                  />
                ) : null}

                {activeStep === "profile_basics" ? (
                  <ProfileBasicsStep
                    busyAction={busyAction}
                    done={profileBasicsDone}
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
      <Panel className="sticky top-24 grid gap-2 p-3" data-testid="onboarding-progress-rail">
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
                "flex min-h-16 items-center gap-3 rounded-control px-3 text-left text-sm font-semibold transition",
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
              <span className="min-w-0">
                <span className="block truncate">{item.label}</span>
                <span
                  className={cn(
                    "mt-0.5 block truncate text-xs font-medium",
                    active ? "text-accent-ink/78" : "text-muted",
                  )}
                >
                  {item.description}
                </span>
              </span>
            </button>
          );
        })}
      </Panel>
    </aside>
  );
}

function WelcomeStep({
  displayName,
  handle,
  onContinue,
  profileTourUrl,
}: {
  displayName: string;
  handle: string;
  onContinue: () => void;
  profileTourUrl: string;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.82fr)_minmax(22rem,1.18fr)]">
      <div className="grid content-center gap-6">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold text-text">
            Start by making the canvas real.
          </h2>
          <p className="mt-3 text-base leading-7 text-muted">
            A profile is not a form. It is your identity, the places you are on
            the internet, and modules you can move around until the page feels
            like yours.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ButtonLink
            to={profileTourUrl}
            icon={<ArrowRight aria-hidden="true" size={16} />}
            data-testid="onboarding-start"
          >
            Open guided editor
          </ButtonLink>
          <Button type="button" variant="ghost" onClick={onContinue}>
            Setup checklist
          </Button>
        </div>
      </div>
      <ProfileCanvasPreview displayName={displayName} handle={handle} />
    </div>
  );
}

function ProfileCanvasPreview({
  displayName,
  handle,
}: {
  displayName: string;
  handle: string;
}) {
  return (
    <div
      className="overflow-hidden rounded-card border border-line bg-surface/82 shadow-soft"
      data-testid="onboarding-profile-preview"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-canvas/50 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text">thia.lol / {handle}</p>
          <p className="mt-0.5 text-xs font-medium text-muted">Profile preview</p>
        </div>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-3">
          <span className="grid size-20 place-items-center rounded-full border border-line bg-surface text-3xl shadow-soft">
            {displayName.trim().charAt(0).toUpperCase() || "T"}
          </span>
          <div>
            <p className="truncate text-base font-semibold text-text">
              {displayName}
            </p>
            <p className="truncate text-xs font-semibold text-muted">@{handle}</p>
          </div>
          <p className="text-xs font-medium leading-5 text-muted">
            Start with a name, a little context, and one thing worth placing.
          </p>
        </aside>
        <div className="relative min-h-[22rem] overflow-hidden rounded-card border border-line bg-[linear-gradient(90deg,color-mix(in_oklab,var(--line)_55%,transparent)_1px,transparent_1px),linear-gradient(180deg,color-mix(in_oklab,var(--line)_55%,transparent)_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] p-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_45%,color-mix(in_oklab,var(--app-accent)_16%,transparent),transparent_34%)]" />
          <PreviewModule className="left-[18%] top-[16%]" title="About me" text="A short hello that tells people what kind of space this is." />
          <PreviewModule className="right-[8%] top-[24%]" title="Links" text="GitHub, website, and the places you want visible." />
          <PreviewModule className="bottom-[10%] left-[10%]" title="Now playing" text="A song, playlist, or album that sets the mood." />
          <div className="absolute bottom-[16%] right-[10%] grid size-24 place-items-center rounded-card border border-line bg-canvas/70 text-xs font-semibold text-muted shadow-soft">
            Image
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewModule({
  className,
  text,
  title,
}: {
  className: string;
  text: string;
  title: string;
}) {
  return (
    <div
      className={cn(
        "absolute z-10 w-36 rounded-card border border-line bg-surface/90 p-3 shadow-soft backdrop-blur-veil",
        className,
      )}
    >
      <p className="truncate text-xs font-semibold text-text">{title}</p>
      <p className="mt-2 text-[0.68rem] font-medium leading-4 text-muted">
        {text}
      </p>
    </div>
  );
}

function ProfileBasicsStep({
  busyAction,
  done,
  onSkip,
  profileTourUrl,
}: {
  busyAction: string | undefined;
  done: boolean;
  onSkip: () => void;
  profileTourUrl: string;
}) {
  return (
    <StepScaffold
      badge={done ? "done" : "profile"}
      title="Start with your identity"
      text="Your name, picture, bio, and first modules all live in the editor. Open the guided editor when you are ready to shape the real profile surface."
      icon={<UserRound aria-hidden="true" size={20} />}
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
  onSkip,
  profileTourUrl,
}: {
  busyAction: string | undefined;
  done: boolean;
  onBack: () => void;
  onSkip: () => void;
  profileTourUrl: string;
}) {
  return (
    <StepScaffold
      badge={done ? "done" : "editor"}
      title="Place your first module"
      text="Open the real editor. This step completes when you finish the editor guide or save the canvas."
      icon={<Sparkles aria-hidden="true" size={20} />}
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

function onboardingPathItemForStep(step: WizardStep): SetupPathItem {
  if (step === "profile_basics" || step === "welcome") {
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
