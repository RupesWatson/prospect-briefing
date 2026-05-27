import { appState } from './appState';
import type { GraphNode } from './types';

// ============================================================================
// FORCE SIMULATION
// ============================================================================

export function restartSimulation() {
  appState.simulation.temperature = 1.0;
  appState.simulation.tickCount = 0;
  appState.animationRunning = true;
}

export function gentleRestart() {
  appState.simulation.temperature = 0.2;
  appState.simulation.tickCount = 250;
  appState.animationRunning = true;
}

/** Pre-run simulation silently so nodes are settled before first render. */
export function warmupSimulation(ticks = 350) {
  appState.simulation.temperature = 1.0;
  appState.simulation.tickCount = 0;
  appState.animationRunning = true;
  for (let i = 0; i < ticks; i++) {
    if (!appState.animationRunning) break;
    stepSimulation();
  }
  appState.animationRunning = false;
}

export function stepSimulation() {
  const { nodes, edges } = appState.simulation;
  for (const [, n] of nodes) { n.fx = 0; n.fy = 0; }

  // Repulsion
  for (const [id, n] of nodes) {
    for (const [oid, o] of nodes) {
      if (id === oid) continue;
      const dx = n.x - o.x, dy = n.y - o.y;
      const dSq = dx * dx + dy * dy + 1;
      const d = Math.sqrt(dSq);
      if (d > 500) continue;
      const f = 8000 / dSq;
      n.fx += (dx / d) * f;
      n.fy += (dy / d) * f;
    }
  }

  // Springs
  for (const [, e] of edges) {
    const s = nodes.get(e.sourceId), t = nodes.get(e.targetId);
    if (!s || !t) continue;
    const dx = t.x - s.x, dy = t.y - s.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const f = 0.05 * (d - 150);
    const fx = (dx / d) * f, fy = (dy / d) * f;
    s.fx += fx; s.fy += fy;
    t.fx -= fx; t.fy -= fy;
  }

  // Gravity
  for (const [, n] of nodes) {
    n.fx -= n.x * 0.02;
    n.fy -= n.y * 0.02;
  }

  // Integrate
  let maxVel = 0;
  for (const [, n] of nodes) {
    if (n.fixed) continue;
    n.vx = (n.vx + n.fx) * 0.85;
    n.vy = (n.vy + n.fy) * 0.85;
    maxVel = Math.max(maxVel, Math.sqrt(n.vx * n.vx + n.vy * n.vy));
    n.x += n.vx;
    n.y += n.vy;
  }

  appState.simulation.maxVelocity = maxVel;
  appState.simulation.tickCount++;
  if (appState.simulation.tickCount > 300 || maxVel < 0.3) {
    appState.animationRunning = false;
  }
}

// ============================================================================
// CONNECTOR HELPERS
// ============================================================================

export function computeEdgePath(
  src: GraphNode,
  tgt: GraphNode,
  bendOffset: number
) {
  const x1 = src.x, y1 = src.y, x2 = tgt.x, y2 = tgt.y;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const perpX = -dy / len, perpY = dx / len;
  const naturalBend = Math.min(len * 0.12, 55);
  const totalBend = naturalBend + (bendOffset || 0);
  const cpx = mx + perpX * totalBend;
  const cpy = my + perpY * totalBend;
  const vmx = 0.25 * x1 + 0.5 * cpx + 0.25 * x2;
  const vmy = 0.25 * y1 + 0.5 * cpy + 0.25 * y2;
  return {
    pathD: `M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`,
    vmx, vmy, mx, my, perpX, perpY,
  };
}

// ============================================================================
// LAYOUT PRESETS
// ============================================================================

function positionColumn(nodes: GraphNode[], x: number, baseY: number, spacing: number) {
  const total = nodes.length;
  nodes.forEach((n, i) => {
    n.x = x + (Math.random() - 0.5) * 30;
    n.y = baseY + (i - (total - 1) / 2) * spacing;
    n.vx = 0; n.vy = 0;
  });
}

