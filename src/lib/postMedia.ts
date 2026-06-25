import type {
  CreatePostInput,
  UploadedImage,
  UploadedVideo,
} from "./api";
import type { Post } from "./types";

export type PostMediaDraft = {
  mime: string;
  posterUrl?: string | null;
  type: "image" | "video";
  url: string;
};

export function postMediaDraftFromImage(upload: UploadedImage): PostMediaDraft {
  return {
    mime: upload.mime,
    type: "image",
    url: upload.url,
  };
}

export function postMediaDraftFromVideo(upload: UploadedVideo): PostMediaDraft {
  return {
    mime: upload.mime,
    posterUrl: upload.posterUrl ?? null,
    type: "video",
    url: upload.url,
  };
}

export function postMediaInputFromDraft(
  media: PostMediaDraft | undefined,
): Pick<CreatePostInput, "mediaUrl" | "mediaType" | "mediaMime" | "mediaPosterUrl"> {
  if (!media) {
    return {};
  }

  return {
    mediaUrl: media.url,
    mediaType: media.type,
    mediaMime: media.mime,
    mediaPosterUrl: media.posterUrl ?? null,
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
