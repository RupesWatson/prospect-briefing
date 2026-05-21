import { create } from 'zustand';
import type { ModalType } from './types';

// ============================================================================
// MINIMAL ZUSTAND STORE
// Only used to trigger React re-renders. Actual data lives in appState.ts.
// ============================================================================

interface UIStore {
  graphVersion: number;
  detailKey: number;
  activeModal: ModalType;
  tableViewOpen: boolean;
  bumpGraph: () => void;
  bumpDetail: () => void;
  setModal: (m: ModalType) => void;
  setTableViewOpen: (open: boolean) => void;
}

export const useStore = create<UIStore>((set) => ({
  graphVersion: 0,
  detailKey: 0,
  activeModal: null,
  tableViewOpen: false,
  bumpGraph: () => set((s) => ({ graphVersion: s.graphVersion + 1 })),
  bumpDetail: () => set((s) => ({ detailKey: s.detailKey + 1 })),
  setModal: (m) => set({ activeModal: m }),
  setTableViewOpen: (open) => set({ tableViewOpen: open }),
}));
