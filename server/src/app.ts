import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";

import { normalizeRoomSlug, type RoomPayload, type RoomsRepository } from "./rooms.js";
import type { PublicStatsPayload, StatsRepository } from "./stats.js";

const healthQuerySchema = z.object({
  db: z.union([z.string(), z.array(z.string())]).optional(),
});

const roomParamsSchema = z.object({
  slug: z.string(),
});

export interface AppDependencies {
  checkDatabase?: () => Promise<void>;
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

  app.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send(errorPayload("Not found."));
  });

  return app;
}
