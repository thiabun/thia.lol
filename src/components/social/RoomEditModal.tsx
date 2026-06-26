import type { ChangeEvent, FormEvent } from "react";
import { useId, useState } from "react";
import {
  AlertTriangle,
  Hash,
  ImagePlus,
  Plus,
  Radio,
  Save,
  Shield,
  Trash2,
} from "lucide-react";
import { Button } from "../ui/Button";
import { HandleField, TextareaField, TextField } from "../ui/Field";
import { ImageCropModal } from "../ui/ImageCropModal";
import { ModalSheet, ModalSheetStatus } from "../ui/ModalSheet";
import { MarkdownEditor } from "./MarkdownEditor";
import { ThemeAppearanceControl } from "./ThemeAppearanceControl";
import { UserIdentityLink } from "./UserProfileLink";
import { prepareImageFileForCrop } from "../../lib/imageCrop";
import { imageUploadAccept } from "../../lib/mediaFormats";
import type {
  ImageUploadPurpose,
  RoomInput,
  UploadedImage,
} from "../../lib/api";
import type {
  ProfileThemeConfig,
  Room,
  RoomMember,
  RoomVisibility,
} from "../../lib/types";

type RoomEditModalProps = {
  mode: "create" | "edit";
  open: boolean;
  room?: Room | undefined;
  members?: RoomMember[];
  canManageModerators?: boolean;
  canDeleteRoom?: boolean;
  onClose: () => void;
  onSave: (input: RoomInput) => Promise<Room>;
  onPrepareImage: (file: File, purpose: ImageUploadPurpose) => Promise<File>;
  onUpload: (file: File, purpose: ImageUploadPurpose) => Promise<UploadedImage>;
  onAddModerator?: (handle: string) => Promise<void>;
  onRemoveModerator?: (handle: string) => Promise<void>;
  onDeleteRoom?: () => Promise<void>;
};

type UploadSlot = "room_icon" | "room_banner";

type FormState = {
  name: string;
  slug: string;
  summary: string;
  theme: string | null;
  themeConfig: ProfileThemeConfig | null;
  iconUrl: string;
  bannerUrl: string;
  rules: string;
  visibility: RoomVisibility;
};

const roomVisibilityOptions: Array<{
  value: RoomVisibility;
  label: string;
  description: string;
}> = [
  {
    value: "public",
    label: "Public",
    description: "Listed, joinable, and open for signed-in posting.",
  },
  {
    value: "private",
    label: "Private",
    description: "Hidden unless someone is already a member.",
  },
  {
    value: "invite",
    label: "Invite",
    description: "Listed as a requestable shell until staff approve access.",
  },
  {
    value: "view_only",
    label: "View-only",
    description: "Readable and reactable, with posting limited to staff.",
  },
];