// ── Priority Rings ──────────────────────────────────────────────────────────
// Concentric circles — critical contacts orbit closest to centre.
function layoutPriorityRings(nodes: Map<string, GraphNode>) {
  const RADII: Record<string, number> = {
    critical: 130, high: 260, medium: 420, low: 600, background: 800,
  };
  // Stagger start angles per ring so labels don't overlap at 12 o'clock
  const OFFSETS: Record<string, number> = {
    critical: 0, high: 0.6, medium: 0.2, low: 0.9, background: 0.4,
  };
  const byPriority: Record<string, GraphNode[]> = {
    critical: [], high: [], medium: [], low: [], background: [],
  };
  for (const [, n] of nodes) byPriority[n.priority || 'medium'].push(n);

  for (const [p, group] of Object.entries(byPriority)) {
    const r = RADII[p] ?? 420;
    const off = OFFSETS[p] ?? 0;
    group.forEach((n, i) => {
      const a = off + (i / Math.max(group.length, 1)) * Math.PI * 2;
      n.x = Math.cos(a) * r;
      n.y = Math.sin(a) * r;
      n.vx = 0; n.vy = 0;
    });
  }
}

// ── Referral Tree ───────────────────────────────────────────────────────────
// Hierarchical tree built from introducedBy chains.
// Root nodes (no introducer) sit at the top; each introduced generation
// cascades one row below its introducer.
function layoutReferralTree(nodes: Map<string, GraphNode>) {
  const nodeArr = Array.from(nodes.values());

  // Calculate depth for each node
  const depthMap = new Map<string, number>();
  function getDepth(id: string, visited = new Set<string>()): number {
    if (depthMap.has(id)) return depthMap.get(id)!;
    if (visited.has(id)) { depthMap.set(id, 0); return 0; }
    visited.add(id);
    const n = nodes.get(id);
    if (!n?.introducedBy || !nodes.has(n.introducedBy)) {
      depthMap.set(id, 0); return 0;
    }
    const d = getDepth(n.introducedBy, visited) + 1;
    depthMap.set(id, d); return d;
  }
  for (const n of nodeArr) getDepth(n.id);

  const maxDepth = Math.max(0, ...depthMap.values());
  const levels: GraphNode[][] = Array.from({ length: maxDepth + 1 }, () => []);
  for (const n of nodeArr) levels[depthMap.get(n.id) ?? 0].push(n);

  const V_GAP = 190;
  const H_GAP = 160;

  levels.forEach((level, depth) => {
    // Sort within level so children sit roughly under their parent
    level.sort((a, b) => {
      const ax = a.introducedBy ? (nodes.get(a.introducedBy)?.x ?? 0) : 0;
      const bx = b.introducedBy ? (nodes.get(b.introducedBy)?.x ?? 0) : 0;
      return ax - bx;
    });
    level.forEach((n, i) => {
      n.x = (i - (level.length - 1) / 2) * H_GAP;
      n.y = (depth - maxDepth / 2) * V_GAP;
      n.vx = 0; n.vy = 0;
    });
  });
}

