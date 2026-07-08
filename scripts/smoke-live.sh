#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://thia.lol}"
BASE_URL="${BASE_URL%/}"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

check_http_200() {
  local path="$1"
  local body_file="$tmp_dir/$(printf '%s' "$path" | tr -c 'A-Za-z0-9' '_')"
  local status

  status="$(curl --location --silent --show-error --output "$body_file" --write-out '%{http_code}' --max-time 20 "$BASE_URL$path")"

  if [[ "$status" != "200" ]]; then
    echo "Expected HTTP 200 for $path, got $status" >&2
    echo "Response body:" >&2
    sed -n '1,80p' "$body_file" >&2
    exit 1
  fi

  echo "OK $path returned HTTP 200"
}

check_json_ok() {
  local path="$1"
  local body_file="$tmp_dir/$(printf '%s' "$path" | tr -c 'A-Za-z0-9' '_')"

  check_http_200 "$path"

  if ! grep -Eq '"ok"[[:space:]]*:[[:space:]]*true' "$body_file"; then
    echo "Expected JSON containing \"ok\":true for $path" >&2
    echo "Response body:" >&2
    sed -n '1,80p' "$body_file" >&2
    exit 1
  fi

  echo "OK $path returned JSON ok:true"
}

check_profile_share_meta() {
  local path="$1"
  local handle="$2"
  local body_file="$tmp_dir/$(printf '%s' "$path-profile-meta" | tr -c 'A-Za-z0-9' '_')"
  local status

  status="$(
    curl \
      --user-agent "facebookexternalhit/1.1" \
      --silent \
      --show-error \
      --output "$body_file" \
      --write-out '%{http_code}' \
      --max-time 20 \
      "$BASE_URL$path"
  )"

  if [[ "$status" != "200" ]]; then
    echo "Expected HTTP 200 for $path, got $status" >&2
    echo "Response body:" >&2
    sed -n '1,80p' "$body_file" >&2
    exit 1
  fi

  node - "$body_file" "$path" "$handle" <<'NODE'
const { readFileSync } = await import("node:fs");

const [, , bodyPath, requestPath, handle] = process.argv;
const html = readFileSync(bodyPath, "utf8");

function readAttribute(tag, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = tag.match(pattern);

  return match?.[2] ?? match?.[3] ?? match?.[4] ?? "";
}

function metaContent(key) {
  const normalizedKey = key.toLowerCase();

  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const name = readAttribute(tag, "name").toLowerCase();
    const property = readAttribute(tag, "property").toLowerCase();

    if (name === normalizedKey || property === normalizedKey) {
      return readAttribute(tag, "content");
    }
  }

  return "";
}

const normalizedHandle = handle.trim().toLowerCase();
const encodedNormalizedHandle = encodeURIComponent(normalizedHandle);
const image = metaContent("og:image");
const validGeneratedImagePaths = [
  `/api/profiles/${encodeURIComponent(handle)}/share-card.png`,
];
const cachedScreenshotPattern = new RegExp(
  `/uploads/share-cards/profiles/${encodedNormalizedHandle}-screenshot-v[0-9]+\\.jpg(?:[?#]|$)`,
);
const failures = [];

if (metaContent("og:type") !== "profile") {
  failures.push(`expected og:type=profile, got ${metaContent("og:type") || "missing"}`);
}

if (metaContent("profile:username").toLowerCase() !== normalizedHandle) {
  failures.push(`expected profile:username=${normalizedHandle}, got ${metaContent("profile:username") || "missing"}`);
}

if (image.includes("/brand/thia-og")) {
  failures.push(`expected generated profile share-card image, got fallback ${image}`);
}

if (!validGeneratedImagePaths.some((path) => image.includes(path)) && !cachedScreenshotPattern.test(image)) {
  failures.push(`expected og:image to reference a frontend-rendered profile share card, got ${image || "missing"}`);
}

if (metaContent("og:image:width") !== "2400" || metaContent("og:image:height") !== "1260") {
  failures.push(
    `expected 2400x1260 image metadata, got ${metaContent("og:image:width") || "missing"}x${metaContent("og:image:height") || "missing"}`,
  );
}

if (failures.length > 0) {
  console.error(`Profile share metadata check failed for ${requestPath}:`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`OK ${requestPath} profile OG image uses ${image}`);
NODE
}

check_http_200 "/"
check_http_200 "/discover"
check_http_200 "/rooms"
check_profile_share_meta "/@thia" "thia"
check_http_200 "/deploy-meta.json"

check_json_ok "/api/health"
check_json_ok "/api/health?db=1"
check_json_ok "/api/profiles/thia"
check_json_ok "/api/rooms"
check_json_ok "/api/rooms/general/members"
check_json_ok "/api/search?q=thia"
check_json_ok "/api/badges"
check_json_ok "/api/posts"
