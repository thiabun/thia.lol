export type MessageReactionEmojiOption = {
  emoji: string;
  label: string;
};

export const quickMessageReactionEmoji: readonly MessageReactionEmojiOption[] = [
  { emoji: "❤️", label: "heart" },
  { emoji: "👍", label: "thumbs up" },
  { emoji: "😂", label: "face with tears of joy" },
  { emoji: "😮", label: "surprised face" },
  { emoji: "😢", label: "crying face" },
  { emoji: "🔥", label: "fire" },
] as const;

const messageReactionForbiddenPattern =
  /[\p{White_Space}\p{Cc}\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/u;
const messageReactionPictographicPattern =
  /^(?:\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*)$/u;
const messageReactionFlagPattern = /^\p{Regional_Indicator}{2}$/u;
const messageReactionKeycapPattern = /^[#*0-9]\uFE0F?\u20E3$/u;
const messageReactionTagFlagPattern =
  /^\p{Extended_Pictographic}[\u{E0020}-\u{E007E}]+\u{E007F}$/u;

export function messageReactionEmojiLabel(emoji: string): string {
  return (
    quickMessageReactionEmoji.find((option) => option.emoji === emoji)?.label ??
    emoji
  );
}

export function normalizeMessageReactionEmoji(value: string): string | null {
  const emoji = value.trim().normalize("NFC");
  const supported =
    messageReactionPictographicPattern.test(emoji) ||
    messageReactionFlagPattern.test(emoji) ||
    messageReactionKeycapPattern.test(emoji) ||
    messageReactionTagFlagPattern.test(emoji);

  if (
    emoji === "" ||
    new TextEncoder().encode(emoji).byteLength > 64 ||
    messageReactionForbiddenPattern.test(emoji) ||
    !supported
  ) {
    return null;
  }

  if (typeof Intl.Segmenter !== "function") {
    return emoji;
  }

  const segments = [
    ...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(emoji),
  ];
  return segments.length === 1 && segments[0]?.segment === emoji ? emoji : null;
}