// ── Engagement Pipeline ─────────────────────────────────────────────────────
// Left-to-right funnel: cold prospects → warm → hot → clients.
// Referrers and support network sit in a separate row above.
function layoutPipeline(nodes: Map<string, GraphNode>) {
  // Columns for the main funnel
  const cold:   GraphNode[] = []; // prospects eng 1-2
  const warm:   GraphNode[] = []; // prospects eng 3
  const hot:    GraphNode[] = []; // prospects eng 4-5
  const clients: GraphNode[] = []; // all clients
  // Support tracks
  const referrers: GraphNode[] = [];
  const support:   GraphNode[] = []; // adviser, jpmorgan, organisation

  for (const [, n] of nodes) {
    if (n.type === 'client') {
      clients.push(n);
    } else if (n.type === 'prospect') {
      if (n.engagementScore <= 2) cold.push(n);
      else if (n.engagementScore <= 3) warm.push(n);
      else hot.push(n);
    } else if (n.type === 'referrer') {
      referrers.push(n);
    } else {
      support.push(n);
    }
  }

  const COL_X = [-440, -220, 0, 220]; // cold, warm, hot, clients
  const ROW_SP = 140;

  [cold, warm, hot, clients].forEach((group, ci) => {
    group.forEach((n, ni) => {
      n.x = COL_X[ci] + (Math.random() - 0.5) * 50;
      n.y = (ni - (group.length - 1) / 2) * ROW_SP;
      n.vx = 0; n.vy = 0;
    });
  });

  // Referrers: arc above the funnel, x spread matches their introduced contacts
  referrers.forEach((n, i) => {
    n.x = (i - (referrers.length - 1) / 2) * 160;
    n.y = -Math.max(...[cold, warm, hot, clients].map((g) => g.length), 1) * ROW_SP / 2 - 200;
    n.vx = 0; n.vy = 0;
  });

  // Support: below the funnel
  const funnelBottom = Math.max(...[cold, warm, hot, clients].map((g) => g.length), 1) * ROW_SP / 2 + 160;
  support.forEach((n, i) => {
    n.x = (i - (support.length - 1) / 2) * 160;
    n.y = funnelBottom;
    n.vx = 0; n.vy = 0;
  });
}

// ── Sector Map ──────────────────────────────────────────────────────────────
// Cluster contacts by industry/sector. Each cluster orbits a central point.
// Helpful for spotting sector concentration and coverage gaps.
function layoutSectorMap(nodes: Map<string, GraphNode>) {
  const sectorMap = new Map<string, GraphNode[]>();

  for (const [, n] of nodes) {
    // Prefer sector, fall back to industry (organisations), then 'Other'
    const key = (n.type === 'organisation' ? n.industry : n.sector) || n.sector || n.industry || 'Other';
    const bucket = sectorMap.get(key) ?? [];
    bucket.push(n);
    sectorMap.set(key, bucket);
  }

  const sectors = Array.from(sectorMap.entries());
  const num = sectors.length;
  // Radius for the ring of cluster centres scales with number of sectors
  const RING_R = Math.max(300, num * 65);
  const NODE_R = 55; // radius within each cluster

  sectors.forEach(([, group], si) => {
    const ca = (si / num) * Math.PI * 2 - Math.PI / 2;
    const cx = Math.cos(ca) * RING_R;
    const cy = Math.sin(ca) * RING_R;
    group.forEach((n, ni) => {
      const na = (ni / Math.max(group.length, 1)) * Math.PI * 2;
      const nr = group.length === 1 ? 0 : NODE_R;
      n.x = cx + Math.cos(na) * nr;
      n.y = cy + Math.sin(na) * nr;
      n.vx = 0; n.vy = 0;
    });
  });
}

