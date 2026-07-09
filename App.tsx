import 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Asset } from 'expo-asset';
import * as Font from 'expo-font';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAuthStore } from './src/store/authStore';
import { colors } from './src/constants/colors';
import { registerClearUser } from './src/api/client';
import { usePreferencesStore } from './src/store/preferencesStore';

const queryClient = new QueryClient();

// The expo-font plugin copies ionicons.ttf → android/app/src/main/assets/fonts/ionicons.ttf
// so React Native text renderer resolves fontFamily:'ionicons' natively.
// We also call Font.loadAsync so that Font.isLoaded('ionicons') returns true,
// which is required by @expo/vector-icons before it will render the icon glyph.
async function loadIconFonts(): Promise<void> {
  // Step 1: explicitly download/verify the asset so we get a guaranteed local URI
  const [fontAsset] = await Asset.loadAsync(
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('./assets/fonts/ionicons.ttf')
  );

  // Step 2: load the font from its resolved local URI, not the module ID
  // (avoids any asset-manifest resolution issues inside Font.loadAsync)
  if (fontAsset.localUri) {
    await Font.loadAsync({ ionicons: { uri: fontAsset.localUri } });
  } else {
    // Fallback: try loading directly from the module ID
    await Font.loadAsync({
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      ionicons: require('./assets/fonts/ionicons.ttf'),
    });
  }
}

export default function App() {
  const hydrate = useAuthStore((state) => state.hydrate);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const loadPreferences = usePreferencesStore((state) => state.loadPreferences);
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    hydrate();
    loadPreferences();
    registerClearUser(() => useAuthStore.setState({ user: undefined }));
  }, [hydrate, loadPreferences]);

  useEffect(() => {
    loadIconFonts()
      .catch((e) => console.warn('[App] Font load failed:', e?.message ?? e))
      .finally(() => setFontsReady(true));
  }, []);

  if (!isHydrated || !fontsReady) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          <StatusBar style="dark" />
          <RootNavigator />
        </NavigationContainer>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
