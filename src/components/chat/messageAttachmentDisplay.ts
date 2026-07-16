import type {
  ChatMessage,
  ChatMessageAttachment,
  RichTextEntity,
} from "../../lib/types";

type RetainedMessageLine = {
  line: string;
  originalEnd: number;
  originalStart: number;
  outputStart: number;
};

export function messageTextForDisplay(
  message: Pick<ChatMessage, "body" | "bodyEntities"> & {
    attachments?: readonly ChatMessageAttachment[] | null | undefined;
  },
): { body: string; bodyEntities: RichTextEntity[] | undefined } {
  const canonicalPaths = nativeAttachmentCanonicalPaths(message.attachments ?? []);
  const unavailableKinds = nativeUnavailableAttachmentKinds(
    message.attachments ?? [],
  );

  if (
    (canonicalPaths.size === 0 && unavailableKinds.size === 0) ||
    message.body === ""
  ) {
    return {
      body: message.body,
      bodyEntities: message.bodyEntities,
    };
  }

  const retainedLines: RetainedMessageLine[] = [];
  let originalStart = 0;
  let outputLength = 0;

  message.body.split("\n").forEach((line) => {
    const originalEnd = originalStart + line.length;
    const canonicalPath = standaloneCanonicalPath(line);
    const canonicalKind = canonicalPath
      ? nativeCanonicalPathKind(canonicalPath)
      : null;
    const hidesNativeLink = Boolean(
      canonicalPath &&
      (canonicalPaths.has(canonicalPath) ||
        (canonicalKind && unavailableKinds.has(canonicalKind))),
    );

    if (!hidesNativeLink) {
      const outputStart = outputLength + (retainedLines.length > 0 ? 1 : 0);

      retainedLines.push({
        line,
        originalEnd,
        originalStart,
        outputStart,
      });
      outputLength = outputStart + line.length;
    }

    originalStart = originalEnd + 1;
  });

  if (retainedLines.length === message.body.split("\n").length) {
    return {
      body: message.body,
      bodyEntities: message.bodyEntities,
    };
  }

  const bodyEntities = message.bodyEntities?.flatMap((entity) => {
    const entityEnd = entity.start + entity.length;
    const line = retainedLines.find(
      (candidate) =>
        entity.start >= candidate.originalStart &&
        entityEnd <= candidate.originalEnd,
    );

    return line
      ? [{
          ...entity,
          start: line.outputStart + entity.start - line.originalStart,
        }]
      : [];
  });

  return {
    body: retainedLines.map(({ line }) => line).join("\n"),
    bodyEntities,
  };
}

function nativeUnavailableAttachmentKinds(
  attachments: readonly ChatMessageAttachment[],
): Set<"post" | "room"> {
  const kinds = new Set<"post" | "room">();

  attachments.forEach((attachment) => {
    if (attachment.type === "post" && !attachment.post) {
      kinds.add("post");
    }

    if (attachment.type === "room" && !attachment.room) {
      kinds.add("room");
    }
  });

  return kinds;
}

function nativeCanonicalPathKind(
  path: string,
): "post" | "room" | null {
  if (/^\/@[^/]+\/posts\/[^/]+\/?$/u.test(path)) {
    return "post";
  }

  return /^\/rooms\/[^/]+\/?$/u.test(path) ? "room" : null;
}

export function messageBodyWithoutNativeAttachmentLinks(
  body: string,
  attachments?: readonly ChatMessageAttachment[] | null | undefined,
): string {
  return messageTextForDisplay({ body, attachments }).body;
}

function nativeAttachmentCanonicalPaths(
  attachments: readonly ChatMessageAttachment[],
): Set<string> {
  const paths = new Set<string>();

  attachments.forEach((attachment) => {
    if (attachment.type === "post" && attachment.post) {
      addCanonicalPath(paths, attachment.post.canonicalPath);
      addCanonicalPath(paths, attachment.post.canonicalUrl);

      const publicId = attachment.post.publicId ?? String(attachment.post.id);
      addCanonicalPath(
        paths,
        `/@${attachment.post.author.handle}/posts/${publicId}`,
      );
    }

    if (attachment.type === "room" && attachment.room) {
      addCanonicalPath(paths, attachment.room.canonicalPath);
      addCanonicalPath(paths, attachment.room.canonicalUrl);
      addCanonicalPath(paths, `/rooms/${attachment.room.slug}`);
    }
  });

  return paths;
}

function addCanonicalPath(paths: Set<string>, value: string | null | undefined) {
  const path = value ? standaloneCanonicalPath(value) : null;

  if (path) {
    paths.add(path);
  }
}

function standaloneCanonicalPath(value: string): string | null {
  const candidate = value.trim();

  if (candidate === "") {
    return null;
  }

  try {
    const relative = candidate.startsWith("/");

    if (!relative && !/^https?:\/\//iu.test(candidate)) {
      return null;
    }

    const url = new URL(candidate, "https://thia.lol");
    const hostname = url.hostname.toLowerCase().replace(/^www\./u, "");

    if (!relative && hostname !== "thia.lol") {
      return null;
    }

    return url.pathname.replace(/\/+$/u, "") || "/";
  } catch {
    return null;
  }
}
