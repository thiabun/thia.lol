import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Award,
  Bug,
  CalendarDays,
  Check,
  FolderGit2,
  Heart,
  ImagePlus,
  Info,
  MessageCircle,
  Minus,
  MoreHorizontal,
  Music2,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Radio,
  Repeat2,
  Reply,
  Save,
  Settings2,
  Shield,
  Share2,
  Sparkles,
  Star,
  Trash2,
  Upload,
  VolumeX,
  X,
  UserCheck,
  Users,
  Video,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router";
import { createPortal } from "react-dom";
import type { AppShellOutletContext } from "../components/layout/AppShell";
import { PageMeta } from "../components/PageMeta";
import { MarkdownEditor } from "../components/social/MarkdownEditor";
import { MentionTextarea } from "../components/social/MentionTextarea";
import {
  ProfileConnectionIcon,
  type ProfileConnectionIconPlatform,
} from "../components/social/ProfileConnectionIcon";
import { PostCard } from "../components/social/PostCard";
import { ProfileGrid, ProfileGridModule } from "../components/social/ProfileGrid";
import {
  ProfileModulesSection,
  type ProfileMusicAutoplayRequest,
} from "../components/social/ProfileModules";
import { ProfileShareModal } from "../components/social/ProfileShareModal";
import { ReportForm } from "../components/social/ReportForm";
import { RichText } from "../components/social/RichText";
import { RoomCard } from "../components/social/RoomCard";
import { ThemeAppearanceControl } from "../components/social/ThemeAppearanceControl";
import { UserIdentityLink } from "../components/social/UserProfileLink";
import { ApiStateNotice } from "../components/ui/ApiStateNotice";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button, ButtonLink } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { ImageCropModal } from "../components/ui/ImageCropModal";
import { ModalSheet } from "../components/ui/ModalSheet";
import { Panel } from "../components/ui/Panel";
import {
  blockProfile,
  followProfile,
  getProfile,
  getProfileBadges,
  getProfileFollowers,
  getProfileFollowing,
  getMyProfileIntegrations,
  getProfileModules,
  getProfilePosts,
  getProfileReblogs,
  getProfileReplies,
  getProfileRooms,
  getProfileCanvasDraft,
  muteProfile,
  previewImageUpload,
  removeProfileFollower,
  resolveProfileIntegrationMetadata,
  startProfileIntegration,
  starProfile,
  unblockProfile,
  unfollowProfile,
  unmuteProfile,
  unstarProfile,
  commitProfileCanvasDraft,
  discardProfileCanvasDraft,
  updateProfileCanvas,
  updateProfileCanvasDraft,
  updateOnboardingState,
  updateFeaturedBadges,
  updateMyProfile,
  uploadAudio,
  uploadImage,
  uploadVideo,
  type UploadedAudio,
  type UploadedVideo,
  type FollowRelationship,
  type ImageUploadPurpose,
  type ProfileCanvasDraftState,
  type ProfileIntegrationAccount,
  type ProfileIntegrationProvider,
  type ProfileIntegrationProviderStatus,
  type UpdateProfileInput,
} from "../lib/api";
import { ApiClientError } from "../lib/apiClient";
import { cn } from "../lib/classNames";
import { formatShortDate } from "../lib/dates";
import { prepareImageFileForCrop, validateImageCropFile } from "../lib/imageCrop";
import {
  imageUploadAccept,
  isAcceptedVideoUploadFile,
  videoUploadAccept,
  videoUploadFormatHelp,
} from "../lib/mediaFormats";
import { pageEntrance } from "../lib/motionPresets";
import { formatCountWithUnit } from "../lib/pluralize";
import { postMediaType } from "../lib/postMedia";
import {
  connectionPlatformLabel,
  maxProfileConnections,
  profileConnectionPlatforms,
  validateProfileConnectionDraft,
} from "../lib/profileConnections";
import { defaultProfileLayoutPreset } from "../lib/profileLayoutPresets";
import { roomThemeSwatchCssProperties } from "../lib/roomThemes";
import {
  PROFILE_CANVAS_DESKTOP_COLUMNS,
  PROFILE_CANVAS_DESKTOP_ROWS,
  PROFILE_CANVAS_MOBILE_COLUMNS,
  PROFILE_CANVAS_MOBILE_ROWS,
  PROFILE_CANVAS_ACTIVITY_MAX_MODULE_ROWS,
  PROFILE_CANVAS_MAX_MODULE_ROWS,
  PROFILE_CANVAS_PROFILE_INFO_COLUMNS,
  PROFILE_CANVAS_VERSION,
  getProfileModuleDefinition,
  normalizeProfileGridModuleSize,
  profileModuleAllowedSizes,
  profileModuleCatalog,
  profileModuleFallbackTitle,
  profileGridModuleSizeSpan,
  profileGridModuleSpanSize,
  profileModuleSizeLabel,
  type ProfileModuleCategory,
  type ProfileGridModuleSize,
} from "../lib/profileModuleRegistry";
import { safeProfileImageUrl } from "../lib/profileMedia";
import type {
  BadgeDefinition,
  Post,
  Profile,
  ProfileBackgroundBlur,
  ProfileConnectionPlatform,
  ProfileExternalConnection,
  ProfileIntegrationCard,
  ProfileModule,
  ProfileModuleLayout,
  ProfileModuleLink,
  ProfileThemeConfig,
  Room,
  UserBadge,
} from "../lib/types";
import {
  applyProfileThemeToRoot,
  profileThemeConfigEquals,
} from "../lib/profileThemes";
import { useAsyncData } from "../lib/useAsyncData";
import { useAuth } from "../lib/useAuth";
const PROFILE_CANVAS_COLUMNS = PROFILE_CANVAS_DESKTOP_COLUMNS;
const PROFILE_CANVAS_ROWS = PROFILE_CANVAS_DESKTOP_ROWS;
const PROFILE_CONTENT_AUTOSAVE_DELAY_MS = 650;
const PROFILE_MODULE_AUDIO_MAX_BYTES = 20971520;
const PROFILE_MODULE_VIDEO_MAX_BYTES = 100 * 1024 * 1024;

type ProfileTab = "feed" | "replies" | "rooms";
type ProfilePanel = "followers" | "following" | "badges";
type ProfileContentAutosaveState = "idle" | "pending" | "saving" | "saved" | "error";
type ProfileCanvasDraftAutosaveState =
  | "idle"
  | "pending"
  | "saving"
  | "saved"
  | "error";

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
    profileAccent: draft.profileAccent ?? null,
    profileTheme: draft.profileTheme ?? null,
    profileThemeConfig: draft.profileThemeConfig ?? null,
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
    profileAccent: saved.profileAccent ?? null,
    profileTheme: saved.profileTheme ?? null,
    profileThemeConfig: saved.profileThemeConfig ?? null,
  };

  const changed = Object.entries(next).some(([key, value]) => {
    if (key === "profileThemeConfig") {
      return !profileThemeConfigEquals(
        value as ProfileThemeConfig | null,
        current.profileThemeConfig,
      );
    }

    return current[key as keyof typeof current] !== value;
  });

  return changed
    ? next
    : undefined;
}

