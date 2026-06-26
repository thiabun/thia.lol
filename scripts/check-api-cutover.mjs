#!/usr/bin/env node

const baseUrl = (process.env.BASE_URL || "https://thia.lol").replace(/\/+$/, "");
const cookieHeader = process.env.COOKIE_HEADER || "";
const runtimeHeader = "x-thia-api-runtime";
const privateReadStatus = cookieHeader === "" ? 401 : 200;
const privateMutationStatus = cookieHeader === "" ? 401 : 403;

const jsonRoutes = [
  ["GET", "/api/health", 200],
  ["GET", "/api/health?db=1", 200],
  ["GET", "/api/rooms", 200],
  ["GET", "/api/rooms/general", 200],
  ["GET", "/api/rooms/general/members", 200],
  ["GET", "/api/search?q=thia", 200],
  ["GET", "/api/badges", 200],
  ["GET", "/api/stats", 200],
  ["GET", "/api/profiles/thia", 200],
  ["GET", "/api/profiles/thia/rooms", 200],
  ["GET", "/api/profiles/thia/modules", 200],
  ["GET", "/api/profiles/thia/badges", 200],
  ["GET", "/api/profiles/thia/followers", 200],
  ["GET", "/api/profiles/thia/following", 200],
  ["GET", "/api/posts", 200],
  ["GET", "/api/rooms/general/posts", 200],
  ["GET", "/api/profiles/thia/posts", 200],
  ["GET", "/api/profiles/thia/replies", 200],
  ["GET", "/api/profiles/thia/reblogs", 200],
  ["GET", "/api/feed/home", 200],
  ["GET", "/api/feed/discover", 200],
  ["GET", "/api/auth/me", privateReadStatus],
  ["GET", "/api/me/settings", privateReadStatus],
  ["GET", "/api/me/onboarding", privateReadStatus],
  ["GET", "/api/me/follow-requests", privateReadStatus],
  ["GET", "/api/me/posts", privateReadStatus],
  ["GET", "/api/me/profile/modules", privateReadStatus],
  ["GET", "/api/me/profile/canvas-draft", privateReadStatus],
  ["GET", "/api/me/integrations", privateReadStatus],
  ["GET", "/api/me/integrations/diagnostics", privateReadStatus],
  ["GET", "/api/notifications", privateReadStatus],
  ["GET", "/api/me/push", 401],
  ["GET", "/api/chat/conversations", 401],
  ["GET", "/api/chat/moots", 401],
  ["GET", "/api/chat/conversations/1/messages", 401],
  ["GET", "/api/admin/reports", 401],
  ["GET", "/api/admin/rooms", 401],
  ["GET", "/api/admin/growth", 401],
  ["GET", "/api/admin/migrations/status", 401],
  ["GET", "/api/me/integrations/github/suggestions", 401],
  ["GET", "/api/__definitely_not_real__", 404],
  ["POST", "/api/notifications/read", privateMutationStatus],
  ["POST", "/api/notifications/read-all", privateMutationStatus],
  ["POST", "/api/notifications/1/read", privateMutationStatus],
  ["PATCH", "/api/me/onboarding", privateMutationStatus],
  ["PATCH", "/api/me/privacy", privateMutationStatus],
  ["PATCH", "/api/me/preferences", privateMutationStatus],
  ["POST", "/api/profiles/thia/follow", privateMutationStatus],
  ["DELETE", "/api/profiles/thia/follow", privateMutationStatus],
  ["POST", "/api/profiles/thia/block", privateMutationStatus],
  ["DELETE", "/api/profiles/thia/block", privateMutationStatus],
  ["POST", "/api/profiles/thia/mute", privateMutationStatus],
  ["DELETE", "/api/profiles/thia/mute", privateMutationStatus],
  ["POST", "/api/profiles/thia/star", privateMutationStatus],
  ["DELETE", "/api/profiles/thia/star", privateMutationStatus],
  ["DELETE", "/api/profiles/thia/follower", privateMutationStatus],
  ["POST", "/api/me/follow-requests/1/approve", privateMutationStatus],
  ["DELETE", "/api/me/follow-requests/1", privateMutationStatus],
  ["POST", "/api/posts", privateMutationStatus],
  ["POST", "/api/posts/99/replies", privateMutationStatus],
  ["PATCH", "/api/posts/99", privateMutationStatus],
  ["DELETE", "/api/posts/99", privateMutationStatus],
  ["POST", "/api/posts/99/like", privateMutationStatus],
  ["DELETE", "/api/posts/99/like", privateMutationStatus],
  ["POST", "/api/posts/99/reblog", privateMutationStatus],
  ["DELETE", "/api/posts/99/reblog", privateMutationStatus],
  ["POST", "/api/posts/99/reactions", privateMutationStatus],
  ["DELETE", "/api/posts/99/reactions/glow", privateMutationStatus],
  ["POST", "/api/posts/pc359fe2da759/shares/messages", privateMutationStatus],
  ["POST", "/api/rooms", privateMutationStatus],
  ["PATCH", "/api/rooms/general", privateMutationStatus],
  ["DELETE", "/api/rooms/general", privateMutationStatus],
  ["POST", "/api/rooms/general/join", privateMutationStatus],
  ["DELETE", "/api/rooms/general/join", privateMutationStatus],
  ["POST", "/api/rooms/general/moderators", privateMutationStatus],
  ["DELETE", "/api/rooms/general/moderators", privateMutationStatus],
  ["PATCH", "/api/me/profile", privateMutationStatus],
  ["PATCH", "/api/me/profile/featured", privateMutationStatus],
  ["POST", "/api/me/profile/modules", privateMutationStatus],
  ["PATCH", "/api/me/profile/modules/1", privateMutationStatus],
  ["DELETE", "/api/me/profile/modules/1", privateMutationStatus],
  ["POST", "/api/me/profile/modules/1/restore", privateMutationStatus],
  ["PATCH", "/api/me/profile/module-order", privateMutationStatus],
  ["PATCH", "/api/me/profile/canvas", privateMutationStatus],
  ["PATCH", "/api/me/profile/canvas-draft", privateMutationStatus],
  ["DELETE", "/api/me/profile/canvas-draft", privateMutationStatus],
  ["POST", "/api/me/profile/canvas-draft/commit", privateMutationStatus],
  ["PATCH", "/api/me/badges/featured", privateMutationStatus],
  ["DELETE", "/api/me/posts?kind=posts", privateMutationStatus],
  ["PATCH", "/api/me/account/email", privateMutationStatus],
  ["PATCH", "/api/me/account/handle", privateMutationStatus],
  ["PATCH", "/api/me/account/password", privateMutationStatus],
  ["DELETE", "/api/me/account", privateMutationStatus],
  ["DELETE", "/api/me/account/deletion", privateMutationStatus],
  ["POST", "/api/me/account/deletion/cancel", privateMutationStatus],
  ["POST", "/api/me/profile", privateMutationStatus],
  ["POST", "/api/uploads/image", privateMutationStatus],
  ["POST", "/api/uploads/video", privateMutationStatus],
  ["POST", "/api/uploads/audio", privateMutationStatus],
  ["POST", "/api/posts/pc359fe2da759/share-card-cache", privateMutationStatus],
  ["POST", "/api/profiles/thia/share-card-cache", privateMutationStatus],
  ["POST", "/api/chat/conversations", privateMutationStatus],
  ["POST", "/api/chat/conversations/1/messages", privateMutationStatus],
  ["POST", "/api/chat/conversations/1/read", privateMutationStatus],
  ["POST", "/api/reports", privateMutationStatus],
  ["POST", "/api/admin/posts/99/hide", privateMutationStatus],
  ["POST", "/api/admin/posts/99/remove", privateMutationStatus],
  ["POST", "/api/admin/users/1/suspend", privateMutationStatus],
  ["POST", "/api/admin/reports/1/resolve", privateMutationStatus],
  ["POST", "/api/me/push/subscriptions", privateMutationStatus],
  ["DELETE", "/api/me/push/subscriptions", privateMutationStatus],
  ["POST", "/api/me/push/test", privateMutationStatus],
  ["POST", "/api/me/integrations/github/start", privateMutationStatus],
  ["DELETE", "/api/me/integrations/github", privateMutationStatus],
  ["POST", "/api/me/integrations/metadata/resolve", privateMutationStatus],
  ["POST", "/api/admin/migrations/run", privateMutationStatus],
  ["POST", "/api/setup/thia", [403, 404]],
  ["GET", "/api/admin/auth/diagnostics", [403, 404]],
  ["GET", "/api/admin/auth/session-trace", [403, 404]],
  ["POST", "/api/auth/login", 422],
  ["POST", "/api/auth/register", 422],
  ["POST", "/api/auth/logout", 200],
  ["POST", "/api/auth/2fa/verify", 422],
  ["POST", "/api/me/security/2fa/setup", 401],
  ["POST", "/api/me/security/2fa/enable", 401],
  ["DELETE", "/api/me/security/2fa", 401],
  ["POST", "/api/me/security/2fa/recovery-codes", 401],
];

