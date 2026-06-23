import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import { z } from "zod";

import {
  normalizeProfileHandle,
  type FollowUserCardPayload,
  type ProfileBadgesPayload,
  type ProfileModulePayload,
  type ProfilePayload,
  type ProfilesRepository,
} from "./profiles.js";
import { normalizeRoomSlug, type RoomPayload, type RoomsRepository } from "./rooms.js";
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

export interface AppDependencies {
  checkDatabase?: () => Promise<void>;
  profilesRepository?: ProfilesRepository;
  roomsRepository?: RoomsRepository;
  statsRepository?: StatsRepository;
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
