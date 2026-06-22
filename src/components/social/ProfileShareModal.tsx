import { Copy, Download, LoaderCircle, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  profileCanonicalPath,
  profileCanonicalUrl,
  profileShareCardCacheUpload,
  profileShareCardUrl,
} from "../../lib/api";
import { captureShareCard, downloadBlob } from "../../lib/shareCardCapture";
import type { Profile } from "../../lib/types";
import { useAuth } from "../../lib/useAuth";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { ModalSheet } from "../ui/ModalSheet";

type ProfileShareModalProps = {
  onClose: () => void;
  open: boolean;
  profile: Profile;
};

export function ProfileShareModal({ onClose, open, profile }: ProfileShareModalProps) {
  const { runWithAuth, status, user } = useAuth();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [cardState, setCardState] = useState<"idle" | "generating" | "error">("idle");
  const [nativeShareAvailable] = useState(
    () => typeof navigator !== "undefined" && "share" in navigator,
  );
  const canonicalPath = profileCanonicalPath(profile);
  const canonicalUrl = profileCanonicalUrl(profile);
  const canPublishCard = status === "authenticated" && user?.id === profile.user.id;

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    let active = true;

    queueMicrotask(() => {
      if (active) {
        setCopyState("idle");
      }
    });

    return () => {
      active = false;
    };
  }, [open]);

  async function handleCopy() {
    try {
      void generateProfileCard({ publish: canPublishCard, silent: true }).catch(
        () => undefined,
      );
      await copyText(canonicalUrl);
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
      void generateProfileCard({ publish: canPublishCard, silent: true }).catch(
        () => undefined,
      );
      await navigator.share({
        title: `${profile.user.displayName} (@${profile.user.handle}) on thia.lol`,
        text: profile.bio || `@${profile.user.handle} on thia.lol`,
        url: canonicalUrl,
      });
    } catch {
      // User cancellation is expected and should stay quiet.
    }
  }

  async function handleSaveImage() {
    try {
      const blob = await generateProfileCard({ publish: canPublishCard });
      downloadBlob(blob, `thia-profile-${profile.user.handle}.png`);
    } catch {
      setCardState("error");
    }
  }

  async function generateProfileCard({
    publish,
    silent = false,
  }: {
    publish: boolean;
    silent?: boolean;
  }) {
    if (!silent) {
      setCardState("generating");
    }

    try {
      const blob = await captureShareCard(
        `/share-render/profile/${encodeURIComponent(profile.user.handle)}`,
      );

      if (publish) {
        await runWithAuth(
          (csrfToken) => profileShareCardCacheUpload(profile, blob, csrfToken),
          { retryOnCsrf: true },
        ).catch(() => undefined);
      }

      if (!silent) {
        setCardState("idle");
      }

      return blob;
    } catch (error) {
      if (!silent) {
        setCardState("error");
      }

      throw error;
    }
  }

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title="Share profile"
      description={`Share @${profile.user.handle}'s profile.`}
      closeLabel="Close share dialog"
      testId="profile-share-modal"
      size="md"
      mobile="sheet"
      bodyClassName="space-y-5"
    >
      <div className="rounded-card border border-line bg-surface/70 p-3 shadow-inner-soft">
        <div className="flex items-start gap-3">
          <Avatar user={profile.user} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-text">{profile.user.displayName}</span>
              <span className="text-muted">@{profile.user.handle}</span>
            </div>
            {profile.bio ? (
              <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-6 text-text">
                {profile.bio}
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
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          data-testid="profile-share-copy-link"
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
            data-testid="profile-share-native"
            icon={<Share2 aria-hidden="true" size={15} />}
            onClick={() => void handleNativeShare()}
          >
            Share
          </Button>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          data-testid="profile-share-save-image"
          disabled={cardState === "generating"}
          icon={
            cardState === "generating" ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" size={15} />
            ) : (
              <Download aria-hidden="true" size={15} />
            )
          }
          onClick={() => void handleSaveImage()}
        >
          {cardState === "generating" ? "Generating" : "Save image"}
        </Button>
      </div>

      {copyState === "error" ? (
        <p className="rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink">
          Copy failed. The link is {canonicalUrl}
        </p>
      ) : null}
      {cardState === "error" ? (
        <p className="rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink">
          Image generation failed. You can still open the current cached card at{" "}
          <a className="underline" href={profileShareCardUrl(profile)} rel="noreferrer" target="_blank">
            this link
          </a>
          .
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