function mergeAutosavedProfileContent(current: Profile, saved: Profile): Profile {
  return {
    ...current,
    bio: saved.bio,
    bioEntities: saved.bioEntities ?? [],
    location: saved.location,
    bannerUrl: saved.bannerUrl ?? null,
    profileBackground: saved.profileBackground ?? null,
    profileBackgroundVideo: saved.profileBackgroundVideo ?? null,
    profileBackgroundVideoPoster: saved.profileBackgroundVideoPoster ?? null,
    profileAccent: saved.profileAccent ?? null,
    profileTheme: saved.profileTheme ?? null,
    profileThemeConfig: saved.profileThemeConfig ?? null,
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
  const profileEditReturnHandledRef = useRef(false);
  const profileEditorTourReturnHandledRef = useRef(false);
  const profileContentAutosaveRequestRef = useRef(0);
  const profileCanvasDraftAutosaveRequestRef = useRef(0);
  const profileCanvasDraftAutosaveTimerRef = useRef<number | undefined>(undefined);
  const canvasDraftRef = useRef<ProfileCanvasDraftState | undefined>(undefined);
  const nextDraftModuleIdRef = useRef(-1000);
  const [activeTab, setActiveTab] = useState<ProfileTab>("feed");
  const [activePanel, setActivePanel] = useState<ProfilePanel | undefined>();
  const [profileOverride, setProfileOverride] = useState<Profile | undefined>();
  const [badgesOverride, setBadgesOverride] = useState<
    { handle: string; result: Awaited<ReturnType<typeof getProfileBadges>> } | undefined
  >();
  const [canvasEditing, setCanvasEditing] = useState(false);
  const [canvasLoading, setCanvasLoading] = useState(false);
  const [canvasSaving, setCanvasSaving] = useState(false);
  const [canvasError, setCanvasError] = useState<string | undefined>();
  const [canvasDraft, setCanvasDraft] = useState<ProfileCanvasDraftState | undefined>();
  const [canvasDraftAutosaveState, setCanvasDraftAutosaveState] =
    useState<ProfileCanvasDraftAutosaveState>("idle");
  const [canvasDraftAutosaveError, setCanvasDraftAutosaveError] =
    useState<string | undefined>();
  const [draftBackgroundBlur, setDraftBackgroundBlur] =
    useState<ProfileBackgroundBlur>("medium");
  const [draftProfile, setDraftProfile] = useState<Profile | undefined>();
  const [modulesOverride, setModulesOverride] = useState<
    { handle: string; modules: ProfileModule[] } | undefined
  >();
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
  const [
    musicAutoplayDismissedProfileId,
    setMusicAutoplayDismissedProfileId,
  ] = useState<number | undefined>(undefined);
  const [musicAutoplayRequestId, setMusicAutoplayRequestId] = useState(0);
  const [
    spotifyEntryPromptDismissedProfileId,
    setSpotifyEntryPromptDismissedProfileId,
  ] = useState<number | undefined>(undefined);
  const [spotifyEntryPromptPendingHandle, setSpotifyEntryPromptPendingHandle] =
    useState<string | undefined>();
  const [spotifyEntryPromptError, setSpotifyEntryPromptError] =
    useState<{ handle: string; message: string } | undefined>();
  const [followState, setFollowState] = useState<
    { handle: string; relationship: FollowRelationship } | undefined
  >();
  const [followPosting, setFollowPosting] = useState(false);
  const [starPosting, setStarPosting] = useState(false);
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
  const [integrationReloadKey, setIntegrationReloadKey] = useState(0);
  const [integrationReturnNotice, setIntegrationReturnNotice] = useState<
    { kind: "success" | "error"; message: string } | undefined
  >();
  const [profileEditorTourOpen, setProfileEditorTourOpen] = useState(false);
  const [profileShareOpen, setProfileShareOpen] = useState(false);

  function setCurrentCanvasDraft(nextDraft: ProfileCanvasDraftState | undefined) {
    canvasDraftRef.current = nextDraft;
    setCanvasDraft(nextDraft);
  }

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
  const activeSpotifyEntryPromptPending =
    spotifyEntryPromptPendingHandle === normalizedHandle;
  const activeSpotifyEntryPromptError =
    spotifyEntryPromptError?.handle === normalizedHandle
      ? spotifyEntryPromptError.message
      : undefined;
  const isOwnProfile =
    status === "authenticated" &&
    Boolean(user) &&
    user?.handle.toLowerCase() === normalizedHandle;
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
  const integrationsLoader = useMemo(() => {
    const reloadKey = integrationReloadKey;

    return () => {
      void reloadKey;

      return status === "authenticated"
        ? getMyProfileIntegrations()
        : Promise.resolve({ providers: [], accounts: [] });
    };
  }, [integrationReloadKey, status]);
  const profileState = useAsyncData(profileLoader);
  const postsState = useAsyncData(postsLoader);
  const repliesState = useAsyncData(repliesLoader);
  const reblogsState = useAsyncData(reblogsLoader);
  const roomsState = useAsyncData(roomsLoader);
  const badgesState = useAsyncData(badgesLoader);
  const modulesState = useAsyncData(modulesLoader);
  const integrationsState = useAsyncData(integrationsLoader);
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
  const activeProfileThemeConfig = workingProfile?.profileThemeConfig ?? null;
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
  const publicModules = loadedModules.filter(
    (module) =>
      module.status === "active" &&
      (module.visibility === "public" || module.type === "activity"),
  );
  const profileLayoutPreset =
    profile?.profileLayoutPreset ?? defaultProfileLayoutPreset;
  const profileMissing =
    profileState.error instanceof ApiClientError && profileState.error.status === 404;

  useEffect(() => {
    return applyProfileThemeToRoot(activeProfileThemeConfig);
  }, [activeProfileThemeConfig]);

  const musicAutoplayTarget = useMemo(() => {
    if (!profile || canvasEditing || status === "loading" || isOwnProfile) {
      return undefined;
    }

    return firstProfileMusicAutoplayModule(
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
      provider: profileMusicAutoplayProvider(musicAutoplayTarget),
    });
    setMusicAutoplayDismissedProfileId(profile.user.id);
    setMusicAutoplayRequestId((requestId) => requestId + 1);
  }

  function handleSkipSpotifyEntryPrompt() {
    if (!profile || !spotifyEntryPromptTarget) {
      return;
    }

    writeProfileSpotifyPromptSkip(profileSpotifyPromptSkipKey(profile.user.id), {
      handle: profile.user.handle,
      profileId: profile.user.id,
      skippedAt: new Date().toISOString(),
    });
    setSpotifyEntryPromptDismissedProfileId(profile.user.id);
    setSpotifyEntryPromptError(undefined);

    if (musicAutoplayTarget && !musicAutoplayAllowed) {
      handleContinueToProfileMusic();
    }
  }

  async function handleConnectProfileSpotify() {
    if (!profile || activeSpotifyEntryPromptPending) {
      return;
    }

    setSpotifyEntryPromptPendingHandle(normalizedHandle);
    setSpotifyEntryPromptError(undefined);

    try {
      const redirectPath = profileEntryRedirectPath(
        location.pathname,
        location.search,
      );
      const result = await runWithAuth(
        (csrfToken) => startProfileIntegration("spotify", csrfToken, redirectPath),
        { retryOnCsrf: true },
      );

      if (result.authorizationUrl) {
        window.location.assign(result.authorizationUrl);
        return;
      }

      setSpotifyEntryPromptError({
        handle: normalizedHandle,
        message: "Spotify did not return a connection link.",
      });
    } catch (error) {
      setSpotifyEntryPromptError({
        handle: normalizedHandle,
        message:
          error instanceof Error
            ? error.message
            : "Could not start Spotify connection.",
      });
    } finally {
      setSpotifyEntryPromptPendingHandle((current) =>
        current === normalizedHandle ? undefined : current,
      );
    }
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
          profile.isFollowing || profile.isFollowRequestPending
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

  async function handleStarToggle() {
    if (!profile || isOwnProfile || profile.blockedByMe || starPosting) {
      return;
    }

    if (status !== "authenticated") {
      navigate("/login");
      return;
    }

    const previousRelationship: FollowRelationship = {
      isFollowing: profile.isFollowing,
      isFollowedBy: profile.isFollowedBy,
      isMoot: profile.isMoot,
      isStarred: profile.isStarred,
      isFollowRequestPending: profile.isFollowRequestPending ?? false,
      blockedByMe: profile.blockedByMe ?? false,
      mutedByMe: profile.mutedByMe ?? false,
      followerCount: profile.followerCount,
      followingCount: profile.followingCount,
      mootCount: profile.mootCount,
      starCount: profile.starCount,
    };
    const optimisticRelationship: FollowRelationship = {
      ...previousRelationship,
      isStarred: !profile.isStarred,
      starCount: Math.max(0, profile.starCount + (profile.isStarred ? -1 : 1)),
    };

    setStarPosting(true);
    setFollowError(undefined);
    setFollowState({
      handle: normalizedHandle,
      relationship: optimisticRelationship,
    });

    try {
      const result = await runWithAuth(
        (csrfToken) =>
          profile.isStarred
            ? unstarProfile(profile.user.handle, csrfToken)
            : starProfile(profile.user.handle, csrfToken),
        { retryOnCsrf: true },
      );

      setFollowState({
        handle: normalizedHandle,
        relationship: result.relationship,
      });
    } catch (error) {
      setFollowState({
        handle: normalizedHandle,
        relationship: previousRelationship,
      });
      setFollowError({
        handle: normalizedHandle,
        message:
          error instanceof Error ? error.message : "Could not update star state.",
      });
    } finally {
      setStarPosting(false);
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
      const draft = await getProfileCanvasDraft();

      setCurrentCanvasDraft(draft);
      setDraftBackgroundBlur(draft.backgroundBlur);
      setDraftProfile({
        ...profile,
        profileBackgroundBlur: draft.backgroundBlur,
        profileCanvasVersion: draft.canvasVersion,
      });
      setProfileContentAutosaveState("idle");
      setProfileContentAutosaveError(undefined);
      setCanvasDraftAutosaveState("idle");
      setCanvasDraftAutosaveError(undefined);
      setCanvasEditing(true);
    } catch (error) {
      setCanvasError(
        error instanceof Error ? error.message : "Could not open the canvas editor.",
      );
    } finally {
      setCanvasLoading(false);
    }
  }, [canvasLoading, isOwnProfile, profile]);

  useEffect(() => {
    if (
      profileEditReturnHandledRef.current ||
      canvasEditing ||
      canvasLoading ||
      !profile ||
      !isOwnProfile
    ) {
      return;
    }

    const params = new URLSearchParams(location.search);

    if (params.get("editProfile") !== "1" && params.get("editCanvas") !== "1") {
      return;
    }

    profileEditReturnHandledRef.current = true;
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
      profileEditorTourReturnHandledRef.current ||
      !canvasEditing ||
      !isOwnProfile
    ) {
      return;
    }

    const params = new URLSearchParams(location.search);

    if (params.get("tour") !== "profile-editor") {
      return;
    }

    profileEditorTourReturnHandledRef.current = true;
    let active = true;

    queueMicrotask(() => {
      if (!active) {
        return;
      }

      setProfileEditorTourOpen(true);
      params.delete("tour");
      const nextSearch = params.toString();

      navigate(
        {
          pathname: location.pathname,
          search: nextSearch ? `?${nextSearch}` : "",
        },
        { replace: true },
      );
    });

    return () => {
      active = false;
    };
  }, [
    canvasEditing,
    isOwnProfile,
    location.pathname,
    location.search,
    navigate,
  ]);

  useEffect(() => {
    if (!isOwnProfile) {
      return;
    }

    const params = new URLSearchParams(location.search);
    const provider = profileIntegrationProviderFromParam(
      params.get("integrationProvider"),
    );
    const integrationStatus = params.get("integrationStatus");

    if (!provider || !integrationStatus) {
      return;
    }

    let active = true;

    queueMicrotask(() => {
      if (!active) {
        return;
      }

      setIntegrationReturnNotice({
        kind: integrationStatus === "connected" ? "success" : "error",
        message:
          integrationStatus === "connected"
            ? `${profileCanvasProviderLabel(provider)} connected.`
            : `${profileCanvasProviderLabel(provider)} did not connect${
                params.get("integrationError")
                  ? ` (${params.get("integrationError")})`
                  : ""
              }.`,
      });
      setIntegrationReloadKey((key) => key + 1);
      params.delete("integrationProvider");
      params.delete("integrationStatus");
      params.delete("integrationError");
      const nextSearch = params.toString();

      navigate(
        {
          pathname: location.pathname,
          search: nextSearch ? `?${nextSearch}` : "",
        },
        { replace: true },
      );
    });

    return () => {
      active = false;
    };
  }, [isOwnProfile, location.pathname, location.search, navigate]);

  async function markProfileEditorTourStep(action: "complete_step" | "skip_step") {
    try {
      await runWithAuth(
        (csrfToken) =>
          updateOnboardingState({ action, step: "profile_canvas" }, csrfToken),
        { retryOnCsrf: true },
      );
    } catch {
      // The tour should never block profile editing if onboarding state cannot save.
    }
  }

  function handleProfileEditorTourComplete() {
    setProfileEditorTourOpen(false);
    void markProfileEditorTourStep("complete_step");
  }

  function handleProfileEditorTourDismiss() {
    setProfileEditorTourOpen(false);
    void markProfileEditorTourStep("skip_step");
  }

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

  useEffect(() => {
    return () => {
      if (profileCanvasDraftAutosaveTimerRef.current !== undefined) {
        window.clearTimeout(profileCanvasDraftAutosaveTimerRef.current);
      }
    };
  }, []);

  function queueCanvasDraftAutosave(nextDraft: ProfileCanvasDraftState) {
    setCurrentCanvasDraft(nextDraft);
    setDraftBackgroundBlur(nextDraft.backgroundBlur);
    setCanvasDraftAutosaveState("pending");
    setCanvasDraftAutosaveError(undefined);

    if (profileCanvasDraftAutosaveTimerRef.current !== undefined) {
      window.clearTimeout(profileCanvasDraftAutosaveTimerRef.current);
    }

    const requestId = profileCanvasDraftAutosaveRequestRef.current + 1;
    profileCanvasDraftAutosaveRequestRef.current = requestId;

    profileCanvasDraftAutosaveTimerRef.current = window.setTimeout(() => {
      setCanvasDraftAutosaveState("saving");

      void runWithAuth(
        (csrfToken) =>
          updateProfileCanvasDraft(
            {
              backgroundBlur: nextDraft.backgroundBlur,
              canvasGlass: nextDraft.canvasGlass,
              canvasVersion: PROFILE_CANVAS_VERSION,
              modules: nextDraft.modules,
              selectedModuleId: nextDraft.selectedModuleId ?? null,
            },
            csrfToken,
          ),
        { retryOnCsrf: true },
      )
        .then((savedDraft) => {
          if (profileCanvasDraftAutosaveRequestRef.current !== requestId) {
            return;
          }

          setCurrentCanvasDraft(savedDraft);
          setDraftBackgroundBlur(savedDraft.backgroundBlur);
          setCanvasDraftAutosaveState("saved");
          setCanvasDraftAutosaveError(undefined);
        })
        .catch((error) => {
          if (profileCanvasDraftAutosaveRequestRef.current !== requestId) {
            return;
          }

          setCanvasDraftAutosaveState("error");
          setCanvasDraftAutosaveError(
            error instanceof Error
              ? error.message
              : "Canvas draft could not save automatically.",
          );
        });
    }, PROFILE_CONTENT_AUTOSAVE_DELAY_MS);
  }

  async function saveCanvasDraftImmediately(
    nextDraft: ProfileCanvasDraftState,
  ): Promise<ProfileCanvasDraftState> {
    if (profileCanvasDraftAutosaveTimerRef.current !== undefined) {
      window.clearTimeout(profileCanvasDraftAutosaveTimerRef.current);
      profileCanvasDraftAutosaveTimerRef.current = undefined;
    }

    const requestId = profileCanvasDraftAutosaveRequestRef.current + 1;
    profileCanvasDraftAutosaveRequestRef.current = requestId;
    setCanvasDraftAutosaveState("saving");
    setCanvasDraftAutosaveError(undefined);

    const savedDraft = await runWithAuth(
      (csrfToken) =>
        updateProfileCanvasDraft(
          {
            backgroundBlur: nextDraft.backgroundBlur,
            canvasGlass: nextDraft.canvasGlass,
            canvasVersion: PROFILE_CANVAS_VERSION,
            modules: nextDraft.modules,
            selectedModuleId: nextDraft.selectedModuleId ?? null,
          },
          csrfToken,
        ),
      { retryOnCsrf: true },
    );

    if (profileCanvasDraftAutosaveRequestRef.current === requestId) {
      setCurrentCanvasDraft(savedDraft);
      setDraftBackgroundBlur(savedDraft.backgroundBlur);
      setCanvasDraftAutosaveState("saved");
    }

    return savedDraft;
  }

  async function handleSaveCanvasEdit() {
    if (!profile || !canvasDraft || canvasSaving) {
      return;
    }

    setCanvasSaving(true);
    setCanvasError(undefined);

    try {
      const latestProfile =
        draftProfile
          ? (await saveProfileContentImmediately(draftProfile)) ?? profile
          : profile;
      await saveCanvasDraftImmediately(canvasDraft);
      const saved = await runWithAuth(
        (csrfToken) => commitProfileCanvasDraft(csrfToken),
        { retryOnCsrf: true },
      );

      setModulesOverride({ handle: normalizedHandle, modules: saved.modules });
      setProfileOverride({
        ...latestProfile,
        profileBackgroundBlur: saved.backgroundBlur,
        profileCanvasGlass: saved.canvasGlass,
        profileCanvasVersion: saved.canvasVersion,
      });
      setDraftBackgroundBlur(saved.backgroundBlur);
      setCurrentCanvasDraft(undefined);
      setCanvasEditing(false);
      setCanvasDraftAutosaveState("idle");
      setCanvasDraftAutosaveError(undefined);
    } catch (error) {
      setCanvasError(
        error instanceof Error ? error.message : "Could not save canvas changes.",
      );
    } finally {
      setCanvasSaving(false);
    }
  }

  async function handleCancelCanvasEdit() {
    if (profileCanvasDraftAutosaveTimerRef.current !== undefined) {
      window.clearTimeout(profileCanvasDraftAutosaveTimerRef.current);
      profileCanvasDraftAutosaveTimerRef.current = undefined;
    }

    if (canvasDraft) {
      try {
        await runWithAuth((csrfToken) => discardProfileCanvasDraft(csrfToken), {
          retryOnCsrf: true,
        });
      } catch (error) {
        setCanvasError(
          error instanceof Error ? error.message : "Could not discard canvas draft.",
        );
      }
    }

    setCanvasEditing(false);
    setCanvasError(undefined);
    setCurrentCanvasDraft(undefined);
    setDraftBackgroundBlur(profile?.profileBackgroundBlur ?? "medium");
    setDraftProfile(undefined);
    setProfileDraftUploading(undefined);
    setProfileContentAutosaveState("idle");
    setProfileContentAutosaveError(undefined);
    setCanvasDraftAutosaveState("idle");
    setCanvasDraftAutosaveError(undefined);
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
  ): Promise<Profile | undefined> {
    if (!profile) {
      return undefined;
    }

    const input = profileContentAutosaveInput(nextProfile, profile);

    if (!input) {
      return undefined;
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
      return savedProfile;
    } catch (error) {
      const message = error instanceof Error ? error.message : fallbackMessage;
      setProfileContentAutosaveState("error");
      setProfileContentAutosaveError(message);
      setCanvasError(message);
      throw error;
    }
  }

  async function handleProfileImageDraftSelection(
    file: File,
    purpose: Extract<ImageUploadPurpose, "avatar" | "banner" | "profile_background">,
  ) {
    setCanvasError(undefined);

    try {
      const prepared = await runWithAuth(
        (csrfToken) =>
          prepareImageFileForCrop(file, purpose, (sourceFile, imagePurpose) =>
            previewImageUpload(sourceFile, imagePurpose, csrfToken),
          ),
        { retryOnCsrf: true },
      );

      setPendingProfileImageCrop({ file: prepared, purpose });
    } catch (error) {
      setCanvasError(error instanceof Error ? error.message : "Image could not be prepared.");
    }
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
                profileBackgroundVideoPoster: null,
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

    const validationError = validateProfileModuleVideoFile(file);

    if (validationError) {
      setCanvasError(validationError);
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
        profileBackgroundVideoPoster: upload.posterUrl ?? null,
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

  async function handleModuleImageUpload(file: File): Promise<string> {
    const validationError = validateImageCropFile(file);

    if (validationError) {
      setCanvasError(validationError);
      throw new Error(validationError);
    }

    setCanvasError(undefined);

    const upload = await runWithAuth(
      (csrfToken) => uploadImage(file, "post_media", csrfToken),
      { retryOnCsrf: true },
    );

    return upload.url;
  }

  async function handleModuleImagePrepare(file: File): Promise<File> {
    return runWithAuth(
      (csrfToken) =>
        prepareImageFileForCrop(file, "post_media", (sourceFile, purpose) =>
          previewImageUpload(sourceFile, purpose, csrfToken),
        ),
      { retryOnCsrf: true },
    );
  }

  async function handleModuleVideoUpload(file: File): Promise<UploadedVideo> {
    const validationError = validateProfileModuleVideoFile(file);

    if (validationError) {
      setCanvasError(validationError);
      throw new Error(validationError);
    }

    setCanvasError(undefined);

    return runWithAuth(
      (csrfToken) => uploadVideo(file, "profile_module_video", csrfToken),
      { retryOnCsrf: true },
    );
  }

  async function handleModuleAudioUpload(file: File): Promise<UploadedAudio> {
    const validationError = validateProfileModuleAudioFile(file);

    if (validationError) {
      setCanvasError(validationError);
      throw new Error(validationError);
    }

    setCanvasError(undefined);

    return runWithAuth(
      (csrfToken) => uploadAudio(file, "profile_music", csrfToken),
      { retryOnCsrf: true },
    );
  }

  async function handleBackgroundBlurChange(blur: ProfileBackgroundBlur) {
    if (!profile || canvasSaving) {
      return;
    }

    setDraftBackgroundBlur(blur);
    setCanvasSaving(true);
    setCanvasError(undefined);

    try {
      const canvas = await runWithAuth(
        (csrfToken) =>
          updateProfileCanvas(
            {
              canvasVersion: PROFILE_CANVAS_VERSION,
              backgroundBlur: blur,
            },
            csrfToken,
          ),
        { retryOnCsrf: true },
      );
      const savedProfile = {
        ...profile,
        profileBackgroundBlur: canvas.backgroundBlur,
        profileCanvasGlass: canvas.canvasGlass,
        profileCanvasVersion: canvas.canvasVersion,
      };

      setProfileOverride(savedProfile);
      setDraftProfile((current) =>
        current
          ? {
              ...current,
              profileBackgroundBlur: canvas.backgroundBlur,
              profileCanvasGlass: canvas.canvasGlass,
              profileCanvasVersion: canvas.canvasVersion,
            }
          : savedProfile,
      );
      setDraftBackgroundBlur(canvas.backgroundBlur);
    } catch (error) {
      setDraftBackgroundBlur(profile.profileBackgroundBlur);
      setCanvasError(
        error instanceof Error
          ? error.message
          : "Could not save background clarity.",
      );
    } finally {
      setCanvasSaving(false);
    }
  }

  function handleCanvasDraftChange(
    updater: (draft: ProfileCanvasDraftState) => ProfileCanvasDraftState,
  ) {
    const currentDraft = canvasDraftRef.current ?? canvasDraft;

    if (!currentDraft) {
      return;
    }

    queueCanvasDraftAutosave(updater(currentDraft));
  }

  function handleDraftBackgroundBlurChange(blur: ProfileBackgroundBlur) {
    handleCanvasDraftChange((draft) => ({
      ...draft,
      backgroundBlur: blur,
    }));
  }

  function handleDraftCanvasGlassChange(canvasGlass: number) {
    handleCanvasDraftChange((draft) => ({
      ...draft,
      canvasGlass: Math.min(92, Math.max(0, Math.round(canvasGlass))),
    }));
  }

  async function handleCanvasProviderConnect(provider: ProfileIntegrationProvider) {
    if (!profile) {
      return;
    }

    setCanvasError(undefined);

    try {
      if (canvasDraft) {
        await saveCanvasDraftImmediately(canvasDraft);
      }

      const result = await runWithAuth(
        (csrfToken) =>
          startProfileIntegration(
            provider,
            csrfToken,
            `/@${profile.user.handle}?editCanvas=1`,
          ),
        { retryOnCsrf: true },
      );

      if (result.authorizationUrl) {
        window.location.assign(result.authorizationUrl);
      }
    } catch (error) {
      setCanvasError(
        error instanceof Error
          ? error.message
          : "Could not start provider connection.",
      );
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

  if (!renderedProfile.viewerCanView && !isOwnProfile) {
    return (
      <motion.div
        className="profile-canvas-viewport-shell relative"
        variants={pageEntrance}
        initial="hidden"
        animate="show"
      >
        <ProfilePersonalBackdrop profile={backgroundPreviewProfile} paused={canvasEditing} />
        <div className="profile-canvas-page-shell relative z-10 mx-auto">
          <PageMeta
            title={`${renderedProfile.user.displayName} (@${renderedProfile.user.handle})`}
            description="This profile is private."
            path={`/@${renderedProfile.user.handle}`}
          />
          <Panel className="mx-auto max-w-xl p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <Avatar user={renderedProfile.user} size="lg" />
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold text-text">
                  {renderedProfile.user.displayName}
                </h1>
                <p className="text-sm text-muted">@{renderedProfile.user.handle}</p>
              </div>
            </div>
            <div className="mt-5 rounded-card border border-line bg-canvas/45 p-4">
              <p className="font-semibold text-text">This profile is private.</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Follow requests must be approved before posts, modules, and profile details are visible.
              </p>
              {!isOwnProfile ? (
                <Button
                  type="button"
                  className="mt-4"
                  disabled={followPosting}
                  onClick={handleFollowToggle}
                >
                  {followPosting
                    ? "Saving"
                    : renderedProfile.isFollowRequestPending
                      ? "Requested"
                      : "Request follow"}
                </Button>
              ) : null}
              {activeFollowError ? (
                <p className="mt-3 text-sm text-rose-ink">{activeFollowError}</p>
              ) : null}
            </div>
          </Panel>
        </div>
      </motion.div>
    );
  }

  const profileSpaceModules = publicModules.filter((module) => {
    if (module.type === "activity") {
      return true;
    }

    if (module.type === "featured_post") {
      return Boolean(renderedProfile.featuredPost);
    }

    if (module.type === "featured_room") {
      return Boolean(renderedProfile.featuredRoom);
    }

    return true;
  });
  const profileCanvasModules = resolveProfileCanvasModules(
    renderedProfile,
    mergeProfileLinksIntoConnectionModules(renderedProfile, profileSpaceModules),
  );
  const hasVisibleProfileInfoModule = profileCanvasModules.some(
    (module) => module.type === "profile_info",
  );
  const spotifyEntryPromptTarget =
    firstProfileSpotifyEntryPromptModule(profileCanvasModules);
  const spotifyEntryProviderStatus = integrationsState.data?.providers.find(
    (item) => item.provider === "spotify",
  );
  const spotifyEntryConnectedAccount = integrationsState.data?.accounts.find(
    (item) => item.provider === "spotify" && !item.revokedAt,
  );
  const spotifyEntryPromptSkipped = Boolean(
    spotifyEntryPromptTarget &&
      (spotifyEntryPromptDismissedProfileId === renderedProfile.user.id ||
        readProfileSpotifyPromptSkip(
          profileSpotifyPromptSkipKey(renderedProfile.user.id),
          renderedProfile.user.id,
          renderedProfile.user.handle,
        )),
  );
  const spotifyEntryPromptMode: ProfileEntryGateMode | undefined =
    !spotifyEntryPromptTarget ||
    canvasEditing ||
    isOwnProfile ||
    status === "loading" ||
    spotifyEntryPromptSkipped
      ? undefined
      : status === "anonymous"
        ? "spotify-signin"
        : integrationsState.loading
          ? undefined
          : spotifyEntryConnectedAccount
            ? undefined
            : spotifyEntryProviderStatus?.oauthEnabled
              ? "spotify-connect"
              : undefined;
  const profileEntryGateMode: ProfileEntryGateMode | undefined =
    spotifyEntryPromptMode ??
    (musicAutoplayTarget && !musicAutoplayAllowed ? "music" : undefined);
  const profileEntryGateSignInPath =
    profileEntryGateMode === "spotify-signin"
      ? profileEntryLoginPath(
          profileEntryRedirectPath(location.pathname, location.search),
        )
      : undefined;

  function renderProfileModuleContent(
    module: ProfileModule,
    size: ProfileGridModuleSize,
    editing: boolean,
  ) {
    if (module.type === "profile_info") {
      return (
        <ProfileInfoModule
          activeFollowError={activeFollowError}
          activeProfileControlError={activeProfileControlError}
          activeProfileControlMessage={activeProfileControlMessage}
          editing={editing}
          featuredBadges={featuredBadges}
          followPosting={followPosting}
          isOwnProfile={isOwnProfile}
          onStarToggle={handleStarToggle}
          onShareProfile={() => setProfileShareOpen(true)}
          profile={renderedProfile}
          profileControlBusy={profileControlBusy}
          size={size}
          showChatHint={
            status === "authenticated" &&
            !isOwnProfile &&
            !renderedProfile.blockedByMe &&
            !renderedProfile.isMoot
          }
          starPosting={starPosting}
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
          editing={editing}
          profile={renderedProfile}
          title={module.title ?? "Featured post"}
        />
      );
    }

    if (module.type === "featured_room" && renderedProfile.featuredRoom) {
      return (
        <FeaturedRoomModuleCard
          editing={editing}
          profile={renderedProfile}
          title={module.title ?? "Featured room"}
        />
      );
    }

    if (module.type === "activity") {
      return (
        <ProfileActivityModule
          activeTab={activeTab}
          editing={editing}
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
          title={module.title ?? "Feed"}
          onTabChange={setActiveTab}
        />
      );
    }

    return undefined;
  }
  return (
    <motion.div
      className="profile-canvas-viewport-shell relative"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <ProfilePersonalBackdrop profile={backgroundPreviewProfile} paused={canvasEditing} />
      <div className="profile-canvas-page-shell relative z-10 mx-auto space-y-4 sm:space-y-5">
        <PageMeta
          title={`${renderedProfile.user.displayName} (@${renderedProfile.user.handle})`}
          description={renderedProfile.bio}
          path={`/@${renderedProfile.user.handle}`}
        />
        {integrationReturnNotice ? (
          <p
            className={cn(
              "rounded-card border p-3 text-sm font-semibold",
              integrationReturnNotice.kind === "success"
                ? "border-leaf/30 bg-leaf/15 text-leaf-ink"
                : "border-rose/30 bg-rose/12 text-rose-ink",
            )}
            role={integrationReturnNotice.kind === "error" ? "alert" : "status"}
          >
            {integrationReturnNotice.message}
          </p>
        ) : null}
        {!canvasEditing && !hasVisibleProfileInfoModule ? (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-testid="profile-share-button"
              icon={<Share2 aria-hidden="true" size={16} />}
              onClick={() => setProfileShareOpen(true)}
            >
              Share
            </Button>
          </div>
        ) : null}
        {isOwnProfile && !canvasEditing ? (
          <ProfileTransitionEditor
            autosaveError={profileContentAutosaveError}
            autosaveState={profileContentAutosaveState}
            backgroundBlur={draftBackgroundBlur}
            busy={canvasLoading || canvasSaving}
            editing={false}
            error={canvasError}
            profile={renderedProfile}
            uploading={profileDraftUploading}
            onBackgroundBlurChange={(blur) => void handleBackgroundBlurChange(blur)}
            onCancel={() => void handleCancelCanvasEdit()}
            onClearBackground={() => void handleClearProfileBackgroundDraft()}
            onEdit={() => void handleStartCanvasEdit()}
            onImageUpload={handleProfileImageDraftSelection}
            onProfileDraftChange={handleDraftProfileChange}
            onVideoUpload={(file) => void handleProfileVideoDraftUpload(file)}
          />
        ) : null}
        <div className="min-w-0 space-y-4 sm:space-y-5">
          {canvasEditing && canvasDraft ? (
            <ProfileDirectCanvasEditor
              autosaveError={canvasDraftAutosaveError}
              autosaveState={canvasDraftAutosaveState}
              busy={canvasSaving}
              draft={canvasDraft}
              error={canvasError}
              guideOpen={profileEditorTourOpen}
              integrationAccounts={integrationsState.data?.accounts ?? []}
              integrationProviders={integrationsState.data?.providers ?? []}
              modules={canvasDraft.modules}
              profile={renderedProfile}
              uploading={profileDraftUploading}
              onBackgroundBlurChange={handleDraftBackgroundBlurChange}
              onCancel={() => void handleCancelCanvasEdit()}
              onCanvasGlassChange={handleDraftCanvasGlassChange}
              onChange={handleCanvasDraftChange}
              onClearBackground={() => void handleClearProfileBackgroundDraft()}
              onConnectProvider={(provider) =>
                void handleCanvasProviderConnect(provider)
              }
              onGuideComplete={handleProfileEditorTourComplete}
              onGuideDismiss={handleProfileEditorTourDismiss}
              onGuideOpen={() => setProfileEditorTourOpen(true)}
              onModuleAudioUpload={handleModuleAudioUpload}
              onImageUpload={handleProfileImageDraftSelection}
              onModuleImagePrepare={handleModuleImagePrepare}
              onModuleImageUpload={handleModuleImageUpload}
              onModuleVideoUpload={handleModuleVideoUpload}
              onNewDraftModuleId={() => nextDraftModuleIdRef.current--}
              onProfileDraftChange={handleDraftProfileChange}
              onRenderModuleContent={(module, size) =>
                renderProfileModuleContent(module, size, true)
              }
              onResolveIntegrationMetadata={(input) =>
                runWithAuth(
                  (csrfToken) => resolveProfileIntegrationMetadata(input, csrfToken),
                  { retryOnCsrf: true },
                )
              }
              onSave={() => void handleSaveCanvasEdit()}
              onVideoUpload={(file) => void handleProfileVideoDraftUpload(file)}
            />
          ) : (
            <ProfileModulesSection
              badges={profileBadges}
              canvasGlass={renderedProfile.profileCanvasGlass}
              error={modulesState.error}
              isOwnProfile={isOwnProfile}
              layoutPreset={profileLayoutPreset}
              loading={modulesState.loading}
              musicAutoplay={musicAutoplayRequest}
              modules={profileCanvasModules}
              renderModuleContent={(module, size) =>
                renderProfileModuleContent(module, size, false)
              }
            />
          )}
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
      {profileEntryGateMode ? (
        <ProfileEntryGateOverlay
          connectError={activeSpotifyEntryPromptError}
          connectPending={activeSpotifyEntryPromptPending}
          mode={profileEntryGateMode}
          profile={renderedProfile}
          signInPath={profileEntryGateSignInPath}
          onConnectSpotify={() => void handleConnectProfileSpotify()}
          onContinue={
            profileEntryGateMode === "music"
              ? handleContinueToProfileMusic
              : handleSkipSpotifyEntryPrompt
          }
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
      <ProfileShareModal
        open={profileShareOpen}
        profile={renderedProfile}
        onClose={() => setProfileShareOpen(false)}
      />
    </motion.div>
  );
}

type ProfileEntryGateMode = "music" | "spotify-connect" | "spotify-signin";

function ProfileEntryGateOverlay({
  connectError,
  connectPending,
  mode,
  onConnectSpotify,
  onContinue,
  profile,
  signInPath,
}: {
  connectError?: string | undefined;
  connectPending?: boolean | undefined;
  mode: ProfileEntryGateMode;
  onConnectSpotify: () => void;
  onContinue: () => void;
  profile: Profile;
  signInPath?: string | undefined;
}) {
  const continueClickedRef = useRef(false);
  const [continuePending, setContinuePending] = useState(false);
  const spotifyPrompt = mode !== "music";
  const title = spotifyPrompt
    ? "Best with Spotify connected"
    : "Continue to profile";
  const text =
    mode === "spotify-connect"
      ? "Connect Spotify before entering for the smoothest music experience on this profile."
      : mode === "spotify-signin"
        ? "Sign in to connect Spotify before entering, or skip and keep browsing."
        : "Profile music may start after you continue. Embedded or uploaded music is available on this profile.";

  if (typeof document === "undefined") {
    return null;
  }

  function handleContinueClick() {
    if (continueClickedRef.current) {
      return;
    }

    continueClickedRef.current = true;
    setContinuePending(true);
    onContinue();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-canvas/72 p-4 backdrop-blur-xl"
      data-profile-entry-gate-mode={mode}
      data-testid="profile-entry-gate"
    >
      <div
        className="w-full max-w-sm rounded-panel border border-line bg-surface/86 p-4 text-center shadow-lift backdrop-blur-veil"
        data-testid={
          spotifyPrompt
            ? "profile-spotify-entry-prompt"
            : "profile-music-continue-overlay"
        }
      >
        <span className="mx-auto grid size-11 place-items-center rounded-card border border-line bg-canvas/70 text-text">
          <Music2 aria-hidden="true" size={22} />
        </span>
        <p className="mt-3 text-xs font-semibold uppercase text-muted">
          @{profile.user.handle}
        </p>
        <h2 className="mt-1 text-xl font-semibold text-text">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          {text}
        </p>
        {connectError ? (
          <p
            className="mt-3 rounded-card border border-rose/30 bg-rose/12 px-3 py-2 text-sm text-rose-ink"
            data-testid="profile-spotify-entry-error"
            role="alert"
          >
            {connectError}
          </p>
        ) : null}
        {mode === "spotify-connect" ? (
          <Button
            type="button"
            className="mt-4 w-full justify-center"
            data-testid="profile-spotify-entry-connect-button"
            disabled={connectPending}
            onClick={onConnectSpotify}
          >
            {connectPending ? "Opening Spotify" : "Connect Spotify"}
          </Button>
        ) : null}
        {mode === "spotify-signin" ? (
          <ButtonLink
            className="mt-4 w-full justify-center"
            data-testid="profile-spotify-entry-signin-link"
            to={signInPath ?? "/login"}
          >
            Sign in to connect Spotify
          </ButtonLink>
        ) : null}
        {spotifyPrompt ? (
          <Button
            type="button"
            className="mt-2 w-full justify-center"
            data-testid="profile-spotify-entry-skip-button"
            disabled={continuePending}
            variant="secondary"
            onClick={handleContinueClick}
          >
            Skip and continue
          </Button>
        ) : (
          <Button
            type="button"
            className="mt-4 w-full justify-center"
            data-testid="profile-music-continue-button"
            disabled={continuePending}
            onClick={handleContinueClick}
          >
            Continue to profile
          </Button>
        )}
      </div>
    </div>,
    document.body,
  );
}

type ProfileMusicAutoplayConsent = {
  grantedAt: string;
  handle: string;
  profileId: number;
  provider: "spotify" | "youtube" | "upload";
};

type ProfileSpotifyPromptSkip = {
  handle: string;
  profileId: number;
  skippedAt: string;
};

function firstProfileSpotifyEntryPromptModule(
  modules: ProfileModule[],
): ProfileModule | undefined {
  return modules.find((module) => {
    const integration = module.config.integration;

    return (
      module.status === "active" &&
      module.visibility === "public" &&
      integration?.provider === "spotify" &&
      integration.apiBacked === true
    );
  });
}

function firstProfileMusicAutoplayModule(
  modules: ProfileModule[],
): ProfileModule | undefined {
  const firstMusicModule = modules.find(
    (module) =>
      (module.type === "music" || getProfileModuleDefinition(module.type).category === "music") &&
      module.visibility === "public" &&
      module.status === "active",
  );

  if (!firstMusicModule) {
    return undefined;
  }

  const integration = firstMusicModule.config.integration;

  if (firstMusicModule.config.audio) {
    return firstMusicModule;
  }

  if (!integration?.embed) {
    return undefined;
  }

  if (
    integration.provider === "spotify" &&
    ["track", "album", "playlist"].includes(integration.resourceType)
  ) {
    return firstMusicModule;
  }

  return integration.provider === "youtube" && firstMusicModule.type.startsWith("youtube_music")
    ? firstMusicModule
    : undefined;
}

function profileMusicAutoplayProvider(
  module: ProfileModule | undefined,
): ProfileMusicAutoplayConsent["provider"] {
  if (module?.config.audio) {
    return "upload";
  }

  if (module?.config.integration?.provider === "youtube") {
    return "youtube";
  }

  return "spotify";
}

function validateProfileModuleAudioFile(file: File): string | undefined {
  const name = file.name.toLowerCase();

  if (file.size <= 0) {
    return "Audio cannot be empty.";
  }

  if (file.size > PROFILE_MODULE_AUDIO_MAX_BYTES) {
    return "Audio must be 20 MB or smaller.";
  }

  if (file.type !== "audio/mpeg" && !name.endsWith(".mp3")) {
    return "Use an MP3 file.";
  }

  return undefined;
}

function validateProfileModuleVideoFile(file: File): string | undefined {
  if (file.size <= 0) {
    return "Video cannot be empty.";
  }

  if (file.size > PROFILE_MODULE_VIDEO_MAX_BYTES) {
    return "Video must be 100 MB or smaller.";
  }

  if (!isAcceptedVideoUploadFile(file)) {
    return videoUploadFormatHelp;
  }

  return undefined;
}

function readMediaFileDuration(file: File): Promise<number | undefined> {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    return Promise.resolve(undefined);
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const element = file.type.startsWith("video/")
      ? document.createElement("video")
      : document.createElement("audio");
    const cleanup = () => {
      window.clearTimeout(timeout);
      URL.revokeObjectURL(objectUrl);
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      resolve(undefined);
    }, 4000);

    element.preload = "metadata";
    element.onloadedmetadata = () => {
      const duration = Number.isFinite(element.duration) && element.duration > 0
        ? Math.round(element.duration * 1000) / 1000
        : undefined;

      cleanup();
      resolve(duration);
    };
    element.onerror = () => {
      cleanup();
      resolve(undefined);
    };
    element.src = objectUrl;
  });
}

function sanitizeUploadedMediaTitle(fileName: string, fallback: string): string {
  const title = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return title ? title.slice(0, 60) : fallback;
}

function formatUploadSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) {
    return "0 KB";
  }

  if (size >= 1048576) {
    return `${(size / 1048576).toFixed(size >= 10485760 ? 0 : 1)} MB`;
  }

  return `${Math.ceil(size / 1024)} KB`;
}

function profileMusicAutoplayConsentKey(profileId: number): string {
  return `thia.profile.musicAutoplayConsent.v1:${profileId}`;
}

function profileSpotifyPromptSkipKey(profileId: number): string {
  return `thia.profile.spotifyConnectPromptSkip.v1:${profileId}`;
}

function profileEntryRedirectPath(pathname: string, search: string): string {
  const params = new URLSearchParams(search);

  params.delete("integrationProvider");
  params.delete("integrationStatus");
  params.delete("integrationError");

  const nextSearch = params.toString();

  return nextSearch ? `${pathname}?${nextSearch}` : pathname;
}

function profileEntryLoginPath(returnTo: string): string {
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
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

function readProfileSpotifyPromptSkip(
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

    const parsed = JSON.parse(value) as Partial<ProfileSpotifyPromptSkip>;

    return (
      parsed.profileId === profileId &&
      parsed.handle === handle &&
      typeof parsed.skippedAt === "string" &&
      parsed.skippedAt.length > 0
    );
  } catch {
    return false;
  }
}

function writeProfileSpotifyPromptSkip(
  key: string,
  skip: ProfileSpotifyPromptSkip,
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(skip));
  } catch {
    // If localStorage is unavailable, the current skip still applies to this view.
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
    profile.links
      .map(profileModuleLinkFromConnection)
      .filter((link): link is ProfileModuleLink => link !== undefined),
  );
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

function profileModuleLinkFromConnection(
  connection: ProfileExternalConnection,
): ProfileModuleLink | undefined {
  if (!connection.url) {
    return undefined;
  }

  return {
    label:
      connection.platform === "website"
        ? connection.label
        : connection.label || connectionPlatformLabel(connection.platform),
    platform: connection.platform,
    url: connection.url,
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

type ProfileTransitionEditorProps = {
  autosaveError?: string | undefined;
  autosaveState: ProfileContentAutosaveState;
  backgroundBlur: ProfileBackgroundBlur;
  busy: boolean;
  editing: boolean;
  error?: string | undefined;
  profile: Profile;
  uploading?: "backgroundImage" | "backgroundVideo" | "avatar" | "banner" | undefined;
  onBackgroundBlurChange: (blur: ProfileBackgroundBlur) => void;
  onCancel: () => void;
  onEdit: () => void;
  onClearBackground: () => void;
  onImageUpload: (
    file: File,
    purpose: "avatar" | "banner" | "profile_background",
  ) => void;
  onProfileDraftChange: (updater: (profile: Profile) => Profile) => void;
  onVideoUpload: (file: File) => void;
};

function ProfileTransitionEditor({
  autosaveError,
  autosaveState,
  backgroundBlur,
  busy,
  editing,
  error,
  onBackgroundBlurChange,
  onCancel,
  onEdit,
  onClearBackground,
  onImageUpload,
  onProfileDraftChange,
  onVideoUpload,
  profile,
  uploading,
}: ProfileTransitionEditorProps) {
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
          data-testid="profile-edit-button"
          icon={<Settings2 aria-hidden="true" size={16} />}
          onClick={onEdit}
        >
          {busy ? "Opening" : "Edit profile"}
        </Button>
      </div>
    );
  }

  return (
    <section
      aria-label="Profile editor"
      className="rounded-panel border border-line bg-surface/82 p-3 shadow-soft backdrop-blur-veil sm:p-4"
      data-testid="profile-editor"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-muted">Profile</p>
            <h2 className="truncate text-base font-semibold text-text">
              Edit profile
            </h2>
            <p className="mt-1 text-sm leading-5 text-muted">
              Edit the profile identity and media shown publicly.
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy}
          icon={<X aria-hidden="true" size={16} />}
          onClick={onCancel}
        >
          Close
        </Button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.8fr)]">
        <ProfileIdentityEditorFields
          autosaveError={autosaveError}
          autosaveState={autosaveState}
          onImageUpload={onImageUpload}
          onProfileDraftChange={onProfileDraftChange}
          profile={profile}
        />
        <div className="space-y-3">
          <ProfileAppearanceControls
            profile={profile}
            onProfileDraftChange={onProfileDraftChange}
          />
          <ProfileCanvasBackgroundControls
            backgroundBlur={backgroundBlur}
            profile={profile}
            uploading={uploading}
            onBackgroundBlurChange={onBackgroundBlurChange}
            onClear={onClearBackground}
            onImageUpload={(file) => onImageUpload(file, "profile_background")}
            onVideoUpload={onVideoUpload}
          />
          {error ? (
            <p
              className="rounded-card border border-rose/30 bg-rose/12 p-3 text-sm font-medium text-rose-ink"
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ProfileIdentityEditorFields({
  autosaveError,
  autosaveState,
  onImageUpload,
  onProfileDraftChange,
  profile,
}: {
  autosaveError?: string | undefined;
  autosaveState: ProfileContentAutosaveState;
  onImageUpload: (
    file: File,
    purpose: "avatar" | "banner" | "profile_background",
  ) => void;
  onProfileDraftChange: (updater: (profile: Profile) => Profile) => void;
  profile: Profile;
}) {
  return (
    <div className="min-w-0 space-y-3" data-testid="profile-identity-editor">
      <ProfileInfoAutosaveStatus error={autosaveError} state={autosaveState} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold uppercase text-muted">
          Name
          <input
            className="mt-1 h-10 w-full rounded-control border border-line bg-canvas/55 px-3 text-sm font-semibold normal-case text-text focus-visible:outline-2 focus-visible:outline-focus"
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
            className="mt-1 h-10 w-full rounded-control border border-line bg-canvas/55 px-3 text-sm font-semibold normal-case text-text focus-visible:outline-2 focus-visible:outline-focus"
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
        <label className="text-xs font-semibold uppercase text-muted sm:col-span-2">
          Bio
          <MentionTextarea
            className="mt-1 min-h-24 w-full resize-y rounded-control border border-line bg-canvas/55 px-3 py-2 text-sm font-medium normal-case text-text focus-visible:outline-2 focus-visible:outline-focus"
            value={profile.bio}
            data-testid="profile-info-bio-input"
            onValueChange={(bio) =>
              onProfileDraftChange((current) => ({
                ...current,
                bio,
              }))
            }
          />
        </label>
        <label className="inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-control border border-line bg-canvas/55 px-2.5 text-xs font-semibold text-text transition hover:border-line-strong focus-within:outline-2 focus-within:outline-focus">
          <ImagePlus aria-hidden="true" size={14} />
          Avatar
          <input
            className="sr-only"
            type="file"
            accept={imageUploadAccept}
            data-testid="profile-info-avatar-input"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) {
                onImageUpload(file, "avatar");
              }
              event.currentTarget.value = "";
            }}
          />
        </label>
        <label className="inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-control border border-line bg-canvas/55 px-2.5 text-xs font-semibold text-text transition hover:border-line-strong focus-within:outline-2 focus-within:outline-focus">
          <ImagePlus aria-hidden="true" size={14} />
          Banner
          <input
            className="sr-only"
            type="file"
            accept={imageUploadAccept}
            data-testid="profile-info-banner-input"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) {
                onImageUpload(file, "banner");
              }
              event.currentTarget.value = "";
            }}
          />
        </label>
      </div>
    </div>
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
          className="absolute left-0 top-full z-20 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-card border border-line bg-surface/95 p-3 shadow-lift backdrop-blur-veil"
          role="dialog"
          aria-label="Background settings"
          data-testid="profile-canvas-background-popover"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text">Background</p>
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
          <div className="mt-3 grid grid-cols-3 gap-2">
            <label
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-control border border-line bg-surface/68 px-2 text-sm font-semibold text-text transition duration-fluid ease-fluid hover:border-line-strong focus-within:outline-2 focus-within:outline-focus"
              data-profile-edit-control="true"
              title="Choose image"
            >
              <ImagePlus aria-hidden="true" size={16} />
              <span className="truncate">
                {uploading === "backgroundImage" ? "Uploading" : "Image"}
              </span>
              <input
                className="sr-only"
                type="file"
                accept={imageUploadAccept}
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
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-control border border-line bg-surface/68 px-2 text-sm font-semibold text-text transition duration-fluid ease-fluid hover:border-line-strong focus-within:outline-2 focus-within:outline-focus"
              data-profile-edit-control="true"
              title="Choose video"
            >
              <Video aria-hidden="true" size={16} />
              <span className="truncate">
                {uploading === "backgroundVideo" ? "Uploading" : "Video"}
              </span>
              <input
                className="sr-only"
                type="file"
                accept={videoUploadAccept}
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
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-line bg-canvas/55 px-2 text-sm font-semibold text-muted transition duration-fluid ease-fluid hover:border-line-strong hover:text-text focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50"
              data-profile-edit-control="true"
              title="Clear background"
              disabled={!hasBackground || Boolean(uploading)}
              onClick={() => {
                onClear();
                setOpen(false);
              }}
            >
              <Trash2 aria-hidden="true" size={16} />
              <span className="truncate">Clear</span>
            </button>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase text-muted">
                Clarity
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
                  className="min-w-0 rounded-control px-1.5 py-1.5 text-xs font-semibold text-muted transition duration-fluid ease-fluid hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-focus aria-pressed:bg-surface aria-pressed:text-text"
                  aria-pressed={backgroundBlur === blur}
                  aria-label={`Set background clarity to ${blurLabel(blur)}`}
                  data-profile-edit-control="true"
                  data-testid={`profile-background-blur-${blur}`}
                  onClick={() => {
                    onBackgroundBlurChange(blur);
                    setOpen(false);
                  }}
                >
                  {blurShortLabel(blur)}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProfileAppearanceControls({
  profile,
  onProfileDraftChange,
}: {
  profile: Profile;
  onProfileDraftChange: (updater: (profile: Profile) => Profile) => void;
}) {
  function applyThemeConfig(config: ProfileThemeConfig | null) {
    onProfileDraftChange((currentProfile) => ({
      ...currentProfile,
      profileAccent:
        config?.mode === "custom"
          ? "custom"
          : config?.mode === "preset"
            ? config.preset
            : null,
      profileTheme:
        config?.mode === "preset"
          ? config.preset
          : config?.mode === "custom"
            ? "custom"
            : null,
      profileThemeConfig: config,
    }));
  }

  return (
    <ThemeAppearanceControl
      config={profile.profileThemeConfig}
      controlAttribute="data-profile-edit-control"
      description="Override Sunveil/Frostveil while people view your profile."
      label="Appearance"
      previewTitle={profile.user.displayName}
      previewSubtitle={`@${profile.user.handle}`}
      previewLinkLabel="Profile link"
      testIdKind="profile"
      onChange={applyThemeConfig}
    />
  );
}

