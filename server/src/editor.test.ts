import { describe, expect, it } from "vitest";

import { createEditorRepository } from "./editor.js";
import type { RequestSession } from "./sessions.js";

type ExecuteCall = {
  query: string;
  params?: unknown[];
  source: "connection" | "pool";
};

type FakePoolOptions = {
  draftJson?: string;
  moduleDeleteAffectedRows?: number;
  moduleRows?: Array<Record<string, unknown>>;
  moduleUpdateAffectedRows?: number;
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
  const transactionEvents: string[] = [];
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
  async function execute(query: string, params?: unknown[],
    source: ExecuteCall["source"] = "pool",
  ) {
    calls.push({ query, params, source });

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
          String(item.type) === String(params?.[1]) &&
          (!query.includes("AND status <> 'deleted'") || item.status !== "deleted"),
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
                Number(row.user_id) === Number(params?.[0]) &&
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
            module_count: moduleRows.filter((row) =>
                Number(row.user_id) === Number(params?.[0]) &&
                row.status !== "deleted").length,
          },
        ],
        undefined,
      ];
    }

    if (query.includes("MAX(position)") && query.includes("AS module_count")) {
      const ownerPositions = moduleRows
        .filter((row) => Number(row.user_id) === Number(params?.[0]))
        .map((row) => Number(row.position) || 0);

      return [
        [{ module_count: Math.max(0, ...ownerPositions) + 1 }],
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

    if (
      query.includes("SELECT user_id") &&
      query.includes("FROM profiles") &&
      query.includes("FOR UPDATE")
    ) {
      return [[{ user_id: params?.[0] }], undefined];
    }

    if (
      query.includes("SELECT user_id") &&
      query.includes("FROM profile_canvas_drafts") &&
      query.includes("FOR UPDATE")
    ) {
      return [draftJson === undefined ? [] : [{ user_id: params?.[0] }], undefined];
    }

    if (
      query.includes("SELECT draft_json") &&
      query.includes("FROM profile_canvas_drafts")
    ) {
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

    if (
      query.includes("SELECT id, type, status") &&
      query.includes("FOR UPDATE")
    ) {
      return [
        moduleRows
          .filter((row) => Number(row.user_id) === Number(params?.[0]))
          .map((row) => ({
            id: row.id,
            type: row.type,
            status: row.status,
          })),
        undefined,
      ];
    }

    if (
      query.includes("FROM profile_modules") &&
      query.includes("WHERE id = ?") &&
      query.includes("LIMIT 1")
    ) {
      const row = moduleRows.find(
        (item) => Number(item.id) === Number(params?.[0]),
      );

      return [row === undefined ? [] : [row], undefined];
    }

    if (query.includes("INSERT INTO profile_modules")) {
      if ((params?.length ?? 0) <= 6) {
        return [{ affectedRows: 1, insertId: 1 }, undefined];
      }

      const insertId = nextInsertedModuleId++;
      const directCreate = params?.length === 8;
      const insertedModule = {
        id: insertId,
        userId: params?.[0],
        type: params?.[1],
        title: params?.[2],
        configJson: params?.[3],
        visibility: params?.[4],
        position: params?.[5],
        gridColumn: directCreate ? null : params?.[6],
        gridRow: directCreate ? null : params?.[7],
        gridColSpan: directCreate ? null : params?.[8],
        gridRowSpan: directCreate ? null : params?.[9],
        gridPinned: directCreate ? 0 : params?.[10],
        status: directCreate ? params?.[6] : params?.[11],
        schemaVersion: directCreate ? params?.[7] : params?.[12],
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
        grid_column: directCreate ? null : (params?.[6] ?? null),
        grid_row: directCreate ? null : (params?.[7] ?? null),
        grid_col_span: directCreate ? null : (params?.[8] ?? null),
        grid_row_span: directCreate ? null : (params?.[9] ?? null),
        grid_pinned: directCreate ? 0 : (params?.[10] ?? 0),
        status: directCreate ? params?.[6] : params?.[11],
        schema_version: directCreate ? params?.[7] : params?.[12],
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

      const affectedRows =
        options.moduleDeleteAffectedRows ?? (row === undefined ? 0 : 1);

      if (row !== undefined && affectedRows === 1) {
        row.status = "deleted";
        row.visibility = "hidden";
      }

      deletedModuleUpdates.push({ id: moduleId, userId });

      return [{ affectedRows }, undefined];
    }

    if (
      query.includes("UPDATE profile_modules") &&
      query.includes("config_json") &&
      !query.includes("type = ?")
    ) {
      const moduleId = Number(params?.[(params?.length ?? 2) - 2]);
      const userId = Number(params?.[(params?.length ?? 1) - 1]);
      const row = moduleRows.find(
        (item) =>
          Number(item.id) === moduleId &&
          Number(item.user_id) === userId &&
          item.status !== "deleted",
      );
      let parameterIndex = 0;

      if (query.includes("title = ?")) {
        if (row !== undefined) {
          row.title = params?.[parameterIndex];
        }
        parameterIndex += 1;
      }

      if (query.includes("config_json = ?")) {
        if (row !== undefined) {
          row.config_json = params?.[parameterIndex];
        }
        parameterIndex += 1;
      }

      if (query.includes("visibility = ?")) {
        if (row !== undefined) {
          row.visibility = params?.[parameterIndex];
        }
        parameterIndex += 1;
      }

      if (query.includes("status = ?")) {
        if (row !== undefined) {
          row.status = params?.[parameterIndex];
        }
      }

      return [{ affectedRows: row === undefined ? 0 : 1 }, undefined];
    }

    if (query.includes("UPDATE profile_modules") && query.includes("config_json")) {
      const moduleId = Number(params?.[12]);
      const userId = Number(params?.[13]);
      const row = moduleRows.find((item) => Number(item.id) === moduleId &&
          Number(item.user_id) === userId &&
          item.status !== "deleted",
      );
      const affectedRows =
        options.moduleUpdateAffectedRows ?? (row === undefined ? 0 : 1);
      const update = {
        title: params?.[0],
        type: params?.[1],
        configJson: params?.[2],
        visibility: params?.[3],
        position: params?.[4],
        gridColumn: params?.[5],
        gridRow: params?.[6],
        gridColSpan: params?.[7],
        gridRowSpan: params?.[8],
        gridPinned: params?.[9],
        status: params?.[10],
        schemaVersion: params?.[11],
        id: params?.[12],
        userId: params?.[13],
      };

      moduleUpdates.push(update);

      if (row !== undefined && affectedRows === 1) {
        row.title = params?.[0];
        row.type = params?.[1];
        row.config_json = params?.[2];
        row.visibility = params?.[3];
        row.position = params?.[4];
        row.grid_column = params?.[5];
        row.grid_row = params?.[6];
        row.grid_col_span = params?.[7];
        row.grid_row_span = params?.[8];
        row.grid_pinned = params?.[9];
        row.status = params?.[10];
        row.schema_version = params?.[11];
      }

      return [{ affectedRows }, undefined];
    }

    if (query.includes("UPDATE profile_modules") && query.includes("status = 'active'")) {
      const row = moduleRows.find(
        (item) =>
          Number(item.id) === Number(params?.[0]) &&
          Number(item.user_id) === Number(params?.[1]),
      );

      if (row !== undefined) {
        row.status = "active";
        row.visibility = "public";
      }

      return [{ affectedRows: row === undefined ? 0 : 1 }, undefined];
    }

    if (
      query.includes("UPDATE profile_modules") &&
      query.includes("SET position = ?") &&
      !query.includes("grid_column")
    ) {
      const row = moduleRows.find(
        (item) =>
          Number(item.id) === Number(params?.[1]) &&
          Number(item.user_id) === Number(params?.[2]) &&
          item.status !== "deleted",
      );

      if (row !== undefined) {
        row.position = params?.[0];
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

    if (query.includes("FROM profile_modules") && query.includes("ORDER BY position ASC, id ASC")
    ) {
      const ownerRows = moduleRows.filter(
        (row) => Number(row.user_id) === Number(params?.[0]),
      );

      return [
        query.includes("AND status <> 'deleted'")
          ? ownerRows.filter((row) => row.status !== "deleted")
          : ownerRows,
        undefined,
      ];
    }

    throw new Error(`Unhandled fake pool query: ${query}`);
  }

  const pool = {
    execute(query: string, params?: unknown[]) {
      return execute(query, params, "pool");
    },
    async getConnection() {
      return {
        execute(query: string, params?: unknown[]) {
          return execute(query, params, "connection");
        },
        async beginTransaction() {
          transactionEvents.push("begin");
        },
        async commit() {
          transactionEvents.push("commit");
        },
        async rollback() {
          transactionEvents.push("rollback");
        },
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
    transactionEvents,
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
    type?: string;
    visibility?: string;
  } = {},
) {
  return {
    id: 20,
    type: overrides.type ?? "music",
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

function musicRow(overrides: { type?: string } = {}) {
  return {
    id: 20,
    user_id: 1,
    type: overrides.type ?? "music",
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
const canvasDraftRevisionOne = "draft:00000000-0000-4000-8000-000000000001";
const canvasDraftRevisionTwo = "draft:00000000-0000-4000-8000-000000000002";

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

  it("materializes a revisioned draft on open so a direct module update conflicts with the first save", async () => {
    const { draftJson, pool, transactionEvents } = fakePool({
      moduleRows: [profileInfoRow(1), musicRow()],
    });
    const repository = createEditorRepository(pool as never);

    const opened = await repository.getCanvasDraft(session.userId);

    expect(opened.revision).toMatch(/^draft:/u);
    expect(JSON.parse(draftJson() ?? "{}")).toMatchObject({
      revision: opened.revision,
    });

    await repository.updateModule(session, 20, {
      config: {
        label: "Direct update after open",
        platform: "spotify",
        url: "https://open.spotify.com/track/profile-test",
      },
    });
    const replacement = JSON.parse(draftJson() ?? "{}") as {
      modules?: Array<{ config?: { label?: unknown }; id?: unknown }>;
      revision?: unknown;
    };

    expect(replacement.revision).toMatch(/^draft:/u);
    expect(replacement.revision).not.toBe(opened.revision);
    expect(
      replacement.modules?.find((module) => module.id === 20)?.config?.label,
    ).toBe("Direct update after open");
    await expect(
      repository.updateCanvasDraft(session, {
        backgroundBlur: "soft",
        expectedRevision: opened.revision,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(transactionEvents).toEqual([
      "begin",
      "commit",
      "begin",
      "commit",
      "begin",
      "rollback",
    ]);
  });

  it("keeps omitted-revision clients in legacy mode after opening a revisioned draft", async () => {
    const { draftJson, pool, transactionEvents } = fakePool({
      moduleRows: [profileInfoRow(1)],
    });
    const repository = createEditorRepository(pool as never);

    const opened = await repository.getCanvasDraft(session.userId);
    const saved = await repository.updateCanvasDraft(session, {
      backgroundBlur: "soft",
    });
    const stored = JSON.parse(draftJson() ?? "{}") as {
      revision?: unknown;
    };

    expect(opened.revision).toMatch(/^draft:/u);
    expect(saved.revision).toMatch(/^legacy:/u);
    expect(stored.revision).toBeUndefined();
    expect(transactionEvents).toEqual([
      "begin",
      "commit",
      "begin",
      "commit",
    ]);
  });

  it("stores repaired positions for background-only canvas draft updates", async () => {
    const { draftJson, pool } = fakePool({
      moduleRows: [profileInfoRow(0)],
    });
    const repository = createEditorRepository(pool as never);

    const saved = await repository.updateCanvasDraft(session, {
      backgroundBlur: "soft",
    });

    const savedDraft = JSON.parse(draftJson() ?? "{}") as {
      modules?: Array<{ position?: unknown }>;
      revision?: unknown;
    };
    expect(savedDraft.modules?.[0]?.position).toBe(1);
    expect(savedDraft.revision).toBeUndefined();
    expect(saved.revision).toMatch(/^legacy:/u);
  });

  it("keeps omitted-revision clients in legacy mode across repeated saves and commit", async () => {
    const { draftJson, pool, transactionEvents } = fakePool({
      moduleRows: [profileInfoRow(1)],
    });
    const repository = createEditorRepository(pool as never);

    const first = await repository.updateCanvasDraft(session, {
      backgroundBlur: "soft",
    });
    const second = await repository.updateCanvasDraft(session, {
      canvasGlass: 64,
    });
    const stored = JSON.parse(draftJson() ?? "{}") as {
      revision?: unknown;
    };

    expect(first.revision).toMatch(/^legacy:/u);
    expect(second.revision).toMatch(/^legacy:/u);
    expect(second.revision).not.toBe(first.revision);
    expect(stored.revision).toBeUndefined();

    await expect(repository.commitCanvasDraft(session)).resolves.toMatchObject({
      canvasVersion: 2,
    });
    expect(draftJson()).toBeUndefined();
    expect(transactionEvents).toEqual([
      "begin",
      "commit",
      "begin",
      "commit",
      "begin",
      "commit",
    ]);
  });

  it("creates an opaque revision and keeps all transactional draft reads on one connection", async () => {
    const { calls, draftJson, pool, transactionEvents } = fakePool({
      moduleRows: [profileInfoRow(1)],
    });
    const repository = createEditorRepository(pool as never);

    const saved = await repository.updateCanvasDraft(session, {
      backgroundBlur: "soft",
      expectedRevision: null,
    });
    const stored = JSON.parse(draftJson() ?? "{}") as { revision?: unknown };
    const profileLockIndex = calls.findIndex(
      (call) =>
        call.query.includes("FROM profiles") &&
        call.query.includes("FOR UPDATE"),
    );

    expect(saved.revision).toMatch(/^draft:/u);
    expect(stored.revision).toBe(saved.revision);
    expect(profileLockIndex).toBeGreaterThanOrEqual(0);
    expect(calls.slice(profileLockIndex).every((call) => call.source === "connection")).toBe(true);
    expect(transactionEvents).toEqual(["begin", "commit"]);
  });

  it("rotates a canvas revision only when the expected revision matches", async () => {
    const { draftJson, pool, transactionEvents } = fakePool({
      draftJson: JSON.stringify({
        backgroundBlur: "medium",
        canvasGlass: 58,
        canvasVersion: 2,
        modules: [profileInfoPayload(1)],
        revision: canvasDraftRevisionOne,
        selectedModuleId: null,
      }),
      moduleRows: [profileInfoRow(1)],
    });
    const repository = createEditorRepository(pool as never);

    const saved = await repository.updateCanvasDraft(session, {
      canvasGlass: 64,
      expectedRevision: canvasDraftRevisionOne,
    });
    const stored = JSON.parse(draftJson() ?? "{}") as {
      canvasGlass?: unknown;
      revision?: unknown;
    };

    expect(saved.revision).toMatch(/^draft:/u);
    expect(saved.revision).not.toBe(canvasDraftRevisionOne);
    expect(stored).toMatchObject({
      canvasGlass: 64,
      revision: saved.revision,
    });
    expect(transactionEvents).toEqual(["begin", "commit"]);
  });

  it("rejects stale explicit revisions without overwriting a revisioned draft", async () => {
    const initialDraft = JSON.stringify({
      backgroundBlur: "medium",
      canvasGlass: 58,
      canvasVersion: 2,
      modules: [profileInfoPayload(1)],
      revision: canvasDraftRevisionOne,
      selectedModuleId: null,
    });
    const { draftJson, pool, transactionEvents } = fakePool({
      draftJson: initialDraft,
      moduleRows: [profileInfoRow(1)],
    });
    const repository = createEditorRepository(pool as never);

    await expect(
      repository.updateCanvasDraft(session, {
        canvasGlass: 70,
        expectedRevision: canvasDraftRevisionTwo,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(draftJson()).toBe(initialDraft);
    expect(transactionEvents).toEqual(["begin", "rollback"]);
  });

  it("allows an omitted revision to continue a revisioned draft in legacy mode", async () => {
    const { draftJson, pool, transactionEvents } = fakePool({
      draftJson: JSON.stringify({
        backgroundBlur: "medium",
        canvasGlass: 58,
        canvasVersion: 2,
        modules: [profileInfoPayload(1)],
        revision: canvasDraftRevisionOne,
        selectedModuleId: null,
      }),
      moduleRows: [profileInfoRow(1)],
    });
    const repository = createEditorRepository(pool as never);

    const saved = await repository.updateCanvasDraft(session, {
      canvasGlass: 72,
    });
    const stored = JSON.parse(draftJson() ?? "{}") as {
      canvasGlass?: unknown;
      revision?: unknown;
    };

    expect(saved.revision).toMatch(/^legacy:/u);
    expect(stored).toMatchObject({ canvasGlass: 72 });
    expect(stored.revision).toBeUndefined();
    expect(transactionEvents).toEqual(["begin", "commit"]);
  });

  it("rebases a matching uncommittable draft onto current live modules", async () => {
    const deletedMusicRow = { ...musicRow(), status: "deleted" };
    const { draftJson, pool, transactionEvents } = fakePool({
      draftJson: JSON.stringify({
        backgroundBlur: "medium",
        canvasGlass: 58,
        canvasVersion: 2,
        modules: [profileInfoPayload(1), persistedMusicPayload()],
        revision: canvasDraftRevisionOne,
        selectedModuleId: 20,
      }),
      moduleRows: [profileInfoRow(1), deletedMusicRow],
    });
    const repository = createEditorRepository(pool as never);

    const rebased = await repository.rebaseCanvasDraft(
      session,
      canvasDraftRevisionOne,
    );
    const stored = JSON.parse(draftJson() ?? "{}") as {
      modules?: Array<{ id?: unknown }>;
      revision?: unknown;
    };

    expect(rebased.revision).toMatch(/^draft:/u);
    expect(rebased.revision).not.toBe(canvasDraftRevisionOne);
    expect(rebased.selectedModuleId).toBeNull();
    expect(rebased.modules.some((module) => module.id === 20)).toBe(false);
    expect(stored.revision).toBe(rebased.revision);
    expect(stored.modules?.some((module) => module.id === 20)).toBe(false);

    await expect(
      repository.commitCanvasDraft(session, rebased.revision),
    ).resolves.toMatchObject({ canvasVersion: 2 });
    expect(transactionEvents).toEqual([
      "begin",
      "commit",
      "begin",
      "commit",
    ]);
  });

  it("rejects a stale rebase without replacing a newer draft", async () => {
    const initialDraft = JSON.stringify({
      backgroundBlur: "medium",
      canvasGlass: 58,
      canvasVersion: 2,
      modules: [profileInfoPayload(1)],
      revision: canvasDraftRevisionOne,
      selectedModuleId: null,
    });
    const { draftJson, pool, transactionEvents } = fakePool({
      draftJson: initialDraft,
      moduleRows: [profileInfoRow(1)],
    });
    const repository = createEditorRepository(pool as never);

    await expect(
      repository.rebaseCanvasDraft(session, canvasDraftRevisionTwo),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(draftJson()).toBe(initialDraft);
    expect(transactionEvents).toEqual(["begin", "rollback"]);
  });

  it("replaces an open draft after a direct module update and rejects its stale revision", async () => {
    const { draftJson, pool, transactionEvents } = fakePool({
      draftJson: JSON.stringify({
        backgroundBlur: "medium",
        canvasGlass: 58,
        canvasVersion: 2,
        modules: [profileInfoPayload(1), persistedMusicPayload()],
        revision: canvasDraftRevisionOne,
        selectedModuleId: 20,
      }),
      moduleRows: [profileInfoRow(1), musicRow()],
    });
    const repository = createEditorRepository(pool as never);

    await repository.updateModule(session, 20, {
      config: {
        label: "New direct edit",
        platform: "spotify",
        url: "https://open.spotify.com/track/profile-test",
      },
    });
    const replacement = JSON.parse(draftJson() ?? "{}") as {
      modules?: Array<{ config?: { label?: unknown }; id?: unknown }>;
      revision?: unknown;
    };

    expect(replacement.revision).toMatch(/^draft:/u);
    expect(replacement.revision).not.toBe(canvasDraftRevisionOne);
    expect(
      replacement.modules?.find((module) => module.id === 20)?.config?.label,
    ).toBe("New direct edit");
    await expect(
      repository.updateCanvasDraft(session, {
        canvasGlass: 72,
        expectedRevision: canvasDraftRevisionOne,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(transactionEvents).toEqual([
      "begin",
      "commit",
      "begin",
      "rollback",
    ]);
  });

  it("atomically replaces open drafts after every direct module and canvas mutation", async () => {
    async function expectReplacement(
      moduleRows: Array<Record<string, unknown>>,
      draftModules: Array<Record<string, unknown>>,
      mutate: (
        repository: ReturnType<typeof createEditorRepository>,
      ) => Promise<unknown>,
    ) {
      const { calls, draftJson, pool, transactionEvents } = fakePool({
        draftJson: JSON.stringify({
          backgroundBlur: "medium",
          canvasGlass: 58,
          canvasVersion: 2,
          modules: draftModules,
          revision: canvasDraftRevisionOne,
          selectedModuleId: null,
        }),
        moduleRows,
      });
      const repository = createEditorRepository(pool as never);

      await mutate(repository);

      const replacement = JSON.parse(draftJson() ?? "{}") as {
        revision?: unknown;
      };
      const profileLockIndex = calls.findIndex(
        (call) =>
          call.query.includes("FROM profiles") &&
          call.query.includes("FOR UPDATE"),
      );
      const draftLock = calls.find(
        (call) =>
          call.query.includes("FROM profile_canvas_drafts") &&
          call.query.includes("SELECT user_id") &&
          call.query.includes("FOR UPDATE"),
      );
      const replacementSave = calls
        .filter((call) => call.query.includes("INSERT INTO profile_canvas_drafts"))
        .at(-1);

      expect(profileLockIndex).toBeGreaterThanOrEqual(0);
      expect(draftLock).toMatchObject({ source: "connection" });
      expect(replacementSave).toMatchObject({ source: "connection" });
      expect(replacement.revision).toMatch(/^draft:/u);
      expect(replacement.revision).not.toBe(canvasDraftRevisionOne);
      expect(transactionEvents).toEqual(["begin", "commit"]);
    }

    await expectReplacement(
      [profileInfoRow(1), musicRow()],
      [profileInfoPayload(1), persistedMusicPayload()],
      (repository) => repository.deleteModule(session, 20),
    );
    await expectReplacement(
      [
        profileInfoRow(1),
        { ...musicRow(), status: "deleted", visibility: "hidden" },
      ],
      [profileInfoPayload(1)],
      (repository) => repository.restoreModule(session, 20),
    );
    await expectReplacement(
      [profileInfoRow(1), musicRow()],
      [profileInfoPayload(1), persistedMusicPayload()],
      (repository) =>
        repository.updateModuleOrder(session, { moduleIds: [20, 10] }),
    );
    await expectReplacement(
      [profileInfoRow(1), musicRow()],
      [profileInfoPayload(1), persistedMusicPayload()],
      (repository) =>
        repository.updateCanvas(session, { backgroundBlur: "soft" }),
    );
  });

  it("prevents a stale autosave from recreating a draft after commit", async () => {
    const { draftJson, pool, transactionEvents } = fakePool({
      draftJson: JSON.stringify({
        backgroundBlur: "medium",
        canvasGlass: 58,
        canvasVersion: 2,
        modules: [profileInfoPayload(1)],
        revision: canvasDraftRevisionOne,
        selectedModuleId: null,
      }),
      moduleRows: [profileInfoRow(1)],
    });
    const repository = createEditorRepository(pool as never);

    await repository.commitCanvasDraft(session, canvasDraftRevisionOne);
    await expect(
      repository.updateCanvasDraft(session, {
        backgroundBlur: "heavy",
        expectedRevision: canvasDraftRevisionOne,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(draftJson()).toBeUndefined();
    expect(transactionEvents).toEqual([
      "begin",
      "commit",
      "begin",
      "rollback",
    ]);
  });

  it("rejects a stale commit revision before mutating modules or deleting the draft", async () => {
    const initialDraft = JSON.stringify({
      backgroundBlur: "medium",
      canvasGlass: 58,
      canvasVersion: 2,
      modules: [profileInfoPayload(1)],
      revision: canvasDraftRevisionOne,
      selectedModuleId: null,
    });
    const { draftJson, moduleUpdates, pool, transactionEvents } = fakePool({
      draftJson: initialDraft,
      moduleRows: [profileInfoRow(1)],
    });
    const repository = createEditorRepository(pool as never);

    await expect(
      repository.commitCanvasDraft(session, canvasDraftRevisionTwo),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(draftJson()).toBe(initialDraft);
    expect(moduleUpdates).toHaveLength(0);
    expect(transactionEvents).toEqual(["begin", "rollback"]);
  });

  it("rejects a stale explicit revision before deleting a newer draft", async () => {
    const initialDraft = JSON.stringify({
      backgroundBlur: "medium",
      canvasGlass: 58,
      canvasVersion: 2,
      modules: [profileInfoPayload(1)],
      revision: canvasDraftRevisionOne,
      selectedModuleId: null,
    });
    const { draftJson, pool, transactionEvents } = fakePool({
      draftJson: initialDraft,
      moduleRows: [profileInfoRow(1)],
    });
    const repository = createEditorRepository(pool as never);

    await expect(
      repository.deleteCanvasDraft(session, canvasDraftRevisionTwo),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(draftJson()).toBe(initialDraft);
    expect(transactionEvents).toEqual(["begin", "rollback"]);
  });

  it("allows an omitted revision to commit a revisioned draft for legacy clients", async () => {
    const { draftJson, pool, transactionEvents } = fakePool({
      draftJson: JSON.stringify({
        backgroundBlur: "medium",
        canvasGlass: 58,
        canvasVersion: 2,
        modules: [profileInfoPayload(1)],
        revision: canvasDraftRevisionOne,
        selectedModuleId: null,
      }),
      moduleRows: [profileInfoRow(1)],
    });
    const repository = createEditorRepository(pool as never);

    await expect(repository.commitCanvasDraft(session)).resolves.toMatchObject({
      canvasVersion: 2,
    });

    expect(draftJson()).toBeUndefined();
    expect(transactionEvents).toEqual(["begin", "commit"]);
  });

  it("deletes a draft only when its expected revision matches", async () => {
    const { draftJson, pool, transactionEvents } = fakePool({
      draftJson: JSON.stringify({
        backgroundBlur: "medium",
        canvasGlass: 58,
        canvasVersion: 2,
        modules: [profileInfoPayload(1)],
        revision: canvasDraftRevisionOne,
        selectedModuleId: null,
      }),
      moduleRows: [profileInfoRow(1)],
    });
    const repository = createEditorRepository(pool as never);

    const result = await repository.deleteCanvasDraft(
      session,
      canvasDraftRevisionOne,
    );

    expect(draftJson()).toBeUndefined();
    expect(result.revision).toBeNull();
    expect(transactionEvents).toEqual(["begin", "commit"]);
  });

  it("allows an omitted revision to delete a revisioned draft for legacy clients", async () => {
    const { draftJson, pool, transactionEvents } = fakePool({
      draftJson: JSON.stringify({
        backgroundBlur: "medium",
        canvasGlass: 58,
        canvasVersion: 2,
        modules: [profileInfoPayload(1)],
        revision: canvasDraftRevisionOne,
        selectedModuleId: null,
      }),
      moduleRows: [profileInfoRow(1)],
    });
    const repository = createEditorRepository(pool as never);

    await expect(repository.deleteCanvasDraft(session)).resolves.toMatchObject({
      revision: null,
    });

    expect(draftJson()).toBeUndefined();
    expect(transactionEvents).toEqual(["begin", "commit"]);
  });

  it("serializes direct module creation with canvas commits through the profile lock", async () => {
    const { calls, draftJson, pool, transactionEvents } = fakePool({
      draftJson: JSON.stringify({
        backgroundBlur: "medium",
        canvasGlass: 58,
        canvasVersion: 2,
        modules: [profileInfoPayload(1), persistedMusicPayload()],
        revision: canvasDraftRevisionOne,
        selectedModuleId: null,
      }),
      moduleRows: [profileInfoRow(1), musicRow()],
    });
    const repository = createEditorRepository(pool as never);

    await repository.createModule(session, {
      config: { body: "A link https://thia.lol" },
      status: "active",
      title: "Note",
      type: "custom_text",
      visibility: "public",
    });

    const profileLock = calls.find(
      (call) =>
        call.query.includes("FROM profiles") &&
        call.query.includes("FOR UPDATE"),
    );
    const directInsert = calls.find(
      (call) =>
        call.query.includes("INSERT INTO profile_modules") &&
        call.params?.length === 8,
    );
    const guardedCount = calls.find(
      (call) =>
        call.query.includes("COUNT(*) AS module_count") &&
        !call.query.includes("type NOT IN"),
    );
    const replacement = JSON.parse(draftJson() ?? "{}") as {
      modules?: Array<{ type?: unknown }>;
      revision?: unknown;
    };

    expect(profileLock).toMatchObject({ source: "connection" });
    expect(directInsert).toMatchObject({ source: "connection" });
    expect(guardedCount).toMatchObject({ source: "connection" });
    expect(replacement.revision).toMatch(/^draft:/u);
    expect(replacement.revision).not.toBe(canvasDraftRevisionOne);
    expect(replacement.modules?.some((module) => module.type === "custom_text")).toBe(true);
    expect(transactionEvents).toEqual(["begin", "commit"]);
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

  it("writes profile module text entities through the canvas commit transaction", async () => {
    const customText = {
      ...draftCustomTextPayload(),
      config: {
        body: "Draft note https://thia.lol",
        configured: true,
      },
    };
    const { calls, pool, transactionEvents } = fakePool({
      draftJson: JSON.stringify({
        backgroundBlur: "medium",
        canvasGlass: 58,
        canvasVersion: 2,
        modules: [profileInfoPayload(1), customText],
        selectedModuleId: null,
      }),
      moduleRows: [profileInfoRow(1)],
    });
    const repository = createEditorRepository(pool as never);

    await repository.commitCanvasDraft(session);

    const draftRead = calls.find(
      (call) =>
        call.query.includes("FROM profile_canvas_drafts") &&
        call.query.includes("SELECT draft_json"),
    );
    const profileLock = calls.find(
      (call) =>
        call.query.includes("FROM profiles") &&
        call.query.includes("FOR UPDATE"),
    );
    const textEntityWrites = calls.filter(
      (call) =>
        call.query.includes("DELETE FROM text_entities") ||
        call.query.includes("INSERT INTO text_entities"),
    );
    expect(draftRead).toMatchObject({ source: "connection" });
    expect(draftRead?.query).toContain("FOR UPDATE");
    expect(profileLock).toMatchObject({ source: "connection" });
    expect(
      textEntityWrites.some((call) =>
        call.query.includes("INSERT INTO text_entities"),
      ),
    ).toBe(true);
    expect(textEntityWrites.every((call) => call.source === "connection")).toBe(
      true,
    );
    expect(transactionEvents).toEqual(["begin", "commit"]);
  });

  it("rejects a persisted canvas module id owned by another user before touching text entities", async () => {
    const foreignModuleId = 99;
    const foreignDraftModule = {
      ...persistedMusicPayload({
        config: { body: "Another user's text" },
        status: "deleted",
        type: "custom_text",
        visibility: "hidden",
      }),
      id: foreignModuleId,
    };
    const foreignModuleRow = {
      ...musicRow({ type: "custom_text" }),
      id: foreignModuleId,
      user_id: 2,
      config_json: JSON.stringify({ body: "Another user's text" }),
    };
    const {
      calls,
      deletedModuleUpdates,
      moduleRows,
      moduleUpdates,
      pool,
      transactionEvents,
    } = fakePool({
      draftJson: JSON.stringify({
        backgroundBlur: "medium",
        canvasGlass: 58,
        canvasVersion: 2,
        modules: [profileInfoPayload(1), foreignDraftModule],
        selectedModuleId: null,
      }),
      moduleRows: [profileInfoRow(1), foreignModuleRow],
    });
    const repository = createEditorRepository(pool as never);

    await expect(repository.commitCanvasDraft(session)).rejects.toMatchObject({
      message:
        "Profile modules changed while this draft was open. Reload the editor and try again.",
      statusCode: 409,
    });

    expect(moduleUpdates).toHaveLength(0);
    expect(deletedModuleUpdates).toHaveLength(0);
    expect(moduleRows.find((row) => row.id === foreignModuleId)).toMatchObject({
      status: "active",
      user_id: 2,
    });
    expect(
      calls.some(
        (call) =>
          call.query.includes("text_entities") &&
          Number(call.params?.[1]) === foreignModuleId,
      ),
    ).toBe(false);
    expect(transactionEvents).toEqual(["begin", "rollback"]);
  });

  it("rejects a stale persisted canvas module that was already deleted", async () => {
    const deletedMusicRow = {
      ...musicRow(),
      status: "deleted",
      visibility: "hidden",
    };
    const { moduleUpdates, pool, transactionEvents } = fakePool({
      draftJson: JSON.stringify({
        backgroundBlur: "medium",
        canvasGlass: 58,
        canvasVersion: 2,
        modules: [profileInfoPayload(1), persistedMusicPayload()],
        selectedModuleId: null,
      }),
      moduleRows: [profileInfoRow(1), deletedMusicRow],
    });
    const repository = createEditorRepository(pool as never);

    await expect(repository.commitCanvasDraft(session)).rejects.toMatchObject({
      statusCode: 409,
    });

    expect(moduleUpdates).toHaveLength(0);
    expect(transactionEvents).toEqual(["begin", "rollback"]);
  });

  it("rejects immutable type changes for persisted canvas modules", async () => {
    const { moduleRows, moduleUpdates, pool, transactionEvents } = fakePool({
      draftJson: JSON.stringify({
        backgroundBlur: "medium",
        canvasGlass: 58,
        canvasVersion: 2,
        modules: [
          profileInfoPayload(1),
          persistedMusicPayload({ type: "custom_text" }),
        ],
        selectedModuleId: null,
      }),
      moduleRows: [profileInfoRow(1), musicRow()],
    });
    const repository = createEditorRepository(pool as never);

    await expect(repository.commitCanvasDraft(session)).rejects.toMatchObject({
      message: "Module type cannot be changed.",
      statusCode: 422,
    });

    expect(moduleUpdates).toHaveLength(0);
    expect(moduleRows.find((row) => row.id === 20)?.type).toBe("music");
    expect(transactionEvents).toEqual(["begin", "rollback"]);
  });

  it("rejects canvas commits when an expected module update affects no row", async () => {
    const { pool, transactionEvents } = fakePool({
      draftJson: JSON.stringify({
        backgroundBlur: "medium",
        canvasGlass: 58,
        canvasVersion: 2,
        modules: [profileInfoPayload(1), persistedMusicPayload()],
        selectedModuleId: null,
      }),
      moduleRows: [profileInfoRow(1), musicRow()],
      moduleUpdateAffectedRows: 0,
    });
    const repository = createEditorRepository(pool as never);

    await expect(repository.commitCanvasDraft(session)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(transactionEvents).toEqual(["begin", "rollback"]);
  });

  it("rejects canvas commits when an expected module delete affects no row", async () => {
    const { pool, transactionEvents } = fakePool({
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
      moduleDeleteAffectedRows: 0,
      moduleRows: [profileInfoRow(1), musicRow()],
    });
    const repository = createEditorRepository(pool as never);

    await expect(repository.commitCanvasDraft(session)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(transactionEvents).toEqual(["begin", "rollback"]);
  });

  it("canonicalizes new legacy music playlist draft modules during commit", async () => {
    const { insertedModules, pool } = fakePool({
      draftJson: JSON.stringify({
        backgroundBlur: "medium",
        canvasGlass: 58,
        canvasVersion: 2,
        modules: [
          profileInfoPayload(1),
          {
            id: -1004,
            type: "youtube_music_playlist",
            title: "Set list",
            config: {
              label: "Set list",
              platform: "youtube",
              url: "https://www.youtube.com/playlist?list=PL123",
            },
            visibility: "public",
            position: 2,
            pinned: false,
            layout: {
              column: 3,
              row: 4,
              colSpan: 4,
              rowSpan: 3,
            },
            status: "active",
            schemaVersion: 1,
            createdAt: null,
            updatedAt: null,
          },
        ],
        selectedModuleId: null,
      }),
      moduleRows: [profileInfoRow(0)],
    });
    const repository = createEditorRepository(pool as never);

    await repository.commitCanvasDraft(session);

    expect(insertedModules).toContainEqual(
      expect.objectContaining({
        type: "music_playlist",
      }),
    );
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

  it("allows a new Activity draft when the only persisted Activity row is already deleted", async () => {
    const deletedActivity = {
      ...activityRow(),
      status: "deleted",
      visibility: "hidden",
    };
    const { insertedModules, pool } = fakePool({
      draftJson: JSON.stringify({
        backgroundBlur: "medium",
        canvasGlass: 58,
        canvasVersion: 2,
        modules: [profileInfoPayload(1), draftActivityPayload(-1002, 2)],
        selectedModuleId: null,
      }),
      moduleRows: [profileInfoRow(1), deletedActivity],
    });
    const repository = createEditorRepository(pool as never);

    await repository.commitCanvasDraft(session);

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

  it("canonicalizes existing legacy music modules during canvas commit", async () => {
    const { moduleRows, moduleUpdates, pool } = fakePool({
      draftJson: JSON.stringify({
        backgroundBlur: "medium",
        canvasGlass: 58,
        canvasVersion: 2,
        modules: [profileInfoPayload(1), persistedMusicPayload({ type: "spotify_song" })],
        selectedModuleId: null,
      }),
      moduleRows: [profileInfoRow(1), musicRow({ type: "spotify_song" })],
    });
    const repository = createEditorRepository(pool as never);

    const result = await repository.commitCanvasDraft(session);
    const musicUpdate = moduleUpdates.find((update) => update.id === 20);
    const musicModule = result.modules.find((module) => module.id === 20);

    expect(musicUpdate?.type).toBe("music");
    expect(moduleRows.find((row) => row.id === 20)?.type).toBe("music");
    expect(musicModule?.type).toBe("music");
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
