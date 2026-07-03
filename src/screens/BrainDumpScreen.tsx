import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { studyApi } from '../api/studyApi';
import { Button } from '../components/Button';
import { colors } from '../constants/colors';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'BrainDump'>;

export function BrainDumpScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const subjectId = route.params?.subjectId;

  const createNote = useMutation({
    mutationFn: ({ note, subjectId }: { note: string; subjectId?: string }) =>
      studyApi.createBrainDump(note, subjectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brainDump'] });
      navigation.goBack();
    }
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <Text style={styles.title}>Brain Dump</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        multiline
        autoFocus
        placeholder="Capture it here"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
      <View style={styles.actions}>
        <Button
          title="Save"
          icon="checkmark"
          disabled={!note.trim() || createNote.isPending}
          onPress={() => createNote.mutate({ note: note.trim(), subjectId })}
        />
        <Button title="Cancel" icon="close" variant="danger-quiet" onPress={() => navigation.goBack()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
    gap: 18
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900'
  },
  input: {
    minHeight: 180,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    color: colors.text,
    textAlignVertical: 'top',
    fontSize: 16
  },
  actions: {
    gap: 12
  }
});
