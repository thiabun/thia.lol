import {
  ArrowRight,
  Award,
  Bug,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  EyeOff,
  Heart,
  LayoutGrid,
  MessageCircle,
  Radio,
  Repeat2,
  Reply,
  Save,
  Settings2,
  Shield,
  Sparkles,
  Star,
  X,
  UserCheck,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router";
import type { AppShellOutletContext } from "../components/layout/AppShell";
import { PageMeta } from "../components/PageMeta";
import { PostCard } from "../components/social/PostCard";
import { ProfileHeader } from "../components/social/ProfileHeader";
import { ProfileModulesSection } from "../components/social/ProfileModules";
import { ReportForm } from "../components/social/ReportForm";
import { RoomCard } from "../components/social/RoomCard";
import { UserIdentityLink } from "../components/social/UserProfileLink";
import { ApiStateNotice } from "../components/ui/ApiStateNotice";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { ModalSheet } from "../components/ui/ModalSheet";
import {
  blockProfile,
  followProfile,
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
  unblockProfile,
  unfollowProfile,
  unmuteProfile,
  updateProfileCanvas,
  updateFeaturedBadges,
  type FollowRelationship,
} from "../lib/api";
import { ApiClientError } from "../lib/apiClient";
import { cn } from "../lib/classNames";
import { formatShortDate } from "../lib/dates";
import { pageEntrance } from "../lib/motionPresets";
import { formatCountWithUnit } from "../lib/pluralize";
import { defaultProfileLayoutPreset } from "../lib/profileLayoutPresets";
import {
  getProfileModuleDefinition,
  profileGridModuleSizeSpan,
  profileGridModuleSpanSize,
  profileModuleAllowedSizes,
  profileModuleFallbackTitle,
  profileModuleGridSpan,
  type ProfileGridModuleSize,
} from "../lib/profileModuleRegistry";
import { safeProfileImageUrl } from "../lib/profileMedia";
import type {
  BadgeDefinition,
  Post,
  Profile,
  ProfileBackgroundBlur,
  ProfileLayoutPreset,
  ProfileModule,
  ProfileModuleLayout,
  Room,
  UserBadge,
} from "../lib/types";
import { useAsyncData } from "../lib/useAsyncData";
import { useAuth } from "../lib/useAuth";

type ProfileTab = "feed" | "replies" | "rooms";
type ProfilePanel = "followers" | "following" | "badges";

export function ProfilePage() {
  const { handle, profileHandle } = useParams();
  const navigate = useNavigate();
  const { setTopBarAction } = useOutletContext<AppShellOutletContext>();
  const { runWithAuth, status, user } = useAuth();
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
  const [draftBackgroundBlur, setDraftBackgroundBlur] =
    useState<ProfileBackgroundBlur>("medium");
  const [selectedCanvasModuleId, setSelectedCanvasModuleId] = useState<
    number | undefined
  >();
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

  async function handleStartCanvasEdit() {
    if (!profile || !isOwnProfile || canvasLoading) {
      return;
    }

    setCanvasLoading(true);
    setCanvasError(undefined);

    try {
      const modules = await getMyProfileModules();
      const preparedModules = prepareProfileCanvasModules(
        profile,
        modules,
        profileLayoutPreset,
      );

      setDraftModules(preparedModules);
      setDraftBackgroundBlur(profile.profileBackgroundBlur);
      setSelectedCanvasModuleId(preparedModules[0]?.id);
      setCanvasEditing(true);
    } catch (error) {
      setCanvasError(
        error instanceof Error ? error.message : "Could not load canvas editor.",
      );
    } finally {
      setCanvasLoading(false);
    }
  }

  function handleCancelCanvasEdit() {
    setCanvasEditing(false);
    setCanvasError(undefined);
    setDraftModules([]);
    setSelectedCanvasModuleId(undefined);
    setDraftBackgroundBlur(profile?.profileBackgroundBlur ?? "medium");
  }

  async function handleSaveCanvasEdit() {
    if (!profile || !canvasEditing || canvasSaving) {
      return;
    }

    setCanvasSaving(true);
    setCanvasError(undefined);

    try {
      const result = await runWithAuth(
        (csrfToken) =>
          updateProfileCanvas(
            {
              canvasVersion: 1,
              backgroundBlur: draftBackgroundBlur,
              modules: draftModules
                .filter((module) => module.id > 0)
                .map((module) =>
                  profileModuleCanvasInput(
                    module,
                    profile,
                    profileLayoutPreset,
                    draftModules.indexOf(module),
                  ),
                ),
            },
            csrfToken,
          ),
        { retryOnCsrf: true },
      );

      const normalizedModules = prepareProfileCanvasModules(
        { ...profile, profileBackgroundBlur: result.backgroundBlur },
        result.modules,
        profileLayoutPreset,
      );

      setModulesOverride({
        handle: normalizedHandle,
        modules: normalizedModules,
      });
      setProfileOverride({
        ...profile,
        profileBackgroundBlur: result.backgroundBlur,
        profileCanvasVersion: result.canvasVersion,
      });
      setDraftModules(normalizedModules);
      setDraftBackgroundBlur(result.backgroundBlur);
      setCanvasEditing(false);
      setSelectedCanvasModuleId(undefined);
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
      prepareProfileCanvasModules(
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
      ),
    );
  }

  function handleCanvasModuleLayoutChange(
    moduleId: number,
    layout: ProfileModuleLayout,
  ) {
    if (!profile) {
      return;
    }

    setDraftModules((modules) =>
      modules.map((module) =>
        module.id === moduleId
          ? {
              ...module,
              layout,
            }
          : module,
      ),
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
      return canvasEditing || Boolean(profile.featuredPost);
    }

    if (module.type === "featured_room") {
      return canvasEditing || Boolean(profile.featuredRoom);
    }

    return true;
  });
  const profileCanvasModules = resolveProfileCanvasModules(profile, profileSpaceModules);
  const selectedCanvasModule = draftModules.find(
    (module) => module.id === selectedCanvasModuleId,
  );

  return (
    <motion.div
      className="relative mx-auto max-w-5xl"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <ProfilePersonalBackdrop profile={profile} />
      <div className="relative z-10 space-y-4 sm:space-y-5">
        <PageMeta
          title={`${profile.user.displayName} (@${profile.user.handle})`}
          description={profile.bio}
          path={`/@${profile.user.handle}`}
        />
        {isOwnProfile ? (
          <ProfileCanvasEditorToolbar
            backgroundBlur={draftBackgroundBlur}
            busy={canvasLoading || canvasSaving}
            editing={canvasEditing}
            error={canvasError}
            modules={draftModules}
            selectedModule={selectedCanvasModule}
            onBackgroundBlurChange={setDraftBackgroundBlur}
            onCancel={handleCancelCanvasEdit}
            onEdit={() => void handleStartCanvasEdit()}
            onLayoutChange={handleCanvasModuleLayoutChange}
            onSave={() => void handleSaveCanvasEdit()}
            onSelectModule={setSelectedCanvasModuleId}
            onVisibilityChange={handleCanvasModuleVisibilityChange}
          />
        ) : null}
        <ProfileModulesSection
          badges={profileBadges}
          editing={
            canvasEditing
              ? {
                  selectedModuleId: selectedCanvasModuleId,
                  onSelectModule: handleSelectCanvasModule,
                }
              : undefined
          }
          error={modulesState.error}
          isOwnProfile={isOwnProfile}
          layoutPreset={profileLayoutPreset}
          loading={modulesState.loading}
          modules={profileCanvasModules}
          renderModuleContent={(module) => {
            if (module.type === "profile_info") {
              return (
                <ProfileInfoModule
                  activeFollowError={activeFollowError}
                  activeProfileControlError={activeProfileControlError}
                  activeProfileControlMessage={activeProfileControlMessage}
                  featuredBadges={featuredBadges}
                  followPosting={followPosting}
                  isOwnProfile={isOwnProfile}
                  profile={profile}
                  profileControlBusy={profileControlBusy}
                  showChatHint={
                    status === "authenticated" &&
                    !isOwnProfile &&
                    !profile.blockedByMe &&
                    !profile.isMoot
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

            if (module.type === "featured_post" && profile.featuredPost) {
              return (
                <FeaturedPostModuleCard
                  profile={profile}
                  title={module.title ?? "Featured post"}
                />
              );
            }

            if (module.type === "featured_room" && profile.featuredRoom) {
              return (
                <FeaturedRoomModuleCard
                  profile={profile}
                  title={module.title ?? "Featured room"}
                />
              );
            }

            if (module.type === "activity") {
              return (
              <ProfileActivityModule
                activeTab={activeTab}
                feed={profileFeed}
                feedError={postsState.error ?? reblogsState.error}
                feedLoading={postsState.loading || reblogsState.loading}
                profile={profile}
                replies={profileReplies}
                repliesError={repliesState.error}
                repliesLoading={repliesState.loading}
                rooms={profileRooms}
                roomsError={roomsState.error}
                roomsLoading={roomsState.loading}
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
    </motion.div>
  );
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

function normalizeProfileInfoModule(
  profile: Profile,
  module: ProfileModule,
): ProfileModule {
  return {
    ...module,
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
  const normalized = resolveProfileCanvasModules(profile, modules);
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

  for (let row = 1; row <= 9 - rowSpan + 1; row++) {
    for (let column = 1; column <= 6 - colSpan + 1; column++) {
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
    layout.column + layout.colSpan - 1 > 6 ||
    layout.row + layout.rowSpan - 1 > 9
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

type ProfileCanvasEditorToolbarProps = {
  backgroundBlur: ProfileBackgroundBlur;
  busy: boolean;
  editing: boolean;
  error?: string | undefined;
  modules: ProfileModule[];
  onBackgroundBlurChange: (blur: ProfileBackgroundBlur) => void;
  onCancel: () => void;
  onEdit: () => void;
  onLayoutChange: (moduleId: number, layout: ProfileModuleLayout) => void;
  onSave: () => void;
  onSelectModule: (moduleId: number) => void;
  onVisibilityChange: (moduleId: number, visible: boolean) => void;
  selectedModule?: ProfileModule | undefined;
};

function ProfileCanvasEditorToolbar({
  backgroundBlur,
  busy,
  editing,
  error,
  modules,
  onBackgroundBlurChange,
  onCancel,
  onEdit,
  onLayoutChange,
  onSave,
  onSelectModule,
  onVisibilityChange,
  selectedModule,
}: ProfileCanvasEditorToolbarProps) {
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

  const selectedLayout = selectedModule?.layout ?? {
    column: 1,
    row: 1,
    colSpan: 1,
    rowSpan: 1,
  };
  const selectedSize =
    profileGridModuleSpanSize(selectedLayout.colSpan, selectedLayout.rowSpan) ??
    "1x1";
  const selectedDefinition = selectedModule
    ? getProfileModuleDefinition(selectedModule.type)
    : undefined;
  const canHide = selectedModule?.type !== "profile_info";
  const selectedVisible = selectedModule?.visibility === "public";

  function updateLayout(patch: Partial<ProfileModuleLayout>) {
    if (!selectedModule) {
      return;
    }

    const nextLayout = clampProfileModuleLayout({
      ...selectedLayout,
      ...patch,
    });

    onLayoutChange(selectedModule.id, nextLayout);
  }

  function updateSpan(size: ProfileGridModuleSize) {
    const span = profileGridModuleSizeSpan(size);
    updateLayout({
      colSpan: span.columns,
      rowSpan: span.rows,
    });
  }

  return (
    <section
      aria-label="Profile canvas editor"
      className="rounded-panel border border-line bg-surface/72 p-3 shadow-soft backdrop-blur-veil"
      data-testid="profile-canvas-editor"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-[1.1fr_0.8fr_0.9fr_0.9fr]">
          <label className="min-w-0 text-xs font-semibold uppercase text-muted">
            Module
            <select
              className="mt-1 h-9 w-full rounded-control border border-line bg-canvas/70 px-2 text-sm font-semibold normal-case text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              value={selectedModule?.id ?? ""}
              onChange={(event) => onSelectModule(Number(event.target.value))}
              data-testid="profile-canvas-module-select"
            >
              {modules.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.title ?? profileModuleFallbackTitle(module.type)}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-0 text-xs font-semibold uppercase text-muted">
            Blur
            <select
              className="mt-1 h-9 w-full rounded-control border border-line bg-canvas/70 px-2 text-sm font-semibold normal-case text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              value={backgroundBlur}
              onChange={(event) =>
                onBackgroundBlurChange(event.target.value as ProfileBackgroundBlur)
              }
              data-testid="profile-background-blur-select"
            >
              <option value="none">None</option>
              <option value="soft">Soft</option>
              <option value="medium">Medium</option>
              <option value="heavy">Heavy</option>
            </select>
          </label>

          <label className="min-w-0 text-xs font-semibold uppercase text-muted">
            Span
            <select
              className="mt-1 h-9 w-full rounded-control border border-line bg-canvas/70 px-2 text-sm font-semibold normal-case text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              value={selectedSize}
              onChange={(event) =>
                updateSpan(event.target.value as ProfileGridModuleSize)
              }
              data-testid="profile-canvas-span-select"
              disabled={!selectedModule}
            >
              {(selectedModule
                ? profileModuleAllowedSizes(selectedModule.type)
                : (["1x1"] as const)
              ).map((size) => (
                <option key={size} value={size}>
                  {sizeLabel(size)}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="min-w-0 text-xs font-semibold uppercase text-muted">
              Col
              <select
                className="mt-1 h-9 w-full rounded-control border border-line bg-canvas/70 px-2 text-sm font-semibold normal-case text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                value={selectedLayout.column}
                onChange={(event) =>
                  updateLayout({ column: Number(event.target.value) })
                }
                data-testid="profile-canvas-column-select"
                disabled={!selectedModule}
              >
                {numberOptions(6 - selectedLayout.colSpan + 1).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 text-xs font-semibold uppercase text-muted">
              Row
              <select
                className="mt-1 h-9 w-full rounded-control border border-line bg-canvas/70 px-2 text-sm font-semibold normal-case text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                value={selectedLayout.row}
                onChange={(event) =>
                  updateLayout({ row: Number(event.target.value) })
                }
                data-testid="profile-canvas-row-select"
                disabled={!selectedModule}
              >
                {numberOptions(9 - selectedLayout.rowSpan + 1).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-control border border-line bg-canvas/55 p-1">
            <CanvasIconButton
              label="Move up"
              disabled={!selectedModule || selectedLayout.row <= 1}
              icon={<ChevronUp aria-hidden="true" size={15} />}
              onClick={() => updateLayout({ row: selectedLayout.row - 1 })}
            />
            <CanvasIconButton
              label="Move left"
              disabled={!selectedModule || selectedLayout.column <= 1}
              icon={<ChevronLeft aria-hidden="true" size={15} />}
              onClick={() => updateLayout({ column: selectedLayout.column - 1 })}
            />
            <CanvasIconButton
              label="Move right"
              disabled={
                !selectedModule ||
                selectedLayout.column >= 6 - selectedLayout.colSpan + 1
              }
              icon={<ChevronRight aria-hidden="true" size={15} />}
              onClick={() => updateLayout({ column: selectedLayout.column + 1 })}
            />
            <CanvasIconButton
              label="Move down"
              disabled={
                !selectedModule ||
                selectedLayout.row >= 9 - selectedLayout.rowSpan + 1
              }
              icon={<ChevronDownIcon />}
              onClick={() => updateLayout({ row: selectedLayout.row + 1 })}
            />
          </div>

          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!selectedModule || !canHide}
            data-testid="profile-canvas-visibility-button"
            icon={
              selectedVisible ? (
                <Eye aria-hidden="true" size={16} />
              ) : (
                <EyeOff aria-hidden="true" size={16} />
              )
            }
            onClick={() =>
              selectedModule
                ? onVisibilityChange(selectedModule.id, !selectedVisible)
                : undefined
            }
          >
            {selectedVisible ? "Shown" : "Hidden"}
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
            data-testid="profile-canvas-save-button"
            icon={<Save aria-hidden="true" size={16} />}
            onClick={onSave}
          >
            {busy ? "Saving" : "Save"}
          </Button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <LayoutGrid aria-hidden="true" size={14} />
          6 x 9
        </span>
        {selectedDefinition ? <span>{selectedDefinition.label}</span> : null}
        {error ? (
          <span className="font-medium text-rose-ink" role="alert">
            {error}
          </span>
        ) : null}
      </div>
    </section>
  );
}

function CanvasIconButton({
  disabled,
  icon,
  label,
  onClick,
}: {
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="grid size-8 place-items-center rounded-control text-text transition duration-fluid ease-fluid hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-45"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

function ChevronDownIcon() {
  return (
    <span className="grid size-[15px] place-items-center">
      <ChevronUp aria-hidden="true" size={15} className="rotate-180" />
    </span>
  );
}

function clampProfileModuleLayout(layout: ProfileModuleLayout): ProfileModuleLayout {
  const colSpan = Math.max(1, Math.min(3, layout.colSpan));
  const rowSpan = Math.max(1, Math.min(3, layout.rowSpan));

  return {
    column: Math.max(1, Math.min(6 - colSpan + 1, layout.column)),
    row: Math.max(1, Math.min(9 - rowSpan + 1, layout.row)),
    colSpan,
    rowSpan,
  };
}

function numberOptions(max: number): number[] {
  return Array.from({ length: Math.max(1, max) }, (_, index) => index + 1);
}

function sizeLabel(size: ProfileGridModuleSize): string {
  const span = profileGridModuleSizeSpan(size);

  return `${span.columns} x ${span.rows}`;
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
  const imageUrl = safeProfileImageUrl(profile.profileBackground);
  const blurTreatment = profile.profileBackgroundBlur;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-[-1.25rem] bottom-[-2rem] z-0 min-h-dvh w-screen -translate-x-1/2 overflow-hidden sm:top-[-1.5rem]"
      data-profile-background-blur={blurTreatment}
      data-profile-background-source={imageUrl ? "image" : "fallback"}
      data-testid="profile-personal-backdrop"
    >
      {imageUrl ? (
        <img
          alt=""
          className={cn(
            "absolute inset-0 size-full scale-105 object-cover opacity-[0.34] saturate-[0.9]",
            profileBackgroundBlurClass(blurTreatment),
          )}
          decoding="async"
          src={imageUrl}
        />
      ) : (
        <div className="absolute inset-0 bg-page-wash" />
      )}
      <div className="absolute inset-0 bg-canvas/52" />
      <div className="absolute inset-0 bg-gradient-to-b from-canvas/76 via-canvas/48 to-canvas/86" />
      <div className="absolute inset-0 bg-gradient-to-r from-surface/64 via-transparent to-surface/64" />
    </div>
  );
}

function profileBackgroundBlurClass(
  treatment: ProfileBackgroundBlur,
): string {
  if (treatment === "soft") {
    return "blur-sm";
  }

  if (treatment === "heavy") {
    return "blur-2xl";
  }

  if (treatment === "none") {
    return "";
  }

  return "blur-xl";
}

type ProfileInfoModuleProps = {
  activeFollowError?: string | undefined;
  activeProfileControlError?: string | undefined;
  activeProfileControlMessage?: string | undefined;
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
  status: string;
};

function ProfileInfoModule({
  activeFollowError,
  activeProfileControlError,
  activeProfileControlMessage,
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
  status,
}: ProfileInfoModuleProps) {
  return (
    <div className="min-w-0 space-y-3" data-testid="profile-module-profile-info">
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
        showChatHint={showChatHint}
      />
      {!isOwnProfile ? (
        <ReportForm
          targetType="profile"
          targetId={profile.user.id}
          reportedUserId={profile.user.id}
          title="Report profile"
          explainer={`This reports @${profile.user.handle}'s profile to moderators.`}
        />
      ) : null}
    </div>
  );
}

function FeaturedPostModuleCard({
  profile,
  title,
}: {
  profile: Profile;
  title: string;
}) {
  const featuredPost = profile.featuredPost;

  return (
    <article
      className="h-full min-w-0 rounded-card border border-line bg-surface/58 p-3 shadow-soft backdrop-blur-veil"
      data-testid="profile-module-featured-post"
    >
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      {featuredPost ? (
        <div className="mt-3">
          <FeaturedPostCard post={featuredPost} />
        </div>
      ) : (
        <p className="mt-2 text-sm leading-6 text-muted">No featured post.</p>
      )}
    </article>
  );
}

function FeaturedRoomModuleCard({
  profile,
  title,
}: {
  profile: Profile;
  title: string;
}) {
  const featuredRoom = profile.featuredRoom;

  return (
    <article
      className="h-full min-w-0 rounded-card border border-line bg-surface/58 p-3 shadow-soft backdrop-blur-veil"
      data-testid="profile-module-featured-room"
    >
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      {featuredRoom ? (
        <div className="mt-3">
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
  title: string;
};

function ProfileActivityModule({
  activeTab,
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
  title,
}: ProfileActivityModuleProps) {
  return (
    <div
      className="flex h-full max-h-[min(38rem,75dvh)] min-h-0 min-w-0 flex-col gap-3 overflow-hidden rounded-card border border-line bg-surface/58 p-3 shadow-soft backdrop-blur-veil md:max-h-[calc(var(--profile-grid-row-size)+var(--profile-grid-row-size)+var(--profile-grid-row-size)+var(--profile-grid-gap)+var(--profile-grid-gap))]"
      data-profile-activity-max-rows="3"
      data-testid="profile-module-activity"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
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
