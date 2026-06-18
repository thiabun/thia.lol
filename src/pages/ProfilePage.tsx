import {
  ArrowRight,
  Award,
  Bug,
  CalendarDays,
  Heart,
  ImagePlus,
  MessageCircle,
  Music2,
  Radio,
  Repeat2,
  Reply,
  Settings2,
  Shield,
  Sparkles,
  Star,
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
import { ProfileHeader } from "../components/social/ProfileHeader";
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
  muteProfile,
  removeProfileFollower,
  unblockProfile,
  unfollowProfile,
  unmuteProfile,
  updateProfileCanvas,
  updateFeaturedBadges,
  updateMyProfile,
  uploadImage,
  uploadVideo,
  type FollowRelationship,
  type ImageUploadPurpose,
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
  profileGridModuleSizeSpan,
  profileGridModuleSpanSize,
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
  const profileEditReturnHandledRef = useRef(false);
  const profileContentAutosaveRequestRef = useRef(0);
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
  const loadedModules = modulesState.data ?? [];
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

  const handleStartCanvasEdit = useCallback(() => {
    if (!profile || !isOwnProfile || canvasLoading) {
      return;
    }

    setCanvasLoading(true);
    setCanvasError(undefined);
    setDraftBackgroundBlur(profile.profileBackgroundBlur);
    setDraftProfile(profile);
    setProfileContentAutosaveState("idle");
    setProfileContentAutosaveError(undefined);
    setCanvasEditing(true);
    setCanvasLoading(false);
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
      handleStartCanvasEdit();
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
    setDraftBackgroundBlur(profile?.profileBackgroundBlur ?? "medium");
    setDraftProfile(undefined);
    setProfileDraftUploading(undefined);
    setProfileContentAutosaveState("idle");
    setProfileContentAutosaveError(undefined);
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
              canvasVersion: 1,
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
        {isOwnProfile ? (
          <ProfileTransitionEditor
            autosaveError={profileContentAutosaveError}
            autosaveState={profileContentAutosaveState}
            backgroundBlur={draftBackgroundBlur}
            busy={canvasLoading || canvasSaving}
            editing={canvasEditing}
            error={canvasError}
            profile={renderedProfile}
            uploading={profileDraftUploading}
            onBackgroundBlurChange={(blur) => void handleBackgroundBlurChange(blur)}
            onCancel={handleCancelCanvasEdit}
            onClearBackground={() => void handleClearProfileBackgroundDraft()}
            onEdit={handleStartCanvasEdit}
            onImageUpload={handleProfileImageDraftSelection}
            onProfileDraftChange={handleDraftProfileChange}
            onVideoUpload={(file) => void handleProfileVideoDraftUpload(file)}
          />
        ) : null}
        <div className="min-w-0 space-y-4 sm:space-y-5">
          <ProfileModulesSection
          badges={profileBadges}
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
                  editing={false}
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
                  editing={false}
                  profile={renderedProfile}
                  title={module.title ?? "Featured post"}
                />
              );
            }

            if (module.type === "featured_room" && renderedProfile.featuredRoom) {
              return (
                <FeaturedRoomModuleCard
                  editing={false}
                  profile={renderedProfile}
                  title={module.title ?? "Featured room"}
                />
              );
            }

            if (module.type === "activity") {
              return (
              <ProfileActivityModule
                activeTab={activeTab}
                editing={false}
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
