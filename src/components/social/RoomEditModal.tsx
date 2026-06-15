import type { ChangeEvent, FormEvent } from "react";
import { useId, useState } from "react";
import {
  AlertTriangle,
  Hash,
  ImagePlus,
  Palette,
  Plus,
  Radio,
  Save,
  ScrollText,
  Shield,
  Trash2,
} from "lucide-react";
import { Button } from "../ui/Button";
import { SelectField, TextareaField, TextField } from "../ui/Field";
import { ModalSheet, ModalSheetStatus } from "../ui/ModalSheet";
import { UserIdentityLink } from "./UserProfileLink";
import type {
  ImageUploadPurpose,
  RoomInput,
  UploadedImage,
} from "../../lib/api";
import type { Room, RoomMember } from "../../lib/types";

const maxUploadBytes = 10 * 1024 * 1024;
const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];

type RoomEditModalProps = {
  mode: "create" | "edit";
  open: boolean;
  room?: Room | undefined;
  members?: RoomMember[];
  canManageModerators?: boolean;
  canDeleteRoom?: boolean;
  onClose: () => void;
  onSave: (input: RoomInput) => Promise<Room>;
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
  accent: string;
  iconUrl: string;
  bannerUrl: string;
  rules: string;
};

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
  onUpload,
  open,
  room,
}: RoomEditModalProps) {
  const formId = useId();
  const [form, setForm] = useState<FormState>(() => roomToForm(room));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<UploadSlot | undefined>();
  const [message, setMessage] = useState<string | undefined>();
  const [moderatorHandle, setModeratorHandle] = useState("");
  const [moderatorPending, setModeratorPending] = useState<string | undefined>();
  const [moderatorMessage, setModeratorMessage] = useState<string | undefined>();
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletePending, setDeletePending] = useState(false);
  const busy = saving || uploading !== undefined || deletePending;
  const moderators = members.filter((member) => member.role === "moderator");
  const owner = members.find((member) => member.role === "owner");
  const messageTone = message === "Images are converted to WebP" ? "success" : "error";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(undefined);

    try {
      const input: RoomInput = {
        name: form.name,
        summary: form.summary,
        accent: form.accent || null,
        iconUrl: form.iconUrl || null,
        bannerUrl: form.bannerUrl || null,
        rules: form.rules || null,
      };

      if (mode === "create") {
        input.slug = form.slug;
      }

      const saved = await onSave(input);

      setForm(roomToForm(saved));
      setMessage(mode === "create" ? "Room created" : "Room updated");
      onClose();
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

    if (file.size > maxUploadBytes) {
      setMessage("Image must be 10 MB or smaller");
      return;
    }

    if (!acceptedTypes.includes(file.type)) {
      setMessage("Unsupported image type. Use JPEG, PNG, or WebP.");
      return;
    }

    setUploading(slot);
    setMessage(undefined);

    try {
      const uploaded = await onUpload(file, slot);
      updateForm(slot === "room_icon" ? "iconUrl" : "bannerUrl", uploaded.url);
      setMessage("Images are converted to WebP");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Image could not be uploaded.");
    } finally {
      setUploading(undefined);
    }
  }

  function updateForm(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateName(value: string) {
    setForm((current) => ({
      ...current,
      name: value,
      slug: mode === "create" ? slugFromName(value) : current.slug,
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
    <ModalSheet
      open={open}
      onClose={onClose}
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
            onClick={onClose}
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

              <SelectField
                id="room-accent"
                label="Accent"
                icon={Palette}
                value={form.accent}
                disabled={busy}
                options={[
                  { value: "var(--accent-sun)", label: "Sunveil" },
                  { value: "var(--accent-frost)", label: "Frostveil" },
                  { value: "var(--accent-leaf)", label: "Leaf" },
                  { value: "var(--accent-rose)", label: "Rose" },
                  { value: "var(--app-accent)", label: "Default" },
                ]}
                onChange={(event) => updateForm("accent", event.currentTarget.value)}
              />

              <TextareaField
                id="room-rules"
                label="Room rules"
                icon={ScrollText}
                className="min-h-32"
                maxLength={3000}
                value={form.rules}
                disabled={busy}
                onChange={(event) => updateForm("rules", event.currentTarget.value)}
              />

              {mode === "edit" ? (
                <section className="space-y-3 rounded-card border border-line bg-canvas/45 p-4">
                  <div className="flex items-center gap-2">
                    <Shield aria-hidden="true" size={17} className="text-muted" />
                    <h3 className="text-sm font-semibold text-text">Moderators</h3>
                  </div>
                  {owner ? (
                    <RoomMemberSettingsRow member={owner} />
                  ) : null}
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
                      <TextField
                        id="room-moderator-handle"
                        label="Add moderator by handle"
                        value={moderatorHandle}
                        maxLength={40}
                        disabled={busy || moderatorPending !== undefined}
                        onChange={(event) =>
                          setModeratorHandle(event.currentTarget.value)
                        }
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
            accept="image/jpeg,image/png,image/webp"
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
    accent: room?.accent || "var(--accent-sun)",
    iconUrl: room?.iconUrl ?? "",
    bannerUrl: room?.bannerUrl ?? "",
    rules: room?.rules ?? "",
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
