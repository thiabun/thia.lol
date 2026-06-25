import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ImagePlus, Music2, Radio, Send, Trash2, WifiOff } from "lucide-react";
import { Button } from "../ui/Button";
import { ImageCropModal } from "../ui/ImageCropModal";
import { ModalSheet, ModalSheetStatus } from "../ui/ModalSheet";
import { MarkdownEditor } from "./MarkdownEditor";
import {
  createPost,
  getProfileIntegrationSuggestions,
  previewImageUpload,
  resolveProfileIntegrationMetadata,
  startProfileIntegration,
  uploadAudio,
  uploadImage,
  uploadVideo,
} from "../../lib/api";
import type { CreatePostInput } from "../../lib/api";
import { prepareImageFileForCrop } from "../../lib/imageCrop";
import {
  imageUploadFormatHelp,
  isAcceptedImageUploadFile,
  isAcceptedVideoUploadFile,
  isLikelyVideoUploadFile,
  visualMediaUploadAccept,
  audioUploadFormatHelp,
  videoUploadFormatHelp,
  isAcceptedAudioUploadFile,
} from "../../lib/mediaFormats";
import {
  postMediaDraftFromAudio,
  postMediaDraftFromImage,
  postMediaDraftFromIntegration,
  postMediaDraftFromVideo,
  postMediaInputFromDraft,
  type PostMediaDraft,
} from "../../lib/postMedia";
import type { Post, Room } from "../../lib/types";
import type { PostMusicAttachmentProvider } from "./PostMusicAttachmentPicker";
import { PostMusicAttachmentPicker } from "./PostMusicAttachmentPicker";

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
  const [media, setMedia] = useState<PostMediaDraft[]>([]);
  const [musicPickerOpen, setMusicPickerOpen] = useState(false);
  const [pendingImageCrop, setPendingImageCrop] = useState<File | undefined>();
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const postableRooms = useMemo(() => rooms.filter((room) => room.viewerCanPost), [rooms]);
  const canSubmit =
    Boolean(csrfToken) && body.trim().length > 0 && !submitting && !uploadingMedia;
  const canAddMedia = media.length < maxPostComposerAttachments;
  const roomOptions = [
    { value: "", label: "Profile feed" },
    ...postableRooms.map((room) => ({
      value: room.slug,
      label: `/${room.slug}`,
    })),
  ];
  const effectiveRoomSlug = postableRooms.some((room) => room.slug === roomSlug)
    ? roomSlug
    : "";
  const selectedRoomOptionLabel =
    roomOptions.find((option) => option.value === effectiveRoomSlug)?.label ?? "Profile feed";

  const closeComposer = useCallback(() => {
    setBody("");
    setRoomSlug("");
    setMedia([]);
    setMusicPickerOpen(false);
    setPendingImageCrop(undefined);
    setUploadingMedia(false);
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

      if (effectiveRoomSlug) {
        input.roomSlug = effectiveRoomSlug;
      }

      Object.assign(input, postMediaInputFromDraft(media));

      const post = await createPost(input, csrfToken);

      onCreated?.(post);
      closeComposer();
    } catch {
      setMessage("Post could not be shared.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMediaChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    if (!csrfToken) {
      setMessage("Sign in again before uploading.");
      return;
    }

    if (!canAddMedia) {
      setMessage(`Posts can include up to ${maxPostComposerAttachments} attachments.`);
      return;
    }

    if (isLikelyVideoUploadFile(file)) {
      await uploadVideoMedia(file);
      return;
    }

    if (!isAcceptedImageUploadFile(file)) {
      setMessage(`${imageUploadFormatHelp} ${videoUploadFormatHelp}`);
      return;
    }

    setUploadingMedia(true);
    setMessage(undefined);

    try {
      const prepared = await prepareImageFileForCrop(file, "post_media", (sourceFile, purpose) =>
        previewImageUpload(sourceFile, purpose, csrfToken),
      );
      setPendingImageCrop(prepared);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Image could not be prepared.");
    } finally {
      setUploadingMedia(false);
    }
  }

  async function uploadVideoMedia(file: File) {
    if (!csrfToken) {
      setMessage("Sign in again before uploading.");
      return;
    }

    const validationError = validatePostVideoFile(file);

    if (validationError) {
      setMessage(validationError);
      return;
    }

    setUploadingMedia(true);
    setMessage(undefined);

    try {
      const uploaded = await uploadVideo(file, "post_media", csrfToken);
      appendMedia(postMediaDraftFromVideo(uploaded));
      setPendingImageCrop(undefined);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Video could not be uploaded.");
    } finally {
      setUploadingMedia(false);
    }
  }

  async function createAudioAttachmentDraft(file: File): Promise<PostMediaDraft> {
    if (!csrfToken) {
      setMessage("Sign in again before uploading.");
      throw new Error("Sign in again before uploading.");
    }

    const validationError = validatePostAudioFile(file);

    if (validationError) {
      setMessage(validationError);
      throw new Error(validationError);
    }

    setUploadingMedia(true);
    setMessage(undefined);

    try {
      const uploaded = await uploadAudio(file, "post_media", csrfToken);
      setPendingImageCrop(undefined);
      return postMediaDraftFromAudio(uploaded);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Audio could not be uploaded.");
      throw error;
    } finally {
      setUploadingMedia(false);
    }
  }

  async function resolveMusicAttachmentDraft(input: {
    provider?: PostMusicAttachmentProvider;
    url: string;
  }): Promise<PostMediaDraft> {
    if (!csrfToken) {
      setMessage("Sign in again before attaching music.");
      throw new Error("Sign in again before attaching music.");
    }

    const card = await resolveProfileIntegrationMetadata(input, csrfToken);

    return postMediaDraftFromIntegration(card);
  }

  async function connectMusicProvider(provider: PostMusicAttachmentProvider) {
    if (!csrfToken) {
      setMessage("Sign in again before connecting music.");
      throw new Error("Sign in again before connecting music.");
    }

    const redirectPath = `${window.location.pathname}${window.location.search}`;
    const result = await startProfileIntegration(provider, csrfToken, redirectPath);

    if (result.authorizationUrl) {
      window.location.assign(result.authorizationUrl);
    }
  }

  async function uploadCroppedImage(file: File) {
    if (!csrfToken) {
      setMessage("Sign in again before uploading.");
      throw new Error("Sign in again before uploading.");
    }

    setUploadingMedia(true);
    setMessage(undefined);

    try {
      const uploaded = await uploadImage(file, "post_media", csrfToken);
      appendMedia(postMediaDraftFromImage(uploaded));
      setMessage(undefined);
      setPendingImageCrop(undefined);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Image could not be uploaded.";
      setMessage(message);
      throw error;
    } finally {
      setUploadingMedia(false);
    }
  }

  function moveMediaAttachment(index: number, offset: -1 | 1) {
    setMedia((current) => movePostMediaDraft(current, index, index + offset));
  }

  function appendMedia(draft: PostMediaDraft) {
    setMedia((current) =>
      current.length >= maxPostComposerAttachments ? current : [...current, draft],
    );
  }

  function handleMusicAttachmentAdd(draft: PostMediaDraft) {
    appendMedia(draft);
    setMessage(undefined);
    setMusicPickerOpen(false);
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
        busy={submitting || uploadingMedia}
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
                value={effectiveRoomSlug}
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
              title={media.length > 0 ? "Add image or video" : "Upload image or video"}
            >
              <ImagePlus aria-hidden="true" size={18} />
              <span className="sr-only">
                {uploadingMedia
                  ? "Uploading media"
                  : media.length > 0
                    ? "Add image or video"
                    : "Upload image or video"}
              </span>
              <input
                className="sr-only"
                type="file"
                accept={visualMediaUploadAccept}
                disabled={submitting || uploadingMedia || !canAddMedia}
                onChange={handleMediaChange}
              />
            </label>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 rounded-full"
              disabled={submitting || uploadingMedia || !canAddMedia || !csrfToken}
              aria-label="Add music"
              title="Add music"
              onClick={() => setMusicPickerOpen((current) => !current)}
            >
              <Music2 aria-hidden="true" size={18} />
            </Button>

            {media.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 rounded-full"
                disabled={submitting || uploadingMedia}
                aria-label="Remove all media"
                title="Remove all media"
                onClick={() => setMedia([])}
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
        <MarkdownEditor
          ref={textareaRef}
          label="Post"
          className="pt-1"
          minHeightClassName="min-h-44 sm:min-h-52"
          placeholder="Write with Markdown, @mentions, and HTTPS links."
          renderedClassName="text-base leading-7 sm:text-lg sm:leading-8"
          testIdPrefix="post-composer-markdown"
          textareaTestId="post-composer-body"
          value={body}
          maxLength={2000}
          disabled={submitting}
          onValueChange={setBody}
        />

        <PostMusicAttachmentPicker
          attachmentCount={media.length}
          disabled={submitting || uploadingMedia || !csrfToken}
          limitMessage={`Posts can include up to ${maxPostComposerAttachments} attachments.`}
          loadSuggestions={getProfileIntegrationSuggestions}
          maxAttachments={maxPostComposerAttachments}
          onAddAttachment={handleMusicAttachmentAdd}
          onClose={() => setMusicPickerOpen(false)}
          onConnectProvider={connectMusicProvider}
          onResolveMusicUrl={resolveMusicAttachmentDraft}
          onUploadAudio={createAudioAttachmentDraft}
          open={musicPickerOpen}
        />

        {media.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2" data-testid="composer-attachments">
            {media.map((item, index) => (
              <PostComposerAttachmentPreview
                key={`${postMediaDraftKey(item)}-${index}`}
                attachment={item}
                index={index}
                disabled={submitting || uploadingMedia}
                canMoveDown={index < media.length - 1}
                canMoveUp={index > 0}
                onMoveDown={() => moveMediaAttachment(index, 1)}
                onMoveUp={() => moveMediaAttachment(index, -1)}
                onRemove={() => setMedia((current) => current.filter((_, itemIndex) => itemIndex !== index))}
              />
            ))}
          </div>
        ) : null}

        {message ? <ModalSheetStatus tone="error">{message}</ModalSheetStatus> : null}
        </form>
      </ModalSheet>
      <ImageCropModal
        open={Boolean(pendingImageCrop)}
        file={pendingImageCrop}
        purpose="post_media"
        busy={uploadingMedia}
        onClose={() => setPendingImageCrop(undefined)}
        onApply={uploadCroppedImage}
      />
    </>
  );
}

