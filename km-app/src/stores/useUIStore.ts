import { create } from 'zustand';
import type { GraphViewState } from '../types';

interface UIState {
  sidebarOpen: boolean;
  activeSheet: string | null;
  isRecording: boolean;
  graphViewState: GraphViewState;
  sidebarTimeFilter: string | null;

  toggleSidebar: () => void;
  openSidebar: () => void;
  closeSidebar: () => void;
  openSheet: (sheetId: string) => void;
  closeSheet: () => void;
  setIsRecording: (recording: boolean) => void;
  setGraphViewState: (state: Partial<GraphViewState>) => void;
  setSidebarTimeFilter: (dateStr: string | null) => void;
}

const defaultGraphView: GraphViewState = {
  offsetX: 0,
  offsetY: 0,
  scale: 1,
};

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  activeSheet: null,
  isRecording: false,
  graphViewState: defaultGraphView,
  sidebarTimeFilter: null,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  openSidebar: () => set({ sidebarOpen: true }),
  closeSidebar: () => set({ sidebarOpen: false }),
  openSheet: (sheetId) => set({ activeSheet: sheetId }),
  closeSheet: () => set({ activeSheet: null }),
  setIsRecording: (recording) => set({ isRecording: recording }),
  setGraphViewState: (state) =>
    set((s) => ({
      graphViewState: { ...s.graphViewState, ...state },
    })),
  setSidebarTimeFilter: (dateStr) => set({ sidebarTimeFilter: dateStr }),
}));
