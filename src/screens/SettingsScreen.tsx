import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, StyleSheet, Text, View, Pressable, Modal, ScrollView, TextInput, ActivityIndicator, Switch } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { studyApi } from '../api/studyApi';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { colors } from '../constants/colors';
import { scheduleDailyReminder, cancelDailyReminder } from '../services/notifications';
import { useAuthStore } from '../store/authStore';
import { usePreferencesStore } from '../store/preferencesStore';
import { PRESET_COURSES } from '../constants/presets';
import type { FocusSession, Topic } from '../types/models';

export function SettingsScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const queryClient = useQueryClient();
  
  function handleSyncData() {
    queryClient.invalidateQueries();
    Alert.alert('App Synced', 'Application data has been successfully refreshed.');
  }

  const clearData = useMutation({
    mutationFn: studyApi.clearData,
    onSuccess: () => {
      queryClient.invalidateQueries();
      Alert.alert('Data Cleared', 'All your study data has been successfully deleted.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to clear data. Please try again.');
    }
  });

  function handleClearData() {
    Alert.alert(
      'Clear all data?',
      'This will permanently delete all your subjects, topics, focus sessions, exams, and brain dump notes. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Everything',
          style: 'destructive',
          onPress: () => clearData.mutate()
        }
      ]
    );
  }
  
  const dailyGoalMinutes = usePreferencesStore((state) => state.dailyGoalMinutes);
  const setDailyGoalMinutes = usePreferencesStore((state) => state.setDailyGoalMinutes);
  const dailyReminderEnabled = usePreferencesStore((state) => state.dailyReminderEnabled);
  const dailyReminderHour = usePreferencesStore((state) => state.dailyReminderHour);
  const dailyReminderMinute = usePreferencesStore((state) => state.dailyReminderMinute);
  const setDailyReminder = usePreferencesStore((state) => state.setDailyReminder);

  const [showTimePicker, setShowTimePicker] = useState(false);

  // Custom goal input state
  const [customGoalUnit, setCustomGoalUnit] = useState<'min' | 'hr'>('hr');
  const [customGoalValue, setCustomGoalValue] = useState('');

  const history = useQuery({ queryKey: ['focusHistory'], queryFn: studyApi.focusHistory });
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: studyApi.subjects });

  // Course selection state
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [selectedCourses, setSelectedCourses] = useState<string[]>(user?.seekingCourses || []);
  const [modalTab, setModalTab] = useState<'presets' | 'search'>('presets');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchedCoursesCache, setSearchedCoursesCache] = useState<Record<string, any>>({});

  const handleSearchCourses = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const res = await studyApi.searchCourses(searchQuery);
      setSearchResults(res.courses || []);
      const newCache = { ...searchedCoursesCache };
      (res.courses || []).forEach((c: any) => {
        newCache[c.id] = c;
      });
      setSearchedCoursesCache(newCache);
    } catch (err: any) {
      Alert.alert('Search failed', err.message || 'Failed to search courses.');
    } finally {
      setSearchLoading(false);
    }
  };

  function openEditCourses() {
    setSelectedCourses(user?.seekingCourses || []);
    setModalTab('presets');
    setSearchQuery('');
    setSearchResults([]);
    setShowCourseModal(true);
  }

  const updateProfileMutation = useMutation({
    mutationFn: (payload: { seekingCourses: string[] }) => useAuthStore.getState().updateProfile(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowCourseModal(false);
      Alert.alert('Profile Saved', 'Your course selections and syllabus have been updated.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to update profile.');
    }
  });

  async function handleSaveCourses() {
    const oldCourses = user?.seekingCourses || [];
    const newCourses = selectedCourses;

    const added = newCourses.filter(c => !oldCourses.includes(c));
    const removed = oldCourses.filter(c => !newCourses.includes(c));

    try {
      // 1. Process added courses: import subjects & topics
      for (const courseId of added) {
        let course = PRESET_COURSES.find(c => c.id === courseId);
        if (!course && searchedCoursesCache[courseId]) {
          course = searchedCoursesCache[courseId];
        }
        if (course) {
          for (const sub of course.subjects) {
            const existingSubjects = subjects.data || [];
            const alreadyExists = existingSubjects.some(s => s.name.toLowerCase() === sub.name.toLowerCase());
            
            if (!alreadyExists) {
              const res = await studyApi.createSubject(sub.name);
              for (const t of sub.topics) {
                await studyApi.createTopic({
                  subjectId: res._id,
                  title: t.title,
                  estimatedMinutes: t.estimatedMinutes
                });
              }
            }
          }
        }
      }

      // 2. Process removed courses: delete their subjects from database
      for (const courseId of removed) {
        let course = PRESET_COURSES.find(c => c.id === courseId);
        if (!course && searchedCoursesCache[courseId]) {
          course = searchedCoursesCache[courseId];
        }
        if (course) {
          const existingSubjects = subjects.data || [];
          for (const sub of course.subjects) {
            const match = existingSubjects.find(s => s.name.toLowerCase() === sub.name.toLowerCase());
            if (match) {
              await studyApi.deleteSubject(match._id);
            }
          }
        }
      }

      // 3. Update the user profile on the backend
      updateProfileMutation.mutate({ seekingCourses: newCourses });
    } catch (err: any) {
      Alert.alert('Error updating subjects', err.message || 'Failed to update database subjects.');
    }
  }

  const completedSessions = history.data?.filter((session) => session.completed) ?? [];



  // Goal presets (30m, 45m, 1h, 1.5h, 2h, 3h)
  const goalPresets = [60, 120, 180, 240]; // 1h, 2h, 3h, 4h

  return (
    <Screen>
      {/* ── Settings header row with inline logout ── */}
      <View style={styles.settingsHeaderRow}>
        <View>
          <Text style={styles.settingsHeaderTitle}>Settings</Text>
          {user?.email ? <Text style={styles.settingsHeaderSubtitle}>{user.email}</Text> : null}
        </View>
        <Pressable
          onPress={logout}
          style={({ pressed }) => [styles.logoutIconBtn, pressed ? styles.pressed : undefined]}
          accessibilityLabel="Logout"
        >
          <Ionicons name="log-out-outline" size={22} color={colors.danger} />
        </Pressable>
      </View>

      {/* ── User Profile Panel ── */}
      <View style={styles.panel}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>
          <View style={styles.profileText}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.meta}>Longest streak: {user?.longestStreak ?? 0} days</Text>
          </View>
        </View>

        <View style={styles.profileDivider} />

        <View style={styles.profileCoursesSection}>
          <View style={styles.profileCoursesHeader}>
            <Text style={styles.profileCoursesTitle}>Seeking Courses</Text>
            <Pressable onPress={openEditCourses} style={styles.profileEditBtn}>
              <Ionicons name="create-outline" size={16} color={colors.primary} />
              <Text style={styles.profileEditBtnText}>Edit</Text>
            </Pressable>
          </View>

          {user?.seekingCourses && user.seekingCourses.length > 0 ? (
            <View style={styles.coursesGrid}>
              {user.seekingCourses.map((courseId) => {
                const course = PRESET_COURSES.find(c => c.id === courseId);
                return (
                  <View key={courseId} style={styles.courseCapsule}>
                    <Ionicons name={course?.icon as any || 'book-outline'} size={14} color={colors.primary} />
                    <Text style={styles.courseCapsuleText}>{course?.name || courseId}</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyCoursesText}>No courses selected. Tap edit to select your courses.</Text>
          )}
        </View>
      </View>

      {/* ── Course Selections Modal ── */}
      <Modal
        visible={showCourseModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCourseModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setShowCourseModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Seeking Courses</Text>
            <Text style={styles.modalDesc}>Select the courses you are studying. We will set up your syllabus accordingly.</Text>

            {/* Tab bar inside Course Selections Modal */}
            <View style={styles.modalTabs}>
              <Pressable
                onPress={() => setModalTab('presets')}
                style={[styles.modalTab, modalTab === 'presets' ? styles.modalTabActive : undefined]}
              >
                <Text style={[styles.modalTabText, modalTab === 'presets' ? styles.modalTabTextActive : undefined]}>
                  Presets Library
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setModalTab('search')}
                style={[styles.modalTab, modalTab === 'search' ? styles.modalTabActive : undefined]}
              >
                <Text style={[styles.modalTabText, modalTab === 'search' ? styles.modalTabTextActive : undefined]}>
                  Search Online
                </Text>
              </Pressable>
            </View>

            {modalTab === 'presets' ? (
              <ScrollView style={{ height: 330, marginBottom: 16 }} showsVerticalScrollIndicator={false}>
                {PRESET_COURSES.map((course) => {
                  const isChecked = selectedCourses.includes(course.id);
                  return (
                    <Pressable
                      key={course.id}
                      onPress={() => {
                        if (isChecked) {
                          setSelectedCourses(selectedCourses.filter((c) => c !== course.id));
                        } else {
                          setSelectedCourses([...selectedCourses, course.id]);
                        }
                      }}
                      style={styles.checklistRow}
                    >
                      <Ionicons
                        name={isChecked ? 'checkmark-circle' : 'ellipse-outline'}
                        color={isChecked ? colors.primary : colors.muted}
                        size={22}
                      />
                      <Ionicons 
                        name={course.icon as any} 
                        size={18} 
                        color={isChecked ? colors.primary : colors.muted} 
                        style={{ marginHorizontal: 8 }} 
                      />
                      <View style={styles.grow}>
                        <Text style={styles.checklistRowText}>{course.name}</Text>
                        <Text style={styles.checklistRowSub}>{course.subjects.length} subjects</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={{ height: 330, marginBottom: 16 }}>
                {/* Search Bar */}
                <View style={styles.modalSearchRow}>
                  <TextInput
                    style={styles.modalSearchInput}
                    placeholder="Search courses (e.g. Machine Learning, Physics)..."
                    placeholderTextColor={colors.muted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={handleSearchCourses}
                  />
                  <Pressable
                    onPress={handleSearchCourses}
                    disabled={searchLoading}
                    style={styles.modalSearchBtn}
                  >
                    {searchLoading ? (
                      <ActivityIndicator size="small" color={colors.background} />
                    ) : (
                      <Ionicons name="search" size={18} color={colors.background} />
                    )}
                  </Pressable>
                </View>

                {searchLoading ? (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Searching courses...</Text>
                  </View>
                ) : searchResults.length === 0 ? (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 24 }}>
                    <Ionicons name="search-outline" size={36} color={colors.muted} style={{ marginBottom: 4 }} />
                    <Text style={styles.emptyText}>Search for any course</Text>
                    <Text style={styles.emptySubtext}>Type a query above to search for real courses, subjects, and topics.</Text>
                  </View>
                ) : (
                  <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                    {searchResults.map((course) => {
                      const isChecked = selectedCourses.includes(course.id);
                      return (
                        <Pressable
                          key={course.id}
                          onPress={() => {
                            if (isChecked) {
                              setSelectedCourses(selectedCourses.filter((c) => c !== course.id));
                            } else {
                              setSelectedCourses([...selectedCourses, course.id]);
                            }
                          }}
                          style={styles.checklistRow}
                        >
                          <Ionicons
                            name={isChecked ? 'checkmark-circle' : 'ellipse-outline'}
                            color={isChecked ? colors.primary : colors.muted}
                            size={22}
                          />
                          <Ionicons 
                            name={course.icon as any || 'book-outline'} 
                            size={18} 
                            color={isChecked ? colors.primary : colors.muted} 
                            style={{ marginHorizontal: 8 }} 
                          />
                          <View style={styles.grow}>
                            <Text style={styles.checklistRowText}>{course.name}</Text>
                            <Text style={styles.checklistRowSub}>{course.subjects.length} subjects</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            )}

            <View style={styles.modalActions}>
              <Button
                title={updateProfileMutation.isPending ? 'Saving...' : 'Save Selections'}
                icon="checkmark"
                disabled={updateProfileMutation.isPending}
                onPress={handleSaveCourses}
              />
              <Button
                title="Cancel"
                icon="close"
                variant="danger-quiet"
                onPress={() => setShowCourseModal(false)}
              />
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ── Daily Goal Preferences ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Daily Study Target</Text>
        <Text style={styles.sectionDesc}>
          Current target: {dailyGoalMinutes >= 60
            ? `${dailyGoalMinutes / 60}h (${dailyGoalMinutes} min)`
            : `${dailyGoalMinutes} min`}
        </Text>

        {/* Quick hour presets */}
        <View style={styles.goalRow}>
          {goalPresets.map((goal) => {
            const isSelected = dailyGoalMinutes === goal;
            return (
              <Pressable
                key={goal}
                onPress={() => setDailyGoalMinutes(goal)}
                style={[
                  styles.goalPresetBtn,
                  isSelected ? styles.goalPresetBtnSelected : undefined
                ]}
              >
                <Text
                  style={[
                    styles.goalPresetText,
                    isSelected ? styles.goalPresetTextSelected : undefined
                  ]}
                >
                  {goal / 60}h
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Custom input */}
        <View style={styles.customGoalRow}>
          <TextInput
            style={styles.customGoalInput}
            value={customGoalValue}
            onChangeText={setCustomGoalValue}
            keyboardType="decimal-pad"
            placeholder={customGoalUnit === 'hr' ? 'e.g. 1.5' : 'e.g. 90'}
            placeholderTextColor={colors.muted}
            returnKeyType="done"
            onSubmitEditing={() => {
              const parsed = parseFloat(customGoalValue);
              if (!isNaN(parsed) && parsed > 0) {
                const minutes = customGoalUnit === 'hr'
                  ? Math.round(parsed * 60)
                  : Math.round(parsed);
                setDailyGoalMinutes(minutes);
                setCustomGoalValue('');
              }
            }}
          />
          {/* Unit toggle */}
          <View style={styles.customGoalUnitToggle}>
            <Pressable
              onPress={() => setCustomGoalUnit('min')}
              style={[styles.unitTab, customGoalUnit === 'min' ? styles.unitTabActive : undefined]}
            >
              <Text style={[styles.unitTabText, customGoalUnit === 'min' ? styles.unitTabTextActive : undefined]}>min</Text>
            </Pressable>
            <Pressable
              onPress={() => setCustomGoalUnit('hr')}
              style={[styles.unitTab, customGoalUnit === 'hr' ? styles.unitTabActive : undefined]}
            >
              <Text style={[styles.unitTabText, customGoalUnit === 'hr' ? styles.unitTabTextActive : undefined]}>hr</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => {
              const parsed = parseFloat(customGoalValue);
              if (!isNaN(parsed) && parsed > 0) {
                const minutes = customGoalUnit === 'hr'
                  ? Math.round(parsed * 60)
                  : Math.round(parsed);
                setDailyGoalMinutes(minutes);
                setCustomGoalValue('');
              }
            }}
            style={({ pressed }) => [styles.customGoalSetBtn, pressed ? styles.pressed : undefined]}
          >
            <Text style={styles.customGoalSetBtnText}>Set</Text>
          </Pressable>
        </View>
      </View>





      {/* ── Daily Study Reminder ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.actionCard}>
          <View style={styles.settingsOptionRow}>
            <View style={styles.settingsOptionLabel}>
              <Ionicons name="notifications-outline" size={20} color={colors.primary} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.settingsOptionTitle}>Daily Study Reminder</Text>
                <Text style={styles.settingsOptionSubtitle}>Reminds you to study and protect streaks</Text>
              </View>
            </View>
            <Switch
              value={dailyReminderEnabled}
              onValueChange={async (value) => {
                if (value) {
                  await setDailyReminder(true, dailyReminderHour, dailyReminderMinute);
                  await scheduleDailyReminder(dailyReminderHour, dailyReminderMinute);
                } else {
                  await setDailyReminder(false, dailyReminderHour, dailyReminderMinute);
                  await cancelDailyReminder();
                }
              }}
              trackColor={{ true: colors.primary }}
            />
          </View>

          {dailyReminderEnabled && (
            <Pressable
              onPress={() => setShowTimePicker(true)}
              style={styles.timePickerTrigger}
            >
              <Text style={styles.timePickerLabel}>Reminder Time</Text>
              <View style={styles.timeValueBox}>
                <Ionicons name="time-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.timePickerValue}>
                  {formatTime(dailyReminderHour, dailyReminderMinute)}
                </Text>
              </View>
            </Pressable>
          )}

          {showTimePicker && (
            <DateTimePicker
              value={new Date(new Date().setHours(dailyReminderHour, dailyReminderMinute))}
              mode="time"
              is24Hour={false}
              display="default"
              onChange={async (event, date) => {
                setShowTimePicker(false);
                if (date) {
                  const hr = date.getHours();
                  const min = date.getMinutes();
                  await setDailyReminder(true, hr, min);
                  await scheduleDailyReminder(hr, min);
                }
              }}
            />
          )}
        </View>
      </View>

      {/* ── App Settings ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Settings</Text>
        <View style={styles.actionCard}>
          <Button title="Sync App Data" icon="refresh-outline" variant="quiet" onPress={handleSyncData} />
        </View>
      </View>

      {/* ── Danger Zone ── */}
      <View style={[styles.section, { marginBottom: 32 }]}>
        <Text style={styles.sectionTitle}>Danger Zone</Text>
        <Text style={styles.sectionDesc}>This action is permanent and cannot be undone. Proceed with caution.</Text>
        <View style={styles.actionCard}>
          <Pressable
            onPress={handleClearData}
            disabled={clearData.isPending}
            style={({ pressed }) => [
              styles.clearDataBtn,
              pressed ? styles.pressed : undefined,
              clearData.isPending ? styles.disabled : undefined
            ]}
          >
            <Ionicons name="trash-bin-outline" size={20} color={colors.danger} />
            <Text style={styles.clearDataBtnText}>Clear All Data</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

function HistoryRow({ session }: { session: FocusSession }) {
  const title = topicTitle(session.topicId);
  const minutes = Math.max(1, Math.round(session.duration / 60));
  const date = new Date(session.endTime ?? session.startTime).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });

  return (
    <View style={styles.historyRow}>
      <View style={styles.historyText}>
        <Text style={styles.historyTitle}>{title}</Text>
        <Text style={styles.meta}>{date}</Text>
      </View>
      <Text style={styles.duration}>+{minutes} min</Text>
    </View>
  );
}

function topicTitle(topic: string | Topic | null | undefined) {
  if (!topic) return 'Deleted topic';
  return typeof topic === 'string' ? 'Study session' : topic.title;
}

function formatTime(hour: number, minute: number) {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  const displayMinute = minute < 10 ? `0${minute}` : minute;
  return `${displayHour}:${displayMinute} ${ampm}`;
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    backgroundColor: colors.surface
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    color: colors.background,
    fontSize: 20,
    fontWeight: '900'
  },
  profileText: {
    gap: 2
  },
  name: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900'
  },
  meta: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 13
  },
  section: {
    gap: 10
  },
  settingsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  settingsHeaderTitle: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900'
  },
  settingsHeaderSubtitle: {
    color: colors.muted,
    fontSize: 15,
    marginTop: 2
  },
  logoutIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center'
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900'
  },
  sectionDesc: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: -4
  },
  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: colors.surface,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border
  },
  goalPresetBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.surface
  },
  goalPresetBtnSelected: {
    backgroundColor: colors.primary
  },
  goalPresetText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14
  },
  goalPresetTextSelected: {
    color: colors.background,
    fontWeight: '800'
  },
  customGoalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 8
  },
  customGoalInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    backgroundColor: colors.background
  },
  customGoalUnitToggle: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2
  },
  unitTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6
  },
  unitTabActive: {
    backgroundColor: colors.background,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1
  },
  unitTabText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.muted
  },
  unitTabTextActive: {
    color: colors.primary
  },
  customGoalSetBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  customGoalSetBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.background
  },
  insightsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 12
  },
  insightItem: {
    gap: 6
  },
  insightHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  insightSubjectName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800'
  },
  insightSubjectValue: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800'
  },
  insightBarBg: {
    height: 6,
    backgroundColor: colors.background,
    borderRadius: 3,
    overflow: 'hidden'
  },
  insightBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12
  },
  statBox: {
    flex: 1,
    minHeight: 88,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface
  },
  statValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900'
  },
  statLabel: {
    color: colors.muted,
    fontWeight: '800',
    fontSize: 12,
    marginTop: 2
  },
  list: {
    gap: 8
  },
  historyRow: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: colors.surface
  },
  historyText: {
    flex: 1,
    gap: 2
  },
  historyTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800'
  },
  duration: {
    color: colors.primary,
    fontWeight: '900',
    fontSize: 14
  },
  empty: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 8
  },
  actionCard: {
    gap: 10
  },
  clearDataBtn: {
    minHeight: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  clearDataBtnText: {
    color: colors.danger,
    fontWeight: '800',
    fontSize: 16
  },
  pressed: {
    opacity: 0.75
  },
  disabled: {
    opacity: 0.45
  },
  profileDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 14
  },
  profileCoursesSection: {
    gap: 10
  },
  profileCoursesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  profileCoursesTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800'
  },
  profileEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  profileEditBtnText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 14
  },
  coursesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  courseCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E0E7FF'
  },
  courseCapsuleText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700'
  },
  emptyCoursesText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 6
  },
  modalDesc: {
    fontSize: 14,
    color: colors.muted,
    fontWeight: '600',
    marginBottom: 20
  },
  subjectsChecklist: {
    maxHeight: 300,
    marginBottom: 20
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 4
  },
  grow: {
    flex: 1,
    gap: 2
  },
  checklistRowText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text
  },
  checklistRowSub: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '600'
  },
  modalActions: {
    gap: 10
  },
  modalTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 16
  },
  modalTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent'
  },
  modalTabActive: {
    borderBottomColor: colors.primary
  },
  modalTabText: {
    fontSize: 14,
    color: colors.muted,
    fontWeight: '700'
  },
  modalTabTextActive: {
    color: colors.primary,
    fontWeight: '800'
  },
  modalSearchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    alignItems: 'center'
  },
  modalSearchInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.background,
    fontWeight: '600'
  },
  modalSearchBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  centerLoading: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  loadingText: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 14
  },
  emptyContainer: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 24
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center'
  },
  emptySubtext: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 16
  },
  settingsOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  settingsOptionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12
  },
  settingsOptionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text
  },
  settingsOptionSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    marginTop: 2
  },
  timePickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  timePickerLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text
  },
  timeValueBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  timePickerValue: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.primary
  }
});
