import type { Post } from "./types";

export function roomAllowsPosting(room: Post["room"] | null | undefined): boolean {
  if (room === null || room === undefined || !("viewerCanPost" in room)) {
    return true;
  }

  return room.viewerCanPost === true;
}
