import type { Category, MenuItem } from '../types';

const API = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? '/api';
const MOBILE_SESSION_KEY = 'opentab.mobile.auth.session';

interface StoredMobileSession {
  token?: string;
}

export interface MobileMenuVenue {
  id: string;
  name: string;
  address: string;
  description: string;
}

export interface MobileMenuCatalog {
  venue: MobileMenuVenue | null;
  categories: Category[];
  items: MenuItem[];
}

function readStoredMobileToken(): string | null {
  const raw = localStorage.getItem(MOBILE_SESSION_KEY);

  if (!raw) return null;

  try {
    const session = JSON.parse(raw) as StoredMobileSession;
    return session.token ?? null;
  } catch {
    return null;
  }
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = typeof data?.detail === 'string' ? data.detail : 'Ne mogu da učitam podatke.';
    throw new Error(message);
  }

  return data as T;
}

async function mobileGet<T>(path: string): Promise<T> {
  const token = readStoredMobileToken();
  const headers: HeadersInit = {
    Accept: 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API}${path}`, {
    method: 'GET',
    headers,
  });

  return readJsonResponse<T>(response);
}

export async function getMobileMenuCatalog(): Promise<MobileMenuCatalog> {
  return mobileGet<MobileMenuCatalog>('/mobile/menu/');
}
