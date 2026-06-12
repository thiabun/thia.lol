import { AnimatePresence, motion } from "motion/react";
import { useId, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import type {
  CreateProfileModuleInput,
  UpdateProfileModuleInput,
} from "../../lib/api";
import { cn } from "../../lib/classNames";
import { modalOverlay, modalPanel } from "../../lib/motionPresets";
import type {
  ProfileModule,
  ProfileModuleConfig,
  ProfileModuleType,
  ProfileModuleVisibility,
  UserBadge,
} from "../../lib/types";
import { Button } from "../ui/Button";
import { SelectField, TextareaField, TextField } from "../ui/Field";
import { ProfileModuleGrid } from "./ProfileModules";

const moduleTypes: Array<{ type: ProfileModuleType; label: string; description: string }> = [
  {
    type: "about",
    label: "About",
    description: "A short profile introduction.",
  },
  {
    type: "custom_text",
    label: "Text",
    description: "A compact note or update.",
  },
  {
    type: "links",
    label: "Links",
    description: "A safe list of external links.",
  },
  {
    type: "featured_badges",
    label: "Badges",
    description: "A shelf of earned visible badges.",
  },
];

const visibilityOptions: Array<{ value: ProfileModuleVisibility; label: string }> = [
  { value: "public", label: "Public" },
  { value: "hidden", label: "Hidden" },
  { value: "draft", label: "Draft" },
];

const maxTitleLength = 80;
const maxBodyLength = 500;
const maxLinks = 10;
const maxLinkLabelLength = 60;
const maxFeaturedBadges = 12;

type ProfileModuleEditorModalProps = {
  badges: UserBadge[];
  error?: string | undefined;
  loading: boolean;
  modules: ProfileModule[];
  onClose: () => void;
  onCreate: (input: CreateProfileModuleInput) => Promise<ProfileModule[]>;
  onDelete: (moduleId: number) => Promise<void>;
  onReorder: (moduleIds: number[]) => Promise<ProfileModule[]>;
  onUpdate: (
    moduleId: number,
    input: UpdateProfileModuleInput,
  ) => Promise<ProfileModule[]>;
};

type DirtyMap = Record<number, boolean>;

export function ProfileModuleEditorModal({
  badges,
  error,
  loading,
  modules,
  onClose,
  onCreate,
  onDelete,
  onReorder,
  onUpdate,
}: ProfileModuleEditorModalProps) {
  const titleId = useId();
  const [drafts, setDrafts] = useState<ProfileModule[]>(modules);
  const [selectedId, setSelectedId] = useState<number | undefined>(modules[0]?.id);
  const [dirty, setDirty] = useState<DirtyMap>({});
  const [orderDirty, setOrderDirty] = useState(false);
  const [busy, setBusy] = useState<"save" | "delete" | "order" | undefined>();
  const [message, setMessage] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();

  const selectedModule = drafts.find((module) => module.id === selectedId);
  const hasUnsaved = Object.values(dirty).some(Boolean) || orderDirty;
  const hasUnsavedNewModule = drafts.some((module) => module.id < 0);
  const selectedDirty = selectedModule ? dirty[selectedModule.id] === true : false;
  const canPersistOrder = drafts.length > 1 && orderDirty && !hasUnsavedNewModule;

  function requestClose() {
    if (hasUnsaved && !window.confirm("Discard unsaved module changes?")) {
      return;
    }

    onClose();
  }

  function addModule(type: ProfileModuleType) {
    const draft = createDraftModule(type);
    setDrafts((current) => [...current, draft]);
    setSelectedId(draft.id);
    setDirty((current) => ({ ...current, [draft.id]: true }));
    setMessage(undefined);
    setFormError(undefined);
  }

  function updateSelected(updater: (module: ProfileModule) => ProfileModule) {
    if (!selectedModule) {
      return;
    }

    const updated = updater(selectedModule);
    setDrafts((current) =>
      current.map((module) => (module.id === selectedModule.id ? updated : module)),
    );
    setDirty((current) => ({ ...current, [selectedModule.id]: true }));
    setMessage(undefined);
    setFormError(undefined);
  }

  function moveSelected(direction: -1 | 1) {
    if (!selectedModule) {
      return;
    }

    const index = drafts.findIndex((module) => module.id === selectedModule.id);
    const nextIndex = index + direction;

    if (index < 0 || nextIndex < 0 || nextIndex >= drafts.length) {
      return;
    }

    const nextDrafts = [...drafts];
    const [item] = nextDrafts.splice(index, 1);

    if (!item) {
      return;
    }

    nextDrafts.splice(nextIndex, 0, item);
    setDrafts(nextDrafts.map((module, moduleIndex) => ({
      ...module,
      position: moduleIndex + 1,
    })));
    setOrderDirty(true);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedModule) {
      return;
    }

    const validation = validateModuleDraft(selectedModule, badges);

    if (validation) {
      setFormError(validation);
      return;
    }

    setBusy("save");
    setMessage(undefined);
    setFormError(undefined);

    try {
      const input = moduleInput(selectedModule);
      const updated =
        selectedModule.id < 0
          ? await onCreate(input)
          : await onUpdate(selectedModule.id, input);
      const selectedAfterSave =
        selectedModule.id < 0 ? updated[updated.length - 1]?.id : selectedModule.id;

      setDrafts(updated);
      setSelectedId(selectedAfterSave ?? updated[0]?.id);
      setDirty({});
      setOrderDirty(false);
      setMessage("Module saved");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Module could not be saved.");
    } finally {
      setBusy(undefined);
    }
  }

  async function handleDelete() {
    if (!selectedModule) {
      return;
    }

    if (!window.confirm("Delete this module?")) {
      return;
    }

    setBusy("delete");
    setMessage(undefined);
    setFormError(undefined);

    try {
      const nextDrafts = drafts.filter((module) => module.id !== selectedModule.id);

      if (selectedModule.id > 0) {
        await onDelete(selectedModule.id);
      }

      setDrafts(nextDrafts);
      setSelectedId(nextDrafts[0]?.id);
      setDirty((current) => {
        const next = { ...current };
        delete next[selectedModule.id];
        return next;
      });
      setMessage("Module deleted");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Module could not be deleted.");
    } finally {
      setBusy(undefined);
    }
  }

  async function handleSaveOrder() {
    if (!canPersistOrder) {
      return;
    }

    setBusy("order");
    setMessage(undefined);
    setFormError(undefined);

    try {
      const updated = await onReorder(drafts.map((module) => module.id));
      setDrafts(updated);
      setSelectedId((current) =>
        current !== undefined && updated.some((module) => module.id === current)
          ? current
          : updated[0]?.id,
      );
      setOrderDirty(false);
      setMessage("Module order saved");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Module order could not be saved.");
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 grid place-items-center bg-text/28 px-3 py-4 backdrop-blur-veil sm:px-4 sm:py-6"
        variants={modalOverlay}
        initial="hidden"
        animate="show"
        exit="exit"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !busy) {
            requestClose();
          }
        }}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          data-testid="profile-module-editor"
          className="max-h-[calc(100dvh-2rem)] w-full max-w-6xl overflow-y-auto rounded-panel border border-line bg-surface p-4 shadow-lift sm:max-h-[calc(100dvh-3rem)] sm:p-5"
          variants={modalPanel}
        >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 id={titleId} className="text-lg font-semibold text-text">
                  Edit personal space
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Modules use plain text, safe links, and earned badges.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close module editor"
                title="Close"
                icon={<X aria-hidden="true" size={18} />}
                disabled={busy !== undefined}
                onClick={requestClose}
              />
            </div>

            {loading ? (
              <div className="mt-5 rounded-card border border-line bg-canvas/45 p-4 text-sm text-muted">
                Loading modules.
              </div>
            ) : null}

            {error ? (
              <div className="mt-5 rounded-card border border-rose/30 bg-rose/15 p-4 text-sm text-rose-ink">
                {error}
              </div>
            ) : null}

            {!loading ? (
              <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
                <aside className="min-w-0 space-y-5">
                  <section>
                    <h3 className="text-sm font-semibold text-text">Modules</h3>
                    <div className="mt-3 space-y-2" data-testid="profile-module-list">
                      {drafts.length === 0 ? (
                        <p className="rounded-card border border-dashed border-line bg-canvas/45 p-3 text-sm text-muted">
                          No modules yet.
                        </p>
                      ) : null}
                      {drafts.map((module, index) => (
                        <button
                          key={module.id}
                          type="button"
                          className={cn(
                            "w-full rounded-card border p-3 text-left transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                            selectedId === module.id
                              ? "border-line-strong bg-surface shadow-soft"
                              : "border-line bg-canvas/45 hover:border-line-strong",
                          )}
                          onClick={() => setSelectedId(module.id)}
                        >
                          <span className="block truncate text-sm font-semibold text-text">
                            {module.title || moduleTypeLabel(module.type)}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                            <span>{moduleTypeLabel(module.type)}</span>
                            <span>{visibilityLabel(module.visibility)}</span>
                            {dirty[module.id] ? <span>Unsaved</span> : null}
                            <span>#{index + 1}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon={<ArrowUp aria-hidden="true" size={15} />}
                        disabled={!selectedModule || drafts[0]?.id === selectedModule.id}
                        onClick={() => moveSelected(-1)}
                      >
                        Up
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon={<ArrowDown aria-hidden="true" size={15} />}
                        disabled={
                          !selectedModule || drafts[drafts.length - 1]?.id === selectedModule.id
                        }
                        onClick={() => moveSelected(1)}
                      >
                        Down
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="mt-3 w-full"
                      disabled={!canPersistOrder || busy !== undefined}
                      onClick={() => void handleSaveOrder()}
                    >
                      {busy === "order" ? "Saving order" : "Save order"}
                    </Button>
                    {orderDirty && hasUnsavedNewModule ? (
                      <p className="mt-2 text-xs leading-5 text-muted">
                        Save new modules before saving order.
                      </p>
                    ) : null}
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold text-text">Add module</h3>
                    <div className="mt-3 space-y-2">
                      {moduleTypes.map((moduleType) => (
                        <button
                          key={moduleType.type}
                          type="button"
                          className="w-full rounded-card border border-line bg-canvas/45 p-3 text-left transition duration-fluid ease-fluid hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                          onClick={() => addModule(moduleType.type)}
                        >
                          <span className="block text-sm font-semibold text-text">
                            {moduleType.label}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-muted">
                            {moduleType.description}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                </aside>

                <div className="min-w-0 space-y-5">
                  {selectedModule ? (
                    <form
                      className="rounded-panel border border-line bg-canvas/35 p-4"
                      onSubmit={(event) => void handleSave(event)}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold text-text">
                            {moduleTypeLabel(selectedModule.type)}
                          </h3>
                          <p className="mt-1 text-sm leading-6 text-muted">
                            Preview updates before saving.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            icon={<Trash2 aria-hidden="true" size={15} />}
                            disabled={busy !== undefined}
                            onClick={() => void handleDelete()}
                          >
                            Delete
                          </Button>
                          <Button
                            type="submit"
                            size="sm"
                            icon={<Save aria-hidden="true" size={15} />}
                            disabled={busy !== undefined || (!selectedDirty && selectedModule.id > 0)}
                          >
                            {busy === "save" ? "Saving" : "Save module"}
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
                        <TextField
                          id="module-title"
                          label="Title"
                          maxLength={maxTitleLength}
                          value={selectedModule.title ?? ""}
                          onChange={(event) =>
                            updateSelected((module) => ({
                              ...module,
                              title: event.currentTarget.value || null,
                            }))
                          }
                        />
                        <SelectField
                          id="module-visibility"
                          label="Visibility"
                          options={visibilityOptions}
                          value={selectedModule.visibility}
                          onChange={(event) =>
                            updateSelected((module) => ({
                              ...module,
                              visibility: event.currentTarget.value as ProfileModuleVisibility,
                            }))
                          }
                        />
                      </div>

                      <ModuleTypeFields
                        badges={badges}
                        module={selectedModule}
                        onChange={updateSelected}
                      />

                      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                        {visibilityIcon(selectedModule.visibility)}
                        <span className="text-muted">
                          {selectedModule.visibility === "public"
                            ? "Public modules render on your profile after saving."
                            : "Hidden and draft modules stay out of public view."}
                        </span>
                      </div>

                      {formError ? (
                        <p className="mt-4 rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink">
                          {formError}
                        </p>
                      ) : null}
                      {message ? (
                        <p className="mt-4 rounded-card border border-leaf/30 bg-leaf/15 p-3 text-sm text-leaf-ink">
                          {message}
                        </p>
                      ) : null}
                    </form>
                  ) : (
                    <div className="rounded-panel border border-dashed border-line bg-canvas/35 p-6 text-sm text-muted">
                      Choose a module type to start.
                    </div>
                  )}

                  <section className="rounded-panel border border-line bg-surface p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-text">Preview</h3>
                        <p className="mt-1 text-sm leading-6 text-muted">
                          Unsaved changes are shown here as plain profile modules.
                        </p>
                      </div>
                    </div>
                    <div data-testid="profile-module-preview">
                      <ProfileModuleGrid
                        badges={badges}
                        modules={previewModules(drafts)}
                      />
                    </div>
                  </section>
                </div>
              </div>
            ) : null}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

type ModuleTypeFieldsProps = {
  badges: UserBadge[];
  module: ProfileModule;
  onChange: (updater: (module: ProfileModule) => ProfileModule) => void;
};

function ModuleTypeFields({ badges, module, onChange }: ModuleTypeFieldsProps) {
  if (module.type === "links") {
    const links = module.config.links ?? [];

    return (
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold text-text">Links</h4>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<Plus aria-hidden="true" size={15} />}
            disabled={links.length >= maxLinks}
            onClick={() =>
              onChange((current) => ({
                ...current,
                config: {
                  ...current.config,
                  links: [...(current.config.links ?? []), { label: "", url: "" }],
                },
              }))
            }
          >
            Add link
          </Button>
        </div>
        {links.length === 0 ? (
          <p className="rounded-card border border-dashed border-line bg-canvas/45 p-3 text-sm text-muted">
            Add at least one safe HTTPS link.
          </p>
        ) : null}
        {links.map((link, index) => (
          <div key={index} className="grid gap-3 rounded-card border border-line bg-surface p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
            <TextField
              id={`module-link-label-${index}`}
              label={`Link ${index + 1} label`}
              maxLength={maxLinkLabelLength}
              value={link.label}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  config: {
                    ...current.config,
                    links: updateLink(current.config.links ?? [], index, {
                      ...link,
                      label: event.currentTarget.value,
                    }),
                  },
                }))
              }
            />
            <TextField
              id={`module-link-url-${index}`}
              label={`Link ${index + 1} URL`}
              value={link.url}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  config: {
                    ...current.config,
                    links: updateLink(current.config.links ?? [], index, {
                      ...link,
                      url: event.currentTarget.value,
                    }),
                  },
                }))
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-end"
              onClick={() =>
                onChange((current) => ({
                  ...current,
                  config: {
                    ...current.config,
                    links: (current.config.links ?? []).filter((_, linkIndex) => linkIndex !== index),
                  },
                }))
              }
            >
              Remove
            </Button>
          </div>
        ))}
      </div>
    );
  }

  if (module.type === "featured_badges") {
    const selectedIds = new Set(module.config.userBadgeIds ?? []);

    return (
      <fieldset className="mt-4">
        <legend className="text-sm font-semibold text-text">Earned badges</legend>
        {badges.length === 0 ? (
          <p className="mt-3 rounded-card border border-dashed border-line bg-canvas/45 p-3 text-sm text-muted">
            No earned badges are available for this module.
          </p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {badges.map((userBadge) => (
              <label
                key={userBadge.id}
                className="flex min-w-0 items-start gap-3 rounded-card border border-line bg-surface p-3 text-sm"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selectedIds.has(userBadge.id)}
                  disabled={
                    !selectedIds.has(userBadge.id) &&
                    selectedIds.size >= maxFeaturedBadges
                  }
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      config: {
                        ...current.config,
                        userBadgeIds: nextBadgeIds(
                          current.config.userBadgeIds ?? [],
                          userBadge.id,
                          event.currentTarget.checked,
                        ),
                      },
                    }))
                  }
                />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-text">
                    {userBadge.badge.name}
                  </span>
                  <span className="block text-xs text-muted">{userBadge.badge.rarity}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>
    );
  }

  return (
    <TextareaField
      id="module-body"
      label="Body"
      rows={6}
      maxLength={maxBodyLength}
      className="mt-4"
      value={module.config.body ?? ""}
      onChange={(event) =>
        onChange((current) => ({
          ...current,
          config: {
            ...current.config,
            body: event.currentTarget.value,
          },
        }))
      }
    />
  );
}

