import type { ChangeEvent, FormEvent } from "react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ImagePlay,
  ImagePlus,
  Music2,
  Radio,
  Send,
  Trash2,
  WifiOff,
} from "lucide-react";
import { cn } from "../../lib/classNames";
import {
  createPost,
  createPostReply,
  getProfileIntegrationSuggestions,
  previewImageUpload,
  resolveProfileIntegrationMetadata,
  startProfileIntegration,
  uploadAudio,
  uploadImage,
  uploadVideo,
  type CreatePostInput,
} from "../../lib/api";
import { prepareImageFileForCrop } from "../../lib/imageCrop";
import {
  audioUploadFormatHelp,
  imageUploadFormatHelp,
  isAcceptedAudioUploadFile,
  isAcceptedImageUploadFile,
  isAcceptedVideoUploadFile,
  isLikelyVideoUploadFile,
  videoUploadFormatHelp,
  visualMediaUploadAccept,
} from "../../lib/mediaFormats";
import {
  postMediaDraftFromAudio,
  postMediaDraftFromGif,
  postMediaDraftFromImage,
  postMediaDraftFromIntegration,
  postMediaDraftFromVideo,
  postMediaInputFromDraft,
  type PostMediaDraft,
} from "../../lib/postMedia";
import type { GifSearchResult, Post, Room } from "../../lib/types";
import { useAuth } from "../../lib/useAuth";
import { Button } from "../ui/Button";
import { ImageCropModal } from "../ui/ImageCropModal";
import { ModalSheetStatus } from "../ui/ModalSheet";
import { GifPicker } from "./GifPicker";
import { MarkdownEditor } from "./MarkdownEditor";
import {
  PostMusicAttachmentPicker,
  type PostMusicAttachmentProvider,
} from "./PostMusicAttachmentPicker";

export type UnifiedComposerProps = {
  autoFocus?: boolean;
  className?: string;
  initialRoomSlug?: string | undefined;
  mode: "post" | "reply";
  onBusyChange?: (busy: boolean) => void;
  onCancel?: (() => void) | undefined;
  onCreated: (post: Post) => void;
  parentPostId?: number | undefined;
  rooms?: Room[];
};

type ComposerMessage = {
  text: string;
  tone: "error" | "success";
};

const maxPostComposerAttachments = 8;

