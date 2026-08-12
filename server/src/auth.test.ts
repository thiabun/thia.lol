import type { Pool } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";

import {
  AuthRouteError,
  buildClearSessionCookies,
  buildSessionCookie,
  createAuthRepository,
  hashPhpPassword,
  validateAuthDisplayName,
  validateAuthEmail,
  validateAuthHandle,
  validateAuthLoginIdentifier,
  validateAuthPassword,
  verifyPhpPassword,
} from "./auth.js";

const repositoryOptions = {
  cookieName: "thia_session",
  cookieDomain: null,
  csrfSecret: "test-csrf-secret",
  encryptionKey: "",
  sessionLifetimeSeconds: 3_600,
};

const requestContext = {
  ipAddress: "203.0.113.10",
  userAgent: "auth-test",
  host: "thia.lol",
  secure: true,
};

type ExecuteCall = {
  query: string;
  params: unknown[];
  source: "connection" | "pool";
};

function authSessionRow(
  tokenHash = "session-token-hash",
  overrides: Record<string, unknown> = {},
) {
  return {
    session_id: 11,
    user_id: 42,
    token_hash: tokenHash,
    handle: "viewer",
    email: "viewer@example.test",
    role: "member",
    status: "active",
    display_name: "Viewer",
    bio: null,
    location: null,
    avatar_url: null,
    banner_url: null,
    profile_accent: null,
    profile_background: null,
    profile_background_video_url: null,
    profile_background_video_poster_url: null,
    profile_background_blur: "medium",
    profile_theme: null,
    profile_theme_config_json: null,
    profile_canvas_glass_opacity: 58,
    links: "[]",
    traits: "[]",
    ...overrides,
  };
}

function createLoginPool(user: Record<string, unknown> | null) {
  const calls: ExecuteCall[] = [];
  const execute = vi.fn(async (query: string, params: unknown[] = []) => {
    calls.push({ query, params, source: "pool" });

    if (query.includes("INSERT INTO auth_rate_limits")) {
      return [{ affectedRows: 1 }, undefined];
    }

    if (query.includes("SELECT attempts") && query.includes("FROM auth_rate_limits")) {
      return [[{ attempts: 1 }], undefined];
    }

    if (query.includes("SELECT id, password_hash, status") && query.includes("FROM users")) {
      return [user === null ? [] : [user], undefined];
    }

    if (query.includes("INFORMATION_SCHEMA.TABLES")) {
      return [[{ table_count: 0 }], undefined];
    }

    if (query.includes("DELETE FROM sessions WHERE expires_at")) {
      return [{ affectedRows: 0 }, undefined];
    }

    if (query.includes("INSERT INTO sessions")) {
      return [{ insertId: 11, affectedRows: 1 }, undefined];
    }

    if (query.includes("FROM sessions s")) {
      return [[authSessionRow(String(params[0] ?? "session-token-hash"))], undefined];
    }

    throw new Error(`Unhandled login pool query: ${query}`);
  });

  return {
    calls,
    pool: { execute } as unknown as Pool,
  };
}

function createAvailabilityPool(options: {
  current?: boolean;
  hasHistory: boolean;
  reserved?: boolean;
}) {
  const calls: ExecuteCall[] = [];
  const execute = vi.fn(async (query: string, params: unknown[] = []) => {
    calls.push({ query, params, source: "pool" });

    if (query.includes("FROM users") && query.includes("WHERE handle = ?")) {
      return [options.current ? [{ user_exists: 1 }] : [], undefined];
    }

    if (query.includes("INFORMATION_SCHEMA.TABLES")) {
      return [[{ table_count: options.hasHistory ? 1 : 0 }], undefined];
    }

    if (query.includes("FROM user_handle_history")) {
      return [options.reserved ? [{ user_exists: 1 }] : [], undefined];
    }

    throw new Error(`Unhandled availability pool query: ${query}`);
  });

  return {
    calls,
    pool: { execute } as unknown as Pool,
  };
}

