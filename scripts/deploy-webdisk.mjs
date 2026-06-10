#!/usr/bin/env node

import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const distDir = path.join(root, "dist");
const apiDir = path.join(root, "api");
const migrationsDir = path.join(root, "backend", "database", "migrations");
const defaultWebDiskPath = "/Volumes/thia.lol/public_html";
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run") || process.env.THIA_DEPLOY_DRY_RUN === "1";
const destinationArg = args.find((arg) => !arg.startsWith("--"));
const destinationInput = destinationArg ?? process.env.THIA_WEB_DISK_PATH ?? defaultWebDiskPath;

const skipped = [];
const copied = [];
const removed = [];

const destinationRoot = path.resolve(destinationInput);

await assertLooksLikePublicHtml(destinationRoot);
await assertDistExists();
await assertRealDestinationWhenWriting(destinationRoot);

const apiDestination = path.join(destinationRoot, "api");
const migrationDestination = path.join(apiDestination, "migrations");

logHeader();
await cleanFrontendAssets(destinationRoot);
await copyDist();
await copyApi();
await copyMigrations();
printSummary();

async function assertLooksLikePublicHtml(destination) {
  const isNamedPublicHtml = path.basename(destination) === "public_html";
  const isKnownWebDiskVolume = destination === path.resolve(defaultWebDiskPath);

  if (!isNamedPublicHtml && !isKnownWebDiskVolume) {
    fail(
      `Destination must be public_html or the known Web Disk volume ${defaultWebDiskPath}: ${destination}`,
    );
  }
}

async function assertDistExists() {
  try {
    const stat = await fs.stat(distDir);

    if (!stat.isDirectory()) {
      fail(`dist exists but is not a directory: ${distDir}`);
    }
  } catch {
    fail("dist/ does not exist. Run npm run build before deploying.");
  }
}

async function assertRealDestinationWhenWriting(destination) {
  if (dryRun) {
    return;
  }

  try {
    const stat = await fs.stat(destination);

    if (!stat.isDirectory()) {
      fail(`Destination exists but is not a directory: ${destination}`);
    }
  } catch {
    fail(`Destination does not exist: ${destination}`);
  }

  await fs.access(destination, fsConstants.W_OK).catch(() => {
    fail(`Destination is not writable: ${destination}`);
  });
}

function logHeader() {
  console.log(`Web Disk deploy ${dryRun ? "(dry run)" : "(write mode)"}`);
  console.log(`Frontend source: ${distDir}`);
  console.log(`API source: ${apiDir}`);
  console.log(`Migration source: ${migrationsDir}`);
  console.log(`public_html destination: ${destinationRoot}`);
  console.log(`API destination: ${apiDestination}`);
  console.log(`Migration destination: ${migrationDestination}`);

  if (dryRun) {
    console.log("No files will be changed.");
  }

  console.log("");
}

async function cleanFrontendAssets(destination) {
  const assetsDestination = path.join(destination, "assets");

  if (!(await exists(path.join(distDir, "assets")))) {
    skip("dist/assets", "no dist assets folder found");
    return;
  }

  if (!(await exists(assetsDestination))) {
    skip("public_html/assets", "no existing assets folder to remove");
    return;
  }

  assertInsideDestination(assetsDestination);
  removed.push(relativeTo(destination, assetsDestination));
  console.log(`Remove: ${relativeTo(destination, assetsDestination)}`);

  if (!dryRun) {
    await fs.rm(assetsDestination, { recursive: true, force: true });
  }
}

async function copyDist() {
  const files = await listFiles(distDir);

  for (const source of files) {
    const relativePath = relativeTo(distDir, source);

    if (shouldSkip(relativePath)) {
      skip(`dist/${relativePath}`, "protected or local-only file");
      continue;
    }

    await copyFile(source, path.join(destinationRoot, relativePath));
  }
}

async function copyApi() {
  const files = await listFiles(apiDir);

  for (const source of files) {
    const relativePath = relativeTo(apiDir, source);

    if (shouldSkip(relativePath)) {
      skip(`api/${relativePath}`, "protected or local-only file");
      continue;
    }

    await copyFile(source, path.join(apiDestination, relativePath));
  }
}

async function copyMigrations() {
  if (!(await exists(migrationsDir))) {
    skip("backend/database/migrations", "no migrations folder found");
    return;
  }

  const files = await listFiles(migrationsDir);

  for (const source of files) {
    const relativePath = relativeTo(migrationsDir, source);

    if (shouldSkip(relativePath)) {
      skip(`backend/database/migrations/${relativePath}`, "protected or local-only file");
      continue;
    }

    if (path.extname(source) !== ".sql") {
      skip(`backend/database/migrations/${relativePath}`, "only .sql migrations are copied");
      continue;
    }

    await copyFile(source, path.join(migrationDestination, path.basename(source)));
  }
}

async function copyFile(source, destination) {
  assertInsideDestination(destination);
  copied.push(`${relativeTo(root, source)} -> ${relativeTo(destinationRoot, destination)}`);
  console.log(
    `Copy: ${relativeTo(root, source)} -> ${relativeTo(destinationRoot, destination)}`,
  );

  if (dryRun) {
    return;
  }

  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
  const sourceStat = await fs.stat(source);
  await fs.chmod(destination, sourceStat.mode);
}

async function listFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function shouldSkip(relativePath) {
  const normalized = toPosix(relativePath);
  const segments = normalized.split("/");
  const basename = segments.at(-1) ?? "";

  return (
    basename === ".DS_Store" ||
    basename === "config.php" ||
    basename === ".env" ||
    basename.startsWith(".env.") ||
    basename === "secrets.json" ||
    basename.endsWith(".pem") ||
    basename.endsWith(".key") ||
    segments.includes("config")
  );
}

function assertInsideDestination(target) {
  const relativePath = path.relative(destinationRoot, path.resolve(target));

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    fail(`Refusing to write outside public_html: ${target}`);
  }
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function skip(filePath, reason) {
  skipped.push(`${filePath} (${reason})`);
  console.log(`Skip: ${filePath} - ${reason}`);
}

function printSummary() {
  console.log("");
  console.log("Summary");
  console.log(`Copied: ${copied.length}`);
  console.log(`Removed: ${removed.length}`);
  console.log(`Skipped: ${skipped.length}`);

  if (skipped.length > 0) {
    console.log("");
    console.log("Skipped files");

    for (const item of skipped) {
      console.log(`- ${item}`);
    }
  }
}

function relativeTo(from, target) {
  const relativePath = path.relative(from, target);

  return toPosix(relativePath || ".");
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function fail(message) {
  console.error(`Web Disk deploy refused: ${message}`);
  process.exit(1);
}
