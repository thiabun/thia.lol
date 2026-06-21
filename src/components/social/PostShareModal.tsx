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
  postCanonicalPath,
  postCanonicalUrl,
  postPublicIdentifier,
  postShareCardUrl,
  sharePostToMessages,
} from "../../lib/api";
import { cn } from "../../lib/classNames";
import type { ChatMoot, Post } from "../../lib/types";
import { useAuth } from "../../lib/useAuth";

type PostShareModalProps = {
  open: boolean;
  post: Post;
  onClose: () => void;
};

export function PostShareModal({ open, post, onClose }: PostShareModalProps) {
  const { csrfToken, runWithAuth, status } = useAuth();
  const [moots, setMoots] = useState<ChatMoot[]>([]);
  const [mootsLoading, setMootsLoading] = useState(false);
  const [mootsError, setMootsError] = useState<string>();
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [shareMessage, setShareMessage] = useState<string>();
  const [sentConversationIds, setSentConversationIds] = useState<number[]>([]);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [nativeShareAvailable] = useState(
    () => typeof navigator !== "undefined" && "share" in navigator,
  );
  const canonicalPath = postCanonicalPath(post);
  const canonicalUrl = postCanonicalUrl(post);
  const publicIdentifier = postPublicIdentifier(post);
  const selectedCount = selectedIds.size;
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
      setSentConversationIds([]);
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
      await navigator.share({
        title: `${post.author.displayName} on thia.lol`,
        text: post.body,
        url: canonicalUrl,
      });
    } catch {
      // User cancellation is not an error worth surfacing.
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
    setSentConversationIds([]);

    try {
      const trimmedNote = note.trim();
      const result = await runWithAuth(
        (freshCsrfToken) =>
          sharePostToMessages(
            publicIdentifier,
            trimmedNote === ""
              ? { recipientUserIds: Array.from(selectedIds) }
              : { recipientUserIds: Array.from(selectedIds), note: trimmedNote },
            freshCsrfToken,
          ),
        { retryOnCsrf: true },
      );
      const sentIds = result.results
        .filter((item) => item.status === "sent")
        .map((item) => item.conversationId);

      setSentConversationIds(Array.from(new Set(sentIds)));
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
      description={`Share @${post.author.handle}'s post.`}
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
              <span className="font-semibold text-text">{post.author.displayName}</span>
              <span className="text-muted">@{post.author.handle}</span>
            </div>
            <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-6 text-text">
              {post.body}
            </p>
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
        <a
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-control border border-line bg-surface px-3 text-sm font-medium text-text shadow-soft transition duration-fluid hover:-translate-y-0.5 hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:hover:translate-y-0"
          data-testid="post-share-save-image"
          href={postShareCardUrl(post)}
          download={`thia-post-${publicIdentifier}.png`}
        >
          <Download aria-hidden="true" size={15} />
          Save image
        </a>
      </div>

      {copyState === "error" ? (
        <p className="rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink">
          Copy failed. The link is {canonicalUrl}
        </p>
      ) : null}

      <section className="space-y-3" aria-label="Send to moots">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text">Send to moots</h3>
            <p className="text-xs text-muted">Choose up to 10 mutuals.</p>
          </div>
          <span className="text-xs font-medium text-muted">{selectedCount}/10 selected</span>
        </div>

        {status !== "authenticated" ? (
          <CompactStateNotice
            icon={MessageCircle}
            title="Log in to send"
            text="You can still copy the public link or save the share card."
          />
        ) : (
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

            {mootsLoading ? (
              <CompactStateNotice
                icon={LoaderCircle}
                kind="loading"
                title="Loading moots"
                text="Finding people you can message."
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
            {!mootsLoading && !mootsError && filteredMoots.length > 0 ? (
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
                        <CheckCircle2 aria-hidden="true" className="text-accent" size={18} />
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
                className="min-h-20 w-full resize-none rounded-card border border-line bg-canvas/60 px-3 py-2 text-sm leading-6 text-text outline-none transition duration-fluid placeholder:text-muted focus:border-line-strong focus:ring-2 focus:ring-focus/30"
                data-testid="post-share-note"
                maxLength={500}
                placeholder="Add a note"
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

            {shareMessage ? (
              <div className="rounded-card border border-line bg-surface/70 p-3 text-sm text-text">
                <p>{shareMessage}</p>
                {sentConversationIds.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sentConversationIds.map((conversationId) => (
                      <Link
                        key={conversationId}
                        to={`/chat?conversation=${conversationId}`}
                        className="rounded-full border border-line bg-canvas px-2.5 py-1 text-xs font-medium text-text hover:border-line-strong"
                      >
                        Open chat
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