function blurLabel(blur: ProfileBackgroundBlur): string {
  return blur === "none" ? "None" : blur[0]!.toUpperCase() + blur.slice(1);
}

function blurShortLabel(blur: ProfileBackgroundBlur): string {
  if (blur === "medium") {
    return "Med";
  }

  return blurLabel(blur);
}

function profileCanvasCells(
  columns = PROFILE_CANVAS_COLUMNS,
  rows = PROFILE_CANVAS_ROWS,
): CanvasPoint[] {
  const cells: CanvasPoint[] = [];

  for (let row = 1; row <= rows; row += 1) {
    for (let column = 1; column <= columns; column += 1) {
      cells.push({ column, row });
    }
  }

  return cells;
}

function profileCanvasRectFromPoints(
  first: CanvasPoint,
  second: CanvasPoint,
): ProfileModuleLayout {
  const column = Math.min(first.column, second.column);
  const row = Math.min(first.row, second.row);
  const colSpan = Math.abs(first.column - second.column) + 1;
  const rowSpan = Math.abs(first.row - second.row) + 1;

  return {
    column,
    row,
    colSpan,
    rowSpan,
  };
}

function profileCanvasPointInRect(
  point: CanvasPoint,
  rect: ProfileModuleLayout,
): boolean {
  return (
    point.column >= rect.column &&
    point.column < rect.column + rect.colSpan &&
    point.row >= rect.row &&
    point.row < rect.row + rect.rowSpan
  );
}

function profileCanvasRectsOverlap(
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

function profileCanvasModulePriority(module: ProfileModule): number {
  if (module.type === "profile_info") {
    return 0;
  }

  if (module.type === "activity") {
    return 2;
  }

  return 1;
}

function profileCanvasSortDraftModules(modules: ProfileModule[]): ProfileModule[] {
  return [...modules].sort((first, second) => {
    const priority = profileCanvasModulePriority(first) - profileCanvasModulePriority(second);

    if (priority !== 0) {
      return priority;
    }

    const firstLayout = first.layout ?? profileCanvasDefaultClientLayout(first, 0);
    const secondLayout = second.layout ?? profileCanvasDefaultClientLayout(second, 0);

    return (
      firstLayout.row - secondLayout.row ||
      firstLayout.column - secondLayout.column ||
      first.position - second.position ||
      first.id - second.id
    );
  });
}

function useProfileCanvasEditorGridProjection(): {
  columns: 6 | 12;
  rows: 16 | 32;
  mobile: boolean;
} {
  const [mobile, setMobile] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia("(max-width: 1023px)").matches,
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const syncProjection = () => setMobile(mediaQuery.matches);

    syncProjection();
    mediaQuery.addEventListener("change", syncProjection);

    return () => mediaQuery.removeEventListener("change", syncProjection);
  }, []);

  return mobile
    ? {
        columns: PROFILE_CANVAS_MOBILE_COLUMNS,
        rows: PROFILE_CANVAS_MOBILE_ROWS,
        mobile,
      }
    : {
        columns: PROFILE_CANVAS_COLUMNS,
        rows: PROFILE_CANVAS_ROWS,
        mobile,
      };
}

function profileCanvasDesktopPointFromEditorPoint(
  point: CanvasPoint,
  mobile: boolean,
): CanvasPoint {
  if (!mobile) {
    return point;
  }

  const mobileRow = Math.min(
    PROFILE_CANVAS_MOBILE_ROWS,
    Math.max(1, point.row),
  );
  const desktopRow = Math.min(
    PROFILE_CANVAS_ROWS,
    Math.floor((mobileRow - 1) / 2) + 1,
  );
  const desktopColumn = Math.min(
    PROFILE_CANVAS_COLUMNS,
    Math.max(
      1,
      point.column + (mobileRow % 2 === 0 ? PROFILE_CANVAS_MOBILE_COLUMNS : 0),
    ),
  );

  return {
    column: desktopColumn,
    row: desktopRow,
  };
}

function profileCanvasEditorCellKeyFromDesktopPoint(
  point: CanvasPoint,
  mobile: boolean,
): string {
  if (!mobile) {
    return `${point.column}:${point.row}`;
  }

  const leftHalf = point.column <= PROFILE_CANVAS_MOBILE_COLUMNS;
  const column = leftHalf
    ? point.column
    : point.column - PROFILE_CANVAS_MOBILE_COLUMNS;
  const row = (point.row - 1) * 2 + (leftHalf ? 1 : 2);

  return `${column}:${row}`;
}

function profileCanvasOccupiedEditorCellKeysForLayout(
  layout: ProfileModuleLayout,
  mobile: boolean,
): Set<string> {
  const occupied = new Set<string>();

  for (let row = layout.row; row < layout.row + layout.rowSpan; row += 1) {
    for (
      let column = layout.column;
      column < layout.column + layout.colSpan;
      column += 1
    ) {
      occupied.add(
        profileCanvasEditorCellKeyFromDesktopPoint({ column, row }, mobile),
      );
    }
  }

  return occupied;
}

function profileCanvasDesktopRectFromEditorPoints(
  first: CanvasPoint,
  second: CanvasPoint,
  mobile: boolean,
): ProfileModuleLayout {
  return profileCanvasRectFromPoints(
    profileCanvasDesktopPointFromEditorPoint(first, mobile),
    profileCanvasDesktopPointFromEditorPoint(second, mobile),
  );
}

function profileCanvasDefaultClientLayout(
  module: ProfileModule,
  index: number,
): ProfileModuleLayout {
  const span = profileGridModuleSizeSpan(
    module.config.canvasSize ?? getProfileModuleDefinition(module.type).defaultSize,
  );

  return {
    column: module.type === "profile_info" ? 3 : 1,
    row:
      module.type === "profile_info"
        ? 1
        : module.type === "activity"
          ? 4
          : index + 1,
    colSpan: span.columns,
    rowSpan: span.rows,
  };
}

function profileCanvasLayoutFromPointer(
  grid: HTMLDivElement,
  clientX: number,
  clientY: number,
  colSpan: number,
  rowSpan: number,
  pointerOffsetX: number,
  pointerOffsetY: number,
  mobile = false,
): ProfileModuleLayout {
  const rect = grid.getBoundingClientRect();
  const styles = window.getComputedStyle(grid);
  const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
  const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
  const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
  const columnGap = Number.parseFloat(styles.columnGap) || 0;
  const rowGap = Number.parseFloat(styles.rowGap) || columnGap;
  const contentWidth = Math.max(1, grid.clientWidth - paddingLeft - paddingRight);
  const activeColumns = mobile
    ? PROFILE_CANVAS_MOBILE_COLUMNS
    : PROFILE_CANVAS_COLUMNS;
  const cellSize = Math.max(
    1,
    (contentWidth - columnGap * (activeColumns - 1)) / activeColumns,
  );
  const stepX = cellSize + columnGap;
  const stepY = cellSize + rowGap;
  const moduleLeft = clientX - pointerOffsetX;
  const moduleTop = clientY - pointerOffsetY;
  const rawColumn = Math.round((moduleLeft - rect.left - paddingLeft) / stepX) + 1;
  const rawRow = Math.round((moduleTop - rect.top - paddingTop) / stepY) + 1;
  const point = mobile
    ? profileCanvasDesktopPointFromEditorPoint(
        {
          column: Math.min(
            PROFILE_CANVAS_MOBILE_COLUMNS,
            Math.max(1, rawColumn),
          ),
          row: Math.min(PROFILE_CANVAS_MOBILE_ROWS, Math.max(1, rawRow)),
        },
        true,
      )
    : {
        column: rawColumn,
        row: rawRow,
      };

  return {
    column: Math.min(
      PROFILE_CANVAS_COLUMNS - colSpan + 1,
      Math.max(1, point.column),
    ),
    row: Math.min(PROFILE_CANVAS_ROWS - rowSpan + 1, Math.max(1, point.row)),
    colSpan,
    rowSpan,
  };
}

function profileCanvasEditorPointFromPointer(
  grid: HTMLDivElement,
  clientX: number,
  clientY: number,
  mobile = false,
): CanvasPoint {
  const rect = grid.getBoundingClientRect();
  const styles = window.getComputedStyle(grid);
  const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
  const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
  const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
  const columnGap = Number.parseFloat(styles.columnGap) || 0;
  const rowGap = Number.parseFloat(styles.rowGap) || columnGap;
  const contentWidth = Math.max(1, grid.clientWidth - paddingLeft - paddingRight);
  const activeColumns = mobile
    ? PROFILE_CANVAS_MOBILE_COLUMNS
    : PROFILE_CANVAS_COLUMNS;
  const cellSize = Math.max(
    1,
    (contentWidth - columnGap * (activeColumns - 1)) / activeColumns,
  );
  const stepX = cellSize + columnGap;
  const stepY = cellSize + rowGap;
  const rawColumn =
    Math.round((clientX - rect.left - paddingLeft) / stepX) + 1;
  const rawRow = Math.round((clientY - rect.top - paddingTop) / stepY) + 1;
  const editorPoint = {
    column: Math.min(activeColumns, Math.max(1, rawColumn)),
    row: Math.min(
      mobile ? PROFILE_CANVAS_MOBILE_ROWS : PROFILE_CANVAS_ROWS,
      Math.max(1, rawRow),
    ),
  };

  return mobile
    ? profileCanvasDesktopPointFromEditorPoint(editorPoint, true)
    : editorPoint;
}

function profileCanvasResizeLayoutFromPointer(
  grid: HTMLDivElement,
  clientX: number,
  clientY: number,
  startLayout: ProfileModuleLayout,
  direction: ProfileCanvasResizeDirection,
  type: ProfileModule["type"],
  mobile = false,
): { layout: ProfileModuleLayout; size: ProfileGridModuleSize } {
  const point = profileCanvasEditorPointFromPointer(grid, clientX, clientY, mobile);
  const startEndColumn = startLayout.column + startLayout.colSpan - 1;
  const startEndRow = startLayout.row + startLayout.rowSpan - 1;
  const rawColumn =
    direction.includes("west")
      ? Math.min(startEndColumn, Math.max(1, point.column))
      : startLayout.column;
  const rawEndColumn =
    direction.includes("east")
      ? Math.max(startLayout.column, Math.min(PROFILE_CANVAS_COLUMNS, point.column))
      : startEndColumn;
  const rawRow =
    direction.includes("north")
      ? Math.min(startEndRow, Math.max(1, point.row))
      : startLayout.row;
  const rawEndRow =
    direction.includes("south")
      ? Math.max(startLayout.row, Math.min(PROFILE_CANVAS_ROWS, point.row))
      : startEndRow;
  const rawLayout = {
    column: rawColumn,
    row: rawRow,
    colSpan: Math.max(1, rawEndColumn - rawColumn + 1),
    rowSpan: Math.max(1, rawEndRow - rawRow + 1),
  };

  return profileCanvasNearestResizeLayout(type, startLayout, rawLayout, direction);
}

function profileCanvasNearestResizeLayout(
  type: ProfileModule["type"],
  startLayout: ProfileModuleLayout,
  rawLayout: ProfileModuleLayout,
  direction: ProfileCanvasResizeDirection,
): { layout: ProfileModuleLayout; size: ProfileGridModuleSize } {
  const horizontalOnly =
    (direction === "east" || direction === "west") &&
    !direction.includes("north") &&
    !direction.includes("south");
  const verticalOnly =
    (direction === "north" || direction === "south") &&
    !direction.includes("east") &&
    !direction.includes("west");
  const startEndColumn = startLayout.column + startLayout.colSpan - 1;
  const startEndRow = startLayout.row + startLayout.rowSpan - 1;
  const candidates = profileModuleAllowedSizes(type)
    .map((size) => {
      const span = profileGridModuleSizeSpan(size);
      const column = direction.includes("west")
        ? startEndColumn - span.columns + 1
        : startLayout.column;
      const row = direction.includes("north")
        ? startEndRow - span.rows + 1
        : startLayout.row;
      const layout = {
        column,
        row,
        colSpan: span.columns,
        rowSpan: span.rows,
      };

      return { layout, size };
    })
    .filter(({ layout }) =>
      layout.column >= 1 &&
      layout.row >= 1 &&
      layout.column + layout.colSpan - 1 <= PROFILE_CANVAS_COLUMNS &&
      layout.row + layout.rowSpan - 1 <= PROFILE_CANVAS_ROWS
    );
  const fallbackSize =
    profileGridModuleSpanSize(startLayout.colSpan, startLayout.rowSpan) ??
    getProfileModuleDefinition(type).defaultSize;
  const fallback = {
    layout: startLayout,
    size: fallbackSize,
  };

  return (
    candidates.sort((first, second) => {
      const firstScore = profileCanvasResizeCandidateScore(
        first.layout,
        rawLayout,
        startLayout,
        horizontalOnly,
        verticalOnly,
      );
      const secondScore = profileCanvasResizeCandidateScore(
        second.layout,
        rawLayout,
        startLayout,
        horizontalOnly,
        verticalOnly,
      );

      return firstScore - secondScore;
    })[0] ?? fallback
  );
}

function profileCanvasResizeCandidateScore(
  layout: ProfileModuleLayout,
  rawLayout: ProfileModuleLayout,
  startLayout: ProfileModuleLayout,
  horizontalOnly: boolean,
  verticalOnly: boolean,
): number {
  return (
    Math.abs(layout.colSpan - rawLayout.colSpan) * 12 +
    Math.abs(layout.rowSpan - rawLayout.rowSpan) * 12 +
    Math.abs(layout.column - rawLayout.column) * 3 +
    Math.abs(layout.row - rawLayout.row) * 3 +
    (horizontalOnly && layout.rowSpan !== startLayout.rowSpan ? 100 : 0) +
    (verticalOnly && layout.colSpan !== startLayout.colSpan ? 100 : 0)
  );
}

type ProfileCanvasSelectionFit = {
  enabled: boolean;
  exactSize?: ProfileGridModuleSize | undefined;
  noteSize?: ProfileGridModuleSize | undefined;
  sortSize: ProfileGridModuleSize;
  warning?: "too-large" | "too-small" | undefined;
};

type ProfileCanvasSelectionExample = {
  category: ProfileModuleCategory;
  label: string;
  type: ProfileModule["type"];
};

const profileCanvasSelectionExampleLimit = 4;
const profileCanvasSelectionExampleCategoryPriority: Record<
  ProfileModuleCategory,
  number
> = {
  music: 0,
  info: 1,
  images: 2,
  video: 3,
  projects: 4,
};
const profileCanvasSelectionExampleTypePriority: Partial<
  Record<ProfileModule["type"], number>
> = {
  music: 0,
  text: 1,
  uploaded_image: 2,
  twitch_channel: 3,
  uploaded_video: 4,
  youtube_video: 5,
  activity: 6,
  connections: 7,
  badge_display: 8,
  featured_room: 9,
  featured_post: 10,
  github_repo: 11,
};

function profileCanvasAllowedSizesByArea(
  type: ProfileModule["type"],
): ProfileGridModuleSize[] {
  return [...profileModuleAllowedSizes(type)].sort((first, second) => {
    const firstSpan = profileGridModuleSizeSpan(first);
    const secondSpan = profileGridModuleSizeSpan(second);

    return (
      firstSpan.columns * firstSpan.rows -
        secondSpan.columns * secondSpan.rows ||
      firstSpan.columns - secondSpan.columns ||
      firstSpan.rows - secondSpan.rows
    );
  });
}

function profileCanvasSelectionSize(
  selection: ProfileModuleLayout,
): ProfileGridModuleSize | undefined {
  return profileGridModuleSpanSize(
    Math.min(PROFILE_CANVAS_PROFILE_INFO_COLUMNS, selection.colSpan),
    Math.min(PROFILE_CANVAS_ACTIVITY_MAX_MODULE_ROWS, selection.rowSpan),
  );
}

function profileCanvasExactSizeForSelection(
  type: ProfileModule["type"],
  selection: ProfileModuleLayout,
): ProfileGridModuleSize | undefined {
  const selectionSize = profileCanvasSelectionSize(selection);

  if (selectionSize && profileModuleAllowedSizes(type).includes(selectionSize)) {
    return selectionSize;
  }

  return undefined;
}

function profileCanvasFitForSelection(
  type: ProfileModule["type"],
  selection: ProfileModuleLayout,
): ProfileCanvasSelectionFit {
  const allowedSizes = profileCanvasAllowedSizesByArea(type);
  const fallbackSize = getProfileModuleDefinition(type).defaultSize;
  const smallestSize = allowedSizes[0] ?? fallbackSize;
  const largestSize = allowedSizes[allowedSizes.length - 1] ?? fallbackSize;
  const exactSize = profileCanvasExactSizeForSelection(type, selection);

  if (exactSize) {
    return {
      enabled: true,
      exactSize,
      sortSize: exactSize,
    };
  }

  const smallestSpan = profileGridModuleSizeSpan(smallestSize);
  const largestSpan = profileGridModuleSizeSpan(largestSize);
  const allowedSpans = allowedSizes.map(profileGridModuleSizeSpan);
  const minColumns = Math.min(...allowedSpans.map((span) => span.columns));
  const minRows = Math.min(...allowedSpans.map((span) => span.rows));
  const maxColumns = Math.max(...allowedSpans.map((span) => span.columns));
  const maxRows = Math.max(...allowedSpans.map((span) => span.rows));
  const selectionArea = selection.colSpan * selection.rowSpan;
  const smallestArea = smallestSpan.columns * smallestSpan.rows;
  const largestArea = largestSpan.columns * largestSpan.rows;
  const warning =
    selectionArea < smallestArea ||
    selection.colSpan < minColumns ||
    selection.rowSpan < minRows
      ? "too-small"
      : selectionArea > largestArea ||
          selection.colSpan > maxColumns ||
          selection.rowSpan > maxRows
        ? "too-large"
        : "too-large";

  return {
    enabled: false,
    noteSize: warning === "too-small" ? smallestSize : largestSize,
    sortSize: warning === "too-small" ? smallestSize : largestSize,
    warning,
  };
}

function profileCanvasSelectionExampleRank(type: ProfileModule["type"]): number {
  return profileCanvasSelectionExampleTypePriority[type] ?? 100;
}

function profileCanvasSelectionExamples(
  selection: ProfileModuleLayout,
): ProfileCanvasSelectionExample[] {
  const ranked = profileModuleCatalog
    .map((item) => ({
      ...item,
      fit: profileCanvasFitForSelection(item.type, selection),
    }))
    .filter((item) => item.fit.exactSize)
    .sort(
      (first, second) =>
        profileCanvasSelectionExampleRank(first.type) -
          profileCanvasSelectionExampleRank(second.type) ||
        profileCanvasSelectionExampleCategoryPriority[first.category] -
          profileCanvasSelectionExampleCategoryPriority[second.category] ||
        first.label.localeCompare(second.label),
    );
  const picked: ProfileCanvasSelectionExample[] = [];
  const usedCategories = new Set<ProfileModuleCategory>();

  for (const item of ranked) {
    if (usedCategories.has(item.category)) {
      continue;
    }

    picked.push({
      category: item.category,
      label: profileModulePickerLabel(item.type),
      type: item.type,
    });
    usedCategories.add(item.category);

    if (picked.length >= profileCanvasSelectionExampleLimit) {
      return picked;
    }
  }

  for (const item of ranked) {
    if (picked.some((example) => example.type === item.type)) {
      continue;
    }

    picked.push({
      category: item.category,
      label: profileModulePickerLabel(item.type),
      type: item.type,
    });

    if (picked.length >= profileCanvasSelectionExampleLimit) {
      break;
    }
  }

  return picked;
}

function profileCanvasDefaultConfigForModule(
  type: ProfileModule["type"],
  size: ProfileGridModuleSize,
  integrationLinks: ProfileModuleLink[] = [],
): ProfileModule["config"] {
  const definition = getProfileModuleDefinition(type);
  const base = {
    canvasSize: size,
    configured: profileCanvasModuleIsIntrinsicallyConfigured(type),
  };

  if (type === "connections" || type === "links") {
    return profileCanvasConfigWithIntegrationLinks(
      { ...base, links: [] },
      integrationLinks,
    );
  }

  if (type === "badge_display" || type === "featured_badges") {
    return { ...base, userBadgeIds: [] };
  }

  if (definition.category === "images") {
    return { ...base, mediaItems: [] };
  }

  if (definition.category === "video") {
    if (type === "uploaded_video") {
      return { ...base, sourceMode: "upload" };
    }

    return {
      ...base,
      platform: type.startsWith("youtube") ? "youtube" : "twitch",
      sourceMode: type.startsWith("youtube") ? "youtube" : "twitch",
    };
  }

  if (definition.category === "music") {
    if (type === "music") {
      return { ...base, platform: "custom", sourceMode: "upload" };
    }

    const provider = type.startsWith("apple")
      ? "apple_music"
      : type.startsWith("youtube")
        ? "youtube_music"
        : "spotify";

    return { ...base, platform: provider, sourceMode: provider };
  }

  if (type === "github_repo") {
    return { ...base, platform: "github", sourceMode: "github", displayMode: "project" };
  }

  return base;
}

function profileCanvasModuleIsIntrinsicallyConfigured(
  type: ProfileModule["type"],
): boolean {
  return (
    type === "profile_info" ||
    type === "activity" ||
    type === "featured_post" ||
    type === "featured_room"
  );
}

function profileCanvasModuleIsConfiguredForEditor(module: ProfileModule): boolean {
  if (module.type === "placeholder") {
    return false;
  }

  return (
    profileCanvasModuleIsIntrinsicallyConfigured(module.type) ||
    module.config.configured !== false
  );
}

type ProfileCanvasAutofillConfig = {
  config: ProfileModule["config"];
  resolve?: {
    provider?: ProfileIntegrationProvider;
    url: string;
  };
};

function profileCanvasAutofillConfigForModule(
  type: ProfileModule["type"],
  size: ProfileGridModuleSize,
  baseConfig: ProfileModule["config"],
  integrationAccounts: ProfileIntegrationAccount[],
): ProfileCanvasAutofillConfig {
  if (type !== "twitch_channel") {
    return { config: baseConfig };
  }

  const account = profileCanvasConnectedIntegrationAccount(
    integrationAccounts,
    "twitch",
  );
  const sourceUrl = account
    ? profileCanvasIntegrationAccountUrl(account)
    : undefined;

  if (!sourceUrl || !account) {
    return { config: baseConfig };
  }

  const label =
    account.displayName ??
    profileCanvasIntegrationAccountHandle(account) ??
    "Twitch stream";
  const config = {
    ...baseConfig,
    configured: true,
    displayMode: profileCanvasTwitchDisplayModeForSize(size),
    label,
    platform: "twitch",
    sourceMode: "twitch",
    url: sourceUrl,
  };

  return {
    config,
    resolve: {
      provider: "twitch",
      url: sourceUrl,
    },
  };
}

function profileCanvasConfigWithIntegrationCard(
  config: ProfileModule["config"],
  card: ProfileIntegrationCard,
): ProfileModule["config"] {
  const nextConfig: ProfileModule["config"] = {
    ...config,
    configured: true,
    integration: card,
    platform: card.provider,
    url: card.sourceUrl,
  };

  if (card.metadata.description) {
    nextConfig.description = card.metadata.description;
  }

  if (card.metadata.title) {
    nextConfig.label = card.metadata.title;
  }

  return nextConfig;
}

function profileCanvasTwitchDisplayModeForSize(
  size: ProfileGridModuleSize,
): "stream_status" | "stream" | "stream_chat" {
  const span = profileGridModuleSizeSpan(size);

  if (span.columns >= 6 && span.rows >= 4) {
    return "stream_chat";
  }

  if (span.columns >= 4 && span.rows >= 3) {
    return "stream";
  }

  return "stream_status";
}

function profileCanvasConnectedIntegrationAccount(
  integrationAccounts: ProfileIntegrationAccount[],
  provider: ProfileIntegrationProvider,
): ProfileIntegrationAccount | undefined {
  return integrationAccounts.find(
    (account) => account.provider === provider && !account.revokedAt,
  );
}

function profileCanvasConnectionLinksFromIntegrationAccounts(
  integrationAccounts: ProfileIntegrationAccount[],
): ProfileModuleLink[] {
  return integrationAccounts
    .filter((account) => !account.revokedAt)
    .map(profileCanvasConnectionLinkFromIntegrationAccount)
    .filter((link): link is ProfileModuleLink => Boolean(link));
}

function profileCanvasConnectionLinkFromIntegrationAccount(
  account: ProfileIntegrationAccount,
): ProfileModuleLink | undefined {
  const url = profileCanvasIntegrationAccountUrl(account);

  if (!url) {
    return undefined;
  }

  return {
    label:
      account.displayName ??
      profileCanvasIntegrationAccountHandle(account) ??
      profileCanvasProviderLabel(account.provider),
    platform: profileCanvasConnectionPlatformForProvider(account.provider),
    url,
  };
}

function profileCanvasIntegrationAccountUrl(
  account: ProfileIntegrationAccount,
): string | undefined {
  const handle = profileCanvasIntegrationAccountHandle(account);

  if (account.provider === "github" && handle) {
    return `https://github.com/${encodeURIComponent(handle.replace(/^@/, ""))}`;
  }

  if (account.provider === "twitch" && handle) {
    return `https://www.twitch.tv/${encodeURIComponent(handle.replace(/^@/, ""))}`;
  }

  if (account.provider === "youtube") {
    const rawHandle = account.providerHandle?.trim();

    if (rawHandle && /^@[A-Za-z0-9_.-]+$/.test(rawHandle)) {
      return `https://www.youtube.com/${rawHandle}`;
    }

    if (account.providerAccountId) {
      return `https://www.youtube.com/channel/${encodeURIComponent(
        account.providerAccountId,
      )}`;
    }
  }

  if (account.provider === "spotify" && account.providerAccountId) {
    return `https://open.spotify.com/user/${encodeURIComponent(
      account.providerAccountId,
    )}`;
  }

  return undefined;
}

