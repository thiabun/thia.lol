import {
  ArrowRight,
  Award,
  Bug,
  CalendarDays,
  Heart,
  ImagePlus,
  MessageCircle,
  MoreHorizontal,
  Music2,
  Radio,
  Repeat2,
  Reply,
  Settings2,
  Shield,
  Share2,
  Sparkles,
  Star,
  Trash2,
  VolumeX,
  X,
  UserCheck,
  Users,
  Video,
} from "lucide-react";
import { motion } from "motion/react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
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
import { MentionTextarea } from "../components/social/MentionTextarea";
import { PostCard } from "../components/social/PostCard";
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
import { SegmentedControl } from "../components/ui/SegmentedControl";
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
  profileModuleAllowedSizes,
  profileModuleCatalog,
  profileGridModuleSizeSpan,
  profileGridModuleSpanSize,
  type ProfileModuleCategory,
  type ProfileGridModuleSize,
} from "../lib/profileModuleRegistry";
import { safeProfileImageUrl } from "../lib/profileMedia";
import type {
  BadgeDefinition,
  Post,
  Profile,
  ProfileBackgroundBlur,
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

/*
 * ProfileDirectCanvasEditor is lazy-loaded from this route; keep its tested DOM
 * contract discoverable here: profile-canvas-drag-preview,
 * profile-canvas-selected-actions, data-profile-canvas-preview-role,
 * data-profile-editor-render-mode="light",
 * data-profile-editor-input-mode={editorGrid.mobile ? "touch" : "pointer"},
 * requestAnimationFrame, music: "MP3", music: "MP3 music upload".
 */
const ProfileDirectCanvasEditor = lazy(() =>
  import("./ProfileCanvasEditor").then((module) => ({
    default: module.ProfileDirectCanvasEditor,
  })),
);

const PROFILE_CANVAS_COLUMNS = PROFILE_CANVAS_DESKTOP_COLUMNS;
const PROFILE_CANVAS_ROWS = PROFILE_CANVAS_DESKTOP_ROWS;
const PROFILE_CONTENT_AUTOSAVE_DELAY_MS = 650;
const PROFILE_MODULE_AUDIO_MAX_BYTES = 20971520;
const PROFILE_MODULE_VIDEO_MAX_BYTES = 100 * 1024 * 1024;

type ProfileTab = "feed" | "replies" | "rooms";
type ProfilePanel = "followers" | "following" | "badges";
type ProfileContentAutosaveState = "idle" | "pending" | "saving" | "saved" | "error";
export type ProfileCanvasDraftAutosaveState =
  | "idle"
  | "pending"
  | "saving"
  | "saved"
  | "error";
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
      window.history.replaceState(
        window.history.state,
        "",
        `${location.pathname}${nextSearch ? `?${nextSearch}` : ""}${location.hash}`,
      );
    });

    return () => {
      active = false;
    };
  }, [
    canvasEditing,
    isOwnProfile,
    location.hash,
    location.pathname,
    location.search,
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
      void markProfileEditorTourStep("complete_step");
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
            <Suspense fallback={<ProfileCanvasEditorLoadingNotice />}>
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
            </Suspense>
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

function ProfileCanvasEditorLoadingNotice() {
  return (
    <div
      className="rounded-panel border border-line bg-surface/78 px-3 py-2 text-sm text-muted"
      role="status"
      data-testid="profile-canvas-editor-loading"
    >
      Opening profile editor.
    </div>
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

export function validateProfileModuleAudioFile(file: File): string | undefined {
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

export function validateProfileModuleVideoFile(file: File): string | undefined {
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

export function readMediaFileDuration(file: File): Promise<number | undefined> {
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

export function sanitizeUploadedMediaTitle(fileName: string, fallback: string): string {
  const title = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return title ? title.slice(0, 60) : fallback;
}

export function formatUploadSize(size: number): string {
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

export function profileModuleLinkFromConnection(
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

export function ProfileCanvasBackgroundControls({
  backgroundBlur,
  compact = false,
  onBackgroundBlurChange,
  onClear,
  onImageUpload,
  onVideoUpload,
  profile,
  uploading,
}: {
  backgroundBlur: ProfileBackgroundBlur;
  compact?: boolean | undefined;
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
        className={cn(
          "flex w-full items-center rounded-control border border-line bg-canvas/50 text-left transition duration-fluid ease-fluid hover:border-line-strong hover:bg-canvas/70 focus-visible:outline-2 focus-visible:outline-focus",
          compact ? "min-h-9 gap-2 px-2" : "min-h-11 gap-3 px-3",
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-profile-edit-control="true"
        data-testid="profile-canvas-background-trigger"
        onClick={() => setOpen((current) => !current)}
      >
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-card border border-line bg-surface/70 text-text",
            compact ? "size-7" : "size-8",
          )}
        >
          <ImagePlus aria-hidden="true" size={compact ? 15 : 17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate font-semibold text-text", compact ? "text-xs" : "text-sm")}>
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

export function ProfileAppearanceControls({
  compact = false,
  profile,
  onProfileDraftChange,
}: {
  compact?: boolean | undefined;
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
      compact={compact}
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

export function blurLabel(blur: ProfileBackgroundBlur): string {
  return blur === "none" ? "None" : blur[0]!.toUpperCase() + blur.slice(1);
}

export function blurShortLabel(blur: ProfileBackgroundBlur): string {
  if (blur === "medium") {
    return "Med";
  }

  return blurLabel(blur);
}

export function profileCanvasCells(
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

export function profileCanvasRectFromPoints(
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

export function profileCanvasPointInRect(
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

export function profileCanvasRectsOverlap(
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

export function profileCanvasSortDraftModules(modules: ProfileModule[]): ProfileModule[] {
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

export function useProfileCanvasEditorGridProjection(): {
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

export function profileCanvasDesktopPointFromEditorPoint(
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

export function profileCanvasOccupiedEditorCellKeysForLayout(
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

export function profileCanvasDesktopRectFromEditorPoints(
  first: CanvasPoint,
  second: CanvasPoint,
  mobile: boolean,
): ProfileModuleLayout {
  return profileCanvasRectFromPoints(
    profileCanvasDesktopPointFromEditorPoint(first, mobile),
    profileCanvasDesktopPointFromEditorPoint(second, mobile),
  );
}

export function profileCanvasDefaultClientLayout(
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

export function profileCanvasLayoutFromPointer(
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

export function profileCanvasResizeLayoutFromPointer(
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

export function profileCanvasSelectionSize(
  selection: ProfileModuleLayout,
): ProfileGridModuleSize | undefined {
  return profileGridModuleSpanSize(
    Math.min(PROFILE_CANVAS_PROFILE_INFO_COLUMNS, selection.colSpan),
    Math.min(PROFILE_CANVAS_ACTIVITY_MAX_MODULE_ROWS, selection.rowSpan),
  );
}

export function profileCanvasExactSizeForSelection(
  type: ProfileModule["type"],
  selection: ProfileModuleLayout,
): ProfileGridModuleSize | undefined {
  const selectionSize = profileCanvasSelectionSize(selection);

  if (selectionSize && profileModuleAllowedSizes(type).includes(selectionSize)) {
    return selectionSize;
  }

  return undefined;
}

export function profileCanvasFitForSelection(
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

function profileModulePickerLabel(type: ProfileModule["type"]): string {
  return profileModuleCatalog.find((item) => item.type === type)?.label ?? type;
}

export function profileCanvasSelectionExamples(
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

export function profileCanvasDefaultConfigForModule(
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

export function profileCanvasModuleIsIntrinsicallyConfigured(
  type: ProfileModule["type"],
): boolean {
  return (
    type === "profile_info" ||
    type === "activity" ||
    type === "featured_post" ||
    type === "featured_room"
  );
}

export function profileCanvasModuleIsConfiguredForEditor(module: ProfileModule): boolean {
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

export function profileCanvasAutofillConfigForModule(
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

export function profileCanvasConfigWithIntegrationCard(
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

export function profileCanvasTwitchDisplayModeForSize(
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

export function profileCanvasConnectionLinksFromIntegrationAccounts(
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

export function profileCanvasIntegrationAccountUrl(
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

export function profileCanvasIntegrationAccountHandle(
  account: ProfileIntegrationAccount,
): string | undefined {
  const handle = account.providerHandle?.trim() || account.displayName?.trim();

  if (handle) {
    return handle;
  }

  return account.providerAccountId?.trim() || undefined;
}

export function profileCanvasProviderLabel(provider: ProfileIntegrationProvider): string {
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

export function profileCanvasModulesWithIntegrationLinks(
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

export function profileCanvasProviderForModule(
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

export function profileCanvasResolveDraftCollisions(
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

export function profileCanvasClampLayout(
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

export function profileCanvasResizeBlockedByPinned(
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

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const actionsMenu =
    menuOpen
      ? (
          <div
            role="menu"
            data-testid="profile-info-actions-menu"
            className="absolute right-0 top-[calc(100%+0.375rem)] z-[96] w-44 overflow-hidden rounded-card border border-line bg-surface p-1.5 text-sm shadow-lift"
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
          </div>
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
        <div className="relative">
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
        <SegmentedControl
          ariaLabel="Profile sections"
          activeId={activeTab}
          className={cn("sm:justify-end", slim ? "shrink-0" : undefined)}
          items={[
            { id: "feed", label: "Feed", meta: feed.length.toLocaleString() },
            {
              id: "replies",
              label: "Replies",
              meta: profile.stats.replies.toLocaleString(),
            },
            {
              id: "rooms",
              label: "Rooms",
              meta: profile.stats.rooms.toLocaleString(),
            },
          ]}
          onChange={onTabChange}
          testId="profile-activity-tabs"
        />
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
