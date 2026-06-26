import {
  Clock3,
  MessageCircle,
  PenLine,
  Radio,
  ScrollText,
  Settings,
  Share2,
  Shield,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react";
import { motion } from "motion/react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useOutletContext, useParams } from "react-router";
import { PageMeta } from "../components/PageMeta";
import { PostCard } from "../components/social/PostCard";
import { ReportForm } from "../components/social/ReportForm";
import { RoomShareModal } from "../components/social/RoomShareModal";
import { RichText } from "../components/social/RichText";
import {
  InlineUserProfileLink,
  UserIdentityLink,
} from "../components/social/UserProfileLink";
import { ApiStateNotice } from "../components/ui/ApiStateNotice";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Panel } from "../components/ui/Panel";
import {
  deletePost,
  deleteRoom,
  approveRoomAccessRequest,
  cancelRoomAccessRequest,
  denyRoomAccessRequest,
  getRoomAccessRequests,
  getRoom,
  getRoomMembers,
  getRoomPosts,
  joinRoom,
  leaveRoom,
  addRoomModerator,
  requestRoomAccess,
  removeRoomModerator,
  updatePost,
  updateRoom,
  previewImageUpload,
  uploadImage,
} from "../lib/api";
import { ApiClientError } from "../lib/apiClient";
import { postCreatedEventName } from "../lib/postEvents";
import { canDeletePost, canHidePost } from "../lib/postPermissions";
import { formatRelativeTime } from "../lib/dates";
import { cardEntrance, pageEntrance } from "../lib/motionPresets";
import { formatCountWithUnit } from "../lib/pluralize";
import { applyProfileThemeToRoot } from "../lib/profileThemes";
import { roomThemeConfig, roomThemeSwatchCssProperties } from "../lib/roomThemes";
import type { AppShellOutletContext } from "../components/layout/AppShell";
import type { ImageUploadPurpose, RoomInput } from "../lib/api";
import type { Post, Room, RoomAccessRequest, RoomMember, RoomVisibility } from "../lib/types";
import { useAsyncData } from "../lib/useAsyncData";
import { useAuth } from "../lib/useAuth";