function createDraftModule(type: ProfileModuleType): ProfileModule {
  return {
    id: -Date.now(),
    type,
    title: null,
    visibility: "public",
    position: 999,
    status: "active",
    schemaVersion: 1,
    config: defaultConfig(type),
    createdAt: null,
    updatedAt: null,
  };
}

function defaultConfig(type: ProfileModuleType): ProfileModuleConfig {
  if (type === "links") {
    return { links: [{ label: "", url: "" }] };
  }

  if (type === "featured_badges") {
    return { userBadgeIds: [] };
  }

  return { body: "" };
}

function moduleInput(module: ProfileModule): CreateProfileModuleInput {
  return {
    type: module.type,
    title: module.title,
    visibility: module.visibility,
    status: "active",
    config: normalizedConfig(module),
  };
}

function normalizedConfig(module: ProfileModule): ProfileModuleConfig {
  if (module.type === "links") {
    return {
      links: (module.config.links ?? []).map((link) => ({
        label: link.label.trim(),
        url: link.url.trim(),
      })),
    };
  }

  if (module.type === "featured_badges") {
    return { userBadgeIds: module.config.userBadgeIds ?? [] };
  }

  return { body: (module.config.body ?? "").trim() };
}

function validateModuleDraft(module: ProfileModule, badges: UserBadge[]): string | undefined {
  const titleError = optionalPlainTextError(module.title ?? "", maxTitleLength, "Title");

  if (titleError) {
    return titleError;
  }

  if (module.type === "links") {
    const links = module.config.links ?? [];

    if (links.length === 0) {
      return "Add at least one link.";
    }

    if (links.length > maxLinks) {
      return "Links modules can have up to 10 links.";
    }

    for (const link of links) {
      const labelError = requiredPlainTextError(link.label, maxLinkLabelLength, "Link label");

      if (labelError) {
        return labelError;
      }

      const urlError = safeUrlError(link.url);

      if (urlError) {
        return urlError;
      }
    }

    return undefined;
  }

  if (module.type === "featured_badges") {
    const selectedIds = module.config.userBadgeIds ?? [];
    const availableIds = new Set(badges.map((badge) => badge.id));

    if (selectedIds.length === 0) {
      return "Choose at least one earned badge.";
    }

    if (selectedIds.length > maxFeaturedBadges) {
      return "Badge modules can show up to 12 badges.";
    }

    if (selectedIds.some((id) => !availableIds.has(id))) {
      return "Choose only badges earned by this profile.";
    }

    return undefined;
  }

  return requiredPlainTextError(module.config.body ?? "", maxBodyLength, "Body");
}

