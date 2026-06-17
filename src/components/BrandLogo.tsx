import { useTheme } from "../lib/useTheme";
import type { ThemeName } from "../lib/types";
import { cn } from "../lib/classNames";

type BrandMarkVariant = "bunny" | "pink" | "t";
type BrandMarkShape = "plain" | "circle" | "squircle";
type BrandSize = "sm" | "md" | "lg";

const markSources: Record<ThemeName, string> = {
  frostveil: "/brand/thia-mark-frostveil-96.png",
  sunveil: "/brand/thia-mark-sunveil-96.png",
};

const circleMarkSources: Record<ThemeName, string> = {
  frostveil: "/brand/thia-mark-frostveil-circle-96.png",
  sunveil: "/brand/thia-mark-sunveil-circle-96.png",
};

const squircleMarkSources: Record<ThemeName, string> = {
  frostveil: "/brand/thia-mark-frostveil-squircle-96.png",
  sunveil: "/brand/thia-mark-sunveil-squircle-96.png",
};

const lockupSources: Record<ThemeName, string> = {
  frostveil: "/brand/thia-lockup-frostveil.png",
  sunveil: "/brand/thia-lockup-sunveil.png",
};

const tMarkSources: Record<ThemeName, string> = {
  frostveil: "/brand/thia-t-frostveil-96.png",
  sunveil: "/brand/thia-t-sunveil-96.png",
};

const markSizeClasses: Record<BrandSize, string> = {
  sm: "size-6",
  md: "size-8",
  lg: "size-12",
};

const markSizePixels: Record<BrandSize, number> = {
  sm: 24,
  md: 32,
  lg: 48,
};

const logoMainSizeClasses: Record<BrandSize, string> = {
  sm: "size-12",
  md: "size-16",
  lg: "size-20",
};

const logoMainSizePixels: Record<BrandSize, number> = {
  sm: 48,
  md: 64,
  lg: 80,
};

export function BrandLogo() {
  return (
    <span
      className="inline-flex min-w-0 items-center gap-2"
      data-testid="brand-logo"
    >
      <BrandMark className="rounded-full" />
      <span className="min-w-0 truncate text-base font-semibold leading-none tracking-normal text-text">
        <span>thia</span>
        <span className="text-rose">.lol</span>
      </span>
    </span>
  );
}

export function BrandMark({
  alt = "",
  className,
  shape = "plain",
  size = "md",
  variant = "bunny",
  "data-testid": testId,
}: {
  alt?: string;
  className?: string;
  shape?: BrandMarkShape;
  size?: BrandSize;
  variant?: BrandMarkVariant;
  "data-testid"?: string;
}) {
  const { theme } = useTheme();
  const source = getBrandMarkSource({ shape, theme, variant });
  const pixels = markSizePixels[size];

  return (
    <img
      src={source}
      alt={alt}
      aria-hidden={alt ? undefined : "true"}
      width={pixels}
      height={pixels}
      className={cn(markSizeClasses[size], "shrink-0 object-contain", className)}
      data-testid={testId}
    />
  );
}

export function BrandLogoMain({
  alt = "thia.lol",
  className,
  size = "md",
  "data-testid": testId,
}: {
  alt?: string;
  className?: string;
  size?: BrandSize;
  "data-testid"?: string;
}) {
  const pixels = logoMainSizePixels[size];

  return (
    <img
      src="/brand/thia-logo-main-256.png"
      alt={alt}
      width={pixels}
      height={pixels}
      className={cn(
        logoMainSizeClasses[size],
        "block shrink-0 rounded-[1.35rem] object-cover shadow-soft ring-1 ring-line",
        className,
      )}
      data-testid={testId}
    />
  );
}

export function BrandLockup({
  alt = "thia.lol",
  className,
  "data-testid": testId,
}: {
  alt?: string;
  className?: string;
  "data-testid"?: string;
}) {
  const { theme } = useTheme();

  return (
    <img
      src={lockupSources[theme]}
      alt={alt}
      width={theme === "sunveil" ? 560 : 720}
      height={theme === "sunveil" ? 160 : 320}
      className={cn("block shrink-0 object-contain", className)}
      data-testid={testId}
    />
  );
}

function getBrandMarkSource({
  shape,
  theme,
  variant,
}: {
  shape: BrandMarkShape;
  theme: ThemeName;
  variant: BrandMarkVariant;
}) {
  if (variant === "t") {
    return tMarkSources[theme];
  }

  if (variant === "pink") {
    if (shape === "circle") {
      return "/brand/thia-mark-pink-circle-96.png";
    }

    if (shape === "squircle") {
      return "/brand/thia-mark-pink-squircle-96.png";
    }

    return "/brand/thia-mark-pink-96.png";
  }

  if (shape === "circle") {
    return circleMarkSources[theme];
  }

  if (shape === "squircle") {
    return squircleMarkSources[theme];
  }

  return markSources[theme];
}
