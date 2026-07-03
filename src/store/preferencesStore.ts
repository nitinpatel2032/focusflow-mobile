import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

type PreferencesState = {
  dailyGoalMinutes: number;
  weeklyGoalMinutes: number;
  weeklyGoalTopics: number;
  weeklyGoalUnit: 'min' | 'hr';
  dailyReminderEnabled: boolean;
  dailyReminderHour: number;
  dailyReminderMinute: number;
  isLoaded: boolean;
  loadPreferences: () => Promise<void>;
  setDailyGoalMinutes: (minutes: number) => Promise<void>;
  setWeeklyGoalMinutes: (minutes: number) => Promise<void>;
  setWeeklyGoalTopics: (count: number) => Promise<void>;
  setWeeklyGoalUnit: (unit: 'min' | 'hr') => Promise<void>;
  setDailyReminder: (enabled: boolean, hour: number, minute: number) => Promise<void>;
};

export const usePreferencesStore = create<PreferencesState>((set) => ({
  dailyGoalMinutes: 60,
  weeklyGoalMinutes: 120,
  weeklyGoalTopics: 5,
  weeklyGoalUnit: 'min',
  dailyReminderEnabled: false,
  dailyReminderHour: 9,
  dailyReminderMinute: 0,
  isLoaded: false,
  loadPreferences: async () => {
    try {
      const [
        savedGoal,
        savedWeeklyMinutes,
        savedWeeklyTopics,
        savedWeeklyUnit,
        savedReminderEnabled,
        savedReminderHour,
        savedReminderMinute
      ] = await Promise.all([
        AsyncStorage.getItem('dailyGoalMinutes'),
        AsyncStorage.getItem('weeklyGoalMinutes'),
        AsyncStorage.getItem('weeklyGoalTopics'),
        AsyncStorage.getItem('weeklyGoalUnit'),
        AsyncStorage.getItem('dailyReminderEnabled'),
        AsyncStorage.getItem('dailyReminderHour'),
        AsyncStorage.getItem('dailyReminderMinute')
      ]);

      set({
        dailyGoalMinutes: savedGoal ? parseInt(savedGoal, 10) : 60,
        weeklyGoalMinutes: savedWeeklyMinutes ? parseInt(savedWeeklyMinutes, 10) : 120,
        weeklyGoalTopics: savedWeeklyTopics ? parseInt(savedWeeklyTopics, 10) : 5,
        weeklyGoalUnit: (savedWeeklyUnit as 'min' | 'hr') || 'min',
        dailyReminderEnabled: savedReminderEnabled === 'true',
        dailyReminderHour: savedReminderHour ? parseInt(savedReminderHour, 10) : 9,
        dailyReminderMinute: savedReminderMinute ? parseInt(savedReminderMinute, 10) : 0,
        isLoaded: true
      });
    } catch {
      set({ isLoaded: true });
    }
  },
  setDailyGoalMinutes: async (minutes: number) => {
    try {
      await AsyncStorage.setItem('dailyGoalMinutes', String(minutes));
      set({ dailyGoalMinutes: minutes });
    } catch (e) {
      console.warn('Failed to save daily study goal', e);
    }
  },
  setWeeklyGoalMinutes: async (minutes: number) => {
    try {
      await AsyncStorage.setItem('weeklyGoalMinutes', String(minutes));
      set({ weeklyGoalMinutes: minutes });
    } catch (e) {
      console.warn('Failed to save weekly focus minutes goal', e);
    }
  },
  setWeeklyGoalTopics: async (count: number) => {
    try {
      await AsyncStorage.setItem('weeklyGoalTopics', String(count));
      set({ weeklyGoalTopics: count });
    } catch (e) {
      console.warn('Failed to save weekly topics goal', e);
    }
  },
  setWeeklyGoalUnit: async (unit: 'min' | 'hr') => {
    try {
      await AsyncStorage.setItem('weeklyGoalUnit', unit);
      set({ weeklyGoalUnit: unit });
    } catch (e) {
      console.warn('Failed to save weekly goal unit preference', e);
    }
  },
  setDailyReminder: async (enabled: boolean, hour: number, minute: number) => {
    try {
      await Promise.all([
        AsyncStorage.setItem('dailyReminderEnabled', String(enabled)),
        AsyncStorage.setItem('dailyReminderHour', String(hour)),
        AsyncStorage.setItem('dailyReminderMinute', String(minute))
      ]);
      set({ dailyReminderEnabled: enabled, dailyReminderHour: hour, dailyReminderMinute: minute });
    } catch (e) {
      console.warn('Failed to save daily study reminder preferences', e);
    }
  }
}));
