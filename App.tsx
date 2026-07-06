import 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAuthStore } from './src/store/authStore';
import { colors } from './src/constants/colors';
import { registerClearUser } from './src/api/client';

import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { usePreferencesStore } from './src/store/preferencesStore';

const queryClient = new QueryClient();

export default function App() {
  const hydrate = useAuthStore((state) => state.hydrate);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const loadPreferences = usePreferencesStore((state) => state.loadPreferences);

  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
  });

  useEffect(() => {
    hydrate();
    loadPreferences();
    // Wire up the API client so it can clear auth state when refresh tokens expire
    registerClearUser(() => useAuthStore.setState({ user: undefined }));
  }, [hydrate, loadPreferences]);

  if (!isHydrated || (!fontsLoaded && !fontError)) {
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
