import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useId, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  BookOpen,
  Edit3,
  Eye,
  EyeOff,
  ImagePlus,
  LayoutGrid,
  Link as LinkIcon,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Pin,
  Plus,
  Radio,
  Save,
  Search,
  Sparkles,
  Trash2,
  Type,
  UserRound,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react";
import type {
  CreateProfileModuleInput,
  ImageUploadPurpose,
  UpdateProfileFeaturedInput,
  UpdateProfileInput,
  UpdateProfileModuleInput,
  UploadedImage,
} from "../../lib/api";
import { cn } from "../../lib/classNames";
import { modalOverlay, modalPanel } from "../../lib/motionPresets";
import {
  defaultProfileLayoutPreset,
  profileLayoutPresetOptions,
} from "../../lib/profileLayoutPresets";
import {
  connectionPlatformHelp,
  connectionPlatformLabel,
  formatProfileConnectionValue,
  maxProfileConnections,
  profileConnectionPlatforms,
  validateProfileConnectionDraft,
} from "../../lib/profileConnections";
import {
  getProfileModuleDefinition,
  profileModuleSummary,
} from "../../lib/profileModuleRegistry";
import type {
  Profile,
  ProfileConnectionPlatform,
  ProfileExternalConnection,
  ProfileLayoutPreset,
  ProfileModule,
  ProfileModuleConfig,
  ProfileModuleType,
  ProfileModuleVisibility,
  Post,
  Room,
  UserBadge,
} from "../../lib/types";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { SelectField, TextareaField, TextField } from "../ui/Field";
import { ModalSheetStatus } from "../ui/ModalSheet";
import { CompactStateNotice } from "../ui/RouteState";
import { ProfileConnectionIcon } from "./ProfileConnectionIcon";
import { ProfileModuleGrid } from "./ProfileModules";

const maxUploadBytes = 10 * 1024 * 1024;
const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];
const maxTitleLength = 80;
const maxBodyLength = 500;
const maxLinks = 10;
const maxLinkLabelLength = 60;
const maxFeaturedBadges = 12;

const sections: Array<{
  id: CustomizationSection;
  label: string;
  icon: LucideIcon;
}> = [
  {
    id: "identity",
    label: "Identity",
    icon: UserRound,
  },
  {
    id: "look",
    label: "Look",
    icon: ImagePlus,
  },
  {
    id: "modules",
    label: "Modules",
    icon: Sparkles,
  },
  {
    id: "preview",
    label: "Preview",
    icon: Eye,
  },
];

const moduleTypes: Array<{
  addable?: boolean;
  type: ProfileModuleType;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    type: "about",
    label: getProfileModuleDefinition("about").label,
    description: getProfileModuleDefinition("about").description,
    icon: BookOpen,
  },
  {
    type: "custom_text",
    label: getProfileModuleDefinition("custom_text").label,
    description: getProfileModuleDefinition("custom_text").description,
    icon: Type,
  },
  {
    type: "links",
    label: getProfileModuleDefinition("links").label,
    description: getProfileModuleDefinition("links").description,
    icon: LinkIcon,
  },
  {
    type: "featured_badges",
    label: getProfileModuleDefinition("featured_badges").label,
    description: getProfileModuleDefinition("featured_badges").description,
    icon: BadgeCheck,
  },
  {
    type: "featured_post",
    label: getProfileModuleDefinition("featured_post").label,
    description: getProfileModuleDefinition("featured_post").description,
    icon: Pin,
    addable: false,
  },
  {
    type: "featured_room",
    label: getProfileModuleDefinition("featured_room").label,
    description: getProfileModuleDefinition("featured_room").description,
    icon: Radio,
    addable: false,
  },
  {
    type: "activity",
    label: getProfileModuleDefinition("activity").label,
    description: getProfileModuleDefinition("activity").description,
    icon: Radio,
    addable: false,
  },
];

const visibilityOptions: Array<{ value: ProfileModuleVisibility; label: string }> = [
  { value: "public", label: "Public" },
  { value: "hidden", label: "Hidden" },
  { value: "draft", label: "Draft" },
];

function isFeaturedContentModule(type: ProfileModuleType): boolean {
  return type === "featured_post" || type === "featured_room";
}

type CustomizationSection =
  | "identity"
  | "look"
  | "modules"
  | "preview";

type UploadSlot = "avatar" | "banner" | "profile_background";

type DraftConnection = {
  id: string;
  platform: ProfileConnectionPlatform;
  value: string;
};

type ProfileFormState = {
  displayName: string;
  bio: string;
  location: string;
  avatarUrl: string;
  bannerUrl: string;
  profileBackground: string;
  connections: DraftConnection[];
};

type DirtyMap = Record<number, boolean>;

type ProfileCustomizationModalProps = {
  badges: UserBadge[];
  featuredOptionsError?: string | undefined;
  featuredOptionsLoading: boolean;
  featuredPostOptions: Post[];
  featuredRoomOptions: Room[];
  initialSection?: CustomizationSection | undefined;
  moduleError?: string | undefined;
  moduleLoading: boolean;
  modules: ProfileModule[];
  onClose: () => void;
  onCreateModule: (input: CreateProfileModuleInput) => Promise<ProfileModule[]>;
  onDeleteModule: (moduleId: number) => Promise<void>;
  onReorderModules: (moduleIds: number[]) => Promise<ProfileModule[]>;
  onSaveFeaturedContent: (input: UpdateProfileFeaturedInput) => Promise<Profile>;
  onSaveProfile: (input: UpdateProfileInput) => Promise<Profile>;
  onUpdateModule: (
    moduleId: number,
    input: UpdateProfileModuleInput,
  ) => Promise<ProfileModule[]>;
  onUpload: (file: File, purpose: ImageUploadPurpose) => Promise<UploadedImage>;
  profile: Profile;
};

