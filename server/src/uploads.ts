import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { fileTypeFromBuffer } from "file-type";
import type { MultipartFile } from "@fastify/multipart";
import sharp from "sharp";

export const imageUploadMaxBytes = 10 * 1024 * 1024;
export const videoUploadMaxBytes = 30 * 1024 * 1024;
export const audioUploadMaxBytes = 20 * 1024 * 1024;

const imageMimes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

const videoMimes = new Map([
  ["video/mp4", "mp4"],
  ["video/webm", "webm"],
]);

const imagePurposes = new Set(["avatar", "banner", "profile_background", "post_media", "room_icon", "room_banner"]);
const videoPurposes = new Set(["profile_background", "profile_module_video"]);

export class UploadRouteError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "UploadRouteError";
  }
}

export interface UploadServiceOptions {
  uploadRoot: string;
  publicPrefix: string;
}

export interface UploadPayload {
  url: string;
  width?: number;
  height?: number;
  mime: string;
  type: string;
  size: number;
  purpose: string;
}

export interface UploadService {
  store(kind: string, file: MultipartFile | undefined): Promise<UploadPayload>;
}

export function createUploadService(options: UploadServiceOptions): UploadService {
  return new NodeUploadService(options.uploadRoot, options.publicPrefix);
}

class NodeUploadService implements UploadService {
  constructor(
    private readonly uploadRoot: string,
    private readonly publicPrefix: string,
  ) {}

  async store(kind: string, file: MultipartFile | undefined): Promise<UploadPayload> {
    if (kind === "image") {
      return this.storeImage(file);
    }

    if (kind === "video") {
      return this.storeVideo(file);
    }

    if (kind === "audio") {
      return this.storeAudio(file);
    }

    throw new UploadRouteError("Not found.", 404);
  }

  private async storeImage(file: MultipartFile | undefined): Promise<UploadPayload> {
    const buffer = await uploadedFileBuffer(file, "image", imageUploadMaxBytes);
    const purpose = uploadPurpose(file, imagePurposes, "image");
    const mime = await detectedMime(buffer, "image");
    const extension = imageMimes.get(mime);

    if (extension === undefined) {
      throw new UploadRouteError("Unsupported image type. Use JPEG, PNG, WebP, or GIF.", 415);
    }

    let metadata;

    try {
      metadata = await sharp(buffer, { animated: true }).metadata();
    } catch {
      throw new UploadRouteError("Image could not be decoded.", 415);
    }

    if (metadata.width === undefined || metadata.height === undefined) {
      throw new UploadRouteError("Image could not be decoded.", 415);
    }

    const storage = await this.writeUpload(buffer, purpose, extension);

    return {
      url: storage.url,
      width: metadata.width,
      height: metadata.height,
      mime,
      type: mime,
      size: buffer.byteLength,
      purpose,
    };
  }

  private async storeVideo(file: MultipartFile | undefined): Promise<UploadPayload> {
    const buffer = await uploadedFileBuffer(file, "video", videoUploadMaxBytes);
    const purpose = uploadPurpose(file, videoPurposes, "video");
    const mime = await detectedMime(buffer, "video");
    const extension = videoMimes.get(mime);

    if (extension === undefined) {
      throw new UploadRouteError("Unsupported video type. Use MP4 or WebM.", 415);
    }

    const storage = await this.writeUpload(buffer, purpose, extension);

    return {
      url: storage.url,
      mime,
      type: mime,
      size: buffer.byteLength,
      purpose,
    };
  }

  private async storeAudio(file: MultipartFile | undefined): Promise<UploadPayload> {
    const buffer = await uploadedFileBuffer(file, "audio", audioUploadMaxBytes);
    const purpose = uploadPurpose(file, new Set(["profile_music"]), "audio");
    const mime = await detectedMime(buffer, "audio");

    if (mime !== "audio/mpeg") {
      throw new UploadRouteError("Unsupported audio type. Use MP3.", 415);
    }

    const storage = await this.writeUpload(buffer, purpose, "mp3");

    return {
      url: storage.url,
      mime,
      type: mime,
      size: buffer.byteLength,
      purpose,
    };
  }

