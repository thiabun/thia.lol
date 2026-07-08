import { describe, expect, it } from "vitest";

import { createEditorRepository } from "./editor.js";
import type { RequestSession } from "./sessions.js";

type ExecuteCall = {
  query: string;
  params?: unknown[];
};

type FakePoolOptions = {
  draftJson?: string;
  moduleRows?: Array<Record<string, unknown>>;
};

const tableNames = new Set([
  "account_deletion_requests",
  "user_follows",
  "user_follow_requests",
  "user_blocks",
  "user_mutes",
  "profile_stars",
  "room_memberships",
  "post_reblogs",
  "text_entities",
  "profile_modules",
  "badges",
  "user_badges",
  "profile_integration_accounts",
  "profile_integration_metadata_cache",
  "user_preferences",
  "user_handle_history",
  "user_two_factor",
  "user_two_factor_backup_codes",
  "profile_canvas_drafts",
]);

const columnNames = new Set([
  "banner_url",
  "profile_background_video_url",
  "profile_background_blur",
  "profile_layout_preset",
  "profile_canvas_version",
  "profile_canvas_glass_opacity",
  "profile_theme_config_json",
  "featured_post_id",
  "visibility",
  "icon_url",
  "deleted_at",
  "public_id",
  "grid_column",
  "grid_pinned",
]);

