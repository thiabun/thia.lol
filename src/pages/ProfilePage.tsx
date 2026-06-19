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
  Pin,
  PinOff,
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
  Upload,
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
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router";
import type { AppShellOutletContext } from "../components/layout/AppShell";
import { PageMeta } from "../components/PageMeta";
import { MentionTextarea } from "../components/social/MentionTextarea";
import {
  ProfileConnectionIcon,
  type ProfileConnectionIconPlatform,
} from "../components/social/ProfileConnectionIcon";
import { PostCard } from "../components/social/PostCard";
import { ProfileGrid, ProfileGridModule } from "../components/social/ProfileGrid";
import {
  ProfileModuleCard,
  ProfileModulesSection,
  type ProfileMusicAutoplayRequest,
} from "../components/social/ProfileModules";
import { ReportForm } from "../components/social/ReportForm";
import { RichText } from "../components/social/RichText";
import { RoomCard } from "../components/social/RoomCard";
import { UserIdentityLink } from "../components/social/UserProfileLink";
import { ApiStateNotice } from "../components/ui/ApiStateNotice";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { ImageCropModal } from "../components/ui/ImageCropModal";
import { ModalSheet } from "../components/ui/ModalSheet";
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
  removeProfileFollower,
  resolveProfileIntegrationMetadata,
  startProfileIntegration,
  unblockProfile,
  unfollowProfile,
  unmuteProfile,
  commitProfileCanvasDraft,
  discardProfileCanvasDraft,
  updateProfileCanvas,
  updateProfileCanvasDraft,
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
import { validateImageCropFile } from "../lib/imageCrop";
import { pageEntrance } from "../lib/motionPresets";
import { formatCountWithUnit } from "../lib/pluralize";
import {
  connectionPlatformLabel,
  maxProfileConnections,
  profileConnectionPlatforms,
  validateProfileConnectionDraft,
} from "../lib/profileConnections";
import { defaultProfileLayoutPreset } from "../lib/profileLayoutPresets";
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
  Room,
  UserBadge,
} from "../lib/types";
import { useAsyncData } from "../lib/useAsyncData";
import { useAuth } from "../lib/useAuth";
const PROFILE_CANVAS_COLUMNS = PROFILE_CANVAS_DESKTOP_COLUMNS;
const PROFILE_CANVAS_ROWS = PROFILE_CANVAS_DESKTOP_ROWS;
const PROFILE_CONTENT_AUTOSAVE_DELAY_MS = 650;
const PROFILE_MODULE_AUDIO_MAX_BYTES = 20971520;
const PROFILE_MODULE_VIDEO_MAX_BYTES = 31457280;

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
    bioEntities: saved.bioEntities ?? [],
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
  const profileEditReturnHandledRef = useRef(false);
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
  const [integrationReloadKey, setIntegrationReloadKey] = useState(0);
  const [integrationReturnNotice, setIntegrationReturnNotice] = useState<
    { kind: "success" | "error"; message: string } | undefined
  >();

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

      return isOwnProfile
        ? getMyProfileIntegrations()
        : Promise.resolve({ providers: [], accounts: [] });
    };
  }, [integrationReloadKey, isOwnProfile]);
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
      await saveCanvasDraftImmediately(canvasDraft);
      const saved = await runWithAuth(
        (csrfToken) => commitProfileCanvasDraft(csrfToken),
        { retryOnCsrf: true },
      );

      setModulesOverride({ handle: normalizedHandle, modules: saved.modules });
      setProfileOverride({
        ...profile,
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
          title={module.title ?? "Activity"}
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
      <ProfilePersonalBackdrop profile={backgroundPreviewProfile} />
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
              onModuleAudioUpload={handleModuleAudioUpload}
              onImageUpload={handleProfileImageDraftSelection}
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
          Profile music may start after you continue. Embedded or uploaded music is available on this profile.
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
  provider: "spotify" | "youtube" | "upload";
};

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
  const name = file.name.toLowerCase();

  if (file.size <= 0) {
    return "Video cannot be empty.";
  }

  if (file.size > PROFILE_MODULE_VIDEO_MAX_BYTES) {
    return "Video must be 30 MB or smaller.";
  }

  if (
    file.type !== "video/mp4" &&
    file.type !== "video/webm" &&
    !name.endsWith(".mp4") &&
    !name.endsWith(".webm")
  ) {
    return "Use an MP4 or WebM file.";
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
        <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-control border border-line bg-canvas/55 px-3 text-sm font-semibold text-text transition hover:border-line-strong focus-within:outline-2 focus-within:outline-focus">
          <ImagePlus aria-hidden="true" size={16} />
          Avatar
          <input
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
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
        <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-control border border-line bg-canvas/55 px-3 text-sm font-semibold text-text transition hover:border-line-strong focus-within:outline-2 focus-within:outline-focus">
          <ImagePlus aria-hidden="true" size={16} />
          Banner
          <input
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
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
  const [mobile, setMobile] = useState(false);

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
    row: module.type === "profile_info" ? 1 : index + 1,
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

type ProfileCanvasSelectionFit = {
  enabled: boolean;
  exactSize?: ProfileGridModuleSize | undefined;
  noteSize?: ProfileGridModuleSize | undefined;
  sortSize: ProfileGridModuleSize;
  warning?: "too-large" | "too-small" | undefined;
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
  const colSpan = Math.min(PROFILE_CANVAS_PROFILE_INFO_COLUMNS, Math.max(1, layout.colSpan));
  const rowSpan = Math.min(
    profileCanvasMaxRowsForType(type),
    Math.max(1, layout.rowSpan),
  );

  return {
    column: Math.min(PROFILE_CANVAS_COLUMNS - colSpan + 1, Math.max(1, layout.column)),
    row: Math.min(PROFILE_CANVAS_ROWS - rowSpan + 1, Math.max(1, layout.row)),
    colSpan,
    rowSpan,
  };
}

function profileCanvasMaxRowsForType(type: ProfileModule["type"]): number {
  return type === "activity" || type === "placeholder"
    ? PROFILE_CANVAS_ACTIVITY_MAX_MODULE_ROWS
    : PROFILE_CANVAS_MAX_MODULE_ROWS;
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
  integrationAccounts: ProfileIntegrationAccount[];
  integrationProviders: ProfileIntegrationProviderStatus[];
  modules: ProfileModule[];
  onBackgroundBlurChange: (blur: ProfileBackgroundBlur) => void;
  onCancel: () => void;
  onCanvasGlassChange: (canvasGlass: number) => void;
  onChange: (updater: (draft: ProfileCanvasDraftState) => ProfileCanvasDraftState) => void;
  onClearBackground: () => void;
  onConnectProvider: (provider: ProfileIntegrationProvider) => void;
  onModuleAudioUpload: (file: File) => Promise<UploadedAudio>;
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

function ProfileDirectCanvasEditor({
  autosaveError,
  autosaveState,
  busy,
  draft,
  error,
  integrationAccounts,
  integrationProviders,
  modules,
  onBackgroundBlurChange,
  onCancel,
  onCanvasGlassChange,
  onChange,
  onClearBackground,
  onConnectProvider,
  onModuleAudioUpload,
  onImageUpload,
  onModuleImageUpload,
  onModuleVideoUpload,
  onNewDraftModuleId,
  onProfileDraftChange,
  onRenderModuleContent,
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
  const [dragState, setDragState] = useState<
    | {
        moduleId: number;
        pointerOffsetX: number;
        pointerOffsetY: number;
        startLayout: ProfileModuleLayout;
      }
    | undefined
  >();
  const sortedModules = profileCanvasSortDraftModules(
    modules.filter((module) => module.status !== "deleted"),
  );
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

  useEffect(() => {
    if (!dragState) {
      return undefined;
    }

    const activeDragState = dragState;

    function handlePointerMove(event: globalThis.PointerEvent) {
      const grid = gridRef.current;

      if (!grid) {
        return;
      }

      const nextLayout = profileCanvasLayoutFromPointer(
        grid,
        event.clientX,
        event.clientY,
        activeDragState.startLayout.colSpan,
        activeDragState.startLayout.rowSpan,
        activeDragState.pointerOffsetX,
        activeDragState.pointerOffsetY,
        editorGrid.mobile,
      );

      updateDraftModules((currentModules) =>
        profileCanvasResolveDraftCollisions(
          currentModules.map((module) =>
            module.id === activeDragState.moduleId
              ? { ...module, layout: nextLayout }
              : module,
          ),
          activeDragState.moduleId,
        ),
      );
    }

    function handlePointerUp() {
      setDragState(undefined);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    window.addEventListener("pointercancel", handlePointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [dragState, editorGrid.mobile, modules, updateDraftModules]);

  function handleCellClick(point: CanvasPoint) {
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
      <ProfileGrid
        canvasGlass={draft.canvasGlass}
        gridRef={gridRef}
        className="relative overflow-hidden"
        maxColumns={editorGrid.columns}
        maxRows={editorGrid.rows}
        testId="profile-canvas-direct-grid"
      >
        <div
          className="pointer-events-auto absolute inset-2 z-0 grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${editorGrid.columns}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${editorGrid.rows}, minmax(0, 1fr))`,
          }}
          onMouseLeave={() => {
            if (selectionStart) {
              setSelectionHover(selectionStart);
            }
          }}
        >
          <AnimatePresence initial={false}>
            {selectionPreviewRect ? (
              <motion.div
                layout
                className="pointer-events-none relative z-20 rounded-[1.1rem] border border-focus/80 bg-focus/20 shadow-glow backdrop-blur-veil"
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
              />
            ) : null}
          </AnimatePresence>
          {profileCanvasCells(editorGrid.columns, editorGrid.rows).map((point) => {
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
            const layoutPoint = profileCanvasDesktopPointFromEditorPoint(
              point,
              editorGrid.mobile,
            );
            const coveredByModule = sortedModules.some((draftModule) =>
              profileCanvasPointInRect(
                layoutPoint,
                draftModule.layout ?? profileCanvasDefaultClientLayout(draftModule, 0),
              ),
            );
            const visuallyCovered = coveredByModule || (inPreview && previewHasArea);

            return (
              <button
                key={`${point.column}:${point.row}`}
                type="button"
                className={cn(
                  "relative z-10 min-h-0 rounded-card border border-line/55 bg-surface/20 transition duration-fluid ease-fluid hover:scale-[1.03] hover:border-line-strong hover:bg-surface/42 focus-visible:z-30 focus-visible:outline-2 focus-visible:outline-focus",
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
                  if (selectionStart) {
                    setSelectionHover(point);
                  }
                }}
              />
            );
          })}
        </div>
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
                    module.pinned ||
                    event.button !== 0 ||
                    (target instanceof HTMLElement &&
                      target.closest('[data-profile-edit-control="true"]'))
                  ) {
                    return;
                  }

                  const rect = event.currentTarget.getBoundingClientRect();
                  setDragState({
                    moduleId: module.id,
                    pointerOffsetX: event.clientX - rect.left,
                    pointerOffsetY: event.clientY - rect.top,
                    startLayout: layout,
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
                      configured
                        ? "scale-[0.9] blur-[18px] opacity-45 saturate-50"
                        : undefined,
                    )}
                    data-profile-canvas-module-configured={
                      configured ? "true" : "false"
                    }
                    data-profile-canvas-module-frame={
                      configured ? "inset" : undefined
                    }
                    data-testid={`profile-canvas-module-content-${module.id}`}
                  >
                    {onRenderModuleContent(module, size) ?? (
                      <ProfileModuleCard
                        module={module}
                        badges={[]}
                        editing
                        size={size}
                      />
                    )}
                  </div>
                )}
              </div>
              {placeholder ? (
                <div
                  className={cn(
                    "absolute right-1.5 top-1.5 z-30 flex items-center gap-1",
                    placeholderMicro ? "right-1 top-1 gap-0.5" : undefined,
                  )}
                  data-profile-edit-control="true"
                >
                  <button
                    type="button"
                    className={cn(
                      "grid place-items-center rounded-control border border-line bg-surface/92 text-text shadow-soft backdrop-blur-veil transition hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus",
                      placeholderMicro ? "size-6" : "size-7",
                    )}
                    aria-label={
                      module.pinned ? "Unpin blank module" : "Pin blank module"
                    }
                    title={module.pinned ? "Unpin blank module" : "Pin blank module"}
                    data-testid={`profile-canvas-pin-placeholder-${module.id}`}
                    onClick={() => handleTogglePin(module)}
                  >
                    {module.pinned ? (
                      <PinOff aria-hidden="true" size={placeholderMicro ? 12 : 14} />
                    ) : (
                      <Pin aria-hidden="true" size={placeholderMicro ? 12 : 14} />
                    )}
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "grid place-items-center rounded-control border border-line bg-surface/92 text-rose-ink shadow-soft backdrop-blur-veil transition hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus",
                      placeholderMicro ? "size-6" : "size-7",
                    )}
                    aria-label="Delete blank module"
                    title="Delete blank module"
                    data-testid={`profile-canvas-delete-placeholder-${module.id}`}
                    onClick={() => handleRemoveModule(module)}
                  >
                    <Trash2 aria-hidden="true" size={placeholderMicro ? 12 : 14} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="absolute left-1/2 top-1/2 z-30 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-line bg-surface/92 text-text shadow-lift backdrop-blur-veil transition duration-fluid ease-fluid hover:scale-105 hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus"
                  aria-label={`Edit ${profileModuleFallbackTitle(module.type)}`}
                  title={`Edit ${profileModuleFallbackTitle(module.type)}`}
                  data-profile-edit-control="true"
                  data-testid={`profile-canvas-edit-module-${module.id}`}
                  onClick={() => setSettingsModuleId(module.id)}
                >
                  <MoreHorizontal aria-hidden="true" size={24} />
                </button>
              )}
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
        onModuleImageUpload={onModuleImageUpload}
        onModuleVideoUpload={onModuleVideoUpload}
        onProfileImageUpload={onImageUpload}
        onProfileDraftChange={onProfileDraftChange}
        onUpdateConfig={handleModuleConfig}
        onTogglePin={handleTogglePin}
      />
    </section>
  );
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
  onModuleImageUpload,
  onModuleVideoUpload,
  onProfileImageUpload,
  onProfileDraftChange,
  onRemove,
  onResize,
  onTogglePin,
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
  onModuleImageUpload: (file: File) => Promise<string>;
  onModuleVideoUpload: (file: File) => Promise<UploadedVideo>;
  onProfileImageUpload: (
    file: File,
    purpose: "avatar" | "banner" | "profile_background",
  ) => void;
  onProfileDraftChange: (updater: (profile: Profile) => Profile) => void;
  onRemove: (module: ProfileModule) => void;
  onResize: (module: ProfileModule, size: ProfileGridModuleSize) => void;
  onTogglePin: (module: ProfileModule) => void;
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
  const connectionLinks = module?.config.links ?? [];
  const canAddConnection = connectionLinks.length < maxProfileConnections;
  const moduleMediaItems = module?.config.mediaItems ?? [];
  const moduleMediaSlots = Math.max(0, 6 - moduleMediaItems.length);
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

  function handleModuleImageSelection(files: FileList | null) {
    if (!module || !files || moduleMediaSlots <= 0) {
      return;
    }

    const selectedFiles: File[] = [];

    for (const file of Array.from(files).slice(0, moduleMediaSlots)) {
      const validationError = validateImageCropFile(file);

      if (validationError) {
        setModuleImageError(validationError);
        continue;
      }

      selectedFiles.push(file);
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
      const mediaItems = [
        ...(module.config.mediaItems ?? []),
        { url },
      ].slice(0, 6);

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
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              icon={module.pinned ? <PinOff aria-hidden="true" size={16} /> : <Pin aria-hidden="true" size={16} />}
              onClick={() => onTogglePin(module)}
            >
              {module.pinned ? "Unpin" : "Pin"}
            </Button>
            <div className="flex items-center gap-2">
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
                <div className="relative min-h-28 overflow-hidden bg-surface/55">
                  {safeProfileImageUrl(profile.bannerUrl) ? (
                    <img
                      alt=""
                      className="absolute inset-0 size-full object-cover"
                      src={safeProfileImageUrl(profile.bannerUrl)}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-cool/12 to-leaf/14" />
                  )}
                  <div className="absolute inset-0 bg-canvas/18" />
                  <div className="absolute bottom-2 left-2 flex items-end gap-2">
                    <Avatar
                      user={profile.user}
                      size="lg"
                      className="size-16 border-[3px] border-surface shadow-soft"
                    />
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
                  <label
                    className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-control border border-line bg-surface/62 px-3 text-sm font-semibold text-text transition hover:border-line-strong focus-within:outline-2 focus-within:outline-focus"
                    title="Change profile picture"
                  >
                    <ImagePlus aria-hidden="true" size={16} />
                    {uploading === "avatar" ? "Uploading" : "Picture"}
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      data-testid="profile-info-modal-avatar-input"
                      disabled={Boolean(uploading)}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];

                        if (file) {
                          onProfileImageUpload(file, "avatar");
                        }

                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  <label
                    className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-control border border-line bg-surface/62 px-3 text-sm font-semibold text-text transition hover:border-line-strong focus-within:outline-2 focus-within:outline-focus"
                    title="Change profile banner"
                  >
                    <ImagePlus aria-hidden="true" size={16} />
                    {uploading === "banner" ? "Uploading" : "Banner"}
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      data-testid="profile-info-modal-banner-input"
                      disabled={Boolean(uploading)}
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
          {module.type === "text" ||
          module.type === "about" ||
          module.type === "custom_text" ? (
            <label className="block">
              <span className="text-xs font-semibold uppercase text-muted">
                Text
              </span>
              <MentionTextarea
                className="mt-1 min-h-28 w-full resize-none rounded-control border border-line bg-canvas/45 px-3 py-2 text-sm leading-6 text-text outline-none transition focus:border-line-strong focus:outline-2 focus:outline-focus"
                value={module.config.body ?? ""}
                data-testid="profile-module-settings-body"
                onValueChange={(body) => {
                  updateModuleConfig(
                    configWithContent({ body }, body.trim().length > 0),
                  );
                }}
              />
            </label>
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
                    accept="video/mp4,video/webm"
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
                  Upload an MP4 or WebM file.
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
                      Upload a custom MP3 or use a provider link below.
                    </p>
                  )}
                  {moduleAudioError ? (
                    <p className="text-xs font-semibold text-rose-ink" role="alert">
                      {moduleAudioError}
                    </p>
                  ) : null}
                </div>
              ) : null}
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
                <p className="text-xs font-semibold uppercase text-muted">Photos</p>
                <label
                  className={cn(
                    "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-control border border-line bg-canvas/45 px-3 text-sm font-semibold text-text transition hover:border-line-strong focus-within:outline-2 focus-within:outline-focus",
                    moduleMediaSlots <= 0 || moduleImageUploading
                      ? "pointer-events-none opacity-50"
                      : undefined,
                  )}
                  data-profile-edit-control="true"
                  title="Add photos"
                >
                  <ImagePlus aria-hidden="true" size={16} />
                  {moduleImageUploading ? "Uploading" : "Add"}
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    data-testid="profile-module-settings-image-input"
                    disabled={moduleImageUploading || moduleMediaSlots <= 0}
                    onChange={(event) => {
                      handleModuleImageSelection(event.currentTarget.files);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
              {moduleMediaItems.length > 0 ? (
                <div
                  className="grid grid-cols-3 gap-2"
                  data-testid="profile-module-media-list"
                >
                  {moduleMediaItems.map((item, index) => (
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
      className="profile-personal-backdrop pointer-events-none z-0 min-h-full overflow-hidden"
      data-profile-background-blur={blurTreatment}
      data-profile-background-source={videoUrl ? "video" : imageUrl ? "image" : "fallback"}
      data-profile-background-visibility={visibility.name}
      data-testid="profile-personal-backdrop"
    >
      {videoUrl ? (
        <video
          aria-hidden="true"
          className={cn(
            "absolute inset-0 size-full object-cover object-center saturate-[1.04] motion-reduce:hidden",
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
            "absolute inset-0 size-full object-cover object-center saturate-[1.04]",
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
          profile={profile}
          profileControlBusy={profileControlBusy}
          mobileProjected={mobileProjected}
          showChatHint={showChatHint}
          span={span}
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
  profile: Profile;
  profileControlBusy?: "block" | "mute" | undefined;
  mobileProjected: boolean;
  showChatHint: boolean;
  span: { columns: number; rows: number; size: ProfileGridModuleSize };
};

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
  profile,
  profileControlBusy,
  mobileProjected,
  showChatHint,
  span,
}: ProfileInfoSizedCardProps) {
  const compact = span.columns <= 3;
  const balanced = span.columns === 4;
  const expanded = span.rows >= 4;
  const wide = span.columns >= 6;
  const large = span.columns >= 8;
  const mobileWide = mobileProjected && wide;
  const inlineStats = !compact;
  const bannerUrl = safeProfileImageUrl(profile.bannerUrl);
  const showBanner = Boolean(bannerUrl) && !compact;
  const bannerHeight = mobileWide
    ? "6.25rem"
    : expanded
    ? large
      ? "9.75rem"
      : "8rem"
    : large
      ? "7.75rem"
      : wide
        ? "6.75rem"
        : balanced
          ? "5.5rem"
          : "5rem";
  const avatarSizeClass = mobileWide
    ? "size-16"
    : balanced
    ? "size-14"
    : expanded
      ? "size-20"
      : large
        ? "size-[4.5rem]"
        : "size-16";
  const avatarInsetClass = mobileWide || expanded ? "left-4" : "left-3";
  const avatarOverlapClass = showBanner
    ? mobileWide
      ? "-top-8"
      : expanded || large
      ? "-top-10"
      : balanced
        ? "-top-7"
        : "-top-8"
    : expanded
      ? "top-4"
      : "top-3";
  const identityInsetClass = mobileWide
    ? "pl-[5rem]"
    : balanced
    ? "pl-[4.75rem]"
    : expanded
      ? "pl-[6.25rem]"
      : "pl-[5.25rem]";
  const identityMaxWidthClass = mobileWide
    ? "max-w-[8.75rem]"
    : balanced
    ? "max-w-[8.5rem]"
    : expanded
      ? "max-w-[12rem]"
      : large
        ? "max-w-[11rem]"
        : "max-w-[10rem]";
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
                <Badge className="min-h-5 px-1.5 text-[0.65rem]">Moot</Badge>
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
              inline
              onOpenPanel={onOpenPanel}
              profile={profile}
            />
          </div>
          <ProfileInfoActions
            compact
            followPosting={followPosting}
            isOwnProfile={isOwnProfile}
            messageToHandle={messageToHandle}
            onFollowToggle={onFollowToggle}
            profile={profile}
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
      data-profile-info-variant={expanded ? "expanded" : balanced ? "balanced" : "wide"}
      data-testid="profile-header"
    >
      {showBanner ? (
        <div
          className="relative isolate grid shrink-0 place-items-center overflow-hidden border-b border-line bg-canvas/80"
          data-profile-banner-treatment={large ? "full" : "clear"}
          data-testid="profile-header-banner"
          style={{ blockSize: bannerHeight }}
        >
          <img
            alt=""
            aria-hidden="true"
            className="absolute inset-0 -z-10 size-full scale-105 object-cover opacity-35 blur-sm saturate-75"
            src={bannerUrl}
          />
          <span
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-canvas/25"
          />
          <img
            alt=""
            className="relative z-10 h-full max-h-full max-w-full object-contain object-center"
            src={bannerUrl}
            data-testid="profile-header-banner-image"
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
          "relative flex min-h-0 min-w-0 flex-1 flex-col",
          mobileWide || expanded ? "p-4" : "p-3",
        )}
      >
        <div
          className={cn(
            "absolute z-30 rounded-full",
            avatarInsetClass,
            avatarOverlapClass,
          )}
          data-testid="profile-info-avatar-frame"
        >
          <Avatar
            user={profile.user}
            size="lg"
            className={cn("border-[3px] border-surface", avatarSizeClass)}
          />
        </div>
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-col",
            mobileWide
              ? "pt-9"
              : "mt-auto",
            expanded || mobileWide ? "gap-2" : "gap-1.5",
          )}
          data-testid="profile-info-content-cluster"
        >
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2.5",
                identityInsetClass,
              )}
              data-testid="profile-info-identity-row"
            >
              <div className={cn("min-w-0 shrink-0", identityMaxWidthClass)}>
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <h1
                    className={cn(
                      "min-w-0 truncate font-semibold text-text",
                      expanded ? "text-xl" : "text-base",
                    )}
                  >
                    {profile.user.displayName}
                  </h1>
                  {!isOwnProfile && profile.isMoot ? (
                    <Badge className="min-h-5 px-2 text-[0.68rem]">Moot</Badge>
                  ) : null}
                  {!isOwnProfile && profile.mutedByMe ? (
                    <Badge className="min-h-5 px-2 text-[0.68rem]" tone="cool">
                      Muted
                    </Badge>
                  ) : null}
                </div>
                <p className="truncate text-xs text-muted">@{profile.user.handle}</p>
              </div>
              {inlineStats ? (
                <ProfileInfoStats
                  inline
                  trail
                  featuredBadges={featuredBadges}
                  maxBadges={expanded ? 5 : 3}
                  onOpenPanel={onOpenPanel}
                  profile={profile}
                />
              ) : null}
            </div>
            <ProfileInfoActions
              followPosting={followPosting}
              isOwnProfile={isOwnProfile}
              messageToHandle={messageToHandle}
              onBlockToggle={onBlockToggle}
              onFollowToggle={onFollowToggle}
              onMuteToggle={onMuteToggle}
              profile={profile}
              profileControlBusy={profileControlBusy}
              showControls={span.columns >= 6}
            />
          </div>
          {profile.bio ? (
            <ProfileInfoBio
              bio={profile.bio}
              entities={profile.bioEntities}
              expanded={expanded}
            />
          ) : null}
          <div className="min-w-0 pt-1">
            {!inlineStats ? (
              <ProfileInfoStats
                onOpenPanel={onOpenPanel}
                profile={profile}
              />
            ) : null}
            <ProfileInfoStatusLine
              followError={activeFollowError}
              profile={profile}
              profileControlError={activeProfileControlError}
              profileControlMessage={activeProfileControlMessage}
              showChatHint={showChatHint}
            />
            {!isOwnProfile && span.columns >= 6 ? (
              <div className="mt-2 flex justify-end">
                <ReportForm
                  targetType="profile"
                  targetId={profile.user.id}
                  reportedUserId={profile.user.id}
                  title="Report profile"
                  explainer={`This reports @${profile.user.handle}'s profile to moderators.`}
                  triggerClassName="min-h-8 px-2.5 text-xs"
                />
              </div>
            ) : null}
          </div>
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
  profile,
  profileControlBusy,
  showControls = false,
}: {
  compact?: boolean | undefined;
  followPosting: boolean;
  isOwnProfile: boolean;
  messageToHandle?: string | undefined;
  onBlockToggle?: (() => Promise<void> | void) | undefined;
  onFollowToggle: () => void;
  onMuteToggle?: (() => Promise<void> | void) | undefined;
  profile: Profile;
  profileControlBusy?: "block" | "mute" | undefined;
  showControls?: boolean | undefined;
}) {
  if (isOwnProfile) {
    return null;
  }

  const disabled = profile.blockedByMe === true;

  return (
    <div className={cn("flex shrink-0 flex-wrap justify-end gap-1.5", compact ? "items-center" : undefined)}>
      {messageToHandle && !disabled ? (
        <Link
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-control border border-line bg-surface text-text shadow-soft transition duration-fluid ease-fluid hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus",
            compact ? "size-8 p-0" : "min-h-8 px-2.5 text-xs font-semibold",
          )}
          data-testid="profile-message-button"
          to={`/chat?with=${encodeURIComponent(messageToHandle)}`}
          aria-label={`Message @${profile.user.handle}`}
          title={`Message @${profile.user.handle}`}
        >
          <MessageCircle aria-hidden="true" size={compact ? 14 : 15} />
          {compact ? null : "Message"}
        </Link>
      ) : null}
      {!disabled ? (
        <Button
          type="button"
          variant={profile.isFollowing ? "secondary" : "primary"}
          disabled={followPosting}
          className={compact ? "size-8 p-0" : "min-h-8 px-2.5 text-xs"}
          data-testid="profile-follow-button"
          size={compact ? "icon" : "sm"}
          icon={<UserCheck aria-hidden="true" size={compact ? 14 : 15} />}
          aria-label={profile.isFollowing ? "Following" : "Follow"}
          title={profile.isFollowing ? "Following" : "Follow"}
          onClick={onFollowToggle}
        >
          {compact ? null : followPosting ? "Saving" : profile.isFollowing ? "Following" : "Follow"}
        </Button>
      ) : null}
      {showControls && onMuteToggle ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="min-h-8 px-2.5 text-xs"
          disabled={profileControlBusy !== undefined}
          onClick={() => void onMuteToggle()}
        >
          {profile.mutedByMe ? "Unmute" : "Mute"}
        </Button>
      ) : null}
      {showControls && onBlockToggle ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="min-h-8 px-2.5 text-xs"
          disabled={profileControlBusy !== undefined}
          onClick={() => void onBlockToggle()}
        >
          {profile.blockedByMe ? "Unblock" : "Block"}
        </Button>
      ) : null}
    </div>
  );
}

