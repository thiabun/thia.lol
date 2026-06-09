import { AnimatePresence, motion } from "motion/react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Radio, Send, X } from "lucide-react";
import { Button } from "../ui/Button";
import { SelectField, TextareaField } from "../ui/Field";
import { createPost } from "../../lib/api";
import type { CreatePostInput } from "../../lib/api";
import type { Post, Room } from "../../lib/types";

type PostComposerModalProps = {
  csrfToken: string | undefined;
  onClose: () => void;
  onCreated?: (post: Post) => void;
  open: boolean;
  rooms: Room[];
};

export function PostComposerModal({
  csrfToken,
  onClose,
  onCreated,
  open,
  rooms,
}: PostComposerModalProps) {
  const titleId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState("");
  const [roomSlug, setRoomSlug] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const selectedRoomSlug = roomSlug || rooms[0]?.slug || "";
  const canSubmit = Boolean(csrfToken) && body.trim().length > 0 && !submitting;

  const closeComposer = useCallback(() => {
    setBody("");
    setRoomSlug("");
    setMessage(undefined);
    setSubmitting(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => textareaRef.current?.focus(), 80);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeComposer();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeComposer, open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!csrfToken) {
      setMessage("Please log in again before posting.");
      return;
    }

    setSubmitting(true);
    setMessage(undefined);

    try {
      const input: CreatePostInput = { body: body.trim() };

      if (selectedRoomSlug) {
        input.roomSlug = selectedRoomSlug;
      }

      const post = await createPost(input, csrfToken);

      onCreated?.(post);
      closeComposer();
    } catch {
      setMessage("Post could not be shared right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-text/28 px-4 py-6 backdrop-blur-veil"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeComposer();
            }
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-xl rounded-panel border border-line bg-surface p-4 shadow-lift sm:p-5"
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id={titleId} className="text-lg font-semibold text-text">
                  New post
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Share something with the room.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close post composer"
                title="Close"
                icon={<X aria-hidden="true" size={18} />}
                onClick={closeComposer}
              />
            </div>

            <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
              <TextareaField
                ref={textareaRef}
                id="post-composer-body"
                name="body"
                label="Post"
                hideLabel
                className="min-h-36 bg-canvas/55"
                placeholder="What do you want to share?"
                value={body}
                maxLength={2000}
                disabled={submitting}
                required
                onChange={(event) => setBody(event.currentTarget.value)}
              />

              {rooms.length > 0 ? (
                <SelectField
                  id="post-composer-room"
                  name="roomSlug"
                  label="Room"
                  icon={Radio}
                  options={rooms.map((room) => ({
                    value: room.slug,
                    label: room.name,
                  }))}
                  value={selectedRoomSlug}
                  disabled={submitting}
                  onChange={(event) => setRoomSlug(event.currentTarget.value)}
                />
              ) : null}

              {message ? (
                <p className="rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink">
                  {message}
                </p>
              ) : null}

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted">{body.length}/2000</span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={submitting}
                    onClick={closeComposer}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!canSubmit}
                    icon={<Send aria-hidden="true" size={17} />}
                  >
                    {submitting ? "Posting..." : "Post"}
                  </Button>
                </div>
              </div>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