function profileCanvasIntegrationAccountHandle(
  account: ProfileIntegrationAccount,
): string | undefined {
  const handle = account.providerHandle?.trim() || account.displayName?.trim();

  if (handle) {
    return handle;
  }

  return account.providerAccountId?.trim() || undefined;
}

function profileCanvasProviderLabel(provider: ProfileIntegrationProvider): string {
  const labels: Record<ProfileIntegrationProvider, string> = {
    apple_music: "Apple Music",
    github: "GitHub",
    spotify: "Spotify",
    twitch: "Twitch",
    youtube: "YouTube",
  };

  return labels[provider];
}

function profileIntegrationProviderFromParam(
  value: string | null,
): ProfileIntegrationProvider | undefined {
  return value === "spotify" ||
    value === "apple_music" ||
    value === "youtube" ||
    value === "twitch" ||
    value === "github"
    ? value
    : undefined;
}

function profileCanvasConnectionPlatformForProvider(
  provider: ProfileIntegrationProvider,
): string {
  return provider === "apple_music" ? "website" : provider;
}

function profileCanvasModulesWithIntegrationLinks(
  modules: ProfileModule[],
  integrationLinks: ProfileModuleLink[],
): ProfileModule[] {
  if (integrationLinks.length === 0) {
    return modules;
  }

  let changed = false;
  const nextModules = modules.map((module) => {
    if (module.type !== "connections" && module.type !== "links") {
      return module;
    }

    const config = profileCanvasConfigWithIntegrationLinks(
      module.config,
      integrationLinks,
    );

    if (config === module.config) {
      return module;
    }

    changed = true;

    return {
      ...module,
      config,
      visibility: config.configured === false ? module.visibility : "public",
    };
  });

  return changed ? nextModules : modules;
}

function profileCanvasConfigWithIntegrationLinks(
  config: ProfileModule["config"],
  integrationLinks: ProfileModuleLink[],
): ProfileModule["config"] {
  if (integrationLinks.length === 0) {
    return config;
  }

  const links = [...(config.links ?? [])];
  const seen = new Set(links.map(profileCanvasConnectionLinkKey));
  let changed = false;

  integrationLinks.forEach((link) => {
    const key = profileCanvasConnectionLinkKey(link);

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    links.push(link);
    changed = true;
  });

  if (!changed) {
    return config;
  }

  const nextConfig: ProfileModule["config"] = {
    ...config,
    links,
  };

  if (links.length > 0) {
    nextConfig.configured = true;
  }

  return nextConfig;
}

function profileCanvasConnectionLinkKey(link: ProfileModuleLink): string {
  return `${link.platform ?? "website"}:${link.url.toLowerCase()}`;
}

function profileCanvasProviderForModule(
  type: ProfileModule["type"],
): ProfileIntegrationProvider | undefined {
  if (type === "github_repo") {
    return "github";
  }

  if (type === "twitch_channel") {
    return "twitch";
  }

  if (type.startsWith("youtube_")) {
    return "youtube";
  }

  if (type.startsWith("spotify_")) {
    return "spotify";
  }

  if (type.startsWith("apple_music_")) {
    return "apple_music";
  }

  return undefined;
}

function profileCanvasResolveDraftCollisions(
  modules: ProfileModule[],
  anchorModuleId?: number,
): ProfileModule[] {
  const occupied = new Set<string>();
  const result = new Map<number, ProfileModule>();
  const active = [...modules]
    .filter((module) => module.status !== "deleted")
    .sort((first, second) => {
      if (first.pinned !== second.pinned) {
        return first.pinned ? -1 : 1;
      }

      if (anchorModuleId !== undefined) {
        if (first.id === anchorModuleId && second.id !== anchorModuleId) {
          return -1;
        }

        if (second.id === anchorModuleId && first.id !== anchorModuleId) {
          return 1;
        }
      }

      const priority = profileCanvasModulePriority(first) - profileCanvasModulePriority(second);

      if (priority !== 0) {
        return priority;
      }

      const firstLayout = first.layout ?? profileCanvasDefaultClientLayout(first, 0);
      const secondLayout = second.layout ?? profileCanvasDefaultClientLayout(second, 0);

      return (
        firstLayout.row - secondLayout.row ||
        firstLayout.column - secondLayout.column ||
        first.position - second.position ||
        first.id - second.id
      );
    });

  active.forEach((module, index) => {
    const requested = profileCanvasClampLayout(
      module.layout ?? profileCanvasDefaultClientLayout(module, index),
      module.type,
    );
    const layout = profileCanvasLayoutFits(requested, occupied)
      ? requested
      : profileCanvasNextAvailableLayout(requested, occupied) ?? requested;

    profileCanvasOccupyLayout(layout, occupied);
    result.set(module.id, { ...module, layout });
  });

  return modules.map((module) => result.get(module.id) ?? module);
}

function profileCanvasClampLayout(
  layout: ProfileModuleLayout,
  type: ProfileModule["type"],
): ProfileModuleLayout {
  const maxSpan = profileCanvasMaxSpanForType(type);
  const colSpan = Math.min(maxSpan.columns, Math.max(1, layout.colSpan));
  const rowSpan = Math.min(maxSpan.rows, Math.max(1, layout.rowSpan));

  return {
    column: Math.min(PROFILE_CANVAS_COLUMNS - colSpan + 1, Math.max(1, layout.column)),
    row: Math.min(PROFILE_CANVAS_ROWS - rowSpan + 1, Math.max(1, layout.row)),
    colSpan,
    rowSpan,
  };
}

function profileCanvasMaxSpanForType(type: ProfileModule["type"]): {
  columns: number;
  rows: number;
} {
  return profileModuleAllowedSizes(type).reduce(
    (max, size) => {
      const span = profileGridModuleSizeSpan(size);

      return {
        columns: Math.max(max.columns, span.columns),
        rows: Math.max(max.rows, span.rows),
      };
    },
    { columns: 1, rows: 1 },
  );
}

function profileCanvasLayoutFits(
  layout: ProfileModuleLayout,
  occupied: Set<string>,
): boolean {
  if (
    layout.column < 1 ||
    layout.row < 1 ||
    layout.column + layout.colSpan - 1 > PROFILE_CANVAS_COLUMNS ||
    layout.row + layout.rowSpan - 1 > PROFILE_CANVAS_ROWS
  ) {
    return false;
  }

  for (let row = layout.row; row < layout.row + layout.rowSpan; row += 1) {
    for (
      let column = layout.column;
      column < layout.column + layout.colSpan;
      column += 1
    ) {
      if (occupied.has(`${column}:${row}`)) {
        return false;
      }
    }
  }

  return true;
}

function profileCanvasResizeBlockedByPinned(
  modules: ProfileModule[],
  moduleId: number,
  layout: ProfileModuleLayout,
): boolean {
  return modules.some((module, index) => {
    if (!module.pinned || module.id === moduleId || module.status === "deleted") {
      return false;
    }

    return profileCanvasRectsOverlap(
      layout,
      module.layout ?? profileCanvasDefaultClientLayout(module, index),
    );
  });
}

function profileCanvasOccupyLayout(
  layout: ProfileModuleLayout,
  occupied: Set<string>,
) {
  for (let row = layout.row; row < layout.row + layout.rowSpan; row += 1) {
    for (
      let column = layout.column;
      column < layout.column + layout.colSpan;
      column += 1
    ) {
      occupied.add(`${column}:${row}`);
    }
  }
}

function profileCanvasNextAvailableLayout(
  layout: ProfileModuleLayout,
  occupied: Set<string>,
): ProfileModuleLayout | undefined {
  const maxColumn = PROFILE_CANVAS_COLUMNS - layout.colSpan + 1;
  const maxRow = PROFILE_CANVAS_ROWS - layout.rowSpan + 1;

  for (let row = 1; row <= maxRow; row += 1) {
    for (let column = 1; column <= maxColumn; column += 1) {
      const candidate = { ...layout, column, row };

      if (profileCanvasLayoutFits(candidate, occupied)) {
        return candidate;
      }
    }
  }

  return undefined;
}

type ProfileDirectCanvasEditorProps = {
  autosaveError?: string | undefined;
  autosaveState: ProfileCanvasDraftAutosaveState;
  busy: boolean;
  draft: ProfileCanvasDraftState;
  error?: string | undefined;
  guideOpen: boolean;
  integrationAccounts: ProfileIntegrationAccount[];
  integrationProviders: ProfileIntegrationProviderStatus[];
  modules: ProfileModule[];
  onBackgroundBlurChange: (blur: ProfileBackgroundBlur) => void;
  onCancel: () => void;
  onCanvasGlassChange: (canvasGlass: number) => void;
  onChange: (updater: (draft: ProfileCanvasDraftState) => ProfileCanvasDraftState) => void;
  onClearBackground: () => void;
  onConnectProvider: (provider: ProfileIntegrationProvider) => void;
  onGuideComplete: () => void;
  onGuideDismiss: () => void;
  onGuideOpen: () => void;
  onModuleAudioUpload: (file: File) => Promise<UploadedAudio>;
  onModuleImagePrepare: (file: File) => Promise<File>;
  onImageUpload: (
    file: File,
    purpose: "avatar" | "banner" | "profile_background",
  ) => void;
  onModuleImageUpload: (file: File) => Promise<string>;
  onModuleVideoUpload: (file: File) => Promise<UploadedVideo>;
  onNewDraftModuleId: () => number;
  onProfileDraftChange: (updater: (profile: Profile) => Profile) => void;
  onRenderModuleContent: (
    module: ProfileModule,
    size: ProfileGridModuleSize,
  ) => ReactNode | undefined;
  onResolveIntegrationMetadata: (input: {
    provider?: ProfileIntegrationProvider;
    url: string;
  }) => Promise<ProfileIntegrationCard>;
  onSave: () => void;
  onVideoUpload: (file: File) => void;
  profile: Profile;
  uploading?: "backgroundImage" | "backgroundVideo" | "avatar" | "banner" | undefined;
};

type CanvasPoint = { column: number; row: number };

type ProfileCanvasResizeDirection =
  | "north"
  | "east"
  | "south"
  | "west"
  | "north-east"
  | "south-east"
  | "south-west"
  | "north-west";

type ProfileCanvasResizeState = {
  direction: ProfileCanvasResizeDirection;
  moduleId: number;
  previewLayout: ProfileModuleLayout;
  size: ProfileGridModuleSize;
  startLayout: ProfileModuleLayout;
  valid: boolean;
};

type ProfileCanvasDragState = {
  moduleId: number;
  pointerOffsetX: number;
  pointerOffsetY: number;
  previewLayout: ProfileModuleLayout;
  size: ProfileGridModuleSize;
  startLayout: ProfileModuleLayout;
  valid: boolean;
};

const profileCanvasResizeDirections: ProfileCanvasResizeDirection[] = [
  "north",
  "east",
  "south",
  "west",
  "north-east",
  "south-east",
  "south-west",
  "north-west",
];

const profileCanvasResizeDirectionLabels: Record<
  ProfileCanvasResizeDirection,
  string
> = {
  north: "top edge",
  east: "right edge",
  south: "bottom edge",
  west: "left edge",
  "north-east": "top right corner",
  "south-east": "bottom right corner",
  "south-west": "bottom left corner",
  "north-west": "top left corner",
};

const profileEditorCoachmarkSteps = [
  {
    title: "Set the stage",
    body: "Use background settings for profile media and glass. This changes the mood before modules are added.",
    target: "Background",
  },
  {
    title: "Pick a space",
    body: "Click one grid cell, then another cell to draw the rectangle your next module should occupy.",
    target: "Grid",
  },
  {
    title: "Choose a module",
    body: "The picker only shows modules that fit the selected size. Brand icons tell you the provider at a glance.",
    target: "Picker",
  },
  {
    title: "Configure it",
    body: "Module settings handle uploads, text, links, providers, and the Done button returns you to the canvas.",
    target: "Settings",
  },
  {
    title: "Arrange the room",
    body: "Drag modules, resize supported cards, and pin important modules so the profile keeps its structure.",
    target: "Layout",
  },
  {
    title: "Save the canvas",
    body: "Drafts autosave while you work. Use Save when the public profile should get the final layout.",
    target: "Save",
  },
] as const;

