import { buildApp, nodeApiLoggerOptions } from "./app.js";
import { createAuthRepository } from "./auth.js";
import { createBadgesRepository } from "./badges.js";
import { loadServerConfig } from "./config.js";
import { createDatabaseClient } from "./db.js";
import { createPostsRepository } from "./posts.js";
import { createPrivateReadsRepository } from "./private.js";
import { createProfilesRepository } from "./profiles.js";
import { createRoomsRepository } from "./rooms.js";
import { createSearchRepository } from "./search.js";
import { createSessionsRepository } from "./sessions.js";
import { createStatsRepository } from "./stats.js";

const config = loadServerConfig();
const database = createDatabaseClient(config);
const authRepository = createAuthRepository(database.pool, {
  cookieName: config.THIA_SESSION_COOKIE_NAME,
  cookieDomain: config.THIA_SESSION_COOKIE_DOMAIN === "" ? null : config.THIA_SESSION_COOKIE_DOMAIN,
  csrfSecret: config.THIA_CSRF_SECRET,
  encryptionKey: config.THIA_SECURITY_INTEGRATION_ENCRYPTION_KEY,
  sessionLifetimeSeconds: config.THIA_SESSION_LIFETIME_SECONDS,
});
const badgesRepository = createBadgesRepository(database.pool);
const postsRepository = createPostsRepository(database.pool);
const privateReadsRepository = createPrivateReadsRepository(database.pool, {
  csrfSecret: config.THIA_CSRF_SECRET,
  encryptionConfigured: config.THIA_SECURITY_ENCRYPTION_CONFIGURED,
  encryptionAvailable: config.THIA_SECURITY_ENCRYPTION_AVAILABLE,
});
const profilesRepository = createProfilesRepository(database.pool);
const roomsRepository = createRoomsRepository(database.pool);
const searchRepository = createSearchRepository(database.pool);
const sessionsRepository = createSessionsRepository(database.pool, config.THIA_SESSION_COOKIE_NAME);
const statsRepository = createStatsRepository(database.pool);
const app = buildApp({
  authRepository,
  badgesRepository,
  checkDatabase: database.check,
  logger: nodeApiLoggerOptions(config.THIA_API_LOG_LEVEL),
  postsRepository,
  privateReadsRepository,
  profilesRepository,
  roomsRepository,
  searchRepository,
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