export function ProfileCustomizationModal({
  badges,
  featuredOptionsError,
  featuredOptionsLoading,
  featuredPostOptions,
  featuredRoomOptions,
  initialSection = "identity",
  moduleError,
  moduleLoading,
  modules,
  onClose,
  onCreateModule,
  onDeleteModule,
  onReorderModules,
  onSaveFeaturedContent,
  onSaveProfile,
  onUpdateModule,
  onUpload,
  profile,
}: ProfileCustomizationModalProps) {
  const titleId = useId();
  const [activeSection, setActiveSection] = useState<CustomizationSection>(initialSection);
  const [form, setForm] = useState<ProfileFormState>(() => profileToForm(profile));
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState<UploadSlot | undefined>();
  const [profileMessage, setProfileMessage] = useState<string | undefined>();
  const [featuredPostId, setFeaturedPostId] = useState<number | null>(
    () => profile.featuredPost?.id ?? profile.featuredPostId ?? null,
  );
  const [featuredRoomId, setFeaturedRoomId] = useState<number | null>(
    () => profile.featuredRoom?.id ?? profile.featuredRoomId ?? null,
  );
  const [featuredPostQuery, setFeaturedPostQuery] = useState("");
  const [featuredRoomQuery, setFeaturedRoomQuery] = useState("");
  const [connectionErrors, setConnectionErrors] = useState<Record<string, string>>({});
  const [editingConnectionIds, setEditingConnectionIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [drafts, setDrafts] = useState<ProfileModule[]>(modules);
  const [layoutPreset, setLayoutPreset] = useState<ProfileLayoutPreset>(
    () => profile.profileLayoutPreset ?? defaultProfileLayoutPreset,
  );
  const [savedLayoutPreset, setSavedLayoutPreset] = useState<ProfileLayoutPreset>(
    () => profile.profileLayoutPreset ?? defaultProfileLayoutPreset,
  );
  const [savingLayout, setSavingLayout] = useState(false);
  const [layoutMessage, setLayoutMessage] = useState<string | undefined>();
  const [selectedModuleId, setSelectedModuleId] = useState<number | undefined>();
  const [moduleDirty, setModuleDirty] = useState<DirtyMap>({});
  const [orderDirty, setOrderDirty] = useState(false);
  const [moduleBusy, setModuleBusy] = useState<"save" | "delete" | "order" | undefined>();
  const [moduleMessage, setModuleMessage] = useState<string | undefined>();
  const [moduleFormError, setModuleFormError] = useState<string | undefined>();

  const busy =
    savingProfile ||
    savingLayout ||
    uploading !== undefined ||
    moduleBusy !== undefined;
  const selectedModule = drafts.find((module) => module.id === selectedModuleId);
  const hasUnsavedModules = Object.values(moduleDirty).some(Boolean) || orderDirty;
  const layoutDirty = layoutPreset !== savedLayoutPreset;
  const hasUnsavedNewModule = drafts.some((module) => module.id < 0);
  const selectedModuleDirty = selectedModule
    ? moduleDirty[selectedModule.id] === true
    : false;
  const canPersistOrder = drafts.length > 1 && orderDirty && !hasUnsavedNewModule;
  const initialFeaturedPostId = profile.featuredPost?.id ?? profile.featuredPostId ?? null;
  const initialFeaturedRoomId = profile.featuredRoom?.id ?? profile.featuredRoomId ?? null;
  const featuredDirty =
    featuredPostId !== initialFeaturedPostId || featuredRoomId !== initialFeaturedRoomId;
  const previewFeaturedPost =
    featuredPostOptions.find((post) => post.id === featuredPostId) ??
    (profile.featuredPost?.id === featuredPostId ? profile.featuredPost : null);
  const previewFeaturedRoom =
    featuredRoomOptions.find((room) => room.id === featuredRoomId) ??
    (profile.featuredRoom?.id === featuredRoomId ? profile.featuredRoom : null);
  const validPreviewConnections = useMemo(
    () => normalizedConnections(form.connections).connections,
    [form.connections],
  );

  function requestClose() {
    if (
      (hasUnsavedModules || layoutDirty || featuredDirty) &&
      !window.confirm("Discard unsaved customization changes?")
    ) {
      return;
    }

    onClose();
  }

  function updateForm(field: keyof ProfileFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setProfileMessage(undefined);
  }

  function updateConnection(
    id: string,
    field: keyof Omit<DraftConnection, "id">,
    value: string,
  ) {
    setEditingConnectionIds((current) => new Set(current).add(id));
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
    setProfileMessage(undefined);
  }

  function addConnection(platform: ProfileConnectionPlatform = "website") {
    const id = crypto.randomUUID();
    setForm((current) => ({
      ...current,
      connections: [
        ...current.connections,
        {
          id,
          platform,
          value: "",
        },
      ],
    }));
    setEditingConnectionIds((current) => new Set(current).add(id));
    setProfileMessage(undefined);
  }

  function removeConnection(id: string) {
    setEditingConnectionIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
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
    setProfileMessage(undefined);
  }

  function editConnection(id: string) {
    setEditingConnectionIds((current) => new Set(current).add(id));
  }

  function finishConnectionEdit(id: string) {
    const connection = form.connections.find((item) => item.id === id);

    if (!connection) {
      return;
    }

    if (!connection.value.trim()) {
      removeConnection(id);
      return;
    }

    const validated = validateProfileConnectionDraft(
      connection.platform,
      connection.value,
    );

    if ("error" in validated) {
      const error = validated.error ?? "Connection value is invalid.";
      setConnectionErrors((current) => ({
        ...current,
        [id]: error,
      }));
      setEditingConnectionIds((current) => new Set(current).add(id));
      return;
    }

    setConnectionErrors((current) => {
      if (!current[id]) {
        return current;
      }

      const next = { ...current };
      delete next[id];
      return next;
    });
    setEditingConnectionIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  async function handleProfileSave() {
    const links = normalizedConnections(form.connections);
    setConnectionErrors(links.errors);

    if (Object.keys(links.errors).length > 0) {
      setEditingConnectionIds((current) => {
        const next = new Set(current);
        Object.keys(links.errors).forEach((id) => next.add(id));
        return next;
      });
      setProfileMessage("Fix the highlighted connections before saving.");
      setActiveSection("identity");
      return;
    }

    setSavingProfile(true);
    setProfileMessage(undefined);

    try {
      const updated = await onSaveProfile({
        displayName: form.displayName,
        bio: form.bio,
        location: form.location,
        avatarUrl: form.avatarUrl || null,
        bannerUrl: form.bannerUrl || null,
        profileBackground: form.profileBackground || null,
        links: links.connections,
      });

      setForm(profileToForm(updated));
      setEditingConnectionIds(new Set());
      setProfileMessage("Profile updated");
    } catch (error) {
      setProfileMessage(
        error instanceof Error ? error.message : "Profile could not be saved.",
      );
    } finally {
      setSavingProfile(false);
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
      setProfileMessage("Image must be 10 MB or smaller");
      return;
    }

    if (!acceptedTypes.includes(file.type)) {
      setProfileMessage("Unsupported image type. Use JPEG, PNG, or WebP.");
      return;
    }

    setUploading(slot);
    setProfileMessage(undefined);

    try {
      const uploaded = await onUpload(file, slot);
      updateForm(uploadFieldName(slot), uploaded.url);
      setProfileMessage("Images are converted to WebP");
    } catch (error) {
      setProfileMessage(
        error instanceof Error ? error.message : "Image could not be uploaded.",
      );
    } finally {
      setUploading(undefined);
    }
  }

  async function handleLayoutSave() {
    if (!layoutDirty) {
      return;
    }

    setSavingLayout(true);
    setLayoutMessage(undefined);

    try {
      const updated = await onSaveProfile({
        profileLayoutPreset: layoutPreset,
      });
      const nextPreset =
        updated.profileLayoutPreset ?? defaultProfileLayoutPreset;

      setLayoutPreset(nextPreset);
      setSavedLayoutPreset(nextPreset);
      setLayoutMessage("Layout saved");
    } catch (error) {
      setLayoutMessage(
        error instanceof Error ? error.message : "Layout could not be saved.",
      );
    } finally {
      setSavingLayout(false);
    }
  }

  function addModule(type: ProfileModuleType) {
    const draft = createDraftModule(type);
    setDrafts((current) => [...current, draft]);
    setSelectedModuleId(draft.id);
    setModuleDirty((current) => ({ ...current, [draft.id]: true }));
    setModuleMessage(undefined);
    setModuleFormError(undefined);
  }

  function updateSelectedModule(updater: (module: ProfileModule) => ProfileModule) {
    if (!selectedModule) {
      return;
    }

    const updated = updater(selectedModule);
    setDrafts((current) =>
      current.map((module) => (module.id === selectedModule.id ? updated : module)),
    );
    setModuleDirty((current) => ({ ...current, [selectedModule.id]: true }));
    setModuleMessage(undefined);
    setModuleFormError(undefined);
  }

  function moveModule(moduleId: number, direction: -1 | 1) {
    const index = drafts.findIndex((module) => module.id === moduleId);
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
    setDrafts(
      nextDrafts.map((module, moduleIndex) => ({
        ...module,
        position: moduleIndex + 1,
      })),
    );
    setOrderDirty(true);
  }

  async function handleModuleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedModule) {
      return;
    }

    const validation = validateModuleDraft(selectedModule, badges);

    if (validation) {
      setModuleFormError(validation);
      return;
    }

    setModuleBusy("save");
    setModuleMessage(undefined);
    setModuleFormError(undefined);

    try {
      const shouldSaveModule = selectedModule.id < 0 || selectedModuleDirty;
      const shouldSaveFeatured =
        isFeaturedContentModule(selectedModule.type) && featuredDirty;

      let updatedModules: ProfileModule[] | undefined;

      if (shouldSaveModule) {
        const input = moduleInput(selectedModule);
        updatedModules =
          selectedModule.id < 0
            ? await onCreateModule(input)
            : await onUpdateModule(selectedModule.id, input);
      }

      if (shouldSaveFeatured) {
        const updatedProfile = await onSaveFeaturedContent({
          featuredPostId,
          featuredRoomId,
        });

        setFeaturedPostId(
          updatedProfile.featuredPost?.id ?? updatedProfile.featuredPostId ?? null,
        );
        setFeaturedRoomId(
          updatedProfile.featuredRoom?.id ?? updatedProfile.featuredRoomId ?? null,
        );
      }

      if (updatedModules) {
        setDrafts(updatedModules);
      }

      setSelectedModuleId(undefined);
      setModuleDirty({});
      setOrderDirty(false);
      setModuleMessage(
        isFeaturedContentModule(selectedModule.type)
          ? `${moduleTypeMeta(selectedModule.type).label} module saved`
          : "Module saved",
      );
    } catch (caught) {
      setModuleFormError(
        caught instanceof Error ? caught.message : "Module could not be saved.",
      );
    } finally {
      setModuleBusy(undefined);
    }
  }

  async function handleModuleDelete(moduleId?: number) {
    const targetModule = drafts.find((module) => module.id === (moduleId ?? selectedModuleId));

    if (!targetModule) {
      return;
    }

    if (!window.confirm(`Delete ${targetModule.title || moduleTypeMeta(targetModule.type).label}?`)) {
      return;
    }

    setModuleBusy("delete");
    setModuleMessage(undefined);
    setModuleFormError(undefined);

    try {
      const nextDrafts = drafts.filter((module) => module.id !== targetModule.id);

      if (targetModule.id > 0) {
        await onDeleteModule(targetModule.id);
      }

      setDrafts(nextDrafts);
      setSelectedModuleId((current) => (current === targetModule.id ? undefined : current));
      setModuleDirty((current) => {
        const next = { ...current };
        delete next[targetModule.id];
        return next;
      });
      setModuleMessage("Module deleted");
    } catch (caught) {
      setModuleFormError(
        caught instanceof Error ? caught.message : "Module could not be deleted.",
      );
    } finally {
      setModuleBusy(undefined);
    }
  }

  async function handleSaveOrder() {
    if (!canPersistOrder) {
      return;
    }

    setModuleBusy("order");
    setModuleMessage(undefined);
    setModuleFormError(undefined);

    try {
      const updated = await onReorderModules(drafts.map((module) => module.id));
      setDrafts(updated);
      setSelectedModuleId((current) =>
        current !== undefined && updated.some((module) => module.id === current)
          ? current
          : updated[0]?.id,
      );
      setOrderDirty(false);
      setModuleMessage("Module order saved");
    } catch (caught) {
      setModuleFormError(
        caught instanceof Error ? caught.message : "Module order could not be saved.",
      );
    } finally {
      setModuleBusy(undefined);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 grid bg-text/28 p-0 backdrop-blur-veil sm:place-items-center sm:px-3 sm:py-4"
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
          data-testid="profile-customization-modal"
          className="flex h-dvh w-full flex-col overflow-hidden bg-surface shadow-lift sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-4xl sm:rounded-panel sm:border sm:border-line xl:max-w-5xl"
          variants={modalPanel}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-surface/95 px-3 py-2 backdrop-blur-veil">
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-semibold text-text">
                Customize profile
              </h2>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close profile customization"
              title="Close"
              icon={<X aria-hidden="true" size={18} />}
              disabled={busy}
              onClick={requestClose}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2.5 sm:px-3 sm:py-3">
            <div className="min-w-0 space-y-3">
              <nav
                aria-label="Customization sections"
                className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
              >
                {sections.map((section) => (
                  <SectionButton
                    key={section.id}
                    active={activeSection === section.id}
                    section={section}
                    onClick={() => setActiveSection(section.id)}
                  />
                ))}
              </nav>

              <div
                className={cn(
                  "grid min-w-0 gap-3",
                  activeSection === "preview"
                    ? "lg:grid-cols-1"
                    : "lg:grid-cols-[minmax(0,1fr)_minmax(15rem,18rem)]",
                )}
              >
                <div className="min-w-0 space-y-3">
                <div className={activeSection === "identity" ? "block" : "hidden"}>
                  <EditorSection title="Identity">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <TextField
                        id="profile-display-name"
                        label="Display name"
                        density="compact"
                        icon={UserRound}
                        maxLength={120}
                        required
                        value={form.displayName}
                        disabled={busy}
                        onChange={(event) =>
                          updateForm("displayName", event.currentTarget.value)
                        }
                      />
                      <TextField
                        id="profile-location"
                        label="Location"
                        density="compact"
                        icon={MapPin}
                        maxLength={120}
                        value={form.location}
                        disabled={busy}
                        onChange={(event) =>
                          updateForm("location", event.currentTarget.value)
                        }
                      />
                    </div>
                    <TextareaField
                      id="profile-bio"
                      label="Bio"
                      density="compact"
                      rows={2}
                      className="min-h-16"
                      maxLength={500}
                      value={form.bio}
                      disabled={busy}
                      onChange={(event) => updateForm("bio", event.currentTarget.value)}
                    />
                    <div className="space-y-2.5 border-t border-line/70 pt-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <h4 className="text-sm font-semibold text-text">Connections</h4>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={busy || form.connections.length >= maxProfileConnections}
                          icon={<Plus aria-hidden="true" size={15} />}
                          onClick={() => addConnection()}
                        >
                          Add connection
                        </Button>
                      </div>
                      <ConnectionCards
                        busy={busy}
                        connections={form.connections}
                        editingIds={editingConnectionIds}
                        errors={connectionErrors}
                        onAdd={addConnection}
                        onEdit={editConnection}
                        onFinishEdit={finishConnectionEdit}
                        onRemove={removeConnection}
                        onUpdate={updateConnection}
                      />
                    </div>
                  </EditorSection>
                </div>

              <div className={activeSection === "look" ? "block" : "hidden"}>
                <EditorSection title="Look">
                  <div className="grid gap-3 sm:grid-cols-2">
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
              </div>

              <div className={activeSection === "modules" ? "block" : "hidden"}>
                <ModulesEditorSection
                  badges={badges}
                  busy={moduleBusy}
                  canPersistOrder={canPersistOrder}
                  drafts={drafts}
                  editorBusy={busy}
                  error={moduleError}
                  formError={moduleFormError}
                  featuredContent={{
                    busy,
                    currentPost: profile.featuredPost ?? null,
                    currentRoom: profile.featuredRoom ?? null,
                    error: featuredOptionsError,
                    featuredPostId,
                    featuredPostQuery,
                    featuredRoomId,
                    featuredRoomQuery,
                    loading: featuredOptionsLoading,
                    postOptions: featuredPostOptions,
                    roomOptions: featuredRoomOptions,
                    onClearPost: () => {
                      setFeaturedPostId(null);
                      setModuleMessage(undefined);
                    },
                    onClearRoom: () => {
                      setFeaturedRoomId(null);
                      setModuleMessage(undefined);
                    },
                    onPostQueryChange: (value) => {
                      setFeaturedPostQuery(value);
                      setModuleMessage(undefined);
                    },
                    onRoomQueryChange: (value) => {
                      setFeaturedRoomQuery(value);
                      setModuleMessage(undefined);
                    },
                    onSelectPost: (postId) => {
                      setFeaturedPostId(postId);
                      setModuleMessage(undefined);
                    },
                    onSelectRoom: (roomId) => {
                      setFeaturedRoomId(roomId);
                      setModuleMessage(undefined);
                    },
                  }}
                  featuredDirty={featuredDirty}
                  hasUnsavedNewModule={hasUnsavedNewModule}
                  layoutDirty={layoutDirty}
                  layoutMessage={layoutMessage}
                  layoutPreset={layoutPreset}
                  loading={moduleLoading}
                  message={moduleMessage}
                  orderDirty={orderDirty}
                  savingLayout={savingLayout}
                  selectedDirty={selectedModuleDirty}
                  selectedModuleId={selectedModuleId}
                  onAddModule={addModule}
                  onDelete={(moduleId) => void handleModuleDelete(moduleId)}
                  onLayoutChange={(preset) => {
                    setLayoutPreset(preset);
                    setLayoutMessage(undefined);
                  }}
                  onMove={moveModule}
                  onSave={(event) => void handleModuleSave(event)}
                  onSaveLayout={() => void handleLayoutSave()}
                  onSaveOrder={() => void handleSaveOrder()}
                  onSelect={setSelectedModuleId}
                  onUpdate={updateSelectedModule}
                />
              </div>

              <div className={activeSection === "preview" ? "block" : "hidden"}>
                <PreviewPanel
                  badges={badges}
                  connections={validPreviewConnections}
                  drafts={drafts}
                  featuredPost={previewFeaturedPost}
                  featuredRoom={previewFeaturedRoom}
                  form={form}
                  layoutPreset={layoutPreset}
                  profile={profile}
                  testId="profile-customization-preview-mobile"
                />
              </div>

              {profileMessage ? (
                <ModalSheetStatus tone={profileStatusTone(profileMessage)}>
                  {profileMessage}
                </ModalSheetStatus>
              ) : null}

              {activeSection !== "modules" ? (
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={requestClose}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    icon={<Save aria-hidden="true" size={17} />}
                    onClick={() => void handleProfileSave()}
                  >
                    {savingProfile ? "Saving" : "Save profile"}
                  </Button>
                </div>
              ) : null}
            </div>

              {activeSection !== "preview" ? (
              <div className="hidden min-w-0 lg:block">
                <div className="sticky top-0">
                  <PreviewPanel
                    badges={badges}
                    connections={validPreviewConnections}
                    drafts={drafts}
                    featuredPost={previewFeaturedPost}
                    featuredRoom={previewFeaturedRoom}
                    form={form}
                    layoutPreset={layoutPreset}
                    profile={profile}
                    testId="profile-customization-preview"
                  />
                </div>
              </div>
              ) : null}
            </div>
          </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

type SectionButtonProps = {
  active: boolean;
  onClick: () => void;
  section: (typeof sections)[number];
};

function SectionButton({ active, onClick, section }: SectionButtonProps) {
  const Icon = section.icon;

  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-8 min-w-max shrink-0 items-center gap-1.5 rounded-control px-2.5 py-1.5 text-left transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        active
          ? "bg-canvas text-text shadow-soft"
          : "bg-transparent text-muted hover:bg-canvas/55 hover:text-text",
      )}
      onClick={onClick}
    >
      <Icon aria-hidden="true" className="shrink-0" size={14} />
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold">
          {section.label}
        </span>
      </span>
    </button>
  );
}

