import { randomUUID, timingSafeEqual } from "node:crypto";

import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
  type FastifyServerOptions,
} from "fastify";
import multipart from "@fastify/multipart";
import { z } from "zod";

import {
  AuthRouteError,
  buildClearSessionCookies,
  type AuthLogoutResult,
  type AuthRepository,
  type AuthRequestContext,
  type AuthSessionResult,
  type TwoFactorChallengePayload,
  type TwoFactorEnablePayload,
  type TwoFactorRecoveryCodesPayload,
  type TwoFactorSetupPayload,
  type TwoFactorStatusPayload,
} from "./auth.js";
import { BadgeStorageNotReadyError, type BadgePayload, type BadgesRepository } from "./badges.js";
import {
  ContentRouteError,
  ContentStorageNotReadyError,
  type ContentMutationsRepository,
  type FollowRelationshipPayload,
  type FollowRequestApprovePayload,
  type FollowRequestDenyPayload,
  type LikePayload,
  type PostDeletePayload,
  type PostShareMessagesPayload,
  type ProfileControlPayload,
  type ProfileStarPayload,
  type ReactionPayload,
  type ReblogPayload,
  type RemoveFollowerPayload,
  type RoomAccessRequestPayload,
  type RoomDeletePayload,
} from "./content.js";
import {
  ChatRouteError,
  ChatStorageNotReadyError,
  type ChatConversationPayload,
  type ChatMessagesPayload,
  type ChatMessagePayload,
  type ChatReadPayload,
  type ChatRepository,
  type ChatUserPayload,
} from "./chat.js";
import {
  EditorRouteError,
  EditorStorageNotReadyError,
  type AccountDeletionSchedulePayload,
  type AccountPasswordPayload,
  type EditorRepository,
  type MyPostsDeletePayload,
  type ProfileCanvasDraftState,
  type ProfileCanvasUpdatePayload,
} from "./editor.js";
import {
  ModerationRouteError,
  type ModerationReportPayload,
  type ModerationRepository,
  type ModerationUserPayload,
} from "./moderation.js";
import {
  IntegrationRouteError,
  IntegrationStorageNotReadyError,
  type IntegrationCardPayload,
  type IntegrationDiagnosticsPayload,
  type IntegrationOAuthStartPayload,
  type IntegrationOwnerPayload,
  type IntegrationSuggestionsPayload,
  type IntegrationsRepository,
} from "./integrations.js";
import {
  OpsRouteError,
  type AuthDiagnosticsPayload,
  type MigrationRunPayload,
  type MigrationStatusPayload,
  type OpsService,
  type SetupPayload,
} from "./ops.js";
import {
  normalizePostIdentifier,
  type DiscoverFeedPayload,
  type HomeFeedPayload,
  type PostDetailPayload,
  type PostsRepository,
} from "./posts.js";
import {
  notificationIdsFromPayload,
  PrivateRouteError,
  PrivateStorageNotReadyError,
  settingsPostKind,
  type AuthSessionPayload,
  type FollowRequestPayload,
  type MyPostPayload,
  type NotificationsReadAllPayload,
  type NotificationsReadPayload,
  type NotificationsPayload,
  type OnboardingStatePayload,
  type PrivateReadsRepository,
  type SettingsPayload,
} from "./private.js";
import {
  PushRouteError,
  type PushRepository,
  type PushStatusPayload,
  type PushTestPayload,
} from "./push.js";
import {
  normalizeProfileHandle,
  type FollowUserCardPayload,
  type PostPayload,
  type ProfileBadgesPayload,
  type ProfileModulePayload,
  type ProfilePayload,
  type ProfilesRepository,
} from "./profiles.js";
import {
  normalizeRoomSlug,
  RoomStorageNotReadyError,
  type RoomMemberPayload,
  type RoomPayload,
  type RoomViewer,
  type RoomsRepository,
} from "./rooms.js";
import { type SearchPayload, type SearchRepository } from "./search.js";
import type { RequestSession, SessionsRepository } from "./sessions.js";
import {
  ShareCardRouteError,
  type ShareCardCachePayload,
  type ShareCardService,
} from "./share-cards.js";
import type { ShareShellResponse, ShareShellService } from "./share-shells.js";
import type { SitemapService } from "./sitemap.js";
import type { PublicStatsPayload, StatsRepository } from "./stats.js";
import {
  audioUploadMaxBytes,
  imageUploadMaxBytes,
  multipartUploadMaxBytes,
  UploadRouteError,
  type UploadPayload,
  type UploadService,
  videoUploadMaxBytes,
} from "./uploads.js";

const healthQuerySchema = z.object({
  db: z.union([z.string(), z.array(z.string())]).optional(),
});

const searchQuerySchema = z
  .object({
    q: z.union([z.string(), z.array(z.string())]).optional(),
  })
  .passthrough();

const roomParamsSchema = z.object({
  slug: z.string(),
});

const roomAccessRequestParamsSchema = z.object({
  slug: z.string(),
  id: z.string(),
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

const postReactionParamsSchema = z.object({
  id: z.string(),
  type: z.string(),
});

const profileModuleParamsSchema = z.object({
  id: z.string(),
});

const notificationReadParamsSchema = z.object({
  id: z.string(),
});

const followRequestDecisionParamsSchema = z.object({
  id: z.string(),
});

const uploadParamsSchema = z.object({
  kind: z.string(),
});

const chatConversationParamsSchema = z.object({
  id: z.string(),
});

const adminEntityParamsSchema = z.object({
  id: z.string(),
});

const privatePostsQuerySchema = z
  .object({
    kind: z.union([z.string(), z.array(z.string())]).optional(),
  })
  .passthrough();

export const requestIdHeader = "X-Thia-Request-Id";

export const nodeApiLogRedactPaths = [
  "req.headers.cookie",
  "req.headers.authorization",
  "req.headers.proxy-authorization",
  "req.headers.x-api-key",
  "req.headers.x-csrf-token",
  "req.headers.x-xsrf-token",
  "headers.cookie",
  "headers.authorization",
  "headers.proxy-authorization",
  "headers.x-api-key",
  "headers.x-csrf-token",
  "headers.x-xsrf-token",
];

export interface AppDependencies {
  authRepository?: AuthRepository;
  badgesRepository?: BadgesRepository;
  chatRepository?: ChatRepository;
  checkDatabase?: () => Promise<void>;
  contentMutationsRepository?: ContentMutationsRepository;
  editorRepository?: EditorRepository;
  moderationRepository?: ModerationRepository;
  integrationsRepository?: IntegrationsRepository;
  opsService?: OpsService;
  profilesRepository?: ProfilesRepository;
  postsRepository?: PostsRepository;
  privateReadsRepository?: PrivateReadsRepository;
  pushRepository?: PushRepository;
  roomsRepository?: RoomsRepository;
  searchRepository?: SearchRepository;
  sessionsRepository?: SessionsRepository;
  shareCardService?: ShareCardService;
  shareShellService?: ShareShellService;
  sitemapService?: SitemapService;
  statsRepository?: StatsRepository;
  uploadService?: UploadService;
  publicBaseUrl?: string;
  sessionCookieName?: string;
  sessionCookieDomain?: string | null;
  logger?: FastifyServerOptions["logger"];
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

function searchQueryFromRequest(query: unknown): unknown {
  const parsed = searchQuerySchema.safeParse(query);

  if (!parsed.success) {
    return "";
  }

  const value = parsed.data.q;

  return Array.isArray(value) ? "" : (value ?? "");
}

export function nodeApiLoggerOptions(level: string): NonNullable<FastifyServerOptions["logger"]> {
  return {
    level,
    redact: {
      paths: nodeApiLogRedactPaths,
      censor: "[redacted]",
    },
    serializers: {
      req(request: FastifyRequest) {
        const url = sanitizedUrl(request.url);

        return {
          method: request.method,
          url,
          host: request.hostname,
          remoteAddress: request.ip,
          remotePort: request.raw.socket.remotePort ?? 0,
        };
      },
    },
  };
}

function requestIdFromHeader(value: string | string[] | undefined): string | undefined {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (rawValue === undefined || !/^[A-Za-z0-9._:-]{8,128}$/.test(rawValue)) {
    return undefined;
  }

  return rawValue;
}

function generateRequestId(request: { headers: Record<string, string | string[] | undefined> }): string {
  return (
    requestIdFromHeader(request.headers["x-thia-request-id"]) ??
    requestIdFromHeader(request.headers["x-request-id"]) ??
    randomUUID()
  );
}

function sanitizedUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl, "https://thia.lol");
    const queryKeys = [...new Set([...url.searchParams.keys()])].sort();
    const query = queryKeys.map((key) => `${encodeURIComponent(key)}=[redacted]`).join("&");

    return query === "" ? url.pathname : `${url.pathname}?${query}`;
  } catch {
    return rawUrl.split("?", 1)[0] ?? rawUrl;
  }
}

function errorRecord(error: unknown): Record<string, string | number | boolean> {
  if (error === null || error === undefined) {
    return {
      type: String(error),
    };
  }

  if (typeof error !== "object") {
    return {
      type: typeof error,
      message: String(error).slice(0, 160),
    };
  }

  const record = error as Record<string, unknown>;
  const metadata: Record<string, string | number | boolean> = {
    type: error instanceof Error ? error.name : "ErrorLike",
  };
  const databaseLike =
    "sql" in record ||
    "sqlMessage" in record ||
    "sqlState" in record ||
    "errno" in record;

  if (error instanceof Error && !databaseLike) {
    metadata.message = error.message.slice(0, 160);
  }

  for (const key of ["code", "errno", "sqlState", "statusCode"]) {
    const value = record[key];

    if (typeof value === "string" || typeof value === "number") {
      metadata[key] = typeof value === "string" ? value.slice(0, 80) : value;
    }
  }

  if (databaseLike) {
    metadata.databaseError = true;
  }

  return metadata;
}

function logRouteFailure(
  request: FastifyRequest,
  routeName: string,
  statusCode: number,
  error: unknown,
): void {
  request.log.error(
    {
      routeName,
      requestId: request.id,
      method: request.method,
      url: sanitizedUrl(request.url),
      statusCode,
      error: errorRecord(error),
    },
    "Node API route failed",
  );
}

function sendRouteError(
  request: FastifyRequest,
  reply: FastifyReply,
  routeName: string,
  statusCode: number,
  payload: ErrorPayload,
  error: unknown,
) {
  logRouteFailure(request, routeName, statusCode, error);

  return reply.status(statusCode).send(payload);
}

function internalError(
  request: FastifyRequest,
  reply: FastifyReply,
  routeName: string,
  error: unknown,
) {
  return sendRouteError(request, reply, routeName, 500, errorPayload("Internal server error."), error);
}

async function withPublicProfileSubroute<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  repository: ProfilesRepository | undefined,
  routeName: string,
  lookup: (repository: ProfilesRepository, handle: string) => Promise<T | null>,
) {
  if (repository === undefined) {
    return internalError(request, reply, routeName, new Error("Missing profiles repository dependency."));
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
  } catch (error) {
    return internalError(request, reply, routeName, error);
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

async function currentViewerSession(
  request: { headers: { cookie?: string | undefined } },
  repository: SessionsRepository | undefined,
): Promise<RequestSession | null> {
  if (repository === undefined) {
    return null;
  }

  return repository.currentSession(request.headers.cookie);
}

function roomViewerFromSession(session: RequestSession | null): RoomViewer {
  return {
    userId: session?.userId ?? null,
    role: session?.role ?? null,
  };
}

function optionalRoomViewerFromSession(session: RequestSession | null): RoomViewer | undefined {
  return session === null ? undefined : roomViewerFromSession(session);
}

function privatePostKindFromRequest(query: unknown): "all" | "posts" | "replies" {
  const parsed = privatePostsQuerySchema.safeParse(query);

  if (!parsed.success) {
    return "all";
  }

  const value = parsed.data.kind;

  return settingsPostKind(Array.isArray(value) ? undefined : value);
}

function includeDeletedModulesFromRequest(query: unknown): boolean {
  if (query === null || typeof query !== "object" || Array.isArray(query)) {
    return false;
  }

  const value = (query as Record<string, unknown>).includeDeleted;
  const scalar = Array.isArray(value) ? value[0] : value;

  return scalar === "1" || scalar === "true" || scalar === true;
}

async function withAuthenticatedPrivateRoute<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: AppDependencies,
  routeName: string,
  lookup: (repository: PrivateReadsRepository, session: RequestSession) => Promise<T> | T,
) {
  if (dependencies.sessionsRepository === undefined || dependencies.privateReadsRepository === undefined) {
    return internalError(request, reply, routeName, new Error("Missing authenticated route dependency."));
  }

  try {
    const session = await dependencies.sessionsRepository.currentSession(request.headers.cookie);

    if (session === null) {
      return reply.status(401).send(errorPayload("Unauthenticated."));
    }

    const data = await lookup(dependencies.privateReadsRepository, session);

    return reply.send(successPayload<T>(data));
  } catch (error) {
    if (error instanceof PrivateStorageNotReadyError) {
      return sendRouteError(request, reply, routeName, 503, errorPayload(error.message), error);
    }

    return internalError(request, reply, routeName, error);
  }
}

async function withAuthenticatedMutationRoute<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: AppDependencies,
  routeName: string,
  lookup: (
    repository: PrivateReadsRepository,
    session: RequestSession,
    body: Record<string, unknown>,
  ) => Promise<T> | T,
) {
  if (dependencies.sessionsRepository === undefined || dependencies.privateReadsRepository === undefined) {
    return internalError(request, reply, routeName, new Error("Missing authenticated mutation dependency."));
  }

  try {
    const session = await dependencies.sessionsRepository.currentSession(request.headers.cookie);

    if (session === null) {
      return reply.status(401).send(errorPayload("Unauthenticated."));
    }

    const providedCsrfToken = csrfTokenFromRequest(request);

    if (providedCsrfToken === "") {
      return reply.status(403).send(errorPayload("CSRF token is required."));
    }

    if (!safeStringEquals(dependencies.privateReadsRepository.csrfTokenForSession(session), providedCsrfToken)) {
      return reply.status(403).send(errorPayload("Invalid CSRF token."));
    }

    const body = jsonBodyRecord(request.body);
    const data = await lookup(dependencies.privateReadsRepository, session, body);

    return reply.send(successPayload<T>(data));
  } catch (error) {
    if (error instanceof PrivateRouteError) {
      return reply.status(error.statusCode).send(errorPayload(error.message));
    }

    if (error instanceof PrivateStorageNotReadyError) {
      return sendRouteError(request, reply, routeName, 503, errorPayload(error.message), error);
    }

    return internalError(request, reply, routeName, error);
  }
}

