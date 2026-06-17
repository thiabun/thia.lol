import { useTheme } from "../lib/useTheme";
import type { ThemeName } from "../lib/types";
import { cn } from "../lib/classNames";

type BrandMarkVariant = "bunny" | "pink" | "t";
type BrandSize = "sm" | "md" | "lg";

const markSources: Record<ThemeName, string> = {
  frostveil: "/brand/thia-mark-frostveil-96.png",
  sunveil: "/brand/thia-mark-sunveil-96.png",
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
  size = "md",
  variant = "bunny",
  "data-testid": testId,
}: {
  alt?: string;
  className?: string;
  size?: BrandSize;
  variant?: BrandMarkVariant;
  "data-testid"?: string;
}) {
  const { theme } = useTheme();
  const source =
    variant === "pink"
      ? "/brand/thia-mark-pink-96.png"
      : variant === "t"
        ? tMarkSources[theme]
        : markSources[theme];
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
