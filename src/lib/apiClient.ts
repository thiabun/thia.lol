const apiBase = "/api";
const apiGetTimeoutMs = 12_000;
const apiMutationTimeoutMs = 20_000;
export const authSessionExpiredEventName = "thia:auth-session-expired";

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

export class ApiClientError extends Error {
  status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetchWithTimeout(`${apiBase}${path}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  }, apiGetTimeoutMs);

  return unwrapResponse<T>(response);
}

export async function apiPost<T>(
  path: string,
  body?: Record<string, unknown>,
  csrfToken?: string | undefined,
): Promise<T> {
  return apiMutate<T>("POST", path, body, csrfToken);
}

export async function apiPatch<T>(
  path: string,
  body?: Record<string, unknown>,
  csrfToken?: string | undefined,
): Promise<T> {
  return apiMutate<T>("PATCH", path, body, csrfToken);
}

export async function apiDelete<T>(
  path: string,
  csrfToken?: string | undefined,
  body?: Record<string, unknown>,
): Promise<T> {
  return apiMutate<T>("DELETE", path, body, csrfToken);
}

export async function apiUpload<T>(
  path: string,
  body: FormData,
  csrfToken?: string | undefined,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  const response = await fetch(`${apiBase}${path}`, {
    method: "POST",
    credentials: "include",
    headers,
    body,
  });

  return unwrapResponse<T>(response);
}

export async function apiUploadBlob(
  path: string,
  body: FormData,
  csrfToken?: string | undefined,
): Promise<Blob> {
  const headers: Record<string, string> = {
    Accept: "image/webp,application/json",
  };

  if (csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  const response = await fetch(`${apiBase}${path}`, {
    method: "POST",
    credentials: "include",
    headers,
    body,
  });

  if (!response.ok) {
    if (response.status === 401) {
      dispatchAuthSessionExpired();
    }

    const json = (await response.json().catch(() => undefined)) as
      | ApiEnvelope<unknown>
      | undefined;

    throw new ApiClientError(getErrorMessage(json, response.status), response.status);
  }

  return response.blob();
}

async function apiMutate<T>(
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: Record<string, unknown>,
  csrfToken?: string | undefined,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  const request: RequestInit = {
    method,
    credentials: "include",
    headers,
  };

  if (body !== undefined) {
    request.body = JSON.stringify(body);
  }

  const response = await fetchWithTimeout(
    `${apiBase}${path}`,
    request,
    apiMutationTimeoutMs,
  );

  return unwrapResponse<T>(response);
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiClientError("Could not load this right now. (timeout)");
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function unwrapResponse<T>(response: Response): Promise<T> {
  const json = (await response.json().catch(() => undefined)) as
    | T
    | ApiEnvelope<T>
    | undefined;

  if (!response.ok) {
    if (response.status === 401) {
      dispatchAuthSessionExpired();
    }

    throw new ApiClientError(getErrorMessage(json, response.status), response.status);
  }

  if (isApiEnvelope<T>(json)) {
    if (!json.ok || json.data === undefined) {
      throw new ApiClientError(
        json.error ?? "Could not load this right now.",
        response.status,
      );
    }

    return json.data;
  }

  if (json === undefined) {
    throw new ApiClientError("Could not load this right now.", response.status);
  }

  return json;
}

function dispatchAuthSessionExpired() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(authSessionExpiredEventName));
}

function isApiEnvelope<T>(value: T | ApiEnvelope<T> | undefined): value is ApiEnvelope<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    typeof (value as ApiEnvelope<T>).ok === "boolean"
  );
}

function getErrorMessage<T>(
  value: T | ApiEnvelope<T> | undefined,
  status: number,
): string {
  if (isApiEnvelope<T>(value) && value.error) {
    return value.error;
  }

  return `Could not load this right now. (${status})`;
}
