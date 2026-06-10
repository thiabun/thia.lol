import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import {
  Activity,
  Award,
  Ban,
  CheckCircle2,
  EyeOff,
  MessageCircle,
  Radio,
  RefreshCw,
  Shield,
  Trash2,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageMeta } from "../components/PageMeta";
import { ApiStateNotice } from "../components/ui/ApiStateNotice";
import { Badge } from "../components/ui/Badge";
import { Button, ButtonLink } from "../components/ui/Button";
import { SelectField, TextareaField, TextField } from "../components/ui/Field";
import { Panel } from "../components/ui/Panel";
import {
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
import { pageEntrance } from "../lib/motionPresets";
import { formatCountWithUnit } from "../lib/pluralize";
import type { BadgeDefinition, Room, UserBadge } from "../lib/types";
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
  const [loading, setLoading] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingBadges, setLoadingBadges] = useState(false);
  const [error, setError] = useState<string>();
  const [roomsError, setRoomsError] = useState<string>();
  const [badgesError, setBadgesError] = useState<string>();
  const [pendingAction, setPendingAction] = useState<string>();
  const [pendingBadgeAction, setPendingBadgeAction] = useState<string>();
  const [badgeHandle, setBadgeHandle] = useState("");
  const [badgeKey, setBadgeKey] = useState("");
  const [badgeReason, setBadgeReason] = useState("");
  const [badgeMessage, setBadgeMessage] = useState<string>();
  const [notesByReport, setNotesByReport] = useState<Record<number, string>>({});
  const isModerator = user?.role === "moderator" || user?.role === "admin";

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

  useEffect(() => {
    let active = true;

    if (isModerator) {
      queueMicrotask(() => {
        if (active) {
          void loadReports();
          void loadRooms();
          void loadBadges();
        }
      });
    }

    return () => {
      active = false;
    };
  }, [isModerator, loadBadges, loadReports, loadRooms]);

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
          text="The admin queue unlocks after your role is confirmed."
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
            Moderation tools are available to signed-in moderators and admins.
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
            Your current role is {user.role}. Report queues and enforcement actions
            are limited to moderators and admins.
          </p>
        </Panel>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <Panel className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="rose">moderation</Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-normal text-text">
              Report queue
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
              Review reports, hide posts, suspend accounts, and close the loop.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={loading || loadingRooms || loadingBadges}
            icon={<RefreshCw aria-hidden="true" size={15} />}
            onClick={() => {
              void loadReports();
              void loadRooms();
              void loadBadges();
            }}
          >
            Refresh
          </Button>
        </div>
      </Panel>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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

      <Panel className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="cool">rooms</Badge>
            <h2 className="mt-3 text-xl font-semibold text-text">Room metadata</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Room ownership, membership, and activity metadata for moderation planning.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted">
            <Radio aria-hidden="true" size={16} />
            {formatCountWithUnit(rooms.length, "room")}
          </div>
        </div>

        {loadingRooms ? (
          <p className="mt-4 text-sm text-muted">Loading rooms</p>
        ) : null}

        {roomsError ? (
          <p className="mt-4 rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink">
            {roomsError}
          </p>
        ) : null}

        {rooms.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {rooms.map((room) => (
              <AdminRoomRow key={room.id} room={room} />
            ))}
          </div>
        ) : null}
      </Panel>

      {loading ? (
        <ApiStateNotice
          kind="loading"
          title="Loading reports"
          text="Fetching the latest moderation queue."
        />
      ) : null}

      {error ? (
        <p className="rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink">
          {error}
        </p>
      ) : null}

      <section className="space-y-4" aria-label="Reports">
        {reports.length === 0 && !loading ? (
          <Panel className="p-5">
            <Badge tone="leaf">clear</Badge>
            <h2 className="mt-3 text-lg font-semibold text-text">No reports yet</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              New reports will appear here after logged-in members flag posts or
              profiles.
            </p>
          </Panel>
        ) : null}

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
      </section>
    </AdminShell>
  );
}

