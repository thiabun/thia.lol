import { useEffect, useState } from "react";
import { useTheme } from "../lib/useTheme";
import type { ThemeName } from "../lib/types";
import { cn } from "../lib/classNames";

type BrandMarkVariant = "bunny" | "pink" | "t";
type BrandMarkShape = "plain" | "circle" | "squircle";
type BrandSize = "sm" | "md" | "lg";

const markSources: Record<ThemeName, string> = {
  dark: "/brand/thia-mark-dark-96.png",
  light: "/brand/thia-mark-light-96.png",
};

const circleMarkSources: Record<ThemeName, string> = {
  dark: "/brand/thia-mark-dark-circle-96.png",
  light: "/brand/thia-mark-light-circle-96.png",
};

const squircleMarkSources: Record<ThemeName, string> = {
  dark: "/brand/thia-mark-dark-squircle-96.png",
  light: "/brand/thia-mark-light-squircle-96.png",
};

const tMarkSources: Record<ThemeName, string> = {
  dark: "/brand/thia-t-dark-96.png",
  light: "/brand/thia-t-light-96.png",
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
      <BrandMark className="rounded-full" shape="plain" variant="bunny" />
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
  shape = "squircle",
  size = "md",
  variant = "pink",
  "data-testid": testId,
}: {
  alt?: string;
  className?: string;
  shape?: BrandMarkShape;
  size?: BrandSize;
  variant?: BrandMarkVariant;
  "data-testid"?: string;
}) {
  const theme = useBrandTheme();
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
      src="/brand/thia-mark-pink-squircle-96.png"
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
  return (
    <img
      src="/brand/thia-mark-pink-squircle-96.png"
      alt={alt}
      width={96}
      height={96}
      className={cn("block shrink-0 rounded-[1.35rem] object-cover", className)}
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

function useBrandTheme(): ThemeName {
  const { theme } = useTheme();
  const [profileTheme, setProfileTheme] = useState<ThemeName | null>(() =>
    activeProfileBrandTheme(),
  );

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const root = document.documentElement;
    const update = () => setProfileTheme(activeProfileBrandTheme());
    const observer = new MutationObserver(update);

    update();
    observer.observe(root, {
      attributeFilter: ["data-profile-theme", "style"],
      attributes: true,
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return profileTheme ?? theme;
}

function activeProfileBrandTheme(): ThemeName | null {
  if (typeof document === "undefined") {
    return null;
  }

  const root = document.documentElement;

  if (!root.dataset.profileTheme) {
    return null;
  }

  const canvas = getComputedStyle(root)
    .getPropertyValue("--app-canvas")
    .trim();
  const luminance = relativeLuminance(canvas);

  if (luminance === null) {
    return null;
  }

  return luminance > 0.52 ? "light" : "dark";
}

function relativeLuminance(hex: string): number | null {
  const match = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex);

  if (!match) {
    return null;
  }

  const [, redHex = "00", greenHex = "00", blueHex = "00"] = match;
  const red = linearRgbChannel(redHex);
  const green = linearRgbChannel(greenHex);
  const blue = linearRgbChannel(blueHex);

  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function linearRgbChannel(hex: string): number {
  const channel = Number.parseInt(hex, 16) / 255;

  return channel <= 0.03928
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}