function createRegistrationPool(options: {
  hasHistory: boolean;
  reserved?: boolean;
}) {
  const calls: ExecuteCall[] = [];
  const beginTransaction = vi.fn(async () => undefined);
  const commit = vi.fn(async () => undefined);
  const rollback = vi.fn(async () => undefined);
  const release = vi.fn();
  const connectionExecute = vi.fn(async (query: string, params: unknown[] = []) => {
    calls.push({ query, params, source: "connection" });

    if (query.includes("FROM users") && query.includes("FOR UPDATE")) {
      return [[], undefined];
    }

    if (query.includes("FROM user_handle_history")) {
      return [options.reserved ? [{ user_exists: 1 }] : [], undefined];
    }

    if (query.includes("INSERT INTO users")) {
      return [{ insertId: 42, affectedRows: 1 }, undefined];
    }

    if (query.includes("INSERT INTO profiles")) {
      return [{ affectedRows: 1 }, undefined];
    }

    throw new Error(`Unhandled registration connection query: ${query}`);
  });
  const connection = {
    beginTransaction,
    commit,
    execute: connectionExecute,
    release,
    rollback,
  };
  const execute = vi.fn(async (query: string, params: unknown[] = []) => {
    calls.push({ query, params, source: "pool" });

    if (query.includes("INSERT INTO auth_rate_limits")) {
      return [{ affectedRows: 1 }, undefined];
    }

    if (query.includes("SELECT attempts") && query.includes("FROM auth_rate_limits")) {
      return [[{ attempts: 1 }], undefined];
    }

    if (query.includes("INFORMATION_SCHEMA.TABLES")) {
      const tableName = String(params[0] ?? "");
      return [[{ table_count: tableName === "user_handle_history" && options.hasHistory ? 1 : 0 }], undefined];
    }

    if (query.includes("DELETE FROM sessions WHERE expires_at")) {
      return [{ affectedRows: 0 }, undefined];
    }

    if (query.includes("INSERT INTO sessions")) {
      return [{ insertId: 11, affectedRows: 1 }, undefined];
    }

    if (query.includes("FROM sessions s")) {
      return [[authSessionRow(String(params[0] ?? "session-token-hash"), {
        display_name: "New User",
        email: "new@example.test",
        handle: "new_user",
      })], undefined];
    }

    throw new Error(`Unhandled registration pool query: ${query}`);
  });
  const getConnection = vi.fn(async () => connection);

  return {
    calls,
    commit,
    getConnection,
    pool: { execute, getConnection } as unknown as Pool,
    release,
    rollback,
  };
}

