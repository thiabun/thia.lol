export class GifRouteError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "GifRouteError";
  }
}

export interface GifPayload {
  id: string;
  title: string;
  provider: "klipy";
  resourceType: "gif";
  resourceId: string;
  resourceKey: string;
  url: string;
  previewUrl: string;
  sourceUrl: string | null;
  width: number | null;
  height: number | null;
  mime: "image/gif";
  card: {
    provider: "klipy";
    title: string;
    previewUrl: string;
    url: string;
    sourceUrl: string | null;
    width: number | null;
    height: number | null;
  };
}

export interface GifSearchPayload {
  available: boolean;
  provider: "klipy";
  query: string | null;
  next: string | null;
  items: GifPayload[];
}

export interface GifSharePayload {
  registered: boolean;
}

export interface GifRepository {
  trending(query: Record<string, unknown>): Promise<GifSearchPayload>;
  search(query: Record<string, unknown>): Promise<GifSearchPayload>;
  lookup(id: string): Promise<GifPayload | null>;
  registerShare(body: Record<string, unknown>): Promise<GifSharePayload>;
}

export interface GifRepositoryOptions {
  apiKey: string;
  baseUrl?: string;
  country?: string;
  locale?: string;
}

type KlipyMediaFormat = {
  url?: unknown;
  dims?: unknown;
  width?: unknown;
  height?: unknown;
};

type KlipyGifRecord = Record<string, unknown> & {
  id?: unknown;
  title?: unknown;
  content_description?: unknown;
  contentDescription?: unknown;
  media_formats?: unknown;
  mediaFormats?: unknown;
  itemurl?: unknown;
  itemUrl?: unknown;
  url?: unknown;
};

const defaultKlipyBaseUrl = "https://api.klipy.com/api/v1";
const defaultGifLimit = 24;
const maxGifLimit = 40;

export function createGifRepository(options: GifRepositoryOptions): GifRepository {
  return new KlipyGifRepository(options);
}

class KlipyGifRepository implements GifRepository {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly country: string;
  private readonly locale: string;

  constructor(options: GifRepositoryOptions) {
    this.apiKey = options.apiKey.trim();
    this.baseUrl = (options.baseUrl ?? defaultKlipyBaseUrl).replace(/\/+$/u, "");
    this.country = options.country?.trim() || "US";
    this.locale = options.locale?.trim() || "en_US";
  }

  async trending(query: Record<string, unknown>): Promise<GifSearchPayload> {
    return this.searchEndpoint("trending", null, query);
  }

  async search(query: Record<string, unknown>): Promise<GifSearchPayload> {
    const q = scalarString(query.q).trim();

    if (q === "") {
      return this.trending(query);
    }

    return this.searchEndpoint("search", q, query);
  }

  async lookup(id: string): Promise<GifPayload | null> {
    const normalizedId = normalizeGifId(id);

    if (normalizedId === null) {
      throw new GifRouteError("GIF not found.", 404);
    }

    if (!this.available()) {
      return null;
    }

    const response = await this.fetchKlipy(normalizedId, {
      media_filter: "gif,tinygif,nanogif",
    });
    const item = this.normalizedItems(response).find((gif) => gif.id === normalizedId);

    return item ?? null;
  }

  async registerShare(body: Record<string, unknown>): Promise<GifSharePayload> {
    const id = normalizeGifId(scalarString(body.id ?? body.resourceId ?? body.resource_id));

    if (id === null || !this.available()) {
      return { registered: false };
    }

    try {
      await this.fetchKlipy("registershare", {
        id,
        q: scalarString(body.q).trim(),
      });

      return { registered: true };
    } catch {
      return { registered: false };
    }
  }

  private async searchEndpoint(
    endpoint: "trending" | "search",
    q: string | null,
    query: Record<string, unknown>,
  ): Promise<GifSearchPayload> {
    if (!this.available()) {
      return emptyGifSearch(q);
    }

    const response = await this.fetchKlipy(endpoint, {
      ...(q === null ? {} : { q }),
      limit: String(limitFromQuery(query.limit)),
      media_filter: "gif,tinygif,nanogif",
      pos: scalarString(query.pos ?? query.cursor).trim(),
    });

    return {
      available: true,
      provider: "klipy",
      query: q,
      next: nextCursor(response),
      items: this.normalizedItems(response),
    };
  }

  private async fetchKlipy(endpoint: string, params: Record<string, string>): Promise<Record<string, unknown>> {
    const url = new URL(
      `${this.baseUrl}/${encodeURIComponent(this.apiKey)}/gifs/${endpoint.replace(/^\/+/u, "")}`,
    );

    url.searchParams.set("country", this.country);
    url.searchParams.set("locale", this.locale);

    for (const [key, value] of Object.entries(params)) {
      if (value !== "") {
        url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "thia.lol gifs",
      },
      signal: AbortSignal.timeout(3500),
    });

    if (!response.ok) {
      throw new GifRouteError("GIF search is unavailable.", response.status >= 500 ? 503 : 502);
    }

