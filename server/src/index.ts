import { buildApp, nodeApiLoggerOptions } from "./app.js";
import { createAuthRepository } from "./auth.js";
import { createBadgesRepository } from "./badges.js";
import { createChatRepository } from "./chat.js";
import { loadServerConfig } from "./config.js";
import { createContentMutationsRepository } from "./content.js";
import { createDatabaseClient } from "./db.js";
import { createEditorRepository } from "./editor.js";
import { createGrowthRepository } from "./growth.js";
import { createGifRepository } from "./gifs.js";
import { createIntegrationsRepository } from "./integrations.js";
import { createModerationRepository } from "./moderation.js";
import { createOpsService } from "./ops.js";
import { createPostsRepository } from "./posts.js";
import { createPrivateReadsRepository } from "./private.js";
import { createProfilesRepository } from "./profiles.js";
import { createPushRepository } from "./push.js";
import { createRoomsRepository } from "./rooms.js";
import { createSearchRepository } from "./search.js";
import { createSessionsRepository } from "./sessions.js";
import { createShareCardService } from "./share-cards.js";
import { createShareShellService } from "./share-shells.js";
import { createSitemapService } from "./sitemap.js";
import { createStatsRepository } from "./stats.js";
import { createUploadService } from "./uploads.js";

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
const chatRepository = createChatRepository(database.pool, config.THIA_PUBLIC_BASE_URL);
const contentMutationsRepository = createContentMutationsRepository(database.pool, {
  publicBaseUrl: config.THIA_PUBLIC_BASE_URL,
});
const editorRepository = createEditorRepository(database.pool);
const growthRepository = createGrowthRepository(database.pool);
const gifsRepository = createGifRepository({
  apiKey: config.THIA_KLIPY_API_KEY,
  baseUrl: config.THIA_KLIPY_API_BASE_URL,
  country: config.THIA_KLIPY_COUNTRY,
  locale: config.THIA_KLIPY_LOCALE,
});
const moderationRepository = createModerationRepository(database.pool);
const integrationsRepository = createIntegrationsRepository(database.pool, {
  publicBaseUrl: config.THIA_PUBLIC_BASE_URL,
  encryptionKey: config.THIA_SECURITY_INTEGRATION_ENCRYPTION_KEY,
  onOAuthCallbackError: ({ error, provider, stage }) => {
    console.error("integration OAuth callback failed", {
      error: error.message.replace(/[\r\n]+/gu, " ").slice(0, 160),
      provider,
      stage,
    });
  },
  providers: {
    spotify: {
      clientId: config.THIA_INTEGRATION_SPOTIFY_CLIENT_ID,
      clientSecret: config.THIA_INTEGRATION_SPOTIFY_CLIENT_SECRET,
      redirectUri: config.THIA_INTEGRATION_SPOTIFY_REDIRECT_URI,
    },
    apple_music: {
      developerToken: config.THIA_INTEGRATION_APPLE_MUSIC_DEVELOPER_TOKEN,
      storefront: config.THIA_INTEGRATION_APPLE_MUSIC_STOREFRONT,
    },
    youtube: {
      clientId: config.THIA_INTEGRATION_YOUTUBE_CLIENT_ID,
      clientSecret: config.THIA_INTEGRATION_YOUTUBE_CLIENT_SECRET,
      apiKey: config.THIA_INTEGRATION_YOUTUBE_API_KEY,
      redirectUri: config.THIA_INTEGRATION_YOUTUBE_REDIRECT_URI,
    },
    twitch: {
      clientId: config.THIA_INTEGRATION_TWITCH_CLIENT_ID,
      clientSecret: config.THIA_INTEGRATION_TWITCH_CLIENT_SECRET,
      embedParent: config.THIA_INTEGRATION_TWITCH_EMBED_PARENT,
      redirectUri: config.THIA_INTEGRATION_TWITCH_REDIRECT_URI,
    },
    github: {
      clientId: config.THIA_INTEGRATION_GITHUB_CLIENT_ID,
      clientSecret: config.THIA_INTEGRATION_GITHUB_CLIENT_SECRET,
      redirectUri: config.THIA_INTEGRATION_GITHUB_REDIRECT_URI,
    },
  },
});
const opsService = createOpsService(database.pool, {
  setupToken: config.THIA_ACCOUNT_SETUP_TOKEN,
  migrationToken: config.THIA_MIGRATION_TOKEN,
  migrationsDir: config.THIA_MIGRATIONS_DIR,
  sessionCookieName: config.THIA_SESSION_COOKIE_NAME,
  sessionCookieDomain: config.THIA_SESSION_COOKIE_DOMAIN === "" ? null : config.THIA_SESSION_COOKIE_DOMAIN,
});
const postsRepository = createPostsRepository(database.pool);
const privateReadsRepository = createPrivateReadsRepository(database.pool, {
  csrfSecret: config.THIA_CSRF_SECRET,
  encryptionConfigured: config.THIA_SECURITY_ENCRYPTION_CONFIGURED,
  encryptionAvailable: config.THIA_SECURITY_ENCRYPTION_AVAILABLE,
});
const profilesRepository = createProfilesRepository(database.pool);
const pushRepository = createPushRepository(database.pool, {
  publicKey: config.THIA_PUSH_VAPID_PUBLIC_KEY,
  privateKey: config.THIA_PUSH_VAPID_PRIVATE_KEY,
  subject: config.THIA_PUSH_SUBJECT,
});
const roomsRepository = createRoomsRepository(database.pool);
const searchRepository = createSearchRepository(database.pool);
const sessionsRepository = createSessionsRepository(database.pool, config.THIA_SESSION_COOKIE_NAME);
const shareCardService = createShareCardService({
  postsRepository,
  profilesRepository,
  roomsRepository,
  uploadRoot: config.THIA_UPLOAD_ROOT,
  publicBaseUrl: config.THIA_PUBLIC_BASE_URL,
  browserExecutablePath: config.THIA_SHARE_CARD_BROWSER_PATH,
});
const shareShellService = createShareShellService({
  postsRepository,
  profilesRepository,
  roomsRepository,
  uploadRoot: config.THIA_UPLOAD_ROOT,
  webRoot: config.THIA_WEB_ROOT,
  publicBaseUrl: config.THIA_PUBLIC_BASE_URL,
});
const sitemapService = createSitemapService(database.pool, config.THIA_PUBLIC_BASE_URL);
const statsRepository = createStatsRepository(database.pool);
const uploadService = createUploadService({
  uploadRoot: config.THIA_UPLOAD_ROOT,
  publicPrefix: config.THIA_UPLOAD_PUBLIC_PREFIX,
  ffmpegPath: config.THIA_FFMPEG_PATH,
  ffprobePath: config.THIA_FFPROBE_PATH,
});
const app = buildApp({
  authRepository,
  badgesRepository,
  chatRepository,
  checkDatabase: database.check,
  contentMutationsRepository,
  editorRepository,
  growthRepository,
  gifsRepository,
  integrationsRepository,
  moderationRepository,
  opsService,
  logger: nodeApiLoggerOptions(config.THIA_API_LOG_LEVEL),
  postsRepository,
  privateReadsRepository,
  profilesRepository,
  pushRepository,
  roomsRepository,
  searchRepository,
  sessionsRepository,
  shareCardService,
  shareShellService,
  sitemapService,
  statsRepository,
  uploadService,
  publicBaseUrl: config.THIA_PUBLIC_BASE_URL,
  sessionCookieName: config.THIA_SESSION_COOKIE_NAME,
  sessionCookieDomain: config.THIA_SESSION_COOKIE_DOMAIN === "" ? null : config.THIA_SESSION_COOKIE_DOMAIN,
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
