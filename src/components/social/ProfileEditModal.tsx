import { AnimatePresence, motion } from "motion/react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useId, useState } from "react";
import {
  ImagePlus,
  MapPin,
  Plus,
  Save,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "../ui/Button";
import { SelectField, TextareaField, TextField } from "../ui/Field";
import { modalOverlay, modalPanel } from "../../lib/motionPresets";
import type {
  ImageUploadPurpose,
  UploadedImage,
  UpdateProfileInput,
} from "../../lib/api";
import type { Profile } from "../../lib/types";
import type {
  ProfileConnectionPlatform,
  ProfileExternalConnection,
} from "../../lib/types";
import {
  connectionPlatformLabel,
  connectionPlatformHelp,
  maxProfileConnections,
  profileConnectionPlatforms,
  validateProfileConnectionDraft,
} from "../../lib/profileConnections";

const maxUploadBytes = 10 * 1024 * 1024;
const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];

type ProfileEditModalProps = {
  open: boolean;
  profile: Profile;
  onClose: () => void;
  onSave: (input: UpdateProfileInput) => Promise<Profile>;
  onUpload: (file: File, purpose: ImageUploadPurpose) => Promise<UploadedImage>;
};

type UploadSlot = "avatar" | "banner" | "profile_background";

type FormState = {
  displayName: string;
  bio: string;
  location: string;
  avatarUrl: string;
  bannerUrl: string;
  profileBackground: string;
  connections: DraftConnection[];
};

type DraftConnection = {
  id: string;
  platform: ProfileConnectionPlatform;
  value: string;
};

