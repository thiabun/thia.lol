import { AnimatePresence, motion } from "motion/react";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Radio, Send, Trash2, UserRound, X } from "lucide-react";
import { Button } from "../ui/Button";
import { SelectField, TextareaField } from "../ui/Field";
import { createPost, uploadImage } from "../../lib/api";
import { modalOverlay, modalPanel } from "../../lib/motionPresets";
import type { CreatePostInput } from "../../lib/api";
import type { Post, Room } from "../../lib/types";

type PostComposerModalProps = {
  csrfToken: string | undefined;
  initialRoomSlug?: string | undefined;
  onClose: () => void;
  onCreated?: (post: Post) => void;
  open: boolean;
  rooms: Room[];
};

const maxUploadBytes = 10 * 1024 * 1024;
const acceptedImageTypes = ["image/jpeg", "image/png", "image/webp"];

export function PostComposerModal({
  csrfToken,
  initialRoomSlug,
  onClose,
  onCreated,
  open,
  rooms,
}: PostComposerModalProps) {
  const titleId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState("");
  const [roomSlug, setRoomSlug] = useState(initialRoomSlug ?? "");
  const [mediaUrl, setMediaUrl] = useState<string | undefined>();
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const selectedRoom = rooms.find((room) => room.slug === roomSlug);
  const canSubmit =
    Boolean(csrfToken) && body.trim().length > 0 && !submitting && !uploadingImage;
  const destinationLabel = selectedRoom
    ? `/${selectedRoom.slug}`
    : roomSlug
      ? `/${roomSlug}`
      : "Profile feed";
  const destinationSummary = selectedRoom
    ? `${selectedRoom.name}${selectedRoom.summary ? ` · ${selectedRoom.summary}` : ""}`
    : roomSlug
      ? "Room selected."
    : "Post to your profile.";
  const roomOptions = [
    { value: "", label: "Profile feed" },
    ...(roomSlug && !selectedRoom
      ? [{ value: roomSlug, label: `/${roomSlug}` }]
      : []),
    ...rooms.map((room) => ({
      value: room.slug,
      label: `/${room.slug} - ${room.name}`,
    })),
  ];

  const closeComposer = useCallback(() => {
    setBody("");
    setRoomSlug("");
    setMediaUrl(undefined);
    setUploadingImage(false);
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

      if (roomSlug) {
        input.roomSlug = roomSlug;
      }

      if (mediaUrl) {
        input.mediaUrl = mediaUrl;
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

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    if (!csrfToken) {
      setMessage("Please log in again before uploading.");
      return;
    }

    if (file.size > maxUploadBytes) {
      setMessage("Image must be 10 MB or smaller");
      return;
    }

    if (!acceptedImageTypes.includes(file.type)) {
      setMessage("Unsupported image type. Use JPEG, PNG, or WebP.");
      return;
    }

    setUploadingImage(true);
    setMessage(undefined);

    try {
      const uploaded = await uploadImage(file, "post_media", csrfToken);
      setMediaUrl(uploaded.url);
      setMessage("Images are converted to WebP");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Image could not be uploaded.");
    } finally {
      setUploadingImage(false);
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-text/28 px-4 py-6 backdrop-blur-veil"
          variants={modalOverlay}
          initial="hidden"
          animate="show"
          exit="exit"
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
            data-testid="composer-modal"
            className="max-h-[calc(100dvh-3rem)] w-full max-w-xl overflow-y-auto rounded-panel border border-line bg-surface p-4 shadow-lift sm:p-5"
            variants={modalPanel}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id={titleId} className="text-lg font-semibold text-text">
                  New post
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Pick where this post belongs.
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
              <div className="space-y-3">
                <SelectField
                  id="post-composer-room"
                  name="roomSlug"
                  label="Post to"
                  icon={Radio}
                  data-testid="composer-room-selector"
                  options={roomOptions}
                  value={roomSlug}
                  disabled={submitting}
                  onChange={(event) => setRoomSlug(event.currentTarget.value)}
                />

                <div className="flex items-start gap-3 rounded-card border border-line bg-canvas/55 p-3 shadow-inner-soft">
                  <div className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-strong text-accent-strong">
                    {selectedRoom ? (
                      <Radio aria-hidden="true" size={16} />
                    ) : (
                      <UserRound aria-hidden="true" size={16} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase text-muted">
                      Post to
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-text">
                      {destinationLabel}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">
                      {destinationSummary}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-card border border-line bg-canvas/55 p-3 shadow-inner-soft">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-medium text-text">
                      <ImagePlus aria-hidden="true" size={16} />
                      Upload image
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted">
                      Image must be 10 MB or smaller. Images are converted to WebP.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {mediaUrl ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={submitting || uploadingImage}
                        icon={<Trash2 aria-hidden="true" size={16} />}
                        onClick={() => setMediaUrl(undefined)}
                      >
                        Remove
                      </Button>
                    ) : null}
                    <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-control border border-line bg-surface px-3 text-sm font-medium text-text shadow-soft transition duration-fluid hover:border-line-strong focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
                      <ImagePlus aria-hidden="true" size={16} />
                      {uploadingImage
                        ? "Uploading"
                        : mediaUrl
                          ? "Replace image"
                          : "Upload image"}
                      <input
                        className="sr-only"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={submitting || uploadingImage}
                        onChange={handleImageChange}
                      />
                    </label>
                  </div>
                </div>
                {mediaUrl ? (
                  <img
                    alt=""
                    className="mt-3 max-h-72 w-full rounded-card object-cover"
                    src={mediaUrl}
                  />
                ) : null}
              </div>

              <TextareaField
                ref={textareaRef}
                id="post-composer-body"
                name="body"
                label="Post"
                className="min-h-32 bg-canvas/55 sm:min-h-36"
                placeholder="Write something"
                value={body}
                maxLength={2000}
                disabled={submitting}
                required
                onChange={(event) => setBody(event.currentTarget.value)}
              />

              {message ? (
                <p className="rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink">
                  {message}
                </p>
              ) : null}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-muted" aria-live="polite">
                  {body.length}/2000
                </span>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1 sm:flex-none"
                    disabled={submitting}
                    onClick={closeComposer}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 sm:flex-none"
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