describe("auth password compatibility", () => {
  it("creates PHP-compatible bcrypt hashes and verifies them", async () => {
    const hash = await hashPhpPassword("correct-password");

    expect(hash.startsWith("$2y$")).toBe(true);
    await expect(verifyPhpPassword("correct-password", hash)).resolves.toBe(true);
    await expect(verifyPhpPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("verifies existing PHP $2y$ hashes", async () => {
    const hash = await hashPhpPassword("another-password");

    await expect(verifyPhpPassword("another-password", hash)).resolves.toBe(true);
  });
});

describe("auth validation", () => {
  it("normalizes and validates auth inputs like PHP", () => {
    expect(validateAuthEmail(" Viewer@Example.TEST ")).toBe("viewer@example.test");
    expect(validateAuthHandle("@Viewer_01")).toBe("viewer_01");
    expect(validateAuthLoginIdentifier(" Viewer@Example.TEST ")).toEqual({
      kind: "email",
      value: "viewer@example.test",
    });
    expect(validateAuthLoginIdentifier(" @Viewer_01 ")).toEqual({
      kind: "handle",
      value: "viewer_01",
    });
    expect(validateAuthLoginIdentifier("Viewer_01")).toEqual({
      kind: "handle",
      value: "viewer_01",
    });
    expect(validateAuthDisplayName(" Viewer ")).toBe("Viewer");
    expect(validateAuthPassword("1234567890")).toBe("1234567890");
  });

  it("rejects invalid auth inputs with PHP-compatible messages", () => {
    expect(() => validateAuthEmail("bad")).toThrow(new AuthRouteError("Enter a valid email address.", 422));
    expect(() => validateAuthHandle("no")).toThrow(
      new AuthRouteError("Handle must be 3-40 characters using letters, numbers, dashes, or underscores.", 422),
    );
    expect(() => validateAuthLoginIdentifier("no")).toThrow(
      new AuthRouteError("Enter a valid email address or handle.", 422),
    );
    expect(() => validateAuthLoginIdentifier(undefined)).toThrow(
      new AuthRouteError("Email or handle is required.", 422),
    );
    expect(() => validateAuthDisplayName("")).toThrow(new AuthRouteError("Display name must be 1-50 visible characters.", 422));
    expect(() => validateAuthHandle("@@viewer")).toThrow(
      new AuthRouteError("Handle must start with at most one @.", 422),
    );
    expect(() => validateAuthPassword("short")).toThrow(
      new AuthRouteError("Password must be at least 10 characters and at most 255 bytes.", 422),
    );
    expect(() => validateAuthPassword("🔐🔐🔐")).toThrow(
      new AuthRouteError("Password must be at least 10 characters and at most 255 bytes.", 422),
    );
    expect(validateAuthPassword("🔐🔐🔐🔐🔐🔐🔐🔐🔐🔐")).toBe("🔐🔐🔐🔐🔐🔐🔐🔐🔐🔐");
  });
});

describe("auth repository login identifiers", () => {
  it("prefers a canonical Handle identifier and allows a pending-deletion account to authenticate", async () => {
    const passwordHash = await hashPhpPassword("correct-password");
    const fake = createLoginPool({
      id: 42,
      password_hash: passwordHash,
      status: "active",
    });
    const repository = createAuthRepository(fake.pool, repositoryOptions);

    const result = await repository.login(
      {
        email: "ignored@example.test",
        identifier: "@Viewer",
        password: "correct-password",
      },
      requestContext,
    );

    expect("payload" in result).toBe(true);
    expect(fake.calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        params: ["viewer"],
        query: expect.stringContaining("WHERE handle = ?"),
      }),
    ]));
    expect(fake.calls.some((call) => call.query.includes("account_deletion_requests"))).toBe(false);
  });

  it("keeps the legacy email input and indexed email lookup working", async () => {
    const passwordHash = await hashPhpPassword("correct-password");
    const fake = createLoginPool({
      id: 42,
      password_hash: passwordHash,
      status: "active",
    });
    const repository = createAuthRepository(fake.pool, repositoryOptions);

    await expect(repository.login(
      {
        email: " Viewer@Example.TEST ",
        password: "correct-password",
      },
      requestContext,
    )).resolves.toHaveProperty("payload.user.email", "viewer@example.test");
    expect(fake.calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        params: ["viewer@example.test"],
        query: expect.stringContaining("WHERE email = ?"),
      }),
    ]));
  });

  it("uses one enumeration-safe error for an unknown identifier", async () => {
    const fake = createLoginPool(null);
    const repository = createAuthRepository(fake.pool, repositoryOptions);

    await expect(repository.login(
      {
        identifier: "@missing-user",
        password: "wrong-password",
      },
      requestContext,
    )).rejects.toEqual(new AuthRouteError("Invalid email, handle, or password.", 401));
  });

  it("uses the same enumeration-safe error for a known identifier with the wrong password", async () => {
    const fake = createLoginPool({
      id: 42,
      password_hash: await hashPhpPassword("correct-password"),
      status: "active",
    });
    const repository = createAuthRepository(fake.pool, repositoryOptions);

    await expect(repository.login(
      {
        identifier: "viewer@example.test",
        password: "wrong-password",
      },
      requestContext,
    )).rejects.toEqual(new AuthRouteError("Invalid email, handle, or password.", 401));
  });

  it.each(["pending", "suspended", "deleted"])(
    "rejects a correctly credentialed %s account with the generic login error",
    async (status) => {
      const fake = createLoginPool({
        id: 42,
        password_hash: await hashPhpPassword("correct-password"),
        status,
      });
      const repository = createAuthRepository(fake.pool, repositoryOptions);

      await expect(repository.login(
        {
          identifier: "@viewer",
          password: "correct-password",
        },
        requestContext,
      )).rejects.toEqual(new AuthRouteError("Invalid email, handle, or password.", 401));
      expect(fake.calls.some((call) => call.query.includes("INSERT INTO sessions"))).toBe(false);
    },
  );

  it("applies both the IP-wide and identifier-specific login limits", async () => {
    const fake = createLoginPool({
      id: 42,
      password_hash: await hashPhpPassword("correct-password"),
      status: "active",
    });
    const repository = createAuthRepository(fake.pool, repositoryOptions);

    await repository.login(
      {
        identifier: "viewer@example.test",
        password: "correct-password",
      },
      requestContext,
    );

    const rateLimitInserts = fake.calls.filter((call) =>
      call.query.includes("INSERT INTO auth_rate_limits"),
    );
    expect(rateLimitInserts).toHaveLength(2);
    expect(rateLimitInserts[0]?.params[1]).not.toBe(rateLimitInserts[1]?.params[1]);
  });
});

