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
import { ProfileGrid, ProfileGridModule } from "../components/social/ProfileGrid";
import { ProfileHeader } from "../components/social/ProfileHeader";
import {
  ProfileModuleCard,
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
  followProfile,
  getProfile,
  getProfileBadges,
  getProfileFollowers,
  getProfileFollowing,
  getProfileModules,
  getProfilePosts,
  getProfileReblogs,
  getProfileReplies,
  getProfileRooms,
  getProfileCanvasDraft,
  muteProfile,
  removeProfileFollower,
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
  uploadImage,
  uploadVideo,
  type FollowRelationship,
  type ImageUploadPurpose,
  type ProfileCanvasDraftState,
  type ProfileIntegrationProvider,
  type UpdateProfileInput,
} from "../lib/api";
import { ApiClientError } from "../lib/apiClient";
import { cn } from "../lib/classNames";
import { formatShortDate } from "../lib/dates";
import { validateImageCropFile } from "../lib/imageCrop";
import { pageEntrance } from "../lib/motionPresets";
import { formatCountWithUnit } from "../lib/pluralize";
import { defaultProfileLayoutPreset } from "../lib/profileLayoutPresets";
import {
  PROFILE_CANVAS_DESKTOP_COLUMNS,
  PROFILE_CANVAS_DESKTOP_ROWS,
  PROFILE_CANVAS_MAX_MODULE_ROWS,
  PROFILE_CANVAS_PROFILE_INFO_COLUMNS,
  PROFILE_CANVAS_VERSION,
  getProfileModuleDefinition,
  profileModuleAllowedSizes,
  profileModuleCatalog,
  profileModuleFallbackTitle,
  profileGridModuleSizeSpan,
  profileGridModuleSpanSize,
  profileModuleSizeLabel,
  type ProfileGridModuleSize,
} from "../lib/profileModuleRegistry";
import { safeProfileImageUrl } from "../lib/profileMedia";
import type {
  BadgeDefinition,
  Post,
  Profile,
  ProfileBackgroundBlur,
  ProfileExternalConnection,
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
  const publicModules = loadedModules.filter(
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
      const draft = await getProfileCanvasDraft();

      setCanvasDraft(draft);
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
    setCanvasDraft(nextDraft);
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

          setCanvasDraft(savedDraft);
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
      setCanvasDraft(savedDraft);
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
        profileCanvasVersion: saved.canvasVersion,
      });
      setDraftBackgroundBlur(saved.backgroundBlur);
      setCanvasDraft(undefined);
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
    setCanvasDraft(undefined);
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
        profileCanvasVersion: canvas.canvasVersion,
      };

      setProfileOverride(savedProfile);
      setDraftProfile((current) =>
        current
          ? {
              ...current,
              profileBackgroundBlur: canvas.backgroundBlur,
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
    if (!canvasDraft) {
      return;
    }

    queueCanvasDraftAutosave(updater(canvasDraft));
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
      canvasGlass: Math.min(92, Math.max(22, Math.round(canvasGlass))),
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
  const profileSpaceModules = publicModules.filter((module) => {
    if (module.type === "activity") {
      return showActivityModule;
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
      className="relative mx-auto max-w-5xl"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <ProfilePersonalBackdrop profile={backgroundPreviewProfile} />
      <div className="relative z-10 space-y-4 sm:space-y-5">
        <PageMeta
          title={`${renderedProfile.user.displayName} (@${renderedProfile.user.handle})`}
          description={renderedProfile.bio}
          path={`/@${renderedProfile.user.handle}`}
        />
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
              onImageUpload={handleProfileImageDraftSelection}
              onNewDraftModuleId={() => nextDraftModuleIdRef.current--}
              onRenderModuleContent={(module, size) =>
                renderProfileModuleContent(module, size, true)
              }
              onSave={() => void handleSaveCanvasEdit()}
              onVideoUpload={(file) => void handleProfileVideoDraftUpload(file)}
            />
          ) : (
            <ProfileModulesSection
              badges={profileBadges}
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
          <textarea
            className="mt-1 min-h-24 w-full resize-y rounded-control border border-line bg-canvas/55 px-3 py-2 text-sm font-medium normal-case text-text focus-visible:outline-2 focus-visible:outline-focus"
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

function blurLabel(blur: ProfileBackgroundBlur): string {
  return blur === "none" ? "None" : blur[0]!.toUpperCase() + blur.slice(1);
}

function profileCanvasCells(): CanvasPoint[] {
  const cells: CanvasPoint[] = [];

  for (let row = 1; row <= PROFILE_CANVAS_ROWS; row += 1) {
    for (let column = 1; column <= PROFILE_CANVAS_COLUMNS; column += 1) {
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

function profileCanvasSortDraftModules(modules: ProfileModule[]): ProfileModule[] {
  return [...modules].sort((first, second) => {
    const firstLayout = first.layout;
    const secondLayout = second.layout;

    if (firstLayout && secondLayout) {
      return (
        firstLayout.row - secondLayout.row ||
        firstLayout.column - secondLayout.column ||
        first.position - second.position
      );
    }

    return first.position - second.position;
  });
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
): ProfileModuleLayout {
  const rect = grid.getBoundingClientRect();
  const styles = window.getComputedStyle(grid);
  const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
  const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
  const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
  const columnGap = Number.parseFloat(styles.columnGap) || 0;
  const rowGap = Number.parseFloat(styles.rowGap) || columnGap;
  const contentWidth = Math.max(1, grid.clientWidth - paddingLeft - paddingRight);
  const cellSize = Math.max(
    1,
    (contentWidth - columnGap * (PROFILE_CANVAS_COLUMNS - 1)) /
      PROFILE_CANVAS_COLUMNS,
  );
  const stepX = cellSize + columnGap;
  const stepY = cellSize + rowGap;
  const moduleLeft = clientX - pointerOffsetX;
  const moduleTop = clientY - pointerOffsetY;
  const rawColumn = Math.round((moduleLeft - rect.left - paddingLeft) / stepX) + 1;
  const rawRow = Math.round((moduleTop - rect.top - paddingTop) / stepY) + 1;

  return {
    column: Math.min(
      PROFILE_CANVAS_COLUMNS - colSpan + 1,
      Math.max(1, rawColumn),
    ),
    row: Math.min(PROFILE_CANVAS_ROWS - rowSpan + 1, Math.max(1, rawRow)),
    colSpan,
    rowSpan,
  };
}

function profileCanvasBestSizeForSelection(
  type: ProfileModule["type"],
  selection: ProfileModuleLayout,
): ProfileGridModuleSize | undefined {
  const selectionSize = profileGridModuleSpanSize(
    Math.min(PROFILE_CANVAS_PROFILE_INFO_COLUMNS, selection.colSpan),
    Math.min(PROFILE_CANVAS_MAX_MODULE_ROWS, selection.rowSpan),
  );
  const allowedSizes = profileModuleAllowedSizes(type);

  if (selectionSize && allowedSizes.includes(selectionSize)) {
    return selectionSize;
  }

  return [...allowedSizes]
    .filter((size) => {
      const span = profileGridModuleSizeSpan(size);
      return span.columns <= selection.colSpan && span.rows <= selection.rowSpan;
    })
    .sort((first, second) => {
      const firstSpan = profileGridModuleSizeSpan(first);
      const secondSpan = profileGridModuleSizeSpan(second);
      return (
        secondSpan.columns * secondSpan.rows -
          firstSpan.columns * firstSpan.rows ||
        secondSpan.columns - firstSpan.columns ||
        secondSpan.rows - firstSpan.rows
      );
    })[0];
}

function profileCanvasDefaultConfigForModule(
  type: ProfileModule["type"],
  size: ProfileGridModuleSize,
): ProfileModule["config"] {
  const definition = getProfileModuleDefinition(type);
  const base = { canvasSize: size, configured: false };

  if (type === "connections" || type === "links") {
    return { ...base, links: [] };
  }

  if (type === "badge_display" || type === "featured_badges") {
    return { ...base, userBadgeIds: [] };
  }

  if (definition.category === "images") {
    return { ...base, mediaItems: [] };
  }

  if (definition.category === "video") {
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

      const firstLayout = first.layout ?? profileCanvasDefaultClientLayout(first, 0);
      const secondLayout = second.layout ?? profileCanvasDefaultClientLayout(second, 0);

      return firstLayout.row - secondLayout.row || firstLayout.column - secondLayout.column;
    });

  active.forEach((module, index) => {
    const requested = profileCanvasClampLayout(
      module.layout ?? profileCanvasDefaultClientLayout(module, index),
    );
    const layout = profileCanvasLayoutFits(requested, occupied)
      ? requested
      : profileCanvasNextAvailableLayout(requested, occupied) ?? requested;

    profileCanvasOccupyLayout(layout, occupied);
    result.set(module.id, { ...module, layout });
  });

  return modules.map((module) => result.get(module.id) ?? module);
}

function profileCanvasCanResizeModule(
  module: ProfileModule,
  modules: ProfileModule[],
  size: ProfileGridModuleSize,
): boolean {
  if (!module.layout) {
    return false;
  }

  const span = profileGridModuleSizeSpan(size);
  const resolved = profileCanvasResolveDraftCollisions(
    modules.map((item) =>
      item.id === module.id
        ? {
            ...item,
            layout: {
              ...module.layout!,
              colSpan: span.columns,
              rowSpan: span.rows,
            },
          }
        : item,
    ),
    module.id,
  );
  const updated = resolved.find((item) => item.id === module.id);

  return (
    updated?.layout?.colSpan === span.columns &&
    updated.layout.rowSpan === span.rows
  );
}

function profileCanvasClampLayout(layout: ProfileModuleLayout): ProfileModuleLayout {
  const colSpan = Math.min(PROFILE_CANVAS_PROFILE_INFO_COLUMNS, Math.max(1, layout.colSpan));
  const rowSpan = Math.min(PROFILE_CANVAS_MAX_MODULE_ROWS, Math.max(1, layout.rowSpan));

  return {
    column: Math.min(PROFILE_CANVAS_COLUMNS - colSpan + 1, Math.max(1, layout.column)),
    row: Math.min(PROFILE_CANVAS_ROWS - rowSpan + 1, Math.max(1, layout.row)),
    colSpan,
    rowSpan,
  };
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
  modules: ProfileModule[];
  onBackgroundBlurChange: (blur: ProfileBackgroundBlur) => void;
  onCancel: () => void;
  onCanvasGlassChange: (canvasGlass: number) => void;
  onChange: (updater: (draft: ProfileCanvasDraftState) => ProfileCanvasDraftState) => void;
  onClearBackground: () => void;
  onConnectProvider: (provider: ProfileIntegrationProvider) => void;
  onImageUpload: (
    file: File,
    purpose: "avatar" | "banner" | "profile_background",
  ) => void;
  onNewDraftModuleId: () => number;
  onRenderModuleContent: (
    module: ProfileModule,
    size: ProfileGridModuleSize,
  ) => ReactNode | undefined;
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
  modules,
  onBackgroundBlurChange,
  onCancel,
  onCanvasGlassChange,
  onChange,
  onClearBackground,
  onConnectProvider,
  onImageUpload,
  onNewDraftModuleId,
  onRenderModuleContent,
  onSave,
  onVideoUpload,
  profile,
  uploading,
}: ProfileDirectCanvasEditorProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);
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
  }, [dragState, modules, updateDraftModules]);

  function handleCellClick(point: CanvasPoint) {
    if (!selectionStart) {
      setSelectionStart(point);
      setSelectionHover(point);
      return;
    }

    const rect = profileCanvasRectFromPoints(selectionStart, point);
    const id = onNewDraftModuleId();
    const colSpan = Math.min(PROFILE_CANVAS_MAX_MODULE_ROWS, rect.colSpan);
    const rowSpan = Math.min(PROFILE_CANVAS_MAX_MODULE_ROWS, rect.rowSpan);
    const size = profileGridModuleSpanSize(colSpan, rowSpan) ?? "1x1";
    const blankModule: ProfileModule = {
      id,
      type: "uploaded_image",
      title: null,
      config: { canvasSize: size, configured: false },
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
    setPickerModuleId(id);
    setSelectionStart(undefined);
    setSelectionHover(undefined);
  }

  function handleChooseModule(type: ProfileModule["type"]) {
    const module = pickerModule;

    if (!module?.layout) {
      return;
    }

    const size = profileCanvasBestSizeForSelection(type, module.layout);

    if (!size) {
      return;
    }

    const span = profileGridModuleSizeSpan(size);

    updateDraftModules((currentModules) =>
      profileCanvasResolveDraftCollisions(
        currentModules.map((item) =>
          item.id === module.id
            ? {
                ...item,
                type,
                title: null,
                config: profileCanvasDefaultConfigForModule(type, size),
                visibility: "draft",
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
    setSettingsModuleId(module.id);
  }

  function handleModuleSize(module: ProfileModule, size: ProfileGridModuleSize) {
    const span = profileGridModuleSizeSpan(size);

    updateDraftModules((currentModules) =>
      profileCanvasResolveDraftCollisions(
        currentModules.map((item) =>
          item.id === module.id && item.layout
            ? {
                ...item,
                config: { ...item.config, canvasSize: size },
                layout: {
                  ...item.layout,
                  colSpan: span.columns,
                  rowSpan: span.rows,
                },
              }
            : item,
        ),
        module.id,
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
    setSettingsModuleId(undefined);
  }

  const selectionRect =
    selectionStart && selectionHover
      ? profileCanvasRectFromPoints(selectionStart, selectionHover)
      : undefined;

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
          <label className="flex min-h-11 items-center gap-3 rounded-control border border-line bg-surface/72 px-3 text-sm font-semibold text-text shadow-soft backdrop-blur-veil">
            <span>Glass</span>
            <input
              className="w-28 accent-[var(--app-accent)]"
              type="range"
              min={22}
              max={92}
              value={draft.canvasGlass}
              data-testid="profile-canvas-glass-slider"
              onChange={(event) =>
                onCanvasGlassChange(Number(event.currentTarget.value))
              }
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
        gridRef={gridRef}
        className="relative overflow-hidden"
        maxColumns={PROFILE_CANVAS_COLUMNS}
        maxRows={PROFILE_CANVAS_ROWS}
        testId="profile-canvas-direct-grid"
      >
        <div
          className="pointer-events-auto absolute inset-2 z-0 grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${PROFILE_CANVAS_COLUMNS}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${PROFILE_CANVAS_ROWS}, minmax(0, 1fr))`,
          }}
          aria-hidden="true"
        >
          {profileCanvasCells().map((point) => {
            const selected = selectionStart &&
              point.column === selectionStart.column &&
              point.row === selectionStart.row;
            const inPreview = selectionRect
              ? profileCanvasPointInRect(point, selectionRect)
              : false;

            return (
              <button
                key={`${point.column}:${point.row}`}
                type="button"
                className={cn(
                  "min-h-0 rounded-card border border-line/55 bg-surface/20 transition duration-fluid ease-fluid hover:border-line-strong hover:bg-surface/42 focus-visible:outline-2 focus-visible:outline-focus",
                  selected ? "border-focus bg-focus/30" : undefined,
                  inPreview && !selected ? "border-focus/70 bg-focus/15" : undefined,
                )}
                data-testid={`profile-canvas-cell-${point.column}-${point.row}`}
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
          const unconfigured =
            module.visibility === "draft" || module.config.configured === false;

          return (
            <ProfileGridModule
              key={module.id}
              className={cn(
                "z-10 rounded-card transition duration-fluid ease-fluid",
                unconfigured ? "backdrop-blur-veil" : undefined,
                module.pinned ? "outline outline-1 outline-line-strong" : undefined,
              )}
              layout={layout}
              pinned={module.pinned}
              size={size}
              testId={`profile-canvas-module-${module.id}`}
            >
              <div
                className={cn(
                  "relative h-full min-h-0 cursor-grab rounded-card active:cursor-grabbing",
                  unconfigured ? "blur-[1px]" : undefined,
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
                {unconfigured ? (
                  <button
                    type="button"
                    className="grid h-full min-h-0 w-full place-items-center rounded-card border border-dashed border-line-strong bg-surface/62 p-4 text-center shadow-soft backdrop-blur-veil focus-visible:outline-2 focus-visible:outline-focus"
                    data-profile-edit-control="true"
                    data-testid={`profile-canvas-add-module-${module.id}`}
                    onClick={() => setPickerModuleId(module.id)}
                  >
                    <span>
                      <span className="mx-auto grid size-11 place-items-center rounded-full border border-line bg-canvas/80 text-accent-strong">
                        <Plus aria-hidden="true" size={22} />
                      </span>
                      <span className="mt-3 block text-sm font-semibold text-text">
                        Click to add module
                      </span>
                    </span>
                  </button>
                ) : (
                  onRenderModuleContent(module, size) ?? (
                    <ProfileModuleCard
                      module={module}
                      badges={[]}
                      editing
                      size={size}
                    />
                  )
                )}
              </div>
              <button
                type="button"
                className="absolute right-2 top-2 z-30 grid size-8 place-items-center rounded-control border border-line bg-surface/92 text-text shadow-soft backdrop-blur-veil transition hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus"
                aria-label={`Edit ${profileModuleFallbackTitle(module.type)}`}
                title={`Edit ${profileModuleFallbackTitle(module.type)}`}
                data-profile-edit-control="true"
                data-testid={`profile-canvas-edit-module-${module.id}`}
                onClick={() => setSettingsModuleId(module.id)}
              >
                <MoreHorizontal aria-hidden="true" size={16} />
              </button>
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
        module={settingsModule}
        modules={sortedModules}
        onClose={() => setSettingsModuleId(undefined)}
        onRemove={handleRemoveModule}
        onConnectProvider={onConnectProvider}
        onSize={handleModuleSize}
        onTogglePin={(module) =>
          updateDraftModules((currentModules) =>
            currentModules.map((item) =>
              item.id === module.id ? { ...item, pinned: !item.pinned } : item,
            ),
          )
        }
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
  onChoose: (type: ProfileModule["type"]) => void;
  onClose: () => void;
}) {
  return (
    <ModalSheet
      open={Boolean(module)}
      onClose={onClose}
      title="Add module"
      description="Choose a tool that fits the selected space."
      size="lg"
      testId="profile-module-picker"
    >
      {module?.layout ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {profileModuleCatalog.map((item) => {
            const enabled = Boolean(
              profileCanvasBestSizeForSelection(item.type, module.layout!),
            );

            return (
              <button
                key={item.type}
                type="button"
                className={cn(
                  "min-h-28 rounded-card border border-line bg-canvas/45 p-3 text-left transition duration-fluid ease-fluid hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus",
                  !enabled ? "cursor-not-allowed opacity-50 blur-[1px]" : undefined,
                )}
                disabled={!enabled}
                data-testid={`profile-module-picker-${item.type}`}
                onClick={() => onChoose(item.type)}
              >
                <span className="block text-sm font-semibold text-text">
                  {item.label}
                </span>
                <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted">
                  {enabled ? item.description : "Selection too small"}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </ModalSheet>
  );
}

function ModuleSettingsModal({
  module,
  modules,
  onClose,
  onConnectProvider,
  onRemove,
  onSize,
  onTogglePin,
}: {
  module: ProfileModule | undefined;
  modules: ProfileModule[];
  onClose: () => void;
  onConnectProvider: (provider: ProfileIntegrationProvider) => void;
  onRemove: (module: ProfileModule) => void;
  onSize: (module: ProfileModule, size: ProfileGridModuleSize) => void;
  onTogglePin: (module: ProfileModule) => void;
}) {
  const definition = module ? getProfileModuleDefinition(module.type) : undefined;
  const provider = module ? profileCanvasProviderForModule(module.type) : undefined;

  return (
    <ModalSheet
      open={Boolean(module)}
      onClose={onClose}
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
          </div>
        ) : undefined
      }
    >
      {module && definition ? (
        <div className="space-y-4">
          {definition.purpose === "integration" && provider ? (
            <div className="rounded-card border border-line bg-canvas/45 p-3">
              <p className="text-sm font-semibold text-text">Connect</p>
              <p className="mt-1 text-sm leading-6 text-muted">
                Connect only when this module needs provider data. thia.lol stores the minimum token data needed to refresh this card.
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-3"
                variant="secondary"
                onClick={() => onConnectProvider(provider)}
              >
                Connect
              </Button>
            </div>
          ) : null}
          <div>
            <p className="text-xs font-semibold uppercase text-muted">
              Available sizes
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {profileModuleAllowedSizes(module.type).map((size) => {
                const enabled = profileCanvasCanResizeModule(module, modules, size);

                return (
                  <button
                    key={size}
                    type="button"
                    className="min-h-10 rounded-control border border-line bg-canvas/45 px-3 text-sm font-semibold text-text transition hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={!enabled}
                    data-testid={`profile-canvas-size-${size}`}
                    onClick={() => onSize(module, size)}
                  >
                    {profileModuleSizeLabel(module.type, size)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </ModalSheet>
  );
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
