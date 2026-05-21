// ============================================================================
// TYPES
// ============================================================================

export type NodeType = 'client' | 'prospect' | 'referrer' | 'adviser' | 'jpmorgan' | 'organisation';
export type RelationshipType = 'referred' | 'knows' | 'colleague' | 'adviser-to' | 'family' | 'covers';
export type FilterType = 'all' | NodeType;
export type LayoutType = 'free' | 'by-type' | 'clients-prospects' | 'referrers-hub' | 'jpmorgan-view';
export type DetailMode = 'node' | 'edge' | null;
export type ModalType = 'connection' | 'apikey' | 'import' | 'orgDuplicate' | null;

export interface GraphNode {
  id: string;
  name: string;
  type: NodeType;
  organisation: string;
  sector: string;
  estimatedAUM: string;
  engagementScore: number;
  referralLikelihood: number;
  notes: string;
  introducedBy: string | null;
  // JP Morgan fields
  areaOfFocus: string;
  firmsCovered: string;
  jpmTitle: string;
  jpmEngagement: string;
  // Organisation fields
  industry: string;
  website: string;
  keyContacts: string;
  // Simulation physics
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number;
  fy: number;
  fixed: boolean;
  // Research state
  researching?: boolean;
  researchedAt?: string;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationshipType: RelationshipType;
  strength: number; // 1-3
  notes: string;
  bendOffset: number;
  lastContact: string;
}

export interface DraggingEdgeHandle {
  edgeId: string;
  startBend: number;
  startMouseX: number;
  startMouseY: number;
  perpX: number;
  perpY: number;
  hasMoved: boolean;
}

export interface AppStateType {
  simulation: {
    nodes: Map<string, GraphNode>;
    edges: Map<string, GraphEdge>;
    temperature: number;
    tickCount: number;
    maxVelocity: number;
  };
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  detailMode: DetailMode;
  filter: FilterType;
  dirty: boolean;
  autosaveTimer: ReturnType<typeof setTimeout> | null;
  draggingNodeId: string | null;
  dragStartX: number;
  dragStartY: number;
  isPanning: boolean;
  panStartX: number;
  panStartY: number;
  panStartPanX: number;
  panStartPanY: number;
  panHasMoved: boolean;
  panTargetX: number | null;
  panTargetY: number | null;
  panX: number;
  panY: number;
  zoomLevel: number;
  animationRunning: boolean;
  lastSaveTime: Date | null;
  linkMode: boolean;
  linkSourceNodeId: string | null;
  pendingOrgNode: GraphNode | null;
  showEdgeLabels: boolean;
  hoveredEdgeId: string | null;
  hoveredNodeId: string | null;
  draggingEdgeHandle: DraggingEdgeHandle | null;
}

export interface StaleInfo {
  level: 'none' | 'fresh' | 'aging' | 'stale';
  color: string;
  label: string;
}
