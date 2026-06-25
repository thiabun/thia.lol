import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import {
  ExternalLink,
  Link as LinkIcon,
  LoaderCircle,
  Music2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "../ui/Button";
import type {
  ProfileIntegrationProvider,
  ProfileIntegrationSuggestion,
  ProfileIntegrationSuggestionsResult,
} from "../../lib/api";
import { audioUploadAccept } from "../../lib/mediaFormats";
import {
  postMediaDraftFromIntegration,
  type PostMediaDraft,
} from "../../lib/postMedia";
import { cn } from "../../lib/classNames";

export type PostMusicAttachmentProvider = Extract<
  ProfileIntegrationProvider,
  "spotify" | "youtube"
>;

type PostMusicAttachmentPickerProps = {
  attachmentCount: number;
  disabled?: boolean;
  limitMessage: string;
  loadSuggestions: (
    provider: PostMusicAttachmentProvider,
  ) => Promise<ProfileIntegrationSuggestionsResult>;
  maxAttachments: number;
  onAddAttachment: (draft: PostMediaDraft) => void;
  onClose: () => void;
  onConnectProvider: (provider: PostMusicAttachmentProvider) => Promise<void>;
  onResolveMusicUrl: (input: {
    provider?: PostMusicAttachmentProvider;
    url: string;
  }) => Promise<PostMediaDraft>;
  onUploadAudio: (file: File) => Promise<PostMediaDraft>;
  open: boolean;
};

type SuggestionsState = {
  error?: string;
  loading: boolean;
  result?: ProfileIntegrationSuggestionsResult;
};

const musicProviders = ["spotify", "youtube"] as const;

export function PostMusicAttachmentPicker({
  attachmentCount,
  disabled = false,
  limitMessage,
  loadSuggestions,
  maxAttachments,
  onAddAttachment,
  onClose,
  onConnectProvider,
  onResolveMusicUrl,
  onUploadAudio,
  open,
}: PostMusicAttachmentPickerProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const [suggestions, setSuggestions] = useState<Record<PostMusicAttachmentProvider, SuggestionsState>>(
    () => initialSuggestionsState(),
  );
  const [url, setUrl] = useState("");
  const canAddAttachment = attachmentCount < maxAttachments && !disabled && !busy;

  const loadProviderSuggestions = useCallback(async (provider: PostMusicAttachmentProvider) => {
    setSuggestions((current) => ({
      ...current,
      [provider]: {
        ...current[provider],
        error: undefined,
        loading: true,
      },
    }));

    try {
      const result = await loadSuggestions(provider);

      setSuggestions((current) => ({
        ...current,
        [provider]: {
          loading: false,
          result,
        },
      }));
    } catch (error) {
      setSuggestions((current) => ({
        ...current,
        [provider]: {
          error:
            error instanceof Error
              ? error.message
              : `${providerLabel(provider)} suggestions could not load.`,
          loading: false,
        },
      }));
    }
  }, [loadSuggestions]);

  useEffect(() => {
    if (!open) {
      setBusy(false);
      setMessage(undefined);
      setUrl("");
      return;
    }

    for (const provider of musicProviders) {
      void loadProviderSuggestions(provider);
    }
  }, [loadProviderSuggestions, open]);

  if (!open) {
    return null;
  }

  async function handleUrlSubmit() {
    if (!canAddAttachment) {
      setMessage(limitMessage);
      return;
    }

    const trimmedUrl = url.trim();
    const provider = musicProviderFromUrl(trimmedUrl);

    if (!provider) {
      setMessage("Use a Spotify or YouTube link.");
      return;
    }

    setBusy(true);
    setMessage(undefined);

    try {
      const draft = await onResolveMusicUrl({ provider, url: trimmedUrl });
      onAddAttachment(draft);
      setUrl("");
      onClose();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Music link could not be attached.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleAudioChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    if (!canAddAttachment) {
      setMessage(limitMessage);
      return;
    }

    setBusy(true);
    setMessage(undefined);

    try {
      const draft = await onUploadAudio(file);
      onAddAttachment(draft);
      onClose();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "MP3 could not be attached.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSuggestionSelect(
    provider: PostMusicAttachmentProvider,
    suggestion: ProfileIntegrationSuggestion,
  ) {
    if (!canAddAttachment) {
      setMessage(limitMessage);
      return;
    }

    setBusy(true);
    setMessage(undefined);

    try {
      const draft =
        suggestion.card && suggestion.card.provider === provider
          ? postMediaDraftFromIntegration(suggestion.card)
          : await onResolveMusicUrl({ provider, url: suggestion.sourceUrl });

      onAddAttachment(draft);
      onClose();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : `${providerLabel(provider)} item could not be attached.`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleConnect(provider: PostMusicAttachmentProvider) {
    setBusy(true);
    setMessage(undefined);

    try {
      await onConnectProvider(provider);
      setBusy(false);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : `${providerLabel(provider)} could not be connected.`,
      );
      setBusy(false);
    }
  }

  return (
    <section
      className="rounded-card border border-line bg-canvas/60 p-3 shadow-inner-soft"
      data-testid="post-music-picker"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-muted">
            <Music2 aria-hidden="true" size={16} />
          </span>
          <h3 className="truncate text-sm font-semibold text-text">Music</h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          aria-label="Close music picker"
          title="Close music picker"
          onClick={onClose}
        >
          <X aria-hidden="true" size={15} />
        </Button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
        <label className="min-w-0">
          <span className="sr-only">Spotify or YouTube URL</span>
          <input
            className="min-h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-text outline-none transition duration-fluid placeholder:text-muted/70 focus:border-line-strong focus-visible:outline-2 focus-visible:outline-focus"
            data-testid="post-music-url-input"
            disabled={disabled || busy}
            inputMode="url"
            placeholder="Spotify or YouTube URL"
            value={url}
            onChange={(event) => setUrl(event.currentTarget.value)}
          />
        </label>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || busy || !url.trim()}
          icon={<LinkIcon aria-hidden="true" size={15} />}
          data-testid="post-music-url-submit"
          onClick={() => void handleUrlSubmit()}
        >
          Add link
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label
          className={cn(
            "inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-control border border-line bg-surface px-3 text-sm font-medium text-text shadow-soft transition duration-fluid hover:border-line-strong focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus",
            (disabled || busy || attachmentCount >= maxAttachments) &&
              "pointer-events-none opacity-50",
          )}
        >
          <Upload aria-hidden="true" size={15} />
          Upload MP3
          <input
            className="sr-only"
            type="file"
            accept={audioUploadAccept}
            data-testid="post-music-audio-input"
            disabled={disabled || busy || attachmentCount >= maxAttachments}
            onChange={(event) => void handleAudioChange(event)}
          />
        </label>
        {busy ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
            <LoaderCircle aria-hidden="true" className="animate-spin" size={14} />
            Working
          </span>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {musicProviders.map((provider) => (
          <ProviderSuggestions
            key={provider}
            busy={busy || disabled}
            provider={provider}
            state={suggestions[provider]}
            onConnect={() => void handleConnect(provider)}
            onRetry={() => void loadProviderSuggestions(provider)}
            onSelect={(suggestion) => void handleSuggestionSelect(provider, suggestion)}
          />
        ))}
      </div>

      {attachmentCount >= maxAttachments || message ? (
        <p
          className="mt-3 rounded-card border border-rose/30 bg-rose/12 p-2 text-sm text-rose-ink"
          role="alert"
        >
          {attachmentCount >= maxAttachments ? limitMessage : message}
        </p>
      ) : null}
    </section>
  );
}

function ProviderSuggestions({
  busy,
  provider,
  state,
  onConnect,
  onRetry,
  onSelect,
}: {
  busy: boolean;
  provider: PostMusicAttachmentProvider;
  state: SuggestionsState;
  onConnect: () => void;
  onRetry: () => void;
  onSelect: (suggestion: ProfileIntegrationSuggestion) => void;
}) {
  const items = (state.result?.items ?? []).filter(
    (item) =>
      item.moduleType === "music" &&
      (!item.card || item.card.provider === provider),
  );
  const canConnect = Boolean(
    state.result?.status.oauthEnabled && !state.result.account,
  );

  return (
    <div className="min-w-0 rounded-card border border-line bg-surface/70 p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase text-muted">
          {providerLabel(provider)}
        </p>
        {state.loading ? (
          <LoaderCircle aria-hidden="true" className="animate-spin text-muted" size={14} />
        ) : null}
      </div>
      <div className="mt-2 grid gap-1.5">
        {items.slice(0, 4).map((item, index) => (
          <button
            key={item.id}
            type="button"
            className="min-w-0 rounded-control border border-line bg-canvas/70 px-2 py-1.5 text-left transition duration-fluid hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-60"
            disabled={busy}
            data-testid={`post-music-suggestion-${provider}-${index}`}
            onClick={() => onSelect(item)}
          >
            <span className="block truncate text-sm font-semibold text-text">
              {item.label}
            </span>
            {item.description ? (
              <span className="mt-0.5 block truncate text-xs text-muted">
                {item.description}
              </span>
            ) : null}
          </button>
        ))}
        {!state.loading && items.length === 0 ? (
          <p className="rounded-control bg-canvas/60 px-2 py-1.5 text-xs text-muted">
            {state.error ?? state.result?.message ?? "No suggestions yet."}
          </p>
        ) : null}
      </div>
      <div className="mt-2 flex justify-end gap-1.5">
        {state.error ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={onRetry}
          >
            Retry
          </Button>
        ) : null}
        {canConnect ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            icon={<ExternalLink aria-hidden="true" size={14} />}
            data-testid={`post-music-connect-${provider}`}
            onClick={onConnect}
          >
            Connect
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function initialSuggestionsState(): Record<PostMusicAttachmentProvider, SuggestionsState> {
  return {
    spotify: { loading: false },
    youtube: { loading: false },
  };
}

function musicProviderFromUrl(value: string): PostMusicAttachmentProvider | undefined {
  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^www\./u, "").toLowerCase();

    if (hostname === "open.spotify.com" || hostname.endsWith(".spotify.com")) {
      return "spotify";
    }

    if (
      hostname === "youtube.com" ||
      hostname === "music.youtube.com" ||
      hostname === "youtu.be" ||
      hostname.endsWith(".youtube.com")
    ) {
      return "youtube";
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function providerLabel(provider: PostMusicAttachmentProvider): string {
  return provider === "spotify" ? "Spotify" : "YouTube";
}
