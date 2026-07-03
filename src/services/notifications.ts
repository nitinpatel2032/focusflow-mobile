import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function scheduleStartReminder() {
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) {
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Just 5 minutes',
      body: 'Start now and protect your study streak.'
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 60 * 60 * 6
    }
  });
}

export async function schedulePomodoroNotification(minutes: number) {
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) {
    return null;
  }

  // Cancel any existing pomodoro notifications first
  await cancelPomodoroNotification();

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: "🍅 Focus Block Complete!",
      body: "Great work! Your Pomodoro focus interval has ended. Time to rest!",
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: minutes * 60,
    },
  });
  return identifier;
}

export async function cancelPomodoroNotification() {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.content.title?.includes("Focus Block Complete")) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch (err) {
    console.warn("Failed to cancel pomodoro notifications", err);
  }
}

export async function scheduleDailyReminder(hour: number, minute: number) {
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) {
    return null;
  }

  // Cancel existing study reminders
  await cancelDailyReminder();

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: "📅 Time to Study!",
      body: "Consistency is key. Open the app to complete a topic and protect your streak!",
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    } as any,
  });
  return identifier;
}

export async function cancelDailyReminder() {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.content.title?.includes("Time to Study")) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch (err) {
    console.warn("Failed to cancel daily reminders", err);
  }
}
