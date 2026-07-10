import {
  Archive,
  ChevronDown,
  ChevronUp,
  Clock3,
  Hash,
  ImagePlay,
  Inbox,
  LoaderCircle,
  Megaphone,
  MessageCircle,
  PenLine,
  Plus,
  Radio,
  ScrollText,
  Settings,
  Share2,
  Shield,
  Sparkles,
  Send,
  UserRound,
  UsersRound,
  WifiOff,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useNavigate, useOutletContext, useParams, useSearchParams } from "react-router";
import { PageMeta } from "../components/PageMeta";
import { GifPicker } from "../components/social/GifPicker";
import { MentionTextarea } from "../components/social/MentionTextarea";
import { PostCard } from "../components/social/PostCard";
import { ReportForm } from "../components/social/ReportForm";
import { RoomShareModal } from "../components/social/RoomShareModal";
import { RichText } from "../components/social/RichText";
import {
  InlineUserProfileLink,
  UserIdentityLink,
} from "../components/social/UserProfileLink";
import { ApiStateNotice } from "../components/ui/ApiStateNotice";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Panel } from "../components/ui/Panel";
import { CompactStateNotice } from "../components/ui/RouteState";
import {
  createRoomChannel,
  deletePost,
  deleteRoom,
  approveRoomAccessRequest,
  cancelRoomAccessRequest,
  denyRoomAccessRequest,
  getRoomAccessRequests,
  getRoom,
  getRoomChannels,
  getRoomChannelMessages,
  getRoomMembers,
  getRoomPosts,
  joinRoom,
  leaveRoom,
  markRoomChannelRead,
  addRoomModerator,
  requestRoomAccess,
  removeRoomModerator,
  sendRoomChannelMessage,
  updatePost,
  updateRoom,
  updateRoomChannel,
  previewImageUpload,
  uploadImage,
} from "../lib/api";
import { ApiClientError } from "../lib/apiClient";
import { cn } from "../lib/classNames";
import { postCreatedEventName } from "../lib/postEvents";
import { canDeletePost, canHidePost } from "../lib/postPermissions";
import { formatRelativeTime } from "../lib/dates";
import { gifAttachmentTitle, gifToChatAttachmentInput } from "../lib/gifs";
import { cardEntrance, pageEntrance } from "../lib/motionPresets";
import { formatCountWithUnit } from "../lib/pluralize";
import { applyProfileThemeToRoot } from "../lib/profileThemes";
import { roomThemeConfig, roomThemeSwatchCssProperties } from "../lib/roomThemes";
import type { AppShellOutletContext } from "../components/layout/AppShell";
import type { ImageUploadPurpose, RoomInput } from "../lib/api";
import type {
  ChatMessage,
  GifAttachment,
  GifSearchResult,
  Post,
  Room,
  RoomAccessRequest,
  RoomChannel,
  RoomMember,
  RoomVisibility,
  User,
} from "../lib/types";
import { useAsyncData } from "../lib/useAsyncData";
import { useAuth } from "../lib/useAuth";

const RoomEditModal = lazy(() =>
  import("../components/social/RoomEditModal").then((module) => ({
    default: module.RoomEditModal,
  })),
);