export function ProfileEditModal({
  onClose,
  onSave,
  onUpload,
  open,
  profile,
}: ProfileEditModalProps) {
  const titleId = useId();
  const [form, setForm] = useState<FormState>(() => profileToForm(profile));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<UploadSlot | undefined>();
  const [message, setMessage] = useState<string | undefined>();
  const [connectionErrors, setConnectionErrors] = useState<Record<string, string>>({});
  const busy = saving || uploading !== undefined;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const links = normalizedConnections(form.connections);
    setConnectionErrors(links.errors);

    if (Object.keys(links.errors).length > 0) {
      setMessage("Fix the highlighted connections before saving.");
      return;
    }

    setSaving(true);
    setMessage(undefined);

    try {
      const updated = await onSave({
        displayName: form.displayName,
        bio: form.bio,
        location: form.location,
        avatarUrl: form.avatarUrl || null,
        bannerUrl: form.bannerUrl || null,
        profileBackground: form.profileBackground || null,
        links: links.connections,
      });

      setForm(profileToForm(updated));
      setMessage("Profile updated");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Profile could not be saved.");
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
      updateForm(uploadFieldName(slot), uploaded.url);
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

  function updateConnection(
    id: string,
    field: keyof Omit<DraftConnection, "id">,
    value: string,
  ) {
    setConnectionErrors((current) => {
      if (!current[id]) {
        return current;
      }

      const next = { ...current };
      delete next[id];
      return next;
    });
    setForm((current) => ({
      ...current,
      connections: current.connections.map((connection) =>
        connection.id === id ? { ...connection, [field]: value } : connection,
      ),
    }));
  }

  function addConnection() {
    setForm((current) => ({
      ...current,
      connections: [
        ...current.connections,
        {
          id: crypto.randomUUID(),
          platform: "website",
          value: "",
        },
      ],
    }));
  }

  function removeConnection(id: string) {
    setConnectionErrors((current) => {
      if (!current[id]) {
        return current;
      }

      const next = { ...current };
      delete next[id];
      return next;
    });
    setForm((current) => ({
      ...current,
      connections: current.connections.filter((connection) => connection.id !== id),
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
            data-testid="profile-edit-modal"
            className="max-h-[calc(100dvh-3rem)] w-full max-w-3xl overflow-y-auto rounded-panel border border-line bg-surface p-4 shadow-lift sm:p-6"
            variants={modalPanel}
          >
            <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
              <div>
                <h2 id={titleId} className="text-lg font-semibold text-text">
                  Edit profile
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Update the public identity, images, and connections shown on this profile.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close profile editor"
                title="Close"
                icon={<X aria-hidden="true" size={18} />}
                disabled={busy}
                onClick={onClose}
              />
            </div>

            <form className="mt-5 space-y-5" onSubmit={handleSubmit}>
              <EditorSection
                title="Profile images"
                description="Images are converted to WebP and shown across the profile layout."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <ImageUploadControl
                    id="profile-avatar-upload"
                    imageUrl={form.avatarUrl}
                    label="Change avatar"
                    uploading={uploading === "avatar"}
                    onChange={(event) => void handleImageChange(event, "avatar")}
                  />
                  <ImageUploadControl
                    id="profile-banner-upload"
                    imageUrl={form.bannerUrl}
                    label="Change banner"
                    wide
                    uploading={uploading === "banner"}
                    onChange={(event) => void handleImageChange(event, "banner")}
                  />
                  <ImageUploadControl
                    id="profile-background-upload"
                    imageUrl={form.profileBackground}
                    label="Change background"
                    wide
                    uploading={uploading === "profile_background"}
                    onChange={(event) =>
                      void handleImageChange(event, "profile_background")
                    }
                  />
                </div>
              </EditorSection>

              <EditorSection
                title="Identity"
                description="Keep this concise; the profile header uses the same text."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    id="profile-display-name"
                    label="Display name"
                    icon={UserRound}
                    maxLength={120}
                    required
                    value={form.displayName}
                    disabled={busy}
                    onChange={(event) => updateForm("displayName", event.currentTarget.value)}
                  />
                  <TextField
                    id="profile-location"
                    label="Location"
                    icon={MapPin}
                    maxLength={120}
                    value={form.location}
                    disabled={busy}
                    onChange={(event) => updateForm("location", event.currentTarget.value)}
                  />
                </div>

                <TextareaField
                  id="profile-bio"
                  label="Bio"
                  className="min-h-28"
                  maxLength={500}
                  value={form.bio}
                  disabled={busy}
                  onChange={(event) => updateForm("bio", event.currentTarget.value)}
                />
              </EditorSection>

              <EditorSection
                title="Connections"
                description={`Add up to ${maxProfileConnections} public profile connections.`}
                action={
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={busy || form.connections.length >= maxProfileConnections}
                    icon={<Plus aria-hidden="true" size={15} />}
                    onClick={addConnection}
                  >
                    Add connection
                  </Button>
                }
              >

                {form.connections.length > 0 ? (
                  <div className="space-y-3">
                    {form.connections.map((connection, index) => {
                      const platform = profileConnectionPlatforms.find(
                        (option) => option.value === connection.platform,
                      );

                      return (
                        <div
                          key={connection.id}
                          className="grid min-w-0 gap-3 rounded-card border border-line bg-canvas/45 p-3 sm:grid-cols-[0.8fr_minmax(0,1fr)_auto]"
                        >
                          <SelectField
                            id={`profile-connection-platform-${connection.id}`}
                            label={`Connection ${index + 1}`}
                            value={connection.platform}
                            disabled={busy}
                            options={profileConnectionPlatforms}
                            onChange={(event) =>
                              updateConnection(
                                connection.id,
                                "platform",
                                event.currentTarget.value,
                              )
                            }
                          />
                          <TextField
                            id={`profile-connection-value-${connection.id}`}
                            label={connectionPlatformLabel(connection.platform)}
                            value={connection.value}
                            placeholder={platform?.placeholder}
                            maxLength={300}
                            disabled={busy}
                            onChange={(event) =>
                              updateConnection(
                                connection.id,
                                "value",
                                event.currentTarget.value,
                              )
                            }
                          />
                          <p className="text-xs leading-5 text-muted sm:col-start-2">
                            {connectionErrors[connection.id] ??
                              connectionPlatformHelp(connection.platform)}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="self-end sm:row-span-2 sm:row-start-1"
                            aria-label={`Remove connection ${index + 1}`}
                            title="Remove connection"
                            disabled={busy}
                            icon={<Trash2 aria-hidden="true" size={16} />}
                            onClick={() => removeConnection(connection.id)}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-card border border-dashed border-line bg-canvas/45 p-3 text-sm text-muted">
                    No connections added.
                  </p>
                )}
              </EditorSection>

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
                  {saving ? "Saving" : "Save changes"}
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

type EditorSectionProps = {
  action?: ReactNode;
  children: ReactNode;
  description: string;
  title: string;
};

function EditorSection({ action, children, description, title }: EditorSectionProps) {
  return (
    <section
      className="space-y-4 rounded-card border border-line bg-canvas/35 p-4"
      aria-label={title}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

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
            className={wide ? "h-20 w-32 rounded-card object-cover" : "size-20 rounded-full object-cover"}
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

function profileToForm(profile: Profile): FormState {
  return {
    displayName: profile.user.displayName,
    bio: profile.bio,
    location: profile.location,
    avatarUrl: profile.user.avatarUrl ?? "",
    bannerUrl: profile.bannerUrl ?? "",
    profileBackground: profile.profileBackground ?? "",
    connections: profile.links.map((connection) => ({
      id: crypto.randomUUID(),
      platform: connection.platform,
      value: connection.value || connection.url || "",
    })),
  };
}

function uploadFieldName(slot: UploadSlot): keyof FormState {
  if (slot === "avatar") {
    return "avatarUrl";
  }

  if (slot === "banner") {
    return "bannerUrl";
  }

  return "profileBackground";
}

function normalizedConnections(
  connections: DraftConnection[],
): { connections: ProfileExternalConnection[]; errors: Record<string, string> } {
  const normalized: ProfileExternalConnection[] = [];
  const errors: Record<string, string> = {};

  for (const connection of connections) {
    const validated = validateProfileConnectionDraft(
      connection.platform,
      connection.value,
    );

    if ("error" in validated) {
      errors[connection.id] = validated.error;
      continue;
    }

    normalized.push(validated.connection);
  }

  return {
    connections: normalized.slice(0, maxProfileConnections),
    errors,
  };
}
