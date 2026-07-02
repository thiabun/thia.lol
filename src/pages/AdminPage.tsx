import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import {
  Activity,
  Award,
  Ban,
  CheckCircle2,
  EyeOff,
  LoaderCircle,
  MessageCircle,
  Radio,
  RefreshCw,
  Shield,
  Trash2,
  UserPlus,
  WifiOff,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageMeta } from "../components/PageMeta";
import { InlineUserProfileLink } from "../components/social/UserProfileLink";
import { ApiStateNotice } from "../components/ui/ApiStateNotice";
import { Badge } from "../components/ui/Badge";
import { Button, ButtonLink } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import {
  HandleField,
  SelectField,
  TextareaField,
  TextField,
} from "../components/ui/Field";
import { Panel } from "../components/ui/Panel";
import { CompactStateNotice } from "../components/ui/RouteState";
import {
  getAdminGrowthMetrics,
  getAdminBadges,
  getAdminRooms,
  getAdminReports,
  grantAdminBadge,
  hideAdminPost,
  removeAdminPost,
  revokeAdminBadge,
  resolveAdminReport,
  suspendAdminUser,
  type AdminBadgesResult,
  type ReportCategory,
  type ModerationReport,
  type ModerationReportStatus,
  type ModerationUser,
} from "../lib/api";
import { parseApiTimestamp } from "../lib/dates";
import { cn } from "../lib/classNames";
import { pageEntrance } from "../lib/motionPresets";
import { formatCountWithUnit } from "../lib/pluralize";
import { roomThemeSwatchCssProperties } from "../lib/roomThemes";
import type { AdminGrowthMetrics, BadgeDefinition, Room, UserBadge } from "../lib/types";
import { useAuth } from "../lib/useAuth";

type ActionName = "hide" | "remove" | "suspend" | "review" | "dismiss";
type BadgeTone = "default" | "warm" | "cool" | "leaf" | "rose";

