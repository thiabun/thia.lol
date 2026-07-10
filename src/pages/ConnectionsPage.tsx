import {
  ArrowLeft,
  CheckCircle2,
  Link2,
  RefreshCw,
  Unlink,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { PageMeta } from "../components/PageMeta";
import { ProfileConnectionIcon } from "../components/social/ProfileConnectionIcon";
import { ApiStateNotice } from "../components/ui/ApiStateNotice";
import { Badge } from "../components/ui/Badge";
import { Button, ButtonLink } from "../components/ui/Button";
import { ModalSheet } from "../components/ui/ModalSheet";
import { Panel } from "../components/ui/Panel";
import { RouteHeader } from "../components/ui/RouteState";
import {
  disconnectProfileIntegration,
  getMyProfileIntegrations,
  getProfileIntegrationDiagnostics,
  startProfileIntegration,
  type ProfileIntegrationAccount,
  type ProfileIntegrationDiagnostics,
  type ProfileIntegrationsResult,
} from "../lib/api";
import { cn } from "../lib/classNames";
import { useAuth } from "../lib/useAuth";

const connectionsPath = "/settings/connections";
const managedProviders = ["spotify", "youtube", "twitch", "github"] as const;

type ManagedProvider = (typeof managedProviders)[number];
type Notice = { kind: "error" | "success"; message: string };

const providerLabels: Record<ManagedProvider, string> = {
  spotify: "Spotify",
  youtube: "YouTube",
  twitch: "Twitch",
  github: "GitHub",
};

export function ConnectionsPage() {
  const { runWithAuth, status } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const callbackHandledRef = useRef<string | undefined>(undefined);
  const [connections, setConnections] = useState<ProfileIntegrationsResult>();
  const [diagnostics, setDiagnostics] = useState<ProfileIntegrationDiagnostics>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<Notice>();
  const [busyProvider, setBusyProvider] = useState<ManagedProvider>();
  const [disconnectTarget, setDisconnectTarget] = useState<ManagedProvider>();

  const loadConnections = useCallback(async () => {
    setLoading(true);
    setError(undefined);

    const [connectionsResult, diagnosticsResult] = await Promise.allSettled([
      getMyProfileIntegrations(),
      getProfileIntegrationDiagnostics(),
    ]);

    if (connectionsResult.status === "fulfilled") {
      setConnections(connectionsResult.value);
    } else {
      setConnections(undefined);
      setError(
        connectionsResult.reason instanceof Error
          ? connectionsResult.reason.message
          : "Connections could not load.",
      );
    }

    setDiagnostics(
      diagnosticsResult.status === "fulfilled" ? diagnosticsResult.value : undefined,
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status !== "authenticated") {
      return undefined;
    }

    let active = true;

    queueMicrotask(() => {
      if (active) {
        void loadConnections();
      }
    });

    return () => {
      active = false;
    };
  }, [loadConnections, status]);

  useEffect(() => {
    const provider = managedProviderFromValue(searchParams.get("integrationProvider"));
    const integrationStatus = searchParams.get("integrationStatus");

    if (!provider || !integrationStatus || status !== "authenticated") {
      return undefined;
    }

    const callbackKey = `${provider}:${integrationStatus}:${
      searchParams.get("integrationError") ?? ""
    }`;

    if (callbackHandledRef.current === callbackKey) {
      return undefined;
    }

    let active = true;

    queueMicrotask(() => {
      if (!active) {
        return;
      }

      callbackHandledRef.current = callbackKey;
      setNotice(
        integrationStatus === "connected"
          ? {
              kind: "success",
              message: `${providerLabels[provider]} connected.`,
            }
          : {
              kind: "error",
              message: providerCallbackError(provider, searchParams.get("integrationError")),
            },
      );

      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("integrationProvider");
      nextParams.delete("integrationStatus");
      nextParams.delete("integrationError");
      const nextSearch = nextParams.toString();

      navigate(
        {
          pathname: connectionsPath,
          search: nextSearch ? `?${nextSearch}` : "",
        },
        { replace: true },
      );
    });

    return () => {
      active = false;
    };
  }, [navigate, searchParams, status]);

  async function handleConnect(provider: ManagedProvider) {
    setBusyProvider(provider);
    setError(undefined);
    setNotice(undefined);

    try {
      const result = await runWithAuth(
        (csrfToken) => startProfileIntegration(provider, csrfToken, connectionsPath),
        { retryOnCsrf: true },
      );

      if (!result.authorizationUrl) {
        throw new Error(`${providerLabels[provider]} did not return a connection link.`);
      }

      window.location.assign(result.authorizationUrl);
    } catch (caught) {
      setNotice({
        kind: "error",
        message:
          caught instanceof Error
            ? caught.message
            : `${providerLabels[provider]} could not connect.`,
      });
      setBusyProvider(undefined);
    }
  }

  async function handleDisconnect() {
    const provider = disconnectTarget;

    if (!provider) {
      return;
    }

    setBusyProvider(provider);
    setError(undefined);
    setNotice(undefined);

    try {
      const nextConnections = await runWithAuth(
        (csrfToken) => disconnectProfileIntegration(provider, csrfToken),
        { retryOnCsrf: true },
      );
      setConnections(nextConnections);
      setDisconnectTarget(undefined);
      setNotice({
        kind: "success",
        message: `${providerLabels[provider]} disconnected.`,
      });
    } catch (caught) {
      setNotice({
        kind: "error",
        message:
          caught instanceof Error
            ? caught.message
            : `${providerLabels[provider]} could not disconnect.`,
      });
    } finally {
      setBusyProvider(undefined);
    }
  }

  if (status === "anonymous") {
    return <Navigate to={`/login?returnTo=${encodeURIComponent(connectionsPath)}`} replace />;
  }

  const disconnectLabel = disconnectTarget
    ? providerLabels[disconnectTarget]
    : "connection";

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 px-3 py-5 sm:px-4 lg:px-6">
      <PageMeta
        title="Connections"
        description="Manage connected provider accounts."
        path={connectionsPath}
      />
      <RouteHeader
        surface="bare"
        title="Connections"
        description="Connect accounts that can power profile modules and suggestions."
        actions={
          <ButtonLink
            to="/settings"
            size="sm"
            variant="ghost"
            icon={<ArrowLeft aria-hidden="true" size={15} />}
          >
            Back to Settings
          </ButtonLink>
        }
      />

      {notice ? <ConnectionsNotice tone={notice.kind}>{notice.message}</ConnectionsNotice> : null}

      {status === "loading" || (loading && !connections) ? (
        <ApiStateNotice
          kind="loading"
          title="Loading connections"
          text="Checking connected provider accounts."
          testId="connections-loading"
        />
      ) : error || !connections ? (
        <ApiStateNotice
          kind="error"
          title="Connections could not load"
          text={error ?? "Try again in a moment."}
          testId="connections-error"
          actions={
            <Button
              type="button"
              size="sm"
              variant="secondary"
              icon={<RefreshCw aria-hidden="true" size={15} />}
              onClick={() => void loadConnections()}
            >
              Try again
            </Button>
          }
        />
      ) : (
        <Panel className="overflow-hidden" data-testid="connections-provider-list">
          <div className="border-b border-line/65 px-3 py-3 sm:px-4">
            <h2 className="text-base font-semibold text-text">Provider accounts</h2>
            <p className="mt-1 text-sm leading-5 text-muted">
              Public profile links and Apple Music links stay in profile editing.
            </p>
          </div>
          <div className="divide-y divide-line/65">
            {managedProviders.map((provider) => {
              const providerStatus = connections.providers.find(
                (item) => item.provider === provider,
              );
              const account = activeAccountForProvider(connections.accounts, provider);
              const availability = providerAvailability(providerStatus?.oauthEnabled, diagnostics);
              const busy = busyProvider === provider;

              return (
                <div
                  key={provider}
                  className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-3 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:px-4"
                  data-testid={`connections-provider-row-${provider}`}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-control border border-line bg-canvas/55 text-text">
                    <ProfileConnectionIcon platform={provider} size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-text">
                        {providerLabels[provider]}
                      </h3>
                      {account ? (
                        <Badge tone="leaf" data-testid={`connections-status-${provider}`}>
                          Connected
                        </Badge>
                      ) : availability.available ? (
                        <Badge data-testid={`connections-status-${provider}`}>
                          Ready to connect
                        </Badge>
                      ) : (
                        <Badge tone="cool" data-testid={`connections-status-${provider}`}>
                          Not available
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm text-muted">
                      {account
                        ? connectedAccountLabel(account)
                        : availability.available
                          ? `Connect your ${providerLabels[provider]} account.`
                          : availability.message}
                    </p>
                  </div>
                  <div className="col-start-2 flex shrink-0 flex-wrap items-center gap-2 sm:col-start-auto sm:justify-end">
                    {account ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        icon={<Unlink aria-hidden="true" size={15} />}
                        data-testid={`connections-disconnect-${provider}`}
                        onClick={() => setDisconnectTarget(provider)}
                      >
                        {busy ? "Disconnecting" : "Disconnect"}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        disabled={!availability.available || busy}
                        icon={<Link2 aria-hidden="true" size={15} />}
                        data-testid={`connections-connect-${provider}`}
                        onClick={() => void handleConnect(provider)}
                      >
                        {busy ? "Opening" : "Connect"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <ModalSheet
        open={disconnectTarget !== undefined}
        onClose={() => setDisconnectTarget(undefined)}
        title={`Disconnect ${disconnectLabel}?`}
        description="Remove this provider account from thia.lol."
        closeLabel="Close disconnect confirmation"
        size="sm"
        mobile="dialog"
        busy={disconnectTarget !== undefined && busyProvider === disconnectTarget}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={disconnectTarget !== undefined && busyProvider === disconnectTarget}
              onClick={() => setDisconnectTarget(undefined)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              icon={<Unlink aria-hidden="true" size={15} />}
              disabled={disconnectTarget !== undefined && busyProvider === disconnectTarget}
              data-testid="connections-confirm-disconnect"
              onClick={() => void handleDisconnect()}
            >
              {disconnectTarget !== undefined && busyProvider === disconnectTarget
                ? "Disconnecting"
                : "Disconnect"}
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-6 text-muted">
          This revokes thia.lol&apos;s local connection and stops new authenticated
          provider data. Existing public modules and links stay visible until you edit
          or remove them.
        </p>
      </ModalSheet>
    </main>
  );
}

function activeAccountForProvider(
  accounts: ProfileIntegrationAccount[],
  provider: ManagedProvider,
): ProfileIntegrationAccount | undefined {
  return accounts.find((account) => account.provider === provider && !account.revokedAt);
}

function connectedAccountLabel(account: ProfileIntegrationAccount): string {
  const identity = account.displayName?.trim() || account.providerHandle?.trim();

  return identity || "Connected account";
}

function providerAvailability(
  oauthEnabled: boolean | undefined,
  diagnostics: ProfileIntegrationDiagnostics | undefined,
): { available: boolean; message: string } {
  if (
    diagnostics &&
    (!diagnostics.storageReady ||
      !diagnostics.encryptionConfigured ||
      !diagnostics.encryptionAvailable)
  ) {
    return {
      available: false,
      message: "Connection setup is not available right now.",
    };
  }

  if (oauthEnabled) {
    return { available: true, message: "Ready to connect." };
  }

  return {
    available: false,
    message: "This provider is not available right now.",
  };
}

function managedProviderFromValue(value: string | null): ManagedProvider | undefined {
  return managedProviders.find((provider) => provider === value);
}

function providerCallbackError(provider: ManagedProvider, error: string | null): string {
  const messages: Record<string, string> = {
    invalid_or_expired_state: "The connection expired. Try connecting again.",
    missing_callback_parameters: "The provider returned an incomplete response.",
    oauth_callback_failed: "The provider approved access, but thia.lol could not finish saving it.",
    provider_error: "The provider cancelled or rejected the connection.",
  };
  const detail = error ? messages[error] ?? "Try connecting again." : "Try connecting again.";

  return `${providerLabels[provider]} did not connect. ${detail}`;
}

function ConnectionsNotice({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "error" | "success";
}) {
  return (
    <div
      className={cn(
        "rounded-card border p-3 text-sm font-medium",
        tone === "error"
          ? "border-rose/30 bg-rose/15 text-rose-ink"
          : "border-leaf/30 bg-leaf/15 text-text",
      )}
      role={tone === "error" ? "alert" : "status"}
      data-testid={`connections-notice-${tone}`}
    >
      <span className="inline-flex items-center gap-2">
        {tone === "success" ? <CheckCircle2 aria-hidden="true" size={16} /> : null}
        {children}
      </span>
    </div>
  );
}