// ── Hub & Spoke ─────────────────────────────────────────────────────────────
// Organisation nodes + heavily-connected nodes become large hubs.
// Everyone else clusters around their primary hub in a circular arc.
export function layoutHubSpoke(
  nodes: Map<string, GraphNode>,
  edges: Map<string, import('./types').GraphEdge>
) {
  // Connection count
  const connCount = new Map<string, number>();
  for (const e of edges.values()) {
    connCount.set(e.sourceId, (connCount.get(e.sourceId) || 0) + 1);
    connCount.set(e.targetId, (connCount.get(e.targetId) || 0) + 1);
  }

  // Identify hubs: organisations OR nodes with ≥3 connections
  const hubSet = new Set<string>();
  for (const [id, n] of nodes) {
    if (n.type === 'organisation' || (connCount.get(id) || 0) >= 3) {
      hubSet.add(id);
    }
  }

  // If no explicit hubs, promote the top-5 most connected nodes
  if (hubSet.size === 0) {
    const sorted = Array.from(nodes.keys()).sort(
      (a, b) => (connCount.get(b) || 0) - (connCount.get(a) || 0)
    );
    sorted.slice(0, Math.min(5, sorted.length)).forEach((id) => hubSet.add(id));
  }

  const hubs = Array.from(hubSet).map((id) => nodes.get(id)!).filter(Boolean);
  const spokes = Array.from(nodes.values()).filter((n) => !hubSet.has(n.id));

  // Position hubs in a circle scaled to their count
  const HUB_RING = Math.max(220, hubs.length * 75);
  hubs.forEach((h, i) => {
    const a = (i / Math.max(hubs.length, 1)) * Math.PI * 2 - Math.PI / 2;
    h.x = Math.cos(a) * HUB_RING;
    h.y = Math.sin(a) * HUB_RING;
    h.vx = 0; h.vy = 0;
  });

  // Build spoke→hub assignment
  const hubById = new Map(hubs.map((h) => [h.id, h]));
  const hubSpokes = new Map<string, GraphNode[]>();
  hubs.forEach((h) => hubSpokes.set(h.id, []));
  const assigned = new Set<string>();

  // Pass 1: assign via edges
  for (const e of edges.values()) {
    const srcIsHub = hubById.has(e.sourceId);
    const tgtIsHub = hubById.has(e.targetId);
    const srcSpoke = !srcIsHub ? nodes.get(e.sourceId) : null;
    const tgtSpoke = !tgtIsHub ? nodes.get(e.targetId) : null;
    if (srcIsHub && tgtSpoke && !assigned.has(tgtSpoke.id)) {
      hubSpokes.get(e.sourceId)?.push(tgtSpoke);
      assigned.add(tgtSpoke.id);
    }
    if (tgtIsHub && srcSpoke && !assigned.has(srcSpoke.id)) {
      hubSpokes.get(e.targetId)?.push(srcSpoke);
      assigned.add(srcSpoke.id);
    }
  }

  // Pass 2: assign unassigned spokes by organisation name match
  for (const spoke of spokes) {
    if (assigned.has(spoke.id)) continue;
    if (spoke.organisation) {
      const orgLower = spoke.organisation.toLowerCase();
      for (const h of hubs) {
        if (h.name.toLowerCase() === orgLower) {
          hubSpokes.get(h.id)?.push(spoke);
          assigned.add(spoke.id);
          break;
        }
      }
    }
  }

  // Pass 3: assign remaining unassigned to nearest hub by introducedBy chain
  for (const spoke of spokes) {
    if (assigned.has(spoke.id)) continue;
    if (spoke.introducedBy && hubById.has(spoke.introducedBy)) {
      hubSpokes.get(spoke.introducedBy)?.push(spoke);
      assigned.add(spoke.id);
    }
  }

  // Position spokes in arcs around their hub
  const SPOKE_ORBIT = 155;
  for (const [hubId, spokeList] of hubSpokes) {
    const hub = hubById.get(hubId)!;
    // Point arcs away from canvas centre so labels don't overlap hub
    const hubAngle = Math.atan2(hub.y, hub.x);
    const arcSpan = Math.min(Math.PI * 1.6, spokeList.length * 0.35 + 0.4);
    const startAngle = hubAngle - arcSpan / 2;

    spokeList.forEach((s, i) => {
      const t = spokeList.length === 1 ? 0.5 : i / (spokeList.length - 1);
      const a = startAngle + t * arcSpan;
      s.x = hub.x + Math.cos(a) * SPOKE_ORBIT;
      s.y = hub.y + Math.sin(a) * SPOKE_ORBIT;
      s.vx = 0; s.vy = 0;
    });
  }

  // Orphaned nodes — no hub connection — stack below the canvas centre
  const orphans = spokes.filter((s) => !assigned.has(s.id));
  orphans.forEach((n, i) => {
    n.x = (i - (orphans.length - 1) / 2) * 120;
    n.y = HUB_RING + 220;
    n.vx = 0; n.vy = 0;
  });
}