type EditorSectionProps = {
  action?: ReactNode;
  children: ReactNode;
  description?: string;
  title: string;
};

function EditorSection({ action, children, description, title }: EditorSectionProps) {
  return (
    <section
      className="space-y-3"
      aria-label={title}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text">{title}</h3>
          {description ? (
            <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
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
      <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-text">
        <ImagePlus aria-hidden="true" size={14} />
        {label}
      </div>
      <div className="flex min-w-0 items-center gap-2.5 rounded-card bg-canvas/40 p-2">
        {imageUrl ? (
          <img
            alt=""
            className={
              wide
                ? "h-12 w-20 shrink-0 rounded-card object-cover"
                : "size-12 shrink-0 rounded-full object-cover"
            }
            src={imageUrl}
          />
        ) : (
          <div
            className={
              wide
                ? "grid h-12 w-20 shrink-0 place-items-center rounded-card border border-dashed border-line bg-surface-strong text-muted"
                : "grid size-12 shrink-0 place-items-center rounded-full border border-dashed border-line bg-surface-strong text-muted"
            }
          >
            <ImagePlus aria-hidden="true" size={16} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <label
            className="inline-flex min-h-8 cursor-pointer items-center justify-center gap-1.5 rounded-control border border-line bg-surface px-2.5 text-xs font-semibold text-text shadow-soft transition duration-fluid hover:border-line-strong focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus"
            htmlFor={id}
          >
            <ImagePlus aria-hidden="true" size={14} />
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
          <p className="mt-1 text-xs leading-5 text-muted">
            Image must be 10 MB or smaller.
          </p>
        </div>
      </div>
    </div>
  );
}

type ConnectionCardsProps = {
  busy: boolean;
  connections: DraftConnection[];
  editingIds: Set<string>;
  errors: Record<string, string>;
  onAdd: (platform: ProfileConnectionPlatform) => void;
  onEdit: (id: string) => void;
  onFinishEdit: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdate: (
    id: string,
    field: keyof Omit<DraftConnection, "id">,
    value: string,
  ) => void;
};

function ConnectionCards({
  busy,
  connections,
  editingIds,
  errors,
  onAdd,
  onEdit,
  onFinishEdit,
  onRemove,
  onUpdate,
}: ConnectionCardsProps) {
  if (connections.length === 0) {
    return (
      <div className="space-y-2.5">
        <p className="rounded-card border border-dashed border-line bg-surface/65 p-2 text-sm text-muted">
          No connections yet. Choose a platform to add a profile link.
        </p>
        <PlatformPicker onAdd={onAdd} />
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="grid gap-2">
        {connections.map((connection) => {
          const platform = platformMeta(connection.platform);
          const validated = validateProfileConnectionDraft(
            connection.platform,
            connection.value,
          );
          const isValid = !("error" in validated);
          const isEditing = editingIds.has(connection.id) || !isValid;

          return (
            <div
              key={connection.id}
              className={cn(
                "min-w-0 rounded-card border p-2",
                platformToneClass(platform.tone),
              )}
            >
              <div className={cn("flex items-start justify-between gap-2", isEditing ? "mb-2" : null)}>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line bg-surface/80 text-text">
                    <ProfileConnectionIcon platform={connection.platform} size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text">
                      {platform.label}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {isValid
                        ? formatProfileConnectionValue(validated.connection)
                        : connection.value.trim() || platform.help}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!isEditing ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${platform.label} connection`}
                      title="Edit connection"
                      disabled={busy}
                      icon={<Edit3 aria-hidden="true" size={15} />}
                      onClick={() => onEdit(connection.id)}
                    />
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${platform.label} connection`}
                    title="Remove connection"
                    disabled={busy}
                    icon={<Trash2 aria-hidden="true" size={16} />}
                    onClick={() => onRemove(connection.id)}
                  />
                </div>
              </div>
              {isEditing ? (
                <div className="grid gap-2">
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
                    <SelectField
                      id={`profile-connection-platform-${connection.id}`}
                      label="Platform"
                      density="compact"
                      value={connection.platform}
                      disabled={busy}
                      options={profileConnectionPlatforms}
                      onChange={(event) =>
                        onUpdate(connection.id, "platform", event.currentTarget.value)
                      }
                    />
                    <TextField
                      id={`profile-connection-value-${connection.id}`}
                      label={connectionPlatformLabel(connection.platform)}
                      density="compact"
                      value={connection.value}
                      placeholder={platform.placeholder}
                      maxLength={300}
                      disabled={busy}
                      onChange={(event) =>
                        onUpdate(connection.id, "value", event.currentTarget.value)
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="min-w-0 text-xs leading-5 text-muted">
                      {errors[connection.id] ?? connectionPlatformHelp(connection.platform)}
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => onFinishEdit(connection.id)}
                    >
                      {connection.value.trim() ? "Done" : "Cancel"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {connections.length < maxProfileConnections ? <PlatformPicker onAdd={onAdd} /> : null}
    </div>
  );
}

function PlatformPicker({
  onAdd,
}: {
  onAdd: (platform: ProfileConnectionPlatform) => void;
}) {
  return (
      <div>
      <h4 className="sr-only">Add by platform</h4>
      <div className="flex flex-wrap gap-1.5">
        {profileConnectionPlatforms.map((platform) => (
            <button
              key={platform.value}
              type="button"
              className={cn(
                "inline-flex min-h-8 min-w-0 items-center gap-1.5 rounded-control border px-2 text-left text-xs font-semibold transition duration-fluid ease-fluid hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                platformToneClass(platform.tone),
              )}
              onClick={() => onAdd(platform.value)}
            >
              <ProfileConnectionIcon
                platform={platform.value}
                size={14}
              />
              <span className="truncate text-text">
                {platform.label}
              </span>
            </button>
          ))}
      </div>
    </div>
  );
}

type FeaturedContentEditorProps = {
  busy: boolean;
  currentPost: Post | null;
  currentRoom: Room | null;
  error?: string | undefined;
  featuredPostId: number | null;
  featuredPostQuery: string;
  featuredRoomId: number | null;
  featuredRoomQuery: string;
  loading: boolean;
  mode?: "post" | "room";
  postOptions: Post[];
  roomOptions: Room[];
  onClearPost: () => void;
  onClearRoom: () => void;
  onPostQueryChange: (value: string) => void;
  onRoomQueryChange: (value: string) => void;
  onSelectPost: (postId: number) => void;
  onSelectRoom: (roomId: number) => void;
};

function FeaturedContentEditor({
  busy,
  currentPost,
  currentRoom,
  error,
  featuredPostId,
  featuredPostQuery,
  featuredRoomId,
  featuredRoomQuery,
  loading,
  mode = "post",
  postOptions,
  roomOptions,
  onClearPost,
  onClearRoom,
  onPostQueryChange,
  onRoomQueryChange,
  onSelectPost,
  onSelectRoom,
}: FeaturedContentEditorProps) {
  const selectedPost =
    postOptions.find((post) => post.id === featuredPostId) ??
    (currentPost?.id === featuredPostId ? currentPost : undefined);
  const selectedRoom =
    roomOptions.find((room) => room.id === featuredRoomId) ??
    (currentRoom?.id === featuredRoomId ? currentRoom : undefined);
  const visiblePosts = filterFeaturedPosts(postOptions, featuredPostQuery).slice(0, 8);
  const visibleRooms = filterFeaturedRooms(roomOptions, featuredRoomQuery).slice(0, 8);

  return (
    <section
      aria-label="Featured content"
      className="space-y-3"
      data-testid="profile-featured-editor"
    >
      {loading ? (
        <CompactStateNotice
          icon={LoaderCircle}
          kind="loading"
          title="Loading featured options"
          text="Loading options."
        />
      ) : null}

      {error ? (
        <CompactStateNotice
          icon={WifiOff}
          kind="error"
          title="Featured options are not available"
          text={error}
        />
      ) : null}

      <div className="grid gap-3">
        {mode === "post" ? (
          <FeaturedPostPicker
            busy={busy}
            options={visiblePosts}
            query={featuredPostQuery}
            selectedPost={selectedPost}
            selectedPostId={featuredPostId}
            totalCount={postOptions.length}
            onClear={onClearPost}
            onQueryChange={onPostQueryChange}
            onSelect={onSelectPost}
          />
        ) : null}
        {mode === "room" ? (
          <FeaturedRoomPicker
            busy={busy}
            options={visibleRooms}
            query={featuredRoomQuery}
            selectedRoom={selectedRoom}
            selectedRoomId={featuredRoomId}
            totalCount={roomOptions.length}
            onClear={onClearRoom}
            onQueryChange={onRoomQueryChange}
            onSelect={onSelectRoom}
          />
        ) : null}
      </div>
    </section>
  );
}

type FeaturedPostPickerProps = {
  busy: boolean;
  options: Post[];
  query: string;
  selectedPost: Post | undefined;
  selectedPostId: number | null;
  totalCount: number;
  onClear: () => void;
  onQueryChange: (value: string) => void;
  onSelect: (postId: number) => void;
};

function FeaturedPostPicker({
  busy,
  options,
  query,
  selectedPost,
  selectedPostId,
  totalCount,
  onClear,
  onQueryChange,
  onSelect,
}: FeaturedPostPickerProps) {
  return (
    <div className="min-w-0 rounded-card border border-line bg-surface/60 p-2.5">
      <div className="flex min-w-0 items-start justify-between gap-2.5">
        <div className="min-w-0">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-text">
            <MessageCircle aria-hidden="true" size={15} />
            Featured post
          </h4>
          {selectedPost ? (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">
              {postOptionText(selectedPost)}
            </p>
          ) : (
            <p className="mt-1 text-xs leading-5 text-muted">No post selected.</p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy || selectedPostId === null}
          onClick={onClear}
        >
          Clear
        </Button>
      </div>

      <TextField
        id="featured-post-search"
        label="Search posts"
        density="compact"
        icon={Search}
        className="mt-2.5"
        value={query}
        disabled={busy || totalCount === 0}
        onChange={(event) => onQueryChange(event.currentTarget.value)}
      />

      <div className="mt-2 space-y-1.5" data-testid="featured-post-options">
        {totalCount === 0 ? (
          <p className="rounded-card border border-dashed border-line bg-canvas/45 p-2 text-sm text-muted">
            No public posts are available to feature.
          </p>
        ) : null}
        {totalCount > 0 && options.length === 0 ? (
          <p className="rounded-card border border-dashed border-line bg-canvas/45 p-2 text-sm text-muted">
            No posts match that search.
          </p>
        ) : null}
        {options.map((post) => (
          <button
            key={post.id}
            type="button"
            aria-pressed={selectedPostId === post.id}
            className={cn(
              "block w-full rounded-card border p-2 text-left transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
              selectedPostId === post.id
                ? "border-accent/50 bg-accent/12"
                : "border-line bg-canvas/45 hover:border-line-strong",
            )}
            disabled={busy}
            onClick={() => onSelect(post.id)}
          >
            <span className="block line-clamp-2 text-sm font-semibold leading-5 text-text">
              {postOptionText(post)}
            </span>
            <span className="mt-1 block text-xs text-muted">
              {post.parentId ? "Reply" : "Post"} · {post.createdAt}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

type FeaturedRoomPickerProps = {
  busy: boolean;
  options: Room[];
  query: string;
  selectedRoom: Room | undefined;
  selectedRoomId: number | null;
  totalCount: number;
  onClear: () => void;
  onQueryChange: (value: string) => void;
  onSelect: (roomId: number) => void;
};

function FeaturedRoomPicker({
  busy,
  options,
  query,
  selectedRoom,
  selectedRoomId,
  totalCount,
  onClear,
  onQueryChange,
  onSelect,
}: FeaturedRoomPickerProps) {
  return (
    <div className="min-w-0 rounded-card border border-line bg-surface/60 p-2.5">
      <div className="flex min-w-0 items-start justify-between gap-2.5">
        <div className="min-w-0">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-text">
            <Radio aria-hidden="true" size={15} />
            Featured room
          </h4>
          {selectedRoom ? (
            <p className="mt-1 truncate text-xs leading-5 text-muted">
              {selectedRoom.name} /{selectedRoom.slug}
            </p>
          ) : (
            <p className="mt-1 text-xs leading-5 text-muted">No room selected.</p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy || selectedRoomId === null}
          onClick={onClear}
        >
          Clear
        </Button>
      </div>

      <TextField
        id="featured-room-search"
        label="Search rooms"
        density="compact"
        icon={Search}
        className="mt-2.5"
        value={query}
        disabled={busy || totalCount === 0}
        onChange={(event) => onQueryChange(event.currentTarget.value)}
      />

      <div className="mt-2 space-y-1.5" data-testid="featured-room-options">
        {totalCount === 0 ? (
          <p className="rounded-card border border-dashed border-line bg-canvas/45 p-2 text-sm text-muted">
            No eligible rooms are available to feature.
          </p>
        ) : null}
        {totalCount > 0 && options.length === 0 ? (
          <p className="rounded-card border border-dashed border-line bg-canvas/45 p-2 text-sm text-muted">
            No rooms match that search.
          </p>
        ) : null}
        {options.map((room) => (
          <button
            key={room.id}
            type="button"
            aria-pressed={selectedRoomId === room.id}
            className={cn(
              "block w-full rounded-card border p-2 text-left transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
              selectedRoomId === room.id
                ? "border-accent/50 bg-accent/12"
                : "border-line bg-canvas/45 hover:border-line-strong",
            )}
            disabled={busy}
            onClick={() => onSelect(room.id)}
          >
            <span className="block truncate text-sm font-semibold text-text">
              {room.name}
            </span>
            <span className="mt-1 block truncate text-xs text-muted">
              /{room.slug} · {room.summary}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function filterFeaturedPosts(posts: Post[], query: string): Post[] {
  const normalized = query.trim().toLowerCase();

  if (normalized === "") {
    return posts;
  }

  return posts.filter((post) =>
    [post.body, post.room.name, post.createdAt]
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );
}

function filterFeaturedRooms(rooms: Room[], query: string): Room[] {
  const normalized = query.trim().toLowerCase();

  if (normalized === "") {
    return rooms;
  }

  return rooms.filter((room) =>
    [room.name, room.slug, room.summary]
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );
}

function postOptionText(post: Post): string {
  const body = post.body.trim().replace(/\s+/g, " ");

  return body.length > 130 ? `${body.slice(0, 127)}...` : body;
}

function profileStatusTone(message: string) {
  return message === "Profile updated" || message === "Images are converted to WebP"
    ? "success"
    : "error";
}

type ModulesEditorSectionProps = {
  badges: UserBadge[];
  busy: "save" | "delete" | "order" | undefined;
  canPersistOrder: boolean;
  drafts: ProfileModule[];
  editorBusy: boolean;
  error?: string | undefined;
  featuredContent: FeaturedContentEditorProps;
  featuredDirty: boolean;
  formError?: string | undefined;
  hasUnsavedNewModule: boolean;
  layoutDirty: boolean;
  layoutMessage?: string | undefined;
  layoutPreset: ProfileLayoutPreset;
  loading: boolean;
  message?: string | undefined;
  orderDirty: boolean;
  savingLayout: boolean;
  selectedDirty: boolean;
  selectedModuleId: number | undefined;
  onAddModule: (type: ProfileModuleType) => void;
  onDelete: (moduleId: number) => void;
  onLayoutChange: (preset: ProfileLayoutPreset) => void;
  onMove: (moduleId: number, direction: -1 | 1) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onSaveLayout: () => void;
  onSaveOrder: () => void;
  onSelect: (moduleId: number | undefined) => void;
  onUpdate: (updater: (module: ProfileModule) => ProfileModule) => void;
};

function ModulesEditorSection({
  badges,
  busy,
  canPersistOrder,
  drafts,
  editorBusy,
  error,
  featuredContent,
  featuredDirty,
  formError,
  hasUnsavedNewModule,
  layoutDirty,
  layoutMessage,
  layoutPreset,
  loading,
  message,
  orderDirty,
  savingLayout,
  selectedDirty,
  selectedModuleId,
  onAddModule,
  onDelete,
  onLayoutChange,
  onMove,
  onSave,
  onSaveLayout,
  onSaveOrder,
  onSelect,
  onUpdate,
}: ModulesEditorSectionProps) {
  return (
    <section
      aria-label="Modules"
      className="space-y-3"
      data-testid="profile-module-editor"
    >
      <h3 className="text-sm font-semibold text-text">Modules</h3>

      {loading ? (
        <CompactStateNotice
          icon={LoaderCircle}
          kind="loading"
          title="Loading modules"
          text="Loading modules."
        />
      ) : null}

      {error ? (
        <CompactStateNotice
          icon={WifiOff}
          kind="error"
          title="Modules are not available"
          text={error}
        />
      ) : null}

      {!loading ? (
        <div className="min-w-0 space-y-4">
          <LayoutPresetControl
            disabled={editorBusy}
            dirty={layoutDirty}
            message={layoutMessage}
            saving={savingLayout}
            value={layoutPreset}
            onChange={onLayoutChange}
            onSave={onSaveLayout}
          />

          <section>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-sm font-semibold text-text">Your modules</h4>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!canPersistOrder || busy !== undefined}
                onClick={onSaveOrder}
              >
                {busy === "order" ? "Saving order" : "Save order"}
              </Button>
            </div>
            {orderDirty && hasUnsavedNewModule ? (
              <p className="mt-2 text-xs leading-5 text-muted">
                Save new modules before saving order.
              </p>
            ) : null}
            {message ? (
              <motion.div
                className="mt-3"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <ModalSheetStatus tone="success">{message}</ModalSheetStatus>
              </motion.div>
            ) : null}
            <div className="mt-3 space-y-2.5" data-testid="profile-module-list">
              {drafts.length === 0 ? (
                <CompactStateNotice
                  icon={Sparkles}
                  title="No modules yet"
                  text="Add a block below."
                  className="border border-dashed border-line bg-canvas/45"
                />
              ) : null}
              {drafts.map((module, index) => (
                <ModuleTile
                  key={module.id}
                  badges={badges}
                  busy={busy}
                  canMoveDown={index < drafts.length - 1}
                  canMoveUp={index > 0}
                  expanded={selectedModuleId === module.id}
                  featuredContent={featuredContent}
                  featuredDirty={
                    selectedModuleId === module.id &&
                    isFeaturedContentModule(module.type)
                      ? featuredDirty
                      : false
                  }
                  formError={selectedModuleId === module.id ? formError : undefined}
                  module={module}
                  selectedDirty={selectedModuleId === module.id ? selectedDirty : false}
                  onDelete={() => onDelete(module.id)}
                  onMove={(direction) => onMove(module.id, direction)}
                  onSave={onSave}
                  onSelect={() =>
                    onSelect(selectedModuleId === module.id ? undefined : module.id)
                  }
                  onUpdate={onUpdate}
                />
              ))}
            </div>
          </section>

          <section>
            <h4 className="text-sm font-semibold text-text">Add module</h4>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {moduleTypes.filter((moduleType) => moduleType.addable !== false).map((moduleType) => {
                const Icon = moduleType.icon;

                return (
                  <button
                    key={moduleType.type}
                    type="button"
                    className="group flex min-w-0 items-center gap-2 rounded-card border border-line bg-surface/55 p-2 text-left shadow-soft transition duration-fluid ease-fluid hover:border-line-strong hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    onClick={() => onAddModule(moduleType.type)}
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent/15 text-text transition group-hover:bg-accent/25">
                      <Icon aria-hidden="true" size={15} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-text">
                        {moduleType.label}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted">
                        {moduleType.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

type LayoutPresetControlProps = {
  dirty: boolean;
  disabled: boolean;
  message?: string | undefined;
  onChange: (preset: ProfileLayoutPreset) => void;
  onSave: () => void;
  saving: boolean;
  value: ProfileLayoutPreset;
};

function LayoutPresetControl({
  dirty,
  disabled,
  message,
  onChange,
  onSave,
  saving,
  value,
}: LayoutPresetControlProps) {
  return (
    <section
      aria-label="Layout preset"
      className="space-y-2.5 rounded-card bg-canvas/45 p-2.5"
      data-testid="profile-layout-editor"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-text">
            <LayoutGrid aria-hidden="true" size={15} />
            Layout
          </h4>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || !dirty}
          icon={<Save aria-hidden="true" size={15} />}
          onClick={onSave}
        >
          {saving ? "Saving" : "Save layout"}
        </Button>
      </div>

      <div
        className="grid gap-1 rounded-control bg-surface/70 p-1 sm:grid-cols-3"
        data-testid="profile-layout-presets"
      >
        {profileLayoutPresetOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            className={cn(
              "min-w-0 rounded-control px-2 py-1.5 text-left transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
              value === option.value
                ? "bg-surface text-text shadow-soft"
                : "text-muted hover:bg-canvas/55 hover:text-text",
            )}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            <span className="block truncate text-sm font-semibold">
              {option.label}
            </span>
            <span className="block truncate text-xs">
              {option.description}
            </span>
          </button>
        ))}
      </div>

      {message ? (
        <div>
          <ModalSheetStatus tone={message === "Layout saved" ? "success" : "error"}>
            {message}
          </ModalSheetStatus>
        </div>
      ) : null}
    </section>
  );
}

type ModuleTileProps = {
  badges: UserBadge[];
  busy: "save" | "delete" | "order" | undefined;
  canMoveDown: boolean;
  canMoveUp: boolean;
  expanded: boolean;
  featuredContent: FeaturedContentEditorProps;
  featuredDirty: boolean;
  formError?: string | undefined;
  module: ProfileModule;
  selectedDirty: boolean;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onSelect: () => void;
  onUpdate: (updater: (module: ProfileModule) => ProfileModule) => void;
};

function ModuleTile({
  badges,
  busy,
  canMoveDown,
  canMoveUp,
  expanded,
  featuredContent,
  featuredDirty,
  formError,
  module,
  selectedDirty,
  onDelete,
  onMove,
  onSave,
  onSelect,
  onUpdate,
}: ModuleTileProps) {
  const moduleType = moduleTypeMeta(module.type);
  const Icon = moduleType.icon;
  const title = module.title || moduleType.label;
  const isBuiltInModule =
    module.type === "activity" || isFeaturedContentModule(module.type);
  const canSaveModule = module.id < 0 || selectedDirty || featuredDirty;
  const shouldReduceMotion = useReducedMotion();

  return (
    <article
      className={cn(
        "min-w-0 rounded-card border border-line/70 bg-surface/68 p-2.5 shadow-soft transition duration-fluid ease-fluid",
        expanded ? "border-line-strong bg-surface" : "hover:border-line-strong hover:bg-surface",
      )}
      data-testid={`profile-module-card-${module.id}`}
    >
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-2 rounded-card text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          aria-expanded={expanded}
          data-testid={`profile-module-toggle-${module.id}`}
          onClick={onSelect}
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-canvas/75 text-text">
            <Icon aria-hidden="true" size={15} />
          </span>
          <span className="min-w-0">
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold text-text">{title}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-canvas/70 px-1.5 py-0.5 text-[0.68rem] font-semibold text-muted">
                {visibilityIcon(module.visibility)}
                {visibilityLabel(module.visibility)}
              </span>
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted">
              {profileModuleSummary(module)}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 flex-wrap gap-1 sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Move ${title} up`}
            title="Move up"
            disabled={!canMoveUp || busy !== undefined}
            icon={<ArrowUp aria-hidden="true" size={15} />}
            onClick={() => onMove(-1)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Move ${title} down`}
            title="Move down"
            disabled={!canMoveDown || busy !== undefined}
            icon={<ArrowDown aria-hidden="true" size={15} />}
            onClick={() => onMove(1)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`${expanded ? "Collapse" : "Edit"} ${title}`}
            title={expanded ? "Collapse" : "Edit"}
            disabled={busy !== undefined}
            icon={<Edit3 aria-hidden="true" size={15} />}
            onClick={onSelect}
          />
          {!isBuiltInModule ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Delete ${title}`}
              title="Delete"
              disabled={busy !== undefined}
              icon={<Trash2 aria-hidden="true" size={15} />}
              onClick={onDelete}
            />
          ) : null}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.form
            className="mt-2.5 space-y-2.5 overflow-hidden border-t border-line/70 pt-2.5"
            data-testid="profile-module-expanded"
            initial={shouldReduceMotion ? false : { opacity: 0, height: 0 }}
            animate={
              shouldReduceMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }
            }
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: "easeOut" }}
            onSubmit={onSave}
          >
            <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto]">
              <TextField
                id={`module-title-${module.id}`}
                label="Title"
                density="compact"
                maxLength={maxTitleLength}
                value={module.title ?? ""}
                onChange={(event) =>
                  onUpdate((current) => ({
                    ...current,
                    title: event.currentTarget.value || null,
                  }))
                }
              />
              <VisibilitySegmentedControl
                value={module.visibility}
                onChange={(visibility) =>
                  onUpdate((current) => ({
                    ...current,
                    visibility,
                  }))
                }
              />
            </div>

            <ModuleTypeFields
              badges={badges}
              featuredContent={featuredContent}
              module={module}
              onChange={onUpdate}
            />

            <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
              <Button
                type="submit"
                size="sm"
                icon={<Save aria-hidden="true" size={15} />}
                disabled={busy !== undefined || !canSaveModule}
              >
                {busy === "save" ? "Saving" : "Save module"}
              </Button>
            </div>

            {formError ? (
              <ModalSheetStatus tone="error">{formError}</ModalSheetStatus>
            ) : null}
          </motion.form>
        ) : null}
      </AnimatePresence>
    </article>
  );
}

type VisibilitySegmentedControlProps = {
  onChange: (visibility: ProfileModuleVisibility) => void;
  value: ProfileModuleVisibility;
};

function VisibilitySegmentedControl({ onChange, value }: VisibilitySegmentedControlProps) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-medium text-text">Visibility</legend>
      <div className="inline-flex min-h-9 max-w-full rounded-control bg-canvas/70 p-1">
        {visibilityOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={cn(
              "rounded-control px-2.5 py-1.5 text-xs font-medium transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
              value === option.value
                ? "bg-surface text-text shadow-soft"
                : "text-muted hover:text-text",
            )}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

type ModuleTypeFieldsProps = {
  badges: UserBadge[];
  featuredContent: FeaturedContentEditorProps;
  module: ProfileModule;
  onChange: (updater: (module: ProfileModule) => ProfileModule) => void;
};

function ModuleTypeFields({
  badges,
  featuredContent,
  module,
  onChange,
}: ModuleTypeFieldsProps) {
  if (module.type === "activity") {
    return (
      <div className="rounded-card border border-line bg-canvas/45 p-2 text-sm leading-5 text-muted">
        Feed, replies, and rooms use the existing profile activity sources.
      </div>
    );
  }

  if (module.type === "featured_post") {
    return <FeaturedContentEditor {...featuredContent} mode="post" />;
  }

  if (module.type === "featured_room") {
    return <FeaturedContentEditor {...featuredContent} mode="room" />;
  }

  if (module.type === "links") {
    const links = module.config.links ?? [];

    return (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <h5 className="text-sm font-semibold text-text">Links</h5>
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
          <p className="rounded-card border border-dashed border-line bg-canvas/45 p-2 text-sm text-muted">
            Add at least one safe HTTPS link.
          </p>
        ) : null}
        {links.map((link, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-card border border-line bg-surface p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]"
          >
            <TextField
              id={`module-link-label-${index}`}
              label={`Link ${index + 1} label`}
              density="compact"
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
              density="compact"
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
                    links: (current.config.links ?? []).filter(
                      (_, linkIndex) => linkIndex !== index,
                    ),
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
      <fieldset>
        <legend className="text-sm font-semibold text-text">Earned badges</legend>
        {badges.length === 0 ? (
          <p className="mt-2 rounded-card border border-dashed border-line bg-canvas/45 p-2 text-sm text-muted">
            No earned badges are available for this module.
          </p>
        ) : (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {badges.map((userBadge) => (
              <label
                key={userBadge.id}
                className="flex min-w-0 items-start gap-2 rounded-card border border-line bg-surface p-2 text-sm"
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
                  <span className="block text-xs text-muted">
                    {userBadge.badge.rarity}
                  </span>
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
      density="compact"
      rows={3}
      maxLength={maxBodyLength}
      className="min-h-20"
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

type PreviewPanelProps = {
  badges: UserBadge[];
  connections: ProfileExternalConnection[];
  drafts: ProfileModule[];
  featuredPost: Post | null;
  featuredRoom: Room | null;
  form: ProfileFormState;
  layoutPreset: ProfileLayoutPreset;
  profile: Profile;
  testId?: string;
};

function PreviewPanel({
  badges,
  connections,
  drafts,
  featuredPost,
  featuredRoom,
  form,
  layoutPreset,
  profile,
  testId,
}: PreviewPanelProps) {
  const previewUser = {
    ...profile.user,
    displayName: form.displayName || profile.user.displayName,
    avatarUrl: form.avatarUrl || null,
  };
  const featuredBadges = badges.filter((badge) => badge.featuredOrder !== null).slice(0, 4);
  const publicPreviewModules = previewModules(drafts).filter(
    (module) =>
      (module.type !== "featured_post" || Boolean(featuredPost)) &&
      (module.type !== "featured_room" || Boolean(featuredRoom)),
  );

  return (
    <section
      aria-label="Profile preview"
      className="min-w-0 rounded-card border border-line bg-surface/80 p-2.5 shadow-soft"
      data-testid={testId}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-text">Preview</h3>
        </div>
        <Badge tone="cool">Draft</Badge>
      </div>
      <div className="overflow-hidden rounded-card bg-canvas/35">
        <div
          className="isolate relative h-14 bg-surface-strong"
          data-testid="profile-preview-banner"
        >
          {form.profileBackground ? (
            <img
              alt=""
              className="absolute inset-0 z-0 size-full object-cover opacity-35"
              src={form.profileBackground}
            />
          ) : null}
          {form.bannerUrl ? (
            <img
              alt=""
              className="absolute inset-0 z-0 size-full object-cover"
              src={form.bannerUrl}
            />
          ) : (
            <div className="absolute inset-0 z-0 bg-gradient-to-br from-accent/25 via-surface-strong to-frost/25" />
          )}
          <div className="absolute inset-x-0 bottom-0 z-10 h-12 bg-gradient-to-t from-surface via-surface/70 to-transparent" />
        </div>
        <div className="relative z-10 px-2.5 pb-2.5">
          <div
            className="relative z-10 -mt-6 flex items-end gap-2"
            data-testid="profile-preview-identity"
          >
            <Avatar
              user={previewUser}
              size="lg"
              className="size-12 border-[3px] border-surface text-sm shadow-lift"
            />
            <div className="min-w-0 pb-1">
              <h4 className="truncate text-sm font-semibold text-text">
                {form.displayName || profile.user.displayName}
              </h4>
              <p className="break-all text-xs text-muted">@{profile.user.handle}</p>
            </div>
          </div>
          {form.bio ? (
            <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-5 text-text">
              {form.bio}
            </p>
          ) : null}
          {form.location ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
              <MapPin aria-hidden="true" size={14} />
              <span className="min-w-0 truncate">{form.location}</span>
            </p>
          ) : null}
          {connections.length > 0 ? (
            <div className="mt-2 flex min-w-0 flex-wrap gap-1">
              {connections.map((connection) => (
                  <span
                    key={`${connection.platform}-${connection.value}`}
                    className="inline-flex min-w-0 items-center gap-1 rounded-control border border-line bg-surface/70 px-1.5 py-0.5 text-xs font-semibold text-text"
                  >
                    <ProfileConnectionIcon platform={connection.platform} size={13} />
                    <span className="truncate">{connectionPlatformLabel(connection.platform)}</span>
                  </span>
                ))}
            </div>
          ) : null}
          {featuredBadges.length > 0 ? (
            <div className="mt-2 flex min-w-0 flex-wrap gap-1">
              {featuredBadges.map((userBadge) => (
                <span
                  key={userBadge.id}
                  className="inline-flex min-w-0 items-center gap-1 rounded-control border border-line bg-surface-strong px-1.5 py-0.5 text-xs font-semibold text-text"
                >
                  <BadgeCheck aria-hidden="true" size={13} />
                  <span className="truncate">{userBadge.badge.name}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div
        className="mt-2.5"
        data-testid={
          testId === "profile-customization-preview"
            ? "profile-module-preview"
            : "profile-module-preview-mobile"
        }
      >
        {publicPreviewModules.length > 0 ? (
          <ProfileModuleGrid
            badges={badges}
            layoutPreset={layoutPreset}
            maxColumns={2}
            modules={publicPreviewModules}
            renderModuleContent={(module) =>
              module.type === "featured_post" ? (
                <FeaturedPostPreviewModule
                  featuredPost={featuredPost}
                  title={module.title ?? "Featured post"}
                />
              ) : module.type === "featured_room" ? (
                <FeaturedRoomPreviewModule
                  featuredRoom={featuredRoom}
                  title={module.title ?? "Featured room"}
                />
              ) : undefined
            }
          />
        ) : (
          <p className="rounded-card border border-dashed border-line bg-canvas/45 p-2 text-xs leading-5 text-muted">
            No public modules in this draft.
          </p>
        )}
      </div>
    </section>
  );
}

function FeaturedPostPreviewModule({
  featuredPost,
  title,
}: {
  featuredPost: Post | null;
  title: string;
}) {
  return (
    <article
      className="h-full min-w-0 rounded-card border border-line bg-surface/68 p-2.5"
      data-testid="profile-featured-post-preview"
    >
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      <div className="mt-1.5 space-y-1.5">
        {featuredPost ? (
          <div className="rounded-card bg-canvas/55 p-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted">
              <MessageCircle aria-hidden="true" size={14} />
              Featured post
            </p>
            <p className="mt-1 line-clamp-3 text-sm leading-5 text-text">
              {postOptionText(featuredPost)}
            </p>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function FeaturedRoomPreviewModule({
  featuredRoom,
  title,
}: {
  featuredRoom: Room | null;
  title: string;
}) {
  return (
    <article
      className="h-full min-w-0 rounded-card border border-line bg-surface/68 p-2.5"
      data-testid="profile-featured-room-preview"
    >
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      <div className="mt-1.5 space-y-1.5">
        {featuredRoom ? (
          <div className="rounded-card bg-canvas/55 p-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted">
              <Radio aria-hidden="true" size={14} />
              Featured room
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-text">
              {featuredRoom.name}
            </p>
            <p className="mt-1 truncate text-xs text-muted">/{featuredRoom.slug}</p>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function profileToForm(profile: Profile): ProfileFormState {
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

function uploadFieldName(slot: UploadSlot): keyof ProfileFormState {
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
  if (type === "activity" || isFeaturedContentModule(type) || type === "profile_info") {
    return {};
  }

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
  if (
    module.type === "activity" ||
    isFeaturedContentModule(module.type) ||
    module.type === "profile_info"
  ) {
    return {};
  }

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

  if (
    module.type === "activity" ||
    isFeaturedContentModule(module.type) ||
    module.type === "profile_info"
  ) {
    return undefined;
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
  return /<\s*\/?\s*[a-z][^>]*>/i.test(value)
    || /(?:javascript|data)\s*:/i.test(value)
    || /\bon[a-z]+\s*=/i.test(value);
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

function moduleTypeMeta(type: ProfileModuleType) {
  const fallback = moduleTypes[0];

  if (!fallback) {
    throw new Error("Profile module types are not configured.");
  }

  return moduleTypes.find((moduleType) => moduleType.type === type) ?? fallback;
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

function platformMeta(platform: ProfileConnectionPlatform) {
  return profileConnectionPlatforms.find((item) => item.value === platform) ?? {
    value: "website" as const,
    label: "Website",
    help: "Use a full https:// URL.",
    placeholder: "https://example.com",
    tone: "warm" as const,
  };
}

function platformToneClass(tone: (typeof profileConnectionPlatforms)[number]["tone"]) {
  return {
    warm: "border-accent/25 bg-accent/10",
    cool: "border-frost/25 bg-frost/10",
    rose: "border-rose/25 bg-rose/10",
    leaf: "border-leaf/25 bg-leaf/10",
    neutral: "border-line bg-surface/60",
  }[tone];
}