async function withAuthenticatedPushRoute<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: AppDependencies,
  routeName: string,
  lookup: (repository: PushRepository, session: RequestSession) => Promise<T> | T,
) {
  if (dependencies.sessionsRepository === undefined || dependencies.pushRepository === undefined) {
    return internalError(request, reply, routeName, new Error("Missing authenticated push route dependency."));
  }

  try {
    const session = await dependencies.sessionsRepository.currentSession(request.headers.cookie);

    if (session === null) {
      return reply.status(401).send(errorPayload("Unauthenticated."));
    }

    const data = await lookup(dependencies.pushRepository, session);

    return reply.send(successPayload<T>(data));
  } catch (error) {
    if (error instanceof PushRouteError) {
      if (error.statusCode >= 500) {
        return sendRouteError(request, reply, routeName, error.statusCode, errorPayload(error.message), error);
      }

      return reply.status(error.statusCode).send(errorPayload(error.message));
    }

    return internalError(request, reply, routeName, error);
  }
}

async function withAuthenticatedPushMutationRoute<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: AppDependencies,
  routeName: string,
  lookup: (repository: PushRepository, session: RequestSession, body: Record<string, unknown>) => Promise<T> | T,
) {
  if (
    dependencies.sessionsRepository === undefined ||
    dependencies.privateReadsRepository === undefined ||
    dependencies.pushRepository === undefined
  ) {
    return internalError(request, reply, routeName, new Error("Missing authenticated push mutation dependency."));
  }

  try {
    const session = await dependencies.sessionsRepository.currentSession(request.headers.cookie);

    if (session === null) {
      return reply.status(401).send(errorPayload("Unauthenticated."));
    }

    const providedCsrfToken = csrfTokenFromRequest(request);

    if (providedCsrfToken === "") {
      return reply.status(403).send(errorPayload("CSRF token is required."));
    }

    if (!safeStringEquals(dependencies.privateReadsRepository.csrfTokenForSession(session), providedCsrfToken)) {
      return reply.status(403).send(errorPayload("Invalid CSRF token."));
    }

    const body = jsonBodyRecord(request.body);
    const data = await lookup(dependencies.pushRepository, session, body);

    return reply.send(successPayload<T>(data));
  } catch (error) {
    if (error instanceof PushRouteError || error instanceof PrivateRouteError) {
      if (error.statusCode >= 500) {
        return sendRouteError(request, reply, routeName, error.statusCode, errorPayload(error.message), error);
      }

      return reply.status(error.statusCode).send(errorPayload(error.message));
    }

    return internalError(request, reply, routeName, error);
  }
}

async function withAuthenticatedContentMutationRoute<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: AppDependencies,
  routeName: string,
  lookup: (
    repository: ContentMutationsRepository,
    session: RequestSession,
    body: Record<string, unknown>,
  ) => Promise<T> | T,
  statusCode = 200,
) {
  if (
    dependencies.sessionsRepository === undefined ||
    dependencies.privateReadsRepository === undefined ||
    dependencies.contentMutationsRepository === undefined
  ) {
    return internalError(request, reply, routeName, new Error("Missing authenticated content mutation dependency."));
  }

  try {
    const session = await dependencies.sessionsRepository.currentSession(request.headers.cookie);

    if (session === null) {
      return reply.status(401).send(errorPayload("Unauthenticated."));
    }

    const providedCsrfToken = csrfTokenFromRequest(request);

    if (providedCsrfToken === "") {
      return reply.status(403).send(errorPayload("CSRF token is required."));
    }

    if (!safeStringEquals(dependencies.privateReadsRepository.csrfTokenForSession(session), providedCsrfToken)) {
      return reply.status(403).send(errorPayload("Invalid CSRF token."));
    }

    const body = jsonBodyRecord(request.body);
    const data = await lookup(dependencies.contentMutationsRepository, session, body);

    return reply.status(statusCode).send(successPayload<T>(data));
  } catch (error) {
    if (error instanceof ContentRouteError || error instanceof PrivateRouteError) {
      return reply.status(error.statusCode).send(errorPayload(error.message));
    }

    if (error instanceof ContentStorageNotReadyError) {
      return sendRouteError(request, reply, routeName, 503, errorPayload(error.message), error);
    }

    return internalError(request, reply, routeName, error);
  }
}

async function withAuthenticatedContentRoute<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: AppDependencies,
  routeName: string,
  lookup: (
    repository: ContentMutationsRepository,
    session: RequestSession,
  ) => Promise<T> | T,
) {
  if (
    dependencies.sessionsRepository === undefined ||
    dependencies.contentMutationsRepository === undefined
  ) {
    return internalError(request, reply, routeName, new Error("Missing authenticated content route dependency."));
  }

  try {
    const session = await dependencies.sessionsRepository.currentSession(request.headers.cookie);

    if (session === null) {
      return reply.status(401).send(errorPayload("Unauthenticated."));
    }

    const data = await lookup(dependencies.contentMutationsRepository, session);

    return reply.send(successPayload<T>(data));
  } catch (error) {
    if (error instanceof ContentRouteError || error instanceof PrivateRouteError) {
      return reply.status(error.statusCode).send(errorPayload(error.message));
    }

    if (error instanceof ContentStorageNotReadyError) {
      return sendRouteError(request, reply, routeName, 503, errorPayload(error.message), error);
    }

    return internalError(request, reply, routeName, error);
  }
}

async function withAuthenticatedEditorRoute<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: AppDependencies,
  routeName: string,
  lookup: (repository: EditorRepository, session: RequestSession) => Promise<T> | T,
) {
  if (dependencies.sessionsRepository === undefined || dependencies.editorRepository === undefined) {
    return internalError(request, reply, routeName, new Error("Missing authenticated editor route dependency."));
  }

  try {
    const session = await dependencies.sessionsRepository.currentSession(request.headers.cookie);

    if (session === null) {
      return reply.status(401).send(errorPayload("Unauthenticated."));
    }

    const data = await lookup(dependencies.editorRepository, session);

    return reply.send(successPayload<T>(data));
  } catch (error) {
    if (error instanceof EditorRouteError) {
      return reply.status(error.statusCode).send(errorPayload(error.message));
    }

    if (error instanceof EditorStorageNotReadyError) {
      return sendRouteError(request, reply, routeName, 503, errorPayload(error.message), error);
    }

    return internalError(request, reply, routeName, error);
  }
}

async function withAuthenticatedEditorMutationRoute<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: AppDependencies,
  routeName: string,
  lookup: (
    repository: EditorRepository,
    session: RequestSession,
    body: Record<string, unknown>,
  ) => Promise<T> | T,
  statusCode = 200,
) {
  if (
    dependencies.sessionsRepository === undefined ||
    dependencies.privateReadsRepository === undefined ||
    dependencies.editorRepository === undefined
  ) {
    return internalError(request, reply, routeName, new Error("Missing authenticated editor mutation dependency."));
  }

  try {
    const session = await dependencies.sessionsRepository.currentSession(request.headers.cookie);

    if (session === null) {
      return reply.status(401).send(errorPayload("Unauthenticated."));
    }

    const providedCsrfToken = csrfTokenFromRequest(request);

    if (providedCsrfToken === "") {
      return reply.status(403).send(errorPayload("CSRF token is required."));
    }

    if (!safeStringEquals(dependencies.privateReadsRepository.csrfTokenForSession(session), providedCsrfToken)) {
      return reply.status(403).send(errorPayload("Invalid CSRF token."));
    }

    const body = jsonBodyRecord(request.body);
    const data = await lookup(dependencies.editorRepository, session, body);

    return reply.status(statusCode).send(successPayload<T>(data));
  } catch (error) {
    if (error instanceof AuthRouteError || error instanceof EditorRouteError || error instanceof PrivateRouteError) {
      return reply.status(error.statusCode).send(errorPayload(error.message));
    }

    if (error instanceof EditorStorageNotReadyError) {
      return sendRouteError(request, reply, routeName, 503, errorPayload(error.message), error);
    }

    return internalError(request, reply, routeName, error);
  }
}

async function withAccountDeletionScheduleRoute(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: AppDependencies,
  routeName: string,
) {
  if (
    dependencies.sessionsRepository === undefined ||
    dependencies.privateReadsRepository === undefined ||
    dependencies.editorRepository === undefined
  ) {
    return internalError(request, reply, routeName, new Error("Missing account deletion dependency."));
  }

  try {
    const session = await dependencies.sessionsRepository.currentSession(request.headers.cookie);

    if (session === null) {
      return reply.status(401).send(errorPayload("Unauthenticated."));
    }

    const providedCsrfToken = csrfTokenFromRequest(request);

    if (providedCsrfToken === "") {
      return reply.status(403).send(errorPayload("CSRF token is required."));
    }

    if (!safeStringEquals(dependencies.privateReadsRepository.csrfTokenForSession(session), providedCsrfToken)) {
      return reply.status(403).send(errorPayload("Invalid CSRF token."));
    }

    const context = authRequestContext(request, dependencies);
    const data = await dependencies.editorRepository.scheduleAccountDeletion(
      session,
      jsonBodyRequiredObject(jsonBodyRecord(request.body), request.body),
    );

    reply.header(
      "Set-Cookie",
      buildClearSessionCookies(dependencies.sessionCookieName ?? "thia_session", {
        domain: dependencies.sessionCookieDomain ?? null,
        host: context.host,
        secure: context.secure,
      }),
    );

    return reply.send(successPayload<AccountDeletionSchedulePayload>(data));
  } catch (error) {
    if (error instanceof AuthRouteError || error instanceof EditorRouteError || error instanceof PrivateRouteError) {
      return reply.status(error.statusCode).send(errorPayload(error.message));
    }

    if (error instanceof EditorStorageNotReadyError) {
      return sendRouteError(request, reply, routeName, 503, errorPayload(error.message), error);
    }

    return internalError(request, reply, routeName, error);
  }
}

function csrfTokenFromRequest(request: FastifyRequest): string {
  const value = request.headers["x-csrf-token"];

  return typeof value === "string" ? value : "";
}

function safeStringEquals(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

function jsonBodyRecord(body: unknown): Record<string, unknown> {
  if (body === undefined || body === null) {
    return {};
  }

  if (Array.isArray(body)) {
    return {};
  }

  if (typeof body !== "object") {
    throw new PrivateRouteError("JSON body must be an object.", 400);
  }

  return body as Record<string, unknown>;
}

function jsonBodyRequiredObject(body: Record<string, unknown>, originalBody: unknown): Record<string, unknown> {
  if (Array.isArray(originalBody)) {
    throw new PrivateRouteError("JSON body must be an object.", 400);
  }

  return body;
}

function authJsonBodyRecord(body: unknown): Record<string, unknown> {
  const record = jsonBodyRecord(body);

  if (Array.isArray(body)) {
    throw new AuthRouteError("JSON body must be an object.", 400);
  }

  return record;
}

function isInvalidJsonBodyError(error: unknown): boolean {
  if (error === null || typeof error !== "object") {
    return false;
  }

  const record = error as Record<string, unknown>;

  return record.statusCode === 400 && record.code === "FST_ERR_CTP_INVALID_JSON_BODY";
}

async function withPublicAuthRoute<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: AppDependencies,
  routeName: string,
  lookup: (repository: AuthRepository, body: Record<string, unknown>, context: AuthRequestContext) => Promise<T>,
  send: (result: T, reply: FastifyReply) => FastifyReply,
) {
  if (dependencies.authRepository === undefined) {
    return internalError(request, reply, routeName, new Error("Missing auth repository dependency."));
  }

  try {
    const body = authJsonBodyRecord(request.body);
    const result = await lookup(dependencies.authRepository, body, authRequestContext(request, dependencies));

    return send(result, reply);
  } catch (error) {
    if (error instanceof AuthRouteError) {
      return reply.status(error.statusCode).send(errorPayload(error.message));
    }

    return internalError(request, reply, routeName, error);
  }
}

async function withProtectedAuthRoute<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: AppDependencies,
  routeName: string,
  lookup: (repository: AuthRepository, session: RequestSession, body: Record<string, unknown>) => Promise<T>,
) {
  if (dependencies.sessionsRepository === undefined || dependencies.authRepository === undefined) {
    return internalError(request, reply, routeName, new Error("Missing protected auth route dependency."));
  }

  try {
    const session = await dependencies.sessionsRepository.currentSession(request.headers.cookie);

    if (session === null) {
      return reply.status(401).send(errorPayload("Unauthenticated."));
    }

    const providedCsrfToken = csrfTokenFromRequest(request);

    if (providedCsrfToken === "") {
      return reply.status(403).send(errorPayload("CSRF token is required."));
    }

    if (!safeStringEquals(dependencies.authRepository.csrfTokenForSession(session), providedCsrfToken)) {
      return reply.status(403).send(errorPayload("Invalid CSRF token."));
    }

    const body = authJsonBodyRecord(request.body);
    const data = await lookup(dependencies.authRepository, session, body);

    return reply.send(successPayload<T>(data));
  } catch (error) {
    if (error instanceof AuthRouteError) {
      return reply.status(error.statusCode).send(errorPayload(error.message));
    }

    return internalError(request, reply, routeName, error);
  }
}

