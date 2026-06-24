import { describe, expect, it } from "vitest";

import { createEditorRepository } from "./editor.js";

type ExecuteCall = {
  query: string;
  params?: unknown[];
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

function fakePool() {
  const calls: ExecuteCall[] = [];
  const pool = {
    async execute(query: string, params?: unknown[]) {
      calls.push({ query, params });

      if (query.includes("INFORMATION_SCHEMA.TABLES")) {
        return [[{ table_count: tableNames.has(String(params?.[0])) ? 1 : 0 }], undefined];
      }

      if (query.includes("INFORMATION_SCHEMA.COLUMNS")) {
        return [[{ column_count: columnNames.has(String(params?.[1])) ? 1 : 0 }], undefined];
      }

      if (query.includes("SELECT id") && query.includes("WHERE user_id = ?") && query.includes("AND type = ?")) {
        return [[{ id: params?.[1] === "profile_info" ? 10 : 12 }], undefined];
      }

      if (query.includes("COUNT(*) AS module_count") && query.includes("type NOT IN")) {
        return [[{ module_count: 1 }], undefined];
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
          [
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
          ],
          undefined,
        ];
      }

      throw new Error(`Unhandled fake pool query: ${query}`);
    },
  };

  return { calls, pool };
}

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
});
