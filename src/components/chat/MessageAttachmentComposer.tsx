import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  LoaderCircle,
  Music2,
  Trash2,
  WifiOff,
} from "lucide-react";
import {
  getProfileIntegrationSuggestions,
  previewImageUpload,
  resolveProfileIntegrationMetadata,
  startProfileIntegration,
  uploadAudio,
  uploadImage,
  uploadVideo,
} from "../../lib/api";
import { cn } from "../../lib/classNames";
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
  type PostMediaDraft,
} from "../../lib/postMedia";
import type { GifSearchResult } from "../../lib/types";
import { useAuth } from "../../lib/useAuth";
import { GifIcon } from "../icons/GifIcon";
import { GifPicker } from "../social/GifPicker";
import {
  PostMusicAttachmentPicker,
  type PostMusicAttachmentProvider,
} from "../social/PostMusicAttachmentPicker";
import { Button } from "../ui/Button";
import { ImageCropModal } from "../ui/ImageCropModal";
import { maxMessageAttachments } from "./messageAttachmentState";

export type MessageAttachmentComposerProps = {
  attachments: PostMediaDraft[];
  className?: string;
  disabled?: boolean;
  maxAttachments?: number;
  onBusyChange?: (busy: boolean) => void;
  onChange: (attachments: PostMediaDraft[]) => void;
  testId?: string;
};

type AttachmentComposerStatus = {
  text: string;
  tone: "error" | "success";
};

type MessageAttachmentPreviewProps = {
  attachment: PostMediaDraft;
  canMoveLater: boolean;
  canMoveEarlier: boolean;
  disabled: boolean;
  index: number;
  onMoveLater: () => void;
  onMoveEarlier: () => void;
  onRemove: () => void;
  testId: string;
};

