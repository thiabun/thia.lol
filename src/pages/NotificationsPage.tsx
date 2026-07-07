import {
  Award,
  AtSign,
  Bell,
  Check,
  CheckCheck,
  Heart,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  Repeat2,
  UserCheck,
  UserPlus,
  UsersRound,
  WifiOff,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { PageMeta } from "../components/PageMeta";
import { DesktopNotificationsCard } from "../components/notifications/DesktopNotificationsCard";
import { Button, ButtonLink } from "../components/ui/Button";
import { Panel } from "../components/ui/Panel";
import { RouteHeader, RouteStateNotice } from "../components/ui/RouteState";
import { InlineUserProfileLink } from "../components/social/UserProfileLink";
import {
  approveFollowRequest,
  denyFollowRequest,
  getFollowRequests,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type FollowRequest,
} from "../lib/api";
import { cn } from "../lib/classNames";
import { formatRelativeTime } from "../lib/dates";
import { cardEntrance, pageEntrance } from "../lib/motionPresets";
import { emitNotificationsUpdated } from "../lib/notificationEvents";
import type { NotificationItem, NotificationsResult } from "../lib/types";
import { useAuth } from "../lib/useAuth";

type NotificationState = {
  data: NotificationsResult | undefined;
  loading: boolean;
  error: Error | undefined;
};

type FollowRequestState = {
  requests: FollowRequest[];
  loading: boolean;
  error: string | undefined;
};

export function NotificationsPage() {
  const { csrfToken, runWithAuth, status } = useAuth();
  const [state, setState] = useState<NotificationState>({
    data: undefined,
    loading: status === "authenticated",
    error: undefined,
  });
  const [requestState, setRequestState] = useState<FollowRequestState>({
    requests: [],
    loading: status === "authenticated",
    error: undefined,
  });
  const [pendingId, setPendingId] = useState<number | "all" | undefined>();
  const [requestPendingId, setRequestPendingId] = useState<number | undefined>();
  const [actionError, setActionError] = useState<string | undefined>();
  const [requestActionError, setRequestActionError] = useState<string | undefined>();
  const notifications = state.data?.notifications ?? [];
  const unreadCount = state.data?.unreadCount ?? 0;
  const followRequests = requestState.requests;
  const loadNotifications = useCallback(() => {
    if (status !== "authenticated") {
      setState({ data: undefined, loading: false, error: undefined });
      setRequestState({ requests: [], loading: false, error: undefined });
      return;
    }

    setState((current) => ({ ...current, loading: true, error: undefined }));
    setRequestState((current) => ({ ...current, loading: true, error: undefined }));

    getNotifications()
      .then((data) => {
        setState({ data, loading: false, error: undefined });
        emitNotificationsUpdated(data.unreadCount);
      })
      .catch((error: unknown) => {
        setState({
          data: undefined,
          loading: false,
          error: error instanceof Error ? error : new Error("Unknown error"),
        });
      });

    getFollowRequests()
      .then((requests) => {
        setRequestState({ requests, loading: false, error: undefined });
      })
      .catch((caught: unknown) => {
        setRequestState({
          requests: [],
          loading: false,
          error: caught instanceof Error ? caught.message : "Follow requests could not load.",
        });
      });
  }, [status]);

  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (active) {
        loadNotifications();
      }
    });

    return () => {
      active = false;
    };
  }, [loadNotifications]);

  async function handleMarkRead(notification: NotificationItem) {
    if (!csrfToken || notification.readAt) {
      return;
    }

    setPendingId(notification.id);
    setActionError(undefined);

    try {
      const result = await markNotificationRead(notification.id, csrfToken);
      setState((current) => applyReadState(current, [notification.id], result.readAt, result.unreadCount));
      emitNotificationsUpdated(result.unreadCount);
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "Notification could not be updated.",
      );
    } finally {
      setPendingId(undefined);
    }
  }

  async function handleMarkAllRead() {
    if (!csrfToken || unreadCount === 0) {
      return;
    }

    setPendingId("all");
    setActionError(undefined);

    try {
      const result = await markAllNotificationsRead(csrfToken);
      setState((current) =>
        applyReadState(
          current,
          notifications.map((notification) => notification.id),
          result.readAt,
          result.unreadCount,
        ),
      );
      emitNotificationsUpdated(result.unreadCount);
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "Notifications could not be updated.",
      );
    } finally {
      setPendingId(undefined);
    }
  }

  async function handleFollowRequest(request: FollowRequest, action: "approve" | "deny") {
    if (!csrfToken) {
      return;
    }

    setRequestPendingId(request.id);
    setRequestActionError(undefined);

    try {
      await runWithAuth(
        async (token) => {
          if (action === "approve") {
            await approveFollowRequest(request.id, token);
            return;
          }

          await denyFollowRequest(request.id, token);
        },
        { retryOnCsrf: true },
      );
      setRequestState((current) => ({
        ...current,
        requests: current.requests.filter((nextRequest) => nextRequest.id !== request.id),
      }));
    } catch (caught) {
      setRequestActionError(
        caught instanceof Error ? caught.message : "Follow request could not be updated.",
      );
    } finally {
      setRequestPendingId(undefined);
    }
  }

  if (status === "anonymous") {
    return (
      <motion.div
        className="mx-auto max-w-4xl space-y-5"
        variants={pageEntrance}
        initial="hidden"
        animate="show"
      >
        <PageMeta
          title="Notifications"
          description="Notifications."
          path="/notifications"
        />
        <RouteHeader
          badge="private"
          badgeTone="cool"
          title="Notifications"
          description="Updates."
        />
        <RouteStateNotice
          icon={Bell}
          title="Sign in to see notifications."
          text="Notifications require sign-in."
          actions={
            <ButtonLink
              to="/login"
              icon={<Bell aria-hidden="true" size={17} />}
            >
              Sign in
            </ButtonLink>
          }
        />
      </motion.div>
    );
  }

  if (status === "loading") {
    return (
      <motion.div
        className="mx-auto max-w-4xl space-y-5"
        variants={pageEntrance}
        initial="hidden"
        animate="show"
      >
        <PageMeta
          title="Notifications"
          description="Notifications."
          path="/notifications"
        />
        <RouteHeader
          badge="private"
          badgeTone="cool"
          title="Notifications"
          description="Updates."
        />
        <RouteStateNotice
          kind="loading"
          icon={LoaderCircle}
          title="Loading notifications"
          text="Loading updates."
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      className="mx-auto max-w-4xl space-y-5"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <PageMeta
        title="Notifications"
        description="Notifications."
        path="/notifications"
      />

      <motion.div variants={cardEntrance} custom={0} initial="hidden" animate="show">
        <RouteHeader
          badge="private"
          badgeTone="cool"
          title="Notifications"
          description="Updates."
          meta={
            <p
              className="text-sm font-medium text-muted"
              data-testid="notifications-unread-count"
            >
              {unreadCount} unread
            </p>
          }
          actions={
            <Button
              type="button"
              variant="secondary"
              disabled={unreadCount === 0 || pendingId === "all"}
              icon={<CheckCheck aria-hidden="true" size={17} />}
              onClick={() => void handleMarkAllRead()}
            >
              {pendingId === "all" ? "Working..." : "Mark all as read"}
            </Button>
          }
        />
      </motion.div>

      {state.loading ? (
        <RouteStateNotice
          kind="loading"
          icon={LoaderCircle}
          title="Loading notifications"
          text="Loading updates."
        />
      ) : null}

      {state.error ? (
        <RouteStateNotice
          kind="error"
          icon={WifiOff}
          title="Could not load notifications"
          text="Try refreshing in a moment."
          actions={
            <Button
              type="button"
              variant="secondary"
              icon={<RefreshCw aria-hidden="true" size={17} />}
              onClick={loadNotifications}
            >
              Try again
            </Button>
          }
        />
      ) : null}

      {actionError ? (
        <RouteStateNotice
          kind="error"
          icon={WifiOff}
          title="Could not update notifications"
          text={actionError}
        />
      ) : null}

      {requestState.error ? (
        <RouteStateNotice
          kind="error"
          icon={WifiOff}
          title="Could not load follow requests"
          text={requestState.error}
        />
      ) : null}

      {requestActionError ? (
        <RouteStateNotice
          kind="error"
          icon={WifiOff}
          title="Could not update follow request"
          text={requestActionError}
        />
      ) : null}

      {!requestState.loading && followRequests.length > 0 ? (
        <FollowRequestsPanel
          pendingId={requestPendingId}
          requests={followRequests}
          onResolve={handleFollowRequest}
        />
      ) : null}

      {!state.loading && !state.error ? <DesktopNotificationsCard compact /> : null}

      {!state.loading &&
      !state.error &&
      !requestState.loading &&
      followRequests.length === 0 &&
      notifications.length === 0 ? (
        <RouteStateNotice
          icon={Bell}
          title="No notifications yet"
          text="No updates."
        />
      ) : null}

      <div className="space-y-3">
        {notifications.map((notification, index) => (
          <NotificationRow
            key={notification.id}
            index={index}
            notification={notification}
            pending={pendingId === notification.id}
            onMarkRead={handleMarkRead}
          />
        ))}
      </div>
    </motion.div>
  );
}