async function withAuthenticatedIntegrationRoute<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: AppDependencies,
  routeName: string,
  lookup: (repository: IntegrationsRepository, session: RequestSession) => Promise<T> | T,
) {
  if (dependencies.sessionsRepository === undefined || dependencies.integrationsRepository === undefined) {
    return internalError(request, reply, routeName, new Error("Missing authenticated integration dependency."));
  }

  try {
    const session = await dependencies.sessionsRepository.currentSession(request.headers.cookie);

    if (session === null) {
      return reply.status(401).send(errorPayload("Unauthenticated."));
    }

    const data = await lookup(dependencies.integrationsRepository, session);

    return reply.send(successPayload<T>(data));
  } catch (error) {
    if (error instanceof IntegrationRouteError) {
      return reply.status(error.statusCode).send(errorPayload(error.message));
    }

    if (error instanceof IntegrationStorageNotReadyError) {
      return sendRouteError(request, reply, routeName, 503, errorPayload(error.message), error);
    }

    return internalError(request, reply, routeName, error);
  }
}

async function withAuthenticatedIntegrationMutationRoute<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: AppDependencies,
  routeName: string,
  lookup: (
    repository: IntegrationsRepository,
    session: RequestSession,
    body: Record<string, unknown>,
  ) => Promise<T> | T,
  statusCode = 200,
) {
  if (
    dependencies.sessionsRepository === undefined ||
    dependencies.privateReadsRepository === undefined ||
    dependencies.integrationsRepository === undefined
  ) {
    return internalError(request, reply, routeName, new Error("Missing authenticated integration mutation dependency."));
  }

  try {
    const session = await dependencies.sessionsRepository.currentSession(request.headers.cookie);

    if (session === null) {
      return reply.status(401).send(errorPayload("Unauthenticated."));
    }

    const providedCsrfToken = csrfTokenFromRequest(request);

    if (providedCsrfToken === "") {
      return reply.status(403).send(errorPayload("CSRF token is required."));
    }

    if (!safeStringEquals(dependencies.privateReadsRepository.csrfTokenForSession(session), providedCsrfToken)) {
      return reply.status(403).send(errorPayload("Invalid CSRF token."));
    }

    const body = jsonBodyRecord(request.body);
    const data = await lookup(dependencies.integrationsRepository, session, body);

    return reply.status(statusCode).send(successPayload<T>(data));
  } catch (error) {
    if (error instanceof IntegrationRouteError || error instanceof PrivateRouteError) {
      return reply.status(error.statusCode).send(errorPayload(error.message));
    }

    if (error instanceof IntegrationStorageNotReadyError) {
      return sendRouteError(request, reply, routeName, 503, errorPayload(error.message), error);
    }

    return internalError(request, reply, routeName, error);
  }
}

async function withAuthenticatedUploadRoute(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: AppDependencies,
  routeName: string,
  kind: string,
) {
  if (
    dependencies.sessionsRepository === undefined ||
    dependencies.privateReadsRepository === undefined ||
    dependencies.uploadService === undefined
  ) {
    return internalError(request, reply, routeName, new Error("Missing authenticated upload dependency."));
  }

  try {
    const session = await dependencies.sessionsRepository.currentSession(request.headers.cookie);

    if (session === null) {
      return reply.status(401).send(errorPayload("Unauthenticated."));
    }

    const providedCsrfToken = csrfTokenFromRequest(request);

    if (providedCsrfToken === "") {
      return reply.status(403).send(errorPayload("CSRF token is required."));
    }

    if (!safeStringEquals(dependencies.privateReadsRepository.csrfTokenForSession(session), providedCsrfToken)) {
      return reply.status(403).send(errorPayload("Invalid CSRF token."));
    }

    const file = await request.file({
      limits: {
        fileSize: uploadMaxBytes(kind),
        files: 1,
      },
    });

    if (kind === "image" && uploadPreviewRequested(request)) {
      const preview = await dependencies.uploadService.previewImage(file);

      return reply
        .status(200)
        .header("Cache-Control", "no-store")
        .type(preview.contentType)
        .send(preview.body);
    }

    const data = await dependencies.uploadService.store(kind, file);

    return reply.status(201).send(successPayload<UploadPayload>(data));
  } catch (error) {
    if (error instanceof UploadRouteError) {
      if (error.statusCode >= 500) {
        return sendRouteError(request, reply, routeName, error.statusCode, errorPayload(error.message), error);
      }

      return reply.status(error.statusCode).send(errorPayload(error.message));
    }

    if (multipartLimitError(error)) {
      return reply.status(413).send(errorPayload(`${uploadTitle(kind)} must be ${uploadLimitLabel(kind)} or smaller.`));
    }

    return internalError(request, reply, routeName, error);
  }
}

function uploadMaxBytes(kind: string): number {
  if (kind === "image") {
    return imageUploadMaxBytes;
  }

  if (kind === "video") {
    return videoUploadMaxBytes;
  }

  return audioUploadMaxBytes;
}

function uploadTitle(kind: string): string {
  if (kind === "video") {
    return "Video";
  }

  if (kind === "audio") {
    return "Audio";
  }

  return "Image";
}

function uploadLimitLabel(kind: string): string {
  if (kind === "video") {
    return "100 MB";
  }

  if (kind === "audio") {
    return "20 MB";
  }

  return "10 MB";
}

function multipartLimitError(error: unknown): boolean {
  if (error === null || typeof error !== "object") {
    return false;
  }

  const record = error as Record<string, unknown>;

  return record.code === "FST_REQ_FILE_TOO_LARGE" || record.name === "RequestFileTooLargeError";
}

function uploadPreviewRequested(request: FastifyRequest): boolean {
  const query = request.query;

  if (query === null || typeof query !== "object" || Array.isArray(query)) {
    return false;
  }

  const value = (query as Record<string, unknown>).preview;

  return value === "1" || value === "true";
}

function singleHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

async function withAuthenticatedChatRoute<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: AppDependencies,
  routeName: string,
  lookup: (repository: ChatRepository, session: RequestSession) => Promise<T> | T,
) {
  if (dependencies.sessionsRepository === undefined || dependencies.chatRepository === undefined) {
    return internalError(request, reply, routeName, new Error("Missing authenticated chat route dependency."));
  }

  try {
    const session = await dependencies.sessionsRepository.currentSession(request.headers.cookie);

    if (session === null) {
      return reply.status(401).send(errorPayload("Unauthenticated."));
    }

    const data = await lookup(dependencies.chatRepository, session);

    return reply.send(successPayload<T>(data));
  } catch (error) {
    if (error instanceof ChatRouteError) {
      return reply.status(error.statusCode).send(errorPayload(error.message));
    }

    if (error instanceof ChatStorageNotReadyError) {
      return sendRouteError(request, reply, routeName, 503, errorPayload(error.message), error);
    }

    return internalError(request, reply, routeName, error);
  }
}

async function withAuthenticatedChatMutationRoute<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: AppDependencies,
  routeName: string,
  lookup: (repository: ChatRepository, session: RequestSession, body: Record<string, unknown>) => Promise<T> | T,
  statusCode = 200,
) {
  if (
    dependencies.sessionsRepository === undefined ||
    dependencies.privateReadsRepository === undefined ||
    dependencies.chatRepository === undefined
  ) {
    return internalError(request, reply, routeName, new Error("Missing authenticated chat mutation dependency."));
  }

  try {
    const session = await dependencies.sessionsRepository.currentSession(request.headers.cookie);

    if (session === null) {
      return reply.status(401).send(errorPayload("Unauthenticated."));
    }

    const providedCsrfToken = csrfTokenFromRequest(request);

    if (providedCsrfToken === "") {
      return reply.status(403).send(errorPayload("CSRF token is required."));
    }

    if (!safeStringEquals(dependencies.privateReadsRepository.csrfTokenForSession(session), providedCsrfToken)) {
      return reply.status(403).send(errorPayload("Invalid CSRF token."));
    }

    const body = jsonBodyRecord(request.body);
    const data = await lookup(dependencies.chatRepository, session, body);

    return reply.status(statusCode).send(successPayload<T>(data));
  } catch (error) {
    if (error instanceof ChatRouteError || error instanceof PrivateRouteError) {
      return reply.status(error.statusCode).send(errorPayload(error.message));
    }

    if (error instanceof ChatStorageNotReadyError) {
      return sendRouteError(request, reply, routeName, 503, errorPayload(error.message), error);
    }

    return internalError(request, reply, routeName, error);
  }
}

async function withAuthenticatedModerationRoute<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: AppDependencies,
  routeName: string,
  lookup: (repository: ModerationRepository, session: RequestSession) => Promise<T> | T,
) {
  if (dependencies.sessionsRepository === undefined || dependencies.moderationRepository === undefined) {
    return internalError(request, reply, routeName, new Error("Missing moderation route dependency."));
  }

  try {
    const session = await dependencies.sessionsRepository.currentSession(request.headers.cookie);

    if (session === null) {
      return reply.status(401).send(errorPayload("Unauthenticated."));
    }

    const data = await lookup(dependencies.moderationRepository, session);

    return reply.send(successPayload<T>(data));
  } catch (error) {
    if (error instanceof ModerationRouteError) {
      return reply.status(error.statusCode).send(errorPayload(error.message));
    }

    return internalError(request, reply, routeName, error);
  }
}

async function withAuthenticatedModerationMutationRoute<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: AppDependencies,
  routeName: string,
  lookup: (repository: ModerationRepository, session: RequestSession, body: Record<string, unknown>) => Promise<T> | T,
  statusCode = 200,
) {
  if (
    dependencies.sessionsRepository === undefined ||
    dependencies.privateReadsRepository === undefined ||
    dependencies.moderationRepository === undefined
  ) {
    return internalError(request, reply, routeName, new Error("Missing moderation mutation dependency."));
  }

  try {
    const session = await dependencies.sessionsRepository.currentSession(request.headers.cookie);

    if (session === null) {
      return reply.status(401).send(errorPayload("Unauthenticated."));
    }

    const providedCsrfToken = csrfTokenFromRequest(request);

    if (providedCsrfToken === "") {
      return reply.status(403).send(errorPayload("CSRF token is required."));
    }

    if (!safeStringEquals(dependencies.privateReadsRepository.csrfTokenForSession(session), providedCsrfToken)) {
      return reply.status(403).send(errorPayload("Invalid CSRF token."));
    }

    const body = jsonBodyRecord(request.body);
    const data = await lookup(dependencies.moderationRepository, session, body);

    return reply.status(statusCode).send(successPayload<T>(data));
  } catch (error) {
    if (error instanceof ModerationRouteError || error instanceof PrivateRouteError) {
      return reply.status(error.statusCode).send(errorPayload(error.message));
    }

    return internalError(request, reply, routeName, error);
  }
}

async function withShareCardCacheRoute(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: AppDependencies,
  routeName: string,
  cache: (service: ShareCardService, session: RequestSession) => Promise<ShareCardCachePayload>,
) {
  if (
    dependencies.sessionsRepository === undefined ||
    dependencies.privateReadsRepository === undefined ||
    dependencies.shareCardService === undefined
  ) {
    return internalError(request, reply, routeName, new Error("Missing share card cache dependency."));
  }

  try {
    const session = await dependencies.sessionsRepository.currentSession(request.headers.cookie);

    if (session === null) {
      return reply.status(401).send(errorPayload("Unauthenticated."));
    }

    const providedCsrfToken = csrfTokenFromRequest(request);

    if (providedCsrfToken === "") {
      return reply.status(403).send(errorPayload("CSRF token is required."));
    }

    if (!safeStringEquals(dependencies.privateReadsRepository.csrfTokenForSession(session), providedCsrfToken)) {
      return reply.status(403).send(errorPayload("Invalid CSRF token."));
    }

    const data = await cache(dependencies.shareCardService, session);

    return reply.status(201).send(successPayload(data));
  } catch (error) {
    if (error instanceof ShareCardRouteError) {
      if (error.statusCode >= 500) {
        return sendRouteError(request, reply, routeName, error.statusCode, errorPayload(error.message), error);
      }

      return reply.status(error.statusCode).send(errorPayload(error.message));
    }

    return internalError(request, reply, routeName, error);
  }
}

async function sendShareCardImage(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: AppDependencies,
  routeName: string,
  image: (service: ShareCardService) => Promise<{ body: Buffer; contentType: string; cacheControl: string } | null>,
) {
  if (dependencies.shareCardService === undefined) {
    return internalError(request, reply, routeName, new Error("Missing share card service dependency."));
  }

  try {
    const result = await image(dependencies.shareCardService);

    if (result === null) {
      return reply.status(404).send("");
    }

    return reply
      .type(result.contentType)
      .header("Cache-Control", result.cacheControl)
      .header("X-Content-Type-Options", "nosniff")
      .header("Content-Length", String(result.body.byteLength))
      .send(request.method === "HEAD" ? undefined : result.body);
  } catch (error) {
    if (error instanceof ShareCardRouteError) {
      return reply.status(error.statusCode).send(error.statusCode === 404 ? "" : errorPayload(error.message));
    }

    return internalError(request, reply, routeName, error);
  }
}

