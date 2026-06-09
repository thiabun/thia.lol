import type { Post } from "./types";

export const postCreatedEventName = "thia:post-created";

export function emitPostCreated(post: Post) {
  window.dispatchEvent(new CustomEvent<Post>(postCreatedEventName, { detail: post }));
}
