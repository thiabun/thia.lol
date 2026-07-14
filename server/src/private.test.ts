import { describe, expect, it } from "vitest";

import {
  authSessionPayload,
  csrfTokenForSession,
  notificationConversationId,
  notificationIdsFromPayload,
  notificationPayloadFromRow,
  notificationTargetUrl,
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
  bannerUrl: "/uploads/banner.png",
  profileAccent: "rose",
  profileBackground: "/uploads/background.webp",
  profileBackgroundVideo: "/uploads/background.mp4",
  profileBackgroundVideoPoster: "/uploads/background-poster.webp",
  profileBackgroundBlur: "heavy",
  profileTheme: "glinda",
  profileThemeConfig: '{"mode":"preset","preset":"glinda"}',
  profileCanvasGlass: "80",
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
        bannerUrl: "/uploads/banner.png",
        profileAccent: "rose",
        profileBackground: "/uploads/background.webp",
        profileBackgroundVideo: "/uploads/background.mp4",
        profileBackgroundVideoPoster: "/uploads/background-poster.webp",
        profileBackgroundBlur: "heavy",
        profileTheme: "glinda",
        profileThemeConfig: {
          mode: "preset",
          preset: "glinda",
        },
        profileCanvasGlass: 80,
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

  it("normalizes profile appearance values for auth/me", () => {
    expect(authSessionPayload({
      ...session,
      profileBackgroundBlur: "mist",
      profileTheme: "sunveil",
      profileCanvasGlass: "999",
    }, "secret").profile).toMatchObject({
      profileBackgroundBlur: "medium",
      profileTheme: "glinda",
      profileCanvasGlass: 92,
    });

    expect(authSessionPayload({
      ...session,
      profileBackgroundBlur: undefined,
      profileTheme: "frostveil",
      profileCanvasGlass: -5.7,
    }, "secret").profile).toMatchObject({
      profileBackgroundBlur: "medium",
      profileTheme: "elphaba",
      profileCanvasGlass: 0,
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
  it("routes direct and room message notifications to their owning surfaces", () => {
    expect(notificationTargetUrl("message", null, null, null, { conversationId: 17 })).toBe(
      "/chat?conversation=17",
    );
    expect(
      notificationTargetUrl(
        "message",
        null,
        null,
        { slug: "general" } as Parameters<typeof notificationTargetUrl>[3],
        { conversationId: 18, channelSlug: "announcements", messageContext: "room" },
      ),
    ).toBe("/rooms/general?tab=chat&channel=announcements");
    expect(
      notificationTargetUrl("message", null, null, null, {
        conversationId: 18,
        messageContext: "room",
        roomSlug: "general",
        channelSlug: "announcements",
      }),
    ).toBe("/rooms/general?tab=chat&channel=announcements");
  });

  it("accepts only bounded positive conversation ids from notification metadata", () => {
    expect(notificationConversationId({ conversationId: 17 })).toBe(17);
    expect(notificationConversationId({ conversationId: "18" })).toBe(18);
    expect(notificationConversationId({ conversationId: 0 })).toBeNull();
    expect(notificationConversationId({ conversationId: "not-a-number" })).toBeNull();
    expect(notificationConversationId([])).toBeNull();
  });

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
        room_theme: null,
        room_theme_config_json: null,
        room_legacy_accent: null,
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