function ProfileEditorCoachmarkTour({
  onComplete,
  onDismiss,
  open,
}: {
  onComplete: () => void;
  onDismiss: () => void;
  open: boolean;
}) {
  const [index, setIndex] = useState(0);
  const step = profileEditorCoachmarkSteps[index] ?? profileEditorCoachmarkSteps[0];
  const last = index >= profileEditorCoachmarkSteps.length - 1;

  if (!open) {
    return null;
  }

  return (
    <motion.div
      className="rounded-card border border-focus/45 bg-surface/92 p-4 shadow-lift backdrop-blur-veil"
      role="dialog"
      aria-label="Profile editor guide"
      data-testid="profile-editor-guide"
      data-profile-editor-guide-step={step.target.toLowerCase()}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge tone="cool">{step.target}</Badge>
          <h2 className="mt-2 text-lg font-semibold text-text">{step.title}</h2>
          <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-muted">
            {step.body}
          </p>
        </div>
        <p className="text-xs font-semibold text-muted">
          {index + 1}/{profileEditorCoachmarkSteps.length}
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid="profile-editor-guide-dismiss"
          onClick={() => {
            setIndex(0);
            onDismiss();
          }}
        >
          Skip guide
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={index === 0}
            onClick={() => setIndex((current) => Math.max(0, current - 1))}
          >
            Back
          </Button>
          <Button
            type="button"
            size="sm"
            data-testid={last ? "profile-editor-guide-done" : "profile-editor-guide-next"}
            icon={
              last ? (
                <Check aria-hidden="true" size={15} />
              ) : (
                <ArrowRight aria-hidden="true" size={15} />
              )
            }
            onClick={() => {
              if (last) {
                setIndex(0);
                onComplete();
                return;
              }

              setIndex((current) =>
                Math.min(profileEditorCoachmarkSteps.length - 1, current + 1),
              );
            }}
          >
            {last ? "Done" : "Next"}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function ProfileCanvasSelectionExamples({
  selection,
}: {
  selection: ProfileModuleLayout;
}) {
  const examples = profileCanvasSelectionExamples(selection);
  const size = profileCanvasSelectionSize(selection);
  const span = size
    ? profileGridModuleSizeSpan(size)
    : {
        columns: Math.min(8, Math.max(1, selection.colSpan)),
        rows: Math.min(10, Math.max(1, selection.rowSpan)),
      };
  const tiny = span.columns <= 2 || span.rows <= 1;
  const roomy = span.columns >= 3 && span.rows >= 2;

  return (
    <div
      className={cn(
        "absolute inset-0 flex min-h-0 min-w-0 flex-col items-center justify-center overflow-hidden text-center",
        tiny ? "gap-1 p-1" : "gap-2 p-2",
      )}
      data-testid="profile-canvas-selection-examples"
    >
      {!tiny && size ? (
        <motion.p
          className="max-w-full truncate rounded-full border border-focus/35 bg-canvas/72 px-2 py-0.5 text-[0.68rem] font-semibold uppercase text-text shadow-soft"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.14 }}
        >
          Fits {size}
        </motion.p>
      ) : null}
      <div
        className={cn(
          "flex max-h-full max-w-full flex-wrap items-center justify-center overflow-hidden",
          tiny ? "gap-1" : "gap-1.5",
        )}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {examples.length > 0 ? (
            examples.map((example, index) => (
              <motion.span
                key={example.type}
                layout
                className={cn(
                  "min-w-0 max-w-full border border-line bg-surface/88 text-text shadow-soft backdrop-blur-veil",
                  roomy
                    ? "inline-flex h-7 items-center gap-1.5 rounded-full px-2 text-xs font-semibold"
                    : "grid size-7 place-items-center rounded-full",
                )}
                data-testid={`profile-canvas-selection-example-${example.type}`}
                initial={{ opacity: 0, scale: 0.88, y: 5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -4 }}
                transition={{
                  delay: Math.min(index * 0.025, 0.08),
                  duration: 0.16,
                  ease: "easeOut",
                  layout: { type: "spring", stiffness: 430, damping: 32 },
                }}
              >
                <ProfileModulePickerIcon
                  category={example.category}
                  disabled={false}
                  type={example.type}
                />
                {roomy ? (
                  <span className="max-w-[7rem] truncate">{example.label}</span>
                ) : (
                  <span className="sr-only">{example.label}</span>
                )}
              </motion.span>
            ))
          ) : (
            <motion.span
              key="empty"
              className="max-w-full truncate rounded-full border border-line bg-surface/88 px-2 py-1 text-[0.68rem] font-semibold text-muted shadow-soft backdrop-blur-veil"
              data-testid="profile-canvas-selection-examples-empty"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.14 }}
            >
              No exact fit
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function profileCanvasCommitPendingDragPreview(
  grid: HTMLDivElement | null,
  state: ProfileCanvasDragState | undefined,
  point: { clientX: number; clientY: number } | undefined,
  mobile: boolean,
): ProfileCanvasDragState | undefined {
  if (!grid || !state || !point) {
    return state;
  }

  return {
    ...state,
    previewLayout: profileCanvasLayoutFromPointer(
      grid,
      point.clientX,
      point.clientY,
      state.startLayout.colSpan,
      state.startLayout.rowSpan,
      state.pointerOffsetX,
      state.pointerOffsetY,
      mobile,
    ),
  };
}

function profileCanvasCommitPendingResizePreview(
  grid: HTMLDivElement | null,
  state: ProfileCanvasResizeState | undefined,
  point: { clientX: number; clientY: number } | undefined,
  modules: ProfileModule[],
  mobile: boolean,
): ProfileCanvasResizeState | undefined {
  if (!grid || !state || !point) {
    return state;
  }

  const moduleType =
    modules.find((module) => module.id === state.moduleId)?.type ?? "placeholder";
  const next = profileCanvasResizeLayoutFromPointer(
    grid,
    point.clientX,
    point.clientY,
    state.startLayout,
    state.direction,
    moduleType,
    mobile,
  );

  return {
    ...state,
    previewLayout: next.layout,
    size: next.size,
    valid: !profileCanvasResizeBlockedByPinned(modules, state.moduleId, next.layout),
  };
}

function ProfileDirectCanvasEditor({
  autosaveError,
  autosaveState,
  busy,
  draft,
  error,
  guideOpen,
  integrationAccounts,
  integrationProviders,
  modules,
  onBackgroundBlurChange,
  onCancel,
  onCanvasGlassChange,
  onChange,
  onClearBackground,
  onConnectProvider,
  onGuideComplete,
  onGuideDismiss,
  onGuideOpen,
  onModuleAudioUpload,
  onModuleImagePrepare,
  onImageUpload,
  onModuleImageUpload,
  onModuleVideoUpload,
  onNewDraftModuleId,
  onProfileDraftChange,
  onResolveIntegrationMetadata,
  onSave,
  onVideoUpload,
  profile,
  uploading,
}: ProfileDirectCanvasEditorProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const editorGrid = useProfileCanvasEditorGridProjection();
  const [selectionStart, setSelectionStart] = useState<CanvasPoint | undefined>();
  const [selectionHover, setSelectionHover] = useState<CanvasPoint | undefined>();
  const [pickerModuleId, setPickerModuleId] = useState<number | undefined>();
  const [settingsModuleId, setSettingsModuleId] = useState<number | undefined>();
  const [mobileMoveModuleId, setMobileMoveModuleId] = useState<number | undefined>();
  const [dragState, setDragState] = useState<ProfileCanvasDragState | undefined>();
  const [resizeState, setResizeState] = useState<
    ProfileCanvasResizeState | undefined
  >();
  const dragStateRef = useRef<ProfileCanvasDragState | undefined>(undefined);
  const dragFrameRef = useRef<number | undefined>(undefined);
  const dragPendingPointRef = useRef<
    { clientX: number; clientY: number } | undefined
  >(undefined);
  const resizeStateRef = useRef<ProfileCanvasResizeState | undefined>(undefined);
  const resizeFrameRef = useRef<number | undefined>(undefined);
  const resizePendingPointRef = useRef<
    { clientX: number; clientY: number } | undefined
  >(undefined);
  const sortedModules = useMemo(
    () =>
      profileCanvasSortDraftModules(
        modules.filter((module) => module.status !== "deleted"),
      ),
    [modules],
  );
  const editorCells = useMemo(
    () => profileCanvasCells(editorGrid.columns, editorGrid.rows),
    [editorGrid.columns, editorGrid.rows],
  );
  const occupiedEditorCellKeys = useMemo(() => {
    const occupied = new Set<string>();

    sortedModules.forEach((draftModule, index) => {
      const layout =
        draftModule.layout ?? profileCanvasDefaultClientLayout(draftModule, index);

      profileCanvasOccupiedEditorCellKeysForLayout(
        layout,
        editorGrid.mobile,
      ).forEach((key) => occupied.add(key));
    });

    return occupied;
  }, [editorGrid.mobile, sortedModules]);
  const pickerModule = sortedModules.find((module) => module.id === pickerModuleId);
  const settingsModule = sortedModules.find((module) => module.id === settingsModuleId);
  const integrationConnectionLinks = useMemo(
    () => profileCanvasConnectionLinksFromIntegrationAccounts(integrationAccounts),
    [integrationAccounts],
  );
  const autosaveMessage =
    autosaveState === "error"
      ? autosaveError ?? "Canvas draft could not save."
      : autosaveState === "saving"
        ? "Saving draft..."
        : autosaveState === "pending"
          ? "Draft pending..."
          : autosaveState === "saved"
            ? "Draft saved."
            : "Draft autosaves.";
  const updateDraftModules = useCallback(
    (updater: (currentModules: ProfileModule[]) => ProfileModule[]) => {
      onChange((currentDraft) => ({
        ...currentDraft,
        modules: updater(currentDraft.modules),
      }));
    },
    [onChange],
  );

  useEffect(() => {
    if (integrationConnectionLinks.length === 0) {
      return;
    }

    const nextModules = profileCanvasModulesWithIntegrationLinks(
      modules,
      integrationConnectionLinks,
    );

    if (nextModules === modules) {
      return;
    }

    onChange((currentDraft) => ({
      ...currentDraft,
      modules: profileCanvasModulesWithIntegrationLinks(
        currentDraft.modules,
        integrationConnectionLinks,
      ),
    }));
  }, [integrationConnectionLinks, modules, onChange]);

  const updateDragState = useCallback((nextState: ProfileCanvasDragState | undefined) => {
    dragStateRef.current = nextState;
    setDragState(nextState);
  }, []);
  const activeDragModuleId = dragState?.moduleId;

  useEffect(() => {
    if (activeDragModuleId === undefined) {
      return undefined;
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      const grid = gridRef.current;
      const activeDragState = dragStateRef.current;

      if (!grid || !activeDragState) {
        return;
      }

      if (dragFrameRef.current !== undefined) {
        window.cancelAnimationFrame(dragFrameRef.current);
      }

      const { clientX, clientY } = event;
      dragPendingPointRef.current = { clientX, clientY };

      dragFrameRef.current = window.requestAnimationFrame(() => {
        dragFrameRef.current = undefined;
        const pendingPoint = dragPendingPointRef.current;
        const currentState = dragStateRef.current;
        const currentGrid = gridRef.current;

        if (!currentGrid || !currentState || !pendingPoint) {
          return;
        }

        const nextLayout = profileCanvasLayoutFromPointer(
          currentGrid,
          pendingPoint.clientX,
          pendingPoint.clientY,
          currentState.startLayout.colSpan,
          currentState.startLayout.rowSpan,
          currentState.pointerOffsetX,
          currentState.pointerOffsetY,
          editorGrid.mobile,
        );

        updateDragState({
          ...currentState,
          previewLayout: nextLayout,
        });
      });
    }

    function handlePointerUp() {
      const finalState = profileCanvasCommitPendingDragPreview(
        gridRef.current,
        dragStateRef.current,
        dragPendingPointRef.current,
        editorGrid.mobile,
      );

      if (finalState?.valid) {
        updateDraftModules((currentModules) =>
          profileCanvasResolveDraftCollisions(
            currentModules.map((module) =>
              module.id === finalState.moduleId
                ? { ...module, layout: finalState.previewLayout }
                : module,
            ),
            finalState.moduleId,
          ),
        );
      }

      if (dragFrameRef.current !== undefined) {
        window.cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = undefined;
      }

      dragPendingPointRef.current = undefined;
      updateDragState(undefined);
    }

    function handlePointerCancel() {
      if (dragFrameRef.current !== undefined) {
        window.cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = undefined;
      }

      dragPendingPointRef.current = undefined;
      updateDragState(undefined);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    window.addEventListener("pointercancel", handlePointerCancel, { once: true });

    return () => {
      if (dragFrameRef.current !== undefined) {
        window.cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = undefined;
      }
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [
    activeDragModuleId,
    editorGrid.mobile,
    updateDraftModules,
    updateDragState,
  ]);

  const updateResizeState = useCallback((nextState: ProfileCanvasResizeState | undefined) => {
    resizeStateRef.current = nextState;
    setResizeState(nextState);
  }, []);
  const activeResizeModuleId = resizeState?.moduleId;

  useEffect(() => {
    if (activeResizeModuleId === undefined) {
      return undefined;
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      const grid = gridRef.current;
      const activeResizeState = resizeStateRef.current;

      if (!grid || !activeResizeState) {
        return;
      }

      if (resizeFrameRef.current !== undefined) {
        window.cancelAnimationFrame(resizeFrameRef.current);
      }

      const { clientX, clientY } = event;
      resizePendingPointRef.current = { clientX, clientY };

      resizeFrameRef.current = window.requestAnimationFrame(() => {
        resizeFrameRef.current = undefined;
        const pendingPoint = resizePendingPointRef.current;
        const currentGrid = gridRef.current;
        const currentResizeState = resizeStateRef.current;

        if (!currentGrid || !currentResizeState || !pendingPoint) {
          return;
        }

        const moduleType =
          modules.find((module) => module.id === currentResizeState.moduleId)?.type ??
          "placeholder";
        const next = profileCanvasResizeLayoutFromPointer(
          currentGrid,
          pendingPoint.clientX,
          pendingPoint.clientY,
          currentResizeState.startLayout,
          currentResizeState.direction,
          moduleType,
          editorGrid.mobile,
        );
        const valid = !profileCanvasResizeBlockedByPinned(
          modules,
          currentResizeState.moduleId,
          next.layout,
        );

        updateResizeState({
          ...currentResizeState,
          previewLayout: next.layout,
          size: next.size,
          valid,
        });
      });
    }

    function handlePointerUp() {
      const finalState = profileCanvasCommitPendingResizePreview(
        gridRef.current,
        resizeStateRef.current,
        resizePendingPointRef.current,
        modules,
        editorGrid.mobile,
      );

      if (finalState?.valid) {
        updateDraftModules((currentModules) =>
          profileCanvasResolveDraftCollisions(
            currentModules.map((item) => {
              if (item.id !== finalState.moduleId) {
                return item;
              }

              return {
                ...item,
                config: {
                  ...item.config,
                  canvasSize: finalState.size,
                },
                layout: finalState.previewLayout,
              };
            }),
            finalState.moduleId,
          ),
        );
      }

      if (resizeFrameRef.current !== undefined) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = undefined;
      }

      resizePendingPointRef.current = undefined;
      updateResizeState(undefined);
    }

    function handlePointerCancel() {
      if (resizeFrameRef.current !== undefined) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = undefined;
      }

      resizePendingPointRef.current = undefined;
      updateResizeState(undefined);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    window.addEventListener("pointercancel", handlePointerCancel, { once: true });

    return () => {
      if (resizeFrameRef.current !== undefined) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = undefined;
      }
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [
    editorGrid.mobile,
    modules,
    activeResizeModuleId,
    updateDraftModules,
    updateResizeState,
  ]);

  function handleCellClick(point: CanvasPoint) {
    if (mobileMoveModuleId !== undefined) {
      const movingModule = sortedModules.find(
        (module) => module.id === mobileMoveModuleId,
      );

      if (!movingModule?.layout) {
        setMobileMoveModuleId(undefined);
        return;
      }

      const layoutPoint = profileCanvasDesktopPointFromEditorPoint(
        point,
        editorGrid.mobile,
      );
      const nextLayout = profileCanvasClampLayout(
        {
          ...movingModule.layout,
          column: layoutPoint.column,
          row: layoutPoint.row,
        },
        movingModule.type,
      );
      const blockedByPinned = profileCanvasResizeBlockedByPinned(
        sortedModules,
        movingModule.id,
        nextLayout,
      );

      if (blockedByPinned) {
        setSelectionStart(point);
        setSelectionHover(point);
        return;
      }

      updateDraftModules((currentModules) =>
        profileCanvasResolveDraftCollisions(
          currentModules.map((module) =>
            module.id === movingModule.id
              ? { ...module, layout: nextLayout }
              : module,
          ),
          movingModule.id,
        ),
      );
      setMobileMoveModuleId(undefined);
      setSelectionStart(undefined);
      setSelectionHover(undefined);
      return;
    }

    if (!selectionStart) {
      setSelectionStart(point);
      setSelectionHover(point);
      return;
    }

    const rect = profileCanvasDesktopRectFromEditorPoints(
      selectionStart,
      point,
      editorGrid.mobile,
    );
    const blocked = sortedModules.some((draftModule) =>
      profileCanvasRectsOverlap(
        rect,
        draftModule.layout ?? profileCanvasDefaultClientLayout(draftModule, 0),
      ),
    );

    if (blocked) {
      setSelectionHover(point);
      return;
    }

    const id = onNewDraftModuleId();
    const colSpan = Math.min(PROFILE_CANVAS_PROFILE_INFO_COLUMNS, rect.colSpan);
    const rowSpan = Math.min(PROFILE_CANVAS_ACTIVITY_MAX_MODULE_ROWS, rect.rowSpan);
    const size = profileGridModuleSpanSize(colSpan, rowSpan) ?? "1x1";
    const blankModule: ProfileModule = {
      id,
      type: "placeholder",
      title: null,
      config: { canvasSize: size, configured: false, placeholder: true },
      visibility: "draft",
      position: modules.length + 1,
      pinned: false,
      layout: {
        column: rect.column,
        row: rect.row,
        colSpan,
        rowSpan,
      },
      status: "active",
      schemaVersion: 1,
      createdAt: null,
      updatedAt: null,
    };

    updateDraftModules((currentModules) =>
      profileCanvasResolveDraftCollisions([...currentModules, blankModule], id),
    );
    setMobileMoveModuleId(undefined);
    setSettingsModuleId(undefined);
    setPickerModuleId(id);
    setSelectionStart(undefined);
    setSelectionHover(undefined);
  }

  async function handleChooseModule(type: ProfileModule["type"]) {
    const module = pickerModule;

    if (!module?.layout) {
      return;
    }

    const size = profileCanvasExactSizeForSelection(type, module.layout);

    if (!size) {
      return;
    }

    const span = profileGridModuleSizeSpan(size);
    const autofill = profileCanvasAutofillConfigForModule(
      type,
      size,
      profileCanvasDefaultConfigForModule(type, size, integrationConnectionLinks),
      integrationAccounts,
    );

    updateDraftModules((currentModules) =>
      profileCanvasResolveDraftCollisions(
        currentModules.map((item) =>
          item.id === module.id
            ? {
                ...item,
                type,
                title: null,
                config: autofill.config,
                visibility: autofill.config.configured === false ? "draft" : "public",
                layout: {
                  ...item.layout!,
                  colSpan: span.columns,
                  rowSpan: span.rows,
                },
              }
            : item,
        ),
        module.id,
      ),
    );
    setPickerModuleId(undefined);
    setSettingsModuleId(undefined);
    window.setTimeout(() => setSettingsModuleId(module.id), 0);

    if (!autofill.resolve) {
      return;
    }

    try {
      const card = await onResolveIntegrationMetadata(autofill.resolve);

      updateDraftModules((currentModules) =>
        currentModules.map((item) =>
          item.id === module.id && item.type === type
            ? {
                ...item,
                config: profileCanvasConfigWithIntegrationCard(item.config, card),
                visibility: "public",
              }
            : item,
        ),
      );
    } catch {
      // The saved URL still lets the backend regenerate a safe fallback card.
    }
  }

  function handleModuleConfig(module: ProfileModule, config: ProfileModule["config"]) {
    updateDraftModules((currentModules) =>
      currentModules.map((item) =>
        item.id === module.id
          ? {
              ...item,
              config,
              visibility: config.configured === false ? "draft" : "public",
            }
          : item,
      ),
    );
  }

  function handleRemoveModule(module: ProfileModule) {
    updateDraftModules((currentModules) =>
      module.id < 0
        ? currentModules.filter((item) => item.id !== module.id)
        : currentModules.map((item) =>
            item.id === module.id
              ? { ...item, status: "deleted", visibility: "hidden" }
              : item,
          ),
    );
    setPickerModuleId((current) => (current === module.id ? undefined : current));
    setSettingsModuleId(undefined);
  }

  function handleTogglePin(module: ProfileModule) {
    updateDraftModules((currentModules) =>
      currentModules.map((item) =>
        item.id === module.id ? { ...item, pinned: !item.pinned } : item,
      ),
    );
  }

  function handleResizeModule(
    module: ProfileModule,
    size: ProfileGridModuleSize,
  ) {
    const span = profileGridModuleSizeSpan(size);

    updateDraftModules((currentModules) =>
      profileCanvasResolveDraftCollisions(
        currentModules.map((item, index) => {
          if (item.id !== module.id) {
            return item;
          }

          const layout =
            item.layout ?? profileCanvasDefaultClientLayout(item, index);

          return {
            ...item,
            config: {
              ...item.config,
              canvasSize: size,
            },
            layout: {
              ...layout,
              colSpan: span.columns,
              rowSpan: span.rows,
            },
          };
        }),
        module.id,
      ),
    );
  }

  function handleResizePointerStart(
    module: ProfileModule,
    layout: ProfileModuleLayout,
    direction: ProfileCanvasResizeDirection,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (module.pinned || event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    updateDragState(undefined);
    const size =
      profileGridModuleSpanSize(layout.colSpan, layout.rowSpan) ??
      getProfileModuleDefinition(module.type).defaultSize;

    updateResizeState({
      direction,
      moduleId: module.id,
      previewLayout: layout,
      size,
      startLayout: layout,
      valid: true,
    });
  }

  const selectionRect =
    selectionStart && selectionHover
      ? profileCanvasRectFromPoints(selectionStart, selectionHover)
      : undefined;
  const selectionLayoutRect =
    selectionStart && selectionHover
      ? profileCanvasDesktopRectFromEditorPoints(
          selectionStart,
          selectionHover,
          editorGrid.mobile,
        )
      : undefined;
  const selectionBlocked = Boolean(
    selectionLayoutRect &&
      sortedModules.some((draftModule) =>
        profileCanvasRectsOverlap(
          selectionLayoutRect,
          draftModule.layout ?? profileCanvasDefaultClientLayout(draftModule, 0),
        ),
      ),
  );
  const selectionPreviewRect = selectionBlocked ? undefined : selectionRect;

  return (
    <section
      className="space-y-3"
      data-testid="profile-canvas-editor"
      data-profile-editor-input-mode={editorGrid.mobile ? "touch" : "pointer"}
      data-profile-editor-render-mode="light"
      aria-label="Profile canvas editor"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ProfileCanvasBackgroundControls
            backgroundBlur={draft.backgroundBlur}
            profile={profile}
            uploading={uploading}
            onBackgroundBlurChange={onBackgroundBlurChange}
            onClear={onClearBackground}
            onImageUpload={(file) => onImageUpload(file, "profile_background")}
            onVideoUpload={onVideoUpload}
          />
          <ProfileAppearanceControls
            profile={profile}
            onProfileDraftChange={onProfileDraftChange}
          />
          <label className="flex min-h-11 items-center gap-2 rounded-control border border-line bg-surface/72 px-3 text-sm font-semibold text-text shadow-soft backdrop-blur-veil">
            <span>Glass</span>
            <span
              aria-hidden="true"
              className="size-4 rounded-[0.3rem] border border-line-strong bg-surface-strong shadow-inner-soft"
            />
            <input
              className="w-28 accent-[var(--app-accent)]"
              type="range"
              min={0}
              max={92}
              value={draft.canvasGlass}
              data-testid="profile-canvas-glass-slider"
              onChange={(event) =>
                onCanvasGlassChange(Number(event.currentTarget.value))
              }
            />
            <span
              aria-hidden="true"
              className="size-4 rounded-[0.3rem] border border-line-strong bg-transparent shadow-inner-soft"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <p
            className={cn(
              "text-xs font-semibold",
              autosaveState === "error" ? "text-rose-ink" : "text-muted",
            )}
            role={autosaveState === "error" ? "alert" : "status"}
          >
            {autosaveMessage}
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            icon={<Sparkles aria-hidden="true" size={16} />}
            data-testid="profile-editor-guide-button"
            onClick={onGuideOpen}
          >
            Guide
          </Button>
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
            icon={<Save aria-hidden="true" size={16} />}
            data-testid="profile-canvas-save-button"
            onClick={onSave}
          >
            Save
          </Button>
        </div>
      </div>
      {error ? (
        <p
          className="rounded-card border border-rose/30 bg-rose/12 p-3 text-sm font-medium text-rose-ink"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <ProfileEditorCoachmarkTour
        open={guideOpen}
        onComplete={onGuideComplete}
        onDismiss={onGuideDismiss}
      />
      <ProfileGrid
        canvasGlass={draft.canvasGlass}
        gridRef={gridRef}
        className="relative overflow-hidden"
        maxColumns={editorGrid.columns}
        maxRows={editorGrid.rows}
        testId="profile-canvas-direct-grid"
      >
        <div
          className={cn(
            "pointer-events-auto absolute inset-2 z-0 grid",
            editorGrid.mobile ? "gap-2" : "gap-3",
          )}
          style={{
            gridTemplateColumns: `repeat(${editorGrid.columns}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${editorGrid.rows}, minmax(0, 1fr))`,
          }}
          onMouseLeave={() => {
            if (selectionStart && !editorGrid.mobile) {
              setSelectionHover(selectionStart);
            }
          }}
        >
          <AnimatePresence initial={false}>
            {selectionPreviewRect ? (
              <motion.div
                layout
                className="pointer-events-none relative z-20 overflow-hidden rounded-[1.1rem] border border-focus/80 bg-focus/20 shadow-glow backdrop-blur-veil"
                data-testid="profile-canvas-selection-preview"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{
                  layout: { type: "spring", stiffness: 420, damping: 34 },
                  opacity: { duration: 0.12 },
                  scale: { duration: 0.16 },
                }}
                style={{
                  gridColumn: `${selectionPreviewRect.column} / span ${selectionPreviewRect.colSpan}`,
                  gridRow: `${selectionPreviewRect.row} / span ${selectionPreviewRect.rowSpan}`,
                }}
              >
                <ProfileCanvasSelectionExamples selection={selectionPreviewRect} />
              </motion.div>
            ) : null}
          </AnimatePresence>
          {editorCells.map((point) => {
            const selected = selectionStart &&
              point.column === selectionStart.column &&
              point.row === selectionStart.row;
            const inPreview = selectionPreviewRect
              ? profileCanvasPointInRect(point, selectionPreviewRect)
              : false;
            const previewHasArea = Boolean(
              selectionPreviewRect &&
                (selectionPreviewRect.colSpan > 1 || selectionPreviewRect.rowSpan > 1),
            );
            const coveredByModule = occupiedEditorCellKeys.has(
              `${point.column}:${point.row}`,
            );
            const visuallyCovered = coveredByModule || (inPreview && previewHasArea);

            return (
              <button
                key={`${point.column}:${point.row}`}
                type="button"
                className={cn(
                  "relative z-10 min-h-0 touch-manipulation rounded-card border border-line/55 bg-surface/20 transition-colors duration-fluid ease-fluid focus-visible:z-30 focus-visible:outline-2 focus-visible:outline-focus",
                  !editorGrid.mobile
                    ? "hover:scale-[1.03] hover:border-line-strong hover:bg-surface/42"
                    : undefined,
                  selected && selectionBlocked
                    ? "z-30 border-rose bg-rose/25 shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent-rose)_18%,transparent)]"
                    : undefined,
                  selected && !selectionBlocked && !visuallyCovered
                    ? "z-30 border-focus bg-focus/35 shadow-glow"
                    : undefined,
                  visuallyCovered
                    ? "border-transparent bg-transparent opacity-0 hover:bg-transparent hover:opacity-0"
                    : undefined,
                )}
                aria-label={`Select grid point column ${point.column}, row ${point.row}`}
                data-testid={`profile-canvas-cell-${point.column}-${point.row}`}
                style={{
                  gridColumn: point.column,
                  gridRow: point.row,
                }}
                onClick={() => handleCellClick(point)}
                onMouseEnter={() => {
                  if (selectionStart && !editorGrid.mobile) {
                    setSelectionHover(point);
                  }
                }}
              />
            );
          })}
        </div>
        <AnimatePresence initial={false}>
          {dragState ? (
            <ProfileGridModule
              className={cn(
                "pointer-events-none z-30 rounded-card border border-focus/80 bg-focus/18 shadow-glow backdrop-blur-veil",
                dragState.valid
                  ? undefined
                  : "border-rose/80 bg-rose/18 shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent-rose)_16%,transparent)]",
              )}
              layout={dragState.previewLayout}
              layoutAnimation={false}
              size={dragState.size}
              testId="profile-canvas-drag-preview"
            >
              <div
                className="grid h-full min-h-0 place-items-center rounded-card border border-current/35 text-xs font-semibold text-text/80"
                data-profile-canvas-drag-valid={dragState.valid ? "true" : "false"}
              >
                Move
              </div>
            </ProfileGridModule>
          ) : null}
          {resizeState ? (
            <ProfileGridModule
              className={cn(
                "pointer-events-none z-30 rounded-card",
                resizeState.valid
                  ? "border border-focus/90 bg-focus/18 shadow-glow"
                  : "border border-rose/80 bg-rose/18 shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent-rose)_16%,transparent)]",
              )}
              layout={resizeState.previewLayout}
              layoutAnimation={false}
              size={resizeState.size}
              testId="profile-canvas-resize-preview"
            >
              <div
                className="grid h-full min-h-0 place-items-center rounded-card border border-current/35 text-xs font-semibold text-text/80 backdrop-blur-veil"
                data-profile-canvas-resize-valid={resizeState.valid ? "true" : "false"}
              >
                {resizeState.size}
              </div>
            </ProfileGridModule>
          ) : null}
        </AnimatePresence>
        {sortedModules.map((module) => {
          const layout = module.layout ?? profileCanvasDefaultClientLayout(module, 0);
          const size =
            profileGridModuleSpanSize(layout.colSpan, layout.rowSpan) ??
            getProfileModuleDefinition(module.type).defaultSize;
          const placeholder = module.type === "placeholder";
          const configured = profileCanvasModuleIsConfiguredForEditor(module);
          const placeholderMicro =
            placeholder && layout.colSpan <= 1 && layout.rowSpan <= 1;
          const placeholderSmall =
            placeholder &&
            !placeholderMicro &&
            (layout.colSpan <= 2 || layout.rowSpan <= 1);
          const placeholderLabel = placeholderMicro
            ? "Add"
            : placeholderSmall
              ? "Add module"
              : "Click to add module";
          const moduleTitle = profileModuleFallbackTitle(module.type);
          const pinLabel = module.pinned
            ? `Unpin ${placeholder ? "blank module" : moduleTitle}`
            : `Pin ${placeholder ? "blank module" : moduleTitle}`;
          const removable = module.type !== "profile_info";
          const removeLabel = placeholder
            ? "Delete blank module"
            : `Remove ${moduleTitle}`;
          const editControlSize = placeholderMicro ? "size-6" : "size-8";
          const editControlIconSize = placeholderMicro ? 12 : 15;

          return (
            <ProfileGridModule
              key={module.id}
              className={cn(
                "z-10 rounded-card transition duration-fluid ease-fluid",
                configured ? "backdrop-blur-veil" : undefined,
                module.pinned
                  ? "outline outline-2 outline-rose/70 ring-2 ring-rose/20"
                  : undefined,
              )}
              data-profile-canvas-preview-blurred={configured ? "true" : undefined}
              layout={layout}
              layoutAnimation={false}
              pinned={module.pinned}
              size={size}
              testId={`profile-canvas-module-${module.id}`}
            >
              <div
                className={cn(
                  "relative h-full min-h-0 cursor-grab rounded-card active:cursor-grabbing",
                  configured
                    ? "overflow-hidden border border-line-strong bg-surface/90 p-2 shadow-inner-soft"
                    : undefined,
                )}
                onPointerDown={(event) => {
                  const target = event.target;

                  if (
                    editorGrid.mobile ||
                    module.pinned ||
                    event.button !== 0 ||
                    (target instanceof HTMLElement &&
                      target.closest('[data-profile-edit-control="true"]'))
                  ) {
                    return;
                  }

                  const rect = event.currentTarget.getBoundingClientRect();
                  const dragSize =
                    profileGridModuleSpanSize(layout.colSpan, layout.rowSpan) ??
                    getProfileModuleDefinition(module.type).defaultSize;

                  updateDragState({
                    moduleId: module.id,
                    pointerOffsetX: event.clientX - rect.left,
                    pointerOffsetY: event.clientY - rect.top,
                    previewLayout: layout,
                    size: dragSize,
                    startLayout: layout,
                    valid: true,
                  });
                }}
              >
                {placeholder ? (
                  <div
                    className={cn(
                      "grid h-full min-h-0 w-full place-items-center overflow-hidden rounded-card border border-dashed border-line-strong bg-surface/62 text-center shadow-soft backdrop-blur-veil",
                      placeholderMicro
                        ? "p-1"
                        : placeholderSmall
                          ? "p-2"
                          : "p-4",
                    )}
                    data-testid={`profile-canvas-blank-module-${module.id}`}
                  >
                    <button
                      type="button"
                      className={cn(
                        "min-w-0 max-w-full rounded-card text-center transition duration-fluid ease-fluid hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-focus",
                        placeholderMicro
                          ? "px-1 py-0.5"
                          : placeholderSmall
                            ? "px-2 py-1"
                            : "px-3 py-2",
                      )}
                      data-profile-edit-control="true"
                      data-testid={`profile-canvas-add-module-${module.id}`}
                      onClick={() => {
                        setSettingsModuleId(undefined);
                        setPickerModuleId(module.id);
                      }}
                    >
                      <span
                        className={cn(
                          "mx-auto grid place-items-center rounded-full border border-line bg-canvas/80 text-accent-strong",
                          placeholderMicro
                            ? "size-8"
                            : placeholderSmall
                              ? "size-9"
                              : "size-11",
                        )}
                      >
                        <Plus
                          aria-hidden="true"
                          size={placeholderMicro ? 16 : placeholderSmall ? 18 : 22}
                        />
                      </span>
                      <span
                        className={cn(
                          "block max-w-full break-words font-semibold text-text",
                          placeholderMicro
                            ? "mt-1 text-[0.68rem] leading-3"
                            : placeholderSmall
                              ? "mt-1.5 text-xs leading-4"
                              : "mt-3 text-sm",
                        )}
                      >
                        {placeholderLabel}
                      </span>
                      <span
                        className={cn(
                          "block font-medium text-muted",
                          placeholderMicro
                            ? "sr-only"
                            : placeholderSmall
                              ? "mt-0.5 text-[0.68rem]"
                              : "mt-1 text-xs",
                        )}
                      >
                        {profileModuleSizeLabel("placeholder", size)}
                      </span>
                    </button>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "h-full min-h-0 min-w-0 overflow-hidden rounded-card",
                      "pointer-events-none select-none",
                    )}
                    data-profile-canvas-module-configured={
                      configured ? "true" : "false"
                    }
                    data-profile-module-content-interactive="false"
                    data-profile-canvas-module-frame="light"
                    data-profile-editor-render-mode="light"
                    data-testid={`profile-canvas-module-content-${module.id}`}
                    inert
                  >
                    <ProfileCanvasModulePreview module={module} size={size} />
                  </div>
                )}
              </div>
              {!editorGrid.mobile ? (
                <ProfileCanvasResizeHandles
                  compact={placeholderMicro}
                  disabled={module.pinned}
                  layout={layout}
                  module={module}
                  onResizeStart={handleResizePointerStart}
                />
              ) : null}
              <div
                className={cn(
                  "absolute right-1.5 top-1.5 z-40 flex items-center gap-1",
                  placeholderMicro ? "right-1 top-1 gap-0.5" : undefined,
                )}
                data-profile-edit-control="true"
              >
                {removable ? (
                  <button
                    type="button"
                    className={cn(
                      "grid place-items-center rounded-full border border-line bg-surface/92 text-rose-ink shadow-soft backdrop-blur-veil transition hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus",
                      editControlSize,
                    )}
                    aria-label={removeLabel}
                    title={removeLabel}
                    data-profile-edit-control="true"
                    data-testid={
                      placeholder
                        ? `profile-canvas-delete-placeholder-${module.id}`
                        : `profile-canvas-remove-module-${module.id}`
                    }
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleRemoveModule(module);
                    }}
                  >
                    <Trash2 aria-hidden="true" size={editControlIconSize} />
                  </button>
                ) : null}
                <button
                  type="button"
                  className={cn(
                    "grid place-items-center rounded-full border border-line bg-surface/92 text-text shadow-soft backdrop-blur-veil transition hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus",
                    module.pinned ? "border-rose/50 bg-rose/18 text-rose-ink" : undefined,
                    editControlSize,
                  )}
                  aria-label={pinLabel}
                  aria-pressed={module.pinned}
                  title={pinLabel}
                  data-testid={`profile-canvas-pin-module-${module.id}`}
                  onClick={() => handleTogglePin(module)}
                >
                  {module.pinned ? (
                    <PinOff aria-hidden="true" size={editControlIconSize} />
                  ) : (
                    <Pin aria-hidden="true" size={editControlIconSize} />
                  )}
                </button>
              </div>
              {editorGrid.mobile ? (
                <div
                  className="absolute inset-x-1.5 bottom-1.5 z-40 flex items-center justify-center gap-1 rounded-full border border-line bg-surface/92 p-1 shadow-soft backdrop-blur-veil"
                  data-profile-edit-control="true"
                  data-testid="profile-canvas-mobile-actions"
                >
                  <button
                    type="button"
                    className={cn(
                      "inline-flex min-h-8 min-w-0 flex-1 touch-manipulation items-center justify-center gap-1 rounded-full px-2 text-[0.68rem] font-semibold text-muted transition hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-focus",
                      mobileMoveModuleId === module.id
                        ? "bg-focus/18 text-text shadow-inner-soft"
                        : undefined,
                    )}
                    aria-pressed={mobileMoveModuleId === module.id}
                    data-profile-edit-control="true"
                    data-testid={`profile-canvas-mobile-move-${module.id}`}
                    onClick={() => {
                      setSelectionStart(undefined);
                      setSelectionHover(undefined);
                      setMobileMoveModuleId((current) =>
                        current === module.id ? undefined : module.id,
                      );
                    }}
                  >
                    <ArrowRight aria-hidden="true" size={13} />
                    Move
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-8 min-w-0 flex-1 touch-manipulation items-center justify-center gap-1 rounded-full px-2 text-[0.68rem] font-semibold text-muted transition hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-focus"
                    data-profile-edit-control="true"
                    data-testid={`profile-canvas-mobile-size-${module.id}`}
                    onClick={() => {
                      setPickerModuleId(undefined);
                      setSettingsModuleId(module.id);
                    }}
                  >
                    <Settings2 aria-hidden="true" size={13} />
                    Size
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex min-h-8 min-w-0 flex-1 touch-manipulation items-center justify-center gap-1 rounded-full px-2 text-[0.68rem] font-semibold text-muted transition hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-focus",
                      module.pinned ? "bg-rose/14 text-rose-ink" : undefined,
                    )}
                    aria-pressed={module.pinned}
                    data-profile-edit-control="true"
                    data-testid={`profile-canvas-mobile-pin-${module.id}`}
                    onClick={() => handleTogglePin(module)}
                  >
                    {module.pinned ? (
                      <PinOff aria-hidden="true" size={13} />
                    ) : (
                      <Pin aria-hidden="true" size={13} />
                    )}
                    Pin
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-8 min-w-0 flex-1 touch-manipulation items-center justify-center gap-1 rounded-full px-2 text-[0.68rem] font-semibold text-muted transition hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-focus"
                    data-profile-edit-control="true"
                    data-testid={`profile-canvas-mobile-settings-${module.id}`}
                    onClick={() => {
                      if (placeholder) {
                        setSettingsModuleId(undefined);
                        setPickerModuleId(module.id);
                        return;
                      }

                      setPickerModuleId(undefined);
                      setSettingsModuleId(module.id);
                    }}
                  >
                    <MoreHorizontal aria-hidden="true" size={13} />
                    {placeholder ? "Add" : "Edit"}
                  </button>
                </div>
              ) : null}
              {!placeholder ? (
                <button
                  type="button"
                  className={cn(
                    "absolute left-1/2 top-1/2 z-30 size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-line bg-surface/92 text-text shadow-lift backdrop-blur-veil transition duration-fluid ease-fluid hover:scale-105 hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus",
                    editorGrid.mobile ? "hidden" : "grid",
                  )}
                  aria-label={`Edit ${moduleTitle}`}
                  title={`Edit ${moduleTitle}`}
                  data-profile-edit-control="true"
                  data-testid={`profile-canvas-edit-module-${module.id}`}
                  onClick={() => setSettingsModuleId(module.id)}
                >
                  <MoreHorizontal aria-hidden="true" size={24} />
                </button>
              ) : null}
            </ProfileGridModule>
          );
        })}
      </ProfileGrid>
      <ModulePickerModal
        module={pickerModule}
        onChoose={handleChooseModule}
        onClose={() => setPickerModuleId(undefined)}
      />
      <ModuleSettingsModal
        integrationAccounts={integrationAccounts}
        integrationProviders={integrationProviders}
        module={settingsModule}
        profile={profile}
        uploading={uploading}
        onClose={() => setSettingsModuleId(undefined)}
        onRemove={handleRemoveModule}
        onResize={handleResizeModule}
        onConnectProvider={onConnectProvider}
        onModuleAudioUpload={onModuleAudioUpload}
        onModuleImagePrepare={onModuleImagePrepare}
        onModuleImageUpload={onModuleImageUpload}
        onModuleVideoUpload={onModuleVideoUpload}
        onProfileImageUpload={onImageUpload}
        onProfileDraftChange={onProfileDraftChange}
        onUpdateConfig={handleModuleConfig}
      />
    </section>
  );
}

function ProfileCanvasModulePreview({
  module,
  size,
}: {
  module: ProfileModule;
  size: ProfileGridModuleSize;
}) {
  const category = profileCanvasModulePreviewCategory(module.type);
  const title = profileCanvasModulePreviewTitle(module);
  const subtitle = profileCanvasModulePreviewSubtitle(module, size);
  const imageUrl = profileCanvasModulePreviewImage(module);
  const span = profileGridModuleSizeSpan(size);
  const slim = span.rows <= 1 || (span.columns >= 5 && span.rows <= 2);
  const configured = profileCanvasModuleIsConfiguredForEditor(module);

  return (
    <div
      className={cn(
        "relative h-full min-h-0 w-full overflow-hidden rounded-card border border-line bg-canvas/60 text-text shadow-inner-soft",
        slim ? "flex items-center gap-2 p-2" : "p-3",
      )}
      data-profile-editor-render-mode="light"
      data-testid={`profile-canvas-light-preview-${module.id}`}
    >
      {imageUrl ? (
        <img
          alt=""
          className={cn(
            "pointer-events-none select-none rounded-card object-cover",
            slim
              ? "size-12 shrink-0 border border-line"
              : "absolute inset-0 size-full opacity-45",
          )}
          loading="lazy"
          src={imageUrl}
        />
      ) : null}
      {imageUrl && !slim ? (
        <div className="absolute inset-0 bg-gradient-to-br from-canvas/92 via-canvas/70 to-canvas/38" />
      ) : null}
      <div
        className={cn(
          "relative z-10 min-w-0",
          slim ? "flex flex-1 items-center gap-2" : "flex h-full flex-col",
        )}
      >
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-card border border-line bg-surface/78 text-text shadow-soft",
            slim ? "size-9" : "size-10",
          )}
        >
          <ProfileModulePickerIcon
            category={category}
            disabled={false}
            type={module.type}
          />
        </span>
        <span className={cn("min-w-0", slim ? "flex-1" : "mt-3")}>
          <span
            className={cn(
              "block truncate font-semibold text-text",
              slim ? "text-xs" : "text-sm",
            )}
          >
            {title}
          </span>
          <span
            className={cn(
              "block truncate font-medium text-muted",
              slim ? "text-[0.68rem]" : "mt-1 text-xs",
            )}
          >
            {subtitle}
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.08em]",
            configured
              ? "border-line bg-surface/70 text-muted"
              : "border-focus/40 bg-focus/15 text-text",
            slim ? "ml-auto" : "mt-auto self-start",
          )}
        >
          {size}
        </span>
      </div>
    </div>
  );
}

