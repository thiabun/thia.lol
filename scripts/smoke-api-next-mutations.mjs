#!/usr/bin/env node

const baseUrl = (process.env.BASE_URL ?? "https://thia.lol").replace(/\/+$/u, "");

if (process.env.THIA_MUTATION_SMOKE !== "1") {
  console.error("Set THIA_MUTATION_SMOKE=1 to run controlled write smoke checks.");
  process.exit(2);
}

const prefix = process.env.THIA_MUTATION_SMOKE_PREFIX ?? `codexmut${Date.now().toString(36)}`;
const password = `CodexSmoke-${prefix}-12345`;
const created = {
  rooms: [],
  posts: [],
};

async function api(path, options = {}) {
  const headers = {
    accept: "application/json",
    ...(options.body === undefined ? {} : { "content-type": "application/json" }),
    ...(options.session === undefined
      ? {}
      : {
          cookie: options.session.cookie,
          "x-csrf-token": options.session.csrfToken,
        }),
  };
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: "manual",
  });
  const text = await response.text();
  let json;

  try {
    json = text === "" ? null : JSON.parse(text);
  } catch {
    throw new Error(`${options.method ?? "GET"} ${path} returned non-JSON HTTP ${response.status}: ${text.slice(0, 240)}`);
  }

  const expected = options.expected ?? 200;

  if (response.status !== expected || json?.ok !== true) {
    throw new Error(`${options.method ?? "GET"} ${path} expected HTTP ${expected} ok:true, got HTTP ${response.status}: ${text.slice(0, 500)}`);
  }

  return {
    response,
    data: json.data,
  };
}

function sessionCookie(response) {
  const raw = response.headers.get("set-cookie") ?? "";
  const [cookie] = raw.split(";", 1);

  if (!cookie.includes("=")) {
    throw new Error("Auth response did not include a session cookie.");
  }

  return cookie;
}

async function registerUser(suffix, displayName) {
  const handle = `${prefix}${suffix}`;
  const { response, data } = await api("/api-next/auth/register", {
    method: "POST",
    expected: 201,
    body: {
      email: `${handle}@example.com`,
      handle,
      displayName,
      password,
    },
  });

  return {
    handle,
    userId: data.user.id,
    csrfToken: data.csrfToken,
    cookie: sessionCookie(response),
  };
}

async function cleanupWithApi(owner, friend, roomSlug) {
  for (const postId of created.posts.toReversed()) {
    await api(`/api-next/posts/${postId}`, {
      method: "DELETE",
      session: owner,
      body: {},
    }).catch((error) => {
      console.warn(`WARN post cleanup failed for ${postId}: ${error.message}`);
    });
  }

  if (roomSlug !== null) {
    await api(`/api-next/rooms/${roomSlug}/join`, {
      method: "DELETE",
      session: friend,
      body: {},
    }).catch(() => undefined);
    await api(`/api-next/rooms/${roomSlug}`, {
      method: "DELETE",
      session: owner,
      body: {},
    }).catch((error) => {
      console.warn(`WARN room cleanup failed for ${roomSlug}: ${error.message}`);
    });
  }

  for (const session of [owner, friend]) {
    await api("/api-next/auth/logout", {
      method: "POST",
      session,
      body: {},
    }).catch(() => undefined);
  }
}

