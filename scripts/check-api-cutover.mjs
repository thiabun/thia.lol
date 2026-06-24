#!/usr/bin/env node

const baseUrl = (process.env.BASE_URL || "https://thia.lol").replace(/\/+$/, "");
const cookieHeader = process.env.COOKIE_HEADER || "";
const runtimeHeader = "x-thia-api-runtime";
const privateReadStatus = cookieHeader === "" ? 401 : 200;
const privateMutationStatus = cookieHeader === "" ? 401 : 403;

const nodeCutoverPairs = [
  ["/api/rooms", "/api-next/rooms", 200],
  ["/api/rooms/general", "/api-next/rooms/general", 200],
  ["/api/rooms/general/members", "/api-next/rooms/general/members", 200],
  ["/api/search?q=thia", "/api-next/search?q=thia", 200],
  ["/api/badges", "/api-next/badges", 200],
  ["/api/stats", "/api-next/stats", 200],
  ["/api/profiles/thia", "/api-next/profiles/thia", 200],
  ["/api/profiles/thia/rooms", "/api-next/profiles/thia/rooms", 200],
  ["/api/profiles/thia/modules", "/api-next/profiles/thia/modules", 200],
  ["/api/profiles/thia/badges", "/api-next/profiles/thia/badges", 200],
  ["/api/profiles/thia/followers", "/api-next/profiles/thia/followers", 200],
  ["/api/profiles/thia/following", "/api-next/profiles/thia/following", 200],
  ["/api/posts", "/api-next/posts", 200],
  ["/api/rooms/general/posts", "/api-next/rooms/general/posts", 200],
  ["/api/profiles/thia/posts", "/api-next/profiles/thia/posts", 200],
  ["/api/profiles/thia/replies", "/api-next/profiles/thia/replies", 200],
  ["/api/profiles/thia/reblogs", "/api-next/profiles/thia/reblogs", 200],
  ["/api/feed/home", "/api-next/feed/home", 200],
  ["/api/feed/discover", "/api-next/feed/discover", 200],
  ["/api/auth/me", "/api-next/auth/me", privateReadStatus],
  ["/api/me/settings", "/api-next/me/settings", privateReadStatus],
  ["/api/me/onboarding", "/api-next/me/onboarding", privateReadStatus],
  ["/api/me/follow-requests", "/api-next/me/follow-requests", privateReadStatus],
  ["/api/me/posts", "/api-next/me/posts", privateReadStatus],
  ["/api/notifications", "/api-next/notifications", privateReadStatus],
];

const postsIndex = await fetchJson("/api-next/posts");
const postAnchor = firstPostAnchor(postsIndex.body);

if (postAnchor !== null) {
  nodeCutoverPairs.push(
    [`/api/posts/${encodeURIComponent(postAnchor.publicIdentifier)}`, `/api-next/posts/${encodeURIComponent(postAnchor.publicIdentifier)}`, 200],
    [`/api/posts/${postAnchor.id}/replies`, `/api-next/posts/${postAnchor.id}/replies`, 200],
  );
}

const phpOwnedHeadRoutes = [
  "/api/posts/99/share-card.png",
  "/api/posts/99/like",
  "/api/posts/99/reblog",
  "/api/profiles/thia/share-card.png",
  "/api/profiles/thia/follow",
  "/api/me/profile",
  "/api/uploads",
  "/api/chat",
];

const nodeMutationCutoverPairs = [
  ["POST", "/api/notifications/read", "/api-next/notifications/read", privateMutationStatus],
  ["POST", "/api/notifications/read-all", "/api-next/notifications/read-all", privateMutationStatus],
  ["POST", "/api/notifications/1/read", "/api-next/notifications/1/read", privateMutationStatus],
  ["PATCH", "/api/me/onboarding", "/api-next/me/onboarding", privateMutationStatus],
  ["PATCH", "/api/me/privacy", "/api-next/me/privacy", privateMutationStatus],
  ["PATCH", "/api/me/preferences", "/api-next/me/preferences", privateMutationStatus],
];

const nodeAuthCutoverPairs = [
  ["POST", "/api/auth/login", "/api-next/auth/login", 422],
  ["POST", "/api/auth/register", "/api-next/auth/register", 422],
  ["POST", "/api/auth/logout", "/api-next/auth/logout", 200],
  ["POST", "/api/auth/2fa/verify", "/api-next/auth/2fa/verify", 422],
  ["POST", "/api/me/security/2fa/setup", "/api-next/me/security/2fa/setup", 401],
  ["POST", "/api/me/security/2fa/enable", "/api-next/me/security/2fa/enable", 401],
  ["DELETE", "/api/me/security/2fa", "/api-next/me/security/2fa", 401],
  ["POST", "/api/me/security/2fa/recovery-codes", "/api-next/me/security/2fa/recovery-codes", 401],
];

const phpOwnedMethodRoutes = [
  ["POST", "/api/posts/99/like"],
  ["POST", "/api/posts/99/reblog"],
  ["POST", "/api/profiles/thia/follow"],
  ["POST", "/api/uploads"],
  ["POST", "/api/chat"],
];

