import {
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
} from "react";
import { Link, useSearchParams } from "react-router";
import { PageMeta } from "../components/PageMeta";
import { MentionTextarea } from "../components/social/MentionTextarea";
import { ReportForm } from "../components/social/ReportForm";
import { RichText } from "../components/social/RichText";
import { Avatar } from "../components/ui/Avatar";
import { Button, ButtonLink } from "../components/ui/Button";
import { ModalSheet } from "../components/ui/ModalSheet";
import { Panel } from "../components/ui/Panel";
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
import { cardEntrance, pageEntrance } from "../lib/motionPresets";
import type {
  ChatConversation,
  ChatMessage,
  ChatMoot,
  PostShareSummary,
} from "../lib/types";
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
          className="p-4 sm:p-5"
          title="Chat"
          description="Messages."
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
        className="mx-auto max-w-5xl space-y-5"
        variants={pageEntrance}
        initial="hidden"
        animate="show"
      >
        <PageMeta title="Chat" description="Messages on thia.lol." path="/chat" />
        <RouteHeader
          badge="private"
          badgeTone="cool"
          className="p-4 sm:p-5"
          title="Chat"
          description="Messages."
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
          className="p-4 sm:p-5"
          title="Chat"
          description="Messages."
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
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
          <Panel className="max-h-[16rem] overflow-hidden lg:max-h-none">
            <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2.5">
              <h2 className="text-sm font-semibold text-text">Conversations</h2>
              {conversationsLoading ? (
                <span className="text-xs font-medium text-muted">Refreshing</span>
              ) : null}
            </div>
            <div className="max-h-[calc(16rem-2.75rem)] divide-y divide-line overflow-y-auto lg:max-h-none" data-testid="chat-conversation-list">
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

          <Panel className="flex min-h-[22rem] flex-col overflow-hidden sm:min-h-[26rem] lg:min-h-[30rem]">
            {selectedConversation ? (
              <>
                <div className="flex items-center gap-3 border-b border-line px-3 py-2.5 sm:px-4">
                  <UserIdentityLink
                    user={selectedConversation.otherParticipant}
                    avatarSize="sm"
                    className="flex-1 rounded-control"
                  />
                </div>

                <div
                  className="flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-4"
                  data-testid="chat-message-list"
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
                      icon={Inbox}
                      title="No messages yet"
                      text="Send the first message."
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
                  className="border-t border-line p-3"
                  data-testid="chat-message-composer"
                  onSubmit={(event) => void handleSend(event)}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <label className="sr-only" htmlFor="chat-message-body">
                      Write a message
                    </label>
                    <MentionTextarea
                      id="chat-message-body"
                      className="min-h-10 flex-1 resize-none rounded-control border border-line bg-canvas/60 px-3 py-2 text-sm leading-6 text-text outline-none transition duration-fluid ease-fluid placeholder:text-muted focus:border-line-strong focus:ring-2 focus:ring-focus/30"
                      maxLength={maxMessageLength}
                      placeholder="Write a message"
                      rows={1}
                      value={body}
                      onValueChange={setBody}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      className="min-h-10 w-full sm:w-auto"
                      disabled={body.trim() === "" || sending}
                      icon={<Send aria-hidden="true" size={16} />}
                    >
                      {sending ? "Sending" : "Send"}
                    </Button>
                  </div>
                </form>
              </>
            ) : (
              <CompactStateNotice
                centered
                icon={MessageCircle}
                title="Choose a conversation"
                text="Select a chat."
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
      className="group relative isolate flex min-h-[4.25rem] w-full flex-col items-stretch gap-1.5 px-3 py-2.5 text-left transition duration-fluid ease-fluid sm:flex-row sm:items-center sm:gap-2.5"
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
          "pointer-events-none absolute bottom-2.5 left-0 top-2.5 z-10 w-0.5 rounded-full bg-accent transition duration-fluid ease-fluid",
          selected
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-45 motion-reduce:transition-none",
        )}
        aria-hidden="true"
      />

      <div className="pointer-events-none relative z-10 flex min-w-0 shrink-0 items-center gap-2.5 sm:w-40">
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

      <div className="pointer-events-none relative z-10 flex min-w-0 flex-1 items-center justify-between gap-3 pl-[3.125rem] text-muted transition duration-fluid ease-fluid group-hover:text-text sm:pl-0">
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
      <div className="relative mb-1 max-w-[min(28rem,86%)] sm:max-w-[min(28rem,78%)]">
        <MessageBubbleTail mine={mine} />
        <div
          className={cn(
            "relative z-10 rounded-[1rem] px-3 py-1.5 text-sm leading-5 shadow-soft transition duration-fluid ease-fluid",
            mine
              ? "bg-accent text-accent-ink"
              : "border border-line bg-surface text-text hover:border-line-strong",
          )}
        >
          <RichText
            text={message.body}
            entities={message.bodyEntities}
            className="block whitespace-pre-wrap break-words"
            previewClassName="mt-2"
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
                ) : null,
              )}
            </div>
          ) : null}
          <div
            className={cn(
              "mt-0.5 flex flex-wrap items-center gap-1.5 text-[0.68rem] leading-none",
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
  const outlinePath =
    "M25.3 1.2C18.2 3.1 12.6 10.9 1.5 15.1C11 15.2 19.4 10.5 25.3 4.1";
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
      <path className={mine ? "fill-accent" : "fill-surface"} d={path} />
      {mine ? null : (
        <path
          className="fill-none stroke-line transition duration-fluid ease-fluid group-hover/message:stroke-line-strong motion-reduce:transition-none"
          d={outlinePath}
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
