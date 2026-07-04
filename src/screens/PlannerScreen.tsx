import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { studyApi } from '../api/studyApi';
import { colors } from '../constants/colors';
import { isoDateInput, subjectId, subjectName } from '../utils/modelText';
import type { RootStackParamList } from '../navigation/types';
import DateTimePicker from '@react-native-community/datetimepicker';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function PlannerScreen() {
  const queryClient = useQueryClient();
  const navigation = useNavigation<Navigation>();

  const [screenSubjectFilter, setScreenSubjectFilter] = useState<string | null>(null);
  const [examDate, setExamDate] = useState(isoDateInput());
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [gridYear, setGridYear] = useState(new Date().getFullYear());
  const [gridMonth, setGridMonth] = useState(new Date().getMonth());

  const subjects = useQuery({ queryKey: ['subjects'], queryFn: studyApi.subjects });
  const exams = useQuery({ queryKey: ['exams'], queryFn: studyApi.exams });
  const notes = useQuery({ queryKey: ['brainDump'], queryFn: studyApi.brainDump });

  const createExam = useMutation({
    mutationFn: studyApi.createExam,
    onSuccess: () => {
      setEditingExamId(null);
      setExamDate(isoDateInput());
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });

  const updateExam = useMutation({
    mutationFn: ({ id, subjectId, examDate }: { id: string; subjectId: string; examDate: string }) =>
      studyApi.updateExam(id, { subjectId, examDate }),
    onSuccess: () => {
      setEditingExamId(null);
      setExamDate(isoDateInput());
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });

  const deleteExam = useMutation({
    mutationFn: studyApi.deleteExam,
    onSuccess: () => {
      setEditingExamId(null);
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });


  const resolveNote = useMutation({
    mutationFn: studyApi.resolveBrainDump,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brainDump'] })
  });

  const deleteNote = useMutation({
    mutationFn: studyApi.deleteBrainDump,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brainDump'] })
  });

  function saveExam() {
    if (!screenSubjectFilter) {
      Alert.alert('Select Subject First', 'Please select a subject from the top filter bar before adding an exam.');
      return;
    }
    // Validation
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(examDate)) {
      Alert.alert('Invalid Date Format', 'Please enter date as YYYY-MM-DD');
      return;
    }

    if (editingExamId) {
      updateExam.mutate({ id: editingExamId, subjectId: screenSubjectFilter, examDate });
      return;
    }
    createExam.mutate({ subjectId: screenSubjectFilter, examDate });
  }


  function confirmDeleteExam(id: string, name: string) {
    Alert.alert('Delete exam?', name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteExam.mutate(id) }
    ]);
  }

  function confirmDeleteNote(id: string, note: string) {
    Alert.alert('Delete note?', note, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteNote.mutate(id) }
    ]);
  }

  // Date selection helpers
  const handleQuickDateSelect = (type: 'today' | 'tomorrow' | 'nextWeek') => {
    const today = new Date();
    if (type === 'today') {
      setExamDate(isoDateInput(today));
    } else if (type === 'tomorrow') {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      setExamDate(isoDateInput(tomorrow));
    } else if (type === 'nextWeek') {
      const nextWeek = new Date(today);
      const day = today.getDay();
      const diff = today.getDate() + (day === 0 ? 1 : 8 - day);
      nextWeek.setDate(diff);
      setExamDate(isoDateInput(nextWeek));
    }
  };

  // Safe date parser to avoid timezone shift
  const parseDate = (dateStr: any) => {
    if (!dateStr) return new Date();
    let str: string;
    if (typeof dateStr === 'string') {
      str = dateStr;
    } else if (dateStr instanceof Date) {
      str = dateStr.toISOString();
    } else {
      str = String(dateStr);
    }
    const onlyDateStr = str.split('T')[0] || '';
    const date = new Date(onlyDateStr.replace(/-/g, '/'));
    if (isNaN(date.getTime())) {
      // Fallback in case of parsing issues
      return new Date(dateStr);
    }
    date.setHours(0, 0, 0, 0);
    return date;
  };

  // Helper to format YYYY-MM-DD string to readable format
  const formatDateString = (dateStr: string) => {
    const d = parseDate(dateStr);
    if (isNaN(d.getTime())) return 'Select Date';
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Helper for relative time countdown
  const getRelativeDaysText = (dateStr: string) => {
    const examDateObj = parseDate(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    examDateObj.setHours(0, 0, 0, 0);

    const diffTime = examDateObj.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 1) return `In ${diffDays} days`;
    return `${Math.abs(diffDays)} days ago`;
  };

  // Sort exams by date ascending
  const sortedExams = useMemo(() => {
    if (!exams.data) return [];
    return [...exams.data].sort((a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime());
  }, [exams.data]);

  // Screen subject filtered exams
  const filteredExams = useMemo(() => {
    const sorted = sortedExams;
    if (!screenSubjectFilter) return sorted;
    return sorted.filter(exam => {
      const subId = subjectId(exam.subjectId);
      return subId === screenSubjectFilter;
    });
  }, [sortedExams, screenSubjectFilter]);

  // Screen subject filtered notes
  const filteredNotes = useMemo(() => {
    if (!notes.data) return [];
    if (!screenSubjectFilter) return notes.data;
    return notes.data.filter(note => {
      const subId = note.subjectId && typeof note.subjectId === 'object'
        ? note.subjectId._id
        : note.subjectId;
      return subId === screenSubjectFilter;
    });
  }, [notes.data, screenSubjectFilter]);

  // Generate next 7 days starting from today for calendar strip selector
  const next7Days = useMemo(() => {
    const days = [];
    const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dayName = weekdays[d.getDay()] || 'S';
      const dayNum = d.getDate();
      const isoStr = isoDateInput(d);
      
      days.push({
        dayLetter: dayName,
        dayNum,
        isoStr,
        isToday: i === 0
      });
    }
    return days;
  }, []);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const monthGridDays = useMemo(() => {
    const days = [];
    const firstDayIndex = new Date(gridYear, gridMonth, 1).getDay(); // 0 = Sun
    const totalDays = new Date(gridYear, gridMonth + 1, 0).getDate();

    // Pad prefix cells
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ dayNum: null, isoStr: '' });
    }

    // Month days
    for (let i = 1; i <= totalDays; i++) {
      const dayStr = String(i).padStart(2, '0');
      const mStr = String(gridMonth + 1).padStart(2, '0');
      const isoStr = `${gridYear}-${mStr}-${dayStr}`;
      days.push({ dayNum: i, isoStr });
    }

    // Pad suffix cells to complete the week
    const totalCells = days.length;
    const remaining = totalCells % 7;
    if (remaining > 0) {
      for (let i = 0; i < 7 - remaining; i++) {
        days.push({ dayNum: null, isoStr: '' });
      }
    }

    return days;
  }, [gridYear, gridMonth]);

  const examsDateMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    if (!exams.data) return map;
    exams.data.forEach((exam) => {
      if (screenSubjectFilter) {
        // The subjectId can be a populated object or just an ID string.
        // We need to handle both cases to get the ID for comparison.
        const subId = subjectId(exam.subjectId);
        if (subId !== screenSubjectFilter) return;
      }
      map[exam.examDate.substring(0, 10)] = true;
    });
    return map;
  }, [exams.data, screenSubjectFilter]);

  return (
    <Screen>
      <Header title="Planner" subtitle="Exams and captured thoughts." />

      {/* ── Subject selection scrolling chips (Screen-wide filter) ── */}
      <View style={styles.subjectsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subjectsScroll}
        >
          <Pressable
            onPress={() => setScreenSubjectFilter(null)}
            style={[
              styles.subjectChip,
              screenSubjectFilter === null ? styles.selectedChip : undefined
            ]}
          >
            <Text
              style={[
                styles.chipText,
                screenSubjectFilter === null ? styles.selectedChipText : undefined
              ]}
            >
              All Subjects
            </Text>
          </Pressable>

          {subjects.data?.map((subject) => (
            <Pressable
              key={subject._id}
              onPress={() => setScreenSubjectFilter(subject._id)}
              style={[
                styles.subjectChip,
                screenSubjectFilter === subject._id ? styles.selectedChip : undefined
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  screenSubjectFilter === subject._id ? styles.selectedChipText : undefined
                ]}
              >
                {subject.name}
              </Text>
            </Pressable>
          ))}

          <Pressable
            onPress={() => navigation.navigate('Main', { screen: 'Syllabus' } as any)}
            style={({ pressed }) => [styles.addChipBtn, pressed ? styles.pressed : undefined]}
            accessibilityRole="button"
            accessibilityLabel="Manage subjects"
          >
            <Ionicons name="add" size={22} color={colors.primary} />
          </Pressable>
        </ScrollView>
      </View>

      {/* ── Exam date input card with explicit subject selector ── */}
      <View style={styles.examInputCard}>
        <Text style={styles.inputCardTitle}>
          {editingExamId ? 'Reschedule Exam' : 'Plan New Exam'}
        </Text>

        {!screenSubjectFilter && (
          <View style={styles.formInstructionsCard}>
            <Ionicons name="information-circle-outline" size={18} color={colors.primary} style={{ marginTop: 1 }} />
            <Text style={styles.formInstructionsText}>
              Tap a subject chip at the top of the screen to schedule a new exam.
            </Text>
          </View>
        )}
        
        <View style={styles.inlineForm}>
          <View style={styles.grow}>
            <Text style={styles.dateLabel}>Exam Date</Text>
            <Pressable
              disabled={!screenSubjectFilter}
              onPress={() => setShowDatePicker(true)}
              style={({ pressed }) => [
                styles.datePickerToggle,
                !screenSubjectFilter ? styles.datePickerToggleDisabled : undefined,
                pressed ? styles.pressed : undefined
              ]}
            >
              <Ionicons name="calendar-outline" size={18} color={screenSubjectFilter ? colors.primary : colors.muted} />
              <Text style={[
                styles.datePickerToggleText,
                !screenSubjectFilter ? styles.datePickerToggleTextDisabled : undefined
              ]}>
                {examDate ? formatDateString(examDate) : 'Select Date'}
              </Text>
            </Pressable>
          </View>
          <Button
            title={editingExamId ? 'Save' : 'Add'}
            icon={editingExamId ? 'checkmark' : undefined}
            disabled={!screenSubjectFilter || createExam.isPending || updateExam.isPending}
            onPress={saveExam}
          />
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={parseDate(examDate)}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) {
                setExamDate(isoDateInput(selectedDate));
              }
            }}
          />
        )}

        <View style={styles.calendarHeaderRow}>
          <Text style={styles.calendarHeaderLabel}>Calendar View</Text>
          <View style={styles.viewModeTabs}>
            <Pressable
              onPress={() => setViewMode('week')}
              style={[styles.viewModeTab, viewMode === 'week' ? styles.viewModeTabActive : undefined]}
            >
              <Text style={[styles.viewModeTabText, viewMode === 'week' ? styles.viewModeTabTextActive : undefined]}>
                Week
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setViewMode('month')}
              style={[styles.viewModeTab, viewMode === 'month' ? styles.viewModeTabActive : undefined]}
            >
              <Text style={[styles.viewModeTabText, viewMode === 'month' ? styles.viewModeTabTextActive : undefined]}>
                Month
              </Text>
            </Pressable>
          </View>
        </View>

        {viewMode === 'week' && (
          <View style={styles.calendarStrip}>
            {next7Days.map((day) => {
              const isSelected = examDate === day.isoStr;
              const hasExam = examsDateMap[day.isoStr] === true;
              return (
                <Pressable
                  key={day.isoStr}
                  onPress={() => setExamDate(day.isoStr)}
                  style={[
                    styles.calendarStripDay,
                    hasExam && !isSelected ? styles.calendarStripDayHasExam : undefined,
                    isSelected ? styles.calendarStripDaySelected : undefined,
                    day.isToday && !isSelected && !hasExam ? styles.calendarStripDayToday : undefined
                  ]}
                >
                  <Text
                    style={[
                      styles.calendarStripDayLetter,
                      hasExam && !isSelected ? styles.calendarStripDayTextHasExam : undefined,
                      isSelected ? styles.calendarStripDayTextSelected : undefined,
                      day.isToday && !isSelected && !hasExam ? styles.calendarStripDayTextToday : undefined
                    ]}
                  >
                    {day.dayLetter}
                  </Text>
                  <Text
                    style={[
                      styles.calendarStripDayNumber,
                      hasExam && !isSelected ? styles.calendarStripDayTextHasExam : undefined,
                      isSelected ? styles.calendarStripDayTextSelected : undefined,
                      day.isToday && !isSelected && !hasExam ? styles.calendarStripDayTextToday : undefined
                    ]}
                  >
                    {day.dayNum}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {viewMode === 'month' && (
          <View style={styles.monthCalendarContainer}>
            <View style={styles.monthSelectorRow}>
              <Pressable
                onPress={() => {
                  if (gridMonth === 0) {
                    setGridMonth(11);
                    setGridYear((y) => y - 1);
                  } else {
                    setGridMonth((m) => m - 1);
                  }
                }}
                style={styles.monthNavBtn}
              >
                <Ionicons name="chevron-back" size={16} color={colors.primary} />
              </Pressable>
              <Text style={styles.monthLabel}>
                {monthNames[gridMonth]} {gridYear}
              </Text>
              <Pressable
                onPress={() => {
                  if (gridMonth === 11) {
                    setGridMonth(0);
                    setGridYear((y) => y + 1);
                  } else {
                    setGridMonth((m) => m + 1);
                  }
                }}
                style={styles.monthNavBtn}
              >
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </Pressable>
            </View>

            <View style={styles.weekdayRow}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((wd, i) => (
                <Text key={i} style={styles.weekdayLabel}>{wd}</Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {monthGridDays.map((cell, idx) => {
                if (cell.dayNum === null) {
                  return <View key={`empty-${idx}`} style={styles.gridCellEmpty} />;
                }

                const isSelected = examDate === cell.isoStr;
                const hasExam = examsDateMap[cell.isoStr] === true;
                const isToday = isoDateInput() === cell.isoStr;

                return (
                  <Pressable
                    key={cell.isoStr}
                    onPress={() => {
                      setExamDate(cell.isoStr);
                    }}
                    style={[
                      styles.gridCell,
                      hasExam && !isSelected ? styles.gridCellHasExam : undefined,
                      isSelected ? styles.gridCellSelected : undefined,
                      isToday && !isSelected && !hasExam ? styles.gridCellToday : undefined
                    ]}
                  >
                    <Text
                      style={[
                        styles.gridCellText,
                        hasExam && !isSelected ? styles.gridCellTextHasExam : undefined,
                        isSelected ? styles.gridCellTextSelected : undefined,
                        isToday && !isSelected && !hasExam ? styles.gridCellTextToday : undefined
                      ]}
                    >
                      {cell.dayNum}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {editingExamId ? (
          <Button
            title="Cancel Edit"
            icon="close"
            variant="danger-quiet"
            onPress={() => {
              setEditingExamId(null);
              setExamDate(isoDateInput());
            }}
          />
        ) : null}
      </View>

      {/* ── Exams section with calendar date blocks ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Exams Checklist</Text>
        {filteredExams.length === 0 ? (
          <Text style={styles.empty}>No exams scheduled for this selection.</Text>
        ) : null}
        
        {filteredExams.map((exam) => {
          const daysLeftStr = getRelativeDaysText(exam.examDate);
          const isOverdue = daysLeftStr.includes('ago');
          const isClose = daysLeftStr === 'Today' || daysLeftStr === 'Tomorrow' || daysLeftStr.includes('In 2') || daysLeftStr.includes('In 3');
          
          // Parse date safely
          const parts = exam.examDate.split('-');
          const year = parseInt(parts[0] || '2026', 10);
          const month = parseInt(parts[1] || '01', 10) - 1;
          const day = parseInt(parts[2] || '01', 10);
          const parsedDate = new Date(year, month, day);
          const dayNum = parsedDate.getDate();
          const monthStr = parsedDate.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();

          return (
            <View key={exam._id} style={styles.examCard}>
              {/* Colored Date Ticket Block */}
              <View style={[
                styles.dateBlock,
                isOverdue ? styles.dateBlockOverdue : undefined,
                isClose && !isOverdue ? styles.dateBlockWarning : undefined
              ]}>
                <Text style={[
                  styles.dateBlockMonth,
                  isOverdue ? styles.dateBlockMonthOverdue : undefined,
                  isClose && !isOverdue ? styles.dateBlockMonthWarning : undefined
                ]}>
                  {monthStr}
                </Text>
                <Text style={[
                  styles.dateBlockDay,
                  isOverdue ? styles.dateBlockDayOverdue : undefined,
                  isClose && !isOverdue ? styles.dateBlockDayWarning : undefined
                ]}>
                  {dayNum}
                </Text>
              </View>

              {/* Exam Info Middle Column */}
              <View style={styles.examInfoCol}>
                {!screenSubjectFilter && (
                  <Text style={styles.rowTitle}>{subjectName(exam.subjectId)}</Text>
                )}
                <View style={styles.examMetaRow}>
                  <View
                    style={[
                      styles.daysBadge,
                      isOverdue ? styles.daysBadgeOverdue : undefined,
                      isClose && !isOverdue ? styles.daysBadgeWarning : undefined
                    ]}
                  >
                    <Text
                      style={[
                        styles.daysBadgeText,
                        isOverdue ? styles.daysBadgeTextOverdue : undefined,
                        isClose && !isOverdue ? styles.daysBadgeTextWarning : undefined
                      ]}
                    >
                      {daysLeftStr}
                    </Text>
                  </View>
                  <Text style={styles.examCardDateText}>
                    {parsedDate.toLocaleDateString(undefined, {
                      weekday: 'short',
                      year: 'numeric'
                    })}
                  </Text>
                </View>
              </View>
              
              {/* Exam Action Group Right Column */}
              <View style={styles.iconGroup}>
                <IconAction
                  icon="pencil-outline"
                  label="Edit exam"
                  onPress={() => {
                    setEditingExamId(exam._id);
                    setScreenSubjectFilter(subjectId(exam.subjectId));
                    setExamDate(exam.examDate);
                  }}
                />
                <IconAction
                  icon="trash-outline"
                  label="Delete exam"
                  danger
                  onPress={() => confirmDeleteExam(exam._id, subjectName(exam.subjectId))}
                />
              </View>
            </View>
          );
        })}
      </View>

      {/* ── Brain Dump capture and list section ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Brain Dump</Text>

        <View style={styles.notesList}>
          {filteredNotes.length === 0 ? (
            <Text style={styles.empty}>Capture stray thoughts so you can focus.</Text>
          ) : null}
          
          {filteredNotes.map((note) => (
            <View key={note._id} style={styles.noteRow}>
              <Pressable
                onPress={() => resolveNote.mutate(note._id)}
                disabled={note.resolved}
                style={styles.noteResolve}
              >
                <Ionicons
                  name={note.resolved ? 'checkmark-circle' : 'ellipse-outline'}
                  color={note.resolved ? colors.success : colors.muted}
                  size={22}
                />
                <View style={styles.noteDetails}>
                  {!screenSubjectFilter && note.subjectId ? (
                    <View style={styles.noteBadge}>
                      <Text style={styles.noteBadgeText}>
                        {subjectName(note.subjectId)}
                      </Text>
                    </View>
                  ) : !note.subjectId ? (
                    <View style={[styles.noteBadge, styles.generalBadge]}>
                      <Text style={styles.generalBadgeText}>General</Text>
                    </View>
                  ) : null}
                  <Text style={[styles.noteText, note.resolved ? styles.completed : undefined]}>
                    {note.note}
                  </Text>
                </View>
              </Pressable>
              
              <IconAction
                icon="trash-outline"
                label="Delete note"
                danger
                onPress={() => confirmDeleteNote(note._id, note.note)}
              />
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}

type IconActionProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
};

function IconAction({ icon, label, onPress, danger }: IconActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : undefined]}
    >
      <Ionicons name={icon} color={danger ? colors.danger : colors.primary} size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  subjectsContainer: {
    paddingVertical: 2
  },
  subjectsScroll: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center'
  },
  subjectChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surface
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
  addChipBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface
  },
  examInputCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 12
  },
  inputCardTitle: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  inlineForm: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10
  },
  grow: {
    flex: 1
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4
  },
  presetChip: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  presetText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700'
  },
  section: {
    gap: 10,
    marginTop: 8
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900'
  },
  examCard: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: colors.surface
  },
  examRightCol: {
    alignItems: 'flex-end',
    gap: 6
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800'
  },
  meta: {
    color: colors.muted,
    fontWeight: '600',
    fontSize: 13,
    marginTop: 2
  },
  daysBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  daysBadgeWarning: {
    backgroundColor: colors.warningLight
  },
  daysBadgeOverdue: {
    backgroundColor: colors.dangerLight
  },
  daysBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary
  },
  daysBadgeTextWarning: {
    color: colors.warning
  },
  daysBadgeTextOverdue: {
    color: colors.danger
  },
  captureCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: 6,
    alignItems: 'center',
    gap: 6
  },
  captureInput: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 10,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600'
  },
  captureBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  captureBtnDisabled: {
    backgroundColor: colors.border,
    opacity: 0.6
  },
  notesList: {
    gap: 8
  },
  noteRow: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface
  },
  iconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border
  },
  noteDetails: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6
  },
  noteText: {
    flex: 1,
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 18
  },
  noteBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  noteBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase'
  },
  generalBadge: {
    backgroundColor: colors.border
  },
  generalBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.muted,
    textTransform: 'uppercase'
  },
  noteResolve: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  completed: {
    color: colors.muted,
    textDecorationLine: 'line-through'
  },
  pressed: {
    opacity: 0.7
  },
  empty: {
    color: colors.muted,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 6,
    fontSize: 13
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4
  },
  formSubjectChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background
  },
  formSubjectChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  formSubjectChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text
  },
  formSubjectChipTextSelected: {
    color: colors.background,
    fontWeight: '800'
  },
  dateBlock: {
    width: 52,
    height: 56,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E7FF'
  },
  dateBlockMonth: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase'
  },
  dateBlockDay: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.primary,
    marginTop: 2
  },
  dateBlockOverdue: {
    backgroundColor: colors.dangerLight,
    borderColor: '#FEE2E2'
  },
  dateBlockMonthOverdue: {
    color: colors.danger
  },
  dateBlockDayOverdue: {
    color: colors.danger
  },
  dateBlockWarning: {
    backgroundColor: colors.warningLight,
    borderColor: '#FEF3C7'
  },
  dateBlockMonthWarning: {
    color: colors.warning
  },
  dateBlockDayWarning: {
    color: colors.warning
  },
  examInfoCol: {
    flex: 1,
    gap: 4
  },
  examMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap'
  },
  examCardDateText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted
  },
  formActiveSubjectRow: {
    marginVertical: 4,
    gap: 4
  },
  formActiveSubjectTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border
  },
  formActiveSubjectValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text
  },
  calendarStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 2
  },
  calendarStripDay: {
    width: 40,
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2
  },
  calendarStripDayHasExam: {
    backgroundColor: colors.warningLight,
    borderColor: colors.warning
  },
  calendarStripDaySelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  calendarStripDayToday: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight
  },
  calendarStripDayLetter: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.muted,
    textTransform: 'uppercase'
  },
  calendarStripDayNumber: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text
  },
  calendarStripDayTextSelected: {
    color: colors.background
  },
  calendarStripDayTextToday: {
    color: colors.primary
  },
  calendarStripDayTextHasExam: {
    color: colors.warning,
    fontWeight: '900'
  },
  formInstructionsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C7D2FE'
  },
  formInstructionsText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '700',
    flex: 1
  },
  dateLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4
  },
  datePickerToggle: {
    height: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  datePickerToggleDisabled: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    opacity: 0.6
  },
  datePickerToggleText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text
  },
  datePickerToggleTextDisabled: {
    color: colors.muted
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10
  },
  calendarHeaderLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text
  },
  viewModeTabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
    alignItems: 'center'
  },
  viewModeTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  viewModeTabActive: {
    backgroundColor: colors.background,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1
  },
  viewModeTabText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.muted
  },
  viewModeTabTextActive: {
    color: colors.primary
  },
  monthCalendarContainer: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.surface
  },
  monthSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  monthLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text
  },
  monthNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9'
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  weekdayLabel: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8
  },
  gridCell: {
    width: '14.28%',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    position: 'relative'
  },
  gridCellEmpty: {
    width: '14.28%',
    height: 38
  },
  gridCellSelected: {
    backgroundColor: colors.primary
  },
  gridCellToday: {
    borderWidth: 1.5,
    borderColor: colors.primary
  },
  gridCellHasExam: {
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  gridCellText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text
  },
  gridCellTextSelected: {
    color: colors.background,
    fontWeight: '900'
  },
  gridCellTextToday: {
    color: colors.primary,
    fontWeight: '900'
  },
  gridCellTextHasExam: {
    color: colors.warning,
    fontWeight: '900'
  },
});
