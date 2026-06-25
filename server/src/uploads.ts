import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { fileTypeFromBuffer } from "file-type";
import type { MultipartFile } from "@fastify/multipart";
import sharp, { type Sharp } from "sharp";

export const imageUploadMaxBytes = 10 * 1024 * 1024;
export const videoUploadMaxBytes = 100 * 1024 * 1024;
export const audioUploadMaxBytes = 20 * 1024 * 1024;
export const multipartUploadMaxBytes = videoUploadMaxBytes;

const imageOutputMime = "image/webp";
const videoOutputMime = "video/mp4";

const imageMimes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/tiff",
  "image/bmp",
]);

const videoMimes = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
  "video/3gpp",
  "video/3gpp2",
  "video/matroska",
  "video/vnd.avi",
  "video/mpeg",
  "video/mp1s",
  "video/mp2p",
  "video/ogg",
]);

const videoExtensionMimes = new Map([
  ["mp4", "video/mp4"],
  ["webm", "video/webm"],
  ["mov", "video/quicktime"],
  ["m4v", "video/x-m4v"],
  ["3gp", "video/3gpp"],
  ["3g2", "video/3gpp2"],
  ["mkv", "video/matroska"],
  ["avi", "video/vnd.avi"],
  ["mpeg", "video/mpeg"],
  ["mpg", "video/mpeg"],
  ["ogv", "video/ogg"],
  ["ogg", "video/ogg"],
]);

const imagePurposes = new Set(["avatar", "banner", "profile_background", "post_media", "room_icon", "room_banner"]);
const videoPurposes = new Set(["profile_background", "profile_module_video", "post_media"]);
const sharedUploadDirectoryMode = 0o2775;

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
  ffmpegPath?: string | undefined;
  ffprobePath?: string | undefined;
}

export interface UploadPayload {
  url: string;
  width?: number;
  height?: number;
  duration?: number;
  posterUrl?: string;
  mime: string;
  type: string;
  size: number;
  purpose: string;
  mediaType?: "image" | "video" | "audio";
}

export interface UploadPreviewImagePayload {
  body: Buffer;
  contentType: typeof imageOutputMime;
  width: number;
  height: number;
}

export interface UploadService {
  store(kind: string, file: MultipartFile | undefined): Promise<UploadPayload>;
  previewImage(file: MultipartFile | undefined): Promise<UploadPreviewImagePayload>;
}

export function createUploadService(options: UploadServiceOptions): UploadService {
  return new NodeUploadService(options);
}

class NodeUploadService implements UploadService {
  private readonly ffmpegPath: string;
  private readonly ffprobePath: string;

  constructor(private readonly options: UploadServiceOptions) {
    this.ffmpegPath = options.ffmpegPath?.trim() || "ffmpeg";
    this.ffprobePath = options.ffprobePath?.trim() || "ffprobe";
  }

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

  async previewImage(file: MultipartFile | undefined): Promise<UploadPreviewImagePayload> {
    const buffer = await uploadedFileBuffer(file, "image", imageUploadMaxBytes);
    uploadPurpose(file, imagePurposes, "image");
    const mime = await detectedMime(buffer, "image", file?.filename);

    if (!imageMimes.has(mime)) {
      throw new UploadRouteError(unsupportedImageMessage(), 415);
    }

    const converted = await convertImage(buffer, mime, { width: 4096, height: 4096 });

    return {
      body: converted.body,
      contentType: imageOutputMime,
      width: converted.width,
      height: converted.height,
    };
  }

  private async storeImage(file: MultipartFile | undefined): Promise<UploadPayload> {
    const buffer = await uploadedFileBuffer(file, "image", imageUploadMaxBytes);
    const purpose = uploadPurpose(file, imagePurposes, "image");
    const mime = await detectedMime(buffer, "image", file?.filename);

    if (!imageMimes.has(mime)) {
      throw new UploadRouteError(unsupportedImageMessage(), 415);
    }

    const converted = await convertImage(buffer, mime, imageOutputLimit(purpose));
    const storage = await this.writeUpload(converted.body, purpose, "webp");

    return {
      url: storage.url,
      width: converted.width,
      height: converted.height,
      mime: imageOutputMime,
      type: imageOutputMime,
      size: converted.body.byteLength,
      purpose,
      mediaType: "image",
    };
  }