export function MessageAttachmentComposer({
  attachments,
  className,
  disabled = false,
  maxAttachments = maxMessageAttachments,
  onBusyChange,
  onChange,
  testId = "message-attachment-composer",
}: MessageAttachmentComposerProps) {
  const { csrfToken, runWithAuth, status: authStatus } = useAuth();
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [musicPickerOpen, setMusicPickerOpen] = useState(false);
  const [pendingImageCrop, setPendingImageCrop] = useState<File | undefined>();
  const [pendingOperations, setPendingOperations] = useState(0);
  const [message, setMessage] = useState<AttachmentComposerStatus | undefined>();
  const attachmentLimit = normalizedAttachmentLimit(maxAttachments);
  const attachmentsRef = useRef(attachments);
  const attachmentLimitRef = useRef(attachmentLimit);
  const mountedRef = useRef(true);
  const onChangeRef = useRef(onChange);
  const busy = pendingOperations > 0;
  const controlsDisabled = disabled || busy || authStatus !== "authenticated" || !csrfToken;
  const canAddAttachment = attachments.length < attachmentLimit;

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    attachmentLimitRef.current = attachmentLimit;
  }, [attachmentLimit]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    onBusyChange?.(busy);

    return () => {
      if (busy) {
        onBusyChange?.(false);
      }
    };
  }, [busy, onBusyChange]);

  const runBusy = useCallback(async <Result,>(operation: () => Promise<Result>) => {
    setPendingOperations((current) => current + 1);

    try {
      return await operation();
    } finally {
      setPendingOperations((current) => Math.max(0, current - 1));
    }
  }, []);

  const replaceAttachments = useCallback((nextAttachments: PostMediaDraft[]) => {
    if (!mountedRef.current) {
      return;
    }

    attachmentsRef.current = nextAttachments;
    onChangeRef.current(nextAttachments);
  }, []);

  const setAttachmentLimitError = useCallback(() => {
    setMessage({
      text: `Messages can include up to ${attachmentLimitRef.current} attachments.`,
      tone: "error",
    });
  }, []);

  const appendAttachment = useCallback(
    (attachment: PostMediaDraft): boolean => {
      if (!mountedRef.current) {
        return false;
      }

      const current = attachmentsRef.current;

      if (current.length >= attachmentLimitRef.current) {
        setAttachmentLimitError();
        return false;
      }

      replaceAttachments([...current, attachment]);
      return true;
    },
    [replaceAttachments, setAttachmentLimitError],
  );

  const loadMusicSuggestions = useCallback(
    (provider: PostMusicAttachmentProvider) =>
      getProfileIntegrationSuggestions(provider),
    [],
  );

  const resolveMusicAttachmentDraft = useCallback(
    async (input: {
      provider?: PostMusicAttachmentProvider;
      url: string;
    }): Promise<PostMediaDraft> => {
      try {
        const card = await runBusy(() =>
          runWithAuth(
            (freshCsrfToken) =>
              resolveProfileIntegrationMetadata(input, freshCsrfToken),
            { retryOnCsrf: true },
          ),
        );

        return postMediaDraftFromIntegration(card);
      } catch (error) {
        setMessage({
          text: attachmentComposerError(error, "Music could not be attached."),
          tone: "error",
        });
        throw error;
      }
    },
    [runBusy, runWithAuth],
  );

  const connectMusicProvider = useCallback(
    async (provider: PostMusicAttachmentProvider) => {
      try {
        const redirectPath = `${window.location.pathname}${window.location.search}`;
        const result = await runBusy(() =>
          runWithAuth(
            (freshCsrfToken) =>
              startProfileIntegration(provider, freshCsrfToken, redirectPath),
            { retryOnCsrf: true },
          ),
        );

        if (result.authorizationUrl) {
          window.location.assign(result.authorizationUrl);
        }
      } catch (error) {
        setMessage({
          text: attachmentComposerError(
            error,
            "Music provider could not be connected.",
          ),
          tone: "error",
        });
        throw error;
      }
    },
    [runBusy, runWithAuth],
  );

  const createAudioAttachmentDraft = useCallback(
    async (file: File): Promise<PostMediaDraft> => {
      const validationError = validateMessageAudioFile(file);

      if (validationError) {
        setMessage({ text: validationError, tone: "error" });
        throw new Error(validationError);
      }

      try {
        const uploaded = await runBusy(() =>
          runWithAuth(
            (freshCsrfToken) =>
              uploadAudio(file, "post_media", freshCsrfToken),
            { retryOnCsrf: true },
          ),
        );

        return postMediaDraftFromAudio(uploaded);
      } catch (error) {
        setMessage({
          text: attachmentComposerError(error, "Audio could not be uploaded."),
          tone: "error",
        });
        throw error;
      }
    },
    [runBusy, runWithAuth],
  );

  const handleMusicAttachmentAdd = useCallback(
    (attachment: PostMediaDraft) => {
      if (appendAttachment(attachment)) {
        setMessage({ text: "Music attached.", tone: "success" });
      }

      setMusicPickerOpen(false);
    },
    [appendAttachment],
  );

  const handleGifAttachmentAdd = useCallback(
    (gif: GifSearchResult) => {
      if (appendAttachment(postMediaDraftFromGif(gif))) {
        setMessage({ text: "GIF attached.", tone: "success" });
      }

      setGifPickerOpen(false);
    },
    [appendAttachment],
  );

  async function handleVisualMediaChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    if (!csrfToken || authStatus !== "authenticated") {
      setMessage({ text: "Log in to upload media.", tone: "error" });
      return;
    }

    if (attachmentsRef.current.length >= attachmentLimitRef.current) {
      setAttachmentLimitError();
      return;
    }

    if (isLikelyVideoUploadFile(file)) {
      await uploadVideoAttachment(file);
      return;
    }

    if (!isAcceptedImageUploadFile(file)) {
      setMessage({
        text: `${imageUploadFormatHelp} ${videoUploadFormatHelp}`,
        tone: "error",
      });
      return;
    }

    setMessage(undefined);

    try {
      const prepared = await runBusy(() =>
        runWithAuth(
          (freshCsrfToken) =>
            prepareImageFileForCrop(file, "post_media", (sourceFile, purpose) =>
              previewImageUpload(sourceFile, purpose, freshCsrfToken),
            ),
          { retryOnCsrf: true },
        ),
      );
      setPendingImageCrop(prepared);
    } catch (error) {
      setMessage({
        text: attachmentComposerError(error, "Image could not be prepared."),
        tone: "error",
      });
    }
  }

  async function uploadVideoAttachment(file: File) {
    const validationError = validateMessageVideoFile(file);

    if (validationError) {
      setMessage({ text: validationError, tone: "error" });
      return;
    }

    setMessage(undefined);

    try {
      const uploaded = await runBusy(() =>
        runWithAuth(
          (freshCsrfToken) =>
            uploadVideo(file, "post_media", freshCsrfToken),
          { retryOnCsrf: true },
        ),
      );

      if (appendAttachment(postMediaDraftFromVideo(uploaded))) {
        setMessage({ text: "Video attached.", tone: "success" });
      }
    } catch (error) {
      setMessage({
        text: attachmentComposerError(error, "Video could not be uploaded."),
        tone: "error",
      });
    }
  }

  async function uploadCroppedImage(file: File) {
    setMessage(undefined);

    try {
      const uploaded = await runBusy(() =>
        runWithAuth(
          (freshCsrfToken) => uploadImage(file, "post_media", freshCsrfToken),
          { retryOnCsrf: true },
        ),
      );

      if (appendAttachment(postMediaDraftFromImage(uploaded))) {
        setMessage({ text: "Image attached.", tone: "success" });
      }
      setPendingImageCrop(undefined);
    } catch (error) {
      setMessage({
        text: attachmentComposerError(error, "Image could not be uploaded."),
        tone: "error",
      });
      throw error;
    }
  }

  function moveAttachment(index: number, offset: -1 | 1) {
    replaceAttachments(
      moveMessageAttachment(
        attachmentsRef.current,
        index,
        index + offset,
      ),
    );
    setMessage(undefined);
  }

  function removeAttachment(index: number) {
    replaceAttachments(
      attachmentsRef.current.filter(
        (_attachment, attachmentIndex) => attachmentIndex !== index,
      ),
    );
    setMessage(undefined);
  }

  function clearAttachments() {
    replaceAttachments([]);
    setGifPickerOpen(false);
    setMusicPickerOpen(false);
    setMessage(undefined);
  }

  return (
    <>
      <section
        aria-label="Message attachments"
        className={cn("min-w-0 max-w-full", className)}
        data-attachment-count={attachments.length}
        data-testid={testId}
      >
        <div
          aria-label="Add message attachments"
          className="flex min-w-0 max-w-full items-center gap-1 rounded-control border border-line bg-canvas/55 p-1"
          role="toolbar"
        >
          <label
            className="app-control grid size-11 shrink-0 cursor-pointer touch-manipulation place-items-center rounded-full text-muted transition duration-fluid hover:bg-surface-strong hover:text-text focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus has-[:disabled]:pointer-events-none has-[:disabled]:opacity-50"
            title={attachments.length > 0 ? "Add image or video" : "Upload image or video"}
          >
            <ImagePlus aria-hidden="true" size={19} />
            <span className="sr-only">
              {busy
                ? "Uploading media"
                : attachments.length > 0
                  ? "Add image or video"
                  : "Upload image or video"}
            </span>
            <input
              accept={visualMediaUploadAccept}
              className="sr-only"
              data-testid={`${testId}-media-input`}
              disabled={controlsDisabled || !canAddAttachment}
              type="file"
              onChange={(event) => void handleVisualMediaChange(event)}
            />
          </label>

          <Button
            aria-label={gifPickerOpen ? "Close GIF picker" : "Add GIF"}
            className="size-11"
            data-testid={`${testId}-gif-button`}
            disabled={controlsDisabled || !canAddAttachment}
            icon={<GifIcon aria-hidden="true" size={19} />}
            size="icon"
            title={gifPickerOpen ? "Close GIF picker" : "Add GIF"}
            type="button"
            variant="ghost"
            onClick={() => {
              setGifPickerOpen((current) => !current);
              setMusicPickerOpen(false);
              setMessage(undefined);
            }}
          />

          <Button
            aria-label={musicPickerOpen ? "Close music picker" : "Add music"}
            className="size-11"
            data-testid={`${testId}-music-button`}
            disabled={controlsDisabled || !canAddAttachment}
            icon={<Music2 aria-hidden="true" size={19} />}
            size="icon"
            title={musicPickerOpen ? "Close music picker" : "Add music"}
            type="button"
            variant="ghost"
            onClick={() => {
              setMusicPickerOpen((current) => !current);
              setGifPickerOpen(false);
              setMessage(undefined);
            }}
          />

          {attachments.length > 0 ? (
            <Button
              aria-label="Remove all attachments"
              className="size-11"
              data-testid={`${testId}-clear-button`}
              disabled={disabled || busy}
              icon={<Trash2 aria-hidden="true" size={18} />}
              size="icon"
              title="Remove all attachments"
              type="button"
              variant="ghost"
              onClick={clearAttachments}
            />
          ) : null}

          <span
            aria-live="polite"
            className={cn(
              "ml-auto shrink-0 px-2 text-xs font-medium tabular-nums",
              attachments.length >= attachmentLimit ? "text-rose-ink" : "text-muted",
            )}
          >
            {attachments.length}/{attachmentLimit}
          </span>

          {busy ? (
            <LoaderCircle
              aria-label="Working on attachment"
              className="mr-2 shrink-0 animate-spin text-muted"
              data-testid={`${testId}-busy`}
              size={16}
            />
          ) : null}
        </div>

        <PostMusicAttachmentPicker
          attachmentCount={attachments.length}
          disabled={controlsDisabled}
          limitMessage={`Messages can include up to ${attachmentLimit} attachments.`}
          loadSuggestions={loadMusicSuggestions}
          maxAttachments={attachmentLimit}
          onAddAttachment={handleMusicAttachmentAdd}
          onClose={() => setMusicPickerOpen(false)}
          onConnectProvider={connectMusicProvider}
          onResolveMusicUrl={resolveMusicAttachmentDraft}
          onUploadAudio={createAudioAttachmentDraft}
          open={musicPickerOpen && !disabled}
        />

        {gifPickerOpen && !disabled ? (
          <GifPicker
            className="mt-2 w-full max-w-full"
            onSelect={handleGifAttachmentAdd}
          />
        ) : null}

        {attachments.length > 0 ? (
          <div
            aria-label="Selected message attachments"
            className="mt-2 flex max-w-full snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-1"
            data-testid={`${testId}-items`}
            role="list"
          >
            {attachments.map((attachment, index) => (
              <MessageAttachmentPreview
                key={`${messageAttachmentKey(attachment)}-${index}`}
                attachment={attachment}
                canMoveEarlier={index > 0}
                canMoveLater={index < attachments.length - 1}
                disabled={disabled || busy}
                index={index}
                testId={`${testId}-item`}
                onMoveEarlier={() => moveAttachment(index, -1)}
                onMoveLater={() => moveAttachment(index, 1)}
                onRemove={() => removeAttachment(index)}
              />
            ))}
          </div>
        ) : null}

        {message ? (
          <p
            className={cn(
              "mt-2 rounded-control border px-3 py-2 text-sm leading-5",
              message.tone === "error"
                ? "border-rose/30 bg-rose/12 text-rose-ink"
                : "border-leaf/30 bg-leaf/12 text-leaf-ink",
            )}
            role={message.tone === "error" ? "alert" : "status"}
          >
            {message.text}
          </p>
        ) : null}
      </section>

      <ImageCropModal
        busy={busy}
        file={pendingImageCrop}
        open={Boolean(pendingImageCrop) && !disabled}
        purpose="post_media"
        onApply={uploadCroppedImage}
        onClose={() => setPendingImageCrop(undefined)}
      />
    </>
  );
}

