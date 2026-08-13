import { describe, expect, it } from "vitest";
import { normalizeMessageReactionEmoji } from "./messageReactionEmoji";

describe("message reaction emoji normalization", () => {
  it.each(["❤️", "👍🏽", "👨‍👩‍👧", "🇳🇴", "1️⃣"])(
    "accepts one supported emoji: %s",
    (emoji) => {
      expect(normalizeMessageReactionEmoji(emoji)).toBe(emoji.normalize("NFC"));
    },
  );

  it.each(["", "hello", "👍 👍", "👍\u202E", "👍👍"])(
    "rejects unsupported input: %s",
    (value) => {
      expect(normalizeMessageReactionEmoji(value)).toBeNull();
    },
  );
});
