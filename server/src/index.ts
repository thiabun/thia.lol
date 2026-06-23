import { buildApp } from "./app.js";
import { loadServerConfig } from "./config.js";
import { createDatabaseClient } from "./db.js";
import { createProfilesRepository } from "./profiles.js";
import { createRoomsRepository } from "./rooms.js";
import { createStatsRepository } from "./stats.js";

const config = loadServerConfig();
const database = createDatabaseClient(config);
const profilesRepository = createProfilesRepository(database.pool);
const roomsRepository = createRoomsRepository(database.pool);
const statsRepository = createStatsRepository(database.pool);
const app = buildApp({
  checkDatabase: database.check,
  profilesRepository,
  roomsRepository,
  statsRepository,
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
