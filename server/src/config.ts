import { z } from "zod";

const boolEnv = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return value;
}, z.boolean());

const envSchema = z.object({
  THIA_API_HOST: z.string().min(1).default("127.0.0.1"),
  THIA_API_PORT: z.coerce.number().int().min(1).max(65535).default(3100),
  THIA_DB_HOST: z.string().min(1).default("127.0.0.1"),
  THIA_DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  THIA_DB_NAME: z.string().min(1),
  THIA_DB_USER: z.string().min(1),
  THIA_DB_PASSWORD: z.string().default(""),
  THIA_DB_CHARSET: z.string().min(1).default("utf8mb4"),
  THIA_SESSION_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]+$/).default("thia_session"),
  THIA_SESSION_COOKIE_DOMAIN: z
    .string()
    .regex(/^$|^\.?[A-Za-z0-9.-]+$/)
    .default(""),
  THIA_SESSION_LIFETIME_SECONDS: z.coerce.number().int().min(1).default(2_592_000),
  THIA_PUBLIC_BASE_URL: z.string().url().default("https://thia.lol"),
  THIA_UPLOAD_ROOT: z.string().min(1).default("/srv/thia.lol/www/uploads"),
  THIA_UPLOAD_PUBLIC_PREFIX: z.string().regex(/^\/[A-Za-z0-9/_-]*$/).default("/uploads"),
  THIA_WEB_ROOT: z.string().min(1).default("/srv/thia.lol/www"),
  THIA_SHARE_CARD_BROWSER_PATH: z.string().default(""),
  THIA_FFMPEG_PATH: z.string().min(1).default("ffmpeg"),
  THIA_FFPROBE_PATH: z.string().min(1).default("ffprobe"),
  THIA_API_LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
    .default("info"),
  THIA_CSRF_SECRET: z.string().min(1).default("development-csrf-secret-change-me"),
  THIA_SECURITY_INTEGRATION_ENCRYPTION_KEY: z.string().default(""),
  THIA_SECURITY_ENCRYPTION_CONFIGURED: boolEnv.default(false),
  THIA_SECURITY_ENCRYPTION_AVAILABLE: boolEnv.default(true),
  THIA_ACCOUNT_SETUP_TOKEN: z.string().default(""),
  THIA_MIGRATION_TOKEN: z.string().default(""),
  THIA_MIGRATIONS_DIR: z.string().min(1).default("/srv/thia.lol/migrations"),
  THIA_PUSH_VAPID_PUBLIC_KEY: z.string().default(""),
  THIA_PUSH_VAPID_PRIVATE_KEY: z.string().default(""),
  THIA_PUSH_SUBJECT: z.string().default("mailto:hello@thia.lol"),
  THIA_INTEGRATION_SPOTIFY_CLIENT_ID: z.string().default(""),
  THIA_INTEGRATION_SPOTIFY_CLIENT_SECRET: z.string().default(""),
  THIA_INTEGRATION_SPOTIFY_REDIRECT_URI: z.string().default(""),
  THIA_INTEGRATION_YOUTUBE_CLIENT_ID: z.string().default(""),
  THIA_INTEGRATION_YOUTUBE_CLIENT_SECRET: z.string().default(""),
  THIA_INTEGRATION_YOUTUBE_API_KEY: z.string().default(""),
  THIA_INTEGRATION_YOUTUBE_REDIRECT_URI: z.string().default(""),
  THIA_INTEGRATION_TWITCH_CLIENT_ID: z.string().default(""),
  THIA_INTEGRATION_TWITCH_CLIENT_SECRET: z.string().default(""),
  THIA_INTEGRATION_TWITCH_EMBED_PARENT: z.string().default("thia.lol"),
  THIA_INTEGRATION_TWITCH_REDIRECT_URI: z.string().default(""),
  THIA_INTEGRATION_GITHUB_CLIENT_ID: z.string().default(""),
  THIA_INTEGRATION_GITHUB_CLIENT_SECRET: z.string().default(""),
  THIA_INTEGRATION_GITHUB_REDIRECT_URI: z.string().default(""),
  THIA_INTEGRATION_APPLE_MUSIC_DEVELOPER_TOKEN: z.string().default(""),
  THIA_INTEGRATION_APPLE_MUSIC_STOREFRONT: z.string().default("us"),
  THIA_KLIPY_API_KEY: z.string().default(""),
  THIA_KLIPY_API_BASE_URL: z.string().url().default("https://api.klipy.com/api/v1"),
  THIA_KLIPY_COUNTRY: z.string().min(1).default("US"),
  THIA_KLIPY_LOCALE: z.string().min(1).default("en_US"),
});

export type ServerConfig = z.infer<typeof envSchema>;

export function loadServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid Node API environment: ${issues}`);
  }

  return parsed.data;
}
