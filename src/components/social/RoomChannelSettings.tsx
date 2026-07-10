import {
  Archive,
  ChevronDown,
  ChevronUp,
  Hash,
  LoaderCircle,
  Megaphone,
  Plus,
  Save,
  WifiOff,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createRoomChannel,
  getRoomChannels,
  updateRoomChannel,
} from "../../lib/api";
import { cn } from "../../lib/classNames";
import type { RoomChannel } from "../../lib/types";
import { useAuth } from "../../lib/useAuth";
import { Button } from "../ui/Button";
import { SelectField, TextareaField, TextField } from "../ui/Field";
import { CompactStateNotice } from "../ui/RouteState";

type RoomChannelSettingsProps = {
  disabled?: boolean;
  onChannelsChanged?: () => void;
  roomSlug: string;
};

type ChannelDraft = {
  description: string;
  kind: RoomChannel["kind"];
  name: string;
  readOnly: boolean;
};

type ChannelAction =
  | "create"
  | `archive:${string}`
  | `move:${string}`
  | `save:${string}`;

const channelKindOptions = [
  { value: "chat", label: "Chat" },
  { value: "announcement", label: "Announcement" },
];

export function RoomChannelSettings({
  disabled = false,
  onChannelsChanged,
  roomSlug,
}: RoomChannelSettingsProps) {
  const { runWithAuth, status } = useAuth();
  const latestLoadRequestRef = useRef(0);
  const [channels, setChannels] = useState<RoomChannel[]>([]);
  const [activeChannelSlug, setActiveChannelSlug] = useState<string | undefined>();
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | undefined>();
  const [actionError, setActionError] = useState<string | undefined>();
  const [actionMessage, setActionMessage] = useState<string | undefined>();
  const [pendingAction, setPendingAction] = useState<ChannelAction | undefined>();
  const orderedChannels = useMemo(
    () => [...channels].sort(sortRoomChannels),
    [channels],
  );
  const activeChannel =
    orderedChannels.find((channel) => channel.slug === activeChannelSlug) ??
    orderedChannels[0];
  const activeIndex = activeChannel
    ? orderedChannels.findIndex((channel) => channel.id === activeChannel.id)
    : -1;
  const busy = disabled || pendingAction !== undefined;

  const loadChannels = useCallback(async () => {
    const requestId = latestLoadRequestRef.current + 1;
    latestLoadRequestRef.current = requestId;

    if (status !== "authenticated") {
      setChannels([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(undefined);

    try {
      const loadedChannels = await getRoomChannels(roomSlug);

      if (latestLoadRequestRef.current !== requestId) {
        return;
      }

      setChannels(loadedChannels);
      setActiveChannelSlug((current) =>
        current && loadedChannels.some((channel) => channel.slug === current)
          ? current
          : loadedChannels[0]?.slug,
      );
    } catch (caught) {
      if (latestLoadRequestRef.current === requestId) {
        setLoadError(
          caught instanceof Error ? caught.message : "Chat channels could not load.",
        );
      }
    } finally {
      if (latestLoadRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [roomSlug, status]);

  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (active) {
        void loadChannels();
      }
    });

    return () => {
      active = false;
      latestLoadRequestRef.current += 1;
    };
  }, [loadChannels]);

  function selectChannel(channelSlug: string) {
    setCreating(false);
    setActiveChannelSlug(channelSlug);
    setActionError(undefined);
    setActionMessage(undefined);
  }

  async function handleCreate(draft: ChannelDraft) {
    setPendingAction("create");
    clearActionFeedback();

    try {
      const created = await runWithAuth(
        (csrfToken) =>
          createRoomChannel(
            roomSlug,
            {
              name: draft.name,
              description: draft.description.trim() || null,
              kind: draft.kind,
              readOnly: draft.readOnly,
            },
            csrfToken,
          ),
        { retryOnCsrf: true },
      );

      setChannels((current) => upsertRoomChannel(current, created));
      setActiveChannelSlug(created.slug);
      setCreating(false);
      setActionMessage("Channel created");
      onChannelsChanged?.();
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "Channel could not be created.",
      );
    } finally {
      setPendingAction(undefined);
    }
  }

  async function handleSave(channel: RoomChannel, draft: ChannelDraft) {
    setPendingAction(`save:${channel.slug}`);
    clearActionFeedback();

    try {
      const updated = await runWithAuth(
        (csrfToken) =>
          updateRoomChannel(
            roomSlug,
            channel.slug,
            {
              name: draft.name,
              description: draft.description.trim() || null,
              kind: draft.kind,
              readOnly: draft.readOnly,
            },
            csrfToken,
          ),
        { retryOnCsrf: true },
      );

      setChannels((current) => upsertRoomChannel(current, updated));
      setActiveChannelSlug(updated.slug);
      setActionMessage("Channel updated");
      onChannelsChanged?.();
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "Channel could not be saved.",
      );
    } finally {
      setPendingAction(undefined);
    }
  }

  async function handleMove(channel: RoomChannel, direction: -1 | 1) {
    const channelIndex = orderedChannels.findIndex((item) => item.id === channel.id);
    const neighbor = orderedChannels[channelIndex + direction];

    if (!neighbor) {
      return;
    }

    setPendingAction(`move:${channel.slug}`);
    clearActionFeedback();

    try {
      const [updatedChannel, updatedNeighbor] = await runWithAuth(
        async (csrfToken) => {
          const movedChannel = await updateRoomChannel(
            roomSlug,
            channel.slug,
            { position: neighbor.position },
            csrfToken,
          );

          try {
            const movedNeighbor = await updateRoomChannel(
              roomSlug,
              neighbor.slug,
              { position: channel.position },
              csrfToken,
            );

            return [movedChannel, movedNeighbor] as const;
          } catch (caught) {
            await updateRoomChannel(
              roomSlug,
              channel.slug,
              { position: channel.position },
              csrfToken,
            ).catch(() => undefined);
            throw caught;
          }
        },
        { retryOnCsrf: true },
      );

      setChannels((current) =>
        upsertRoomChannel(
          upsertRoomChannel(current, updatedChannel),
          updatedNeighbor,
        ),
      );
      setActionMessage("Channel order updated");
      onChannelsChanged?.();
    } catch (caught) {
      await loadChannels();
      setActionError(
        caught instanceof Error
          ? `${caught.message} The current channel order was reloaded.`
          : "Channel order could not be saved. The current order was reloaded.",
      );
    } finally {
      setPendingAction(undefined);
    }
  }

  async function handleArchive(channel: RoomChannel) {
    setPendingAction(`archive:${channel.slug}`);
    clearActionFeedback();

    try {
      await runWithAuth(
        (csrfToken) =>
          updateRoomChannel(
            roomSlug,
            channel.slug,
            { archived: true },
            csrfToken,
          ),
        { retryOnCsrf: true },
      );

      setChannels((current) =>
        current.filter((item) => item.id !== channel.id),
      );
      setActiveChannelSlug(undefined);
      setActionMessage("Channel archived");
      onChannelsChanged?.();
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "Channel could not be archived.",
      );
    } finally {
      setPendingAction(undefined);
    }
  }

  function clearActionFeedback() {
    setActionError(undefined);
    setActionMessage(undefined);
  }

  return (
    <section
      className="space-y-3 rounded-card border border-line bg-canvas/45 p-4"
      data-testid="room-channel-settings"
      aria-labelledby="room-channel-settings-title"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Hash aria-hidden="true" size={17} className="text-muted" />
            <h3
              id="room-channel-settings-title"
              className="text-sm font-semibold text-text"
            >
              Chat channels
            </h3>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted">
            Organize conversations inside this room. Channel changes save immediately.
          </p>
        </div>
        <Button
          type="button"
          variant={creating ? "secondary" : "primary"}
          size="sm"
          className="w-full shrink-0 sm:w-auto"
          data-testid="room-channel-settings-add"
          disabled={busy || loading || Boolean(loadError)}
          icon={<Plus aria-hidden="true" size={15} />}
          onClick={() => {
            setCreating((current) => !current);
            clearActionFeedback();
          }}
        >
          {creating ? "Cancel new channel" : "Add channel"}
        </Button>
      </div>

      {loading ? (
        <CompactStateNotice
          icon={LoaderCircle}
          kind="loading"
          title="Loading chat channels"
          text="Loading channels."
        />
      ) : null}

      {loadError ? (
        <CompactStateNotice
          icon={WifiOff}
          kind="error"
          title="Chat channels are not available"
          text={loadError}
          actions={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => void loadChannels()}
            >
              Retry
            </Button>
          }
        />
      ) : null}

      {!loading && !loadError && orderedChannels.length === 0 && !creating ? (
        <CompactStateNotice
          icon={Hash}
          title="No chat channels"
          text="Add a channel to start room chat."
        />
      ) : null}

      {!loading && !loadError && (orderedChannels.length > 0 || creating) ? (
        <div className="grid gap-3 sm:grid-cols-[minmax(10rem,12rem)_minmax(0,1fr)]">
          <div
            className="flex gap-2 overflow-x-auto pb-1 sm:block sm:space-y-1 sm:overflow-visible sm:pb-0"
            aria-label="Chat channels"
          >
            {orderedChannels.map((channel) => (
              <ChannelSelectButton
                key={channel.id}
                channel={channel}
                disabled={busy}
                selected={!creating && channel.id === activeChannel?.id}
                onSelect={() => selectChannel(channel.slug)}
              />
            ))}
          </div>

          <div className="min-w-0">
            {creating ? (
              <ChannelEditor
                key="new-channel"
                busy={busy}
                mode="create"
                onCreate={handleCreate}
              />
            ) : activeChannel ? (
              <ChannelEditor
                key={`${activeChannel.id}:${activeChannel.updatedAt ?? ""}`}
                busy={busy}
                canArchive={orderedChannels.length > 1}
                canMoveDown={activeIndex >= 0 && activeIndex < orderedChannels.length - 1}
                canMoveUp={activeIndex > 0}
                channel={activeChannel}
                mode="edit"
                onArchive={() => void handleArchive(activeChannel)}
                onMove={(direction) => void handleMove(activeChannel, direction)}
                onSave={(draft) => void handleSave(activeChannel, draft)}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {actionError ? (
        <p
          className="rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink"
          data-testid="room-channel-settings-status"
          role="alert"
        >
          {actionError}
        </p>
      ) : null}
      {actionMessage ? (
        <p
          className="rounded-card border border-leaf/30 bg-leaf/12 p-3 text-sm text-leaf-ink"
          data-testid="room-channel-settings-status"
          role="status"
        >
          {actionMessage}
        </p>
      ) : null}
    </section>
  );
}

function ChannelSelectButton({
  channel,
  disabled,
  onSelect,
  selected,
}: {
  channel: RoomChannel;
  disabled: boolean;
  onSelect: () => void;
  selected: boolean;
}) {
  const Icon = channel.kind === "announcement" ? Megaphone : Hash;

  return (
    <button
      type="button"
      className={cn(
        "flex min-h-10 w-40 shrink-0 items-center gap-2 rounded-control px-2.5 py-2 text-left text-sm transition duration-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:w-full",
        selected
          ? "bg-surface-strong text-text shadow-inner-soft"
          : "text-muted hover:bg-surface/75 hover:text-text",
        disabled && "cursor-not-allowed opacity-55",
      )}
      aria-pressed={selected}
      data-testid={`room-channel-settings-channel-${channel.slug}`}
      disabled={disabled}
      onClick={onSelect}
    >
      <Icon aria-hidden="true" size={15} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate font-medium">{channel.name}</span>
    </button>
  );
}

function ChannelEditor({
  busy,
  canArchive = false,
  canMoveDown = false,
  canMoveUp = false,
  channel,
  mode,
  onArchive,
  onCreate,
  onMove,
  onSave,
}: {
  busy: boolean;
  canArchive?: boolean;
  canMoveDown?: boolean;
  canMoveUp?: boolean;
  channel?: RoomChannel;
  mode: "create" | "edit";
  onArchive?: () => void;
  onCreate?: (draft: ChannelDraft) => void;
  onMove?: (direction: -1 | 1) => void;
  onSave?: (draft: ChannelDraft) => void;
}) {
  const editorId = useId();
  const [draft, setDraft] = useState<ChannelDraft>(() => channelToDraft(channel));
  const name = draft.name.trim();
  const title = mode === "create" ? "New channel" : `Edit #${channel?.slug ?? "channel"}`;
  const fieldPrefix = `${editorId}-${mode}`;

  function updateDraft<K extends keyof ChannelDraft>(
    field: K,
    value: ChannelDraft[K],
  ) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  return (
    <div
      className="space-y-3 rounded-card border border-line bg-surface/72 p-3"
      data-testid={mode === "create" ? "room-channel-create" : "room-channel-editor"}
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-text">{title}</h4>
        {mode === "edit" ? (
          <div className="flex gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8"
              aria-label={`Move #${channel?.slug ?? "channel"} up`}
              title="Move channel up"
              disabled={busy || !canMoveUp}
              icon={<ChevronUp aria-hidden="true" size={15} />}
              onClick={() => onMove?.(-1)}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8"
              aria-label={`Move #${channel?.slug ?? "channel"} down`}
              title="Move channel down"
              disabled={busy || !canMoveDown}
              icon={<ChevronDown aria-hidden="true" size={15} />}
              onClick={() => onMove?.(1)}
            />
          </div>
        ) : null}
      </div>

      <TextField
        id={`${fieldPrefix}-name`}
        label={mode === "create" ? "New channel name" : "Channel name"}
        density="compact"
        maxLength={80}
        value={draft.name}
        disabled={busy}
        onChange={(event) => updateDraft("name", event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
          }
        }}
      />
      <TextareaField
        id={`${fieldPrefix}-description`}
        label="Channel description"
        density="compact"
        className="min-h-20"
        maxLength={240}
        value={draft.description}
        disabled={busy}
        onChange={(event) =>
          updateDraft("description", event.currentTarget.value)
        }
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          id={`${fieldPrefix}-kind`}
          label="Channel kind"
          density="compact"
          options={channelKindOptions}
          value={draft.kind}
          disabled={busy}
          onChange={(event) =>
            updateDraft(
              "kind",
              event.currentTarget.value === "announcement"
                ? "announcement"
                : "chat",
            )
          }
        />
        <label className="flex min-h-10 items-center gap-2 self-end rounded-card border border-line bg-canvas/55 px-3 text-sm font-medium text-muted shadow-inner-soft">
          <input
            type="checkbox"
            checked={draft.readOnly}
            disabled={busy}
            onChange={(event) =>
              updateDraft("readOnly", event.currentTarget.checked)
            }
          />
          Staff-only posting
        </label>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {mode === "edit" ? (
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={busy || !canArchive}
            icon={<Archive aria-hidden="true" size={15} />}
            onClick={onArchive}
          >
            Archive channel
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          disabled={busy || name === ""}
          icon={
            mode === "create" ? (
              <Plus aria-hidden="true" size={15} />
            ) : (
              <Save aria-hidden="true" size={15} />
            )
          }
          onClick={() => {
            if (mode === "create") {
              onCreate?.({ ...draft, name });
              return;
            }

            onSave?.({ ...draft, name });
          }}
        >
          {mode === "create" ? "Create channel" : "Save channel"}
        </Button>
      </div>
    </div>
  );
}

function channelToDraft(channel: RoomChannel | undefined): ChannelDraft {
  return {
    name: channel?.name ?? "",
    description: channel?.description ?? "",
    kind: channel?.kind ?? "chat",
    readOnly: channel?.readOnly ?? false,
  };
}

function sortRoomChannels(first: RoomChannel, second: RoomChannel): number {
  if (first.position !== second.position) {
    return first.position - second.position;
  }

  return first.id - second.id;
}

function upsertRoomChannel(
  channels: RoomChannel[],
  channel: RoomChannel,
): RoomChannel[] {
  const exists = channels.some((item) => item.id === channel.id);
  const next = exists
    ? channels.map((item) => (item.id === channel.id ? channel : item))
    : [...channels, channel];

  return next
    .filter((item) => item.archivedAt === null || item.archivedAt === undefined)
    .sort(sortRoomChannels);
}
