import {
  Heart,
  MessageCircle,
  Repeat2,
  Share2,
  type LucideIcon,
} from "lucide-react";
import { ProfilePersonalBackdrop } from "../social/ProfilePersonalBackdrop";
import { ProfilePublicCanvasSnapshot } from "../../pages/ProfilePage";
import { cn } from "../../lib/classNames";
import {
  postCanonicalPath,
  shareCardImageProxyUrl,
} from "../../lib/api";
import { postMediaType } from "../../lib/postMedia";
import {
  profileThemeConfigColors,
  profileThemeConfigToCssProperties,
  profileThemePresetById,
} from "../../lib/profileThemes";
import { profileCanvasGlassTreatment } from "../../lib/profileVisualTreatments";
import type {
  Post,
  Profile,
  ProfileModule,
  ProfileThemeConfig,
  RichLinkCard,
  UserBadge,
} from "../../lib/types";

type ShareCardSceneProps =
  | {
      kind: "post";
      post: Post;
    }
  | {
      badges: UserBadge[];
      featuredBadges: UserBadge[];
      kind: "profile";
      modules: ProfileModule[];
      posts: Post[];
      profile: Profile;
      reblogs: Post[];
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

const SHARE_CARD_RENDER_VERSION = "screenshot-v7";
const PROFILE_SHARE_CANVAS_SCALE = 0.75;
const PROFILE_SHARE_CANVAS_WIDTH = 1536;

export function ShareCardScene(props: ShareCardSceneProps) {
  const profileTheme =
    props.kind === "profile" ? props.profile.profileThemeConfig : undefined;
  const palette =
    props.kind === "profile"
      ? paletteFromTheme(profileTheme)
      : paletteFromTheme(
          (props.post as { profile?: Profile }).profile?.profileThemeConfig,
        );
  const profileThemeStyle =
    props.kind === "profile"
      ? profileThemeConfigToCssProperties(profileTheme)
      : undefined;

  return (
    <main
      className="relative isolate h-[630px] w-[1200px] overflow-hidden font-sans"
      data-share-card-canvas="true"
      data-share-card-ready="true"
      data-share-card-render-version={SHARE_CARD_RENDER_VERSION}
      style={{
        ...(profileThemeStyle ?? {}),
        backgroundColor:
          props.kind === "profile" ? "var(--app-canvas)" : palette.canvas,
        color: props.kind === "profile" ? "var(--app-text)" : palette.text,
      }}
    >
      {props.kind === "profile" ? (
        <ProfilePersonalBackdrop profile={props.profile} />
      ) : (
        <ShareCardBackground
          imageUrl={postShareBackgroundImage(props.post)}
          palette={palette}
        />
      )}
      {props.kind === "profile" ? (
        <img
          alt="thia.lol"
          className="absolute left-[42px] top-[18px] z-30 h-[52px] w-auto opacity-95"
          data-share-card-brand="true"
          src="/brand/thia-mark-pink-squircle-96.png"
        />
      ) : null}
      {props.kind === "post" ? (
        <PostShareCard post={props.post} palette={palette} />
      ) : (
        <ProfileShareCard
          badges={props.badges}
          featuredBadges={props.featuredBadges}
          modules={props.modules}
          posts={props.posts}
          profile={props.profile}
          reblogs={props.reblogs}
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
  const previewImage =
    postShareMediaImage(post) ?? linkCard?.metadata.imageUrl ?? null;
  const hasPreview = Boolean(previewImage);
  const contextChips = postShareContextChips(post);

  return (
    <section
      className={cn(
        "absolute inset-0 grid overflow-hidden",
        hasPreview ? "grid-cols-[minmax(0,1fr)_448px]" : "grid-cols-1",
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
              <span className="truncate font-semibold">
                {post.author.displayName}
              </span>
              <span className="truncate" style={{ color: palette.muted }}>
                @{post.author.handle}
              </span>
              {post.createdAt ? (
                <>
                  <span style={{ color: hexToRgba(palette.muted, 0.72) }}>
                    ·
                  </span>
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
                      backgroundColor: hexToRgba(
                        palette.accent,
                        chip === "Recent" ? 0.14 : 0.1,
                      ),
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
        <div
          className="mt-auto flex items-center gap-4 pt-8 text-[24px]"
          style={{ color: palette.muted }}
        >
          <Metric
            accent={palette.accent}
            icon={MessageCircle}
            label="Replies"
            value={post.commentCount}
          />
          <Metric
            active={post.reactions.glow > 0}
            accent={palette.accent}
            icon={Heart}
            label="Likes"
            value={post.reactions.glow}
          />
          <Metric
            active={(post.reblogCount ?? post.reactions.echo) > 0}
            accent={palette.accent}
            icon={Repeat2}
            label="Reposts"
            value={post.reblogCount ?? post.reactions.echo}
          />
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
        <PostPreviewTile
          card={linkCard}
          imageUrl={previewImage}
          palette={palette}
          post={post}
        />
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
  badges,
  featuredBadges,
  modules,
  posts,
  profile,
  reblogs,
}: {
  badges: UserBadge[];
  featuredBadges: UserBadge[];
  modules: ProfileModule[];
  posts: Post[];
  profile: Profile;
  reblogs: Post[];
}) {
  const {
    canvasSurfacePercent,
    moduleSurfacePercent,
    normalizedGlass,
  } = profileCanvasGlassTreatment(profile.profileCanvasGlass);

  return (
    <section
      className="absolute left-[24px] top-[82px] z-10 h-[526px] w-[1152px] overflow-hidden rounded-[22px] border border-line/70 shadow-[0_28px_88px_rgba(0,0,0,0.46)]"
      data-share-card-profile-background-blur={profile.profileBackgroundBlur}
      data-share-card-profile-canvas="true"
      data-share-card-profile-canvas-alpha={canvasSurfacePercent}
      data-share-card-profile-canvas-glass={normalizedGlass}
      data-share-card-profile-module-alpha={moduleSurfacePercent}
      data-share-card-profile-screenshot="true"
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        data-share-card-profile-canvas-scale={PROFILE_SHARE_CANVAS_SCALE}
        style={{
          transform: `scale(${PROFILE_SHARE_CANVAS_SCALE})`,
          width: `${PROFILE_SHARE_CANVAS_WIDTH}px`,
        }}
      >
        <ProfilePublicCanvasSnapshot
          badges={badges}
          featuredBadges={featuredBadges}
          modules={modules}
          posts={posts}
          profile={profile}
          reblogs={reblogs}
        />
      </div>
    </section>
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
      style={{
        backgroundColor: palette.surfaceStrong,
        borderColor: palette.line,
      }}
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
          <p
            className="text-[18px] uppercase tracking-[0.24em]"
            style={{ color: palette.accent }}
          >
            thia.lol
          </p>
          <p className="mt-4 text-[28px] leading-tight">
            Post by @{post.author.handle}
          </p>
        </div>
      )}
      {card ? (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/82 via-black/48 to-transparent p-6 pt-24">
          <p
            className="text-[16px] uppercase tracking-[0.2em]"
            style={{ color: palette.accent }}
          >
            {providerLabel(card.provider)}
          </p>
          <p className="mt-2 line-clamp-2 text-[24px] font-semibold leading-tight">
            {card.metadata.title ??
              card.metadata.subtitle ??
              card.sourceUrl}
          </p>
        </div>
      ) : null}
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
      className="inline-flex min-h-[62px] items-center gap-3 rounded-full border px-7 py-3"
      data-share-card-post-metric={label}
      style={{
        backgroundColor: active
          ? hexToRgba(accent, 0.24)
          : "rgba(0,0,0,0.2)",
        borderColor: active
          ? hexToRgba(accent, 0.28)
          : "rgba(255,255,255,0.08)",
      }}
    >
      <Icon size={24} />
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

function postShareBackgroundImage(post: Post) {
  const linkCard = firstLinkCard(post);

  return postShareMediaImage(post) ?? linkCard?.metadata.imageUrl ?? null;
}

function postShareMediaImage(post: Post): string | null {
  if (post.mediaUrl) {
    return postMediaType(post) === "video"
      ? post.mediaPosterUrl ?? null
      : post.mediaUrl;
  }

  const gif = post.attachments?.find(
    (attachment) => attachment.kind === "gif" && attachment.url,
  );

  return gif?.url ?? null;
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
  return (
    createdAt === "now" || /(?:minute|minutes|hour|hours) ago/iu.test(createdAt)
  );
}

function postTimeLabel(createdAt: string) {
  if (createdAt === "now" || /ago$/iu.test(createdAt.trim())) {
    return createdAt;
  }

  const normalized = createdAt.includes("T")
    ? createdAt
    : createdAt.replace(" ", "T");
  const time = Date.parse(normalized);

  if (!Number.isFinite(time)) {
    return createdAt;
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
  }).format(new Date(time));
}

function paletteFromTheme(config?: ProfileThemeConfig | null): SharePalette {
  const colors =
    profileThemeConfigColors(
      config ?? { mode: "preset", preset: "elphaba" },
    ) ?? profileThemePresetById("elphaba").colors;

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

function hexToRgba(color: string, alpha: number) {
  return colorToRgba(color, alpha);
}

function colorToRgba(color: string, alpha: number) {
  const match = color.match(
    /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i,
  );

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
  return normalized
    ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
    : "Module";
}