let failed = false;

for (const [productionPath, previewPath, expectedStatus] of nodeCutoverPairs) {
  const production = await fetchJson(productionPath);
  const preview = await fetchJson(previewPath);
  const label = `${productionPath} cutover`;

  if (production.status !== expectedStatus) {
    failed = true;
    console.error(`FAIL ${label}: expected HTTP ${expectedStatus}, got ${production.status}`);
    continue;
  }

  if (production.runtime !== "node") {
    failed = true;
    console.error(`FAIL ${label}: expected ${runtimeHeader}: node, got ${production.runtime ?? "missing"}`);
    continue;
  }

  if (production.status !== preview.status || !deepEqual(production.body, preview.body)) {
    failed = true;
    console.error(`FAIL ${label}: production route does not match ${previewPath}`);
    console.error("Production:", JSON.stringify(production.body, null, 2));
    console.error("Preview:", JSON.stringify(preview.body, null, 2));
    continue;
  }

  const productionHead = await fetchHead(productionPath);
  if (productionHead.status !== expectedStatus || productionHead.runtime !== "node") {
    failed = true;
    console.error(
      `FAIL HEAD ${productionPath}: expected HTTP ${expectedStatus} with ${runtimeHeader}: node, got HTTP ${productionHead.status} and ${
        productionHead.runtime ?? "missing"
      }`,
    );
    continue;
  }

  console.log(`OK ${label} is served by Node and matches ${previewPath}`);
}

for (const [method, productionPath, previewPath, expectedStatus] of nodeMutationCutoverPairs) {
  const production = await fetchJson(productionPath, method);
  const preview = await fetchJson(previewPath, method);
  const label = `${method} ${productionPath} cutover`;

  if (production.status !== expectedStatus) {
    failed = true;
    console.error(`FAIL ${label}: expected HTTP ${expectedStatus}, got ${production.status}`);
    continue;
  }

  if (production.runtime !== "node") {
    failed = true;
    console.error(`FAIL ${label}: expected ${runtimeHeader}: node, got ${production.runtime ?? "missing"}`);
    continue;
  }

  if (production.status !== preview.status || !deepEqual(production.body, preview.body)) {
    failed = true;
    console.error(`FAIL ${label}: production route does not match ${previewPath}`);
    console.error("Production:", JSON.stringify(production.body, null, 2));
    console.error("Preview:", JSON.stringify(preview.body, null, 2));
    continue;
  }

  console.log(`OK ${label} is served by Node and matches ${previewPath} without mutating data`);
}

for (const [method, productionPath, previewPath, expectedStatus] of nodeAuthCutoverPairs) {
  const production = await fetchJson(productionPath, method, { includeCookie: false });
  const preview = await fetchJson(previewPath, method, { includeCookie: false });
  const label = `${method} ${productionPath} auth cutover`;

  if (production.status !== expectedStatus) {
    failed = true;
    console.error(`FAIL ${label}: expected HTTP ${expectedStatus}, got ${production.status}`);
    continue;
  }

  if (production.runtime !== "node") {
    failed = true;
    console.error(`FAIL ${label}: expected ${runtimeHeader}: node, got ${production.runtime ?? "missing"}`);
    continue;
  }

  if (production.status !== preview.status || !deepEqual(production.body, preview.body)) {
    failed = true;
    console.error(`FAIL ${label}: production route does not match ${previewPath}`);
    console.error("Production:", JSON.stringify(production.body, null, 2));
    console.error("Preview:", JSON.stringify(preview.body, null, 2));
    continue;
  }

  console.log(`OK ${label} is served by Node and matches ${previewPath} without using a real session`);
}

for (const path of phpOwnedHeadRoutes) {
  const headResponse = await fetchHead(path);

  if (headResponse.runtime !== null) {
    failed = true;
    console.error(`FAIL HEAD ${path}: expected PHP-owned route without ${runtimeHeader}, got ${headResponse.runtime}`);
    continue;
  }

  console.log(`OK ${path} remains PHP-owned`);
}

for (const [method, path] of phpOwnedMethodRoutes) {
  const methodResponse = await fetchMethodHeaders(path, method);

  if (methodResponse.runtime !== null) {
    failed = true;
    console.error(`FAIL ${method} ${path}: expected PHP-owned route without ${runtimeHeader}, got ${methodResponse.runtime}`);
    continue;
  }

  console.log(`OK ${method} ${path} remains PHP-owned`);
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
    throw new Error(`Expected JSON from ${path}, got: ${text.slice(0, 300)}`, {
      cause: error,
    });
  }
}

async function fetchMethodHeaders(path, method) {
  const headers = {
    accept: "application/json",
    "content-type": "application/json",
  };

  if (cookieHeader !== "") {
    headers.cookie = cookieHeader;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: "{}",
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

    if (Number.isInteger(id) && id > 0) {
      return {
        id,
        publicIdentifier: typeof publicId === "string" && publicId !== "" ? publicId : String(id),
      };
    }
  }

  return null;
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