function authRequestContext(request: FastifyRequest, dependencies: AppDependencies): AuthRequestContext {
  const forwardedFor = request.headers["x-forwarded-for"];
  const forwardedProto = request.headers["x-forwarded-proto"];
  const forwardedHost = request.headers["x-forwarded-host"];
  const ipAddress = typeof forwardedFor === "string" && forwardedFor.trim() !== ""
    ? forwardedFor.split(",", 1)[0]?.trim() ?? request.ip
    : request.ip;
  const host = (typeof forwardedHost === "string" ? forwardedHost : request.hostname).replace(/:\d+$/u, "").toLowerCase();
  const secure =
    (typeof forwardedProto === "string" && forwardedProto.toLowerCase().split(",", 1)[0] === "https") ||
    (dependencies.publicBaseUrl ?? "https://thia.lol").startsWith("https://");

  return {
    ipAddress,
    userAgent: typeof request.headers["user-agent"] === "string" ? request.headers["user-agent"] : "",
    host,
    secure,
  };
}

function sendAuthSessionResult(result: AuthSessionResult, reply: FastifyReply): FastifyReply {
  reply.header("Set-Cookie", result.cookie);

  return reply.send(successPayload(result.payload));
}

function sendCreatedAuthSessionResult(result: AuthSessionResult, reply: FastifyReply): FastifyReply {
  reply.header("Set-Cookie", result.cookie);

  return reply.status(201).send(successPayload(result.payload));
}

function sendAuthLogoutResult(result: AuthLogoutResult, reply: FastifyReply): FastifyReply {
  reply.header("Set-Cookie", result.cookies);

  return reply.send(successPayload({ loggedOut: result.loggedOut }));
}

function sendJsonResult<T>(result: T, reply: FastifyReply): FastifyReply {
  return reply.send(successPayload(result));
}

function sendShareShellResult(result: ShareShellResponse, reply: FastifyReply): FastifyReply {
  if (result.kind === "redirect") {
    return reply.redirect(result.location, result.statusCode);
  }

  return reply
    .status(result.statusCode)
    .type("text/html; charset=utf-8")
    .header("Cache-Control", "no-cache, no-store, must-revalidate")
    .header("X-Content-Type-Options", "nosniff")
    .send(result.html);
}

async function sendPostShareShell(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: AppDependencies,
  routeName: string,
  input: Record<string, unknown>,
): Promise<FastifyReply> {
  if (dependencies.shareShellService === undefined) {
    return internalError(request, reply, routeName, new Error("Missing share shell service dependency."));
  }

  try {
    return sendShareShellResult(
      await dependencies.shareShellService.postShare(input),
      reply,
    );
  } catch (error) {
    return internalError(request, reply, routeName, error);
  }
}

async function sendProfileShareShell(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: AppDependencies,
  routeName: string,
  input: Record<string, unknown>,
): Promise<FastifyReply> {
  if (dependencies.shareShellService === undefined) {
    return internalError(request, reply, routeName, new Error("Missing share shell service dependency."));
  }

  try {
    return sendShareShellResult(
      await dependencies.shareShellService.profileShare(input),
      reply,
    );
  } catch (error) {
    return internalError(request, reply, routeName, error);
  }
}

