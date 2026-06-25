import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { MultipartFile } from "@fastify/multipart";
import sharp from "sharp";
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

      const result = await service.store("image", multipartFile(buffer, "post_media"));
      const match = /^\/uploads\/media\/([0-9]{4})\/([0-9]{2})\/post_media-[a-f0-9]{32}\.png$/u.exec(
        result.url,
      );

      expect(match).not.toBeNull();
      expect(result).toMatchObject({
        width: 2,
        height: 3,
        mime: "image/png",
        type: "image/png",
        size: buffer.byteLength,
        purpose: "post_media",
      });

      const [, year, month] = match ?? [];
      expect(year).toEqual(expect.any(String));
      expect(month).toEqual(expect.any(String));

      const filePath = path.join(uploadRoot, result.url.replace(/^\/uploads\//u, ""));
      await expect(stat(filePath)).resolves.toMatchObject({ size: buffer.byteLength });

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

function multipartFile(buffer: Buffer, purpose: string): MultipartFile {
  return {
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
