import {
  ArrowRight,
  Award,
  BadgeCheck,
  Bug,
  CalendarDays,
  Eye,
  Heart,
  ImagePlus,
  Link2,
  MessageCircle,
  Music2,
  Pin,
  Plus,
  Radio,
  Repeat2,
  Reply,
  Save,
  Settings2,
  Shield,
  Sparkles,
  Star,
  Trash2,
  Undo2,
  X,
  UserCheck,
  Users,
  Video,
} from "lucide-react";
import { motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  Link,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router";
import type { AppShellOutletContext } from "../components/layout/AppShell";
import { PageMeta } from "../components/PageMeta";
import { PostCard } from "../components/social/PostCard";
import { ProfileHeader } from "../components/social/ProfileHeader";
import { ProfileConnectionIcon } from "../components/social/ProfileConnectionIcon";
import {
  ProfileModulesSection,
  type ProfileMusicAutoplayRequest,
} from "../components/social/ProfileModules";
import { ReportForm } from "../components/social/ReportForm";
import { RoomCard } from "../components/social/RoomCard";
import { UserIdentityLink } from "../components/social/UserProfileLink";
import { ApiStateNotice } from "../components/ui/ApiStateNotice";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { ImageCropModal } from "../components/ui/ImageCropModal";
import { ModalSheet } from "../components/ui/ModalSheet";
import {
  blockProfile,
  createProfileModule,
  deleteProfileModule,
  disconnectProfileIntegration,
  followProfile,
  getMyProfileIntegrations,
  getProfile,
  getProfileBadges,
  getProfileFollowers,
  getProfileFollowing,
  getProfileModules,
  getMyProfileModules,
  getProfilePosts,
  getProfileReblogs,
  getProfileReplies,
  getProfileRooms,
  muteProfile,
  removeProfileFollower,
  resolveProfileIntegrationMetadata,
  restoreProfileModule,
  startProfileIntegration,
  unblockProfile,
  unfollowProfile,
  unmuteProfile,
  updateProfileCanvas,
  updateFeaturedBadges,
  updateProfileFeaturedContent,
  updateMyProfile,
  updateProfileModule,
  uploadImage,
  uploadVideo,
  type CreateProfileModuleInput,
  type FollowRelationship,
  type ImageUploadPurpose,
  type ProfileIntegrationAccount,
  type ProfileIntegrationProvider,
  type ProfileIntegrationProviderStatus,
  type ProfileIntegrationsResult,
  type UpdateProfileInput,
} from "../lib/api";
import { ApiClientError } from "../lib/apiClient";
import { cn } from "../lib/classNames";
import { formatShortDate } from "../lib/dates";
import { validateImageCropFile } from "../lib/imageCrop";
import { pageEntrance } from "../lib/motionPresets";
import { formatCountWithUnit } from "../lib/pluralize";
import {
  connectionPlatformLabel,
  profileConnectionPlatforms,
  validateProfileConnectionDraft,
} from "../lib/profileConnections";
import { defaultProfileLayoutPreset } from "../lib/profileLayoutPresets";
import {
  profileGridModuleSizeSpan,
  profileGridModuleSpanSize,
  profileModuleAllowedSizes,
  profileModuleFallbackTitle,
  profileModuleGridSpan,
  profileModuleSizeLabel,
  type ProfileGridModuleSize,
} from "../lib/profileModuleRegistry";
import { safeProfileImageUrl } from "../lib/profileMedia";
import type {
  BadgeDefinition,
  Post,
  Profile,
  ProfileBackgroundBlur,
  ProfileCanvasMovementContext,
  ProfileConnectionPlatform,
  ProfileExternalConnection,
  ProfileIntegrationCard,
  ProfileLayoutPreset,
  ProfileModule,
  ProfileModuleConfig,
  ProfileModuleLayout,
  ProfileModuleLink,
  ProfileModuleType,
  Room,
  UserBadge,
} from "../lib/types";
import { useAsyncData } from "../lib/useAsyncData";
import { useAuth } from "../lib/useAuth";
import {
  SiApplemusic,
  SiGithub,
  SiSpotify,
  SiTwitch,
  SiYoutube,
} from "react-icons/si";

const PROFILE_CANVAS_COLUMNS = 6;
const PROFILE_CANVAS_ROWS = 12;
const PROFILE_CONTENT_AUTOSAVE_DELAY_MS = 650;

type ProfileTab = "feed" | "replies" | "rooms";
type ProfilePanel = "followers" | "following" | "badges";
type ProfileContentAutosaveState = "idle" | "pending" | "saving" | "saved" | "error";

function profileContentAutosaveInput(
  draft: Profile,
  saved: Profile,
): UpdateProfileInput | undefined {
  const next = {
    displayName: draft.user.displayName,
    bio: draft.bio,
    location: draft.location,
    avatarUrl: draft.user.avatarUrl ?? null,
    bannerUrl: draft.bannerUrl ?? null,
    profileBackground: draft.profileBackground ?? null,
    profileBackgroundVideo: draft.profileBackgroundVideo ?? null,
    profileBackgroundVideoPoster: draft.profileBackgroundVideoPoster ?? null,
  };
  const current = {
    displayName: saved.user.displayName,
    bio: saved.bio,
    location: saved.location,
    avatarUrl: saved.user.avatarUrl ?? null,
    bannerUrl: saved.bannerUrl ?? null,
    profileBackground: saved.profileBackground ?? null,
    profileBackgroundVideo: saved.profileBackgroundVideo ?? null,
    profileBackgroundVideoPoster: saved.profileBackgroundVideoPoster ?? null,
  };

  return Object.entries(next).some(
    ([key, value]) => current[key as keyof typeof current] !== value,
  )
    ? next
    : undefined;
}

function mergeAutosavedProfileContent(current: Profile, saved: Profile): Profile {
  return {
    ...current,
    bio: saved.bio,
    location: saved.location,
    bannerUrl: saved.bannerUrl ?? null,
    profileBackground: saved.profileBackground ?? null,
    profileBackgroundVideo: saved.profileBackgroundVideo ?? null,
    profileBackgroundVideoPoster: saved.profileBackgroundVideoPoster ?? null,
    user: {
      ...current.user,
      displayName: saved.user.displayName,
      avatarUrl: saved.user.avatarUrl ?? null,
    },
  };
}

export function ProfilePage() {
  const { handle, profileHandle } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { setTopBarAction } = useOutletContext<AppShellOutletContext>();
  const { runWithAuth, status, user } = useAuth();
  const canvasEditReturnHandledRef = useRef(false);
  const profileContentAutosaveRequestRef = useRef(0);
  const [activeTab, setActiveTab] = useState<ProfileTab>("feed");
  const [activePanel, setActivePanel] = useState<ProfilePanel | undefined>();
  const [profileOverride, setProfileOverride] = useState<Profile | undefined>();
  const [badgesOverride, setBadgesOverride] = useState<
    { handle: string; result: Awaited<ReturnType<typeof getProfileBadges>> } | undefined
  >();
  const [modulesOverride, setModulesOverride] = useState<
    { handle: string; modules: ProfileModule[] } | undefined
  >();
  const [canvasEditing, setCanvasEditing] = useState(false);
  const [canvasLoading, setCanvasLoading] = useState(false);
  const [canvasSaving, setCanvasSaving] = useState(false);
  const [canvasError, setCanvasError] = useState<string | undefined>();
  const [draftModules, setDraftModules] = useState<ProfileModule[]>([]);
  const [deletedDraftModules, setDeletedDraftModules] = useState<ProfileModule[]>([]);
  const [draftBackgroundBlur, setDraftBackgroundBlur] =
    useState<ProfileBackgroundBlur>("medium");
  const [draftProfile, setDraftProfile] = useState<Profile | undefined>();
  const [profileContentAutosaveState, setProfileContentAutosaveState] =
    useState<ProfileContentAutosaveState>("idle");
  const [profileContentAutosaveError, setProfileContentAutosaveError] =
    useState<string | undefined>();
  const [profileDraftUploading, setProfileDraftUploading] = useState<
    "backgroundImage" | "backgroundVideo" | "avatar" | "banner" | undefined
  >();
  const [pendingProfileImageCrop, setPendingProfileImageCrop] = useState<
    | {
        file: File;
        purpose: Extract<
          ImageUploadPurpose,
          "avatar" | "banner" | "profile_background"
        >;
      }
    | undefined
  >();
  const [selectedCanvasModuleId, setSelectedCanvasModuleId] = useState<
    number | undefined
  >();
  const [canvasMovementContext, setCanvasMovementContext] = useState<
    ProfileCanvasMovementContext | undefined
  >();
  const [profileIntegrations, setProfileIntegrations] =
    useState<ProfileIntegrationsResult | undefined>();
  const [integrationBusy, setIntegrationBusy] = useState<
    ProfileIntegrationProvider | "metadata" | undefined
  >();
  const [integrationMessage, setIntegrationMessage] = useState<string | undefined>();
  const [
    musicAutoplayDismissedProfileId,
    setMusicAutoplayDismissedProfileId,
  ] = useState<number | undefined>(undefined);
  const [musicAutoplayRequestId, setMusicAutoplayRequestId] = useState(0);
  const [followState, setFollowState] = useState<
    { handle: string; relationship: FollowRelationship } | undefined
  >();
  const [followPosting, setFollowPosting] = useState(false);
  const [followError, setFollowError] = useState<
    { handle: string; message: string } | undefined
  >();
  const [profileControlBusy, setProfileControlBusy] = useState<
    "block" | "mute" | undefined
  >();
  const [profileControlMessage, setProfileControlMessage] = useState<
    { handle: string; message: string } | undefined
  >();
  const [profileControlError, setProfileControlError] = useState<
    { handle: string; message: string } | undefined
  >();

  useEffect(() => {
    if (typeof document === "undefined" || !canvasEditing) {
      return undefined;
    }

    document.body.dataset.profileCanvasEditing = "true";

    return () => {
      delete document.body.dataset.profileCanvasEditing;
    };
  }, [canvasEditing]);

  const normalizedHandle = (handle ?? profileHandle ?? "thia")
    .replace(/^@/, "")
    .toLowerCase();
  const profileLoader = useMemo(
    () => () => getProfile(normalizedHandle),
    [normalizedHandle],
  );
  const postsLoader = useMemo(
    () => () => getProfilePosts(normalizedHandle),
    [normalizedHandle],
  );
  const repliesLoader = useMemo(
    () => () => getProfileReplies(normalizedHandle),
    [normalizedHandle],
  );
  const reblogsLoader = useMemo(
    () => () => getProfileReblogs(normalizedHandle),
    [normalizedHandle],
  );
  const roomsLoader = useMemo(
    () => () => getProfileRooms(normalizedHandle),
    [normalizedHandle],
  );
  const badgesLoader = useMemo(
    () => () => getProfileBadges(normalizedHandle),
    [normalizedHandle],
  );
  const modulesLoader = useMemo(
    () => () => getProfileModules(normalizedHandle),
    [normalizedHandle],
  );
  const profileState = useAsyncData(profileLoader);
  const postsState = useAsyncData(postsLoader);
  const repliesState = useAsyncData(repliesLoader);
  const reblogsState = useAsyncData(reblogsLoader);
  const roomsState = useAsyncData(roomsLoader);
  const badgesState = useAsyncData(badgesLoader);
  const modulesState = useAsyncData(modulesLoader);
  const activeFollowState =
    followState?.handle === normalizedHandle ? followState.relationship : undefined;
  const activeFollowError =
    followError?.handle === normalizedHandle ? followError.message : undefined;
  const activeProfileControlMessage =
    profileControlMessage?.handle === normalizedHandle
      ? profileControlMessage.message
      : undefined;
  const activeProfileControlError =
    profileControlError?.handle === normalizedHandle
      ? profileControlError.message
      : undefined;
  const sourceProfile =
    profileOverride?.user.handle.toLowerCase() === normalizedHandle
      ? profileOverride
      : profileState.data;
  const profile = mergeFollowState(sourceProfile, activeFollowState);
  const workingProfile = canvasEditing && draftProfile ? draftProfile : profile;
  const profileReplies = repliesState.data ?? [];
  const profileFeed = useMemo(
    () => mergeProfileFeed(postsState.data ?? [], reblogsState.data ?? []),
    [postsState.data, reblogsState.data],
  );
  const profileRooms = useMemo(() => roomsState.data ?? [], [roomsState.data]);
  const profileBadgesResult =
    badgesOverride?.handle === normalizedHandle ? badgesOverride.result : badgesState.data;
  const profileBadges = profileBadgesResult?.badges ?? [];
  const featuredBadges = profileBadgesResult?.featuredBadges ?? [];
  const loadedModules =
    modulesOverride?.handle === normalizedHandle
      ? modulesOverride.modules
      : modulesState.data ?? [];
  const displayModules = canvasEditing ? draftModules : loadedModules;
  const publicModules = displayModules.filter(
    (module) => module.visibility === "public" && module.status === "active",
  );
  const profileLayoutPreset =
    profile?.profileLayoutPreset ?? defaultProfileLayoutPreset;
  const profileMissing =
    profileState.error instanceof ApiClientError && profileState.error.status === 404;
  const isOwnProfile =
    status === "authenticated" &&
    Boolean(user) &&
    user?.handle.toLowerCase() === normalizedHandle;
  const musicAutoplayTarget = useMemo(() => {
    if (!profile || canvasEditing || status === "loading" || isOwnProfile) {
      return undefined;
    }

    return firstSpotifyMusicAutoplayModule(
      resolveProfileCanvasModules(
        profile,
        mergeProfileLinksIntoConnectionModules(profile, publicModules),
      ),
    );
  }, [canvasEditing, isOwnProfile, profile, publicModules, status]);
  const musicAutoplayConsentKey = profile && musicAutoplayTarget
    ? profileMusicAutoplayConsentKey(profile.user.id)
    : undefined;
  const musicAutoplayTargetId = musicAutoplayTarget?.id;
  const musicAutoplayStoredConsent =
    profile && musicAutoplayConsentKey
      ? readProfileMusicAutoplayConsent(
          musicAutoplayConsentKey,
          profile.user.id,
          profile.user.handle,
        )
      : false;
  const musicAutoplayAllowed = Boolean(
    profile &&
    musicAutoplayTargetId !== undefined &&
    (musicAutoplayStoredConsent ||
      musicAutoplayDismissedProfileId === profile.user.id),
  );
  const musicAutoplayRequestIdForTarget =
    musicAutoplayRequestId > 0
      ? musicAutoplayRequestId
      : musicAutoplayStoredConsent
        ? 1
        : 0;
  const musicAutoplayRequest: ProfileMusicAutoplayRequest | undefined =
    musicAutoplayAllowed &&
    musicAutoplayTargetId !== undefined &&
    musicAutoplayRequestIdForTarget > 0
      ? {
          requestId: musicAutoplayRequestIdForTarget,
          targetModuleId: musicAutoplayTargetId,
        }
      : undefined;

  function handleContinueToProfileMusic() {
    if (!profile || !musicAutoplayConsentKey) {
      return;
    }

    writeProfileMusicAutoplayConsent(musicAutoplayConsentKey, {
      grantedAt: new Date().toISOString(),
      handle: profile.user.handle,
      profileId: profile.user.id,
      provider: "spotify",
    });
    setMusicAutoplayDismissedProfileId(profile.user.id);
    setMusicAutoplayRequestId((requestId) => requestId + 1);
  }

  async function handleFollowToggle() {
    if (!profile || isOwnProfile || profile.blockedByMe || followPosting) {
      return;
    }

    if (status !== "authenticated") {
      navigate("/login");
      return;
    }

    setFollowPosting(true);
    setFollowError(undefined);

    try {
      const nextState = await runWithAuth(
        (csrfToken) =>
          profile.isFollowing
            ? unfollowProfile(profile.user.handle, csrfToken)
            : followProfile(profile.user.handle, csrfToken),
        { retryOnCsrf: true },
      );

      setFollowState({
        handle: normalizedHandle,
        relationship: nextState,
      });
    } catch (error) {
      setFollowError({
        handle: normalizedHandle,
        message:
          error instanceof Error ? error.message : "Could not update follow state.",
      });
    } finally {
      setFollowPosting(false);
    }
  }

  async function handleBlockToggle() {
    if (!profile || isOwnProfile || profileControlBusy) {
      return;
    }

    if (status !== "authenticated") {
      navigate("/login");
      return;
    }

    const nextBlockedState = !profile.blockedByMe;
    setProfileControlBusy("block");
    setProfileControlError(undefined);
    setProfileControlMessage(undefined);

    try {
      const result = await runWithAuth(
        (csrfToken) =>
          nextBlockedState
            ? blockProfile(profile.user.handle, csrfToken)
            : unblockProfile(profile.user.handle, csrfToken),
        { retryOnCsrf: true },
      );

      setFollowState({
        handle: normalizedHandle,
        relationship: result.relationship,
      });
      setProfileControlMessage({
        handle: normalizedHandle,
        message: nextBlockedState
          ? `Blocked @${profile.user.handle}.`
          : `Unblocked @${profile.user.handle}.`,
      });
    } catch (error) {
      setProfileControlError({
        handle: normalizedHandle,
        message:
          error instanceof Error ? error.message : "Could not update block state.",
      });
    } finally {
      setProfileControlBusy(undefined);
    }
  }

  async function handleMuteToggle() {
    if (!profile || isOwnProfile || profileControlBusy) {
      return;
    }

    if (status !== "authenticated") {
      navigate("/login");
      return;
    }

    const nextMutedState = !profile.mutedByMe;
    setProfileControlBusy("mute");
    setProfileControlError(undefined);
    setProfileControlMessage(undefined);

    try {
      const result = await runWithAuth(
        (csrfToken) =>
          nextMutedState
            ? muteProfile(profile.user.handle, csrfToken)
            : unmuteProfile(profile.user.handle, csrfToken),
        { retryOnCsrf: true },
      );

      setFollowState({
        handle: normalizedHandle,
        relationship: result.relationship,
      });
      setProfileControlMessage({
        handle: normalizedHandle,
        message: nextMutedState
          ? `Muted @${profile.user.handle}. Muted posts are hidden from your feeds where possible.`
          : `Unmuted @${profile.user.handle}.`,
      });
    } catch (error) {
      setProfileControlError({
        handle: normalizedHandle,
        message:
          error instanceof Error ? error.message : "Could not update mute state.",
      });
    } finally {
      setProfileControlBusy(undefined);
    }
  }

  async function handleRemoveFollower(
    followerHandle: string,
    wasMoot: boolean,
  ): Promise<boolean> {
    if (!profile || !isOwnProfile) {
      return false;
    }

    const result = await runWithAuth(
      (csrfToken) => removeProfileFollower(followerHandle, csrfToken),
      { retryOnCsrf: true },
    );

    if (result.removedFollower) {
      const nextFollowerCount = Math.max(0, profile.followerCount - 1);
      setProfileOverride({
        ...profile,
        followerCount: nextFollowerCount,
        stats: {
          ...profile.stats,
          followers: nextFollowerCount,
          moots: wasMoot ? Math.max(0, profile.stats.moots - 1) : profile.stats.moots,
        },
      });
    }

    return result.removedFollower;
  }

  async function handleFeaturedBadgesChange(featuredBadgeIds: number[]) {
    const updated = await runWithAuth(
      (csrfToken) => updateFeaturedBadges({ featuredBadgeIds }, csrfToken),
      { retryOnCsrf: true },
    );

    setBadgesOverride({ handle: normalizedHandle, result: updated });
  }

  const handleStartCanvasEdit = useCallback(async () => {
    if (!profile || !isOwnProfile || canvasLoading) {
      return;
    }

    setCanvasLoading(true);
    setCanvasError(undefined);

    try {
      const [modules, integrations] = await Promise.all([
        getMyProfileModules({ includeDeleted: true }),
        getMyProfileIntegrations().catch(() => undefined),
      ]);
      const activeModules = modules.filter((module) => module.status !== "deleted");
      const deletedModules = modules.filter((module) => module.status === "deleted");
      const preparedModules = prepareProfileCanvasModules(
        profile,
        mergeIntegrationAccountsIntoConnectionModules(
          activeModules,
          integrations?.accounts,
        ),
        profileLayoutPreset,
      );

      setDraftModules(preparedModules);
      setDeletedDraftModules(deletedModules);
      setProfileIntegrations(integrations);
      setIntegrationMessage(undefined);
      setDraftBackgroundBlur(profile.profileBackgroundBlur);
      setDraftProfile(profile);
      setProfileContentAutosaveState("idle");
      setProfileContentAutosaveError(undefined);
      setSelectedCanvasModuleId(undefined);
      setCanvasMovementContext(undefined);
      setCanvasEditing(true);
    } catch (error) {
      setCanvasError(
        error instanceof Error ? error.message : "Could not load canvas editor.",
      );
    } finally {
      setCanvasLoading(false);
    }
  }, [canvasLoading, isOwnProfile, profile, profileLayoutPreset]);

  useEffect(() => {
    if (
      canvasEditReturnHandledRef.current ||
      canvasEditing ||
      canvasLoading ||
      !profile ||
      !isOwnProfile
    ) {
      return;
    }

    const params = new URLSearchParams(location.search);

    if (params.get("editCanvas") !== "1") {
      return;
    }

    canvasEditReturnHandledRef.current = true;
    const timer = window.setTimeout(() => {
      void handleStartCanvasEdit();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    canvasEditing,
    canvasLoading,
    handleStartCanvasEdit,
    isOwnProfile,
    location.search,
    profile,
  ]);

  useEffect(() => {
    if (
      !canvasEditing ||
      !isOwnProfile ||
      !profile ||
      !draftProfile ||
      canvasSaving
    ) {
      return undefined;
    }

    const input = profileContentAutosaveInput(draftProfile, profile);

    if (!input) {
      return undefined;
    }

    const requestId = profileContentAutosaveRequestRef.current + 1;
    profileContentAutosaveRequestRef.current = requestId;

    const timeout = window.setTimeout(() => {
      setProfileContentAutosaveState("saving");
      setProfileContentAutosaveError(undefined);

      void runWithAuth((csrfToken) => updateMyProfile(input, csrfToken), {
        retryOnCsrf: true,
      })
        .then((savedProfile) => {
          if (profileContentAutosaveRequestRef.current !== requestId) {
            return;
          }

          setProfileOverride(savedProfile);
          setDraftProfile((current) =>
            current ? mergeAutosavedProfileContent(current, savedProfile) : current,
          );
          setProfileContentAutosaveState("saved");
          setProfileContentAutosaveError(undefined);
        })
        .catch((error) => {
          if (profileContentAutosaveRequestRef.current !== requestId) {
            return;
          }

          setProfileContentAutosaveState("error");
          setProfileContentAutosaveError(
            error instanceof Error
              ? error.message
              : "Profile edits could not save automatically.",
          );
        });
    }, PROFILE_CONTENT_AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [
    canvasEditing,
    canvasSaving,
    draftProfile,
    isOwnProfile,
    profile,
    runWithAuth,
  ]);

  function handleCancelCanvasEdit() {
    setCanvasEditing(false);
    setCanvasError(undefined);
    setDraftModules([]);
    setDeletedDraftModules([]);
    setSelectedCanvasModuleId(undefined);
    setCanvasMovementContext(undefined);
    setDraftBackgroundBlur(profile?.profileBackgroundBlur ?? "medium");
    setDraftProfile(undefined);
    setProfileDraftUploading(undefined);
    setProfileContentAutosaveState("idle");
    setProfileContentAutosaveError(undefined);
    setIntegrationMessage(undefined);
  }

  async function handleSaveCanvasEdit() {
    if (!profile || !canvasEditing || canvasSaving) {
      return;
    }

    setCanvasSaving(true);
    setCanvasError(undefined);

    try {
      const { profile: savedProfile, canvas } = await runWithAuth(
        async (csrfToken) => {
          let modulesForSave = draftModules;
          let anchorModuleIdForSave = selectedCanvasModuleId ?? null;

          for (const module of modulesForSave) {
            if (
              module.id >= 0 ||
              module.type === "profile_info" ||
              module.status !== "active"
            ) {
              continue;
            }

            const existingIds = new Set(
              modulesForSave
                .filter((item) => item.id > 0)
                .map((item) => item.id),
            );
            const createdModules = await createProfileModule(
              {
                type: module.type,
                title: null,
                visibility: module.visibility,
                status: "active",
                config: profileModulePersistentConfig(module.config),
              },
              csrfToken,
            );
            const createdModule = createdModules
              .filter(
                (item) => item.type === module.type && !existingIds.has(item.id),
              )
              .sort((first, second) => second.id - first.id)[0];

            if (!createdModule) {
              throw new Error("Could not persist this module.");
            }

            modulesForSave = modulesForSave.map((item) =>
              item.id === module.id
                ? {
                    ...createdModule,
                    config: module.config,
                    layout: module.layout ?? null,
                    visibility: module.visibility,
                  }
                : item,
            );

            if (anchorModuleIdForSave === module.id) {
              anchorModuleIdForSave = createdModule.id;
            }
          }

          await Promise.all(
            modulesForSave
              .filter((module) => module.id > 0 && module.type !== "profile_info")
              .map((module) =>
                updateProfileModule(
                  module.id,
                  { config: profileModulePersistentConfig(module.config) },
                  csrfToken,
                ),
              ),
          );

          const shouldClearLegacyProfileLinks =
            profile.links.length > 0 &&
            modulesForSave.some(
              (module) => module.id > 0 && module.type === "links",
            );
          let updatedProfile = draftProfile
            ? await updateMyProfile(
                {
                  displayName: draftProfile.user.displayName,
                  bio: draftProfile.bio,
                  location: draftProfile.location,
                  avatarUrl: draftProfile.user.avatarUrl ?? null,
                  bannerUrl: draftProfile.bannerUrl ?? null,
                  profileBackground: draftProfile.profileBackground ?? null,
                  profileBackgroundVideo: draftProfile.profileBackgroundVideo ?? null,
                  profileBackgroundVideoPoster:
                    draftProfile.profileBackgroundVideoPoster ?? null,
                  links: shouldClearLegacyProfileLinks ? [] : draftProfile.links,
                },
                csrfToken,
              )
            : undefined;

          if (
            draftProfile &&
            (draftProfile.featuredPostId !== profile.featuredPostId ||
              draftProfile.featuredRoomId !== profile.featuredRoomId)
          ) {
            updatedProfile = await updateProfileFeaturedContent(
              {
                featuredPostId: draftProfile.featuredPostId ?? null,
                featuredRoomId: draftProfile.featuredRoomId ?? null,
              },
              csrfToken,
            );
          }

          const updatedCanvas = await updateProfileCanvas(
            {
              canvasVersion: 1,
              anchorModuleId: anchorModuleIdForSave,
              backgroundBlur: draftBackgroundBlur,
              movementContext: canvasMovementContext ?? null,
              modules: modulesForSave
                .filter((module) => module.id > 0)
                .map((module) =>
                  profileModuleCanvasInput(
                    module,
                    profile,
                    profileLayoutPreset,
                    modulesForSave.indexOf(module),
                  ),
                ),
            },
            csrfToken,
          );

          return { profile: updatedProfile, canvas: updatedCanvas };
        },
        { retryOnCsrf: true },
      );
      const nextProfile = {
        ...(savedProfile ?? profile),
        profileBackgroundBlur: canvas.backgroundBlur,
        profileCanvasVersion: canvas.canvasVersion,
      };

      const normalizedModules = prepareProfileCanvasModules(
        nextProfile,
        canvas.modules,
        profileLayoutPreset,
      );

      setModulesOverride({
        handle: normalizedHandle,
        modules: normalizedModules,
      });
      setProfileOverride(nextProfile);
      setDraftModules(normalizedModules);
      setDraftBackgroundBlur(canvas.backgroundBlur);
      setCanvasEditing(false);
      setSelectedCanvasModuleId(undefined);
      setCanvasMovementContext(undefined);
      setDraftProfile(undefined);
    } catch (error) {
      setCanvasError(
        error instanceof Error ? error.message : "Could not save canvas layout.",
      );
    } finally {
      setCanvasSaving(false);
    }
  }

  function handleSelectCanvasModule(module: ProfileModule) {
    setSelectedCanvasModuleId(module.id);
  }

  function handleCanvasModuleVisibilityChange(moduleId: number, visible: boolean) {
    if (!profile) {
      return;
    }

    setDraftModules((modules) =>
      pushProfileCanvasModules(
        profile,
        modules.map((module) =>
          module.id === moduleId
            ? {
                ...module,
                visibility: visible ? "public" : "hidden",
                status: "active",
            }
            : module,
        ),
        profileLayoutPreset,
        moduleId,
      ),
    );
    setCanvasMovementContext(undefined);
  }

  function handleCanvasModuleLayoutChange(
    moduleId: number,
    layout: ProfileModuleLayout,
    movementContext?: ProfileCanvasMovementContext,
  ) {
    if (!profile) {
      return;
    }

    setSelectedCanvasModuleId(moduleId);
    setCanvasMovementContext(movementContext);
    setDraftModules((modules) =>
      pushProfileCanvasModules(
        profile,
        modules.map((module) =>
          module.id === moduleId
            ? {
                ...module,
                layout,
              }
            : module,
        ),
        profileLayoutPreset,
        moduleId,
        movementContext,
      ),
    );
  }

  function handleCanvasModulePinnedChange(moduleId: number, pinned: boolean) {
    if (!profile) {
      return;
    }

    setCanvasMovementContext(undefined);
    setDraftModules((modules) =>
      pushProfileCanvasModules(
        profile,
        modules.map((module) =>
          module.id === moduleId
            ? {
                ...module,
                pinned,
              }
            : module,
        ),
        profileLayoutPreset,
        undefined,
      ),
    );
  }

  function handleCanvasModuleConfigChange(
    moduleId: number,
    config: ProfileModuleConfig,
  ) {
    setDraftModules((modules) =>
      modules.map((module) =>
        module.id === moduleId
          ? {
              ...module,
              config,
            }
          : module,
      ),
    );
  }

  function handleDraftProfileChange(updater: (profile: Profile) => Profile) {
    setDraftProfile((current) => {
      const base = current ?? profile;

      return base ? updater(base) : current;
    });
  }

  async function saveProfileContentImmediately(
    nextProfile: Profile,
    fallbackMessage = "Could not save profile edits.",
  ) {
    if (!profile) {
      return;
    }

    const input = profileContentAutosaveInput(nextProfile, profile);

    if (!input) {
      return;
    }

    const requestId = profileContentAutosaveRequestRef.current + 1;
    profileContentAutosaveRequestRef.current = requestId;
    setProfileContentAutosaveState("saving");
    setProfileContentAutosaveError(undefined);

    try {
      const savedProfile = await runWithAuth(
        (csrfToken) => updateMyProfile(input, csrfToken),
        { retryOnCsrf: true },
      );

      if (profileContentAutosaveRequestRef.current !== requestId) {
        return;
      }

      setProfileOverride(savedProfile);
      setDraftProfile((current) =>
        current ? mergeAutosavedProfileContent(current, savedProfile) : current,
      );
      setProfileContentAutosaveState("saved");
      setProfileContentAutosaveError(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : fallbackMessage;
      setProfileContentAutosaveState("error");
      setProfileContentAutosaveError(message);
      setCanvasError(message);
      throw error;
    }
  }

  function handleProfileImageDraftSelection(
    file: File,
    purpose: Extract<ImageUploadPurpose, "avatar" | "banner" | "profile_background">,
  ) {
    const validationError = validateImageCropFile(file);

    if (validationError) {
      setCanvasError(validationError);
      return;
    }

    setCanvasError(undefined);
    setPendingProfileImageCrop({ file, purpose });
  }

  async function handleProfileImageDraftUpload(
    file: File,
    purpose: "avatar" | "banner" | "profile_background",
  ) {
    if (!profile || profileDraftUploading) {
      return;
    }

    const uploading =
      purpose === "profile_background"
        ? "backgroundImage"
        : purpose === "banner"
          ? "banner"
          : "avatar";
    setProfileDraftUploading(uploading);
    setCanvasError(undefined);

    try {
      const upload = await runWithAuth(
        (csrfToken) => uploadImage(file, purpose, csrfToken),
        { retryOnCsrf: true },
      );

      const baseProfile = draftProfile ?? profile;
      const nextProfile =
        purpose === "avatar"
          ? {
              ...baseProfile,
              user: {
                ...baseProfile.user,
                avatarUrl: upload.url,
              },
            }
          : purpose === "banner"
            ? {
                ...baseProfile,
                bannerUrl: upload.url,
              }
            : {
                ...baseProfile,
                profileBackground: upload.url,
                profileBackgroundVideo: null,
              };

      setDraftProfile(nextProfile);
      await saveProfileContentImmediately(
        nextProfile,
        "Uploaded image, but could not save it to your profile.",
      );
    } catch (error) {
      setCanvasError(
        error instanceof Error ? error.message : "Could not upload this image.",
      );
      throw error;
    } finally {
      setProfileDraftUploading(undefined);
    }
  }

  async function handleProfileVideoDraftUpload(file: File) {
    if (!profile || profileDraftUploading) {
      return;
    }

    setProfileDraftUploading("backgroundVideo");
    setCanvasError(undefined);

    try {
      const upload = await runWithAuth(
        (csrfToken) => uploadVideo(file, "profile_background", csrfToken),
        { retryOnCsrf: true },
      );

      const nextProfile = {
        ...(draftProfile ?? profile),
        profileBackgroundVideo: upload.url,
      };

      setDraftProfile(nextProfile);
      await saveProfileContentImmediately(
        nextProfile,
        "Uploaded video, but could not save it to your profile.",
      );
    } catch (error) {
      setCanvasError(
        error instanceof Error ? error.message : "Could not upload this video.",
      );
    } finally {
      setProfileDraftUploading(undefined);
    }
  }

  async function handleClearProfileBackgroundDraft() {
    if (!profile) {
      return;
    }

    const nextProfile = {
      ...(draftProfile ?? profile),
      profileBackground: null,
      profileBackgroundVideo: null,
      profileBackgroundVideoPoster: null,
    };

    setDraftProfile(nextProfile);
    try {
      await saveProfileContentImmediately(
        nextProfile,
        "Could not clear this profile background.",
      );
    } catch {
      // The save helper already surfaced the error in the editor.
    }
  }

  async function handleAddCanvasModule(input: CreateProfileModuleInput) {
    if (!profile || !canvasEditing || canvasSaving) {
      return;
    }

    setCanvasSaving(true);
    setCanvasError(undefined);

    try {
      const modules = await runWithAuth(
        (csrfToken) => createProfileModule(input, csrfToken),
        { retryOnCsrf: true },
      );
      const activeModules = modules.filter((module) => module.status !== "deleted");
      const normalizedModules = prepareProfileCanvasModules(
        profile,
        activeModules,
        profileLayoutPreset,
      );
      const newestModule = normalizedModules.reduce<ProfileModule | undefined>(
        (current, module) =>
          !current || module.id > current.id ? module : current,
        undefined,
      );

      setDraftModules(normalizedModules);
      setModulesOverride({ handle: normalizedHandle, modules: normalizedModules });
      setSelectedCanvasModuleId(newestModule?.id);
    } catch (error) {
      setCanvasError(
        error instanceof Error ? error.message : "Could not add profile module.",
      );
    } finally {
      setCanvasSaving(false);
    }
  }

  async function handleDeleteCanvasModule(module: ProfileModule) {
    if (!profile || !canvasEditing || canvasSaving || module.type === "profile_info") {
      return;
    }

    if (module.id < 0) {
      setDraftModules((modules) => modules.filter((item) => item.id !== module.id));
      setSelectedCanvasModuleId(undefined);

      if (module.type === "links") {
        handleDraftProfileChange((current) => ({
          ...current,
          links: [],
        }));
      }

      return;
    }

    setCanvasSaving(true);
    setCanvasError(undefined);

    try {
      const modules = await runWithAuth(
        (csrfToken) => deleteProfileModule(module.id, csrfToken),
        { retryOnCsrf: true },
      );
      const deletedModule: ProfileModule = {
        ...module,
        status: "deleted",
        visibility: "hidden",
        config: {
          ...module.config,
          ...(module.type === "featured_post" && profile.featuredPostId
            ? { restoreFeaturedPostId: profile.featuredPostId }
            : {}),
          ...(module.type === "featured_room" && profile.featuredRoomId
            ? { restoreFeaturedRoomId: profile.featuredRoomId }
            : {}),
        },
      };
      const nextProfile = {
        ...profile,
        ...(module.type === "featured_post"
          ? { featuredPostId: null, featuredPost: null }
          : {}),
        ...(module.type === "featured_room"
          ? { featuredRoomId: null, featuredRoom: null }
          : {}),
      };
      const activeModules = modules.filter((item) => item.status !== "deleted");
      const normalizedModules = prepareProfileCanvasModules(
        nextProfile,
        activeModules,
        profileLayoutPreset,
      );

      setProfileOverride(nextProfile);
      setDraftModules(normalizedModules);
      setDeletedDraftModules((items) => [
        deletedModule,
        ...items.filter((item) => item.id !== module.id),
      ]);
      setModulesOverride({ handle: normalizedHandle, modules: normalizedModules });
      setSelectedCanvasModuleId(normalizedModules[0]?.id);
    } catch (error) {
      setCanvasError(
        error instanceof Error ? error.message : "Could not delete profile module.",
      );
    } finally {
      setCanvasSaving(false);
    }
  }

  async function handleRestoreCanvasModule(module: ProfileModule) {
    if (!profile || !canvasEditing || canvasSaving) {
      return;
    }

    setCanvasSaving(true);
    setCanvasError(undefined);

    try {
      const modules = await runWithAuth(
        (csrfToken) => restoreProfileModule(module.id, csrfToken),
        { retryOnCsrf: true },
      );
      const activeModules = modules.filter((item) => item.status !== "deleted");
      const deletedModules = modules.filter((item) => item.status === "deleted");
      const normalizedModules = prepareProfileCanvasModules(
        profile,
        activeModules,
        profileLayoutPreset,
      );
      const restored = normalizedModules.find((item) => item.id === module.id);

      setDraftModules(normalizedModules);
      setDeletedDraftModules(deletedModules);
      setModulesOverride({ handle: normalizedHandle, modules: normalizedModules });
      setSelectedCanvasModuleId(restored?.id ?? normalizedModules[0]?.id);
    } catch (error) {
      setCanvasError(
        error instanceof Error ? error.message : "Could not restore profile module.",
      );
    } finally {
      setCanvasSaving(false);
    }
  }

  async function handleConnectIntegration(provider: ProfileIntegrationProvider) {
    if (!profile || integrationBusy) {
      return;
    }

    setIntegrationBusy(provider);
    setIntegrationMessage(undefined);

    try {
      const result = await runWithAuth(
        (csrfToken) =>
          startProfileIntegration(
            provider,
            csrfToken,
            `/@${profile.user.handle}?editCanvas=1`,
          ),
        { retryOnCsrf: true },
      );

      window.location.assign(result.authorizationUrl);
    } catch (error) {
      setIntegrationMessage(
        error instanceof Error
          ? error.message
          : "Could not start this integration.",
      );
      setIntegrationBusy(undefined);
    }
  }

  async function handleDisconnectIntegration(provider: ProfileIntegrationProvider) {
    if (integrationBusy) {
      return;
    }

    setIntegrationBusy(provider);
    setIntegrationMessage(undefined);

    try {
      const result = await runWithAuth(
        (csrfToken) => disconnectProfileIntegration(provider, csrfToken),
        { retryOnCsrf: true },
      );

      setProfileIntegrations(result);
    } catch (error) {
      setIntegrationMessage(
        error instanceof Error
          ? error.message
          : "Could not disconnect this integration.",
      );
    } finally {
      setIntegrationBusy(undefined);
    }
  }

  async function handleResolveIntegrationMetadata(input: {
    provider?: ProfileIntegrationProvider;
    url: string;
  }): Promise<ProfileIntegrationCard> {
    return runWithAuth(
      (csrfToken) => resolveProfileIntegrationMetadata(input, csrfToken),
      { retryOnCsrf: true },
    );
  }

  useEffect(() => {
    setTopBarAction(undefined);
    return () => setTopBarAction(undefined);
  }, [setTopBarAction]);

  if (profileMissing) {
    return (
      <motion.div
        className="mx-auto max-w-4xl space-y-5"
        variants={pageEntrance}
        initial="hidden"
        animate="show"
      >
        <PageMeta
          title="Profile not found"
          description="This profile could not be found on thia.lol."
          path={`/@${normalizedHandle}`}
        />
        <EmptyState
          icon={MessageCircle}
          title="Profile not found"
          text="This profile may have moved or is not public."
        />
      </motion.div>
    );
  }

  if (!profile) {
    return (
      <motion.div
        className="mx-auto max-w-4xl space-y-5"
        variants={pageEntrance}
        initial="hidden"
        animate="show"
      >
        <PageMeta
          title={`@${normalizedHandle}`}
          description={`Profile for @${normalizedHandle} on thia.lol.`}
          path={`/@${normalizedHandle}`}
        />
        {profileState.loading ? (
          <ApiStateNotice
            kind="loading"
            title={`Loading @${normalizedHandle}`}
            text="Loading profile."
          />
        ) : (
          <ApiStateNotice
            kind="error"
            title="Profile is not available"
            text="Try refreshing in a moment."
          />
        )}
      </motion.div>
    );
  }

  const renderedProfile = workingProfile ?? profile;
  const backgroundPreviewProfile =
    canvasEditing && renderedProfile
      ? { ...renderedProfile, profileBackgroundBlur: draftBackgroundBlur }
      : renderedProfile;
  const showActivityModule = shouldRenderProfileActivityModule({
    feed: profileFeed,
    isOwnProfile,
    loading:
      postsState.loading ||
      reblogsState.loading ||
      repliesState.loading ||
      roomsState.loading,
    replies: profileReplies,
    rooms: profileRooms,
    error:
      postsState.error ??
      reblogsState.error ??
      repliesState.error ??
      roomsState.error,
  });
  const visibleCanvasModules = canvasEditing ? displayModules : publicModules;
  const profileSpaceModules = visibleCanvasModules.filter((module) => {
    if (module.type === "activity") {
      return showActivityModule;
    }

    if (module.type === "featured_post") {
      return canvasEditing || Boolean(renderedProfile.featuredPost);
    }

    if (module.type === "featured_room") {
      return canvasEditing || Boolean(renderedProfile.featuredRoom);
    }

    return true;
  });
  const profileCanvasModules = resolveProfileCanvasModules(
    renderedProfile,
    mergeProfileLinksIntoConnectionModules(renderedProfile, profileSpaceModules),
  );
  return (
    <motion.div
      className={cn("relative mx-auto", canvasEditing ? "max-w-7xl" : "max-w-5xl")}
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <ProfilePersonalBackdrop profile={backgroundPreviewProfile} />
      <div
        className={cn(
          "relative z-10 space-y-4 sm:space-y-5",
          canvasEditing
            ? "lg:grid lg:grid-cols-[23rem_minmax(0,1fr)] lg:items-start lg:gap-5 lg:space-y-0"
            : undefined,
        )}
      >
        <PageMeta
          title={`${renderedProfile.user.displayName} (@${renderedProfile.user.handle})`}
          description={renderedProfile.bio}
          path={`/@${renderedProfile.user.handle}`}
        />
        {isOwnProfile ? (
          <ProfileCanvasEditorToolbar
            busy={canvasLoading || canvasSaving}
            editing={canvasEditing}
            error={canvasError}
            integrationBusy={integrationBusy}
            integrationMessage={integrationMessage}
            integrations={profileIntegrations}
            modules={draftModules}
            removedModules={deletedDraftModules}
            userBadges={profileBadges}
            onAddModule={(input) => void handleAddCanvasModule(input)}
            onCancel={handleCancelCanvasEdit}
            onConnectIntegration={(provider) => void handleConnectIntegration(provider)}
            onDisconnectIntegration={(provider) =>
              void handleDisconnectIntegration(provider)
            }
            onEdit={() => void handleStartCanvasEdit()}
            onRestoreModule={(module) => void handleRestoreCanvasModule(module)}
            onSave={() => void handleSaveCanvasEdit()}
          />
        ) : null}
        <div className="min-w-0 space-y-4 sm:space-y-5">
          {canvasEditing ? (
            <div
              className="relative z-30 flex justify-end"
              data-testid="profile-canvas-background-surface"
            >
              <div className="w-full max-w-sm">
                <ProfileCanvasBackgroundControls
                  backgroundBlur={draftBackgroundBlur}
                  profile={renderedProfile}
                  uploading={profileDraftUploading}
                  onBackgroundBlurChange={setDraftBackgroundBlur}
                  onClear={() => void handleClearProfileBackgroundDraft()}
                  onImageUpload={(file) =>
                    handleProfileImageDraftSelection(file, "profile_background")
                  }
                  onVideoUpload={(file) => void handleProfileVideoDraftUpload(file)}
                />
              </div>
            </div>
          ) : null}
          <ProfileModulesSection
          badges={profileBadges}
          editing={
            canvasEditing
              ? {
                  selectedModuleId: selectedCanvasModuleId,
                  onDeselectModule: () => setSelectedCanvasModuleId(undefined),
                  onMoveModule: handleCanvasModuleLayoutChange,
                  onSelectModule: handleSelectCanvasModule,
                  renderSelectedControls: (module, size) => (
                    <ProfileSelectedModuleControls
                      busy={canvasSaving || Boolean(profileDraftUploading)}
                      feed={profileFeed}
                      integrationBusy={integrationBusy}
                      integrations={profileIntegrations}
                      module={module}
                      profile={renderedProfile}
                      profileAutosaveError={profileContentAutosaveError}
                      profileAutosaveState={profileContentAutosaveState}
                      rooms={profileRooms}
                      size={size}
                      onConfigChange={(config) =>
                        handleCanvasModuleConfigChange(module.id, config)
                      }
                      onDeleteModule={() => void handleDeleteCanvasModule(module)}
                      onConnectIntegration={(provider) =>
                        void handleConnectIntegration(provider)
                      }
                      onLayoutChange={(layout) =>
                        handleCanvasModuleLayoutChange(module.id, layout)
                      }
                      onPinnedChange={(pinned) =>
                        handleCanvasModulePinnedChange(module.id, pinned)
                      }
                      onProfileDraftChange={handleDraftProfileChange}
                      onProfileImageUpload={handleProfileImageDraftSelection}
                      onResolveIntegration={handleResolveIntegrationMetadata}
                      onVisibilityChange={(visible) =>
                        handleCanvasModuleVisibilityChange(module.id, visible)
                      }
                    />
                  ),
                }
              : undefined
          }
          error={modulesState.error}
          isOwnProfile={isOwnProfile}
          layoutPreset={profileLayoutPreset}
          loading={modulesState.loading}
          musicAutoplay={musicAutoplayRequest}
          modules={profileCanvasModules}
          renderModuleContent={(module, size) => {
            if (module.type === "profile_info") {
              return (
                <ProfileInfoModule
                  activeFollowError={activeFollowError}
                  activeProfileControlError={activeProfileControlError}
                  activeProfileControlMessage={activeProfileControlMessage}
                  editing={canvasEditing}
                  featuredBadges={featuredBadges}
                  followPosting={followPosting}
                  isOwnProfile={isOwnProfile}
                  profile={renderedProfile}
                  profileControlBusy={profileControlBusy}
                  size={size}
                  showChatHint={
                    status === "authenticated" &&
                    !isOwnProfile &&
                    !renderedProfile.blockedByMe &&
                    !renderedProfile.isMoot
                  }
                  status={status}
                  onBlockToggle={
                    status === "authenticated" && !isOwnProfile
                      ? handleBlockToggle
                      : undefined
                  }
                  onFollowToggle={handleFollowToggle}
                  onMuteToggle={
                    status === "authenticated" && !isOwnProfile
                      ? handleMuteToggle
                      : undefined
                  }
                  onOpenPanel={setActivePanel}
                />
              );
            }

            if (module.type === "featured_post" && renderedProfile.featuredPost) {
              return (
                <FeaturedPostModuleCard
                  editing={canvasEditing}
                  profile={renderedProfile}
                  title={module.title ?? "Featured post"}
                />
              );
            }

            if (module.type === "featured_room" && renderedProfile.featuredRoom) {
              return (
                <FeaturedRoomModuleCard
                  editing={canvasEditing}
                  profile={renderedProfile}
                  title={module.title ?? "Featured room"}
                />
              );
            }

            if (module.type === "activity") {
              return (
              <ProfileActivityModule
                activeTab={activeTab}
                editing={canvasEditing}
                feed={profileFeed}
                feedError={postsState.error ?? reblogsState.error}
                feedLoading={postsState.loading || reblogsState.loading}
                profile={renderedProfile}
                replies={profileReplies}
                repliesError={repliesState.error}
                repliesLoading={repliesState.loading}
                rooms={profileRooms}
                roomsError={roomsState.error}
                roomsLoading={roomsState.loading}
                size={size}
                title={module.title ?? "Activity"}
                onTabChange={setActiveTab}
              />
              );
            }

            return undefined;
          }}
        />
      {activePanel ? (
        <ProfileFocusedPanel
          badges={profileBadges}
          badgesError={badgesState.error}
          badgesLoading={badgesState.loading}
          featuredBadges={featuredBadges}
          handle={profile.user.handle}
          isOwnProfile={isOwnProfile}
          panel={activePanel}
          onClose={() => setActivePanel(undefined)}
          onFeaturedChange={handleFeaturedBadgesChange}
          {...(
            isOwnProfile && activePanel === "followers"
              ? { onRemoveFollower: handleRemoveFollower }
              : {}
          )}
        />
      ) : null}
        </div>
      </div>
      {musicAutoplayTarget && !musicAutoplayAllowed ? (
        <ProfileMusicContinueOverlay
          profile={renderedProfile}
          onContinue={handleContinueToProfileMusic}
        />
      ) : null}
      <ImageCropModal
        open={Boolean(pendingProfileImageCrop)}
        file={pendingProfileImageCrop?.file}
        purpose={pendingProfileImageCrop?.purpose ?? "avatar"}
        busy={Boolean(profileDraftUploading)}
        onClose={() => setPendingProfileImageCrop(undefined)}
        onApply={async (croppedFile) => {
          if (!pendingProfileImageCrop) {
            return;
          }

          await handleProfileImageDraftUpload(
            croppedFile,
            pendingProfileImageCrop.purpose,
          );
          setPendingProfileImageCrop(undefined);
        }}
      />
    </motion.div>
  );
}

function ProfileMusicContinueOverlay({
  onContinue,
  profile,
}: {
  onContinue: () => void;
  profile: Profile;
}) {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-canvas/72 p-4 backdrop-blur-xl"
      data-testid="profile-music-continue-overlay"
    >
      <div className="w-full max-w-sm rounded-panel border border-line bg-surface/86 p-4 text-center shadow-lift backdrop-blur-veil">
        <span className="mx-auto grid size-11 place-items-center rounded-card border border-line bg-canvas/70 text-text">
          <Music2 aria-hidden="true" size={22} />
        </span>
        <p className="mt-3 text-xs font-semibold uppercase text-muted">
          @{profile.user.handle}
        </p>
        <h2 className="mt-1 text-xl font-semibold text-text">Continue to profile</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Spotify music may start after you continue. Spotify content is embedded on this profile.
        </p>
        <Button
          type="button"
          className="mt-4 w-full justify-center"
          data-testid="profile-music-continue-button"
          onClick={onContinue}
        >
          Continue to profile
        </Button>
      </div>
    </div>
  );
}

type ProfileMusicAutoplayConsent = {
  grantedAt: string;
  handle: string;
  profileId: number;
  provider: "spotify";
};

function firstSpotifyMusicAutoplayModule(
  modules: ProfileModule[],
): ProfileModule | undefined {
  const firstMusicModule = modules.find(
    (module) =>
      module.type === "music" &&
      module.visibility === "public" &&
      module.status === "active",
  );

  if (!firstMusicModule) {
    return undefined;
  }

  const integration = firstMusicModule.config.integration;

  return integration?.provider === "spotify" &&
    Boolean(integration.embed) &&
    ["track", "album", "playlist"].includes(integration.resourceType)
    ? firstMusicModule
    : undefined;
}

function profileMusicAutoplayConsentKey(profileId: number): string {
  return `thia.profile.musicAutoplayConsent.v1:${profileId}`;
}

function readProfileMusicAutoplayConsent(
  key: string,
  profileId: number,
  handle: string,
): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const value = window.localStorage.getItem(key);

    if (!value) {
      return false;
    }

    const parsed = JSON.parse(value) as Partial<ProfileMusicAutoplayConsent>;

    return (
      parsed.profileId === profileId &&
      parsed.handle === handle &&
      parsed.provider === "spotify" &&
      typeof parsed.grantedAt === "string" &&
      parsed.grantedAt.length > 0
    );
  } catch {
    return false;
  }
}

function writeProfileMusicAutoplayConsent(
  key: string,
  consent: ProfileMusicAutoplayConsent,
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(consent));
  } catch {
    // If localStorage is unavailable, the current click still counts for this view.
  }
}

function resolveProfileCanvasModules(
  profile: Profile,
  modules: ProfileModule[],
): ProfileModule[] {
  const normalizedModules = modules
    .filter((module) => module.status === "active")
    .map((module) =>
      module.type === "profile_info"
        ? normalizeProfileInfoModule(profile, module)
        : module,
    );

  if (normalizedModules.some((module) => module.type === "profile_info")) {
    return normalizedModules.sort(profileCanvasModuleSort);
  }

  return [
    createSyntheticProfileInfoModule(profile),
    ...normalizedModules.sort(profileCanvasModuleSort),
  ];
}

const syntheticConnectionsModuleId = -2;

function mergeProfileLinksIntoConnectionModules(
  profile: Profile,
  modules: ProfileModule[],
): ProfileModule[] {
  if (profile.links.length === 0) {
    return modules;
  }

  return upsertProfileModuleLinks(
    modules,
    profile.links.map(profileModuleLinkFromConnection),
  );
}

function mergeIntegrationAccountsIntoConnectionModules(
  modules: ProfileModule[],
  accounts: ProfileIntegrationAccount[] | undefined,
): ProfileModule[] {
  const accountLinks =
    accounts
      ?.filter((account) => !account.revokedAt)
      .map(profileModuleLinkFromIntegrationAccount)
      .filter(isProfileModuleLink) ?? [];

  if (accountLinks.length === 0) {
    return modules;
  }

  return upsertProfileModuleLinks(modules, accountLinks);
}

function upsertProfileModuleLinks(
  modules: ProfileModule[],
  links: ProfileModuleLink[],
): ProfileModule[] {
  if (links.length === 0) {
    return modules;
  }

  let hasConnectionsModule = false;
  const mergedModules = modules.map((module) => {
    if (module.type !== "links") {
      return module;
    }

    hasConnectionsModule = true;

    return {
      ...module,
      config: {
        ...module.config,
        links: dedupeProfileModuleLinks([
          ...links,
          ...(module.config.links ?? []),
        ]),
      },
    };
  });

  if (hasConnectionsModule) {
    return mergedModules;
  }

  return [
    ...mergedModules,
    {
      id: syntheticConnectionsModuleId,
      type: "links",
      title: "Connections",
      config: {
        links: dedupeProfileModuleLinks(links),
      },
      visibility: "public",
      position: 2,
      pinned: false,
      layout: null,
      status: "active",
      schemaVersion: 1,
    },
  ];
}

function profileModuleLinkFromIntegrationAccount(
  account: ProfileIntegrationAccount,
): ProfileModuleLink | undefined {
  if (account.provider === "spotify") {
    const accountId = account.providerAccountId.trim();

    if (!accountId) {
      return undefined;
    }

    return {
      label: account.displayName || account.providerHandle || "Spotify",
      platform: "spotify",
      url: `https://open.spotify.com/user/${encodeURIComponent(accountId)}`,
    };
  }

  const platform = integrationConnectionPlatform(account.provider);

  if (!platform) {
    return undefined;
  }

  const value =
    account.providerHandle?.trim() ||
    (account.provider === "youtube" && account.providerAccountId.trim()
      ? `https://www.youtube.com/channel/${account.providerAccountId.trim()}`
      : account.providerAccountId.trim());
  const result = validateProfileConnectionDraft(platform, value);

  if ("error" in result) {
    return undefined;
  }

  const link = profileModuleLinkFromConnection(result.connection);

  return {
    ...link,
    label: account.displayName || account.providerHandle || link.label,
  };
}

function integrationConnectionPlatform(
  provider: ProfileIntegrationProvider,
): ProfileConnectionPlatform | undefined {
  if (provider === "github" || provider === "twitch" || provider === "youtube") {
    return provider;
  }

  return undefined;
}

function isProfileModuleLink(
  link: ProfileModuleLink | undefined,
): link is ProfileModuleLink {
  return Boolean(link);
}

function profileModuleLinkFromConnection(
  connection: ProfileExternalConnection,
): ProfileModuleLink {
  return {
    label: connection.label,
    platform: connection.platform,
    url: connection.url ?? connection.value,
  };
}

function moduleLinkLabelFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, "");

    return hostname || "Link";
  } catch {
    return "Link";
  }
}