const maxPostComposerAttachments = 8;

type PostComposerAttachmentPreviewProps = {
  attachment: PostMediaDraft;
  canMoveDown: boolean;
  canMoveUp: boolean;
  disabled: boolean;
  index: number;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onRemove: () => void;
};

function PostComposerAttachmentPreview({
  attachment,
  canMoveDown,
  canMoveUp,
  disabled,
  index,
  onMoveDown,
  onMoveUp,
  onRemove,
}: PostComposerAttachmentPreviewProps) {
  return (
    <div className="relative overflow-hidden rounded-card border border-line bg-canvas/55" data-testid="composer-attachment">
      {attachment.type === "integration" ? (
        <PostComposerIntegrationPreview attachment={attachment} />
      ) : attachment.type === "video" ? (
        <video
          className="mx-auto max-h-64 max-w-full bg-black object-contain"
          controls
          playsInline
          poster={attachment.posterUrl ?? undefined}
          preload="metadata"
        >
          <source src={attachment.url} type={attachment.mime} />
        </video>
      ) : attachment.type === "audio" ? (
        <div className="grid min-h-24 gap-2 p-3">
          <p className="truncate text-sm font-semibold text-text">MP3 attachment {index + 1}</p>
          <audio className="w-full" controls preload="metadata">
            <source src={attachment.url} type={attachment.mime} />
          </audio>
        </div>
      ) : (
        <img
          alt=""
          className="mx-auto max-h-64 max-w-full object-contain"
          src={attachment.url}
        />
      )}
      <div className="absolute right-2 top-2 flex gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-full border border-line bg-surface/90"
          disabled={disabled || !canMoveUp}
          aria-label={`Move attachment ${index + 1} earlier`}
          title="Move earlier"
          onClick={onMoveUp}
        >
          <ArrowUp aria-hidden="true" size={14} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-full border border-line bg-surface/90"
          disabled={disabled || !canMoveDown}
          aria-label={`Move attachment ${index + 1} later`}
          title="Move later"
          onClick={onMoveDown}
        >
          <ArrowDown aria-hidden="true" size={14} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-full border border-line bg-surface/90"
          disabled={disabled}
          aria-label={`Remove attachment ${index + 1}`}
          title="Remove attachment"
          onClick={onRemove}
        >
          <Trash2 aria-hidden="true" size={15} />
        </Button>
      </div>
    </div>
  );
}

