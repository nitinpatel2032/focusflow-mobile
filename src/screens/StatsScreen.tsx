import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { Alert, StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { studyApi } from '../api/studyApi';
import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { colors } from '../constants/colors';
import { useAuthStore } from '../store/authStore';
import { usePreferencesStore } from '../store/preferencesStore';
import type { Flashcard, Subject, Topic, FocusSession } from '../types/models';

export function StatsScreen() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  
  const [activeSegment, setActiveSegment] = useState<'analytics' | 'flashcards'>('analytics');
  
  // Queries
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: studyApi.subjects });
  const focusHistoryQuery = useQuery({ queryKey: ['focusHistory'], queryFn: studyApi.focusHistory });
  const topicsQuery = useQuery({ queryKey: ['topics'], queryFn: () => studyApi.topics() });

  // Preference goals
  const weeklyGoalMinutes = usePreferencesStore((state) => state.weeklyGoalMinutes);
  const weeklyGoalTopics = usePreferencesStore((state) => state.weeklyGoalTopics);
  const weeklyGoalUnit = usePreferencesStore((state) => state.weeklyGoalUnit);
  const setWeeklyGoalMinutes = usePreferencesStore((state) => state.setWeeklyGoalMinutes);
  const setWeeklyGoalTopics = usePreferencesStore((state) => state.setWeeklyGoalTopics);
  const setWeeklyGoalUnit = usePreferencesStore((state) => state.setWeeklyGoalUnit);

  const [editingGoals, setEditingGoals] = useState(false);
  const [goalMinInput, setGoalMinInput] = useState('');
  const [goalTopicsInput, setGoalTopicsInput] = useState('');
  const [goalUnitInput, setGoalUnitInput] = useState<'min' | 'hr'>('min');

  function openEditGoals() {
    setGoalMinInput(
      weeklyGoalUnit === 'hr'
        ? String(Math.round(weeklyGoalMinutes / 60))
        : String(weeklyGoalMinutes)
    );
    setGoalTopicsInput(String(weeklyGoalTopics));
    setGoalUnitInput(weeklyGoalUnit);
    setEditingGoals(true);
  }

  // Flashcards state
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [cardFront, setCardFront] = useState('');
  const [cardBack, setCardBack] = useState('');
  const [isStudyMode, setIsStudyMode] = useState(false);

  const [showAiCardModal, setShowAiCardModal] = useState(false);
  const [selectedTopicIdForAi, setSelectedTopicIdForAi] = useState<string | null>(null);
  const [isGeneratingAiCards, setIsGeneratingAiCards] = useState(false);

  const generateFlashcardsMutation = useMutation({
    mutationFn: (payload: { subjectId: string; topicId?: string }) =>
      studyApi.generateFlashcards(payload.subjectId, payload.topicId),
    onMutate: () => {
      setIsGeneratingAiCards(true);
    },
    onSuccess: (data) => {
      setIsGeneratingAiCards(false);
      setShowAiCardModal(false);
      setSelectedTopicIdForAi(null);
      queryClient.invalidateQueries({ queryKey: ['flashcards', selectedSubjectId] });
      Alert.alert('AI Cards Generated', `Successfully generated and saved ${data.length} flashcards covering this content!`);
    },
    onError: (err: any) => {
      setIsGeneratingAiCards(false);
      Alert.alert('AI Generation Failed', err.message || 'Failed to auto-generate flashcards.');
    }
  });

  const subjectTopics = useMemo(() => {
    if (!topicsQuery.data || !selectedSubjectId) return [];
    return topicsQuery.data.filter((t) => {
      const subId = typeof t.subjectId === 'object' ? t.subjectId._id : t.subjectId;
      return subId === selectedSubjectId;
    });
  }, [topicsQuery.data, selectedSubjectId]);
  
  // Study session state
  const [studyQueue, setStudyQueue] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);

  // Auto-select first subject for flashcards
  useMemo(() => {
    if (subjectsQuery.data && subjectsQuery.data.length > 0 && !selectedSubjectId) {
      const firstSub = subjectsQuery.data[0];
      if (firstSub) {
        setSelectedSubjectId(firstSub._id);
      }
    }
  }, [subjectsQuery.data, selectedSubjectId]);

  const flashcardsQuery = useQuery({
    queryKey: ['flashcards', selectedSubjectId],
    queryFn: () => studyApi.flashcards(selectedSubjectId || undefined),
    enabled: !!selectedSubjectId
  });

  // Calculate current week and last week statistics
  const currentWeekStats = useMemo(() => {
    const now = new Date();
    // Monday as start of this week
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(now.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const weekStartMs = startOfWeek.getTime();
    const weekEndMs = endOfWeek.getTime();

    // Monday as start of last week
    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfWeek.getDate() - 7);
    startOfLastWeek.setHours(0, 0, 0, 0);

    const endOfLastWeek = new Date(startOfWeek);
    endOfLastWeek.setMilliseconds(-1);

    const lastWeekStartMs = startOfLastWeek.getTime();
    const lastWeekEndMs = endOfLastWeek.getTime();

    // 1. Weekly focus minutes (This Week)
    const sessionsThisWeek = (focusHistoryQuery.data || []).filter((s) => {
      if (!s.completed) return false;
      const t = new Date(s.endTime ?? s.startTime).getTime();
      return t >= weekStartMs && t <= weekEndMs;
    });
    const weekFocusMinutes = Math.round(sessionsThisWeek.reduce((sum, s) => sum + s.duration, 0) / 60);

    // 2. Weekly focus minutes (Last Week)
    const sessionsLastWeek = (focusHistoryQuery.data || []).filter((s) => {
      if (!s.completed) return false;
      const t = new Date(s.endTime ?? s.startTime).getTime();
      return t >= lastWeekStartMs && t <= lastWeekEndMs;
    });
    const lastWeekFocusMinutes = Math.round(sessionsLastWeek.reduce((sum, s) => sum + s.duration, 0) / 60);

    // 3. Weekly topics completed (This Week)
    const topicsCompletedThisWeek = (topicsQuery.data || []).filter((t) => {
      if (!t.completed || !t.completedAt) return false;
      const compTime = new Date(t.completedAt).getTime();
      return compTime >= weekStartMs && compTime <= weekEndMs;
    });

    // 4. Daily focus minutes grouping (This Week)
    const dailyMins = [0, 0, 0, 0, 0, 0, 0];
    sessionsThisWeek.forEach((s) => {
      const sessionDate = new Date(s.endTime ?? s.startTime);
      let dayIndex = sessionDate.getDay() - 1; // Mon = 0
      if (dayIndex < 0) dayIndex = 6; // Sun = 6
      const currentVal = dailyMins[dayIndex] ?? 0;
      dailyMins[dayIndex] = currentVal + s.duration / 60;
    });
    const scaledDailyMins = dailyMins.map((m) => Math.round(m));

    // 5. Daily focus minutes grouping (Last Week)
    const lastWeekDailyMins = [0, 0, 0, 0, 0, 0, 0];
    sessionsLastWeek.forEach((s) => {
      const sessionDate = new Date(s.endTime ?? s.startTime);
      let dayIndex = sessionDate.getDay() - 1; // Mon = 0
      if (dayIndex < 0) dayIndex = 6; // Sun = 6
      const currentVal = lastWeekDailyMins[dayIndex] ?? 0;
      lastWeekDailyMins[dayIndex] = currentVal + s.duration / 60;
    });
    const scaledLastWeekDailyMins = lastWeekDailyMins.map((m) => Math.round(m));

    // 6. Trend calculation
    let pctChangeStr = 'No previous data';
    let trendDirection: 'up' | 'down' | 'neutral' = 'neutral';
    if (lastWeekFocusMinutes > 0) {
      const diff = weekFocusMinutes - lastWeekFocusMinutes;
      const pct = Math.round((diff / lastWeekFocusMinutes) * 100);
      pctChangeStr = pct >= 0 ? `+${pct}% vs last week` : `${pct}% vs last week`;
      trendDirection = pct > 0 ? 'up' : (pct < 0 ? 'down' : 'neutral');
    } else if (weekFocusMinutes > 0) {
      pctChangeStr = '+100% vs last week';
      trendDirection = 'up';
    }

    // 7. Time spent per subject
    const subjectMins: Record<string, number> = {};
    sessionsThisWeek.forEach((s) => {
      if (s.topicId && typeof s.topicId === 'object') {
        const subId = typeof s.topicId.subjectId === 'object' ? s.topicId.subjectId._id : s.topicId.subjectId;
        if (subId) {
          subjectMins[subId] = (subjectMins[subId] || 0) + s.duration / 60;
        }
      }
    });

    return {
      focusMinutes: weekFocusMinutes,
      topicsCompleted: topicsCompletedThisWeek.length,
      dailyMinutes: scaledDailyMins,
      lastWeekDailyMinutes: scaledLastWeekDailyMins,
      lastWeekTotalMinutes: lastWeekFocusMinutes,
      pctChangeStr,
      trendDirection,
      subjectBreakdown: Object.keys(subjectMins).map((subId) => {
        const name = subjectsQuery.data?.find((sub) => sub._id === subId)?.name || 'Other';
        return {
          id: subId,
          name,
          minutes: Math.round(subjectMins[subId] || 0)
        };
      }).sort((a, b) => b.minutes - a.minutes)
    };
  }, [focusHistoryQuery.data, topicsQuery.data, subjectsQuery.data]);

  // Gamification metrics
  const totalCompletedSessions = useMemo(() => {
    return (focusHistoryQuery.data || []).filter(s => s.completed).length;
  }, [focusHistoryQuery.data]);

  const totalMinutesAllTime = useMemo(() => {
    return Math.round((focusHistoryQuery.data || []).reduce((sum, s) => sum + (s.completed ? s.duration : 0), 0) / 60);
  }, [focusHistoryQuery.data]);

  const completedTopicsCount = useMemo(() => {
    return (topicsQuery.data || []).filter(t => t.completed).length;
  }, [topicsQuery.data]);

  // Achievements config list
  const achievementsList = useMemo(() => {
    return [
      {
        id: 'first_step',
        title: 'First Step',
        desc: 'Log your first completed focus block.',
        icon: 'footsteps-outline',
        unlocked: totalCompletedSessions >= 1,
        color: '#10B981'
      },
      {
        id: 'focused_learner',
        title: 'Focused Learner',
        desc: 'Log 60 focus minutes (1 hour) of study.',
        icon: 'time-outline',
        unlocked: totalMinutesAllTime >= 60,
        color: '#3B82F6'
      },
      {
        id: 'focus_hero',
        title: 'Focus Hero',
        desc: 'Accumulate 240 focus minutes (4 hours) of study.',
        icon: 'trophy-outline',
        unlocked: totalMinutesAllTime >= 240,
        color: '#8B5CF6'
      },
      {
        id: 'streak_starter',
        title: 'Streak Starter',
        desc: 'Achieve a study streak of 3 days.',
        icon: 'flame-outline',
        unlocked: (user?.currentStreak ?? 0) >= 3 || (user?.longestStreak ?? 0) >= 3,
        color: '#F59E0B'
      },
      {
        id: 'streak_champion',
        title: 'Streak Champion',
        desc: 'Achieve a study streak of 7 days.',
        icon: 'ribbon-outline',
        unlocked: (user?.currentStreak ?? 0) >= 7 || (user?.longestStreak ?? 0) >= 7,
        color: '#EF4444'
      },
      {
        id: 'recall_rookie',
        title: 'Recall Rookie',
        desc: 'Create at least one flashcard.',
        icon: 'layers-outline',
        unlocked: (flashcardsQuery.data || []).length > 0,
        color: '#EC4899'
      },
      {
        id: 'recall_master',
        title: 'Recall Master',
        desc: 'Grade recall difficulty in a revision session.',
        icon: 'heart-outline',
        unlocked: (flashcardsQuery.data || []).some(c => c.difficulty !== 'medium'),
        color: '#14B8A6'
      },
      {
        id: 'topic_conqueror',
        title: 'Topic Conqueror',
        desc: 'Complete 5 topics on your syllabus.',
        icon: 'checkmark-done-outline',
        unlocked: completedTopicsCount >= 5,
        color: '#6366F1'
      }
    ];
  }, [totalCompletedSessions, totalMinutesAllTime, user?.currentStreak, user?.longestStreak, flashcardsQuery.data, completedTopicsCount]);

  // All-time subject study time breakdown (for Syllabus Insights card)
  const allTimeSubjectBreakdown = useMemo(() => {
    const sessions = (focusHistoryQuery.data || []).filter(s => s.completed);
    if (!subjectsQuery.data || sessions.length === 0) return [];

    const timeMap: Record<string, number> = {};
    subjectsQuery.data.forEach((s) => { timeMap[s._id] = 0; });

    sessions.forEach((session) => {
      if (session.topicId && typeof session.topicId !== 'string') {
        const sub = session.topicId.subjectId;
        const subId = typeof sub === 'string' ? sub : sub?._id;
        if (subId && timeMap[subId] !== undefined) {
          timeMap[subId] += session.duration;
        }
      }
    });

    return subjectsQuery.data
      .map((s) => ({
        id: s._id,
        name: s.name,
        minutes: Math.round((timeMap[s._id] || 0) / 60)
      }))
      .filter((item) => item.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes);
  }, [focusHistoryQuery.data, subjectsQuery.data]);

  const maxAllTimeSubjectMinutes = useMemo(() => {
    if (!allTimeSubjectBreakdown.length) return 1;
    return Math.max(...allTimeSubjectBreakdown.map((s) => s.minutes), 1);
  }, [allTimeSubjectBreakdown]);

  // Flashcards CRUD Mutations
  const createCardMutation = useMutation({
    mutationFn: studyApi.createFlashcard,
    onSuccess: () => {
      setCardFront('');
      setCardBack('');
      setShowAddCardModal(false);
      queryClient.invalidateQueries({ queryKey: ['flashcards', selectedSubjectId] });
      Alert.alert('Flashcard Added', 'Your new flashcard is ready.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to create flashcard.');
    }
  });

  const updateCardMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => studyApi.updateFlashcard(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flashcards', selectedSubjectId] });
    }
  });

  const deleteCardMutation = useMutation({
    mutationFn: studyApi.deleteFlashcard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flashcards', selectedSubjectId] });
      Alert.alert('Flashcard Deleted', 'The flashcard was deleted.');
    }
  });

  function handleSaveGoals() {
    const rawVal = parseFloat(goalMinInput);
    const topics = parseInt(goalTopicsInput, 10);
    if (isNaN(rawVal) || rawVal <= 0 || isNaN(topics) || topics <= 0) {
      Alert.alert('Invalid Goals', 'Please enter positive numbers for targets.');
      return;
    }
    const mins = goalUnitInput === 'hr' ? Math.round(rawVal * 60) : Math.round(rawVal);
    setWeeklyGoalMinutes(mins);
    setWeeklyGoalTopics(topics);
    setWeeklyGoalUnit(goalUnitInput);
    setEditingGoals(false);
  }

  function handleStartStudy() {
    if (!flashcardsQuery.data || flashcardsQuery.data.length === 0) return;
    // Shuffle the queue
    const shuffled = [...flashcardsQuery.data].sort(() => Math.random() - 0.5);
    setStudyQueue(shuffled);
    setCurrentCardIndex(0);
    setIsCardFlipped(false);
    setIsStudyMode(true);
  }

  function handleCardDifficulty(difficulty: 'easy' | 'medium' | 'hard') {
    const card = studyQueue[currentCardIndex];
    if (!card) return;

    // Save difficulty rating in backend
    updateCardMutation.mutate({ id: card._id, payload: { difficulty } });

    // Queue revision intervals
    let nextQueue = [...studyQueue];
    if (difficulty === 'hard') {
      // Re-insert card 2 slots down so user sees it again quickly
      const insertIndex = Math.min(currentCardIndex + 3, nextQueue.length);
      nextQueue.splice(insertIndex, 0, card);
      setStudyQueue(nextQueue);
      setCurrentCardIndex((prev) => prev + 1);
      setIsCardFlipped(false);
    } else {
      // If easy/medium, progress to next card
      if (currentCardIndex + 1 >= studyQueue.length) {
        setIsStudyMode(false);
        Alert.alert('Revision Completed', 'Excellent recall! You reviewed all cards.');
      } else {
        setCurrentCardIndex((prev) => prev + 1);
        setIsCardFlipped(false);
      }
    }
  }

  function handleCreateCard() {
    if (!selectedSubjectId || !cardFront.trim() || !cardBack.trim()) return;
    createCardMutation.mutate({
      subjectId: selectedSubjectId,
      front: cardFront.trim(),
      back: cardBack.trim()
    });
  }

  function handleDeleteCard(id: string) {
    Alert.alert('Delete card?', 'Are you sure you want to remove this flashcard?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteCardMutation.mutate(id) }
    ]);
  }

  // Render helpers
  const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const maxDayMinutes = Math.max(...currentWeekStats.dailyMinutes, 1);

  return (
    <Screen>
      <Header title="Analytics & Revision" subtitle="Track progress & revise core terms" />

      {/* Segment Switcher */}
      <View style={styles.segmentContainer}>
        <Pressable
          onPress={() => {
            setActiveSegment('analytics');
            setIsStudyMode(false);
          }}
          style={[styles.segmentBtn, activeSegment === 'analytics' && styles.segmentBtnActive]}
        >
          <Ionicons
            name="bar-chart-outline"
            size={18}
            color={activeSegment === 'analytics' ? colors.background : colors.primary}
          />
          <Text style={[styles.segmentBtnText, activeSegment === 'analytics' && styles.segmentBtnTextActive]}>
            Analytics
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveSegment('flashcards')}
          style={[styles.segmentBtn, activeSegment === 'flashcards' && styles.segmentBtnActive]}
        >
          <Ionicons
            name="layers-outline"
            size={18}
            color={activeSegment === 'flashcards' ? colors.background : colors.primary}
          />
          <Text style={[styles.segmentBtnText, activeSegment === 'flashcards' && styles.segmentBtnTextActive]}>
            Flashcards
          </Text>
        </Pressable>
      </View>

      {activeSegment === 'analytics' ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
          
          {/* Streak Banner */}
          <View style={styles.streakPanel}>
            <Ionicons name="flame" size={32} color="#F59E0B" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.streakTitle}>Current Study Streak: {user?.currentStreak ?? 0} days</Text>
              <Text style={styles.streakSubtitle}>Keep studying daily to protect your record streak of {user?.longestStreak ?? 0} days!</Text>
            </View>
          </View>

          {/* Weekly Milestones Section */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Weekly Milestones</Text>
              <Pressable onPress={() => {
                if (editingGoals) {
                  setEditingGoals(false);
                } else {
                  openEditGoals();
                }
              }}>
                <Text style={styles.editGoalBtnText}>{editingGoals ? 'Cancel' : 'Edit Goals'}</Text>
              </Pressable>
            </View>

            {editingGoals ? (
              <View style={styles.goalsEditForm}>
                <View style={styles.inline}>
                  <View style={styles.grow}>
                    <TextField
                      label={`Focus Target (${goalUnitInput === 'hr' ? 'Hours' : 'Minutes'})`}
                      value={goalMinInput}
                      onChangeText={setGoalMinInput}
                      keyboardType="decimal-pad"
                      placeholder={goalUnitInput === 'hr' ? "2.5" : "150"}
                    />
                  </View>
                  <View style={styles.goalUnitSelector}>
                    <Text style={styles.goalUnitLabel}>Unit</Text>
                    <View style={styles.goalUnitTabs}>
                      <Pressable
                        onPress={() => {
                          if (goalUnitInput !== 'min') {
                            setGoalUnitInput('min');
                            const parsed = parseFloat(goalMinInput) || 0;
                            setGoalMinInput(String(Math.round(parsed * 60)));
                          }
                        }}
                        style={[
                          styles.goalUnitTab,
                          goalUnitInput === 'min' ? styles.goalUnitTabSelected : undefined
                        ]}
                      >
                        <Text style={[
                          styles.goalUnitTabText,
                          goalUnitInput === 'min' ? styles.goalUnitTabTextSelected : undefined
                        ]}>Min</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          if (goalUnitInput !== 'hr') {
                            setGoalUnitInput('hr');
                            const parsed = parseFloat(goalMinInput) || 0;
                            setGoalMinInput(String((parsed / 60).toFixed(1).replace(/\.0$/, '')));
                          }
                        }}
                        style={[
                          styles.goalUnitTab,
                          goalUnitInput === 'hr' ? styles.goalUnitTabSelected : undefined
                        ]}
                      >
                        <Text style={[
                          styles.goalUnitTabText,
                          goalUnitInput === 'hr' ? styles.goalUnitTabTextSelected : undefined
                        ]}>Hr</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>

                <TextField
                  label="Topics Target (completions)"
                  value={goalTopicsInput}
                  onChangeText={setGoalTopicsInput}
                  keyboardType="number-pad"
                />
                <Button title="Save Goals" icon="checkmark-circle-outline" onPress={handleSaveGoals} />
              </View>
            ) : (
              <View style={styles.goalsProgressRow}>
                {/* Focus progress */}
                <View style={styles.goalMeterContainer}>
                  <Text style={styles.goalMeterLabel}>Weekly Focus</Text>
                  <Text style={styles.goalMeterCount}>
                    {weeklyGoalUnit === 'hr'
                      ? `${(currentWeekStats.focusMinutes / 60).toFixed(1).replace(/\.0$/, '')} / ${Math.round(weeklyGoalMinutes / 60)} hr`
                      : `${currentWeekStats.focusMinutes} / ${weeklyGoalMinutes} min`}
                  </Text>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min(
                            100,
                            (currentWeekStats.focusMinutes / weeklyGoalMinutes) * 100
                          )}%`,
                          backgroundColor: '#6366F1'
                        }
                      ]}
                    />
                  </View>
                </View>

                {/* Topics progress */}
                <View style={styles.goalMeterContainer}>
                  <Text style={styles.goalMeterLabel}>Topics Completed</Text>
                  <Text style={styles.goalMeterCount}>
                    {currentWeekStats.topicsCompleted} / {weeklyGoalTopics} topics
                  </Text>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min(
                            100,
                            (currentWeekStats.topicsCompleted / weeklyGoalTopics) * 100
                          )}%`,
                          backgroundColor: '#10B981'
                        }
                      ]}
                    />
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Weekly Comparison Trend chart */}
          <View style={styles.card}>
            <View style={styles.chartHeaderRow}>
              <Text style={styles.cardTitle}>Weekly Comparison (mins)</Text>
              <View style={[
                styles.trendBadge,
                currentWeekStats.trendDirection === 'up' && { backgroundColor: '#DEF7EC' },
                currentWeekStats.trendDirection === 'down' && { backgroundColor: '#FDE8E8' }
              ]}>
                <Ionicons
                  name={currentWeekStats.trendDirection === 'up' ? 'trending-up' : (currentWeekStats.trendDirection === 'down' ? 'trending-down' : 'remove')}
                  size={12}
                  color={currentWeekStats.trendDirection === 'up' ? '#03543F' : (currentWeekStats.trendDirection === 'down' ? '#9B1C1C' : colors.muted)}
                  style={{ marginRight: 3 }}
                />
                <Text style={[
                  styles.trendBadgeText,
                  currentWeekStats.trendDirection === 'up' && { color: '#03543F' },
                  currentWeekStats.trendDirection === 'down' && { color: '#9B1C1C' }
                ]}>
                  {currentWeekStats.pctChangeStr}
                </Text>
              </View>
            </View>

            <View style={styles.chartContainer}>
              {currentWeekStats.dailyMinutes.map((mins, i) => {
                const lastMins = currentWeekStats.lastWeekDailyMinutes[i] ?? 0;
                const maxDayMinutesCompare = Math.max(...currentWeekStats.dailyMinutes, ...currentWeekStats.lastWeekDailyMinutes, 1);
                
                const barHeightThis = Math.max(4, Math.round((mins / maxDayMinutesCompare) * 110));
                const barHeightLast = Math.max(4, Math.round((lastMins / maxDayMinutesCompare) * 110));
                
                return (
                  <View key={i} style={styles.chartCol}>
                    <View style={styles.dualBarsFrame}>
                      {/* Last Week Bar (gray background) */}
                      <View style={[styles.chartBarLast, { height: barHeightLast }]} />
                      {/* This Week Bar (purple foreground) */}
                      <View style={[styles.chartBarThis, { height: barHeightThis }]} />
                    </View>
                    <Text style={styles.chartBarLabel}>{dayNames[i]}</Text>
                  </View>
                );
              })}
            </View>

            {/* Chart Legend */}
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, { backgroundColor: '#8B5CF6' }]} />
                <Text style={styles.legendText}>This Week ({currentWeekStats.focusMinutes}m)</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, { backgroundColor: '#CBD5E1' }]} />
                <Text style={styles.legendText}>Last Week ({currentWeekStats.lastWeekTotalMinutes}m)</Text>
              </View>
            </View>
          </View>

          {/* Time Spent per Subject */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Time Spent per Subject</Text>
            {currentWeekStats.subjectBreakdown.length === 0 ? (
              <Text style={styles.emptyText}>No study sessions logged this week yet.</Text>
            ) : (
              <View style={{ gap: 12, marginTop: 8 }}>
                {currentWeekStats.subjectBreakdown.map((item) => (
                  <View key={item.id} style={styles.subjectBreakdownRow}>
                    <View style={styles.subjectBreakdownLabel}>
                      <Text style={styles.subjectBreakdownName}>{item.name}</Text>
                      <Text style={styles.subjectBreakdownMins}>{item.minutes} min</Text>
                    </View>
                    <View style={styles.progressBarBg}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.min(
                              100,
                              (item.minutes / Math.max(1, currentWeekStats.focusMinutes)) * 100
                            )}%`,
                            backgroundColor: colors.primary
                          }
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Gamified Achievements Grid */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Study Achievements ({achievementsList.filter(a => a.unlocked).length} / {achievementsList.length})
            </Text>
            <View style={styles.badgesGrid}>
              {achievementsList.map((badge) => (
                <Pressable
                  key={badge.id}
                  onPress={() => {
                    Alert.alert(
                      badge.title,
                      `${badge.desc}\n\nStatus: ${badge.unlocked ? '✅ Unlocked' : '🔒 Locked'}`
                    );
                  }}
                  style={[
                    styles.badgeCell,
                    badge.unlocked ? styles.badgeCellUnlocked : styles.badgeCellLocked
                  ]}
                >
                  <View style={[
                    styles.badgeIconContainer,
                    badge.unlocked ? { backgroundColor: badge.color + '1A' } : { backgroundColor: '#F1F5F9' }
                  ]}>
                    <Ionicons
                      name={badge.unlocked ? badge.icon as any : 'lock-closed-outline'}
                      size={20}
                      color={badge.unlocked ? badge.color : colors.muted}
                    />
                  </View>
                  <Text style={[
                    styles.badgeTitle,
                    badge.unlocked ? undefined : { color: colors.muted }
                  ]} numberOfLines={1}>
                    {badge.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Syllabus Insights */}
          {allTimeSubjectBreakdown.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Syllabus Insights</Text>
              <Text style={styles.syllabusInsightDesc}>All-time study time across your subjects</Text>
              <View style={styles.syllabusInsightList}>
                {allTimeSubjectBreakdown.map((item) => {
                  const widthPercent = (item.minutes / maxAllTimeSubjectMinutes) * 100;
                  return (
                    <View key={item.id} style={styles.syllabusInsightItem}>
                      <View style={styles.syllabusInsightHeader}>
                        <Text style={styles.syllabusInsightName}>{item.name}</Text>
                        <Text style={styles.syllabusInsightValue}>{item.minutes} min</Text>
                      </View>
                      <View style={styles.syllabusBarBg}>
                        <View style={[styles.syllabusBarFill, { width: `${widthPercent}%` }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Recent Focus Sessions */}
          <View style={styles.card}>
            <View style={styles.sessionCardHeader}>
              <Text style={styles.cardTitle}>Focus Sessions</Text>
              <View style={styles.sessionSummaryRow}>
                <View style={styles.sessionSummaryBox}>
                  <Ionicons name="trophy-outline" size={18} color={colors.primary} />
                  <Text style={styles.sessionSummaryValue}>{totalCompletedSessions}</Text>
                  <Text style={styles.sessionSummaryLabel}>Sessions</Text>
                </View>
                <View style={[styles.sessionSummaryBox, { borderLeftWidth: 1, borderLeftColor: colors.border }]}>
                  <Ionicons name="hourglass-outline" size={18} color={colors.primary} />
                  <Text style={styles.sessionSummaryValue}>{totalMinutesAllTime}</Text>
                  <Text style={styles.sessionSummaryLabel}>Minutes</Text>
                </View>
              </View>
            </View>

            <View style={styles.sessionList}>
              {(focusHistoryQuery.data?.filter(s => s.completed) ?? []).length === 0 ? (
                <Text style={styles.emptyText}>Complete a focus session to see history here.</Text>
              ) : (
                (focusHistoryQuery.data?.filter(s => s.completed) ?? [])
                  .slice()
                  .reverse()
                  .slice(0, 10)
                  .map((session) => {
                    const topicObj = session.topicId;
                    const title = !topicObj
                      ? 'Deleted topic'
                      : typeof topicObj === 'string'
                        ? 'Study session'
                        : topicObj.title;
                    const minutes = Math.max(1, Math.round(session.duration / 60));
                    const date = new Date(session.endTime ?? session.startTime).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric'
                    });
                    return (
                      <View key={session._id} style={styles.sessionRow}>
                        <View style={styles.sessionDotWrapper}>
                          <View style={styles.sessionDot} />
                        </View>
                        <View style={styles.sessionRowContent}>
                          <Text style={styles.sessionRowTitle} numberOfLines={1}>{title}</Text>
                          <Text style={styles.sessionRowMeta}>{date}</Text>
                        </View>
                        <View style={styles.sessionDurationBadge}>
                          <Text style={styles.sessionDurationText}>+{minutes} min</Text>
                        </View>
                      </View>
                    );
                  })
              )}
            </View>
          </View>

        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Flashcards View */}
          {!isStudyMode ? (
            <>
              {/* Subjects Tab bar selector */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.subjectsScroll}
                contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
              >
                {subjectsQuery.data?.map((subject) => (
                  <Pressable
                    key={subject._id}
                    onPress={() => setSelectedSubjectId(subject._id)}
                    style={[
                      styles.subjectChip,
                      selectedSubjectId === subject._id ? styles.selectedChip : undefined
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedSubjectId === subject._id ? styles.selectedChipText : undefined
                      ]}
                    >
                      {subject.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Toolbar */}
              <View style={styles.flashcardToolbar}>
                <Text style={styles.flashcardHeading}>
                  Study Cards ({flashcardsQuery.data?.length ?? 0})
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={() => setShowAiCardModal(true)}
                    style={[styles.addCardBtn, { backgroundColor: '#8B5CF6' }]}
                  >
                    <Ionicons name="sparkles" size={14} color={colors.background} style={{ marginRight: 2 }} />
                    <Text style={styles.addCardBtnText}>AI Generate</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setShowAddCardModal(true)}
                    style={styles.addCardBtn}
                  >
                    <Ionicons name="add" size={16} color={colors.background} />
                    <Text style={styles.addCardBtnText}>Add Card</Text>
                  </Pressable>
                </View>
              </View>

              {flashcardsQuery.isLoading ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 40 }} />
              ) : !flashcardsQuery.data || flashcardsQuery.data.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="layers-outline" size={48} color={colors.muted} />
                  <Text style={styles.emptyHeading}>No flashcards yet</Text>
                  <Text style={styles.emptyDesc}>
                    Create flashcards for active recall testing to study key concepts.
                  </Text>
                </View>
              ) : (
                <>
                  <View style={{ marginVertical: 12 }}>
                    <Button
                      title="Start Active Recall Session"
                      icon="play-outline"
                      onPress={handleStartStudy}
                    />
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 24 }}>
                    {flashcardsQuery.data.map((card) => (
                      <View key={card._id} style={styles.flashcardListItem}>
                        <View style={styles.grow}>
                          <Text style={styles.cardListFront}>Q: {card.front}</Text>
                          <Text style={styles.cardListBack}>A: {card.back}</Text>
                          <View style={[
                            styles.diffBadge,
                            card.difficulty === 'easy' && { backgroundColor: '#DEF7EC' },
                            card.difficulty === 'medium' && { backgroundColor: '#FEF3C7' },
                            card.difficulty === 'hard' && { backgroundColor: '#FDE8E8' }
                          ]}>
                            <Text style={[
                              styles.diffBadgeText,
                              card.difficulty === 'easy' && { color: '#03543F' },
                              card.difficulty === 'medium' && { color: '#92400E' },
                              card.difficulty === 'hard' && { color: '#9B1C1C' }
                            ]}>
                              {card.difficulty.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                        <Pressable onPress={() => handleDeleteCard(card._id)} style={styles.deleteCardBtn}>
                          <Ionicons name="trash-outline" size={18} color={colors.danger} />
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                </>
              )}
            </>
          ) : (
            // Study Active Recall Swiper
            <View style={styles.studyModeContainer}>
              <View style={styles.studyHeader}>
                <Pressable onPress={() => setIsStudyMode(false)} style={styles.studyCloseBtn}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
                <Text style={styles.studyTitle}>
                  Study Queue ({currentCardIndex + 1} / {studyQueue.length})
                </Text>
              </View>

              {studyQueue[currentCardIndex] && (
                <View style={styles.activeStudyCardFrame}>
                  <Pressable
                    onPress={() => setIsCardFlipped(!isCardFlipped)}
                    style={[
                      styles.activeStudyCard,
                      isCardFlipped ? styles.activeStudyCardFlipped : undefined
                    ]}
                  >
                    {!isCardFlipped ? (
                      <View style={styles.cardSide}>
                        <Text style={styles.sideLabel}>QUESTION</Text>
                        <Text style={styles.cardTextContent}>{studyQueue[currentCardIndex].front}</Text>
                        <Text style={styles.tapToFlip}>Tap card to reveal answer</Text>
                      </View>
                    ) : (
                      <View style={styles.cardSide}>
                        <Text style={styles.sideLabelAnswer}>ANSWER</Text>
                        <Text style={styles.cardTextContent}>{studyQueue[currentCardIndex].back}</Text>
                        <Text style={styles.tapToFlip}>Tap card to view question</Text>
                      </View>
                    )}
                  </Pressable>
                </View>
              )}

              {/* Difficulty recall buttons */}
              {isCardFlipped && (
                <View style={styles.recallActionsRow}>
                  <Pressable
                    onPress={() => handleCardDifficulty('easy')}
                    style={[styles.recallBtn, { backgroundColor: '#10B981' }]}
                  >
                    <Ionicons name="happy-outline" size={20} color={colors.background} />
                    <Text style={styles.recallBtnText}>Easy</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleCardDifficulty('medium')}
                    style={[styles.recallBtn, { backgroundColor: '#F59E0B' }]}
                  >
                    <Ionicons name="help-circle-outline" size={20} color={colors.background} />
                    <Text style={styles.recallBtnText}>Medium</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleCardDifficulty('hard')}
                    style={[styles.recallBtn, { backgroundColor: '#EF4444' }]}
                  >
                    <Ionicons name="sad-outline" size={20} color={colors.background} />
                    <Text style={styles.recallBtnText}>Hard</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {/* Add Flashcard Modal */}
          <Modal
            visible={showAddCardModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowAddCardModal(false)}
          >
            <Pressable
              style={styles.modalOverlay}
              onPress={() => setShowAddCardModal(false)}
            >
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Add Flashcard</Text>
                <TextField
                  label="Front (Question/Term)"
                  value={cardFront}
                  onChangeText={setCardFront}
                  placeholder="e.g. What is SQL?"
                />
                <TextField
                  label="Back (Answer/Explanation)"
                  value={cardBack}
                  onChangeText={setCardBack}
                  placeholder="e.g. Structured Query Language used to manage relational databases."
                />
                <View style={styles.modalActions}>
                  <Button
                    title="Add Flashcard"
                    icon="checkmark"
                    disabled={!cardFront.trim() || !cardBack.trim()}
                    onPress={handleCreateCard}
                  />
                  <Button
                    title="Cancel"
                    icon="close"
                    variant="danger-quiet"
                    onPress={() => setShowAddCardModal(false)}
                  />
                </View>
              </View>
            </Pressable>
          </Modal>

          {/* AI Flashcards Modal */}
          <Modal
            visible={showAiCardModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowAiCardModal(false)}
          >
            <Pressable
              style={styles.modalOverlay}
              onPress={() => !isGeneratingAiCards && setShowAiCardModal(false)}
            >
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>AI Flashcards Generator</Text>
                
                {isGeneratingAiCards ? (
                  <View style={{ paddingVertical: 20, alignItems: 'center', gap: 12 }}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text, textAlign: 'center' }}>
                      Gemini is generating 5-8 revision flashcards covering this content...
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={{ fontSize: 13, color: colors.muted, fontWeight: '600', marginBottom: 8 }}>
                      Select a specific topic to study, or leave empty to auto-generate cards for the entire subject.
                    </Text>
                    
                    <ScrollView style={{ maxHeight: 200, marginBottom: 12 }} showsVerticalScrollIndicator={false}>
                      <View style={styles.topicsSelectorBox}>
                        <Pressable
                          onPress={() => setSelectedTopicIdForAi(null)}
                          style={[
                            styles.topicSelectorRow,
                            selectedTopicIdForAi === null ? styles.topicSelectorRowActive : undefined
                          ]}
                        >
                          <Ionicons
                            name={selectedTopicIdForAi === null ? 'radio-button-on' : 'radio-button-off'}
                            size={18}
                            color={selectedTopicIdForAi === null ? colors.primary : colors.muted}
                          />
                          <Text style={[
                            styles.topicSelectorText,
                            selectedTopicIdForAi === null ? styles.topicSelectorTextActive : undefined
                          ]}>Entire Subject (Full Scope)</Text>
                        </Pressable>

                        {subjectTopics.map((topic) => (
                          <Pressable
                            key={topic._id}
                            onPress={() => setSelectedTopicIdForAi(topic._id)}
                            style={[
                              styles.topicSelectorRow,
                              selectedTopicIdForAi === topic._id ? styles.topicSelectorRowActive : undefined
                            ]}
                          >
                            <Ionicons
                              name={selectedTopicIdForAi === topic._id ? 'radio-button-on' : 'radio-button-off'}
                              size={18}
                              color={selectedTopicIdForAi === topic._id ? colors.primary : colors.muted}
                            />
                            <Text style={[
                              styles.topicSelectorText,
                              selectedTopicIdForAi === topic._id ? styles.topicSelectorTextActive : undefined
                            ]}>{topic.title}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </ScrollView>

                    <View style={styles.modalActions}>
                      <Button
                        title="Generate Flashcards"
                        icon="sparkles"
                        onPress={() => {
                          if (selectedSubjectId) {
                            generateFlashcardsMutation.mutate({
                              subjectId: selectedSubjectId,
                              topicId: selectedTopicIdForAi || undefined
                            });
                          }
                        }}
                      />
                      <Button
                        title="Cancel"
                        icon="close"
                        variant="danger-quiet"
                        onPress={() => setShowAiCardModal(false)}
                      />
                    </View>
                  </>
                )}
              </View>
            </Pressable>
          </Modal>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segmentContainer: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 4
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6
  },
  segmentBtnActive: {
    backgroundColor: colors.primary
  },
  segmentBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary
  },
  segmentBtnTextActive: {
    color: colors.background
  },
  // Streak panel
  streakPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#FFFBEB'
  },
  streakTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#92400E'
  },
  streakSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
    marginTop: 2,
    lineHeight: 16
  },
  // Card layout
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    backgroundColor: colors.surface,
    gap: 12
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.text
  },
  editGoalBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary
  },
  goalsEditForm: {
    gap: 10,
    marginTop: 4
  },
  goalsProgressRow: {
    flexDirection: 'column',
    gap: 12
  },
  goalMeterContainer: {
    gap: 4
  },
  goalMeterLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text
  },
  goalMeterCount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 2
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4
  },
  // Chart styles
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 160,
    paddingTop: 10
  },
  chartCol: {
    alignItems: 'center',
    flex: 1
  },
  chartBarValue: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.muted,
    marginBottom: 4
  },
  chartBar: {
    width: 14,
    backgroundColor: '#8B5CF6',
    borderRadius: 7
  },
  chartBarLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    marginTop: 6
  },
  // Subject breakdown list
  subjectBreakdownRow: {
    gap: 4
  },
  subjectBreakdownLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  subjectBreakdownName: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text
  },
  subjectBreakdownMins: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 12
  },
  // Flashcards scrollview
  subjectsScroll: {
    maxHeight: 52,
    marginVertical: 4
  },
  subjectChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.background,
    marginRight: 6
  },
  selectedChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  chipText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14
  },
  selectedChipText: {
    color: colors.background
  },
  // Flashcard list view
  flashcardToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10
  },
  flashcardHeading: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text
  },
  addCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4
  },
  addCardBtnText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '800'
  },
  flashcardListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    gap: 12
  },
  cardListFront: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text
  },
  cardListBack: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
    marginTop: 4
  },
  diffBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 6
  },
  diffBadgeText: {
    fontSize: 10,
    fontWeight: '900'
  },
  deleteCardBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background
  },
  grow: {
    flex: 1
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  emptyHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text
  },
  emptyDesc: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 20
  },
  // Modal overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 14,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text
  },
  modalActions: {
    gap: 8,
    marginTop: 6
  },
  // Study session swiper UI
  studyModeContainer: {
    flex: 1,
    gap: 16,
    paddingTop: 10
  },
  studyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  studyCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  studyTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text
  },
  activeStudyCardFrame: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10
  },
  activeStudyCard: {
    width: '100%',
    height: '80%',
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 20,
    backgroundColor: colors.surface,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4
  },
  activeStudyCardFlipped: {
    borderColor: '#8B5CF6',
    backgroundColor: '#FAF5FF',
    shadowColor: '#8B5CF6'
  },
  cardSide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%'
  },
  sideLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 1.5,
    marginBottom: 20
  },
  sideLabelAnswer: {
    fontSize: 11,
    fontWeight: '900',
    color: '#8B5CF6',
    letterSpacing: 1.5,
    marginBottom: 20
  },
  cardTextContent: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 28,
    flex: 1
  },
  tapToFlip: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.muted,
    marginTop: 20
  },
  recallActionsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 24
  },
  recallBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  recallBtnText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '800'
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  goalUnitSelector: {
    width: 100,
    gap: 4
  },
  goalUnitLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted
  },
  goalUnitTabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
    height: 40,
    alignItems: 'center'
  },
  goalUnitTab: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6
  },
  goalUnitTabSelected: {
    backgroundColor: colors.background,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1
  },
  goalUnitTabText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.muted
  },
  goalUnitTabTextSelected: {
    color: colors.primary
  },
  topicsSelectorBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden'
  },
  topicSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    gap: 10
  },
  topicSelectorRowActive: {
    backgroundColor: '#F8FAFC'
  },
  topicSelectorText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    flex: 1
  },
  topicSelectorTextActive: {
    color: colors.primary,
    fontWeight: '800'
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  trendBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted
  },
  dualBarsFrame: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 120,
    width: 32,
    gap: 3
  },
  chartBarThis: {
    width: 8,
    backgroundColor: '#8B5CF6',
    borderRadius: 4
  },
  chartBarLast: {
    width: 8,
    backgroundColor: '#CBD5E1',
    borderRadius: 4
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  legendBox: {
    width: 10,
    height: 10,
    borderRadius: 2
  },
  legendText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    marginTop: 8
  },
  badgeCell: {
    width: '48%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface
  },
  badgeCellUnlocked: {
    borderColor: colors.border
  },
  badgeCellLocked: {
    borderColor: colors.border,
    backgroundColor: '#FAFBFD',
    opacity: 0.8
  },
  badgeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center'
  },
  badgeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center'
  },
  sessionCardHeader: {
    gap: 12,
    marginBottom: 4
  },
  sessionSummaryRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: 'hidden'
  },
  sessionSummaryBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.background
  },
  sessionSummaryValue: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text
  },
  sessionSummaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted
  },
  sessionList: {
    gap: 0,
    marginTop: 4
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  sessionDotWrapper: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sessionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary
  },
  sessionRowContent: {
    flex: 1,
    gap: 2
  },
  sessionRowTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text
  },
  sessionRowMeta: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted
  },
  sessionDurationBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  sessionDurationText: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.primary
  },
  syllabusInsightDesc: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: 8
  },
  syllabusInsightList: {
    gap: 12
  },
  syllabusInsightItem: {
    gap: 6
  },
  syllabusInsightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  syllabusInsightName: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    flex: 1,
    marginRight: 8
  },
  syllabusInsightValue: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary
  },
  syllabusBarBg: {
    height: 7,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden'
  },
  syllabusBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4
  }
});