function fakePool(options: FakePoolOptions = {}) {
  const calls: ExecuteCall[] = [];
  let draftJson = options.draftJson;
  let selectedModuleId: string | null = null;
  let nextInsertedModuleId = 100;
  const insertedModules: Array<Record<string, unknown>> = [];
  const placementUpdates: Array<Record<string, unknown>> = [];
  const moduleUpdates: Array<Record<string, unknown>> = [];
  const deletedModuleUpdates: Array<Record<string, unknown>> = [];
  const profileFeaturedClears: string[] = [];
  const defaultModuleRows = [
    {
      id: 20,
      user_id: 1,
      type: "music",
      title: "Focus",
      config_json: JSON.stringify({
        label: "Focus track",
        platform: "spotify",
        url: "https://open.spotify.com/track/profile-test?si=ignored",
      }),
      visibility: "public",
      position: 1,
      grid_column: 1,
      grid_row: 1,
      grid_col_span: 4,
      grid_row_span: 3,
      grid_pinned: 0,
      status: "active",
      schema_version: 1,
      created_at: "2026-06-24 11:00:00",
      updated_at: "2026-06-24 12:00:00",
    },
  ];
  const moduleRows: Array<Record<string, unknown>> = (options.moduleRows ?? defaultModuleRows).map((row) => ({ ...row }));
  async function execute(query: string, params?: unknown[]) {
    calls.push({ query, params });

    if (query.includes("INFORMATION_SCHEMA.TABLES")) {
      return [[{ table_count: tableNames.has(String(params?.[0])) ? 1 : 0 }], undefined];
    }

    if (query.includes("INFORMATION_SCHEMA.COLUMNS")) {
      return [[{ column_count: columnNames.has(String(params?.[1])) ? 1 : 0 }], undefined];
    }

    if (query.includes("SELECT id") && query.includes("WHERE user_id = ?") && query.includes("AND type = ?")) {
      const row = moduleRows.find(
        (item) =>
          Number(item.user_id) === Number(params?.[0]) &&
          String(item.type) === String(params?.[1]),
      );

      if (row !== undefined) {
        return [[{ id: row.id }], undefined];
      }

      return [[params?.[1] === "profile_info" ? { id: 10 } : undefined].filter(Boolean), undefined];
    }

    if (query.includes("COUNT(*) AS module_count") && query.includes("type NOT IN")) {
      return [
        [
          {
            module_count: moduleRows.filter(
              (row) =>
                row.status !== "deleted" &&
                row.type !== "profile_info" &&
                row.type !== "activity",
            ).length,
          },
        ],
        undefined,
      ];
    }

    if (query.includes("COUNT(*) AS module_count")) {
      return [
        [
          {
            module_count: moduleRows.filter((row) => row.status !== "deleted").length,
          },
        ],
        undefined,
      ];
    }

    if (query.includes("SELECT profile_background_blur")) {
      return [
        [
          {
            profile_background_blur: "medium",
            profile_canvas_version: 2,
            profile_canvas_glass_opacity: 58,
          },
        ],
        undefined,
      ];
    }

    if (query.includes("FROM profile_canvas_drafts")) {
      return [
        draftJson === undefined
          ? []
          : [
              {
                draft_json: draftJson,
                selected_module_id: selectedModuleId,
                updated_at: "2026-06-25 10:00:00",
              },
            ],
        undefined,
      ];
    }

    if (query.includes("INSERT INTO profile_canvas_drafts")) {
      draftJson = String(params?.[1] ?? "");
      selectedModuleId = params?.[2] === null ? null : String(params?.[2]);

      return [{ affectedRows: 1 }, undefined];
    }

    if (query.includes("DELETE FROM profile_canvas_drafts")) {
      draftJson = undefined;
      selectedModuleId = null;

      return [{ affectedRows: 1 }, undefined];
    }

    if (query.includes("INSERT INTO profile_modules")) {
      if ((params?.length ?? 0) <= 6) {
        return [{ affectedRows: 1, insertId: 1 }, undefined];
      }

      const insertId = nextInsertedModuleId++;
      const insertedModule = {
        id: insertId,
        userId: params?.[0],
        type: params?.[1],
        title: params?.[2],
        configJson: params?.[3],
        visibility: params?.[4],
        position: params?.[5],
        gridColumn: params?.[6],
        gridRow: params?.[7],
        gridColSpan: params?.[8],
        gridRowSpan: params?.[9],
        gridPinned: params?.[10],
        status: params?.[11],
        schemaVersion: params?.[12],
      };
      insertedModules.push(insertedModule);
      moduleRows.push({
        id: insertId,
        user_id: params?.[0],
        type: params?.[1],
        title: params?.[2],
        config_json: params?.[3],
        visibility: params?.[4],
        position: params?.[5],
        grid_column: params?.[6] ?? null,
        grid_row: params?.[7] ?? null,
        grid_col_span: params?.[8] ?? null,
        grid_row_span: params?.[9] ?? null,
        grid_pinned: params?.[10] ?? 0,
        status: params?.[11],
        schema_version: params?.[12],
        created_at: "2026-06-24 13:00:00",
        updated_at: "2026-06-24 13:00:00",
      });

      return [{ affectedRows: 1, insertId }, undefined];
    }

    if (query.includes("UPDATE profile_modules") && query.includes("status = 'deleted'")) {
      const moduleId = Number(params?.[0]);
      const userId = params?.[1];
      const row = moduleRows.find(
        (item) =>
          Number(item.id) === moduleId &&
          (userId === undefined || Number(item.user_id) === Number(userId)) &&
          item.type !== "profile_info",
      );

      if (row !== undefined) {
        row.status = "deleted";
        row.visibility = "hidden";
      }

      deletedModuleUpdates.push({ id: moduleId, userId });

      return [{ affectedRows: row === undefined ? 0 : 1 }, undefined];
    }

    if (query.includes("UPDATE profile_modules") && query.includes("config_json")) {
      const moduleId = Number(params?.[11]);
      const row = moduleRows.find((item) => Number(item.id) === moduleId);
      const update = {
        title: params?.[0],
        configJson: params?.[1],
        visibility: params?.[2],
        position: params?.[3],
        gridColumn: params?.[4],
        gridRow: params?.[5],
        gridColSpan: params?.[6],
        gridRowSpan: params?.[7],
        gridPinned: params?.[8],
        status: params?.[9],
        schemaVersion: params?.[10],
        id: params?.[11],
        userId: params?.[12],
      };

      moduleUpdates.push(update);

      if (row !== undefined) {
        row.title = params?.[0];
        row.config_json = params?.[1];
        row.visibility = params?.[2];
        row.position = params?.[3];
        row.grid_column = params?.[4];
        row.grid_row = params?.[5];
        row.grid_col_span = params?.[6];
        row.grid_row_span = params?.[7];
        row.grid_pinned = params?.[8];
        row.status = params?.[9];
        row.schema_version = params?.[10];
      }

      return [{ affectedRows: row === undefined ? 0 : 1 }, undefined];
    }

    if (query.includes("UPDATE profiles") && query.includes("featured_post_id = NULL")) {
      profileFeaturedClears.push("featured_post");
      return [{ affectedRows: 1 }, undefined];
    }

    if (query.includes("UPDATE profiles") && query.includes("featured_room_id = NULL")) {
      profileFeaturedClears.push("featured_room");
      return [{ affectedRows: 1 }, undefined];
    }

    if (query.includes("UPDATE profiles")) {
      return [{ affectedRows: 1 }, undefined];
    }

    if (query.includes("UPDATE profile_modules") && query.includes("grid_column")) {
      placementUpdates.push({
        column: params?.[0],
        row: params?.[1],
        colSpan: params?.[2],
        rowSpan: params?.[3],
        pinned: params?.[4],
        visibility: params?.[5],
        id: params?.[6],
        userId: params?.[7],
      });

      return [{ affectedRows: 1 }, undefined];
    }

    if (query.includes("DELETE FROM text_entities")) {
      return [{ affectedRows: 1 }, undefined];
    }

    if (query.includes("INSERT INTO text_entities")) {
      return [{ affectedRows: 1, insertId: 1 }, undefined];
    }

    if (query.includes("FROM profile_integration_metadata_cache")) {
      return [
        [
          {
            provider: "spotify",
            resource_type: "track",
            resource_id: "profile-test",
            resource_key: "spotify:track:profile-test",
            source_url: "https://open.spotify.com/track/profile-test",
            metadata_json: JSON.stringify({
              title: "Focus track",
              subtitle: "Spotify track",
            }),
            embed_json: JSON.stringify({
              type: "iframe",
              src: "https://open.spotify.com/embed/track/profile-test",
            }),
            api_backed: 1,
            fetched_at: "2026-06-24 12:00:00",
            expires_at: null,
            stale_at: null,
            error_message: null,
          },
        ],
        undefined,
      ];
    }

    if (query.includes("FROM profile_modules") && query.includes("ORDER BY position ASC, id ASC")) {
      return [
        query.includes("AND status <> 'deleted'")
          ? moduleRows.filter((row) => row.status !== "deleted")
          : moduleRows,
        undefined,
      ];
    }

    throw new Error(`Unhandled fake pool query: ${query}`);
  }

  const pool = {
    execute,
    async getConnection() {
      return {
        execute,
        async beginTransaction() {},
        async commit() {},
        async rollback() {},
        release() {},
      };
    },
  };

  return {
    calls,
    pool,
    draftJson: () => draftJson,
    deletedModuleUpdates,
    insertedModules,
    moduleRows,
    moduleUpdates,
    placementUpdates,
    profileFeaturedClears,
  };
}

