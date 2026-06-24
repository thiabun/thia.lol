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
  THIA_PUBLIC_BASE_URL: z.string().url().default("https://thia.lol"),
  THIA_API_LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
    .default("info"),
  THIA_CSRF_SECRET: z.string().min(1).default("development-csrf-secret-change-me"),
  THIA_SECURITY_ENCRYPTION_CONFIGURED: boolEnv.default(false),
  THIA_SECURITY_ENCRYPTION_AVAILABLE: boolEnv.default(true),
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
