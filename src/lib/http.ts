import type { ApiEnvelope } from '@/lib/types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '');
const API_PREFIX = import.meta.env.VITE_API_PREFIX ?? '';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractEnvelopeData<T>(payload: unknown): T | undefined {
  if (!isObject(payload)) {
    return undefined;
  }

  if ('data' in payload && payload.data !== undefined) {
    return payload.data as T;
  }

  const candidates = ['result', 'payload'];
  for (const key of candidates) {
    if (payload[key] !== undefined) {
      return payload[key] as T;
    }
  }

  return undefined;
}

function extractErrorMessage(payload: unknown): string | null {
  if (!isObject(payload)) {
    return null;
  }

  const detail = payload.detail;
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }

  const message = payload.message;
  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  const error = payload.error;
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (isObject(detail)) {
    const nestedMessage = extractErrorMessage(detail);
    if (nestedMessage) {
      return nestedMessage;
    }
  }

  return null;
}

function resolvePayload<T>(payload: T | ApiEnvelope<T>): T {
  const extracted = extractEnvelopeData<T>(payload);
  if (extracted !== undefined) {
    return extracted;
  }

  return payload as T;
}

function joinPath(prefix: string, path: string) {
  const normalizedPrefix = prefix.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedPrefix}${normalizedPath}`;
}

function buildCandidatePaths(path: string) {
  const prefixCandidates = [API_PREFIX, '', '/api/v1'];
  const seen = new Set<string>();
  const candidates: string[] = [];

  for (const prefix of prefixCandidates) {
    const joined = joinPath(prefix, path);
    if (!seen.has(joined)) {
      seen.add(joined);
      candidates.push(joined);
    }
  }

  return candidates;
}

async function readErrorResponse(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const payload = await response.json();
    const message = extractErrorMessage(payload);
    return {
      message: message ?? `Request failed: ${response.status}`,
      retryableNotFound: response.status === 404 && !message,
    };
  }

  const text = (await response.text()).trim();
  const plainNotFound = text === '' || /^not found$/i.test(text);
  return {
    message: text || `Request failed: ${response.status}`,
    retryableNotFound: response.status === 404 && plainNotFound,
  };
}

export async function requestJson<T>(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let lastError: Error | null = null;
  for (const candidatePath of buildCandidatePaths(path)) {
    const response = await fetch(`${API_BASE_URL}${candidatePath}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      const errorInfo = await readErrorResponse(response);
      if (response.status === 404 && errorInfo.retryableNotFound) {
        lastError = new Error(`Not found for path ${candidatePath}`);
        continue;
      }

      throw new Error(errorInfo.message);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const payload = (await response.json()) as T | ApiEnvelope<T>;
    return resolvePayload(payload);
  }

  throw lastError ?? new Error(`Unable to resolve request path for ${path}`);
}

export function shouldUseMocks() {
  return (import.meta.env.VITE_USE_MOCKS ?? 'true') === 'true';
}
