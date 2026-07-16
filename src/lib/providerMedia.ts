const providerImageHosts = new Set([
  "i.scdn.co",
  "i.ytimg.com",
  "image-cdn-ak.spotifycdn.com",
  "img.youtube.com",
  "mosaic.scdn.co",
  "yt3.ggpht.com",
]);

export function safeProviderImageUrl(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  if (/^\/uploads\/media\/[0-9]{4}\/[0-9]{2}\/[a-z0-9_-]+\.(?:jpe?g|png|webp|gif)$/u.test(value)) {
    return value;
  }

  const url = safeHttpsUrl(value);

  if (!url) {
    return null;
  }

  const host = normalizedHost(url);

  return providerImageHosts.has(host) || providerSubdomainAllowed(host, "mzstatic.com")
    ? url.toString()
    : null;
}

export function safeKlipyUrl(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const url = safeHttpsUrl(value);

  return url && providerSubdomainAllowed(normalizedHost(url), "klipy.com")
    ? url.toString()
    : null;
}

function safeHttpsUrl(value: string): URL | null {
  if (value.length > 1200) {
    return null;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" && url.username === "" && url.password === ""
      ? url
      : null;
  } catch {
    return null;
  }
}

function normalizedHost(url: URL): string {
  return url.hostname.toLowerCase().replace(/\.$/u, "");
}

function providerSubdomainAllowed(host: string, root: string): boolean {
  return host === root || host.endsWith(`.${root}`);
}
