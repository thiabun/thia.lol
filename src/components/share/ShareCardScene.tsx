import {
  ExternalLink,
  Heart,
  Image as ImageIcon,
  Link2,
  MessageCircle,
  Music2,
  Play,
  Repeat2,
  Star,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
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

const SHARE_CARD_RENDER_VERSION = "mosaic-v2";

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
      : postShareBackgroundImage(props.post);

  return (
    <main
      className="relative h-[630px] w-[1200px] overflow-hidden font-sans"
      data-share-card-canvas="true"
      data-share-card-ready="true"
      data-share-card-render-version={SHARE_CARD_RENDER_VERSION}
      style={{ backgroundColor: palette.canvas, color: palette.text }}
    >
      <ShareCardBackground imageUrl={backgroundUrl} palette={palette} />
      <img
        alt="thia.lol"
        className="absolute left-[68px] top-[34px] h-[56px] w-auto"
        data-share-card-brand="true"
        src="/brand/thia-lockup-frostveil.png"
      />
      {props.kind === "post" ? (
        <PostShareCard post={props.post} palette={palette} />
      ) : (
        <ProfileShareCard
          modules={props.modules}
          palette={palette}
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
          avatarHook="post-author"
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
  profile,
}: {
  modules: ProfileModule[];
  palette: SharePalette;
  profile: Profile;
}) {
  const visibleModules = modules
    .filter(isProfileShareModuleEligible)
    .sort(profileShareModuleSort)
    .slice(0, 4);

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
      <div className="relative z-10 grid min-h-0 grid-cols-2 grid-rows-[1fr_1fr_118px] gap-4">
        {visibleModules.length > 0 ? (
          visibleModules.map((module, index) => (
            <ModulePreview
              className={cn(index === 0 ? "row-span-2" : "", index === 3 ? "col-span-2" : "")}
              key={module.id}
              module={module}
              palette={palette}
            />
          ))
        ) : (
          <EmptyModuleMosaic className="col-span-2 row-span-3" palette={palette} />
        )}
      </div>
    </section>
  );
}

function IdentityRow({
  avatarUrl,
  avatarHook,
  displayName,
  handle,
  palette,
  size = "md",
}: {
  avatarUrl?: string | null | undefined;
  avatarHook?: "post-author" | undefined;
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
            data-share-card-post-author-avatar={avatarHook === "post-author" ? "true" : undefined}
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

function EmptyModuleMosaic({
  className,
  palette,
}: {
  className?: string | undefined;
  palette: SharePalette;
}) {
  return (
    <div
      className={cn("relative grid min-h-0 place-items-center overflow-hidden rounded-[24px] border p-8 text-center", className)}
      data-share-card-module-type="empty"
      style={{ backgroundColor: palette.surfaceStrong, borderColor: palette.line }}
    >
      <div
        className="absolute inset-0 opacity-70"
        style={{
          background: `radial-gradient(circle at 50% 18%, ${hexToRgba(palette.accent, 0.18)}, transparent 42%)`,
        }}
      />
      <div className="relative">
        <Star className="mx-auto" size={44} style={{ color: palette.accent }} />
        <p className="mt-5 text-[30px] font-semibold leading-tight">Profile highlights</p>
        <p className="mt-3 text-[18px] leading-snug" style={{ color: palette.muted }}>
          More public modules will appear here.
        </p>
      </div>
    </div>
  );
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
      <RichText
        className="line-clamp-7 text-[21px] leading-snug"
        entities={module.textEntities?.body}
        markdown
        showPreviews={false}
        text={module.config.body ?? module.title ?? ""}
      />
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

function postShareBackgroundImage(post: Post) {
  const linkCard = firstLinkCard(post);

  return post.mediaUrl ?? linkCard?.metadata.imageUrl ?? null;
}

function isProfileShareModuleEligible(module: ProfileModule) {
  return (
    module.status === "active" &&
    module.visibility === "public" &&
    module.type !== "activity" &&
    module.type !== "profile_info" &&
    module.type !== "placeholder"
  );
}

function profileShareModuleSort(first: ProfileModule, second: ProfileModule) {
  const rankDelta = profileShareModuleRank(first) - profileShareModuleRank(second);

  if (rankDelta !== 0) {
    return rankDelta;
  }

  return first.position - second.position;
}

function profileShareModuleRank(module: ProfileModule) {
  const kind = modulePreviewKind(module);

  if (kind === "image" && moduleImage(module)) return 0;
  if (kind === "music" && moduleImage(module)) return 1;
  if (kind === "artist" && moduleImage(module)) return 2;
  if (kind === "video" && moduleImage(module)) return 3;
  if (kind === "connections" && moduleLinks(module).length > 0) return 4;
  if (kind === "card" && module.config.integration) return 5;
  if (kind === "text") return 6;
  return 8;
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