function AdminShell({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="mx-auto max-w-6xl space-y-6"
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
    <Panel className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge tone="warm">badges</Badge>
          <h2 className="mt-3 text-xl font-semibold text-text">Badge management</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Grant visible status badges to members with traceable reasons.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted">
          <Award aria-hidden="true" size={16} />
          {formatCountWithUnit(activeBadges.length, "definition")}
        </div>
      </div>

      {loading ? <p className="mt-4 text-sm text-muted">Loading badges</p> : null}

      {error ? (
        <p className="mt-4 rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="mt-4 rounded-card border border-line bg-canvas/55 p-3 text-sm text-text">
          {message}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_1.4fr_auto] lg:items-end">
        <TextField
          id="badge-grant-handle"
          label="Handle"
          value={handle}
          placeholder="member"
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
          disabled={pendingAction === "grant" || !handle.trim() || !badgeKey}
          icon={<Award aria-hidden="true" size={16} />}
          onClick={onGrant}
        >
          {pendingAction === "grant" ? "Granting" : "Grant badge"}
        </Button>
      </div>

      {activeBadges.length > 0 ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {activeBadges.map((badge) => (
            <div
              key={badge.badgeKey}
              className="rounded-card border border-line bg-canvas/45 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={rarityTone(badge.rarity)}>{rarityLabel(badge.rarity)}</Badge>
                <span className="text-xs text-muted">{badge.source}</span>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-text">{badge.name}</h3>
              <p className="mt-1 text-xs text-muted">{badge.badgeKey}</p>
              {badge.description ? (
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">
                  {badge.description}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {recentGrants.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-text">Recent grants</h3>
          <div className="mt-3 space-y-2">
            {recentGrants.map((grant) => (
              <div
                key={grant.id}
                className="flex flex-col gap-3 rounded-card border border-line bg-canvas/45 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text">
                    {grant.badge.name} to{" "}
                    {grant.user ? `@${grant.user.handle}` : "unknown user"}
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
      ) : null}
    </Panel>
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
  const targetTitle = targetLabel(report);

  return (
    <Panel className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(report.status)}>{statusLabel(report.status)}</Badge>
            <Badge>{categoryLabel(report.category)}</Badge>
            <Badge tone="cool">{targetTypeLabel(report.targetType)}</Badge>
            <span className="text-xs text-muted">#{report.id}</span>
          </div>
          <h2 className="mt-3 text-lg font-semibold text-text">{targetTitle}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Reported by {userLabel(report.reporter)} · {formatDate(report.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted">
          <Shield aria-hidden="true" size={16} />
          {report.actionCount} action{report.actionCount === 1 ? "" : "s"}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-3">
          {report.details ? (
            <div className="rounded-card border border-line bg-canvas/45 p-3">
              <p className="text-xs font-medium uppercase text-muted">Reporter note</p>
              <p className="mt-2 text-sm leading-6 text-text">{report.details}</p>
            </div>
          ) : null}

          {report.post ? (
            <div className="rounded-card border border-line bg-canvas/45 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={report.post.status === "hidden" ? "rose" : "warm"}>
                  post {report.post.status}
                </Badge>
                <span className="text-xs text-muted">
                  by {userLabel(report.post.author)}
                </span>
              </div>
              <p className="mt-3 line-clamp-4 text-sm leading-6 text-text">
                {report.post.body}
              </p>
            </div>
          ) : null}

          {report.actionTaken || report.moderatorNote || report.reviewedBy ? (
            <div className="rounded-card border border-line bg-canvas/45 p-3">
              <p className="text-xs font-medium uppercase text-muted">Action taken</p>
              <p className="mt-2 text-sm font-semibold text-text">
                {actionTakenLabel(report.actionTaken)}
              </p>
              {report.reviewedBy ? (
                <p className="mt-1 text-xs text-muted">
                  by {userLabel(report.reviewedBy)}
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
          <div className="rounded-card border border-line bg-canvas/45 p-3">
            <p className="text-xs font-medium uppercase text-muted">Target summary</p>
            <p className="mt-2 text-sm font-semibold text-text">{targetTitle}</p>
            <p className="mt-1 text-xs text-muted">
              {targetTypeLabel(report.targetType)}
              {report.targetId ? ` #${report.targetId}` : ""}
            </p>
          </div>
          <TargetSummary label="Reported user" user={report.reportedUser} />
          <TextareaField
            id={`moderation-notes-${report.id}`}
            label="Moderator note"
            rows={3}
            maxLength={2000}
            value={notes}
            placeholder="Optional internal note"
            onChange={(event) => onNotesChange(report.id, event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {canHidePost ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
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
                disabled={pendingAction === `${report.id}:suspend`}
                icon={<Ban aria-hidden="true" size={15} />}
                onClick={() => onSuspendUser(report)}
              >
                Suspend
              </Button>
            ) : null}
            {canClose ? (
              <>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
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
                  disabled={pendingAction === `${report.id}:dismiss`}
                  icon={<XCircle aria-hidden="true" size={15} />}
                  onClick={() => onDismiss(report)}
                >
                  Dismiss
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </Panel>
  );
}

type AdminMetricProps = {
  icon: LucideIcon;
  label: string;
  value: string;
};

function AdminMetric({ icon: Icon, label, value }: AdminMetricProps) {
  return (
    <Panel className="p-4">
      <div className="grid size-11 place-items-center rounded-card bg-surface-strong text-accent-strong">
        <Icon aria-hidden="true" size={19} />
      </div>
      <p className="mt-4 text-sm text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-text">{value}</p>
    </Panel>
  );
}

function AdminRoomRow({ room }: { room: Room }) {
  return (
    <div className="rounded-card border border-line bg-canvas/45 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="cool">{room.visibility ?? "public"}</Badge>
            <span className="text-xs text-muted">#{room.id}</span>
          </div>
          <h3 className="mt-3 text-sm font-semibold text-text">{room.name}</h3>
          <p className="mt-1 truncate text-xs text-muted">/{room.slug}</p>
        </div>
        <div
          className="size-7 shrink-0 rounded-full border border-line"
          style={{ backgroundColor: room.accent }}
          aria-hidden="true"
        />
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted">
        {room.summary || "No description"}
      </p>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
        <span>Owner: {room.owner ? `@${room.owner.handle}` : "unassigned"}</span>
        <span className="inline-flex items-center gap-1">
          <Radio aria-hidden="true" size={13} />
          {formatCountWithUnit(room.memberCount, "member")}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageCircle aria-hidden="true" size={13} />
          {formatCountWithUnit(room.postCount, "post")}
        </span>
        <span>Created: {room.createdAt ? formatDate(room.createdAt) : "unknown"}</span>
      </div>
      <ButtonLink
        to={`/rooms/${room.slug}`}
        size="sm"
        variant="secondary"
        className="mt-4"
      >
        Open room
      </ButtonLink>
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
    <div className="rounded-card border border-line bg-canvas/45 p-3">
      <p className="text-xs font-medium uppercase text-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold text-text">{userLabel(user)}</p>
      {user ? (
        <p className="mt-1 text-xs text-muted">
          {user.role} · {user.status}
        </p>
      ) : null}
    </div>
  );
}

function userLabel(user: ModerationUser | null): string {
  if (!user) {
    return "unknown user";
  }

  return `${user.displayName} (@${user.handle})`;
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