function PostComposerIntegrationPreview({
  attachment,
}: {
  attachment: Extract<PostMediaDraft, { type: "integration" }>;
}) {
  const title = attachment.card.metadata.title ?? providerLabel(attachment.provider);
  const subtitle = attachment.card.metadata.subtitle ?? providerLabel(attachment.provider);
  const imageUrl = attachment.card.metadata.imageUrl;

  return (
    <div className="grid min-h-28 grid-cols-[4rem_1fr] gap-3 p-3 pr-28">
      <span className="grid size-16 overflow-hidden rounded-card border border-line bg-surface">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="grid place-items-center text-muted">
            <WifiOff aria-hidden="true" size={18} />
          </span>
        )}
      </span>
      <span className="min-w-0 self-center">
        <span className="block truncate text-sm font-semibold text-text">{title}</span>
        <span className="mt-1 block truncate text-xs text-muted">{subtitle}</span>
      </span>
    </div>
  );
}

function movePostMediaDraft(
  attachments: PostMediaDraft[],
  fromIndex: number,
  toIndex: number,
): PostMediaDraft[] {
  if (toIndex < 0 || toIndex >= attachments.length || fromIndex === toIndex) {
    return attachments;
  }

  const next = [...attachments];
  const [item] = next.splice(fromIndex, 1);

  if (item === undefined) {
    return attachments;
  }

  next.splice(toIndex, 0, item);

  return next;
}

function postMediaDraftKey(attachment: PostMediaDraft): string {
  return attachment.type === "integration"
    ? attachment.resourceKey
    : attachment.url;
}

function providerLabel(provider: "spotify" | "youtube"): string {
  return provider === "spotify" ? "Spotify" : "YouTube";
}

function validatePostVideoFile(file: File): string | undefined {
  if (file.size <= 0) {
    return "Video cannot be empty.";
  }

  if (file.size > 100 * 1024 * 1024) {
    return "Video must be 100 MB or smaller.";
  }

  if (!isAcceptedVideoUploadFile(file)) {
    return videoUploadFormatHelp;
  }

  return undefined;
}

function validatePostAudioFile(file: File): string | undefined {
  if (file.size <= 0) {
    return "Audio cannot be empty.";
  }

  if (file.size > 20 * 1024 * 1024) {
    return "Audio must be 20 MB or smaller.";
  }

  if (!isAcceptedAudioUploadFile(file)) {
    return audioUploadFormatHelp;
  }

  return undefined;
}
