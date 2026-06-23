#!/usr/bin/env node

const baseUrl = (process.env.BASE_URL || "https://thia.lol").replace(/\/+$/, "");

const routePairs = [
  ["/api/rooms", "/api-next/rooms"],
  ["/api/rooms/general", "/api-next/rooms/general"],
  ["/api/stats", "/api-next/stats"],
  ["/api/profiles/thia", "/api-next/profiles/thia"],
];

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
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      accept: "application/json",
    },
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