export function AdminPage() {
  const { status, user, csrfToken } = useAuth();
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [badges, setBadges] = useState<AdminBadgesResult>({
    badges: [],
    recentGrants: [],
  });
  const [growth, setGrowth] = useState<AdminGrowthMetrics | undefined>();
  const [loading, setLoading] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingBadges, setLoadingBadges] = useState(false);
  const [loadingGrowth, setLoadingGrowth] = useState(false);
  const [error, setError] = useState<string>();
  const [roomsError, setRoomsError] = useState<string>();
  const [badgesError, setBadgesError] = useState<string>();
  const [growthError, setGrowthError] = useState<string>();
  const [pendingAction, setPendingAction] = useState<string>();
  const [pendingBadgeAction, setPendingBadgeAction] = useState<string>();
  const [badgeHandle, setBadgeHandle] = useState("");
  const [badgeKey, setBadgeKey] = useState("");
  const [badgeReason, setBadgeReason] = useState("");
  const [badgeMessage, setBadgeMessage] = useState<string>();
  const [notesByReport, setNotesByReport] = useState<Record<number, string>>({});
  const isModerator = user?.role === "moderator" || user?.role === "admin";
  const isAdmin = user?.role === "admin";

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(undefined);

    try {
      setReports(await getAdminReports());
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load reports.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRooms = useCallback(async () => {
    setLoadingRooms(true);
    setRoomsError(undefined);

    try {
      setRooms(await getAdminRooms());
    } catch (loadError) {
      setRoomsError(
        loadError instanceof Error ? loadError.message : "Could not load rooms.",
      );
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  const loadBadges = useCallback(async () => {
    setLoadingBadges(true);
    setBadgesError(undefined);

    try {
      setBadges(await getAdminBadges());
    } catch (loadError) {
      setBadgesError(
        loadError instanceof Error ? loadError.message : "Could not load badges.",
      );
    } finally {
      setLoadingBadges(false);
    }
  }, []);

  const loadGrowth = useCallback(async () => {
    setLoadingGrowth(true);
    setGrowthError(undefined);

    try {
      setGrowth(await getAdminGrowthMetrics());
    } catch (loadError) {
      setGrowthError(
        loadError instanceof Error ? loadError.message : "Could not load growth metrics.",
      );
    } finally {
      setLoadingGrowth(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    if (isModerator) {
      queueMicrotask(() => {
        if (active) {
          void loadReports();
          void loadRooms();
          void loadBadges();
          if (isAdmin) {
            void loadGrowth();
          }
        }
      });
    }

    return () => {
      active = false;
    };
  }, [isAdmin, isModerator, loadBadges, loadGrowth, loadReports, loadRooms]);

  const metrics = useMemo(() => {
    const open = reports.filter((report) => report.status === "open").length;
    const closed = reports.filter((report) => report.status !== "open").length;
    const hiddenPosts = reports.filter(
      (report) => report.post?.status === "hidden",
    ).length;
    const suspendedUsers = reports.filter(
      (report) => report.reportedUser?.status === "suspended",
    ).length;

    return { open, closed, hiddenPosts, suspendedUsers, badges: badges.badges.length };
  }, [badges.badges.length, reports]);
  async function runAction(
    report: ModerationReport,
    action: ActionName,
    task: (token: string) => Promise<unknown>,
  ) {
    if (!csrfToken) {
      setError("CSRF token is missing. Sign in again.");
      return;
    }

    setPendingAction(`${report.id}:${action}`);
    setError(undefined);

    try {
      await task(csrfToken);
      await loadReports();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Moderation action failed.",
      );
    } finally {
      setPendingAction(undefined);
    }
  }

  async function handleGrantBadge() {
    if (!csrfToken) {
      setBadgesError("CSRF token is missing. Sign in again.");
      return;
    }

    if (!badgeHandle.trim() || !badgeKey) {
      setBadgesError("Handle and badge are required.");
      return;
    }

    setPendingBadgeAction("grant");
    setBadgesError(undefined);
    setBadgeMessage(undefined);

    try {
      await grantAdminBadge(
        {
          handle: badgeHandle,
          badgeKey,
          reason: badgeReason,
        },
        csrfToken,
      );
      setBadgeMessage("Badge granted");
      setBadgeReason("");
      await loadBadges();
    } catch (actionError) {
      setBadgesError(
        actionError instanceof Error ? actionError.message : "Badge could not be granted.",
      );
    } finally {
      setPendingBadgeAction(undefined);
    }
  }

  async function handleRevokeBadge(grant: UserBadge) {
    if (!csrfToken || !grant.user) {
      setBadgesError("CSRF token is missing. Sign in again.");
      return;
    }

    setPendingBadgeAction(`revoke:${grant.id}`);
    setBadgesError(undefined);
    setBadgeMessage(undefined);

    try {
      await revokeAdminBadge(
        {
          handle: grant.user.handle,
          badgeKey: grant.badge.badgeKey,
        },
        csrfToken,
      );
      setBadgeMessage("Badge revoked");
      await loadBadges();
    } catch (actionError) {
      setBadgesError(
        actionError instanceof Error ? actionError.message : "Badge could not be revoked.",
      );
    } finally {
      setPendingBadgeAction(undefined);
    }
  }

  function reportNotes(reportId: number): string {
    return notesByReport[reportId]?.trim() ?? "";
  }

  function setReportNotes(reportId: number, value: string) {
    setNotesByReport((current) => ({ ...current, [reportId]: value }));
  }

  if (status === "loading") {
    return (
      <AdminShell>
        <ApiStateNotice
          kind="loading"
          title="Checking admin session"
          text="Checking access."
        />
      </AdminShell>
    );
  }

  if (!user) {
    return (
      <AdminShell>
        <Panel className="p-5 sm:p-6">
          <Badge tone="rose">restricted</Badge>
          <h1 className="mt-4 text-2xl font-semibold text-text">Sign in required</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Admin requires a moderator account.
          </p>
          <ButtonLink to="/login" className="mt-5" size="sm">
            Sign in
          </ButtonLink>
        </Panel>
      </AdminShell>
    );
  }

  if (!isModerator) {
    return (
      <AdminShell>
        <Panel className="p-5 sm:p-6">
          <Badge tone="rose">restricted</Badge>
          <h1 className="mt-4 text-2xl font-semibold text-text">
            Moderator access required
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Current role: {user.role}.
          </p>
        </Panel>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <Panel className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-text sm:text-3xl">
              Admin
            </h1>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="Refresh admin data"
            title="Refresh admin data"
            disabled={loading || loadingRooms || loadingBadges || loadingGrowth}
            icon={<RefreshCw aria-hidden="true" size={15} />}
            onClick={() => {
              void loadReports();
              void loadRooms();
              void loadBadges();
              if (isAdmin) {
                void loadGrowth();
              }
            }}
          />
        </div>
      </Panel>

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <AdminMetric icon={Activity} label="Open reports" value={String(metrics.open)} />
        <AdminMetric
          icon={CheckCircle2}
          label="Closed reports"
          value={String(metrics.closed)}
        />
        <AdminMetric
          icon={EyeOff}
          label="Hidden posts"
          value={String(metrics.hiddenPosts)}
        />
        <AdminMetric
          icon={Ban}
          label="Suspended users"
          value={String(metrics.suspendedUsers)}
        />
        <AdminMetric
          icon={Award}
          label="Badges"
          value={String(metrics.badges)}
        />
      </section>

      {isAdmin ? (
        <GrowthMetricsPanel
          error={growthError}
          growth={growth}
          loading={loadingGrowth}
        />
      ) : null}

      <AdminSection
        badge="reports"
        badgeTone="rose"
        title="Report queue"
        meta={
          <span className="inline-flex items-center gap-2 text-sm text-muted">
            <Shield aria-hidden="true" size={16} />
            {formatCountWithUnit(reports.length, "report")}
          </span>
        }
      >
        {loading ? (
          <ApiStateNotice
            kind="loading"
            title="Loading reports"
            text="Loading queue."
          />
        ) : null}

        {error ? (
          <ApiStateNotice
            kind="error"
            title="Report queue is not available"
            text={error}
          />
        ) : null}

        {reports.length === 0 && !loading && !error ? (
          <EmptyState
            icon={Shield}
            title="No reports yet"
            text="Reported content appears here."
          />
        ) : null}

        {reports.length > 0 ? (
          <div className="space-y-3">
            {reports.map((report) => (
              <ReportRow
                key={report.id}
                report={report}
                currentUserId={user.id}
                notes={notesByReport[report.id] ?? ""}
                pendingAction={pendingAction}
                onNotesChange={setReportNotes}
                onHidePost={(targetReport) =>
                  void runAction(targetReport, "hide", (token) =>
                    hideAdminPost(
                      targetReport.post!.id,
                      {
                        reportId: targetReport.id,
                        notes: reportNotes(targetReport.id),
                      },
                      token,
                    ),
                  )
                }
                onRemovePost={(targetReport) =>
                  void runAction(targetReport, "remove", (token) =>
                    removeAdminPost(
                      targetReport.post!.id,
                      {
                        reportId: targetReport.id,
                        notes: reportNotes(targetReport.id),
                      },
                      token,
                    ),
                  )
                }
                onSuspendUser={(targetReport) =>
                  void runAction(targetReport, "suspend", (token) =>
                    suspendAdminUser(
                      targetReport.reportedUser!.id,
                      {
                        reportId: targetReport.id,
                        notes: reportNotes(targetReport.id),
                      },
                      token,
                    ),
                  )
                }
                onReview={(targetReport) =>
                  void runAction(targetReport, "review", (token) =>
                    resolveAdminReport(
                      targetReport.id,
                      {
                        status: "reviewed",
                        notes: reportNotes(targetReport.id),
                      },
                      token,
                    ),
                  )
                }
                onDismiss={(targetReport) =>
                  void runAction(targetReport, "dismiss", (token) =>
                    resolveAdminReport(
                      targetReport.id,
                      {
                        status: "dismissed",
                        notes: reportNotes(targetReport.id),
                      },
                      token,
                    ),
                  )
                }
              />
            ))}
          </div>
        ) : null}
      </AdminSection>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <BadgeAdminPanel
          badgeKey={badgeKey}
          badges={badges.badges}
          error={badgesError}
          handle={badgeHandle}
          loading={loadingBadges}
          message={badgeMessage}
          pendingAction={pendingBadgeAction}
          reason={badgeReason}
          recentGrants={badges.recentGrants}
          onBadgeKeyChange={setBadgeKey}
          onGrant={() => void handleGrantBadge()}
          onHandleChange={setBadgeHandle}
          onReasonChange={setBadgeReason}
          onRevoke={(grant) => void handleRevokeBadge(grant)}
        />

        <RoomMetadataPanel
          error={roomsError}
          loading={loadingRooms}
          rooms={rooms}
        />
      </section>
    </AdminShell>
  );
}

function GrowthMetricsPanel({
  error,
  growth,
  loading,
}: {
  error: string | undefined;
  growth: AdminGrowthMetrics | undefined;
  loading: boolean;
}) {
  return (
    <AdminSection
      badge="growth"
      badgeTone="cool"
      title="Growth"
      meta={
        growth ? (
          <span className="text-sm text-muted">
            Last {growth.windowDays} days
          </span>
        ) : undefined
      }
    >
      {loading ? (
        <ApiStateNotice
          kind="loading"
          title="Loading growth metrics"
          text="Loading signup attribution."
        />
      ) : null}
      {error ? (
        <ApiStateNotice
          kind="error"
          title="Growth metrics are not available"
          text={error}
        />
      ) : null}
      {growth ? (
        <div className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <AdminMetric
              icon={UserPlus}
              label="Signups"
              value={String(growth.totalSignups)}
            />
            <AdminMetric
              icon={Activity}
              label="Attributed"
              value={String(growth.attributedSignups)}
            />
          </div>
          <GrowthBucketList title="Sources" items={growth.bySource} />
          <GrowthSharedList items={growth.topSharedEntities} />
        </div>
      ) : null}
    </AdminSection>
  );
}

function GrowthBucketList({
  items,
  title,
}: {
  items: AdminGrowthMetrics["bySource"];
  title: string;
}) {
  return (
    <div className="rounded-card border border-line bg-canvas/35 p-3">
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted">No attributed signups yet.</p>
        ) : (
          items.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-muted">{item.key}</span>
              <span className="font-semibold text-text">{item.count}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function GrowthSharedList({
  items,
}: {
  items: AdminGrowthMetrics["topSharedEntities"];
}) {
  return (
    <div className="rounded-card border border-line bg-canvas/35 p-3">
      <h3 className="text-sm font-semibold text-text">Shared links</h3>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted">No share-attributed signups yet.</p>
        ) : (
          items.map((item) => (
            <div
              key={`${item.shareKind}:${item.shareRef}`}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="min-w-0 truncate text-muted">
                {item.shareKind}:{item.shareRef}
              </span>
              <span className="font-semibold text-text">{item.count}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AdminShell({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="mx-auto max-w-7xl space-y-4"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <PageMeta
        title="Admin"
        description="Moderation and reporting tools for thia.lol."
        path="/admin"
      />
      {children}
    </motion.div>
  );
}

type AdminSectionProps = {
  badge: string;
  badgeTone?: BadgeTone;
  children: ReactNode;
  className?: string;
  description?: string;
  meta?: ReactNode;
  title: string;
};

function AdminSection({
  badge,
  badgeTone = "default",
  children,
  className,
  description,
  meta,
  title,
}: AdminSectionProps) {
  return (
    <Panel className={cn("overflow-hidden", className)}>
      <div className="border-b border-line/70 bg-canvas/30 p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Badge tone={badgeTone}>{badge}</Badge>
            <h2 className="mt-2 text-lg font-semibold text-text">{title}</h2>
            {description ? (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                {description}
              </p>
            ) : null}
          </div>
          {meta ? <div className="shrink-0">{meta}</div> : null}
        </div>
      </div>
      <div className="space-y-3 p-3 sm:p-4">{children}</div>
    </Panel>
  );
}

type BadgeAdminPanelProps = {
  badgeKey: string;
  badges: BadgeDefinition[];
  error: string | undefined;
  handle: string;
  loading: boolean;
  message: string | undefined;
  pendingAction: string | undefined;
  reason: string;
  recentGrants: UserBadge[];
  onBadgeKeyChange: (value: string) => void;
  onGrant: () => void;
  onHandleChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  onRevoke: (grant: UserBadge) => void;
};

function BadgeAdminPanel({
  badgeKey,
  badges,
  error,
  handle,
  loading,
  message,
  onBadgeKeyChange,
  onGrant,
  onHandleChange,
  onReasonChange,
  onRevoke,
  pendingAction,
  reason,
  recentGrants,
}: BadgeAdminPanelProps) {
  const activeBadges = badges.filter((badge) => badge.isActive);
  const badgeOptions = [
    { value: "", label: "Select badge" },
    ...activeBadges.map((badge) => ({
      value: badge.badgeKey,
      label: `${badge.name} · ${rarityLabel(badge.rarity)}`,
    })),
  ];

  return (
    <AdminSection
      badge="badges"
      badgeTone="warm"
      title="Badge management"
      meta={
        <span className="inline-flex items-center gap-2 text-sm text-muted">
          <Award aria-hidden="true" size={16} />
          {formatCountWithUnit(activeBadges.length, "definition")}
        </span>
      }
    >
      {loading ? (
        <CompactStateNotice
          icon={LoaderCircle}
          kind="loading"
          title="Loading badges"
          text="Loading badge data."
        />
      ) : null}

      {error ? (
        <CompactStateNotice
          icon={WifiOff}
          kind="error"
          title="Badges are not available"
          text={error}
        />
      ) : null}

      {message ? (
        <CompactStateNotice
          icon={CheckCircle2}
          title={message}
          text="Updated."
        />
      ) : null}

      <div className="rounded-card bg-canvas/45 p-3">
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
          <HandleField
            id="badge-grant-handle"
            label="Handle"
            value={handle}
            placeholder="handle"
            maxLength={41}
            disabled={pendingAction === "grant"}
            onChange={(event) => onHandleChange(event.currentTarget.value)}
          />
          <SelectField
            id="badge-grant-definition"
            label="Badge"
            value={badgeKey}
            disabled={pendingAction === "grant"}
            options={badgeOptions}
            onChange={(event) => onBadgeKeyChange(event.currentTarget.value)}
          />
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <TextField
            id="badge-grant-reason"
            label="Reason"
            value={reason}
            maxLength={255}
            disabled={pendingAction === "grant"}
            onChange={(event) => onReasonChange(event.currentTarget.value)}
          />
          <Button
            type="button"
            className="w-full lg:w-auto"
            disabled={pendingAction === "grant" || !handle.trim() || !badgeKey}
            icon={<Award aria-hidden="true" size={16} />}
            onClick={onGrant}
          >
            {pendingAction === "grant" ? "Granting" : "Grant badge"}
          </Button>
        </div>
      </div>

      {activeBadges.length > 0 ? (
        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-text">Active definitions</h3>
            <span className="text-xs text-muted">
              {activeBadges.length.toLocaleString()} active
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {activeBadges.map((badge) => (
              <div key={badge.badgeKey} className="rounded-card bg-canvas/45 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-text">{badge.name}</h4>
                    <p className="mt-1 truncate text-xs text-muted">
                      {badge.badgeKey}
                    </p>
                  </div>
                  <Badge tone={rarityTone(badge.rarity)}>
                    {rarityLabel(badge.rarity)}
                  </Badge>
                </div>
                {badge.description ? (
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted">
                    {badge.description}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : !loading && !error ? (
        <CompactStateNotice
          icon={Award}
          title="No active badge definitions"
          text="No active definitions."
        />
      ) : null}

      {recentGrants.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-text">Recent grants</h3>
          <div className="mt-3 space-y-2">
            {recentGrants.map((grant) => (
              <div
                key={grant.id}
                className="flex flex-col gap-3 rounded-card bg-canvas/45 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text">
                    {grant.badge.name} to{" "}
                    {grant.user ? (
                      <InlineUserProfileLink user={grant.user}>
                        @{grant.user.handle}
                      </InlineUserProfileLink>
                    ) : (
                      "unknown user"
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Earned {formatDate(grant.earnedAt)}
                    {grant.reason ? ` · ${grant.reason}` : ""}
                  </p>
                </div>
                {grant.user ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full sm:w-auto"
                    disabled={pendingAction === `revoke:${grant.id}`}
                    icon={<Trash2 aria-hidden="true" size={15} />}
                    onClick={() => onRevoke(grant)}
                  >
                    {pendingAction === `revoke:${grant.id}` ? "Revoking" : "Revoke"}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : !loading && !error ? (
        <CompactStateNotice
          icon={Award}
          title="No recent grants"
          text="No recent badge changes."
        />
      ) : null}
    </AdminSection>
  );
}

type ReportRowProps = {
  report: ModerationReport;
  currentUserId: number;
  notes: string;
  pendingAction: string | undefined;
  onNotesChange: (reportId: number, value: string) => void;
  onHidePost: (report: ModerationReport) => void;
  onRemovePost: (report: ModerationReport) => void;
  onSuspendUser: (report: ModerationReport) => void;
  onReview: (report: ModerationReport) => void;
  onDismiss: (report: ModerationReport) => void;
};

function ReportRow({
  report,
  currentUserId,
  notes,
  pendingAction,
  onNotesChange,
  onHidePost,
  onRemovePost,
  onSuspendUser,
  onReview,
  onDismiss,
}: ReportRowProps) {
  const canHidePost =
    report.post !== null &&
    report.post.status !== "hidden" &&
    report.post.status !== "removed";
  const canRemovePost = report.post !== null && report.post.status !== "removed";
  const canSuspendUser =
    report.reportedUser !== null &&
    report.reportedUser.status !== "suspended" &&
    report.reportedUser.id !== currentUserId;
  const canClose = report.status === "open";
  const hasEnforcementActions = canHidePost || canRemovePost || canSuspendUser;
  const hasAnyAction = canClose || hasEnforcementActions;
  const targetTitle = targetLabel(report);

  return (
    <Panel
      className={cn(
        "p-3 sm:p-4",
        report.status === "open" && "border-rose/30",
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(report.status)}>{statusLabel(report.status)}</Badge>
            <Badge>{categoryLabel(report.category)}</Badge>
            <Badge tone="cool">{targetTypeLabel(report.targetType)}</Badge>
            <span className="text-xs text-muted">#{report.id}</span>
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <Shield aria-hidden="true" size={13} />
              {report.actionCount}
            </span>
          </div>
          <h2 className="mt-2 text-base font-semibold text-text">{targetTitle}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Reported by <UserLabel user={report.reporter} /> ·{" "}
            {formatDate(report.createdAt)}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-3">
          {report.details ? (
            <div className="rounded-card bg-canvas/45 p-3">
              <p className="text-xs font-medium uppercase text-muted">Reporter note</p>
              <p className="mt-2 text-sm leading-6 text-text">{report.details}</p>
            </div>
          ) : null}

          {report.post ? (
            <div className="rounded-card bg-canvas/45 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={report.post.status === "hidden" ? "rose" : "warm"}>
                  post {report.post.status}
                </Badge>
                <span className="text-xs text-muted">
                  by <UserLabel user={report.post.author} />
                </span>
              </div>
              <p className="mt-3 line-clamp-4 text-sm leading-6 text-text">
                {report.post.body}
              </p>
            </div>
          ) : null}

          {report.actionTaken || report.moderatorNote || report.reviewedBy ? (
            <div className="rounded-card bg-canvas/45 p-3">
              <p className="text-xs font-medium uppercase text-muted">Action taken</p>
              <p className="mt-2 text-sm font-semibold text-text">
                {actionTakenLabel(report.actionTaken)}
              </p>
              {report.reviewedBy ? (
                <p className="mt-1 text-xs text-muted">
                  by <UserLabel user={report.reviewedBy} />
                  {report.reviewedAt ? ` · ${formatDate(report.reviewedAt)}` : ""}
                </p>
              ) : null}
              {report.moderatorNote ? (
                <p className="mt-2 text-sm leading-6 text-muted">
                  {report.moderatorNote}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="rounded-card bg-canvas/45 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase text-muted">
                Target summary
              </p>
              <Badge tone="cool">{targetTypeLabel(report.targetType)}</Badge>
            </div>
            <p className="mt-2 text-sm font-semibold text-text">{targetTitle}</p>
            <p className="mt-1 text-xs text-muted">{targetSummaryText(report)}</p>
          </div>
          {report.profile ? (
            <TargetSummary label="Profile" user={report.profile} />
          ) : null}
          {report.room ? <RoomReportSummary room={report.room} /> : null}
          {report.message ? (
            <MessageReportSummary message={report.message} />
          ) : null}
          <TargetSummary label="Reported user" user={report.reportedUser} />

          <div className="rounded-card bg-canvas/45 p-3">
            <TextareaField
              id={`moderation-notes-${report.id}`}
              label="Moderator note"
              rows={3}
              maxLength={2000}
              value={notes}
              placeholder="Optional internal note"
              onChange={(event) => onNotesChange(report.id, event.target.value)}
            />

            {hasAnyAction ? (
              <div className="mt-3 space-y-3">
                {canClose ? (
                  <div>
                    <p className="text-xs font-medium uppercase text-muted">
                      Close report
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        className="w-full"
                        disabled={pendingAction === `${report.id}:review`}
                        icon={<CheckCircle2 aria-hidden="true" size={15} />}
                        onClick={() => onReview(report)}
                      >
                        Mark reviewed
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        disabled={pendingAction === `${report.id}:dismiss`}
                        icon={<XCircle aria-hidden="true" size={15} />}
                        onClick={() => onDismiss(report)}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                ) : null}

                {hasEnforcementActions ? (
                  <div>
                    <p className="text-xs font-medium uppercase text-muted">
                      Enforcement
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {canHidePost ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="w-full"
                          disabled={pendingAction === `${report.id}:hide`}
                          icon={<EyeOff aria-hidden="true" size={15} />}
                          onClick={() => onHidePost(report)}
                        >
                          Hide post
                        </Button>
                      ) : null}
                      {canRemovePost ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="w-full border-rose/30 bg-rose/10 text-rose-ink hover:border-rose/40"
                          disabled={pendingAction === `${report.id}:remove`}
                          icon={<Trash2 aria-hidden="true" size={15} />}
                          onClick={() => onRemovePost(report)}
                        >
                          Remove post
                        </Button>
                      ) : null}
                      {canSuspendUser ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="w-full border-rose/30 bg-rose/10 text-rose-ink hover:border-rose/40"
                          disabled={pendingAction === `${report.id}:suspend`}
                          icon={<Ban aria-hidden="true" size={15} />}
                          onClick={() => onSuspendUser(report)}
                        >
                          Suspend
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 rounded-card bg-surface/70 p-3 text-sm text-muted">
                No available actions for this report.
              </p>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}

type RoomMetadataPanelProps = {
  error: string | undefined;
  loading: boolean;
  rooms: Room[];
};

function RoomMetadataPanel({ error, loading, rooms }: RoomMetadataPanelProps) {
  return (
    <AdminSection
      badge="rooms"
      badgeTone="cool"
      title="Room administration"
      meta={
        <span className="inline-flex items-center gap-2 text-sm text-muted">
          <Radio aria-hidden="true" size={16} />
          {formatCountWithUnit(rooms.length, "room")}
        </span>
      }
    >
      {loading ? (
        <CompactStateNotice
          icon={LoaderCircle}
          kind="loading"
          title="Loading room metadata"
          text="Loading rooms."
        />
      ) : null}

      {error ? (
        <CompactStateNotice
          icon={WifiOff}
          kind="error"
          title="Room metadata is not available"
          text={error}
        />
      ) : null}

      {rooms.length > 0 ? (
        <div className="space-y-2">
          {rooms.map((room) => (
            <AdminRoomRow key={room.id} room={room} />
          ))}
        </div>
      ) : !loading && !error ? (
        <CompactStateNotice
          icon={Radio}
          title="No rooms to review"
          text="No rooms yet."
        />
      ) : null}
    </AdminSection>
  );
}

type AdminMetricProps = {
  icon: LucideIcon;
  label: string;
  value: string;
};

function AdminMetric({ icon: Icon, label, value }: AdminMetricProps) {
  return (
    <div className="flex items-center gap-2 rounded-card border border-line bg-surface/70 p-2.5">
      <div className="grid size-8 shrink-0 place-items-center rounded-card bg-surface-strong text-accent-strong">
        <Icon aria-hidden="true" size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-[0.68rem] font-medium uppercase text-muted">{label}</p>
        <p className="text-lg font-semibold text-text">{value}</p>
      </div>
    </div>
  );
}

function AdminRoomRow({ room }: { room: Room }) {
  return (
    <div className="rounded-card bg-canvas/45 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="mt-1 size-6 shrink-0 rounded-full border border-line"
            style={{
              ...roomThemeSwatchCssProperties(room),
              backgroundColor: "var(--room-accent)",
            }}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="cool">{room.visibility ?? "public"}</Badge>
              <span className="text-xs text-muted">#{room.id}</span>
            </div>
            <h3 className="mt-1 truncate text-sm font-semibold text-text">
              {room.name}
            </h3>
            <p className="mt-1 truncate text-xs text-muted">/{room.slug}</p>
          </div>
        </div>
        <ButtonLink
          to={`/rooms/${room.slug}`}
          size="sm"
          variant="secondary"
          className="w-full sm:w-auto"
        >
          Open room
        </ButtonLink>
      </div>
      {room.summary ? (
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted">
          {room.summary}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span>
          Owner:{" "}
          {room.owner ? (
            <InlineUserProfileLink user={room.owner}>
              @{room.owner.handle}
            </InlineUserProfileLink>
          ) : (
            "unassigned"
          )}
        </span>
        <span className="inline-flex items-center gap-1">
          <Radio aria-hidden="true" size={13} />
          {formatCountWithUnit(room.memberCount, "member")}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageCircle aria-hidden="true" size={13} />
          {formatCountWithUnit(room.postCount, "post")}
        </span>
      </div>
    </div>
  );
}

function TargetSummary({
  label,
  user,
}: {
  label: string;
  user: ModerationUser | null;
}) {
  return (
    <div className="rounded-card bg-canvas/45 p-3">
      <p className="text-xs font-medium uppercase text-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold text-text">
        <UserLabel user={user} />
      </p>
      {user ? (
        <p className="mt-1 text-xs text-muted">
          {user.role} · {user.status}
        </p>
      ) : null}
    </div>
  );
}

function RoomReportSummary({ room }: { room: NonNullable<ModerationReport["room"]> }) {
  return (
    <div className="rounded-card bg-canvas/45 p-3">
      <p className="text-xs font-medium uppercase text-muted">Room</p>
      <p className="mt-2 text-sm font-semibold text-text">{room.name}</p>
      <p className="mt-1 text-xs text-muted">
        /{room.slug} · {room.visibility} · {room.live ? "live" : "not live"}
      </p>
      {room.summary ? (
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted">
          {room.summary}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-muted">
        Owner: <UserLabel user={room.owner} />
      </p>
    </div>
  );
}

function MessageReportSummary({
  message,
}: {
  message: NonNullable<ModerationReport["message"]>;
}) {
  return (
    <div className="rounded-card bg-canvas/45 p-3">
      <p className="text-xs font-medium uppercase text-muted">Message</p>
      <p className="mt-2 text-sm font-semibold text-text">
        From <UserLabel user={message.sender} />
      </p>
      <p className="mt-1 text-xs text-muted">
        Conversation {message.conversationId} · {formatDate(message.createdAt)}
      </p>
      <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-text">
        {message.deletedAt ? "Message has been deleted." : message.body}
      </p>
    </div>
  );
}

function UserLabel({ user }: { user: ModerationUser | null }) {
  if (!user) {
    return <>unknown user</>;
  }

  return (
    <InlineUserProfileLink user={user}>
      {user.displayName} (@{user.handle})
    </InlineUserProfileLink>
  );
}

function categoryLabel(category: ReportCategory): string {
  const labels: Record<ReportCategory, string> = {
    harassment: "Harassment",
    hate: "Hate or abuse",
    sexual_content: "Sexual content",
    non_consensual_content: "Non-consensual content",
    private_info: "Private information",
    spam_or_scam: "Spam or scam",
    impersonation: "Impersonation",
    copyright: "Copyright",
    violence_or_threats: "Violence or threats",
    self_harm: "Self-harm",
    illegal_content: "Illegal content",
    other: "Other",
  };

  return labels[category];
}

function targetTypeLabel(targetType: ModerationReport["targetType"]): string {
  const labels: Record<ModerationReport["targetType"], string> = {
    post: "Post",
    profile: "Profile",
    room: "Room",
    message: "Message",
  };

  return labels[targetType];
}

function targetLabel(report: ModerationReport): string {
  if (report.post) {
    return "Reported post";
  }

  if (report.targetType === "profile") {
    return "Reported profile";
  }

  if (report.targetType === "room") {
    return "Reported room";
  }

  if (report.targetType === "message") {
    return "Reported message";
  }

  return "Reported content";
}

function targetSummaryText(report: ModerationReport): string {
  if (report.post) {
    return `Post by ${report.post.author?.handle ? `@${report.post.author.handle}` : "unknown user"}`;
  }

  if (report.profile) {
    return `${report.profile.displayName} (@${report.profile.handle}) · ${report.profile.status}`;
  }

  if (report.room) {
    return `/${report.room.slug} · ${report.room.visibility}`;
  }

  if (report.message) {
    return `Message from ${report.message.sender?.handle ? `@${report.message.sender.handle}` : "unknown user"}`;
  }

  return targetTypeLabel(report.targetType);
}

function actionTakenLabel(value: string | null): string {
  const labels: Record<string, string> = {
    dismiss_report: "Dismissed",
    hide_post: "Post hidden",
    mark_reviewed: "Reviewed",
    remove_post: "Post removed",
    suspend_user: "User suspended",
  };

  if (!value) {
    return "Reviewed";
  }

  return labels[value] ?? value.replaceAll("_", " ");
}

function statusLabel(status: ModerationReportStatus): string {
  const labels: Record<ModerationReportStatus, string> = {
    open: "Open",
    reviewed: "Reviewed",
    dismissed: "Dismissed",
    actioned: "Action taken",
  };

  return labels[status];
}

function statusTone(status: ModerationReportStatus): BadgeTone {
  if (status === "reviewed" || status === "dismissed" || status === "actioned") {
    return "leaf";
  }

  return "rose";
}

function rarityLabel(rarity: BadgeDefinition["rarity"]): string {
  const labels: Record<BadgeDefinition["rarity"], string> = {
    common: "Common",
    rare: "Rare",
    epic: "Epic",
    legendary: "Legendary",
    founder: "Founder",
  };

  return labels[rarity];
}

function rarityTone(rarity: BadgeDefinition["rarity"]): BadgeTone {
  const tones: Record<BadgeDefinition["rarity"], BadgeTone> = {
    common: "default",
    rare: "cool",
    epic: "rose",
    legendary: "warm",
    founder: "leaf",
  };

  return tones[rarity];
}

function formatDate(value: string): string {
  const parsed = parseApiTimestamp(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}
