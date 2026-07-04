import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../constants/config';
import { clearTokens, getTokens, saveTokens } from './tokenStorage';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000
});

let inMemoryAccessToken: string | undefined;
let refreshPromise: Promise<string | undefined> | undefined;

// Lazily imported to avoid circular dependency (authStore → client → authStore)
let _clearUser: (() => void) | undefined;
export function registerClearUser(fn: () => void) {
  _clearUser = fn;
}

export function setAccessToken(token?: string) {
  inMemoryAccessToken = token;
}

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = inMemoryAccessToken ?? (await getTokens()).accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (error.response?.status !== 401 || !original || original._retry || original.url?.includes('/auth/refresh')) {
      throw error;
    }

    original._retry = true;
    refreshPromise ??= refreshAccessToken();
    const token = await refreshPromise.finally(() => {
      refreshPromise = undefined;
    });

    if (!token) {
      throw error;
    }

    original.headers.Authorization = `Bearer ${token}`;
    return api(original);
  }
);

async function refreshAccessToken() {
  const { refreshToken } = await getTokens();
  if (!refreshToken) {
    await clearTokens();
    setAccessToken(undefined);
    _clearUser?.();
    return undefined;
  }

  try {
    const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
    await saveTokens(data.accessToken, data.refreshToken);
    setAccessToken(data.accessToken);
    return data.accessToken as string;
  } catch {
    await clearTokens();
    setAccessToken(undefined);
    _clearUser?.();
    return undefined;
  }
}
