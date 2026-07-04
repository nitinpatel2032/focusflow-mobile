import * as SecureStore from 'expo-secure-store';

const accessKey = 'justStart.accessToken';
const refreshKey = 'justStart.refreshToken';
const userKey = 'justStart.userProfile';

export async function saveTokens(accessToken: string, refreshToken: string) {
  await Promise.all([
    SecureStore.setItemAsync(accessKey, accessToken),
    SecureStore.setItemAsync(refreshKey, refreshToken)
  ]);
}

export async function getTokens() {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(accessKey),
    SecureStore.getItemAsync(refreshKey)
  ]);
  return { accessToken, refreshToken };
}

export async function clearTokens() {
  await Promise.all([SecureStore.deleteItemAsync(accessKey), SecureStore.deleteItemAsync(refreshKey)]);
}

export async function saveUserProfile(user: any) {
  await SecureStore.setItemAsync(userKey, JSON.stringify(user));
}

export async function getUserProfile() {
  const data = await SecureStore.getItemAsync(userKey);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function clearUserProfile() {
  await SecureStore.deleteItemAsync(userKey);
}