function profileInfoPayload(position: number) {
  return {
    id: 10,
    type: "profile_info",
    title: "Profile info",
    config: {},
    visibility: "public",
    position,
    pinned: false,
    layout: {
      column: 1,
      row: 1,
      colSpan: 4,
      rowSpan: 3,
    },
    status: "active",
    schemaVersion: 1,
    createdAt: "2026-06-24 11:00:00",
    updatedAt: "2026-06-24 12:00:00",
  };
}

function draftCustomTextPayload() {
  return {
    id: -1000,
    type: "custom_text",
    title: null,
    config: {
      body: "Draft note",
      configured: true,
    },
    visibility: "public",
    position: 2,
    pinned: true,
    layout: {
      column: 3,
      row: 4,
      colSpan: 2,
      rowSpan: 2,
    },
    status: "active",
    schemaVersion: 1,
    createdAt: null,
    updatedAt: null,
  };
}

function draftPlaceholderPayload() {
  return {
    id: -1001,
    type: "placeholder",
    title: null,
    config: {
      canvasSize: "2x2",
      configured: false,
      placeholder: true,
    },
    visibility: "draft",
    position: 2,
    pinned: false,
    layout: {
      column: 3,
      row: 4,
      colSpan: 2,
      rowSpan: 2,
    },
    status: "active",
    schemaVersion: 1,
    createdAt: null,
    updatedAt: null,
  };
}

function draftActivityPayload(id: number, position: number) {
  return {
    id,
    type: "activity",
    title: "Activity",
    config: {
      canvasSize: "4x6",
      configured: true,
      variant: "feed",
    },
    visibility: "public",
    position,
    pinned: false,
    layout: {
      column: 1,
      row: position,
      colSpan: 4,
      rowSpan: 6,
    },
    status: "active",
    schemaVersion: 1,
    createdAt: null,
    updatedAt: null,
  };
}