function ProfileInfoStats({
  compact = false,
  featuredBadges = [],
  inline = false,
  maxBadges = 0,
  onOpenPanel,
  profile,
  trail = false,
}: {
  compact?: boolean | undefined;
  featuredBadges?: UserBadge[] | undefined;
  inline?: boolean | undefined;
  maxBadges?: number | undefined;
  onOpenPanel: (panel: "followers" | "following" | "badges") => void;
  profile: Profile;
  trail?: boolean | undefined;
}) {
  const stats: Array<{
    label: "Followers" | "Following" | "Likes";
    panel?: "followers" | "following" | undefined;
    value: number;
  }> = [
    { label: "Followers", panel: "followers", value: profile.stats.followers },
    { label: "Following", panel: "following", value: profile.stats.following },
    { label: "Likes", value: profile.stats.echoes },
  ];
  const inlineBadges =
    trail && !compact && maxBadges > 0
      ? featuredBadges.slice(0, maxBadges)
      : [];

  if (inline) {
    return (
      <div
        className={cn(
          "min-w-0 overflow-hidden",
          compact
            ? "grid grid-cols-3 items-end gap-1"
            : trail
              ? "flex flex-wrap items-center gap-x-2 gap-y-1"
              : "flex flex-wrap items-center gap-x-4 gap-y-1",
        )}
        data-profile-info-stats-variant="inline"
        data-profile-info-stats-trail={trail ? "true" : undefined}
        data-testid="profile-social-context"
      >
        {stats.map((stat) => {
          const content = (
            <>
              <span
                className={cn(
                  "font-semibold leading-none text-text",
                  compact ? "block truncate text-[0.72rem]" : "text-base",
                )}
                data-profile-info-stat-value={stat.label}
              >
                {stat.value.toLocaleString()}
              </span>
              <span
                className={cn(
                  "font-medium leading-none text-muted",
                  compact ? "block truncate text-[0.58rem]" : "text-sm",
                )}
                data-profile-info-stat-label={stat.label}
              >
                {stat.label}
              </span>
            </>
          );
          const className = compact
            ? "block min-w-0 rounded-control py-0.5 text-left leading-none transition duration-fluid ease-fluid"
            : "inline-flex min-w-0 items-baseline gap-1.5 rounded-control py-0.5 leading-none transition duration-fluid ease-fluid";
          const panel = stat.panel;
          const statNode = panel ? (
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
          ) : (
            <span
              key={stat.label}
              className={className}
              data-profile-info-stat={stat.label}
            >
              {content}
            </span>
          );

          if (trail && !compact) {
            return (
              <span
                key={stat.label}
                className="inline-flex min-w-0 items-baseline gap-2"
              >
                <span
                  aria-hidden="true"
                  className="shrink-0 text-sm font-semibold leading-none text-muted"
                  data-profile-info-stat-separator="true"
                >
                  ·
                </span>
                {statNode}
              </span>
            );
          }

          return statNode;
        })}
        {inlineBadges.map((userBadge) => (
          <ProfileInfoTrailBadge key={userBadge.id} userBadge={userBadge} />
        ))}
      </div>
    );
  }

  return (
    <div
      className="grid min-w-0 grid-cols-3 gap-1.5"
      data-testid="profile-social-context"
    >
      {stats.map((stat) => {
        const content = (
          <>
            <span
              className="block truncate text-sm font-semibold text-text"
              data-profile-info-stat-value={stat.label}
            >
              {stat.value.toLocaleString()}
            </span>
            <span
              className="block truncate text-[0.68rem] font-medium text-muted"
              data-profile-info-stat-label={stat.label}
            >
              {stat.label}
            </span>
          </>
        );
        const className =
          "min-w-0 rounded-control border border-line bg-canvas/42 px-2 py-1.5 text-left transition duration-fluid ease-fluid";

        if (stat.panel) {
          const panel = stat.panel;

          return (
            <button
              key={stat.label}
              type="button"
              className={cn(
                className,
                "hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus",
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

function ProfileInfoTrailBadge({ userBadge }: { userBadge: UserBadge }) {
  return (
    <span
      className="inline-flex min-w-0 items-baseline gap-2"
      data-profile-info-badge-trail="true"
    >
      <span
        aria-hidden="true"
        className="shrink-0 text-sm font-semibold leading-none text-muted"
        data-profile-info-badge-separator="true"
        data-profile-info-stat-separator="true"
      >
        ·
      </span>
      <Badge
        className="min-h-5 max-w-28 px-2 text-[0.68rem]"
        data-profile-info-badge={userBadge.badge.badgeKey}
        title={userBadge.badge.description ?? userBadge.badge.name}
        tone={badgeTone(userBadge.badge.rarity)}
      >
        <span className="truncate">{userBadge.badge.name}</span>
      </Badge>
    </span>
  );
}

function ProfileInfoBio({
  bio,
  compact = false,
  entities,
  expanded = false,
}: {
  bio: string;
  compact?: boolean | undefined;
  entities?: Profile["bioEntities"] | undefined;
  expanded?: boolean | undefined;
}) {
  return (
    <p
      className={cn(
        "min-h-0 max-w-full shrink-0 overflow-hidden break-words text-text",
        compact
          ? "mt-2 line-clamp-2 text-xs leading-5"
          : expanded
            ? "line-clamp-4 whitespace-pre-wrap text-sm leading-5"
            : "line-clamp-2 whitespace-pre-wrap text-sm leading-5",
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
      <p className="mt-2 line-clamp-3 break-words whitespace-pre-wrap text-sm leading-6 text-text">
        <RichText
          text={post.body}
          entities={post.bodyEntities}
          showPreviews={false}
        />
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
        "profile-grid-scaled-content flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-hidden rounded-card",
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
            compact
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
      style={{ ["--room-accent" as string]: room.accent }}
      title={`Open ${room.name}`}
    >
      <span
        className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-card border border-line bg-canvas/58 text-text"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--room-accent) 34%, transparent), var(--app-surface))",
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
