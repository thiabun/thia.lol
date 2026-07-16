import { FileQuestion } from "lucide-react";
import { cn } from "../../lib/classNames";
import { gifAttachmentTitle } from "../../lib/gifs";
import { safeKlipyUrl } from "../../lib/providerMedia";
import type {
  ChatMessageAttachment,
  GifAttachment,
  PostAttachment,
} from "../../lib/types";
import {
  PostAttachmentGallery,
  PostCard,
} from "../social/PostCard";
import { RoomCard } from "../social/RoomCard";

export type MessageAttachmentsProps = {
  attachments?: readonly ChatMessageAttachment[] | null | undefined;
  className?: string | undefined;
  testId?: string | undefined;
};

type MessageAttachmentGroup =
  | {
      attachments: PostAttachment[];
      key: string;
      type: "media";
    }
  | {
      attachment: Exclude<ChatMessageAttachment, { type: "media" }>;
      key: string;
      type: "native";
    };

export function MessageAttachments({
  attachments,
  className,
  testId = "message-attachments",
}: MessageAttachmentsProps) {
  const groups = groupMessageAttachments(attachments ?? []);

  if (groups.length === 0) {
    return null;
  }

  return (
    <div
      className={cn("grid min-w-0 w-full max-w-[40rem] gap-2", className)}
      data-testid={testId}
    >
      {groups.map((group, groupIndex) => {
        if (group.type === "media") {
          return (
            <PostAttachmentGallery
              key={group.key}
              attachments={group.attachments}
              className="min-w-0 w-full"
              maxHeightClass="max-h-[min(52svh,24rem)]"
              musicLayout="compact"
              testId={`${testId}-media-${groupIndex}`}
            />
          );
        }

        const attachment = group.attachment;

        if (attachment.type === "post") {
          return (
            <div
              key={group.key}
              className="min-w-0 w-full"
              data-message-attachment="post"
              data-testid={
                attachment.post
                  ? "message-post-attachment"
                  : "message-post-attachment-unavailable"
              }
            >
              {attachment.post ? (
                <PostCard post={attachment.post} variant="attachment" />
              ) : (
                <UnavailableAttachment label="Post unavailable" />
              )}
            </div>
          );
        }

        if (attachment.type === "room") {
          return (
            <div
              key={group.key}
              className="min-w-0 w-full"
              data-message-attachment="room"
              data-testid={
                attachment.room
                  ? "message-room-attachment"
                  : "message-room-attachment-unavailable"
              }
            >
              {attachment.room ? (
                <RoomCard room={attachment.room} variant="attachment" />
              ) : (
                <UnavailableAttachment label="Room unavailable" />
              )}
            </div>
          );
        }

        return (
          <LegacyGifAttachment
            key={group.key}
            gif={attachment.gif}
          />
        );
      })}
    </div>
  );
}

function groupMessageAttachments(
  attachments: readonly ChatMessageAttachment[],
): MessageAttachmentGroup[] {
  const groups: MessageAttachmentGroup[] = [];

  attachments.forEach((attachment, index) => {
    if (attachment.type === "media") {
      const previous = groups.at(-1);

      if (previous?.type === "media") {
        previous.attachments.push(attachment.media);
      } else {
        groups.push({
          attachments: [attachment.media],
          key: `media-${index}`,
          type: "media",
        });
      }
      return;
    }

    groups.push({
      attachment,
      key: `${attachment.type}-${index}`,
      type: "native",
    });
  });

  return groups;
}

function UnavailableAttachment({ label }: { label: string }) {
  return (
    <div className="flex min-h-16 min-w-0 w-full items-center gap-2.5 rounded-card border border-line bg-surface/76 px-3 py-2.5 text-sm font-medium text-muted shadow-inner-soft">
      <FileQuestion aria-hidden="true" className="shrink-0" size={17} />
      <span>{label}</span>
    </div>
  );
}

function LegacyGifAttachment({ gif }: { gif: GifAttachment }) {
  const mediaUrl = safeKlipyUrl(gif.url);

  if (!mediaUrl) {
    return <UnavailableAttachment label="GIF unavailable" />;
  }

  const sourceUrl = safeKlipyUrl(gif.sourceUrl) ?? mediaUrl;

  return (
    <a
      href={sourceUrl}
      target="_blank"
      rel="noreferrer"
      className="block min-w-0 w-full overflow-hidden rounded-card border border-line bg-canvas/70 shadow-inner-soft transition duration-fluid ease-fluid hover:border-line-strong hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      data-message-attachment="gif"
      data-testid="message-gif-attachment"
    >
      <img
        alt={gifAttachmentTitle(gif)}
        src={mediaUrl}
        className="block max-h-[min(52svh,24rem)] min-w-0 w-full object-contain"
        decoding="async"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      <span className="flex min-w-0 items-center justify-between gap-2 px-2.5 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted">
        <span className="truncate">{gifAttachmentTitle(gif)}</span>
        <span className="shrink-0">KLIPY</span>
      </span>
    </a>
  );
}
