import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(repoRoot, "brand", "source");
const publicDir = path.join(repoRoot, "public");
const publicBrandDir = path.join(publicDir, "brand");

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
const generated = [];

const sourceFiles = {
  appIcon: "thia-mark-pink-square.png",
  lockupFrostveil: "thia-lockup-glow.png",
  lockupSunveil: "thia-lockup-sunveil.png",
  markFrostveil: "thia-mark-frostveil-alpha.png",
  markSunveil: "thia-mark-sunveil-alpha.png",
};

await fs.mkdir(publicBrandDir, { recursive: true });

const pngAssets = [
  [sourceFiles.markSunveil, "brand/thia-mark-sunveil-96.png", {
    height: 96,
    width: 96,
  }],
  [sourceFiles.markFrostveil, "brand/thia-mark-frostveil-96.png", {
    height: 96,
    width: 96,
  }],
  [sourceFiles.lockupSunveil, "brand/thia-lockup-sunveil.png", {
    height: 160,
    width: 560,
  }],
  [sourceFiles.lockupFrostveil, "brand/thia-lockup-frostveil.png", {
    height: 320,
    width: 720,
  }],
  [sourceFiles.appIcon, "favicon-32x32.png", {
    height: 32,
    width: 32,
  }],
  [sourceFiles.appIcon, "apple-touch-icon.png", {
    height: 180,
    width: 180,
  }],
  [sourceFiles.appIcon, "brand/thia-app-icon-192.png", {
    height: 192,
    width: 192,
  }],
  [sourceFiles.appIcon, "brand/thia-app-icon-512.png", {
    height: 512,
    width: 512,
  }],
];

for (const [sourceName, outputName, size] of pngAssets) {
  await writePng(sourceName, outputName, size);
}

await writeOpenGraphImage();
await writeManifest();

console.log(
  `Generated ${generated.length} brand asset${generated.length === 1 ? "" : "s"}:\n` +
    generated.map((file) => `- ${file}`).join("\n"),
);

async function writePng(sourceName, outputName, size) {
  const outputPath = path.join(publicDir, outputName);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(path.join(sourceDir, sourceName))
    .rotate()
    .resize({
      ...size,
      background: transparent,
      fit: "contain",
      withoutEnlargement: false,
    })
    .png({ adaptiveFiltering: true, compressionLevel: 9 })
    .toFile(outputPath);

  generated.push(path.relative(repoRoot, outputPath));
}

async function writeOpenGraphImage() {
  const outputPath = path.join(publicBrandDir, "thia-og.png");
  const lockupBuffer = await sharp(path.join(sourceDir, sourceFiles.lockupFrostveil))
    .rotate()
    .resize({
      background: transparent,
      fit: "contain",
      height: 570,
      width: 1080,
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      background: "#05070b",
      channels: 4,
      height: 630,
      width: 1200,
    },
  })
    .composite([{ input: lockupBuffer, left: 60, top: 30 }])
    .png({ adaptiveFiltering: true, compressionLevel: 9 })
    .toFile(outputPath);

  generated.push(path.relative(repoRoot, outputPath));
}

async function writeManifest() {
  const outputPath = path.join(publicDir, "site.webmanifest");
  const manifest = {
    name: "thia.lol",
    short_name: "thia.lol",
    description:
      "A calm, fluid social platform for rooms, posts, profiles, and shared presence.",
    start_url: "/",
    display: "standalone",
    background_color: "#fff4df",
    theme_color: "#f48ca2",
    icons: [
      {
        src: "/brand/thia-app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/brand/thia-app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };

  await fs.writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
  generated.push(path.relative(repoRoot, outputPath));
}
