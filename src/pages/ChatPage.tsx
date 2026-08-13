import {
  ArrowLeft,
  Inbox,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  WifiOff,
  UserPlus,
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
import { ChatMessageBubble } from "../components/chat/ChatMessageBubble";
import { chatMessagesRenderEqual } from "../components/chat/messageReactionState";
import { MessageAttachmentComposer } from "../components/chat/MessageAttachmentComposer";
import {
  messageAttachmentInputsFromDrafts,
  messageHasContent,
} from "../components/chat/messageAttachmentState";
import {
  useChatReactionEvents,
  useMessageReactions,
} from "../components/chat/useMessageReactions";
import { MentionTextarea } from "../components/social/MentionTextarea";
import { Avatar } from "../components/ui/Avatar";
import { Button, ButtonLink } from "../components/ui/Button";
import { ModalSheet } from "../components/ui/ModalSheet";
import {
  CompactStateNotice,
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
import { pageEntrance } from "../lib/motionPresets";
import type { PostMediaDraft } from "../lib/postMedia";
import type {
  ChatConversation,
  ChatMessage,
  ChatMoot,
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
  const [attachments, setAttachments] = useState<PostMediaDraft[]>([]);
  const [attachmentsBusy, setAttachmentsBusy] = useState(false);
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

  const fetchActiveConversationMessages = useCallback(async () => {
    const conversationId = selectedConversationIdRef.current;

    if (status !== "authenticated" || !conversationId) {
      return null;
    }

    const result = await getChatMessages(conversationId);

    return selectedConversationIdRef.current === conversationId
      ? result.messages
      : null;
  }, [status]);
  const refetchReactionMessage = useCallback(
    async (messageId: number) => {
      const nextMessages = await fetchActiveConversationMessages();
      return nextMessages?.find((message) => message.id === messageId) ?? null;
    },
    [fetchActiveConversationMessages],
  );
  const {
    applyReactionEventToMessages,
    errorByMessage: reactionErrorByMessage,
    pendingByMessage: pendingReactionsByMessage,
    reconcileReactionMessage,
    toggleReaction,
  } = useMessageReactions({
    setMessages,
    onRefetchMessage: refetchReactionMessage,
  });
  const handleToggleReaction = useCallback(
    (message: ChatMessage, emoji: string) => {
      void toggleReaction(message, emoji);
    },
    [toggleReaction],
  );
  const handleReactionEvent = useCallback(
    (event: Parameters<typeof applyReactionEventToMessages>[1]) => {
      setMessages((current) => applyReactionEventToMessages(current, event));
    },
    [applyReactionEventToMessages],
  );
  const refreshDirectMessageReactions = useCallback(() => {
    void fetchActiveConversationMessages()
      .then((nextMessages) => {
        if (nextMessages) {
          setMessages((current) =>
            reconcileMessageReactionSnapshots(
              current,
              nextMessages,
              reconcileReactionMessage,
            ),
          );
        }
      })
      .catch(() => undefined);
  }, [fetchActiveConversationMessages, reconcileReactionMessage]);

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

  useChatReactionEvents({
    active:
      status === "authenticated" &&
      activeConversationId !== undefined &&
      messagesConversationId === activeConversationId,
    conversationId: activeConversationId,
    onConnected: refreshDirectMessageReactions,
    onEvent: handleReactionEvent,
  });

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
    setAttachments([]);
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
      setAttachments([]);
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
      !messageHasContent(trimmed, attachments) ||
      sending ||
      attachmentsBusy
    ) {
      return;
    }

    const targetConversationId = activeConversationId;
    const draftAttachments = attachments;

    setSending(true);
    setMessagesError(undefined);

    try {
      const message = await runWithAuth(
        (csrfToken) =>
          sendChatMessage(
            targetConversationId,
            trimmed,
            csrfToken,
            messageAttachmentInputsFromDrafts(draftAttachments),
          ),
        { retryOnCsrf: true },
      );
      if (selectedConversationIdRef.current === targetConversationId) {
        setBody("");
        setAttachments([]);
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
                    previewText: messagePreviewText(message),
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
        data-testid="chat-page"
        role="region"
        aria-label="Chat"
        variants={pageEntrance}
        initial="hidden"
        animate="show"
      >
        <PageMeta title="Chat" description="Messages on thia.lol." path="/chat" />
        <h1 className="sr-only">Chat</h1>
        <RouteStateNotice
          icon={MessageCircle}
          title="Sign in to see messages."
          actions={<ButtonLink to="/login">Sign in</ButtonLink>}
        />
      </motion.div>
    );
  }

  if (status === "loading") {
    return (
      <motion.div
        className="mx-auto max-w-5xl space-y-4"
        data-testid="chat-page"
        role="region"
        aria-label="Chat"
        variants={pageEntrance}
        initial="hidden"
        animate="show"
      >
        <PageMeta title="Chat" description="Messages on thia.lol." path="/chat" />
        <h1 className="sr-only">Chat</h1>
        <RouteStateNotice
          kind="loading"
          icon={LoaderCircle}
          title="Loading chat"
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      className={cn(
        "mx-auto min-w-0 max-w-7xl space-y-3 lg:pb-0",
        mobileConversationOpen ? "pb-0" : "pb-20",
      )}
      data-testid="chat-page"
      role="region"
      aria-label="Chat"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <PageMeta title="Chat" description="Messages on thia.lol." path="/chat" />
      <h1 className="sr-only">Chat</h1>

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
        />
      ) : null}

      {showInitialConversationError ? (
        <RouteStateNotice
          kind="error"
          icon={WifiOff}
          title="Could not load conversations"
          {...(conversationsError ? { text: conversationsError } : {})}
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
          actions={
            <Button
              type="button"
              size="sm"
              icon={<UserPlus aria-hidden="true" size={16} />}
              data-testid="chat-new-chat-button"
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
          data-app-panel="true"
          data-testid="chat-workspace"
        >
          <aside
            className={cn(
              "min-w-0 border-b border-line bg-canvas/18 lg:block lg:border-b-0 lg:border-r",
              mobileConversationOpen ? "hidden" : "block",
            )}
          >
            <div className="flex min-h-12 items-center justify-between gap-3 border-b border-line px-3 py-2.5">
              <h2 className="min-w-0 truncate text-sm font-semibold text-text">
                Conversations
              </h2>
              <div
                className="flex shrink-0 items-center gap-1.5"
                role="toolbar"
                aria-label="Conversation actions"
                data-testid="chat-conversation-actions"
              >
                <Button
                  type="button"
                  size="icon"
                  className="size-11"
                  aria-label="New chat"
                  title="New chat"
                  icon={<UserPlus aria-hidden="true" size={17} />}
                  data-testid="chat-new-chat-button"
                  onClick={handleOpenPicker}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="size-11"
                  disabled={conversationsLoading}
                  aria-label={
                    conversationsLoading
                      ? "Refreshing conversations"
                      : "Refresh conversations"
                  }
                  title="Refresh conversations"
                  icon={
                    <RefreshCw
                      aria-hidden="true"
                      size={17}
                      className={
                        conversationsLoading
                          ? "animate-spin motion-reduce:animate-none"
                          : undefined
                      }
                    />
                  }
                  data-testid="chat-refresh-conversations-button"
                  onClick={() => void loadConversations()}
                />
              </div>
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
                    setAttachments([]);
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
              "min-h-0 min-w-0 overflow-hidden lg:block",
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
                    />
                  ) : null}
                  {visibleMessages.map((message) => {
                    const pendingEmojis = pendingReactionsByMessage.get(message.id);
                    const reactionError = reactionErrorByMessage.get(message.id);

                    return (
                      <ChatMessageBubble
                        key={message.id}
                        canReact={status === "authenticated"}
                        canReport={message.sender.id !== user?.id}
                        message={message}
                        mine={message.sender.id === user?.id}
                        onToggleReaction={handleToggleReaction}
                        variant="direct"
                        {...(pendingEmojis ? { pendingEmojis } : {})}
                        {...(reactionError ? { error: reactionError } : {})}
                      />
                    );
                  })}
                </div>

                <form
                  className="border-t border-line bg-surface/42 p-2 sm:p-2.5"
                  data-testid="chat-message-composer"
                  onSubmit={(event) => void handleSend(event)}
                >
                  <MessageAttachmentComposer
                    key={activeConversationId}
                    attachments={attachments}
                    disabled={sending || showMessagesLoading}
                    testId="chat-attachment-composer"
                    onBusyChange={setAttachmentsBusy}
                    onChange={setAttachments}
                  >
                    <div
                      className="flex min-w-0 flex-1 items-end gap-1 rounded-[1.35rem] border border-transparent bg-surface-strong/52 p-1 transition duration-fluid ease-fluid focus-within:border-line-strong focus-within:bg-canvas focus-within:ring-2 focus-within:ring-focus/30"
                      data-testid="chat-message-composer-input-shell"
                    >
                      <label className="sr-only" htmlFor="chat-message-body">
                        Write a message
                      </label>
                      <MentionTextarea
                        id="chat-message-body"
                        className="block min-h-10 w-full resize-none bg-transparent px-3 py-2 text-sm leading-6 text-text outline-none placeholder:text-muted"
                        maxLength={maxMessageLength}
                        placeholder="Write a message"
                        rows={1}
                        value={body}
                        wrapperClassName="min-w-0 flex-1"
                        onKeyDown={handleComposerKeyDown}
                        onValueChange={setBody}
                      />
                      <Button
                        aria-label={sending ? "Sending" : "Send"}
                        className="size-10 shrink-0"
                        disabled={
                          showMessagesLoading ||
                          !messageHasContent(body, attachments) ||
                          sending ||
                          attachmentsBusy
                        }
                        icon={<Send aria-hidden="true" size={17} />}
                        size="icon"
                        title={sending ? "Sending" : "Send"}
                        type="submit"
                      />
                    </div>
                  </MessageAttachmentComposer>
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
              className="m-4"
              icon={MessageCircle}
              testId="chat-moot-empty"
              title="No moots yet"
              text="Follow each other to chat."
            />
          ) : null}
          {!loading && !error && moots.length > 0 && filteredMoots.length === 0 ? (
            <CompactStateNotice
              centered
              className="m-4"
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
  const actualLastMessage =
    conversation.lastMessage?.previewText?.trim() ||
    conversation.lastMessage?.body;
  const lastMessage = actualLastMessage || (!selected ? "No messages yet" : undefined);
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
          {lastMessage ? (
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
          ) : null}
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

function reconcileMessageReactionSnapshots(
  current: ChatMessage[],
  incoming: ChatMessage[],
  reconcile: (current: ChatMessage, incoming: ChatMessage) => ChatMessage,
): ChatMessage[] {
  const incomingById = new Map(incoming.map((message) => [message.id, message]));
  let changed = false;
  const next = current.map((message) => {
    const fresh = incomingById.get(message.id);

    if (!fresh) {
      return message;
    }

    const reconciled = reconcile(message, fresh);

    if (chatMessagesRenderEqual(message, reconciled)) {
      return message;
    }

    changed = true;
    return reconciled;
  });

  return changed ? next : current;
}

function messagePreviewText(message: ChatMessage): string {
  const body = message.body.trim();

  if (body) {
    return body;
  }

  const attachment = message.attachments?.[0];

  if (!attachment) {
    return "Message";
  }

  if (attachment.type === "post") {
    return "Post";
  }

  if (attachment.type === "room") {
    return "Room";
  }

  if (attachment.type === "gif") {
    return "GIF";
  }

  switch (attachment.media.kind) {
    case "image":
      return "Photo";
    case "video":
      return "Video";
    case "audio":
      return "Audio";
    case "integration":
      return "Music";
    case "gif":
      return "GIF";
  }
}
