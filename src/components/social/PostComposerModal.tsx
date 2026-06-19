import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useId, useRef, useState } from "react";
import { ChevronDown, ImagePlus, Radio, Send, Trash2 } from "lucide-react";
import { Button } from "../ui/Button";
import { ImageCropModal } from "../ui/ImageCropModal";
import { ModalSheet, ModalSheetStatus } from "../ui/ModalSheet";
import { MentionTextarea } from "./MentionTextarea";
import { createPost, uploadImage } from "../../lib/api";
import type { CreatePostInput } from "../../lib/api";
import { validateImageCropFile } from "../../lib/imageCrop";
import type { Post, Room } from "../../lib/types";

type PostComposerModalProps = {
  csrfToken: string | undefined;
  initialRoomSlug?: string | undefined;
  onClose: () => void;
  onCreated?: (post: Post) => void;
  open: boolean;
  rooms: Room[];
};

export function PostComposerModal({
  csrfToken,
  initialRoomSlug,
  onClose,
  onCreated,
  open,
  rooms,
}: PostComposerModalProps) {
  const formId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState("");
  const [roomSlug, setRoomSlug] = useState(initialRoomSlug ?? "");
  const [mediaUrl, setMediaUrl] = useState<string | undefined>();
  const [pendingImageCrop, setPendingImageCrop] = useState<File | undefined>();
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const selectedRoom = rooms.find((room) => room.slug === roomSlug);
  const canSubmit =
    Boolean(csrfToken) && body.trim().length > 0 && !submitting && !uploadingImage;
  const roomOptions = [
    { value: "", label: "Profile feed" },
    ...(roomSlug && !selectedRoom
      ? [{ value: roomSlug, label: `/${roomSlug}` }]
      : []),
    ...rooms.map((room) => ({
      value: room.slug,
      label: `/${room.slug}`,
    })),
  ];
  const selectedRoomOptionLabel =
    roomOptions.find((option) => option.value === roomSlug)?.label ?? "Profile feed";

  const closeComposer = useCallback(() => {
    setBody("");
    setRoomSlug("");
    setMediaUrl(undefined);
    setPendingImageCrop(undefined);
    setUploadingImage(false);
    setMessage(undefined);
    setSubmitting(false);
    onClose();
  }, [onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!csrfToken) {
      setMessage("Sign in again before posting.");
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
      setMessage("Post could not be shared.");
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
      setMessage("Sign in again before uploading.");
      return;
    }

    const validationError = validateImageCropFile(file);

    if (validationError) {
      setMessage(validationError);
      return;
    }

    setMessage(undefined);
    setPendingImageCrop(file);
  }

  async function uploadCroppedImage(file: File) {
    if (!csrfToken) {
      setMessage("Sign in again before uploading.");
      throw new Error("Sign in again before uploading.");
    }

    setUploadingImage(true);
    setMessage(undefined);

    try {
      const uploaded = await uploadImage(file, "post_media", csrfToken);
      setMediaUrl(uploaded.url);
      setMessage(undefined);
      setPendingImageCrop(undefined);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Image could not be uploaded.";
      setMessage(message);
      throw error;
    } finally {
      setUploadingImage(false);
    }
  }

  return (
    <>
      <ModalSheet
        open={open}
        onClose={closeComposer}
        title="New post"
        closeLabel="Close post composer"
        testId="composer-modal"
        size="md"
        mobile="full"
        busy={submitting || uploadingImage}
        initialFocusRef={textareaRef}
        bodyClassName="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4"
        footerClassName="shrink-0 border-t border-line bg-surface px-4 py-3 sm:px-5"
        footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <label
              className="group relative inline-flex min-h-9 max-w-[13rem] cursor-pointer items-center gap-2 overflow-hidden rounded-full border border-line bg-canvas/70 px-3 pr-8 text-sm font-medium text-text shadow-inner-soft transition duration-fluid hover:border-line-strong hover:bg-surface focus-within:border-line-strong"
              data-testid="composer-destination-control"
              title="Post destination"
            >
              <Radio
                aria-hidden="true"
                className="shrink-0 text-muted transition duration-fluid group-hover:text-text"
                size={15}
                strokeWidth={2.2}
              />
              <span className="sr-only">Post to</span>
              <span aria-hidden="true" className="min-w-0 truncate">
                {selectedRoomOptionLabel}
              </span>
              <select
                id="post-composer-room"
                name="roomSlug"
                aria-label="Post to"
                data-testid="composer-room-selector"
                className="absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none opacity-0 outline-none disabled:cursor-not-allowed"
                value={roomSlug}
                disabled={submitting}
                onChange={(event) => {
                  setRoomSlug(event.currentTarget.value);
                  event.currentTarget.blur();
                }}
              >
                {roomOptions.map((option) => (
                  <option key={option.value || "profile"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute right-3 text-muted transition duration-fluid group-hover:text-text"
                size={15}
              />
            </label>

            <label
              className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-muted transition duration-fluid hover:bg-surface-strong hover:text-text focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus has-[:disabled]:pointer-events-none has-[:disabled]:opacity-50"
              title={mediaUrl ? "Replace image" : "Upload image"}
            >
              <ImagePlus aria-hidden="true" size={18} />
              <span className="sr-only">
                {uploadingImage
                  ? "Uploading image"
                  : mediaUrl
                    ? "Replace image"
                    : "Upload image"}
              </span>
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={submitting || uploadingImage}
                onChange={handleImageChange}
              />
            </label>

            {mediaUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 rounded-full"
                disabled={submitting || uploadingImage}
                aria-label="Remove image"
                title="Remove image"
                onClick={() => setMediaUrl(undefined)}
              >
                <Trash2 aria-hidden="true" size={17} />
              </Button>
            ) : null}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted" aria-live="polite">
              {body.length}/2000
            </span>
            <Button
              type="submit"
              form={formId}
              size="sm"
              disabled={!canSubmit}
              icon={<Send aria-hidden="true" size={16} />}
            >
              {submitting ? "Posting..." : "Post"}
            </Button>
          </div>
        </div>
        }
      >
        <form id={formId} className="space-y-3" onSubmit={handleSubmit}>
        <label htmlFor="post-composer-body" className="sr-only">
          Post
        </label>
        <MentionTextarea
          ref={textareaRef}
          id="post-composer-body"
          name="body"
          className="min-h-44 w-full resize-none bg-transparent text-base leading-7 text-text outline-none placeholder:text-muted/75 disabled:opacity-60 sm:min-h-52 sm:text-lg"
          placeholder="Write a post"
          value={body}
          maxLength={2000}
          disabled={submitting}
          required
          onValueChange={setBody}
        />

        {mediaUrl ? (
          <div className="overflow-hidden rounded-card border border-line bg-canvas/55">
            <img
              alt=""
              className="mx-auto max-h-64 max-w-full object-contain"
              src={mediaUrl}
            />
          </div>
        ) : null}

        {message ? <ModalSheetStatus tone="error">{message}</ModalSheetStatus> : null}
        </form>
      </ModalSheet>
      <ImageCropModal
        open={Boolean(pendingImageCrop)}
        file={pendingImageCrop}
        purpose="post_media"
        busy={uploadingImage}
        onClose={() => setPendingImageCrop(undefined)}
        onApply={uploadCroppedImage}
      />
    </>
  );
}