export function RoomEditModal({
  mode,
  canDeleteRoom = false,
  canManageModerators = false,
  members = [],
  onAddModerator,
  onClose,
  onDeleteRoom,
  onRemoveModerator,
  onSave,
  onPrepareImage,
  onUpload,
  open,
  room,
}: RoomEditModalProps) {
  const formId = useId();
  const [form, setForm] = useState<FormState>(() => roomToForm(room));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<UploadSlot | undefined>();
  const [pendingImageCrop, setPendingImageCrop] = useState<
    { file: File; slot: UploadSlot } | undefined
  >();
  const [message, setMessage] = useState<string | undefined>();
  const [moderatorHandle, setModeratorHandle] = useState("");
  const [moderatorPending, setModeratorPending] = useState<string | undefined>();
  const [moderatorMessage, setModeratorMessage] = useState<string | undefined>();
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletePending, setDeletePending] = useState(false);
  const busy = saving || uploading !== undefined || deletePending;
  const moderators = members.filter((member) => member.role === "moderator");
  const owner = members.find((member) => member.role === "owner");
  const messageTone = message === "Image uploaded" ? "success" : "error";

  function closeEditor() {
    setPendingImageCrop(undefined);
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(undefined);

    try {
      const input: RoomInput = {
        name: form.name,
        summary: form.summary,
        theme: form.theme,
        themeConfig: form.themeConfig,
        iconUrl: form.iconUrl || null,
        bannerUrl: form.bannerUrl || null,
        rules: form.rules || null,
        visibility: form.visibility,
      };

      if (mode === "create") {
        input.slug = form.slug;
      }

      const saved = await onSave(input);

      setForm(roomToForm(saved));
      setMessage(mode === "create" ? "Room created" : "Room updated");
      closeEditor();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Room could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function handleImageChange(
    event: ChangeEvent<HTMLInputElement>,
    slot: UploadSlot,
  ) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    setMessage(undefined);

    try {
      const prepared = await prepareImageFileForCrop(file, slot, onPrepareImage);
      setPendingImageCrop({ file: prepared, slot });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Image could not be prepared.");
    }
  }

  async function uploadCroppedImage(file: File) {
    if (!pendingImageCrop) {
      return;
    }

    const slot = pendingImageCrop.slot;
    setUploading(slot);
    setMessage(undefined);

    try {
      const uploaded = await onUpload(file, slot);
      updateForm(slot === "room_icon" ? "iconUrl" : "bannerUrl", uploaded.url);
      setPendingImageCrop(undefined);
      setMessage("Image uploaded");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Image could not be uploaded.";
      setMessage(message);
      throw error;
    } finally {
      setUploading(undefined);
    }
  }

  function updateForm<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateName(value: string) {
    setForm((current) => ({
      ...current,
      name: value,
      slug: mode === "create" ? slugFromName(value) : current.slug,
    }));
  }

  function applyRoomThemeConfig(config: ProfileThemeConfig | null) {
    setForm((current) => ({
      ...current,
      theme:
        config?.mode === "preset"
          ? config.preset
          : config?.mode === "custom"
            ? "custom"
            : null,
      themeConfig: config,
    }));
  }

  async function handleAddModerator() {
    if (!onAddModerator) {
      return;
    }

    setModeratorPending("add");
    setModeratorMessage(undefined);

    try {
      await onAddModerator(moderatorHandle);
      setModeratorHandle("");
      setModeratorMessage("Moderator added");
    } catch (error) {
      setModeratorMessage(error instanceof Error ? error.message : "Moderator could not be added.");
    } finally {
      setModeratorPending(undefined);
    }
  }

  async function handleRemoveModerator(handle: string) {
    if (!onRemoveModerator) {
      return;
    }

    setModeratorPending(handle);
    setModeratorMessage(undefined);

    try {
      await onRemoveModerator(handle);
      setModeratorMessage("Moderator removed");
    } catch (error) {
      setModeratorMessage(
        error instanceof Error ? error.message : "Moderator could not be removed.",
      );
    } finally {
      setModeratorPending(undefined);
    }
  }

  async function handleDeleteRoom() {
    if (!onDeleteRoom) {
      return;
    }

    setDeletePending(true);
    setMessage(undefined);

    try {
      await onDeleteRoom();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Room could not be deleted.");
      setDeletePending(false);
    }
  }

  return (
    <>
      <ModalSheet
        open={open}
        onClose={closeEditor}
        title={mode === "create" ? "Create room" : "Edit room"}
        closeLabel="Close room editor"
        testId="room-edit-modal"
        size="lg"
        mobile="full"
        busy={busy}
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={closeEditor}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form={formId}
              disabled={busy}
              icon={<Save aria-hidden="true" size={17} />}
            >
              {saving ? "Saving" : mode === "create" ? "Create room" : "Save changes"}
            </Button>
          </div>
        }
      >
        <form id={formId} className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <ImageUploadControl
              id="room-icon-upload"
              imageUrl={form.iconUrl}
              label="Change icon"
              uploading={uploading === "room_icon"}
              onChange={(event) => void handleImageChange(event, "room_icon")}
            />
            <ImageUploadControl
              id="room-banner-upload"
              imageUrl={form.bannerUrl}
              label="Change banner"
              wide
              uploading={uploading === "room_banner"}
              onChange={(event) => void handleImageChange(event, "room_banner")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="room-name"
              label="Name"
              icon={Radio}
              maxLength={80}
              required
              value={form.name}
              disabled={busy}
              onChange={(event) => updateName(event.currentTarget.value)}
            />
            <TextField
              id="room-slug"
              label="Slug"
              icon={Hash}
              maxLength={80}
              required={mode === "create"}
              disabled={busy || mode === "edit"}
              value={form.slug}
              onChange={(event) =>
                updateForm("slug", event.currentTarget.value.toLowerCase())
              }
            />
          </div>

          <TextareaField
            id="room-summary"
            label="Summary"
            className="min-h-28"
            maxLength={500}
            required
            value={form.summary}
            disabled={busy}
            onChange={(event) => updateForm("summary", event.currentTarget.value)}
          />

          <ThemeAppearanceControl
            config={form.themeConfig}
            controlAttribute="data-room-edit-control"
            description="Override Sunveil/Frostveil while people view this room."
            label="Theme"
            previewTitle={form.name || "Room"}
            previewSubtitle={`/${form.slug || "room"}`}
            previewLinkLabel="Room link"
            testIdKind="room"
            onChange={applyRoomThemeConfig}
          />

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-text">Visibility</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {roomVisibilityOptions.map((option) => (
                <label
                  key={option.value}
                  className="cursor-pointer rounded-card border border-line bg-canvas/45 p-3 transition duration-fluid has-[:checked]:border-accent/55 has-[:checked]:bg-accent/10 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="room-visibility"
                    value={option.value}
                    checked={form.visibility === option.value}
                    disabled={busy}
                    onChange={() => updateForm("visibility", option.value)}
                  />
                  <span className="block text-sm font-semibold text-text">{option.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted">{option.description}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <MarkdownEditor
            label="Room rules"
            className="rounded-card border border-line bg-surface/45 p-3"
            maxLength={3000}
            value={form.rules}
            disabled={busy}
            placeholder="Write room rules with Markdown, @mentions, and HTTPS links."
            textareaTestId="room-rules"
            onValueChange={(value) => updateForm("rules", value)}
          />

          {mode === "edit" ? (
            <section className="space-y-3 rounded-card border border-line bg-canvas/45 p-4">
              <div className="flex items-center gap-2">
                <Shield aria-hidden="true" size={17} className="text-muted" />
                <h3 className="text-sm font-semibold text-text">Moderators</h3>
              </div>
              {owner ? <RoomMemberSettingsRow member={owner} /> : null}
              {moderators.map((member) => (
                <RoomMemberSettingsRow
                  key={member.id}
                  member={member}
                  pending={moderatorPending === member.user.handle}
                  canRemove={canManageModerators}
                  onRemove={() => void handleRemoveModerator(member.user.handle)}
                />
              ))}
              {moderators.length === 0 ? (
                <p className="text-sm text-muted">No room moderators yet.</p>
              ) : null}

              {canManageModerators ? (
                <div className="grid gap-3 border-t border-line pt-3 sm:grid-cols-[1fr_auto]">
                  <HandleField
                    id="room-moderator-handle"
                    label="Add moderator by handle"
                    value={moderatorHandle}
                    placeholder="handle"
                    maxLength={41}
                    disabled={busy || moderatorPending !== undefined}
                    onChange={(event) => setModeratorHandle(event.currentTarget.value)}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="self-end"
                    disabled={
                      busy ||
                      moderatorPending !== undefined ||
                      moderatorHandle.trim() === ""
                    }
                    icon={<Plus aria-hidden="true" size={15} />}
                    onClick={() => void handleAddModerator()}
                  >
                    {moderatorPending === "add" ? "Adding" : "Add"}
                  </Button>
                </div>
              ) : null}

              {moderatorMessage ? (
                <ModalSheetStatus tone={moderatorStatusTone(moderatorMessage)}>
                  {moderatorMessage}
                </ModalSheetStatus>
              ) : null}
            </section>
          ) : null}

          {mode === "edit" && canDeleteRoom ? (
            <section className="space-y-3 rounded-card border border-rose/35 bg-rose/10 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle aria-hidden="true" size={17} className="text-rose" />
                <h3 className="text-sm font-semibold text-rose-ink">Delete room</h3>
              </div>
              <p className="text-sm leading-6 text-rose-ink">
                This hides the room from public pages and keeps posts, memberships,
                and moderation history for review.
              </p>
              <TextField
                id="room-delete-confirm"
                label={`Type /${room?.slug ?? "room"} to confirm`}
                value={deleteConfirm}
                disabled={busy}
                onChange={(event) => setDeleteConfirm(event.currentTarget.value)}
              />
              <Button
                type="button"
                variant="secondary"
                className="border-rose/40 bg-rose/15 text-rose-ink hover:border-rose/60"
                disabled={busy || deleteConfirm !== `/${room?.slug ?? ""}`}
                icon={<Trash2 aria-hidden="true" size={16} />}
                onClick={() => void handleDeleteRoom()}
              >
                {deletePending ? "Deleting" : "Delete room"}
              </Button>
            </section>
          ) : null}

          {message ? (
            <ModalSheetStatus tone={messageTone}>{message}</ModalSheetStatus>
          ) : null}
        </form>
      </ModalSheet>
      <ImageCropModal
        open={Boolean(pendingImageCrop)}
        file={pendingImageCrop?.file}
        purpose={pendingImageCrop?.slot ?? "room_icon"}
        busy={Boolean(uploading)}
        onClose={() => setPendingImageCrop(undefined)}
        onApply={uploadCroppedImage}
      />
    </>
  );
}

function RoomMemberSettingsRow({
  canRemove = false,
  member,
  onRemove,
  pending = false,
}: {
  canRemove?: boolean;
  member: RoomMember;
  onRemove?: () => void;
  pending?: boolean;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-card border border-line bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
      <UserIdentityLink
        user={member.user}
        showAvatar={false}
        className="flex-1"
      />
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase text-muted">{member.role}</span>
        {canRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove @${member.user.handle} as moderator`}
            title="Remove moderator"
            disabled={pending}
            icon={<Trash2 aria-hidden="true" size={15} />}
            onClick={onRemove}
          />
        ) : null}
      </div>
    </div>
  );
}

type ImageUploadControlProps = {
  id: string;
  imageUrl: string;
  label: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  uploading: boolean;
  wide?: boolean;
};

function ImageUploadControl({
  id,
  imageUrl,
  label,
  onChange,
  uploading,
  wide = false,
}: ImageUploadControlProps) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-text">
        <ImagePlus aria-hidden="true" size={16} />
        {label}
      </div>
      <div className="flex items-center gap-3 rounded-card border border-line bg-canvas/55 p-3">
        {imageUrl ? (
          <img
            alt=""
            className={
              wide
                ? "h-20 w-32 rounded-card object-cover"
                : "size-20 rounded-full object-cover"
            }
            src={imageUrl}
          />
        ) : (
          <div
            className={
              wide
                ? "grid h-20 w-32 place-items-center rounded-card border border-dashed border-line bg-surface-strong text-muted"
                : "grid size-20 place-items-center rounded-full border border-dashed border-line bg-surface-strong text-muted"
            }
          >
            <ImagePlus aria-hidden="true" size={20} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <label
            className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-control border border-line bg-surface px-3 text-sm font-medium text-text shadow-soft transition duration-fluid hover:border-line-strong focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus"
            htmlFor={id}
          >
            <ImagePlus aria-hidden="true" size={16} />
            {uploading ? "Uploading" : label}
          </label>
          <input
            id={id}
            className="sr-only"
            type="file"
            accept={imageUploadAccept}
            disabled={uploading}
            onChange={onChange}
          />
          <p className="mt-2 text-xs leading-5 text-muted">
            Image must be 10 MB or smaller.
          </p>
        </div>
      </div>
    </div>
  );
}

function roomToForm(room: Room | undefined): FormState {
  return {
    name: room?.name ?? "",
    slug: room?.slug ?? "",
    summary: room?.summary ?? "",
    theme: room?.theme ?? null,
    themeConfig: room?.themeConfig ?? null,
    iconUrl: room?.iconUrl ?? "",
    bannerUrl: room?.bannerUrl ?? "",
    rules: room?.rules ?? "",
    visibility: room?.visibility ?? "public",
  };
}

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function moderatorStatusTone(message: string) {
  return message === "Moderator added" || message === "Moderator removed"
    ? "success"
    : "error";
}