function persistedMusicPayload(
  overrides: {
    config?: Record<string, unknown>;
    status?: string;
    visibility?: string;
  } = {},
) {
  return {
    id: 20,
    type: "music",
    title: "Focus",
    config: overrides.config ?? {
      label: "Focus track",
      platform: "spotify",
      url: "https://open.spotify.com/track/profile-test?si=ignored",
    },
    visibility: overrides.visibility ?? "public",
    position: 2,
    pinned: false,
    layout: {
      column: 5,
      row: 1,
      colSpan: 4,
      rowSpan: 3,
    },
    status: overrides.status ?? "active",
    schemaVersion: 1,
    createdAt: "2026-06-24 11:00:00",
    updatedAt: "2026-06-24 12:00:00",
  };
}

function featuredModulePayload(
  type: "featured_post" | "featured_room",
  id: number,
) {
  return {
    id,
    type,
    title: type === "featured_post" ? "Featured post" : "Featured room",
    config: type === "featured_post" ? { featuredPostId: 42 } : { featuredRoomId: 7 },
    visibility: "hidden",
    position: id,
    pinned: false,
    layout: {
      column: 1,
      row: id,
      colSpan: type === "featured_post" ? 3 : 4,
      rowSpan: type === "featured_post" ? 4 : 2,
    },
    status: "deleted",
    schemaVersion: 1,
    createdAt: "2026-06-24 11:00:00",
    updatedAt: "2026-06-24 12:00:00",
  };
}

function profileInfoRow(position: number) {
  return {
    id: 10,
    user_id: 1,
    type: "profile_info",
    title: "Profile info",
    config_json: JSON.stringify({}),
    visibility: "public",
    position,
    grid_column: null,
    grid_row: null,
    grid_col_span: null,
    grid_row_span: null,
    grid_pinned: 0,
    status: "active",
    schema_version: 1,
    created_at: "2026-06-24 11:00:00",
    updated_at: "2026-06-24 12:00:00",
  };
}

function musicRow() {
  return {
    id: 20,
    user_id: 1,
    type: "music",
    title: "Focus",
    config_json: JSON.stringify({
      label: "Focus track",
      platform: "spotify",
      url: "https://open.spotify.com/track/profile-test?si=ignored",
    }),
    visibility: "public",
    position: 2,
    grid_column: 5,
    grid_row: 1,
    grid_col_span: 4,
    grid_row_span: 3,
    grid_pinned: 0,
    status: "active",
    schema_version: 1,
    created_at: "2026-06-24 11:00:00",
    updated_at: "2026-06-24 12:00:00",
  };
}

function featuredModuleRow(type: "featured_post" | "featured_room", id: number) {
  return {
    id,
    user_id: 1,
    type,
    title: type === "featured_post" ? "Featured post" : "Featured room",
    config_json: JSON.stringify(
      type === "featured_post" ? { featuredPostId: 42 } : { featuredRoomId: 7 },
    ),
    visibility: "public",
    position: id,
    grid_column: 1,
    grid_row: id,
    grid_col_span: type === "featured_post" ? 3 : 4,
    grid_row_span: type === "featured_post" ? 4 : 2,
    grid_pinned: 0,
    status: "active",
    schema_version: 1,
    created_at: "2026-06-24 11:00:00",
    updated_at: "2026-06-24 12:00:00",
  };
}

function activityRow() {
  return {
    id: 40,
    user_id: 1,
    type: "activity",
    title: "Activity",
    config_json: JSON.stringify({
      canvasSize: "4x6",
      configured: true,
      variant: "feed",
    }),
    visibility: "public",
    position: 2,
    grid_column: 1,
    grid_row: 2,
    grid_col_span: 4,
    grid_row_span: 6,
    grid_pinned: 0,
    status: "active",
    schema_version: 1,
    created_at: "2026-06-24 11:00:00",
    updated_at: "2026-06-24 12:00:00",
  };
}

const session: RequestSession = {
  sessionId: 1,
  userId: 1,
  tokenHash: "hash",
  handle: "thia",
  role: "user",
};

