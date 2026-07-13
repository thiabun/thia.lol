import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { ShareCardScene } from "../components/share/ShareCardScene";
import {
  getPost,
  getProfile,
  getProfileBadges,
  getProfileModules,
  getProfilePosts,
  getProfileReblogs,
} from "../lib/api";
import type {
  Post,
  Profile,
  ProfileBadgesResult,
  ProfileModule,
} from "../lib/types";

export function ShareRenderPostPage() {
  const { postId = "" } = useParams();
  const [post, setPost] = useState<Post | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    getPost(postId)
      .then((result) => {
        if (active) {
          setPost(result);
        }
      })
      .catch(() => {
        if (active) {
          setFailed(true);
        }
      });

    return () => {
      active = false;
    };
  }, [postId]);

  if (post) {
    return <ShareCardScene kind="post" post={post} />;
  }

  return <ShareRenderFallback failed={failed} />;
}

export function ShareRenderProfilePage() {
  const { handle = "" } = useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [modules, setModules] = useState<ProfileModule[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [reblogs, setReblogs] = useState<Post[]>([]);
  const [badges, setBadges] = useState<ProfileBadgesResult>({
    badges: [],
    featuredBadges: [],
  });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    Promise.all([
      getProfile(handle),
      getProfileModules(handle),
      getProfilePosts(handle),
      getProfileReblogs(handle),
      getProfileBadges(handle),
    ])
      .then(([
        profileResult,
        moduleResults,
        postResults,
        reblogResults,
        badgeResults,
      ]) => {
        if (!active) {
          return;
        }

        if (!profileResult.viewerCanView) {
          setFailed(true);
          return;
        }

        setProfile(profileResult);
        setModules(moduleResults);
        setPosts(postResults);
        setReblogs(reblogResults);
        setBadges(badgeResults);
      })
      .catch(() => {
        if (active) {
          setFailed(true);
        }
      });

    return () => {
      active = false;
    };
  }, [handle]);

  if (profile) {
    return (
      <ShareCardScene
        badges={badges.badges}
        featuredBadges={badges.featuredBadges}
        kind="profile"
        modules={modules}
        posts={posts}
        profile={profile}
        reblogs={reblogs}
      />
    );
  }

  return <ShareRenderFallback failed={failed} />;
}

function ShareRenderFallback({ failed }: { failed: boolean }) {
  return (
    <main
      className="grid h-[630px] w-[1200px] place-items-center bg-[#071820] text-[#ecfbfb]"
      data-share-card-canvas="true"
      data-share-card-ready="false"
    >
      <div className="rounded-[32px] border border-white/20 bg-white/8 px-10 py-8 text-center">
        <img alt="thia.lol" className="mx-auto h-12 w-12 rounded-[14px]" src="/brand/thia-mark-pink-squircle-96.png" />
        <p className="mt-8 text-3xl font-semibold">
          {failed ? "This share card is unavailable." : "Rendering share card..."}
        </p>
      </div>
    </main>
  );
}