export function applyLayout(type: string) {
  if (type === 'free') {
    appState.layoutLocked = false;
    restartSimulation();
    return;
  }
  const { nodes, edges } = appState.simulation;
  if (type === 'priority-rings') {
    layoutPriorityRings(nodes);
  } else if (type === 'referral-tree') {
    layoutReferralTree(nodes);
  } else if (type === 'pipeline') {
    layoutPipeline(nodes);
  } else if (type === 'sector-map') {
    layoutSectorMap(nodes);
  } else if (type === 'hub-spoke') {
    layoutHubSpoke(nodes, edges);
  }
  // Lock out physics so pulse animations can't re-trigger stepSimulation
  appState.layoutLocked = true;
  appState.animationRunning = true; // keep RAF ticking for visual effects
}

// ============================================================================
// SAMPLE DATA
// ============================================================================

export const SAMPLE_DATA = {
  nodes: [
    { id: 'n1', name: 'James Hartley',  type: 'client'       as const, priority: 'critical' as const, organisation: 'Hartley Capital',  sector: 'Private equity',  estimatedAUM: '>£50m',   engagementScore: 5, referralLikelihood: 4, notes: 'Long-standing client, well connected in PE', introducedBy: null, areaOfFocus: '', firmsCovered: '', jpmTitle: '', jpmEngagement: '', industry: '', website: '', keyContacts: '', x: 0,    y: 0,    vx: 0, vy: 0, fx: 0, fy: 0, fixed: false },
    { id: 'n2', name: 'Sarah Chen',     type: 'prospect'     as const, priority: 'high'     as const, organisation: 'Meridian Ventures', sector: 'Venture capital', estimatedAUM: '£25–50m', engagementScore: 3, referralLikelihood: 2, notes: '', introducedBy: 'n1', areaOfFocus: '', firmsCovered: '', jpmTitle: '', jpmEngagement: '', industry: '', website: '', keyContacts: '', x: 160,  y: 80,   vx: 0, vy: 0, fx: 0, fy: 0, fixed: false },
    { id: 'n3', name: 'Robert Okafor',  type: 'referrer'     as const, priority: 'critical' as const, organisation: 'Okafor & Partners', sector: 'Legal',           estimatedAUM: '',        engagementScore: 4, referralLikelihood: 5, notes: 'Top referrer — family law focus', introducedBy: null, areaOfFocus: '', firmsCovered: '', jpmTitle: '', jpmEngagement: '', industry: '', website: '', keyContacts: '', x: -160, y: 80,   vx: 0, vy: 0, fx: 0, fy: 0, fixed: false },
    { id: 'n4', name: 'Emma Blackwood', type: 'prospect'     as const, priority: 'high'     as const, organisation: 'Blackwood Family',  sector: 'Real estate',     estimatedAUM: '>£50m',   engagementScore: 4, referralLikelihood: 3, notes: '', introducedBy: 'n3', areaOfFocus: '', firmsCovered: '', jpmTitle: '', jpmEngagement: '', industry: '', website: '', keyContacts: '', x: -220, y: -50,  vx: 0, vy: 0, fx: 0, fy: 0, fixed: false },
    { id: 'n5', name: 'David Lim',      type: 'client'       as const, priority: 'high'     as const, organisation: 'Lim Group',         sector: 'Tech founder',    estimatedAUM: '£10–25m', engagementScore: 4, referralLikelihood: 3, notes: '', introducedBy: null, areaOfFocus: '', firmsCovered: '', jpmTitle: '', jpmEngagement: '', industry: '', website: '', keyContacts: '', x: 220,  y: -50,  vx: 0, vy: 0, fx: 0, fy: 0, fixed: false },
    { id: 'n6', name: 'Claire Dubois',  type: 'adviser'      as const, priority: 'medium'   as const, organisation: 'Montrose Tax',      sector: 'Accounting',      estimatedAUM: '',        engagementScore: 3, referralLikelihood: 4, notes: 'Tax adviser — good conduit', introducedBy: null, areaOfFocus: '', firmsCovered: '', jpmTitle: '', jpmEngagement: '', industry: '', website: '', keyContacts: '', x: 0,    y: -180, vx: 0, vy: 0, fx: 0, fy: 0, fixed: false },
    { id: 'n7', name: 'Marcus Webb',    type: 'prospect'     as const, priority: 'low'      as const, organisation: 'Webb Industries',   sector: 'Corporate',       estimatedAUM: '£10–25m', engagementScore: 2, referralLikelihood: 1, notes: '', introducedBy: null, areaOfFocus: '', firmsCovered: '', jpmTitle: '', jpmEngagement: '', industry: '', website: '', keyContacts: '', x: 300,  y: 60,   vx: 0, vy: 0, fx: 0, fy: 0, fixed: false },
    { id: 'n8', name: 'Alex Morgan',    type: 'jpmorgan'     as const, priority: 'medium'   as const, organisation: 'JP Morgan',         sector: '',                estimatedAUM: '',        engagementScore: 0, referralLikelihood: 0, notes: 'Covers HF clients in London', introducedBy: null, areaOfFocus: 'Hedge Funds', firmsCovered: 'Bridgewater, Man Group', jpmTitle: 'Relationship Manager', jpmEngagement: 'active', industry: '', website: '', keyContacts: '', x: -80,  y: -220, vx: 0, vy: 0, fx: 0, fy: 0, fixed: false },
    { id: 'n9', name: 'Hartley Capital', type: 'organisation' as const, priority: 'high'    as const, organisation: '',                 sector: '',                estimatedAUM: '>£100m',  engagementScore: 0, referralLikelihood: 0, notes: "James Hartley's firm", introducedBy: null, areaOfFocus: '', firmsCovered: '', jpmTitle: '', jpmEngagement: '', industry: 'Asset Management', website: 'hartleycapital.com', keyContacts: 'James Hartley', x: 130, y: -180, vx: 0, vy: 0, fx: 0, fy: 0, fixed: false },
  ],
  edges: [
    { id: 'e1', sourceId: 'n1', targetId: 'n2', relationshipType: 'referred'   as const, strength: 3, notes: '', bendOffset: 0, lastContact: '' },
    { id: 'e2', sourceId: 'n3', targetId: 'n4', relationshipType: 'referred'   as const, strength: 3, notes: '', bendOffset: 0, lastContact: '' },
    { id: 'e3', sourceId: 'n3', targetId: 'n5', relationshipType: 'referred'   as const, strength: 2, notes: '', bendOffset: 0, lastContact: '' },
    { id: 'e4', sourceId: 'n1', targetId: 'n3', relationshipType: 'knows'      as const, strength: 2, notes: '', bendOffset: 0, lastContact: '' },
    { id: 'e5', sourceId: 'n6', targetId: 'n1', relationshipType: 'adviser-to' as const, strength: 3, notes: '', bendOffset: 0, lastContact: '' },
    { id: 'e6', sourceId: 'n6', targetId: 'n4', relationshipType: 'adviser-to' as const, strength: 2, notes: '', bendOffset: 0, lastContact: '' },
    { id: 'e7', sourceId: 'n5', targetId: 'n7', relationshipType: 'knows'      as const, strength: 1, notes: '', bendOffset: 0, lastContact: '' },
    { id: 'e8', sourceId: 'n8', targetId: 'n1', relationshipType: 'covers'     as const, strength: 2, notes: 'JPM coverage', bendOffset: 0, lastContact: '' },
    { id: 'e9', sourceId: 'n1', targetId: 'n9', relationshipType: 'colleague'  as const, strength: 3, notes: '', bendOffset: 0, lastContact: '' },
  ],
};
