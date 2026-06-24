#!/usr/bin/env node

const baseUrl = (process.env.BASE_URL ?? "https://thia.lol").replace(/\/+$/u, "");
const apiPrefix = normalizeApiPrefix(process.env.API_PREFIX ?? "/api-next");

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
  const { response, data } = await api(`${apiPrefix}/auth/register`, {
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

async function cleanupWithApi(owner, friend, target, roomSlug) {
  for (const postId of created.posts.toReversed()) {
    await api(`${apiPrefix}/posts/${postId}`, {
      method: "DELETE",
      session: owner,
      body: {},
    }).catch((error) => {
      console.warn(`WARN post cleanup failed for ${postId}: ${error.message}`);
    });
  }

  if (roomSlug !== null) {
    await api(`${apiPrefix}/rooms/${roomSlug}/join`, {
      method: "DELETE",
      session: friend,
      body: {},
    }).catch(() => undefined);
    await api(`${apiPrefix}/rooms/${roomSlug}`, {
      method: "DELETE",
      session: owner,
      body: {},
    }).catch((error) => {
      console.warn(`WARN room cleanup failed for ${roomSlug}: ${error.message}`);
    });
  }

  for (const session of [owner, friend, target]) {
    await api(`${apiPrefix}/auth/logout`, {
      method: "POST",
      session,
      body: {},
    }).catch(() => undefined);
  }
}

function requireArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} was not an array.`);
  }

  return value;
}

function requireObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} was not an object.`);
  }

  return value;
}

function moduleIds(modules) {
  return requireArray(modules, "Profile modules")
    .map((module) => requireObject(module, "Profile module").id)
    .filter((id) => Number.isInteger(id));
}

function canvasPlacements(modules) {
  return requireArray(modules, "Profile modules").map((module, index) => {
    const record = requireObject(module, "Profile module");
    const layout = requireObject(record.layout, "Profile module layout");

    return {
      id: record.id,
      column: Math.max(1, Number(layout.column) || 1),
      row: index + 1,
      colSpan: Math.max(1, Number(layout.colSpan) || 3),
      rowSpan: Math.max(1, Number(layout.rowSpan) || 2),
      pinned: Boolean(record.pinned),
      visible: record.visibility !== "hidden",
    };
  });
}

function newestModuleId(modules, type) {
  const matches = requireArray(modules, "Profile modules")
    .filter((module) => requireObject(module, "Profile module").type === type)
    .map((module) => requireObject(module, "Profile module").id)
    .filter((id) => Number.isInteger(id));

  if (matches.length === 0) {
    throw new Error(`Expected a ${type} module id.`);
  }

  return Math.max(...matches);
}