describe("auth repository Handle reservations", () => {
  it("reports an active old-Handle reservation as unavailable", async () => {
    const fake = createAvailabilityPool({
      hasHistory: true,
      reserved: true,
    });
    const repository = createAuthRepository(fake.pool, repositoryOptions);

    await expect(repository.checkHandleAvailability({ handle: "@Former_User" })).resolves.toEqual({
      available: false,
      handle: "former_user",
    });
    expect(fake.calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        params: ["former_user"],
        query: expect.stringContaining("FROM user_handle_history"),
      }),
    ]));
  });

  it("keeps availability working before the Handle history migration", async () => {
    const fake = createAvailabilityPool({
      hasHistory: false,
    });
    const repository = createAuthRepository(fake.pool, repositoryOptions);

    await expect(repository.checkHandleAvailability({ handle: "new_user" })).resolves.toEqual({
      available: true,
      handle: "new_user",
    });
    expect(fake.calls.some((call) => call.query.includes("FROM user_handle_history"))).toBe(false);
  });

  it("rejects registration when the requested Handle has an active reservation", async () => {
    const fake = createRegistrationPool({
      hasHistory: true,
      reserved: true,
    });
    const repository = createAuthRepository(fake.pool, repositoryOptions);

    await expect(repository.register(
      {
        displayName: "Former User",
        email: "former@example.test",
        handle: "former_user",
        password: "correct-password",
      },
      requestContext,
    )).rejects.toEqual(new AuthRouteError("Handle is temporarily unavailable.", 409));
    expect(fake.rollback).toHaveBeenCalledOnce();
    expect(fake.release).toHaveBeenCalledOnce();
    expect(fake.calls.some((call) => call.query.includes("INSERT INTO users"))).toBe(false);
  });

  it("registers normally when the Handle history table is not deployed", async () => {
    const fake = createRegistrationPool({
      hasHistory: false,
    });
    const repository = createAuthRepository(fake.pool, repositoryOptions);

    await expect(repository.register(
      {
        displayName: "New User",
        email: "new@example.test",
        handle: "new_user",
        password: "correct-password",
      },
      requestContext,
    )).resolves.toHaveProperty("payload.user.handle", "new_user");
    expect(fake.commit).toHaveBeenCalledOnce();
    expect(fake.release).toHaveBeenCalledOnce();
    expect(fake.calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        params: ["new_user"],
        query: expect.stringContaining("FOR UPDATE"),
        source: "connection",
      }),
    ]));
    expect(fake.calls.some((call) => call.query.includes("FROM user_handle_history"))).toBe(false);
  });

  it("registers when the Handle history table exists without an active reservation", async () => {
    const fake = createRegistrationPool({
      hasHistory: true,
      reserved: false,
    });
    const repository = createAuthRepository(fake.pool, repositoryOptions);

    await expect(repository.register(
      {
        displayName: "New User",
        email: "new@example.test",
        handle: "new_user",
        password: "correct-password",
      },
      requestContext,
    )).resolves.toHaveProperty("payload.user.handle", "new_user");
    expect(fake.calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        params: ["new_user"],
        query: expect.stringContaining("FOR UPDATE"),
        source: "connection",
      }),
      expect.objectContaining({
        params: ["new_user"],
        query: expect.stringContaining("reserved_until > UTC_TIMESTAMP()"),
        source: "connection",
      }),
    ]));
    expect(fake.commit).toHaveBeenCalledOnce();
  });
});

describe("auth session cookies", () => {
  it("serializes PHP-compatible session cookies", () => {
    expect(
      buildSessionCookie("thia_session", "token value", new Date("2026-06-24T12:00:00Z"), {
        domain: ".thia.lol",
        secure: true,
      }),
    ).toBe(
      "thia_session=token%20value; Expires=Wed, 24 Jun 2026 12:00:00 GMT; Path=/; Domain=.thia.lol; Secure; HttpOnly; SameSite=Lax",
    );
  });

  it("generates clear-cookie variants for host and thia.lol domains", () => {
    const cookies = buildClearSessionCookies("thia_session", {
      domain: null,
      host: "thia.lol",
      secure: true,
    });

    expect(cookies.some((cookie) => cookie.includes("thia_session=;"))).toBe(true);
    expect(cookies.some((cookie) => cookie.includes("Path=/api"))).toBe(true);
    expect(cookies.some((cookie) => cookie.includes("Domain=.thia.lol"))).toBe(true);
  });
});