describe("editor profile module payloads", () => {
  it("keeps cached rich integration cards on owner module responses", async () => {
    const { calls, pool } = fakePool();
    const repository = createEditorRepository(pool as never);
    const modules = await repository.listOwnerModules(1, false);

    expect(modules).toHaveLength(1);
    expect(modules[0]?.config).toMatchObject({
      platform: "spotify",
      url: "https://open.spotify.com/track/profile-test?si=ignored",
      integration: {
        provider: "spotify",
        resourceType: "track",
        resourceKey: "spotify:track:profile-test",
        metadata: {
          title: "Focus track",
        },
        embed: {
          src: "https://open.spotify.com/embed/track/profile-test",
        },
        apiBacked: true,
      },
    });
    expect(
      calls.some((call) => call.query.includes("FROM profile_integration_metadata_cache")),
    ).toBe(true);
  });

  it("repairs non-positive positions when reading stored canvas drafts", async () => {
    const { pool } = fakePool({
      draftJson: JSON.stringify({
        backgroundBlur: "medium",
        canvasGlass: 58,
        canvasVersion: 2,
        modules: [profileInfoPayload(0)],
        selectedModuleId: null,
      }),
    });
    const repository = createEditorRepository(pool as never);

    const draft = await repository.getCanvasDraft(1);

    expect(draft.modules).toHaveLength(1);
    expect(draft.modules[0]?.position).toBe(1);
  });

  it("repairs non-object module configs when reading stored canvas drafts", async () => {
    const { pool } = fakePool({
      draftJson: JSON.stringify({
        backgroundBlur: "medium",
        canvasGlass: 58,
        canvasVersion: 2,
        modules: [{ ...profileInfoPayload(1), config: [] }],
        selectedModuleId: null,
      }),
    });
    const repository = createEditorRepository(pool as never);

    const draft = await repository.getCanvasDraft(1);

    expect(draft.modules).toHaveLength(1);
    expect(draft.modules[0]?.config).toEqual({});
  });

  it("stores repaired positions for background-only canvas draft updates", async () => {
    const { draftJson, pool } = fakePool({
      moduleRows: [profileInfoRow(0)],
    });
    const repository = createEditorRepository(pool as never);

    await repository.updateCanvasDraft(session, { backgroundBlur: "soft" });

    const savedDraft = JSON.parse(draftJson() ?? "{}") as {
      modules?: Array<{ position?: unknown }>;
    };
    expect(savedDraft.modules?.[0]?.position).toBe(1);
  });

  it("creates chosen canvas draft modules before applying placements", async () => {
    const { insertedModules, moduleUpdates, pool } = fakePool({
      draftJson: JSON.stringify({
        backgroundBlur: "medium",
        canvasGlass: 58,
        canvasVersion: 2,
        modules: [profileInfoPayload(1), draftCustomTextPayload()],
        selectedModuleId: null,
      }),
      moduleRows: [profileInfoRow(0)],
    });
    const repository = createEditorRepository(pool as never);

    await repository.commitCanvasDraft(session);

    expect(insertedModules).toHaveLength(1);
    expect(insertedModules[0]).toMatchObject({
      id: 100,
      type: "custom_text",
      visibility: "public",
      position: 2,
      gridColumn: 3,
      gridRow: 4,
      gridColSpan: 2,
      gridRowSpan: 2,
      gridPinned: 1,
      status: "active",
    });
    expect(moduleUpdates.map((update) => update.id)).toEqual([10]);
    expect(moduleUpdates[0]).toMatchObject({
      gridColumn: 1,
      gridRow: 1,
      gridColSpan: 4,
      gridRowSpan: 3,
      gridPinned: 0,
      visibility: "public",
      status: "active",
    });
  });

  it("commits repaired non-object module configs from stored canvas drafts", async () => {
    const { moduleUpdates, pool } = fakePool({
      draftJson: JSON.stringify({
        backgroundBlur: "medium",
        canvasGlass: 58,
        canvasVersion: 2,
        modules: [{ ...profileInfoPayload(1), config: [] }],
        selectedModuleId: null,
      }),
      moduleRows: [profileInfoRow(1)],
    });
    const repository = createEditorRepository(pool as never);

    await repository.commitCanvasDraft(session);

    expect(JSON.parse(String(moduleUpdates[0]?.configJson))).toEqual({});
  });

  it("rejects duplicate singleton modules in stored canvas drafts", async () => {
    const { pool } = fakePool({
      draftJson: JSON.stringify({
        backgroundBlur: "medium",
        canvasGlass: 58,
        canvasVersion: 2,
        modules: [
          profileInfoPayload(1),
          draftActivityPayload(-1002, 2),
          draftActivityPayload(-1003, 3),
        ],
        selectedModuleId: null,
      }),
      moduleRows: [profileInfoRow(1)],
    });
    const repository = createEditorRepository(pool as never);

    await expect(repository.commitCanvasDraft(session)).rejects.toMatchObject({
      message: "Activity module already exists.",
      statusCode: 422,
    });
  });

  it("allows a stored canvas draft to replace a deleted singleton module", async () => {
    const { deletedModuleUpdates, insertedModules, pool } = fakePool({
      draftJson: JSON.stringify({
        backgroundBlur: "medium",
        canvasGlass: 58,
        canvasVersion: 2,
        modules: [
          profileInfoPayload(1),
          { ...draftActivityPayload(40, 2), status: "deleted", visibility: "hidden" },
          draftActivityPayload(-1002, 2),
        ],
        selectedModuleId: null,
      }),
      moduleRows: [profileInfoRow(1), activityRow()],
    });
    const repository = createEditorRepository(pool as never);

    await repository.commitCanvasDraft(session);

    expect(deletedModuleUpdates).toContainEqual({ id: 40, userId: 1 });
    expect(insertedModules).toContainEqual(
      expect.objectContaining({
        type: "activity",
        visibility: "public",
        status: "active",
      }),
    );
  });

  it("drops unpicked placeholder draft modules during commit", async () => {
    const { insertedModules, moduleUpdates, pool } = fakePool({
      draftJson: JSON.stringify({
        backgroundBlur: "medium",
        canvasGlass: 58,
        canvasVersion: 2,
        modules: [profileInfoPayload(1), draftPlaceholderPayload()],
        selectedModuleId: null,
      }),
      moduleRows: [profileInfoRow(0)],
    });
    const repository = createEditorRepository(pool as never);

    await repository.commitCanvasDraft(session);

    expect(insertedModules).toHaveLength(0);
    expect(moduleUpdates.map((update) => update.id)).toEqual([10]);
  });

  it("soft-deletes persisted modules marked deleted in canvas drafts", async () => {
    const { deletedModuleUpdates, moduleRows, pool } = fakePool({
      draftJson: JSON.stringify({
        backgroundBlur: "medium",
        canvasGlass: 58,
        canvasVersion: 2,
        modules: [
          profileInfoPayload(1),
          persistedMusicPayload({ status: "deleted", visibility: "hidden" }),
        ],
        selectedModuleId: null,
      }),
      moduleRows: [profileInfoRow(1), musicRow()],
    });
    const repository = createEditorRepository(pool as never);

    const result = await repository.commitCanvasDraft(session);

    expect(deletedModuleUpdates).toContainEqual({ id: 20, userId: 1 });
    expect(moduleRows.find((row) => row.id === 20)).toMatchObject({
      status: "deleted",
      visibility: "hidden",
    });
    expect(result.modules.some((module) => module.id === 20)).toBe(false);
  });

  it("persists config changes for existing canvas draft modules", async () => {
    const nextConfig = {
      label: "Updated focus track",
      platform: "spotify",
      url: "https://open.spotify.com/track/profile-test",
    };
    const { moduleUpdates, pool } = fakePool({
      draftJson: JSON.stringify({
        backgroundBlur: "medium",
        canvasGlass: 58,
        canvasVersion: 2,
        modules: [profileInfoPayload(1), persistedMusicPayload({ config: nextConfig })],
        selectedModuleId: null,
      }),
      moduleRows: [profileInfoRow(1), musicRow()],
    });
    const repository = createEditorRepository(pool as never);

    const result = await repository.commitCanvasDraft(session);
    const musicUpdate = moduleUpdates.find((update) => update.id === 20);
    const musicModule = result.modules.find((module) => module.id === 20);

    expect(JSON.parse(String(musicUpdate?.configJson))).toMatchObject(nextConfig);
    expect(musicModule?.config).toMatchObject(nextConfig);
  });

  it("clears featured profile references when featured modules are deleted in canvas drafts", async () => {
    const { deletedModuleUpdates, pool, profileFeaturedClears } = fakePool({
      draftJson: JSON.stringify({
        backgroundBlur: "medium",
        canvasGlass: 58,
        canvasVersion: 2,
        modules: [
          profileInfoPayload(1),
          featuredModulePayload("featured_post", 30),
          featuredModulePayload("featured_room", 31),
        ],
        selectedModuleId: null,
      }),
      moduleRows: [
        profileInfoRow(1),
        featuredModuleRow("featured_post", 30),
        featuredModuleRow("featured_room", 31),
      ],
    });
    const repository = createEditorRepository(pool as never);

    await repository.commitCanvasDraft(session);

    expect(deletedModuleUpdates.map((update) => update.id)).toEqual([30, 31]);
    expect(profileFeaturedClears).toEqual(["featured_post", "featured_room"]);
  });
});
