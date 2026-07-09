import { chmod, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { MultipartFile } from "@fastify/multipart";
import sharp, { type Sharp } from "sharp";
import { describe, expect, it } from "vitest";

import { createUploadService } from "./uploads.js";

describe("upload service", () => {
  it("stores image uploads in shared runtime directories", async () => {
    const uploadRoot = await mkdtemp(path.join(tmpdir(), "thia-uploads-"));

    try {
      const service = createUploadService({
        uploadRoot,
        publicPrefix: "/uploads",
      });
      const buffer = await sharp({
        create: {
          width: 2,
          height: 3,
          channels: 3,
          background: "#ff00aa",
        },
      })
        .png()
        .toBuffer();

      const result = await service.store("image", multipartFile(buffer, "post_media", "fixture.png"));
      const match = /^\/uploads\/media\/([0-9]{4})\/([0-9]{2})\/post_media-[a-f0-9]{32}\.webp$/u.exec(
        result.url,
      );

      expect(match).not.toBeNull();
      expect(result).toMatchObject({
        width: 2,
        height: 3,
        mime: "image/webp",
        type: "image/webp",
        purpose: "post_media",
        mediaType: "image",
      });
      expect(result.size).toBeGreaterThan(0);

      const [, year, month] = match ?? [];
      expect(year).toEqual(expect.any(String));
      expect(month).toEqual(expect.any(String));

      const filePath = path.join(uploadRoot, result.url.replace(/^\/uploads\//u, ""));
      await expect(stat(filePath)).resolves.toMatchObject({ size: result.size });
      await expect(sharp(await readFile(filePath)).metadata()).resolves.toMatchObject({
        format: "webp",
        width: 2,
        height: 3,
      });

      for (const directory of [
        uploadRoot,
        path.join(uploadRoot, "media"),
        path.join(uploadRoot, "media", year ?? ""),
        path.join(uploadRoot, "media", year ?? "", month ?? ""),
      ]) {
        const directoryMode = (await stat(directory)).mode & 0o7777;

        expect(directoryMode).toBe(0o2775);
      }
    } finally {
      await rm(uploadRoot, { recursive: true, force: true });
    }
  });

  it.each([
    ["AVIF", () => sharpColorImage().avif().toBuffer(), "fixture.avif"],
    ["TIFF", () => sharpColorImage().tiff().toBuffer(), "fixture.tiff"],
    ["BMP", async () => bmpFixture(), "fixture.bmp"],
  ])("normalizes %s uploads to WebP", async (_label, bufferFactory, filename) => {
    const uploadRoot = await mkdtemp(path.join(tmpdir(), "thia-uploads-"));

    try {
      const service = createUploadService({
        uploadRoot,
        publicPrefix: "/uploads",
      });
      const buffer = await bufferFactory();

      const result = await service.store("image", multipartFile(buffer, "post_media", filename));
      const filePath = path.join(uploadRoot, result.url.replace(/^\/uploads\//u, ""));

      expect(result).toMatchObject({
        mime: "image/webp",
        type: "image/webp",
        width: 2,
        height: 3,
        mediaType: "image",
      });
      expect(result.url).toMatch(/^\/uploads\/media\/[0-9]{4}\/[0-9]{2}\/post_media-[a-f0-9]{32}\.webp$/u);
      await expect(sharp(await readFile(filePath)).metadata()).resolves.toMatchObject({
        format: "webp",
        width: 2,
        height: 3,
      });
    } finally {
      await rm(uploadRoot, { recursive: true, force: true });
    }
  });

  it("returns authenticated image previews as converted WebP blobs", async () => {
    const uploadRoot = await mkdtemp(path.join(tmpdir(), "thia-uploads-"));

    try {
      const service = createUploadService({
        uploadRoot,
        publicPrefix: "/uploads",
      });
      const buffer = await sharpColorImage().tiff().toBuffer();

      const preview = await service.previewImage(multipartFile(buffer, "post_media", "fixture.tiff"));

      expect(preview.contentType).toBe("image/webp");
      expect(preview.width).toBe(2);
      expect(preview.height).toBe(3);
      await expect(sharp(preview.body).metadata()).resolves.toMatchObject({
        format: "webp",
        width: 2,
        height: 3,
      });
    } finally {
      await rm(uploadRoot, { recursive: true, force: true });
    }
  });

  it("rejects unsupported image and video uploads", async () => {
    const service = createUploadService({
      uploadRoot: "/tmp/thia-unused-uploads",
      publicPrefix: "/uploads",
    });

    await expect(service.store("image", multipartFile(Buffer.from("%PDF-1.7"), "post_media", "paper.pdf"))).rejects.toMatchObject({
      statusCode: 415,
      message: expect.stringContaining("Unsupported image type"),
    });
    await expect(service.store("video", multipartFile(Buffer.from("<svg></svg>"), "post_media", "clip.svg"))).rejects.toMatchObject({
      statusCode: 415,
      message: expect.stringContaining("Unsupported video type"),
    });
  });

  it("stores post MP3 uploads in shared runtime directories", async () => {
    const uploadRoot = await mkdtemp(path.join(tmpdir(), "thia-uploads-"));

    try {
      const service = createUploadService({
        uploadRoot,
        publicPrefix: "/uploads",
      });
      const buffer = Buffer.from([0xff, 0xfb, 0x90, 0x64, 0x00, 0x0f, 0xf0, 0x00]);

      const result = await service.store("audio", multipartFile(buffer, "post_media", "fixture.mp3"));
      const match = /^\/uploads\/media\/([0-9]{4})\/([0-9]{2})\/post_media-[a-f0-9]{32}\.mp3$/u.exec(
        result.url,
      );

      expect(match).not.toBeNull();
      expect(result).toMatchObject({
        mime: "audio/mpeg",
        type: "audio/mpeg",
        size: buffer.byteLength,
        purpose: "post_media",
        mediaType: "audio",
      });

      const filePath = path.join(uploadRoot, result.url.replace(/^\/uploads\//u, ""));

      await expect(readFile(filePath)).resolves.toEqual(buffer);
    } finally {
      await rm(uploadRoot, { recursive: true, force: true });
    }
  });

  it("converts accepted profile audio formats to MP3", async () => {
    const uploadRoot = await mkdtemp(path.join(tmpdir(), "thia-uploads-"));
    const toolRoot = await mkdtemp(path.join(tmpdir(), "thia-upload-tools-"));

    try {
      const { ffmpegPath, ffprobePath, outputBytes } = await fakeAudioConversionTools(toolRoot);
      const service = createUploadService({
        uploadRoot,
        publicPrefix: "/uploads",
        ffmpegPath,
        ffprobePath,
      });
      const wavHeader = Buffer.from("RIFF$\x00\x00\x00WAVEfmt ", "binary");

      const result = await service.store("audio", multipartFile(wavHeader, "profile_music", "fixture.wav"));
      const match = /^\/uploads\/media\/([0-9]{4})\/([0-9]{2})\/profile_music-[a-f0-9]{32}\.mp3$/u.exec(
        result.url,
      );

      expect(match).not.toBeNull();
      expect(result).toMatchObject({
        duration: 12.5,
        mime: "audio/mpeg",
        type: "audio/mpeg",
        size: outputBytes.length,
        purpose: "profile_music",
        mediaType: "audio",
      });

      const filePath = path.join(uploadRoot, result.url.replace(/^\/uploads\//u, ""));

      await expect(readFile(filePath)).resolves.toEqual(outputBytes);
    } finally {
      await rm(uploadRoot, { recursive: true, force: true });
      await rm(toolRoot, { recursive: true, force: true });
    }
  });

  it("preserves multipart limit errors for route-level 413 handling", async () => {
    const service = createUploadService({
      uploadRoot: "/tmp/thia-unused-uploads",
      publicPrefix: "/uploads",
    });
    const limitError = Object.assign(new Error("too large"), {
      code: "FST_REQ_FILE_TOO_LARGE",
    });

    await expect(service.store("image", multipartFileError(limitError, "post_media"))).rejects.toBe(limitError);
  });
});

function sharpColorImage(): Sharp {
  return sharp({
    create: {
      width: 2,
      height: 3,
      channels: 3,
      background: "#ff00aa",
    },
  });
}

function bmpFixture(): Buffer {
  const width = 2;
  const height = 3;
  const rowStride = Math.ceil((width * 3) / 4) * 4;
  const pixelBytes = rowStride * height;
  const fileHeaderBytes = 14;
  const dibHeaderBytes = 40;
  const pixelOffset = fileHeaderBytes + dibHeaderBytes;
  const buffer = Buffer.alloc(pixelOffset + pixelBytes);

  buffer.write("BM", 0, "ascii");
  buffer.writeUInt32LE(buffer.byteLength, 2);
  buffer.writeUInt32LE(pixelOffset, 10);
  buffer.writeUInt32LE(dibHeaderBytes, 14);
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(height, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(0, 30);
  buffer.writeUInt32LE(pixelBytes, 34);

  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const offset = pixelOffset + row * rowStride + column * 3;

      buffer[offset] = 0xaa;
      buffer[offset + 1] = 0x00;
      buffer[offset + 2] = 0xff;
    }
  }

  return buffer;
}

function multipartFile(buffer: Buffer, purpose: string, filename = "upload.bin"): MultipartFile {
  return {
    filename,
    fields: {
      purpose: {
        value: purpose,
      },
    },
    toBuffer: async () => buffer,
  } as unknown as MultipartFile;
}

function multipartFileError(error: Error, purpose: string): MultipartFile {
  return {
    fields: {
      purpose: {
        value: purpose,
      },
    },
    toBuffer: async () => {
      throw error;
    },
  } as unknown as MultipartFile;
}

async function fakeAudioConversionTools(
  directory: string,
): Promise<{ ffmpegPath: string; ffprobePath: string; outputBytes: Buffer }> {
  const outputBytes = Buffer.from([0xff, 0xfb, 0x90, 0x64, 0x00, 0x0f, 0xf0, 0x00]);
  const ffmpegPath = path.join(directory, "ffmpeg");
  const ffprobePath = path.join(directory, "ffprobe");

  await writeFile(
    ffmpegPath,
    `#!/usr/bin/env node
const { writeFileSync } = require("node:fs");
const output = process.argv[process.argv.length - 1];
writeFileSync(output, Buffer.from(${JSON.stringify(Array.from(outputBytes))}));
`,
    { mode: 0o755 },
  );
  await writeFile(
    ffprobePath,
    `#!/usr/bin/env node
process.stdout.write(JSON.stringify({
  format: { duration: "12.5" },
  streams: [{ codec_type: "audio", duration: "12.5" }]
}));
`,
    { mode: 0o755 },
  );
  await chmod(ffmpegPath, 0o755);
  await chmod(ffprobePath, 0o755);

  return { ffmpegPath, ffprobePath, outputBytes };
}
