import * as SecureStore from 'expo-secure-store';

const accessKey = 'justStart.accessToken';
const refreshKey = 'justStart.refreshToken';

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
