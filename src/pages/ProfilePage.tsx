import { MessageCircle } from "lucide-react";
import { useMemo } from "react";
import { useParams } from "react-router";
import { PageMeta } from "../components/PageMeta";
import { EmptyState } from "../components/ui/EmptyState";
import { PostCard } from "../components/social/PostCard";
import { ProfileHeader } from "../components/social/ProfileHeader";
import { posts } from "../data/mockData";
import { getProfile } from "../lib/api";
import { useAsyncData } from "../lib/useAsyncData";

export function ProfilePage() {
  const { handle = "thia" } = useParams();
  const normalizedHandle = handle.replace(/^@/, "").toLowerCase();
  const profileLoader = useMemo(() => () => getProfile(normalizedHandle), [normalizedHandle]);
  const { data: profile } = useAsyncData(profileLoader);
  const profilePosts = posts.filter(
    (post) => post.author.handle === normalizedHandle,
  );

  if (!profile) {
    return (
      <>
        <PageMeta
          title={`@${normalizedHandle}`}
          description={`Profile for @${normalizedHandle} on thia.lol.`}
          path={`/@${normalizedHandle}`}
        />
        <EmptyState
          icon={MessageCircle}
          title="Profile warming up"
          text="The profile route is settling into its fallback data."
        />
      </>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageMeta
        title={`${profile.user.displayName} (@${profile.user.handle})`}
        description={profile.bio}
        path={`/@${profile.user.handle}`}
      />
      <ProfileHeader profile={profile} />
      <div>
        <h2 className="mb-3 text-xl font-semibold text-text">Signals</h2>
        {profilePosts.length > 0 ? (
          <div className="space-y-4">
            {profilePosts.map((post, index) => (
              <PostCard key={post.id} post={post} index={index} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={MessageCircle}
            title="No public signals yet"
            text="This profile has room to become more visible over time."
          />
        )}
      </div>
    </div>
  );
}