function requiredPlainTextError(
  value: string,
  maxLength: number,
  label: string,
): string | undefined {
  const trimmed = value.trim();

  if (trimmed === "") {
    return `${label} is required.`;
  }

  return optionalPlainTextError(trimmed, maxLength, label);
}

function optionalPlainTextError(
  value: string,
  maxLength: number,
  label: string,
): string | undefined {
  if (value.trim() === "") {
    return undefined;
  }

  if (value.length > maxLength) {
    return `${label} is too long.`;
  }

  if (unsafeText(value)) {
    return `${label} must be plain text.`;
  }

  return undefined;
}

function unsafeText(value: string): boolean {
  return /<\s*\/?\s*[a-z][^>]*>/i.test(value) || /(?:javascript|data)\s*:/i.test(value) || /\bon[a-z]+\s*=/i.test(value);
}

function safeUrlError(value: string): string | undefined {
  const trimmed = value.trim();

  if (trimmed === "") {
    return "Link URL is required.";
  }

  if (unsafeText(trimmed)) {
    return "Link URL is invalid.";
  }

  try {
    const url = new URL(trimmed);

    if (url.protocol !== "https:" || url.username || url.password) {
      return "Links must use a valid HTTPS URL.";
    }

    if (/\.svg$/i.test(url.pathname)) {
      return "Links cannot reference SVG media.";
    }
  } catch {
    return "Links must use a valid HTTPS URL.";
  }

  return undefined;
}