const maxRoomChatMessageLength = 2000;

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

      {room && !postsAccessGated ? (
        <RoomChannelWorkspace
          canManage={canEditRoom}
          members={members}
          room={room}
        />
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

function RoomChannelWorkspace({
  canManage,
  members,
  room,
}: {
  canManage: boolean;
  members: RoomMember[];
  room: Room;
}) {
  const { runWithAuth, status, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const messageListRef = useRef<HTMLDivElement>(null);
  const latestMessageRequestRef = useRef<string | undefined>(undefined);
  const requestedChannelSlug = sanitizeChannelSlug(searchParams.get("channel"));
  const [channels, setChannels] = useState<RoomChannel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelsError, setChannelsError] = useState<string | undefined>();
  const [activeChannelSlug, setActiveChannelSlug] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | undefined>();
  const [body, setBody] = useState("");
  const [selectedGifs, setSelectedGifs] = useState<GifSearchResult[]>([]);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [newChannelOpen, setNewChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDescription, setNewChannelDescription] = useState("");
  const [newChannelKind, setNewChannelKind] = useState<RoomChannel["kind"]>("chat");
  const [newChannelReadOnly, setNewChannelReadOnly] = useState(false);
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [channelDraft, setChannelDraft] = useState({
    name: "",
    description: "",
    kind: "chat" as RoomChannel["kind"],
    readOnly: false,
  });
  const [channelSaving, setChannelSaving] = useState(false);
  const [channelActionError, setChannelActionError] = useState<string | undefined>();
  const orderedChannels = useMemo(
    () => [...channels].sort(sortRoomChannels),
    [channels],
  );
  const activeChannel = useMemo(
    () =>
      orderedChannels.find((channel) => channel.slug === activeChannelSlug) ??
      orderedChannels[0],
    [activeChannelSlug, orderedChannels],
  );
  const activeChannelKey = activeChannel
    ? `${room.slug}:${activeChannel.slug}`
    : undefined;
  const canPostInActiveChannel = Boolean(activeChannel?.viewerCanPost);

  const loadChannels = useCallback(
    async (showLoading = true) => {
      if (status !== "authenticated") {
        setChannels([]);
        return;
      }

      if (showLoading) {
        setChannelsLoading(true);
      }
      setChannelsError(undefined);

      try {
        setChannels(await getRoomChannels(room.slug));
      } catch (caught) {
        setChannelsError(
          caught instanceof Error ? caught.message : "Channels could not load.",
        );
      } finally {
        if (showLoading) {
          setChannelsLoading(false);
        }
      }
    },
    [room.slug, status],
  );

  const loadMessages = useCallback(
    async (showLoading = true) => {
      if (status !== "authenticated" || !activeChannel) {
        setMessages([]);
        return;
      }

      const requestKey = `${room.slug}:${activeChannel.slug}`;
      latestMessageRequestRef.current = requestKey;

      if (showLoading) {
        setMessagesLoading(true);
      }
      setMessagesError(undefined);

      try {
        const result = await getRoomChannelMessages(room.slug, activeChannel.slug);

        if (latestMessageRequestRef.current !== requestKey) {
          return;
        }

        setMessages(result.messages);
        setChannels((current) => upsertRoomChannel(current, result.channel));

        void runWithAuth(
          (csrfToken) => markRoomChannelRead(room.slug, activeChannel.slug, csrfToken),
          { retryOnCsrf: true },
        ).then(() => {
          setChannels((current) =>
            current.map((channel) =>
              channel.slug === activeChannel.slug
                ? { ...channel, unreadCount: 0 }
                : channel,
            ),
          );
        });
      } catch (caught) {
        if (latestMessageRequestRef.current === requestKey) {
          setMessagesError(
            caught instanceof Error ? caught.message : "Messages could not load.",
          );
        }
      } finally {
        if (showLoading && latestMessageRequestRef.current === requestKey) {
          setMessagesLoading(false);
        }
      }
    },
    [activeChannel, room.slug, runWithAuth, status],
  );

  useEffect(() => {
    queueMicrotask(() => {
      setChannels([]);
      setMessages([]);
      setActiveChannelSlug(undefined);
      setBody("");
      setSelectedGifs([]);
      setGifPickerOpen(false);
      void loadChannels();
    });
  }, [loadChannels, room.slug]);

  useEffect(() => {
    if (orderedChannels.length === 0) {
      return;
    }

    const requested = requestedChannelSlug
      ? orderedChannels.find((channel) => channel.slug === requestedChannelSlug)
      : undefined;
    const nextSlug = requested?.slug ?? activeChannel?.slug ?? orderedChannels[0]?.slug;

    if (nextSlug && nextSlug !== activeChannelSlug) {
      queueMicrotask(() => {
        setActiveChannelSlug(nextSlug);
      });
    }
  }, [activeChannel?.slug, activeChannelSlug, orderedChannels, requestedChannelSlug]);

  useEffect(() => {
    if (!activeChannel) {
      return;
    }

    queueMicrotask(() => {
      setChannelDraft({
        name: activeChannel.name,
        description: activeChannel.description ?? "",
        kind: activeChannel.kind,
        readOnly: activeChannel.readOnly,
      });
    });
  }, [activeChannel]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadMessages();
    });
  }, [loadMessages, activeChannelKey]);

  useEffect(() => {
    if (!activeChannel || status !== "authenticated") {
      return undefined;
    }

    const refresh = () => {
      if (document.visibilityState === "visible") {
        void loadChannels(false);
        void loadMessages(false);
      }
    };
    const interval = window.setInterval(refresh, 8000);

    window.addEventListener("focus", refresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [activeChannel, loadChannels, loadMessages, status]);

  useEffect(() => {
    if (messages.length === 0) {
      return;
    }

    const messageList = messageListRef.current;

    if (messageList) {
      messageList.scrollTop = messageList.scrollHeight;
    }
  }, [messages.length, activeChannelSlug]);

  function selectChannel(channel: RoomChannel) {
    setActiveChannelSlug(channel.slug);
    setMessagesError(undefined);
    setSelectedGifs([]);
    setGifPickerOpen(false);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("channel", channel.slug);
    setSearchParams(nextParams, { replace: false });
  }

  async function handleCreateChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = newChannelName.trim();

    if (name === "" || creatingChannel) {
      return;
    }

    setCreatingChannel(true);
    setChannelActionError(undefined);

    try {
      const created = await runWithAuth(
        (csrfToken) =>
          createRoomChannel(
            room.slug,
            {
              name,
              description: newChannelDescription.trim() || null,
              kind: newChannelKind,
              readOnly: newChannelReadOnly,
            },
            csrfToken,
          ),
        { retryOnCsrf: true },
      );

      setChannels((current) => upsertRoomChannel(current, created));
      setNewChannelName("");
      setNewChannelDescription("");
      setNewChannelKind("chat");
      setNewChannelReadOnly(false);
      setNewChannelOpen(false);
      selectChannel(created);
    } catch (caught) {
      setChannelActionError(
        caught instanceof Error ? caught.message : "Channel could not be created.",
      );
    } finally {
      setCreatingChannel(false);
    }
  }

  async function handleSaveChannel() {
    if (!activeChannel || channelSaving) {
      return;
    }

    setChannelSaving(true);
    setChannelActionError(undefined);

    try {
      const updated = await runWithAuth(
        (csrfToken) =>
          updateRoomChannel(
            room.slug,
            activeChannel.slug,
            {
              name: channelDraft.name,
              description: channelDraft.description.trim() || null,
              kind: channelDraft.kind,
              readOnly: channelDraft.readOnly,
            },
            csrfToken,
          ),
        { retryOnCsrf: true },
      );

      setChannels((current) => upsertRoomChannel(current, updated));
      setActiveChannelSlug(updated.slug);
    } catch (caught) {
      setChannelActionError(
        caught instanceof Error ? caught.message : "Channel could not be saved.",
      );
    } finally {
      setChannelSaving(false);
    }
  }

  async function handleMoveChannel(direction: -1 | 1) {
    if (!activeChannel || channelSaving) {
      return;
    }

    const index = orderedChannels.findIndex(
      (channel) => channel.slug === activeChannel.slug,
    );
    const neighbor = orderedChannels[index + direction];

    if (!neighbor) {
      return;
    }

    setChannelSaving(true);
    setChannelActionError(undefined);

    try {
      const [updatedActive, updatedNeighbor] = await runWithAuth(
        async (csrfToken) =>
          Promise.all([
            updateRoomChannel(
              room.slug,
              activeChannel.slug,
              { position: neighbor.position },
              csrfToken,
            ),
            updateRoomChannel(
              room.slug,
              neighbor.slug,
              { position: activeChannel.position },
              csrfToken,
            ),
          ]),
        { retryOnCsrf: true },
      );

      setChannels((current) =>
        upsertRoomChannel(upsertRoomChannel(current, updatedActive), updatedNeighbor),
      );
    } catch (caught) {
      setChannelActionError(
        caught instanceof Error ? caught.message : "Channel order could not be saved.",
      );
    } finally {
      setChannelSaving(false);
    }
  }

  async function handleArchiveChannel() {
    if (!activeChannel || orderedChannels.length <= 1 || channelSaving) {
      return;
    }

    setChannelSaving(true);
    setChannelActionError(undefined);

    try {
      await runWithAuth(
        (csrfToken) =>
          updateRoomChannel(
            room.slug,
            activeChannel.slug,
            { archived: true },
            csrfToken,
          ),
        { retryOnCsrf: true },
      );

      const remaining = orderedChannels.filter(
        (channel) => channel.slug !== activeChannel.slug,
      );

      setChannels(remaining);
      if (remaining[0]) {
        selectChannel(remaining[0]);
      }
    } catch (caught) {
      setChannelActionError(
        caught instanceof Error ? caught.message : "Channel could not be archived.",
      );
    } finally {
      setChannelSaving(false);
    }
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = body.trim();

    if (
      !activeChannel ||
      !user ||
      sending ||
      (trimmed === "" && selectedGifs.length === 0)
    ) {
      return;
    }

    const draftGifs = selectedGifs;
    const optimisticId = -Date.now();
    const optimisticMessage: ChatMessage = {
      id: optimisticId,
      conversationId: activeChannel.conversationId,
      body: trimmed,
      bodyEntities: [],
      attachments: draftGifs.map((gif) => ({ type: "gif", gif })),
      deletedAt: null,
      createdAt: new Date().toISOString(),
      sender: userToChatUser(user),
    };

    setSending(true);
    setMessagesError(undefined);
    setBody("");
    setSelectedGifs([]);
    setGifPickerOpen(false);
    setMessages((current) => [...current, optimisticMessage]);

    try {
      const message = await runWithAuth(
        (csrfToken) =>
          sendRoomChannelMessage(
            room.slug,
            activeChannel.slug,
            trimmed,
            csrfToken,
            draftGifs.map(gifToChatAttachmentInput),
          ),
        { retryOnCsrf: true },
      );

      setMessages((current) =>
        current.map((item) => (item.id === optimisticId ? message : item)),
      );
      setChannels((current) =>
        upsertRoomChannel(current, {
          ...activeChannel,
          lastMessageAt: message.createdAt,
          unreadCount: 0,
        }),
      );
    } catch (caught) {
      setMessages((current) => current.filter((item) => item.id !== optimisticId));
      setBody(trimmed);
      setSelectedGifs(draftGifs);
      setMessagesError(
        caught instanceof Error ? caught.message : "Message could not send.",
      );
    } finally {
      setSending(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key !== "Enter" ||
      event.defaultPrevented ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      const textarea = event.currentTarget;
      const value = textarea.value;
      const selectionStart = textarea.selectionStart;
      const selectionEnd = textarea.selectionEnd;
      const nextValue = `${value.slice(0, selectionStart)}\n${value.slice(selectionEnd)}`;

      if (nextValue.length > maxRoomChatMessageLength) {
        return;
      }

      event.preventDefault();
      setBody(nextValue);

      window.requestAnimationFrame(() => {
        const cursor = selectionStart + 1;
        textarea.setSelectionRange(cursor, cursor);
      });
      return;
    }

    if (event.altKey || event.shiftKey) {
      return;
    }

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  function handleGifSelect(gif: GifSearchResult) {
    setSelectedGifs((current) => {
      if (current.some((item) => item.resourceKey === gif.resourceKey)) {
        return current;
      }

      if (current.length >= 4) {
        setMessagesError("Messages can include up to 4 GIFs.");
        return current;
      }

      setMessagesError(undefined);
      return [...current, gif];
    });
  }

  if (status !== "authenticated") {
    return (
      <Panel className="p-4" data-testid="room-channel-workspace">
        <CompactStateNotice
          centered
          icon={MessageCircle}
          title="Room chat"
          text="Sign in to read and post room channels."
        />
      </Panel>
    );
  }

  const activeIndex = activeChannel
    ? orderedChannels.findIndex((channel) => channel.slug === activeChannel.slug)
    : -1;

  return (
    <Panel
      className="overflow-hidden"
      data-testid="room-channel-workspace"
      style={roomThemeSwatchCssProperties(room)}
    >
      <div className="grid min-h-[34rem] lg:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)_minmax(15rem,18rem)]">
        <aside className="border-b border-line bg-canvas/22 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-3">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-text">Channels</h2>
              <p className="text-xs text-muted">{formatCountWithUnit(orderedChannels.length, "channel")}</p>
            </div>
            {canManage ? (
              <Button
                type="button"
                size="icon"
                variant={newChannelOpen ? "secondary" : "ghost"}
                className="size-8 shrink-0"
                aria-label={newChannelOpen ? "Close new channel form" : "Create channel"}
                title={newChannelOpen ? "Close new channel form" : "Create channel"}
                icon={<Plus aria-hidden="true" size={15} />}
                onClick={() => setNewChannelOpen((open) => !open)}
              />
            ) : null}
          </div>

          {newChannelOpen ? (
            <form
              className="space-y-2 border-b border-line bg-surface/38 p-3"
              onSubmit={(event) => void handleCreateChannel(event)}
            >
              <label className="block text-xs font-semibold text-muted" htmlFor="new-channel-name">
                Name
              </label>
              <input
                id="new-channel-name"
                className="min-h-9 w-full rounded-control border border-line bg-canvas/72 px-3 text-sm text-text outline-none focus:border-line-strong focus:ring-2 focus:ring-focus/30"
                maxLength={80}
                value={newChannelName}
                onChange={(event) => setNewChannelName(event.currentTarget.value)}
              />
              <label className="block text-xs font-semibold text-muted" htmlFor="new-channel-description">
                Description
              </label>
              <input
                id="new-channel-description"
                className="min-h-9 w-full rounded-control border border-line bg-canvas/72 px-3 text-sm text-text outline-none focus:border-line-strong focus:ring-2 focus:ring-focus/30"
                maxLength={240}
                value={newChannelDescription}
                onChange={(event) => setNewChannelDescription(event.currentTarget.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-semibold text-muted" htmlFor="new-channel-kind">
                  Kind
                  <select
                    id="new-channel-kind"
                    className="mt-1 min-h-9 w-full rounded-control border border-line bg-canvas/72 px-2 text-sm text-text outline-none focus:border-line-strong focus:ring-2 focus:ring-focus/30"
                    value={newChannelKind}
                    onChange={(event) =>
                      setNewChannelKind(event.currentTarget.value === "announcement" ? "announcement" : "chat")
                    }
                  >
                    <option value="chat">Chat</option>
                    <option value="announcement">Announcement</option>
                  </select>
                </label>
                <label className="flex items-end gap-2 rounded-control border border-line bg-canvas/45 px-2 py-2 text-xs font-semibold text-muted">
                  <input
                    type="checkbox"
                    checked={newChannelReadOnly}
                    onChange={(event) => setNewChannelReadOnly(event.currentTarget.checked)}
                  />
                  Staff posts
                </label>
              </div>
              <Button
                type="submit"
                size="sm"
                className="w-full"
                disabled={newChannelName.trim() === "" || creatingChannel}
                icon={<Plus aria-hidden="true" size={15} />}
              >
                {creatingChannel ? "Creating" : "Create"}
              </Button>
            </form>
          ) : null}

          <div className="flex gap-2 overflow-x-auto p-2 lg:block lg:space-y-1 lg:overflow-visible">
            {channelsLoading ? (
              <CompactStateNotice
                icon={LoaderCircle}
                kind="loading"
                title="Loading channels"
                text="Loading channels."
              />
            ) : null}
            {channelsError ? (
              <CompactStateNotice
                icon={WifiOff}
                kind="error"
                title="Could not load channels"
                text={channelsError}
              />
            ) : null}
            {!channelsLoading && !channelsError && orderedChannels.length === 0 ? (
              <CompactStateNotice
                icon={Inbox}
                title="No channels"
                text="No room channels."
              />
            ) : null}
            {orderedChannels.map((channel) => (
              <RoomChannelButton
                key={channel.id}
                channel={channel}
                selected={channel.slug === activeChannel?.slug}
                onSelect={() => selectChannel(channel)}
              />
            ))}
          </div>
        </aside>

        <section className="flex min-h-[34rem] min-w-0 flex-col">
          <div className="flex min-h-16 items-center justify-between gap-3 border-b border-line bg-surface/34 px-3 py-2.5 sm:px-4">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                {activeChannel?.kind === "announcement" ? (
                  <Megaphone aria-hidden="true" size={17} className="shrink-0 text-muted" />
                ) : (
                  <Hash aria-hidden="true" size={17} className="shrink-0 text-muted" />
                )}
                <h2 className="truncate text-sm font-semibold text-text">
                  {activeChannel?.name ?? "Room chat"}
                </h2>
              </div>
              {activeChannel?.description ? (
                <p className="mt-0.5 line-clamp-1 text-xs text-muted">
                  {activeChannel.description}
                </p>
              ) : null}
            </div>
            {activeChannel?.readOnly ? (
              <Badge className="shrink-0" tone="warm">Staff posting</Badge>
            ) : null}
          </div>

          <div
            ref={messageListRef}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-4"
            data-testid="room-channel-message-list"
          >
            {messagesLoading ? (
              <CompactStateNotice
                icon={LoaderCircle}
                kind="loading"
                title="Loading messages"
                text="Loading messages."
              />
            ) : null}
            {messagesError ? (
              <CompactStateNotice
                icon={WifiOff}
                kind="error"
                title="Could not load messages"
                text={messagesError}
              />
            ) : null}
            {!messagesLoading && !messagesError && messages.length === 0 ? (
              <CompactStateNotice
                centered
                icon={MessageCircle}
                title="No messages yet"
                text={activeChannel?.readOnly ? "No announcements yet." : "Send the first message."}
              />
            ) : null}
            {messages.map((message) => (
              <RoomChatMessageBubble
                key={message.id}
                canReport={message.sender.id !== user?.id}
                message={message}
                mine={message.sender.id === user?.id}
              />
            ))}
          </div>

          <form
            className="border-t border-line bg-surface/42 p-2.5 sm:p-3"
            data-testid="room-channel-message-composer"
            onSubmit={(event) => void handleSend(event)}
          >
            {selectedGifs.length > 0 ? (
              <div className="mb-2 flex gap-2 overflow-x-auto pb-1" data-testid="room-selected-gifs">
                {selectedGifs.map((gif) => (
                  <div
                    key={gif.resourceKey}
                    className="relative h-24 w-32 shrink-0 overflow-hidden rounded-card border border-line bg-canvas shadow-inner-soft"
                  >
                    <img
                      alt={gifAttachmentTitle(gif)}
                      src={gif.previewUrl ?? gif.url}
                      className="size-full object-cover"
                    />
                    <span className="absolute bottom-1 left-1 rounded-full bg-black/75 px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-white">
                      KLIPY
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="absolute right-1 top-1 size-7 bg-black/70 text-white hover:bg-black/85 hover:text-white"
                      aria-label={`Remove ${gifAttachmentTitle(gif)}`}
                      title={`Remove ${gifAttachmentTitle(gif)}`}
                      icon={<X aria-hidden="true" size={14} />}
                      onClick={() =>
                        setSelectedGifs((current) =>
                          current.filter((item) => item.resourceKey !== gif.resourceKey),
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            ) : null}
            {gifPickerOpen ? (
              <GifPicker className="mb-2" onSelect={handleGifSelect} />
            ) : null}
            <div className="flex items-start gap-2">
              <Button
                type="button"
                size="icon"
                variant={gifPickerOpen ? "secondary" : "ghost"}
                className="mt-1 shrink-0"
                aria-label={gifPickerOpen ? "Close GIF picker" : "Add GIF"}
                title={gifPickerOpen ? "Close GIF picker" : "Add GIF"}
                disabled={!canPostInActiveChannel}
                icon={<ImagePlay aria-hidden="true" size={16} />}
                onClick={() => setGifPickerOpen((open) => !open)}
              />
              <label className="sr-only" htmlFor="room-channel-message-body">
                Write a message
              </label>
              <MentionTextarea
                id="room-channel-message-body"
                className="min-h-12 w-full resize-none rounded-control border border-line bg-canvas/70 px-3 py-2.5 text-sm leading-6 text-text outline-none transition duration-fluid ease-fluid placeholder:text-muted focus:border-line-strong focus:bg-canvas focus:ring-2 focus:ring-focus/30 disabled:opacity-70"
                disabled={!canPostInActiveChannel}
                maxLength={maxRoomChatMessageLength}
                placeholder={
                  canPostInActiveChannel
                    ? "Write a message"
                    : activeChannel?.readOnly
                      ? "Only room staff can post here"
                      : "You cannot post in this channel"
                }
                rows={1}
                value={body}
                wrapperClassName="min-w-0 flex-1"
                onKeyDown={handleComposerKeyDown}
                onValueChange={setBody}
              />
              <Button
                type="submit"
                size="sm"
                className="min-h-12 shrink-0 px-3"
                disabled={
                  !canPostInActiveChannel ||
                  (body.trim() === "" && selectedGifs.length === 0) ||
                  sending
                }
                icon={<Send aria-hidden="true" size={16} />}
              >
                {sending ? "Sending" : "Send"}
              </Button>
            </div>
          </form>
        </section>

        <aside className="border-t border-line bg-canvas/18 p-3 lg:border-l lg:border-t-0">
          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-text">Room context</h2>
              <p className="mt-1 text-xs leading-5 text-muted">
                {formatCountWithUnit(room.memberCount, "member")}
                {members.length > 0 ? `, ${formatCountWithUnit(members.length, "visible member")}` : ""}
              </p>
            </div>

            {members.length > 0 ? (
              <div className="space-y-1.5">
                {members.slice(0, 5).map((member) => (
                  <UserIdentityLink
                    key={member.id}
                    user={member.user}
                    avatarSize="sm"
                    className="rounded-control px-1 py-1"
                  />
                ))}
              </div>
            ) : null}

            {channelActionError ? (
              <p className="rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink">
                {channelActionError}
              </p>
            ) : null}

            {canManage && activeChannel ? (
              <div className="space-y-2 border-t border-line pt-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-text">Channel</h3>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      aria-label="Move channel up"
                      title="Move channel up"
                      disabled={channelSaving || activeIndex <= 0}
                      icon={<ChevronUp aria-hidden="true" size={15} />}
                      onClick={() => void handleMoveChannel(-1)}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      aria-label="Move channel down"
                      title="Move channel down"
                      disabled={channelSaving || activeIndex < 0 || activeIndex >= orderedChannels.length - 1}
                      icon={<ChevronDown aria-hidden="true" size={15} />}
                      onClick={() => void handleMoveChannel(1)}
                    />
                  </div>
                </div>
                <label className="block text-xs font-semibold text-muted" htmlFor="channel-name">
                  Name
                </label>
                <input
                  id="channel-name"
                  className="min-h-9 w-full rounded-control border border-line bg-canvas/72 px-3 text-sm text-text outline-none focus:border-line-strong focus:ring-2 focus:ring-focus/30"
                  maxLength={80}
                  value={channelDraft.name}
                  onChange={(event) =>
                    setChannelDraft((draft) => ({
                      ...draft,
                      name: event.currentTarget.value,
                    }))
                  }
                />
                <label className="block text-xs font-semibold text-muted" htmlFor="channel-description">
                  Description
                </label>
                <textarea
                  id="channel-description"
                  className="min-h-20 w-full resize-none rounded-control border border-line bg-canvas/72 px-3 py-2 text-sm text-text outline-none focus:border-line-strong focus:ring-2 focus:ring-focus/30"
                  maxLength={240}
                  value={channelDraft.description}
                  onChange={(event) =>
                    setChannelDraft((draft) => ({
                      ...draft,
                      description: event.currentTarget.value,
                    }))
                  }
                />
                <label className="block text-xs font-semibold text-muted" htmlFor="channel-kind">
                  Kind
                </label>
                <select
                  id="channel-kind"
                  className="min-h-9 w-full rounded-control border border-line bg-canvas/72 px-2 text-sm text-text outline-none focus:border-line-strong focus:ring-2 focus:ring-focus/30"
                  value={channelDraft.kind}
                  onChange={(event) =>
                    setChannelDraft((draft) => ({
                      ...draft,
                      kind: event.currentTarget.value === "announcement" ? "announcement" : "chat",
                    }))
                  }
                >
                  <option value="chat">Chat</option>
                  <option value="announcement">Announcement</option>
                </select>
                <label className="flex items-center gap-2 rounded-control border border-line bg-canvas/45 px-2 py-2 text-xs font-semibold text-muted">
                  <input
                    type="checkbox"
                    checked={channelDraft.readOnly}
                    onChange={(event) =>
                      setChannelDraft((draft) => ({
                        ...draft,
                        readOnly: event.currentTarget.checked,
                      }))
                    }
                  />
                  Staff-only posting
                </label>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="w-full"
                    disabled={channelSaving || channelDraft.name.trim() === ""}
                    onClick={() => void handleSaveChannel()}
                  >
                    {channelSaving ? "Saving" : "Save channel"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    className="w-full"
                    disabled={channelSaving || orderedChannels.length <= 1}
                    icon={<Archive aria-hidden="true" size={15} />}
                    onClick={() => void handleArchiveChannel()}
                  >
                    Archive
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </Panel>
  );
}

function RoomChannelButton({
  channel,
  onSelect,
  selected,
}: {
  channel: RoomChannel;
  onSelect: () => void;
  selected: boolean;
}) {
  const Icon = channel.kind === "announcement" ? Megaphone : Hash;

  return (
    <button
      type="button"
      className={cn(
        "group relative flex min-h-11 w-44 shrink-0 items-center gap-2 rounded-control px-2.5 py-2 text-left transition duration-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus lg:w-full",
        selected
          ? "bg-surface-strong text-text shadow-inner-soft"
          : "text-muted hover:bg-surface/70 hover:text-text",
      )}
      data-testid={`room-channel-${channel.slug}`}
      onClick={onSelect}
    >
      <Icon aria-hidden="true" size={15} className="shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{channel.name}</span>
        <span className="block truncate text-[0.68rem]">
          {channel.readOnly ? "Staff posts" : "Open chat"}
        </span>
      </span>
      {channel.unreadCount > 0 ? (
        <span className="grid min-w-5 shrink-0 place-items-center rounded-full bg-accent px-1.5 py-0.5 text-xs font-semibold leading-none text-accent-ink shadow-soft">
          {channel.unreadCount}
        </span>
      ) : null}
    </button>
  );
}

function RoomChatMessageBubble({
  canReport,
  message,
  mine,
}: {
  canReport: boolean;
  message: ChatMessage;
  mine: boolean;
}) {
  return (
    <div
      className={cn(
        "group/message flex items-end gap-2",
        mine ? "justify-end" : "justify-start",
      )}
    >
      {mine ? null : (
        <Avatar user={message.sender} size="sm" className="mb-1 hidden sm:block" />
      )}
      <div className="relative mb-1 max-w-[min(31rem,88%)] sm:max-w-[min(36rem,78%)]">
        <div
          className={cn(
            "rounded-[1.125rem] px-3 py-2 text-sm leading-5 transition duration-fluid ease-fluid",
            mine
              ? "bg-accent text-accent-ink shadow-soft"
              : "bg-surface-strong text-text",
          )}
        >
          {!mine ? (
            <span className="mb-1 block truncate text-[0.7rem] font-semibold text-muted">
              {message.sender.displayName}
            </span>
          ) : null}
          {message.body ? (
            <RichText
              text={message.body}
              entities={message.bodyEntities}
              className="block whitespace-pre-wrap break-words"
              previewClassName="mt-2"
            />
          ) : null}
          {message.attachments?.length ? (
            <div className="mt-2 space-y-2" data-testid="room-message-attachments">
              {message.attachments.map((attachment, index) =>
                attachment.type === "gif" ? (
                  <RoomChatGifAttachment
                    key={`${message.id}-gif-${attachment.gif.resourceKey}-${index}`}
                    gif={attachment.gif}
                    mine={mine}
                  />
                ) : null,
              )}
            </div>
          ) : null}
          <div
            className={cn(
              "mt-1.5 flex flex-wrap items-center gap-1.5 text-[0.68rem] leading-none",
              mine ? "text-accent-ink/70" : "text-muted",
            )}
          >
            <span>{formatActivityTime(message.createdAt)}</span>
            {canReport && message.deletedAt === null ? (
              <>
                <span className="text-current/45" aria-hidden="true">
                  •
                </span>
                <ReportForm
                  className="contents"
                  targetType="message"
                  targetId={message.id}
                  reportedUserId={message.sender.id}
                  title="Report message"
                  explainer="This reports this room message to moderators."
                  triggerMode="icon"
                  triggerLabel="Report message"
                  triggerSize="compact"
                  triggerIconSize={12}
                  triggerClassName="!bg-transparent !text-current hover:!bg-transparent focus-visible:!bg-transparent"
                  feedbackClassName="basis-full"
                />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function RoomChatGifAttachment({
  gif,
  mine,
}: {
  gif: GifAttachment;
  mine: boolean;
}) {
  return (
    <a
      href={gif.sourceUrl ?? gif.url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "block overflow-hidden rounded-card border shadow-inner-soft transition duration-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        mine
          ? "border-accent-ink/20 bg-accent-ink/10 hover:bg-accent-ink/15"
          : "border-line bg-canvas/70 hover:border-line-strong hover:bg-surface",
      )}
      data-testid="room-chat-gif-attachment"
    >
      <img
        alt={gifAttachmentTitle(gif)}
        src={gif.url}
        className="max-h-72 w-full min-w-48 object-cover"
        loading="lazy"
      />
      <span
        className={cn(
          "flex items-center justify-between gap-2 px-2.5 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em]",
          mine ? "text-accent-ink/72" : "text-muted",
        )}
      >
        <span className="truncate">{gifAttachmentTitle(gif)}</span>
        <span className="shrink-0">KLIPY</span>
      </span>
    </a>
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

function sortRoomChannels(first: RoomChannel, second: RoomChannel): number {
  if (first.position !== second.position) {
    return first.position - second.position;
  }

  return first.id - second.id;
}

function upsertRoomChannel(
  channels: RoomChannel[],
  channel: RoomChannel,
): RoomChannel[] {
  const exists = channels.some((item) => item.id === channel.id);
  const next = exists
    ? channels.map((item) => (item.id === channel.id ? channel : item))
    : [...channels, channel];

  return next
    .filter((item) => item.archivedAt === null || item.archivedAt === undefined)
    .sort(sortRoomChannels);
}

function sanitizeChannelSlug(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase().replace(/^#/u, "");

  return /^[a-z0-9-]{1,48}$/u.test(normalized) ? normalized : undefined;
}

function userToChatUser(user: {
  avatarUrl?: string | null;
  displayName: string;
  handle: string;
  id: number;
}): User {
  return {
    id: user.id,
    handle: user.handle,
    displayName: user.displayName,
    initials: initialsFromDisplayName(user.displayName),
    aura: "tide",
    avatarUrl: user.avatarUrl ?? null,
  };
}

function initialsFromDisplayName(displayName: string): string {
  const letters = displayName
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return letters || "T";
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