function dedupeProfileModuleLinks(links: ProfileModuleLink[]): ProfileModuleLink[] {
  const seen = new Set<string>();
  const deduped: ProfileModuleLink[] = [];

  links.forEach((link) => {
    const url = link.url.trim();

    if (!url) {
      return;
    }

    const key = `${link.platform ?? "website"}|${url.toLowerCase()}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    deduped.push({
      ...link,
      label: link.label || moduleLinkLabelFromUrl(url),
      url,
    });
  });

  return deduped;
}

function normalizeProfileInfoModule(
  profile: Profile,
  module: ProfileModule,
): ProfileModule {
  const legacyLayoutSize = module.layout
    ? profileGridModuleSpanSize(module.layout.colSpan, module.layout.rowSpan)
    : undefined;
  const layout =
    legacyLayoutSize === "2x1" || legacyLayoutSize === "2x2"
      ? clampProfileModuleLayout({
          ...(module.layout ?? { column: 1, row: 1 }),
          colSpan: 3,
          rowSpan: 2,
        })
      : module.layout ?? null;

  return {
    ...module,
    layout,
    title: module.title ?? "Profile info",
    config: {
      ...module.config,
      hasBanner: Boolean(safeProfileImageUrl(profile.bannerUrl)),
    },
    visibility: "public",
    status: "active",
  };
}

function createSyntheticProfileInfoModule(profile: Profile | undefined): ProfileModule {
  return {
    id: -1,
    type: "profile_info",
    title: "Profile info",
    config: {
      hasBanner: Boolean(safeProfileImageUrl(profile?.bannerUrl)),
    },
    visibility: "public",
    position: 0,
    pinned: false,
    status: "active",
    schemaVersion: 1,
    createdAt: null,
    updatedAt: null,
  };
}

function prepareProfileCanvasModules(
  profile: Profile,
  modules: ProfileModule[],
  layoutPreset: ProfileLayoutPreset,
): ProfileModule[] {
  const normalized = resolveProfileCanvasModules(
    profile,
    mergeProfileLinksIntoConnectionModules(profile, modules),
  );
  const occupied = new Set<string>();

  return normalized.map((module, index) => {
    const withProfileInfo =
      module.type === "profile_info"
        ? normalizeProfileInfoModule(profile, module)
        : module;
    const existingLayout = profileModuleLayoutFits(
      withProfileInfo.layout,
      occupied,
    )
      ? withProfileInfo.layout
      : undefined;
    const layout =
      existingLayout ??
      findProfileModuleDefaultLayout(
        withProfileInfo,
        profile,
        layoutPreset,
        index,
        occupied,
      );

    occupyProfileModuleLayout(layout, occupied);

    return {
      ...withProfileInfo,
      layout,
    };
  });
}

function pushProfileCanvasModules(
  profile: Profile,
  modules: ProfileModule[],
  layoutPreset: ProfileLayoutPreset,
  anchorModuleId?: number,
  movementContext?: ProfileCanvasMovementContext,
): ProfileModule[] {
  const normalized = modules.map((module) =>
    module.type === "profile_info" ? normalizeProfileInfoModule(profile, module) : module,
  );
  const visibleModules = normalized
    .filter((module) => module.visibility === "public" || module.type === "profile_info")
    .map((module, index) => profileCanvasModuleWithRequestedLayout(module, layoutPreset, index))
    .sort(profileCanvasModuleSort);
  const hiddenModules = normalized.filter(
    (module) => module.visibility !== "public" && module.type !== "profile_info",
  );
  const anchor = visibleModules.find((module) => module.id === anchorModuleId);
  const occupied = new Set<string>();
  const placed = new Map<number, ProfileModule>();
  let anchorLayout: ProfileModuleLayout | undefined;

  visibleModules.forEach((module) => {
    if (!module.pinned || !module.layout) {
      return;
    }

    if (!profileModuleLayoutFits(module.layout, occupied)) {
      placed.set(module.id, module);
      return;
    }

    occupyProfileModuleLayout(module.layout, occupied);
    placed.set(module.id, module);
  });

  if (anchor && !placed.has(anchor.id) && anchor.layout) {
    const layout = findProfileCanvasAnchorLayout(
      anchor,
      visibleModules,
      occupied,
      movementContext,
    );

    anchorLayout = layout ?? anchor.layout;

    if (layout) {
      occupyProfileModuleLayout(layout, occupied);
    }

    placed.set(anchor.id, { ...anchor, layout: anchorLayout });
  }

  const movableModules = visibleModules
    .filter((module) => !placed.has(module.id))
    .sort((first, second) => {
      if (anchorLayout && movementContext) {
        const firstIntent = profileCanvasDisplacementIntent(
          anchorLayout,
          first.layout,
          movementContext,
        );
        const secondIntent = profileCanvasDisplacementIntent(
          anchorLayout,
          second.layout,
          movementContext,
        );

        if (Boolean(firstIntent) !== Boolean(secondIntent)) {
          return firstIntent ? -1 : 1;
        }
      }

      return profileCanvasModuleSort(first, second);
    });

  movableModules.forEach((module) => {
    const requestedLayout = module.layout;

    if (!requestedLayout) {
      placed.set(module.id, module);
      return;
    }

    const intent = anchorLayout && movementContext
      ? profileCanvasDisplacementIntent(anchorLayout, requestedLayout, movementContext)
      : undefined;
    const layout = profileModuleLayoutFits(requestedLayout, occupied)
      ? requestedLayout
      : findProfileModuleNextLayout(requestedLayout, occupied, intent);

    if (layout) {
      occupyProfileModuleLayout(layout, occupied);
    }

    placed.set(module.id, { ...module, layout: layout ?? requestedLayout });
  });

  hiddenModules.forEach((module) => {
    placed.set(module.id, module);
  });

  return normalized
    .map((module) => placed.get(module.id) ?? module)
    .sort(profileCanvasModuleSort);
}

function profileCanvasModuleWithRequestedLayout(
  module: ProfileModule,
  layoutPreset: ProfileLayoutPreset,
  index: number,
): ProfileModule {
  const span = profileModuleGridSpan(module, layoutPreset, index);
  const layout = clampProfileModuleLayout({
    column: module.layout?.column ?? 1,
    row: module.layout?.row ?? 1,
    colSpan: span.columns,
    rowSpan: span.rows,
  });

  return {
    ...module,
    layout,
  };
}

function profileModuleCanvasInput(
  module: ProfileModule,
  profile: Profile,
  layoutPreset: ProfileLayoutPreset,
  index: number,
) {
  const layout =
    module.layout ??
    findProfileModuleDefaultLayout(
      module,
      profile,
      layoutPreset,
      index,
      new Set<string>(),
    );

  return {
    id: module.id,
    column: layout.column,
    row: layout.row,
    colSpan: layout.colSpan,
    rowSpan: layout.rowSpan,
    pinned: module.pinned === true,
    visible: module.type === "profile_info" || module.visibility === "public",
  };
}

function findProfileModuleDefaultLayout(
  module: ProfileModule,
  profile: Profile,
  layoutPreset: ProfileLayoutPreset,
  index: number,
  occupied: Set<string>,
): ProfileModuleLayout {
  const profileInfoAwareModule =
    module.type === "profile_info" ? normalizeProfileInfoModule(profile, module) : module;
  const span = profileModuleGridSpan(profileInfoAwareModule, layoutPreset, index);
  const colSpan = span.columns;
  const rowSpan = span.rows;

  for (let row = 1; row <= PROFILE_CANVAS_ROWS - rowSpan + 1; row++) {
    for (let column = 1; column <= PROFILE_CANVAS_COLUMNS - colSpan + 1; column++) {
      const layout = { column, row, colSpan, rowSpan };

      if (profileModuleLayoutFits(layout, occupied)) {
        return layout;
      }
    }
  }

  return {
    column: 1,
    row: 1,
    colSpan,
    rowSpan,
  };
}

function findProfileCanvasAnchorLayout(
  anchor: ProfileModule,
  visibleModules: ProfileModule[],
  fixedOccupied: Set<string>,
  movementContext?: ProfileCanvasMovementContext,
): ProfileModuleLayout | undefined {
  const targetLayout = anchor.layout;

  if (!targetLayout) {
    return undefined;
  }

  if (!movementContext) {
    return profileModuleLayoutFits(targetLayout, fixedOccupied)
      ? targetLayout
      : findProfileModuleNextLayout(targetLayout, fixedOccupied);
  }

  if (!profileModuleLayoutFits(targetLayout, fixedOccupied)) {
    return findProfileModuleNextLayout(
      targetLayout,
      fixedOccupied,
      profileCanvasAnchorIntent(movementContext),
    );
  }

  if (!profileCanvasAnchorCrossedCollisionHalf(targetLayout, visibleModules, movementContext)) {
    const fromLayout = clampProfileModuleLayout({
      ...targetLayout,
      column: movementContext.from.column,
      row: movementContext.from.row,
    });

    if (profileModuleLayoutFits(fromLayout, fixedOccupied)) {
      return fromLayout;
    }
  }

  return targetLayout;
}

function profileCanvasAnchorCrossedCollisionHalf(
  anchorLayout: ProfileModuleLayout,
  visibleModules: ProfileModule[],
  movementContext: ProfileCanvasMovementContext,
): boolean {
  for (const module of visibleModules) {
    if (
      !module.layout ||
      module.id === movementContext.anchorModuleId ||
      module.pinned ||
      module.visibility !== "public"
    ) {
      continue;
    }

    if (!profileModuleLayoutsIntersect(anchorLayout, module.layout)) {
      continue;
    }

    if (!profileCanvasDisplacementIntent(anchorLayout, module.layout, movementContext)) {
      return false;
    }
  }

  return true;
}

function profileCanvasAnchorIntent(
  movementContext: ProfileCanvasMovementContext,
): ProfileCanvasMoveIntent | undefined {
  const deltaColumn = movementContext.to.column - movementContext.from.column;
  const deltaRow = movementContext.to.row - movementContext.from.row;

  if (Math.abs(deltaColumn) >= Math.abs(deltaRow) && deltaColumn !== 0) {
    return { dx: deltaColumn > 0 ? 1 : -1, dy: 0 };
  }

  if (deltaRow !== 0) {
    return { dx: 0, dy: deltaRow > 0 ? 1 : -1 };
  }

  return undefined;
}

type ProfileCanvasMoveIntent = {
  dx: -1 | 0 | 1;
  dy: -1 | 0 | 1;
};

function profileCanvasDisplacementIntent(
  anchorLayout: ProfileModuleLayout,
  layout: ProfileModuleLayout | null | undefined,
  movementContext: ProfileCanvasMovementContext,
): ProfileCanvasMoveIntent | undefined {
  if (!layout || !profileModuleLayoutsIntersect(anchorLayout, layout)) {
    return undefined;
  }

  const deltaColumn = movementContext.to.column - movementContext.from.column;
  const deltaRow = movementContext.to.row - movementContext.from.row;

  if (Math.abs(deltaColumn) >= Math.abs(deltaRow) && deltaColumn !== 0) {
    const overlap = profileModuleAxisOverlap(anchorLayout, layout, "column");

    if (overlap * 2 <= layout.colSpan) {
      return undefined;
    }

    return { dx: deltaColumn > 0 ? -1 : 1, dy: 0 };
  }

  if (deltaRow !== 0) {
    const overlap = profileModuleAxisOverlap(anchorLayout, layout, "row");

    if (overlap * 2 <= layout.rowSpan) {
      return undefined;
    }

    return { dx: 0, dy: deltaRow > 0 ? -1 : 1 };
  }

  return undefined;
}

function profileModuleLayoutsIntersect(
  first: ProfileModuleLayout,
  second: ProfileModuleLayout,
): boolean {
  return (
    first.column < second.column + second.colSpan &&
    first.column + first.colSpan > second.column &&
    first.row < second.row + second.rowSpan &&
    first.row + first.rowSpan > second.row
  );
}

function profileModuleAxisOverlap(
  first: ProfileModuleLayout,
  second: ProfileModuleLayout,
  axis: "column" | "row",
): number {
  if (axis === "column") {
    const start = Math.max(first.column, second.column);
    const end = Math.min(first.column + first.colSpan - 1, second.column + second.colSpan - 1);

    return Math.max(0, end - start + 1);
  }

  const start = Math.max(first.row, second.row);
  const end = Math.min(first.row + first.rowSpan - 1, second.row + second.rowSpan - 1);

  return Math.max(0, end - start + 1);
}

function findProfileModuleNextLayout(
  requestedLayout: ProfileModuleLayout,
  occupied: Set<string>,
  intent?: ProfileCanvasMoveIntent,
): ProfileModuleLayout | undefined {
  const maxColumn = PROFILE_CANVAS_COLUMNS - requestedLayout.colSpan + 1;
  const maxRow = PROFILE_CANVAS_ROWS - requestedLayout.rowSpan + 1;
  const baseColumn = Math.min(maxColumn, Math.max(1, requestedLayout.column));
  const baseRow = Math.min(maxRow, Math.max(1, requestedLayout.row));
  const candidates = [
    ...(intent
      ? profileCanvasDirectionalCandidates(baseColumn, baseRow, maxColumn, maxRow, intent)
      : []),
    ...profileCanvasNearestCandidates(baseColumn, baseRow, maxColumn, maxRow),
  ];
  const seen = new Set<string>();

  for (const candidatePoint of candidates) {
    const key = `${candidatePoint.column}:${candidatePoint.row}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    const candidate = {
      ...requestedLayout,
      column: candidatePoint.column,
      row: candidatePoint.row,
    };

    if (profileModuleLayoutFits(candidate, occupied)) {
      return candidate;
    }
  }

  return undefined;
}

function profileCanvasDirectionalCandidates(
  baseColumn: number,
  baseRow: number,
  maxColumn: number,
  maxRow: number,
  intent: ProfileCanvasMoveIntent,
): { column: number; row: number }[] {
  const candidates: { column: number; row: number }[] = [];

  if (intent.dx !== 0) {
    for (
      let column = baseColumn + intent.dx;
      column >= 1 && column <= maxColumn;
      column += intent.dx
    ) {
      candidates.push({ column, row: baseRow });
    }

    for (const row of profileCanvasNearbyRows(baseRow, maxRow)) {
      if (row !== baseRow) {
        candidates.push({ column: baseColumn, row });
      }
    }
  }

  if (intent.dy !== 0) {
    for (
      let row = baseRow + intent.dy;
      row >= 1 && row <= maxRow;
      row += intent.dy
    ) {
      candidates.push({ column: baseColumn, row });
    }

    for (const column of profileCanvasNearbyColumns(baseColumn, maxColumn)) {
      if (column !== baseColumn) {
        candidates.push({ column, row: baseRow });
      }
    }
  }

  return candidates;
}

function profileCanvasNearestCandidates(
  baseColumn: number,
  baseRow: number,
  maxColumn: number,
  maxRow: number,
): { column: number; row: number }[] {
  const candidates = profileCanvasSameRowSidewaysColumns(baseColumn, maxColumn).map(
    (column) => ({ column, row: baseRow }),
  );

  for (const row of profileCanvasNearbyRows(baseRow, maxRow)) {
    if (row === baseRow) {
      continue;
    }

    for (const column of profileCanvasNearbyColumns(baseColumn, maxColumn)) {
      candidates.push({ column, row });
    }
  }

  return candidates;
}

function profileCanvasSameRowSidewaysColumns(
  baseColumn: number,
  maxColumn: number,
): number[] {
  const columns: number[] = [];

  for (let distance = 1; distance <= maxColumn; distance += 1) {
    const right = baseColumn + distance;
    const left = baseColumn - distance;

    if (right <= maxColumn) {
      columns.push(right);
    }

    if (left >= 1) {
      columns.push(left);
    }
  }

  return columns;
}

function profileCanvasNearbyColumns(baseColumn: number, maxColumn: number): number[] {
  const columns = [baseColumn];

  for (let distance = 1; distance <= maxColumn; distance += 1) {
    const right = baseColumn + distance;
    const left = baseColumn - distance;

    if (right <= maxColumn) {
      columns.push(right);
    }

    if (left >= 1) {
      columns.push(left);
    }
  }

  return [...new Set(columns)];
}

function profileCanvasNearbyRows(baseRow: number, maxRow: number): number[] {
  const rows = [baseRow];

  for (let distance = 1; distance <= maxRow; distance += 1) {
    const down = baseRow + distance;
    const up = baseRow - distance;

    if (down <= maxRow) {
      rows.push(down);
    }

    if (up >= 1) {
      rows.push(up);
    }
  }

  return [...new Set(rows)];
}

function profileModuleLayoutFits(
  layout: ProfileModuleLayout | null | undefined,
  occupied: Set<string>,
): layout is ProfileModuleLayout {
  if (!layout) {
    return false;
  }

  if (
    layout.column < 1 ||
    layout.row < 1 ||
    layout.colSpan < 1 ||
    layout.rowSpan < 1 ||
    layout.column + layout.colSpan - 1 > PROFILE_CANVAS_COLUMNS ||
    layout.row + layout.rowSpan - 1 > PROFILE_CANVAS_ROWS
  ) {
    return false;
  }

  for (let row = layout.row; row < layout.row + layout.rowSpan; row++) {
    for (let column = layout.column; column < layout.column + layout.colSpan; column++) {
      if (occupied.has(`${column}:${row}`)) {
        return false;
      }
    }
  }

  return true;
}

function occupyProfileModuleLayout(
  layout: ProfileModuleLayout,
  occupied: Set<string>,
) {
  for (let row = layout.row; row < layout.row + layout.rowSpan; row++) {
    for (let column = layout.column; column < layout.column + layout.colSpan; column++) {
      occupied.add(`${column}:${row}`);
    }
  }
}

function profileCanvasModuleSort(first: ProfileModule, second: ProfileModule): number {
  const firstLayout = first.layout;
  const secondLayout = second.layout;

  if (firstLayout && secondLayout) {
    const rowCompare = firstLayout.row - secondLayout.row;

    if (rowCompare !== 0) {
      return rowCompare;
    }

    const columnCompare = firstLayout.column - secondLayout.column;

    if (columnCompare !== 0) {
      return columnCompare;
    }
  }

  return first.position - second.position;
}

type ProfileCanvasAddEntry =
  | "about"
  | "custom_text"
  | "links"
  | "featured_badges"
  | "gallery_media"
  | "creator_live"
  | "music"
  | "github_project"
  | "featured_post"
  | "featured_room"
  | "activity";

const profileCanvasAddEntries: { label: string; value: ProfileCanvasAddEntry }[] = [
  { label: "About", value: "about" },
  { label: "Text", value: "custom_text" },
  { label: "Links", value: "links" },
  { label: "Badges", value: "featured_badges" },
  { label: "Gallery", value: "gallery_media" },
  { label: "Creator", value: "creator_live" },
  { label: "Music", value: "music" },
  { label: "GitHub project", value: "github_project" },
  { label: "Featured post", value: "featured_post" },
  { label: "Featured room", value: "featured_room" },
  { label: "Activity", value: "activity" },
];

function profileCanvasAddInput(
  entry: ProfileCanvasAddEntry,
  userBadges: UserBadge[],
): CreateProfileModuleInput | undefined {
  const base = {
    status: "active" as const,
    title: null,
    visibility: "public" as const,
  };

  if (entry === "about") {
    return { ...base, type: "about", config: {} };
  }

  if (entry === "custom_text") {
    return { ...base, type: "custom_text", config: { body: "" } };
  }

  if (entry === "links") {
    return {
      ...base,
      type: "links",
      config: { links: [] },
    };
  }

  if (entry === "featured_badges") {
    const badgeId = userBadges.find((userBadge) => userBadge.isVisible)?.id;
    return {
      ...base,
      type: "featured_badges",
      config: { userBadgeIds: badgeId ? [badgeId] : [] },
    };
  }

  if (entry === "gallery_media") {
    return {
      ...base,
      type: "gallery_media",
      config: { mediaItems: [] },
    };
  }

  if (entry === "creator_live") {
    return { ...base, type: "creator_live", config: {} };
  }

  if (entry === "github_project") {
    return { ...base, type: "creator_live", config: { platform: "github" } };
  }

  if (entry === "music") {
    return { ...base, type: "music", config: {} };
  }

  if (
    entry === "featured_post" ||
    entry === "featured_room" ||
    entry === "activity"
  ) {
    return { ...base, type: entry as ProfileModuleType, config: {} };
  }

  return undefined;
}

type ProfileCanvasEditorToolbarProps = {
  busy: boolean;
  editing: boolean;
  error?: string | undefined;
  integrationBusy?: ProfileIntegrationProvider | "metadata" | undefined;
  integrationMessage?: string | undefined;
  integrations?: ProfileIntegrationsResult | undefined;
  modules: ProfileModule[];
  removedModules: ProfileModule[];
  onAddModule: (input: CreateProfileModuleInput) => void;
  onCancel: () => void;
  onConnectIntegration: (provider: ProfileIntegrationProvider) => void;
  onDisconnectIntegration: (provider: ProfileIntegrationProvider) => void;
  onEdit: () => void;
  onRestoreModule: (module: ProfileModule) => void;
  onSave: () => void;
  userBadges: UserBadge[];
};

type ProfileCanvasDockCategory =
  | "essentials"
  | "featured"
  | "media"
  | "integrations"
  | "removed";

const profileCanvasDockCategories: {
  icon: ReactNode;
  label: string;
  value: ProfileCanvasDockCategory;
}[] = [
  {
    icon: <Radio aria-hidden="true" size={15} />,
    label: "Integrations",
    value: "integrations",
  },
  {
    icon: <UserCheck aria-hidden="true" size={15} />,
    label: "Essentials",
    value: "essentials",
  },
  {
    icon: <Star aria-hidden="true" size={15} />,
    label: "Featured",
    value: "featured",
  },
  {
    icon: <ImagePlus aria-hidden="true" size={15} />,
    label: "Media",
    value: "media",
  },
  {
    icon: <Undo2 aria-hidden="true" size={15} />,
    label: "Removed",
    value: "removed",
  },
];

const profileCanvasDockEntries: Record<
  Exclude<ProfileCanvasDockCategory, "integrations" | "removed">,
  ProfileCanvasAddEntry[]
> = {
  essentials: ["about", "links", "featured_badges", "activity"],
  featured: ["featured_post", "featured_room"],
  media: ["gallery_media", "creator_live", "music", "custom_text"],
};

const profileIntegrationProviders: ProfileIntegrationProvider[] = [
  "spotify",
  "apple_music",
  "youtube",
  "twitch",
  "github",
];

function ProfileCanvasEditorToolbar({
  busy,
  editing,
  error,
  integrationBusy,
  integrationMessage,
  integrations,
  modules,
  onAddModule,
  onCancel,
  onConnectIntegration,
  onDisconnectIntegration,
  onEdit,
  onRestoreModule,
  onSave,
  removedModules,
  userBadges,
}: ProfileCanvasEditorToolbarProps) {
  const [activeCategory, setActiveCategory] =
    useState<ProfileCanvasDockCategory>("integrations");
  const [moduleSearch, setModuleSearch] = useState("");
  const useMobilePanel = useProfileCanvasMobilePanel();

  if (!editing) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        {error ? (
          <p className="text-sm font-medium text-rose-ink" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy}
          data-testid="profile-canvas-edit-button"
          icon={<Settings2 aria-hidden="true" size={16} />}
          onClick={onEdit}
        >
          {busy ? "Opening" : "Edit canvas"}
        </Button>
      </div>
    );
  }

  const activeModuleTypes = new Set(modules.map((module) => module.type));
  const normalizedSearch = moduleSearch.trim().toLowerCase();
  const categoryEntries =
    activeCategory === "integrations" || activeCategory === "removed"
      ? []
      : profileCanvasDockEntries[activeCategory];
  const visibleEntries = categoryEntries.filter((entry) => {
    if (entry === "featured_badges" && userBadges.length === 0) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return profileCanvasAddEntryLabel(entry).toLowerCase().includes(normalizedSearch);
  });
  const providerStatuses = profileIntegrationProviders.map((provider) =>
    profileIntegrationStatus(provider, integrations?.providers),
  );

  const editorPanel = (
    <section
      aria-label="Profile canvas editor"
      className={cn(
        "mx-auto flex flex-col overflow-hidden rounded-panel border border-line bg-surface/78 shadow-lift backdrop-blur-veil",
        useMobilePanel
          ? "fixed inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[70] max-h-[calc(100dvh-7rem)] max-w-xl"
          : "sticky top-20 hidden max-h-[calc(100dvh-6rem)] max-w-none lg:flex",
      )}
      data-testid="profile-canvas-editor"
      data-profile-canvas-edit-mode={useMobilePanel ? "stacked" : "grid"}
      data-profile-canvas-panel="left"
    >
      <div className="flex shrink-0 flex-col border-b border-line/70 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-muted">Canvas</p>
            <h2 className="truncate text-base font-semibold text-text">
              Arrange modules
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-1 lg:hidden">
            <button
              type="button"
              className="grid size-9 place-items-center rounded-control border border-line bg-canvas/55 text-text focus-visible:outline-2 focus-visible:outline-focus"
              aria-label="Cancel editing"
              onClick={onCancel}
            >
              <X aria-hidden="true" size={17} />
            </button>
            <button
              type="button"
              className="grid size-9 place-items-center rounded-control bg-accent text-accent-ink focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-55"
              aria-label="Save layout"
              title="Save layout"
              data-testid="profile-canvas-save-button-mobile"
              disabled={busy}
              onClick={onSave}
            >
              <Save aria-hidden="true" size={17} />
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1" role="tablist" aria-label="Module categories">
          {profileCanvasDockCategories.map((category) => (
            <button
              key={category.value}
              type="button"
              role="tab"
              aria-selected={activeCategory === category.value}
              className="inline-flex min-w-0 items-center gap-2 rounded-card px-3 py-2 text-left text-sm font-semibold text-muted transition duration-fluid ease-fluid hover:bg-canvas/55 hover:text-text focus-visible:outline-2 focus-visible:outline-focus aria-selected:bg-canvas/70 aria-selected:text-text"
              data-testid={`profile-canvas-category-${category.value}`}
              onClick={() => setActiveCategory(category.value)}
            >
              {category.icon}
              <span className="block truncate">{category.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-auto hidden gap-2 pt-3 lg:flex">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy}
            icon={<X aria-hidden="true" size={16} />}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            data-testid="profile-canvas-save-button"
            icon={<Save aria-hidden="true" size={16} />}
            onClick={onSave}
          >
            Save layout
          </Button>
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto p-3" data-testid="profile-canvas-dock">
        <div className="space-y-3">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search modules</span>
            <input
              className="h-10 w-full rounded-control border border-line bg-canvas/55 px-3 text-sm font-medium text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-focus"
              value={moduleSearch}
              onChange={(event) => setModuleSearch(event.target.value)}
              placeholder="Search modules"
              data-testid="profile-canvas-module-search"
            />
          </label>
        </div>

        {activeCategory === "integrations" ? (
          <div className="mt-3 space-y-3" data-testid="profile-canvas-integrations">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {providerStatuses.map((providerStatus) => {
                const account = profileIntegrationAccount(providerStatus.provider, integrations?.accounts);
                const connected = Boolean(account && !account.revokedAt);
                const canAddModule =
                  connected ||
                  providerStatus.provider === "apple_music" ||
                  (!providerStatus.oauthEnabled && Boolean(providerStatus.linkSupported));
                const addModuleLabel =
                  profileCanvasIntegrationModuleType(providerStatus.provider) === "music"
                    ? "Add music"
                    : "Add creator";

                return (
                  <article
                    key={providerStatus.provider}
                    className="min-w-0 rounded-card border border-line bg-canvas/48 p-3"
                    data-testid={`profile-integration-card-${providerStatus.provider}`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className="grid size-9 shrink-0 place-items-center rounded-card border border-line bg-surface/78 text-text"
                        data-testid={`profile-integration-logo-${providerStatus.provider}`}
                      >
                        {profileIntegrationIcon(providerStatus.provider)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold text-text">
                          {integrationProviderLabel(providerStatus.provider)}
                        </h3>
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {connected
                            ? account?.displayName ?? account?.providerHandle ?? "Connected"
                            : profileIntegrationStatusText(providerStatus)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {!connected ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={
                            busy ||
                            integrationBusy === providerStatus.provider ||
                            !providerStatus.oauthEnabled
                          }
                          title={
                            providerStatus.oauthEnabled
                              ? `Connect ${integrationProviderLabel(providerStatus.provider)}`
                              : profileIntegrationStatusText(providerStatus)
                          }
                          data-testid={`profile-integration-connect-${providerStatus.provider}`}
                          onClick={() => onConnectIntegration(providerStatus.provider)}
                        >
                          Connect
                        </Button>
                      ) : null}
                      {connected ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={busy || integrationBusy === providerStatus.provider}
                            data-testid={`profile-integration-add-module-${providerStatus.provider}`}
                            onClick={() =>
                              onAddModule(
                                profileCanvasModuleInputFromProvider(
                                  providerStatus.provider,
                                  account,
                                ),
                              )
                            }
                          >
                            {addModuleLabel}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busy || integrationBusy === providerStatus.provider}
                            onClick={() => onDisconnectIntegration(providerStatus.provider)}
                          >
                            Disconnect
                          </Button>
                        </>
                      ) : null}
                      {!connected && canAddModule ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          data-testid={`profile-integration-add-module-${providerStatus.provider}`}
                          onClick={() =>
                            onAddModule(
                              profileCanvasModuleInputFromProvider(
                                providerStatus.provider,
                                account,
                              ),
                            )
                          }
                        >
                          {addModuleLabel}
                        </Button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>

            {integrationMessage ? (
              <p className="rounded-card border border-line bg-canvas/48 p-3 text-sm font-medium text-muted" role="status">
                {integrationMessage}
              </p>
            ) : null}
          </div>
        ) : activeCategory === "removed" ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {removedModules.length > 0 ? (
              removedModules.map((module) => (
                <ProfileDockModuleCard
                  key={module.id}
                  actionLabel="Restore"
                  disabled={busy}
                  icon={profileCanvasModuleIcon(module.type)}
                  meta="Removed from canvas"
                  title={module.title ?? profileModuleFallbackTitle(module.type)}
                  onAction={() => onRestoreModule(module)}
                  testId={`profile-canvas-restore-module-${module.id}`}
                />
              ))
            ) : (
              <p className="rounded-card border border-dashed border-line bg-canvas/45 p-4 text-sm text-muted">
                Removed modules appear here.
              </p>
            )}
          </div>
        ) : (
          <>
            <div
              className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1"
              data-testid="profile-canvas-module-browser"
            >
              {activeCategory === "essentials" &&
              (!normalizedSearch || "profile info".includes(normalizedSearch)) ? (
                <ProfileDockModuleCard
                  actionLabel="On canvas"
                  disabled
                  icon={<UserCheck aria-hidden="true" size={20} />}
                  meta="Identity anchor. Always visible and not removable."
                  title="Profile info"
                  onAction={() => undefined}
                  testId="profile-canvas-identity-anchor"
                />
              ) : null}
              {visibleEntries.map((entry) => {
                const existing = profileCanvasEntryActiveModule(entry, modules);
                const singletonExists = existing && profileCanvasEntryIsSingleton(entry);
                const addInput = profileCanvasAddInput(entry, userBadges);

                return (
                  <ProfileDockModuleCard
                    key={entry}
                    actionLabel={singletonExists ? "On canvas" : "Add"}
                    disabled={busy || Boolean(singletonExists) || !addInput}
                    icon={profileCanvasEntryIcon(entry)}
                    meta={profileCanvasEntryPurpose(entry)}
                    title={profileCanvasAddEntryLabel(entry)}
                    onAction={() => {
                      if (addInput) {
                        onAddModule(addInput);
                      }
                    }}
                    testId={`profile-canvas-add-module-${entry}`}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>
      {(error || activeModuleTypes.size === 0) ? (
        <div className="shrink-0 border-t border-line/70 p-3">
          {error ? (
            <p className="text-sm font-medium text-rose-ink" role="alert">
              {error}
            </p>
          ) : null}
          {activeModuleTypes.size === 0 ? (
            <p className="text-xs text-muted">Add a module to start shaping this space.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );

  if (useMobilePanel && typeof document !== "undefined") {
    return createPortal(editorPanel, document.body);
  }

  return editorPanel;
}

function useProfileCanvasMobilePanel(): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia("(max-width: 1023px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const query = window.matchMedia("(max-width: 1023px)");
    const update = () => setMatches(query.matches);

    update();
    query.addEventListener("change", update);

    return () => query.removeEventListener("change", update);
  }, []);

  return matches;
}

function ProfileSelectedModuleControls({
  busy,
  feed,
  integrationBusy,
  integrations,
  module,
  onConnectIntegration,
  onConfigChange,
  onDeleteModule,
  onLayoutChange,
  onPinnedChange,
  onProfileDraftChange,
  onProfileImageUpload,
  onResolveIntegration,
  onVisibilityChange,
  profile,
  profileAutosaveError,
  profileAutosaveState,
  rooms,
  size,
}: {
  busy: boolean;
  feed: Post[];
  integrationBusy?: ProfileIntegrationProvider | "metadata" | undefined;
  integrations?: ProfileIntegrationsResult | undefined;
  module: ProfileModule;
  onConnectIntegration: (provider: ProfileIntegrationProvider) => void;
  onConfigChange: (config: ProfileModuleConfig) => void;
  onDeleteModule: () => void;
  onLayoutChange: (layout: ProfileModuleLayout) => void;
  onPinnedChange: (pinned: boolean) => void;
  onProfileDraftChange: (updater: (profile: Profile) => Profile) => void;
  onProfileImageUpload: (
    file: File,
    purpose: "avatar" | "banner" | "profile_background",
  ) => void;
  onResolveIntegration: (input: {
    provider?: ProfileIntegrationProvider;
    url: string;
  }) => Promise<ProfileIntegrationCard>;
  onVisibilityChange: (visible: boolean) => void;
  profile: Profile;
  profileAutosaveError?: string | undefined;
  profileAutosaveState: ProfileContentAutosaveState;
  rooms: Room[];
  size: ProfileGridModuleSize;
}) {
  const [connectionPlatform, setConnectionPlatform] =
    useState<ProfileConnectionPlatform>("website");
  const [connectionValue, setConnectionValue] = useState("");
  const [connectionError, setConnectionError] = useState<string | undefined>();
  const [connectionFormOpen, setConnectionFormOpen] = useState(false);
  const layout = module.layout ?? {
    column: 1,
    row: 1,
    colSpan: profileGridModuleSizeSpan(size).columns,
    rowSpan: profileGridModuleSizeSpan(size).rows,
  };
  const selectedSize =
    profileGridModuleSpanSize(layout.colSpan, layout.rowSpan) ?? size;
  const canDelete = module.type !== "profile_info";
  const visible = module.visibility === "public";
  const pinned = module.pinned === true;
  const allowedSizes = profileModuleAllowedSizes(module.type);

  function updateSpan(nextSize: ProfileGridModuleSize) {
    const span = profileGridModuleSizeSpan(nextSize);

    onLayoutChange(
      clampProfileModuleLayout({
        ...layout,
        colSpan: span.columns,
        rowSpan: span.rows,
      }),
    );
  }

  function addConnection() {
    const result = validateProfileConnectionDraft(connectionPlatform, connectionValue);

    if ("error" in result) {
      setConnectionError(result.error);
      return;
    }

    setConnectionError(undefined);
    setConnectionValue("");
    setConnectionFormOpen(false);
    onConfigChange({
      ...module.config,
      links: dedupeProfileModuleLinks([
        ...(module.config.links ?? []),
        profileModuleLinkFromConnection(result.connection),
      ]),
    });
  }

  function removeConnection(link: ProfileModuleLink) {
    onConfigChange({
      ...module.config,
      links: (module.config.links ?? []).filter((item) => item.url !== link.url),
    });
  }

  return (
    <article
      className="grid max-h-[min(34rem,calc(100dvh-8rem))] min-h-0 min-w-0 grid-rows-[auto_1fr] overflow-hidden rounded-card border border-line-strong bg-surface/90 p-3 text-sm shadow-lift backdrop-blur-veil"
      data-profile-edit-control="true"
      data-testid="profile-selected-module-controls"
      data-profile-module-edit-surface="true"
      role="region"
      aria-label={`Edit ${profileModuleFallbackTitle(module.type)} module`}
    >
      <header className="min-w-0 pr-10">
        <div className="min-w-0">
          <p className="truncate font-semibold text-text">
            {module.title ?? profileModuleFallbackTitle(module.type)}
          </p>
        </div>
      </header>

      <div className="mt-3 min-h-0 overflow-y-auto pr-1">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase text-muted">Size</p>
            <div className="relative z-30 flex shrink-0 gap-1">
              <button
                type="button"
                className="grid size-8 place-items-center rounded-control border border-line bg-canvas/55 text-muted transition hover:text-text focus-visible:outline-2 focus-visible:outline-focus aria-pressed:bg-accent aria-pressed:text-accent-ink"
                aria-label={pinned ? "Unpin module" : "Pin module"}
                aria-pressed={pinned}
                title={pinned ? "Unpin module" : "Pin module"}
                data-profile-edit-control="true"
                data-testid="profile-canvas-pin-module-button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onPinnedChange(!pinned);
                }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onPinnedChange(!pinned);
                }}
              >
                <Pin aria-hidden="true" size={15} />
              </button>
              <button
                type="button"
                className="grid size-8 place-items-center rounded-control border border-line bg-canvas/55 text-muted transition hover:text-text focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50"
                aria-label={visible ? "Hide module" : "Show module"}
                title={visible ? "Hide module" : "Show module"}
                disabled={module.type === "profile_info"}
                data-profile-edit-control="true"
                data-testid="profile-canvas-visibility-button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onVisibilityChange(!visible);
                }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onVisibilityChange(!visible);
                }}
              >
                <Eye aria-hidden="true" size={15} />
              </button>
              <button
                type="button"
                className="grid size-8 place-items-center rounded-control border border-line bg-canvas/55 text-muted transition hover:text-text focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50"
                aria-label="Remove module"
                title="Remove module"
                disabled={!canDelete || busy}
                data-profile-edit-control="true"
                data-testid="profile-canvas-delete-module-button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onDeleteModule();
                }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onDeleteModule();
                }}
              >
                <Trash2 aria-hidden="true" size={15} />
              </button>
            </div>
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {allowedSizes.map((allowedSize) => (
              <button
                key={allowedSize}
                type="button"
                className="rounded-control border border-line bg-canvas/55 px-2 py-1 text-xs font-semibold text-muted transition hover:border-line-strong hover:text-text focus-visible:outline-2 focus-visible:outline-focus aria-pressed:bg-surface aria-pressed:text-text"
                aria-pressed={selectedSize === allowedSize}
                data-testid={`profile-canvas-size-${allowedSize}`}
                onClick={() => updateSpan(allowedSize)}
              >
                {profileModuleSizeLabel(module.type, allowedSize)}
              </button>
            ))}
          </div>
        </div>

        <ProfileSelectedModuleContentControls
          connectionError={connectionError}
          connectionFormOpen={connectionFormOpen}
          connectionPlatform={connectionPlatform}
          connectionValue={connectionValue}
          feed={feed}
          integrationBusy={integrationBusy}
          integrations={integrations}
          module={module}
          profile={profile}
          profileAutosaveError={profileAutosaveError}
          profileAutosaveState={profileAutosaveState}
          rooms={rooms}
          onAddConnection={addConnection}
          onConnectIntegration={onConnectIntegration}
          onConfigChange={onConfigChange}
          onConnectionFormOpenChange={setConnectionFormOpen}
          onConnectionPlatformChange={setConnectionPlatform}
          onConnectionValueChange={setConnectionValue}
          onProfileDraftChange={onProfileDraftChange}
          onProfileImageUpload={onProfileImageUpload}
          onRemoveConnection={removeConnection}
          onResolveIntegration={onResolveIntegration}
          onSizeChange={updateSpan}
          selectedSize={selectedSize}
        />
      </div>
    </article>
  );
}

function ProfileInfoAutosaveStatus({
  error,
  state,
}: {
  error?: string | undefined;
  state: ProfileContentAutosaveState;
}) {
  const message =
    state === "error"
      ? error ?? "Profile edits could not save automatically."
      : state === "saving" || state === "pending"
        ? "Saving profile..."
        : state === "saved"
          ? "Profile saved."
          : "Profile edits save automatically.";

  return (
    <p
      className={cn(
        "rounded-card border px-3 py-2 text-xs font-semibold",
        state === "error"
          ? "border-rose/30 bg-rose/12 text-rose-ink"
          : "border-line bg-canvas/45 text-muted",
      )}
      data-testid="profile-info-autosave-status"
      role={state === "error" ? "alert" : "status"}
    >
      {message}
    </p>
  );
}

function ProfileSelectedModuleContentControls({
  connectionError,
  connectionFormOpen,
  connectionPlatform,
  connectionValue,
  feed,
  integrationBusy,
  integrations,
  module,
  onAddConnection,
  onConnectIntegration,
  onConfigChange,
  onConnectionFormOpenChange,
  onConnectionPlatformChange,
  onConnectionValueChange,
  onProfileDraftChange,
  onProfileImageUpload,
  onRemoveConnection,
  onResolveIntegration,
  onSizeChange,
  profile,
  profileAutosaveError,
  profileAutosaveState,
  rooms,
  selectedSize,
}: {
  connectionError?: string | undefined;
  connectionFormOpen: boolean;
  connectionPlatform: ProfileConnectionPlatform;
  connectionValue: string;
  feed: Post[];
  integrationBusy?: ProfileIntegrationProvider | "metadata" | undefined;
  integrations?: ProfileIntegrationsResult | undefined;
  module: ProfileModule;
  onAddConnection: () => void;
  onConnectIntegration: (provider: ProfileIntegrationProvider) => void;
  onConfigChange: (config: ProfileModuleConfig) => void;
  onConnectionFormOpenChange: (open: boolean) => void;
  onConnectionPlatformChange: (platform: ProfileConnectionPlatform) => void;
  onConnectionValueChange: (value: string) => void;
  onProfileDraftChange: (updater: (profile: Profile) => Profile) => void;
  onProfileImageUpload: (
    file: File,
    purpose: "avatar" | "banner" | "profile_background",
  ) => void;
  onRemoveConnection: (link: ProfileModuleLink) => void;
  onResolveIntegration: (input: {
    provider?: ProfileIntegrationProvider;
    url: string;
  }) => Promise<ProfileIntegrationCard>;
  onSizeChange: (size: ProfileGridModuleSize) => void;
  profile: Profile;
  profileAutosaveError?: string | undefined;
  profileAutosaveState: ProfileContentAutosaveState;
  rooms: Room[];
  selectedSize: ProfileGridModuleSize;
}) {
  if (module.type === "profile_info") {
    return (
      <div className="mt-3 space-y-3">
        <ProfileInfoAutosaveStatus
          error={profileAutosaveError}
          state={profileAutosaveState}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs font-semibold uppercase text-muted">
            Name
            <input
              className="mt-1 h-9 w-full rounded-control border border-line bg-canvas/55 px-2 text-sm font-semibold normal-case text-text focus-visible:outline-2 focus-visible:outline-focus"
              value={profile.user.displayName}
              data-testid="profile-info-display-name-input"
              onChange={(event) =>
                onProfileDraftChange((current) => ({
                  ...current,
                  user: { ...current.user, displayName: event.target.value },
                }))
              }
            />
          </label>
          <label className="text-xs font-semibold uppercase text-muted">
            Location
            <input
              className="mt-1 h-9 w-full rounded-control border border-line bg-canvas/55 px-2 text-sm font-semibold normal-case text-text focus-visible:outline-2 focus-visible:outline-focus"
              value={profile.location}
              data-testid="profile-info-location-input"
              onChange={(event) =>
                onProfileDraftChange((current) => ({
                  ...current,
                  location: event.target.value,
                }))
              }
            />
          </label>
          <label className="sm:col-span-2 text-xs font-semibold uppercase text-muted">
            Bio
            <textarea
              className="mt-1 min-h-16 w-full resize-none rounded-control border border-line bg-canvas/55 px-2 py-2 text-sm font-medium normal-case text-text focus-visible:outline-2 focus-visible:outline-focus"
              value={profile.bio}
              data-testid="profile-info-bio-input"
              onChange={(event) =>
                onProfileDraftChange((current) => ({
                  ...current,
                  bio: event.target.value,
                }))
              }
            />
          </label>
          <label className="inline-flex min-h-9 cursor-pointer items-center justify-center rounded-control border border-line bg-canvas/55 px-2 text-xs font-semibold text-muted transition hover:text-text focus-within:outline-2 focus-within:outline-focus">
            Avatar
            <input
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              data-testid="profile-info-avatar-input"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) {
                  onProfileImageUpload(file, "avatar");
                }
                event.currentTarget.value = "";
              }}
            />
          </label>
          <label className="inline-flex min-h-9 cursor-pointer items-center justify-center rounded-control border border-line bg-canvas/55 px-2 text-xs font-semibold text-muted transition hover:text-text focus-within:outline-2 focus-within:outline-focus">
            Banner
            <input
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              data-testid="profile-info-banner-input"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) {
                  onProfileImageUpload(file, "banner");
                }
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>
      </div>
    );
  }

  if (module.type === "links") {
    const links = module.config.links ?? [];

    return (
      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap gap-1">
          {links.map((link) => (
            <span
              key={`${link.platform ?? "website"}-${link.url}`}
              className="inline-flex max-w-full items-center gap-1 rounded-control border border-line bg-canvas/55 px-2 py-1 text-xs font-semibold text-muted"
            >
              <span className="truncate">{link.label || moduleLinkLabelFromUrl(link.url)}</span>
              <button
                type="button"
                className="rounded-full text-muted hover:text-text focus-visible:outline-2 focus-visible:outline-focus"
                aria-label={`Remove ${link.label || "connection"}`}
                onClick={() => onRemoveConnection(link)}
              >
                <X aria-hidden="true" size={12} />
              </button>
            </span>
          ))}
        </div>
        <button
          type="button"
          className="inline-flex min-h-9 items-center rounded-control border border-line bg-canvas/55 px-3 text-sm font-semibold text-text transition hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus"
          data-testid="profile-connection-add-open-button"
          onClick={() => onConnectionFormOpenChange(!connectionFormOpen)}
        >
          Add connection +
        </button>
        {connectionFormOpen ? (
          <div
            className="rounded-card border border-line bg-canvas/45 p-2"
            data-testid="profile-connection-add-popover"
          >
            <div className="flex flex-wrap gap-1" aria-label="Connection platform">
              {profileConnectionPlatforms.map((platform) => (
                <button
                  key={platform.value}
                  type="button"
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-control border border-line bg-surface/62 px-2 text-xs font-semibold text-muted transition hover:border-line-strong hover:text-text focus-visible:outline-2 focus-visible:outline-focus aria-pressed:bg-accent aria-pressed:text-accent-ink"
                  aria-label={platform.label}
                  aria-pressed={connectionPlatform === platform.value}
                  data-testid={`profile-connection-platform-${platform.value}`}
                  onClick={() => onConnectionPlatformChange(platform.value)}
                >
                  <ProfileConnectionIcon platform={platform.value} size={15} />
                  <span className="max-w-20 truncate">{platform.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
              <label className="text-xs font-semibold uppercase text-muted">
                Handle or URL
                <input
                  className="mt-1 h-9 w-full rounded-control border border-line bg-surface/68 px-2 text-sm font-semibold normal-case text-text focus-visible:outline-2 focus-visible:outline-focus"
                  value={connectionValue}
                  data-testid="profile-connection-value-input"
                  onChange={(event) => onConnectionValueChange(event.target.value)}
                  placeholder={connectionPlatformLabel(connectionPlatform)}
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  className="min-h-9 rounded-control bg-accent px-3 text-sm font-semibold text-accent-ink focus-visible:outline-2 focus-visible:outline-focus"
                  data-testid="profile-connection-add-button"
                  onClick={onAddConnection}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {connectionFormOpen ? null : links.length === 0 ? (
          <p className="text-xs text-muted">No connections yet.</p>
        ) : null}
        {connectionError ? (
          <p className="text-xs font-semibold text-rose-ink" role="alert">
            {connectionError}
          </p>
        ) : null}
      </div>
    );
  }

  if (module.type === "about" || module.type === "custom_text") {
    return (
      <label className="mt-3 block text-xs font-semibold uppercase text-muted">
        Text
        <textarea
          className="mt-1 min-h-16 w-full resize-none rounded-control border border-line bg-canvas/55 px-2 py-2 text-sm font-medium normal-case text-text focus-visible:outline-2 focus-visible:outline-focus"
          value={module.config.body ?? ""}
          data-testid="profile-module-body-input"
          onChange={(event) =>
            onConfigChange({
              ...module.config,
              body: event.target.value,
            })
          }
        />
      </label>
    );
  }

  if (module.type === "music") {
    return (
      <ProfileMusicModuleConfigControls
        key={module.id}
        integrationBusy={integrationBusy}
        integrations={integrations}
        module={module}
        onConfigChange={onConfigChange}
        onConnectIntegration={onConnectIntegration}
        onResolveIntegration={onResolveIntegration}
      />
    );
  }

  if (module.type === "creator_live") {
    return (
      <ProfileCreatorModuleConfigControls
        key={module.id}
        integrationBusy={integrationBusy}
        integrations={integrations}
        module={module}
        selectedSize={selectedSize}
        onConfigChange={onConfigChange}
        onConnectIntegration={onConnectIntegration}
        onResolveIntegration={onResolveIntegration}
        onSizeChange={onSizeChange}
      />
    );
  }

  if (module.type === "featured_post") {
    return (
      <label className="mt-3 block text-xs font-semibold uppercase text-muted">
        Featured post
        <select
          className="mt-1 h-9 w-full rounded-control border border-line bg-canvas/55 px-2 text-sm font-semibold normal-case text-text focus-visible:outline-2 focus-visible:outline-focus"
          value={profile.featuredPostId ?? ""}
          data-testid="profile-featured-post-select"
          onChange={(event) => {
            const id = Number(event.target.value) || null;
            const post = feed.find((item) => item.id === id) ?? null;

            onProfileDraftChange((current) => ({
              ...current,
              featuredPostId: id,
              featuredPost: post,
            }));
          }}
        >
          <option value="">Choose post</option>
          {feed.map((post) => (
            <option key={post.id} value={post.id}>
              {post.body.slice(0, 72)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (module.type === "featured_room") {
    return (
      <label className="mt-3 block text-xs font-semibold uppercase text-muted">
        Featured room
        <select
          className="mt-1 h-9 w-full rounded-control border border-line bg-canvas/55 px-2 text-sm font-semibold normal-case text-text focus-visible:outline-2 focus-visible:outline-focus"
          value={profile.featuredRoomId ?? ""}
          data-testid="profile-featured-room-select"
          onChange={(event) => {
            const id = Number(event.target.value) || null;
            const room = rooms.find((item) => item.id === id) ?? null;

            onProfileDraftChange((current) => ({
              ...current,
              featuredRoomId: id,
              featuredRoom: room,
            }));
          }}
        >
          <option value="">Choose room</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return null;
}

function ProfileMusicModuleConfigControls({
  integrationBusy,
  integrations,
  module,
  onConfigChange,
  onConnectIntegration,
  onResolveIntegration,
}: {
  integrationBusy?: ProfileIntegrationProvider | "metadata" | undefined;
  integrations?: ProfileIntegrationsResult | undefined;
  module: ProfileModule;
  onConfigChange: (config: ProfileModuleConfig) => void;
  onConnectIntegration: (provider: ProfileIntegrationProvider) => void;
  onResolveIntegration: (input: {
    provider?: ProfileIntegrationProvider;
    url: string;
  }) => Promise<ProfileIntegrationCard>;
}) {
  const selectedProvider = profileMusicProviderFromConfig(module.config);
  const [url, setUrl] = useState(module.config.url ?? "");
  const [preview, setPreview] = useState<ProfileIntegrationCard | undefined>(
    module.config.integration,
  );
  const [error, setError] = useState<string | undefined>();
  const [resolving, setResolving] = useState(false);
  const spotifyStatus = profileIntegrationStatus("spotify", integrations?.providers);
  const spotifyAccount = profileIntegrationAccount("spotify", integrations?.accounts);
  const spotifyConnected = Boolean(spotifyAccount && !spotifyAccount.revokedAt);

  async function resolveUrl() {
    const trimmed = url.trim();

    if (!trimmed) {
      setError("Paste a song or playlist URL.");
      return;
    }

    setResolving(true);
    setError(undefined);

    try {
      const card = await onResolveIntegration({
        provider: selectedProvider,
        url: trimmed,
      });

      setPreview(card);
      onConfigChange({
        ...profileModulePersistentConfig(module.config),
        displayMode: "embed",
        label: card.metadata.title ?? integrationProviderLabel(card.provider),
        platform: profileMusicPlatformFromProvider(card.provider),
        sourceMode: profileMusicSourceModeFromProvider(card.provider),
        url: card.sourceUrl,
        ...(card.metadata.description
          ? { description: card.metadata.description }
          : {}),
      });
    } catch (metadataError) {
      setError(
        metadataError instanceof Error
          ? metadataError.message
          : "Could not preview that link.",
      );
    } finally {
      setResolving(false);
    }
  }

  function selectProvider(provider: Extract<ProfileIntegrationProvider, "spotify" | "apple_music" | "youtube">) {
    onConfigChange({
      ...profileModulePersistentConfig(module.config),
      displayMode: "embed",
      platform: profileMusicPlatformFromProvider(provider),
      sourceMode: profileMusicSourceModeFromProvider(provider),
    });
  }

  return (
    <div className="mt-3 space-y-3" data-testid="profile-music-config">
      <div className="flex flex-wrap gap-1" aria-label="Music source">
        {musicModuleProviderOptions.map((option) => (
          <button
            key={option.provider}
            type="button"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-control border border-line bg-canvas/55 px-2 text-xs font-semibold text-muted transition hover:border-line-strong hover:text-text focus-visible:outline-2 focus-visible:outline-focus aria-pressed:bg-accent aria-pressed:text-accent-ink"
            aria-pressed={selectedProvider === option.provider}
            data-testid={`profile-music-provider-${option.provider}`}
            onClick={() => selectProvider(option.provider)}
          >
            {profileIntegrationIcon(option.provider)}
            <span>{option.label}</span>
          </button>
        ))}
      </div>

      {selectedProvider === "spotify" && !spotifyConnected && spotifyStatus.oauthEnabled ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={integrationBusy === "spotify"}
          data-testid="profile-music-connect-spotify"
          onClick={() => onConnectIntegration("spotify")}
        >
          Connect Spotify
        </Button>
      ) : null}

      <label className="block text-xs font-semibold uppercase text-muted">
        Song or playlist URL
        <div className="mt-1 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            className="h-9 w-full rounded-control border border-line bg-canvas/55 px-2 text-sm font-semibold normal-case text-text focus-visible:outline-2 focus-visible:outline-focus"
            value={url}
            data-testid="profile-music-url-input"
            onChange={(event) => setUrl(event.target.value)}
            placeholder={musicModuleUrlPlaceholder(selectedProvider)}
          />
          <Button
            type="button"
            size="sm"
            disabled={resolving}
            data-testid="profile-music-preview-button"
            onClick={() => void resolveUrl()}
          >
            {resolving ? "Checking" : "Use"}
          </Button>
        </div>
      </label>

      {preview ? (
        <ProfileIntegrationPreviewSummary card={preview} />
      ) : null}
      {error ? (
        <p className="text-xs font-semibold text-rose-ink" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ProfileCreatorModuleConfigControls({
  integrationBusy,
  integrations,
  module,
  onConfigChange,
  onConnectIntegration,
  onResolveIntegration,
  onSizeChange,
  selectedSize,
}: {
  integrationBusy?: ProfileIntegrationProvider | "metadata" | undefined;
  integrations?: ProfileIntegrationsResult | undefined;
  module: ProfileModule;
  onConfigChange: (config: ProfileModuleConfig) => void;
  onConnectIntegration: (provider: ProfileIntegrationProvider) => void;
  onResolveIntegration: (input: {
    provider?: ProfileIntegrationProvider;
    url: string;
  }) => Promise<ProfileIntegrationCard>;
  onSizeChange: (size: ProfileGridModuleSize) => void;
  selectedSize: ProfileGridModuleSize;
}) {
  const selectedProvider = profileCreatorProviderFromConfig(module.config);
  const selectedMode =
    module.config.displayMode ?? profileCreatorDefaultDisplayMode(selectedProvider);
  const [url, setUrl] = useState(module.config.url ?? "");
  const [preview, setPreview] = useState<ProfileIntegrationCard | undefined>(
    module.config.integration,
  );
  const [error, setError] = useState<string | undefined>();
  const [resolving, setResolving] = useState(false);
  const providerStatus = profileIntegrationStatus(selectedProvider, integrations?.providers);
  const account = profileIntegrationAccount(selectedProvider, integrations?.accounts);
  const connected = Boolean(account && !account.revokedAt);
  const accountUrl = account ? profileIntegrationAccountUrl(account) : undefined;
  const modeOptions = creatorModuleModeOptions(selectedProvider);

  function selectProvider(provider: Extract<ProfileIntegrationProvider, "youtube" | "twitch" | "github">) {
    const nextMode = profileCreatorDefaultDisplayMode(provider);

    onConfigChange({
      ...profileModulePersistentConfig(module.config),
      displayMode: nextMode,
      platform: integrationPlatformFromProvider(provider),
      sourceMode: profileIntegrationSourceMode(provider),
    });
  }

  function selectMode(mode: string, minSize?: ProfileGridModuleSize) {
    onConfigChange({
      ...profileModulePersistentConfig(module.config),
      displayMode: mode,
      platform: integrationPlatformFromProvider(selectedProvider),
      sourceMode: profileIntegrationSourceMode(selectedProvider),
    });

    if (minSize && !profileGridSizeAtLeast(selectedSize, minSize)) {
      onSizeChange(minSize);
    }
  }

  function useConnectedAccount() {
    if (!accountUrl || !account) {
      return;
    }

    setUrl(accountUrl);
    onConfigChange({
      ...profileModulePersistentConfig(module.config),
      displayMode: selectedMode,
      label: account.displayName ?? account.providerHandle ?? integrationProviderLabel(account.provider),
      platform: integrationPlatformFromProvider(account.provider),
      sourceMode: profileIntegrationSourceMode(account.provider),
      url: accountUrl,
    });
  }

  async function resolveUrl() {
    const trimmed = url.trim();

    if (!trimmed) {
      setError("Paste a supported source URL.");
      return;
    }

    setResolving(true);
    setError(undefined);

    try {
      const card = await onResolveIntegration({
        provider: selectedProvider,
        url: trimmed,
      });

      setPreview(card);
      onConfigChange({
        ...profileModulePersistentConfig(module.config),
        displayMode: selectedMode,
        label: card.metadata.title ?? integrationProviderLabel(card.provider),
        platform: integrationPlatformFromProvider(card.provider),
        sourceMode: profileIntegrationSourceMode(card.provider),
        url: card.sourceUrl,
        ...(card.metadata.description
          ? { description: card.metadata.description }
          : {}),
      });
    } catch (metadataError) {
      setError(
        metadataError instanceof Error
          ? metadataError.message
          : "Could not preview that source.",
      );
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="mt-3 space-y-3" data-testid="profile-creator-config">
      <div className="flex flex-wrap gap-1" aria-label="Creator source">
        {creatorModuleProviderOptions.map((option) => (
          <button
            key={option.provider}
            type="button"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-control border border-line bg-canvas/55 px-2 text-xs font-semibold text-muted transition hover:border-line-strong hover:text-text focus-visible:outline-2 focus-visible:outline-focus aria-pressed:bg-accent aria-pressed:text-accent-ink"
            aria-pressed={selectedProvider === option.provider}
            data-testid={`profile-creator-provider-${option.provider}`}
            onClick={() => selectProvider(option.provider)}
          >
            {profileIntegrationIcon(option.provider)}
            <span>{option.label}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1" aria-label="Creator display">
        {modeOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className="rounded-control border border-line bg-canvas/55 px-2 py-1 text-xs font-semibold text-muted transition hover:border-line-strong hover:text-text focus-visible:outline-2 focus-visible:outline-focus aria-pressed:bg-surface aria-pressed:text-text"
            aria-pressed={selectedMode === option.value}
            data-testid={`profile-creator-mode-${option.value}`}
            onClick={() => selectMode(option.value, option.minSize)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {!connected && providerStatus.oauthEnabled ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={integrationBusy === selectedProvider}
          data-testid={`profile-creator-connect-${selectedProvider}`}
          onClick={() => onConnectIntegration(selectedProvider)}
        >
          Connect {integrationProviderLabel(selectedProvider)}
        </Button>
      ) : null}

      {connected && accountUrl ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          data-testid={`profile-creator-use-connected-${selectedProvider}`}
          onClick={useConnectedAccount}
        >
          Use connected account
        </Button>
      ) : null}

      <label className="block text-xs font-semibold uppercase text-muted">
        Source URL
        <div className="mt-1 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            className="h-9 w-full rounded-control border border-line bg-canvas/55 px-2 text-sm font-semibold normal-case text-text focus-visible:outline-2 focus-visible:outline-focus"
            value={url}
            data-testid="profile-creator-url-input"
            onChange={(event) => setUrl(event.target.value)}
            placeholder={creatorModuleUrlPlaceholder(selectedProvider, selectedMode)}
          />
          <Button
            type="button"
            size="sm"
            disabled={resolving}
            data-testid="profile-creator-preview-button"
            onClick={() => void resolveUrl()}
          >
            {resolving ? "Checking" : "Use"}
          </Button>
        </div>
      </label>

      {preview ? (
        <ProfileIntegrationPreviewSummary card={preview} />
      ) : null}
      {error ? (
        <p className="text-xs font-semibold text-rose-ink" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ProfileIntegrationPreviewSummary({
  card,
}: {
  card: ProfileIntegrationCard;
}) {
  return (
    <div
      className="rounded-card border border-line bg-canvas/45 px-3 py-2 text-sm"
      data-testid="profile-integration-preview-summary"
    >
      <p className="truncate font-semibold text-text">
        {card.metadata.title ?? integrationProviderLabel(card.provider)}
      </p>
      <p className="truncate text-xs text-muted">
        {integrationProviderLabel(card.provider)}
        {card.resourceType ? ` · ${card.resourceType}` : ""}
      </p>
    </div>
  );
}

function ProfileCanvasBackgroundControls({
  backgroundBlur,
  onBackgroundBlurChange,
  onClear,
  onImageUpload,
  onVideoUpload,
  profile,
  uploading,
}: {
  backgroundBlur: ProfileBackgroundBlur;
  onBackgroundBlurChange: (blur: ProfileBackgroundBlur) => void;
  onClear: () => void;
  onImageUpload: (file: File) => void;
  onVideoUpload: (file: File) => void;
  profile: Profile;
  uploading?: "backgroundImage" | "backgroundVideo" | "avatar" | "banner" | undefined;
}) {
  const [open, setOpen] = useState(false);
  const hasBackground = Boolean(profile.profileBackground || profile.profileBackgroundVideo);
  const backgroundState = profile.profileBackgroundVideo
    ? "Video"
    : profile.profileBackground
      ? "Image"
      : "None";

  return (
    <div
      className="relative"
      data-testid="profile-canvas-background-controls"
    >
      <button
        type="button"
        className="flex min-h-11 w-full items-center gap-3 rounded-control border border-line bg-canvas/50 px-3 text-left transition duration-fluid ease-fluid hover:border-line-strong hover:bg-canvas/70 focus-visible:outline-2 focus-visible:outline-focus"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-profile-edit-control="true"
        data-testid="profile-canvas-background-trigger"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-card border border-line bg-surface/70 text-text">
          <ImagePlus aria-hidden="true" size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-text">
            Background
          </span>
          <span className="block truncate text-xs text-muted">
            {backgroundState} · {blurLabel(backgroundBlur)}
          </span>
        </span>
      </button>

      {open ? (
        <div
          className="absolute left-0 right-0 top-full z-20 mt-2 rounded-card border border-line bg-surface/95 p-3 shadow-lift backdrop-blur-veil"
          role="dialog"
          aria-label="Background settings"
          data-testid="profile-canvas-background-popover"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text">Background</p>
              <p className="text-xs text-muted">Media and clarity</p>
            </div>
            <button
              type="button"
              className="grid size-8 shrink-0 place-items-center rounded-control border border-line bg-canvas/55 text-muted hover:text-text focus-visible:outline-2 focus-visible:outline-focus"
              aria-label="Close background settings"
              data-profile-edit-control="true"
              onClick={() => setOpen(false)}
            >
              <X aria-hidden="true" size={15} />
            </button>
          </div>
          <div className="mt-3 grid gap-2">
            <label
              className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-control border border-line bg-surface/68 px-3 text-sm font-semibold text-text transition duration-fluid ease-fluid hover:border-line-strong focus-within:outline-2 focus-within:outline-focus"
              data-profile-edit-control="true"
            >
              <ImagePlus aria-hidden="true" size={16} />
              {uploading === "backgroundImage" ? "Uploading image" : "Choose image"}
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                data-testid="profile-background-image-input"
                disabled={Boolean(uploading)}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];

                  if (file) {
                    onImageUpload(file);
                    setOpen(false);
                  }

                  event.currentTarget.value = "";
                }}
              />
            </label>
            <label
              className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-control border border-line bg-surface/68 px-3 text-sm font-semibold text-text transition duration-fluid ease-fluid hover:border-line-strong focus-within:outline-2 focus-within:outline-focus"
              data-profile-edit-control="true"
            >
              <Video aria-hidden="true" size={16} />
              {uploading === "backgroundVideo" ? "Uploading video" : "Choose video"}
              <input
                className="sr-only"
                type="file"
                accept="video/mp4,video/webm"
                data-testid="profile-background-video-input"
                disabled={Boolean(uploading)}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];

                  if (file) {
                    onVideoUpload(file);
                    setOpen(false);
                  }

                  event.currentTarget.value = "";
                }}
              />
            </label>
            <button
              type="button"
              className="min-h-10 rounded-control border border-line bg-canvas/55 px-3 text-sm font-semibold text-muted transition duration-fluid ease-fluid hover:border-line-strong hover:text-text focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50"
              data-profile-edit-control="true"
              disabled={!hasBackground || Boolean(uploading)}
              onClick={() => {
                onClear();
                setOpen(false);
              }}
            >
              Clear background
            </button>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase text-muted">
                Background clarity
              </p>
              <span className="text-xs text-muted">{blurLabel(backgroundBlur)}</span>
            </div>
            <div
              className="mt-2 grid grid-cols-4 gap-1 rounded-control border border-line bg-canvas/50 p-1"
              aria-label="Background blur"
            >
              {(["none", "soft", "medium", "heavy"] as const).map((blur) => (
                <button
                  key={blur}
                  type="button"
                  className="rounded-control px-2 py-1.5 text-xs font-semibold text-muted transition duration-fluid ease-fluid hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-focus aria-pressed:bg-surface aria-pressed:text-text"
                  aria-pressed={backgroundBlur === blur}
                  data-profile-edit-control="true"
                  data-testid={`profile-background-blur-${blur}`}
                  onClick={() => {
                    onBackgroundBlurChange(blur);
                    setOpen(false);
                  }}
                >
                  {blurLabel(blur)}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProfileDockModuleCard({
  actionLabel,
  active,
  disabled,
  icon,
  meta,
  onAction,
  testId,
  title,
}: {
  actionLabel: string;
  active?: boolean;
  disabled?: boolean;
  icon: ReactNode;
  meta: string;
  onAction: () => void;
  testId: string;
  title: string;
}) {
  return (
    <article
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-card border bg-canvas/48 p-2.5 transition duration-fluid ease-fluid",
        active ? "border-line-strong bg-surface/70" : "border-line",
      )}
      data-testid={testId}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-card border border-line bg-surface/78 text-text">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-text">{title}</h3>
        <p className="truncate text-xs text-muted">{meta}</p>
      </div>
      <button
        type="button"
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-control border border-line bg-surface/70 px-2.5 text-xs font-semibold text-text transition duration-fluid ease-fluid hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-55"
        disabled={disabled}
        onClick={onAction}
      >
        {actionLabel === "Restore" ? (
          <Undo2 aria-hidden="true" size={14} />
        ) : actionLabel === "On canvas" ? (
          <Eye aria-hidden="true" size={14} />
        ) : (
          <Plus aria-hidden="true" size={14} />
        )}
        {actionLabel}
      </button>
    </article>
  );
}

function profileCanvasAddEntryLabel(entry: ProfileCanvasAddEntry): string {
  return profileCanvasAddEntries.find((item) => item.value === entry)?.label ?? "Module";
}

function profileCanvasEntryPurpose(entry: ProfileCanvasAddEntry): string {
  return matchProfileCanvasEntry(entry, {
    about: "A compact intro, mood, or current focus.",
    activity: "Recent public posts, replies, and rooms.",
    creator_live: "A creator channel, stream, or public project link.",
    custom_text: "A short plain-text note with an optional link.",
    featured_badges: "Earned badges worth showing at a glance.",
    featured_post: "Pin one eligible post without moving the post itself.",
    featured_room: "Pin one eligible room without changing the room.",
    gallery_media: "Uploaded profile media in a restrained preview.",
    github_project: "A public repository card.",
    links: "A concise set of links or connections.",
    music: "Spotify, Apple Music, or another music link card.",
  });
}

function profileCanvasEntryIcon(entry: ProfileCanvasAddEntry): ReactNode {
  return matchProfileCanvasEntry(entry, {
    about: <Sparkles aria-hidden="true" size={20} />,
    activity: <Repeat2 aria-hidden="true" size={20} />,
    creator_live: <Radio aria-hidden="true" size={20} />,
    custom_text: <FileTextIcon />,
    featured_badges: <BadgeCheck aria-hidden="true" size={20} />,
    featured_post: <Star aria-hidden="true" size={20} />,
    featured_room: <Users aria-hidden="true" size={20} />,
    gallery_media: <Video aria-hidden="true" size={20} />,
    github_project: <Bug aria-hidden="true" size={20} />,
    links: <Link2 aria-hidden="true" size={20} />,
    music: <Music2 aria-hidden="true" size={20} />,
  });
}

function profileCanvasModuleIcon(type: ProfileModuleType): ReactNode {
  if (type === "profile_info") {
    return <UserCheck aria-hidden="true" size={20} />;
  }

  const entry = profileCanvasEntryFromType(type);

  return entry ? profileCanvasEntryIcon(entry) : <Sparkles aria-hidden="true" size={20} />;
}

function profileCanvasEntryFromType(type: ProfileModuleType): ProfileCanvasAddEntry | undefined {
  if (type === "about") {
    return "about";
  }

  if (type === "links") {
    return "links";
  }

  if (type === "featured_badges") {
    return "featured_badges";
  }

  if (type === "featured_post") {
    return "featured_post";
  }

  if (type === "featured_room") {
    return "featured_room";
  }

  if (type === "gallery_media") {
    return "gallery_media";
  }

  if (type === "creator_live") {
    return "creator_live";
  }

  if (type === "music") {
    return "music";
  }

  if (type === "custom_text") {
    return "custom_text";
  }

  if (type === "activity") {
    return "activity";
  }

  return undefined;
}

function profileCanvasEntryActiveModule(
  entry: ProfileCanvasAddEntry,
  modules: ProfileModule[],
): ProfileModule | undefined {
  const type = entry === "github_project" ? "creator_live" : entry;

  if (!profileCanvasEntryIsSingleton(entry)) {
    return undefined;
  }

  return modules.find((module) => module.type === type && module.status === "active");
}

function profileCanvasEntryIsSingleton(entry: ProfileCanvasAddEntry): boolean {
  return entry === "featured_post" || entry === "featured_room" || entry === "activity";
}

function matchProfileCanvasEntry<T>(
  entry: ProfileCanvasAddEntry,
  values: Record<ProfileCanvasAddEntry, T>,
): T {
  return values[entry];
}

function blurLabel(blur: ProfileBackgroundBlur): string {
  return blur === "none" ? "None" : blur[0]!.toUpperCase() + blur.slice(1);
}

function profileIntegrationStatus(
  provider: ProfileIntegrationProvider,
  statuses: ProfileIntegrationProviderStatus[] | undefined,
): ProfileIntegrationProviderStatus {
  return (
    statuses?.find((status) => status.provider === provider) ?? {
      provider,
      configured: false,
      oauthEnabled: false,
      linkSupported: true,
      metadataEnabled: false,
      missingConfigKeys: [],
    }
  );
}

function profileIntegrationAccount(
  provider: ProfileIntegrationProvider,
  accounts: ProfileIntegrationAccount[] | undefined,
): ProfileIntegrationAccount | undefined {
  return accounts?.find((account) => account.provider === provider);
}

function integrationProviderLabel(provider: ProfileIntegrationProvider): string {
  if (provider === "apple_music") {
    return "Apple Music";
  }

  if (provider === "youtube") {
    return "YouTube";
  }

  if (provider === "github") {
    return "GitHub";
  }

  return provider[0]!.toUpperCase() + provider.slice(1);
}

function integrationPlatformFromProvider(
  provider: ProfileIntegrationProvider | undefined,
): string {
  return provider ?? "website";
}

function profileCanvasIntegrationModuleType(
  provider: ProfileIntegrationProvider,
): Extract<ProfileModuleType, "creator_live" | "music"> {
  return provider === "spotify" || provider === "apple_music" ? "music" : "creator_live";
}

function profileCanvasModuleInputFromProvider(
  provider: ProfileIntegrationProvider,
  account: ProfileIntegrationAccount | undefined,
): CreateProfileModuleInput {
  const type = profileCanvasIntegrationModuleType(provider);
  const url =
    type === "creator_live" && account
      ? profileIntegrationAccountUrl(account)
      : undefined;
  const label =
    account?.displayName ||
    account?.providerHandle ||
    integrationProviderLabel(provider);

  return {
    type,
    title: null,
    visibility: "public",
    status: "active",
    config: {
      platform: integrationPlatformFromProvider(provider),
      sourceMode: profileIntegrationSourceMode(provider),
      ...(type === "music" ? { displayMode: "embed" } : {}),
      ...(type === "creator_live"
        ? { displayMode: profileCreatorDefaultDisplayMode(provider) }
        : {}),
      ...(label ? { label } : {}),
      ...(url ? { url } : {}),
    },
  };
}

function profileIntegrationSourceMode(provider: ProfileIntegrationProvider): string {
  if (provider === "apple_music") {
    return "apple_music";
  }

  return provider;
}

function profileCreatorDefaultDisplayMode(provider: ProfileIntegrationProvider): string {
  if (provider === "twitch") {
    return "stream_status";
  }

  if (provider === "youtube") {
    return "latest_video";
  }

  if (provider === "github") {
    return "project";
  }

  return "link";
}

function profileIntegrationAccountUrl(
  account: ProfileIntegrationAccount,
): string | undefined {
  const handle = account.providerHandle?.replace(/^@/, "").trim();
  const accountId = account.providerAccountId.trim();

  if (account.provider === "spotify" && accountId) {
    return `https://open.spotify.com/user/${encodeURIComponent(accountId)}`;
  }

  if (account.provider === "twitch" && handle) {
    return `https://www.twitch.tv/${encodeURIComponent(handle)}`;
  }

  if (account.provider === "youtube") {
    if (account.providerHandle?.startsWith("@")) {
      return `https://www.youtube.com/${account.providerHandle}`;
    }

    if (accountId) {
      return `https://www.youtube.com/channel/${encodeURIComponent(accountId)}`;
    }
  }

  if (account.provider === "github" && handle) {
    return `https://github.com/${encodeURIComponent(handle)}`;
  }

  return undefined;
}

function profileIntegrationStatusText(status: ProfileIntegrationProviderStatus): string {
  if (status.oauthEnabled) {
    return "Ready to connect";
  }

  if (status.provider === "apple_music") {
    return "OAuth not available";
  }

  if ((status.missingConfigKeys ?? []).length > 0) {
    return "OAuth setup needed";
  }

  if (status.metadataEnabled) {
    return "Metadata only";
  }

  return "OAuth unavailable";
}

function profileIntegrationIcon(provider: ProfileIntegrationProvider): ReactNode {
  const className = "shrink-0";

  if (provider === "spotify") {
    return <SiSpotify aria-hidden="true" className={className} size={20} />;
  }

  if (provider === "apple_music") {
    return <SiApplemusic aria-hidden="true" className={className} size={20} />;
  }

  if (provider === "youtube") {
    return <SiYoutube aria-hidden="true" className={className} size={20} />;
  }

  if (provider === "twitch") {
    return <SiTwitch aria-hidden="true" className={className} size={20} />;
  }

  return <SiGithub aria-hidden="true" className={className} size={20} />;
}

const musicModuleProviderOptions: {
  label: string;
  provider: Extract<ProfileIntegrationProvider, "spotify" | "apple_music" | "youtube">;
}[] = [
  { label: "Spotify", provider: "spotify" },
  { label: "Apple Music", provider: "apple_music" },
  { label: "YouTube", provider: "youtube" },
];

const creatorModuleProviderOptions: {
  label: string;
  provider: Extract<ProfileIntegrationProvider, "youtube" | "twitch" | "github">;
}[] = [
  { label: "Twitch", provider: "twitch" },
  { label: "YouTube", provider: "youtube" },
  { label: "GitHub", provider: "github" },
];

function profileMusicProviderFromConfig(
  config: ProfileModuleConfig,
): Extract<ProfileIntegrationProvider, "spotify" | "apple_music" | "youtube"> {
  if (config.platform === "apple_music") {
    return "apple_music";
  }

  if (config.platform === "youtube" || config.platform === "youtube_music") {
    return "youtube";
  }

  return "spotify";
}

function profileCreatorProviderFromConfig(
  config: ProfileModuleConfig,
): Extract<ProfileIntegrationProvider, "youtube" | "twitch" | "github"> {
  if (config.platform === "youtube") {
    return "youtube";
  }

  if (config.platform === "github") {
    return "github";
  }

  return "twitch";
}

function profileMusicPlatformFromProvider(
  provider: ProfileIntegrationProvider,
): string {
  if (provider === "youtube") {
    return "youtube_music";
  }

  return provider;
}

function profileMusicSourceModeFromProvider(
  provider: ProfileIntegrationProvider,
): string {
  if (provider === "youtube") {
    return "youtube_music";
  }

  return profileIntegrationSourceMode(provider);
}

function creatorModuleModeOptions(
  provider: Extract<ProfileIntegrationProvider, "youtube" | "twitch" | "github">,
): { label: string; minSize?: ProfileGridModuleSize; value: string }[] {
  if (provider === "twitch") {
    return [
      { label: "Status", minSize: "1x1", value: "stream_status" },
      { label: "Stream", minSize: "3x2", value: "stream" },
      { label: "Stream + chat", minSize: "4x3", value: "stream_chat" },
    ];
  }

  if (provider === "youtube") {
    return [
      { label: "Latest upload", minSize: "2x1", value: "latest_video" },
      { label: "Video", minSize: "3x2", value: "video" },
      { label: "Playlist", minSize: "3x2", value: "playlist" },
    ];
  }

  return [{ label: "Project", minSize: "2x1", value: "project" }];
}

function profileGridSizeAtLeast(
  currentSize: ProfileGridModuleSize,
  minimumSize: ProfileGridModuleSize,
): boolean {
  const current = profileGridModuleSizeSpan(currentSize);
  const minimum = profileGridModuleSizeSpan(minimumSize);

  return current.columns >= minimum.columns && current.rows >= minimum.rows;
}

function musicModuleUrlPlaceholder(
  provider: Extract<ProfileIntegrationProvider, "spotify" | "apple_music" | "youtube">,
): string {
  if (provider === "apple_music") {
    return "https://music.apple.com/...";
  }

  if (provider === "youtube") {
    return "https://music.youtube.com/...";
  }

  return "https://open.spotify.com/...";
}

function creatorModuleUrlPlaceholder(
  provider: Extract<ProfileIntegrationProvider, "youtube" | "twitch" | "github">,
  mode: string,
): string {
  if (provider === "youtube" && mode === "playlist") {
    return "https://www.youtube.com/playlist?list=...";
  }

  if (provider === "youtube") {
    return "https://www.youtube.com/watch?v=...";
  }

  if (provider === "github") {
    return "https://github.com/owner/repo";
  }

  return "https://www.twitch.tv/channel";
}

function FileTextIcon() {
  return (
    <span className="grid size-5 place-items-center text-[0.68rem] font-bold">
      T
    </span>
  );
}

function profileModulePersistentConfig(
  config: ProfileModuleConfig,
): ProfileModuleConfig {
  const persistentConfig = { ...config };

  delete persistentConfig.integration;

  return persistentConfig;
}

function clampProfileModuleLayout(layout: ProfileModuleLayout): ProfileModuleLayout {
  const colSpan = Math.max(1, Math.min(PROFILE_CANVAS_COLUMNS, layout.colSpan));
  const rowSpan = Math.max(1, Math.min(6, layout.rowSpan));

  return {
    column: Math.max(
      1,
      Math.min(PROFILE_CANVAS_COLUMNS - colSpan + 1, layout.column),
    ),
    row: Math.max(1, Math.min(PROFILE_CANVAS_ROWS - rowSpan + 1, layout.row)),
    colSpan,
    rowSpan,
  };
}

function mergeProfileFeed(posts: Post[], reblogs: Post[]): Post[] {
  const seen = new Set<number>();
  const feed: Post[] = [];

  for (const post of [...posts, ...reblogs]) {
    if (seen.has(post.id)) {
      continue;
    }

    seen.add(post.id);
    feed.push(post);
  }

  return feed;
}

function mergeFollowState(
  profile: Profile | undefined,
  followState: FollowRelationship | undefined,
): Profile | undefined {
  if (!profile || !followState) {
    return profile;
  }

  const mootCount = followState.mootCount ?? profile.mootCount;

  return {
    ...profile,
    followerCount: followState.followerCount,
    followingCount: followState.followingCount,
    mootCount,
    isFollowing: followState.isFollowing,
    isFollowedBy: followState.isFollowedBy,
    isMoot: followState.isMoot,
    blockedByMe: followState.blockedByMe ?? profile.blockedByMe ?? false,
    mutedByMe: followState.mutedByMe ?? profile.mutedByMe ?? false,
    stats: {
      ...profile.stats,
      followers: followState.followerCount,
      following: followState.followingCount,
      moots: mootCount,
    },
  };
}

function ProfilePersonalBackdrop({ profile }: { profile: Profile }) {
  const videoUrl = safeProfileVideoUrl(profile.profileBackgroundVideo);
  const imageUrl = safeProfileImageUrl(
    profile.profileBackgroundVideoPoster ?? profile.profileBackground,
  );
  const blurTreatment = profile.profileBackgroundBlur;
  const visibility = profileBackgroundVisibility(blurTreatment);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-[-1.25rem] bottom-[-2rem] z-0 min-h-dvh w-screen -translate-x-1/2 overflow-hidden sm:top-[-1.5rem]"
      data-profile-background-blur={blurTreatment}
      data-profile-background-source={videoUrl ? "video" : imageUrl ? "image" : "fallback"}
      data-profile-background-visibility={visibility.name}
      data-testid="profile-personal-backdrop"
    >
      {videoUrl ? (
        <video
          aria-hidden="true"
          className={cn(
            "absolute inset-0 size-full scale-105 object-cover saturate-[1.04] motion-reduce:hidden",
            visibility.mediaOpacity,
            profileBackgroundBlurClass(blurTreatment),
          )}
          autoPlay
          loop
          muted
          playsInline
          poster={imageUrl}
          preload="metadata"
        >
          <source src={videoUrl} type={videoUrl.endsWith(".webm") ? "video/webm" : "video/mp4"} />
        </video>
      ) : null}
      {imageUrl ? (
        <img
          alt=""
          className={cn(
            "absolute inset-0 size-full scale-105 object-cover saturate-[1.04]",
            visibility.mediaOpacity,
            videoUrl ? "motion-safe:hidden" : undefined,
            profileBackgroundBlurClass(blurTreatment),
          )}
          decoding="async"
          src={imageUrl}
        />
      ) : (
        <div className="absolute inset-0 bg-page-wash" />
      )}
      <div className={cn("absolute inset-0", visibility.baseOverlay)} />
      <div className={cn("absolute inset-0 bg-gradient-to-b", visibility.verticalOverlay)} />
      <div className={cn("absolute inset-0 bg-gradient-to-r via-transparent", visibility.sideVignette)} />
    </div>
  );
}

function safeProfileVideoUrl(value: string | null | undefined): string | undefined {
  return typeof value === "string" &&
    /^\/uploads\/media\/[0-9]{4}\/[0-9]{2}\/profile_background-[a-z0-9_-]+\.(?:mp4|webm)$/.test(
      value,
    )
    ? value
    : undefined;
}

function profileBackgroundBlurClass(
  treatment: ProfileBackgroundBlur,
): string {
  if (treatment === "soft") {
    return "blur-[3px]";
  }

  if (treatment === "heavy") {
    return "blur-[42px]";
  }

  if (treatment === "none") {
    return "";
  }

  return "blur-[18px]";
}

function profileBackgroundVisibility(
  treatment: ProfileBackgroundBlur,
): {
  baseOverlay: string;
  mediaOpacity: string;
  name: "clear" | "soft" | "muted" | "veiled";
  sideVignette: string;
  verticalOverlay: string;
} {
  if (treatment === "none") {
    return {
      baseOverlay: "bg-canvas/10",
      mediaOpacity: "opacity-[0.84]",
      name: "clear",
      sideVignette: "from-surface/18 to-surface/18",
      verticalOverlay: "from-canvas/28 via-canvas/5 to-canvas/42",
    };
  }

  if (treatment === "soft") {
    return {
      baseOverlay: "bg-canvas/18",
      mediaOpacity: "opacity-[0.72]",
      name: "soft",
      sideVignette: "from-surface/28 to-surface/28",
      verticalOverlay: "from-canvas/40 via-canvas/12 to-canvas/54",
    };
  }

  if (treatment === "heavy") {
    return {
      baseOverlay: "bg-canvas/42",
      mediaOpacity: "opacity-[0.46]",
      name: "veiled",
      sideVignette: "from-surface/54 to-surface/54",
      verticalOverlay: "from-canvas/68 via-canvas/40 to-canvas/80",
    };
  }

  return {
    baseOverlay: "bg-canvas/28",
    mediaOpacity: "opacity-[0.6]",
    name: "muted",
    sideVignette: "from-surface/40 to-surface/40",
    verticalOverlay: "from-canvas/52 via-canvas/22 to-canvas/66",
  };
}

type ProfileInfoModuleProps = {
  activeFollowError?: string | undefined;
  activeProfileControlError?: string | undefined;
  activeProfileControlMessage?: string | undefined;
  editing?: boolean | undefined;
  featuredBadges: UserBadge[];
  followPosting: boolean;
  isOwnProfile: boolean;
  onBlockToggle?: (() => Promise<void> | void) | undefined;
  onFollowToggle: () => void;
  onMuteToggle?: (() => Promise<void> | void) | undefined;
  onOpenPanel: (panel: "followers" | "following" | "badges") => void;
  profile: Profile;
  profileControlBusy?: "block" | "mute" | undefined;
  showChatHint: boolean;
  size: ProfileGridModuleSize;
  status: string;
};

function ProfileInfoModule({
  activeFollowError,
  activeProfileControlError,
  activeProfileControlMessage,
  editing = false,
  featuredBadges,
  followPosting,
  isOwnProfile,
  onBlockToggle,
  onFollowToggle,
  onMuteToggle,
  onOpenPanel,
  profile,
  profileControlBusy,
  showChatHint,
  size,
  status,
}: ProfileInfoModuleProps) {
  const span = profileGridModuleSizeSpan(size);
  const showBlankEditPrompt =
    editing && isOwnProfile && profileInfoNeedsEditPrompt(profile);

  return (
    <div
      className="h-full min-w-0"
      data-profile-info-columns={span.columns}
      data-profile-info-rows={span.rows}
      data-testid="profile-module-profile-info"
    >
      {showBlankEditPrompt ? (
        <ProfileInfoBlankEditPrompt />
      ) : (
        <ProfileHeader
          profile={profile}
          featuredBadges={featuredBadges}
          followError={activeFollowError}
          followPosting={followPosting}
          isOwnProfile={isOwnProfile}
          messageToHandle={
            status === "authenticated" &&
            !isOwnProfile &&
            !profile.blockedByMe &&
            profile.isMoot
              ? profile.user.handle
              : undefined
          }
          profileControlBusy={profileControlBusy}
          profileControlError={activeProfileControlError}
          profileControlMessage={activeProfileControlMessage}
          onBlockToggle={onBlockToggle}
          onFollowToggle={onFollowToggle}
          onMuteToggle={onMuteToggle}
          onOpenPanel={onOpenPanel}
          profileInfoColumns={span.columns}
          profileInfoRows={span.rows}
          chrome={editing}
          reportAction={
            !isOwnProfile ? (
              <ReportForm
                targetType="profile"
                targetId={profile.user.id}
                reportedUserId={profile.user.id}
                title="Report profile"
                explainer={`This reports @${profile.user.handle}'s profile to moderators.`}
                triggerClassName="min-h-8 px-2.5 text-xs"
              />
            ) : undefined
          }
          showChatHint={showChatHint}
        />
      )}
    </div>
  );
}

function profileInfoNeedsEditPrompt(profile: Profile): boolean {
  return (
    !safeProfileImageUrl(profile.user.avatarUrl) &&
    !safeProfileImageUrl(profile.bannerUrl) &&
    profile.bio.trim().length === 0 &&
    profile.location.trim().length === 0
  );
}

function ProfileInfoBlankEditPrompt() {
  return (
    <div
      className="grid h-full min-h-0 place-items-center rounded-panel border border-dashed border-line-strong bg-surface/48 p-4 text-center shadow-soft backdrop-blur-veil"
      data-testid="profile-info-edit-prompt"
    >
      <div className="max-w-64">
        <span className="mx-auto grid size-12 place-items-center rounded-card border border-line bg-canvas/70 text-accent-strong">
          <ImagePlus aria-hidden="true" size={22} />
        </span>
        <p className="mt-3 text-base font-semibold text-text">Select to edit profile</p>
        <p className="mt-1 text-sm leading-6 text-muted">
          Add an avatar, banner, bio, or location from this module.
        </p>
      </div>
    </div>
  );
}

function FeaturedPostModuleCard({
  editing = false,
  profile,
  title,
}: {
  editing?: boolean | undefined;
  profile: Profile;
  title: string;
}) {
  const featuredPost = profile.featuredPost;

  return (
    <article
      className={cn(
        "h-full min-w-0 overflow-hidden rounded-card",
        editing
          ? "border border-line bg-surface/58 p-3 shadow-soft backdrop-blur-veil"
          : "border border-transparent bg-transparent p-0 shadow-none",
      )}
      data-testid="profile-module-featured-post"
    >
      {editing ? <h3 className="text-sm font-semibold text-text">{title}</h3> : null}
      {featuredPost ? (
        <div className={editing ? "mt-3" : "h-full min-h-0"}>
          <FeaturedPostCard post={featuredPost} />
        </div>
      ) : (
        <p className="mt-2 text-sm leading-6 text-muted">No featured post.</p>
      )}
    </article>
  );
}

function FeaturedRoomModuleCard({
  editing = false,
  profile,
  title,
}: {
  editing?: boolean | undefined;
  profile: Profile;
  title: string;
}) {
  const featuredRoom = profile.featuredRoom;

  return (
    <article
      className={cn(
        "h-full min-w-0 overflow-hidden rounded-card",
        editing
          ? "border border-line bg-surface/58 p-3 shadow-soft backdrop-blur-veil"
          : "border border-transparent bg-transparent p-0 shadow-none",
      )}
      data-testid="profile-module-featured-room"
    >
      {editing ? <h3 className="text-sm font-semibold text-text">{title}</h3> : null}
      {featuredRoom ? (
        <div className={editing ? "mt-3" : "h-full min-h-0"}>
          <FeaturedRoomCard room={featuredRoom} />
        </div>
      ) : (
        <p className="mt-2 text-sm leading-6 text-muted">No featured room.</p>
      )}
    </article>
  );
}

function FeaturedPostCard({ post }: { post: Post }) {
  return (
    <article
      className="min-w-0 rounded-card border border-line bg-surface/74 p-3 shadow-soft backdrop-blur-veil"
      data-testid="profile-featured-post"
    >
      <div className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase text-muted">
        <Star aria-hidden="true" size={14} className="text-accent-strong" />
        <h3 className="text-xs font-semibold uppercase text-muted">Featured post</h3>
        <span className="text-muted/50">·</span>
        <span>{post.createdAt}</span>
      </div>
      <p className="mt-2 line-clamp-3 break-words text-sm leading-6 text-text">
        {post.body}
      </p>
      {post.mediaUrl && post.mediaUrl !== "/ambient-veil.webp" ? (
        <div
          className="mt-3 overflow-hidden rounded-card border border-line bg-canvas/70"
          data-testid="profile-featured-post-media"
        >
          <img
            alt=""
            className="block max-h-44 w-full object-contain"
            decoding="async"
            loading="lazy"
            src={post.mediaUrl}
            data-testid="profile-featured-post-media-image"
          />
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Reply aria-hidden="true" size={13} />
          {formatCountWithUnit(post.commentCount, "reply")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Heart aria-hidden="true" size={13} />
          {formatCountWithUnit(post.likeCount, "like")}
        </span>
        {post.reblogCount ? (
          <span className="inline-flex items-center gap-1.5">
            <Repeat2 aria-hidden="true" size={13} />
            {formatCountWithUnit(post.reblogCount, "reblog")}
          </span>
        ) : null}
        <Link
          className="inline-flex min-w-0 items-center gap-1.5 rounded-control font-medium text-text underline-offset-4 hover:text-accent-strong hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          to={`/rooms/${post.room.slug}`}
        >
          <Radio aria-hidden="true" size={13} />
          <span className="truncate">{post.room.name}</span>
        </Link>
      </div>
    </article>
  );
}

function FeaturedRoomCard({ room }: { room: Room }) {
  return (
    <Link
      className="group min-w-0 rounded-card border border-line bg-surface/74 p-3 shadow-soft backdrop-blur-veil transition duration-fluid ease-fluid hover:border-line-strong hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      data-testid="profile-featured-room"
      style={{ ["--room-accent" as string]: room.accent }}
      to={`/rooms/${room.slug}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-card border border-line bg-canvas/65"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklab, var(--room-accent) 36%, transparent), var(--app-surface))",
          }}
        >
          {room.iconUrl ? (
            <img alt="" className="size-full object-cover" src={room.iconUrl} />
          ) : (
            <Radio aria-hidden="true" size={17} className="text-text" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase text-muted">
            <Star aria-hidden="true" size={14} className="text-accent-strong" />
            <h3 className="text-xs font-semibold uppercase text-muted">Featured room</h3>
          </div>
          <span className="mt-1 block truncate text-sm font-semibold text-text">
            {room.name}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted">/{room.slug}</span>
          <span className="mt-1 block line-clamp-2 text-sm leading-5 text-muted">
            {room.summary}
          </span>
        </div>
        <ArrowRight
          aria-hidden="true"
          size={16}
          className="mt-1 shrink-0 text-muted transition duration-fluid ease-fluid group-hover:translate-x-0.5 group-hover:text-text"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 pl-[3.25rem] text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <MessageCircle aria-hidden="true" size={13} />
          {formatCountWithUnit(room.postCount, "post")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users aria-hidden="true" size={13} />
          {formatCountWithUnit(room.memberCount, "member")}
        </span>
      </div>
    </Link>
  );
}

type ProfileTabButtonProps = {
  active: boolean;
  comingLater?: boolean;
  count?: number;
  disabled?: boolean;
  label: string;
  onClick: () => void;
};

type ProfileActivityRenderState = {
  error: unknown;
  feed: Post[];
  isOwnProfile: boolean;
  loading: boolean;
  replies: Post[];
  rooms: Room[];
};

function shouldRenderProfileActivityModule({
  error,
  feed,
  isOwnProfile,
  loading,
  replies,
  rooms,
}: ProfileActivityRenderState): boolean {
  return (
    isOwnProfile ||
    loading ||
    Boolean(error) ||
    feed.length > 0 ||
    replies.length > 0 ||
    rooms.length > 0
  );
}

type ProfileActivityModuleProps = {
  activeTab: ProfileTab;
  editing?: boolean | undefined;
  feed: Post[];
  feedError: unknown;
  feedLoading: boolean;
  onTabChange: (tab: ProfileTab) => void;
  profile: Profile;
  replies: Post[];
  repliesError: unknown;
  repliesLoading: boolean;
  rooms: Room[];
  roomsError: unknown;
  roomsLoading: boolean;
  size: ProfileGridModuleSize;
  title: string;
};

function ProfileActivityModule({
  activeTab,
  editing = false,
  feed,
  feedError,
  feedLoading,
  onTabChange,
  profile,
  replies,
  repliesError,
  repliesLoading,
  rooms,
  roomsError,
  roomsLoading,
  size,
  title,
}: ProfileActivityModuleProps) {
  const activityRows = profileGridModuleSizeSpan(size).rows;
  const activityMaxHeight = `calc(${activityRows} * var(--profile-grid-row-size) + ${
    Math.max(0, activityRows - 1)
  } * var(--profile-grid-gap))`;
  const activityStyle = {
    "--profile-activity-row-span": String(activityRows),
    maxHeight: activityMaxHeight,
  } as CSSProperties;

  return (
    <div
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-hidden rounded-card",
        editing
          ? "border border-line bg-surface/58 p-3 shadow-soft backdrop-blur-veil"
          : "border border-line bg-surface/58 p-3 shadow-soft backdrop-blur-veil",
      )}
      data-profile-activity-max-rows={activityRows}
      data-profile-activity-surface={editing ? "editing" : "public"}
      data-testid="profile-module-activity"
      style={activityStyle}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {editing ? <h3 className="text-sm font-semibold text-text">{title}</h3> : null}
        <div
          aria-label="Profile sections"
          className="flex gap-1 overflow-x-auto rounded-control bg-canvas/55 p-1 sm:justify-end"
          role="tablist"
          data-testid="profile-activity-tabs"
        >
          <ProfileTabButton
            active={activeTab === "feed"}
            count={feed.length}
            label="Feed"
            onClick={() => onTabChange("feed")}
          />
          <ProfileTabButton
            active={activeTab === "replies"}
            count={profile.stats.replies}
            label="Replies"
            onClick={() => onTabChange("replies")}
          />
          <ProfileTabButton
            active={activeTab === "rooms"}
            count={profile.stats.rooms}
            label="Rooms"
            onClick={() => onTabChange("rooms")}
          />
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1"
        data-profile-activity-scroll="internal"
        data-testid="profile-activity"
      >
        {activeTab === "feed" ? (
          <ProfilePostList
            emptyCompact
            emptyDescription="No posts."
            emptyIcon={MessageCircle}
            emptyText="No posts yet"
            errorTitle="Profile feed is not available"
            error={feedError}
            items={feed}
            loading={feedLoading}
            loadingText="Loading posts."
            loadingTitle="Loading profile feed"
          />
        ) : null}
        {activeTab === "replies" ? (
          <ProfilePostList
            emptyCompact
            emptyDescription="No replies."
            emptyIcon={Reply}
            emptyText="No replies yet"
            errorTitle="Replies are not available"
            error={repliesError}
            items={replies}
            loading={repliesLoading}
            loadingText="Loading replies."
            loadingTitle="Loading replies"
          />
        ) : null}
        {activeTab === "rooms" ? (
          <ProfileRoomList
            emptyCompact
            error={roomsError}
            loading={roomsLoading}
            rooms={rooms}
          />
        ) : null}
      </div>
    </div>
  );
}

function ProfileTabButton({
  active,
  comingLater = false,
  count,
  disabled = false,
  label,
  onClick,
}: ProfileTabButtonProps) {
  return (
    <button
      aria-selected={active}
      className={cn(
        "inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-control px-3 text-sm font-semibold transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        active
          ? "bg-surface text-text shadow-inner-soft ring-1 ring-line/80"
          : "text-muted hover:bg-surface/70 hover:text-text",
        disabled && "cursor-not-allowed opacity-60 hover:bg-transparent hover:text-muted",
      )}
      disabled={disabled}
      role="tab"
      title={comingLater ? "Coming later" : undefined}
      type="button"
      onClick={onClick}
    >
      {label}
      {comingLater ? (
        <span className="text-xs font-medium text-muted">Coming later</span>
      ) : null}
      {count !== undefined ? (
        <span className="text-xs font-medium text-muted">{count.toLocaleString()}</span>
      ) : null}
    </button>
  );
}

type ProfilePostListProps = {
  emptyCompact?: boolean;
  emptyDescription: string;
  emptyIcon: typeof MessageCircle;
  emptyText: string;
  errorTitle: string;
  error: unknown;
  items: Post[] | undefined;
  loading: boolean;
  loadingText: string;
  loadingTitle: string;
};

function ProfilePostList({
  emptyCompact = false,
  emptyDescription,
  emptyIcon,
  emptyText,
  errorTitle,
  error,
  items,
  loading,
  loadingText,
  loadingTitle,
}: ProfilePostListProps) {
  const posts = items ?? [];

  if (loading) {
    return (
      <ApiStateNotice
        kind="loading"
        title={loadingTitle}
        text={loadingText}
      />
    );
  }

  if (error) {
    return (
      <ApiStateNotice
        kind="error"
        title={errorTitle}
        text="Try refreshing in a moment."
      />
    );
  }

  if (posts.length === 0) {
    if (emptyCompact) {
      return (
        <ProfileCompactEmpty
          icon={emptyIcon}
          title={emptyText}
          text={emptyDescription}
        />
      );
    }

    return <EmptyState icon={emptyIcon} title={emptyText} text={emptyDescription} />;
  }

  return (
    <div className="space-y-4">
      {posts.map((post, index) => (
        <PostCard key={post.id} post={post} index={index} />
      ))}
    </div>
  );
}

function ProfileCompactEmpty({
  icon: Icon,
  text,
  title,
}: {
  icon: typeof MessageCircle;
  text: string;
  title: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-card border border-dashed border-line bg-canvas/45 p-3">
      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-strong text-accent-strong">
        <Icon aria-hidden="true" size={16} />
      </div>
      <div className="min-w-0">
        <h4 className="text-sm font-semibold text-text">{title}</h4>
        <p className="mt-1 text-sm leading-5 text-muted">{text}</p>
      </div>
    </div>
  );
}

type ProfileBadgeListProps = {
  badges: UserBadge[];
  error: unknown;
  featuredBadges: UserBadge[];
  isOwnProfile: boolean;
  loading: boolean;
  onFeaturedChange: (featuredBadgeIds: number[]) => Promise<void>;
};

type ProfileFocusedPanelProps = {
  badges: UserBadge[];
  badgesError: unknown;
  badgesLoading: boolean;
  featuredBadges: UserBadge[];
  handle: string;
  isOwnProfile: boolean;
  panel: ProfilePanel;
  onClose: () => void;
  onFeaturedChange: (featuredBadgeIds: number[]) => Promise<void>;
  onRemoveFollower?: (handle: string, wasMoot: boolean) => Promise<boolean>;
};

function ProfileFocusedPanel({
  badges,
  badgesError,
  badgesLoading,
  featuredBadges,
  handle,
  isOwnProfile,
  onClose,
  onFeaturedChange,
  onRemoveFollower,
  panel,
}: ProfileFocusedPanelProps) {
  const title =
    panel === "followers"
      ? "Followers"
      : panel === "following"
        ? "Following"
        : "Badges";
  const socialLoader = useMemo(
    () => () =>
      panel === "followers"
        ? getProfileFollowers(handle)
        : panel === "following"
          ? getProfileFollowing(handle)
          : Promise.resolve([]),
    [handle, panel],
  );
  const socialState = useAsyncData(socialLoader);
  const showSocial = panel === "followers" || panel === "following";
  const description =
    panel === "badges" && isOwnProfile
      ? "Feature up to four badges on your profile."
      : undefined;

  return (
    <ModalSheet
      open
      onClose={onClose}
      title={title}
      description={description}
      closeLabel="Close panel"
      size="lg"
      mobile="full"
    >
            {showSocial ? (
              <ProfileConnectionList
                error={socialState.error}
                items={socialState.data ?? []}
                loading={socialState.loading}
                {...(
                  panel === "followers" && isOwnProfile && onRemoveFollower
                    ? { onRemoveFollower }
                    : {}
                )}
                title={title}
              />
            ) : (
              <ProfileBadgeList
                badges={badges}
                error={badgesError}
                featuredBadges={featuredBadges}
                isOwnProfile={isOwnProfile}
                loading={badgesLoading}
                onFeaturedChange={onFeaturedChange}
              />
            )}
    </ModalSheet>
  );
}

type ProfileConnectionListProps = {
  error: unknown;
  items: Awaited<ReturnType<typeof getProfileFollowers>>;
  loading: boolean;
  onRemoveFollower?: (handle: string, wasMoot: boolean) => Promise<boolean>;
  title: string;
};

function ProfileConnectionList({
  error,
  items,
  loading,
  onRemoveFollower,
  title,
}: ProfileConnectionListProps) {
  const [removedHandles, setRemovedHandles] = useState<Set<string>>(() => new Set());
  const [confirmingHandle, setConfirmingHandle] = useState<string | undefined>();
  const [pendingHandle, setPendingHandle] = useState<string | undefined>();
  const [removeError, setRemoveError] = useState<string | undefined>();
  const visibleItems = items.filter((item) => !removedHandles.has(item.handle));

  async function handleRemove(connection: (typeof items)[number]) {
    if (!onRemoveFollower) {
      return;
    }

    setPendingHandle(connection.handle);
    setRemoveError(undefined);

    try {
      const removed = await onRemoveFollower(connection.handle, connection.isMoot);

      if (removed) {
        setRemovedHandles((current) => new Set(current).add(connection.handle));
        setConfirmingHandle(undefined);
      } else {
        setRemoveError(`@${connection.handle} was not in your followers.`);
      }
    } catch (error) {
      setRemoveError(
        error instanceof Error ? error.message : "Could not remove this follower.",
      );
    } finally {
      setPendingHandle(undefined);
    }
  }

  if (loading) {
    return (
      <ApiStateNotice
        kind="loading"
        title={`Loading ${title.toLowerCase()}`}
        text="Loading."
      />
    );
  }

  if (error) {
    return (
      <ApiStateNotice
        kind="error"
        title={`${title} are not available`}
        text="Try refreshing in a moment."
      />
    );
  }

  if (visibleItems.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={`No ${title.toLowerCase()} yet`}
        text={emptyProfileConnectionText(title)}
      />
    );
  }

  return (
    <div className="space-y-3">
      {removeError ? (
        <p className="rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink">
          {removeError}
        </p>
      ) : null}
      {visibleItems.map((connection) => (
        <div
          key={connection.handle}
          className="rounded-card border border-line bg-canvas/45 p-3 transition duration-fluid hover:border-line-strong"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <UserIdentityLink
              user={{ ...connection, aura: "frost" }}
              avatarSize="md"
              avatarClassName="size-11"
              className="flex-1"
            />
            <div className="flex flex-wrap items-center justify-end gap-2">
              {connection.isMoot ? (
                <Badge tone="warm">Moot</Badge>
              ) : connection.isFollowing ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
                  <UserCheck aria-hidden="true" size={14} />
                  Following
                </span>
              ) : null}
              {onRemoveFollower ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pendingHandle !== undefined}
                  onClick={() => {
                    setRemoveError(undefined);
                    setConfirmingHandle(connection.handle);
                  }}
                >
                  Remove follower
                </Button>
              ) : null}
            </div>
          </div>
          {confirmingHandle === connection.handle ? (
            <div className="mt-3 rounded-card border border-line bg-surface p-3">
              <p className="text-sm leading-6 text-muted">
                Remove @{connection.handle} as a follower? They can follow you again unless you block them.
              </p>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pendingHandle !== undefined}
                  onClick={() => setConfirmingHandle(undefined)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pendingHandle !== undefined}
                  onClick={() => void handleRemove(connection)}
                >
                  {pendingHandle === connection.handle ? "Removing" : "Remove follower"}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ProfileBadgeList({
  badges,
  error,
  featuredBadges,
  isOwnProfile,
  loading,
  onFeaturedChange,
}: ProfileBadgeListProps) {
  const [pendingBadgeId, setPendingBadgeId] = useState<number | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const featuredIds = featuredBadges.map((userBadge) => userBadge.badge.id);
  const featuredIdSet = new Set(featuredIds);

  async function handleFeatureToggle(userBadge: UserBadge) {
    const badgeId = userBadge.badge.id;
    const nextIds = featuredIdSet.has(badgeId)
      ? featuredIds.filter((id) => id !== badgeId)
      : [...featuredIds, badgeId];

    setPendingBadgeId(userBadge.id);
    setErrorMessage(undefined);

    try {
      await onFeaturedChange(nextIds);
    } catch (caught) {
      setErrorMessage(
        caught instanceof Error ? caught.message : "Featured badges could not be saved.",
      );
    } finally {
      setPendingBadgeId(undefined);
    }
  }

  if (loading) {
    return (
      <ApiStateNotice
        kind="loading"
        title="Loading badges"
        text="Loading badges."
      />
    );
  }

  if (error) {
    return (
      <ApiStateNotice
        kind="error"
        title="Badges are not available"
        text="Try refreshing in a moment."
      />
    );
  }

  if (badges.length === 0) {
    return (
      <EmptyState
        icon={Award}
        title="No badges yet"
        text="No earned badges."
      />
    );
  }

  return (
    <div className="space-y-4">
      {errorMessage ? (
        <p className="rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink">
          {errorMessage}
        </p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {badges.map((userBadge) => {
          const isFeatured = featuredIdSet.has(userBadge.badge.id);
          const featureLimitReached = featuredIds.length >= 4 && !isFeatured;

          return (
            <ProfileBadgeCard
              key={userBadge.id}
              userBadge={userBadge}
              featured={isFeatured}
              featureDisabled={featureLimitReached || pendingBadgeId !== undefined}
              isOwnProfile={isOwnProfile}
              pending={pendingBadgeId === userBadge.id}
              onFeatureToggle={() => void handleFeatureToggle(userBadge)}
            />
          );
        })}
      </div>
    </div>
  );
}

function emptyProfileConnectionText(title: string): string {
  if (title === "Followers") {
    return "No followers.";
  }

  if (title === "Following") {
    return "Not following anyone.";
  }

  return "No connections.";
}

type ProfileBadgeCardProps = {
  userBadge: UserBadge;
  featured: boolean;
  featureDisabled: boolean;
  isOwnProfile: boolean;
  pending: boolean;
  onFeatureToggle: () => void;
};

function ProfileBadgeCard({
  featureDisabled,
  featured,
  isOwnProfile,
  onFeatureToggle,
  pending,
  userBadge,
}: ProfileBadgeCardProps) {
  const badge = userBadge.badge;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-card border bg-surface p-4 shadow-soft",
        rarityBorderClass(badge.rarity),
      )}
    >
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1",
          rarityStripeClass(badge.rarity),
        )}
      />
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-card border",
            rarityIconClass(badge.rarity),
          )}
        >
          {badgeIconElement(badge)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-text">{badge.name}</h3>
            <Badge tone={badgeTone(badge.rarity)}>{rarityLabel(badge.rarity)}</Badge>
            {featured ? <Badge tone="warm">Featured</Badge> : null}
          </div>
          <p className="mt-1 text-xs text-muted">
            Earned {formatBadgeDate(userBadge.earnedAt)}
          </p>
        </div>
      </div>
      {badge.description ? (
        <p className="mt-4 text-sm leading-6 text-muted">{badge.description}</p>
      ) : null}
      {userBadge.reason ? (
        <p className="mt-3 rounded-card border border-line bg-canvas/45 p-3 text-sm leading-6 text-text">
          <span className="font-semibold">Reason</span>: {userBadge.reason}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase text-muted">
          {sourceLabel(badge.source)}
        </span>
        {isOwnProfile ? (
          <Button
            type="button"
            variant={featured ? "secondary" : "ghost"}
            size="sm"
            disabled={featureDisabled}
            icon={<Star aria-hidden="true" size={15} />}
            onClick={onFeatureToggle}
          >
            {pending ? "Saving" : featured ? "Unfeature" : "Feature"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

type ProfileRoomListProps = {
  emptyCompact?: boolean;
  error: unknown;
  loading: boolean;
  rooms: Awaited<ReturnType<typeof getProfileRooms>>;
};

function ProfileRoomList({
  emptyCompact = false,
  error,
  loading,
  rooms,
}: ProfileRoomListProps) {
  if (loading) {
    return (
      <ApiStateNotice
        kind="loading"
        title="Loading rooms"
        text="Loading rooms."
      />
    );
  }

  if (error) {
    return (
      <ApiStateNotice
        kind="error"
        title="Rooms are not available"
        text="Try refreshing in a moment."
      />
    );
  }

  if (rooms.length === 0) {
    if (emptyCompact) {
      return (
        <ProfileCompactEmpty
          icon={Radio}
          title="No rooms yet"
          text="No rooms."
        />
      );
    }

    return (
      <EmptyState
        icon={Radio}
        title="No rooms yet"
        text="No rooms."
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {rooms.map((room, index) => (
        <RoomCard key={room.slug} room={room} index={index} />
      ))}
    </div>
  );
}

type BadgeTone = "default" | "warm" | "cool" | "leaf" | "rose";

function badgeIconElement(badge: BadgeDefinition) {
  if (badge.icon === "bug") {
    return <Bug aria-hidden="true" size={22} />;
  }

  if (badge.icon === "calendar-days") {
    return <CalendarDays aria-hidden="true" size={22} />;
  }

  if (badge.icon === "radio") {
    return <Radio aria-hidden="true" size={22} />;
  }

  if (badge.icon === "shield") {
    return <Shield aria-hidden="true" size={22} />;
  }

  if (badge.icon === "sparkles") {
    return <Sparkles aria-hidden="true" size={22} />;
  }

  if (badge.icon === "users") {
    return <Users aria-hidden="true" size={22} />;
  }

  return <Award aria-hidden="true" size={22} />;
}

function badgeTone(rarity: BadgeDefinition["rarity"]): BadgeTone {
  const tones: Record<BadgeDefinition["rarity"], BadgeTone> = {
    common: "default",
    rare: "cool",
    epic: "rose",
    legendary: "warm",
    founder: "leaf",
  };

  return tones[rarity];
}

function rarityLabel(rarity: BadgeDefinition["rarity"]): string {
  const labels: Record<BadgeDefinition["rarity"], string> = {
    common: "Common",
    rare: "Rare",
    epic: "Epic",
    legendary: "Legendary",
    founder: "Founder",
  };

  return labels[rarity];
}

function rarityBorderClass(rarity: BadgeDefinition["rarity"]): string {
  const classes: Record<BadgeDefinition["rarity"], string> = {
    common: "border-line",
    rare: "border-cool/30",
    epic: "border-rose/30",
    legendary: "border-warm/35",
    founder: "border-accent/40",
  };

  return classes[rarity];
}

function rarityStripeClass(rarity: BadgeDefinition["rarity"]): string {
  const classes: Record<BadgeDefinition["rarity"], string> = {
    common: "bg-line-strong",
    rare: "bg-cool",
    epic: "bg-rose",
    legendary: "bg-warm",
    founder: "bg-accent",
  };

  return classes[rarity];
}

function rarityIconClass(rarity: BadgeDefinition["rarity"]): string {
  const classes: Record<BadgeDefinition["rarity"], string> = {
    common: "border-line bg-canvas/60 text-muted",
    rare: "border-cool/30 bg-cool/15 text-cool-ink",
    epic: "border-rose/30 bg-rose/15 text-rose-ink",
    legendary: "border-warm/35 bg-warm/20 text-warm-ink",
    founder: "border-accent/40 bg-accent/15 text-accent-strong",
  };

  return classes[rarity];
}

function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    "admin-granted": "Admin granted",
    system: "System",
    "room-earned": "Room earned",
    event: "Event",
    social: "Social",
  };

  return labels[source] ?? source;
}

function formatBadgeDate(value: string): string {
  return formatShortDate(value);
}
