import type {
  CreatePostInput,
  PostAttachmentInput,
  UploadedAudio,
  UploadedImage,
  UploadedVideo,
} from "./api";
import type { Post } from "./types";

export type PostMediaDraft = {
  mime: string;
  posterUrl?: string | null;
  size?: number | null;
  type: "image" | "video" | "audio";
  url: string;
};

export function postMediaDraftFromImage(upload: UploadedImage): PostMediaDraft {
  return {
    mime: upload.mime,
    size: upload.size,
    type: "image",
    url: upload.url,
  };
}

export function postMediaDraftFromVideo(upload: UploadedVideo): PostMediaDraft {
  return {
    mime: upload.mime,
    posterUrl: upload.posterUrl ?? null,
    size: upload.size,
    type: "video",
    url: upload.url,
  };
}

export function postMediaDraftFromAudio(upload: UploadedAudio): PostMediaDraft {
  return {
    mime: upload.mime,
    size: upload.size,
    type: "audio",
    url: upload.url,
  };
}

export function postMediaInputFromDraft(
  media: PostMediaDraft | PostMediaDraft[] | undefined,
): Pick<CreatePostInput, "attachments" | "mediaUrl" | "mediaType" | "mediaMime" | "mediaPosterUrl"> {
  const attachments = Array.isArray(media) ? media : media ? [media] : [];

  if (attachments.length === 0) {
    return {};
  }

  const firstLegacy = attachments.find((attachment) => attachment.type === "image" || attachment.type === "video");
  const attachmentInputs: PostAttachmentInput[] = attachments.map((attachment) => ({
    kind: attachment.type,
    url: attachment.url,
    mime: attachment.mime,
    sizeBytes: attachment.size ?? null,
    posterUrl: attachment.posterUrl ?? null,
  }));

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