const headRoutes = [
  ["/sitemap.xml", 200],
  ["/api/sitemap.php", 200],
  ["/api/posts/pc359fe2da759/share-card.png", 200],
  ["/api/profiles/thia/share-card.png", 200],
  ["/api/rooms/general/share-card.png", 200],
  ["/api/share-card/image", 404],
];

const retiredPreviewRoutes = [
  "/api-next/health",
  "/api-next/posts",
  "/api-next/profile-share.php?handle=thia",
];

const postsIndex = await fetchJson("/api/posts");
const postAnchor = firstPostAnchor(postsIndex.body);

if (postAnchor !== null) {
  jsonRoutes.push(
    ["GET", `/api/posts/${encodeURIComponent(postAnchor.publicIdentifier)}`, 200],
    ["GET", `/api/posts/${postAnchor.id}/replies`, 200],
  );
}

const htmlRoutes = [];
const sharePostAnchor = firstPostAnchor(postsIndex.body);

if (sharePostAnchor !== null) {
  htmlRoutes.push([
    `/api/post-share.php?handle=${encodeURIComponent(sharePostAnchor.handle)}&postId=${encodeURIComponent(sharePostAnchor.publicIdentifier)}`,
    200,
  ]);
}

htmlRoutes.push(["/api/profile-share.php?handle=thia", 200]);
htmlRoutes.push(["/api/room-share.php?slug=general", 200]);

