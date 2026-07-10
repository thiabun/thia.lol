import type { ChatMessageAttachmentInput } from "./api";
import type { GifAttachment } from "./types";

export function gifToChatAttachmentInput(gif: GifAttachment): ChatMessageAttachmentInput {
  return {
    type: "gif",
    provider: "klipy",
    resourceType: "gif",
    resourceId: gif.resourceId,
    resourceKey: gif.resourceKey,
    url: gif.url,
    mime: "image/gif",
    width: gif.width ?? null,
    height: gif.height ?? null,
    sourceUrl: gif.sourceUrl ?? null,
    card: gif.card ?? null,
  };
}

export function gifAttachmentTitle(gif: GifAttachment): string {
  if (typeof gif.title === "string" && gif.title.trim() !== "") {
    return gif.title.trim();
  }

  const cardTitle = gifCardTitle(gif.card);

  return cardTitle ?? "KLIPY GIF";
}

function gifCardTitle(card: GifAttachment["card"]): string | null {
  if (card === null || card === undefined || Array.isArray(card)) {
    return null;
  }

  const title = card.title;

  return typeof title === "string" && title.trim() !== "" ? title.trim() : null;
}
