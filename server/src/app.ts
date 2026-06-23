import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";

const healthQuerySchema = z.object({
  db: z.union([z.string(), z.array(z.string())]).optional(),
});

export interface AppDependencies {
  checkDatabase?: () => Promise<void>;
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
          ok: false,
          error: "Database connection failed.",
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

  app.setNotFoundHandler((_request, reply) => {
    const error: ErrorPayload = {
      ok: false,
      error: "Not found.",
    };

    return reply.status(404).send(error);
  });

  return app;
}
