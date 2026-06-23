import { buildApp } from "./app.js";
import { loadServerConfig } from "./config.js";
import { createDatabaseClient } from "./db.js";
import { createPostsRepository } from "./posts.js";
import { createProfilesRepository } from "./profiles.js";
import { createRoomsRepository } from "./rooms.js";
import { createSessionsRepository } from "./sessions.js";
import { createStatsRepository } from "./stats.js";

const config = loadServerConfig();
const database = createDatabaseClient(config);
const postsRepository = createPostsRepository(database.pool);
const profilesRepository = createProfilesRepository(database.pool);
const roomsRepository = createRoomsRepository(database.pool);
const sessionsRepository = createSessionsRepository(database.pool, config.THIA_SESSION_COOKIE_NAME);
const statsRepository = createStatsRepository(database.pool);
const app = buildApp({
  checkDatabase: database.check,
  postsRepository,
  profilesRepository,
  roomsRepository,
  sessionsRepository,
  statsRepository,
  publicBaseUrl: config.THIA_PUBLIC_BASE_URL,
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  app.log.info({ signal }, "shutting down Node API");

  await app.close();
  await database.close();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    shutdown(signal)
      .then(() => {
        process.exit(0);
      })
      .catch((error: unknown) => {
        app.log.error({ error }, "failed to shut down cleanly");
        process.exit(1);
      });
  });
}

await app.listen({
  host: config.THIA_API_HOST,
  port: config.THIA_API_PORT,
});
