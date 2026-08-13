import { describe, expect, it } from "vitest";
import type {
  ChatMessage,
  ChatMessageReactionEvent,
  ChatMessageReactionMutationResult,
} from "../../lib/types";
import {
  applyChatMessageReactionEvent,
  applyChatMessageReactionMutation,
  applyPendingMessageReactionIntents,
  optimisticallyToggleMessageReaction,
  restoreChatMessageReactionSnapshot,
} from "./messageReactionState";

const message: ChatMessage = {
  id: 10,
  conversationId: 20,
  body: "Hello",
  createdAt: "2026-08-13T12:00:00Z",
  deletedAt: null,
  reactionVersion: 2,
  reactions: [{ emoji: "👍", count: 2, reactedByMe: true }],
  sender: {
    id: 2,
    handle: "friend",
    displayName: "Friend",
    initials: "F",
    aura: "tide",
  },
};

describe("message reaction state", () => {
  it("ignores stale authoritative mutations", () => {
    const result: ChatMessageReactionMutationResult = {
      changed: true,
      conversationId: 20,
      messageId: 10,
      reaction: { emoji: "👍", reacted: false },
      reactionVersion: 1,
      reactions: [{ emoji: "👍", count: 1, reactedByMe: false }],
    };

    expect(applyChatMessageReactionMutation(message, result)).toBe(message);
  });

  it("preserves viewer selection for another actor's event", () => {
    const next = applyChatMessageReactionEvent(
      message,
      reactionEvent({
        actorUserId: 2,
        emoji: "❤️",
        reacted: true,
        reactionVersion: 3,
        reactions: [
          { emoji: "👍", count: 3 },
          { emoji: "❤️", count: 1 },
        ],
      }),
      1,
    );

    expect(next.reactions).toEqual([
      { emoji: "👍", count: 3, reactedByMe: true },
      { emoji: "❤️", count: 1, reactedByMe: false },
    ]);
  });

  it("applies viewer selection when the event actor is current user", () => {
    const next = applyChatMessageReactionEvent(
      message,
      reactionEvent({
        actorUserId: 1,
        emoji: "👍",
        reacted: false,
        reactionVersion: 3,
        reactions: [{ emoji: "👍", count: 1 }],
      }),
      1,
    );

    expect(next.reactions).toEqual([
      { emoji: "👍", count: 1, reactedByMe: false },
    ]);
  });

  it("rolls back only the failed emoji after a newer event", () => {
    const snapshot = {
      emoji: "👍",
      reactions: message.reactions,
      reactionVersion: message.reactionVersion,
    };
    const optimistic = optimisticallyToggleMessageReaction(message, "👍");
    const withNewerCount = applyChatMessageReactionEvent(
      optimistic,
      reactionEvent({
        actorUserId: 2,
        emoji: "👍",
        reacted: true,
        reactionVersion: 3,
        reactions: [{ emoji: "👍", count: 4 }],
      }),
      1,
    );
    const restored = restoreChatMessageReactionSnapshot(withNewerCount, snapshot);

    expect(restored.reactionVersion).toBe(3);
    expect(restored.reactions).toEqual([
      { emoji: "👍", count: 4, reactedByMe: true },
    ]);
  });

  it("preserves another optimistic emoji while rolling back", () => {
    const snapshot = {
      emoji: "👍",
      reactions: message.reactions,
      reactionVersion: message.reactionVersion,
    };
    const withTwoOptimisticChanges = optimisticallyToggleMessageReaction(
      optimisticallyToggleMessageReaction(message, "👍"),
      "❤️",
    );
    const restored = restoreChatMessageReactionSnapshot(
      withTwoOptimisticChanges,
      snapshot,
    );

    expect(restored.reactions).toEqual([
      { emoji: "👍", count: 2, reactedByMe: true },
      { emoji: "❤️", count: 1, reactedByMe: true },
    ]);
  });

  it("reapplies a different pending emoji after an authoritative result", () => {
    const authoritative = applyChatMessageReactionMutation(message, {
      changed: true,
      conversationId: 20,
      messageId: 10,
      reaction: { emoji: "👍", reacted: false },
      reactionVersion: 3,
      reactions: [{ emoji: "👍", count: 1, reactedByMe: false }],
    });
    const withPendingHeart = applyPendingMessageReactionIntents(authoritative, [
      { emoji: "❤️", reacted: true },
    ]);

    expect(withPendingHeart.reactions).toEqual([
      { emoji: "👍", count: 1, reactedByMe: false },
      { emoji: "❤️", count: 1, reactedByMe: true },
    ]);
  });
});

function reactionEvent(
  patch: Pick<
    ChatMessageReactionEvent,
    "actorUserId" | "emoji" | "reacted" | "reactionVersion" | "reactions"
  >,
): ChatMessageReactionEvent {
  return {
    schemaVersion: 1,
    type: "message.reactions.updated",
    conversationId: 20,
    messageId: 10,
    ...patch,
  };
}
