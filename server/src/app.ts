import { randomUUID } from "node:crypto";

import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
  type FastifyServerOptions,
} from "fastify";
import { z } from "zod";

import { BadgeStorageNotReadyError, type BadgePayload, type BadgesRepository } from "./badges.js";
import {
  normalizePostIdentifier,
  type DiscoverFeedPayload,
  type HomeFeedPayload,
  type PostDetailPayload,
  type PostsRepository,
} from "./posts.js";
import {
  normalizeProfileHandle,
  type FollowUserCardPayload,
  type ProfileBadgesPayload,
  type ProfileModulePayload,
  type ProfilePayload,
  type ProfilesRepository,
} from "./profiles.js";
import {
  normalizeRoomSlug,
  RoomStorageNotReadyError,
  type RoomMemberPayload,
  type RoomPayload,
  type RoomsRepository,
} from "./rooms.js";
import { type SearchPayload, type SearchRepository } from "./search.js";
import type { SessionsRepository } from "./sessions.js";
import type { PublicStatsPayload, StatsRepository } from "./stats.js";

const healthQuerySchema = z.object({
  db: z.union([z.string(), z.array(z.string())]).optional(),
});

const searchQuerySchema = z
  .object({
    q: z.union([z.string(), z.array(z.string())]).optional(),
  })
  .passthrough();

const roomParamsSchema = z.object({
  slug: z.string(),
});

const profileParamsSchema = z.object({
  handle: z.string(),
});

const postIdentifierParamsSchema = z.object({
  identifier: z.string(),
});

const postRepliesParamsSchema = z.object({
  id: z.string(),
});

export const requestIdHeader = "X-Thia-Request-Id";

export const nodeApiLogRedactPaths = [
  "req.headers.cookie",
  "req.headers.authorization",
  "req.headers.proxy-authorization",
  "req.headers.x-api-key",
  "req.headers.x-csrf-token",
  "req.headers.x-xsrf-token",
  "headers.cookie",
  "headers.authorization",
  "headers.proxy-authorization",
  "headers.x-api-key",
  "headers.x-csrf-token",
  "headers.x-xsrf-token",
];

export interface AppDependencies {
  badgesRepository?: BadgesRepository;
  checkDatabase?: () => Promise<void>;
  profilesRepository?: ProfilesRepository;
  postsRepository?: PostsRepository;
  roomsRepository?: RoomsRepository;
  searchRepository?: SearchRepository;
  sessionsRepository?: SessionsRepository;
  statsRepository?: StatsRepository;
  publicBaseUrl?: string;
  logger?: FastifyServerOptions["logger"];
}

export interface HealthPayload {
  ok: true;
  service: "thia.lol api";
  status: "ok";
  time: string;
  database?: {
    ok: true;
  };
}

export interface ErrorPayload {
  ok: false;
  error: string;
  database?: {
    ok: false;
  };
}

interface SuccessPayload<T> {
  ok: true;
  data: T;
}

function wantsDatabaseCheck(query: unknown): boolean {
  const parsed = healthQuerySchema.safeParse(query);

  if (!parsed.success) {
    return false;
  }

  const value = parsed.data.db;

  if (Array.isArray(value)) {
    return value.includes("1");
  }

  return value === "1";
}

function successPayload<T>(data: T): SuccessPayload<T> {
  return {
    ok: true,
    data,
  };
}

function errorPayload(error: string): ErrorPayload {
  return {
    ok: false,
    error,
  };
}

function searchQueryFromRequest(query: unknown): unknown {
  const parsed = searchQuerySchema.safeParse(query);

  if (!parsed.success) {
    return "";
  }

  const value = parsed.data.q;

  return Array.isArray(value) ? "" : (value ?? "");
}

export function nodeApiLoggerOptions(level: string): NonNullable<FastifyServerOptions["logger"]> {
  return {
    level,
    redact: {
      paths: nodeApiLogRedactPaths,
      censor: "[redacted]",
    },
    serializers: {
      req(request: FastifyRequest) {
        const url = sanitizedUrl(request.url);

        return {
          method: request.method,
          url,
          host: request.hostname,
          remoteAddress: request.ip,
          remotePort: request.raw.socket.remotePort ?? 0,
        };
      },
    },
  };
}

function requestIdFromHeader(value: string | string[] | undefined): string | undefined {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (rawValue === undefined || !/^[A-Za-z0-9._:-]{8,128}$/.test(rawValue)) {
    return undefined;
  }

  return rawValue;
}

function generateRequestId(request: { headers: Record<string, string | string[] | undefined> }): string {
  return (
    requestIdFromHeader(request.headers["x-thia-request-id"]) ??
    requestIdFromHeader(request.headers["x-request-id"]) ??
    randomUUID()
  );
}

function sanitizedUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl, "https://thia.lol");
    const queryKeys = [...new Set([...url.searchParams.keys()])].sort();
    const query = queryKeys.map((key) => `${encodeURIComponent(key)}=[redacted]`).join("&");

    return query === "" ? url.pathname : `${url.pathname}?${query}`;
  } catch {
    return rawUrl.split("?", 1)[0] ?? rawUrl;
  }
}

function errorRecord(error: unknown): Record<string, string | number | boolean> {
  if (error === null || error === undefined) {
    return {
      type: String(error),
    };
  }

  if (typeof error !== "object") {
    return {
      type: typeof error,
      message: String(error).slice(0, 160),
    };
  }

  const record = error as Record<string, unknown>;
  const metadata: Record<string, string | number | boolean> = {
    type: error instanceof Error ? error.name : "ErrorLike",
  };
  const databaseLike =
    "sql" in record ||
    "sqlMessage" in record ||
    "sqlState" in record ||
    "errno" in record;

  if (error instanceof Error && !databaseLike) {
    metadata.message = error.message.slice(0, 160);
  }

  for (const key of ["code", "errno", "sqlState", "statusCode"]) {
    const value = record[key];

    if (typeof value === "string" || typeof value === "number") {
      metadata[key] = typeof value === "string" ? value.slice(0, 80) : value;
    }
  }

  if (databaseLike) {
    metadata.databaseError = true;
  }

  return metadata;
}

function logRouteFailure(
  request: FastifyRequest,
  routeName: string,
  statusCode: number,
  error: unknown,
): void {
  request.log.error(
    {
      routeName,
      requestId: request.id,
      method: request.method,
      url: sanitizedUrl(request.url),
      statusCode,
      error: errorRecord(error),
    },
    "Node API route failed",
  );
}

function sendRouteError(
  request: FastifyRequest,
  reply: FastifyReply,
  routeName: string,
  statusCode: number,
  payload: ErrorPayload,
  error: unknown,
) {
  logRouteFailure(request, routeName, statusCode, error);

  return reply.status(statusCode).send(payload);
}

function internalError(
  request: FastifyRequest,
  reply: FastifyReply,
  routeName: string,
  error: unknown,
) {
  return sendRouteError(request, reply, routeName, 500, errorPayload("Internal server error."), error);
}

async function withPublicProfileSubroute<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  repository: ProfilesRepository | undefined,
  routeName: string,
  lookup: (repository: ProfilesRepository, handle: string) => Promise<T | null>,
) {
  if (repository === undefined) {
    return internalError(request, reply, routeName, new Error("Missing profiles repository dependency."));
  }

  const parsedParams = profileParamsSchema.safeParse(request.params);
  const normalizedHandle = parsedParams.success ? normalizeProfileHandle(parsedParams.data.handle) : null;

  if (normalizedHandle === null) {
    return reply.status(400).send(errorPayload("Invalid profile handle."));
  }

  try {
    const data = await lookup(repository, normalizedHandle);

    if (data === null) {
      return reply.status(404).send(errorPayload("Profile not found."));
    }

    return reply.send(successPayload<T>(data));
  } catch (error) {
    return internalError(request, reply, routeName, error);
  }
}

async function currentViewerUserId(
  request: { headers: { cookie?: string | undefined } },
  repository: SessionsRepository | undefined,
): Promise<number | null> {
  if (repository === undefined) {
    return null;
  }

  const session = await repository.currentSession(request.headers.cookie);

  return session?.userId ?? null;
}

