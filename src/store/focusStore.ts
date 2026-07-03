import { create } from 'zustand';
import type { Dashboard, FocusSession } from '../types/models';

type FocusState = {
  session?: FocusSession;
  task?: NonNullable<Dashboard['nextTask']>;
  setFocus: (session: FocusSession, task: NonNullable<Dashboard['nextTask']>) => void;
  updateSession: (session: FocusSession) => void;
  clearFocus: () => void;
};

export const useFocusStore = create<FocusState>((set) => ({
  setFocus: (session, task) => set({ session, task }),
  updateSession: (session) => set({ session }),
  clearFocus: () => set({ session: undefined, task: undefined })
}));
