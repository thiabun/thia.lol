import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  addChatMessageReaction,
  normalizeChatMessageReactionEvent,
  removeChatMessageReaction,
} from "../../lib/api";
import type {
  ChatMessage,
  ChatMessageReactionEvent,
} from "../../lib/types";
import { useAuth } from "../../lib/useAuth";
import {
  applyChatMessageReactionEvent,
  applyChatMessageReactionMutation,
  applyPendingMessageReactionIntents,
  messageReactionPendingKey,
  restoreChatMessageReactionSnapshot,
  setOptimisticMessageReaction,
  updateChatMessageInList,
  type ChatMessageReactionIntent,
  type ChatMessageReactionSnapshot,
} from "./messageReactionState";
import { normalizeMessageReactionEmoji } from "./messageReactionEmoji";

export type MessageReactionController = {
  applyReactionEventToMessages: (
    messages: ChatMessage[],
    event: ChatMessageReactionEvent,
  ) => ChatMessage[];
  errorByMessage: ReadonlyMap<number, string>;
  pendingByMessage: ReadonlyMap<number, ReadonlySet<string>>;
  reconcileReactionMessage: (
    current: ChatMessage,
    incoming: ChatMessage,
  ) => ChatMessage;
  toggleReaction: (message: ChatMessage, emoji: string) => Promise<void>;
};

export type UseMessageReactionsOptions = {
  onRefetchMessage?: (messageId: number) => Promise<ChatMessage | null>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
};

export function useMessageReactions({
  onRefetchMessage,
  setMessages,
}: UseMessageReactionsOptions): MessageReactionController {
  const { runWithAuth, user } = useAuth();
  const [pendingByMessage, setPendingByMessage] = useState<
    ReadonlyMap<number, ReadonlySet<string>>
  >(
    () => new Map(),
  );
  const [errorByMessage, setErrorByMessage] = useState<
    ReadonlyMap<number, string>
  >(() => new Map());
  const pendingIntentsRef = useRef(
    new Map<string, ChatMessageReactionIntent & { messageId: number }>(),
  );
  const confirmedIntentsRef = useRef(
    new Map<string, { reacted: boolean; reactionVersion: number }>(),
  );

  const pendingIntentsForMessage = useCallback((messageId: number) => {
    return [...pendingIntentsRef.current.values()].filter(
      (intent) => intent.messageId === messageId,
    );
  }, []);

  const reconcileReactionMessage = useCallback(
    (current: ChatMessage, incoming: ChatMessage): ChatMessage => {
      if (
        current.id !== incoming.id ||
        current.conversationId !== incoming.conversationId ||
        incoming.reactionVersion < current.reactionVersion
      ) {
        return current;
      }

      return applyPendingMessageReactionIntents(
        incoming,
        pendingIntentsForMessage(current.id),
      );
    },
    [pendingIntentsForMessage],
  );

  const applyReactionEventToMessages = useCallback(
    (messages: ChatMessage[], event: ChatMessageReactionEvent) => {
      const key = messageReactionPendingKey(event.messageId, event.emoji);

      if (
        user?.id !== undefined &&
        event.actorUserId === user.id
      ) {
        if (pendingIntentsRef.current.has(key)) {
          confirmedIntentsRef.current.set(key, {
            reacted: event.reacted,
            reactionVersion: event.reactionVersion,
          });
        }

        setErrorByMessage((current) => removeMapKey(current, event.messageId));
      }

      return updateChatMessageInList(messages, event.messageId, (message) =>
        applyPendingMessageReactionIntents(
          applyChatMessageReactionEvent(message, event, user?.id),
          pendingIntentsForMessage(message.id),
        ),
      );
    },
    [pendingIntentsForMessage, user?.id],
  );

  const toggleReaction = useCallback(
    async (message: ChatMessage, emoji: string) => {
      const normalizedEmoji = normalizeMessageReactionEmoji(emoji);

      if (!normalizedEmoji) {
        setErrorByMessage((current) =>
          new Map(current).set(message.id, "Reaction must be exactly one emoji."),
        );
        return;
      }

      const key = messageReactionPendingKey(message.id, normalizedEmoji);

      if (
        message.id <= 0 ||
        message.deletedAt != null ||
        pendingIntentsRef.current.has(key)
      ) {
        return;
      }

      const reactedByMe = message.reactions.some(
        (reaction) =>
          reaction.emoji === normalizedEmoji && reaction.reactedByMe,
      );
      const snapshot: ChatMessageReactionSnapshot = {
        emoji: normalizedEmoji,
        reactions: message.reactions,
        reactionVersion: message.reactionVersion,
      };
      const intendedReaction = !reactedByMe;

      confirmedIntentsRef.current.delete(key);
      pendingIntentsRef.current.set(key, {
        emoji: normalizedEmoji,
        messageId: message.id,
        reacted: intendedReaction,
      });
      setPendingByMessage((current) =>
        updatePendingReactionMap(current, message.id, normalizedEmoji, true),
      );
      setErrorByMessage((current) => removeMapKey(current, message.id));
      setMessages((current) =>
        updateChatMessageInList(current, message.id, (candidate) =>
          setOptimisticMessageReaction(
            candidate,
            normalizedEmoji,
            intendedReaction,
          ),
        ),
      );

      try {
        const result = await runWithAuth(
          (csrfToken) =>
            reactedByMe
              ? removeChatMessageReaction(message.id, normalizedEmoji, csrfToken)
              : addChatMessageReaction(message.id, normalizedEmoji, csrfToken),
          { retryOnCsrf: true },
        );

        pendingIntentsRef.current.delete(key);
        setMessages((current) =>
          updateChatMessageInList(current, result.messageId, (candidate) =>
            applyPendingMessageReactionIntents(
              applyChatMessageReactionMutation(candidate, result),
              pendingIntentsForMessage(result.messageId),
            ),
          ),
        );
      } catch (caught) {
        pendingIntentsRef.current.delete(key);
        const confirmation = confirmedIntentsRef.current.get(key);
        const mutationWasConfirmed =
          confirmation !== undefined &&
          confirmation.reactionVersion > snapshot.reactionVersion &&
          confirmation.reacted === intendedReaction;

        setMessages((current) =>
          updateChatMessageInList(current, message.id, (candidate) => {
            const recovered = mutationWasConfirmed
              ? candidate
              : restoreChatMessageReactionSnapshot(candidate, snapshot);

            return applyPendingMessageReactionIntents(
              recovered,
              pendingIntentsForMessage(message.id),
            );
          },
          ),
        );
        if (!mutationWasConfirmed) {
          setErrorByMessage((current) =>
            new Map(current).set(
              message.id,
              caught instanceof Error
                ? caught.message
                : "Reaction could not be updated.",
            ),
          );
        }

        if (!mutationWasConfirmed && onRefetchMessage) {
          void onRefetchMessage(message.id)
            .then((freshMessage) => {
              if (!freshMessage) {
                return;
              }

              setMessages((current) =>
                updateChatMessageInList(current, freshMessage.id, (candidate) =>
                  reconcileReactionMessage(candidate, freshMessage),
                ),
              );
            })
            .catch(() => undefined);
        }
      } finally {
        pendingIntentsRef.current.delete(key);
        confirmedIntentsRef.current.delete(key);
        setPendingByMessage((current) =>
          updatePendingReactionMap(current, message.id, normalizedEmoji, false),
        );
      }
    },
    [
      onRefetchMessage,
      pendingIntentsForMessage,
      reconcileReactionMessage,
      runWithAuth,
      setMessages,
    ],
  );

  return {
    applyReactionEventToMessages,
    errorByMessage,
    pendingByMessage,
    reconcileReactionMessage,
    toggleReaction,
  };
}