const RoomEditModal = lazy(() =>
  import("../components/social/RoomEditModal").then((module) => ({
    default: module.RoomEditModal,
  })),
);

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
  const [shareOpen, setShareOpen] = useState(false);
  const [postActionError, setPostActionError] = useState<string | undefined>();
  const [accessRequests, setAccessRequests] = useState<RoomAccessRequest[]>([]);
  const [accessRequestsLoading, setAccessRequestsLoading] = useState(false);
  const [accessRequestsError, setAccessRequestsError] = useState<string | undefined>();
  const [pendingAccessRequestId, setPendingAccessRequestId] = useState<number | undefined>();
  const room = roomOverride?.slug === normalizedSlug ? roomOverride : roomState.data;
  const activeRoomThemeConfig = useMemo(
    () => roomThemeConfig(room),
    [room],
  );
  const members = room?.viewerCanViewPosts ? membersOverride ?? membersState.data ?? [] : [];
  const canEditRoom =
    Boolean(room) &&
    (user?.role === "admin" ||
      room?.myRoomRole === "owner" ||
      room?.myRoomRole === "moderator");
  const canManageAccessRequests = canEditRoom;
  const canManageRoomModerators =
    Boolean(room) && (user?.role === "admin" || room?.myRoomRole === "owner");
  const canDeleteRoom =
    Boolean(room) && (user?.role === "admin" || room?.myRoomRole === "owner");

  useEffect(() => {
    return applyProfileThemeToRoot(activeRoomThemeConfig);
  }, [activeRoomThemeConfig]);
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
  const postsAccessGated = Boolean(room && !room.viewerCanViewPosts);

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

  useEffect(() => {
    if (!room || !canManageAccessRequests) {
      return undefined;
    }

    let active = true;

    queueMicrotask(() => {
      if (active) {
        setAccessRequestsLoading(true);
      }
    });
    getRoomAccessRequests(room.slug)
      .then((requests) => {
        if (active) {
          setAccessRequests(requests);
          setAccessRequestsError(undefined);
        }
      })
      .catch((caught) => {
        if (active) {
          setAccessRequests([]);
          setAccessRequestsError(
            caught instanceof Error ? caught.message : "Access requests could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setAccessRequestsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [canManageAccessRequests, room]);

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

  async function handleAccessRequestToggle() {
    if (!room || !csrfToken) {
      setPostActionError("Please log in again before requesting access.");
      return;
    }

    const cancel = room.accessRequestStatus === "pending";

    setPendingRoomAction(cancel ? "cancel-request" : "request-access");
    setPostActionError(undefined);

    try {
      const updated = cancel
        ? await cancelRoomAccessRequest(room.slug, csrfToken)
        : await requestRoomAccess(room.slug, csrfToken);
      setRoomOverride(updated);
    } catch (caught) {
      setPostActionError(
        caught instanceof Error ? caught.message : "Access request could not be updated.",
      );
    } finally {
      setPendingRoomAction(undefined);
    }
  }

  async function handleReviewAccessRequest(requestId: number, decision: "approve" | "deny") {
    if (!room || !csrfToken) {
      setAccessRequestsError("Please log in again before managing access.");
      return;
    }

    setPendingAccessRequestId(requestId);
    setAccessRequestsError(undefined);

    try {
      const updated = decision === "approve"
        ? await approveRoomAccessRequest(room.slug, requestId, csrfToken)
        : await denyRoomAccessRequest(room.slug, requestId, csrfToken);
      setAccessRequests(updated);
      setRoomOverride({
        ...room,
        pendingAccessRequestCount: updated.length,
      });
    } catch (caught) {
      setAccessRequestsError(
        caught instanceof Error ? caught.message : "Access request could not be reviewed.",
      );
    } finally {
      setPendingAccessRequestId(undefined);
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

  async function handlePrepareImage(file: File, purpose: ImageUploadPurpose) {
    if (!csrfToken) {
      throw new Error("Please log in again before uploading.");
    }

    return previewImageUpload(file, purpose, csrfToken);
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
          onAccessRequestToggle={() => void handleAccessRequestToggle()}
          onEdit={() => setEditOpen(true)}
          onJoinToggle={() => void handleJoinToggle()}
          onPost={() => openPostComposer(room.slug)}
          onShare={() => setShareOpen(true)}
        />
      ) : roomState.loading ? (
        <ApiStateNotice
          kind="loading"
          title="Opening room"
          text="Loading room."
        />
      ) : (
        <ApiStateNotice
          kind="error"
          title="Room is not available"
          text="Try refreshing in a moment."
        />
      )}

      {postsState.loading ? (
        <ApiStateNotice
          kind="loading"
          title="Loading room posts"
          text="Loading posts."
        />
      ) : null}

      {postsState.error && !postsState.loading && !postsAccessGated ? (
        <ApiStateNotice
          kind="error"
          title="Posts are not available"
          text="Try refreshing in a moment."
        />
      ) : null}

      {postActionError ? (
        <p className="rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink">
          {postActionError}
        </p>
      ) : null}

      {room ? (
        <RoomAbout
          room={room}
          members={members}
          membersError={room.viewerCanViewPosts ? membersState.error : undefined}
        />
      ) : null}

      {room && canManageAccessRequests ? (
        <RoomAccessRequestsPanel
          error={accessRequestsError}
          loading={accessRequestsLoading}
          pendingRequestId={pendingAccessRequestId}
          requests={accessRequests}
          onApprove={(requestId) => void handleReviewAccessRequest(requestId, "approve")}
          onDeny={(requestId) => void handleReviewAccessRequest(requestId, "deny")}
        />
      ) : null}

      {room && postsAccessGated ? (
        <EmptyState
          icon={Sparkles}
          title={room.visibility === "invite" ? "Access required" : "Room is private"}
          text={room.visibility === "invite" ? "Request access to read posts in this room." : "Posts are visible to room members."}
        />
      ) : null}

      {!postsAccessGated && !postsState.loading && !postsState.error && room && posts.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="No posts yet"
          text="No room posts."
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
        <Suspense fallback={<RoomEditorLoadingNotice />}>
          <RoomEditModal
            mode="edit"
            open={editOpen}
            room={room}
            members={members}
            canManageModerators={canManageRoomModerators}
            canDeleteRoom={canDeleteRoom}
            onClose={() => setEditOpen(false)}
            onSave={handleSaveRoom}
            onPrepareImage={handlePrepareImage}
            onUpload={handleUpload}
            onAddModerator={handleAddModerator}
            onRemoveModerator={handleRemoveModerator}
            onDeleteRoom={handleDeleteRoom}
          />
        </Suspense>
      ) : null}
      {room && shareOpen ? (
        <RoomShareModal
          open={shareOpen}
          room={room}
          onClose={() => setShareOpen(false)}
        />
      ) : null}
    </motion.div>
  );
}

function RoomEditorLoadingNotice() {
  return (
    <div
      className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm rounded-panel border border-line bg-surface/96 px-4 py-3 text-sm text-muted shadow-lift backdrop-blur-veil"
      role="status"
    >
      Opening room editor.
    </div>
  );
}

function RoomAccessRequestsPanel({
  error,
  loading,
  onApprove,
  onDeny,
  pendingRequestId,
  requests,
}: {
  error: string | undefined;
  loading: boolean;
  onApprove: (requestId: number) => void;
  onDeny: (requestId: number) => void;
  pendingRequestId: number | undefined;
  requests: RoomAccessRequest[];
}) {
  if (!loading && requests.length === 0 && !error) {
    return null;
  }

  return (
    <Panel className="p-4" data-testid="room-access-requests">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield aria-hidden="true" size={16} className="text-muted" />
          <h2 className="text-sm font-semibold text-text">Access requests</h2>
        </div>
        <Badge tone="cool">{loading ? "Loading" : formatCountWithUnit(requests.length, "request")}</Badge>
      </div>
      {error ? (
        <p className="mt-3 rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink">
          {error}
        </p>
      ) : null}
      {requests.length > 0 ? (
        <div className="mt-3 space-y-2">
          {requests.map((request) => (
            <div
              key={request.id}
              className="flex flex-col gap-3 rounded-card border border-line bg-canvas/45 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <UserIdentityLink user={request.requester} showAvatar={false} className="min-w-0 flex-1" />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={pendingRequestId !== undefined}
                  onClick={() => onDeny(request.id)}
                >
                  {pendingRequestId === request.id ? "Denying" : "Deny"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={pendingRequestId !== undefined}
                  onClick={() => onApprove(request.id)}
                >
                  {pendingRequestId === request.id ? "Approving" : "Approve"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : loading ? (
        <p className="mt-3 text-sm text-muted">Loading access requests.</p>
      ) : null}
    </Panel>
  );
}

function RoomHeader({
  canEdit,
  canReport,
  onAccessRequestToggle,
  onPost,
  onEdit,
  onJoinToggle,
  pendingAction,
  postCount,
  room,
  userSignedIn,
  onShare,
}: {
  canEdit: boolean;
  canReport: boolean;
  onAccessRequestToggle: () => void;
  onPost: () => void;
  onEdit: () => void;
  onJoinToggle: () => void;
  onShare: () => void;
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
  const canJoinPublicRoom = userSignedIn && room.visibility === "public";
  const canLeaveRoom = userSignedIn && Boolean(room.joinedByMe) && !isOwner;
  const showJoinAction = canJoinPublicRoom || canLeaveRoom || isOwner;
  const accessRequestPending = room.accessRequestStatus === "pending";
  const showAccessRequestAction = userSignedIn && (room.viewerCanRequestAccess || accessRequestPending);
  const showShareAction =
    room.viewerCanViewPosts &&
    (room.visibility === "public" || room.visibility === "view_only");
  const accessRequestLabel = accessRequestPending
    ? pendingAction === "cancel-request"
      ? "Canceling"
      : "Access requested"
    : pendingAction === "request-access"
      ? "Requesting"
      : "Request access";

  return (
    <motion.div variants={cardEntrance} custom={0} initial="hidden" animate="show">
      <Panel
        className="overflow-hidden"
        data-testid="room-header"
        style={roomThemeSwatchCssProperties(room)}
      >
        {room.bannerUrl ? (
          <img alt="" src={room.bannerUrl} className="h-24 w-full object-cover sm:h-28" />
        ) : null}
        <div className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-1 gap-3">
              <div
                className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-card border bg-canvas/65 shadow-inner-soft sm:size-16"
                style={{
                  borderColor:
                    "color-mix(in oklab, var(--room-accent) 42%, var(--room-line))",
                  background:
                    "linear-gradient(135deg, color-mix(in oklab, var(--room-accent) 34%, transparent), var(--room-canvas))",
                }}
              >
                {room.iconUrl ? (
                  <img alt="" src={room.iconUrl} className="size-full object-cover" />
                ) : (
                  <Radio aria-hidden="true" size={22} className="text-text" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="min-w-0 text-2xl font-semibold tracking-normal text-text sm:text-3xl">
                    {room.name}
                  </h1>
                  {room.myRoomRole ? (
                    <Badge className="min-h-6 px-2 text-[0.7rem]" tone="warm">
                      {roleLabel(room.myRoomRole)}
                    </Badge>
                  ) : null}
                  <Badge className="min-h-6 px-2 text-[0.7rem]" tone={room.visibility === "public" ? "cool" : "warm"}>
                    {roomVisibilityLabel(room.visibility)}
                  </Badge>
                </div>
                <p className="mt-0.5 text-sm text-muted">/{room.slug}</p>
                {room.description || room.summary ? (
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                    {room.description || room.summary}
                  </p>
                ) : null}
                <div
                  className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted"
                  data-testid="room-meta"
                >
                  <RoomMetaItem icon={MessageCircle}>
                    {formatCountWithUnit(postCount, "post")}
                  </RoomMetaItem>
                  <RoomMetaItem icon={UsersRound}>
                    {formatCountWithUnit(room.memberCount, "member")}
                  </RoomMetaItem>
                  {room.latestActivityAt ? (
                    <RoomMetaItem icon={Clock3}>
                      {formatActivityTime(room.latestActivityAt)}
                    </RoomMetaItem>
                  ) : null}
                  {room.owner ? (
                    <RoomMetaItem icon={UserRound}>
                      <span>by </span>
                      <InlineUserProfileLink user={room.owner}>
                        @{room.owner.handle}
                      </InlineUserProfileLink>
                    </RoomMetaItem>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto lg:justify-end">
              {showJoinAction ? (
                <Button
                  type="button"
                  variant={room.joinedByMe ? "secondary" : "primary"}
                  size="sm"
                  className="w-full sm:w-auto"
                  data-testid="room-join-button"
                  disabled={Boolean(pendingAction) || isOwner || (!room.joinedByMe && room.visibility !== "public")}
                  icon={<UsersRound aria-hidden="true" size={17} />}
                  onClick={onJoinToggle}
                >
                  {joinLabel}
                </Button>
              ) : null}
              {showAccessRequestAction ? (
                <Button
                  type="button"
                  variant={accessRequestPending ? "secondary" : "primary"}
                  size="sm"
                  className="w-full sm:w-auto"
                  data-testid="room-request-access-button"
                  disabled={Boolean(pendingAction)}
                  icon={<Shield aria-hidden="true" size={17} />}
                  onClick={onAccessRequestToggle}
                >
                  {accessRequestLabel}
                </Button>
              ) : null}
              {room.viewerCanPost ? (
                <Button
                  type="button"
                  size="sm"
                  className="hidden w-full sm:inline-flex sm:w-auto"
                  data-testid="room-post-button"
                  icon={<PenLine aria-hidden="true" size={17} />}
                  onClick={onPost}
                >
                  Post
                </Button>
              ) : null}
              {showShareAction ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full sm:w-auto"
                  data-testid="room-share-button"
                  icon={<Share2 aria-hidden="true" size={17} />}
                  onClick={onShare}
                >
                  Share
                </Button>
              ) : null}
              {canEdit ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
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
                  className="shrink-0"
                  targetType="room"
                  targetId={room.id}
                  reportedUserId={room.owner?.id}
                  title="Report room"
                  explainer={`This reports /${room.slug} to moderators.`}
                  triggerMode="icon"
                  triggerLabel="Report room"
                  triggerClassName="size-9 rounded-full"
                />
              ) : null}
            </div>
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
  const rules = room.rules?.trim() ?? "";
  const showRules = rules.length > 0;
  const showModerators = moderators.length > 0 || Boolean(membersError);

  if (!showRules && !showModerators) {
    return null;
  }

  return (
    <section className="grid gap-3 lg:grid-cols-2" aria-label="Room details">
      {showRules ? (
        <Panel className="p-4">
          <div className="flex items-center gap-2">
            <ScrollText aria-hidden="true" size={16} className="text-muted" />
            <h2 className="text-sm font-semibold text-text">Rules</h2>
          </div>
          <RichText
            markdown
            text={rules}
            className="mt-2 space-y-2 break-words text-sm leading-6 text-muted"
          />
        </Panel>
      ) : null}

      {showModerators ? (
        <Panel className="p-4">
          <div className="flex items-center gap-2">
            <Shield aria-hidden="true" size={16} className="text-muted" />
            <h2 className="text-sm font-semibold text-text">Moderators</h2>
          </div>
          <div className="mt-2 space-y-2">
            {moderators.length > 0 && room.owner ? (
              <RoomMemberRow user={room.owner} role="owner" />
            ) : null}
            {moderators.map((member) => (
              <RoomMemberRow key={member.id} user={member.user} role={member.role} />
            ))}
            {membersError ? (
              <p className="rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink">
                Members are not available.
              </p>
            ) : null}
          </div>
        </Panel>
      ) : null}
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
    <div className="flex items-center justify-between gap-2 rounded-card border border-line bg-canvas/35 px-3 py-2">
      <UserIdentityLink user={user} showAvatar={false} className="min-w-0 flex-1" />
      <Badge className="min-h-6 px-2 text-[0.7rem]" tone={role === "owner" ? "warm" : "cool"}>
        {roleLabel(role)}
      </Badge>
    </div>
  );
}

function RoomMetaItem({
  children,
  icon: Icon,
}: {
  children: ReactNode;
  icon: typeof MessageCircle;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon aria-hidden="true" size={14} />
      <span className="min-w-0">{children}</span>
    </span>
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

function roomVisibilityLabel(visibility: RoomVisibility): string {
  if (visibility === "private") {
    return "Private";
  }

  if (visibility === "invite") {
    return "Invite";
  }

  if (visibility === "view_only") {
    return "View-only";
  }

  return "Public";
}
