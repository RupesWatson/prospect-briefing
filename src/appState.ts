import type { AppStateType } from './types';

// ============================================================================
// GLOBAL MUTABLE STATE
// Animation loops and event handlers read/write this directly without React.
// ============================================================================

export const appState: AppStateType = {
  simulation: {
    nodes: new Map(),
    edges: new Map(),
    temperature: 1.0,
    tickCount: 0,
    maxVelocity: 1.0,
  },
  selectedNodeId: null,
  selectedEdgeId: null,
  detailMode: null,
  filter: 'all',
  dirty: false,
  autosaveTimer: null,
  draggingNodeId: null,
  dragStartX: 0,
  dragStartY: 0,
  isPanning: false,
  panStartX: 0,
  panStartY: 0,
  panStartPanX: 0,
  panStartPanY: 0,
  panHasMoved: false,
  panTargetX: null,
  panTargetY: null,
  panX: 0,
  panY: 0,
  zoomLevel: 1.0,
  animationRunning: true,
  lastSaveTime: null,
  linkMode: false,
  linkSourceNodeId: null,
  pendingOrgNode: null,
  showEdgeLabels: true,
  hoveredEdgeId: null,
  hoveredNodeId: null,
  draggingEdgeHandle: null,
  layoutLocked: false,
};
