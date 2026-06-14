import {
  Clock3,
  MessageCircle,
  PenLine,
  Radio,
  ScrollText,
  Settings,
  Shield,
  UserRound,
  UsersRound,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router";
import { PageMeta } from "../components/PageMeta";
import { PostCard } from "../components/social/PostCard";
import { ReportForm } from "../components/social/ReportForm";
import { RoomEditModal } from "../components/social/RoomEditModal";
import {
  InlineUserProfileLink,
  UserIdentityLink,
} from "../components/social/UserProfileLink";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Panel } from "../components/ui/Panel";
import {
  deletePost,
  deleteRoom,
  getRoom,
  getRoomMembers,
  getRoomPosts,
  joinRoom,
  leaveRoom,
  addRoomModerator,
  removeRoomModerator,
  updatePost,
  updateRoom,
  uploadImage,
} from "../lib/api";
import { ApiClientError } from "../lib/apiClient";
import { postCreatedEventName } from "../lib/postEvents";
import { canDeletePost, canHidePost } from "../lib/postPermissions";
import { formatRelativeTime } from "../lib/dates";
import { cardEntrance, pageEntrance } from "../lib/motionPresets";
import { formatCountWithUnit } from "../lib/pluralize";
import type { AppShellOutletContext } from "../components/layout/AppShell";
import type { ImageUploadPurpose, RoomInput } from "../lib/api";
import type { Post, Room, RoomMember } from "../lib/types";
import { useAsyncData } from "../lib/useAsyncData";
import { useAuth } from "../lib/useAuth";

