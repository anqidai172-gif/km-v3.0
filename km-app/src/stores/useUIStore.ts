import { create } from 'zustand';
import type { GraphViewState } from '../types';

interface UIState {
  sidebarOpen: boolean;
  activeSheet: string | null;
  isRecording: boolean;
  graphViewState: GraphViewState;
  sidebarDateRange: { start: string | null; end: string | null };

  toggleSidebar: () => void;
  openSidebar: () => void;
  closeSidebar: () => void;
  openSheet: (sheetId: string) => void;
  closeSheet: () => void;
  setIsRecording: (recording: boolean) => void;
  setGraphViewState: (state: Partial<GraphViewState>) => void;
  setSidebarDateRange: (start: string | null, end: string | null) => void;
  clearSidebarDateRange: () => void;
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
  sidebarDateRange: { start: null, end: null },

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
  setSidebarDateRange: (start, end) => set({ sidebarDateRange: { start, end } }),
  clearSidebarDateRange: () => set({ sidebarDateRange: { start: null, end: null } }),
}));