let failed = false;

for (const [method, path, expectedStatus] of jsonRoutes) {
  const response = await fetchJson(path, method);
  const label = `${method} ${path}`;

  if (!statusMatches(response.status, expectedStatus)) {
    failed = true;
    console.error(`FAIL ${label}: expected HTTP ${formatExpectedStatus(expectedStatus)}, got ${response.status}`);
    continue;
  }

  if (response.runtime !== "node") {
    failed = true;
    console.error(`FAIL ${label}: expected ${runtimeHeader}: node, got ${response.runtime ?? "missing"}`);
    continue;
  }

  console.log(`OK ${label} is Node-served`);
}

for (const [path, expectedStatus] of headRoutes) {
  const response = await fetchHead(path);
  const label = `HEAD ${path}`;

  if (!statusMatches(response.status, expectedStatus)) {
    failed = true;
    console.error(`FAIL ${label}: expected HTTP ${formatExpectedStatus(expectedStatus)}, got ${response.status}`);
    continue;
  }

  if (response.runtime !== "node") {
    failed = true;
    console.error(`FAIL ${label}: expected ${runtimeHeader}: node, got ${response.runtime ?? "missing"}`);
    continue;
  }

  console.log(`OK ${label} is Node-served`);
}

for (const [path, expectedStatus] of htmlRoutes) {
  const response = await fetchText(path);
  const label = `GET ${path}`;

  if (!statusMatches(response.status, expectedStatus)) {
    failed = true;
    console.error(`FAIL ${label}: expected HTTP ${formatExpectedStatus(expectedStatus)}, got ${response.status}`);
    continue;
  }

  if (response.runtime !== "node") {
    failed = true;
    console.error(`FAIL ${label}: expected ${runtimeHeader}: node, got ${response.runtime ?? "missing"}`);
    continue;
  }

  if (!response.body.includes("og:title")) {
    failed = true;
    console.error(`FAIL ${label}: expected social metadata HTML`);
    continue;
  }

  console.log(`OK ${label} is Node-served HTML`);
}

