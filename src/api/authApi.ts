import type { User } from '../types/models';
import { api } from './client';

export type AuthResponse = {
  user: User;
  accessToken: string;
  refreshToken: string;
};

export function register(payload: { name: string; email: string; password: string }) {
  return api.post<{ email: string; status: string; message: string }>('/auth/register', payload).then((res) => res.data);
}

export function verifyRegistration(payload: { email: string; code: string }) {
  return api.post<AuthResponse>('/auth/verify-registration', payload).then((res) => res.data);
}

export function login(payload: { email: string; password: string }) {
  return api.post<AuthResponse>('/auth/login', payload).then((res) => res.data);
}

export function me() {
  return api.get<User>('/auth/me').then((res) => res.data);
}

export function logout(refreshToken: string) {
  return api.post('/auth/logout', { refreshToken });
}

export function updateProfile(payload: { name?: string; seekingCourses?: string[] }) {
  return api.patch<User>('/auth/profile', payload).then((res) => res.data);
}

export function forgotPassword(email: string) {
  return api.post<{ message: string }>('/auth/forgot-password', { email }).then((res) => res.data);
}

export function resetPassword(payload: { email: string; code: string; password?: string }) {
  return api.post<{ message: string }>('/auth/reset-password', payload).then((res) => res.data);
}

