import type {
  CreatePostInput,
  PostAttachmentInput,
  UploadedAudio,
  UploadedImage,
  UploadedVideo,
} from "./api";
import type { Post, ProfileIntegrationCard } from "./types";
import type { GifSearchResult } from "./types";

export type PostUploadedMediaDraft = {
  durationSeconds?: number | null;
  height?: number | null;
  mime: string;
  posterUrl?: string | null;
  size?: number | null;
  type: "image" | "video" | "audio";
  url: string;
  width?: number | null;
};

export type PostVisualMediaDraft = PostUploadedMediaDraft & {
  type: "image" | "video";
};

export type PostMediaDraft =
  | PostUploadedMediaDraft
  | {
      card: ProfileIntegrationCard;
      provider: "spotify" | "youtube";
      resourceId: string;
      resourceKey: string;
      resourceType: string;
      sourceUrl: string;
      type: "integration";
    }
  | {
      card: Record<string, unknown> | unknown[] | null;
      height?: number | null;
      provider: "klipy";
      resourceId: string;
      resourceKey: string;
      sourceUrl?: string | null;
      type: "gif";
      url: string;
      width?: number | null;
    };

export function postMediaDraftFromImage(upload: UploadedImage): PostMediaDraft {
  return {
    height: upload.height,
    mime: upload.mime,
    size: upload.size,
    type: "image",
    url: upload.url,
    width: upload.width,
  };
}

export function postMediaDraftFromVideo(upload: UploadedVideo): PostMediaDraft {
  return {
    durationSeconds: upload.duration ?? null,
    height: upload.height ?? null,
    mime: upload.mime,
    posterUrl: upload.posterUrl ?? null,
    size: upload.size,
    type: "video",
    url: upload.url,
    width: upload.width ?? null,
  };
}

export function postMediaDraftFromAudio(upload: UploadedAudio): PostMediaDraft {
  return {
    durationSeconds: upload.duration ?? null,
    mime: upload.mime,
    size: upload.size,
    type: "audio",
    url: upload.url,
  };
}

export function postMediaDraftFromIntegration(card: ProfileIntegrationCard): PostMediaDraft {
  if (card.provider !== "spotify" && card.provider !== "youtube") {
    throw new Error("Only Spotify and YouTube music cards can be attached to posts.");
  }

  return {
    card,
    provider: card.provider,
    resourceId: card.resourceId,
    resourceKey: card.resourceKey,
    resourceType: card.resourceType,
    sourceUrl: card.sourceUrl,
    type: "integration",
  };
}

export function postMediaDraftFromGif(gif: GifSearchResult): PostMediaDraft {
  return {
    card: gif.card ?? null,
    height: gif.height ?? null,
    provider: "klipy",
    resourceId: gif.resourceId,
    resourceKey: gif.resourceKey,
    sourceUrl: gif.sourceUrl ?? null,
    type: "gif",
    url: gif.url,
    width: gif.width ?? null,
  };
}

export function postMediaInputFromDraft(
  media: PostMediaDraft | PostMediaDraft[] | undefined,
): Pick<CreatePostInput, "attachments" | "mediaUrl" | "mediaType" | "mediaMime" | "mediaPosterUrl"> {
  const attachments = Array.isArray(media) ? media : media ? [media] : [];

  if (attachments.length === 0) {
    return {};
  }

  const firstLegacy = attachments.find(isLegacyPostMediaDraft);
  const attachmentInputs: PostAttachmentInput[] = attachments.map((attachment) => {
    if (attachment.type === "integration") {
      return {
        kind: "integration",
        provider: attachment.provider,
        resourceType: attachment.resourceType,
        resourceId: attachment.resourceId,
        resourceKey: attachment.resourceKey,
        sourceUrl: attachment.sourceUrl,
        card: attachment.card,
      };
    }

    if (attachment.type === "gif") {
      return {
        kind: "gif",
        url: attachment.url,
        mime: "image/gif",
        width: attachment.width ?? null,
        height: attachment.height ?? null,
        provider: attachment.provider,
        resourceType: "gif",
        resourceId: attachment.resourceId,
        resourceKey: attachment.resourceKey,
        sourceUrl: attachment.sourceUrl ?? null,
        card: attachment.card,
      };
    }

    return {
      kind: attachment.type,
      url: attachment.url,
      mime: attachment.mime,
      sizeBytes: attachment.size ?? null,
      width: attachment.width ?? null,
      height: attachment.height ?? null,
      durationSeconds: attachment.durationSeconds ?? null,
      posterUrl: attachment.posterUrl ?? null,
    };
  });

  return {
    attachments: attachmentInputs,
    mediaUrl: firstLegacy?.url ?? null,
    mediaType: firstLegacy?.type === "image" || firstLegacy?.type === "video" ? firstLegacy.type : null,
    mediaMime: firstLegacy?.mime ?? null,
    mediaPosterUrl: firstLegacy?.posterUrl ?? null,
  };
}

export function postMediaType(post: Pick<Post, "mediaType" | "mediaUrl">): "image" | "video" | null {
  if (!post.mediaUrl) {
    return null;
  }

  if (post.mediaType === "image" || post.mediaType === "video") {
    return post.mediaType;
  }

  return /\.(?:mp4|webm)$/iu.test(post.mediaUrl) ? "video" : "image";
}

function isLegacyPostMediaDraft(
  attachment: PostMediaDraft,
): attachment is PostVisualMediaDraft {
  return attachment.type === "image" || attachment.type === "video";
}