export function RoomPage() {
  const { csrfToken, user } = useAuth();
  const navigate = useNavigate();
  const { openPostComposer } = useOutletContext<AppShellOutletContext>();
  const { slug = "" } = useParams();
  const normalizedSlug = slug.toLowerCase();
  const roomLoader = useMemo(
    () => () => getRoom(normalizedSlug),
    [normalizedSlug],
  );
  const postsLoader = useMemo(
    () => () => getRoomPosts(normalizedSlug),
    [normalizedSlug],
  );
  const membersLoader = useMemo(
    () => () => getRoomMembers(normalizedSlug),
    [normalizedSlug],
  );
  const roomState = useAsyncData(roomLoader);
  const postsState = useAsyncData(postsLoader);
  const membersState = useAsyncData(membersLoader);
  const [roomOverride, setRoomOverride] = useState<Room | undefined>();
  const [membersOverride, setMembersOverride] = useState<RoomMember[] | undefined>();
  const [createdPosts, setCreatedPosts] = useState<Post[]>([]);
  const [removedPostIds, setRemovedPostIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [pendingPostId, setPendingPostId] = useState<number | undefined>();
  const [pendingRoomAction, setPendingRoomAction] = useState<string | undefined>();
  const [editOpen, setEditOpen] = useState(false);
  const [postActionError, setPostActionError] = useState<string | undefined>();
  const room = roomOverride?.slug === normalizedSlug ? roomOverride : roomState.data;
  const members = membersOverride ?? membersState.data ?? [];
  const canEditRoom =
    Boolean(room) &&
    (user?.role === "admin" ||
      room?.myRoomRole === "owner" ||
      room?.myRoomRole === "moderator");
  const canManageRoomModerators =
    Boolean(room) && (user?.role === "admin" || room?.myRoomRole === "owner");
  const canDeleteRoom =
    Boolean(room) && (user?.role === "admin" || room?.myRoomRole === "owner");
  const posts = useMemo(
    () => {
      const roomPosts = postsState.data ?? [];

      return [
        ...createdPosts.filter((post) => post.room.slug === normalizedSlug),
        ...roomPosts,
      ].filter((post, index, allPosts) => {
        if (removedPostIds.has(post.id)) {
          return false;
        }

        return allPosts.findIndex((item) => item.id === post.id) === index;
      });
    },
    [createdPosts, normalizedSlug, postsState.data, removedPostIds],
  );
  const roomMissing =
    roomState.error instanceof ApiClientError && roomState.error.status === 404;

  const handlePostCreated = useCallback(
    (post: Post) => {
      if (post.room.slug !== normalizedSlug) {
        return;
      }

      setCreatedPosts((current) => [post, ...current]);
      setRemovedPostIds((current) => {
        const next = new Set(current);
        next.delete(post.id);
        return next;
      });
    },
    [normalizedSlug],
  );

  useEffect(() => {
    function handleCreated(event: Event) {
      const post = (event as CustomEvent<Post>).detail;

      if (post) {
        handlePostCreated(post);
      }
    }

    window.addEventListener(postCreatedEventName, handleCreated);

    return () => window.removeEventListener(postCreatedEventName, handleCreated);
  }, [handlePostCreated]);

  async function handleDeletePost(post: Post) {
    if (!csrfToken) {
      setPostActionError("Your session needs to refresh before deleting.");
      return;
    }

    setPendingPostId(post.id);
    setPostActionError(undefined);

    try {
      await deletePost(post.id, csrfToken);
      markPostRemoved(post.id);
    } catch (caught) {
      setPostActionError(
        caught instanceof Error ? caught.message : "Post could not be deleted.",
      );
    } finally {
      setPendingPostId(undefined);
    }
  }

  async function handleHidePost(post: Post) {
    if (!csrfToken) {
      setPostActionError("Your session needs to refresh before hiding.");
      return;
    }

    setPendingPostId(post.id);
    setPostActionError(undefined);

    try {
      await updatePost(post.id, { status: "hidden" }, csrfToken);
      markPostRemoved(post.id);
    } catch (caught) {
      setPostActionError(
        caught instanceof Error ? caught.message : "Post could not be hidden.",
      );
    } finally {
      setPendingPostId(undefined);
    }
  }

  function markPostRemoved(postId: number) {
    setRemovedPostIds((current) => new Set(current).add(postId));
    setCreatedPosts((current) => current.filter((post) => post.id !== postId));
  }

  async function handleJoinToggle() {
    if (!room || !csrfToken) {
      setPostActionError("Please log in again before changing room membership.");
      return;
    }

    setPendingRoomAction(room.joinedByMe ? "leave" : "join");
    setPostActionError(undefined);

    try {
      const updated = room.joinedByMe
        ? await leaveRoom(room.slug, csrfToken)
        : await joinRoom(room.slug, csrfToken);
      setRoomOverride(updated);
    } catch (caught) {
      setPostActionError(
        caught instanceof Error ? caught.message : "Room membership could not be updated.",
      );
    } finally {
      setPendingRoomAction(undefined);
    }
  }

  async function handleSaveRoom(input: RoomInput) {
    if (!room || !csrfToken) {
      throw new Error("Please log in again before editing this room.");
    }

    const updated = await updateRoom(room.slug, input, csrfToken);
    setRoomOverride(updated);

    return updated;
  }

  async function handleAddModerator(handle: string) {
    if (!room || !csrfToken) {
      throw new Error("Please log in again before managing moderators.");
    }

    const updatedMembers = await addRoomModerator(room.slug, handle, csrfToken);
    setMembersOverride(updatedMembers);
  }

  async function handleRemoveModerator(handle: string) {
    if (!room || !csrfToken) {
      throw new Error("Please log in again before managing moderators.");
    }

    const updatedMembers = await removeRoomModerator(room.slug, handle, csrfToken);
    setMembersOverride(updatedMembers);
  }

  async function handleDeleteRoom() {
    if (!room || !csrfToken) {
      throw new Error("Please log in again before deleting this room.");
    }

    await deleteRoom(room.slug, csrfToken);
    navigate("/rooms");
  }

  async function handleUpload(file: File, purpose: ImageUploadPurpose) {
    if (!csrfToken) {
      throw new Error("Please log in again before uploading.");
    }

    return uploadImage(file, purpose, csrfToken);
  }

  if (roomMissing) {
    return (
      <motion.div
        className="space-y-6"
        data-testid="room-page"
        variants={pageEntrance}
        initial="hidden"
        animate="show"
      >
        <PageMeta
          title="Room not found"
          description="This room could not be found on thia.lol."
          path={`/rooms/${normalizedSlug}`}
        />
        <EmptyState
          icon={Radio}
          title="Room not found"
          text="This room may have moved or is not public."
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      className="space-y-6"
      data-testid="room-page"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <PageMeta
        title={room ? `${room.name} Room` : "Room"}
        description={room?.summary ?? "A public room on thia.lol."}
        path={`/rooms/${normalizedSlug}`}
      />

      {room ? (
        <RoomHeader
          room={room}
          canEdit={canEditRoom}
          canReport={user?.id !== room.createdBy}
          pendingAction={pendingRoomAction}
          postCount={posts.length > room.postCount ? posts.length : room.postCount}
          userSignedIn={Boolean(user)}
          onEdit={() => setEditOpen(true)}
          onJoinToggle={() => void handleJoinToggle()}
          onPost={() => openPostComposer(room.slug)}
        />
      ) : roomState.loading ? (
        <RoomNotice title="Opening room" text="The room is loading." />
      ) : (
        <RoomNotice
          title="Room is not available"
          text="Try refreshing in a moment."
          tone="rose"
        />
      )}

      {postsState.loading ? (
        <RoomNotice title="Loading posts" text="Posts are loading." />
      ) : null}

      {postsState.error && !postsState.loading ? (
        <RoomNotice
          title="Posts are not available"
          text="Try refreshing in a moment."
          tone="rose"
        />
      ) : null}

      {postActionError ? (
        <p className="rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink">
          {postActionError}
        </p>
      ) : null}

      {room ? (
        <RoomAbout room={room} members={members} membersError={membersState.error} />
      ) : null}

      {!postsState.loading && !postsState.error && room && posts.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="No posts yet"
          text="This room is quiet for now."
        />
      ) : null}

      {posts.length > 0 ? (
        <section className="space-y-4" aria-label={`${room?.name ?? "Room"} posts`}>
          {posts.map((post, index) => (
            <PostCard
              key={post.id}
              post={post}
              index={index}
              canDelete={canDeletePost(user, post)}
              canHide={canHidePost(user)}
              actionPending={pendingPostId === post.id}
              onDelete={(targetPost) => void handleDeletePost(targetPost)}
              onHide={(targetPost) => void handleHidePost(targetPost)}
            />
          ))}
        </section>
      ) : null}

      {room && editOpen ? (
        <RoomEditModal
          mode="edit"
          open={editOpen}
          room={room}
          members={members}
          canManageModerators={canManageRoomModerators}
          canDeleteRoom={canDeleteRoom}
          onClose={() => setEditOpen(false)}
          onSave={handleSaveRoom}
          onUpload={handleUpload}
          onAddModerator={handleAddModerator}
          onRemoveModerator={handleRemoveModerator}
          onDeleteRoom={handleDeleteRoom}
        />
      ) : null}
    </motion.div>
  );
}

function RoomHeader({
  canEdit,
  canReport,
  onPost,
  onEdit,
  onJoinToggle,
  pendingAction,
  postCount,
  room,
  userSignedIn,
}: {
  canEdit: boolean;
  canReport: boolean;
  onPost: () => void;
  onEdit: () => void;
  onJoinToggle: () => void;
  pendingAction: string | undefined;
  postCount: number;
  room: Room;
  userSignedIn: boolean;
}) {
  const isOwner = room.myRoomRole === "owner";
  const joinLabel = room.joinedByMe
    ? isOwner
      ? "Joined"
      : pendingAction === "leave"
        ? "Leaving"
        : "Leave room"
    : pendingAction === "join"
      ? "Joining"
      : "Join";

  return (
    <motion.div variants={cardEntrance} custom={0} initial="hidden" animate="show">
      <Panel className="overflow-hidden">
        <div style={{ ["--room-accent" as string]: room.accent }}>
          {room.bannerUrl ? (
            <img
              alt=""
              src={room.bannerUrl}
              className="h-40 w-full object-cover sm:h-56"
            />
          ) : (
            <div
              className="h-20"
              style={{
                background:
                  "linear-gradient(90deg, var(--room-accent), color-mix(in oklab, var(--room-accent) 28%, transparent))",
              }}
            />
          )}
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 max-w-3xl">
              <div
                className="-mt-14 mb-4 grid size-24 place-items-center overflow-hidden rounded-panel border border-white/50 bg-surface shadow-lift"
                style={{
                  background:
                    "linear-gradient(135deg, color-mix(in oklab, var(--room-accent) 54%, transparent), var(--app-surface))",
                  ["--room-accent" as string]: room.accent,
                }}
              >
                {room.iconUrl ? (
                  <img alt="" src={room.iconUrl} className="size-full object-cover" />
                ) : (
                  <Radio aria-hidden="true" size={30} className="text-text" />
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="leaf">room</Badge>
                {room.myRoomRole ? <Badge tone="warm">{roleLabel(room.myRoomRole)}</Badge> : null}
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-normal text-text sm:text-4xl">
                {room.name}
              </h1>
              <p className="mt-1 text-base text-muted">/{room.slug}</p>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
                {room.description || room.summary}
              </p>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row lg:flex-col">
              {userSignedIn ? (
                <Button
                  type="button"
                  variant={room.joinedByMe ? "secondary" : "primary"}
                  className="w-full sm:w-auto"
                  data-testid="room-join-button"
                  disabled={Boolean(pendingAction) || isOwner}
                  icon={<UsersRound aria-hidden="true" size={17} />}
                  onClick={onJoinToggle}
                >
                  {joinLabel}
                </Button>
              ) : null}
              <Button
                type="button"
                className="hidden w-full sm:inline-flex sm:w-auto"
                data-testid="room-post-button"
                icon={<PenLine aria-hidden="true" size={17} />}
                onClick={onPost}
              >
                Post
              </Button>
              {canEdit ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  data-testid="edit-room-button"
                  icon={<Settings aria-hidden="true" size={17} />}
                  onClick={onEdit}
                >
                  Edit room
                </Button>
              ) : null}
              {canReport ? (
                <ReportForm
                  className="w-full sm:w-auto"
                  targetType="room"
                  targetId={room.id}
                  reportedUserId={room.owner?.id}
                  title="Report room"
                  explainer={`This reports /${room.slug} to moderators.`}
                  triggerClassName="w-full sm:w-auto"
                />
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:max-w-4xl">
            <RoomMetric
              icon={MessageCircle}
              label="Posts"
              value={formatCountWithUnit(postCount, "post")}
            />
            <RoomMetric
              icon={UsersRound}
              label="Members"
              value={formatCountWithUnit(room.memberCount, "member")}
            />
            <RoomMetric
              icon={Clock3}
              label="Latest"
              value={
                room.latestActivityAt
                  ? formatActivityTime(room.latestActivityAt)
                  : "No activity yet"
              }
            />
            <RoomMetric
              icon={UserRound}
              label="Owner"
              value={
                room.owner ? (
                  <InlineUserProfileLink user={room.owner}>
                    @{room.owner.handle}
                  </InlineUserProfileLink>
                ) : (
                  "Unassigned"
                )
              }
            />
          </div>
        </div>
      </Panel>
    </motion.div>
  );
}

function RoomAbout({
  members,
  membersError,
  room,
}: {
  members: RoomMember[];
  membersError: Error | undefined;
  room: Room;
}) {
  const moderators = members.filter((member) => member.role === "moderator");

  return (
    <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]" aria-label="Room details">
      <Panel className="p-5">
        <div className="flex items-center gap-2">
          <ScrollText aria-hidden="true" size={17} className="text-muted" />
          <h2 className="text-base font-semibold text-text">Room rules</h2>
        </div>
        {room.rules ? (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">
            {room.rules}
          </p>
        ) : (
          <p className="mt-3 text-sm leading-6 text-muted">
            No room rules have been added yet.
          </p>
        )}
      </Panel>

      <Panel className="p-5">
        <div className="flex items-center gap-2">
          <Shield aria-hidden="true" size={17} className="text-muted" />
          <h2 className="text-base font-semibold text-text">Moderators</h2>
        </div>
        <div className="mt-3 space-y-3">
          {room.owner ? (
            <RoomMemberRow user={room.owner} role="owner" />
          ) : (
            <p className="text-sm text-muted">Owner unassigned</p>
          )}
          {moderators.map((member) => (
            <RoomMemberRow key={member.id} user={member.user} role={member.role} />
          ))}
          {moderators.length === 0 ? (
            <p className="text-sm text-muted">No extra moderators yet.</p>
          ) : null}
          {membersError ? (
            <p className="rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink">
              Members are not available.
            </p>
          ) : null}
        </div>
      </Panel>
    </section>
  );
}

function RoomMemberRow({
  role,
  user,
}: {
  role: "owner" | "moderator" | "member";
  user: RoomMember["user"];
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-card border border-line bg-canvas/45 p-3 sm:flex-row sm:items-center sm:justify-between">
      <UserIdentityLink user={user} showAvatar={false} className="flex-1" />
      <Badge tone={role === "owner" ? "warm" : "cool"}>{roleLabel(role)}</Badge>
    </div>
  );
}

function RoomMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MessageCircle;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-card border border-line bg-canvas/50 p-3">
      <div className="flex items-center gap-2 text-xs text-muted">
        <Icon aria-hidden="true" size={14} />
        {label}
      </div>
      <p className="mt-2 text-sm font-semibold text-text">{value}</p>
    </div>
  );
}

function RoomNotice({
  text,
  title,
  tone = "cool",
}: {
  text: string;
  title: string;
  tone?: "cool" | "rose";
}) {
  return (
    <Panel className="p-4">
      <Badge tone={tone}>{tone === "rose" ? "notice" : "loading"}</Badge>
      <h2 className="mt-3 text-sm font-semibold text-text">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-muted">{text}</p>
    </Panel>
  );
}

function formatActivityTime(value: string): string {
  return formatRelativeTime(value).replace(/^now$/, "active now");
}

function roleLabel(role: "owner" | "moderator" | "member"): string {
  if (role === "owner") {
    return "Owner";
  }

  if (role === "moderator") {
    return "Moderator";
  }

  return "Member";
}