function updatePendingReactionMap(
  current: ReadonlyMap<number, ReadonlySet<string>>,
  messageId: number,
  emoji: string,
  pending: boolean,
): ReadonlyMap<number, ReadonlySet<string>> {
  const currentEmoji = current.get(messageId) ?? new Set<string>();
  const nextEmoji = new Set(currentEmoji);

  if (pending) {
    nextEmoji.add(emoji);
  } else {
    nextEmoji.delete(emoji);
  }

  if (
    nextEmoji.size === currentEmoji.size &&
    nextEmoji.has(emoji) === currentEmoji.has(emoji)
  ) {
    return current;
  }

  const next = new Map(current);

  if (nextEmoji.size === 0) {
    next.delete(messageId);
  } else {
    next.set(messageId, nextEmoji);
  }

  return next;
}

function removeMapKey<T>(
  current: ReadonlyMap<number, T>,
  key: number,
): ReadonlyMap<number, T> {
  if (!current.has(key)) {
    return current;
  }

  const next = new Map(current);
  next.delete(key);
  return next;
}

export type UseChatReactionEventsOptions = {
  active?: boolean;
  conversationId: number | undefined;
  onConnected?: () => void;
  onEvent: (event: ChatMessageReactionEvent) => void;
};

export function useChatReactionEvents({
  active = true,
  conversationId,
  onConnected,
  onEvent,
}: UseChatReactionEventsOptions): void {
  const onEventRef = useRef(onEvent);
  const onConnectedRef = useRef(onConnected);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    onConnectedRef.current = onConnected;
  }, [onConnected]);

  useEffect(() => {
    if (!active || !conversationId || typeof EventSource === "undefined") {
      return undefined;
    }

    const source = new EventSource(
      `/api/chat/conversations/${conversationId}/events`,
      { withCredentials: true },
    );
    const handleOpen = () => {
      // Reconcile on the initial connection as well as reconnects so a
      // mutation committed between history loading and stream setup is not lost.
      onConnectedRef.current?.();
    };
    const handleReactionEvent = (rawEvent: MessageEvent<string>) => {
      try {
        const event = normalizeChatMessageReactionEvent(
          JSON.parse(rawEvent.data) as unknown,
        );

        if (event && event.conversationId === conversationId) {
          onEventRef.current(event);
        }
      } catch {
        // A malformed event is ignored; history refresh remains the recovery path.
      }
    };

    source.addEventListener("open", handleOpen);
    source.addEventListener(
      "message.reactions.updated",
      handleReactionEvent as EventListener,
    );

    return () => {
      source.removeEventListener("open", handleOpen);
      source.removeEventListener(
        "message.reactions.updated",
        handleReactionEvent as EventListener,
      );
      source.close();
    };
  }, [active, conversationId]);
}