async function main() {
  console.log(`Using smoke prefix ${prefix} against ${apiPrefix}`);
  const owner = await registerUser("a", "Codex Mutation A");
  const friend = await registerUser("b", "Codex Mutation B");
  const target = await registerUser("c", "Codex Mutation C");
  let roomSlug = null;

  try {
    await api(`${apiPrefix}/me/privacy`, {
      method: "PATCH",
      session: friend,
      body: {
        profileVisibility: "private",
      },
    });
    await api(`${apiPrefix}/me/privacy`, {
      method: "PATCH",
      session: target,
      body: {
        profileVisibility: "private",
      },
    });

    await api(`${apiPrefix}/me/profile`, {
      method: "PATCH",
      session: owner,
      body: {
        displayName: "Codex Editor Smoke",
        bio: `Profile editor smoke ${prefix} https://thia.lol`,
        location: "Codex",
        traits: ["temporary", "node"],
        links: [
          {
            label: "thia.lol",
            url: "https://thia.lol",
          },
        ],
      },
    });
    await api(`${apiPrefix}/profiles/${owner.handle}`, {
      session: owner,
    });
    await api(`${apiPrefix}/me/profile/featured`, {
      method: "PATCH",
      session: owner,
      body: {
        featuredPostId: null,
        featuredRoomId: null,
      },
    });

    const createdModules = await api(`${apiPrefix}/me/profile/modules`, {
      method: "POST",
      expected: 201,
      session: owner,
      body: {
        type: "custom_text",
        title: "Smoke note",
        config: {
          body: `Temporary editor smoke module ${prefix}`,
        },
        visibility: "public",
      },
    });
    const customModuleId = newestModuleId(createdModules.data, "custom_text");

    const updatedModules = await api(`${apiPrefix}/me/profile/modules/${customModuleId}`, {
      method: "PATCH",
      session: owner,
      body: {
        title: "Smoke note edited",
        config: {
          body: `Temporary editor smoke module ${prefix} edited`,
        },
      },
    });

    await api(`${apiPrefix}/me/profile/modules/${customModuleId}`, {
      method: "DELETE",
      session: owner,
      body: {},
    });
    await api(`${apiPrefix}/me/profile/modules/${customModuleId}/restore`, {
      method: "POST",
      session: owner,
      body: {},
    });

    const ownerModules = await api(`${apiPrefix}/me/profile/modules`, {
      session: owner,
    });
    await api(`${apiPrefix}/me/profile/module-order`, {
      method: "PATCH",
      session: owner,
      body: {
        moduleIds: moduleIds(ownerModules.data),
      },
    });
    await api(`${apiPrefix}/me/profile/canvas`, {
      method: "PATCH",
      session: owner,
      body: {
        backgroundBlur: "soft",
        modules: canvasPlacements(ownerModules.data),
      },
    });
    await api(`${apiPrefix}/me/profile/canvas-draft`, {
      session: owner,
    });
    await api(`${apiPrefix}/me/profile/canvas-draft`, {
      method: "PATCH",
      session: owner,
      body: {
        backgroundBlur: "medium",
        canvasGlass: 62,
        modules: updatedModules.data,
        selectedModuleId: customModuleId,
      },
    });
    await api(`${apiPrefix}/me/profile/canvas-draft/commit`, {
      method: "POST",
      session: owner,
      body: {},
    });
    await api(`${apiPrefix}/me/profile/canvas-draft`, {
      method: "DELETE",
      session: owner,
      body: {},
    });
    await api(`${apiPrefix}/me/badges/featured`, {
      method: "PATCH",
      session: owner,
      body: {
        featuredBadgeIds: [],
        visibleBadgeIds: [],
        hiddenBadgeIds: [],
      },
    });

    await api(`${apiPrefix}/profiles/${friend.handle}/follow`, {
      method: "POST",
      session: owner,
      body: {},
    });
    const friendRequests = await api(`${apiPrefix}/me/follow-requests`, {
      session: friend,
    });
    const friendRequest = friendRequests.data.find((request) => request.user.handle === owner.handle);

    if (friendRequest === undefined) {
      throw new Error("Expected pending follow request for friend account.");
    }

    await api(`${apiPrefix}/me/follow-requests/${friendRequest.id}/approve`, {
      method: "POST",
      session: friend,
      body: {},
    });

    await api(`${apiPrefix}/profiles/${target.handle}/follow`, {
      method: "POST",
      session: owner,
      body: {},
    });
    const targetRequests = await api(`${apiPrefix}/me/follow-requests`, {
      session: target,
    });
    const targetRequest = targetRequests.data.find((request) => request.user.handle === owner.handle);

    if (targetRequest === undefined) {
      throw new Error("Expected pending follow request for target account.");
    }

    await api(`${apiPrefix}/me/follow-requests/${targetRequest.id}`, {
      method: "DELETE",
      session: target,
      body: {},
    });

    await api(`${apiPrefix}/profiles/${owner.handle}/follow`, {
      method: "POST",
      session: friend,
      body: {},
    });
    await api(`${apiPrefix}/profiles/${target.handle}/mute`, {
      method: "POST",
      session: owner,
      body: {},
    });
    await api(`${apiPrefix}/profiles/${target.handle}/mute`, {
      method: "DELETE",
      session: owner,
      body: {},
    });
    await api(`${apiPrefix}/profiles/${target.handle}/block`, {
      method: "POST",
      session: owner,
      body: {},
    });
    await api(`${apiPrefix}/profiles/${target.handle}/block`, {
      method: "DELETE",
      session: owner,
      body: {},
    });
    await api(`${apiPrefix}/profiles/${friend.handle}/star`, {
      method: "POST",
      session: owner,
      body: {},
    });
    await api(`${apiPrefix}/profiles/${friend.handle}/star`, {
      method: "DELETE",
      session: owner,
      body: {},
    });
    await api(`${apiPrefix}/profiles/${owner.handle}/follow`, {
      method: "POST",
      session: target,
      body: {},
    });
    await api(`${apiPrefix}/profiles/${target.handle}/follower`, {
      method: "DELETE",
      session: owner,
      body: {},
    });

    const createdPost = await api(`${apiPrefix}/posts`, {
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

    await api(`${apiPrefix}/posts/${postId}/like`, {
      method: "POST",
      session: friend,
      body: {},
    });
    await api(`${apiPrefix}/posts/${postId}/like`, {
      method: "DELETE",
      session: friend,
      body: {},
    });
    await api(`${apiPrefix}/posts/${postId}/reactions`, {
      method: "POST",
      session: friend,
      body: {
        type: "echo",
      },
    });
    await api(`${apiPrefix}/posts/${postId}/reactions/echo`, {
      method: "DELETE",
      session: friend,
      body: {},
    });
    await api(`${apiPrefix}/posts/${postId}/reblog`, {
      method: "POST",
      session: friend,
      body: {},
    });
    await api(`${apiPrefix}/posts/${postId}/reblog`, {
      method: "DELETE",
      session: friend,
      body: {},
    });
    const reply = await api(`${apiPrefix}/posts/${postId}/replies`, {
      method: "POST",
      expected: 201,
      session: owner,
      body: {
        body: `Reply from ${prefix}`,
      },
    });
    created.posts.push(reply.data.id);
    await api(`${apiPrefix}/posts/${postId}`, {
      method: "PATCH",
      session: owner,
      body: {
        body: `Node mutation smoke ${prefix} edited`,
      },
    });
    await api(`${apiPrefix}/posts/${createdPost.data.publicId}/shares/messages`, {
      method: "POST",
      expected: 201,
      session: owner,
      body: {
        recipientUserIds: [friend.userId],
        note: "Smoke share",
      },
    });
    await api(`${apiPrefix}/me/posts?kind=replies`, {
      method: "DELETE",
      session: owner,
      body: {},
    });

    roomSlug = `${prefix}-room`;
    created.rooms.push(roomSlug);
    await api(`${apiPrefix}/rooms`, {
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
    await api(`${apiPrefix}/rooms/${roomSlug}/join`, {
      method: "POST",
      session: friend,
      body: {},
    });
    await api(`${apiPrefix}/rooms/${roomSlug}/moderators`, {
      method: "POST",
      session: owner,
      body: {
        handle: friend.handle,
      },
    });
    await api(`${apiPrefix}/rooms/${roomSlug}/moderators`, {
      method: "DELETE",
      session: owner,
      body: {
        handle: friend.handle,
      },
    });
    await api(`${apiPrefix}/rooms/${roomSlug}/join`, {
      method: "DELETE",
      session: friend,
      body: {},
    });

    const targetEmail = `${target.handle}2@example.com`;
    const targetHandle = `${target.handle}x`;
    const updatedPassword = `${password}-updated`;

    await api(`${apiPrefix}/me/account/email`, {
      method: "PATCH",
      session: target,
      body: {
        email: targetEmail,
        currentPassword: password,
      },
    });
    await api(`${apiPrefix}/me/account/handle`, {
      method: "PATCH",
      session: target,
      body: {
        handle: targetHandle,
        currentPassword: password,
      },
    });
    await api(`${apiPrefix}/me/account/password`, {
      method: "PATCH",
      session: target,
      body: {
        currentPassword: password,
        newPassword: updatedPassword,
      },
    });

    const relogin = await api(`${apiPrefix}/auth/login`, {
      method: "POST",
      body: {
        email: targetEmail,
        password: updatedPassword,
      },
    });
    target.cookie = sessionCookie(relogin.response);
    target.csrfToken = relogin.data.csrfToken;
    target.handle = targetHandle;

    await api(`${apiPrefix}/me/account/deletion/cancel`, {
      method: "POST",
      session: target,
      body: {},
    });
    await api(`${apiPrefix}/me/account`, {
      method: "DELETE",
      session: target,
      body: {
        currentPassword: updatedPassword,
        reason: "Controlled Node account deletion smoke.",
      },
    });

    console.log("OK controlled mutation smoke passed");
  } finally {
    await cleanupWithApi(owner, friend, target, roomSlug);
    console.log(`Cleanup note: remove throwaway users with handle prefix '${prefix}' after this script if account cleanup is desired.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

function normalizeApiPrefix(value) {
  const trimmed = value.trim().replace(/\/+$/u, "");

  if (trimmed === "") {
    return "/api-next";
  }

  if (!trimmed.startsWith("/") || trimmed.includes("?") || trimmed.includes("#")) {
    throw new Error("API_PREFIX must be an absolute path prefix such as /api-next or /api.");
  }

  return trimmed;
}
