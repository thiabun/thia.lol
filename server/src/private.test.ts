import { describe, expect, it } from "vitest";

import {
  authSessionPayload,
  csrfTokenForSession,
  notificationIdsFromPayload,
  notificationPayloadFromRow,
  onboardingStepListForStoredJson,
  PrivateRouteError,
  settingsPostKind,
} from "./private.js";
import type { RequestSession } from "./sessions.js";

const session: RequestSession = {
  sessionId: 7,
  userId: 42,
  tokenHash: "hash",
  handle: "viewer",
  email: "viewer@example.test",
  role: "member",
  status: "active",
  displayName: "Viewer",
  bio: "Hello",
  location: "Oslo",
  avatarUrl: "/uploads/avatar.png",
  links: '[{"label":"site"}]',
  traits: '["soft"]',
};

describe("private preview auth helpers", () => {
  it("generates CSRF tokens using the PHP session HMAC contract", () => {
    expect(csrfTokenForSession(session, "secret")).toBe("x79cYYUq_6HomXDaLpoJ3FnubdzOU2f6k0LaCZVqh38");
  });

  it("maps auth/me payloads like PHP", () => {
    expect(authSessionPayload(session, "secret")).toEqual({
      user: {
        id: 42,
        handle: "viewer",
        email: "viewer@example.test",
        role: "member",
        status: "active",
        displayName: "Viewer",
        avatarUrl: "/uploads/avatar.png",
      },
      profile: {
        displayName: "Viewer",
        bio: "Hello",
        location: "Oslo",
        avatarUrl: "/uploads/avatar.png",
        links: [
          {
            label: "site",
          },
        ],
        traits: ["soft"],
      },
      csrfToken: "x79cYYUq_6HomXDaLpoJ3FnubdzOU2f6k0LaCZVqh38",
    });
  });

  it("falls back invalid private post kind filters to all", () => {
    expect(settingsPostKind("posts")).toBe("posts");
    expect(settingsPostKind("replies")).toBe("replies");
    expect(settingsPostKind("all")).toBe("all");
    expect(settingsPostKind("unknown")).toBe("all");
    expect(settingsPostKind(["posts"])).toBe("all");
  });

  it("uses the current PHP onboarding step order and filters unknown legacy values", () => {
    expect(
      onboardingStepListForStoredJson('["profile_canvas","unknown","profile_basics","apple_music"]'),
    ).toEqual(["profile_basics", "apple_music", "profile_canvas"]);
  });

  it("normalizes notification read ids like PHP", () => {
    expect(notificationIdsFromPayload({
      id: "8",
      ids: [8, "9", "8"],
    })).toEqual([8, 9]);
  });

  it("rejects invalid notification read id payloads with PHP-compatible errors", () => {
    expect(() => notificationIdsFromPayload({})).toThrow(new PrivateRouteError("At least one notification id is required.", 422));
    expect(() => notificationIdsFromPayload({ ids: "8" })).toThrow(new PrivateRouteError("Notification ids must be an array.", 422));
    expect(() => notificationIdsFromPayload({ id: 0 })).toThrow(new PrivateRouteError("Notification id must be numeric.", 422));
    expect(() => notificationIdsFromPayload({ ids: Array.from({ length: 101 }, (_, index) => index + 1) })).toThrow(
      new PrivateRouteError("Too many notification ids.", 422),
    );
  });
});

describe("private preview notification mapping", () => {
  it("maps notification payloads and target URLs like PHP", () => {
    expect(
      notificationPayloadFromRow({
        id: "9",
        user_id: 42,
        actor_id: "1",
        type: "follow",
        post_id: null,
        room_id: null,
        data: null,
        read_at: null,
        created_at: "2026-06-24 10:00:00",
        actor_handle: "thia",
        actor_display_name: "Thia",
        actor_avatar_url: null,
        post_body: null,
        post_created_at: null,
        post_author_user_id: null,
        post_author_handle: null,
        post_author_display_name: null,
        post_author_avatar_url: null,
        joined_room_id: null,
        room_slug: null,
        room_name: null,
        room_summary: null,
        room_mood: null,
        room_member_count: null,
        room_is_live: null,
        room_accent: null,
        room_visibility: null,
        room_created_by: null,
        owner_user_id: null,
        owner_handle: null,
        owner_display_name: null,
        owner_avatar_url: null,
        room_created_at: null,
        room_updated_at: null,
      }),
    ).toMatchObject({
      id: 9,
      type: "follow",
      actor: {
        id: 1,
        handle: "thia",
        displayName: "Thia",
      },
      targetUrl: "/@thia",
    });
  });
});
