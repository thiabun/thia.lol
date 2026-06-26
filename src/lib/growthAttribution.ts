import type { GrowthAttribution, GrowthShareKind } from "./types";

const storageKey = "thia_growth_attribution";
const ttlMs = 30 * 24 * 60 * 60 * 1000;

type StoredGrowthAttribution = {
  attribution: GrowthAttribution;
  capturedAt: number;
};

export function captureGrowthAttribution(): void {
  if (typeof window === "undefined") {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const share = parseShare(params.get("thia_share"));
  const source = normalizeToken(params.get("utm_source"));
  const medium = normalizeToken(params.get("utm_medium"));
  const campaign = normalizeToken(params.get("utm_campaign"));
  const referrerHost = referrerHostFromDocument();
  const attribution: GrowthAttribution = {
    source,
    medium,
    campaign,
    shareKind: share?.kind ?? null,
    shareRef: share?.ref ?? null,
    referrerHost,
    landingPath: normalizeLandingPath(window.location.pathname),
  };

  if (!hasAttributionSignal(attribution)) {
    return;
  }

  window.localStorage.setItem(
    storageKey,
    JSON.stringify({
      attribution,
      capturedAt: Date.now(),
    } satisfies StoredGrowthAttribution),
  );
}

export function currentGrowthAttribution(): GrowthAttribution | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const stored = window.localStorage.getItem(storageKey);

  if (!stored) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<StoredGrowthAttribution>;

    if (
      typeof parsed.capturedAt !== "number" ||
      Date.now() - parsed.capturedAt > ttlMs ||
      !parsed.attribution
    ) {
      clearGrowthAttribution();
      return undefined;
    }

    return normalizeAttribution(parsed.attribution);
  } catch {
    clearGrowthAttribution();
    return undefined;
  }
}

export function clearGrowthAttribution(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(storageKey);
  }
}

export function shareUrlWithAttribution(
  canonicalUrl: string,
  input: {
    kind: GrowthShareKind;
    ref: string;
  },
): string {
  const url = new URL(canonicalUrl, typeof window === "undefined" ? "https://thia.lol" : window.location.origin);
  const ref = normalizeShareRef(input.ref, input.kind);

  url.searchParams.set("utm_source", "thia.lol");
  url.searchParams.set("utm_medium", "share");
  url.searchParams.set("utm_campaign", `${input.kind}-share`);

  if (ref) {
    url.searchParams.set("thia_share", `${input.kind}:${ref}`);
  }

  return url.toString();
}

function normalizeAttribution(value: GrowthAttribution): GrowthAttribution | undefined {
  const shareKind = isGrowthShareKind(value.shareKind) ? value.shareKind : null;
  const shareRef = shareKind ? normalizeShareRef(value.shareRef, shareKind) : null;
  const attribution: GrowthAttribution = {
    source: normalizeToken(value.source),
    medium: normalizeToken(value.medium),
    campaign: normalizeToken(value.campaign),
    shareKind: shareRef ? shareKind : null,
    shareRef,
    referrerHost: normalizeHost(value.referrerHost),
    landingPath: normalizeLandingPath(value.landingPath),
  };

  return hasAttributionSignal(attribution) ? attribution : undefined;
}

function parseShare(value: string | null): { kind: GrowthShareKind; ref: string } | undefined {
  if (!value) {
    return undefined;
  }

  const [kind, ref] = value.split(":", 2);

  if (!isGrowthShareKind(kind)) {
    return undefined;
  }

  const normalizedRef = normalizeShareRef(ref, kind);

  return normalizedRef ? { kind, ref: normalizedRef } : undefined;
}

function hasAttributionSignal(value: GrowthAttribution): boolean {
  return Boolean(
    value.source ||
      value.medium ||
      value.campaign ||
      (value.shareKind && value.shareRef) ||
      value.referrerHost,
  );
}

function normalizeToken(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 120);

  return normalized || null;
}

function normalizeShareRef(value: unknown, kind: GrowthShareKind): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const ref = value.trim().toLowerCase().replace(/^@/u, "").slice(0, 120);
  const valid = kind === "room" ? /^[a-z0-9-]{1,80}$/u.test(ref) : /^[a-z0-9_-]{1,120}$/u.test(ref);

  return valid ? ref : null;
}

function referrerHostFromDocument(): string | null {
  if (!document.referrer) {
    return null;
  }

  try {
    const referrer = new URL(document.referrer);
    const current = new URL(window.location.href);

    if (referrer.hostname.toLowerCase() === current.hostname.toLowerCase()) {
      return null;
    }

    return normalizeHost(referrer.hostname);
  } catch {
    return null;
  }
}

function normalizeHost(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const host = value.trim().toLowerCase().replace(/\.$/u, "").slice(0, 255);

  return host && /^[a-z0-9.-]+$/u.test(host) && !host.includes("..") ? host : null;
}

function normalizeLandingPath(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const path = value.trim().split(/[?#]/u, 1)[0]?.slice(0, 255) ?? "";

  return path.startsWith("/") && !path.startsWith("//") ? path : null;
}

function isGrowthShareKind(value: unknown): value is GrowthShareKind {
  return value === "profile" || value === "post" || value === "room";
}
