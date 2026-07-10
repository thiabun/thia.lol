import {
  ArrowLeft,
  ImagePlay,
  Inbox,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  WifiOff,
  UserPlus,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Link, useOutletContext, useSearchParams } from "react-router";
import type { AppShellOutletContext } from "../components/layout/AppShell";
import { PageMeta } from "../components/PageMeta";
import { GifPicker } from "../components/social/GifPicker";
import { MentionTextarea } from "../components/social/MentionTextarea";
import { ReportForm } from "../components/social/ReportForm";
import { RichText } from "../components/social/RichText";
import { Avatar } from "../components/ui/Avatar";
import { Button, ButtonLink } from "../components/ui/Button";
import { ModalSheet } from "../components/ui/ModalSheet";
import {
  CompactStateNotice,
  RouteHeader,
  RouteStateNotice,
} from "../components/ui/RouteState";
import { UserIdentityLink } from "../components/social/UserProfileLink";
import {
  createChatConversation,
  getChatConversations,
  getChatMessages,
  getChatMoots,
  markChatConversationRead,
  sendChatMessage,
} from "../lib/api";
import { cn } from "../lib/classNames";
import { parseApiTimestamp } from "../lib/dates";
import { gifAttachmentTitle, gifToChatAttachmentInput } from "../lib/gifs";
import { cardEntrance, pageEntrance } from "../lib/motionPresets";
import type {
  ChatConversation,
  ChatMessage,
  ChatMoot,
  GifAttachment,
  GifSearchResult,
  PostShareSummary,
} from "../lib/types";
import { useAuth } from "../lib/useAuth";

const maxMessageLength = 2000;