    const parsed: unknown = await response.json();

    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new GifRouteError("GIF search response is invalid.", 502);
    }

    return parsed as Record<string, unknown>;
  }

  private normalizedItems(response: Record<string, unknown>): GifPayload[] {
    const responseData = plainObject(response.data) ? response.data : null;
    const rawItems = Array.isArray(responseData?.data)
      ? responseData.data
      : Array.isArray(response.results)
      ? response.results
      : Array.isArray(response.data)
        ? response.data
        : plainObject(response.result)
          ? [response.result]
          : plainObject(response.data)
            ? [response.data]
            : plainObject(response.gif)
              ? [response.gif]
              : normalizeGifId(scalarString(response.id)) !== null
                ? [response]
                : [];

    return rawItems
      .map((item) => normalizeGifRecord(item))
      .filter((item): item is GifPayload => item !== null);
  }

  private available(): boolean {
    return this.apiKey !== "";
  }
}

function emptyGifSearch(query: string | null): GifSearchPayload {
  return {
    available: false,
    provider: "klipy",
    query,
    next: null,
    items: [],
  };
}

function normalizeGifRecord(value: unknown): GifPayload | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as KlipyGifRecord;
  const id = normalizeGifId(scalarString(record.id));

  if (id === null) {
    return null;
  }

  const mediaFormats = mediaFormatsRecord(record.media_formats ?? record.mediaFormats);
  const files = plainObject(record.file) ? record.file : {};
  const full =
    firstNestedMediaFormat(files, ["hd", "md", "sm", "xs"], "gif") ??
    firstMediaFormat(mediaFormats, ["gif", "mediumgif", "tinygif"]);
  const preview =
    firstNestedMediaFormat(files, ["xs", "sm", "md", "hd"], "gif") ??
    firstMediaFormat(mediaFormats, ["tinygif", "nanogif", "gif"]);

  if (full === null || preview === null) {
    return null;
  }

  const url = scalarString(full.url).trim();
  const previewUrl = scalarString(preview.url).trim();

  if (!isHttpsUrl(url) || !isHttpsUrl(previewUrl)) {
    return null;
  }

  const [width, height] = dimensionsFromFormat(full);
  const title =
    scalarString(record.title).trim() ||
    scalarString(record.content_description ?? record.contentDescription).trim() ||
    "KLIPY GIF";
  const sourceUrl = firstHttpsUrl(record.itemurl, record.itemUrl, record.url);

  return {
    id,
    title,
    provider: "klipy",
    resourceType: "gif",
    resourceId: id,
    resourceKey: `klipy:${id}`,
    url,
    previewUrl,
    sourceUrl,
    width,
    height,
    mime: "image/gif",
    card: {
      provider: "klipy",
      title,
      previewUrl,
      url,
      sourceUrl,
      width,
      height,
    },
  };
}

function mediaFormatsRecord(value: unknown): Record<string, KlipyMediaFormat> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, KlipyMediaFormat>;
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function firstMediaFormat(
  formats: Record<string, KlipyMediaFormat>,
  keys: string[],
): KlipyMediaFormat | null {
  for (const key of keys) {
    const format = formats[key];

    if (format && isHttpsUrl(scalarString(format.url).trim())) {
      return format;
    }
  }

  return null;
}

function firstNestedMediaFormat(
  files: Record<string, unknown>,
  sizes: string[],
  format: string,
): KlipyMediaFormat | null {
  for (const size of sizes) {
    const formats = mediaFormatsRecord(files[size]);
    const candidate = formats[format];

    if (candidate && isHttpsUrl(scalarString(candidate.url).trim())) {
      return candidate;
    }
  }

  return null;
}

function dimensionsFromFormat(format: KlipyMediaFormat): [number | null, number | null] {
  if (Array.isArray(format.dims) && format.dims.length >= 2) {
    return [positiveNumberOrNull(format.dims[0]), positiveNumberOrNull(format.dims[1])];
  }

  return [positiveNumberOrNull(format.width), positiveNumberOrNull(format.height)];
}

function nextCursor(response: Record<string, unknown>): string | null {
  const next = scalarString(response.next).trim();

  return next === "" || next === "0" ? null : next;
}

function limitFromQuery(value: unknown): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);

  return Number.isFinite(parsed)
    ? Math.min(maxGifLimit, Math.max(1, Math.trunc(parsed)))
    : defaultGifLimit;
}

function normalizeGifId(value: string): string | null {
  const trimmed = value.trim();

  return /^[A-Za-z0-9_.:-]{1,191}$/u.test(trimmed) ? trimmed : null;
}

function firstHttpsUrl(...values: unknown[]): string | null {
  for (const value of values) {
    const url = scalarString(value).trim();

    if (isHttpsUrl(url)) {
      return url;
    }
  }

  return null;
}

function isHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);

    return parsed.protocol === "https:" && parsed.username === "" && parsed.password === "";
  } catch {
    return false;
  }
}

function positiveNumberOrNull(value: unknown): number | null {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : null;
}

function scalarString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }

  return "";
}
