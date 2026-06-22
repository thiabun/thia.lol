import { Heart, MessageCircle, Play, Repeat2, Star, Users, type LucideIcon } from "lucide-react";
import { RichText } from "../social/RichText";
import { cn } from "../../lib/classNames";
import {
  postCanonicalPath,
  shareCardImageProxyUrl,
} from "../../lib/api";
import type {
  Post,
  Profile,
  ProfileModule,
  ProfileThemeColors,
  ProfileThemeConfig,
  RichLinkCard,
} from "../../lib/types";

type ShareCardSceneProps =
  | {
      kind: "post";
      post: Post;
    }
  | {
      kind: "profile";
      modules: ProfileModule[];
      posts: Post[];
      profile: Profile;
    };

type SharePalette = {
  accent: string;
  canvas: string;
  line: string;
  muted: string;
  surface: string;
  surfaceStrong: string;
  text: string;
};

const fallbackPalette: SharePalette = {
  canvas: "#071820",
  surface: "rgba(17, 49, 58, 0.78)",
  surfaceStrong: "rgba(7, 24, 32, 0.82)",
  text: "#ecfbfb",
  muted: "#a9c8cf",
  line: "rgba(105, 202, 213, 0.42)",
  accent: "#61e2d4",
};

export function ShareCardScene(props: ShareCardSceneProps) {
  const palette =
    props.kind === "profile"
      ? paletteFromTheme(props.profile.profileThemeConfig)
      : paletteFromTheme((props.post as { profile?: Profile }).profile?.profileThemeConfig);
  const backgroundUrl =
    props.kind === "profile"
      ? props.profile.profileBackground ??
        props.profile.profileBackgroundVideoPoster ??
        props.profile.bannerUrl ??
        props.profile.user.avatarUrl
      : props.post.mediaUrl ?? props.post.author.avatarUrl;

  return (
    <main
      className="relative h-[630px] w-[1200px] overflow-hidden font-sans"
      data-share-card-canvas="true"
      data-share-card-ready="true"
      style={{ backgroundColor: palette.canvas, color: palette.text }}
    >
      <ShareCardBackground imageUrl={backgroundUrl} palette={palette} />
      <img
        alt="thia.lol"
        className="absolute left-[68px] top-[38px] h-[34px] w-auto"
        src="/brand/thia-lockup-frostveil.png"
      />
      {props.kind === "post" ? (
        <PostShareCard post={props.post} palette={palette} />
      ) : (
        <ProfileShareCard
          modules={props.modules}
          palette={palette}
          posts={props.posts}
          profile={props.profile}
        />
      )}
    </main>
  );
}

