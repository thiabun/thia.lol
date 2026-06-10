import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import {
  Activity,
  Ban,
  CheckCircle2,
  EyeOff,
  MessageCircle,
  Radio,
  RefreshCw,
  Shield,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageMeta } from "../components/PageMeta";
import { ApiStateNotice } from "../components/ui/ApiStateNotice";
import { Badge } from "../components/ui/Badge";
import { Button, ButtonLink } from "../components/ui/Button";
import { TextareaField } from "../components/ui/Field";
import { Panel } from "../components/ui/Panel";
import {
  getAdminRooms,
  getAdminReports,
  hideAdminPost,
  resolveAdminReport,
  suspendAdminUser,
  type ModerationReport,
  type ModerationReportStatus,
  type ModerationUser,
  type ReportReason,
} from "../lib/api";
import { pageEntrance } from "../lib/motionPresets";
import { formatCountWithUnit } from "../lib/pluralize";
import type { Room } from "../lib/types";
import { useAuth } from "../lib/useAuth";

type ActionName = "hide" | "suspend" | "resolve" | "dismiss";
type BadgeTone = "default" | "warm" | "cool" | "leaf" | "rose";

export function AdminPage() {
  const { status, user, csrfToken } = useAuth();
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [error, setError] = useState<string>();
  const [roomsError, setRoomsError] = useState<string>();
  const [pendingAction, setPendingAction] = useState<string>();
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

  useEffect(() => {
    let active = true;

    if (isModerator) {
      queueMicrotask(() => {
        if (active) {
          void loadReports();
          void loadRooms();
        }
      });
    }

    return () => {
      active = false;
    };
  }, [isModerator, loadReports, loadRooms]);

  const metrics = useMemo(() => {
    const open = reports.filter((report) => report.status === "open").length;
    const resolved = reports.filter(
      (report) => report.status === "resolved" || report.status === "dismissed",
    ).length;
    const hiddenPosts = reports.filter(
      (report) => report.post?.status === "hidden",
    ).length;
    const suspendedUsers = reports.filter(
      (report) => report.reportedUser?.status === "suspended",
    ).length;

    return { open, resolved, hiddenPosts, suspendedUsers };
  }, [reports]);

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
            disabled={loading || loadingRooms}
            icon={<RefreshCw aria-hidden="true" size={15} />}
            onClick={() => {
              void loadReports();
              void loadRooms();
            }}
          >
            Refresh
          </Button>
        </div>
      </Panel>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminMetric icon={Activity} label="Open reports" value={String(metrics.open)} />
        <AdminMetric
          icon={CheckCircle2}
          label="Closed reports"
          value={String(metrics.resolved)}
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
      </section>

      <Panel className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="cool">rooms</Badge>
            <h2 className="mt-3 text-xl font-semibold text-text">Room metadata</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Read-only room status for moderation planning.
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
            onResolve={(targetReport) =>
              void runAction(targetReport, "resolve", (token) =>
                resolveAdminReport(
                  targetReport.id,
                  {
                    status: "resolved",
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

type ReportRowProps = {
  report: ModerationReport;
  currentUserId: number;
  notes: string;
  pendingAction: string | undefined;
  onNotesChange: (reportId: number, value: string) => void;
  onHidePost: (report: ModerationReport) => void;
  onSuspendUser: (report: ModerationReport) => void;
  onResolve: (report: ModerationReport) => void;
  onDismiss: (report: ModerationReport) => void;
};

function ReportRow({
  report,
  currentUserId,
  notes,
  pendingAction,
  onNotesChange,
  onHidePost,
  onSuspendUser,
  onResolve,
  onDismiss,
}: ReportRowProps) {
  const canHidePost =
    report.post !== null &&
    report.post.status !== "hidden" &&
    report.post.status !== "removed";
  const canSuspendUser =
    report.reportedUser !== null &&
    report.reportedUser.status !== "suspended" &&
    report.reportedUser.id !== currentUserId;
  const canClose = report.status === "open" || report.status === "reviewing";

  return (
    <Panel className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(report.status)}>{statusLabel(report.status)}</Badge>
            <Badge>{reasonLabel(report.reason)}</Badge>
            <span className="text-xs text-muted">#{report.id}</span>
          </div>
          <h2 className="mt-3 text-lg font-semibold text-text">
            {report.post ? "Reported post" : "Reported user"}
          </h2>
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
        </div>

        <div className="space-y-3">
          <TargetSummary label="Reported user" user={report.reportedUser} />
          <TextareaField
            id={`moderation-notes-${report.id}`}
            label="Action notes"
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
                  disabled={pendingAction === `${report.id}:resolve`}
                  icon={<CheckCircle2 aria-hidden="true" size={15} />}
                  onClick={() => onResolve(report)}
                >
                  Resolve
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
            {room.mood ? <Badge>{room.mood}</Badge> : null}
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
          <MessageCircle aria-hidden="true" size={13} />
          {formatCountWithUnit(room.postCount, "post")}
        </span>
        <span>Created: {room.createdAt ? formatDate(room.createdAt) : "unknown"}</span>
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

function reasonLabel(reason: ReportReason): string {
  const labels: Record<ReportReason, string> = {
    spam: "Spam",
    harassment: "Harassment",
    abuse: "Abuse",
    self_harm: "Self-harm",
    illegal: "Illegal content",
    other: "Other",
  };

  return labels[reason];
}

function statusLabel(status: ModerationReportStatus): string {
  const labels: Record<ModerationReportStatus, string> = {
    open: "Open",
    reviewing: "Reviewing",
    resolved: "Resolved",
    dismissed: "Dismissed",
  };

  return labels[status];
}

function statusTone(status: ModerationReportStatus): BadgeTone {
  if (status === "resolved" || status === "dismissed") {
    return "leaf";
  }

  if (status === "reviewing") {
    return "cool";
  }

  return "rose";
}

function formatDate(value: string): string {
  const parsed = new Date(value.includes("T") ? value : value.replace(" ", "T"));

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