export function buildApp(dependencies: AppDependencies = {}): FastifyInstance {
  const app = Fastify({
    genReqId: generateRequestId,
    logger: dependencies.logger ?? false,
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header(requestIdHeader, request.id);
  });

  app.get("/health", async (request, reply) => {
    const payload: HealthPayload = {
      ok: true,
      service: "thia.lol api",
      status: "ok",
      time: new Date().toISOString(),
    };

    if (wantsDatabaseCheck(request.query)) {
      try {
        await dependencies.checkDatabase?.();
      } catch (exception) {
        const error: ErrorPayload = {
          ...errorPayload("Database connection failed."),
          database: {
            ok: false,
          },
        };

        return sendRouteError(request, reply, "health.db", 503, error, exception);
      }

      payload.database = {
        ok: true,
      };
    }

    return reply.send(payload);
  });

  app.get("/rooms", async (request, reply) => {
    if (dependencies.roomsRepository === undefined) {
      return internalError(request, reply, "rooms.index", new Error("Missing rooms repository dependency."));
    }

    try {
      const rooms = await dependencies.roomsRepository.listPublicRooms();

      return reply.send(successPayload<RoomPayload[]>(rooms));
    } catch (error) {
      return internalError(request, reply, "rooms.index", error);
    }
  });

  app.get("/rooms/:slug/members", async (request, reply) => {
    if (dependencies.roomsRepository === undefined) {
      return internalError(request, reply, "rooms.members", new Error("Missing rooms repository dependency."));
    }

    const parsedParams = roomParamsSchema.safeParse(request.params);
    const normalizedSlug = parsedParams.success ? normalizeRoomSlug(parsedParams.data.slug) : null;

    if (normalizedSlug === null) {
      return reply.status(400).send(errorPayload("Invalid room slug."));
    }

    try {
      const members = await dependencies.roomsRepository.getPublicRoomMembers(normalizedSlug);

      if (members === null) {
        return reply.status(404).send(errorPayload("Room not found."));
      }

      return reply.send(successPayload<RoomMemberPayload[]>(members));
    } catch (error) {
      if (error instanceof RoomStorageNotReadyError) {
        return sendRouteError(request, reply, "rooms.members", 503, errorPayload(error.message), error);
      }

      return internalError(request, reply, "rooms.members", error);
    }
  });

  app.get("/rooms/:slug", async (request, reply) => {
    if (dependencies.roomsRepository === undefined) {
      return internalError(request, reply, "rooms.show", new Error("Missing rooms repository dependency."));
    }

    const parsedParams = roomParamsSchema.safeParse(request.params);
    const normalizedSlug = parsedParams.success ? normalizeRoomSlug(parsedParams.data.slug) : null;

    if (normalizedSlug === null) {
      return reply.status(400).send(errorPayload("Invalid room slug."));
    }

    try {
      const room = await dependencies.roomsRepository.getPublicRoom(normalizedSlug);

      if (room === null) {
        return reply.status(404).send(errorPayload("Room not found."));
      }

      return reply.send(successPayload<RoomPayload>(room));
    } catch (error) {
      return internalError(request, reply, "rooms.show", error);
    }
  });

  app.get("/search", async (request, reply) => {
    if (dependencies.searchRepository === undefined) {
      return internalError(request, reply, "search.index", new Error("Missing search repository dependency."));
    }

    try {
      const viewerUserId = await currentViewerUserId(request, dependencies.sessionsRepository);
      const results = await dependencies.searchRepository.search(searchQueryFromRequest(request.query), viewerUserId);

      return reply.send(successPayload<SearchPayload>(results));
    } catch (error) {
      return internalError(request, reply, "search.index", error);
    }
  });

  app.get("/badges", async (request, reply) => {
    if (dependencies.badgesRepository === undefined) {
      return internalError(request, reply, "badges.index", new Error("Missing badges repository dependency."));
    }

    try {
      const badges = await dependencies.badgesRepository.listPublicBadges();

      return reply.send(successPayload<BadgePayload[]>(badges));
    } catch (error) {
      if (error instanceof BadgeStorageNotReadyError) {
        return sendRouteError(request, reply, "badges.index", 503, errorPayload(error.message), error);
      }

      return internalError(request, reply, "badges.index", error);
    }
  });

  app.get("/stats", async (request, reply) => {
    if (dependencies.statsRepository === undefined) {
      return internalError(request, reply, "stats.index", new Error("Missing stats repository dependency."));
    }

    try {
      const stats = await dependencies.statsRepository.getPublicStats();

      return reply.send(successPayload<PublicStatsPayload>(stats));
    } catch (error) {
      return internalError(request, reply, "stats.index", error);
    }
  });

  app.get("/feed/home", async (request, reply) => {
    if (dependencies.postsRepository === undefined) {
      return internalError(request, reply, "feed.home", new Error("Missing posts repository dependency."));
    }

    try {
      const viewerUserId = await currentViewerUserId(request, dependencies.sessionsRepository);
      const feed = await dependencies.postsRepository.getHomeFeed(viewerUserId);

      return reply.send(successPayload<HomeFeedPayload>(feed));
    } catch (error) {
      return internalError(request, reply, "feed.home", error);
    }
  });

  app.get("/feed/discover", async (request, reply) => {
    if (dependencies.postsRepository === undefined || dependencies.roomsRepository === undefined) {
      return internalError(request, reply, "feed.discover", new Error("Missing feed repository dependency."));
    }

    try {
      const viewerUserId = await currentViewerUserId(request, dependencies.sessionsRepository);
      const [posts, rooms, peopleToWatch] = await Promise.all([
        dependencies.postsRepository.listDiscoverPosts(viewerUserId),
        dependencies.roomsRepository.listPublicRooms(),
        dependencies.postsRepository.listPeopleToWatch(viewerUserId),
      ]);
      const feed: DiscoverFeedPayload = {
        posts,
        activeRooms: rooms.slice(0, 6),
        peopleToWatch,
      };

      return reply.send(successPayload<DiscoverFeedPayload>(feed));
    } catch (error) {
      return internalError(request, reply, "feed.discover", error);
    }
  });

  app.get("/posts", async (request, reply) => {
    if (dependencies.postsRepository === undefined) {
      return internalError(request, reply, "posts.index", new Error("Missing posts repository dependency."));
    }

    try {
      const viewerUserId = await currentViewerUserId(request, dependencies.sessionsRepository);
      const posts = await dependencies.postsRepository.listPublicPosts(viewerUserId);

      return reply.send(successPayload(posts));
    } catch (error) {
      return internalError(request, reply, "posts.index", error);
    }
  });

  app.get("/posts/:id/replies", async (request, reply) => {
    if (dependencies.postsRepository === undefined) {
      return internalError(request, reply, "posts.replies", new Error("Missing posts repository dependency."));
    }

    const parsedParams = postRepliesParamsSchema.safeParse(request.params);
    const rawId = parsedParams.success ? parsedParams.data.id : "";

    if (!/^[0-9]+$/.test(rawId)) {
      return reply.status(404).send(errorPayload("Not found."));
    }

    try {
      const viewerUserId = await currentViewerUserId(request, dependencies.sessionsRepository);
      const replies = await dependencies.postsRepository.listPostReplies(Number(rawId), viewerUserId);

      if (replies === null) {
        return reply.status(404).send(errorPayload("Post not found."));
      }

      return reply.send(successPayload(replies));
    } catch (error) {
      return internalError(request, reply, "posts.replies", error);
    }
  });

  app.get("/posts/:identifier", async (request, reply) => {
    if (dependencies.postsRepository === undefined) {
      return internalError(request, reply, "posts.show", new Error("Missing posts repository dependency."));
    }

    const parsedParams = postIdentifierParamsSchema.safeParse(request.params);
    const identifier = parsedParams.success ? parsedParams.data.identifier : "";

    if (normalizePostIdentifier(identifier) === null) {
      return reply.status(404).send(errorPayload("Not found."));
    }

    try {
      const viewerUserId = await currentViewerUserId(request, dependencies.sessionsRepository);
      const post = await dependencies.postsRepository.getPublicPost(
        identifier,
        viewerUserId,
        dependencies.publicBaseUrl ?? "https://thia.lol",
      );

      if (post === null) {
        return reply.status(404).send(errorPayload("Post not found."));
      }

      return reply.send(successPayload<PostDetailPayload>(post));
    } catch (error) {
      return internalError(request, reply, "posts.show", error);
    }
  });

  app.get("/rooms/:slug/posts", async (request, reply) => {
    if (dependencies.postsRepository === undefined) {
      return internalError(request, reply, "rooms.posts", new Error("Missing posts repository dependency."));
    }

    const parsedParams = roomParamsSchema.safeParse(request.params);
    const normalizedSlug = parsedParams.success ? normalizeRoomSlug(parsedParams.data.slug) : null;

    if (normalizedSlug === null) {
      return reply.status(400).send(errorPayload("Invalid room slug."));
    }

    try {
      const viewerUserId = await currentViewerUserId(request, dependencies.sessionsRepository);
      const posts = await dependencies.postsRepository.listRoomPosts(normalizedSlug, viewerUserId);

      if (posts === null) {
        return reply.status(404).send(errorPayload("Room not found."));
      }

      return reply.send(successPayload(posts));
    } catch (error) {
      return internalError(request, reply, "rooms.posts", error);
    }
  });

  app.get("/profiles/:handle/posts", async (request, reply) => {
    if (dependencies.postsRepository === undefined) {
      return internalError(request, reply, "profiles.posts", new Error("Missing posts repository dependency."));
    }

    const parsedParams = profileParamsSchema.safeParse(request.params);
    const normalizedHandle = parsedParams.success ? normalizeProfileHandle(parsedParams.data.handle) : null;

    if (normalizedHandle === null) {
      return reply.status(400).send(errorPayload("Invalid profile handle."));
    }

    try {
      const viewerUserId = await currentViewerUserId(request, dependencies.sessionsRepository);
      const posts = await dependencies.postsRepository.listProfilePosts(normalizedHandle, viewerUserId);

      if (posts === null) {
        return reply.status(404).send(errorPayload("Profile not found."));
      }

      return reply.send(successPayload(posts));
    } catch (error) {
      return internalError(request, reply, "profiles.posts", error);
    }
  });

  app.get("/profiles/:handle/replies", async (request, reply) => {
    if (dependencies.postsRepository === undefined) {
      return internalError(request, reply, "profiles.replies", new Error("Missing posts repository dependency."));
    }

    const parsedParams = profileParamsSchema.safeParse(request.params);
    const normalizedHandle = parsedParams.success ? normalizeProfileHandle(parsedParams.data.handle) : null;

    if (normalizedHandle === null) {
      return reply.status(400).send(errorPayload("Invalid profile handle."));
    }

    try {
      const viewerUserId = await currentViewerUserId(request, dependencies.sessionsRepository);
      const posts = await dependencies.postsRepository.listProfileReplies(normalizedHandle, viewerUserId);

      if (posts === null) {
        return reply.status(404).send(errorPayload("Profile not found."));
      }

      return reply.send(successPayload(posts));
    } catch (error) {
      return internalError(request, reply, "profiles.replies", error);
    }
  });

  app.get("/profiles/:handle/reblogs", async (request, reply) => {
    if (dependencies.postsRepository === undefined) {
      return internalError(request, reply, "profiles.reblogs", new Error("Missing posts repository dependency."));
    }

    const parsedParams = profileParamsSchema.safeParse(request.params);
    const normalizedHandle = parsedParams.success ? normalizeProfileHandle(parsedParams.data.handle) : null;

    if (normalizedHandle === null) {
      return reply.status(400).send(errorPayload("Invalid profile handle."));
    }

    try {
      const viewerUserId = await currentViewerUserId(request, dependencies.sessionsRepository);
      const posts = await dependencies.postsRepository.listProfileReblogs(normalizedHandle, viewerUserId);

      if (posts === null) {
        return reply.status(404).send(errorPayload("Profile not found."));
      }

      return reply.send(successPayload(posts));
    } catch (error) {
      return internalError(request, reply, "profiles.reblogs", error);
    }
  });

  app.get("/profiles/:handle/rooms", async (request, reply) =>
    withPublicProfileSubroute<RoomPayload[]>(
      request,
      reply,
      dependencies.profilesRepository,
      "profiles.rooms",
      (repository, handle) => repository.getPublicProfileRooms(handle),
    ),
  );

  app.get("/profiles/:handle/modules", async (request, reply) =>
    withPublicProfileSubroute<ProfileModulePayload[]>(
      request,
      reply,
      dependencies.profilesRepository,
      "profiles.modules",
      (repository, handle) => repository.getPublicProfileModules(handle),
    ),
  );

  app.get("/profiles/:handle/badges", async (request, reply) =>
    withPublicProfileSubroute<ProfileBadgesPayload>(
      request,
      reply,
      dependencies.profilesRepository,
      "profiles.badges",
      (repository, handle) => repository.getPublicProfileBadges(handle),
    ),
  );

  app.get("/profiles/:handle/followers", async (request, reply) =>
    withPublicProfileSubroute<FollowUserCardPayload[]>(
      request,
      reply,
      dependencies.profilesRepository,
      "profiles.followers",
      (repository, handle) => repository.getPublicProfileFollowers(handle),
    ),
  );

  app.get("/profiles/:handle/following", async (request, reply) =>
    withPublicProfileSubroute<FollowUserCardPayload[]>(
      request,
      reply,
      dependencies.profilesRepository,
      "profiles.following",
      (repository, handle) => repository.getPublicProfileFollowing(handle),
    ),
  );

  app.get("/profiles/:handle", async (request, reply) => {
    if (dependencies.profilesRepository === undefined) {
      return internalError(request, reply, "profiles.show", new Error("Missing profiles repository dependency."));
    }

    const parsedParams = profileParamsSchema.safeParse(request.params);
    const normalizedHandle = parsedParams.success ? normalizeProfileHandle(parsedParams.data.handle) : null;

    if (normalizedHandle === null) {
      return reply.status(400).send(errorPayload("Invalid profile handle."));
    }

    try {
      const profile = await dependencies.profilesRepository.getPublicProfile(normalizedHandle);

      if (profile === null) {
        return reply.status(404).send(errorPayload("Profile not found."));
      }

      return reply.send(successPayload<ProfilePayload>(profile));
    } catch (error) {
      return internalError(request, reply, "profiles.show", error);
    }
  });

  app.setErrorHandler((error, request, reply) => {
    return internalError(request, reply, "unhandled", error);
  });

  app.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send(errorPayload("Not found."));
  });

  return app;
}