function positiveIntegerParam(value: string): number | null {
  if (!/^[0-9]+$/.test(value)) {
    return null;
  }

  const number = Number(value);

  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export function buildApp(dependencies: AppDependencies = {}): FastifyInstance {
  const app = Fastify({
    genReqId: generateRequestId,
    logger: dependencies.logger ?? false,
  });

  void app.register(multipart, {
    limits: {
      files: 1,
      fileSize: multipartUploadMaxBytes,
    },
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header(requestIdHeader, request.id);
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
      } catch (exception) {
        const error: ErrorPayload = {
          ...errorPayload("Database connection failed."),
          database: {
            ok: false,
          },
        };

        return sendRouteError(request, reply, "health.db", 503, error, exception);
      }

      payload.database = {
        ok: true,
      };
    }

    return reply.send(payload);
  });

  const sitemapHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    if (dependencies.sitemapService === undefined) {
      return internalError(request, reply, "sitemap", new Error("Missing sitemap service dependency."));
    }

    try {
      return reply
        .type("application/xml; charset=utf-8")
        .header("X-Content-Type-Options", "nosniff")
        .send(await dependencies.sitemapService.xml());
    } catch (error) {
      return internalError(request, reply, "sitemap", error);
    }
  };

  app.get("/sitemap.xml", sitemapHandler);
  app.get("/sitemap", sitemapHandler);

  app.get("/share-card/image", async (request, reply) => {
    const query = request.query;
    const url = query !== null && typeof query === "object" && !Array.isArray(query)
      ? (query as Record<string, unknown>).url
      : "";

    return sendShareCardImage(
      request,
      reply,
      dependencies,
      "share-card.image",
      (service) => service.proxyImage(typeof url === "string" ? url : ""),
    );
  });

  const canonicalPostShareHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string | undefined>;

    return sendPostShareShell(request, reply, dependencies, "share-shell.post.canonical", {
      handle: params.handle ?? "",
      postId: params.postId ?? "",
    });
  };

  app.get("/@:handle/posts/:postId", canonicalPostShareHandler);
  app.get("/@:handle/posts/:postId/", canonicalPostShareHandler);

  const canonicalProfileShareHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string | undefined>;

    return sendProfileShareShell(request, reply, dependencies, "share-shell.profile.canonical", {
      handle: params.handle ?? "",
    });
  };

  app.get("/@:handle", canonicalProfileShareHandler);
  app.get("/@:handle/", canonicalProfileShareHandler);

  app.get("/post-share.php", async (request, reply) =>
    sendPostShareShell(request, reply, dependencies, "share-shell.post", jsonBodyRecord(request.query)),
  );

  app.get("/profile-share.php", async (request, reply) =>
    sendProfileShareShell(request, reply, dependencies, "share-shell.profile", jsonBodyRecord(request.query)),
  );

  app.post("/setup/thia", async (request, reply) => {
    if (dependencies.opsService === undefined) {
      return internalError(request, reply, "setup.thia", new Error("Missing ops service dependency."));
    }

    try {
      const data = await dependencies.opsService.activateThia(
        authJsonBodyRecord(request.body),
        singleHeaderValue(request.headers["x-setup-token"]),
      );

      return reply.send(successPayload<SetupPayload>(data));
    } catch (error) {
      if (error instanceof OpsRouteError) {
        return reply.status(error.statusCode).send(errorPayload(error.message));
      }

      return internalError(request, reply, "setup.thia", error);
    }
  });

  app.get("/admin/auth/diagnostics", async (request, reply) => {
    if (dependencies.opsService === undefined) {
      return internalError(request, reply, "admin.auth.diagnostics", new Error("Missing ops service dependency."));
    }

    try {
      const data = dependencies.opsService.authDiagnostics(
        request.headers.cookie,
        request.hostname,
        singleHeaderValue(request.headers["x-migration-token"]),
      );

      return reply.send(successPayload<AuthDiagnosticsPayload>(data));
    } catch (error) {
      if (error instanceof OpsRouteError) {
        return reply.status(error.statusCode).send(errorPayload(error.message));
      }

      return internalError(request, reply, "admin.auth.diagnostics", error);
    }
  });

  app.get("/admin/auth/session-trace", async (request, reply) => {
    if (dependencies.opsService === undefined) {
      return internalError(request, reply, "admin.auth.session-trace", new Error("Missing ops service dependency."));
    }

    try {
      const data = dependencies.opsService.authDiagnostics(
        request.headers.cookie,
        request.hostname,
        singleHeaderValue(request.headers["x-migration-token"]),
      );

      return reply.send(successPayload<AuthDiagnosticsPayload>(data));
    } catch (error) {
      if (error instanceof OpsRouteError) {
        return reply.status(error.statusCode).send(errorPayload(error.message));
      }

      return internalError(request, reply, "admin.auth.session-trace", error);
    }
  });

  app.get("/admin/migrations/status", async (request, reply) => {
    if (dependencies.opsService === undefined || dependencies.sessionsRepository === undefined) {
      return internalError(request, reply, "admin.migrations.status", new Error("Missing migrations dependency."));
    }

    try {
      const session = await dependencies.sessionsRepository.currentSession(request.headers.cookie);

      if (session === null) {
        return reply.status(401).send(errorPayload("Unauthenticated."));
      }

      const data = await dependencies.opsService.migrationStatus(
        session,
        singleHeaderValue(request.headers["x-migration-token"]),
      );

      return reply.send(successPayload<MigrationStatusPayload>(data));
    } catch (error) {
      if (error instanceof OpsRouteError) {
        return reply.status(error.statusCode).send(errorPayload(error.message));
      }

      return internalError(request, reply, "admin.migrations.status", error);
    }
  });

  app.post("/admin/migrations/run", async (request, reply) => {
    if (dependencies.opsService === undefined || dependencies.sessionsRepository === undefined) {
      return internalError(request, reply, "admin.migrations.run", new Error("Missing migrations dependency."));
    }

    try {
      const session = await dependencies.sessionsRepository.currentSession(request.headers.cookie);

      if (session === null) {
        return reply.status(401).send(errorPayload("Unauthenticated."));
      }

      const data = await dependencies.opsService.runMigrations(
        session,
        singleHeaderValue(request.headers["x-migration-token"]),
      );

      return reply.send(successPayload<MigrationRunPayload>(data));
    } catch (error) {
      if (error instanceof OpsRouteError) {
        return reply.status(error.statusCode).send(errorPayload(error.message));
      }

      return internalError(request, reply, "admin.migrations.run", error);
    }
  });

  app.get("/auth/me", async (request, reply) =>
    withAuthenticatedPrivateRoute<AuthSessionPayload>(
      request,
      reply,
      dependencies,
      "auth.me",
      (repository, session) => repository.authSessionPayload(session),
    ),
  );

  app.post("/auth/login", async (request, reply) =>
    withPublicAuthRoute<AuthSessionResult | TwoFactorChallengePayload>(
      request,
      reply,
      dependencies,
      "auth.login",
      (repository, body, context) => repository.login(body, context),
      (result, routeReply) => "twoFactorRequired" in result
        ? sendJsonResult(result, routeReply)
        : sendAuthSessionResult(result, routeReply),
    ),
  );

  app.post("/auth/register", async (request, reply) =>
    withPublicAuthRoute<AuthSessionResult>(
      request,
      reply,
      dependencies,
      "auth.register",
      (repository, body, context) => repository.register(body, context),
      sendCreatedAuthSessionResult,
    ),
  );

  app.post("/auth/logout", async (request, reply) => {
    if (dependencies.authRepository === undefined) {
      return internalError(request, reply, "auth.logout", new Error("Missing auth repository dependency."));
    }

    try {
      const result = await dependencies.authRepository.logout(request.headers.cookie, authRequestContext(request, dependencies));

      return sendAuthLogoutResult(result, reply);
    } catch (error) {
      if (error instanceof AuthRouteError) {
        return reply.status(error.statusCode).send(errorPayload(error.message));
      }

      return internalError(request, reply, "auth.logout", error);
    }
  });

  app.post("/auth/2fa/verify", async (request, reply) =>
    withPublicAuthRoute<AuthSessionResult>(
      request,
      reply,
      dependencies,
      "auth.2fa.verify",
      (repository, body, context) => repository.verifyTwoFactor(body, context),
      sendAuthSessionResult,
    ),
  );

  app.post("/me/security/2fa/setup", async (request, reply) =>
    withProtectedAuthRoute<TwoFactorSetupPayload>(
      request,
      reply,
      dependencies,
      "me.security.2fa.setup",
      (repository, session, body) => repository.setupTwoFactor(session, body),
    ),
  );

  app.post("/me/security/2fa/enable", async (request, reply) =>
    withProtectedAuthRoute<TwoFactorEnablePayload>(
      request,
      reply,
      dependencies,
      "me.security.2fa.enable",
      (repository, session, body) => repository.enableTwoFactor(session, body),
    ),
  );

  app.delete("/me/security/2fa", async (request, reply) =>
    withProtectedAuthRoute<TwoFactorStatusPayload>(
      request,
      reply,
      dependencies,
      "me.security.2fa.disable",
      (repository, session, body) => repository.disableTwoFactor(session, body),
    ),
  );

  app.post("/me/security/2fa/recovery-codes", async (request, reply) =>
    withProtectedAuthRoute<TwoFactorRecoveryCodesPayload>(
      request,
      reply,
      dependencies,
      "me.security.2fa.recovery-codes",
      (repository, session, body) => repository.regenerateTwoFactorRecoveryCodes(session, body),
    ),
  );

  app.get("/me/integrations", async (request, reply) =>
    withAuthenticatedIntegrationRoute<IntegrationOwnerPayload>(
      request,
      reply,
      dependencies,
      "me.integrations",
      (repository, session) => repository.ownerIndex(session),
    ),
  );

  app.get("/me/integrations/diagnostics", async (request, reply) =>
    withAuthenticatedIntegrationRoute<IntegrationDiagnosticsPayload>(
      request,
      reply,
      dependencies,
      "me.integrations.diagnostics",
      (repository) => repository.diagnostics(),
    ),
  );

  app.post("/me/integrations/metadata/resolve", async (request, reply) =>
    withAuthenticatedIntegrationMutationRoute<IntegrationCardPayload>(
      request,
      reply,
      dependencies,
      "me.integrations.metadata.resolve",
      (repository, session, body) => repository.resolveMetadata(session, body),
    ),
  );

  app.post("/me/integrations/:provider/start", async (request, reply) => {
    const provider = (request.params as Record<string, string | undefined>).provider ?? "";

    return withAuthenticatedIntegrationMutationRoute<IntegrationOAuthStartPayload>(
      request,
      reply,
      dependencies,
      "me.integrations.start",
      (repository, session, body) => repository.startOAuth(session, provider, body),
      201,
    );
  });

  app.delete("/me/integrations/:provider", async (request, reply) => {
    const provider = (request.params as Record<string, string | undefined>).provider ?? "";

    return withAuthenticatedIntegrationMutationRoute<IntegrationOwnerPayload>(
      request,
      reply,
      dependencies,
      "me.integrations.disconnect",
      (repository, session) => repository.disconnect(session, provider),
    );
  });

  app.get("/me/integrations/:provider/suggestions", async (request, reply) => {
    const provider = (request.params as Record<string, string | undefined>).provider ?? "";

    return withAuthenticatedIntegrationRoute<IntegrationSuggestionsPayload>(
      request,
      reply,
      dependencies,
      "me.integrations.suggestions",
      (repository, session) => repository.suggestions(session, provider),
    );
  });

  app.get("/integrations/:provider/callback", async (request, reply) => {
    if (dependencies.integrationsRepository === undefined) {
      return internalError(request, reply, "integrations.callback", new Error("Missing integrations repository dependency."));
    }

    const provider = (request.params as Record<string, string | undefined>).provider ?? "";

    try {
      const result = await dependencies.integrationsRepository.oauthCallback(provider, jsonBodyRecord(request.query));

      return reply.redirect(result.location, 303);
    } catch (error) {
      if (error instanceof IntegrationRouteError) {
        return reply.status(error.statusCode).send(errorPayload(error.message));
      }

      if (error instanceof IntegrationStorageNotReadyError) {
        return sendRouteError(request, reply, "integrations.callback", 503, errorPayload(error.message), error);
      }

      return internalError(request, reply, "integrations.callback", error);
    }
  });

  app.get("/me/settings", async (request, reply) =>
    withAuthenticatedPrivateRoute<SettingsPayload>(
      request,
      reply,
      dependencies,
      "me.settings",
      (repository, session) => repository.getSettings(session),
    ),
  );

  app.patch("/me/privacy", async (request, reply) =>
    withAuthenticatedMutationRoute<SettingsPayload>(
      request,
      reply,
      dependencies,
      "me.privacy.update",
      (repository, session, body) => repository.updatePrivacy(session, body),
    ),
  );

  app.patch("/me/preferences", async (request, reply) =>
    withAuthenticatedMutationRoute<SettingsPayload>(
      request,
      reply,
      dependencies,
      "me.preferences.update",
      (repository, session, body) => repository.updatePreferences(session, body),
    ),
  );

  app.get("/me/onboarding", async (request, reply) =>
    withAuthenticatedPrivateRoute<OnboardingStatePayload>(
      request,
      reply,
      dependencies,
      "me.onboarding",
      (repository, session) => repository.getOnboardingState(session.userId),
    ),
  );

  app.patch("/me/onboarding", async (request, reply) =>
    withAuthenticatedMutationRoute<OnboardingStatePayload>(
      request,
      reply,
      dependencies,
      "me.onboarding.update",
      (repository, session, body) => repository.updateOnboardingState(
        session.userId,
        jsonBodyRequiredObject(body, request.body),
      ),
    ),
  );

  app.get("/me/push", async (request, reply) =>
    withAuthenticatedPushRoute<PushStatusPayload>(
      request,
      reply,
      dependencies,
      "me.push",
      (repository, session) => repository.status(session.userId),
    ),
  );

  app.post("/me/push/subscriptions", async (request, reply) =>
    withAuthenticatedPushMutationRoute<PushStatusPayload>(
      request,
      reply,
      dependencies,
      "me.push.subscriptions.create",
      (repository, session, body) => repository.saveSubscription(session.userId, jsonBodyRequiredObject(body, request.body)),
    ),
  );

  app.delete("/me/push/subscriptions", async (request, reply) =>
    withAuthenticatedPushMutationRoute<PushStatusPayload>(
      request,
      reply,
      dependencies,
      "me.push.subscriptions.delete",
      (repository, session, body) => repository.disableSubscription(session.userId, jsonBodyRequiredObject(body, request.body)),
    ),
  );

  app.post("/me/push/test", async (request, reply) =>
    withAuthenticatedPushMutationRoute<PushTestPayload>(
      request,
      reply,
      dependencies,
      "me.push.test",
      (repository, session) => repository.testSend(session.userId),
    ),
  );

  app.get("/me/follow-requests", async (request, reply) =>
    withAuthenticatedPrivateRoute<FollowRequestPayload[]>(
      request,
      reply,
      dependencies,
      "me.follow-requests",
      (repository, session) => repository.getFollowRequests(session.userId),
    ),
  );

  app.post("/me/follow-requests/:id/approve", async (request, reply) => {
    const parsedParams = followRequestDecisionParamsSchema.safeParse(request.params);
    const requestId = parsedParams.success ? positiveIntegerParam(parsedParams.data.id) : null;

    if (requestId === null) {
      return reply.status(404).send(errorPayload("Follow request not found."));
    }

    return withAuthenticatedContentMutationRoute<FollowRequestApprovePayload>(
      request,
      reply,
      dependencies,
      "me.follow-requests.approve",
      (repository, session) => repository.approveFollowRequest(requestId, session.userId),
    );
  });

  app.delete("/me/follow-requests/:id", async (request, reply) => {
    const parsedParams = followRequestDecisionParamsSchema.safeParse(request.params);
    const requestId = parsedParams.success ? positiveIntegerParam(parsedParams.data.id) : null;

    if (requestId === null) {
      return reply.status(404).send(errorPayload("Follow request not found."));
    }

    return withAuthenticatedContentMutationRoute<FollowRequestDenyPayload>(
      request,
      reply,
      dependencies,
      "me.follow-requests.deny",
      (repository, session) => repository.denyFollowRequest(requestId, session.userId),
    );
  });

  app.get("/me/posts", async (request, reply) =>
    withAuthenticatedPrivateRoute<MyPostPayload[]>(
      request,
      reply,
      dependencies,
      "me.posts",
      (repository, session) => repository.getMyPosts(session.userId, privatePostKindFromRequest(request.query)),
    ),
  );

  app.delete("/me/posts", async (request, reply) =>
    withAuthenticatedEditorMutationRoute<MyPostsDeletePayload>(
      request,
      reply,
      dependencies,
      "me.posts.delete",
      (repository, session) => repository.deleteMyPosts(session.userId, privatePostKindFromRequest(request.query)),
    ),
  );

  app.patch("/me/profile", async (request, reply) =>
    withAuthenticatedEditorMutationRoute<ProfilePayload>(
      request,
      reply,
      dependencies,
      "me.profile.update",
      (repository, session, body) => repository.updateProfile(session, jsonBodyRequiredObject(body, request.body)),
    ),
  );

  app.post("/me/profile", async (request, reply) =>
    withAuthenticatedEditorMutationRoute<ProfilePayload>(
      request,
      reply,
      dependencies,
      "me.profile.update",
      (repository, session, body) => repository.updateProfile(session, jsonBodyRequiredObject(body, request.body)),
    ),
  );

  app.patch("/me/profile/featured", async (request, reply) =>
    withAuthenticatedEditorMutationRoute<ProfilePayload>(
      request,
      reply,
      dependencies,
      "me.profile.featured.update",
      (repository, session, body) => repository.updateFeaturedProfile(session, jsonBodyRequiredObject(body, request.body)),
    ),
  );

  app.get("/me/profile/modules", async (request, reply) =>
    withAuthenticatedEditorRoute<ProfileModulePayload[]>(
      request,
      reply,
      dependencies,
      "me.profile.modules",
      (repository, session) => repository.listOwnerModules(
        session.userId,
        includeDeletedModulesFromRequest(request.query),
      ),
    ),
  );

  app.post("/me/profile/modules", async (request, reply) =>
    withAuthenticatedEditorMutationRoute<ProfileModulePayload[]>(
      request,
      reply,
      dependencies,
      "me.profile.modules.create",
      (repository, session, body) => repository.createModule(session, jsonBodyRequiredObject(body, request.body)),
      201,
    ),
  );

  app.patch("/me/profile/modules/:id", async (request, reply) => {
    const parsedParams = profileModuleParamsSchema.safeParse(request.params);
    const moduleId = parsedParams.success ? positiveIntegerParam(parsedParams.data.id) : null;

    if (moduleId === null) {
      return reply.status(404).send(errorPayload("Profile module not found."));
    }

    return withAuthenticatedEditorMutationRoute<ProfileModulePayload[]>(
      request,
      reply,
      dependencies,
      "me.profile.modules.update",
      (repository, session, body) => repository.updateModule(session, moduleId, jsonBodyRequiredObject(body, request.body)),
    );
  });

  app.delete("/me/profile/modules/:id", async (request, reply) => {
    const parsedParams = profileModuleParamsSchema.safeParse(request.params);
    const moduleId = parsedParams.success ? positiveIntegerParam(parsedParams.data.id) : null;

    if (moduleId === null) {
      return reply.status(404).send(errorPayload("Profile module not found."));
    }

    return withAuthenticatedEditorMutationRoute<ProfileModulePayload[]>(
      request,
      reply,
      dependencies,
      "me.profile.modules.delete",
      (repository, session) => repository.deleteModule(session, moduleId),
    );
  });

  app.post("/me/profile/modules/:id/restore", async (request, reply) => {
    const parsedParams = profileModuleParamsSchema.safeParse(request.params);
    const moduleId = parsedParams.success ? positiveIntegerParam(parsedParams.data.id) : null;

    if (moduleId === null) {
      return reply.status(404).send(errorPayload("Profile module not found."));
    }

    return withAuthenticatedEditorMutationRoute<ProfileModulePayload[]>(
      request,
      reply,
      dependencies,
      "me.profile.modules.restore",
      (repository, session) => repository.restoreModule(session, moduleId),
    );
  });

  app.patch("/me/profile/module-order", async (request, reply) =>
    withAuthenticatedEditorMutationRoute<ProfileModulePayload[]>(
      request,
      reply,
      dependencies,
      "me.profile.module-order.update",
      (repository, session, body) => repository.updateModuleOrder(session, jsonBodyRequiredObject(body, request.body)),
    ),
  );

  app.patch("/me/profile/canvas", async (request, reply) =>
    withAuthenticatedEditorMutationRoute<ProfileCanvasUpdatePayload>(
      request,
      reply,
      dependencies,
      "me.profile.canvas.update",
      (repository, session, body) => repository.updateCanvas(session, jsonBodyRequiredObject(body, request.body)),
    ),
  );

  app.get("/me/profile/canvas-draft", async (request, reply) =>
    withAuthenticatedEditorRoute<ProfileCanvasDraftState>(
      request,
      reply,
      dependencies,
      "me.profile.canvas-draft",
      (repository, session) => repository.getCanvasDraft(session.userId),
    ),
  );

  app.patch("/me/profile/canvas-draft", async (request, reply) =>
    withAuthenticatedEditorMutationRoute<ProfileCanvasDraftState>(
      request,
      reply,
      dependencies,
      "me.profile.canvas-draft.update",
      (repository, session, body) => repository.updateCanvasDraft(session, jsonBodyRequiredObject(body, request.body)),
    ),
  );

  app.delete("/me/profile/canvas-draft", async (request, reply) =>
    withAuthenticatedEditorMutationRoute<ProfileCanvasDraftState>(
      request,
      reply,
      dependencies,
      "me.profile.canvas-draft.delete",
      (repository, session) => repository.deleteCanvasDraft(session),
    ),
  );

  app.post("/me/profile/canvas-draft/commit", async (request, reply) =>
    withAuthenticatedEditorMutationRoute<ProfileCanvasUpdatePayload>(
      request,
      reply,
      dependencies,
      "me.profile.canvas-draft.commit",
      (repository, session) => repository.commitCanvasDraft(session),
    ),
  );

  app.patch("/me/badges/featured", async (request, reply) =>
    withAuthenticatedEditorMutationRoute<ProfileBadgesPayload>(
      request,
      reply,
      dependencies,
      "me.badges.featured.update",
      (repository, session, body) => repository.updateFeaturedBadges(session, jsonBodyRequiredObject(body, request.body)),
    ),
  );

  app.patch("/me/account/email", async (request, reply) =>
    withAuthenticatedEditorMutationRoute<SettingsPayload>(
      request,
      reply,
      dependencies,
      "me.account.email.update",
      (repository, session, body) => repository.updateAccountEmail(session, jsonBodyRequiredObject(body, request.body)),
    ),
  );

  app.patch("/me/account/handle", async (request, reply) =>
    withAuthenticatedEditorMutationRoute<SettingsPayload>(
      request,
      reply,
      dependencies,
      "me.account.handle.update",
      (repository, session, body) => repository.updateAccountHandle(session, jsonBodyRequiredObject(body, request.body)),
    ),
  );

  app.patch("/me/account/password", async (request, reply) =>
    withAuthenticatedEditorMutationRoute<AccountPasswordPayload>(
      request,
      reply,
      dependencies,
      "me.account.password.update",
      (repository, session, body) => repository.updateAccountPassword(session, jsonBodyRequiredObject(body, request.body)),
    ),
  );

  app.delete("/me/account", async (request, reply) =>
    withAccountDeletionScheduleRoute(request, reply, dependencies, "me.account.delete"),
  );

  app.delete("/me/account/deletion", async (request, reply) =>
    withAccountDeletionScheduleRoute(request, reply, dependencies, "me.account.deletion.delete"),
  );

  app.post("/me/account/deletion/cancel", async (request, reply) =>
    withAuthenticatedEditorMutationRoute<SettingsPayload>(
      request,
      reply,
      dependencies,
      "me.account.deletion.cancel",
      (repository, session) => repository.cancelAccountDeletion(session),
    ),
  );

  app.post("/uploads/:kind", async (request, reply) => {
    const parsedParams = uploadParamsSchema.safeParse(request.params);
    const kind = parsedParams.success ? parsedParams.data.kind : "";

    if (!["image", "video", "audio"].includes(kind)) {
      return reply.status(404).send(errorPayload("Not found."));
    }

    return withAuthenticatedUploadRoute(request, reply, dependencies, `uploads.${kind}.create`, kind);
  });

  app.get("/chat/conversations", async (request, reply) =>
    withAuthenticatedChatRoute<ChatConversationPayload[]>(
      request,
      reply,
      dependencies,
      "chat.conversations",
      (repository, session) => repository.listConversations(session.userId),
    ),
  );

  app.post("/chat/conversations", async (request, reply) =>
    withAuthenticatedChatMutationRoute<ChatConversationPayload>(
      request,
      reply,
      dependencies,
      "chat.conversations.create",
      (repository, session, body) => repository.createConversation(session, jsonBodyRequiredObject(body, request.body)),
      201,
    ),
  );

  app.get("/chat/moots", async (request, reply) =>
    withAuthenticatedChatRoute<ChatUserPayload[]>(
      request,
      reply,
      dependencies,
      "chat.moots",
      (repository, session) => repository.listMoots(session.userId),
    ),
  );

  app.get("/chat/conversations/:id/messages", async (request, reply) => {
    const parsedParams = chatConversationParamsSchema.safeParse(request.params);
    const conversationId = parsedParams.success ? positiveIntegerParam(parsedParams.data.id) : null;

    if (conversationId === null) {
      return reply.status(404).send(errorPayload("Conversation not found."));
    }

    return withAuthenticatedChatRoute<ChatMessagesPayload>(
      request,
      reply,
      dependencies,
      "chat.messages",
      (repository, session) => repository.listMessages(session.userId, conversationId),
    );
  });

  app.post("/chat/conversations/:id/messages", async (request, reply) => {
    const parsedParams = chatConversationParamsSchema.safeParse(request.params);
    const conversationId = parsedParams.success ? positiveIntegerParam(parsedParams.data.id) : null;

    if (conversationId === null) {
      return reply.status(404).send(errorPayload("Conversation not found."));
    }

    return withAuthenticatedChatMutationRoute<ChatMessagePayload>(
      request,
      reply,
      dependencies,
      "chat.messages.create",
      (repository, session, body) => repository.createMessage(session, conversationId, jsonBodyRequiredObject(body, request.body)),
      201,
    );
  });

  app.post("/chat/conversations/:id/read", async (request, reply) => {
    const parsedParams = chatConversationParamsSchema.safeParse(request.params);
    const conversationId = parsedParams.success ? positiveIntegerParam(parsedParams.data.id) : null;

    if (conversationId === null) {
      return reply.status(404).send(errorPayload("Conversation not found."));
    }

    return withAuthenticatedChatMutationRoute<ChatReadPayload>(
      request,
      reply,
      dependencies,
      "chat.conversations.read",
      (repository, session) => repository.markConversationRead(session.userId, conversationId),
    );
  });

  app.post("/reports", async (request, reply) =>
    withAuthenticatedModerationMutationRoute<ModerationReportPayload>(
      request,
      reply,
      dependencies,
      "reports.create",
      (repository, session, body) => repository.createReport(session, jsonBodyRequiredObject(body, request.body)),
      201,
    ),
  );

  app.get("/admin/reports", async (request, reply) =>
    withAuthenticatedModerationRoute<ModerationReportPayload[]>(
      request,
      reply,
      dependencies,
      "admin.reports",
      (repository, session) => repository.listAdminReports(session),
    ),
  );

  app.get("/admin/rooms", async (request, reply) =>
    withAuthenticatedModerationRoute<RoomPayload[]>(
      request,
      reply,
      dependencies,
      "admin.rooms",
      (repository, session) => repository.listAdminRooms(session),
    ),
  );

  app.post("/admin/posts/:id/hide", async (request, reply) => {
    const parsedParams = adminEntityParamsSchema.safeParse(request.params);
    const postId = parsedParams.success ? positiveIntegerParam(parsedParams.data.id) : null;

    if (postId === null) {
      return reply.status(404).send(errorPayload("Post not found."));
    }

    return withAuthenticatedModerationMutationRoute<{ id: number; status: "hidden" }>(
      request,
      reply,
      dependencies,
      "admin.posts.hide",
      (repository, session, body) => repository.hidePost(session, postId, jsonBodyRequiredObject(body, request.body)),
    );
  });

  app.post("/admin/posts/:id/remove", async (request, reply) => {
    const parsedParams = adminEntityParamsSchema.safeParse(request.params);
    const postId = parsedParams.success ? positiveIntegerParam(parsedParams.data.id) : null;

    if (postId === null) {
      return reply.status(404).send(errorPayload("Post not found."));
    }

    return withAuthenticatedModerationMutationRoute<{ id: number; status: "removed" }>(
      request,
      reply,
      dependencies,
      "admin.posts.remove",
      (repository, session, body) => repository.removePost(session, postId, jsonBodyRequiredObject(body, request.body)),
    );
  });

  app.post("/admin/users/:id/suspend", async (request, reply) => {
    const parsedParams = adminEntityParamsSchema.safeParse(request.params);
    const userId = parsedParams.success ? positiveIntegerParam(parsedParams.data.id) : null;

    if (userId === null) {
      return reply.status(404).send(errorPayload("User not found."));
    }

    return withAuthenticatedModerationMutationRoute<ModerationUserPayload>(
      request,
      reply,
      dependencies,
      "admin.users.suspend",
      (repository, session, body) => repository.suspendUser(session, userId, jsonBodyRequiredObject(body, request.body)),
    );
  });

  app.post("/admin/reports/:id/resolve", async (request, reply) => {
    const parsedParams = adminEntityParamsSchema.safeParse(request.params);
    const reportId = parsedParams.success ? positiveIntegerParam(parsedParams.data.id) : null;

    if (reportId === null) {
      return reply.status(404).send(errorPayload("Report not found."));
    }

    return withAuthenticatedModerationMutationRoute<ModerationReportPayload>(
      request,
      reply,
      dependencies,
      "admin.reports.resolve",
      (repository, session, body) => repository.resolveReport(session, reportId, jsonBodyRequiredObject(body, request.body)),
    );
  });

  app.get("/notifications", async (request, reply) =>
    withAuthenticatedPrivateRoute<NotificationsPayload>(
      request,
      reply,
      dependencies,
      "notifications.index",
      (repository, session) => repository.getNotifications(session.userId),
    ),
  );

  app.post("/notifications/read", async (request, reply) =>
    withAuthenticatedMutationRoute<NotificationsReadPayload>(
      request,
      reply,
      dependencies,
      "notifications.read",
      (repository, session, body) => repository.markNotificationsRead(session.userId, notificationIdsFromPayload(body)),
    ),
  );

  app.post("/notifications/read-all", async (request, reply) =>
    withAuthenticatedMutationRoute<NotificationsReadAllPayload>(
      request,
      reply,
      dependencies,
      "notifications.read-all",
      (repository, session) => repository.markAllNotificationsRead(session.userId),
    ),
  );

  app.post("/notifications/:id/read", async (request, reply) => {
    const parsedParams = notificationReadParamsSchema.safeParse(request.params);
    const id = parsedParams.success ? parsedParams.data.id : "";

    if (!/^[0-9]+$/.test(id)) {
      return reply.status(405).send(errorPayload("Method not allowed."));
    }

    return withAuthenticatedMutationRoute<NotificationsReadPayload>(
      request,
      reply,
      dependencies,
      "notifications.read-one",
      (repository, session) => repository.markNotificationsRead(session.userId, [Number(id)]),
    );
  });

  app.post("/rooms", async (request, reply) =>
    withAuthenticatedContentMutationRoute<RoomPayload>(
      request,
      reply,
      dependencies,
      "rooms.create",
      (repository, session, body) => repository.createRoom(session, body),
      201,
    ),
  );

  app.get("/rooms", async (request, reply) => {
    if (dependencies.roomsRepository === undefined) {
      return internalError(request, reply, "rooms.index", new Error("Missing rooms repository dependency."));
    }

    try {
      const viewerSession = await currentViewerSession(request, dependencies.sessionsRepository);
      const viewer = optionalRoomViewerFromSession(viewerSession);
      const rooms = viewer === undefined
        ? await dependencies.roomsRepository.listPublicRooms()
        : await dependencies.roomsRepository.listPublicRooms(viewer);

      return reply.send(successPayload<RoomPayload[]>(rooms));
    } catch (error) {
      return internalError(request, reply, "rooms.index", error);
    }
  });

  app.get("/rooms/:slug/members", async (request, reply) => {
    if (dependencies.roomsRepository === undefined) {
      return internalError(request, reply, "rooms.members", new Error("Missing rooms repository dependency."));
    }

    const parsedParams = roomParamsSchema.safeParse(request.params);
    const normalizedSlug = parsedParams.success ? normalizeRoomSlug(parsedParams.data.slug) : null;

    if (normalizedSlug === null) {
      return reply.status(400).send(errorPayload("Invalid room slug."));
    }

    try {
      const viewerSession = await currentViewerSession(request, dependencies.sessionsRepository);
      const viewer = optionalRoomViewerFromSession(viewerSession);
      const members = viewer === undefined
        ? await dependencies.roomsRepository.getPublicRoomMembers(normalizedSlug)
        : await dependencies.roomsRepository.getPublicRoomMembers(normalizedSlug, viewer);

      if (members === null) {
        return reply.status(404).send(errorPayload("Room not found."));
      }

      return reply.send(successPayload<RoomMemberPayload[]>(members));
    } catch (error) {
      if (error instanceof RoomStorageNotReadyError) {
        return sendRouteError(request, reply, "rooms.members", 503, errorPayload(error.message), error);
      }

      return internalError(request, reply, "rooms.members", error);
    }
  });

  app.patch("/rooms/:slug", async (request, reply) => {
    const parsedParams = roomParamsSchema.safeParse(request.params);
    const normalizedSlug = parsedParams.success ? normalizeRoomSlug(parsedParams.data.slug) : null;

    if (normalizedSlug === null) {
      return reply.status(400).send(errorPayload("Invalid room slug."));
    }

    return withAuthenticatedContentMutationRoute<RoomPayload>(
      request,
      reply,
      dependencies,
      "rooms.update",
      (repository, session, body) => repository.updateRoom(session, normalizedSlug, body),
    );
  });

  app.delete("/rooms/:slug", async (request, reply) => {
    const parsedParams = roomParamsSchema.safeParse(request.params);
    const normalizedSlug = parsedParams.success ? normalizeRoomSlug(parsedParams.data.slug) : null;

    if (normalizedSlug === null) {
      return reply.status(400).send(errorPayload("Invalid room slug."));
    }

    return withAuthenticatedContentMutationRoute<RoomDeletePayload>(
      request,
      reply,
      dependencies,
      "rooms.delete",
      (repository, session) => repository.deleteRoom(session, normalizedSlug),
    );
  });

  app.post("/rooms/:slug/join", async (request, reply) => {
    const parsedParams = roomParamsSchema.safeParse(request.params);
    const normalizedSlug = parsedParams.success ? normalizeRoomSlug(parsedParams.data.slug) : null;

    if (normalizedSlug === null) {
      return reply.status(400).send(errorPayload("Invalid room slug."));
    }

    return withAuthenticatedContentMutationRoute<RoomPayload>(
      request,
      reply,
      dependencies,
      "rooms.join",
      (repository, session) => repository.joinRoom(session, normalizedSlug),
    );
  });

  app.delete("/rooms/:slug/join", async (request, reply) => {
    const parsedParams = roomParamsSchema.safeParse(request.params);
    const normalizedSlug = parsedParams.success ? normalizeRoomSlug(parsedParams.data.slug) : null;

    if (normalizedSlug === null) {
      return reply.status(400).send(errorPayload("Invalid room slug."));
    }

    return withAuthenticatedContentMutationRoute<RoomPayload>(
      request,
      reply,
      dependencies,
      "rooms.leave",
      (repository, session) => repository.leaveRoom(session, normalizedSlug),
    );
  });

  app.post("/rooms/:slug/access-requests", async (request, reply) => {
    const parsedParams = roomParamsSchema.safeParse(request.params);
    const normalizedSlug = parsedParams.success ? normalizeRoomSlug(parsedParams.data.slug) : null;

    if (normalizedSlug === null) {
      return reply.status(400).send(errorPayload("Invalid room slug."));
    }

    return withAuthenticatedContentMutationRoute<RoomPayload>(
      request,
      reply,
      dependencies,
      "rooms.access-requests.create",
      (repository, session) => repository.requestRoomAccess(session, normalizedSlug),
      201,
    );
  });

  app.delete("/rooms/:slug/access-requests/me", async (request, reply) => {
    const parsedParams = roomParamsSchema.safeParse(request.params);
    const normalizedSlug = parsedParams.success ? normalizeRoomSlug(parsedParams.data.slug) : null;

    if (normalizedSlug === null) {
      return reply.status(400).send(errorPayload("Invalid room slug."));
    }

    return withAuthenticatedContentMutationRoute<RoomPayload>(
      request,
      reply,
      dependencies,
      "rooms.access-requests.cancel",
      (repository, session) => repository.cancelRoomAccessRequest(session, normalizedSlug),
    );
  });

  app.get("/rooms/:slug/access-requests", async (request, reply) => {
    const parsedParams = roomParamsSchema.safeParse(request.params);
    const normalizedSlug = parsedParams.success ? normalizeRoomSlug(parsedParams.data.slug) : null;

    if (normalizedSlug === null) {
      return reply.status(400).send(errorPayload("Invalid room slug."));
    }

    return withAuthenticatedContentRoute<RoomAccessRequestPayload[]>(
      request,
      reply,
      dependencies,
      "rooms.access-requests.index",
      (repository, session) => repository.listRoomAccessRequests(session, normalizedSlug),
    );
  });

  app.post("/rooms/:slug/access-requests/:id/approve", async (request, reply) => {
    const parsedParams = roomAccessRequestParamsSchema.safeParse(request.params);
    const normalizedSlug = parsedParams.success ? normalizeRoomSlug(parsedParams.data.slug) : null;
    const requestId = parsedParams.success ? positiveIntegerParam(parsedParams.data.id) : null;

    if (normalizedSlug === null) {
      return reply.status(400).send(errorPayload("Invalid room slug."));
    }

    if (requestId === null) {
      return reply.status(404).send(errorPayload("Access request not found."));
    }

    return withAuthenticatedContentMutationRoute<RoomAccessRequestPayload[]>(
      request,
      reply,
      dependencies,
      "rooms.access-requests.approve",
      (repository, session) => repository.approveRoomAccessRequest(session, normalizedSlug, requestId),
    );
  });

  app.post("/rooms/:slug/access-requests/:id/deny", async (request, reply) => {
    const parsedParams = roomAccessRequestParamsSchema.safeParse(request.params);
    const normalizedSlug = parsedParams.success ? normalizeRoomSlug(parsedParams.data.slug) : null;
    const requestId = parsedParams.success ? positiveIntegerParam(parsedParams.data.id) : null;

    if (normalizedSlug === null) {
      return reply.status(400).send(errorPayload("Invalid room slug."));
    }

    if (requestId === null) {
      return reply.status(404).send(errorPayload("Access request not found."));
    }

    return withAuthenticatedContentMutationRoute<RoomAccessRequestPayload[]>(
      request,
      reply,
      dependencies,
      "rooms.access-requests.deny",
      (repository, session) => repository.denyRoomAccessRequest(session, normalizedSlug, requestId),
    );
  });

  app.post("/rooms/:slug/members", async (request, reply) => {
    const parsedParams = roomParamsSchema.safeParse(request.params);
    const normalizedSlug = parsedParams.success ? normalizeRoomSlug(parsedParams.data.slug) : null;

    if (normalizedSlug === null) {
      return reply.status(400).send(errorPayload("Invalid room slug."));
    }

    return withAuthenticatedContentMutationRoute<RoomMemberPayload[]>(
      request,
      reply,
      dependencies,
      "rooms.members.add",
      (repository, session, body) => repository.addRoomMember(session, normalizedSlug, body),
    );
  });

  app.delete("/rooms/:slug/members", async (request, reply) => {
    const parsedParams = roomParamsSchema.safeParse(request.params);
    const normalizedSlug = parsedParams.success ? normalizeRoomSlug(parsedParams.data.slug) : null;

    if (normalizedSlug === null) {
      return reply.status(400).send(errorPayload("Invalid room slug."));
    }

    return withAuthenticatedContentMutationRoute<RoomMemberPayload[]>(
      request,
      reply,
      dependencies,
      "rooms.members.remove",
      (repository, session, body) => repository.removeRoomMember(session, normalizedSlug, body),
    );
  });

  app.post("/rooms/:slug/moderators", async (request, reply) => {
    const parsedParams = roomParamsSchema.safeParse(request.params);
    const normalizedSlug = parsedParams.success ? normalizeRoomSlug(parsedParams.data.slug) : null;

    if (normalizedSlug === null) {
      return reply.status(400).send(errorPayload("Invalid room slug."));
    }

    return withAuthenticatedContentMutationRoute<RoomMemberPayload[]>(
      request,
      reply,
      dependencies,
      "rooms.moderators.add",
      (repository, session, body) => repository.addRoomModerator(session, normalizedSlug, body),
    );
  });

  app.delete("/rooms/:slug/moderators", async (request, reply) => {
    const parsedParams = roomParamsSchema.safeParse(request.params);
    const normalizedSlug = parsedParams.success ? normalizeRoomSlug(parsedParams.data.slug) : null;

    if (normalizedSlug === null) {
      return reply.status(400).send(errorPayload("Invalid room slug."));
    }

    return withAuthenticatedContentMutationRoute<RoomMemberPayload[]>(
      request,
      reply,
      dependencies,
      "rooms.moderators.remove",
      (repository, session, body) => repository.removeRoomModerator(session, normalizedSlug, body),
    );
  });

  app.get("/rooms/:slug", async (request, reply) => {
    if (dependencies.roomsRepository === undefined) {
      return internalError(request, reply, "rooms.show", new Error("Missing rooms repository dependency."));
    }

    const parsedParams = roomParamsSchema.safeParse(request.params);
    const normalizedSlug = parsedParams.success ? normalizeRoomSlug(parsedParams.data.slug) : null;

    if (normalizedSlug === null) {
      return reply.status(400).send(errorPayload("Invalid room slug."));
    }

    try {
      const viewerSession = await currentViewerSession(request, dependencies.sessionsRepository);
      const viewer = optionalRoomViewerFromSession(viewerSession);
      const room = viewer === undefined
        ? await dependencies.roomsRepository.getPublicRoom(normalizedSlug)
        : await dependencies.roomsRepository.getPublicRoom(normalizedSlug, viewer);

      if (room === null) {
        return reply.status(404).send(errorPayload("Room not found."));
      }

      return reply.send(successPayload<RoomPayload>(room));
    } catch (error) {
      return internalError(request, reply, "rooms.show", error);
    }
  });

  app.get("/search", async (request, reply) => {
    if (dependencies.searchRepository === undefined) {
      return internalError(request, reply, "search.index", new Error("Missing search repository dependency."));
    }

    try {
      const viewerSession = await currentViewerSession(request, dependencies.sessionsRepository);
      const results = await dependencies.searchRepository.search(
        searchQueryFromRequest(request.query),
        viewerSession?.userId ?? null,
        viewerSession?.role ?? null,
      );

      return reply.send(successPayload<SearchPayload>(results));
    } catch (error) {
      return internalError(request, reply, "search.index", error);
    }
  });

  app.get("/badges", async (request, reply) => {
    if (dependencies.badgesRepository === undefined) {
      return internalError(request, reply, "badges.index", new Error("Missing badges repository dependency."));
    }

    try {
      const badges = await dependencies.badgesRepository.listPublicBadges();

      return reply.send(successPayload<BadgePayload[]>(badges));
    } catch (error) {
      if (error instanceof BadgeStorageNotReadyError) {
        return sendRouteError(request, reply, "badges.index", 503, errorPayload(error.message), error);
      }

      return internalError(request, reply, "badges.index", error);
    }
  });

  app.get("/stats", async (request, reply) => {
    if (dependencies.statsRepository === undefined) {
      return internalError(request, reply, "stats.index", new Error("Missing stats repository dependency."));
    }

    try {
      const stats = await dependencies.statsRepository.getPublicStats();

      return reply.send(successPayload<PublicStatsPayload>(stats));
    } catch (error) {
      return internalError(request, reply, "stats.index", error);
    }
  });

  app.get("/feed/home", async (request, reply) => {
    if (dependencies.postsRepository === undefined) {
      return internalError(request, reply, "feed.home", new Error("Missing posts repository dependency."));
    }

    try {
      const viewerUserId = await currentViewerUserId(request, dependencies.sessionsRepository);
      const feed = await dependencies.postsRepository.getHomeFeed(viewerUserId);

      return reply.send(successPayload<HomeFeedPayload>(feed));
    } catch (error) {
      return internalError(request, reply, "feed.home", error);
    }
  });

  app.get("/feed/discover", async (request, reply) => {
    if (dependencies.postsRepository === undefined || dependencies.roomsRepository === undefined) {
      return internalError(request, reply, "feed.discover", new Error("Missing feed repository dependency."));
    }

    try {
      const viewerSession = await currentViewerSession(request, dependencies.sessionsRepository);
      const viewerUserId = viewerSession?.userId ?? null;
      const roomViewer = optionalRoomViewerFromSession(viewerSession);
      const [posts, rooms, peopleToWatch] = await Promise.all([
        dependencies.postsRepository.listDiscoverPosts(viewerUserId),
        roomViewer === undefined
          ? dependencies.roomsRepository.listPublicRooms()
          : dependencies.roomsRepository.listPublicRooms(roomViewer),
        dependencies.postsRepository.listPeopleToWatch(viewerUserId),
      ]);
      const feed: DiscoverFeedPayload = {
        posts,
        activeRooms: rooms.filter((room) => room.viewerCanViewPosts || room.visibility === "public" || room.visibility === "view_only").slice(0, 6),
        peopleToWatch,
      };

      return reply.send(successPayload<DiscoverFeedPayload>(feed));
    } catch (error) {
      return internalError(request, reply, "feed.discover", error);
    }
  });

  app.post("/posts", async (request, reply) =>
    withAuthenticatedContentMutationRoute<PostPayload>(
      request,
      reply,
      dependencies,
      "posts.create",
      (repository, session, body) => repository.createPost(session, body),
      201,
    ),
  );

  app.get("/posts", async (request, reply) => {
    if (dependencies.postsRepository === undefined) {
      return internalError(request, reply, "posts.index", new Error("Missing posts repository dependency."));
    }

    try {
      const viewerUserId = await currentViewerUserId(request, dependencies.sessionsRepository);
      const posts = await dependencies.postsRepository.listPublicPosts(viewerUserId);

      return reply.send(successPayload(posts));
    } catch (error) {
      return internalError(request, reply, "posts.index", error);
    }
  });

  app.post("/posts/:id/replies", async (request, reply) => {
    const parsedParams = postRepliesParamsSchema.safeParse(request.params);
    const postId = parsedParams.success ? positiveIntegerParam(parsedParams.data.id) : null;

    if (postId === null) {
      return reply.status(404).send(errorPayload("Not found."));
    }

    return withAuthenticatedContentMutationRoute<PostPayload>(
      request,
      reply,
      dependencies,
      "posts.replies.create",
      (repository, session, body) => repository.createReply(session, postId, body),
      201,
    );
  });

  app.get("/posts/:id/replies", async (request, reply) => {
    if (dependencies.postsRepository === undefined) {
      return internalError(request, reply, "posts.replies", new Error("Missing posts repository dependency."));
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
    } catch (error) {
      return internalError(request, reply, "posts.replies", error);
    }
  });

  app.patch("/posts/:id", async (request, reply) => {
    const parsedParams = postRepliesParamsSchema.safeParse(request.params);
    const postId = parsedParams.success ? positiveIntegerParam(parsedParams.data.id) : null;

    if (postId === null) {
      return reply.status(404).send(errorPayload("Not found."));
    }

    return withAuthenticatedContentMutationRoute<PostPayload>(
      request,
      reply,
      dependencies,
      "posts.update",
      (repository, session, body) => repository.updatePost(session, postId, body),
    );
  });

  app.delete("/posts/:id", async (request, reply) => {
    const parsedParams = postRepliesParamsSchema.safeParse(request.params);
    const postId = parsedParams.success ? positiveIntegerParam(parsedParams.data.id) : null;

    if (postId === null) {
      return reply.status(404).send(errorPayload("Not found."));
    }

    return withAuthenticatedContentMutationRoute<PostDeletePayload>(
      request,
      reply,
      dependencies,
      "posts.delete",
      (repository, session) => repository.deletePost(session, postId),
    );
  });

  app.post("/posts/:id/like", async (request, reply) => {
    const parsedParams = postRepliesParamsSchema.safeParse(request.params);
    const postId = parsedParams.success ? positiveIntegerParam(parsedParams.data.id) : null;

    if (postId === null) {
      return reply.status(404).send(errorPayload("Not found."));
    }

    return withAuthenticatedContentMutationRoute<LikePayload>(
      request,
      reply,
      dependencies,
      "posts.like.create",
      (repository, session) => repository.likePost(postId, session.userId),
    );
  });

  app.delete("/posts/:id/like", async (request, reply) => {
    const parsedParams = postRepliesParamsSchema.safeParse(request.params);
    const postId = parsedParams.success ? positiveIntegerParam(parsedParams.data.id) : null;

    if (postId === null) {
      return reply.status(404).send(errorPayload("Not found."));
    }

    return withAuthenticatedContentMutationRoute<LikePayload>(
      request,
      reply,
      dependencies,
      "posts.like.delete",
      (repository, session) => repository.unlikePost(postId, session.userId),
    );
  });

  app.post("/posts/:id/reblog", async (request, reply) => {
    const parsedParams = postRepliesParamsSchema.safeParse(request.params);
    const postId = parsedParams.success ? positiveIntegerParam(parsedParams.data.id) : null;

    if (postId === null) {
      return reply.status(404).send(errorPayload("Not found."));
    }

    return withAuthenticatedContentMutationRoute<ReblogPayload>(
      request,
      reply,
      dependencies,
      "posts.reblog.create",
      (repository, session) => repository.reblogPost(postId, session),
    );
  });

  app.delete("/posts/:id/reblog", async (request, reply) => {
    const parsedParams = postRepliesParamsSchema.safeParse(request.params);
    const postId = parsedParams.success ? positiveIntegerParam(parsedParams.data.id) : null;

    if (postId === null) {
      return reply.status(404).send(errorPayload("Not found."));
    }

    return withAuthenticatedContentMutationRoute<ReblogPayload>(
      request,
      reply,
      dependencies,
      "posts.reblog.delete",
      (repository, session) => repository.unreblogPost(postId, session),
    );
  });

  app.post("/posts/:id/reactions", async (request, reply) => {
    const parsedParams = postRepliesParamsSchema.safeParse(request.params);
    const postId = parsedParams.success ? positiveIntegerParam(parsedParams.data.id) : null;

    if (postId === null) {
      return reply.status(404).send(errorPayload("Not found."));
    }

    return withAuthenticatedContentMutationRoute<ReactionPayload>(
      request,
      reply,
      dependencies,
      "posts.reactions.create",
      (repository, session, body) => repository.reactToPost(postId, session.userId, body),
    );
  });

  app.delete("/posts/:id/reactions/:type", async (request, reply) => {
    const parsedParams = postReactionParamsSchema.safeParse(request.params);
    const postId = parsedParams.success ? positiveIntegerParam(parsedParams.data.id) : null;

    if (!parsedParams.success || postId === null) {
      return reply.status(404).send(errorPayload("Not found."));
    }

    return withAuthenticatedContentMutationRoute<ReactionPayload>(
      request,
      reply,
      dependencies,
      "posts.reactions.delete",
      (repository, session) => repository.deletePostReaction(postId, session.userId, parsedParams.data.type),
    );
  });

  app.post("/posts/:identifier/shares/messages", async (request, reply) => {
    const parsedParams = postIdentifierParamsSchema.safeParse(request.params);
    const identifier = parsedParams.success ? parsedParams.data.identifier : "";

    if (normalizePostIdentifier(identifier) === null) {
      return reply.status(404).send(errorPayload("Not found."));
    }

    return withAuthenticatedContentMutationRoute<PostShareMessagesPayload>(
      request,
      reply,
      dependencies,
      "posts.shares.messages",
      (repository, session, body) => repository.sharePostToMessages(identifier, session.userId, body),
      201,
    );
  });

  app.get("/posts/:identifier/share-card.png", async (request, reply) => {
    const parsedParams = postIdentifierParamsSchema.safeParse(request.params);
    const identifier = parsedParams.success ? parsedParams.data.identifier : "";

    if (normalizePostIdentifier(identifier) === null) {
      return reply.status(404).send("");
    }

    const viewerUserId = await currentViewerUserId(request, dependencies.sessionsRepository);

    return sendShareCardImage(
      request,
      reply,
      dependencies,
      "posts.share-card",
      (service) => service.postCard(identifier, viewerUserId),
    );
  });

  app.post("/posts/:identifier/share-card-cache", async (request, reply) => {
    const parsedParams = postIdentifierParamsSchema.safeParse(request.params);
    const identifier = parsedParams.success ? parsedParams.data.identifier : "";

    if (normalizePostIdentifier(identifier) === null) {
      return reply.status(404).send(errorPayload("Post not found."));
    }

    return withShareCardCacheRoute(
      request,
      reply,
      dependencies,
      "posts.share-card-cache",
      async (service, session) => service.cachePostCard(identifier, session, await request.file()),
    );
  });

  app.get("/posts/:identifier", async (request, reply) => {
    if (dependencies.postsRepository === undefined) {
      return internalError(request, reply, "posts.show", new Error("Missing posts repository dependency."));
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
    } catch (error) {
      return internalError(request, reply, "posts.show", error);
    }
  });

  app.get("/rooms/:slug/posts", async (request, reply) => {
    if (dependencies.postsRepository === undefined) {
      return internalError(request, reply, "rooms.posts", new Error("Missing posts repository dependency."));
    }

    const parsedParams = roomParamsSchema.safeParse(request.params);
    const normalizedSlug = parsedParams.success ? normalizeRoomSlug(parsedParams.data.slug) : null;

    if (normalizedSlug === null) {
      return reply.status(400).send(errorPayload("Invalid room slug."));
    }

    try {
      const viewerSession = await currentViewerSession(request, dependencies.sessionsRepository);
      const posts = await dependencies.postsRepository.listRoomPosts(
        normalizedSlug,
        viewerSession?.userId ?? null,
        viewerSession?.role ?? null,
      );

      if (posts === null) {
        return reply.status(404).send(errorPayload("Room not found."));
      }

      return reply.send(successPayload(posts));
    } catch (error) {
      return internalError(request, reply, "rooms.posts", error);
    }
  });

  app.get("/profiles/:handle/posts", async (request, reply) => {
    if (dependencies.postsRepository === undefined) {
      return internalError(request, reply, "profiles.posts", new Error("Missing posts repository dependency."));
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
    } catch (error) {
      return internalError(request, reply, "profiles.posts", error);
    }
  });

  app.get("/profiles/:handle/replies", async (request, reply) => {
    if (dependencies.postsRepository === undefined) {
      return internalError(request, reply, "profiles.replies", new Error("Missing posts repository dependency."));
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
    } catch (error) {
      return internalError(request, reply, "profiles.replies", error);
    }
  });

  app.get("/profiles/:handle/reblogs", async (request, reply) => {
    if (dependencies.postsRepository === undefined) {
      return internalError(request, reply, "profiles.reblogs", new Error("Missing posts repository dependency."));
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
    } catch (error) {
      return internalError(request, reply, "profiles.reblogs", error);
    }
  });

  app.post("/profiles/:handle/follow", async (request, reply) => {
    const parsedParams = profileParamsSchema.safeParse(request.params);
    const normalizedHandle = parsedParams.success ? normalizeProfileHandle(parsedParams.data.handle) : null;

    if (normalizedHandle === null) {
      return reply.status(400).send(errorPayload("Invalid profile handle."));
    }

    return withAuthenticatedContentMutationRoute<FollowRelationshipPayload>(
      request,
      reply,
      dependencies,
      "profiles.follow.create",
      (repository, session) => repository.followProfile(normalizedHandle, session.userId),
    );
  });

  app.delete("/profiles/:handle/follow", async (request, reply) => {
    const parsedParams = profileParamsSchema.safeParse(request.params);
    const normalizedHandle = parsedParams.success ? normalizeProfileHandle(parsedParams.data.handle) : null;

    if (normalizedHandle === null) {
      return reply.status(400).send(errorPayload("Invalid profile handle."));
    }

    return withAuthenticatedContentMutationRoute<FollowRelationshipPayload>(
      request,
      reply,
      dependencies,
      "profiles.follow.delete",
      (repository, session) => repository.unfollowProfile(normalizedHandle, session.userId),
    );
  });

  app.post("/profiles/:handle/block", async (request, reply) => {
    const parsedParams = profileParamsSchema.safeParse(request.params);
    const normalizedHandle = parsedParams.success ? normalizeProfileHandle(parsedParams.data.handle) : null;

    if (normalizedHandle === null) {
      return reply.status(400).send(errorPayload("Invalid profile handle."));
    }

    return withAuthenticatedContentMutationRoute<ProfileControlPayload>(
      request,
      reply,
      dependencies,
      "profiles.block.create",
      (repository, session) => repository.blockProfile(normalizedHandle, session.userId),
    );
  });

  app.delete("/profiles/:handle/block", async (request, reply) => {
    const parsedParams = profileParamsSchema.safeParse(request.params);
    const normalizedHandle = parsedParams.success ? normalizeProfileHandle(parsedParams.data.handle) : null;

    if (normalizedHandle === null) {
      return reply.status(400).send(errorPayload("Invalid profile handle."));
    }

    return withAuthenticatedContentMutationRoute<ProfileControlPayload>(
      request,
      reply,
      dependencies,
      "profiles.block.delete",
      (repository, session) => repository.unblockProfile(normalizedHandle, session.userId),
    );
  });

  app.post("/profiles/:handle/mute", async (request, reply) => {
    const parsedParams = profileParamsSchema.safeParse(request.params);
    const normalizedHandle = parsedParams.success ? normalizeProfileHandle(parsedParams.data.handle) : null;

    if (normalizedHandle === null) {
      return reply.status(400).send(errorPayload("Invalid profile handle."));
    }

    return withAuthenticatedContentMutationRoute<ProfileControlPayload>(
      request,
      reply,
      dependencies,
      "profiles.mute.create",
      (repository, session) => repository.muteProfile(normalizedHandle, session.userId),
    );
  });

  app.delete("/profiles/:handle/mute", async (request, reply) => {
    const parsedParams = profileParamsSchema.safeParse(request.params);
    const normalizedHandle = parsedParams.success ? normalizeProfileHandle(parsedParams.data.handle) : null;

    if (normalizedHandle === null) {
      return reply.status(400).send(errorPayload("Invalid profile handle."));
    }

    return withAuthenticatedContentMutationRoute<ProfileControlPayload>(
      request,
      reply,
      dependencies,
      "profiles.mute.delete",
      (repository, session) => repository.unmuteProfile(normalizedHandle, session.userId),
    );
  });

  app.post("/profiles/:handle/star", async (request, reply) => {
    const parsedParams = profileParamsSchema.safeParse(request.params);
    const normalizedHandle = parsedParams.success ? normalizeProfileHandle(parsedParams.data.handle) : null;

    if (normalizedHandle === null) {
      return reply.status(400).send(errorPayload("Invalid profile handle."));
    }

    return withAuthenticatedContentMutationRoute<ProfileStarPayload>(
      request,
      reply,
      dependencies,
      "profiles.star.create",
      (repository, session) => repository.starProfile(normalizedHandle, session.userId),
    );
  });

  app.delete("/profiles/:handle/star", async (request, reply) => {
    const parsedParams = profileParamsSchema.safeParse(request.params);
    const normalizedHandle = parsedParams.success ? normalizeProfileHandle(parsedParams.data.handle) : null;

    if (normalizedHandle === null) {
      return reply.status(400).send(errorPayload("Invalid profile handle."));
    }

    return withAuthenticatedContentMutationRoute<ProfileStarPayload>(
      request,
      reply,
      dependencies,
      "profiles.star.delete",
      (repository, session) => repository.unstarProfile(normalizedHandle, session.userId),
    );
  });

  app.delete("/profiles/:handle/follower", async (request, reply) => {
    const parsedParams = profileParamsSchema.safeParse(request.params);
    const normalizedHandle = parsedParams.success ? normalizeProfileHandle(parsedParams.data.handle) : null;

    if (normalizedHandle === null) {
      return reply.status(400).send(errorPayload("Invalid profile handle."));
    }

    return withAuthenticatedContentMutationRoute<RemoveFollowerPayload>(
      request,
      reply,
      dependencies,
      "profiles.follower.delete",
      (repository, session) => repository.removeFollower(normalizedHandle, session.userId),
    );
  });

  app.get("/profiles/:handle/share-card.png", async (request, reply) => {
    const parsedParams = profileParamsSchema.safeParse(request.params);
    const normalizedHandle = parsedParams.success ? normalizeProfileHandle(parsedParams.data.handle) : null;

    if (normalizedHandle === null) {
      return reply.status(404).send("");
    }

    return sendShareCardImage(
      request,
      reply,
      dependencies,
      "profiles.share-card",
      (service) => service.profileCard(normalizedHandle),
    );
  });

  app.post("/profiles/:handle/share-card-cache", async (request, reply) => {
    const parsedParams = profileParamsSchema.safeParse(request.params);
    const normalizedHandle = parsedParams.success ? normalizeProfileHandle(parsedParams.data.handle) : null;

    if (normalizedHandle === null) {
      return reply.status(404).send(errorPayload("Profile not found."));
    }

    return withShareCardCacheRoute(
      request,
      reply,
      dependencies,
      "profiles.share-card-cache",
      async (service, session) => service.cacheProfileCard(normalizedHandle, session, await request.file()),
    );
  });

  app.get("/profiles/:handle/rooms", async (request, reply) =>
    withPublicProfileSubroute<RoomPayload[]>(
      request,
      reply,
      dependencies.profilesRepository,
      "profiles.rooms",
      (repository, handle) => repository.getPublicProfileRooms(handle),
    ),
  );

  app.get("/profiles/:handle/modules", async (request, reply) =>
    withPublicProfileSubroute<ProfileModulePayload[]>(
      request,
      reply,
      dependencies.profilesRepository,
      "profiles.modules",
      (repository, handle) => repository.getPublicProfileModules(handle),
    ),
  );

  app.get("/profiles/:handle/badges", async (request, reply) =>
    withPublicProfileSubroute<ProfileBadgesPayload>(
      request,
      reply,
      dependencies.profilesRepository,
      "profiles.badges",
      (repository, handle) => repository.getPublicProfileBadges(handle),
    ),
  );

  app.get("/profiles/:handle/followers", async (request, reply) =>
    withPublicProfileSubroute<FollowUserCardPayload[]>(
      request,
      reply,
      dependencies.profilesRepository,
      "profiles.followers",
      (repository, handle) => repository.getPublicProfileFollowers(handle),
    ),
  );

  app.get("/profiles/:handle/following", async (request, reply) =>
    withPublicProfileSubroute<FollowUserCardPayload[]>(
      request,
      reply,
      dependencies.profilesRepository,
      "profiles.following",
      (repository, handle) => repository.getPublicProfileFollowing(handle),
    ),
  );

  app.get("/profiles/:handle", async (request, reply) => {
    if (dependencies.profilesRepository === undefined) {
      return internalError(request, reply, "profiles.show", new Error("Missing profiles repository dependency."));
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
    } catch (error) {
      return internalError(request, reply, "profiles.show", error);
    }
  });

  app.setErrorHandler((error, request, reply) => {
    if (isInvalidJsonBodyError(error)) {
      return reply.status(400).send(errorPayload("Invalid JSON body."));
    }

    return internalError(request, reply, "unhandled", error);
  });

  app.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send(errorPayload("Not found."));
  });

  return app;
}
