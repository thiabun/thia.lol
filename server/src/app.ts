import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import { z } from "zod";

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
import { normalizeRoomSlug, type RoomPayload, type RoomsRepository } from "./rooms.js";
import type { SessionsRepository } from "./sessions.js";
import type { PublicStatsPayload, StatsRepository } from "./stats.js";

const healthQuerySchema = z.object({
  db: z.union([z.string(), z.array(z.string())]).optional(),
});

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

export interface AppDependencies {
  checkDatabase?: () => Promise<void>;
  profilesRepository?: ProfilesRepository;
  postsRepository?: PostsRepository;
  roomsRepository?: RoomsRepository;
  sessionsRepository?: SessionsRepository;
  statsRepository?: StatsRepository;
  publicBaseUrl?: string;
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

async function withPublicProfileSubroute<T>(
  request: { params: unknown },
  reply: FastifyReply,
  repository: ProfilesRepository | undefined,
  lookup: (repository: ProfilesRepository, handle: string) => Promise<T | null>,
) {
  if (repository === undefined) {
    return reply.status(500).send(errorPayload("Internal server error."));
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
  } catch {
    return reply.status(500).send(errorPayload("Internal server error."));
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
    logger: false,
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
      } catch {
        const error: ErrorPayload = {
          ...errorPayload("Database connection failed."),
          database: {
            ok: false,
          },
        };

        return reply.status(503).send(error);
      }

      payload.database = {
        ok: true,
      };
    }

    return reply.send(payload);
  });

  app.get("/rooms", async (_request, reply) => {
    if (dependencies.roomsRepository === undefined) {
      return reply.status(500).send(errorPayload("Internal server error."));
    }

    try {
      const rooms = await dependencies.roomsRepository.listPublicRooms();

      return reply.send(successPayload<RoomPayload[]>(rooms));
    } catch {
      return reply.status(500).send(errorPayload("Internal server error."));
    }
  });

  app.get("/rooms/:slug", async (request, reply) => {
    if (dependencies.roomsRepository === undefined) {
      return reply.status(500).send(errorPayload("Internal server error."));
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
    } catch {
      return reply.status(500).send(errorPayload("Internal server error."));
    }
  });

  app.get("/stats", async (_request, reply) => {
    if (dependencies.statsRepository === undefined) {
      return reply.status(500).send(errorPayload("Internal server error."));
    }

    try {
      const stats = await dependencies.statsRepository.getPublicStats();

      return reply.send(successPayload<PublicStatsPayload>(stats));
    } catch {
      return reply.status(500).send(errorPayload("Internal server error."));
    }
  });

  app.get("/feed/home", async (request, reply) => {
    if (dependencies.postsRepository === undefined) {
      return reply.status(500).send(errorPayload("Internal server error."));
    }

    try {
      const viewerUserId = await currentViewerUserId(request, dependencies.sessionsRepository);
      const feed = await dependencies.postsRepository.getHomeFeed(viewerUserId);

      return reply.send(successPayload<HomeFeedPayload>(feed));
    } catch {
      return reply.status(500).send(errorPayload("Internal server error."));
    }
  });

  app.get("/feed/discover", async (request, reply) => {
    if (dependencies.postsRepository === undefined || dependencies.roomsRepository === undefined) {
      return reply.status(500).send(errorPayload("Internal server error."));
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
    } catch {
      return reply.status(500).send(errorPayload("Internal server error."));
    }
  });

  app.get("/posts", async (request, reply) => {
    if (dependencies.postsRepository === undefined) {
      return reply.status(500).send(errorPayload("Internal server error."));
    }

    try {
      const viewerUserId = await currentViewerUserId(request, dependencies.sessionsRepository);
      const posts = await dependencies.postsRepository.listPublicPosts(viewerUserId);

      return reply.send(successPayload(posts));
    } catch {
      return reply.status(500).send(errorPayload("Internal server error."));
    }
  });

  app.get("/posts/:id/replies", async (request, reply) => {
    if (dependencies.postsRepository === undefined) {
      return reply.status(500).send(errorPayload("Internal server error."));
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
    } catch {
      return reply.status(500).send(errorPayload("Internal server error."));
    }
  });

  app.get("/posts/:identifier", async (request, reply) => {
    if (dependencies.postsRepository === undefined) {
      return reply.status(500).send(errorPayload("Internal server error."));
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
    } catch {
      return reply.status(500).send(errorPayload("Internal server error."));
    }
  });

  app.get("/rooms/:slug/posts", async (request, reply) => {
    if (dependencies.postsRepository === undefined) {
      return reply.status(500).send(errorPayload("Internal server error."));
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
    } catch {
      return reply.status(500).send(errorPayload("Internal server error."));
    }
  });

  app.get("/profiles/:handle/posts", async (request, reply) => {
    if (dependencies.postsRepository === undefined) {
      return reply.status(500).send(errorPayload("Internal server error."));
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
    } catch {
      return reply.status(500).send(errorPayload("Internal server error."));
    }
  });

  app.get("/profiles/:handle/replies", async (request, reply) => {
    if (dependencies.postsRepository === undefined) {
      return reply.status(500).send(errorPayload("Internal server error."));
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
    } catch {
      return reply.status(500).send(errorPayload("Internal server error."));
    }
  });

  app.get("/profiles/:handle/reblogs", async (request, reply) => {
    if (dependencies.postsRepository === undefined) {
      return reply.status(500).send(errorPayload("Internal server error."));
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
    } catch {
      return reply.status(500).send(errorPayload("Internal server error."));
    }
  });

  app.get("/profiles/:handle/rooms", async (request, reply) =>
    withPublicProfileSubroute<RoomPayload[]>(
      request,
      reply,
      dependencies.profilesRepository,
      (repository, handle) => repository.getPublicProfileRooms(handle),
    ),
  );

  app.get("/profiles/:handle/modules", async (request, reply) =>
    withPublicProfileSubroute<ProfileModulePayload[]>(
      request,
      reply,
      dependencies.profilesRepository,
      (repository, handle) => repository.getPublicProfileModules(handle),
    ),
  );

  app.get("/profiles/:handle/badges", async (request, reply) =>
    withPublicProfileSubroute<ProfileBadgesPayload>(
      request,
      reply,
      dependencies.profilesRepository,
      (repository, handle) => repository.getPublicProfileBadges(handle),
    ),
  );

  app.get("/profiles/:handle/followers", async (request, reply) =>
    withPublicProfileSubroute<FollowUserCardPayload[]>(
      request,
      reply,
      dependencies.profilesRepository,
      (repository, handle) => repository.getPublicProfileFollowers(handle),
    ),
  );

  app.get("/profiles/:handle/following", async (request, reply) =>
    withPublicProfileSubroute<FollowUserCardPayload[]>(
      request,
      reply,
      dependencies.profilesRepository,
      (repository, handle) => repository.getPublicProfileFollowing(handle),
    ),
  );

  app.get("/profiles/:handle", async (request, reply) => {
    if (dependencies.profilesRepository === undefined) {
      return reply.status(500).send(errorPayload("Internal server error."));
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
    } catch {
      return reply.status(500).send(errorPayload("Internal server error."));
    }
  });

  app.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send(errorPayload("Not found."));
  });

  return app;
}
