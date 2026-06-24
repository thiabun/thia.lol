#!/usr/bin/env node

const baseUrl = (process.env.BASE_URL || "https://thia.lol").replace(/\/+$/, "");
const cookieHeader = process.env.COOKIE_HEADER || "";

const routePairs = [
  ["/api/rooms", "/api-next/rooms"],
  ["/api/rooms/general", "/api-next/rooms/general"],
  ["/api/rooms/general/members", "/api-next/rooms/general/members"],
  ["/api/search?q=thia", "/api-next/search?q=thia"],
  ["/api/badges", "/api-next/badges"],
  ["/api/stats", "/api-next/stats"],
  ["/api/profiles/thia", "/api-next/profiles/thia"],
  ["/api/profiles/thia/rooms", "/api-next/profiles/thia/rooms"],
  ["/api/profiles/thia/modules", "/api-next/profiles/thia/modules"],
  ["/api/profiles/thia/badges", "/api-next/profiles/thia/badges"],
  ["/api/profiles/thia/followers", "/api-next/profiles/thia/followers"],
  ["/api/profiles/thia/following", "/api-next/profiles/thia/following"],
  ["/api/posts", "/api-next/posts"],
  ["/api/rooms/general/posts", "/api-next/rooms/general/posts"],
  ["/api/profiles/thia/posts", "/api-next/profiles/thia/posts"],
  ["/api/profiles/thia/replies", "/api-next/profiles/thia/replies"],
  ["/api/profiles/thia/reblogs", "/api-next/profiles/thia/reblogs"],
  ["/api/feed/home", "/api-next/feed/home"],
  ["/api/feed/discover", "/api-next/feed/discover"],
];

if (cookieHeader !== "") {
  routePairs.push(
    ["/api/auth/me", "/api-next/auth/me"],
    ["/api/me/settings", "/api-next/me/settings"],
    ["/api/me/onboarding", "/api-next/me/onboarding"],
    ["/api/me/follow-requests", "/api-next/me/follow-requests"],
    ["/api/me/posts", "/api-next/me/posts"],
    ["/api/me/integrations", "/api-next/me/integrations"],
    ["/api/me/integrations/diagnostics", "/api-next/me/integrations/diagnostics"],
    ["/api/notifications", "/api-next/notifications"],
  );
}

const postsIndex = await fetchJson("/api/posts");
const postAnchor = firstPostAnchor(postsIndex.body);

if (postAnchor !== null) {
  routePairs.push(
    [`/api/posts/${encodeURIComponent(postAnchor.publicIdentifier)}`, `/api-next/posts/${encodeURIComponent(postAnchor.publicIdentifier)}`],
    [`/api/posts/${postAnchor.id}/replies`, `/api-next/posts/${postAnchor.id}/replies`],
  );
}

let failed = false;

for (const [phpPath, nodePath] of routePairs) {
  const php = await fetchJson(phpPath);
  const node = await fetchJson(nodePath);
  const label = `${phpPath} vs ${nodePath}`;

  if (php.status !== node.status) {
    failed = true;
    console.error(`FAIL ${label}: HTTP ${php.status} != ${node.status}`);
    continue;
  }

  if (!deepEqual(php.body, node.body)) {
    failed = true;
    console.error(`FAIL ${label}: JSON payloads differ`);
    console.error("PHP:", JSON.stringify(php.body, null, 2));
    console.error("Node:", JSON.stringify(node.body, null, 2));
    continue;
  }

  console.log(`OK ${label}`);
}

if (failed) {
  process.exit(1);
}

async function fetchJson(path) {
  const headers = {
    accept: "application/json",
  };

  if (cookieHeader !== "") {
    headers.cookie = cookieHeader;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    headers,
  });
  const text = await response.text();

  try {
    return {
      status: response.status,
      body: JSON.parse(text),
    };
  } catch (error) {
    throw new Error(`Expected JSON from ${path}, got: ${text.slice(0, 300)}`, {
      cause: error,
    });
  }
}

function firstPostAnchor(body) {
  const posts = body?.data;

  if (!Array.isArray(posts)) {
    return null;
  }

  for (const post of posts) {
    if (post === null || typeof post !== "object") {
      continue;
    }

    const id = post.id;
    const publicId = post.publicId;

    if (Number.isInteger(id) && id > 0) {
      return {
        id,
        publicIdentifier: typeof publicId === "string" && publicId !== "" ? publicId : String(id),
      };
    }
  }

  return null;
}

function deepEqual(left, right) {
  return JSON.stringify(sortJson(left)) === JSON.stringify(sortJson(right));
}

function sortJson(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sortJson(item));
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, childValue]) => [key, sortJson(childValue)]),
    );
  }

  return value;
}