async function main() {
  console.log(`Using smoke prefix ${prefix}`);
  const owner = await registerUser("a", "Codex Mutation A");
  const friend = await registerUser("b", "Codex Mutation B");
  const target = await registerUser("c", "Codex Mutation C");
  let roomSlug = null;

  try {
    await api("/api-next/me/privacy", {
      method: "PATCH",
      session: friend,
      body: {
        profileVisibility: "private",
      },
    });
    await api("/api-next/me/privacy", {
      method: "PATCH",
      session: target,
      body: {
        profileVisibility: "private",
      },
    });

    await api(`/api-next/profiles/${friend.handle}/follow`, {
      method: "POST",
      session: owner,
      body: {},
    });
    const friendRequests = await api("/api-next/me/follow-requests", {
      session: friend,
    });
    const friendRequest = friendRequests.data.find((request) => request.user.handle === owner.handle);

    if (friendRequest === undefined) {
      throw new Error("Expected pending follow request for friend account.");
    }

    await api(`/api-next/me/follow-requests/${friendRequest.id}/approve`, {
      method: "POST",
      session: friend,
      body: {},
    });

    await api(`/api-next/profiles/${target.handle}/follow`, {
      method: "POST",
      session: owner,
      body: {},
    });
    const targetRequests = await api("/api-next/me/follow-requests", {
      session: target,
    });
    const targetRequest = targetRequests.data.find((request) => request.user.handle === owner.handle);

    if (targetRequest === undefined) {
      throw new Error("Expected pending follow request for target account.");
    }

    await api(`/api-next/me/follow-requests/${targetRequest.id}`, {
      method: "DELETE",
      session: target,
      body: {},
    });

    await api(`/api-next/profiles/${owner.handle}/follow`, {
      method: "POST",
      session: friend,
      body: {},
    });
    await api(`/api-next/profiles/${target.handle}/mute`, {
      method: "POST",
      session: owner,
      body: {},
    });
    await api(`/api-next/profiles/${target.handle}/mute`, {
      method: "DELETE",
      session: owner,
      body: {},
    });
    await api(`/api-next/profiles/${target.handle}/block`, {
      method: "POST",
      session: owner,
      body: {},
    });
    await api(`/api-next/profiles/${target.handle}/block`, {
      method: "DELETE",
      session: owner,
      body: {},
    });
    await api(`/api-next/profiles/${friend.handle}/star`, {
      method: "POST",
      session: owner,
      body: {},
    });
    await api(`/api-next/profiles/${friend.handle}/star`, {
      method: "DELETE",
      session: owner,
      body: {},
    });
    await api(`/api-next/profiles/${owner.handle}/follow`, {
      method: "POST",
      session: target,
      body: {},
    });
    await api(`/api-next/profiles/${target.handle}/follower`, {
      method: "DELETE",
      session: owner,
      body: {},
    });

    const createdPost = await api("/api-next/posts", {
      method: "POST",
      expected: 201,
      session: owner,
      body: {
        body: `Node mutation smoke ${prefix}`,
        mood: "sunveil",
      },
    });
    const postId = createdPost.data.id;

    created.posts.push(postId);

    await api(`/api-next/posts/${postId}/like`, {
      method: "POST",
      session: friend,
      body: {},
    });
    await api(`/api-next/posts/${postId}/like`, {
      method: "DELETE",
      session: friend,
      body: {},
    });
    await api(`/api-next/posts/${postId}/reactions`, {
      method: "POST",
      session: friend,
      body: {
        type: "echo",
      },
    });
    await api(`/api-next/posts/${postId}/reactions/echo`, {
      method: "DELETE",
      session: friend,
      body: {},
    });
    await api(`/api-next/posts/${postId}/reblog`, {
      method: "POST",
      session: friend,
      body: {},
    });
    await api(`/api-next/posts/${postId}/reblog`, {
      method: "DELETE",
      session: friend,
      body: {},
    });
    const reply = await api(`/api-next/posts/${postId}/replies`, {
      method: "POST",
      expected: 201,
      session: owner,
      body: {
        body: `Reply from ${prefix}`,
      },
    });
    created.posts.push(reply.data.id);
    await api(`/api-next/posts/${postId}`, {
      method: "PATCH",
      session: owner,
      body: {
        body: `Node mutation smoke ${prefix} edited`,
      },
    });
    await api(`/api-next/posts/${createdPost.data.publicId}/shares/messages`, {
      method: "POST",
      expected: 201,
      session: owner,
      body: {
        recipientUserIds: [friend.userId],
        note: "Smoke share",
      },
    });

    roomSlug = `${prefix}-room`;
    created.rooms.push(roomSlug);
    await api("/api-next/rooms", {
      method: "POST",
      expected: 201,
      session: owner,
      body: {
        name: `Codex ${prefix}`,
        slug: roomSlug,
        summary: "Temporary room for Node mutation smoke.",
        visibility: "public",
      },
    });
    await api(`/api-next/rooms/${roomSlug}/join`, {
      method: "POST",
      session: friend,
      body: {},
    });
    await api(`/api-next/rooms/${roomSlug}/moderators`, {
      method: "POST",
      session: owner,
      body: {
        handle: friend.handle,
      },
    });
    await api(`/api-next/rooms/${roomSlug}/moderators`, {
      method: "DELETE",
      session: owner,
      body: {
        handle: friend.handle,
      },
    });
    await api(`/api-next/rooms/${roomSlug}/join`, {
      method: "DELETE",
      session: friend,
      body: {},
    });

    console.log("OK controlled mutation smoke passed");
  } finally {
    await cleanupWithApi(owner, friend, roomSlug);
    console.log(`Cleanup note: remove throwaway users with handle prefix '${prefix}' after this script if account cleanup is desired.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