function MessageAttachmentPreview({
  attachment,
  canMoveLater,
  canMoveEarlier,
  disabled,
  index,
  onMoveLater,
  onMoveEarlier,
  onRemove,
  testId,
}: MessageAttachmentPreviewProps) {
  return (
    <article
      className="w-56 max-w-[calc(100vw-4rem)] shrink-0 snap-start overflow-hidden rounded-card border border-line bg-canvas/60"
      data-attachment-type={attachment.type}
      data-testid={testId}
      role="listitem"
    >
      <div className="relative grid h-28 min-w-0 place-items-center overflow-hidden bg-surface/70">
        {attachment.type === "integration" ? (
          <MessageIntegrationPreview attachment={attachment} />
        ) : attachment.type === "gif" ? (
          <img
            alt=""
            className="h-full w-full object-contain"
            decoding="async"
            src={attachment.url}
          />
        ) : attachment.type === "video" ? (
          <video
            className="h-full w-full bg-black object-contain"
            controls
            playsInline
            poster={attachment.posterUrl ?? undefined}
            preload="metadata"
          >
            <source src={attachment.url} type={attachment.mime} />
          </video>
        ) : attachment.type === "audio" ? (
          <div className="grid w-full min-w-0 gap-2 px-3">
            <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-text">
              <Music2 aria-hidden="true" className="shrink-0 text-muted" size={17} />
              <span className="truncate">Audio attachment</span>
            </span>
            <audio className="h-10 w-full min-w-0" controls preload="metadata">
              <source src={attachment.url} type={attachment.mime} />
            </audio>
          </div>
        ) : (
          <img
            alt=""
            className="h-full w-full object-contain"
            decoding="async"
            src={attachment.url}
          />
        )}

        <span className="absolute left-2 top-2 rounded-full border border-line bg-surface/92 px-2 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted shadow-soft">
          {attachmentLabel(attachment)} {index + 1}
        </span>
      </div>

      <div className="flex min-w-0 items-center justify-end gap-1 border-t border-line p-1">
        <Button
          aria-label={`Move attachment ${index + 1} earlier`}
          className="size-11"
          disabled={disabled || !canMoveEarlier}
          icon={<ArrowLeft aria-hidden="true" size={16} />}
          size="icon"
          title="Move earlier"
          type="button"
          variant="ghost"
          onClick={onMoveEarlier}
        />
        <Button
          aria-label={`Move attachment ${index + 1} later`}
          className="size-11"
          disabled={disabled || !canMoveLater}
          icon={<ArrowRight aria-hidden="true" size={16} />}
          size="icon"
          title="Move later"
          type="button"
          variant="ghost"
          onClick={onMoveLater}
        />
        <Button
          aria-label={`Remove attachment ${index + 1}`}
          className="size-11"
          disabled={disabled}
          icon={<Trash2 aria-hidden="true" size={17} />}
          size="icon"
          title="Remove attachment"
          type="button"
          variant="ghost"
          onClick={onRemove}
        />
      </div>
    </article>
  );
}

