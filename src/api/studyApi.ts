import type { BrainDumpNote, Dashboard, Exam, Flashcard, FocusSession, Subject, Topic } from '../types/models';
import { api } from './client';

export const studyApi = {
  dashboard: () => api.get<Dashboard>('/dashboard').then((res) => res.data),
  subjects: () => api.get<Subject[]>('/subjects').then((res) => res.data),
  createSubject: (name: string) => api.post<Subject>('/subjects', { name }).then((res) => res.data),
  updateSubject: (id: string, name: string) => api.patch<Subject>(`/subjects/${id}`, { name }).then((res) => res.data),
  deleteSubject: (id: string) => api.delete<void>(`/subjects/${id}`).then((res) => res.data),
  topics: (subjectId?: string) =>
    api.get<Topic[]>('/topics', { params: subjectId ? { subjectId } : undefined }).then((res) => res.data),
  suggestTopics: (payload: { subjectName: string; existingTopics?: string[] }) =>
    api.post<{ aiGenerated: boolean; topics: Array<{ title: string; estimatedMinutes: number }> }>('/topics/suggest', payload).then((res) => res.data),
  suggestCourse: (courseName: string) =>
    api.post<{ aiGenerated: boolean; subjects: Array<{ name: string; topics: Array<{ title: string; estimatedMinutes: number }> }> }>('/topics/suggest-course', { courseName }).then((res) => res.data),
  searchCourses: (query: string) =>
    api.get<{ aiGenerated: boolean; courses: Array<{ id: string; name: string; icon: string; subjects: Array<{ name: string; topics: Array<{ title: string; estimatedMinutes: number }> }> }> }>('/topics/search-courses', { params: { query } }).then((res) => res.data),
  createTopic: (payload: { subjectId: string; title: string; estimatedMinutes: number }) =>
    api.post<Topic>('/topics', payload).then((res) => res.data),
  updateTopic: (id: string, payload: Partial<Pick<Topic, 'title' | 'estimatedMinutes' | 'completed'>>) =>
    api.patch<Topic>(`/topics/${id}`, payload).then((res) => res.data),
  deleteTopic: (id: string) => api.delete<void>(`/topics/${id}`).then((res) => res.data),
  progress: () =>
    api
      .get<Array<{ subjectId: string; total: number; completed: number; percent: number }>>('/topics/progress')
      .then((res) => res.data),
  exams: () => api.get<Exam[]>('/exams').then((res) => res.data),
  createExam: (payload: { subjectId: string; examDate: string }) =>
    api.post<Exam>('/exams', payload).then((res) => res.data),
  updateExam: (id: string, payload: { subjectId?: string; examDate?: string }) =>
    api.patch<Exam>(`/exams/${id}`, payload).then((res) => res.data),
  deleteExam: (id: string) => api.delete<void>(`/exams/${id}`).then((res) => res.data),
  startFocus: (topicId: string) => api.post<FocusSession>('/focus/start', { topicId }).then((res) => res.data),
  pauseFocus: (sessionId: string) => api.post<FocusSession>('/focus/pause', { sessionId }).then((res) => res.data),
  resumeFocus: (sessionId: string) => api.post<FocusSession>('/focus/resume', { sessionId }).then((res) => res.data),
  completeFocus: (sessionId: string) =>
    api.post<FocusSession>('/focus/complete', { sessionId }).then((res) => res.data),
  focusHistory: () => api.get<FocusSession[]>('/focus/history').then((res) => res.data),
  brainDump: () => api.get<BrainDumpNote[]>('/brain-dump').then((res) => res.data),
  createBrainDump: (note: string, subjectId?: string) => api.post<BrainDumpNote>('/brain-dump', { note, subjectId }).then((res) => res.data),
  resolveBrainDump: (id: string) => api.patch<BrainDumpNote>(`/brain-dump/${id}`, { resolved: true }).then((res) => res.data),
  deleteBrainDump: (id: string) => api.delete<void>(`/brain-dump/${id}`).then((res) => res.data),
  flashcards: (subjectId?: string) =>
    api.get<Flashcard[]>('/flashcards', { params: subjectId ? { subjectId } : undefined }).then((res) => res.data),
  createFlashcard: (payload: { subjectId: string; front: string; back: string }) =>
    api.post<Flashcard>('/flashcards', payload).then((res) => res.data),
  updateFlashcard: (id: string, payload: Partial<Pick<Flashcard, 'front' | 'back' | 'difficulty'>>) =>
    api.patch<Flashcard>(`/flashcards/${id}`, payload).then((res) => res.data),
  deleteFlashcard: (id: string) => api.delete<void>(`/flashcards/${id}`).then((res) => res.data),
  generateFlashcards: (subjectId: string, topicId?: string) =>
    api.post<Flashcard[]>('/flashcards/generate', { subjectId, topicId }).then((res) => res.data),
  clearData: () => api.post<{ success: boolean }>('/auth/clear-data').then((res) => res.data)
};
