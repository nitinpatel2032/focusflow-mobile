import { create } from 'zustand';
import * as authApi from '../api/authApi';
import { clearTokens, getTokens, saveTokens } from '../api/tokenStorage';
import { setAccessToken } from '../api/client';
import type { User } from '../types/models';

type AuthState = {
  user?: User;
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { name: string; email: string; password: string }) => Promise<void>;
  verifyRegistration: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (input: { name?: string; seekingCourses?: string[] }) => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  isHydrated: false,
  hydrate: async () => {
    const tokens = await getTokens();
    setAccessToken(tokens.accessToken ?? undefined);
    if (!tokens.accessToken) {
      set({ isHydrated: true });
      return;
    }
    try {
      const user = await authApi.me();
      set({ user, isHydrated: true });
    } catch {
      await clearTokens();
      setAccessToken(undefined);
      set({ isHydrated: true });
    }
  },
  login: async (email, password) => {
    const data = await authApi.login({ email, password });
    await saveTokens(data.accessToken, data.refreshToken);
    setAccessToken(data.accessToken);
    set({ user: data.user });
  },
  register: async (input) => {
    await authApi.register(input);
  },
  verifyRegistration: async (email, code) => {
    const data = await authApi.verifyRegistration({ email, code });
    await saveTokens(data.accessToken, data.refreshToken);
    setAccessToken(data.accessToken);
    set({ user: data.user });
  },
  logout: async () => {
    const { refreshToken } = await getTokens();
    if (refreshToken) {
      await authApi.logout(refreshToken).catch(() => undefined);
    }
    await clearTokens();
    setAccessToken(undefined);
    set({ user: undefined });
  },
  updateProfile: async (input) => {
    const user = await authApi.updateProfile(input);
    set({ user });
  }
}));
