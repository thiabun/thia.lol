import {
  BellRing,
  CheckCircle2,
  LoaderCircle,
  Send,
  ShieldAlert,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";
import {
  disablePushSubscription,
  getPushNotificationStatus,
  savePushSubscription,
  sendPushNotificationTest,
  type PushNotificationStatus,
} from "../../lib/api";
import { cn } from "../../lib/classNames";
import {
  desktopNotificationSupport,
  subscribeToDesktopNotifications,
  unsubscribeFromDesktopNotifications,
} from "../../lib/desktopNotifications";
import { useAuth } from "../../lib/useAuth";

type DesktopNotificationsCardProps = {
  compact?: boolean;
  className?: string;
  onHandled?: (kind: "enabled" | "disabled" | "tested") => void;
};

export function DesktopNotificationsCard({
  className,
  compact = false,
  onHandled,
}: DesktopNotificationsCardProps) {
  const { runWithAuth, status } = useAuth();
  const [pushStatus, setPushStatus] = useState<PushNotificationStatus>();
  const [browserSupport, setBrowserSupport] = useState(() =>
    desktopNotificationSupport(),
  );
  const [loading, setLoading] = useState(status === "authenticated");
  const [busy, setBusy] = useState<"enable" | "disable" | "test" | undefined>();
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  const state = useMemo(
    () => desktopNotificationState(browserSupport, pushStatus),
    [browserSupport, pushStatus],
  );

  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (active) {
        setBrowserSupport(desktopNotificationSupport());
      }
    });

    if (status !== "authenticated") {
      queueMicrotask(() => {
        if (active) {
          setLoading(false);
        }
      });

      return () => {
        active = false;
      };
    }

    queueMicrotask(() => {
      if (active) {
        setLoading(true);
      }
    });

    getPushNotificationStatus()
      .then((next) => {
        if (active) {
          setPushStatus(next);
          setError(undefined);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Desktop notification status could not load.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [status]);

  async function refreshStatus() {
    const next = await getPushNotificationStatus();
    setPushStatus(next);
    setBrowserSupport(desktopNotificationSupport());
    return next;
  }

  async function handleEnable() {
    if (!pushStatus?.publicKey) {
      return;
    }

    setBusy("enable");
    setError(undefined);
    setMessage(undefined);

    try {
      const subscription = await subscribeToDesktopNotifications(pushStatus.publicKey);
      const next = await runWithAuth(
        (token) => savePushSubscription(subscription, token),
        { retryOnCsrf: true },
      );
      setPushStatus(next);
      setBrowserSupport(desktopNotificationSupport());
      setMessage("Desktop notifications are enabled on this browser.");
      onHandled?.("enabled");
    } catch (caught) {
      setBrowserSupport(desktopNotificationSupport());
      setError(
        caught instanceof Error
          ? caught.message
          : "Desktop notifications could not be enabled.",
      );
    } finally {
      setBusy(undefined);
    }
  }

  async function handleDisable() {
    setBusy("disable");
    setError(undefined);
    setMessage(undefined);

    try {
      const endpoint = await unsubscribeFromDesktopNotifications();

      if (!endpoint) {
        await refreshStatus();
        setMessage("This browser was not subscribed.");
        return;
      }

      const next = await runWithAuth(
        (token) => disablePushSubscription({ endpoint }, token),
        { retryOnCsrf: true },
      );
      setPushStatus(next);
      setBrowserSupport(desktopNotificationSupport());
      setMessage("Desktop notifications are disabled on this browser.");
      onHandled?.("disabled");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Desktop notifications could not be disabled.",
      );
    } finally {
      setBusy(undefined);
    }
  }

  async function handleTest() {
    setBusy("test");
    setError(undefined);
    setMessage(undefined);

    try {
      const next = await runWithAuth((token) => sendPushNotificationTest(token), {
        retryOnCsrf: true,
      });
      setPushStatus(next);
      const sent = next.lastSend?.sent ?? 0;
      setMessage(sent > 0 ? "Test notification sent." : "No active browser subscription was found.");
      onHandled?.("tested");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Test notification could not be sent.",
      );
    } finally {
      setBusy(undefined);
    }
  }

  const Icon = state.icon;
  const canEnable =
    status === "authenticated" &&
    !loading &&
    !busy &&
    browserSupport.supported &&
    browserSupport.permission !== "denied" &&
    Boolean(
      pushStatus?.configured &&
        pushStatus.storageReady &&
        pushStatus.publicKey &&
        pushStatus.diagnostics.curlAvailable &&
        pushStatus.diagnostics.opensslAvailable,
    );
  const canTest =
    status === "authenticated" &&
    !loading &&
    !busy &&
    browserSupport.supported &&
    browserSupport.permission === "granted" &&
    Boolean(pushStatus?.enabled);

  return (
    <Panel
      className={cn(
        "overflow-hidden p-4",
        compact ? "space-y-3" : "space-y-4",
        className,
      )}
      data-testid="desktop-notifications-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "grid shrink-0 place-items-center rounded-card border bg-canvas/55",
              compact ? "size-10" : "size-12",
              state.tone === "success"
                ? "border-leaf/30 text-leaf-ink"
                : state.tone === "error"
                  ? "border-rose/30 text-rose-ink"
                  : "border-line text-muted",
            )}
          >
            {loading ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" size={18} />
            ) : (
              <Icon aria-hidden="true" size={18} />
            )}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-text">
                Desktop notifications
              </h2>
              <Badge
                tone={
                  state.tone === "success"
                    ? "leaf"
                    : state.tone === "error"
                      ? "rose"
                      : "cool"
                }
                className="min-h-6 px-2 text-[0.68rem]"
                data-testid="desktop-notifications-state"
              >
                {loading ? "checking" : state.label}
              </Badge>
            </div>
            <p className="mt-1 text-sm font-medium leading-6 text-muted">
              {loading ? "Checking this browser and server setup." : state.description}
            </p>
          </div>
        </div>
      </div>

      {pushStatus?.diagnostics.missingConfigKeys.length ? (
        <p className="rounded-card border border-line bg-canvas/45 p-2 text-xs font-semibold text-muted">
          Missing server config: {pushStatus.diagnostics.missingConfigKeys.join(", ")}
        </p>
      ) : null}

      {message ? (
        <p className="rounded-card border border-leaf/30 bg-leaf/12 p-2 text-sm font-semibold text-leaf-ink">
          {message}
        </p>
      ) : null}

      {error ? (
        <p
          className="rounded-card border border-rose/30 bg-rose/12 p-2 text-sm font-semibold text-rose-ink"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {pushStatus?.enabled ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={Boolean(busy) || loading}
            icon={<X aria-hidden="true" size={15} />}
            data-testid="desktop-notifications-disable"
            onClick={() => void handleDisable()}
          >
            {busy === "disable" ? "Disabling..." : "Disable"}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={!canEnable}
            title={!canEnable ? state.description : undefined}
            icon={<BellRing aria-hidden="true" size={15} />}
            data-testid="desktop-notifications-enable"
            onClick={() => void handleEnable()}
          >
            {busy === "enable" ? "Enabling..." : "Enable"}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!canTest}
          icon={<Send aria-hidden="true" size={15} />}
          data-testid="desktop-notifications-test"
          onClick={() => void handleTest()}
        >
          {busy === "test" ? "Sending..." : "Send test"}
        </Button>
      </div>
    </Panel>
  );
}

