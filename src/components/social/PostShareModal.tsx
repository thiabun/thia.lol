import {
  CheckCircle2,
  Copy,
  Download,
  LoaderCircle,
  MessageCircle,
  Search,
  Send,
  Share2,
  WifiOff,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { ModalSheet } from "../ui/ModalSheet";
import { CompactStateNotice } from "../ui/RouteState";
import {
  getChatMoots,
  postCanonicalUrl,
  postPublicIdentifier,
  postShareCardCacheUpload,
  postShareCardUrl,
  sharePostToMessages,
} from "../../lib/api";
import { cn } from "../../lib/classNames";
import { shareUrlWithAttribution } from "../../lib/growthAttribution";
import { captureShareCard, downloadBlob } from "../../lib/shareCardCapture";
import type { ChatMoot, Post } from "../../lib/types";
import { useAuth } from "../../lib/useAuth";

type PostShareModalProps = {
  open: boolean;
  post: Post;
  onClose: () => void;
};

type SentConversationLink = {
  conversationId: number;
  recipientLabel: string;
};

export function PostShareModal({ open, post, onClose }: PostShareModalProps) {
  const { csrfToken, runWithAuth, status, user } = useAuth();
  const [moots, setMoots] = useState<ChatMoot[]>([]);
  const [mootsLoading, setMootsLoading] = useState(false);
  const [mootsError, setMootsError] = useState<string>();
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [shareMessage, setShareMessage] = useState<string>();
  const [sentConversations, setSentConversations] = useState<
    SentConversationLink[]
  >([]);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const [cardState, setCardState] = useState<"idle" | "generating" | "error">(
    "idle",
  );
  const [nativeShareAvailable] = useState(
    () => typeof navigator !== "undefined" && "share" in navigator,
  );
  const canonicalUrl = postCanonicalUrl(post);
  const publicIdentifier = postPublicIdentifier(post);
  const shareUrl = shareUrlWithAttribution(canonicalUrl, {
    kind: "post",
    ref: publicIdentifier,
  });
  const canPublishCard =
    status === "authenticated" && user?.id === post.author.id;
  const selectedCount = selectedIds.size;
  const hasSelectableMoots =
    status === "authenticated" &&
    !mootsLoading &&
    !mootsError &&
    moots.length > 0;
  const filteredMoots = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (normalizedQuery === "") {
      return moots;
    }

    return moots.filter((moot) => {
      return (
        moot.displayName.toLowerCase().includes(normalizedQuery) ||
        moot.handle.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [moots, query]);

  useEffect(() => {
    if (!open) {
      return;
    }

    queueMicrotask(() => {
      setCopyState("idle");
      setShareMessage(undefined);
      setSentConversations([]);
    });
  }, [open]);

  useEffect(() => {
    if (!open || status !== "authenticated") {
      return;
    }

    let active = true;

    queueMicrotask(() => {
      if (!active) {
        return;
      }

      setMootsLoading(true);
      setMootsError(undefined);

      getChatMoots()
        .then((items) => {
          if (active) {
            setMoots(items);
          }
        })
        .catch((error) => {
          if (active) {
            setMootsError(
              error instanceof Error ? error.message : "Moots could not load.",
            );
          }
        })
        .finally(() => {
          if (active) {
            setMootsLoading(false);
          }
        });
    });

    return () => {
      active = false;
    };
  }, [open, status]);

  useEffect(() => {
    if (open) {
      return;
    }

    let active = true;

    queueMicrotask(() => {
      if (!active) {
        return;
      }

      setSelectedIds(new Set());
      setNote("");
      setQuery("");
    });

    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (status === "authenticated") {
      return;
    }

    let active = true;

    queueMicrotask(() => {
      if (active) {
        setMoots([]);
        setMootsLoading(false);
        setMootsError(undefined);
      }
    });

    return () => {
      active = false;
    };
  }, [status]);

  async function handleCopy() {
    try {
      void generatePostCard({ publish: canPublishCard, silent: true }).catch(
        () => undefined,
      );
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
      void generatePostCard({ publish: canPublishCard, silent: true }).catch(
        () => undefined,
      );
      await navigator.share({
        title: `${post.author.displayName} on thia.lol`,
        text: post.body,
        url: shareUrl,
      });
    } catch {
      // User cancellation is not an error worth surfacing.
    }
  }

  async function handleSaveImage() {
    try {
      const blob = await generatePostCard({ publish: canPublishCard });
      downloadBlob(blob, `thia-post-${publicIdentifier}.png`);
    } catch {
      setCardState("error");
    }
  }

  async function generatePostCard({
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
        `/share-render/post/${encodeURIComponent(publicIdentifier)}`,
      );

      if (publish) {
        const socialCardBlob = await captureShareCard(
          `/share-render/post/${encodeURIComponent(publicIdentifier)}`,
          { quality: 0.9, type: "image/jpeg" },
        );
        await runWithAuth(
          (freshCsrfToken) =>
            postShareCardCacheUpload(post, socialCardBlob, freshCsrfToken),
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

  function toggleMoot(id: number) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 10) {
        next.add(id);
      }

      return next;
    });
  }

  async function handleSend() {
    if (!csrfToken || selectedCount === 0 || sending) {
      return;
    }

    setSending(true);
    setShareMessage(undefined);
    setSentConversations([]);

    try {
      const trimmedNote = note.trim();
      const result = await runWithAuth(
        (freshCsrfToken) =>
          sharePostToMessages(
            publicIdentifier,
            trimmedNote === ""
              ? { recipientUserIds: Array.from(selectedIds) }
              : {
                  recipientUserIds: Array.from(selectedIds),
                  note: trimmedNote,
                },
            freshCsrfToken,
          ),
        { retryOnCsrf: true },
      );
      const conversations = result.results.flatMap((item) => {
        if (item.status !== "sent") {
          return [];
        }

        const recipient =
          item.recipient ??
          moots.find((moot) => moot.id === item.recipientUserId);

        return [
          {
            conversationId: item.conversationId,
            recipientLabel: recipient
              ? `${recipient.displayName} (@${recipient.handle})`
              : `recipient ${item.recipientUserId}`,
          },
        ];
      });

      setSentConversations(
        Array.from(
          new Map(
            conversations.map((conversation) => [
              conversation.conversationId,
              conversation,
            ]),
          ).values(),
        ),
      );
      setShareMessage(
        result.failedCount > 0
          ? `Sent to ${result.sentCount}. ${result.failedCount} could not be sent.`
          : `Sent to ${result.sentCount} ${result.sentCount === 1 ? "moot" : "moots"}.`,
      );
    } catch (error) {
      setShareMessage(
        error instanceof Error ? error.message : "Post could not be shared.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title="Share post"
      closeLabel="Close share dialog"
      testId="post-share-modal"
      size="lg"
      mobile="sheet"
      bodyClassName="space-y-5"
    >
      <div className="rounded-card border border-line bg-surface/70 p-3 shadow-inner-soft">
        <div className="flex items-start gap-3">
          <Avatar user={post.author} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-text">
                {post.author.displayName}
              </span>
              <span className="text-muted">@{post.author.handle}</span>
            </div>
            <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-6 text-text">
              {post.body}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          data-testid="post-share-copy-link"
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
            data-testid="post-share-native"
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
          data-testid="post-share-save-image"
          disabled={cardState === "generating"}
          icon={
            cardState === "generating" ? (
              <LoaderCircle
                aria-hidden="true"
                className="animate-spin"
                size={15}
              />
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
          Copy failed. The link is {shareUrl}
        </p>
      ) : null}
      {cardState === "error" ? (
        <p className="rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink">
          Image generation failed. You can still open the current cached card at{" "}
          <a
            className="underline"
            href={postShareCardUrl(post)}
            rel="noreferrer"
            target="_blank"
          >
            this link
          </a>
          .
        </p>
      ) : null}

      <section className="space-y-3" aria-label="Send to moots">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold text-text">Send to moots</h3>
          {hasSelectableMoots ? (
            <span className="text-xs font-medium text-muted">
              {selectedCount}/10 selected
            </span>
          ) : null}
        </div>

        {status !== "authenticated" ? (
          <CompactStateNotice
            icon={MessageCircle}
            title="Log in to send"
          />
        ) : (
          <>
            {mootsLoading ? (
              <CompactStateNotice
                icon={LoaderCircle}
                kind="loading"
                title="Loading moots"
              />
            ) : null}
            {mootsError ? (
              <CompactStateNotice
                icon={WifiOff}
                kind="error"
                title="Moots could not load"
                text={mootsError}
              />
            ) : null}
            {!mootsLoading && !mootsError && moots.length === 0 ? (
              <CompactStateNotice
                icon={MessageCircle}
                title="No moots yet"
                text="Mutual follows can receive shared posts in chat."
              />
            ) : null}
            {hasSelectableMoots ? (
              <>
                <label className="relative block">
                  <span className="sr-only">Search moots</span>
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                    size={15}
                  />
                  <input
                    className="min-h-10 w-full rounded-control border border-line bg-canvas/60 py-2 pl-9 pr-3 text-sm text-text outline-none transition duration-fluid placeholder:text-muted focus:border-line-strong focus:ring-2 focus:ring-focus/30"
                    data-testid="post-share-moot-search"
                    placeholder="Search moots"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>

                {filteredMoots.length > 0 ? (
                  <div
                    className="max-h-56 space-y-2 overflow-y-auto rounded-card border border-line bg-canvas/40 p-2"
                    data-testid="post-share-moot-list"
                  >
                    {filteredMoots.map((moot) => {
                      const selected = selectedIds.has(moot.id);

                      return (
                        <button
                          key={moot.id}
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-3 rounded-card border px-3 py-2 text-left transition duration-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                            selected
                              ? "border-accent bg-accent/15"
                              : "border-transparent hover:border-line hover:bg-surface",
                          )}
                          data-testid={`post-share-moot-${moot.id}`}
                          aria-pressed={selected}
                          onClick={() => toggleMoot(moot.id)}
                        >
                          <Avatar user={moot} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-text">
                              {moot.displayName}
                            </span>
                            <span className="block truncate text-xs text-muted">
                              @{moot.handle}
                            </span>
                          </span>
                          {selected ? (
                            <CheckCircle2
                              aria-hidden="true"
                              className="text-accent"
                              size={18}
                            />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">
                    Optional note
                  </span>
                  <textarea
                    className="min-h-20 w-full resize-none rounded-card border border-line bg-canvas/60 px-3 py-2 text-sm leading-6 text-text outline-none transition duration-fluid focus:border-line-strong focus:ring-2 focus:ring-focus/30"
                    data-testid="post-share-note"
                    maxLength={500}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </label>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted">{note.length}/500</p>
                  <Button
                    type="button"
                    size="sm"
                    data-testid="post-share-send-moots"
                    disabled={!csrfToken || selectedCount === 0 || sending}
                    icon={<Send aria-hidden="true" size={15} />}
                    onClick={() => void handleSend()}
                  >
                    {sending ? "Sending" : "Send"}
                  </Button>
                </div>
              </>
            ) : null}

            {shareMessage ? (
              <div className="rounded-card border border-line bg-surface/70 p-3 text-sm text-text">
                <p>{shareMessage}</p>
                {sentConversations.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sentConversations.map((conversation) => (
                      <Link
                        key={conversation.conversationId}
                        to={`/chat?conversation=${conversation.conversationId}`}
                        className="rounded-full border border-line bg-canvas px-2.5 py-1 text-xs font-medium text-text hover:border-line-strong"
                      >
                        {sentConversations.length > 1
                          ? `Open chat with ${conversation.recipientLabel}`
                          : "Open chat"}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </section>
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
