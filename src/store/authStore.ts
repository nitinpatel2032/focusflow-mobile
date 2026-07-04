import { create } from 'zustand';
import * as authApi from '../api/authApi';
import { clearTokens, getTokens, saveTokens, getUserProfile, saveUserProfile, clearUserProfile } from '../api/tokenStorage';
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
    try {
      const [tokens, cachedUser] = await Promise.all([
        getTokens(),
        getUserProfile()
      ]);
      
      setAccessToken(tokens.accessToken ?? undefined);
      
      if (!tokens.accessToken) {
        set({ user: undefined, isHydrated: true });
        return;
      }
      
      // If we have a cached user profile, immediately hydrate the UI so the app mounts
      if (cachedUser) {
        set({ user: cachedUser, isHydrated: true });
        
        // Fetch fresh profile in the background to verify/update
        authApi.me()
          .then((user) => {
            set({ user });
            saveUserProfile(user).catch(() => undefined);
          })
          .catch(async (error) => {
            if (error.response?.status === 401) {
              await clearTokens();
              await clearUserProfile();
              setAccessToken(undefined);
              set({ user: undefined });
            }
          });
      } else {
        // No cached profile - fallback to fetching before completing hydration
        try {
          const user = await authApi.me();
          await saveUserProfile(user);
          set({ user, isHydrated: true });
        } catch (error: any) {
          if (error.response?.status === 401) {
            await clearTokens();
            await clearUserProfile();
            setAccessToken(undefined);
          }
          set({ isHydrated: true });
        }
      }
    } catch {
      set({ isHydrated: true });
    }
  },
  login: async (email, password) => {
    const data = await authApi.login({ email, password });
    await saveTokens(data.accessToken, data.refreshToken);
    await saveUserProfile(data.user);
    setAccessToken(data.accessToken);
    set({ user: data.user });
  },
  register: async (input) => {
    await authApi.register(input);
  },
  verifyRegistration: async (email, code) => {
    const data = await authApi.verifyRegistration({ email, code });
    await saveTokens(data.accessToken, data.refreshToken);
    await saveUserProfile(data.user);
    setAccessToken(data.accessToken);
    set({ user: data.user });
  },
  logout: async () => {
    const { refreshToken } = await getTokens();
    if (refreshToken) {
      await authApi.logout(refreshToken).catch(() => undefined);
    }
    await clearTokens();
    await clearUserProfile();
    setAccessToken(undefined);
    set({ user: undefined });
  },
  updateProfile: async (input) => {
    const user = await authApi.updateProfile(input);
    await saveUserProfile(user);
    set({ user });
  }
}));
