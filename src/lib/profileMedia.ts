export function safeProfileImageUrl(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  if (/^\/uploads\/media\/[0-9]{4}\/[0-9]{2}\/[a-z0-9_-]+\.(?:jpe?g|png|webp|gif)$/.test(value)) {
    return value;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : undefined;
  } catch {
    return undefined;
  }
}