export function ChatPage() {
  const { runWithAuth, status, user } = useAuth();
  const { setMobileDockHidden } = useOutletContext<AppShellOutletContext>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [conversationsError, setConversationsError] = useState<string | undefined>();
  const [selectedConversationId, setSelectedConversationId] = useState<
    number | undefined
  >();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesConversationId, setMessagesConversationId] = useState<
    number | undefined
  >();
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | undefined>();
  const [body, setBody] = useState("");
  const [selectedGifs, setSelectedGifs] = useState<GifSearchResult[]>([]);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [startError, setStartError] = useState<string | undefined>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [moots, setMoots] = useState<ChatMoot[]>([]);
  const [mootsLoading, setMootsLoading] = useState(false);
  const [mootsError, setMootsError] = useState<string | undefined>();
  const [mootQuery, setMootQuery] = useState("");
  const [startingMootHandle, setStartingMootHandle] = useState<string | undefined>();
  const startedHandleRef = useRef<string | undefined>(undefined);
  const conversationListRequestRef = useRef(0);
  const lastMissingConversationRequestRef = useRef<number | undefined>(undefined);
  const selectedConversationIdRef = useRef<number | undefined>(undefined);
  const messageListRef = useRef<HTMLDivElement>(null);

  const requestedConversationId = useMemo(() => {
    const value = searchParams.get("conversation");

    return value && /^\d+$/.test(value) ? Number(value) : undefined;
  }, [searchParams]);
  const requestedHandle = searchParams.get("with")?.replace(/^@/, "").toLowerCase();
  const requestedConversation = requestedConversationId
    ? conversations.find((conversation) => conversation.id === requestedConversationId)
    : undefined;
  const requestedConversationMissing = Boolean(
    requestedConversationId && !requestedConversation,
  );
  const activeConversationId = requestedConversationId
    ? requestedConversation?.id
    : selectedConversationId;
  const selectedConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  );
  const mobileConversationOpen = Boolean(activeConversationId);
  const filteredMoots = useMemo(() => {
    const query = mootQuery.trim().toLowerCase();

    if (query === "") {
      return moots;
    }

    return moots.filter((moot) => {
      return (
        moot.displayName.toLowerCase().includes(query) ||
        moot.handle.toLowerCase().includes(query)
      );
    });
  }, [mootQuery, moots]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px)");
    const syncMobileDock = () => {
      setMobileDockHidden(query.matches && mobileConversationOpen);
    };

    syncMobileDock();
    query.addEventListener("change", syncMobileDock);

    return () => {
      query.removeEventListener("change", syncMobileDock);
      setMobileDockHidden(false);
    };
  }, [mobileConversationOpen, setMobileDockHidden]);

  function handleMobileConversationBack() {
    selectedConversationIdRef.current = undefined;
    setSelectedConversationId(undefined);
    setMessagesError(undefined);
    setBody("");
    setSelectedGifs([]);
    setGifPickerOpen(false);
    setSearchParams({}, { replace: true });
  }

  const loadConversations = useCallback(async () => {
    const requestId = conversationListRequestRef.current + 1;
    conversationListRequestRef.current = requestId;

    if (status !== "authenticated") {
      return;
    }

    setConversationsLoading(true);
    setConversationsError(undefined);

    try {
      const nextConversations = await getChatConversations();

      if (conversationListRequestRef.current !== requestId) {
        return;
      }

      setConversations(nextConversations);
      setSelectedConversationId((current) => {
        if (current && nextConversations.some((item) => item.id === current)) {
          return current;
        }

        return window.matchMedia("(min-width: 1024px)").matches
          ? nextConversations[0]?.id
          : undefined;
      });
    } catch (error) {
      if (conversationListRequestRef.current === requestId) {
        setConversationsError(
          error instanceof Error ? error.message : "Messages could not load.",
        );
      }
    } finally {
      if (conversationListRequestRef.current === requestId) {
        setConversationsLoading(false);
      }
    }
  }, [status]);

  const loadMoots = useCallback(async () => {
    if (status !== "authenticated") {
      return;
    }

    setMootsLoading(true);
    setMootsError(undefined);

    try {
      setMoots(await getChatMoots());
    } catch (error) {
      setMootsError(
        error instanceof Error ? error.message : "Moots could not load.",
      );
    } finally {
      setMootsLoading(false);
    }
  }, [status]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadConversations();
    });
  }, [loadConversations]);

  useEffect(() => {
    if (!requestedConversationId || requestedConversation) {
      lastMissingConversationRequestRef.current = undefined;
      return undefined;
    }

    if (
      status !== "authenticated" ||
      conversationsLoading ||
      lastMissingConversationRequestRef.current === requestedConversationId
    ) {
      return undefined;
    }

    lastMissingConversationRequestRef.current = requestedConversationId;
    let active = true;

    queueMicrotask(() => {
      if (active) {
        void loadConversations();
      }
    });

    return () => {
      active = false;
    };
  }, [
    conversationsLoading,
    loadConversations,
    requestedConversation,
    requestedConversationId,
    status,
  ]);

  useEffect(() => {
    selectedConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    if (
      status !== "authenticated" ||
      !requestedHandle ||
      startedHandleRef.current === requestedHandle
    ) {
      return;
    }

    startedHandleRef.current = requestedHandle;
    setStartError(undefined);

    runWithAuth(
      (csrfToken) =>
        createChatConversation({ targetHandle: requestedHandle }, csrfToken),
      { retryOnCsrf: true },
    )
      .then((conversation) => {
        setConversations((current) => upsertConversation(current, conversation));
        setSelectedConversationId(conversation.id);
        setSearchParams(
          { conversation: String(conversation.id) },
          { replace: true },
        );
      })
      .catch((error: unknown) => {
        setStartError(
          error instanceof Error ? error.message : "Conversation could not start.",
        );
      });
  }, [requestedHandle, runWithAuth, setSearchParams, status]);

  useEffect(() => {
    if (status !== "authenticated" || !activeConversationId) {
      queueMicrotask(() => {
        setMessages([]);
        setMessagesConversationId(undefined);
      });
      return;
    }

    const conversationId = activeConversationId;
    let active = true;

    queueMicrotask(() => {
      if (!active) {
        return;
      }

      setBody("");
      setSelectedGifs([]);
      setGifPickerOpen(false);
      setMessagesLoading(true);
      setMessagesError(undefined);

      getChatMessages(conversationId)
        .then((result) => {
          if (!active) {
            return;
          }

          setMessages(result.messages);
          setMessagesConversationId(conversationId);
          setConversations((current) => upsertConversation(current, result.conversation));

          void runWithAuth(
            (csrfToken) => markChatConversationRead(conversationId, csrfToken),
            { retryOnCsrf: true },
          )
            .then((readResult) => {
              setConversations((current) =>
                current.map((conversation) =>
                  conversation.id === conversationId
                    ? {
                        ...conversation,
                        lastReadAt: readResult.readAt,
                        unreadCount: 0,
                      }
                    : conversation,
                ),
              );
            })
            .catch(() => undefined);
        })
        .catch((error: unknown) => {
          if (active) {
            setMessagesError(
              error instanceof Error ? error.message : "Messages could not load.",
            );
          }
        })
        .finally(() => {
          if (active) {
            setMessagesLoading(false);
          }
        });
    });

    return () => {
      active = false;
    };
  }, [activeConversationId, runWithAuth, status]);

  useEffect(() => {
    if (
      status !== "authenticated" ||
      !activeConversationId ||
      messagesConversationId !== activeConversationId ||
      messages.length === 0
    ) {
      return;
    }

    const messageList = messageListRef.current;
    if (messageList) {
      messageList.scrollTop = messageList.scrollHeight;
    }
  }, [activeConversationId, messages.length, messagesConversationId, status]);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = body.trim();

    if (
      !activeConversationId ||
      messagesConversationId !== activeConversationId ||
      (trimmed === "" && selectedGifs.length === 0) ||
      sending
    ) {
      return;
    }

    const targetConversationId = activeConversationId;
    const draftGifs = selectedGifs;

    setSending(true);
    setMessagesError(undefined);

    try {
      const message = await runWithAuth(
        (csrfToken) =>
          sendChatMessage(
            targetConversationId,
            trimmed,
            csrfToken,
            draftGifs.map(gifToChatAttachmentInput),
          ),
        { retryOnCsrf: true },
      );
      if (selectedConversationIdRef.current === targetConversationId) {
        setBody("");
        setSelectedGifs([]);
        setGifPickerOpen(false);
        setMessagesConversationId(targetConversationId);
        setMessages((current) => [...current, message]);
      }
      setConversations((current) =>
        current
          .map((conversation) =>
            conversation.id === targetConversationId
              ? {
                  ...conversation,
                  lastMessage: {
                    id: message.id,
                    body: message.body,
                    createdAt: message.createdAt,
                    sender: message.sender,
                  },
                  lastMessageAt: message.createdAt,
                  unreadCount: 0,
                }
              : conversation,
          )
          .sort(sortConversations),
      );
    } catch (error) {
      if (selectedConversationIdRef.current === targetConversationId) {
        setMessagesError(
          error instanceof Error ? error.message : "Message could not send.",
        );
      }
    } finally {
      setSending(false);
    }
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

  function handleGifRemove(resourceKey: string) {
    setSelectedGifs((current) =>
      current.filter((gif) => gif.resourceKey !== resourceKey),
    );
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
      const nextValue = `${value.slice(0, selectionStart)}\n${value.slice(
        selectionEnd,
      )}`;

      if (nextValue.length > maxMessageLength) {
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

  function handleOpenPicker() {
    setPickerOpen(true);
    setMootQuery("");
    void loadMoots();
  }

  async function handleStartConversation(moot: ChatMoot) {
    if (startingMootHandle) {
      return;
    }

    setStartingMootHandle(moot.handle);
    setMootsError(undefined);
    setStartError(undefined);

    try {
      const conversation = await runWithAuth(
        (csrfToken) =>
          createChatConversation({ targetUserId: moot.id }, csrfToken),
        { retryOnCsrf: true },
      );
      setConversations((current) => upsertConversation(current, conversation));
      setSelectedConversationId(conversation.id);
      setSearchParams({ conversation: String(conversation.id) }, { replace: true });
      setPickerOpen(false);
      setMootQuery("");
    } catch (error) {
      setMootsError(
        error instanceof Error ? error.message : "Conversation could not start.",
      );
    } finally {
      setStartingMootHandle(undefined);
    }
  }

  const showInitialConversationLoading =
    conversationsLoading && conversations.length === 0;
  const showInitialConversationError =
    Boolean(conversationsError) && conversations.length === 0;
  const conversationsEmpty =
    !conversationsLoading &&
    !conversationsError &&
    conversations.length === 0;
  const showConversationLayout = conversations.length > 0;
  const visibleMessages =
    messagesConversationId === activeConversationId ? messages : [];
  const showMessagesLoading =
    messagesLoading ||
    (Boolean(activeConversationId) &&
      messagesConversationId !== activeConversationId &&
      !messagesError);
  if (status === "anonymous") {
    return (
      <motion.div
        className="mx-auto max-w-4xl space-y-4"
        variants={pageEntrance}
        initial="hidden"
        animate="show"
      >
        <PageMeta title="Chat" description="Messages on thia.lol." path="/chat" />
        <RouteHeader
          badge="private"
          badgeTone="cool"
          surface="bare"
          title="Chat"
          description="Private messages with moots."
        />
        <RouteStateNotice
          icon={MessageCircle}
          title="Sign in to see messages."
          text="Chat requires sign-in."
          actions={<ButtonLink to="/login">Sign in</ButtonLink>}
        />
      </motion.div>
    );
  }

  if (status === "loading") {
    return (
      <motion.div
        className="mx-auto max-w-5xl space-y-4"
        variants={pageEntrance}
        initial="hidden"
        animate="show"
      >
        <PageMeta title="Chat" description="Messages on thia.lol." path="/chat" />
        <RouteHeader
          badge="private"
          badgeTone="cool"
          surface="bare"
          title="Chat"
          description="Private messages with moots."
        />
        <RouteStateNotice
          kind="loading"
          icon={LoaderCircle}
          title="Loading chat"
          text="Loading messages."
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      className={cn(
        "mx-auto min-w-0 max-w-7xl space-y-4 lg:pb-0",
        mobileConversationOpen ? "pb-0" : "pb-20",
      )}
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <PageMeta title="Chat" description="Messages on thia.lol." path="/chat" />
      <motion.div
        className={mobileConversationOpen ? "hidden lg:block" : undefined}
        variants={cardEntrance}
        custom={0}
        initial="hidden"
        animate="show"
      >
        <RouteHeader
          badge="private"
          badgeTone="cool"
          surface="bare"
          title="Chat"
          description="Private messages with moots."
          actions={
            <>
              <Button
                type="button"
                size="sm"
                icon={<UserPlus aria-hidden="true" size={16} />}
                data-testid="chat-new-chat-button"
                onClick={handleOpenPicker}
              >
                New chat
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label="Refresh conversations"
                title="Refresh conversations"
                icon={<RefreshCw aria-hidden="true" size={16} />}
                onClick={() => void loadConversations()}
              />
            </>
          }
        />
      </motion.div>

      {startError ? (
        <RouteStateNotice
          kind="error"
          icon={WifiOff}
          title="Chat could not start"
          text={startError}
        />
      ) : null}

      {showInitialConversationLoading ? (
        <RouteStateNotice
          kind="loading"
          icon={LoaderCircle}
          title="Loading conversations"
          text="Loading chats."
        />
      ) : null}

      {showInitialConversationError ? (
        <RouteStateNotice
          kind="error"
          icon={WifiOff}
          title="Could not load conversations"
          text={conversationsError ?? "Try refreshing in a moment."}
          actions={
            <Button
              type="button"
              variant="secondary"
              icon={<RefreshCw aria-hidden="true" size={16} />}
              aria-label="Retry loading conversations"
              title="Retry loading conversations"
              onClick={() => void loadConversations()}
            />
          }
        />
      ) : null}

      {conversationsEmpty ? (
        <RouteStateNotice
          icon={Inbox}
          title="No chats yet"
          text="Start with a moot."
          actions={
            <Button
              type="button"
              size="sm"
              icon={<UserPlus aria-hidden="true" size={16} />}
              onClick={handleOpenPicker}
            >
              New chat
            </Button>
          }
        />
      ) : null}

      {showConversationLayout ? (
        <section
          className={cn(
            "grid min-w-0 overflow-hidden rounded-panel border border-line/82 bg-surface/58 shadow-inner-soft lg:h-[calc(100svh-12rem)] lg:min-h-[32rem] lg:max-h-[44rem] lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]",
            mobileConversationOpen
              ? "h-[calc(var(--app-visual-viewport-height,100dvh)-4.25rem)] min-h-0"
              : undefined,
          )}
          data-testid="chat-workspace"
        >
          <aside
            className={cn(
              "min-w-0 border-b border-line bg-canvas/18 lg:block lg:border-b-0 lg:border-r",
              mobileConversationOpen ? "hidden" : "block",
            )}
          >
            <div className="flex min-h-12 items-center justify-between gap-3 border-b border-line px-3 py-2.5">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-text">Conversations</h2>
                <p className="mt-0.5 text-xs text-muted">
                  {conversations.length === 1
                    ? "1 chat"
                    : `${conversations.length} chats`}
                </p>
              </div>
              {conversationsLoading ? (
                <span className="shrink-0 text-xs font-medium text-muted">
                  Refreshing
                </span>
              ) : null}
            </div>
            <div
              className="grid min-w-0 divide-y divide-line overflow-visible p-0 lg:block lg:max-h-[calc(100%-3rem)] lg:overflow-y-auto"
              data-testid="chat-conversation-list"
            >
              {conversationsError ? (
                <CompactStateNotice
                  className="m-3"
                  icon={WifiOff}
                  kind="error"
                  title="Conversation list did not refresh"
                  text="Your current chats are still visible."
                />
              ) : null}
              {conversations.map((conversation) => (
                <ConversationButton
                  key={conversation.id}
                  conversation={conversation}
                  selected={conversation.id === activeConversationId}
                  onClick={() => {
                    selectedConversationIdRef.current = conversation.id;
                    setMessagesError(undefined);
                    setBody("");
                    setSelectedGifs([]);
                    setGifPickerOpen(false);
                    setSelectedConversationId(conversation.id);
                    setSearchParams(
                      { conversation: String(conversation.id) },
                      { replace: true },
                    );
                  }}
                />
              ))}
            </div>
          </aside>

          <section
            className={cn(
              "min-w-0 lg:block",
              mobileConversationOpen ? "block" : "hidden",
            )}
          >
            {selectedConversation ? (
              <div className="flex h-full min-h-0 flex-col lg:h-full lg:min-h-0">
                <div className="flex min-h-16 items-center gap-3 border-b border-line bg-surface/34 px-3 py-2.5 sm:px-4">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="shrink-0 lg:hidden"
                    aria-label="Back to conversations"
                    icon={<ArrowLeft aria-hidden="true" size={19} />}
                    onClick={handleMobileConversationBack}
                  />
                  <UserIdentityLink
                    user={selectedConversation.otherParticipant}
                    avatarSize="sm"
                    className="flex-1 rounded-control"
                  />
                </div>

                <div
                  ref={messageListRef}
                  className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-4"
                  data-testid="chat-message-list"
                >
                  {showMessagesLoading ? (
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
                  {!showMessagesLoading && !messagesError && visibleMessages.length === 0 ? (
                    <CompactStateNotice
                      centered
                      icon={Inbox}
                      title="No messages yet"
                      text="Send the first message."
                    />
                  ) : null}
                  {visibleMessages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      mine={message.sender.id === user?.id}
                      canReport={message.sender.id !== user?.id}
                    />
                  ))}
                </div>

                <form
                  className="border-t border-line bg-surface/42 p-2.5 sm:p-3"
                  data-testid="chat-message-composer"
                  onSubmit={(event) => void handleSend(event)}
                >
                  {selectedGifs.length > 0 ? (
                    <div
                      className="mb-2 flex gap-2 overflow-x-auto pb-1"
                      data-testid="chat-selected-gifs"
                    >
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
                            onClick={() => handleGifRemove(gif.resourceKey)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {gifPickerOpen ? (
                    <GifPicker
                      className="mb-2"
                      onSelect={handleGifSelect}
                    />
                  ) : null}
                  <div className="flex items-start gap-2">
                    <Button
                      type="button"
                      size="icon"
                      variant={gifPickerOpen ? "secondary" : "ghost"}
                      className="mt-1 shrink-0"
                      aria-label={gifPickerOpen ? "Close GIF picker" : "Add GIF"}
                      title={gifPickerOpen ? "Close GIF picker" : "Add GIF"}
                      icon={<ImagePlay aria-hidden="true" size={16} />}
                      onClick={() => setGifPickerOpen((open) => !open)}
                    />
                    <label className="sr-only" htmlFor="chat-message-body">
                      Write a message
                    </label>
                    <MentionTextarea
                      id="chat-message-body"
                      className="min-h-12 w-full resize-none rounded-control border border-line bg-canvas/70 px-3 py-2.5 text-sm leading-6 text-text outline-none transition duration-fluid ease-fluid placeholder:text-muted focus:border-line-strong focus:bg-canvas focus:ring-2 focus:ring-focus/30"
                      maxLength={maxMessageLength}
                      placeholder="Write a message"
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
                        showMessagesLoading ||
                        (body.trim() === "" && selectedGifs.length === 0) ||
                        sending
                      }
                      icon={<Send aria-hidden="true" size={16} />}
                    >
                      {sending ? "Sending" : "Send"}
                    </Button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="flex h-full min-h-0 flex-col">
                {mobileConversationOpen ? (
                  <div className="flex min-h-14 items-center border-b border-line px-3 lg:hidden">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label="Back to conversations"
                      icon={<ArrowLeft aria-hidden="true" size={18} />}
                      onClick={handleMobileConversationBack}
                    >
                      Back
                    </Button>
                  </div>
                ) : null}
                <CompactStateNotice
                  centered
                  className="min-h-[24rem] flex-1"
                  icon={
                    requestedConversationMissing && conversationsLoading
                      ? LoaderCircle
                      : requestedConversationMissing
                        ? WifiOff
                        : MessageCircle
                  }
                  {...(requestedConversationMissing && conversationsLoading
                    ? { kind: "loading" as const }
                    : {})}
                  title={
                    requestedConversationMissing
                      ? conversationsLoading
                        ? "Opening conversation"
                        : "Conversation not available"
                      : "Choose a conversation"
                  }
                  text={
                    requestedConversationMissing
                      ? "This direct-message conversation could not be found."
                      : "Select a chat to read or reply."
                  }
                />
              </div>
            )}
          </section>
        </section>
      ) : null}

      {pickerOpen ? (
        <ChatMootPicker
          conversations={conversations}
          filteredMoots={filteredMoots}
          loading={mootsLoading}
          moots={moots}
          query={mootQuery}
          error={mootsError}
          startingHandle={startingMootHandle}
          onClose={() => setPickerOpen(false)}
          onQueryChange={setMootQuery}
          onRefresh={() => void loadMoots()}
          onSelect={(moot) => void handleStartConversation(moot)}
        />
      ) : null}
    </motion.div>
  );
}

type ChatMootPickerProps = {
  conversations: ChatConversation[];
  error: string | undefined;
  filteredMoots: ChatMoot[];
  loading: boolean;
  moots: ChatMoot[];
  query: string;
  startingHandle: string | undefined;
  onClose: () => void;
  onQueryChange: (query: string) => void;
  onRefresh: () => void;
  onSelect: (moot: ChatMoot) => void;
};

function ChatMootPicker({
  conversations,
  error,
  filteredMoots,
  loading,
  moots,
  onClose,
  onQueryChange,
  onRefresh,
  onSelect,
  query,
  startingHandle,
}: ChatMootPickerProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  return (
    <ModalSheet
      open
      onClose={onClose}
      title="New chat"
      closeLabel="Close picker"
      testId="chat-moot-picker"
      size="md"
      mobile="full"
      busy={startingHandle !== undefined}
      initialFocusRef={searchInputRef}
      bodyClassName="flex flex-col overflow-hidden p-0"
    >
      <div className="shrink-0 border-b border-line px-4 py-3 sm:px-5">
        <label className="flex min-h-10 items-center gap-2 rounded-control border border-line bg-canvas/60 px-3 py-2 text-sm text-muted focus-within:border-line-strong focus-within:ring-2 focus-within:ring-focus/30">
            <Search aria-hidden="true" size={16} />
            <span className="sr-only">Search moots</span>
            <input
              ref={searchInputRef}
              className="min-w-0 flex-1 bg-transparent text-text outline-none placeholder:text-muted"
              placeholder="Search"
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" data-testid="chat-moot-list">
          {loading ? (
            <CompactStateNotice
              className="m-4"
              icon={LoaderCircle}
              kind="loading"
              title="Loading moots"
              text="Loading."
            />
          ) : null}
          {error ? (
            <CompactStateNotice
              actions={
                <Button
                  type="button"
                  variant="secondary"
                  icon={<RefreshCw aria-hidden="true" size={16} />}
                  aria-label="Retry loading moots"
                  title="Retry loading moots"
                  onClick={onRefresh}
                />
              }
              className="m-4"
              icon={WifiOff}
              kind="error"
              title="Could not load moots"
              text={error}
            />
          ) : null}
          {!loading && !error && moots.length === 0 ? (
            <CompactStateNotice
              centered
              className="min-h-72"
              icon={MessageCircle}
              testId="chat-moot-empty"
              title="No moots yet"
              text="Follow each other to chat."
            />
          ) : null}
          {!loading && !error && moots.length > 0 && filteredMoots.length === 0 ? (
            <CompactStateNotice
              centered
              className="min-h-72"
              icon={Search}
              title="No matching moots"
              text="Try a shorter search."
            />
          ) : null}
          {!loading && !error
            ? filteredMoots.map((moot) => {
                const existingConversation = conversations.find(
                  (conversation) =>
                    conversation.otherParticipant.handle === moot.handle,
                );
                const starting = startingHandle === moot.handle;

                return (
                  <div
                    key={moot.id}
                    className="flex flex-col items-stretch gap-2 border-b border-line px-4 py-2.5 last:border-b-0 sm:flex-row sm:items-center"
                  >
                    <UserIdentityLink
                      user={moot}
                      avatarSize="sm"
                      className="flex-1"
                    />
                    <button
                      className="inline-flex min-h-9 w-full shrink-0 items-center justify-center rounded-control border border-line bg-canvas/70 px-3 py-2 text-sm font-semibold text-muted transition duration-fluid ease-fluid hover:border-line-strong hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-wait disabled:opacity-70 sm:w-auto"
                      aria-label={`${existingConversation ? "Open chat with" : "Message"} ${moot.displayName}`}
                      data-testid={`chat-moot-option-${moot.handle}`}
                      title={`${existingConversation ? "Open chat with" : "Message"} ${moot.displayName}`}
                      type="button"
                      disabled={startingHandle !== undefined}
                      onClick={() => onSelect(moot)}
                    >
                      {starting
                        ? "Opening"
                        : existingConversation
                          ? "Open"
                          : "Message"}
                    </button>
                  </div>
                );
              })
            : null}
      </div>
    </ModalSheet>
  );
}

type ConversationButtonProps = {
  conversation: ChatConversation;
  selected: boolean;
  onClick: () => void;
};

function ConversationButton({
  conversation,
  onClick,
  selected,
}: ConversationButtonProps) {
  const lastMessage = conversation.lastMessage?.body ?? "No messages yet";
  const participant = conversation.otherParticipant;
  const profilePath = `/@${participant.handle}`;

  return (
    <div
      className="group relative isolate flex min-h-[4.75rem] min-w-0 w-full items-center gap-2.5 overflow-hidden bg-transparent px-3 py-2.5 text-left transition duration-fluid ease-fluid"
      data-testid={`chat-conversation-row-${conversation.id}`}
    >
      <motion.button
        type="button"
        className={cn(
          "absolute inset-0 z-0 bg-transparent text-left transition duration-fluid ease-fluid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus/45",
          selected
            ? "bg-surface-strong/76"
            : "group-hover:bg-surface-strong/46 group-focus-within:bg-surface-strong/42",
        )}
        aria-label={`Open chat with ${participant.displayName}`}
        aria-pressed={selected}
        data-testid={`chat-conversation-open-${conversation.id}`}
        onClick={onClick}
        whileTap={{ scale: 0.996 }}
      >
        <span className="sr-only">
          Open chat with {participant.displayName}
        </span>
      </motion.button>

      <span
        className={cn(
          "pointer-events-none absolute bottom-2.5 left-0 top-2.5 z-10 w-0.5 rounded-full bg-accent transition duration-fluid ease-fluid",
          selected
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-45 motion-reduce:transition-none",
        )}
        aria-hidden="true"
      />

      <div className="pointer-events-none relative z-10 flex min-w-0 shrink-0 items-center gap-2.5 lg:w-40">
        <Link
          to={profilePath}
          aria-label={`${participant.displayName}'s profile`}
          className="pointer-events-auto grid size-10 shrink-0 place-items-center rounded-full transition duration-fluid ease-fluid hover:scale-[1.03] hover:ring-2 hover:ring-accent/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:hover:scale-100"
          data-testid={`chat-conversation-avatar-${conversation.id}`}
        >
          <Avatar user={participant} size="sm" />
        </Link>
        <span className="pointer-events-none min-w-0">
          <Link
            to={profilePath}
            className="pointer-events-auto block w-fit max-w-full truncate rounded-control text-sm font-semibold text-text underline-offset-4 transition duration-fluid ease-fluid hover:text-accent-strong hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            data-testid={`chat-conversation-name-${conversation.id}`}
          >
            {participant.displayName}
          </Link>
          <Link
            to={profilePath}
            className="pointer-events-auto mt-0.5 block w-fit max-w-full truncate rounded-control text-xs text-muted underline-offset-4 transition duration-fluid ease-fluid hover:text-accent-strong hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            data-testid={`chat-conversation-handle-${conversation.id}`}
          >
            @{participant.handle}
          </Link>
        </span>
      </div>

      <div className="pointer-events-none relative z-10 flex min-w-0 flex-1 items-center justify-between gap-3 text-muted transition duration-fluid ease-fluid group-hover:text-text">
        <span className="min-w-0">
          <span
            className={cn(
              "block truncate text-sm",
              conversation.unreadCount > 0
                ? "font-semibold text-text"
                : "font-medium",
            )}
            data-testid={`chat-conversation-preview-${conversation.id}`}
          >
            {lastMessage}
          </span>
          <span
            className="mt-0.5 block text-xs text-muted"
            data-testid={`chat-conversation-timestamp-${conversation.id}`}
          >
            {formatConversationTime(conversation)}
          </span>
        </span>
        {conversation.unreadCount > 0 ? (
          <span
            className="grid min-w-5 shrink-0 place-items-center rounded-full bg-accent px-1.5 py-0.5 text-xs font-semibold leading-none text-accent-ink shadow-soft"
            data-testid={`chat-conversation-unread-${conversation.id}`}
          >
            {conversation.unreadCount}
          </span>
        ) : null}
      </div>
    </div>
  );
}

type MessageBubbleProps = {
  canReport: boolean;
  message: ChatMessage;
  mine: boolean;
};

function MessageBubble({ canReport, message, mine }: MessageBubbleProps) {
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
      <div className="relative mb-1 max-w-[min(30rem,88%)] sm:max-w-[min(34rem,78%)]">
        <MessageBubbleTail mine={mine} />
        <div
          className={cn(
            "relative z-10 rounded-[1.125rem] px-3 py-2 text-sm leading-5 transition duration-fluid ease-fluid",
            mine
              ? "bg-accent text-accent-ink shadow-soft"
              : "bg-surface-strong text-text",
          )}
        >
          <RichText
            text={message.body}
            entities={message.bodyEntities}
            className="block whitespace-pre-wrap break-words"
            embedClassName="mt-2"
          />
          {message.attachments?.length ? (
            <div className="mt-2 space-y-2" data-testid="chat-message-attachments">
              {message.attachments.map((attachment, index) =>
                attachment.type === "post" ? (
                  <ChatPostAttachment
                    key={`${message.id}-post-${attachment.post?.id ?? index}`}
                    mine={mine}
                    post={attachment.post}
                  />
                ) : (
                  <ChatGifAttachment
                    key={`${message.id}-gif-${attachment.gif.resourceKey}-${index}`}
                    gif={attachment.gif}
                    mine={mine}
                  />
                ),
              )}
            </div>
          ) : null}
          <div
            className={cn(
              "mt-1.5 flex flex-wrap items-center gap-1.5 text-[0.68rem] leading-none",
              mine ? "text-accent-ink/70" : "text-muted",
            )}
          >
            <span>{formatChatTime(message.createdAt)}</span>
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
                  explainer="This reports this chat message to moderators."
                  triggerMode="icon"
                  triggerLabel="Report message"
                  triggerSize="compact"
                  triggerIconSize={12}
                  triggerClassName={cn(
                    "-my-1 size-7 border border-transparent !bg-transparent !opacity-100 transition duration-fluid ease-fluid hover:!bg-transparent focus-visible:!bg-transparent focus-visible:!outline-none motion-reduce:transition-none",
                    mine
                      ? "!text-accent-ink/70 hover:!text-accent-ink focus-visible:!text-accent-ink hover:[&>span]:bg-accent-ink/10 focus-visible:[&>span]:bg-accent-ink/12 focus-visible:[&>span]:ring-1 focus-visible:[&>span]:ring-accent-ink/25"
                      : "!text-text/55 group-hover/message:!text-text/70 hover:!text-text/85 focus-visible:!text-text hover:[&>span]:bg-text/8 focus-visible:[&>span]:bg-text/10 focus-visible:[&>span]:ring-1 focus-visible:[&>span]:ring-focus/45",
                  )}
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

function ChatGifAttachment({
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
      data-testid="chat-gif-attachment"
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

function ChatPostAttachment({
  mine,
  post,
}: {
  mine: boolean;
  post: PostShareSummary | null;
}) {
  if (!post) {
    return (
      <div
        className={cn(
          "rounded-card border px-3 py-2 text-xs font-medium",
          mine
            ? "border-accent-ink/20 bg-accent-ink/10 text-accent-ink/80"
            : "border-line bg-canvas/70 text-muted",
        )}
        data-testid="chat-post-attachment-unavailable"
      >
        Post unavailable.
      </div>
    );
  }

  return (
    <Link
      to={post.canonicalPath}
      className={cn(
        "block rounded-card border px-3 py-2 text-left shadow-inner-soft transition duration-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        mine
          ? "border-accent-ink/20 bg-accent-ink/10 text-accent-ink hover:bg-accent-ink/15"
          : "border-line bg-canvas/70 text-text hover:border-line-strong hover:bg-surface",
      )}
      data-testid="chat-post-attachment"
    >
      <span className="flex items-center gap-2">
        <Avatar user={post.author} size="sm" />
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold">
            {post.author.displayName}
          </span>
          <span
            className={cn(
              "block truncate text-[0.68rem]",
              mine ? "text-accent-ink/70" : "text-muted",
            )}
          >
            @{post.author.handle}
          </span>
        </span>
      </span>
      <span className="mt-2 line-clamp-2 block text-xs leading-5">
        {post.bodySnippet}
      </span>
    </Link>
  );
}

function MessageBubbleTail({ mine }: { mine: boolean }) {
  const path =
    "M25.5 0.8H12.8C12.4 6.3 8.5 11.9 1.4 15.2C10.8 15.5 19.2 10.8 25.5 4.2Z";

  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute bottom-1 z-0 h-4 w-6",
        mine ? "-right-2 -scale-x-100" : "-left-2",
      )}
      focusable="false"
      viewBox="0 0 26 16"
    >
      <path
        className={mine ? "fill-accent" : "fill-surface-strong"}
        d={path}
      />
    </svg>
  );
}

function upsertConversation(
  conversations: ChatConversation[],
  conversation: ChatConversation,
): ChatConversation[] {
  const exists = conversations.some((item) => item.id === conversation.id);
  const next = exists
    ? conversations.map((item) => (item.id === conversation.id ? conversation : item))
    : [conversation, ...conversations];

  return next.sort(sortConversations);
}

function sortConversations(
  first: ChatConversation,
  second: ChatConversation,
): number {
  return conversationSortTime(second) - conversationSortTime(first);
}

function conversationSortTime(conversation: ChatConversation): number {
  const value = conversation.lastMessageAt ?? conversation.createdAt;
  const parsed = parseApiTimestamp(value);

  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function formatConversationTime(conversation: ChatConversation): string {
  return formatChatTime(conversation.lastMessageAt ?? conversation.createdAt);
}

function formatChatTime(value: string): string {
  const parsed = parseApiTimestamp(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}
