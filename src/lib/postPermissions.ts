import type { AuthUser } from "./authTypes";
import type { Post } from "./types";

export function canHidePost(user: AuthUser | undefined): boolean {
  return isModerator(user);
}

export function canDeletePost(user: AuthUser | undefined, post: Post): boolean {
  return Boolean(user && (post.author.id === user.id || isModerator(user)));
}

function isModerator(user: AuthUser | undefined): boolean {
  return user?.role === "admin" || user?.role === "moderator";
}
