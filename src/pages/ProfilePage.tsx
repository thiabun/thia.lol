import { MessageCircle } from "lucide-react";
import { motion } from "motion/react";
import { useMemo } from "react";
import { useParams } from "react-router";
import { PageMeta } from "../components/PageMeta";
import { PostCard } from "../components/social/PostCard";
import { ProfileHeader } from "../components/social/ProfileHeader";
import { ApiStateNotice } from "../components/ui/ApiStateNotice";
import { EmptyState } from "../components/ui/EmptyState";
import { getProfile, getProfilePosts } from "../lib/api";
import { ApiClientError } from "../lib/apiClient";
import { cardEntrance, pageEntrance } from "../lib/motionPresets";
import { useAsyncData } from "../lib/useAsyncData";

export function ProfilePage() {
  const { handle, profileHandle } = useParams();
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
  const profileState = useAsyncData(profileLoader);
  const postsState = useAsyncData(postsLoader);
  const profile = profileState.data;
  const profilePosts = postsState.data ?? [];
  const profileMissing =
    profileState.error instanceof ApiClientError && profileState.error.status === 404;

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
            text="Profile details are loading."
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

  return (
    <motion.div
      className="mx-auto max-w-4xl space-y-5"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <PageMeta
        title={`${profile.user.displayName} (@${profile.user.handle})`}
        description={profile.bio}
        path={`/@${profile.user.handle}`}
      />
      <ProfileHeader profile={profile} />
      <motion.div variants={cardEntrance} custom={1} initial="hidden" animate="show">
        <h2 className="mb-3 text-xl font-semibold text-text">Posts</h2>
        {postsState.loading ? (
          <ApiStateNotice
            kind="loading"
            title="Loading posts"
            text="This profile's posts are loading."
          />
        ) : null}
        {postsState.error ? (
          <ApiStateNotice
            kind="error"
            title="Posts are not available"
            text="Try refreshing in a moment."
          />
        ) : null}
        {profilePosts.length > 0 ? (
          <div className="space-y-4">
            {profilePosts.map((post, index) => (
              <PostCard key={post.id} post={post} index={index} />
            ))}
          </div>
        ) : !postsState.loading && !postsState.error ? (
          <EmptyState
            icon={MessageCircle}
            title="This profile has not posted yet"
            text="Posts from this profile will appear here."
          />
        ) : null}
      </motion.div>
    </motion.div>
  );
}