function ShareCardBackground({
  imageUrl,
  palette,
}: {
  imageUrl?: string | null | undefined;
  palette: SharePalette;
}) {
  return (
    <>
      {imageUrl ? (
        <img
          alt=""
          className="absolute inset-0 size-full scale-110 object-cover opacity-30 blur-3xl"
          src={shareCardImageProxyUrl(imageUrl)}
        />
      ) : null}
      <div
        className="absolute inset-0"
        style={{
          background:
            `radial-gradient(circle at 20% 10%, ${hexToRgba(palette.accent, 0.22)}, transparent 34%), ` +
            `radial-gradient(circle at 82% 76%, ${hexToRgba(palette.accent, 0.18)}, transparent 38%), ` +
            `linear-gradient(145deg, ${hexToRgba(palette.canvas, 0.92)}, ${hexToRgba(palette.canvas, 0.72)})`,
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/35 to-transparent" />
    </>
  );
}

function PostShareCard({ palette, post }: { palette: SharePalette; post: Post }) {
  const linkCard = firstLinkCard(post);
  const previewImage = post.mediaUrl ?? linkCard?.metadata.imageUrl ?? null;

  return (
    <section
      className="absolute left-[44px] top-[96px] grid h-[490px] w-[1112px] grid-cols-[1fr_376px] gap-8 overflow-hidden rounded-[34px] border p-12 shadow-[0_32px_90px_rgba(0,0,0,0.42)]"
      style={{
        background: `linear-gradient(135deg, ${palette.surface}, ${hexToRgba(palette.canvas, 0.72)})`,
        borderColor: palette.line,
      }}
    >
      <div className="flex min-w-0 flex-col">
        <IdentityRow
          avatarUrl={post.author.avatarUrl}
          displayName={post.author.displayName}
          handle={post.author.handle}
          palette={palette}
        />
        <RichText
          className="mt-9 line-clamp-5 whitespace-pre-wrap break-words text-[38px] leading-[1.14] tracking-normal"
          entities={post.bodyEntities}
          showPreviews={false}
          text={post.body}
        />
        <div className="mt-auto flex items-center gap-3 text-[20px]" style={{ color: palette.muted }}>
          <Metric icon={MessageCircle} label="Replies" value={post.commentCount} />
          <Metric icon={Heart} label="Likes" value={post.reactions.glow} />
          <Metric icon={Repeat2} label="Reposts" value={post.reactions.echo} />
        </div>
        <p className="mt-8 text-[24px]" style={{ color: palette.muted }}>
          {postCanonicalPath(post)}
        </p>
      </div>
      <PostPreviewTile card={linkCard} imageUrl={previewImage} palette={palette} post={post} />
    </section>
  );
}

function ProfileShareCard({
  modules,
  palette,
  posts,
  profile,
}: {
  modules: ProfileModule[];
  palette: SharePalette;
  posts: Post[];
  profile: Profile;
}) {
  const visibleModules = modules
    .filter((module) => module.status === "active" && module.visibility === "public" && module.type !== "profile_info" && module.type !== "placeholder")
    .slice(0, 5);

  return (
    <section
      className="absolute left-[44px] top-[96px] grid h-[490px] w-[1112px] grid-cols-[590px_1fr] gap-8 overflow-hidden rounded-[34px] border p-12 shadow-[0_32px_90px_rgba(0,0,0,0.42)]"
      style={{
        background: `linear-gradient(135deg, ${palette.surface}, ${hexToRgba(palette.canvas, 0.74)})`,
        borderColor: palette.line,
      }}
    >
      {profile.profileBackground || profile.bannerUrl ? (
        <img
          alt=""
          className="absolute inset-0 size-full object-cover opacity-[0.16]"
          src={shareCardImageProxyUrl(profile.profileBackground ?? profile.bannerUrl)}
        />
      ) : null}
      <div className="relative z-10 flex min-w-0 flex-col">
        <IdentityRow
          avatarUrl={profile.user.avatarUrl}
          displayName={profile.user.displayName}
          handle={profile.user.handle}
          palette={palette}
          size="lg"
        />
        {profile.bio ? (
          <p className="mt-8 line-clamp-4 whitespace-pre-wrap break-words text-[34px] leading-[1.15]">
            {profile.bio}
          </p>
        ) : null}
        <div className="mt-auto grid grid-cols-4 gap-4">
          <ProfileMetric label="Followers" value={profile.followerCount} />
          <ProfileMetric label="Following" value={profile.followingCount} />
          <ProfileMetric label="Likes" value={profile.stats.echoes} />
          <ProfileMetric label="Stars" value={profile.starCount} />
        </div>
        <p className="mt-8 text-[24px]" style={{ color: palette.muted }}>
          /@{profile.user.handle}
        </p>
      </div>
      <div className="relative z-10 grid min-h-0 grid-cols-2 grid-rows-[1fr_1fr_78px] gap-4">
        {visibleModules.length > 0 ? (
          visibleModules.map((module, index) => (
            <ModulePreview
              className={cn(index === 0 ? "row-span-2" : "", index === 3 ? "col-span-2" : "")}
              key={module.id}
              module={module}
              palette={palette}
              posts={posts}
            />
          ))
        ) : (
          <ModulePreview
            className="col-span-2 row-span-3"
            module={{
              id: 0,
              type: "activity",
              title: "Feed",
              config: {},
              visibility: "public",
              position: 0,
              pinned: false,
              status: "active",
              schemaVersion: 1,
            }}
            palette={palette}
            posts={posts}
          />
        )}
      </div>
    </section>
  );
}

function IdentityRow({
  avatarUrl,
  displayName,
  handle,
  palette,
  size = "md",
}: {
  avatarUrl?: string | null | undefined;
  displayName: string;
  handle: string;
  palette: SharePalette;
  size?: "md" | "lg";
}) {
  const avatarSize = size === "lg" ? "h-[88px] w-[88px]" : "h-[72px] w-[72px]";
  const titleSize = size === "lg" ? "text-[58px]" : "text-[48px]";
  const handleSize = size === "lg" ? "text-[32px]" : "text-[28px]";

  return (
    <div className="flex min-w-0 items-center gap-5">
      <div
        className={cn("shrink-0 overflow-hidden rounded-[22px] border bg-black/25", avatarSize)}
        style={{ borderColor: palette.line }}
      >
        {avatarUrl ? (
          <img
            alt=""
            className="size-full object-cover"
            src={shareCardImageProxyUrl(avatarUrl)}
          />
        ) : null}
      </div>
      <div className="min-w-0">
        <h1 className={cn("truncate font-semibold leading-none tracking-normal", titleSize)}>
          {displayName}
        </h1>
        <p className={cn("mt-3 truncate leading-none", handleSize)} style={{ color: palette.muted }}>
          @{handle}
        </p>
      </div>
    </div>
  );
}

function PostPreviewTile({
  card,
  imageUrl,
  palette,
  post,
}: {
  card?: RichLinkCard | null;
  imageUrl?: string | null;
  palette: SharePalette;
  post: Post;
}) {
  return (
    <div
      className="relative min-h-0 overflow-hidden rounded-[28px] border"
      style={{ backgroundColor: palette.surfaceStrong, borderColor: palette.line }}
    >
      {imageUrl ? (
        <img
          alt=""
          className="size-full object-cover"
          src={shareCardImageProxyUrl(imageUrl)}
        />
      ) : (
        <div className="flex size-full flex-col justify-end p-7">
          <p className="text-[18px] uppercase tracking-[0.24em]" style={{ color: palette.accent }}>
            thia.lol
          </p>
          <p className="mt-4 text-[28px] leading-tight">Post by @{post.author.handle}</p>
        </div>
      )}
      {card ? (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/82 via-black/48 to-transparent p-6 pt-24">
          <p className="text-[16px] uppercase tracking-[0.2em]" style={{ color: palette.accent }}>
            {providerLabel(card.provider)}
          </p>
          <p className="mt-2 line-clamp-2 text-[24px] font-semibold leading-tight">
            {card.metadata.title ?? card.metadata.subtitle ?? card.sourceUrl}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ModulePreview({
  className,
  module,
  palette,
  posts,
}: {
  className?: string;
  module: ProfileModule;
  palette: SharePalette;
  posts: Post[];
}) {
  const imageUrl = moduleImage(module);
  const title = moduleTitle(module);
  const subtitle = moduleSubtitle(module);
  const isFeed = module.type === "activity";
  const isText = ["custom_text", "text", "about"].includes(module.type);

  return (
    <div
      className={cn("relative min-h-0 overflow-hidden rounded-[24px] border p-5", className)}
      style={{ backgroundColor: palette.surfaceStrong, borderColor: palette.line }}
    >
      {imageUrl ? (
        <img
          alt=""
          className="absolute inset-0 size-full object-cover"
          src={shareCardImageProxyUrl(imageUrl)}
        />
      ) : null}
      {imageUrl ? <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/28 to-transparent" /> : null}
      <div className="relative z-10 flex h-full flex-col">
        {isFeed ? (
          <FeedPreview palette={palette} posts={posts} />
        ) : isText ? (
          <TextPreview module={module} palette={palette} />
        ) : (
          <>
            <div className="mb-auto">
              <p className="text-[13px] uppercase tracking-[0.22em]" style={{ color: palette.accent }}>
                {providerLabel(module.config.platform ?? module.type)}
              </p>
              <p className="mt-2 line-clamp-2 text-[25px] font-semibold leading-tight">
                {title}
              </p>
              {subtitle ? (
                <p className="mt-1 line-clamp-1 text-[17px]" style={{ color: palette.muted }}>
                  {subtitle}
                </p>
              ) : null}
            </div>
            {moduleKind(module) === "music" || moduleKind(module) === "video" ? (
              <div className="mt-auto flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full" style={{ backgroundColor: palette.accent, color: palette.canvas }}>
                  <Play size={22} fill="currentColor" />
                </span>
                <span className="text-[15px] uppercase tracking-[0.18em]" style={{ color: palette.muted }}>
                  Preview
                </span>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function FeedPreview({ palette, posts }: { palette: SharePalette; posts: Post[] }) {
  return (
    <div>
      <p className="text-[30px] font-semibold">Feed</p>
      <div className="mt-5 space-y-3">
        {posts.slice(0, 3).map((post) => (
          <div className="flex items-start gap-3" key={post.id}>
            <span className="mt-2 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: palette.accent }} />
            <p className="line-clamp-1 text-[18px]" style={{ color: palette.muted }}>
              {post.body || postCanonicalPath(post)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TextPreview({ module, palette }: { module: ProfileModule; palette: SharePalette }) {
  return (
    <div className="overflow-hidden">
      <p className="text-[13px] uppercase tracking-[0.22em]" style={{ color: palette.accent }}>
        Text
      </p>
      <RichText
        className="mt-3 line-clamp-5 text-[20px] leading-snug"
        entities={module.textEntities?.body}
        markdown
        showPreviews={false}
        text={module.config.body ?? module.title ?? ""}
      />
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-black/18 px-4 py-2">
      <Icon size={19} />
      <span>{value}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

function ProfileMetric({ label, value }: { label: string; value: number }) {
  const Icon = label === "Stars" ? Star : Users;

  return (
    <div className="min-w-0">
      <p className="flex items-center gap-2 text-[30px] font-semibold leading-none">
        <Icon size={24} />
        {value}
      </p>
      <p className="mt-2 truncate text-[17px] text-white/64">{label}</p>
    </div>
  );
}

function firstLinkCard(post: Post): RichLinkCard | null {
  const linkEntity = post.bodyEntities?.find(
    (entity) => entity.type === "link" && entity.link.card,
  );

  return linkEntity?.type === "link" ? linkEntity.link.card ?? null : null;
}

function moduleTitle(module: ProfileModule) {
  const metadata = module.config.integration?.metadata;
  return (
    metadata?.title ??
    module.config.audio?.title ??
    module.config.video?.title ??
    module.config.label ??
    module.config.link?.label ??
    module.title ??
    providerLabel(module.type)
  );
}

function moduleSubtitle(module: ProfileModule) {
  const metadata = module.config.integration?.metadata;
  return (
    metadata?.subtitle ??
    metadata?.recentLabel ??
    module.config.description ??
    module.config.statusText ??
    providerLabel(module.config.platform ?? "")
  );
}

function moduleImage(module: ProfileModule) {
  return (
    module.config.mediaItems?.[0]?.url ??
    (module.config.video as { posterUrl?: string } | undefined)?.posterUrl ??
    module.config.integration?.metadata.imageUrl ??
    undefined
  );
}

function moduleKind(module: ProfileModule) {
  if (["music", "spotify_song", "apple_music_song", "youtube_music_song", "spotify_playlist", "apple_music_playlist", "youtube_music_playlist", "spotify_artist", "apple_music_artist", "youtube_music_artist"].includes(module.type)) {
    return "music";
  }

  if (["uploaded_video", "youtube_video", "youtube_stream"].includes(module.type)) {
    return "video";
  }

  return "card";
}

function paletteFromTheme(config?: ProfileThemeConfig | null): SharePalette {
  if (config?.mode === "custom") {
    const colors = config.colors as ProfileThemeColors;
    return {
      canvas: colors.canvas,
      surface: hexToRgba(colors.surface, 0.78),
      surfaceStrong: hexToRgba(colors.surfaceStrong, 0.82),
      text: colors.text,
      muted: colors.muted,
      line: hexToRgba(colors.lineStrong, 0.42),
      accent: colors.accent,
    };
  }

  if (config?.mode === "preset" && config.preset === "sunveil") {
    return {
      canvas: "#fff6d8",
      surface: "rgba(255,253,242,0.82)",
      surfaceStrong: "rgba(255,248,220,0.86)",
      text: "#3f3324",
      muted: "#77694e",
      line: "rgba(205,187,131,0.58)",
      accent: "#d99c25",
    };
  }

  if (config?.mode === "preset" && config.preset === "leafveil") {
    return {
      canvas: "#10231d",
      surface: "rgba(24,54,43,0.82)",
      surfaceStrong: "rgba(8,32,25,0.84)",
      text: "#e4fff2",
      muted: "#9bcdb7",
      line: "rgba(75,150,121,0.58)",
      accent: "#63d99c",
    };
  }

  return fallbackPalette;
}

function hexToRgba(hex: string, alpha: number) {
  const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);

  if (!match) {
    return `rgba(13,31,41,${alpha})`;
  }

  const r = match[1] ?? "0d";
  const g = match[2] ?? "1f";
  const b = match[3] ?? "29";
  return `rgba(${parseInt(r, 16)},${parseInt(g, 16)},${parseInt(b, 16)},${alpha})`;
}

function providerLabel(value: string) {
  const normalized = value.replace(/_/g, " ").replace(/-/g, " ");
  if (normalized.includes("spotify")) return "Spotify";
  if (normalized.includes("youtube")) return "YouTube";
  if (normalized.includes("apple")) return "Apple Music";
  if (normalized.includes("twitch")) return "Twitch";
  if (normalized.includes("github")) return "GitHub";
  if (normalized.includes("music")) return "Music";
  if (normalized.includes("video")) return "Video";
  if (normalized.includes("activity")) return "Feed";
  return normalized.trim() || "Module";
}
