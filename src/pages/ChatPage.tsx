import {
  Inbox,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  WifiOff,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, useSearchParams } from "react-router";
import { PageMeta } from "../components/PageMeta";
import { ReportForm } from "../components/social/ReportForm";
import { Avatar } from "../components/ui/Avatar";
import { Button, ButtonLink } from "../components/ui/Button";
import { Panel } from "../components/ui/Panel";
import { RouteHeader, RouteStateNotice } from "../components/ui/RouteState";
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
import { cardEntrance, pageEntrance } from "../lib/motionPresets";
import type { ChatConversation, ChatMessage, ChatMoot } from "../lib/types";
import { useAuth } from "../lib/useAuth";

const maxMessageLength = 2000;

export function ChatPage() {
  const { runWithAuth, status, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [conversationsError, setConversationsError] = useState<string | undefined>();
  const [selectedConversationId, setSelectedConversationId] = useState<
    number | undefined
  >();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | undefined>();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [startError, setStartError] = useState<string | undefined>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [moots, setMoots] = useState<ChatMoot[]>([]);
  const [mootsLoading, setMootsLoading] = useState(false);
  const [mootsError, setMootsError] = useState<string | undefined>();
  const [mootQuery, setMootQuery] = useState("");
  const [startingMootHandle, setStartingMootHandle] = useState<string | undefined>();
  const startedHandleRef = useRef<string | undefined>(undefined);

  const requestedConversationId = useMemo(() => {
    const value = searchParams.get("conversation");

    return value && /^\d+$/.test(value) ? Number(value) : undefined;
  }, [searchParams]);
  const requestedHandle = searchParams.get("with")?.replace(/^@/, "").toLowerCase();
  const selectedConversation = conversations.find(
    (conversation) => conversation.id === selectedConversationId,
  );
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

  const loadConversations = useCallback(async () => {
    if (status !== "authenticated") {
      return;
    }

    setConversationsLoading(true);
    setConversationsError(undefined);

    try {
      const nextConversations = await getChatConversations();
      setConversations(nextConversations);
      setSelectedConversationId((current) => {
        if (
          requestedConversationId &&
          nextConversations.some((item) => item.id === requestedConversationId)
        ) {
          return requestedConversationId;
        }

        if (current && nextConversations.some((item) => item.id === current)) {
          return current;
        }

        return nextConversations[0]?.id;
      });
    } catch (error) {
      setConversationsError(
        error instanceof Error ? error.message : "Messages could not load.",
      );
    } finally {
      setConversationsLoading(false);
    }
  }, [requestedConversationId, status]);

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
    if (status !== "authenticated" || !selectedConversationId) {
      queueMicrotask(() => {
        setMessages([]);
      });
      return;
    }

    let active = true;

    queueMicrotask(() => {
      if (!active) {
        return;
      }

      setMessagesLoading(true);
      setMessagesError(undefined);

      getChatMessages(selectedConversationId)
        .then((result) => {
          if (!active) {
            return;
          }

          setMessages(result.messages);
          setConversations((current) => upsertConversation(current, result.conversation));

          void runWithAuth(
            (csrfToken) => markChatConversationRead(selectedConversationId, csrfToken),
            { retryOnCsrf: true },
          ).then((readResult) => {
            setConversations((current) =>
              current.map((conversation) =>
                conversation.id === selectedConversationId
                  ? {
                      ...conversation,
                      lastReadAt: readResult.readAt,
                      unreadCount: 0,
                    }
                  : conversation,
              ),
            );
          });
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
  }, [runWithAuth, selectedConversationId, status]);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = body.trim();

    if (!selectedConversationId || trimmed === "" || sending) {
      return;
    }

    setSending(true);
    setMessagesError(undefined);

    try {
      const message = await runWithAuth(
        (csrfToken) => sendChatMessage(selectedConversationId, trimmed, csrfToken),
        { retryOnCsrf: true },
      );
      setBody("");
      setMessages((current) => [...current, message]);
      setConversations((current) =>
        current
          .map((conversation) =>
            conversation.id === selectedConversationId
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
      setMessagesError(
        error instanceof Error ? error.message : "Message could not send.",
      );
    } finally {
      setSending(false);
    }
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
    !conversationsLoading && !conversationsError && conversations.length === 0;
  const showConversationLayout = conversations.length > 0;

  if (status === "anonymous") {
    return (
      <motion.div
        className="mx-auto max-w-4xl space-y-5"
        variants={pageEntrance}
        initial="hidden"
        animate="show"
      >
        <PageMeta title="Chat" description="Messages on thia.lol." path="/chat" />
        <RouteHeader
          badge="private"
          badgeTone="cool"
          title="Chat"
          description="Moots-only direct messages."
        />
        <RouteStateNotice
          icon={MessageCircle}
          title="Sign in to see your messages."
          text="Chat is available to signed-in members."
          actions={<ButtonLink to="/login">Sign in</ButtonLink>}
        />
      </motion.div>
    );
  }

  if (status === "loading") {
    return (
      <motion.div
        className="mx-auto max-w-5xl space-y-5"
        variants={pageEntrance}
        initial="hidden"
        animate="show"
      >
        <PageMeta title="Chat" description="Messages on thia.lol." path="/chat" />
        <RouteHeader
          badge="private"
          badgeTone="cool"
          title="Chat"
          description="Moots-only direct messages."
        />
        <RouteStateNotice
          kind="loading"
          icon={LoaderCircle}
          title="Loading chat"
          text="Your messages are loading."
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      className="mx-auto max-w-6xl space-y-4"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <PageMeta title="Chat" description="Messages on thia.lol." path="/chat" />
      <motion.div variants={cardEntrance} custom={0} initial="hidden" animate="show">
        <RouteHeader
          badge="private"
          badgeTone="cool"
          title="Chat"
          description="Moots-only direct messages."
          actions={
            <>
              <Button
                type="button"
                icon={<UserPlus aria-hidden="true" size={16} />}
                data-testid="chat-new-chat-button"
                onClick={handleOpenPicker}
              >
                Message a moot
              </Button>
              <Button
                type="button"
                variant="secondary"
                icon={<RefreshCw aria-hidden="true" size={16} />}
                onClick={() => void loadConversations()}
              >
                Refresh
              </Button>
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
          text="Your chats are loading."
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
              onClick={() => void loadConversations()}
            >
              Try again
            </Button>
          }
        />
      ) : null}

      {conversationsEmpty ? (
        <RouteStateNotice
          icon={Inbox}
          title="No chats yet"
          text="Start a direct chat with a moot when you both follow each other."
          actions={
            <Button
              type="button"
              icon={<UserPlus aria-hidden="true" size={16} />}
              onClick={handleOpenPicker}
            >
              Message a moot
            </Button>
          }
        />
      ) : null}

      {showConversationLayout ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold text-text">Conversations</h2>
              {conversationsLoading ? (
                <span className="text-xs font-medium text-muted">Refreshing</span>
              ) : null}
            </div>
            <div className="divide-y divide-line" data-testid="chat-conversation-list">
              {conversationsError ? (
                <div className="p-4 text-sm leading-6 text-rose-ink">
                  {conversationsError}
                </div>
              ) : null}
              {conversations.map((conversation) => (
                <ConversationButton
                  key={conversation.id}
                  conversation={conversation}
                  selected={conversation.id === selectedConversationId}
                  onClick={() => {
                    setSelectedConversationId(conversation.id);
                    setSearchParams(
                      { conversation: String(conversation.id) },
                      { replace: true },
                    );
                  }}
                />
              ))}
            </div>
          </Panel>

          <Panel className="flex min-h-[28rem] flex-col overflow-hidden lg:min-h-[32rem]">
            {selectedConversation ? (
              <>
                <div className="flex items-center gap-3 border-b border-line px-4 py-3">
                  <UserIdentityLink
                    user={selectedConversation.otherParticipant}
                    avatarSize="sm"
                    className="flex-1 rounded-control"
                  />
                </div>

                <div
                  className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
                  data-testid="chat-message-list"
                >
                  {messagesLoading ? (
                    <InlineChatState
                      icon={LoaderCircle}
                      kind="loading"
                      title="Loading messages"
                      text="This conversation is loading."
                    />
                  ) : null}
                  {messagesError ? (
                    <InlineChatState
                      icon={WifiOff}
                      kind="error"
                      title="Could not load messages"
                      text={messagesError}
                    />
                  ) : null}
                  {!messagesLoading && !messagesError && messages.length === 0 ? (
                    <InlineChatState
                      centered
                      icon={Inbox}
                      title="No messages yet"
                      text="Start with a short note when you're ready."
                    />
                  ) : null}
                  {messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      mine={message.sender.id === user?.id}
                      canReport={message.sender.id !== user?.id}
                    />
                  ))}
                </div>

                <form
                  className="border-t border-line p-3 sm:p-4"
                  data-testid="chat-message-composer"
                  onSubmit={(event) => void handleSend(event)}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="sr-only" htmlFor="chat-message-body">
                      Write a message
                    </label>
                    <textarea
                      id="chat-message-body"
                      className="min-h-12 flex-1 resize-none rounded-control border border-line bg-canvas/60 px-3 py-2 text-sm leading-6 text-text outline-none transition duration-fluid ease-fluid placeholder:text-muted focus:border-line-strong focus:ring-2 focus:ring-focus/30"
                      maxLength={maxMessageLength}
                      placeholder="Write a message"
                      rows={2}
                      value={body}
                      onChange={(event) => setBody(event.target.value)}
                    />
                    <Button
                      type="submit"
                      className="min-h-12 w-full sm:w-auto"
                      disabled={body.trim() === "" || sending}
                      icon={<Send aria-hidden="true" size={16} />}
                    >
                      {sending ? "Sending" : "Send"}
                    </Button>
                  </div>
                </form>
              </>
            ) : (
              <InlineChatState
                centered
                icon={MessageCircle}
                title="Choose a conversation"
                text="Pick a chat from the list to read messages."
              />
            )}
          </Panel>
        </div>
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
  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-stretch bg-text/28 p-0 backdrop-blur-veil sm:place-items-center sm:px-4 sm:py-6"
      data-testid="chat-moot-picker"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Message a moot"
        className="flex h-dvh w-full flex-col overflow-hidden border border-line bg-surface shadow-lift sm:h-auto sm:max-h-[calc(100dvh-3rem)] sm:max-w-xl sm:rounded-panel"
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <div className="shrink-0 border-b border-line p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-text">Message a moot</h2>
              <p className="mt-1 text-sm text-muted">
                Start a direct chat with someone who follows you back.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close picker"
              title="Close"
              icon={<X aria-hidden="true" size={18} />}
              onClick={onClose}
            />
          </div>

          <label className="mt-4 flex min-h-11 items-center gap-2 rounded-control border border-line bg-canvas/60 px-3 py-2 text-sm text-muted focus-within:border-line-strong focus-within:ring-2 focus-within:ring-focus/30">
            <Search aria-hidden="true" size={16} />
            <span className="sr-only">Search moots</span>
            <input
              className="min-w-0 flex-1 bg-transparent text-text outline-none placeholder:text-muted"
              placeholder="Search moots"
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto" data-testid="chat-moot-list">
          {loading ? (
            <InlineChatState
              className="m-4"
              icon={LoaderCircle}
              kind="loading"
              title="Loading moots"
              text="Eligible chat partners are loading."
            />
          ) : null}
          {error ? (
            <InlineChatState
              actions={
                <Button
                  type="button"
                  variant="secondary"
                  icon={<RefreshCw aria-hidden="true" size={16} />}
                  onClick={onRefresh}
                >
                  Try again
                </Button>
              }
              className="m-4"
              icon={WifiOff}
              kind="error"
              title="Could not load moots"
              text={error}
            />
          ) : null}
          {!loading && !error && moots.length === 0 ? (
            <InlineChatState
              centered
              className="min-h-72"
              icon={MessageCircle}
              testId="chat-moot-empty"
              title="No moots yet"
              text="Chats are moots-only, so follow each other before starting a DM."
            />
          ) : null}
          {!loading && !error && moots.length > 0 && filteredMoots.length === 0 ? (
            <InlineChatState
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
                    className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
                  >
                    <UserIdentityLink
                      user={moot}
                      avatarSize="sm"
                      className="flex-1"
                    />
                    <button
                      className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-control border border-line bg-canvas/70 px-3 py-2 text-sm font-semibold text-muted transition duration-fluid ease-fluid hover:border-line-strong hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-wait disabled:opacity-70"
                      data-testid={`chat-moot-option-${moot.handle}`}
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
      </motion.div>
    </motion.div>
  );
}

type InlineChatStateKind = "neutral" | "loading" | "error";

type InlineChatStateProps = {
  actions?: ReactNode;
  centered?: boolean;
  className?: string;
  icon: LucideIcon;
  kind?: InlineChatStateKind;
  testId?: string;
  text: string;
  title: string;
};

const inlineStateIconStyles: Record<InlineChatStateKind, string> = {
  neutral: "bg-surface-strong text-accent-strong",
  loading: "bg-cool/15 text-cool-ink",
  error: "bg-rose/15 text-rose-ink",
};

function InlineChatState({
  actions,
  centered = false,
  className,
  icon: Icon,
  kind = "neutral",
  testId,
  text,
  title,
}: InlineChatStateProps) {
  return (
    <div
      className={cn(
        centered
          ? "grid flex-1 place-items-center p-6 text-center"
          : "rounded-card bg-canvas/55 p-3",
        className,
      )}
      data-testid={testId}
    >
      <div
        className={cn(
          centered ? "mx-auto max-w-sm" : "flex items-start gap-3",
        )}
      >
        <div
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-full",
            centered ? "mx-auto" : "",
            inlineStateIconStyles[kind],
          )}
        >
          <Icon
            aria-hidden="true"
            size={20}
            className={kind === "loading" ? "animate-spin" : undefined}
          />
        </div>
        <div className={cn("min-w-0", centered ? "mt-4" : "")}>
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">{text}</p>
          {actions ? (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </div>
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
      className="group relative isolate flex min-h-[4.75rem] w-full items-center gap-3 px-4 py-3 text-left transition duration-fluid ease-fluid"
      data-testid={`chat-conversation-row-${conversation.id}`}
    >
      <motion.button
        type="button"
        className={cn(
          "absolute inset-0 z-0 bg-transparent text-left transition duration-fluid ease-fluid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus/45",
          selected
            ? "bg-surface-strong/86"
            : "group-hover:bg-surface-strong/58 group-focus-within:bg-surface-strong/48",
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
          "pointer-events-none absolute bottom-3 left-0 top-3 z-10 w-0.5 rounded-full bg-accent transition duration-fluid ease-fluid",
          selected
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-45 motion-reduce:transition-none",
        )}
        aria-hidden="true"
      />

      <div className="pointer-events-none relative z-10 flex min-w-0 shrink-0 items-center gap-3 sm:w-44">
        <Link
          to={profilePath}
          aria-label={`${participant.displayName}'s profile`}
          className="pointer-events-auto grid size-11 shrink-0 place-items-center rounded-full transition duration-fluid ease-fluid hover:scale-[1.03] hover:ring-2 hover:ring-accent/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:hover:scale-100"
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
            className="block truncate text-sm font-medium"
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
            className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-ink shadow-soft"
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
    <div className={cn("group/message flex", mine ? "justify-end" : "justify-start")}>
      <div
        className="relative mb-1 max-w-[min(28rem,78%)] [filter:drop-shadow(0_14px_40px_oklch(0_0_0_/_0.1))]"
      >
        <MessageBubbleTail mine={mine} />
        <div
          className={cn(
            "relative z-10 rounded-[1.125rem] px-3 py-2 text-sm leading-5 transition duration-fluid ease-fluid",
            mine
              ? "bg-accent text-accent-ink"
              : "border border-line bg-surface text-text hover:border-line-strong",
          )}
        >
          <p className="whitespace-pre-wrap break-words">{message.body}</p>
          <div
            className={cn(
              "mt-1 flex flex-wrap items-center gap-1.5 text-[0.68rem] leading-none",
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
                    "-my-1 size-7 border border-transparent !bg-transparent !opacity-100 transition duration-fluid ease-fluid hover:!bg-transparent focus-visible:!bg-transparent motion-reduce:transition-none",
                    mine
                      ? "!text-accent-ink/70 hover:!text-accent-ink focus-visible:!text-accent-ink hover:[&>span]:bg-accent-ink/8 hover:[&>span]:outline hover:[&>span]:outline-1 hover:[&>span]:outline-accent-ink/20 focus-visible:[&>span]:bg-accent-ink/10 focus-visible:[&>span]:outline focus-visible:[&>span]:outline-1 focus-visible:[&>span]:outline-accent-ink/25"
                      : "!text-text/55 group-hover/message:!text-text/70 hover:!text-text/85 focus-visible:!text-text hover:[&>span]:bg-surface-strong/60 hover:[&>span]:outline hover:[&>span]:outline-1 hover:[&>span]:outline-line-strong/55 focus-visible:[&>span]:bg-surface-strong/70 focus-visible:[&>span]:outline focus-visible:[&>span]:outline-1 focus-visible:[&>span]:outline-focus/55",
                  )}
                  feedbackClassName="basis-full"
                  formClassName="basis-full bg-canvas/80 text-left"
                />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubbleTail({ mine }: { mine: boolean }) {
  const path =
    "M23.2 0.8H8.6C8.8 5.7 6.8 9.6 1.4 13.2C11 12.8 18.8 8.6 23.2 0.8Z";

  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute -bottom-[0.5rem] z-0 h-3.5 w-7",
        mine ? "-right-1 -scale-x-100" : "-left-1",
      )}
      focusable="false"
      viewBox="0 0 24 14"
    >
      <path className={mine ? "fill-accent" : "fill-surface"} d={path} />
      {mine ? null : (
        <path
          className="fill-none stroke-line"
          d={path}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.15"
        />
      )}
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