function profileCanvasModulePreviewCategory(
  type: ProfileModule["type"],
): ProfileModuleCategory {
  return profileModuleCatalog.find((item) => item.type === type)?.category ?? "info";
}

function profileCanvasModulePreviewTitle(module: ProfileModule): string {
  const title =
    module.title?.trim() ||
    module.config.label?.trim() ||
    module.config.integration?.metadata.title?.trim() ||
    module.config.audio?.title?.trim() ||
    module.config.video?.title?.trim();

  return title || profileModulePickerLabel(module.type);
}

function profileCanvasModulePreviewSubtitle(
  module: ProfileModule,
  size: ProfileGridModuleSize,
): string {
  if (!profileCanvasModuleIsConfiguredForEditor(module)) {
    return `Draft ${profileModuleSizeLabel(module.type, size)}`;
  }

  if (module.config.integration) {
    const provider = profileCanvasProviderLabel(module.config.integration.provider);
    const subtitle = module.config.integration.metadata.subtitle?.trim();

    return subtitle ? `${provider} · ${subtitle}` : provider;
  }

  if (module.config.audio) {
    return "Uploaded MP3";
  }

  if (module.config.video) {
    return "Uploaded video";
  }

  if (module.config.mediaItems?.length) {
    const count = module.config.mediaItems.length;

    return count === 1 ? "1 photo" : `${count} photos`;
  }

  if (module.config.links?.length) {
    const count = module.config.links.length;

    return count === 1 ? "1 link" : `${count} links`;
  }

  if (module.config.body?.trim()) {
    return profileCanvasPlainTextSnippet(module.config.body, 72);
  }

  return profileModuleSizeLabel(module.type, size);
}

function profileCanvasModulePreviewImage(
  module: ProfileModule,
): string | undefined {
  const candidates = [
    module.config.mediaItems?.[0]?.url,
    module.config.integration?.metadata.imageUrl ?? undefined,
  ];

  for (const candidate of candidates) {
    const safeUrl = safeProfileImageUrl(candidate);

    if (safeUrl) {
      return safeUrl;
    }
  }

  return undefined;
}

