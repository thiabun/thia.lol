const apiBase = "/api";

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
  const response = await fetch(`${apiBase}${path}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });

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
): Promise<T> {
  return apiMutate<T>("DELETE", path, undefined, csrfToken);
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

  const response = await fetch(`${apiBase}${path}`, request);

  return unwrapResponse<T>(response);
}

async function unwrapResponse<T>(response: Response): Promise<T> {
  const json = (await response.json().catch(() => undefined)) as
    | T
    | ApiEnvelope<T>
    | undefined;

  if (!response.ok) {
    throw new ApiClientError(getErrorMessage(json, response.status), response.status);
  }

  if (isApiEnvelope<T>(json)) {
    if (!json.ok || json.data === undefined) {
      throw new ApiClientError(json.error ?? "API response was not ok", response.status);
    }

    return json.data;
  }

  if (json === undefined) {
    throw new ApiClientError("API returned an empty response", response.status);
  }

  return json;
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

  return `API responded with ${status}`;
}