const redirectResponse = await fetchRedirect("/api/integrations/github/callback");

if (redirectResponse.status !== 303) {
  failed = true;
  console.error(`FAIL GET /api/integrations/github/callback: expected HTTP 303, got ${redirectResponse.status}`);
} else if (redirectResponse.runtime !== "node") {
  failed = true;
  console.error(
    `FAIL GET /api/integrations/github/callback: expected ${runtimeHeader}: node, got ${redirectResponse.runtime ?? "missing"}`,
  );
} else {
  console.log("OK GET /api/integrations/github/callback is Node-served redirect");
}

for (const path of retiredPreviewRoutes) {
  const response = await fetchText(path);
  const label = `GET ${path}`;

  if (response.status !== 404) {
    failed = true;
    console.error(`FAIL ${label}: expected retired preview HTTP 404, got ${response.status}`);
    continue;
  }

  if (response.runtime === "node") {
    failed = true;
    console.error(`FAIL ${label}: /api-next should not be served by Node`);
    continue;
  }

  console.log(`OK ${label} is retired`);
}

if (failed) {
  process.exit(1);
}

async function fetchJson(path, method = "GET", options = {}) {
  const includeCookie = options.includeCookie ?? true;
  const headers = {
    accept: "application/json",
  };

  if (includeCookie && cookieHeader !== "") {
    headers.cookie = cookieHeader;
  }

  if (method !== "GET") {
    headers["content-type"] = "application/json";
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: method === "GET" ? undefined : "{}",
  });
  const text = await response.text();

  try {
    return {
      status: response.status,
      runtime: response.headers.get(runtimeHeader),
      body: JSON.parse(text),
    };
  } catch (error) {
    throw new Error(`Expected JSON from ${method} ${path}, got: ${text.slice(0, 300)}`, {
      cause: error,
    });
  }
}

async function fetchText(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      accept: "text/html,application/xhtml+xml,text/plain",
    },
  });

  return {
    status: response.status,
    runtime: response.headers.get(runtimeHeader),
    body: await response.text(),
  };
}

async function fetchRedirect(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: "manual",
  });

  await response.arrayBuffer();

  return {
    status: response.status,
    runtime: response.headers.get(runtimeHeader),
    location: response.headers.get("location"),
  };
}

async function fetchHead(path) {
  const headers = {
    accept: "application/json",
  };

  if (cookieHeader !== "") {
    headers.cookie = cookieHeader;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: "HEAD",
    headers,
  });

  return {
    status: response.status,
    runtime: response.headers.get(runtimeHeader),
  };
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
    const handle = post.author?.handle;

    if (Number.isInteger(id) && id > 0 && typeof handle === "string" && handle !== "") {
      return {
        id,
        handle,
        publicIdentifier: typeof publicId === "string" && publicId !== "" ? publicId : String(id),
      };
    }
  }

  return null;
}

function statusMatches(actual, expected) {
  return Array.isArray(expected) ? expected.includes(actual) : actual === expected;
}

function formatExpectedStatus(expected) {
  return Array.isArray(expected) ? expected.join("/") : String(expected);
}