function profileCanvasPlainTextSnippet(value: string, maxLength: number): string {
  const stripped = value
    .replace(/```[\s\S]*?```/g, " code ")
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, "$1")
    .replace(/[*_`>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (stripped.length <= maxLength) {
    return stripped;
  }

  return `${stripped.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function ProfileCanvasResizeHandles({
  compact,
  disabled,
  layout,
  module,
  onResizeStart,
}: {
  compact: boolean;
  disabled: boolean;
  layout: ProfileModuleLayout;
  module: ProfileModule;
  onResizeStart: (
    module: ProfileModule,
    layout: ProfileModuleLayout,
    direction: ProfileCanvasResizeDirection,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
}) {
  return (
    <div
      className="absolute inset-0 z-20 pointer-events-none"
      data-profile-edit-control="true"
    >
      {profileCanvasResizeDirections.map((direction) => {
        const title = disabled
          ? "Unpin this module before resizing"
          : `Resize from ${profileCanvasResizeDirectionLabels[direction]}`;

        return (
          <button
            key={direction}
            type="button"
            className={cn(
              "pointer-events-auto absolute grid place-items-center rounded-full border border-line bg-surface/95 text-text shadow-soft backdrop-blur-veil transition duration-fluid ease-fluid hover:scale-110 hover:border-line-strong hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100",
              profileCanvasResizeHandleClass(direction, compact),
            )}
            aria-label={title}
            disabled={disabled}
            title={title}
            data-profile-edit-control="true"
            data-testid={`profile-canvas-resize-handle-${module.id}-${direction}`}
            onPointerDown={(event) =>
              onResizeStart(module, layout, direction, event)
            }
          >
            <span className="size-1.5 rounded-full bg-current" />
          </button>
        );
      })}
    </div>
  );
}

function profileCanvasResizeHandleClass(
  direction: ProfileCanvasResizeDirection,
  compact: boolean,
): string {
  const edgeLength = compact ? "w-5" : "w-7";
  const edgeThickness = compact ? "h-2" : "h-2.5";
  const sideLength = compact ? "h-5" : "h-7";
  const sideThickness = compact ? "w-2" : "w-2.5";
  const cornerSize = compact ? "size-3" : "size-3.5";

  if (direction === "north") {
    return `${edgeLength} ${edgeThickness} left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize`;
  }

  if (direction === "south") {
    return `${edgeLength} ${edgeThickness} bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize`;
  }

  if (direction === "east") {
    return `${sideThickness} ${sideLength} right-0 top-1/2 -translate-y-1/2 translate-x-1/2 cursor-ew-resize`;
  }

  if (direction === "west") {
    return `${sideThickness} ${sideLength} left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize`;
  }

  if (direction === "north-east") {
    return `${cornerSize} right-0 top-0 -translate-y-1/2 translate-x-1/2 cursor-nesw-resize`;
  }

  if (direction === "south-east") {
    return `${cornerSize} bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize`;
  }

  if (direction === "south-west") {
    return `${cornerSize} bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize`;
  }

  return `${cornerSize} left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize`;
}

function ModulePickerModal({
  module,
  onChoose,
  onClose,
}: {
  module: ProfileModule | undefined;
  onChoose: (type: ProfileModule["type"]) => Promise<void> | void;
  onClose: () => void;
}) {
  const [activeCategory, setActiveCategory] =
    useState<ProfileModuleCategory>("video");
  const handleClose = useCallback(() => {
    setActiveCategory("video");
    onClose();
  }, [onClose]);
  const handleChoose = useCallback(
    (type: ProfileModule["type"]) => {
      setActiveCategory("video");
      onChoose(type);
    },
    [onChoose],
  );

  const pickerItems = useMemo(() => {
    if (!module?.layout) {
      return [];
    }

    return profileModuleCatalog
      .filter((item) => item.category === activeCategory)
      .map((item) => {
        const fit = profileCanvasFitForSelection(item.type, module.layout!);
        const sortSpan = profileGridModuleSizeSpan(fit.sortSize);

        return {
          ...item,
          enabled: fit.enabled,
          fittingSize: fit.exactSize,
          noteSize: fit.noteSize,
          sortArea: sortSpan.columns * sortSpan.rows,
          warning: fit.warning,
        };
      })
      .sort(
        (first, second) =>
          Number(!first.enabled) - Number(!second.enabled) ||
          first.sortArea - second.sortArea ||
          first.label.localeCompare(second.label),
      );
  }, [activeCategory, module]);

  return (
    <ModalSheet
      open={Boolean(module)}
      onClose={handleClose}
      title="Add module"
      description="Pick a tool for this space."
      size="md"
      testId="profile-module-picker"
    >
      {module?.layout ? (
        <div className="space-y-3">
          <div
            className="flex gap-1 overflow-x-auto rounded-card border border-line bg-canvas/45 p-1"
            role="tablist"
            aria-label="Module categories"
          >
            {profileModulePickerCategories.map(({ category, icon: Icon, label }) => {
              const active = activeCategory === category;

              return (
                <button
                  key={category}
                  type="button"
                  className={cn(
                    "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-control px-2.5 text-xs font-semibold transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-focus",
                    active
                      ? "bg-surface text-text shadow-soft"
                      : "text-muted hover:bg-surface/56 hover:text-text",
                  )}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveCategory(category)}
                >
                  <Icon aria-hidden="true" size={15} />
                  {label}
                </button>
              );
            })}
          </div>
          <div className="grid gap-2">
            {pickerItems.map((item) => {
              const label = profileModulePickerLabel(item.type);
              const accessibleLabel = profileModulePickerAccessibleLabel(item.type);

              return (
                <button
                  key={item.type}
                  type="button"
                  className={cn(
                    "flex min-h-14 min-w-0 items-center gap-3 rounded-card border border-line bg-canvas/45 px-3 py-2 text-left transition duration-fluid ease-fluid hover:border-line-strong hover:bg-surface/70 focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:hover:border-line disabled:hover:bg-canvas/45",
                    !item.enabled ? "opacity-55" : undefined,
                  )}
                  disabled={!item.enabled}
                  aria-label={accessibleLabel}
                  data-testid={`profile-module-picker-${item.type}`}
                  onClick={() => handleChoose(item.type)}
                >
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-card border border-line bg-surface/75 text-text",
                      !item.enabled ? "blur-[0.8px]" : undefined,
                    )}
                  >
                    <ProfileModulePickerIcon
                      category={item.category}
                      disabled={!item.enabled}
                      type={item.type}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-sm font-semibold text-text",
                        !item.enabled ? "blur-[0.7px]" : undefined,
                      )}
                    >
                      {label}
                    </span>
                    <span className="mt-0.5 block truncate text-xs font-medium text-muted">
                      {item.enabled && item.fittingSize ? (
                        profileModuleSizeLabel(item.type, item.fittingSize)
                      ) : (
                        <>
                          <span className="block">
                            {item.warning === "too-large"
                              ? "Selection too large."
                              : "Selection too small."}
                          </span>
                          {item.noteSize ? (
                            <span className="block text-[0.68rem]">
                              ({item.noteSize})
                            </span>
                          ) : null}
                        </>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </ModalSheet>
  );
}

const profileModulePickerCategories = [
  { category: "video", icon: Video, label: "Video" },
  { category: "music", icon: Music2, label: "Music" },
  { category: "images", icon: ImagePlus, label: "Images" },
  { category: "info", icon: Info, label: "Info" },
  { category: "projects", icon: FolderGit2, label: "Projects" },
] satisfies {
  category: ProfileModuleCategory;
  icon: typeof Video;
  label: string;
}[];

const profileModulePickerDisplayLabels: Partial<
  Record<ProfileModule["type"], string>
> = {
  apple_music_artist: "Artist",
  apple_music_playlist: "Playlist",
  apple_music_song: "Music",
  github_repo: "Repository",
  music: "MP3",
  spotify_artist: "Artist",
  spotify_playlist: "Playlist",
  spotify_song: "Music",
  twitch_channel: "Stream",
  youtube_music_artist: "Artist",
  youtube_music_playlist: "Playlist",
  youtube_music_song: "Music",
  youtube_playlist: "Playlist",
  youtube_stream: "Stream",
  youtube_video: "Video",
};

const profileModulePickerAccessibleLabels: Partial<
  Record<ProfileModule["type"], string>
> = {
  apple_music_artist: "Apple Music artist",
  apple_music_playlist: "Apple Music playlist",
  apple_music_song: "Apple Music song",
  github_repo: "GitHub repository",
  music: "MP3 music upload",
  spotify_artist: "Spotify artist",
  spotify_playlist: "Spotify playlist",
  spotify_song: "Spotify song",
  twitch_channel: "Twitch stream",
  youtube_music_artist: "YouTube Music artist",
  youtube_music_playlist: "YouTube Music playlist",
  youtube_music_song: "YouTube Music song",
  youtube_playlist: "YouTube playlist",
  youtube_stream: "YouTube stream",
  youtube_video: "YouTube video",
};

function profileModulePickerLabel(type: ProfileModule["type"]): string {
  return profileModulePickerDisplayLabels[type] ?? getProfileModuleDefinition(type).label;
}

function profileModulePickerAccessibleLabel(type: ProfileModule["type"]): string {
  return profileModulePickerAccessibleLabels[type] ?? profileModulePickerLabel(type);
}

function profileModulePickerBrand(
  type: ProfileModule["type"],
): ProfileConnectionIconPlatform | undefined {
  if (type.startsWith("apple_music_")) {
    return "apple_music";
  }

  if (type === "github_repo") {
    return "github";
  }

  if (type.startsWith("spotify_")) {
    return "spotify";
  }

  if (type === "twitch_channel") {
    return "twitch";
  }

  if (type.startsWith("youtube_")) {
    return "youtube";
  }

  return undefined;
}

function ProfileModulePickerIcon({
  category,
  disabled,
  type,
}: {
  category: ProfileModuleCategory;
  disabled: boolean;
  type: ProfileModule["type"];
}) {
  const brand = profileModulePickerBrand(type);
  const iconClassName = disabled ? "opacity-80" : undefined;

  if (brand) {
    return (
      <ProfileConnectionIcon
        className={iconClassName}
        platform={brand}
        size={16}
      />
    );
  }

  const props = {
    "aria-hidden": true,
    className: iconClassName,
    "data-testid": `profile-module-picker-icon-${type}`,
    size: 16,
  } as const;

  if (category === "video") {
    return <Video {...props} />;
  }

  if (category === "music") {
    return <Music2 {...props} />;
  }

  if (category === "images") {
    return <ImagePlus {...props} />;
  }

  if (category === "projects") {
    return <FolderGit2 {...props} />;
  }

  if (category === "info") {
    return <Info {...props} />;
  }

  return <Sparkles {...props} />;
}

function ModuleSettingsModal({
  integrationAccounts,
  integrationProviders,
  module,
  onClose,
  onConnectProvider,
  onModuleAudioUpload,
  onModuleImagePrepare,
  onModuleImageUpload,
  onModuleVideoUpload,
  onProfileImageUpload,
  onProfileDraftChange,
  onRemove,
  onResize,
  onUpdateConfig,
  profile,
  uploading,
}: {
  integrationAccounts: ProfileIntegrationAccount[];
  integrationProviders: ProfileIntegrationProviderStatus[];
  module: ProfileModule | undefined;
  onClose: () => void;
  onConnectProvider: (provider: ProfileIntegrationProvider) => void;
  onModuleAudioUpload: (file: File) => Promise<UploadedAudio>;
  onModuleImagePrepare: (file: File) => Promise<File>;
  onModuleImageUpload: (file: File) => Promise<string>;
  onModuleVideoUpload: (file: File) => Promise<UploadedVideo>;
  onProfileImageUpload: (
    file: File,
    purpose: "avatar" | "banner" | "profile_background",
  ) => void;
  onProfileDraftChange: (updater: (profile: Profile) => Profile) => void;
  onRemove: (module: ProfileModule) => void;
  onResize: (module: ProfileModule, size: ProfileGridModuleSize) => void;
  onUpdateConfig: (module: ProfileModule, config: ProfileModule["config"]) => void;
  profile: Profile;
  uploading?: "backgroundImage" | "backgroundVideo" | "avatar" | "banner" | undefined;
}) {
  const definition = module ? getProfileModuleDefinition(module.type) : undefined;
  const provider = module ? profileCanvasProviderForModule(module.type) : undefined;
  const providerStatus = provider
    ? integrationProviders.find((item) => item.provider === provider)
    : undefined;
  const connectedAccount = provider
    ? integrationAccounts.find(
        (item) => item.provider === provider && !item.revokedAt,
      )
    : undefined;
  const showConnectPrompt = Boolean(
    provider && providerStatus?.oauthEnabled && !connectedAccount,
  );
  const providerLabel = provider ? profileCanvasProviderLabel(provider) : undefined;
  const [moduleAudioUploading, setModuleAudioUploading] = useState(false);
  const [moduleAudioError, setModuleAudioError] = useState<string | undefined>();
  const [moduleImageUploading, setModuleImageUploading] = useState(false);
  const [moduleImageError, setModuleImageError] = useState<string | undefined>();
  const [moduleVideoUploading, setModuleVideoUploading] = useState(false);
  const [moduleVideoError, setModuleVideoError] = useState<string | undefined>();
  const [connectionPlatform, setConnectionPlatform] =
    useState<ProfileConnectionPlatform>("website");
  const [connectionValue, setConnectionValue] = useState("");
  const [connectionError, setConnectionError] = useState<string | undefined>();
  const [connectionFormOpen, setConnectionFormOpen] = useState(false);
  const [moduleImageCropQueue, setModuleImageCropQueue] = useState<File[]>([]);
  const profileInfoAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const profileInfoBannerInputRef = useRef<HTMLInputElement | null>(null);
  const connectionLinks = module?.config.links ?? [];
  const canAddConnection = connectionLinks.length < maxProfileConnections;
  const moduleMediaItems = module?.config.mediaItems ?? [];
  const singlePhotoImageModule = module
    ? profileModuleStoresSinglePhoto(module.type)
    : false;
  const visibleModuleMediaItems = singlePhotoImageModule
    ? moduleMediaItems.slice(0, 1)
    : moduleMediaItems;
  const moduleMediaMaxItems = singlePhotoImageModule ? 1 : 6;
  const moduleMediaSlots = Math.max(0, moduleMediaMaxItems - moduleMediaItems.length);
  const canUploadModuleImage = singlePhotoImageModule || moduleMediaSlots > 0;
  const activeModuleImageCropFile = moduleImageCropQueue[0];
  const allowedSizes =
    module && module.type !== "placeholder"
      ? [...profileModuleAllowedSizes(module.type)]
      : [];
  const layoutSize = module?.layout
    ? profileGridModuleSpanSize(module.layout.colSpan, module.layout.rowSpan)
    : undefined;
  const currentSize =
    layoutSize ??
    normalizeProfileGridModuleSize(module?.config.canvasSize) ??
    definition?.defaultSize ??
    allowedSizes[0];
  const currentSizeIndex = currentSize
    ? allowedSizes.indexOf(currentSize)
    : -1;
  const resolvedSizeIndex =
    currentSizeIndex >= 0
      ? currentSizeIndex
      : definition
        ? allowedSizes.indexOf(definition.defaultSize)
        : -1;
  const previousSize =
    resolvedSizeIndex > 0 ? allowedSizes[resolvedSizeIndex - 1] : undefined;
  const nextSize =
    resolvedSizeIndex >= 0 && resolvedSizeIndex < allowedSizes.length - 1
      ? allowedSizes[resolvedSizeIndex + 1]
      : undefined;
  const showMusicUrlField = Boolean(
    module &&
      definition?.category === "music" &&
      (module.type !== "music" || module.config.url?.trim()),
  );

  function updateModuleConfig(nextConfig: ProfileModule["config"]) {
    if (!module) {
      return;
    }

    onUpdateConfig(module, nextConfig);
  }

  function configWithContent(
    patch: ProfileModule["config"],
    configured: boolean,
    removeKeys: (keyof ProfileModule["config"])[] = [],
  ): ProfileModule["config"] {
    const canvasSize = module?.config.canvasSize;
    const nextConfig = {
      ...module?.config,
      ...patch,
      configured,
      ...(canvasSize ? { canvasSize } : {}),
    };

    removeKeys.forEach((key) => {
      delete nextConfig[key];
    });

    return nextConfig;
  }

  function handleUrlConfig(value: string) {
    if (!module || !definition) {
      return;
    }

    const trimmed = value.trim();
    const configured = trimmed.length > 0;
    const label = module.config.label ?? profileModuleFallbackTitle(module.type);

    if (module.type === "connections" || module.type === "links") {
      updateModuleConfig(
        configWithContent(
          {
            links: configured
              ? [{ label, platform: "website", url: trimmed }]
              : [],
          },
          configured,
        ),
      );
      return;
    }

    updateModuleConfig(
      configWithContent(
        {
          label,
          url: trimmed,
        },
        configured,
        definition.category === "music" ? ["audio", "integration"] : ["video", "integration"],
      ),
    );
  }

  function handleProfileInfoImageInput(
    event: ChangeEvent<HTMLInputElement>,
    purpose: "avatar" | "banner",
  ) {
    const file = event.currentTarget.files?.[0];

    if (file) {
      onProfileImageUpload(file, purpose);
    }

    event.currentTarget.value = "";
  }

  function handleClose() {
    setConnectionPlatform("website");
    setConnectionValue("");
    setConnectionError(undefined);
    setConnectionFormOpen(false);
    setModuleAudioError(undefined);
    setModuleVideoError(undefined);
    setModuleImageCropQueue([]);
    onClose();
  }

  function updateConnectionLinks(nextLinks: ProfileModuleLink[]) {
    updateModuleConfig(
      configWithContent(
        {
          links: profileModuleUniqueConnectionLinks(nextLinks).slice(
            0,
            maxProfileConnections,
          ),
        },
        nextLinks.length > 0,
      ),
    );
  }

  function handleAddConnection() {
    if (!module) {
      return;
    }

    const result = profileModuleConnectionLinkFromDraft(
      connectionPlatform,
      connectionValue,
    );

    if ("error" in result) {
      setConnectionError(result.error);
      return;
    }

    const nextLinks = profileModuleUniqueConnectionLinks([
      ...connectionLinks,
      result.link,
    ]);

    updateConnectionLinks(nextLinks);
    setConnectionValue("");
    setConnectionError(undefined);
    setConnectionFormOpen(false);
  }

  function handleRemoveConnection(index: number) {
    updateConnectionLinks(connectionLinks.filter((_, itemIndex) => itemIndex !== index));
  }

  function handleMoveConnection(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;

    if (nextIndex < 0 || nextIndex >= connectionLinks.length) {
      return;
    }

    const nextLinks = [...connectionLinks];
    const [item] = nextLinks.splice(index, 1);

    if (!item) {
      return;
    }

    nextLinks.splice(nextIndex, 0, item);
    updateConnectionLinks(nextLinks);
  }

  function handleRemoveModuleImage(index: number) {
    if (!module) {
      return;
    }

    const mediaItems = moduleMediaItems.filter(
      (_, itemIndex) => itemIndex !== index,
    );

    updateModuleConfig(
      configWithContent(
        {
          mediaItems,
        },
        mediaItems.length > 0,
      ),
    );
  }

  async function handleModuleVideoSelection(file: File | undefined) {
    if (!module || !file || moduleVideoUploading) {
      return;
    }

    const validationError = validateProfileModuleVideoFile(file);

    if (validationError) {
      setModuleVideoError(validationError);
      return;
    }

    setModuleVideoUploading(true);
    setModuleVideoError(undefined);

    try {
      const [upload, duration] = await Promise.all([
        onModuleVideoUpload(file),
        readMediaFileDuration(file),
      ]);
      const title = sanitizeUploadedMediaTitle(file.name, "Uploaded video");
      const video = {
        mime: upload.mime,
        ...(upload.posterUrl ? { posterUrl: upload.posterUrl } : {}),
        size: upload.size,
        title,
        type: upload.type,
        uploadedAt: new Date().toISOString(),
        url: upload.url,
        ...(duration ? { duration } : {}),
      };

      updateModuleConfig(
        configWithContent(
          {
            displayMode: "video",
            label: title,
            sourceMode: "upload",
            video,
          },
          true,
          ["url", "integration", "platform"],
        ),
      );
    } catch (error) {
      setModuleVideoError(
        error instanceof Error ? error.message : "Could not upload this video.",
      );
    } finally {
      setModuleVideoUploading(false);
    }
  }

  async function handleModuleAudioSelection(file: File | undefined) {
    if (!module || !file || moduleAudioUploading) {
      return;
    }

    const validationError = validateProfileModuleAudioFile(file);

    if (validationError) {
      setModuleAudioError(validationError);
      return;
    }

    setModuleAudioUploading(true);
    setModuleAudioError(undefined);

    try {
      const [upload, duration] = await Promise.all([
        onModuleAudioUpload(file),
        readMediaFileDuration(file),
      ]);
      const title = sanitizeUploadedMediaTitle(file.name, "Uploaded track");
      const audio = {
        mime: upload.mime,
        size: upload.size,
        title,
        type: upload.type,
        uploadedAt: new Date().toISOString(),
        url: upload.url,
        ...(duration ? { duration } : {}),
      };

      updateModuleConfig(
        configWithContent(
          {
            audio,
            displayMode: "player",
            label: title,
            platform: "custom",
            sourceMode: "upload",
          },
          true,
          ["url", "integration"],
        ),
      );
    } catch (error) {
      setModuleAudioError(
        error instanceof Error ? error.message : "Could not upload this MP3.",
      );
    } finally {
      setModuleAudioUploading(false);
    }
  }

  function handleRemoveModuleVideo() {
    if (!module) {
      return;
    }

    updateModuleConfig(
      configWithContent(
        {},
        false,
        ["video", "url", "integration"],
      ),
    );
  }

  function handleRemoveModuleAudio() {
    if (!module) {
      return;
    }

    updateModuleConfig(
      configWithContent(
        {},
        false,
        ["audio", "integration"],
      ),
    );
  }

  async function handleModuleImageSelection(files: FileList | null) {
    if (!module || !files || !canUploadModuleImage) {
      return;
    }

    const selectedFiles: File[] = [];
    const selectionLimit = singlePhotoImageModule ? 1 : moduleMediaSlots;

    for (const file of Array.from(files).slice(0, selectionLimit)) {
      try {
        selectedFiles.push(await onModuleImagePrepare(file));
      } catch (error) {
        setModuleImageError(error instanceof Error ? error.message : "Image could not be prepared.");
        continue;
      }
    }

    if (selectedFiles.length === 0) {
      return;
    }

    setModuleImageError(undefined);
    setModuleImageCropQueue(selectedFiles);
  }

  async function handleCroppedModuleImage(croppedFile: File) {
    if (!module) {
      return;
    }

    setModuleImageUploading(true);
    setModuleImageError(undefined);

    try {
      const url = await onModuleImageUpload(croppedFile);
      const mediaItems = singlePhotoImageModule
        ? [{ url }]
        : [
            ...(module.config.mediaItems ?? []),
            { url },
          ].slice(0, moduleMediaMaxItems);

      updateModuleConfig(
        configWithContent(
          {
            mediaItems,
          },
          mediaItems.length > 0,
        ),
      );
    } catch (error) {
      setModuleImageError(
        error instanceof Error ? error.message : "Could not upload this image.",
      );
    } finally {
      setModuleImageUploading(false);
      setModuleImageCropQueue((queue) => queue.slice(1));
    }
  }

  return (
    <ModalSheet
      open={Boolean(module)}
      onClose={handleClose}
      title={module ? profileModuleFallbackTitle(module.type) : "Module settings"}
      description={definition?.description}
      size="md"
      testId="profile-module-settings"
      footer={
        module ? (
          <div className="flex items-center justify-end gap-2">
            {module.type !== "profile_info" ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="border-rose/35 bg-rose/12 text-rose-ink hover:border-rose/60"
                icon={<Trash2 aria-hidden="true" size={16} />}
                onClick={() => onRemove(module)}
              >
                Remove
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              icon={<Check aria-hidden="true" size={16} />}
              data-testid="profile-module-settings-done"
              onClick={onClose}
            >
              Done
            </Button>
          </div>
        ) : undefined
      }
    >
      {module && definition ? (
        <div className="space-y-4">
          {allowedSizes.length > 1 && currentSize ? (
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-canvas/38 p-3"
              data-testid="profile-module-size-stepper"
            >
              <p className="text-xs font-semibold uppercase text-muted">Size</p>
              <div className="inline-flex min-h-10 items-center overflow-hidden rounded-control border border-line bg-surface/70 shadow-inner-soft">
                <button
                  type="button"
                  className="grid size-10 place-items-center text-muted transition hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Shrink module"
                  disabled={!previousSize}
                  data-testid="profile-module-size-decrease"
                  onClick={() => {
                    if (previousSize) {
                      onResize(module, previousSize);
                    }
                  }}
                >
                  <Minus aria-hidden="true" size={16} />
                </button>
                <span
                  className="min-w-24 border-x border-line px-3 text-center text-sm font-semibold text-text"
                  data-testid="profile-module-size-current"
                >
                  {profileModuleSizeLabel(module.type, currentSize)}
                  <span className="ml-1 text-xs font-medium text-muted">
                    {currentSize}
                  </span>
                </span>
                <button
                  type="button"
                  className="grid size-10 place-items-center text-muted transition hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Grow module"
                  disabled={!nextSize}
                  data-testid="profile-module-size-increase"
                  onClick={() => {
                    if (nextSize) {
                      onResize(module, nextSize);
                    }
                  }}
                >
                  <Plus aria-hidden="true" size={16} />
                </button>
              </div>
            </div>
          ) : null}
          {module.type === "profile_info" ? (
            <div className="space-y-3">
              <div
                className="overflow-hidden rounded-card border border-line bg-canvas/38"
                data-testid="profile-info-media-settings"
              >
                <input
                  ref={profileInfoAvatarInputRef}
                  className="sr-only"
                  type="file"
                  accept={imageUploadAccept}
                  data-testid="profile-info-modal-avatar-input"
                  disabled={Boolean(uploading)}
                  onChange={(event) => handleProfileInfoImageInput(event, "avatar")}
                />
                <input
                  ref={profileInfoBannerInputRef}
                  className="sr-only"
                  type="file"
                  accept={imageUploadAccept}
                  data-testid="profile-info-modal-banner-input"
                  disabled={Boolean(uploading)}
                  onChange={(event) => handleProfileInfoImageInput(event, "banner")}
                />
                <div
                  className="group/profile-banner relative min-h-32 overflow-hidden bg-surface/55"
                  data-profile-banner-treatment="cover"
                  data-testid="profile-info-preview-banner"
                >
                  {safeProfileImageUrl(profile.bannerUrl) ? (
                    <img
                      alt=""
                      className="absolute inset-0 size-full object-cover object-center"
                      src={safeProfileImageUrl(profile.bannerUrl)}
                      data-testid="profile-info-preview-banner-image"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-cool/12 to-leaf/14" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-b from-canvas/18 via-canvas/5 to-canvas/46" />
                  <button
                    type="button"
                    className="absolute inset-0 z-10 grid place-items-center text-text transition focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-70"
                    aria-label="Change profile banner"
                    title="Change profile banner"
                    data-testid="profile-info-banner-edit-overlay"
                    disabled={Boolean(uploading)}
                    onClick={() => profileInfoBannerInputRef.current?.click()}
                  >
                    <span className="inline-flex translate-y-1 items-center gap-2 rounded-full border border-white/20 bg-black/48 px-3 py-2 text-sm font-semibold text-white opacity-0 shadow-soft backdrop-blur transition group-hover/profile-banner:translate-y-0 group-hover/profile-banner:opacity-100 group-focus-within/profile-banner:translate-y-0 group-focus-within/profile-banner:opacity-100">
                      <Pencil aria-hidden="true" size={16} />
                      {uploading === "banner" ? "Uploading" : "Change Banner"}
                    </span>
                  </button>
                  <div className="absolute bottom-2 left-2 z-20 flex items-end gap-2">
                    <button
                      type="button"
                      className="group/profile-avatar relative rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-70"
                      aria-label="Change profile avatar"
                      title="Change profile avatar"
                      data-testid="profile-info-avatar-edit-overlay"
                      disabled={Boolean(uploading)}
                      onClick={() => profileInfoAvatarInputRef.current?.click()}
                    >
                      <Avatar
                        user={profile.user}
                        size="lg"
                        className="size-16 border-[3px] border-surface shadow-soft"
                      />
                      <span className="absolute inset-0 grid place-items-center rounded-full bg-black/52 text-white opacity-0 backdrop-blur-[2px] transition group-hover/profile-avatar:opacity-100 group-focus-visible/profile-avatar:opacity-100">
                        <Pencil aria-hidden="true" size={20} />
                      </span>
                      {uploading === "avatar" ? (
                        <span className="absolute inset-x-0 bottom-1 text-center text-[0.6rem] font-bold uppercase tracking-wide text-white">
                          Uploading
                        </span>
                      ) : null}
                    </button>
                    <div className="mb-1 min-w-0">
                      <p className="truncate text-sm font-semibold text-text">
                        {profile.user.displayName}
                      </p>
                      <p className="truncate text-xs font-medium text-muted">
                        @{profile.user.handle}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-2 p-2 sm:grid-cols-2">
                  <button
                    type="button"
                    className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-control border border-line bg-surface/62 px-2.5 text-xs font-semibold text-text transition hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60"
                    title="Change profile avatar"
                    disabled={Boolean(uploading)}
                    onClick={() => profileInfoAvatarInputRef.current?.click()}
                  >
                    <ImagePlus aria-hidden="true" size={14} />
                    {uploading === "avatar" ? "Uploading" : "Avatar"}
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-control border border-line bg-surface/62 px-2.5 text-xs font-semibold text-text transition hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60"
                    title="Change profile banner"
                    disabled={Boolean(uploading)}
                    onClick={() => profileInfoBannerInputRef.current?.click()}
                  >
                    <ImagePlus aria-hidden="true" size={14} />
                    {uploading === "banner" ? "Uploading" : "Banner"}
                  </button>
                </div>
              </div>
              <label className="block">
                <span className="text-xs font-semibold uppercase text-muted">
                  Display name
                </span>
                <input
                  className="mt-1 min-h-11 w-full rounded-control border border-line bg-canvas/45 px-3 text-sm font-semibold text-text outline-none transition focus:border-line-strong focus:outline-2 focus:outline-focus"
                  value={profile.user.displayName}
                  data-testid="profile-info-modal-display-name"
                  onChange={(event) => {
                    const displayName = event.currentTarget.value;
                    onProfileDraftChange((currentProfile) => ({
                      ...currentProfile,
                      user: {
                        ...currentProfile.user,
                        displayName,
                      },
                    }));
                  }}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase text-muted">
                  Bio
                </span>
                <MentionTextarea
                  className="mt-1 min-h-24 w-full resize-none rounded-control border border-line bg-canvas/45 px-3 py-2 text-sm leading-6 text-text outline-none transition focus:border-line-strong focus:outline-2 focus:outline-focus"
                  value={profile.bio}
                  data-testid="profile-info-modal-bio"
                  onValueChange={(bio) => {
                    onProfileDraftChange((currentProfile) => ({
                      ...currentProfile,
                      bio,
                    }));
                  }}
                />
              </label>
            </div>
          ) : null}
          {module.type === "about" ||
          module.type === "text" ||
          module.type === "custom_text" ? (
            <MarkdownEditor
              value={module.config.body ?? ""}
              entities={module.textEntities?.body}
              textareaTestId="profile-module-settings-body"
              onValueChange={(body) => {
                updateModuleConfig(
                  configWithContent({ body }, body.trim().length > 0),
                );
              }}
            />
          ) : null}
          {module.type === "connections" || module.type === "links" ? (
            <div
              className="space-y-3"
              data-testid="profile-connections-settings"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase text-muted">
                  Connections
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!canAddConnection}
                  icon={<Plus aria-hidden="true" size={15} />}
                  data-testid="profile-connection-add-open-button"
                  onClick={() => {
                    setConnectionFormOpen((open) => !open);
                    setConnectionError(undefined);
                  }}
                >
                  Add
                </Button>
              </div>
              {connectionLinks.length > 0 ? (
                <div
                  className="grid gap-2"
                  data-testid="profile-connection-settings-list"
                >
                  {connectionLinks.map((link, index) => {
                    const platform =
                      profileModuleConnectionPlatform(link.platform);
                    const platformLabel = connectionPlatformLabel(platform);

                    return (
                      <div
                        key={`${link.url}:${index}`}
                        className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-card border border-line bg-canvas/38 p-2"
                        data-testid={`profile-connection-settings-row-${index}`}
                      >
                        <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface/72 text-text">
                          <ProfileConnectionIcon platform={platform} size={17} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-text">
                            {link.label || platformLabel}
                          </p>
                          <p className="truncate text-xs font-medium text-muted">
                            {platformLabel} · {profileModuleConnectionPreview(link.url)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="grid size-8 place-items-center rounded-control border border-line bg-surface/72 text-muted transition hover:border-line-strong hover:text-text focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-45"
                            aria-label={`Move ${link.label || platformLabel} up`}
                            disabled={index === 0}
                            data-testid={`profile-connection-move-up-${index}`}
                            onClick={() => handleMoveConnection(index, -1)}
                          >
                            <ArrowUp aria-hidden="true" size={15} />
                          </button>
                          <button
                            type="button"
                            className="grid size-8 place-items-center rounded-control border border-line bg-surface/72 text-muted transition hover:border-line-strong hover:text-text focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-45"
                            aria-label={`Move ${link.label || platformLabel} down`}
                            disabled={index === connectionLinks.length - 1}
                            data-testid={`profile-connection-move-down-${index}`}
                            onClick={() => handleMoveConnection(index, 1)}
                          >
                            <ArrowDown aria-hidden="true" size={15} />
                          </button>
                          <button
                            type="button"
                            className="grid size-8 place-items-center rounded-control border border-rose/35 bg-rose/12 text-rose-ink transition hover:border-rose/60 focus-visible:outline-2 focus-visible:outline-focus"
                            aria-label={`Remove ${link.label || platformLabel}`}
                            data-testid={`profile-connection-remove-${index}`}
                            onClick={() => handleRemoveConnection(index)}
                          >
                            <Trash2 aria-hidden="true" size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-card border border-dashed border-line bg-canvas/38 px-3 py-2 text-sm font-medium text-muted">
                  No connections yet.
                </p>
              )}
              {connectionFormOpen && canAddConnection ? (
                <div
                  className="space-y-3 rounded-card border border-line bg-canvas/35 p-3"
                  data-testid="profile-connection-add-form"
                >
                  <div
                    className="grid grid-cols-5 gap-2"
                    aria-label="Connection platform"
                  >
                    {profileConnectionPlatforms.map((platformOption) => (
                      <button
                        key={platformOption.value}
                        type="button"
                        className="grid min-h-11 place-items-center rounded-control border border-line bg-surface/58 text-muted transition hover:border-line-strong hover:text-text focus-visible:outline-2 focus-visible:outline-focus aria-pressed:border-focus aria-pressed:bg-focus/18 aria-pressed:text-text"
                        aria-label={platformOption.label}
                        aria-pressed={connectionPlatform === platformOption.value}
                        title={platformOption.label}
                        data-testid={`profile-connection-platform-${platformOption.value}`}
                        onClick={() => {
                          setConnectionPlatform(platformOption.value);
                          setConnectionError(undefined);
                        }}
                      >
                        <ProfileConnectionIcon
                          platform={platformOption.value}
                          size={18}
                        />
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <label className="block min-w-0">
                      <span className="sr-only">
                        {connectionPlatformLabel(connectionPlatform)} handle or link
                      </span>
                      <input
                        className="min-h-11 w-full rounded-control border border-line bg-canvas/55 px-3 text-sm text-text outline-none transition placeholder:text-muted focus:border-line-strong focus:outline-2 focus:outline-focus"
                        value={connectionValue}
                        placeholder={
                          profileConnectionPlatforms.find(
                            (item) => item.value === connectionPlatform,
                          )?.placeholder ?? "Handle or link"
                        }
                        data-testid="profile-connection-value-input"
                        onChange={(event) => {
                          setConnectionValue(event.currentTarget.value);
                          setConnectionError(undefined);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            handleAddConnection();
                          }
                        }}
                      />
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      icon={<Plus aria-hidden="true" size={15} />}
                      data-testid="profile-connection-add-button"
                      onClick={handleAddConnection}
                    >
                      Add
                    </Button>
                  </div>
                  {connectionError ? (
                    <p
                      className="text-xs font-semibold text-rose-ink"
                      role="alert"
                    >
                      {connectionError}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {module.type === "uploaded_video" ? (
            <div
              className="space-y-3"
              data-testid="profile-video-module-settings"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase text-muted">Video file</p>
                <label
                  className={cn(
                    "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-control border border-line bg-canvas/45 px-3 text-sm font-semibold text-text transition hover:border-line-strong focus-within:outline-2 focus-within:outline-focus",
                    moduleVideoUploading ? "pointer-events-none opacity-50" : undefined,
                  )}
                  data-profile-edit-control="true"
                  title={module.config.video ? "Replace video" : "Upload video"}
                >
                  <Upload aria-hidden="true" size={16} />
                  {moduleVideoUploading ? "Uploading" : module.config.video ? "Replace" : "Upload"}
                  <input
                    className="sr-only"
                    type="file"
                    accept={videoUploadAccept}
                    data-testid="profile-module-settings-video-input"
                    disabled={moduleVideoUploading}
                    onChange={(event) => {
                      void handleModuleVideoSelection(event.currentTarget.files?.[0]);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
              {module.config.video ? (
                <div
                  className="overflow-hidden rounded-card border border-line bg-black"
                  data-testid="profile-module-video-preview"
                >
                  <video
                    className="aspect-video w-full bg-black object-contain"
                    controls
                    playsInline
                    poster={module.config.video.posterUrl}
                    preload="metadata"
                  >
                    <source src={module.config.video.url} type={module.config.video.mime} />
                  </video>
                  <div className="flex items-center justify-between gap-3 border-t border-line bg-canvas/70 px-3 py-2">
                    <p className="min-w-0 truncate text-sm font-semibold text-text">
                      {module.config.video.title ?? module.config.label ?? "Uploaded video"}
                    </p>
                    <button
                      type="button"
                      className="grid size-8 shrink-0 place-items-center rounded-control border border-rose/35 bg-rose/12 text-rose-ink transition hover:border-rose/60 focus-visible:outline-2 focus-visible:outline-focus"
                      aria-label="Remove video"
                      data-testid="profile-module-video-remove"
                      onClick={handleRemoveModuleVideo}
                    >
                      <Trash2 aria-hidden="true" size={15} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid min-h-28 place-items-center rounded-card border border-dashed border-line bg-canvas/35 px-3 text-center text-sm font-medium text-muted">
                  {videoUploadFormatHelp}
                </div>
              )}
              {moduleVideoError ? (
                <p className="text-xs font-semibold text-rose-ink" role="alert">
                  {moduleVideoError}
                </p>
              ) : null}
            </div>
          ) : definition.category === "music" ? (
            <div className="space-y-3">
              {module.type === "music" ? (
                <div
                  className="space-y-3 rounded-card border border-line bg-canvas/35 p-3"
                  data-testid="profile-audio-module-settings"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase text-muted">MP3 upload</p>
                    <label
                      className={cn(
                        "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-control border border-line bg-surface/62 px-3 text-sm font-semibold text-text transition hover:border-line-strong focus-within:outline-2 focus-within:outline-focus",
                        moduleAudioUploading ? "pointer-events-none opacity-50" : undefined,
                      )}
                      data-profile-edit-control="true"
                      title={module.config.audio ? "Replace MP3" : "Upload MP3"}
                    >
                      <Upload aria-hidden="true" size={16} />
                      {moduleAudioUploading ? "Uploading" : module.config.audio ? "Replace" : "Upload"}
                      <input
                        className="sr-only"
                        type="file"
                        accept="audio/mpeg,.mp3"
                        data-testid="profile-module-settings-audio-input"
                        disabled={moduleAudioUploading}
                        onChange={(event) => {
                          void handleModuleAudioSelection(event.currentTarget.files?.[0]);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>
                  {module.config.audio ? (
                    <div
                      className="flex min-w-0 items-center gap-3 rounded-card border border-line bg-surface/62 p-3"
                      data-testid="profile-module-audio-preview"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-card border border-line bg-canvas/70 text-text">
                        <Music2 aria-hidden="true" size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-text">
                          {module.config.audio.title ?? module.config.label ?? "Uploaded track"}
                        </p>
                        <p className="truncate text-xs font-medium text-muted">
                          MP3 · {formatUploadSize(module.config.audio.size)}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="grid size-8 shrink-0 place-items-center rounded-control border border-rose/35 bg-rose/12 text-rose-ink transition hover:border-rose/60 focus-visible:outline-2 focus-visible:outline-focus"
                        aria-label="Remove MP3"
                        data-testid="profile-module-audio-remove"
                        onClick={handleRemoveModuleAudio}
                      >
                        <Trash2 aria-hidden="true" size={15} />
                      </button>
                    </div>
                  ) : (
                    <p className="rounded-card border border-dashed border-line bg-canvas/38 px-3 py-2 text-sm font-medium text-muted">
                      Upload a custom MP3.
                    </p>
                  )}
                  {moduleAudioError ? (
                    <p className="text-xs font-semibold text-rose-ink" role="alert">
                      {moduleAudioError}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {showMusicUrlField ? (
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-muted">
                    Music link
                  </span>
                  <input
                    className="mt-1 min-h-11 w-full rounded-control border border-line bg-canvas/45 px-3 text-sm text-text outline-none transition focus:border-line-strong focus:outline-2 focus:outline-focus"
                    value={module.config.url ?? ""}
                    placeholder="https://"
                    data-testid="profile-module-settings-url"
                    onChange={(event) => handleUrlConfig(event.currentTarget.value)}
                  />
                </label>
              ) : null}
            </div>
          ) : definition.category === "video" || module.type === "github_repo" ? (
            <label className="block">
              <span className="text-xs font-semibold uppercase text-muted">
                {module.type === "github_repo" ? "Repo link" : "Media link"}
              </span>
              <input
                className="mt-1 min-h-11 w-full rounded-control border border-line bg-canvas/45 px-3 text-sm text-text outline-none transition focus:border-line-strong focus:outline-2 focus:outline-focus"
                value={module.config.url ?? ""}
                placeholder="https://"
                data-testid="profile-module-settings-url"
                onChange={(event) => handleUrlConfig(event.currentTarget.value)}
              />
            </label>
          ) : null}
          {definition.category === "images" ? (
            <div
              className="space-y-3"
              data-testid="profile-image-module-settings"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase text-muted">
                  {singlePhotoImageModule ? "Photo" : "Photos"}
                </p>
                <label
                  className={cn(
                    "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-control border border-line bg-canvas/45 px-3 text-sm font-semibold text-text transition hover:border-line-strong focus-within:outline-2 focus-within:outline-focus",
                    !canUploadModuleImage || moduleImageUploading
                      ? "pointer-events-none opacity-50"
                      : undefined,
                  )}
                  data-profile-edit-control="true"
                  title={singlePhotoImageModule && moduleMediaItems.length > 0 ? "Replace photo" : "Add photos"}
                >
                  <ImagePlus aria-hidden="true" size={16} />
                  {moduleImageUploading
                    ? "Uploading"
                    : singlePhotoImageModule && moduleMediaItems.length > 0
                      ? "Replace"
                      : "Add"}
                  <input
                    className="sr-only"
                    type="file"
                    accept={imageUploadAccept}
                    multiple={!singlePhotoImageModule}
                    data-testid="profile-module-settings-image-input"
                    disabled={moduleImageUploading || !canUploadModuleImage}
                    onChange={(event) => {
                      void handleModuleImageSelection(event.currentTarget.files);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
              {visibleModuleMediaItems.length > 0 ? (
                <div
                  className="grid grid-cols-3 gap-2"
                  data-testid="profile-module-media-list"
                >
                  {visibleModuleMediaItems.map((item, index) => (
                    <figure
                      key={`${item.url}:${index}`}
                      className="group relative aspect-square min-w-0 overflow-hidden rounded-card border border-line bg-canvas/45"
                      data-testid={`profile-module-media-item-${index}`}
                    >
                      <img
                        alt=""
                        className="size-full object-cover"
                        src={item.url}
                      />
                      <button
                        type="button"
                        className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full border border-rose/35 bg-canvas/84 text-rose-ink opacity-95 shadow-soft transition hover:border-rose/60 focus-visible:outline-2 focus-visible:outline-focus"
                        aria-label={`Remove photo ${index + 1}`}
                        data-testid={`profile-module-media-remove-${index}`}
                        onClick={() => handleRemoveModuleImage(index)}
                      >
                        <Trash2 aria-hidden="true" size={14} />
                      </button>
                    </figure>
                  ))}
                </div>
              ) : (
                <div className="grid min-h-28 place-items-center rounded-card border border-dashed border-line bg-canvas/35 px-3 text-center text-sm font-medium text-muted">
                  Add cropped photos.
                </div>
              )}
              <p className="text-xs font-medium text-muted">
                {moduleMediaItems.length}/6
                {moduleImageCropQueue.length > 0
                  ? ` · ${moduleImageCropQueue.length} crop queued`
                  : ""}
              </p>
              {moduleImageError ? (
                <p className="text-xs font-semibold text-rose-ink" role="alert">
                  {moduleImageError}
                </p>
              ) : null}
            </div>
          ) : null}
          {showConnectPrompt && provider ? (
            <div className="rounded-card border border-line bg-canvas/45 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text">Connect</p>
                  <p className="mt-1 text-xs font-medium text-muted">
                    Connect {providerLabel} for authenticated provider data.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  data-testid={`profile-integration-connect-${provider}`}
                  onClick={() => onConnectProvider(provider)}
                >
                  Connect
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      <ImageCropModal
        open={Boolean(activeModuleImageCropFile)}
        file={activeModuleImageCropFile}
        purpose="post_media"
        busy={moduleImageUploading}
        onClose={() => setModuleImageCropQueue([])}
        onApply={handleCroppedModuleImage}
      />
    </ModalSheet>
  );
}

function profileModuleConnectionPlatform(
  value: string | undefined,
): ProfileConnectionPlatform {
  return profileConnectionPlatforms.some((item) => item.value === value)
    ? (value as ProfileConnectionPlatform)
    : "website";
}

function profileModuleConnectionPreview(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return `${parsedUrl.hostname.replace(/^www\./, "")}${parsedUrl.pathname === "/" ? "" : parsedUrl.pathname}`;
  } catch {
    return url;
  }
}

function profileModuleStoresSinglePhoto(type: ProfileModule["type"]): boolean {
  return type === "uploaded_image" || type === "gallery_media";
}

function profileModuleUniqueConnectionLinks(
  links: ProfileModuleLink[],
): ProfileModuleLink[] {
  const seen = new Set<string>();
  const uniqueLinks: ProfileModuleLink[] = [];

  for (const link of links) {
    const key = link.url.trim().toLowerCase();

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueLinks.push(link);
  }

  return uniqueLinks;
}

function profileModuleConnectionLinkFromDraft(
  platform: ProfileConnectionPlatform,
  value: string,
): { link: ProfileModuleLink } | { error: string } {
  const result = validateProfileConnectionDraft(platform, value);

  if ("error" in result) {
    return { error: result.error };
  }

  const link = profileModuleLinkFromConnection(result.connection);

  if (!link) {
    return { error: "Connection must resolve to a safe link." };
  }

  return { link };
}

function clampProfileModuleLayout(layout: ProfileModuleLayout): ProfileModuleLayout {
  const colSpan = Math.max(
    1,
    Math.min(PROFILE_CANVAS_PROFILE_INFO_COLUMNS, layout.colSpan),
  );
  const rowSpan = Math.max(
    1,
    Math.min(PROFILE_CANVAS_MAX_MODULE_ROWS, layout.rowSpan),
  );

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
    starCount: followState.starCount,
    isFollowing: followState.isFollowing,
    isFollowedBy: followState.isFollowedBy,
    isMoot: followState.isMoot,
    isStarred: followState.isStarred,
    isFollowRequestPending: followState.isFollowRequestPending ?? false,
    blockedByMe: followState.blockedByMe ?? profile.blockedByMe ?? false,
    mutedByMe: followState.mutedByMe ?? profile.mutedByMe ?? false,
    stats: {
      ...profile.stats,
      followers: followState.followerCount,
      following: followState.followingCount,
      moots: mootCount,
      stars: followState.starCount,
    },
  };
}

function ProfilePersonalBackdrop({
  paused = false,
  profile,
}: {
  paused?: boolean;
  profile: Profile;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoUrl = safeProfileVideoUrl(profile.profileBackgroundVideo);
  const imageUrl = safeProfileImageUrl(
    profile.profileBackgroundVideoPoster ?? profile.profileBackground,
  );
  const blurTreatment = profile.profileBackgroundBlur;
  const visibility = profileBackgroundVisibility(blurTreatment);
  const playbackState = videoUrl ? (paused ? "paused" : "playing") : "static";

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !videoUrl) {
      return;
    }

    if (paused) {
      video.pause();
      return;
    }

    void video.play().catch(() => undefined);
  }, [paused, videoUrl]);

  return (
    <div
      aria-hidden="true"
      className="profile-personal-backdrop pointer-events-none z-0 min-h-full overflow-hidden"
      data-profile-background-blur={blurTreatment}
      data-profile-background-playback={playbackState}
      data-profile-background-source={videoUrl ? "video" : imageUrl ? "image" : "fallback"}
      data-profile-background-visibility={visibility.name}
      data-testid="profile-personal-backdrop"
    >
      {videoUrl ? (
        <video
          ref={videoRef}
          aria-hidden="true"
          className={cn(
            "absolute inset-0 size-full object-cover object-center saturate-[1.04] motion-reduce:hidden",
            visibility.mediaOpacity,
            profileBackgroundBlurClass(blurTreatment),
          )}
          autoPlay={!paused}
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
            "absolute inset-0 size-full object-cover object-center saturate-[1.04]",
            visibility.mediaOpacity,
            videoUrl && !paused ? "motion-safe:hidden" : undefined,
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
  onShareProfile: () => void;
  onStarToggle: () => void;
  profile: Profile;
  profileControlBusy?: "block" | "mute" | undefined;
  showChatHint: boolean;
  size: ProfileGridModuleSize;
  starPosting: boolean;
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
  onShareProfile,
  onStarToggle,
  profile,
  profileControlBusy,
  showChatHint,
  size,
  starPosting,
  status,
}: ProfileInfoModuleProps) {
  const span = profileGridModuleSizeSpan(size);
  const mobileProjection = useProfileMobileCanvasProjection();
  const renderedSpan = mobileProjection ? profileInfoMobileProjectedSpan(span) : span;
  const mobileProjected = renderedSpan.columns !== span.columns || renderedSpan.rows !== span.rows;
  const showBlankEditPrompt =
    editing && isOwnProfile && profileInfoNeedsEditPrompt(profile);

  return (
    <div
      className="profile-grid-scaled-content size-full min-w-0"
      data-profile-info-columns={renderedSpan.columns}
      data-profile-info-mobile-projection={mobileProjected ? "true" : undefined}
      data-profile-info-rows={renderedSpan.rows}
      data-testid="profile-module-profile-info"
    >
      {showBlankEditPrompt ? (
        <ProfileInfoBlankEditPrompt />
      ) : (
        <ProfileInfoSizedCard
          activeFollowError={activeFollowError}
          activeProfileControlError={activeProfileControlError}
          activeProfileControlMessage={activeProfileControlMessage}
          editing={editing}
          featuredBadges={featuredBadges}
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
          onBlockToggle={onBlockToggle}
          onFollowToggle={onFollowToggle}
          onMuteToggle={onMuteToggle}
          onOpenPanel={onOpenPanel}
          onShareProfile={onShareProfile}
          onStarToggle={onStarToggle}
          profile={profile}
          profileControlBusy={profileControlBusy}
          mobileProjected={mobileProjected}
          showChatHint={showChatHint}
          span={span}
          starPosting={starPosting}
        />
      )}
    </div>
  );
}

function useProfileMobileCanvasProjection(): boolean {
  const [mobileProjection, setMobileProjection] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const syncProjection = () => setMobileProjection(mediaQuery.matches);

    syncProjection();
    mediaQuery.addEventListener("change", syncProjection);

    return () => mediaQuery.removeEventListener("change", syncProjection);
  }, []);

  return mobileProjection;
}

function profileInfoMobileProjectedSpan(span: {
  columns: number;
  rows: number;
  size: ProfileGridModuleSize;
}): {
  columns: number;
  rows: number;
  size: ProfileGridModuleSize;
} {
  if (span.columns <= PROFILE_CANVAS_MOBILE_COLUMNS) {
    return span;
  }

  return {
    ...span,
    columns: PROFILE_CANVAS_MOBILE_COLUMNS,
    rows: Math.ceil((span.columns * span.rows) / PROFILE_CANVAS_MOBILE_COLUMNS),
  };
}

type ProfileInfoSizedCardProps = {
  activeFollowError?: string | undefined;
  activeProfileControlError?: string | undefined;
  activeProfileControlMessage?: string | undefined;
  editing: boolean;
  featuredBadges: UserBadge[];
  followPosting: boolean;
  isOwnProfile: boolean;
  messageToHandle?: string | undefined;
  onBlockToggle?: (() => Promise<void> | void) | undefined;
  onFollowToggle: () => void;
  onMuteToggle?: (() => Promise<void> | void) | undefined;
  onOpenPanel: (panel: "followers" | "following" | "badges") => void;
  onShareProfile: () => void;
  onStarToggle: () => void;
  profile: Profile;
  profileControlBusy?: "block" | "mute" | undefined;
  mobileProjected: boolean;
  showChatHint: boolean;
  span: { columns: number; rows: number; size: ProfileGridModuleSize };
  starPosting: boolean;
};

type ProfileInfoCardLayout = {
  avatarInsetClass: string;
  avatarOverlapClass: string;
  avatarSizeClass: string;
  badgeLimit: number;
  bannerHeight: string;
  bioLines: 1 | 2 | 3 | 4;
  bodyPaddingClass: string;
  contentGapClass: string;
  contentSpacingClass: string;
  primaryCompact: boolean;
  statsTight: boolean;
  titleClass: string;
  variant: "balanced" | "expanded" | "wide";
};

const profileInfoBadgeClass =
  "!h-4 !min-h-0 max-w-20 shrink !px-1.5 !py-0 !text-[0.55rem] !font-semibold !leading-none";

function profileInfoCardLayout(
  span: { columns: number; rows: number; size: ProfileGridModuleSize },
  mobileProjected: boolean,
): ProfileInfoCardLayout {
  const mobileWide = mobileProjected && span.columns >= 6;

  if (mobileWide) {
    return {
      avatarInsetClass: "left-4",
      avatarOverlapClass: "-top-8",
      avatarSizeClass: "size-16",
      badgeLimit: 2,
      bannerHeight: "27%",
      bioLines: 2,
      bodyPaddingClass: "p-4",
      contentGapClass: "space-y-2",
      contentSpacingClass: "pt-9",
      primaryCompact: true,
      statsTight: true,
      titleClass: "text-base",
      variant: span.size === "8x4" || span.rows >= 4 ? "expanded" : "wide",
    };
  }

  if (span.size === "4x3" || span.columns === 4) {
    return {
      avatarInsetClass: "left-3",
      avatarOverlapClass: "-top-7",
      avatarSizeClass: "size-14",
      badgeLimit: 0,
      bannerHeight: "30%",
      bioLines: 1,
      bodyPaddingClass: "p-3",
      contentGapClass: "space-y-1.5",
      contentSpacingClass: "pt-8",
      primaryCompact: true,
      statsTight: true,
      titleClass: "text-base",
      variant: "balanced",
    };
  }

  if (span.size === "6x3") {
    return {
      avatarInsetClass: "left-3",
      avatarOverlapClass: "-top-8",
      avatarSizeClass: "size-16",
      badgeLimit: 1,
      bannerHeight: "28%",
      bioLines: 1,
      bodyPaddingClass: "p-3",
      contentGapClass: "space-y-1.5",
      contentSpacingClass: "pt-9",
      primaryCompact: false,
      statsTight: true,
      titleClass: "text-base",
      variant: "wide",
    };
  }

  if (span.size === "8x4" || span.rows >= 4) {
    return {
      avatarInsetClass: "left-4",
      avatarOverlapClass: "-top-10",
      avatarSizeClass: "size-20",
      badgeLimit: 3,
      bannerHeight: "34%",
      bioLines: 3,
      bodyPaddingClass: "p-4",
      contentGapClass: "space-y-2.5",
      contentSpacingClass: "pt-12",
      primaryCompact: false,
      statsTight: false,
      titleClass: "text-xl",
      variant: "expanded",
    };
  }

  return {
    avatarInsetClass: "left-4",
    avatarOverlapClass: "-top-9",
    avatarSizeClass: "size-[4.5rem]",
    badgeLimit: 2,
    bannerHeight: "31%",
    bioLines: 2,
    bodyPaddingClass: "p-4",
    contentGapClass: "space-y-2",
    contentSpacingClass: "pt-10",
    primaryCompact: false,
    statsTight: false,
    titleClass: "text-base",
    variant: "wide",
  };
}

function ProfileInfoSizedCard({
  activeFollowError,
  activeProfileControlError,
  activeProfileControlMessage,
  editing,
  featuredBadges,
  followPosting,
  isOwnProfile,
  messageToHandle,
  onBlockToggle,
  onFollowToggle,
  onMuteToggle,
  onOpenPanel,
  onShareProfile,
  onStarToggle,
  profile,
  profileControlBusy,
  mobileProjected,
  showChatHint,
  span,
  starPosting,
}: ProfileInfoSizedCardProps) {
  const compact = span.columns <= 3;
  const layout = profileInfoCardLayout(span, mobileProjected);
  const bannerUrl = safeProfileImageUrl(profile.bannerUrl);
  const showBanner = Boolean(bannerUrl) && !compact;
  const shellClass = cn(
    "relative flex size-full min-h-0 min-w-0 flex-col overflow-hidden rounded-panel border",
    editing
      ? "border-line bg-surface/68 shadow-soft backdrop-blur-veil"
      : "border-line bg-surface/52 shadow-soft backdrop-blur-veil",
  );

  if (compact) {
    return (
      <article
        className={cn(shellClass, "p-3")}
        data-profile-info-card="true"
        data-profile-info-variant="compact"
        data-testid="profile-header"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar
            user={profile.user}
            size="md"
            className={span.rows >= 3 ? "size-12" : ""}
          />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <h1 className="truncate text-sm font-semibold text-text">
                {profile.user.displayName}
              </h1>
              {!isOwnProfile && profile.isMoot ? (
                <Badge className={profileInfoBadgeClass}>Moot</Badge>
              ) : null}
            </div>
            <p className="truncate text-xs text-muted">@{profile.user.handle}</p>
          </div>
        </div>
        {span.rows >= 3 && profile.bio ? (
          <ProfileInfoBio bio={profile.bio} entities={profile.bioEntities} compact />
        ) : null}
        <div className="mt-auto flex min-w-0 items-end justify-between gap-2 pt-2">
          <div className="min-w-0 flex-1">
            <ProfileInfoStats
              compact
              onOpenPanel={onOpenPanel}
              profile={profile}
            />
          </div>
          <ProfileInfoActions
            compact
            followPosting={followPosting}
            isOwnProfile={isOwnProfile}
            messageToHandle={messageToHandle}
            onBlockToggle={onBlockToggle}
            onFollowToggle={onFollowToggle}
            onMuteToggle={onMuteToggle}
            onShareProfile={onShareProfile}
            onStarToggle={onStarToggle}
            profile={profile}
            profileControlBusy={profileControlBusy}
            showMenu
            starPosting={starPosting}
          />
        </div>
        <ProfileInfoStatusLine
          followError={activeFollowError}
          profile={profile}
          profileControlError={activeProfileControlError}
          profileControlMessage={activeProfileControlMessage}
          showChatHint={showChatHint}
        />
      </article>
    );
  }

  return (
    <article
      className={shellClass}
      data-profile-info-card="true"
      data-profile-info-mobile-projection={mobileProjected ? "true" : undefined}
      data-profile-info-variant={layout.variant}
      data-testid="profile-header"
    >
      {showBanner ? (
        <div
          className="relative z-10 isolate shrink-0 overflow-visible bg-canvas/80"
          data-profile-banner-treatment="cover"
          data-testid="profile-header-banner"
          style={{ blockSize: layout.bannerHeight }}
        >
          <img
            alt=""
            aria-hidden="true"
            className="absolute inset-0 size-full object-cover object-center"
            src={bannerUrl}
            data-testid="profile-header-banner-image"
          />
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-b from-canvas/14 to-canvas/0"
          />
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="h-1 shrink-0 bg-gradient-to-r from-accent/45 via-cool/30 to-leaf/30"
        />
      )}
      <div
        className={cn(
          "relative z-20 flex min-h-0 min-w-0 flex-1 flex-col overflow-visible bg-gradient-to-b from-surface/0 to-surface/78",
          layout.bodyPaddingClass,
        )}
      >
        {showBanner ? (
          <img
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -top-28 z-0 h-72 w-full object-cover object-center opacity-18 blur-2xl saturate-110"
            src={bannerUrl}
            style={{
              maskImage:
                "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.14) 18%, rgba(0,0,0,0.24) 32%, rgba(0,0,0,0.10) 58%, transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.14) 18%, rgba(0,0,0,0.24) 32%, rgba(0,0,0,0.10) 58%, transparent 100%)",
            }}
            data-testid="profile-header-banner-card-bleed"
          />
        ) : null}
        <div
          className={cn(
            "absolute z-30 rounded-full",
            layout.avatarInsetClass,
            showBanner ? layout.avatarOverlapClass : layout.variant === "expanded" ? "top-4" : "top-3",
          )}
          data-testid="profile-info-avatar-frame"
        >
          <Avatar
            user={profile.user}
            size="lg"
            className={cn("border-[3px] border-surface", layout.avatarSizeClass)}
          />
        </div>
        <div
          className={cn(
            "relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
            showBanner
              ? layout.contentSpacingClass
              : layout.variant === "expanded"
                ? "pt-20"
                : "pt-16",
          )}
          data-testid="profile-info-content-cluster"
        >
          <div className={cn("min-h-0 min-w-0 overflow-hidden", layout.contentGapClass)}>
            <div className="min-w-0 shrink-0" data-testid="profile-info-identity-row">
              <div className="flex max-h-7 min-w-0 flex-wrap items-center gap-1.5 overflow-hidden">
                <h1
                  className={cn(
                    "min-w-0 max-w-full truncate font-semibold leading-tight text-text",
                    layout.titleClass,
                  )}
                >
                  {profile.user.displayName}
                </h1>
                {!isOwnProfile && profile.isMoot ? (
                  <Badge className={profileInfoBadgeClass}>Moot</Badge>
                ) : null}
                {!isOwnProfile && profile.mutedByMe ? (
                  <Badge className={profileInfoBadgeClass} tone="cool">
                    Muted
                  </Badge>
                ) : null}
                <ProfileInfoInlineBadges
                  featuredBadges={featuredBadges}
                  maxBadges={layout.badgeLimit}
                />
              </div>
              <p className="truncate text-xs text-muted">@{profile.user.handle}</p>
            </div>
            {profile.bio ? (
              <ProfileInfoBio
                bio={profile.bio}
                entities={profile.bioEntities}
                lines={layout.bioLines}
              />
            ) : null}
          </div>
          <div className="mt-auto min-w-0 shrink-0 pt-1">
            <ProfileInfoStats
              tight={layout.statsTight}
              onOpenPanel={onOpenPanel}
              profile={profile}
            />
            <ProfileInfoStatusLine
              followError={activeFollowError}
              profile={profile}
              profileControlError={activeProfileControlError}
              profileControlMessage={activeProfileControlMessage}
              showChatHint={showChatHint}
            />
          </div>
        </div>
        <div
          className={cn(
            "absolute right-3 top-3 z-40",
            layout.bodyPaddingClass === "p-4" ? "right-4 top-4" : undefined,
          )}
        >
          <ProfileInfoActions
            followPosting={followPosting}
            isOwnProfile={isOwnProfile}
            messageToHandle={messageToHandle}
            onBlockToggle={onBlockToggle}
            onFollowToggle={onFollowToggle}
            onMuteToggle={onMuteToggle}
            onShareProfile={onShareProfile}
            onStarToggle={onStarToggle}
            primaryCompact={layout.primaryCompact}
            profile={profile}
            profileControlBusy={profileControlBusy}
            showMenu
            starPosting={starPosting}
          />
        </div>
      </div>
    </article>
  );
}

function ProfileInfoActions({
  compact = false,
  followPosting,
  isOwnProfile,
  messageToHandle,
  onBlockToggle,
  onFollowToggle,
  onMuteToggle,
  onShareProfile,
  onStarToggle,
  primaryCompact = false,
  profile,
  profileControlBusy,
  showMenu = false,
  starPosting,
}: {
  compact?: boolean | undefined;
  followPosting: boolean;
  isOwnProfile: boolean;
  messageToHandle?: string | undefined;
  onBlockToggle?: (() => Promise<void> | void) | undefined;
  onFollowToggle: () => void;
  onMuteToggle?: (() => Promise<void> | void) | undefined;
  onShareProfile: () => void;
  onStarToggle: () => void;
  primaryCompact?: boolean | undefined;
  profile: Profile;
  profileControlBusy?: "block" | "mute" | undefined;
  showMenu?: boolean | undefined;
  starPosting: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | undefined>();
  const overflowButtonRef = useRef<HTMLDivElement | null>(null);

  const disabled = profile.blockedByMe === true;
  const iconOnly = compact || primaryCompact;
  const actionIconSize = iconOnly ? 14 : 15;
  const iconButtonClass = iconOnly
    ? "!size-8 !min-h-0 !p-0"
    : "!size-9 !min-h-9 !p-0";
  const textButtonClass = iconOnly
    ? "!size-8 !min-h-0 !p-0"
    : "h-9 min-h-9 px-3 !text-xs";
  const showOverflowMenu = showMenu && (Boolean(onShareProfile) || !isOwnProfile);
  const followLabel = profile.isFollowRequestPending
    ? "Requested"
    : profile.isFollowing
      ? "Following"
      : "Follow";
  const menuItemClass =
    "flex w-full items-center justify-start gap-2 rounded-card px-2.5 py-2 text-left text-xs font-semibold text-text transition duration-fluid ease-fluid hover:bg-surface-strong focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50";
  const updateMenuPosition = useCallback(() => {
    const button = overflowButtonRef.current;

    if (!button) {
      return;
    }

    const rect = button.getBoundingClientRect();
    setMenuStyle({
      right: Math.max(8, window.innerWidth - rect.right),
      top: rect.bottom + 6,
    });
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    updateMenuPosition();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen, updateMenuPosition]);

  const actionsMenu =
    menuOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            role="menu"
            data-testid="profile-info-actions-menu"
            className="fixed z-[96] w-44 overflow-hidden rounded-card border border-line bg-surface p-1.5 text-sm shadow-lift"
            style={menuStyle}
          >
            <button
              type="button"
              role="menuitem"
              className={menuItemClass}
              onClick={() => {
                setMenuOpen(false);
                onShareProfile();
              }}
            >
              <Share2 aria-hidden="true" className="shrink-0" size={14} />
              <span>Share profile</span>
            </button>
            {onMuteToggle ? (
              <button
                type="button"
                role="menuitem"
                className={menuItemClass}
                disabled={profileControlBusy !== undefined}
                onClick={() => {
                  setMenuOpen(false);
                  void onMuteToggle();
                }}
              >
                <VolumeX aria-hidden="true" className="shrink-0" size={14} />
                <span>{profile.mutedByMe ? "Unmute" : "Mute"}</span>
              </button>
            ) : null}
            {onBlockToggle ? (
              <button
                type="button"
                role="menuitem"
                className={menuItemClass}
                disabled={profileControlBusy !== undefined}
                onClick={() => {
                  setMenuOpen(false);
                  void onBlockToggle();
                }}
              >
                <Shield aria-hidden="true" className="shrink-0" size={14} />
                <span>{profile.blockedByMe ? "Unblock" : "Block"}</span>
              </button>
            ) : null}
            {!isOwnProfile ? (
              <ReportForm
                className="w-full"
                targetType="profile"
                targetId={profile.user.id}
                reportedUserId={profile.user.id}
                title="Report profile"
                explainer={`This reports @${profile.user.handle}'s profile to moderators.`}
                triggerLabel="Report profile"
                triggerClassName={cn(
                  menuItemClass,
                  "min-h-0 border-0 bg-transparent shadow-none",
                )}
                triggerIconSize={14}
              />
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      className="relative flex max-w-full shrink-0 items-center justify-end gap-1.5"
      data-testid="profile-info-action-rail"
    >
      {isOwnProfile ? null : (
        <>
      {messageToHandle && !disabled ? (
        <Link
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-control border border-line bg-surface text-text shadow-soft transition duration-fluid ease-fluid hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus",
            iconOnly ? "size-8 p-0" : "h-9 min-h-9 px-3 text-xs font-semibold",
          )}
          data-testid="profile-message-button"
          to={`/chat?with=${encodeURIComponent(messageToHandle)}`}
          aria-label={`Message @${profile.user.handle}`}
          title={`Message @${profile.user.handle}`}
        >
          <MessageCircle aria-hidden="true" size={actionIconSize} />
          {iconOnly ? null : "Message"}
        </Link>
      ) : null}
      {!disabled ? (
        <Button
          type="button"
          variant={profile.isStarred ? "primary" : "secondary"}
          disabled={starPosting}
          className={textButtonClass}
          data-testid="profile-star-button"
          size={iconOnly ? "icon" : "sm"}
          icon={
            <Star
              aria-hidden="true"
              size={actionIconSize}
              className={profile.isStarred ? "fill-current" : undefined}
            />
          }
          aria-label={profile.isStarred ? "Unstar profile" : "Star profile"}
          title={profile.isStarred ? "Unstar profile" : "Star profile"}
          onClick={onStarToggle}
        >
          {iconOnly ? null : starPosting ? "Saving" : profile.isStarred ? "Starred" : "Star"}
        </Button>
      ) : null}
      {!disabled ? (
        <Button
          type="button"
          variant={profile.isFollowing ? "secondary" : "primary"}
          disabled={followPosting}
          className={textButtonClass}
          data-testid="profile-follow-button"
          size={iconOnly ? "icon" : "sm"}
          icon={<UserCheck aria-hidden="true" size={actionIconSize} />}
          aria-label={followLabel}
          title={followLabel}
          onClick={onFollowToggle}
        >
          {iconOnly ? null : followPosting ? "Saving" : followLabel}
        </Button>
      ) : null}
        </>
      )}
      {showOverflowMenu ? (
        <div className="relative" ref={overflowButtonRef}>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className={iconButtonClass}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Profile actions for @${profile.user.handle}`}
            title={`Profile actions for @${profile.user.handle}`}
            data-testid="profile-info-overflow-button"
            icon={<MoreHorizontal aria-hidden="true" size={16} />}
            onClick={() => {
              updateMenuPosition();
              setMenuOpen((open) => !open);
            }}
          />
          {actionsMenu}
        </div>
      ) : null}
    </div>
  );
}

function ProfileInfoStats({
  compact = false,
  onOpenPanel,
  profile,
  tight = false,
}: {
  compact?: boolean | undefined;
  onOpenPanel: (panel: "followers" | "following" | "badges") => void;
  profile: Profile;
  tight?: boolean | undefined;
}) {
  const stats: Array<{
    label: "Stars" | "Followers" | "Following" | "Likes";
    panel?: "followers" | "following" | undefined;
    value: number;
  }> = [
    { label: "Stars", value: profile.stats.stars },
    { label: "Followers", panel: "followers", value: profile.stats.followers },
    { label: "Following", panel: "following", value: profile.stats.following },
    { label: "Likes", value: profile.stats.echoes },
  ];

  return (
    <div
      className={cn(
        "min-w-0 shrink-0 overflow-hidden",
        compact
          ? "grid grid-cols-2 items-end gap-x-1 gap-y-1"
          : "flex flex-wrap items-center gap-x-3 gap-y-1",
      )}
      data-profile-info-stats-variant={compact ? "compact" : "row"}
      data-testid="profile-social-context"
    >
      {stats.map((stat) => {
        const content = (
          <>
            <span
              className={cn(
                "font-semibold leading-none text-text",
                compact
                  ? "block truncate text-[0.72rem]"
                  : tight
                    ? "text-sm"
                    : "text-[0.95rem]",
              )}
              data-profile-info-stat-value={stat.label}
            >
              {stat.value.toLocaleString()}
            </span>
            <span
              className={cn(
                "font-medium leading-none text-muted",
                compact
                  ? "block truncate text-[0.58rem]"
                  : tight
                    ? "text-xs"
                    : "text-sm",
              )}
              data-profile-info-stat-label={stat.label}
            >
              {stat.label}
            </span>
          </>
        );
        const className = compact
          ? "block min-w-0 rounded-control py-0.5 text-left leading-none transition duration-fluid ease-fluid"
          : "inline-flex min-w-0 items-baseline gap-1.5 whitespace-nowrap rounded-control py-0.5 leading-none transition duration-fluid ease-fluid";

        if (stat.panel) {
          const panel = stat.panel;

          return (
            <button
              key={stat.label}
              type="button"
              className={cn(
                className,
                "hover:text-text focus-visible:outline-2 focus-visible:outline-focus",
              )}
              data-profile-info-stat={stat.label}
              onClick={() => onOpenPanel(panel)}
            >
              {content}
            </button>
          );
        }

        return (
          <span
            key={stat.label}
            className={className}
            data-profile-info-stat={stat.label}
          >
            {content}
          </span>
        );
      })}
    </div>
  );
}

function ProfileInfoInlineBadges({
  featuredBadges,
  maxBadges,
}: {
  featuredBadges: UserBadge[];
  maxBadges: number;
}) {
  const visibleBadges = maxBadges > 0 ? featuredBadges.slice(0, maxBadges) : [];

  if (visibleBadges.length === 0) {
    return null;
  }

  return (
    <div
      className="flex min-w-0 max-w-full shrink items-center gap-1 overflow-hidden"
      data-testid="profile-info-inline-badges"
    >
      {visibleBadges.map((userBadge) => (
        <Badge
          key={userBadge.id}
          className={profileInfoBadgeClass}
          data-profile-info-badge={userBadge.badge.badgeKey}
          title={userBadge.badge.description ?? userBadge.badge.name}
          tone={badgeTone(userBadge.badge.rarity)}
        >
          <span className="truncate">{userBadge.badge.name}</span>
        </Badge>
      ))}
    </div>
  );
}

function ProfileInfoBio({
  bio,
  compact = false,
  entities,
  lines,
}: {
  bio: string;
  compact?: boolean | undefined;
  entities?: Profile["bioEntities"] | undefined;
  lines?: 1 | 2 | 3 | 4 | undefined;
}) {
  const lineClampClass = compact
    ? "line-clamp-2"
    : lines === 1
      ? "line-clamp-1"
      : lines === 3
        ? "line-clamp-3"
        : lines === 4
          ? "line-clamp-4"
          : "line-clamp-2";

  return (
    <p
      className={cn(
        "min-h-0 max-w-full shrink-0 overflow-hidden break-words text-text",
        compact
          ? "mt-2 line-clamp-2 text-xs leading-5"
          : cn(lineClampClass, "whitespace-pre-wrap text-sm leading-5"),
      )}
      data-profile-bio-clamped="true"
      data-testid="profile-bio"
      title={bio}
    >
      <RichText text={bio} entities={entities} showPreviews={false} />
    </p>
  );
}

function ProfileInfoStatusLine({
  followError,
  profile,
  profileControlError,
  profileControlMessage,
  showChatHint,
}: {
  followError?: string | undefined;
  profile: Profile;
  profileControlError?: string | undefined;
  profileControlMessage?: string | undefined;
  showChatHint: boolean;
}) {
  const message =
    followError ??
    profileControlError ??
    profileControlMessage ??
    (showChatHint
      ? "Follow each other to chat"
      : profile.blockedByMe
        ? `@${profile.user.handle} is blocked.`
        : undefined);

  if (!message) {
    return null;
  }

  return (
    <p
      className={cn(
        "mt-2 line-clamp-1 text-xs font-medium",
        followError || profileControlError ? "text-rose-ink" : "text-muted",
      )}
      role={followError || profileControlError ? "alert" : "status"}
    >
      {message}
    </p>
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
      className="profile-grid-scaled-content grid h-full min-h-0 place-items-center rounded-panel border border-dashed border-line-strong bg-surface/48 p-4 text-center shadow-soft backdrop-blur-veil"
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
        "profile-grid-scaled-content h-full min-w-0 overflow-hidden rounded-card",
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
        "profile-grid-scaled-content h-full min-w-0 overflow-hidden rounded-card",
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
      <div className="mt-2 line-clamp-3 break-words whitespace-pre-wrap text-sm leading-6 text-text">
        <RichText
          text={post.body}
          entities={post.bodyEntities}
          markdown={post.bodyFormat === "markdown"}
          showPreviews={false}
        />
      </div>
      {post.mediaUrl && post.mediaUrl !== "/ambient-veil.webp" ? (
        <div
          className="mt-3 overflow-hidden rounded-card border border-line bg-canvas/70"
          data-testid="profile-featured-post-media"
        >
          {postMediaType(post) === "video" ? (
            <video
              className="block max-h-44 w-full bg-black object-contain"
              controls
              playsInline
              poster={post.mediaPosterUrl ?? undefined}
              preload="metadata"
              data-testid="profile-featured-post-media-video"
            >
              <source src={post.mediaUrl} type={post.mediaMime ?? "video/mp4"} />
            </video>
          ) : (
            <img
              alt=""
              className="block max-h-44 w-full object-contain"
              decoding="async"
              loading="lazy"
              src={post.mediaUrl}
              data-testid="profile-featured-post-media-image"
            />
          )}
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
      style={roomThemeSwatchCssProperties(room)}
      to={`/rooms/${room.slug}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-card border border-line bg-canvas/65"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklab, var(--room-accent) 36%, transparent), var(--room-surface))",
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
  const activitySpan = profileGridModuleSizeSpan(size);
  const activityRows = activitySpan.rows;
  const slim = activitySpan.columns >= 5 && activityRows <= 3;
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
        "profile-grid-scaled-content flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface/58 shadow-soft backdrop-blur-veil",
        slim ? "gap-2 p-2" : "gap-3 p-3",
      )}
      data-profile-activity-max-rows={activityRows}
      data-profile-activity-surface={editing ? "editing" : "public"}
      data-testid="profile-module-activity"
      style={activityStyle}
    >
      <div
        className={cn(
          "flex gap-2",
          slim
            ? "items-center justify-between"
            : "flex-col sm:flex-row sm:items-center sm:justify-between",
        )}
      >
        {editing ? (
          <h3 className={cn("font-semibold text-text", slim ? "truncate text-xs" : "text-sm")}>
            {title}
          </h3>
        ) : null}
        <div
          aria-label="Profile sections"
          className={cn(
            "flex gap-1 overflow-x-auto rounded-control bg-canvas/55 p-1 sm:justify-end",
            slim ? "shrink-0" : undefined,
          )}
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

      {slim ? (
        <ProfileActivitySlimPreview
          activeTab={activeTab}
          feed={feed}
          profile={profile}
          replies={replies}
          rooms={rooms}
        />
      ) : (
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
              compact
              emptyCompact
              error={roomsError}
              loading={roomsLoading}
              rooms={rooms}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function ProfileActivitySlimPreview({
  activeTab,
  feed,
  profile,
  replies,
  rooms,
}: {
  activeTab: ProfileTab;
  feed: Post[];
  profile: Profile;
  replies: Post[];
  rooms: Room[];
}) {
  const items =
    activeTab === "feed"
      ? feed.map((post) => post.body || "Post").slice(0, 3)
      : activeTab === "replies"
        ? replies.map((post) => post.body || "Reply").slice(0, 3)
        : rooms.map((room) => room.name || `/${room.slug}`).slice(0, 3);

  return (
    <div
      className="flex min-h-0 flex-1 items-center gap-2 overflow-hidden"
      data-profile-activity-scroll="slim"
      data-testid="profile-activity"
    >
      {items.length > 0 ? (
        items.map((item, index) => (
          <span
            key={`${activeTab}:${index}:${item}`}
            className="inline-flex h-9 min-w-0 max-w-[13rem] shrink-0 items-center rounded-full border border-line bg-canvas/45 px-3 text-xs font-semibold text-muted"
          >
            <span className="truncate">{item}</span>
          </span>
        ))
      ) : (
        <span className="inline-flex h-9 min-w-0 items-center rounded-full border border-dashed border-line bg-canvas/32 px-3 text-xs font-semibold text-muted">
          @{profile.user.handle} has no {activeTab === "rooms" ? "rooms" : activeTab} yet
        </span>
      )}
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
  compact?: boolean;
  emptyCompact?: boolean;
  error: unknown;
  loading: boolean;
  rooms: Awaited<ReturnType<typeof getProfileRooms>>;
};

function ProfileRoomList({
  compact = false,
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
    <div
      className={cn(
        "grid",
        compact ? "gap-2 sm:grid-cols-2" : "gap-4 md:grid-cols-2",
      )}
      data-profile-activity-rooms-compact={compact ? "true" : undefined}
    >
      {rooms.map((room, index) => (
        compact ? (
          <ProfileCompactRoomCard key={room.slug} room={room} />
        ) : (
          <RoomCard key={room.slug} room={room} index={index} />
        )
      ))}
    </div>
  );
}

function ProfileCompactRoomCard({ room }: { room: Room }) {
  return (
    <Link
      to={`/rooms/${room.slug}`}
      className="group flex min-h-12 min-w-0 items-center gap-2 rounded-card border border-line bg-canvas/30 px-2 py-2 transition duration-fluid ease-fluid hover:border-line-strong hover:bg-surface/64 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      data-testid="profile-activity-room-compact-card"
      style={roomThemeSwatchCssProperties(room)}
      title={`Open ${room.name}`}
    >
      <span
        className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-card border border-line bg-canvas/58 text-text"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--room-accent) 34%, transparent), var(--room-surface))",
        }}
      >
        {room.iconUrl ? (
          <img alt="" className="size-full object-cover" src={room.iconUrl} />
        ) : (
          <Radio aria-hidden="true" size={16} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-sm font-semibold text-text">
            {room.name}
          </span>
          {room.joinedByMe ? (
            <span className="shrink-0 rounded-full bg-leaf/15 px-1.5 py-0.5 text-[0.62rem] font-semibold text-leaf-ink">
              Joined
            </span>
          ) : room.live ? (
            <span className="shrink-0 rounded-full bg-leaf/15 px-1.5 py-0.5 text-[0.62rem] font-semibold text-leaf-ink">
              Active
            </span>
          ) : null}
        </span>
        <span className="block truncate text-xs text-muted">/{room.slug}</span>
      </span>
      <ArrowRight
        aria-hidden="true"
        size={15}
        className="shrink-0 text-muted transition duration-fluid ease-fluid group-hover:translate-x-0.5 group-hover:text-text"
      />
    </Link>
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