export function UnifiedComposer({
  autoFocus = false,
  className,
  initialRoomSlug,
  mode,
  onBusyChange,
  onCancel,
  onCreated,
  parentPostId,
  rooms = [],
}: UnifiedComposerProps) {
  const formId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { csrfToken, runWithAuth, status, user } = useAuth();
  const [body, setBody] = useState("");
  const [roomSlug, setRoomSlug] = useState(initialRoomSlug ?? "");
  const [media, setMedia] = useState<PostMediaDraft[]>([]);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [musicPickerOpen, setMusicPickerOpen] = useState(false);
  const [pendingImageCrop, setPendingImageCrop] = useState<File | undefined>();
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<ComposerMessage | undefined>();
  const isReply = mode === "reply";
  const noun = isReply ? "Reply" : "Post";
  const nounPlural = isReply ? "Replies" : "Posts";
  const trimmedBody = body.trim();
  const postableRooms = useMemo(
    () => rooms.filter((room) => room.viewerCanPost),
    [rooms],
  );
  const roomOptions = useMemo(
    () => [
      { value: "", label: "Profile feed" },
      ...postableRooms.map((room) => ({
        value: room.slug,
        label: `/${room.slug}`,
      })),
    ],
    [postableRooms],
  );
  const effectiveRoomSlug = postableRooms.some((room) => room.slug === roomSlug)
    ? roomSlug
    : "";
  const selectedRoomOptionLabel =
    roomOptions.find((option) => option.value === effectiveRoomSlug)?.label ??
    "Profile feed";
  const busy = submitting || uploadingMedia;
  const canAddMedia = media.length < maxPostComposerAttachments;
  const canSubmit =
    status === "authenticated" &&
    Boolean(csrfToken) &&
    trimmedBody.length > 0 &&
    trimmedBody.length <= 2000 &&
    (!isReply || parentPostId !== undefined) &&
    !busy;

  useEffect(() => {
    if (!autoFocus) {
      return;
    }

    const timer = window.setTimeout(() => textareaRef.current?.focus(), 60);

    return () => window.clearTimeout(timer);
  }, [autoFocus]);

  useEffect(() => {
    onBusyChange?.(busy);

    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);

  const loadMusicSuggestions = useCallback(
    (provider: PostMusicAttachmentProvider) =>
      getProfileIntegrationSuggestions(provider),
    [],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (status !== "authenticated" || !csrfToken) {
      setError(`Log in to ${isReply ? "reply" : "post"}.`);
      return;
    }

    if (!trimmedBody) {
      setError(`${noun} cannot be empty.`);
      return;
    }

    if (trimmedBody.length > 2000) {
      setError(`${noun} must be 2000 characters or fewer.`);
      return;
    }

    if (isReply && parentPostId === undefined) {
      setError("This thread is not available for replies.");
      return;
    }

    setSubmitting(true);
    setMessage(undefined);

    try {
      const mediaInput = postMediaInputFromDraft(media);
      const created = await runWithAuth(
        (freshCsrfToken) => {
          if (isReply) {
            return createPostReply(
              parentPostId as number,
              { body: trimmedBody, ...mediaInput },
              freshCsrfToken,
            );
          }

          const input: CreatePostInput = { body: trimmedBody, ...mediaInput };

          if (effectiveRoomSlug) {
            input.roomSlug = effectiveRoomSlug;
          }

          return createPost(input, freshCsrfToken);
        },
        { retryOnCsrf: true },
      );

      setBody("");
      setMedia([]);
      setGifPickerOpen(false);
      setMusicPickerOpen(false);
      setPendingImageCrop(undefined);
      setMessage(undefined);
      onCreated(created);
    } catch (error) {
      setErrorFrom(error, `${noun} could not be ${isReply ? "sent" : "shared"}.`);
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
      setError("Log in to upload media.");
      return;
    }

    if (!canAddMedia) {
      setAttachmentLimitError();
      return;
    }

    if (isLikelyVideoUploadFile(file)) {
      await uploadVideoMedia(file);
      return;
    }

    if (!isAcceptedImageUploadFile(file)) {
      setError(`${imageUploadFormatHelp} ${videoUploadFormatHelp}`);
      return;
    }

    setUploadingMedia(true);
    setMessage(undefined);

    try {
      const prepared = await runWithAuth(
        (freshCsrfToken) =>
          prepareImageFileForCrop(file, "post_media", (sourceFile, purpose) =>
            previewImageUpload(sourceFile, purpose, freshCsrfToken),
          ),
        { retryOnCsrf: true },
      );
      setPendingImageCrop(prepared);
    } catch (error) {
      setErrorFrom(error, "Image could not be prepared.");
    } finally {
      setUploadingMedia(false);
    }
  }

  async function uploadVideoMedia(file: File) {
    const validationError = validatePostVideoFile(file);

    if (validationError) {
      setError(validationError);
      return;
    }

    setUploadingMedia(true);
    setMessage(undefined);

    try {
      const uploaded = await runWithAuth(
        (freshCsrfToken) => uploadVideo(file, "post_media", freshCsrfToken),
        { retryOnCsrf: true },
      );
      appendMedia(postMediaDraftFromVideo(uploaded));
      setPendingImageCrop(undefined);
      setSuccess("Video attached.");
    } catch (error) {
      setErrorFrom(error, "Video could not be uploaded.");
    } finally {
      setUploadingMedia(false);
    }
  }

  async function createAudioAttachmentDraft(file: File): Promise<PostMediaDraft> {
    const validationError = validatePostAudioFile(file);

    if (validationError) {
      setError(validationError);
      throw new Error(validationError);
    }

    setUploadingMedia(true);
    setMessage(undefined);

    try {
      const uploaded = await runWithAuth(
        (freshCsrfToken) => uploadAudio(file, "post_media", freshCsrfToken),
        { retryOnCsrf: true },
      );
      setPendingImageCrop(undefined);
      return postMediaDraftFromAudio(uploaded);
    } catch (error) {
      setErrorFrom(error, "Audio could not be uploaded.");
      throw error;
    } finally {
      setUploadingMedia(false);
    }
  }

  const resolveMusicAttachmentDraft = useCallback(
    async (input: {
      provider?: PostMusicAttachmentProvider;
      url: string;
    }): Promise<PostMediaDraft> => {
      try {
        const card = await runWithAuth(
          (freshCsrfToken) =>
            resolveProfileIntegrationMetadata(input, freshCsrfToken),
          { retryOnCsrf: true },
        );

        return postMediaDraftFromIntegration(card);
      } catch (error) {
        setMessage({
          tone: "error",
          text: composerError(error, "Music could not be attached."),
        });
        throw error;
      }
    },
    [runWithAuth],
  );

  const connectMusicProvider = useCallback(
    async (provider: PostMusicAttachmentProvider) => {
      try {
        const redirectPath = `${window.location.pathname}${window.location.search}`;
        const result = await runWithAuth(
          (freshCsrfToken) =>
            startProfileIntegration(provider, freshCsrfToken, redirectPath),
          { retryOnCsrf: true },
        );

        if (result.authorizationUrl) {
          window.location.assign(result.authorizationUrl);
        }
      } catch (error) {
        setMessage({
          tone: "error",
          text: composerError(error, "Music provider could not be connected."),
        });
        throw error;
      }
    },
    [runWithAuth],
  );

  async function uploadCroppedImage(file: File) {
    setUploadingMedia(true);
    setMessage(undefined);

    try {
      const uploaded = await runWithAuth(
        (freshCsrfToken) => uploadImage(file, "post_media", freshCsrfToken),
        { retryOnCsrf: true },
      );
      appendMedia(postMediaDraftFromImage(uploaded));
      setPendingImageCrop(undefined);
      setSuccess("Image attached.");
    } catch (error) {
      setErrorFrom(error, "Image could not be uploaded.");
      throw error;
    } finally {
      setUploadingMedia(false);
    }
  }

  function appendMedia(draft: PostMediaDraft) {
    setMedia((current) =>
      current.length >= maxPostComposerAttachments
        ? current
        : [...current, draft],
    );
  }

  function handleMusicAttachmentAdd(draft: PostMediaDraft) {
    appendMedia(draft);
    setSuccess("Music attached.");
    setMusicPickerOpen(false);
  }

  function handleGifAttachmentAdd(gif: GifSearchResult) {
    if (!canAddMedia) {
      setAttachmentLimitError();
      return;
    }

    appendMedia(postMediaDraftFromGif(gif));
    setSuccess("GIF attached.");
    setGifPickerOpen(false);
  }

  function moveMediaAttachment(index: number, offset: -1 | 1) {
    setMedia((current) => movePostMediaDraft(current, index, index + offset));
  }

  function setError(text: string) {
    setMessage({ text, tone: "error" });
  }

  function setErrorFrom(error: unknown, fallback: string) {
    setError(composerError(error, fallback));
  }

  function setSuccess(text: string) {
    setMessage({ text, tone: "success" });
  }

  function setAttachmentLimitError() {
    setError(
      `${nounPlural} can include up to ${maxPostComposerAttachments} attachments.`,
    );
  }

  const avatar = user?.avatarUrl ? (
    <img
      alt=""
      className="size-10 shrink-0 rounded-full border border-line object-cover shadow-soft"
      src={user.avatarUrl}
    />
  ) : (
    <span
      aria-hidden="true"
      className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-accent-soft text-sm font-semibold text-text shadow-inner-soft"
    >
      {user?.displayName.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );

  return (
    <>
      <form
        id={formId}
        className={cn(
          "flex min-h-0 flex-col bg-surface",
          isReply && "overflow-hidden rounded-card border border-line shadow-inner-soft",
          className,
        )}
        data-testid="unified-composer"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div
          className="contents"
          data-testid={isReply ? "reply-composer" : undefined}
        >

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            {avatar}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text">
                {user?.displayName ?? (status === "loading" ? "Loading…" : "Your profile")}
              </p>
              <p className="truncate text-xs text-muted">
                {isReply
                  ? "Replying in this thread"
                  : user
                    ? `@${user.handle}`
                    : "Sign in to share"}
              </p>
            </div>

            {!isReply ? (
              <label
                className="app-control group relative inline-flex min-h-11 max-w-[12rem] cursor-pointer touch-manipulation items-center gap-2 overflow-hidden rounded-control border border-line bg-canvas/70 px-3 pr-8 text-sm font-medium text-text transition duration-fluid hover:border-line-strong hover:bg-surface-strong focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55"
                data-testid="composer-destination-control"
                title="Post destination"
              >
                <Radio aria-hidden="true" className="shrink-0 text-muted" size={16} />
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
                  disabled={busy}
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
                  className="pointer-events-none absolute right-3 text-muted"
                  size={15}
                />
              </label>
            ) : null}
          </div>

          <MarkdownEditor
            ref={textareaRef}
            label={noun}
            maxLength={2000}
            minHeightClassName={isReply ? "min-h-28" : "min-h-40 sm:min-h-48"}
            placeholder={isReply ? "Write a reply…" : "What do you want to share?"}
            previewMode="collapsible"
            renderedClassName={isReply ? "text-sm leading-6" : "text-base leading-7"}
            showHeader={false}
            testIdPrefix={isReply ? "reply-composer-markdown" : "post-composer-markdown"}
            textareaTestId={
              isReply ? `reply-composer-${parentPostId ?? "unknown"}` : "post-composer-body"
            }
            toolbarMode="collapsible"
            value={body}
            disabled={busy}
            onValueChange={(nextBody) => {
              setBody(nextBody);
              if (message?.tone === "error") {
                setMessage(undefined);
              }
            }}
          />

          <PostMusicAttachmentPicker
            attachmentCount={media.length}
            disabled={busy || !csrfToken}
            limitMessage={`${nounPlural} can include up to ${maxPostComposerAttachments} attachments.`}
            loadSuggestions={loadMusicSuggestions}
            maxAttachments={maxPostComposerAttachments}
            onAddAttachment={handleMusicAttachmentAdd}
            onClose={() => setMusicPickerOpen(false)}
            onConnectProvider={connectMusicProvider}
            onResolveMusicUrl={resolveMusicAttachmentDraft}
            onUploadAudio={createAudioAttachmentDraft}
            open={musicPickerOpen}
          />

          {gifPickerOpen ? (
            <GifPicker className="mx-auto w-full max-w-xl" onSelect={handleGifAttachmentAdd} />
          ) : null}

          {media.length > 0 ? (
            <div
              className="grid gap-2 sm:grid-cols-2"
              data-testid={isReply ? "reply-composer-attachments" : "composer-attachments"}
            >
              {media.map((item, index) => (
                <ComposerAttachmentPreview
                  key={`${postMediaDraftKey(item)}-${index}`}
                  attachment={item}
                  index={index}
                  disabled={busy}
                  canMoveDown={index < media.length - 1}
                  canMoveUp={index > 0}
                  testId={isReply ? "reply-composer-attachment" : "composer-attachment"}
                  onMoveDown={() => moveMediaAttachment(index, 1)}
                  onMoveUp={() => moveMediaAttachment(index, -1)}
                  onRemove={() =>
                    setMedia((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                />
              ))}
            </div>
          ) : null}

          {message ? (
            <ModalSheetStatus tone={message.tone}>{message.text}</ModalSheetStatus>
          ) : null}
        </div>

        <div className="sticky bottom-0 z-10 mt-auto border-t border-line bg-surface/96 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-panel sm:px-5 sm:pb-3">
          <div className="flex flex-col gap-2 min-[360px]:flex-row min-[360px]:items-center">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <label
                className="app-control grid size-11 shrink-0 cursor-pointer touch-manipulation place-items-center rounded-full text-muted transition duration-fluid hover:bg-surface-strong hover:text-text focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus has-[:disabled]:pointer-events-none has-[:disabled]:opacity-50 sm:size-10"
                title={media.length > 0 ? "Add image or video" : "Upload image or video"}
              >
                <ImagePlus aria-hidden="true" size={19} />
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
                  disabled={busy || !canAddMedia || !csrfToken}
                  onChange={(event) => void handleMediaChange(event)}
                />
              </label>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 sm:size-10"
                disabled={busy || !canAddMedia || !csrfToken}
                aria-label="Add GIF"
                title="Add GIF"
                onClick={() => {
                  setGifPickerOpen((current) => !current);
                  setMusicPickerOpen(false);
                }}
                icon={<ImagePlay aria-hidden="true" size={19} />}
              />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 sm:size-10"
                disabled={busy || !canAddMedia || !csrfToken}
                aria-label="Add music"
                title="Add music"
                onClick={() => {
                  setMusicPickerOpen((current) => !current);
                  setGifPickerOpen(false);
                }}
                icon={<Music2 aria-hidden="true" size={19} />}
              />

              {media.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 sm:size-10"
                  disabled={busy}
                  aria-label="Remove all media"
                  title="Remove all media"
                  onClick={() => {
                    setMedia([]);
                    setMessage(undefined);
                  }}
                  icon={<Trash2 aria-hidden="true" size={18} />}
                />
              ) : null}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <span
                className={cn(
                  "text-xs tabular-nums",
                  body.length > 2000 ? "text-rose-ink" : "text-muted",
                )}
                aria-live="polite"
              >
                {body.length}/2000
              </span>
              {onCancel ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 px-3"
                  disabled={busy}
                  onClick={onCancel}
                >
                  Cancel
                </Button>
              ) : null}
              <Button
                type="submit"
                className="min-h-11 px-4 font-semibold"
                disabled={!canSubmit}
                icon={<Send aria-hidden="true" size={17} />}
              >
                {submitting ? (isReply ? "Sending…" : "Posting…") : isReply ? "Reply" : "Post"}
              </Button>
            </div>
          </div>
        </div>
        </div>
      </form>

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

type ComposerAttachmentPreviewProps = {
  attachment: PostMediaDraft;
  canMoveDown: boolean;
  canMoveUp: boolean;
  disabled: boolean;
  index: number;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onRemove: () => void;
  testId: string;
};

function ComposerAttachmentPreview({
  attachment,
  canMoveDown,
  canMoveUp,
  disabled,
  index,
  onMoveDown,
  onMoveUp,
  onRemove,
  testId,
}: ComposerAttachmentPreviewProps) {
  return (
    <div
      className="relative overflow-hidden rounded-card border border-line bg-canvas/55"
      data-testid={testId}
    >
      {attachment.type === "integration" ? (
        <ComposerIntegrationPreview attachment={attachment} />
      ) : attachment.type === "gif" ? (
        <div className="grid gap-2 p-2 pb-14">
          <img
            alt=""
            className="mx-auto max-h-64 max-w-full rounded-card object-contain"
            src={attachment.url}
          />
          <p className="truncate px-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
            KLIPY GIF
          </p>
        </div>
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
        <div className="grid min-h-28 gap-2 p-3 pb-16 sm:pb-3 sm:pr-36">
          <p className="truncate text-sm font-semibold text-text">
            MP3 attachment {index + 1}
          </p>
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

      <div className="absolute bottom-2 right-2 flex gap-1 rounded-full border border-line bg-surface/94 p-0.5 shadow-soft sm:bottom-auto sm:top-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 sm:size-9"
          disabled={disabled || !canMoveUp}
          aria-label={`Move attachment ${index + 1} earlier`}
          title="Move earlier"
          onClick={onMoveUp}
          icon={<ArrowUp aria-hidden="true" size={15} />}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 sm:size-9"
          disabled={disabled || !canMoveDown}
          aria-label={`Move attachment ${index + 1} later`}
          title="Move later"
          onClick={onMoveDown}
          icon={<ArrowDown aria-hidden="true" size={15} />}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 sm:size-9"
          disabled={disabled}
          aria-label={`Remove attachment ${index + 1}`}
          title="Remove attachment"
          onClick={onRemove}
          icon={<Trash2 aria-hidden="true" size={16} />}
        />
      </div>
    </div>
  );
}

function ComposerIntegrationPreview({
  attachment,
}: {
  attachment: Extract<PostMediaDraft, { type: "integration" }>;
}) {
  const title =
    attachment.card.metadata.title ?? providerLabel(attachment.provider);
  const subtitle =
    attachment.card.metadata.subtitle ?? providerLabel(attachment.provider);
  const imageUrl = attachment.card.metadata.imageUrl;

  return (
    <div className="grid min-h-32 min-w-0 grid-cols-[4rem_minmax(0,1fr)] gap-3 p-3 pb-16 sm:min-h-28 sm:pb-3 sm:pr-36">
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
        <span className="block truncate text-sm font-semibold text-text">
          {title}
        </span>
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
  return attachment.type === "integration" || attachment.type === "gif"
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

function composerError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : fallback;
}
