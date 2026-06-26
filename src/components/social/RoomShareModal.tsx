import { Copy, ExternalLink, Share2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import {
  roomCanonicalPath,
  roomCanonicalUrl,
  roomShareCardUrl,
} from "../../lib/api";
import { shareUrlWithAttribution } from "../../lib/growthAttribution";
import type { Room } from "../../lib/types";
import { Button } from "../ui/Button";
import { ModalSheet } from "../ui/ModalSheet";

type RoomShareModalProps = {
  onClose: () => void;
  open: boolean;
  room: Room;
};

export function RoomShareModal({ onClose, open, room }: RoomShareModalProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [nativeShareAvailable] = useState(
    () => typeof navigator !== "undefined" && "share" in navigator,
  );
  const canonicalPath = roomCanonicalPath(room);
  const canonicalUrl = roomCanonicalUrl(room);
  const shareUrl = shareUrlWithAttribution(canonicalUrl, {
    kind: "room",
    ref: room.slug,
  });

  async function handleCopy() {
    try {
      await copyText(shareUrl);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  async function handleNativeShare() {
    if (!nativeShareAvailable || !("share" in navigator)) {
      return;
    }

    try {
      await navigator.share({
        title: `${room.name} on thia.lol`,
        text: room.summary || `/${room.slug} on thia.lol`,
        url: shareUrl,
      });
    } catch {
      // User cancellation is expected and should stay quiet.
    }
  }

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title="Share room"
      description={`Share /${room.slug}.`}
      closeLabel="Close share dialog"
      testId="room-share-modal"
      size="md"
      mobile="sheet"
      bodyClassName="space-y-5"
    >
      <div className="rounded-card border border-line bg-surface/70 p-3 shadow-inner-soft">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-text">{room.name}</span>
            <span className="text-muted">/{room.slug}</span>
          </div>
          {room.summary ? (
            <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-6 text-text">
              {room.summary}
            </p>
          ) : null}
          <Link
            to={canonicalPath}
            className="mt-2 inline-flex text-xs font-medium text-accent-strong underline-offset-4 hover:underline"
          >
            {canonicalPath}
          </Link>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          data-testid="room-share-copy-link"
          icon={<Copy aria-hidden="true" size={15} />}
          onClick={() => void handleCopy()}
        >
          {copyState === "copied" ? "Copied" : "Copy link"}
        </Button>
        {nativeShareAvailable ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="room-share-native"
            icon={<Share2 aria-hidden="true" size={15} />}
            onClick={() => void handleNativeShare()}
          >
            Share
          </Button>
        ) : null}
        <a
          href={roomShareCardUrl(room)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-control border border-line bg-surface px-3 text-sm font-medium text-text shadow-soft transition duration-fluid ease-fluid hover:-translate-y-0.5 hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:hover:translate-y-0"
          data-testid="room-share-card-link"
        >
          <ExternalLink aria-hidden="true" size={15} />
          Open card
        </a>
      </div>

      {copyState === "error" ? (
        <p className="rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink">
          Copy failed. The link is {shareUrl}
        </p>
      ) : null}
    </ModalSheet>
  );
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("Copy failed.");
  }
}
