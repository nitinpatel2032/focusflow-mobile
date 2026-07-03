import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { studyApi } from '../api/studyApi';
import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { colors } from '../constants/colors';
import { PRESET_COURSES, PresetTopic } from '../constants/presets';

const GENERIC_SUGGESTIONS: PresetTopic[] = [
  { title: 'Textbook Reading & Note-taking', estimatedMinutes: 45 },
  { title: 'Practice Problems & Exercises', estimatedMinutes: 60 },
  { title: 'Active Recall Revision & Flashcards', estimatedMinutes: 30 },
  { title: 'Mock Exam & Past Paper Practice', estimatedMinutes: 120 }
];

export function SyllabusScreen() {
  const queryClient = useQueryClient();
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>();
  const [topicTitle, setTopicTitle] = useState('');
  const [durationValue, setDurationValue] = useState('45');
  const [durationUnit, setDurationUnit] = useState<'min' | 'hr'>('min');
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);

  const [isGeneratingCards, setIsGeneratingCards] = useState(false);

  const generateFlashcards = useMutation({
    mutationFn: (payload: { subjectId: string; topicId: string; topicTitle: string }) =>
      studyApi.generateFlashcards(payload.subjectId, payload.topicId),
    onMutate: () => {
      setIsGeneratingCards(true);
    },
    onSuccess: (data, variables) => {
      setIsGeneratingCards(false);
      Alert.alert(
        'AI Cards Ready',
        `Successfully generated and saved ${data.length} flashcards covering "${variables.topicTitle}"!`
      );
    },
    onError: (err: any) => {
      setIsGeneratingCards(false);
      Alert.alert('Generation Failed', err.message || 'Failed to generate flashcards.');
    }
  });

  // Smart suggestions state
  const [showPresetsModal, setShowPresetsModal] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState('cs');
  const [checkedPresetSubjects, setCheckedPresetSubjects] = useState<string[]>([]);
  
  const [showTopicSuggestions, setShowTopicSuggestions] = useState(false);
  const [selectedSuggestedTitles, setSelectedSuggestedTitles] = useState<string[]>([]);

  // AI Suggestions states
  const [activeSuggestionTab, setActiveSuggestionTab] = useState<'presets' | 'ai'>('presets');
  const [aiTopics, setAiTopics] = useState<Array<{ title: string; estimatedMinutes: number }>>([]);
  const [selectedAiSuggestedTitles, setSelectedAiSuggestedTitles] = useState<string[]>([]);

  // AI Course presets states
  const [customCourseInput, setCustomCourseInput] = useState('');
  const [aiCourseSubjects, setAiCourseSubjects] = useState<Array<{ name: string; topics: Array<{ title: string; estimatedMinutes: number }> }>>([]);
  const [checkedAiPresetSubjects, setCheckedAiPresetSubjects] = useState<string[]>([]);
  const [activeCoursePresetTab, setActiveCoursePresetTab] = useState<'presets' | 'ai'>('presets');

  // Subject inline form — hidden by default, revealed only on tap
  const [showSubjectInput, setShowSubjectInput] = useState(false);
  const [subjectName, setSubjectName] = useState('');
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const subjectInputRef = useRef<TextInput>(null);

  const subjects = useQuery({ queryKey: ['subjects'], queryFn: studyApi.subjects });
  const topics = useQuery({
    queryKey: ['topics', selectedSubjectId],
    queryFn: () => studyApi.topics(selectedSubjectId),
    enabled: Boolean(selectedSubjectId)
  });
  const progress = useQuery({ queryKey: ['progress'], queryFn: studyApi.progress });

  // Auto-select first subject on load
  useEffect(() => {
    if (!selectedSubjectId && subjects.data?.[0]) {
      setSelectedSubjectId(subjects.data[0]._id);
    }
  }, [selectedSubjectId, subjects.data]);

  // Auto-focus when input card opens
  useEffect(() => {
    if (showSubjectInput) {
      const t = setTimeout(() => subjectInputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [showSubjectInput]);

  const selectedProgress = useMemo(
    () => progress.data?.find((p) => p.subjectId === selectedSubjectId)?.percent ?? 0,
    [progress.data, selectedSubjectId]
  );

  const selectedSubject = subjects.data?.find((s) => s._id === selectedSubjectId);

  // Preset subject lookup
  const presetSubjectMatch = useMemo(() => {
    if (!selectedSubject) return null;
    for (const course of PRESET_COURSES) {
      const match = course.subjects.find(
        (s) => s.name.toLowerCase() === selectedSubject.name.toLowerCase()
      );
      if (match) return match;
    }
    return null;
  }, [selectedSubject]);

  const suggestedTopics = useMemo(() => {
    if (presetSubjectMatch) return presetSubjectMatch.topics;
    return GENERIC_SUGGESTIONS;
  }, [presetSubjectMatch]);

  const unimportedSuggestedTopics = useMemo(() => {
    const existingTitles = new Set(
      (topics.data || []).map((t) => t.title.trim().toLowerCase())
    );
    return suggestedTopics.filter((t) => !existingTitles.has(t.title.trim().toLowerCase()));
  }, [suggestedTopics, topics.data]);

  const unimportedAiTopics = useMemo(() => {
    const existingTitles = new Set(
      (topics.data || []).map((t) => t.title.trim().toLowerCase())
    );
    return aiTopics.filter((t) => !existingTitles.has(t.title.trim().toLowerCase()));
  }, [aiTopics, topics.data]);

  const selectedCourse = useMemo(() => {
    return PRESET_COURSES.find((c) => c.id === selectedCourseId) || PRESET_COURSES[0]!;
  }, [selectedCourseId]);

  const existingSubjectNames = useMemo(() => {
    return new Set((subjects.data || []).map((s) => s.name.trim().toLowerCase()));
  }, [subjects.data]);

  // Auto-detect course category based on what subject user has added
  useEffect(() => {
    if (!subjects.data || subjects.data.length === 0) return;
    const names = subjects.data.map((s) => s.name.trim().toLowerCase());
    for (const course of PRESET_COURSES) {
      const match = course.subjects.some((sub) =>
        names.includes(sub.name.trim().toLowerCase())
      );
      if (match) {
        setSelectedCourseId(course.id);
        break;
      }
    }
  }, [subjects.data]);

  const unimportedPresetSubjects = useMemo(() => {
    if (!selectedCourse) return [];
    return selectedCourse.subjects.filter(
      (sub) => !existingSubjectNames.has(sub.name.trim().toLowerCase())
    );
  }, [selectedCourse, existingSubjectNames]);

  const unimportedAiPresetSubjects = useMemo(() => {
    return aiCourseSubjects.filter(
      (sub) => !existingSubjectNames.has(sub.name.trim().toLowerCase())
    );
  }, [aiCourseSubjects, existingSubjectNames]);

  // Sync presets checked subjects when unimported presets list changes
  useEffect(() => {
    setCheckedPresetSubjects(unimportedPresetSubjects.map((s) => s.name));
  }, [unimportedPresetSubjects]);

  // Reset presets AI states when modal toggles
  useEffect(() => {
    if (!showPresetsModal) {
      setCustomCourseInput('');
      setAiCourseSubjects([]);
      setCheckedAiPresetSubjects([]);
      setActiveCoursePresetTab('presets');
    }
  }, [showPresetsModal]);

  // Sync suggestion checklist when suggestions drawer opens or subject changes
  useEffect(() => {
    setSelectedSuggestedTitles(unimportedSuggestedTopics.map((t) => t.title));
    setAiTopics([]);
    setSelectedAiSuggestedTitles([]);
    setActiveSuggestionTab('presets');
  }, [selectedSubjectId, showTopicSuggestions, unimportedSuggestedTopics]);

  // ── Subject actions ──────────────────────────────────────────────
  function openAddSubject() {
    setEditingSubjectId(null);
    setSubjectName('');
    setShowSubjectInput(true);
  }

  function openEditSubject() {
    if (!selectedSubject) return;
    setEditingSubjectId(selectedSubject._id);
    setSubjectName(selectedSubject.name);
    setShowSubjectInput(true);
  }

  function cancelSubjectInput() {
    setShowSubjectInput(false);
    setSubjectName('');
    setEditingSubjectId(null);
  }

  function resetTopicForm() {
    setTopicTitle('');
    setDurationValue('45');
    setDurationUnit('min');
    setEditingTopicId(null);
  }

  // ── Mutations ────────────────────────────────────────────────────
  const createSubject = useMutation({
    mutationFn: studyApi.createSubject,
    onSuccess: (subject) => {
      cancelSubjectInput();
      setSelectedSubjectId(subject._id);
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    }
  });

  const updateSubject = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => studyApi.updateSubject(id, name),
    onSuccess: () => {
      cancelSubjectInput();
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });

  const deleteSubject = useMutation({
    mutationFn: studyApi.deleteSubject,
    onSuccess: () => {
      cancelSubjectInput();
      resetTopicForm();
      setSelectedSubjectId(undefined);
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['exams'] });
    }
  });

  // Bulk import mutations
  const importSubjects = useMutation({
    mutationFn: async (names: string[]) => {
      const imported = [];
      for (const name of names) {
        const res = await studyApi.createSubject(name);
        // Bulk import recommended topics as well
        const match = PRESET_COURSES.flatMap(c => c.subjects).find(s => s.name === name);
        if (match && match.topics.length > 0) {
          for (const t of match.topics) {
            await studyApi.createTopic({
              subjectId: res._id,
              title: t.title,
              estimatedMinutes: t.estimatedMinutes
            });
          }
        }
        imported.push(res);
      }
      return imported;
    },
    onSuccess: (importedList) => {
      setShowSubjectInput(false);
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      const first = importedList[0];
      if (first) {
        setSelectedSubjectId(first._id);
        Alert.alert('Import Success', `Added ${importedList.length} subjects with recommended topics!`);
      }
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to import subjects.');
    }
  });

  const importTopics = useMutation({
    mutationFn: async (payloads: Array<{ subjectId: string; title: string; estimatedMinutes: number }>) => {
      const imported = [];
      for (const p of payloads) {
        const res = await studyApi.createTopic(p);
        imported.push(res);
      }
      return imported;
    },
    onSuccess: (importedList) => {
      setShowTopicSuggestions(false);
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      Alert.alert('Success', `Added ${importedList.length} topics to your syllabus!`);
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to import topics.');
    }
  });

  const fetchAiSuggestions = useMutation({
    mutationFn: studyApi.suggestTopics,
    onSuccess: (data) => {
      if (data.aiGenerated && data.topics && data.topics.length > 0) {
        setAiTopics(data.topics);
        const existingTitles = new Set(
          (topics.data || []).map((t) => t.title.trim().toLowerCase())
        );
        const unimported = data.topics.filter(
          (t) => !existingTitles.has(t.title.trim().toLowerCase())
        );
        setSelectedAiSuggestedTitles(unimported.map((t) => t.title));
      } else {
        Alert.alert(
          'Gemini AI Required',
          'Gemini API key is not configured or failed on the backend. Please add GEMINI_API_KEY to the backend .env file.',
          [
            { text: 'OK' },
            { text: 'Use Standard Presets', onPress: () => setActiveSuggestionTab('presets') }
          ]
        );
      }
    },
    onError: (err: any) => {
      Alert.alert(
        'AI Generation Failed',
        err.message || 'Could not fetch topics from Gemini AI. Please check your network and try again.'
      );
    }
  });

  function toggleAiSuggestedTopic(title: string) {
    if (selectedAiSuggestedTitles.includes(title)) {
      setSelectedAiSuggestedTitles(selectedAiSuggestedTitles.filter((t) => t !== title));
    } else {
      setSelectedAiSuggestedTitles([...selectedAiSuggestedTitles, title]);
    }
  }

  const importAiSubjects = useMutation({
    mutationFn: async (selectedSubjects: Array<{ name: string; topics: Array<{ title: string; estimatedMinutes: number }> }>) => {
      const imported = [];
      for (const sub of selectedSubjects) {
        const res = await studyApi.createSubject(sub.name);
        if (sub.topics && sub.topics.length > 0) {
          for (const t of sub.topics) {
            await studyApi.createTopic({
              subjectId: res._id,
              title: t.title,
              estimatedMinutes: t.estimatedMinutes
            });
          }
        }
        imported.push(res);
      }
      return imported;
    },
    onSuccess: (importedList) => {
      setShowSubjectInput(false);
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      const first = importedList[0];
      if (first) {
        setSelectedSubjectId(first._id);
        Alert.alert('Import Success', `Added ${importedList.length} subjects with AI suggested topics!`);
      }
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to import AI subjects.');
    }
  });

  const fetchAiCourseSubjects = useMutation({
    mutationFn: studyApi.suggestCourse,
    onSuccess: (data) => {
      if (data.aiGenerated && data.subjects && data.subjects.length > 0) {
        setAiCourseSubjects(data.subjects);
        const existing = new Set((subjects.data || []).map((s) => s.name.trim().toLowerCase()));
        const unimported = data.subjects.filter(
          (sub) => !existing.has(sub.name.trim().toLowerCase())
        );
        setCheckedAiPresetSubjects(unimported.map((s) => s.name));
      } else {
        Alert.alert(
          'Gemini AI Required',
          'Gemini API key is not configured or failed on the backend. Please add GEMINI_API_KEY to the backend .env file.',
          [
            { text: 'OK' },
            { text: 'Use Standard Library', onPress: () => setActiveCoursePresetTab('presets') }
          ]
        );
      }
    },
    onError: (err: any) => {
      Alert.alert(
        'AI Generation Failed',
        err.message || 'Could not fetch course subjects from Gemini AI. Please check your network and try again.'
      );
    }
  });

  function toggleAiPresetSubject(name: string) {
    if (checkedAiPresetSubjects.includes(name)) {
      setCheckedAiPresetSubjects(checkedAiPresetSubjects.filter((n) => n !== name));
    } else {
      setCheckedAiPresetSubjects([...checkedAiPresetSubjects, name]);
    }
  }

  function handleImportAiSubjects() {
    if (checkedAiPresetSubjects.length === 0) return;
    const toImport = aiCourseSubjects.filter((s) => checkedAiPresetSubjects.includes(s.name));
    importAiSubjects.mutate(toImport);
  }

  function handleImportSubjects() {
    if (checkedPresetSubjects.length === 0) return;
    importSubjects.mutate(checkedPresetSubjects);
  }

  function togglePresetSubject(name: string) {
    if (checkedPresetSubjects.includes(name)) {
      setCheckedPresetSubjects(checkedPresetSubjects.filter((n) => n !== name));
    } else {
      setCheckedPresetSubjects([...checkedPresetSubjects, name]);
    }
  }

  function handleImportSuggestedTopics() {
    if (!selectedSubjectId) return;
    
    if (activeSuggestionTab === 'presets') {
      if (selectedSuggestedTitles.length === 0) return;
      const payloads = unimportedSuggestedTopics
        .filter((topic) => selectedSuggestedTitles.includes(topic.title))
        .map((topic) => ({
          subjectId: selectedSubjectId,
          title: topic.title,
          estimatedMinutes: topic.estimatedMinutes
        }));
      importTopics.mutate(payloads);
    } else {
      if (selectedAiSuggestedTitles.length === 0) return;
      const payloads = unimportedAiTopics
        .filter((topic) => selectedAiSuggestedTitles.includes(topic.title))
        .map((topic) => ({
          subjectId: selectedSubjectId,
          title: topic.title,
          estimatedMinutes: topic.estimatedMinutes
        }));
      importTopics.mutate(payloads);
    }
  }

  function toggleSuggestedTopic(title: string) {
    if (selectedSuggestedTitles.includes(title)) {
      setSelectedSuggestedTitles(selectedSuggestedTitles.filter((t) => t !== title));
    } else {
      setSelectedSuggestedTitles([...selectedSuggestedTitles, title]);
    }
  }

  const saveTopic = useMutation({
    mutationFn: ({
      id,
      subjectId,
      title,
      estimatedMinutes
    }: {
      id?: string;
      subjectId: string;
      title: string;
      estimatedMinutes: number;
    }) =>
      id
        ? studyApi.updateTopic(id, { title, estimatedMinutes })
        : studyApi.createTopic({ subjectId, title, estimatedMinutes }),
    onSuccess: () => {
      resetTopicForm();
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });

  const updateTopic = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      studyApi.updateTopic(id, { completed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });

  const deleteTopic = useMutation({
    mutationFn: studyApi.deleteTopic,
    onSuccess: () => {
      resetTopicForm();
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });

  // ── Handlers ─────────────────────────────────────────────────────
  function saveSubject() {
    const name = subjectName.trim();
    if (!name) return;
    if (editingSubjectId) {
      updateSubject.mutate({ id: editingSubjectId, name });
    } else {
      createSubject.mutate(name);
    }
  }

  function confirmDeleteSubject() {
    if (!selectedSubject) return;
    Alert.alert(
      'Delete subject?',
      `"${selectedSubject.name}" and all its topics will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteSubject.mutate(selectedSubject._id)
        }
      ]
    );
  }

  function saveSelectedTopic() {
    if (!selectedSubjectId || !topicTitle.trim()) return;
    
    const rawVal = parseFloat(durationValue) || 0;
    const estimatedMinutes = durationUnit === 'hr' ? Math.round(rawVal * 60) : Math.round(rawVal);

    if (estimatedMinutes <= 0) {
      Alert.alert('Invalid Duration', 'Please enter a valid study duration.');
      return;
    }

    saveTopic.mutate({
      id: editingTopicId ?? undefined,
      subjectId: selectedSubjectId,
      title: topicTitle.trim(),
      estimatedMinutes
    });
  }

  function confirmDeleteTopic(id: string, title: string) {
    Alert.alert('Delete topic?', title, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteTopic.mutate(id) }
    ]);
  }

  const isSavingSubject = createSubject.isPending || updateSubject.isPending;

  return (
    <Screen>
      <Header title="Syllabus" subtitle={`${selectedProgress}% complete`} />

      {/* ── Subject chips + add button ─────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.subjectsScroll}
      >
        {subjects.data?.map((subject) => (
          <Pressable
            key={subject._id}
            onPress={() => {
              setSelectedSubjectId(subject._id);
              setShowSubjectInput(false);
            }}
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

        {/* "+" icon at the end of the chip row */}
        <Pressable
          onPress={openAddSubject}
          style={({ pressed }) => [styles.addChipBtn, pressed ? styles.pressed : undefined]}
          accessibilityRole="button"
          accessibilityLabel="Add new subject"
        >
          <Ionicons name="add" size={22} color={colors.primary} />
        </Pressable>
      </ScrollView>

      {/* ── Inline subject input card ─────────────────────────── */}
      {showSubjectInput ? (
        <View style={styles.subjectInputCard}>
          <Text style={styles.subjectInputHeading}>
            {editingSubjectId ? 'Rename subject' : 'New subject'}
          </Text>
          <View style={styles.subjectInputRow}>
            <TextInput
              ref={subjectInputRef}
              value={subjectName}
              onChangeText={setSubjectName}
              placeholder="e.g. Physics"
              placeholderTextColor={colors.muted}
              style={styles.subjectTextInput}
              returnKeyType="done"
              onSubmitEditing={saveSubject}
              autoCapitalize="words"
            />
            <Pressable
              onPress={saveSubject}
              disabled={!subjectName.trim() || isSavingSubject}
              style={({ pressed }) => [
                styles.inputActionBtn,
                styles.inputSaveBtn,
                (!subjectName.trim() || isSavingSubject) ? styles.inputBtnDisabled : undefined,
                pressed ? styles.pressed : undefined
              ]}
              accessibilityLabel="Save subject"
            >
              <Ionicons name="checkmark" size={18} color={colors.background} />
            </Pressable>
            <Pressable
              onPress={cancelSubjectInput}
              style={({ pressed }) => [
                styles.inputActionBtn,
                styles.inputCancelBtn,
                pressed ? styles.pressed : undefined
              ]}
              accessibilityLabel="Cancel"
            >
              <Ionicons name="close" size={18} color={colors.danger} />
            </Pressable>
          </View>

          {/* Inline course preset library block when creating a new subject */}
          {!editingSubjectId && (
            <View style={styles.inlinePresetsContainer}>
              <View style={styles.inlineDivider} />
              <Text style={styles.inlinePresetsHeading}>Or Import a Course Template</Text>
              
              <View style={styles.suggestionTabs}>
                <Pressable
                  onPress={() => setActiveCoursePresetTab('presets')}
                  style={[
                    styles.suggestionTab,
                    activeCoursePresetTab === 'presets' ? styles.suggestionTabActive : undefined
                  ]}
                >
                  <Ionicons
                    name="library-outline"
                    size={14}
                    color={activeCoursePresetTab === 'presets' ? colors.background : colors.primary}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.suggestionTabText,
                      activeCoursePresetTab === 'presets' ? styles.suggestionTabTextActive : undefined
                    ]}
                  >
                    Standard Library
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setActiveCoursePresetTab('ai')}
                  style={[
                    styles.suggestionTab,
                    activeCoursePresetTab === 'ai' ? styles.suggestionTabActive : undefined
                  ]}
                >
                  <Ionicons
                    name="sparkles"
                    size={14}
                    color={activeCoursePresetTab === 'ai' ? colors.background : '#8B5CF6'}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.suggestionTabText,
                      activeCoursePresetTab === 'ai' ? styles.suggestionTabTextActive : undefined
                    ]}
                  >
                    AI Course Suggest
                  </Text>
                </Pressable>
              </View>

              {activeCoursePresetTab === 'presets' ? (
                <>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.coursesTabScroll}
                    style={{ marginVertical: 8 }}
                  >
                    {PRESET_COURSES.map((course) => {
                      const isSelected = selectedCourseId === course.id;
                      return (
                        <Pressable
                          key={course.id}
                          onPress={() => setSelectedCourseId(course.id)}
                          style={[
                            styles.courseTabItem,
                            isSelected ? styles.courseTabItemActive : undefined
                          ]}
                        >
                          <Ionicons
                            name={course.icon as any}
                            size={18}
                            color={isSelected ? colors.background : colors.primary}
                          />
                          <Text
                            style={[
                              styles.courseTabText,
                              isSelected ? styles.courseTabTextActive : undefined
                            ]}
                          >
                            {course.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  {unimportedPresetSubjects.length === 0 ? (
                    <View style={{ paddingVertical: 20, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <Ionicons name="checkmark-done-circle-outline" size={32} color={colors.success} />
                      <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>All subjects imported</Text>
                      <Text style={{ fontSize: 11, color: colors.muted, textAlign: 'center', paddingHorizontal: 20 }}>
                        You have already imported all subjects from this course library template.
                      </Text>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.inlineChecklistTitle}>Select subjects to import:</Text>
                      <ScrollView 
                        style={{ maxHeight: 220 }} 
                        showsVerticalScrollIndicator={false}
                        nestedScrollEnabled
                      >
                        <View style={styles.inlineSubjectsChecklist}>
                          {unimportedPresetSubjects.map((sub) => {
                            const isChecked = checkedPresetSubjects.includes(sub.name);
                            return (
                              <Pressable
                                key={sub.name}
                                onPress={() => togglePresetSubject(sub.name)}
                                style={styles.checklistRow}
                              >
                                <Ionicons
                                  name={isChecked ? 'checkmark-circle' : 'ellipse-outline'}
                                  color={isChecked ? colors.primary : colors.muted}
                                  size={20}
                                />
                                <View style={styles.grow}>
                                  <Text style={styles.checklistRowText}>{sub.name}</Text>
                                  <Text style={styles.checklistRowSub}>{sub.topics.length} recommended topics</Text>
                                </View>
                              </Pressable>
                            );
                          })}
                        </View>
                      </ScrollView>
                      
                      <Button
                        title={`Import Checked Subjects (${checkedPresetSubjects.length})`}
                        icon="checkmark"
                        disabled={checkedPresetSubjects.length === 0 || importSubjects.isPending}
                        onPress={handleImportSubjects}
                      />
                    </>
                  )}
                </>
              ) : (
                <>
                  <View style={[styles.subjectInputRow, { marginTop: 8 }]}>
                    <TextInput
                      value={customCourseInput}
                      onChangeText={setCustomCourseInput}
                      placeholder="e.g. AI Engineering, Data Science"
                      placeholderTextColor={colors.muted}
                      style={[styles.subjectTextInput, { height: 52 }]}
                    />
                    <Button
                      title="Generate"
                      icon="sparkles"
                      disabled={!customCourseInput.trim() || fetchAiCourseSubjects.isPending}
                      onPress={() => fetchAiCourseSubjects.mutate(customCourseInput.trim())}
                    />
                  </View>

                  {fetchAiCourseSubjects.isPending ? (
                    <View style={styles.loaderContainer}>
                      <ActivityIndicator size="small" color="#8B5CF6" />
                      <Text style={styles.loaderText}>Asking Gemini AI to build course...</Text>
                    </View>
                  ) : aiCourseSubjects.length === 0 ? (
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>Type a course name above and tap Generate to construct custom subjects using AI.</Text>
                    </View>
                  ) : unimportedAiPresetSubjects.length === 0 ? (
                    <View style={{ paddingVertical: 20, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <Ionicons name="checkmark-done-circle-outline" size={32} color={colors.success} />
                      <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>All AI subjects imported</Text>
                      <Text style={{ fontSize: 11, color: colors.muted, textAlign: 'center', paddingHorizontal: 20 }}>
                        You have already imported all of the AI generated subjects from this suggest list.
                      </Text>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.inlineChecklistTitle}>AI Suggested Subjects:</Text>
                      <ScrollView 
                        style={{ maxHeight: 220 }} 
                        showsVerticalScrollIndicator={false}
                        nestedScrollEnabled
                      >
                        <View style={styles.inlineSubjectsChecklist}>
                          {unimportedAiPresetSubjects.map((sub) => {
                            const isChecked = checkedAiPresetSubjects.includes(sub.name);
                            return (
                              <Pressable
                                key={sub.name}
                                onPress={() => toggleAiPresetSubject(sub.name)}
                                style={styles.checklistRow}
                              >
                                <Ionicons
                                  name={isChecked ? 'checkmark-circle' : 'ellipse-outline'}
                                  color={isChecked ? colors.primary : colors.muted}
                                  size={20}
                                />
                                <View style={styles.grow}>
                                  <Text style={styles.checklistRowText}>{sub.name}</Text>
                                  <Text style={styles.checklistRowSub}>{sub.topics.length} AI suggested topics</Text>
                                </View>
                              </Pressable>
                            );
                          })}
                        </View>
                      </ScrollView>

                      <Button
                        title={`Import Checked AI Subjects (${checkedAiPresetSubjects.length})`}
                        icon="checkmark"
                        disabled={checkedAiPresetSubjects.length === 0 || importAiSubjects.isPending}
                        onPress={handleImportAiSubjects}
                      />
                    </>
                  )}
                </>
              )}
            </View>
          )}
        </View>
      ) : null}

      {/* ── Selected subject header + edit/delete actions ──────── */}
      {selectedSubject && !showSubjectInput ? (
        <View style={styles.selectedSubjectRow}>
          <Text style={styles.selectedSubjectName}>{selectedSubject.name}</Text>
          <View style={styles.iconGroup}>
            <IconAction icon="pencil-outline" label="Rename subject" onPress={openEditSubject} />
            <IconAction
              icon="trash-outline"
              label="Delete subject"
              danger
              onPress={confirmDeleteSubject}
            />
          </View>
        </View>
      ) : null}

      {/* ── Topic form + list (only when a subject is selected) ── */}
      {selectedSubjectId && !showSubjectInput ? (
        <>
          <View style={styles.inline}>
            <View style={styles.grow}>
              <TextField
                label="Topic"
                value={topicTitle}
                onChangeText={setTopicTitle}
                placeholder="Topic name"
              />
            </View>
            <View style={styles.durationBox}>
              <View style={styles.durationInputWrapper}>
                <TextField
                  label="Duration"
                  value={durationValue}
                  onChangeText={setDurationValue}
                  keyboardType="decimal-pad"
                  placeholder="45"
                />
              </View>
              <View style={styles.unitSelector}>
                <Text style={styles.unitSelectorLabel}>Unit</Text>
                <View style={styles.unitTabs}>
                  <Pressable
                    onPress={() => setDurationUnit('min')}
                    style={[
                      styles.unitTab,
                      durationUnit === 'min' ? styles.unitTabSelected : undefined
                    ]}
                  >
                    <Text
                      style={[
                        styles.unitTabText,
                        durationUnit === 'min' ? styles.unitTabTextSelected : undefined
                      ]}
                    >
                      Min
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setDurationUnit('hr')}
                    style={[
                      styles.unitTab,
                      durationUnit === 'hr' ? styles.unitTabSelected : undefined
                    ]}
                  >
                    <Text
                      style={[
                        styles.unitTabText,
                        durationUnit === 'hr' ? styles.unitTabTextSelected : undefined
                      ]}
                    >
                      Hr
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>

          <Button
            title={editingTopicId ? 'Save Topic' : 'Add Topic'}
            icon={editingTopicId ? 'checkmark' : 'add-circle-outline'}
            disabled={!topicTitle.trim() || saveTopic.isPending}
            onPress={saveSelectedTopic}
          />

          {editingTopicId ? (
            <Button title="Cancel Edit" icon="close" variant="danger-quiet" onPress={resetTopicForm} />
          ) : null}

          {/* ✨ Topic Suggestions Trigger Button */}
          {selectedSubject && !editingTopicId && (
            <>
              <Pressable
                onPress={() => setShowTopicSuggestions(!showTopicSuggestions)}
                style={({ pressed }) => [styles.suggestTriggerBtn, pressed ? styles.pressed : undefined]}
              >
                <Ionicons name="sparkles-outline" size={16} color="#8B5CF6" />
                <Text style={styles.suggestTriggerBtnText}>
                  {showTopicSuggestions ? 'Hide Recommended Topics' : 'Auto-Suggest Topics'}
                </Text>
                <Ionicons name={showTopicSuggestions ? 'chevron-up' : 'chevron-down'} size={16} color="#8B5CF6" />
              </Pressable>

              {showTopicSuggestions && (
                <View style={styles.suggestionsCard}>
                  <Text style={styles.suggestionsTitle}>Suggestions for {selectedSubject.name}</Text>
                  
                  {/* Tab selectors for Offline vs AI */}
                  <View style={styles.suggestionTabs}>
                    <Pressable
                      onPress={() => setActiveSuggestionTab('presets')}
                      style={[
                        styles.suggestionTab,
                        activeSuggestionTab === 'presets' ? styles.suggestionTabActive : undefined
                      ]}
                    >
                      <Ionicons
                        name="list-outline"
                        size={14}
                        color={activeSuggestionTab === 'presets' ? colors.background : colors.primary}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.suggestionTabText,
                          activeSuggestionTab === 'presets' ? styles.suggestionTabTextActive : undefined
                        ]}
                      >
                        Standard Presets
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setActiveSuggestionTab('ai');
                        if (aiTopics.length === 0 && !fetchAiSuggestions.isPending) {
                          fetchAiSuggestions.mutate({
                            subjectName: selectedSubject.name,
                            existingTopics: topics.data?.map((t) => t.title) || []
                          });
                        }
                      }}
                      style={[
                        styles.suggestionTab,
                        activeSuggestionTab === 'ai' ? styles.suggestionTabActive : undefined
                      ]}
                    >
                      <Ionicons
                        name="sparkles"
                        size={14}
                        color={activeSuggestionTab === 'ai' ? colors.background : '#8B5CF6'}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.suggestionTabText,
                          activeSuggestionTab === 'ai' ? styles.suggestionTabTextActive : undefined
                        ]}
                      >
                        AI Suggest (Gemini)
                      </Text>
                    </Pressable>
                  </View>

                  {activeSuggestionTab === 'presets' ? (
                    <>
                      {unimportedSuggestedTopics.length === 0 ? (
                        <View style={{ paddingVertical: 20, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          <Ionicons name="checkmark-done-circle-outline" size={32} color={colors.success} />
                          <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>All standard topics imported</Text>
                          <Text style={{ fontSize: 12, color: colors.muted, textAlign: 'center' }}>
                            You have already added all standard recommended topics to this subject.
                          </Text>
                        </View>
                      ) : (
                        <>
                          <Text style={styles.suggestionsDesc}>Check the topics you want to add to your plan:</Text>
                          <View style={styles.suggestionsList}>
                            {unimportedSuggestedTopics.map((topic) => {
                              const isChecked = selectedSuggestedTitles.includes(topic.title);
                              return (
                                <Pressable
                                  key={topic.title}
                                  onPress={() => toggleSuggestedTopic(topic.title)}
                                  style={styles.suggestionItem}
                                >
                                  <Ionicons
                                    name={isChecked ? 'checkmark-circle' : 'ellipse-outline'}
                                    color={isChecked ? colors.primary : colors.muted}
                                    size={20}
                                  />
                                  <View style={styles.grow}>
                                    <Text style={styles.suggestionItemTitle}>{topic.title}</Text>
                                    <Text style={styles.suggestionItemMeta}>{formatDuration(topic.estimatedMinutes)} recommended</Text>
                                  </View>
                                </Pressable>
                              );
                            })}
                          </View>
                          
                          <Button
                            title={`Import Selected Topics (${selectedSuggestedTitles.length})`}
                            icon="download-outline"
                            disabled={selectedSuggestedTitles.length === 0 || importTopics.isPending}
                            onPress={handleImportSuggestedTopics}
                          />
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      {fetchAiSuggestions.isPending ? (
                        <View style={styles.loaderContainer}>
                          <ActivityIndicator size="small" color="#8B5CF6" />
                          <Text style={styles.loaderText}>Asking Gemini AI for topics...</Text>
                        </View>
                      ) : aiTopics.length === 0 ? (
                        <View style={styles.emptyContainer}>
                          <Text style={styles.emptyText}>No AI suggestions loaded. Check your backend configuration.</Text>
                          <Button
                            title="Generate with AI"
                            icon="sparkles"
                            onPress={() =>
                              fetchAiSuggestions.mutate({
                                subjectName: selectedSubject.name,
                                existingTopics: topics.data?.map((t) => t.title) || []
                              })
                            }
                          />
                        </View>
                      ) : unimportedAiTopics.length === 0 ? (
                        <View style={{ paddingVertical: 20, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          <Ionicons name="checkmark-done-circle-outline" size={32} color={colors.success} />
                          <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>All AI topics imported</Text>
                          <Text style={{ fontSize: 12, color: colors.muted, textAlign: 'center' }}>
                            You have already imported all AI suggested topics for this subject.
                          </Text>
                        </View>
                      ) : (
                        <>
                          <Text style={styles.suggestionsDesc}>AI suggested topics for your syllabus:</Text>
                          <View style={styles.suggestionsList}>
                            {unimportedAiTopics.map((topic) => {
                              const isChecked = selectedAiSuggestedTitles.includes(topic.title);
                              return (
                                <Pressable
                                  key={topic.title}
                                  onPress={() => toggleAiSuggestedTopic(topic.title)}
                                  style={styles.suggestionItem}
                                >
                                  <Ionicons
                                    name={isChecked ? 'checkmark-circle' : 'ellipse-outline'}
                                    color={isChecked ? colors.primary : colors.muted}
                                    size={20}
                                  />
                                  <View style={styles.grow}>
                                    <Text style={styles.suggestionItemTitle}>{topic.title}</Text>
                                    <Text style={styles.suggestionItemMeta}>{formatDuration(topic.estimatedMinutes)} recommended</Text>
                                  </View>
                                </Pressable>
                              );
                            })}
                          </View>
                          
                          <Button
                            title={`Import Selected Topics (${selectedAiSuggestedTitles.length})`}
                            icon="download-outline"
                            disabled={selectedAiSuggestedTitles.length === 0 || importTopics.isPending}
                            onPress={handleImportSuggestedTopics}
                          />
                        </>
                      )}
                    </>
                  )}
                </View>
              )}
            </>
          )}

          <View style={styles.topicList}>
            {topics.data?.length === 0 ? (
              <Text style={styles.empty}>No topics yet — add one above</Text>
            ) : null}
            {topics.data?.map((topic) => (
              <View key={topic._id} style={styles.topicRow}>
                <Pressable
                  onPress={() => updateTopic.mutate({ id: topic._id, completed: !topic.completed })}
                  hitSlop={6}
                >
                  <Ionicons
                    name={topic.completed ? 'checkbox' : 'square-outline'}
                    color={topic.completed ? colors.success : colors.muted}
                    size={24}
                  />
                </Pressable>
                <View style={styles.grow}>
                  <Text style={[styles.topicTitle, topic.completed ? styles.completed : undefined]}>
                    {topic.title
                  }</Text>
                  <Text style={styles.meta}>{formatDuration(topic.estimatedMinutes)}</Text>
                </View>
                <View style={styles.iconGroup}>
                  <IconAction
                    icon="sparkles-outline"
                    label="Generate AI Flashcards"
                    onPress={() => {
                      if (selectedSubjectId) {
                        generateFlashcards.mutate({
                          subjectId: selectedSubjectId,
                          topicId: topic._id,
                          topicTitle: topic.title
                        });
                      }
                    }}
                  />
                  <IconAction
                    icon="pencil-outline"
                    label="Edit topic"
                    onPress={() => {
                      setEditingTopicId(topic._id);
                      setTopicTitle(topic.title);
                      if (topic.estimatedMinutes >= 60) {
                        setDurationValue(String(topic.estimatedMinutes / 60));
                        setDurationUnit('hr');
                      } else {
                        setDurationValue(String(topic.estimatedMinutes));
                        setDurationUnit('min');
                      }
                    }}
                  />
                  <IconAction
                    icon="trash-outline"
                    label="Delete topic"
                    danger
                    onPress={() => confirmDeleteTopic(topic._id, topic.title)}
                  />
                </View>
              </View>
            ))}
          </View>
        </>
      ) : !selectedSubjectId && !showSubjectInput ? (
        <Text style={styles.empty}>Tap + to add your first subject</Text>
      ) : null}

      {isGeneratingCards && (
        <Modal transparent visible animationType="fade">
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingBoxText}>Gemini AI is analyzing topic and generating recall flashcards...</Text>
            </View>
          </View>
        </Modal>
      )}
    </Screen>
  );
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hrs = minutes / 60;
  if (Number.isInteger(hrs)) return `${hrs} hr`;
  return `${hrs.toFixed(1).replace(/\.0$/, '')} hr`;
}

// ── Icon action button ─────────────────────────────────────────────
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
      <Ionicons name={icon} color={danger ? colors.danger : colors.primary} size={20} />
    </Pressable>
  );
}

// ── Styles ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  subjectsScroll: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingVertical: 2
  },
  subjectChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.background
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
  // Inline subject input card
  subjectInputCard: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    padding: 14,
    backgroundColor: colors.surface,
    gap: 10
  },
  subjectInputHeading: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  subjectInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  subjectTextInput: {
    flex: 1,
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: colors.text,
    backgroundColor: colors.background,
    fontSize: 16,
    fontWeight: '600'
  },
  inputActionBtn: {
    width: 48,
    height: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  inputSaveBtn: {
    backgroundColor: colors.primary
  },
  inputCancelBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  inputBtnDisabled: {
    opacity: 0.45
  },
  // Selected subject row
  selectedSubjectRow: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: colors.surface
  },
  selectedSubjectName: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: '900'
  },
  // Topic form
  inline: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10
  },
  grow: {
    flex: 1
  },
  durationBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8
  },
  durationInputWrapper: {
    width: 76
  },
  unitSelector: {
    gap: 4
  },
  unitSelectorLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800'
  },
  unitTabs: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
    height: 44,
    backgroundColor: colors.surface
  },
  unitTab: {
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    backgroundColor: colors.surface
  },
  unitTabSelected: {
    backgroundColor: colors.primary
  },
  unitTabText: {
    color: colors.muted,
    fontWeight: '800',
    fontSize: 13
  },
  unitTabTextSelected: {
    color: colors.background
  },
  // Topic list
  topicList: {
    gap: 10
  },
  topicRow: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.background
  },
  topicTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 15
  },
  completed: {
    color: colors.muted,
    textDecorationLine: 'line-through'
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2
  },
  // Icon buttons
  iconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface
  },
  // Misc
  pressed: {
    opacity: 0.7
  },
  empty: {
    color: colors.muted,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
    fontSize: 13
  },
  presetsChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#8B5CF6',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#F5F3FF'
  },
  presetsChipBtnText: {
    color: '#8B5CF6',
    fontWeight: '800',
    fontSize: 13
  },
  suggestTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#C084FC',
    borderRadius: 12,
    backgroundColor: '#FAF5FF',
    marginVertical: 4
  },
  suggestTriggerBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#8B5CF6',
    flex: 1,
    marginLeft: 8
  },
  suggestionsCard: {
    borderWidth: 1,
    borderColor: '#E9D5FF',
    borderRadius: 14,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 12,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  suggestionsTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.text
  },
  suggestionsDesc: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: '600',
    marginTop: -4
  },
  suggestionsList: {
    gap: 8,
    marginVertical: 4
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    backgroundColor: colors.background
  },
  suggestionItemTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text
  },
  suggestionItemMeta: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '700',
    marginTop: 2
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
    maxHeight: '80%',
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
  coursesTabScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4
  },
  courseTabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.surface
  },
  courseTabItemActive: {
    backgroundColor: colors.primary
  },
  courseTabText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary
  },
  courseTabTextActive: {
    color: colors.background
  },
  subjectsChecklistHeader: {
    gap: 4
  },
  checklistTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.text
  },
  checklistSubtitle: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '600'
  },
  subjectsChecklist: {
    maxHeight: 200,
    marginVertical: 4
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  checklistRowText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text
  },
  checklistRowSub: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '600',
    marginTop: 2
  },
  modalActions: {
    gap: 10
  },
  suggestionTabs: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 8
  },
  suggestionTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface
  },
  suggestionTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  suggestionTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary
  },
  suggestionTabTextActive: {
    color: colors.background
  },
  loaderContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  loaderText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600'
  },
  emptyContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 12
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 12
  },
  inlinePresetsContainer: {
    marginTop: 14,
    gap: 8
  },
  inlineDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4
  },
  inlinePresetsHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 4
  },
  inlineChecklistTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    marginTop: 4
  },
  inlineSubjectsChecklist: {
    gap: 2,
    marginVertical: 4
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  loadingBox: {
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    gap: 12,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    width: '80%'
  },
  loadingBoxText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 18
  }
});
