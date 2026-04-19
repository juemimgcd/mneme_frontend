import type { LocationQuery, LocationQueryRaw } from 'vue-router';

function firstValue(value: LocationQuery[string]) {
  return Array.isArray(value) ? value[0] : value;
}

export function readQueryString(query: LocationQuery, key: string) {
  const value = firstValue(query[key]);
  return typeof value === 'string' ? value : '';
}

export function readQueryNumber(query: LocationQuery, key: string, fallback: number) {
  const value = readQueryString(query, key);
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function readQueryFloat(query: LocationQuery, key: string, fallback: number) {
  return readQueryNumber(query, key, fallback);
}

export function readQueryBoolean(query: LocationQuery, key: string, fallback = false) {
  const value = readQueryString(query, key).toLowerCase();
  if (!value) {
    return fallback;
  }

  if (['1', 'true', 'yes', 'on'].includes(value)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(value)) {
    return false;
  }

  return fallback;
}

export function mergeQuery(
  currentQuery: LocationQuery,
  patch: Record<string, string | number | null | undefined>,
): LocationQueryRaw {
  const nextQuery: LocationQueryRaw = { ...currentQuery };

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null || value === '') {
      delete nextQuery[key];
    } else {
      nextQuery[key] = String(value);
    }
  }

  return nextQuery;
}
