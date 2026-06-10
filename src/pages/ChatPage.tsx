import { ArrowLeft, Inbox, MessageCircle, RefreshCw, Send } from "lucide-react";
import { motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useSearchParams } from "react-router";
import { PageMeta } from "../components/PageMeta";
import { ApiStateNotice } from "../components/ui/ApiStateNotice";
import { Avatar } from "../components/ui/Avatar";
import { Button, ButtonLink } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Panel } from "../components/ui/Panel";
import {
  createChatConversation,
  getChatConversations,
  getChatMessages,
  markChatConversationRead,
  sendChatMessage,
} from "../lib/api";
import { cn } from "../lib/classNames";
import { cardEntrance, pageEntrance } from "../lib/motionPresets";
import type { ChatConversation, ChatMessage } from "../lib/types";
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
  const startedHandleRef = useRef<string | undefined>(undefined);

  const requestedConversationId = useMemo(() => {
    const value = searchParams.get("conversation");

    return value && /^\d+$/.test(value) ? Number(value) : undefined;
  }, [searchParams]);
  const requestedHandle = searchParams.get("with")?.replace(/^@/, "").toLowerCase();
  const selectedConversation = conversations.find(
    (conversation) => conversation.id === selectedConversationId,
  );

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
        if (requestedConversationId) {
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

  if (status === "anonymous") {
    return (
      <motion.div
        className="mx-auto max-w-3xl"
        variants={pageEntrance}
        initial="hidden"
        animate="show"
      >
        <PageMeta title="Chat" description="Messages on thia.lol." path="/chat" />
        <EmptyState
          icon={MessageCircle}
          title="Chat"
          text="Sign in to see your messages."
        />
        <div className="mt-4 flex justify-center">
          <ButtonLink to="/login">Sign in</ButtonLink>
        </div>
      </motion.div>
    );
  }

  if (status === "loading") {
    return (
      <motion.div
        className="mx-auto max-w-5xl"
        variants={pageEntrance}
        initial="hidden"
        animate="show"
      >
        <PageMeta title="Chat" description="Messages on thia.lol." path="/chat" />
        <ApiStateNotice
          kind="loading"
          title="Loading Chat"
          text="Messages are loading."
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal text-text">
              Chat
            </h1>
            <p className="mt-1 text-sm text-muted">Messages with your moots.</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            icon={<RefreshCw aria-hidden="true" size={16} />}
            onClick={() => void loadConversations()}
          >
            Refresh
          </Button>
        </div>
      </motion.div>

      {startError ? (
        <ApiStateNotice kind="error" title="Chat could not start" text={startError} />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(260px,340px)_1fr]">
        <Panel className="overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-text">Messages</h2>
          </div>
          <div data-testid="chat-conversation-list">
            {conversationsLoading ? (
              <div className="p-4 text-sm text-muted">Loading messages.</div>
            ) : null}
            {conversationsError ? (
              <div className="p-4 text-sm text-rose">{conversationsError}</div>
            ) : null}
            {!conversationsLoading &&
            !conversationsError &&
            conversations.length === 0 ? (
              <div className="p-5 text-sm text-muted">No chats yet</div>
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

        <Panel className="flex min-h-[560px] flex-col overflow-hidden">
          {selectedConversation ? (
            <>
              <div className="flex items-center gap-3 border-b border-line px-4 py-3">
                <Avatar user={selectedConversation.otherParticipant} size="sm" />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-semibold text-text">
                    {selectedConversation.otherParticipant.displayName}
                  </h2>
                  <p className="truncate text-xs text-muted">
                    @{selectedConversation.otherParticipant.handle}
                  </p>
                </div>
              </div>

              <div
                className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
                data-testid="chat-message-list"
              >
                {messagesLoading ? (
                  <div className="text-sm text-muted">Loading messages.</div>
                ) : null}
                {messagesError ? (
                  <div className="text-sm text-rose">{messagesError}</div>
                ) : null}
                {!messagesLoading && !messagesError && messages.length === 0 ? (
                  <div className="flex h-full min-h-72 items-center justify-center">
                    <div className="text-center">
                      <div className="mx-auto grid size-12 place-items-center rounded-full bg-surface-strong text-accent-strong">
                        <Inbox aria-hidden="true" size={22} />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-text">
                        No chats yet
                      </p>
                    </div>
                  </div>
                ) : null}
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    mine={message.sender.id === user?.id}
                  />
                ))}
              </div>

              <form
                className="border-t border-line p-3"
                data-testid="chat-message-composer"
                onSubmit={(event) => void handleSend(event)}
              >
                <div className="flex items-end gap-2">
                  <label className="sr-only" htmlFor="chat-message-body">
                    Write a message
                  </label>
                  <textarea
                    id="chat-message-body"
                    className="min-h-11 flex-1 resize-none rounded-control border border-line bg-canvas/60 px-3 py-2 text-sm leading-6 text-text outline-none transition duration-fluid ease-fluid placeholder:text-muted focus:border-line-strong focus:ring-2 focus:ring-focus/30"
                    maxLength={maxMessageLength}
                    placeholder="Write a message"
                    rows={2}
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                  />
                  <Button
                    type="submit"
                    disabled={body.trim() === "" || sending}
                    icon={<Send aria-hidden="true" size={16} />}
                  >
                    {sending ? "Sending" : "Send"}
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <div className="grid flex-1 place-items-center p-6 text-center">
              <div>
                <div className="mx-auto grid size-12 place-items-center rounded-full bg-surface-strong text-accent-strong">
                  <ArrowLeft aria-hidden="true" size={22} />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-text">Messages</h2>
                <p className="mt-2 text-sm text-muted">No chats yet</p>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </motion.div>
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
  return (
    <button
      className={cn(
        "flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left transition duration-fluid ease-fluid last:border-b-0 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-focus",
        selected ? "bg-surface-strong" : "hover:bg-canvas/60",
      )}
      type="button"
      onClick={onClick}
    >
      <Avatar user={conversation.otherParticipant} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-text">
            {conversation.otherParticipant.displayName}
          </span>
          {conversation.unreadCount > 0 ? (
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-ink">
              {conversation.unreadCount}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted">
          {conversation.lastMessage?.body ?? "No chats yet"}
        </span>
      </span>
    </button>
  );
}

type MessageBubbleProps = {
  message: ChatMessage;
  mine: boolean;
};

function MessageBubble({ message, mine }: MessageBubbleProps) {
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[min(34rem,82%)] rounded-card px-3 py-2 text-sm leading-6 shadow-soft",
          mine
            ? "bg-accent text-accent-ink"
            : "border border-line bg-canvas/65 text-text",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <p
          className={cn(
            "mt-1 text-[0.7rem]",
            mine ? "text-accent-ink/70" : "text-muted",
          )}
        >
          {formatChatTime(message.createdAt)}
        </p>
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
  const parsed = new Date(value.includes("T") ? value : value.replace(" ", "T"));

  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function formatChatTime(value: string): string {
  const parsed = new Date(value.includes("T") ? value : value.replace(" ", "T"));

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}