  private async writeUpload(buffer: Buffer, purpose: string, extension: string): Promise<{ url: string }> {
    const now = new Date();
    const year = String(now.getUTCFullYear());
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const relativeDir = path.posix.join(this.publicPrefix.replace(/^\/+|\/+$/g, ""), "media", year, month);
    const absoluteDir = path.join(this.uploadRoot, "media", year, month);
    const filename = `${purpose}-${randomBytes(16).toString("hex")}.${safeExtension(extension)}`;

    await mkdir(absoluteDir, { recursive: true, mode: 0o755 });
    await writeFile(path.join(absoluteDir, filename), buffer, { mode: 0o644 });

    return {
      url: `/${path.posix.join(relativeDir, filename)}`,
    };
  }
}

async function uploadedFileBuffer(
  file: MultipartFile | undefined,
  kind: "image" | "video" | "audio",
  maxBytes: number,
): Promise<Buffer> {
  if (file === undefined) {
    throw new UploadRouteError(chooseFileMessage(kind), 422);
  }

  let buffer: Buffer;

  try {
    buffer = await file.toBuffer();
  } catch {
    throw new UploadRouteError(`${titleKind(kind)} could not be uploaded.`, 400);
  }

  if (buffer.byteLength <= 0) {
    throw new UploadRouteError(`${titleKind(kind)} cannot be empty.`, 422);
  }

  if (buffer.byteLength > maxBytes) {
    throw new UploadRouteError(`${titleKind(kind)} must be ${maxUploadLabel(kind)} or smaller.`, 413);
  }

  return buffer;
}

function uploadPurpose(file: MultipartFile | undefined, allowed: Set<string>, kind: "image" | "video" | "audio"): string {
  const field = file?.fields.purpose;
  const rawValue = field !== undefined && !Array.isArray(field) && "value" in field ? field.value : undefined;

  if (typeof rawValue !== "string") {
    throw new UploadRouteError(`Choose where this ${kind === "audio" ? "audio file" : kind} will be used.`, 422);
  }

  const purpose = rawValue.trim();

  if (!allowed.has(purpose)) {
    throw new UploadRouteError(`Unsupported ${kind} purpose.`, 422);
  }

  return purpose;
}

async function detectedMime(buffer: Buffer, kind: "image" | "video" | "audio"): Promise<string> {
  const fileType = await fileTypeFromBuffer(buffer);
  const mime = normalizeMime(fileType?.mime ?? "", kind);

  if (mime !== null) {
    return mime;
  }

  throw new UploadRouteError(`Unsupported ${kind} type.`, 415);
}

function normalizeMime(mime: string, kind: "image" | "video" | "audio"): string | null {
  const normalized = mime.trim().toLowerCase();

  if (kind === "image") {
    if (normalized === "image/jpg" || normalized === "image/pjpeg") {
      return "image/jpeg";
    }

    return imageMimes.has(normalized) ? normalized : null;
  }

  if (kind === "video") {
    if (normalized === "application/mp4" || normalized === "video/x-mp4") {
      return "video/mp4";
    }

    return videoMimes.has(normalized) ? normalized : null;
  }

  if (normalized === "audio/mp3" || normalized === "audio/mpeg") {
    return "audio/mpeg";
  }

  return null;
}

function safeExtension(extension: string): string {
  return extension.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
}

function chooseFileMessage(kind: "image" | "video" | "audio"): string {
  if (kind === "audio") {
    return "Choose an audio file to upload.";
  }

  return `Choose a ${kind} to upload.`;
}

function titleKind(kind: "image" | "video" | "audio"): string {
  if (kind === "audio") {
    return "Audio";
  }

  return kind[0]?.toUpperCase() + kind.slice(1);
}

function maxUploadLabel(kind: "image" | "video" | "audio"): string {
  if (kind === "image") {
    return "10 MB";
  }

  if (kind === "video") {
    return "30 MB";
  }

  return "20 MB";
}