function updateLink(
  links: NonNullable<ProfileModuleConfig["links"]>,
  index: number,
  nextLink: NonNullable<ProfileModuleConfig["links"]>[number],
) {
  return links.map((link, linkIndex) => (linkIndex === index ? nextLink : link));
}

function nextBadgeIds(current: number[], id: number, checked: boolean): number[] {
  if (checked) {
    return current.includes(id) ? current : [...current, id].slice(0, maxFeaturedBadges);
  }

  return current.filter((item) => item !== id);
}

function previewModules(modules: ProfileModule[]): ProfileModule[] {
  return modules
    .filter((module) => module.status === "active" && module.visibility === "public")
    .map((module, index) => ({ ...module, position: index + 1 }));
}

function moduleTypeLabel(type: ProfileModuleType): string {
  if (type === "about") {
    return "About";
  }

  if (type === "custom_text") {
    return "Text";
  }

  if (type === "links") {
    return "Links";
  }

  return "Badges";
}

function visibilityLabel(visibility: ProfileModuleVisibility): string {
  if (visibility === "public") {
    return "Public";
  }

  if (visibility === "hidden") {
    return "Hidden";
  }

  return "Draft";
}

function visibilityIcon(visibility: ProfileModuleVisibility) {
  if (visibility === "public") {
    return <Eye aria-hidden="true" className="text-leaf-ink" size={16} />;
  }

  return <EyeOff aria-hidden="true" className="text-muted" size={16} />;
}