function FollowRequestsPanel({
  onResolve,
  pendingId,
  requests,
}: {
  onResolve: (request: FollowRequest, action: "approve" | "deny") => void;
  pendingId: number | undefined;
  requests: FollowRequest[];
}) {
  return (
    <Panel className="overflow-hidden bg-surface/76" data-testid="follow-requests-panel">
      <div className="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/12 text-accent-strong">
            <UserPlus aria-hidden="true" size={17} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-text">Follow requests</h2>
            <p className="text-sm text-muted">
              {requests.length} pending
            </p>
          </div>
        </div>
      </div>
      <div className="divide-y divide-line/60">
        {requests.map((request) => {
          const busy = pendingId === request.id;
          const handle = `@${request.user.handle}`;

          return (
            <div
              key={request.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text">
                  {request.user.displayName}
                </p>
                <p className="text-sm text-muted">{handle}</p>
                {request.bioSnippet ? (
                  <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted">
                    {request.bioSnippet}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  aria-label={`Approve follow request from ${handle}`}
                  icon={<UserCheck size={14} />}
                  disabled={busy}
                  onClick={() => void onResolve(request, "approve")}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  aria-label={`Deny follow request from ${handle}`}
                  icon={<X size={14} />}
                  disabled={busy}
                  onClick={() => void onResolve(request, "deny")}
                >
                  Deny
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function NotificationRow({
  index,
  notification,
  onMarkRead,
  pending,
}: {
  index: number;
  notification: NotificationItem;
  onMarkRead: (notification: NotificationItem) => void;
  pending: boolean;
}) {
  const unread = notification.readAt === null;
  const markRead = () => {
    if (unread) {
      void onMarkRead(notification);
    }
  };

  return (
    <motion.div
      variants={cardEntrance}
      custom={index + 1}
      initial="hidden"
      animate="show"
    >
      <Panel
        className={cn(
          "overflow-hidden transition duration-fluid ease-fluid hover:border-line-strong hover:shadow-lift",
          unread ? "border-accent/40 bg-surface-strong/86" : "bg-surface/76",
        )}
      >
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span
              className={cn(
                "relative grid size-11 shrink-0 place-items-center rounded-full bg-surface-strong text-accent-strong",
                unread && "bg-accent/12 text-accent-strong",
              )}
            >
              <NotificationIcon type={notification.type} />
              <span className="sr-only">
                {unread ? "Unread notification" : "Read notification"}
              </span>
              {unread ? (
                <span
                  className="absolute right-0.5 top-0.5 size-2.5 rounded-full bg-accent shadow-glow"
                  aria-hidden="true"
                />
              ) : null}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-text">
                <NotificationCopy notification={notification} onVisit={markRead} />
              </span>
              {notification.post ? (
                <Link
                  to={notification.targetUrl}
                  className="mt-1 block line-clamp-2 text-sm leading-6 text-muted underline-offset-4 hover:text-accent-strong hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  onClick={markRead}
                >
                  {notification.post.bodySnippet}
                </Link>
              ) : (
                <Link
                  to={notification.targetUrl}
                  className="mt-1 inline-flex text-sm font-medium text-muted underline-offset-4 hover:text-accent-strong hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  onClick={markRead}
                >
                  {notificationTargetLabel(notification)}
                </Link>
              )}
              <span className="mt-2 block text-xs text-muted">
                {formatRelativeTime(notification.createdAt)}
              </span>
            </span>
          </div>
          {unread ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 shrink-0 rounded-full self-end sm:self-center"
              aria-label={
                pending ? "Marking notification as read" : "Mark notification as read"
              }
              title={pending ? "Marking notification as read" : "Mark notification as read"}
              disabled={pending}
              icon={<Check aria-hidden="true" size={16} />}
              onClick={() => void onMarkRead(notification)}
            />
          ) : (
            <span className="hidden size-10 shrink-0 sm:block" aria-hidden="true" />
          )}
        </div>
      </Panel>
    </motion.div>
  );
}

function applyReadState(
  current: NotificationState,
  ids: number[],
  readAt: string,
  unreadCount: number,
): NotificationState {
  if (!current.data) {
    return current;
  }

  const idSet = new Set(ids);

  return {
    ...current,
    data: {
      notifications: current.data.notifications.map((notification) =>
        idSet.has(notification.id) ? { ...notification, readAt } : notification,
      ),
      unreadCount,
    },
  };
}

function NotificationCopy({
  notification,
  onVisit,
}: {
  notification: NotificationItem;
  onVisit: () => void;
}) {
  const actor = notification.actor ? (
    <InlineUserProfileLink user={notification.actor} onClick={onVisit}>
      @{notification.actor.handle}
    </InlineUserProfileLink>
  ) : (
    "Someone"
  );

  if (notification.type === "follow") {
    return <>{actor} followed you</>;
  }

  if (notification.type === "moot") {
    return <>You and {actor} are moots</>;
  }

  if (notification.type === "like") {
    return <>{actor} liked your post</>;
  }

  if (notification.type === "reblog") {
    return <>{actor} reblogged your post</>;
  }

  if (notification.type === "message") {
    return <>{actor} sent you a message</>;
  }

  if (notification.type === "mention") {
    return <>{actor} mentioned you</>;
  }

  if (notification.type === "badge_granted") {
    const badgeName =
      typeof notification.data?.badgeName === "string"
        ? notification.data.badgeName
        : "a badge";

    return <>{actor} granted you {badgeName}</>;
  }

  return <>{actor} replied to your post</>;
}

function notificationTargetLabel(notification: NotificationItem): string {
  if (notification.type === "message") {
    return "Open chat";
  }

  if (notification.type === "follow" || notification.type === "moot") {
    return "Open profile";
  }

  return "Open notification";
}

function NotificationIcon({ type }: { type: NotificationItem["type"] }) {
  if (type === "follow") {
    return <UserPlus aria-hidden="true" size={20} />;
  }

  if (type === "moot") {
    return <UsersRound aria-hidden="true" size={20} />;
  }

  if (type === "like") {
    return <Heart aria-hidden="true" size={20} />;
  }

  if (type === "reblog") {
    return <Repeat2 aria-hidden="true" size={20} />;
  }

  if (type === "badge_granted") {
    return <Award aria-hidden="true" size={20} />;
  }

  if (type === "mention") {
    return <AtSign aria-hidden="true" size={20} />;
  }

  return <MessageCircle aria-hidden="true" size={20} />;
}
