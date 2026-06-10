import {
  Award,
  Bell,
  Check,
  CheckCheck,
  Heart,
  MessageCircle,
  Repeat2,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { PageMeta } from "../components/PageMeta";
import { ApiStateNotice } from "../components/ui/ApiStateNotice";
import { Badge } from "../components/ui/Badge";
import { Button, ButtonLink } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Panel } from "../components/ui/Panel";
import { InlineUserProfileLink } from "../components/social/UserProfileLink";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
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

export function NotificationsPage() {
  const { csrfToken, status } = useAuth();
  const [state, setState] = useState<NotificationState>({
    data: undefined,
    loading: status === "authenticated",
    error: undefined,
  });
  const [pendingId, setPendingId] = useState<number | "all" | undefined>();
  const [actionError, setActionError] = useState<string | undefined>();
  const notifications = state.data?.notifications ?? [];
  const unreadCount = state.data?.unreadCount ?? 0;

  const loadNotifications = useCallback(() => {
    if (status !== "authenticated") {
      setState({ data: undefined, loading: false, error: undefined });
      return;
    }

    setState((current) => ({ ...current, loading: true, error: undefined }));

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

  if (status === "anonymous") {
    return (
      <motion.div
        className="mx-auto max-w-3xl"
        variants={pageEntrance}
        initial="hidden"
        animate="show"
      >
        <PageMeta
          title="Notifications"
          description="Your thia.lol notifications."
          path="/notifications"
        />
        <EmptyState
          icon={Bell}
          title="Notifications"
          text="Sign in to see who followed, liked, replied to, or reblogged you."
        />
        <div className="mt-4 flex justify-center">
          <ButtonLink to="/login" icon={<Bell aria-hidden="true" size={17} />}>
            Sign in
          </ButtonLink>
        </div>
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
        description="Your thia.lol notifications."
        path="/notifications"
      />

      <motion.div variants={cardEntrance} custom={0} initial="hidden" animate="show">
        <Panel className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Badge tone="cool">private</Badge>
              <h1 className="mt-4 text-3xl font-semibold tracking-normal text-text">
                Notifications
              </h1>
              <p
                className="mt-2 text-sm text-muted"
                data-testid="notifications-unread-count"
              >
                {unreadCount} unread
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={unreadCount === 0 || pendingId === "all"}
              icon={<CheckCheck aria-hidden="true" size={17} />}
              onClick={() => void handleMarkAllRead()}
            >
              {pendingId === "all" ? "Working..." : "Mark all as read"}
            </Button>
          </div>
        </Panel>
      </motion.div>

      {state.loading ? (
        <ApiStateNotice
          kind="loading"
          title="Loading notifications"
          text="Notifications are loading."
        />
      ) : null}

      {state.error ? (
        <ApiStateNotice
          kind="error"
          title="Could not load notifications"
          text="Try refreshing in a moment."
        />
      ) : null}

      {actionError ? (
        <p className="rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink">
          {actionError}
        </p>
      ) : null}

      {!state.loading && !state.error && notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          text="Follows, likes, replies, and reblogs will show up here."
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
          "flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between",
          unread && "border-accent/40 bg-surface-strong/86",
        )}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-strong text-accent-strong">
            <NotificationIcon type={notification.type} />
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
            size="sm"
            disabled={pending}
            icon={<Check aria-hidden="true" size={16} />}
            onClick={() => void onMarkRead(notification)}
          >
            {pending ? "Working..." : "Mark read"}
          </Button>
        ) : null}
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

  return <MessageCircle aria-hidden="true" size={20} />;
}
