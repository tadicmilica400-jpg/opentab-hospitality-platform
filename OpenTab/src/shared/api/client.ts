// Autori: Milica Tadić ([student ID omitted], SSU11), Boško Trifunović ([student ID omitted], SSU16-19)
import { getAuthToken } from "../../features/auth/session/authStorage";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

type ApiRequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

export class ApiRequestError extends Error {
  status?: number;
  isNetworkError: boolean;

  constructor(message: string, options: { status?: number; isNetworkError?: boolean } = {}) {
    super(message);
    this.name = "ApiRequestError";
    this.status = options.status;
    this.isNetworkError = Boolean(options.isNetworkError);
  }
}

export function isApiNetworkError(error: unknown) {
  return error instanceof ApiRequestError && error.isNetworkError;
}

function joinUrl(path: string) {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function getErrorMessage(errorBody: unknown, status: number) {
  if (typeof errorBody === "string" && errorBody.trim().length > 0) {
    const normalizedBody = errorBody.trim().toLowerCase();

    if (normalizedBody.includes("<!doctype html") || normalizedBody.includes("<html")) {
      return "Server je vratio grešku. Proveri terminal backend-a.";
    }

    return errorBody;
  }

  if (errorBody && typeof errorBody === "object") {
    const body = errorBody as Record<string, unknown>;

    if (typeof body.detail === "string") {
      return body.detail;
    }

    if (typeof body.message === "string") {
      return body.message;
    }

    const firstError = Object.values(body).flat().find((value) => typeof value === "string");

    if (typeof firstError === "string") {
      return firstError;
    }
  }

  return `API greška: ${status}`;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const hasBody = options.body !== undefined;
  const isFormData = options.body instanceof FormData;

  if (hasBody && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const requestBody: BodyInit | undefined = hasBody
    ? isFormData
      ? (options.body as FormData)
      : JSON.stringify(options.body)
    : undefined;

  const token = getAuthToken();

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;

  try {
    response = await fetch(joinUrl(path), {
      method: options.method ?? "GET",
      headers,
      body: requestBody,
      cache: "no-store",
    });
  } catch (error) {
    throw new ApiRequestError(
      error instanceof Error ? error.message : "Backend nije dostupan.",
      { isNetworkError: true },
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  const hasJsonBody = contentType.includes("application/json");
  const responseBody = hasJsonBody ? await response.json() : await response.text();

  if (!response.ok) {
    throw new ApiRequestError(getErrorMessage(responseBody, response.status), {
      status: response.status,
      isNetworkError: false,
    });
  }

  return responseBody as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: "POST",
    body,
  });
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: "PATCH",
    body,
  });
}

export function apiDelete<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: "DELETE",
    body,
  });
}
