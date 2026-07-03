export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Focus: undefined;
  BrainDump: { subjectId?: string } | undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Syllabus: undefined;
  Planner: undefined;
  Stats: undefined;
  Settings: undefined;
};
