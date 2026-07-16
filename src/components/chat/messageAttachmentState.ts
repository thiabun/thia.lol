import type { PostAttachmentInput } from "../../lib/api";
import {
  postMediaInputFromDraft,
  type PostMediaDraft,
} from "../../lib/postMedia";

export const maxMessageAttachments = 8;

export function messageHasContent(
  body: string,
  attachments: readonly PostMediaDraft[],
): boolean {
  return body.trim().length > 0 || attachments.length > 0;
}

export function messageAttachmentInputsFromDrafts(
  attachments: readonly PostMediaDraft[],
): PostAttachmentInput[] {
  return postMediaInputFromDraft([...attachments]).attachments ?? [];
}
