import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { colors } from '../constants/colors';
import { BrainDumpScreen } from '../screens/BrainDumpScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { FocusScreen } from '../screens/FocusScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { PlannerScreen } from '../screens/PlannerScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SyllabusScreen } from '../screens/SyllabusScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { useAuthStore } from '../store/authStore';
import type { AuthStackParamList, MainTabParamList, RootStackParamList } from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { borderTopColor: colors.border },
        tabBarIcon: ({ focused, size }) => {
          let name: keyof typeof Ionicons.glyphMap;
          let color: string;

          if (route.name === 'Dashboard') {
            name = focused ? 'home' : 'home-outline';
            color = focused ? '#4F46E5' : colors.muted;
          } else if (route.name === 'Syllabus') {
            name = focused ? 'checkbox' : 'checkbox-outline';
            color = focused ? '#10B981' : colors.muted;
          } else if (route.name === 'Planner') {
            name = focused ? 'calendar' : 'calendar-outline';
            color = focused ? '#F59E0B' : colors.muted;
          } else if (route.name === 'Stats') {
            name = focused ? 'analytics' : 'analytics-outline';
            color = focused ? '#EC4899' : colors.muted;
          } else {
            name = focused ? 'person' : 'person-outline';
            color = focused ? '#8B5CF6' : colors.muted;
          }
          return <Ionicons name={name} color={color} size={size} />;
        },
        tabBarLabel: ({ focused, children }) => {
          let color: string;
          if (route.name === 'Dashboard') {
            color = focused ? '#4F46E5' : colors.muted;
          } else if (route.name === 'Syllabus') {
            color = focused ? '#10B981' : colors.muted;
          } else if (route.name === 'Planner') {
            color = focused ? '#F59E0B' : colors.muted;
          } else if (route.name === 'Stats') {
            color = focused ? '#EC4899' : colors.muted;
          } else {
            color = focused ? '#8B5CF6' : colors.muted;
          }
          return <Text style={{ color, fontSize: 10, fontWeight: '800' }}>{children}</Text>;
        }
      })}
    >
      <Tabs.Screen name="Dashboard" component={DashboardScreen} />
      <Tabs.Screen name="Syllabus" component={SyllabusScreen} />
      <Tabs.Screen name="Planner" component={PlannerScreen} />
      <Tabs.Screen name="Stats" component={StatsScreen} />
      <Tabs.Screen name="Settings" component={SettingsScreen} />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const user = useAuthStore((state) => state.user);

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          <RootStack.Screen name="Main" component={MainTabs} />
          <RootStack.Screen name="Focus" component={FocusScreen} />
          <RootStack.Screen name="BrainDump" component={BrainDumpScreen} options={{ presentation: 'modal' }} />
        </>
      ) : (
        <RootStack.Screen name="Auth" component={AuthNavigator} />
      )}
    </RootStack.Navigator>
  );
}