  private async storeVideo(file: MultipartFile | undefined): Promise<UploadPayload> {
    const buffer = await uploadedFileBuffer(file, "video", videoUploadMaxBytes);
    const purpose = uploadPurpose(file, videoPurposes, "video");
    const mime = await detectedMime(buffer, "video", file?.filename);

    if (!videoMimes.has(mime)) {
      throw new UploadRouteError(unsupportedVideoMessage(), 415);
    }

    const converted = await this.transcodeVideo(buffer, purpose, videoExtension(mime, file?.filename));
    const token = randomBytes(16).toString("hex");
    const videoStorage = await this.writeUpload(converted.body, purpose, "mp4", token);
    const posterStorage = await this.writeUpload(converted.poster, purpose, "webp", token, "-poster");

    return {
      url: videoStorage.url,
      posterUrl: posterStorage.url,
      width: converted.width,
      height: converted.height,
      duration: converted.duration,
      mime: videoOutputMime,
      type: videoOutputMime,
      size: converted.body.byteLength,
      purpose,
      mediaType: "video",
    };
  }

  private async storeAudio(file: MultipartFile | undefined): Promise<UploadPayload> {
    const buffer = await uploadedFileBuffer(file, "audio", audioUploadMaxBytes);
    const purpose = uploadPurpose(file, new Set(["profile_music"]), "audio");
    const mime = await detectedMime(buffer, "audio", file?.filename);

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
      mediaType: "audio",
    };
  }

  private async transcodeVideo(
    buffer: Buffer,
    purpose: string,
    inputExtension: string,
  ): Promise<{ body: Buffer; poster: Buffer; width: number; height: number; duration: number }> {
    const directory = await mkdtemp(path.join(tmpdir(), "thia-video-"));
    const inputPath = path.join(directory, `input.${safeExtension(inputExtension)}`);
    const outputPath = path.join(directory, "output.mp4");
    const posterPath = path.join(directory, "poster.webp");

    try {
      await writeFile(inputPath, buffer, { mode: 0o600 });
      const inputMetadata = await this.ffprobe(inputPath);

      if (inputMetadata.video === null) {
        throw new UploadRouteError("Video could not be decoded.", 415);
      }

      await this.ffmpeg(transcodeArgs(inputPath, outputPath, purpose));
      await this.ffmpeg(posterArgs(outputPath, posterPath));

      const outputMetadata = await this.ffprobe(outputPath);
      const outputStat = await stat(outputPath);

      if (outputMetadata.video === null || outputStat.size <= 0) {
        throw new UploadRouteError("Video could not be converted.", 415);
      }

      const posterStat = await stat(posterPath);

      if (posterStat.size <= 0) {
        throw new UploadRouteError("Video poster could not be generated.", 415);
      }

      return {
        body: await readFile(outputPath),
        poster: await readFile(posterPath),
        width: outputMetadata.video.width,
        height: outputMetadata.video.height,
        duration: outputMetadata.duration,
      };
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  private async ffprobe(filePath: string): Promise<VideoMetadata> {
    const output = await runProcess(
      this.ffprobePath,
      [
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        filePath,
      ],
      30_000,
    );

    try {
      return videoMetadataFromFfprobe(JSON.parse(output) as FfprobeOutput);
    } catch {
      throw new UploadRouteError("Video could not be inspected.", 415);
    }
  }

  private async ffmpeg(args: string[]): Promise<void> {
    await runProcess(this.ffmpegPath, args, 180_000);
  }

  private async writeUpload(
    buffer: Buffer,
    purpose: string,
    extension: string,
    token = randomBytes(16).toString("hex"),
    suffix = "",
  ): Promise<{ url: string }> {
    const now = new Date();
    const year = String(now.getUTCFullYear());
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const relativeDir = path.posix.join(this.options.publicPrefix.replace(/^\/+|\/+$/g, ""), "media", year, month);
    const absoluteDir = path.join(this.options.uploadRoot, "media", year, month);
    const filename = `${purpose}-${token}${suffix}.${safeExtension(extension)}`;

    await this.ensureUploadDirectory(this.options.uploadRoot);
    await this.ensureUploadDirectory(path.join(this.options.uploadRoot, "media"));
    await this.ensureUploadDirectory(path.join(this.options.uploadRoot, "media", year));
    await this.ensureUploadDirectory(absoluteDir);
    await writeFile(path.join(absoluteDir, filename), buffer, { mode: 0o644 });

    return {
      url: `/${path.posix.join(relativeDir, filename)}`,
    };
  }

  private async ensureUploadDirectory(directory: string): Promise<void> {
    await mkdir(directory, { recursive: true, mode: sharedUploadDirectoryMode });
    await chmod(directory, sharedUploadDirectoryMode).catch(() => undefined);
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
  } catch (error) {
    if (uploadLimitError(error)) {
      throw error;
    }

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

async function detectedMime(buffer: Buffer, kind: "image" | "video" | "audio", filename = ""): Promise<string> {
  const fileType = await fileTypeFromBuffer(buffer);
  const mime = normalizeMime(fileType?.mime ?? "", kind, filename);

  if (mime !== null) {
    return mime;
  }

  throw new UploadRouteError(`Unsupported ${kind} type.`, 415);
}

function normalizeMime(mime: string, kind: "image" | "video" | "audio", filename: string): string | null {
  const normalized = mime.trim().toLowerCase();

  if (kind === "image") {
    if (normalized === "image/jpg" || normalized === "image/pjpeg") {
      return "image/jpeg";
    }

    if (normalized === "image/heic-sequence") {
      return "image/heic";
    }

    if (normalized === "image/heif-sequence") {
      return "image/heif";
    }

    if (normalized === "image/x-ms-bmp") {
      return "image/bmp";
    }

    return imageMimes.has(normalized) ? normalized : null;
  }

  if (kind === "video") {
    if (normalized === "application/mp4" || normalized === "video/x-mp4") {
      return "video/mp4";
    }

    if (videoMimes.has(normalized)) {
      return normalized;
    }

    return videoMimeFromFilename(filename);
  }

  if (normalized === "audio/mp3" || normalized === "audio/mpeg") {
    return "audio/mpeg";
  }

  return null;
}

function videoMimeFromFilename(filename: string): string | null {
  const extension = path.extname(filename).replace(/^\./u, "").toLowerCase();

  return videoExtensionMimes.get(extension) ?? null;
}

async function convertImage(
  buffer: Buffer,
  mime: string,
  limit: { width: number; height: number },
): Promise<{ body: Buffer; width: number; height: number }> {
  let image: Sharp;

  try {
    image = mime === "image/bmp" ? sharpFromBmp(buffer) : sharp(buffer, { animated: false, limitInputPixels: 120_000_000 });
  } catch {
    throw new UploadRouteError("Image could not be decoded.", 415);
  }

  try {
    const output = await image
      .rotate()
      .resize({
        width: limit.width,
        height: limit.height,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 88, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    if (output.info.width <= 0 || output.info.height <= 0) {
      throw new Error("Invalid image dimensions.");
    }

    return {
      body: output.data,
      width: output.info.width,
      height: output.info.height,
    };
  } catch {
    throw new UploadRouteError("Image could not be decoded.", 415);
  }
}

function sharpFromBmp(buffer: Buffer): Sharp {
  const bitmap = decodeBmp(buffer);

  return sharp(bitmap.data, {
    raw: {
      width: bitmap.width,
      height: bitmap.height,
      channels: 4,
    },
  });
}

function decodeBmp(buffer: Buffer): { data: Buffer; width: number; height: number } {
  if (buffer.length < 54 || buffer.toString("ascii", 0, 2) !== "BM") {
    throw new Error("Invalid BMP.");
  }

  const pixelOffset = buffer.readUInt32LE(10);
  const dibHeaderSize = buffer.readUInt32LE(14);

  if (dibHeaderSize < 40) {
    throw new Error("Unsupported BMP header.");
  }

  const width = buffer.readInt32LE(18);
  const rawHeight = buffer.readInt32LE(22);
  const planes = buffer.readUInt16LE(26);
  const bitsPerPixel = buffer.readUInt16LE(28);
  const compression = buffer.readUInt32LE(30);
  const topDown = rawHeight < 0;
  const height = Math.abs(rawHeight);

  if (planes !== 1 || compression !== 0 || width <= 0 || height <= 0 || (bitsPerPixel !== 24 && bitsPerPixel !== 32)) {
    throw new Error("Unsupported BMP.");
  }

  const rowSize = Math.floor((bitsPerPixel * width + 31) / 32) * 4;
  const requiredSize = pixelOffset + rowSize * height;

  if (requiredSize > buffer.length) {
    throw new Error("Truncated BMP.");
  }

  const data = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const sourceY = topDown ? y : height - 1 - y;
    const sourceRow = pixelOffset + sourceY * rowSize;

    for (let x = 0; x < width; x += 1) {
      const source = sourceRow + x * (bitsPerPixel / 8);
      const target = (y * width + x) * 4;

      data[target] = buffer[source + 2] ?? 0;
      data[target + 1] = buffer[source + 1] ?? 0;
      data[target + 2] = buffer[source] ?? 0;
      data[target + 3] = bitsPerPixel === 32 ? (buffer[source + 3] ?? 255) : 255;
    }
  }

  return { data, width, height };
}

function imageOutputLimit(purpose: string): { width: number; height: number } {
  if (purpose === "avatar" || purpose === "room_icon") {
    return { width: 512, height: 512 };
  }

  if (purpose === "banner" || purpose === "room_banner") {
    return { width: 1600, height: 600 };
  }

  if (purpose === "profile_background") {
    return { width: 1920, height: 1080 };
  }

  return { width: 1920, height: 1920 };
}

function transcodeArgs(inputPath: string, outputPath: string, purpose: string): string[] {
  const includeAudio = purpose !== "profile_background";

  return [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    inputPath,
    "-t",
    String(videoDurationLimitSeconds(purpose)),
    "-map",
    "0:v:0",
    ...(includeAudio ? ["-map", "0:a:0?"] : []),
    "-vf",
    videoScaleFilter(),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "24",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    ...(includeAudio ? ["-c:a", "aac", "-b:a", "128k", "-ac", "2"] : ["-an"]),
    outputPath,
  ];
}

function posterArgs(inputPath: string, outputPath: string): string[] {
  return [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    "0.1",
    "-i",
    inputPath,
    "-frames:v",
    "1",
    "-vf",
    videoScaleFilter(),
    "-quality",
    "82",
    outputPath,
  ];
}

function videoScaleFilter(): string {
  return "scale=w=1280:h=720:force_original_aspect_ratio=decrease,scale=ceil(iw/2)*2:ceil(ih/2)*2";
}

function videoDurationLimitSeconds(purpose: string): number {
  return purpose === "profile_background" ? 30 : 120;
}

function videoExtension(mime: string, filename = ""): string {
  const fromName = path.extname(filename).replace(/^\./u, "").toLowerCase();

  if (fromName !== "" && videoExtensionMimes.has(fromName)) {
    return fromName;
  }

  if (mime === "video/quicktime") {
    return "mov";
  }

  if (mime === "video/x-m4v") {
    return "m4v";
  }

  if (mime === "video/matroska") {
    return "mkv";
  }

  if (mime === "video/vnd.avi") {
    return "avi";
  }

  if (mime === "video/ogg") {
    return "ogv";
  }

  return mime === "video/webm" ? "webm" : "mp4";
}

type FfprobeOutput = {
  format?: {
    duration?: string | undefined;
  } | undefined;
  streams?: Array<{
    codec_type?: string | undefined;
    duration?: string | undefined;
    height?: number | undefined;
    width?: number | undefined;
  }> | undefined;
};

type VideoMetadata = {
  duration: number;
  video: { width: number; height: number } | null;
};

function videoMetadataFromFfprobe(output: FfprobeOutput): VideoMetadata {
  const videoStream = output.streams?.find((stream) => stream.codec_type === "video");
  const duration = numericDuration(output.format?.duration) ?? numericDuration(videoStream?.duration) ?? 0;

  if (
    videoStream === undefined ||
    !Number.isFinite(videoStream.width) ||
    !Number.isFinite(videoStream.height) ||
    (videoStream.width ?? 0) <= 0 ||
    (videoStream.height ?? 0) <= 0
  ) {
    return {
      duration,
      video: null,
    };
  }

  return {
    duration,
    video: {
      width: videoStream.width ?? 0,
      height: videoStream.height ?? 0,
    },
  };
}

function numericDuration(value: string | undefined): number | null {
  if (value === undefined) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function runProcess(command: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    const errors: Buffer[] = [];
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new UploadRouteError("Media conversion timed out.", 503));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      errors.push(chunk);
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      clearTimeout(timeout);
      reject(new UploadRouteError(error.code === "ENOENT" ? "Media conversion is not available." : "Media conversion failed.", 503));
    });
    child.on("close", (code) => {
      clearTimeout(timeout);

      if (code === 0) {
        resolve(Buffer.concat(chunks).toString("utf8"));
        return;
      }

      const errorText = Buffer.concat(errors).toString("utf8").trim();
      reject(new UploadRouteError(errorText === "" ? "Media conversion failed." : "Media conversion failed.", 415));
    });
  });
}

function uploadLimitError(error: unknown): boolean {
  if (error === null || typeof error !== "object") {
    return false;
  }

  const record = error as Record<string, unknown>;

  return record.code === "FST_REQ_FILE_TOO_LARGE" || record.name === "RequestFileTooLargeError";
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
    return "100 MB";
  }

  return "20 MB";
}

function unsupportedImageMessage(): string {
  return "Unsupported image type. Use JPEG, PNG, WebP, GIF, AVIF, HEIC/HEIF, TIFF, or BMP.";
}

function unsupportedVideoMessage(): string {
  return "Unsupported video type. Use MP4, WebM, MOV, M4V, 3GP, MKV, AVI, MPEG, or OGG.";
}
