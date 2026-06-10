import { AnimatePresence, motion } from "motion/react";
import type { ChangeEvent, FormEvent } from "react";
import { useId, useState } from "react";
import { Hash, ImagePlus, Palette, Radio, Save, ScrollText, X } from "lucide-react";
import { Button } from "../ui/Button";
import { SelectField, TextareaField, TextField } from "../ui/Field";
import { modalOverlay, modalPanel } from "../../lib/motionPresets";
import type {
  ImageUploadPurpose,
  RoomInput,
  UploadedImage,
} from "../../lib/api";
import type { Room } from "../../lib/types";

const maxUploadBytes = 10 * 1024 * 1024;
const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];

type RoomEditModalProps = {
  mode: "create" | "edit";
  open: boolean;
  room?: Room | undefined;
  onClose: () => void;
  onSave: (input: RoomInput) => Promise<Room>;
  onUpload: (file: File, purpose: ImageUploadPurpose) => Promise<UploadedImage>;
};

type UploadSlot = "room_icon" | "room_banner";

type FormState = {
  name: string;
  slug: string;
  summary: string;
  mood: string;
  accent: string;
  iconUrl: string;
  bannerUrl: string;
  rules: string;
};

export function RoomEditModal({
  mode,
  onClose,
  onSave,
  onUpload,
  open,
  room,
}: RoomEditModalProps) {
  const titleId = useId();
  const [form, setForm] = useState<FormState>(() => roomToForm(room));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<UploadSlot | undefined>();
  const [message, setMessage] = useState<string | undefined>();
  const busy = saving || uploading !== undefined;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(undefined);

    try {
      const input: RoomInput = {
        name: form.name,
        summary: form.summary,
        mood: form.mood || null,
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
            if (event.target === event.currentTarget && !busy) {
              onClose();
            }
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-testid="room-edit-modal"
            className="max-h-[calc(100dvh-3rem)] w-full max-w-2xl overflow-y-auto rounded-panel border border-line bg-surface p-4 shadow-lift sm:p-5"
            variants={modalPanel}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id={titleId} className="text-lg font-semibold text-text">
                  {mode === "create" ? "Create room" : "Edit room"}
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Public rooms can be joined and posted in by members.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close room editor"
                title="Close"
                icon={<X aria-hidden="true" size={18} />}
                disabled={busy}
                onClick={onClose}
              />
            </div>

            <form className="mt-5 space-y-5" onSubmit={handleSubmit}>
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

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  id="room-mood"
                  label="Mood"
                  maxLength={40}
                  value={form.mood}
                  disabled={busy}
                  onChange={(event) => updateForm("mood", event.currentTarget.value)}
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
              </div>

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

              {message ? (
                <p className="rounded-card border border-line bg-canvas/55 p-3 text-sm text-text">
                  {message}
                </p>
              ) : null}

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
                  disabled={busy}
                  icon={<Save aria-hidden="true" size={17} />}
                >
                  {saving ? "Saving" : mode === "create" ? "Create room" : "Save changes"}
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
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
                ? "grid h-20 w-32 place-items-center rounded-card bg-ambient-texture text-muted"
                : "grid size-20 place-items-center rounded-full bg-ambient-texture text-muted"
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
    mood: room?.mood ?? "",
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
