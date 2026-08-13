import type {
  ChatMessage,
  ChatMessageReactionEvent,
  ChatMessageReactionMutationResult,
  ChatMessageReactionSummary,
} from "../../lib/types";

export type ChatMessageReactionSnapshot = Pick<
  ChatMessage,
  "reactions" | "reactionVersion"
> & {
  emoji: string;
};

export type ChatMessageReactionIntent = {
  emoji: string;
  reacted: boolean;
};

export function messageReactionPendingKey(
  messageId: number,
  emoji: string,
): string {
  return `${messageId}:${emoji}`;
}

export function optimisticallyToggleMessageReaction(
  message: ChatMessage,
  emoji: string,
): ChatMessage {
  if (message.id <= 0 || message.deletedAt != null) {
    return message;
  }

  const normalizedEmoji = normalizeReactionEmoji(emoji);

  if (!normalizedEmoji) {
    return message;
  }

  const currentReaction = message.reactions.find(
    (reaction) => reaction.emoji === normalizedEmoji,
  );
  return setOptimisticMessageReaction(
    message,
    normalizedEmoji,
    !currentReaction?.reactedByMe,
  );
}

export function setOptimisticMessageReaction(
  message: ChatMessage,
  emoji: string,
  reacted: boolean,
): ChatMessage {
  if (message.id <= 0 || message.deletedAt != null) {
    return message;
  }

  const normalizedEmoji = normalizeReactionEmoji(emoji);

  if (!normalizedEmoji) {
    return message;
  }

  const currentReaction = message.reactions.find(
    (reaction) => reaction.emoji === normalizedEmoji,
  );

  if ((currentReaction?.reactedByMe ?? false) === reacted) {
    return message;
  }

  const nextCount = Math.max(
    0,
    (currentReaction?.count ?? 0) + (reacted ? 1 : -1),
  );
  const nextReaction: ChatMessageReactionSummary = {
    emoji: normalizedEmoji,
    count: nextCount,
    reactedByMe: reacted,
  };
  const reactions = replaceReactionSummary(message.reactions, nextReaction);

  return reactions === message.reactions ? message : { ...message, reactions };
}

export function applyPendingMessageReactionIntents(
  message: ChatMessage,
  intents: readonly ChatMessageReactionIntent[],
): ChatMessage {
  return intents.reduce(
    (current, intent) =>
      setOptimisticMessageReaction(current, intent.emoji, intent.reacted),
    message,
  );
}

export function applyChatMessageReactionMutation(
  message: ChatMessage,
  result: ChatMessageReactionMutationResult,
): ChatMessage {
  if (
    message.id !== result.messageId ||
    message.conversationId !== result.conversationId ||
    result.reactionVersion < message.reactionVersion
  ) {
    return message;
  }

  return replaceAuthoritativeReactions(
    message,
    result.reactions,
    result.reactionVersion,
  );
}

export function applyChatMessageReactionEvent(
  message: ChatMessage,
  event: ChatMessageReactionEvent,
  currentUserId: number | undefined,
): ChatMessage {
  if (
    message.id !== event.messageId ||
    message.conversationId !== event.conversationId ||
    event.reactionVersion < message.reactionVersion
  ) {
    return message;
  }

  const selectedByEmoji = new Map(
    message.reactions.map((reaction) => [reaction.emoji, reaction.reactedByMe]),
  );

  if (currentUserId !== undefined && event.actorUserId === currentUserId) {
    selectedByEmoji.set(event.emoji, event.reacted);
  }

  const reactions = event.reactions.flatMap((reaction) => {
    const emoji = normalizeReactionEmoji(reaction.emoji);

    return emoji && reaction.count > 0
      ? [{
          emoji,
          count: reaction.count,
          reactedByMe: selectedByEmoji.get(emoji) ?? false,
        }]
      : [];
  });

  return replaceAuthoritativeReactions(
    message,
    reactions,
    event.reactionVersion,
  );
}

export function restoreChatMessageReactionSnapshot(
  message: ChatMessage,
  snapshot: ChatMessageReactionSnapshot,
): ChatMessage {
  const snapshotReaction = snapshot.reactions.find(
    (reaction) => reaction.emoji === snapshot.emoji,
  );

  if (message.reactionVersion === snapshot.reactionVersion) {
    return {
      ...message,
      reactions: restoreReactionSummary(
        message.reactions,
        snapshot.emoji,
        snapshotReaction,
      ),
    };
  }

  const currentReaction = message.reactions.find(
    (reaction) => reaction.emoji === snapshot.emoji,
  );

  if (!currentReaction) {
    return message;
  }

  const reactions = replaceReactionSummary(message.reactions, {
    ...currentReaction,
    reactedByMe: snapshotReaction?.reactedByMe ?? false,
  });

  return reactions === message.reactions ? message : { ...message, reactions };
}

