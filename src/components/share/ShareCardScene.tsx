import {
  ExternalLink,
  Heart,
  Image as ImageIcon,
  Link2,
  MessageCircle,
  Music2,
  Play,
  Repeat2,
  Share2,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";
import {
  ProfileConnectionIcon,
  type ProfileConnectionIconPlatform,
} from "../social/ProfileConnectionIcon";
import { cn } from "../../lib/classNames";
import {
  postCanonicalPath,
  shareCardImageProxyUrl,
} from "../../lib/api";
import { postMediaType } from "../../lib/postMedia";
import type {
  Post,
  Profile,
  ProfileModule,
  ProfileModuleLink,
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

type ShareBackgroundMedia = {
  imageUrl?: string | null | undefined;
  posterUrl?: string | null | undefined;
  videoUrl?: string | null | undefined;
};

const fallbackPalette: SharePalette = {
  canvas: "#092119",
  surface: "rgba(19, 55, 42, 0.78)",
  surfaceStrong: "rgba(9, 33, 25, 0.82)",
  text: "#eafbf1",
  muted: "#a3ceb6",
  line: "rgba(73, 147, 110, 0.42)",
  accent: "#55d989",
};

const SHARE_CARD_RENDER_VERSION = "screenshot-v4";

export function ShareCardScene(props: ShareCardSceneProps) {
  const palette =
    props.kind === "profile"
      ? paletteFromTheme(props.profile.profileThemeConfig)
      : paletteFromTheme((props.post as { profile?: Profile }).profile?.profileThemeConfig);
  const backgroundMedia =
    props.kind === "profile"
      ? profileShareBackgroundMedia(props.profile)
      : { imageUrl: postShareBackgroundImage(props.post) };

  return (
    <main
      className="relative h-[630px] w-[1200px] overflow-hidden font-sans"
      data-share-card-canvas="true"
      data-share-card-ready="true"
      data-share-card-render-version={SHARE_CARD_RENDER_VERSION}
      style={{ backgroundColor: palette.canvas, color: palette.text }}
    >
      <ShareCardBackground
        imageUrl={backgroundMedia.imageUrl}
        immersive={props.kind === "profile"}
        palette={palette}
        posterUrl={backgroundMedia.posterUrl}
        videoUrl={backgroundMedia.videoUrl}
      />
      {props.kind === "profile" ? (
        <img
          alt="thia.lol"
          className="absolute left-[42px] top-[18px] h-[52px] w-auto opacity-95"
          data-share-card-brand="true"
          src="/brand/thia-mark-pink-squircle-96.png"
        />
      ) : null}
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
  immersive = false,
  palette,
  posterUrl,
  videoUrl,
}: {
  imageUrl?: string | null | undefined;
  immersive?: boolean;
  palette: SharePalette;
  posterUrl?: string | null | undefined;
  videoUrl?: string | null | undefined;
}) {
  return (
    <>
      {imageUrl ? (
        <img
          alt=""
          className={cn(
            "absolute inset-0 size-full object-cover",
            immersive ? "opacity-[0.38] saturate-[1.05]" : "scale-110 opacity-30 blur-3xl",
          )}
          src={shareCardImageProxyUrl(imageUrl)}
        />
      ) : null}
      {videoUrl ? (
        <video
          aria-hidden="true"
          autoPlay
          className={cn(
            "absolute inset-0 size-full object-cover",
            immersive ? "opacity-[0.48] saturate-[1.05]" : "scale-110 opacity-30 blur-3xl",
          )}
          data-share-card-background-video="true"
          loop
          muted
          playsInline
          poster={posterUrl ? shareCardImageProxyUrl(posterUrl) : undefined}
          preload="auto"
        >
          <source src={videoUrl} type={videoUrl.endsWith(".webm") ? "video/webm" : "video/mp4"} />
        </video>
      ) : null}
      <div
        className="absolute inset-0"
        style={{
          background:
            `radial-gradient(circle at 20% 10%, ${hexToRgba(palette.accent, immersive ? 0.12 : 0.22)}, transparent 34%), ` +
            `radial-gradient(circle at 82% 76%, ${hexToRgba(palette.accent, immersive ? 0.1 : 0.18)}, transparent 38%), ` +
            `linear-gradient(145deg, ${hexToRgba(palette.canvas, immersive ? 0.58 : 0.92)}, ${hexToRgba(palette.canvas, immersive ? 0.42 : 0.72)})`,
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/35 to-transparent" />
    </>
  );
}

function PostShareCard({ palette, post }: { palette: SharePalette; post: Post }) {
  const linkCard = firstLinkCard(post);
  const previewImage = postShareMediaImage(post) ?? linkCard?.metadata.imageUrl ?? null;
  const hasPreview = Boolean(previewImage);
  const contextChips = postShareContextChips(post);

  return (
    <section
      className={cn(
        "absolute inset-0 grid overflow-hidden",
        hasPreview
          ? "grid-cols-[minmax(0,1fr)_448px]"
          : "grid-cols-1",
      )}
      data-share-card-post-screenshot="true"
      style={{
        background: `linear-gradient(145deg, ${hexToRgba(palette.surfaceStrong, 0.92)}, ${hexToRgba(palette.canvas, 0.84)})`,
        borderColor: palette.line,
      }}
    >
      {previewImage ? (
        <img
          alt=""
          className="absolute inset-0 size-full object-cover opacity-[0.07] blur-2xl"
          src={shareCardImageProxyUrl(previewImage)}
        />
      ) : null}
      <div className="relative z-10 flex min-w-0 flex-col p-8">
        <div className="flex min-w-0 items-center gap-4">
          <div
            className="h-[64px] w-[64px] shrink-0 overflow-hidden rounded-full border bg-black/25"
            style={{ borderColor: palette.line }}
          >
            {post.author.avatarUrl ? (
              <img
                alt=""
                className="size-full object-cover"
                data-share-card-post-author-avatar="true"
                src={shareCardImageProxyUrl(post.author.avatarUrl)}
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-3 text-[26px] leading-none">
              <span className="truncate font-semibold">{post.author.displayName}</span>
              <span className="truncate" style={{ color: palette.muted }}>
                @{post.author.handle}
              </span>
              {post.createdAt ? (
                <>
                  <span style={{ color: hexToRgba(palette.muted, 0.72) }}>·</span>
                  <span className="shrink-0" style={{ color: palette.muted }}>
                    {postTimeLabel(post.createdAt)}
                  </span>
                </>
              ) : null}
            </div>
            {contextChips.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {contextChips.map((chip) => (
                  <span
                    className="rounded-full border px-3 py-1 text-[15px] font-semibold leading-none"
                    key={chip}
                    style={{
                      backgroundColor: hexToRgba(palette.accent, chip === "Recent" ? 0.14 : 0.1),
                      borderColor: hexToRgba(palette.accent, 0.36),
                      color: palette.text,
                    }}
                  >
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <p
          className={cn(
            "mt-9 whitespace-pre-wrap break-words leading-[1.18] tracking-normal",
            hasPreview ? "line-clamp-7 text-[34px]" : "line-clamp-3 text-[38px]",
          )}
        >
          {sharePlainText(post.body)}
        </p>
        <div className="mt-auto flex items-center gap-4 pt-8 text-[24px]" style={{ color: palette.muted }}>
          <Metric accent={palette.accent} icon={MessageCircle} label="Replies" value={post.commentCount} />
          <Metric active={post.reactions.glow > 0} accent={palette.accent} icon={Heart} label="Likes" value={post.reactions.glow} />
          <Metric active={(post.reblogCount ?? post.reactions.echo) > 0} accent={palette.accent} icon={Repeat2} label="Reposts" value={post.reblogCount ?? post.reactions.echo} />
          <span
            className="ml-2 grid h-[54px] w-[54px] place-items-center rounded-full"
            style={{
              backgroundColor: hexToRgba(palette.surfaceStrong, 0.76),
              border: `1px solid ${palette.line}`,
              color: palette.muted,
            }}
          >
            <Share2 size={25} />
          </span>
        </div>
        <p className="mt-7 truncate text-[22px]" style={{ color: palette.muted }}>
          {postCanonicalPath(post)}
        </p>
      </div>
      {hasPreview ? (
        <PostPreviewTile card={linkCard} imageUrl={previewImage} palette={palette} post={post} />
      ) : null}
      <img
        alt="thia.lol"
        className="absolute bottom-[24px] right-[26px] z-20 h-[52px] w-auto opacity-72"
        data-share-card-brand="true"
        src="/brand/thia-mark-pink-squircle-96.png"
      />
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
  const visibleModules = profileShareCanvasModules(modules);
  const backgroundMedia = profileShareBackgroundMedia(profile);

  return (
    <section
      className="absolute left-[24px] top-[82px] h-[526px] w-[1152px] overflow-hidden rounded-[22px] border shadow-[0_28px_88px_rgba(0,0,0,0.46)]"
      data-share-card-profile-background-source={backgroundMedia.videoUrl ? "video" : backgroundMedia.imageUrl ? "image" : "fallback"}
      data-share-card-profile-screenshot="true"
      style={{
        background: `linear-gradient(145deg, ${hexToRgba(palette.surfaceStrong, 0.88)}, ${hexToRgba(palette.canvas, 0.8)})`,
        borderColor: palette.line,
      }}
    >
      <ProfileShareBackground media={backgroundMedia} />
      <div
        className="absolute inset-0"
        style={{
          background:
            `linear-gradient(90deg, ${hexToRgba(palette.canvas, 0.64)}, transparent 42%), ` +
            `linear-gradient(180deg, transparent, ${hexToRgba(palette.canvas, 0.28)})`,
        }}
      />
      <div
        className="relative z-10 grid h-full grid-cols-12 grid-rows-5 gap-3 p-3"
        data-share-card-profile-canvas="true"
        style={{
          backgroundColor: hexToRgba(palette.surface, Math.min(0.54, Math.max(0.22, profile.profileCanvasGlass / 160))),
        }}
      >
        {visibleModules.length > 0 ? (
          visibleModules.map((module) => (
            <ProfileCanvasPreviewModule
              key={module.id}
              module={module}
              palette={palette}
              posts={posts}
              profile={profile}
            />
          ))
        ) : (
          <ProfileInfoCanvasModule className="col-span-7 row-span-4" palette={palette} profile={profile} />
        )}
      </div>
    </section>
  );
}

function ProfileShareBackground({
  media,
}: {
  media: ShareBackgroundMedia;
}) {
  return (
    <>
      {media.imageUrl ? (
        <img
          alt=""
          className="absolute inset-0 size-full object-cover opacity-[0.24]"
          src={shareCardImageProxyUrl(media.imageUrl)}
        />
      ) : null}
      {media.videoUrl ? (
        <video
          aria-hidden="true"
          autoPlay
          className="absolute inset-0 size-full object-cover opacity-[0.46]"
          data-share-card-profile-background-video="true"
          loop
          muted
          playsInline
          poster={media.posterUrl ? shareCardImageProxyUrl(media.posterUrl) : undefined}
          preload="auto"
        >
          <source src={media.videoUrl} type={media.videoUrl.endsWith(".webm") ? "video/webm" : "video/mp4"} />
        </video>
      ) : null}
    </>
  );
}

function ProfileCanvasPreviewModule({
  module,
  palette,
  posts,
  profile,
}: {
  module: ProfileModule;
  palette: SharePalette;
  posts: Post[];
  profile: Profile;
}) {
  const layout = shareCanvasLayoutForModule(module);
  const style: CSSProperties = {
    gridColumn: `${layout.column} / span ${layout.colSpan}`,
    gridRow: `${layout.row} / span ${layout.rowSpan}`,
  };

  if (module.type === "profile_info") {
    return <ProfileInfoCanvasModule palette={palette} profile={profile} style={style} />;
  }

  if (module.type === "activity") {
    return (
      <ActivityCanvasModule
        compact={layout.rowSpan <= 2}
        module={module}
        palette={palette}
        posts={posts}
        style={style}
      />
    );
  }

  if (isConnectionModule(module)) {
    return (
      <ConnectionsShareModule
        compact={layout.colSpan <= 2 || layout.rowSpan <= 3}
        module={module}
        palette={palette}
        style={style}
      />
    );
  }

  if (layout.colSpan <= 3 || layout.rowSpan <= 2) {
    return <CompactModulePreview module={module} palette={palette} style={style} />;
  }

  return (
    <div style={style}>
      <ModulePreview className="size-full rounded-[14px]" module={module} palette={palette} />
    </div>
  );
}

function ProfileInfoCanvasModule({
  className,
  palette,
  profile,
  style,
}: {
  className?: string | undefined;
  palette: SharePalette;
  profile: Profile;
  style?: CSSProperties | undefined;
}) {
  const bannerUrl = profile.bannerUrl ?? profile.profileBackground ?? profile.profileBackgroundVideoPoster;

  return (
    <div
      className={cn("relative min-h-0 overflow-hidden rounded-[14px] border", className)}
      data-share-card-module-type="profile_info"
      style={{
        ...style,
        backgroundColor: palette.surfaceStrong,
        borderColor: palette.line,
      }}
    >
      {bannerUrl ? (
        <img
          alt=""
          className="absolute inset-x-0 top-0 h-[34%] w-full object-cover opacity-80"
          src={shareCardImageProxyUrl(bannerUrl)}
        />
      ) : null}
      <div
        className="absolute inset-0"
        style={{
          background:
            `linear-gradient(180deg, transparent, ${colorToRgba(palette.surfaceStrong, 0.78)} 42%), ` +
            `linear-gradient(90deg, ${colorToRgba(palette.canvas, 0.42)}, transparent)`,
        }}
      />
      <div className="relative flex h-full min-w-0 flex-col p-5">
        <div className="mt-[9%] flex min-w-0 items-end gap-3">
          <div
            className="h-[60px] w-[60px] shrink-0 overflow-hidden rounded-[16px] border bg-black/25 shadow-[0_12px_28px_rgba(0,0,0,0.34)]"
            style={{ borderColor: palette.line }}
          >
            {profile.user.avatarUrl ? (
              <img
                alt=""
                className="size-full object-cover"
                src={shareCardImageProxyUrl(profile.user.avatarUrl)}
              />
            ) : null}
          </div>
          <div className="min-w-0 pb-1">
            <p className="truncate text-[25px] font-semibold leading-none">{profile.user.displayName}</p>
            <p className="mt-1 truncate text-[16px]" style={{ color: palette.muted }}>
              @{profile.user.handle}
            </p>
          </div>
        </div>
        {profile.bio ? (
          <p className="mt-3 line-clamp-3 whitespace-pre-wrap break-words text-[18px] leading-snug">
            {profile.bio}
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-2 text-[14px] font-medium" style={{ color: palette.muted }}>
          <span><strong className="text-[16px]" style={{ color: palette.text }}>{profile.starCount}</strong> Stars</span>
          <span><strong className="text-[16px]" style={{ color: palette.text }}>{profile.followerCount}</strong> Followers</span>
          <span><strong className="text-[16px]" style={{ color: palette.text }}>{profile.followingCount}</strong> Following</span>
          <span><strong className="text-[16px]" style={{ color: palette.text }}>{profile.stats.echoes}</strong> Likes</span>
        </div>
      </div>
    </div>
  );
}

function ActivityCanvasModule({
  compact,
  module,
  palette,
  posts,
  style,
}: {
  compact: boolean;
  module: ProfileModule;
  palette: SharePalette;
  posts: Post[];
  style: CSSProperties;
}) {
  const post = posts[0] ?? null;
  const mediaUrl = post ? postShareMediaImage(post) : null;

  return (
    <div
      className={cn("relative min-h-0 overflow-hidden rounded-[14px] border", compact ? "p-3" : "p-4")}
      data-share-card-module-type={module.type}
      style={{ ...style, backgroundColor: palette.surfaceStrong, borderColor: palette.line }}
    >
      <div className="flex h-full min-w-0 flex-col">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[15px] font-semibold uppercase tracking-[0.16em]" style={{ color: palette.accent }}>
            Feed
          </span>
          <span className="rounded-full border px-2.5 py-1 text-[13px]" style={{ borderColor: palette.line, color: palette.muted }}>
            {posts.length}
          </span>
        </div>
        {post ? (
          <>
            <div className={cn("flex min-w-0 items-center gap-3", compact ? "mt-3" : "mt-4")}>
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-black/25">
                {post.author.avatarUrl ? (
                  <img
                    alt=""
                    className="size-full object-cover"
                    src={shareCardImageProxyUrl(post.author.avatarUrl)}
                  />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[16px] font-semibold leading-tight">{post.author.displayName}</p>
                <p className="truncate text-[13px]" style={{ color: palette.muted }}>
                  @{post.author.handle} · {postTimeLabel(post.createdAt)}
                </p>
              </div>
            </div>
            <p
              className={cn(
                "whitespace-pre-wrap break-words leading-snug",
                compact ? "mt-3 line-clamp-3 text-[16px]" : "mt-4 line-clamp-4 text-[18px]",
              )}
            >
              {sharePlainText(post.body)}
            </p>
            {mediaUrl && !compact ? (
              <div className="mt-auto min-h-0 flex-1 overflow-hidden rounded-[10px] border" style={{ borderColor: palette.line }}>
                <img
                  alt=""
                  className="size-full object-cover"
                  src={shareCardImageProxyUrl(mediaUrl)}
                />
              </div>
            ) : null}
          </>
        ) : (
          <div className="grid flex-1 place-items-center text-center">
            <p className="text-[22px] font-semibold">Profile feed</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CompactModulePreview({
  module,
  palette,
  style,
}: {
  module: ProfileModule;
  palette: SharePalette;
  style: CSSProperties;
}) {
  const imageUrl = moduleImage(module);
  const links = moduleLinks(module);

  if (isConnectionModule(module)) {
    return <ConnectionsShareModule compact module={module} palette={palette} style={style} />;
  }

  if (imageUrl) {
    return (
      <div
        className="relative min-h-0 overflow-hidden rounded-[14px] border"
        data-share-card-module-type={module.type}
        style={{ ...style, backgroundColor: palette.surfaceStrong, borderColor: palette.line }}
      >
        <img alt="" className="size-full object-cover" src={shareCardImageProxyUrl(imageUrl)} />
        {modulePreviewKind(module) !== "image" ? (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/78 to-transparent p-3 pt-10 text-white">
            <p className="truncate text-[16px] font-semibold leading-tight">{moduleTitle(module)}</p>
            <p className="truncate text-[12px] text-white/72">{compactModuleSubtitle(module)}</p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="relative min-h-0 overflow-hidden rounded-[14px] border p-3"
      data-share-card-module-type={module.type}
      style={{ ...style, backgroundColor: palette.surfaceStrong, borderColor: palette.line }}
    >
      <div className="flex h-full min-w-0 flex-col">
        <p className="truncate text-[16px] font-semibold leading-tight">{moduleTitle(module)}</p>
        <p className="mt-1 truncate text-[12px]" style={{ color: palette.muted }}>
          {moduleSubtitle(module) || providerLabel(module.type)}
        </p>
        {links.length > 0 ? (
          <div className="mt-auto grid gap-1.5 pt-2">
            {links.slice(0, 2).map((link) => (
              <p className="truncate rounded-full bg-black/16 px-2 py-1 text-[12px]" key={`${link.label}:${link.url}`}>
                {link.label} · {linkHost(link.url)}
              </p>
            ))}
          </div>
        ) : (
          <div className="mt-auto flex items-center gap-2 pt-2 text-[13px]" style={{ color: palette.accent }}>
            <ExternalLink size={14} />
            <span className="truncate">{providerLabel(module.type)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ConnectionsShareModule({
  compact = false,
  module,
  palette,
  style,
}: {
  compact?: boolean;
  module: ProfileModule;
  palette: SharePalette;
  style: CSSProperties;
}) {
  const links = moduleLinks(module);

  return (
    <div
      className={cn(
        "grid min-h-0 content-start overflow-hidden rounded-[14px] border",
        compact ? "gap-1.5 p-1.5" : "gap-2 p-2",
      )}
      data-share-card-module-type={module.type}
      style={{ ...style, backgroundColor: palette.surfaceStrong, borderColor: palette.line }}
    >
      {links.length > 0 ? (
        links.slice(0, 5).map((link) => {
          const platform = shareConnectionPlatform(link);

          return (
            <div
              className={cn(
                "flex min-w-0 items-center gap-2 rounded-[10px] border px-2",
                compact ? "min-h-[38px]" : "min-h-[44px]",
              )}
              data-share-card-connection-link="true"
              key={`${link.platform ?? "website"}:${link.url}`}
              style={{
                backgroundColor: colorToRgba(palette.canvas, 0.46),
                borderColor: palette.line,
              }}
            >
              <span
                className={cn(
                  "grid shrink-0 place-items-center rounded-full border",
                  compact ? "h-7 w-7" : "h-8 w-8",
                )}
                style={{
                  backgroundColor: colorToRgba(palette.surface, 0.72),
                  borderColor: palette.line,
                  color: palette.text,
                }}
              >
                <ProfileConnectionIcon platform={platform} size={compact ? 13 : 15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate font-semibold leading-tight", compact ? "text-[13px]" : "text-[15px]")}>
                  {shareConnectionLabel(link)}
                </span>
                <span className={cn("block truncate leading-tight", compact ? "text-[10px]" : "text-[11px]")} style={{ color: palette.muted }}>
                  {shareConnectionSubtitle(link)}
                </span>
              </span>
              <ExternalLink aria-hidden="true" className="shrink-0" size={compact ? 12 : 13} style={{ color: palette.muted }} />
            </div>
          );
        })
      ) : (
        <div className="grid h-full place-items-center text-center text-[16px]" style={{ color: palette.muted }}>
          Links
        </div>
      )}
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
          data-share-card-post-media="true"
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
}: {
  className?: string | undefined;
  module: ProfileModule;
  palette: SharePalette;
}) {
  const kind = modulePreviewKind(module);

  if (kind === "image") {
    return <ImageModulePreview className={className} module={module} palette={palette} />;
  }

  if (kind === "connections") {
    return <ConnectionsModulePreview className={className} module={module} palette={palette} />;
  }

  if (kind === "music") {
    return <MusicModulePreview className={className} module={module} palette={palette} />;
  }

  if (kind === "artist") {
    return <ArtistModulePreview className={className} module={module} palette={palette} />;
  }

  if (kind === "video") {
    return <VideoModulePreview className={className} module={module} palette={palette} />;
  }

  if (kind === "text") {
    return <TextModulePreview className={className} module={module} palette={palette} />;
  }

  return <GenericModulePreview className={className} module={module} palette={palette} />;
}

function ImageModulePreview({
  className,
  module,
  palette,
}: {
  className?: string | undefined;
  module: ProfileModule;
  palette: SharePalette;
}) {
  const imageUrl = moduleImage(module);

  return (
    <div
      className={cn("relative min-h-0 overflow-hidden rounded-[24px] border", className)}
      data-share-card-module-type={module.type}
      style={{ backgroundColor: palette.surfaceStrong, borderColor: palette.line }}
    >
      {imageUrl ? (
        <img
          alt=""
          className="size-full object-cover"
          src={shareCardImageProxyUrl(imageUrl)}
        />
      ) : (
        <div className="grid size-full place-items-center">
          <ImageIcon size={42} style={{ color: palette.muted }} />
        </div>
      )}
    </div>
  );
}

function ConnectionsModulePreview({
  className,
  module,
  palette,
}: {
  className?: string | undefined;
  module: ProfileModule;
  palette: SharePalette;
}) {
  const links = moduleLinks(module).slice(0, 4);

  return (
    <div
      className={cn("relative min-h-0 overflow-hidden rounded-[24px] border p-5", className)}
      data-share-card-module-type={module.type}
      style={{ backgroundColor: palette.surfaceStrong, borderColor: palette.line }}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full" style={{ backgroundColor: hexToRgba(palette.accent, 0.18), color: palette.accent }}>
            <Link2 size={22} />
          </span>
          <p className="truncate text-[24px] font-semibold">Links</p>
        </div>
        <div className="mt-4 grid min-h-0 flex-1 content-start gap-2">
          {links.length > 0 ? (
            links.map((link) => (
              <div
                className="flex min-w-0 items-center gap-3 rounded-[16px] border bg-black/14 px-3 py-2"
                key={`${link.url}:${link.label}`}
                style={{ borderColor: hexToRgba(palette.accent, 0.18) }}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ backgroundColor: hexToRgba(palette.accent, 0.2), color: palette.accent }}>
                  <ExternalLink size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[17px] font-semibold leading-tight">{link.label}</span>
                  <span className="block truncate text-[13px] leading-tight" style={{ color: palette.muted }}>
                    {linkHost(link.url)}
                  </span>
                </span>
              </div>
            ))
          ) : (
            <p className="mt-auto text-[18px]" style={{ color: palette.muted }}>
              No public links.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function MusicModulePreview({
  className,
  module,
  palette,
}: {
  className?: string | undefined;
  module: ProfileModule;
  palette: SharePalette;
}) {
  const imageUrl = moduleImage(module);
  const title = moduleTitle(module);
  const subtitle = moduleSubtitle(module) || providerLabel(module.config.integration?.provider ?? module.config.platform ?? module.type);
  const duration = module.config.audio?.duration;

  return (
    <div
      className={cn("relative min-h-0 overflow-hidden rounded-[24px] border p-5", className)}
      data-share-card-module-type={module.type}
      style={{ backgroundColor: palette.surfaceStrong, borderColor: palette.line }}
    >
      {imageUrl ? (
        <img
          alt=""
          className="absolute inset-0 size-full object-cover opacity-28 blur-2xl"
          src={shareCardImageProxyUrl(imageUrl)}
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-br from-black/12 via-black/20 to-black/42" />
      <div className="relative z-10 flex h-full min-w-0 flex-col">
        <div className="flex min-w-0 items-center gap-4">
          <div
            className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-[18px] border bg-black/25"
            style={{ borderColor: palette.line }}
          >
            {imageUrl ? (
              <img
                alt=""
                className="size-full object-cover"
                src={shareCardImageProxyUrl(imageUrl)}
              />
            ) : (
              <Music2 size={32} style={{ color: palette.muted }} />
            )}
          </div>
          <div className="min-w-0">
            <p className="line-clamp-2 text-[25px] font-semibold leading-tight">{title}</p>
            <p className="mt-1 truncate text-[16px]" style={{ color: palette.muted }}>
              {subtitle}
            </p>
          </div>
        </div>
        <div className="mt-auto flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ backgroundColor: palette.accent, color: palette.canvas }}>
            <Play size={23} fill="currentColor" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="h-2 overflow-hidden rounded-full bg-white/18">
              <div className="h-full w-[38%] rounded-full" style={{ backgroundColor: palette.accent }} />
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-[13px] font-semibold uppercase tracking-[0.16em]" style={{ color: palette.muted }}>
              <span className="truncate">{providerLabel(module.config.integration?.provider ?? module.config.platform ?? module.type)}</span>
              {duration ? <span>{formatDuration(duration)}</span> : <span>Ready</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArtistModulePreview({
  className,
  module,
  palette,
}: {
  className?: string | undefined;
  module: ProfileModule;
  palette: SharePalette;
}) {
  const imageUrl = moduleImage(module);
  const metadata = module.config.integration?.metadata;
  const stats = metadata?.stats ?? {};
  const statValue =
    stats.listeners ?? stats.followers ?? stats.subscribers ?? stats.views ?? stats.popularity ?? null;

  return (
    <div
      className={cn("relative min-h-0 overflow-hidden rounded-[24px] border p-5", className)}
      data-share-card-module-type={module.type}
      style={{ backgroundColor: palette.surfaceStrong, borderColor: palette.line }}
    >
      {imageUrl ? (
        <img
          alt=""
          className="absolute inset-0 size-full object-cover"
          src={shareCardImageProxyUrl(imageUrl)}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <Video size={54} style={{ color: palette.muted }} />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/30 to-transparent" />
      <div className="relative z-10 flex h-full flex-col justify-end text-white">
        <p className="line-clamp-2 text-[28px] font-semibold leading-tight">{moduleTitle(module)}</p>
        <p className="mt-1 truncate text-[16px] text-white/72">
          {moduleSubtitle(module) || providerLabel(module.config.integration?.provider ?? module.type)}
        </p>
        {statValue !== null ? (
          <p className="mt-3 w-fit rounded-full bg-black/30 px-3 py-1 text-[14px] font-semibold text-white/82">
            {String(statValue)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function VideoModulePreview({
  className,
  module,
  palette,
}: {
  className?: string | undefined;
  module: ProfileModule;
  palette: SharePalette;
}) {
  const imageUrl = moduleImage(module);

  return (
    <div
      className={cn("relative min-h-0 overflow-hidden rounded-[24px] border", className)}
      data-share-card-module-type={module.type}
      style={{ backgroundColor: palette.surfaceStrong, borderColor: palette.line }}
    >
      {imageUrl ? (
        <img
          alt=""
          className="absolute inset-0 size-full object-cover"
          src={shareCardImageProxyUrl(imageUrl)}
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-black/26 to-black/8" />
      <div className="relative z-10 flex h-full flex-col p-5 text-white">
        <span className="mb-auto grid h-14 w-14 place-items-center rounded-full bg-white/18 shadow-[0_12px_32px_rgba(0,0,0,0.35)] backdrop-blur">
          <Play size={26} fill="currentColor" />
        </span>
        <p className="line-clamp-2 text-[25px] font-semibold leading-tight">{moduleTitle(module)}</p>
        <p className="mt-1 truncate text-[15px] text-white/72">
          {moduleSubtitle(module) || providerLabel(module.config.platform ?? module.type)}
        </p>
      </div>
    </div>
  );
}

function TextModulePreview({
  className,
  module,
  palette,
}: {
  className?: string | undefined;
  module: ProfileModule;
  palette: SharePalette;
}) {
  return (
    <div
      className={cn("relative min-h-0 overflow-hidden rounded-[24px] border p-5", className)}
      data-share-card-module-type={module.type}
      style={{ backgroundColor: palette.surfaceStrong, borderColor: palette.line }}
    >
      <p className="line-clamp-7 whitespace-pre-wrap break-words text-[21px] leading-snug">
        {sharePlainText(module.config.body ?? module.title ?? "")}
      </p>
    </div>
  );
}

function GenericModulePreview({
  className,
  module,
  palette,
}: {
  className?: string | undefined;
  module: ProfileModule;
  palette: SharePalette;
}) {
  const metadata = module.config.integration?.metadata;
  const subtitle =
    moduleSubtitle(module) ||
    providerLabel(module.config.integration?.provider ?? module.config.platform ?? module.type);
  const description =
    metadata?.description ??
    module.config.description ??
    module.config.statusText ??
    module.config.workingOn ??
    "";
  const stats = Object.entries(metadata?.stats ?? {})
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 2);

  return (
    <div
      className={cn("relative min-h-0 overflow-hidden rounded-[24px] border p-5", className)}
      data-share-card-module-type={module.type}
      style={{ backgroundColor: palette.surfaceStrong, borderColor: palette.line }}
    >
      <div className="flex h-full min-w-0 flex-col">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
            style={{
              backgroundColor: hexToRgba(palette.accent, 0.18),
              color: palette.accent,
            }}
          >
            <ExternalLink size={20} />
          </span>
          <span className="min-w-0">
            <span
              className="block truncate text-[15px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: palette.accent }}
            >
              {subtitle}
            </span>
            <span className="mt-1 block truncate text-[24px] font-semibold leading-tight">
              {moduleTitle(module)}
            </span>
          </span>
        </div>
        {description ? (
          <p className="mt-4 line-clamp-3 text-[17px] leading-snug" style={{ color: palette.muted }}>
            {description}
          </p>
        ) : null}
        {stats.length > 0 ? (
          <div className="mt-auto flex flex-wrap gap-2 pt-4">
            {stats.map(([label, value]) => (
              <span
                className="rounded-full border px-3 py-1 text-[13px] font-semibold"
                key={label}
                style={{ borderColor: hexToRgba(palette.accent, 0.25), color: palette.text }}
              >
                {String(value)} {label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Metric({
  accent,
  active = false,
  icon: Icon,
  label,
  value,
}: {
  accent: string;
  active?: boolean;
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-[14px] border px-5 py-3"
      style={{
        backgroundColor: active ? hexToRgba(accent, 0.22) : "rgba(0,0,0,0.18)",
        borderColor: active ? hexToRgba(accent, 0.2) : "transparent",
      }}
    >
      <Icon size={19} />
      <span>{value}</span>
      <span className="sr-only">{label}</span>
    </span>
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
  const fallback = providerLabel(module.config.platform ?? "");

  return (
    metadata?.subtitle ??
    metadata?.recentLabel ??
    module.config.description ??
    module.config.statusText ??
    (fallback === "Module" ? undefined : fallback)
  );
}

function sharePlainText(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/gu, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, "$1")
    .replace(/^#{1,6}\s+/gmu, "")
    .replace(/^>\s?/gmu, "")
    .replace(/`([^`]+)`/gu, "$1")
    .replace(/~~([^~]+)~~/gu, "$1")
    .replace(/\*\*([^*]+)\*\*/gu, "$1")
    .replace(/__([^_]+)__/gu, "$1")
    .replace(/\*([^*]+)\*/gu, "$1")
    .replace(/_([^_]+)_/gu, "$1")
    .trim();
}

function isConnectionModule(module: ProfileModule) {
  return module.type === "links" || module.type === "connections";
}

const shareConnectionPlatforms = new Set<ProfileConnectionIconPlatform>([
  "apple_music",
  "bluesky",
  "discord",
  "github",
  "instagram",
  "spotify",
  "tiktok",
  "twitch",
  "website",
  "x",
  "youtube",
]);

function shareConnectionPlatform(link: ProfileModuleLink): ProfileConnectionIconPlatform {
  const configured = link.platform?.trim().toLowerCase();

  if (configured && shareConnectionPlatforms.has(configured as ProfileConnectionIconPlatform)) {
    return configured as ProfileConnectionIconPlatform;
  }

  try {
    const host = new URL(link.url).hostname.replace(/^www\./u, "").toLowerCase();

    if (host.includes("youtube.com") || host === "youtu.be") return "youtube";
    if (host.includes("spotify.com")) return "spotify";
    if (host.includes("twitch.tv")) return "twitch";
    if (host.includes("github.com")) return "github";
    if (host.includes("instagram.com")) return "instagram";
    if (host.includes("tiktok.com")) return "tiktok";
    if (host.includes("bsky.app")) return "bluesky";
    if (host.includes("discord.")) return "discord";
    if (host === "x.com" || host === "twitter.com") return "x";
  } catch {
    return "website";
  }

  return "website";
}

function shareConnectionLabel(link: ProfileModuleLink) {
  return link.label.trim() || linkUsername(link.url) || shareConnectionPlatformLabel(shareConnectionPlatform(link));
}

function shareConnectionSubtitle(link: ProfileModuleLink) {
  const host = linkHost(link.url);
  const platformLabel = shareConnectionPlatformLabel(shareConnectionPlatform(link));

  return host ? `${platformLabel} · ${host}` : platformLabel;
}

function shareConnectionPlatformLabel(platform: ProfileConnectionIconPlatform) {
  const labels: Record<ProfileConnectionIconPlatform, string> = {
    apple_music: "Apple Music",
    bluesky: "Bluesky",
    discord: "Discord",
    github: "GitHub",
    instagram: "Instagram",
    spotify: "Spotify",
    tiktok: "TikTok",
    twitch: "Twitch",
    website: "Website",
    x: "X",
    youtube: "YouTube",
  };

  return labels[platform] ?? "Website";
}

function linkUsername(value: string) {
  try {
    const url = new URL(value);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const candidate = pathParts.at(-1)?.replace(/^@/u, "");

    return candidate || url.hostname.replace(/^www\./u, "");
  } catch {
    return value.replace(/^https?:\/\//u, "").replace(/\/.*$/u, "");
  }
}

function compactModuleSubtitle(module: ProfileModule) {
  const provider = providerLabel(module.config.integration?.provider ?? module.config.platform ?? module.type);
  const subtitle = moduleSubtitle(module);

  if (!subtitle || subtitle === provider) {
    return provider;
  }

  return `${provider} · ${subtitle}`;
}

function moduleImage(module: ProfileModule) {
  return (
    module.config.mediaItems?.[0]?.url ??
    (module.config.video as { posterUrl?: string } | undefined)?.posterUrl ??
    module.config.integration?.metadata.imageUrl ??
    undefined
  );
}

function postShareBackgroundImage(post: Post) {
  const linkCard = firstLinkCard(post);

  return postShareMediaImage(post) ?? linkCard?.metadata.imageUrl ?? null;
}

function profileShareBackgroundMedia(profile: Profile): ShareBackgroundMedia {
  const videoUrl = safeShareVideoUrl(profile.profileBackgroundVideo);
  const posterUrl =
    profile.profileBackgroundVideoPoster ??
    profile.profileBackground ??
    profile.bannerUrl ??
    profile.user.avatarUrl;

  if (videoUrl) {
    return {
      imageUrl: posterUrl,
      posterUrl,
      videoUrl,
    };
  }

  return {
    imageUrl: profile.profileBackground ?? profile.bannerUrl ?? profile.user.avatarUrl,
  };
}

function safeShareVideoUrl(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  if (/^\/uploads\/media\/[0-9]{4}\/[0-9]{2}\/[a-z0-9_-]+\.(?:mp4|webm)$/u.test(value)) {
    return value;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? value : undefined;
  } catch {
    return undefined;
  }
}

function postShareMediaImage(post: Post): string | null {
  if (!post.mediaUrl) {
    return null;
  }

  return postMediaType(post) === "video" ? post.mediaPosterUrl ?? null : post.mediaUrl;
}

type ShareCanvasLayout = {
  column: number;
  row: number;
  colSpan: number;
  rowSpan: number;
};

const shareCanvasRows = 5;
const shareCanvasColumns = 12;

function profileShareCanvasModules(modules: ProfileModule[]) {
  const visibleModules = modules
    .filter(isProfileShareModuleEligible)
    .map((module, index) => ({
      module: module.layout
        ? module
        : {
            ...module,
            layout: fallbackShareCanvasLayout(module, index),
          },
    }))
    .filter(({ module }) => {
      const layout = module.layout;

      return layout !== null && layout !== undefined && layout.row <= shareCanvasRows && layout.column <= shareCanvasColumns;
    })
    .sort((first, second) => {
      const firstLayout = shareCanvasLayoutForModule(first.module);
      const secondLayout = shareCanvasLayoutForModule(second.module);

      return (
        firstLayout.row - secondLayout.row ||
        firstLayout.column - secondLayout.column ||
        first.module.position - second.module.position
      );
    })
    .slice(0, 10)
    .map(({ module }) => module);

  return visibleModules;
}

function isProfileShareModuleEligible(module: ProfileModule) {
  return (
    module.status === "active" &&
    module.visibility === "public" &&
    module.type !== "placeholder"
  );
}

function shareCanvasLayoutForModule(module: ProfileModule): ShareCanvasLayout {
  const rawLayout = module.layout ?? fallbackShareCanvasLayout(module, module.position);
  const column = clampInteger(rawLayout.column, 1, shareCanvasColumns);
  const row = clampInteger(rawLayout.row, 1, shareCanvasRows);
  const maxColSpan = shareCanvasColumns - column + 1;
  const maxRowSpan = shareCanvasRows - row + 1;

  return {
    column,
    row,
    colSpan: clampInteger(rawLayout.colSpan, 1, maxColSpan),
    rowSpan: clampInteger(rawLayout.rowSpan, 1, maxRowSpan),
  };
}

function fallbackShareCanvasLayout(module: ProfileModule, index: number): ShareCanvasLayout {
  if (module.type === "profile_info") {
    return { column: 1, row: 1, colSpan: 5, rowSpan: 3 };
  }

  if (module.type === "activity") {
    return { column: 1, row: 4, colSpan: 4, rowSpan: 5 };
  }

  const fallbackLayouts: ShareCanvasLayout[] = [
    { column: 6, row: 1, colSpan: 4, rowSpan: 4 },
    { column: 10, row: 1, colSpan: 3, rowSpan: 2 },
    { column: 10, row: 3, colSpan: 3, rowSpan: 2 },
    { column: 5, row: 5, colSpan: 4, rowSpan: 4 },
    { column: 9, row: 5, colSpan: 4, rowSpan: 4 },
    { column: 5, row: 1, colSpan: 3, rowSpan: 2 },
    { column: 8, row: 1, colSpan: 3, rowSpan: 2 },
  ];

  return fallbackLayouts[Math.abs(index) % fallbackLayouts.length] ?? fallbackLayouts[0]!;
}

function clampInteger(value: unknown, min: number, max: number): number {
  const numericValue = typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : min;

  return Math.min(max, Math.max(min, numericValue));
}

function postShareContextChips(post: Post): string[] {
  const chips: string[] = [];
  const relationship = post.socialContext?.authorRelationship;

  if (relationship === "moot") {
    chips.push("Moot");
  } else if (relationship === "following") {
    chips.push("Following");
  }

  if (isRecentPostLabel(post.createdAt)) {
    chips.push("Recent");
  }

  chips.push(post.room?.name ?? "Profile feed");

  return chips;
}

function isRecentPostLabel(createdAt: string) {
  return createdAt === "now" || /(?:minute|minutes|hour|hours) ago/iu.test(createdAt);
}

function postTimeLabel(createdAt: string) {
  if (createdAt === "now" || /ago$/iu.test(createdAt.trim())) {
    return createdAt;
  }

  const normalized = createdAt.includes("T") ? createdAt : createdAt.replace(" ", "T");
  const time = Date.parse(normalized);

  if (!Number.isFinite(time)) {
    return createdAt;
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
  }).format(new Date(time));
}

type ModulePreviewKind =
  | "artist"
  | "card"
  | "connections"
  | "image"
  | "music"
  | "text"
  | "video";

function modulePreviewKind(module: ProfileModule): ModulePreviewKind {
  if (
    [
      "gallery_media",
      "uploaded_image",
      "gallery_slideshow",
      "gallery_feed",
    ].includes(module.type)
  ) {
    return "image";
  }

  if (module.type === "links" || module.type === "connections") {
    return "connections";
  }

  if (["custom_text", "text", "about"].includes(module.type)) {
    return "text";
  }

  if (
    [
      "spotify_artist",
      "apple_music_artist",
      "youtube_music_artist",
    ].includes(module.type)
  ) {
    return "artist";
  }

  if (
    [
      "music",
      "spotify_song",
      "apple_music_song",
      "youtube_music_song",
      "spotify_playlist",
      "apple_music_playlist",
      "youtube_music_playlist",
    ].includes(module.type)
  ) {
    return "music";
  }

  if (
    [
      "uploaded_video",
      "youtube_video",
      "youtube_stream",
      "youtube_playlist",
      "creator_live",
    ].includes(module.type)
  ) {
    return "video";
  }

  return "card";
}

function moduleLinks(module: ProfileModule) {
  const links = [...(module.config.links ?? [])];

  if (module.config.link) {
    links.unshift(module.config.link);
  }

  return links.filter((link) => link.url && link.label);
}

function linkHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
}

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
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

  if (
    config?.mode === "preset" &&
    (config.preset === "glinda" || config.preset === "sunveil")
  ) {
    return {
      canvas: "#fff7fb",
      surface: "rgba(255,253,254,0.82)",
      surfaceStrong: "rgba(248,230,239,0.86)",
      text: "#39242f",
      muted: "#785667",
      line: "rgba(216,170,189,0.58)",
      accent: "#e94b82",
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

function hexToRgba(color: string, alpha: number) {
  return colorToRgba(color, alpha);
}

function colorToRgba(color: string, alpha: number) {
  const match = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);

  if (!match) {
    const rgbMatch = color.match(/^rgba?\(([^)]+)\)$/iu);

    if (rgbMatch) {
      const [r = "9", g = "33", b = "25"] = rgbMatch[1]!
        .split(",")
        .slice(0, 3)
        .map((part) => part.trim());

      return `rgba(${r},${g},${b},${alpha})`;
    }

    return `rgba(9,33,25,${alpha})`;
  }

  const r = match[1] ?? "0d";
  const g = match[2] ?? "1f";
  const b = match[3] ?? "29";
  return `rgba(${parseInt(r, 16)},${parseInt(g, 16)},${parseInt(b, 16)},${alpha})`;
}

function providerLabel(value: string) {
  const normalized = value.replace(/_/g, " ").replace(/-/g, " ").trim();
  if (normalized.includes("spotify")) return "Spotify";
  if (normalized.includes("youtube")) return "YouTube";
  if (normalized.includes("apple")) return "Apple Music";
  if (normalized.includes("twitch")) return "Twitch";
  if (normalized.includes("github")) return "GitHub";
  if (normalized === "links") return "Links";
  if (normalized === "custom text") return "Note";
  if (normalized.includes("music")) return "Music";
  if (normalized.includes("video")) return "Video";
  if (normalized.includes("activity")) return "Feed";
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "Module";
}
