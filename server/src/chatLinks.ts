import { normalizePostIdentifier } from "./posts.js";
import { normalizeRoomSlug } from "./rooms.js";

export type NativeChatLink = {
  kind: "post";
  handle: string;
  identifier: string;
  start: number;
  length: number;
  text: string;
} | {
  kind: "room";
  slug: string;
  start: number;
  length: number;
  text: string;
};

export interface ChatLinkEntity {
  start: number;
  length: number;
  text: string;
  url: string;
}

const urlPattern = /https?:\/\/[^\s<>"']{3,1000}/giu;
const trailingPunctuationPattern = /[),.!?;:]+$/u;

export function chatLinkEntities(body: string): ChatLinkEntity[] {
  const entities: ChatLinkEntity[] = [];

  for (const match of body.matchAll(urlPattern)) {
    const raw = match[0] ?? "";
    const text = raw.replace(trailingPunctuationPattern, "");

    if (text === "" || !/^https:\/\//iu.test(text)) {
      continue;
    }

    try {
      const url = new URL(text);

      if (url.protocol !== "https:" || url.username !== "" || url.password !== "") {
        continue;
      }

      entities.push({
        start: match.index ?? 0,
        length: text.length,
        text,
        url: url.toString(),
      });
    } catch {
      // Invalid URLs stay ordinary message text.
    }
  }

  return entities;
}

export function nativeChatLinks(body: string, publicBaseUrl: string): NativeChatLink[] {
  let publicOrigin: string;

  try {
    publicOrigin = new URL(publicBaseUrl).origin;
  } catch {
    return [];
  }

  const links: NativeChatLink[] = [];

  for (const entity of chatLinkEntities(body)) {
    const url = new URL(entity.url);

    if (url.origin !== publicOrigin) {
      continue;
    }

    const postMatch = url.pathname.match(/^\/@([^/]+)\/posts\/([^/]+)\/?$/u);

    if (postMatch !== null) {
      const handle = safeDecode(postMatch[1] ?? "").replace(/^@/u, "").toLowerCase();
      const identifier = normalizePostIdentifier(postMatch[2] ?? "");

      if (/^[a-z0-9_-]{1,40}$/u.test(handle) && identifier !== null) {
        links.push({
          kind: "post",
          handle,
          identifier,
          start: entity.start,
          length: entity.length,
          text: entity.text,
        });
      }

      continue;
    }

    const roomMatch = url.pathname.match(/^\/rooms\/([^/]+)\/?$/u);

    if (roomMatch !== null) {
      const slug = normalizeRoomSlug(roomMatch[1] ?? "");

      if (slug !== null) {
        links.push({
          kind: "room",
          slug,
          start: entity.start,
          length: entity.length,
          text: entity.text,
        });
      }
    }
  }

  return links;
}

export function removeNativeChatLinks(body: string, links: readonly NativeChatLink[]): string {
  let result = body;

  for (const link of [...links].sort((left, right) => right.start - left.start)) {
    result = `${result.slice(0, link.start)}${result.slice(link.start + link.length)}`;
  }

  const cleaned = result
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n[ \t]+/gu, "\n")
    .replace(/ {2,}/gu, " ")
    .replace(/[ \t]+([,.;!?])/gu, "$1")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();

  return /^[),.!?;:\s]*$/u.test(cleaned) ? "" : cleaned;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}