export function updateChatMessageInList(
  messages: ChatMessage[],
  messageId: number,
  update: (message: ChatMessage) => ChatMessage,
): ChatMessage[] {
  const index = messages.findIndex((message) => message.id === messageId);

  if (index < 0) {
    return messages;
  }

  const current = messages[index];

  if (!current) {
    return messages;
  }

  const next = update(current);

  if (next === current) {
    return messages;
  }

  const updatedMessages = messages.slice();
  updatedMessages[index] = next;
  return updatedMessages;
}

export function chatMessagesRenderEqual(
  first: ChatMessage,
  second: ChatMessage,
): boolean {
  return (
    first.id === second.id &&
    first.conversationId === second.conversationId &&
    first.body === second.body &&
    first.createdAt === second.createdAt &&
    first.deletedAt === second.deletedAt &&
    first.reactionVersion === second.reactionVersion &&
    first.sender.id === second.sender.id &&
    first.sender.handle === second.sender.handle &&
    first.sender.displayName === second.sender.displayName &&
    first.sender.avatarUrl === second.sender.avatarUrl &&
    structuredValuesEqual(first.bodyEntities ?? [], second.bodyEntities ?? []) &&
    structuredValuesEqual(first.attachments ?? [], second.attachments ?? []) &&
    reactionSummariesEqual(first.reactions, second.reactions)
  );
}

function structuredValuesEqual(first: unknown, second: unknown): boolean {
  return first === second || JSON.stringify(first) === JSON.stringify(second);
}

function replaceAuthoritativeReactions(
  message: ChatMessage,
  reactions: ChatMessageReactionSummary[],
  reactionVersion: number,
): ChatMessage {
  const normalizedReactions = normalizeReactionSummaries(reactions);

  if (
    message.reactionVersion === reactionVersion &&
    reactionSummariesEqual(message.reactions, normalizedReactions)
  ) {
    return message;
  }

  return {
    ...message,
    reactions: normalizedReactions,
    reactionVersion,
  };
}

function replaceReactionSummary(
  reactions: ChatMessageReactionSummary[],
  replacement: ChatMessageReactionSummary,
): ChatMessageReactionSummary[] {
  const index = reactions.findIndex(
    (reaction) => reaction.emoji === replacement.emoji,
  );

  if (replacement.count === 0) {
    return index < 0
      ? reactions
      : reactions.filter((_, reactionIndex) => reactionIndex !== index);
  }

  if (index < 0) {
    return [...reactions, replacement];
  }

  const current = reactions[index];

  if (
    current?.count === replacement.count &&
    current.reactedByMe === replacement.reactedByMe
  ) {
    return reactions;
  }

  const next = reactions.slice();
  next[index] = replacement;
  return next;
}

function restoreReactionSummary(
  reactions: ChatMessageReactionSummary[],
  emoji: string,
  snapshot: ChatMessageReactionSummary | undefined,
): ChatMessageReactionSummary[] {
  if (snapshot) {
    return replaceReactionSummary(reactions, snapshot);
  }

  const index = reactions.findIndex((reaction) => reaction.emoji === emoji);
  return index < 0
    ? reactions
    : reactions.filter((_, reactionIndex) => reactionIndex !== index);
}

function normalizeReactionSummaries(
  reactions: ChatMessageReactionSummary[],
): ChatMessageReactionSummary[] {
  const normalized = new Map<string, ChatMessageReactionSummary>();

  for (const reaction of reactions) {
    const emoji = normalizeReactionEmoji(reaction.emoji);
    const count = Number.isSafeInteger(reaction.count)
      ? Math.max(0, reaction.count)
      : 0;

    if (!emoji || count === 0) {
      continue;
    }

    normalized.set(emoji, {
      emoji,
      count,
      reactedByMe: reaction.reactedByMe === true,
    });
  }

  return [...normalized.values()];
}

function normalizeReactionEmoji(value: string): string | null {
  const emoji = value.trim().normalize("NFC");
  return emoji !== "" && emoji.length <= 64 ? emoji : null;
}

function reactionSummariesEqual(
  first: ChatMessageReactionSummary[],
  second: ChatMessageReactionSummary[],
): boolean {
  return (
    first.length === second.length &&
    first.every((reaction, index) => {
      const candidate = second[index];
      return (
        candidate?.emoji === reaction.emoji &&
        candidate.count === reaction.count &&
        candidate.reactedByMe === reaction.reactedByMe
      );
    })
  );
}
