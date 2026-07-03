import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { studyApi } from '../api/studyApi';
import { Button } from '../components/Button';
import { colors } from '../constants/colors';
import type { RootStackParamList } from '../navigation/types';
import { useFocusStore } from '../store/focusStore';
import { schedulePomodoroNotification, cancelPomodoroNotification } from '../services/notifications';

type Props = NativeStackScreenProps<RootStackParamList, 'Focus'>;

const MOTIVATIONAL_QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "It always seems impossible until it is done.", author: "Nelson Mandela" },
  { text: "Focus is a matter of deciding what things you are not going to do.", author: "John Carmack" },
  { text: "One hour of study today is one less hour of worry tomorrow.", author: "Anonymous" },
  { text: "Do not watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "Deep work is not a style preference. It is a superpower.", author: "Cal Newport" }
];

export function FocusScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const session = useFocusStore((state) => state.session);
  const task = useFocusStore((state) => state.task);
  const updateSession = useFocusStore((state) => state.updateSession);
  const clearFocus = useFocusStore((state) => state.clearFocus);
  const setFocus = useFocusStore((state) => state.setFocus);
  const [now, setNow] = useState(() => Date.now());
  const [showDrawer, setShowDrawer] = useState(false);

  const subjectsQuery = useQuery({
    queryKey: ['subjects'],
    queryFn: studyApi.subjects
  });

  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  // Auto-select first subject if none selected
  useEffect(() => {
    if (subjectsQuery.data && subjectsQuery.data.length > 0 && !selectedSubjectId) {
      const firstSub = subjectsQuery.data[0];
      if (firstSub) {
        setSelectedSubjectId(firstSub._id);
      }
    }
  }, [subjectsQuery.data, selectedSubjectId]);

  const topicsQuery = useQuery({
    queryKey: ['topics', selectedSubjectId],
    queryFn: () => studyApi.topics(selectedSubjectId || undefined),
    enabled: !!selectedSubjectId
  });

  const incompleteTopics = useMemo(() => {
    if (!topicsQuery.data) return [];
    return topicsQuery.data.filter((t) => !t.completed);
  }, [topicsQuery.data]);

  const selectSubject = (id: string) => {
    setSelectedSubjectId(id);
    setSelectedTopicId(null);
  };

  const startFocusMutation = useMutation({
    mutationFn: studyApi.startFocus,
    onSuccess: (newSession) => {
      const topicObj = topicsQuery.data?.find((t) => t._id === selectedTopicId);
      if (topicObj) {
        const subName = topicObj.subjectId && typeof topicObj.subjectId === 'object'
          ? topicObj.subjectId.name
          : (subjectsQuery.data?.find(s => s._id === selectedSubjectId)?.name || 'Subject');
        
        const subId = topicObj.subjectId && typeof topicObj.subjectId === 'object'
          ? topicObj.subjectId._id
          : (typeof topicObj.subjectId === 'string' ? topicObj.subjectId : selectedSubjectId || undefined);
        
        const taskPayload = {
          id: topicObj._id,
          title: topicObj.title,
          estimatedMinutes: topicObj.estimatedMinutes,
          subject: subName,
          subjectId: subId || undefined
        };
        
        setFocus(newSession, taskPayload);
        const minutes = Math.min(25, topicObj.estimatedMinutes || 25);
        schedulePomodoroNotification(minutes);
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['topics'] });
      }
    },
    onError: (err: any) => {
      Alert.alert('Error starting session', err.message || 'Failed to start focus session.');
    }
  });

  const notesQuery = useQuery({
    queryKey: ['brainDump'],
    queryFn: studyApi.brainDump,
    enabled: !!session
  });

  const sessionNotes = useMemo(() => {
    if (!notesQuery.data || !session) return [];
    const sessionStart = new Date(session.startTime).getTime();
    return notesQuery.data.filter((note) => {
      return new Date(note.createdAt).getTime() >= sessionStart;
    });
  }, [notesQuery.data, session]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Compute elapsed time in seconds
  const elapsed = useMemo(() => {
    if (!session) {
      return 0;
    }
    if (session.status === 'paused' || session.status === 'completed') {
      return session.duration;
    }
    // Subtract any previously accumulated paused duration so only active study time is shown
    return Math.max(
      0,
      Math.round((now - new Date(session.startTime).getTime()) / 1000) - session.pausedDurationSeconds
    );
  }, [now, session]);

  // Select a quote that remains stable during the study session
  const quote = useMemo(() => {
    const defaultQuote = { text: "Stay focused.", author: "Anonymous" };
    if (!session) return MOTIVATIONAL_QUOTES[0] ?? defaultQuote;
    const index = new Date(session.startTime).getTime() % MOTIVATIONAL_QUOTES.length;
    return MOTIVATIONAL_QUOTES[index] ?? MOTIVATIONAL_QUOTES[0] ?? defaultQuote;
  }, [session]);

  const pause = useMutation({
    mutationFn: studyApi.pauseFocus,
    onSuccess: (updated) => {
      updateSession(updated);
      cancelPomodoroNotification();
    }
  });
  const resume = useMutation({
    mutationFn: studyApi.resumeFocus,
    onSuccess: (updated) => {
      updateSession(updated);
      const totalCycleSeconds = 25 * 60;
      const currentCycleElapsed = elapsed % totalCycleSeconds;
      const remainingSeconds = totalCycleSeconds - currentCycleElapsed;
      const remainingMinutes = Math.max(1, Math.round(remainingSeconds / 60));
      schedulePomodoroNotification(remainingMinutes);
    }
  });
  const complete = useMutation({
    mutationFn: studyApi.completeFocus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
      queryClient.invalidateQueries({ queryKey: ['focusHistory'] });
      clearFocus();
      cancelPomodoroNotification();
      navigation.navigate('Main');
    }
  });

  const handleCancelSession = () => {
    Alert.alert(
      'Cancel study session?',
      'This will discard your current progress and focus time. This session won\'t be logged.',
      [
        { text: 'Keep Studying', style: 'cancel' },
        {
          text: 'Discard Session',
          style: 'destructive',
          onPress: () => {
            clearFocus();
            cancelPomodoroNotification();
            navigation.navigate('Main');
          }
        }
      ]
    );
  };

  if (!session || !task) {
    const subjectsList = subjectsQuery.data || [];
    const hasSubjects = subjectsList.length > 0;
    
    return (
      <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.setupHeader}>
          <Pressable onPress={() => navigation.navigate('Main')} style={styles.setupBackBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View style={styles.grow}>
            <Text style={styles.setupTitle}>Start Focus Session</Text>
            <Text style={styles.setupSubtitle}>Choose a subject and topic to begin studying</Text>
          </View>
        </View>

        {!hasSubjects ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="book-outline" size={48} color={colors.muted} style={{ marginBottom: 8 }} />
            <Text style={styles.emptyText}>No subjects found</Text>
            <Text style={styles.emptySubtext}>Please add subjects under Syllabus or select Seeking Courses in Settings first.</Text>
            <Button
              title="Go to Dashboard"
              icon="home-outline"
              onPress={() => {
                navigation.navigate('Main');
              }}
            />
          </View>
        ) : (
          <View style={styles.setupForm}>
            {/* Subjects scroll */}
            <Text style={styles.label}>1. Select Subject</Text>
            <View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.setupSubjectsScroll}
                contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
              >
                {subjectsList.map((sub) => {
                  const isSelected = selectedSubjectId === sub._id;
                  return (
                    <Pressable
                      key={sub._id}
                      onPress={() => selectSubject(sub._id)}
                      style={[
                        styles.setupSubjectChip,
                        isSelected ? styles.setupSubjectChipSelected : undefined
                      ]}
                    >
                      <Text
                        style={[
                          styles.setupChipText,
                          isSelected ? styles.setupChipTextSelected : undefined
                        ]}
                      >
                        {sub.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Incomplete Topics list */}
            <Text style={styles.label}>2. Select Topic</Text>
            {topicsQuery.isLoading ? (
              <View style={styles.centerLoading}>
                <Text style={styles.loadingText}>Loading topics...</Text>
              </View>
            ) : incompleteTopics.length === 0 ? (
              <View style={styles.emptyTopicsContainer}>
                <Ionicons name="checkmark-done-circle-outline" size={36} color={colors.success} />
                <Text style={styles.emptyText}>No incomplete topics</Text>
                <Text style={styles.emptySubtext}>All topics in this subject are completed, or no topics have been added yet.</Text>
              </View>
            ) : (
              <ScrollView style={styles.topicsSelectorList} showsVerticalScrollIndicator={false}>
                {incompleteTopics.map((item) => {
                  const isSelected = selectedTopicId === item._id;
                  return (
                    <Pressable
                      key={item._id}
                      onPress={() => setSelectedTopicId(isSelected ? null : item._id)}
                      style={[
                        styles.topicSelectorRow,
                        isSelected ? styles.topicSelectorRowSelected : undefined
                      ]}
                    >
                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                        color={isSelected ? colors.primary : colors.muted}
                        size={20}
                      />
                      <View style={styles.grow}>
                        <Text style={[
                          styles.topicSelectorTitle,
                          isSelected ? styles.topicSelectorTitleActive : undefined
                        ]}>
                          {item.title}
                        </Text>
                      </View>
                      <View style={styles.topicSelectorMeta}>
                        <Ionicons name="time-outline" size={12} color={colors.muted} />
                        <Text style={{ color: colors.muted, fontSize: 12, marginLeft: 2, fontWeight: '700' }}>{item.estimatedMinutes}m</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {/* CTA action button */}
            <View style={styles.setupActions}>
              <Button
                title={startFocusMutation.isPending ? 'Starting...' : 'Start Session Now'}
                icon="play"
                disabled={!selectedTopicId || startFocusMutation.isPending}
                onPress={() => {
                  if (selectedTopicId) {
                    startFocusMutation.mutate(selectedTopicId);
                  }
                }}
              />
              <Button
                title="Cancel"
                variant="quiet"
                onPress={() => navigation.navigate('Main')}
              />
            </View>
          </View>
        )}
      </View>
    );
  }

  const minutes = Math.floor(elapsed / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(elapsed % 60)
    .toString()
    .padStart(2, '0');

  // Study progress relative to task estimate
  const totalSecondsEstimated = task.estimatedMinutes * 60;
  const progressPercent = Math.min(100, Math.round((elapsed / totalSecondsEstimated) * 100));
  const isOvertime = elapsed > totalSecondsEstimated;
  const overtimeMinutes = isOvertime ? Math.floor((elapsed - totalSecondsEstimated) / 60) : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      {/* ── Top area showing active topic info ── */}
      <View style={styles.top}>
        <View style={styles.subjectBadge}>
          <Text style={styles.subjectBadgeText}>{task.subject || 'Syllabus Topic'}</Text>
        </View>
        <Text style={styles.title}>{task.title}</Text>
        <Text style={styles.targetLabel}>Target: {task.estimatedMinutes} minutes</Text>
      </View>

      {/* ── Immersive Timer Center Ring ── */}
      <View style={styles.timerWrapper}>
        <View style={styles.timerRow}>
          <View style={[
            styles.outerRing,
            session.status === 'paused' ? styles.outerRingPaused : undefined
          ]}>
            <View style={styles.innerRing}>
              <Text style={[
                styles.timerText,
                session.status === 'paused' ? styles.timerTextPaused : undefined
              ]}>
                {minutes}:{seconds}
              </Text>
              
              <View style={styles.progressTextRow}>
                {isOvertime ? (
                  <Text style={styles.overtimeText}>+{overtimeMinutes}m extra study</Text>
                ) : (
                  <Text style={styles.percentText}>{progressPercent}% focused</Text>
                )}
              </View>
            </View>
          </View>

          <Pressable
            onPress={() => navigation.navigate('BrainDump', { subjectId: task.subjectId })}
            style={({ pressed }) => [styles.timerBrainBtn, pressed ? styles.pressed : undefined]}
            accessibilityRole="button"
            accessibilityLabel="Add brain dump note"
          >
            <Ionicons name="create-outline" size={24} color={colors.primary} />
          </Pressable>
        </View>
        
        {session.status === 'active' ? (
          <View style={styles.statusBadge}>
            <View style={styles.pulseDot} />
            <Text style={styles.statusText}>STAYING FOCUSED</Text>
          </View>
        ) : (
          <View style={[styles.statusBadge, { backgroundColor: colors.warningLight }]}>
            <Text style={[styles.statusText, { color: colors.warning }]}>PAUSED</Text>
          </View>
        )}

        {sessionNotes.length > 0 && (
          <Pressable
            onPress={() => setShowDrawer(!showDrawer)}
            style={styles.notesCountBadge}
          >
            <Text style={styles.notesCountBadgeText}>
              🧠 {sessionNotes.length} {sessionNotes.length === 1 ? 'Thought' : 'Thoughts'}
            </Text>
            <Ionicons name={showDrawer ? 'chevron-up' : 'chevron-down'} size={14} color={colors.primary} />
          </Pressable>
        )}

        {showDrawer && sessionNotes.length > 0 && (
          <View style={styles.drawerContainer}>
            <Text style={styles.drawerTitle}>Captured in this session:</Text>
            <ScrollView style={{ maxHeight: 120 }} nestedScrollEnabled>
              {sessionNotes.map((note) => (
                <View key={note._id} style={styles.drawerNoteRow}>
                  <Ionicons name="ellipse" size={6} color={colors.primary} style={styles.bullet} />
                  <Text style={styles.drawerNoteText}>{note.note}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {/* ── Bottom Quote & Actions Area ── */}
      <View style={styles.bottomArea}>
        {/* Inspirational quotes ticker */}
        <View style={styles.quoteCard}>
          <Ionicons name="bulb-outline" size={18} color={colors.primary} style={styles.quoteIcon} />
          <Text style={styles.quoteText}>"{quote.text}"</Text>
          <Text style={styles.quoteAuthor}>— {quote.author}</Text>
        </View>

        {/* Focus Control Buttons */}
        <View style={styles.actions}>
          <View style={styles.mainControls}>
            {session.status === 'paused' ? (
              <Pressable
                onPress={() => resume.mutate(session._id)}
                style={({ pressed }) => [styles.controlBtn, styles.resumeBtn, pressed ? styles.pressed : undefined]}
              >
                <Ionicons name="play" size={24} color={colors.background} />
                <Text style={styles.controlBtnText}>Resume</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => pause.mutate(session._id)}
                style={({ pressed }) => [styles.controlBtn, styles.pauseBtn, pressed ? styles.pressed : undefined]}
              >
                <Ionicons name="pause" size={24} color={colors.primary} />
                <Text style={[styles.controlBtnText, { color: colors.primary }]}>Pause</Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => complete.mutate(session._id)}
              style={({ pressed }) => [styles.controlBtn, styles.completeBtn, pressed ? styles.pressed : undefined]}
            >
              <Ionicons name="checkmark" size={24} color={colors.background} />
              <Text style={styles.controlBtnText}>Complete</Text>
            </Pressable>
          </View>

          <View style={styles.subActions}>
            <Button
              title="Brain Dump Note"
              icon="create-outline"
              variant="quiet"
              onPress={() => navigation.navigate('BrainDump', { subjectId: task.subjectId })}
            />
            <Button
              title="Cancel Session"
              icon="close"
              variant="danger-quiet"
              onPress={handleCancelSession}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
    justifyContent: 'space-between'
  },
  top: {
    alignItems: 'center',
    gap: 8,
    marginTop: 10
  },
  subjectBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  subjectBadgeText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 32
  },
  targetLabel: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700'
  },
  timerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    width: '100%'
  },
  timerRow: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    flexDirection: 'row'
  },
  timerBrainBtn: {
    position: 'absolute',
    right: 10,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  notesCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.primary
  },
  notesCountBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary
  },
  drawerContainer: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginTop: 12,
    gap: 8
  },
  drawerTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6
  },
  drawerNoteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 3
  },
  bullet: {
    marginTop: 6
  },
  drawerNoteText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18
  },
  outerRing: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 6,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3
  },
  outerRingPaused: {
    borderColor: colors.muted,
    shadowColor: colors.muted
  },
  innerRing: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    gap: 4
  },
  timerText: {
    color: colors.primary,
    fontSize: 54,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1
  },
  timerTextPaused: {
    color: colors.muted
  },
  progressTextRow: {
    height: 20,
    justifyContent: 'center'
  },
  percentText: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 13
  },
  overtimeText: {
    color: colors.accent,
    fontWeight: '800',
    fontSize: 13
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.successLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 20
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.success,
    letterSpacing: 0.5
  },
  bottomArea: {
    gap: 20
  },
  quoteCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    alignItems: 'center',
    gap: 4,
    position: 'relative'
  },
  quoteIcon: {
    position: 'absolute',
    top: 8,
    left: 12,
    opacity: 0.15
  },
  quoteText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 18
  },
  quoteAuthor: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted
  },
  actions: {
    gap: 12
  },
  mainControls: {
    flexDirection: 'row',
    gap: 12
  },
  controlBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  resumeBtn: {
    backgroundColor: colors.success
  },
  pauseBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  completeBtn: {
    backgroundColor: colors.primary
  },
  controlBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.background
  },
  subActions: {
    gap: 10,
    marginTop: 4
  },
  pressed: {
    opacity: 0.8
  },
  setupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20
  },
  setupBackBtn: {
    padding: 4
  },
  setupTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text
  },
  setupSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
    marginTop: 2
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center'
  },
  emptySubtext: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18
  },
  setupForm: {
    flex: 1,
    gap: 16
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  setupSubjectsScroll: {
    flexGrow: 0
  },
  setupSubjectChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  setupSubjectChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  setupChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text
  },
  setupChipTextSelected: {
    color: colors.background,
    fontWeight: '800'
  },
  centerLoading: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 14
  },
  emptyTopicsContainer: {
    height: 150,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 6
  },
  topicsSelectorList: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 12
  },
  topicSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8
  },
  topicSelectorRowSelected: {
    borderBottomColor: colors.primary
  },
  topicSelectorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text
  },
  topicSelectorTitleActive: {
    color: colors.primary,
    fontWeight: '800'
  },
  topicSelectorMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  setupActions: {
    gap: 8,
    marginTop: 'auto'
  },
  grow: {
    flex: 1
  }
});