function MessageIntegrationPreview({
  attachment,
}: {
  attachment: Extract<PostMediaDraft, { type: "integration" }>;
}) {
  const title =
    attachment.card.metadata.title ?? integrationProviderLabel(attachment.provider);
  const subtitle =
    attachment.card.metadata.subtitle ?? integrationProviderLabel(attachment.provider);
  const imageUrl = attachment.card.metadata.imageUrl;

  return (
    <div className="grid h-full w-full min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 px-3">
      <span className="grid size-14 overflow-hidden rounded-card border border-line bg-canvas/60">
        {imageUrl ? (
          <img alt="" className="h-full w-full object-cover" src={imageUrl} />
        ) : (
          <span className="grid place-items-center text-muted">
            <WifiOff aria-hidden="true" size={18} />
          </span>
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-text">
          {title}
        </span>
        <span className="mt-1 block truncate text-xs text-muted">{subtitle}</span>
      </span>
    </div>
  );
}

function moveMessageAttachment(
  attachments: PostMediaDraft[],
  fromIndex: number,
  toIndex: number,
): PostMediaDraft[] {
  if (toIndex < 0 || toIndex >= attachments.length || fromIndex === toIndex) {
    return attachments;
  }

  const next = [...attachments];
  const [attachment] = next.splice(fromIndex, 1);

  if (attachment === undefined) {
    return attachments;
  }

  next.splice(toIndex, 0, attachment);
  return next;
}

function messageAttachmentKey(attachment: PostMediaDraft): string {
  return attachment.type === "integration" || attachment.type === "gif"
    ? attachment.resourceKey
    : attachment.url;
}

function attachmentLabel(attachment: PostMediaDraft): string {
  if (attachment.type === "integration") {
    return integrationProviderLabel(attachment.provider);
  }

  if (attachment.type === "gif") {
    return "GIF";
  }

  if (attachment.type === "audio") {
    return "Audio";
  }

  if (attachment.type === "video") {
    return "Video";
  }

  return "Image";
}

function integrationProviderLabel(provider: "spotify" | "youtube"): string {
  return provider === "spotify" ? "Spotify" : "YouTube";
}

function normalizedAttachmentLimit(value: number): number {
  if (!Number.isFinite(value)) {
    return maxMessageAttachments;
  }

  return Math.min(
    maxMessageAttachments,
    Math.max(0, Math.trunc(value)),
  );
}

function validateMessageVideoFile(file: File): string | undefined {
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

function validateMessageAudioFile(file: File): string | undefined {
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

function attachmentComposerError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : fallback;
}