function desktopNotificationState(
  browser: ReturnType<typeof desktopNotificationSupport>,
  pushStatus: PushNotificationStatus | undefined,
): {
  label: string;
  description: string;
  icon: LucideIcon;
  tone: "default" | "success" | "error";
} {
  if (!browser.supported) {
    return {
      label: "unsupported",
      description: "This browser does not support Web Push desktop notifications.",
      icon: WifiOff,
      tone: "error",
    };
  }

  if (browser.permission === "denied") {
    return {
      label: "blocked",
      description: "Notifications are blocked in this browser. Re-enable them in browser site settings.",
      icon: ShieldAlert,
      tone: "error",
    };
  }

  if (pushStatus && !pushStatus.storageReady) {
    return {
      label: "storage needed",
      description: "Desktop notification storage is not ready. Run pending migrations.",
      icon: ShieldAlert,
      tone: "error",
    };
  }

  if (pushStatus && !pushStatus.configured) {
    return {
      label: "setup needed",
      description: "Desktop notifications need VAPID keys in server config before users can subscribe.",
      icon: ShieldAlert,
      tone: "error",
    };
  }

  if (
    pushStatus &&
    (!pushStatus.diagnostics.curlAvailable || !pushStatus.diagnostics.opensslAvailable)
  ) {
    return {
      label: "server unavailable",
      description: "Desktop notifications need server-side HTTP and crypto support enabled.",
      icon: ShieldAlert,
      tone: "error",
    };
  }

  if (pushStatus?.enabled) {
    return {
      label: "enabled",
      description: `${pushStatus.subscriptionCount} browser${pushStatus.subscriptionCount === 1 ? "" : "s"} subscribed for this account.`,
      icon: CheckCircle2,
      tone: "success",
    };
  }

  return {
    label: "ready",
    description: "Enable this browser to receive thia.lol notifications on desktop.",
    icon: BellRing,
    tone: "default",
  };
}
