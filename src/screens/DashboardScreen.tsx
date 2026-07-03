import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { colors } from '../constants/colors';
import type { RootStackParamList } from '../navigation/types';
import { studyApi } from '../api/studyApi';
import { useFocusStore } from '../store/focusStore';
import { useAuthStore } from '../store/authStore';
import { usePreferencesStore } from '../store/preferencesStore';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function DashboardScreen() {
  const navigation = useNavigation<Navigation>();
  const queryClient = useQueryClient();
  
  const user = useAuthStore((state) => state.user);
  const setFocus = useFocusStore((state) => state.setFocus);
  const dailyGoalMinutes = usePreferencesStore((state) => state.dailyGoalMinutes);

  const [selectedTaskOverride, setSelectedTaskOverride] = useState<any | null>(null);
  const [showPickerModal, setShowPickerModal] = useState(false);

  // Queries
  const dashboard = useQuery({ queryKey: ['dashboard'], queryFn: studyApi.dashboard });
  const focusHistory = useQuery({ queryKey: ['focusHistory'], queryFn: studyApi.focusHistory });
  const allTopics = useQuery({ queryKey: ['allTopics'], queryFn: () => studyApi.topics() });

  const incompleteTopics = useMemo(() => {
    if (!allTopics.data) return [];
    return allTopics.data.filter((t) => !t.completed);
  }, [allTopics.data]);

  const [pickerSubjectFilter, setPickerSubjectFilter] = useState<string | null>(null);
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: studyApi.subjects });

  const filteredTopics = useMemo(() => {
    if (!pickerSubjectFilter) return incompleteTopics;
    return incompleteTopics.filter((t) => {
      const subId = t.subjectId && typeof t.subjectId === 'object'
        ? (t.subjectId as any)._id
        : t.subjectId;
      return subId === pickerSubjectFilter;
    });
  }, [incompleteTopics, pickerSubjectFilter]);

  const dashboardData = dashboard.data;

  const activeTask = useMemo(() => {
    if (selectedTaskOverride) {
      const stillIncomplete = incompleteTopics.some((t) => t._id === selectedTaskOverride.id);
      if (stillIncomplete) return selectedTaskOverride;
    }
    return dashboardData?.nextTask || null;
  }, [selectedTaskOverride, incompleteTopics, dashboardData?.nextTask]);

  const startFocus = useMutation({
    mutationFn: studyApi.startFocus,
    onSuccess: (session) => {
      if (activeTask) {
        setFocus(session, activeTask);
        navigation.navigate('Focus');
      }
    },
    onError: (error) => {
      console.error('Failed to start focus session:', error);
      Alert.alert(
        'Unable to Start Study Session',
        'Could not communicate with the server. Please verify the backend API server is running.'
      );
    }
  });

  function selectTopic(topic: any) {
    const subjectName = topic.subjectId && typeof topic.subjectId === 'object' ? topic.subjectId.name : undefined;
    const subjectId = topic.subjectId && typeof topic.subjectId === 'object' ? topic.subjectId._id : topic.subjectId;
    setSelectedTaskOverride({
      id: topic._id,
      title: topic.title,
      estimatedMinutes: topic.estimatedMinutes,
      subject: subjectName,
      subjectId: subjectId
    });
    setShowPickerModal(false);
  }

  // Calculate dynamic greeting
  const greeting = useMemo(() => {
    const hours = new Date().getHours();
    const name = user?.name ? `, ${user.name}` : '';
    if (hours >= 4 && hours < 12) return `Good morning${name}!`;
    if (hours >= 12 && hours < 17) return `Good afternoon${name}!`;
    if (hours >= 17 && hours < 22) return `Good evening${name}!`;
    return `Time to focus${name}!`;
  }, [user?.name]);

  // Calculate study time today
  const minutesToday = useMemo(() => {
    if (!focusHistory.data) return 0;
    const todayStr = new Date().toDateString();
    const completedToday = focusHistory.data.filter((session) => {
      if (!session.completed || !session.endTime) return false;
      return new Date(session.endTime).toDateString() === todayStr;
    });
    return Math.round(completedToday.reduce((sum, s) => sum + s.duration, 0) / 60);
  }, [focusHistory.data]);

  // Daily goal progress fraction
  const goalProgress = useMemo(() => {
    if (dailyGoalMinutes <= 0) return 0;
    return Math.min(1, minutesToday / dailyGoalMinutes);
  }, [minutesToday, dailyGoalMinutes]);

  // Calculate current week days studied
  const weeklyDays = useMemo(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    const monday = new Date(new Date(today).setDate(diff));

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    // Find all days where there is a completed focus session
    const completedDates = new Set(
      (focusHistory.data ?? [])
        .filter((session) => session.completed && session.endTime)
        .map((session) => new Date(session.endTime!).toDateString())
    );

    return days.map((dayName, idx) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + idx);
      const isCompleted = completedDates.has(date.toDateString());
      const isToday = date.toDateString() === new Date().toDateString();
      return {
        name: dayName,
        isCompleted,
        isToday,
      };
    });
  }, [focusHistory.data]);

  // Loader state indicator
  const isLoading = dashboard.isLoading || focusHistory.isLoading;

  return (
    <Screen>
      {/* ── Beautiful Heading Area ── */}
      <View style={styles.header}>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.subtitle}>Small start. Real progress.</Text>
      </View>

      {isLoading && !dashboardData ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : null}

      {dashboard.isError || focusHistory.isError ? (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
          <Text style={styles.errorTitle}>Connection Error</Text>
          <Text style={styles.errorMeta}>
            Unable to connect to the backend server. Please verify the server is running and is connected to the database.
          </Text>
          <Button
            title="Retry Connection"
            icon="refresh"
            variant="quiet"
            onPress={() => {
              queryClient.invalidateQueries();
            }}
          />
        </View>
      ) : null}

      {dashboardData ? (
        <>
          {/* ── Streak & Goal Grid ── */}
          <View style={styles.grid}>
            {/* Streak Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="flame" size={24} color="#EF4444" />
                <Text style={styles.cardTitle}>Streak</Text>
              </View>
              <Text style={styles.cardMetric}>{dashboardData.streak.currentStreak} Days</Text>
              <Text style={styles.cardMeta}>Best: {dashboardData.streak.longestStreak} days</Text>
            </View>

            {/* Daily Goal Progress Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="bar-chart-outline" size={22} color={colors.primary} />
                <Text style={styles.cardTitle}>Daily Goal</Text>
              </View>
              <Text style={styles.cardMetric}>
                {minutesToday}m / {dailyGoalMinutes >= 60 ? `${dailyGoalMinutes / 60}h` : `${dailyGoalMinutes}m`}
              </Text>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${goalProgress * 100}%` }]} />
              </View>
              <Text style={styles.cardMeta}>
                {Math.round(goalProgress * 100)}% completed today
              </Text>
            </View>
          </View>

          {/* ── Weekly Habits Tracker ── */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>This Week's Consistency</Text>
            <View style={styles.weeklyRow}>
              {weeklyDays.map((day, idx) => (
                <View key={idx} style={styles.weekDayColumn}>
                  <View
                    style={[
                      styles.weekDayCircle,
                      day.isCompleted ? styles.weekDayCompleted : undefined,
                      day.isToday ? styles.weekDayToday : undefined,
                    ]}
                  >
                    {day.isCompleted ? (
                      <Ionicons name="checkmark" size={16} color={colors.background} />
                    ) : (
                      <Text
                        style={[
                          styles.weekDayText,
                          day.isToday ? styles.weekDayTextToday : undefined,
                        ]}
                      >
                        {day.name[0]}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.weekDayLabel}>{day.name}</Text>
                </View>
              ))}
            </View>
          </View>

          {incompleteTopics.length === 0 && (
            <Pressable
              onPress={() => navigation.navigate('Main', { screen: 'Syllabus' } as any)}
              style={({ pressed }) => [
                styles.presetsBanner,
                pressed ? styles.pressed : undefined
              ]}
            >
              <Ionicons name="sparkles-outline" size={24} color="#8B5CF6" style={styles.presetsBannerIcon} />
              <View style={styles.presetsBannerTextCol}>
                <Text style={styles.presetsBannerTitle}>🤖 Feeling stuck?</Text>
                <Text style={styles.presetsBannerDesc}>Use Course Presets in the Syllabus tab to kickstart your plan instantly!</Text>
              </View>
              <Ionicons name="arrow-forward-outline" size={18} color="#8B5CF6" />
            </Pressable>
          )}

          {/* ── Next Task Immersive Card ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>Next Focus Session</Text>
              {incompleteTopics.length > 1 && (
                <Pressable
                  onPress={() => {
                    setPickerSubjectFilter(null);
                    setShowPickerModal(true);
                  }}
                  style={({ pressed }) => [styles.changeTopicLink, pressed ? styles.pressed : undefined]}
                >
                  <Ionicons name="swap-horizontal-outline" size={14} color={colors.primary} />
                  <Text style={styles.changeTopicLinkText}>Choose Topic</Text>
                </Pressable>
              )}
            </View>
            
            {activeTask ? (
              <View style={styles.nextTaskCard}>
                <View style={styles.nextTaskInfo}>
                  <View style={styles.nextTaskHeaderRow}>
                    <View style={styles.nextTaskTag}>
                      <Text style={styles.nextTaskTagText}>
                        {activeTask.subject || 'Syllabus Topic'}
                      </Text>
                    </View>
                    {incompleteTopics.length > 1 && (
                      <Pressable
                        onPress={() => {
                          setPickerSubjectFilter(null);
                          setShowPickerModal(true);
                        }}
                        style={styles.cardChangeBtn}
                      >
                        <Ionicons name="chevron-down-outline" size={18} color={colors.muted} />
                      </Pressable>
                    )}
                  </View>
                  <Text style={styles.nextTaskTitle}>{activeTask.title}</Text>
                  <View style={styles.nextTaskMetaRow}>
                    <Ionicons name="time-outline" size={16} color={colors.muted} />
                    <Text style={styles.nextTaskMetaText}>
                      {formatDuration(activeTask.estimatedMinutes)} estimated
                    </Text>
                  </View>
                </View>

                <Pressable
                  disabled={startFocus.isPending}
                  onPress={() => {
                    if (activeTask) {
                      startFocus.mutate(activeTask.id);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.playButton,
                    pressed ? styles.playButtonPressed : undefined,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Just start study session"
                >
                  {startFocus.isPending ? (
                    <ActivityIndicator color={colors.background} size="small" />
                  ) : (
                    <>
                      <Ionicons name="play" size={20} color={colors.background} />
                      <Text style={styles.playButtonText}>JUST START</Text>
                    </>
                  )}
                </Pressable>
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="book-outline" size={32} color={colors.muted} style={{ marginBottom: 6 }} />
                <Text style={styles.emptyText}>All tasks completed!</Text>
                <Text style={styles.emptyMeta}>Add topics in the Syllabus tab to plan more study goals.</Text>
                <View style={{ marginTop: 12, width: '100%' }}>
                  <Button
                    title="Go to Syllabus"
                    icon="arrow-forward-outline"
                    variant="quiet"
                    onPress={() => navigation.navigate('Main', { screen: 'Syllabus' } as any)}
                  />
                </View>
              </View>
            )}
          </View>

          {/* ── Topic Selector Modal ── */}
          <Modal
            visible={showPickerModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowPickerModal(false)}
          >
            <Pressable 
              style={styles.modalOverlay} 
              onPress={() => setShowPickerModal(false)}
            >
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Choose Focus Topic</Text>
                <Text style={styles.modalDesc}>Select which topic you want to study in your next focus session.</Text>

                {/* Horizontal Subject Filter Chips */}
                <View style={{ marginVertical: 12, height: 38 }}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
                  >
                    <Pressable
                      onPress={() => setPickerSubjectFilter(null)}
                      style={[
                        styles.pickerFilterChip,
                        pickerSubjectFilter === null ? styles.pickerFilterChipActive : undefined
                      ]}
                    >
                      <Text
                        style={[
                          styles.pickerFilterChipText,
                          pickerSubjectFilter === null ? styles.pickerFilterChipTextActive : undefined
                        ]}
                      >
                        All
                      </Text>
                    </Pressable>
                    {(subjects.data || []).map((sub) => {
                      const isSelected = pickerSubjectFilter === sub._id;
                      return (
                        <Pressable
                          key={sub._id}
                          onPress={() => setPickerSubjectFilter(sub._id)}
                          style={[
                            styles.pickerFilterChip,
                            isSelected ? styles.pickerFilterChipActive : undefined
                          ]}
                        >
                          <Text
                            style={[
                              styles.pickerFilterChipText,
                              isSelected ? styles.pickerFilterChipTextActive : undefined
                            ]}
                          >
                            {sub.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
                
                {filteredTopics.length === 0 ? (
                  <View style={{ height: 200, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 16 }}>
                    <Ionicons name="checkmark-done-circle-outline" size={36} color={colors.success} />
                    <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>All topics completed</Text>
                    <Text style={{ fontSize: 12, color: colors.muted, textAlign: 'center' }}>
                      There are no incomplete focus topics in this subject.
                    </Text>
                  </View>
                ) : (
                  <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                    {filteredTopics.map((topic) => {
                      const subjectName = topic.subjectId && typeof topic.subjectId === 'object' ? (topic.subjectId as any).name : 'General';
                      return (
                        <Pressable
                          key={topic._id}
                          onPress={() => selectTopic(topic)}
                          style={({ pressed }) => [
                            styles.modalItem,
                            activeTask?.id === topic._id ? styles.modalItemActive : undefined,
                            pressed ? styles.pressed : undefined
                          ]}
                        >
                          <View style={styles.modalItemLeft}>
                            <View style={styles.modalItemBadge}>
                              <Text style={styles.modalItemBadgeText}>{subjectName}</Text>
                            </View>
                            <Text style={styles.modalItemTitle}>{topic.title}</Text>
                          </View>
                          <Text style={styles.modalItemMeta}>{formatDuration(topic.estimatedMinutes)}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
                
                <Button
                  title="Cancel"
                  icon="close"
                  variant="danger-quiet"
                  onPress={() => setShowPickerModal(false)}
                />
              </View>
            </Pressable>
          </Modal>

          {/* ── Quick Action Shortcuts ── */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Quick Actions</Text>
            <View style={styles.shortcutRow}>
              <Pressable
                onPress={() => navigation.navigate('BrainDump')}
                style={({ pressed }) => [styles.shortcutBtn, pressed ? styles.pressed : undefined]}
              >
                <View style={[styles.shortcutIconBg, { backgroundColor: '#EEF2FF' }]}>
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                </View>
                <Text style={styles.shortcutLabel}>Brain Dump</Text>
              </Pressable>

              <Pressable
                onPress={() => navigation.navigate('Main', { screen: 'Planner' } as any)}
                style={({ pressed }) => [styles.shortcutBtn, pressed ? styles.pressed : undefined]}
              >
                <View style={[styles.shortcutIconBg, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="calendar-outline" size={20} color="#10B981" />
                </View>
                <Text style={styles.shortcutLabel}>Add Exam</Text>
              </Pressable>

              <Pressable
                onPress={() => navigation.navigate('Main', { screen: 'Syllabus' } as any)}
                style={({ pressed }) => [styles.shortcutBtn, pressed ? styles.pressed : undefined]}
              >
                <View style={[styles.shortcutIconBg, { backgroundColor: '#FFFBEB' }]}>
                  <Ionicons name="book-outline" size={20} color="#D97706" />
                </View>
                <Text style={styles.shortcutLabel}>Syllabus</Text>
              </Pressable>
            </View>
          </View>

          {/* ── Upcoming Exams (Calm Row items) ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>Upcoming Exams</Text>
              <Pressable onPress={() => navigation.navigate('Main', { screen: 'Planner' } as any)}>
                <Text style={styles.sectionActionText}>View Planner</Text>
              </Pressable>
            </View>
            
            {dashboardData.upcomingExams.length > 0 ? (
              <View style={styles.examsList}>
                {dashboardData.upcomingExams.map((exam) => (
                  <View key={exam.id} style={styles.examItem}>
                    <View style={styles.examBadge}>
                      <Ionicons name="calendar" size={16} color={colors.primary} />
                    </View>
                    <View style={styles.examText}>
                      <Text style={styles.examSubject}>{exam.subject}</Text>
                      <Text style={styles.examDate}>
                        {new Date(exam.examDate).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.daysLeftBadge,
                        exam.daysLeft <= 3 ? styles.daysLeftDanger : undefined,
                      ]}
                    >
                      <Text
                        style={[
                          styles.daysLeftText,
                          exam.daysLeft <= 3 ? styles.daysLeftTextDanger : undefined,
                        ]}
                      >
                        {exam.daysLeft === 0
                          ? 'Today'
                          : exam.daysLeft === 1
                          ? '1 day left'
                          : `${exam.daysLeft} days left`}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyCardMini}>
                <Text style={styles.emptyMeta}>No upcoming exams added yet.</Text>
              </View>
            )}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 8,
    gap: 4,
  },
  greeting: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '600',
  },
  loaderContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'space-between',
    minHeight: 115,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cardMetric: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    marginVertical: 4,
  },
  cardMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    marginVertical: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  section: {
    gap: 10,
    marginTop: 6,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeader: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  sectionActionText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  weeklyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  weekDayColumn: {
    alignItems: 'center',
    gap: 6,
  },
  weekDayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  weekDayCompleted: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  weekDayToday: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
  },
  weekDayTextToday: {
    color: colors.primary,
    fontWeight: '900',
  },
  weekDayLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
  },
  nextTaskCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 14,
    padding: 16,
    gap: 14,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  nextTaskInfo: {
    gap: 6,
  },
  nextTaskTag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  nextTaskTagText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  nextTaskTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
  },
  nextTaskMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  nextTaskMetaText: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: '600',
  },
  playButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    borderRadius: 10,
    gap: 8,
  },
  playButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  playButtonText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  shortcutRow: {
    flexDirection: 'row',
    gap: 10,
  },
  shortcutBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 8,
  },
  shortcutIconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
  },
  examsList: {
    gap: 8,
  },
  examItem: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  examBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  examText: {
    flex: 1,
    gap: 2,
  },
  examSubject: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  examDate: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  daysLeftBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  daysLeftDanger: {
    backgroundColor: colors.dangerLight,
  },
  daysLeftText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  daysLeftTextDanger: {
    color: colors.danger,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  emptyCardMini: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  emptyMeta: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
  errorCard: {
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.danger,
  },
  errorMeta: {
    fontSize: 13,
    color: colors.text,
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center'
  },
  modalContent: {
    width: '100%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
    maxHeight: '75%',
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text
  },
  modalDesc: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
    marginTop: -8
  },
  modalList: {
    marginVertical: 8
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: colors.background
  },
  modalItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight
  },
  modalItemLeft: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
    flex: 1
  },
  modalItemTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text
  },
  modalItemBadge: {
    backgroundColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  modalItemBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.muted,
    textTransform: 'uppercase'
  },
  modalItemMeta: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary
  },
  changeTopicLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  changeTopicLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary
  },
  nextTaskHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%'
  },
  cardChangeBtn: {
    padding: 2,
    marginRight: -4
  },
  presetsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#F5F3FF',
    borderWidth: 1.5,
    borderColor: '#C084FC',
    gap: 12,
    marginVertical: 4
  },
  presetsBannerIcon: {
    opacity: 0.95
  },
  presetsBannerTextCol: {
    flex: 1,
    gap: 2
  },
  presetsBannerTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#8B5CF6'
  },
  presetsBannerDesc: {
    fontSize: 12,
    color: '#7C3AED',
    fontWeight: '600',
    lineHeight: 16
  },
  pickerFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border
  },
  pickerFilterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  pickerFilterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text
  },
  pickerFilterChipTextActive: {
    color: colors.background,
    fontWeight: '800'
  }
});

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hrs = minutes / 60;
  if (Number.isInteger(hrs)) return `${hrs} hr`;
  return `${hrs.toFixed(1).replace(/\.0$/, '')} hr`;
}
