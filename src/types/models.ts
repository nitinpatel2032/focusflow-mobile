export type User = {
  id: string;
  name: string;
  email: string;
  currentStreak: number;
  longestStreak: number;
  seekingCourses?: string[];
};

export type Subject = {
  _id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type Topic = {
  _id: string;
  subjectId: string | Subject;
  title: string;
  completed: boolean;
  estimatedMinutes: number;
  completedAt?: string;
};

export type Exam = {
  _id: string;
  subjectId: string | Subject;
  examDate: string;
};

export type FocusSession = {
  _id: string;
  topicId: string | Topic;
  startTime: string;
  endTime?: string;
  pausedDurationSeconds: number;
  duration: number;
  completed: boolean;
  status: 'active' | 'paused' | 'completed';
};

export type BrainDumpNote = {
  _id: string;
  note: string;
  resolved: boolean;
  createdAt: string;
  subjectId?: string | Subject;
};

export type Dashboard = {
  streak: {
    currentStreak: number;
    longestStreak: number;
  };
  upcomingExams: Array<{
    id: string;
    subject: string;
    examDate: string;
    daysLeft: number;
  }>;
  nextTask?: {
    id: string;
    title: string;
    estimatedMinutes: number;
    subject?: string;
    subjectId?: string;
  };
};

export type Flashcard = {
  _id: string;
  userId: string;
  subjectId: string | Subject;
  front: string;
  back: string;
  difficulty: 'easy' | 'medium' | 'hard';
  createdAt: string;
  updatedAt: string;
};
