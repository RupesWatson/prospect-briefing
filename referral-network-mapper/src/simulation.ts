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

function positionCircular(nodes: GraphNode[], cx: number, cy: number, radius: number) {
  nodes.forEach((n, i) => {
    const a = (i / Math.max(nodes.length, 1)) * Math.PI * 2;
    n.x = cx + Math.cos(a) * radius;
    n.y = cy + Math.sin(a) * radius;
    n.vx = 0; n.vy = 0;
  });
}

export function applyLayout(type: string) {
  if (type === 'free') { restartSimulation(); return; }
  const { nodes } = appState.simulation;
  const bt: Record<string, GraphNode[]> = {
    client: [], prospect: [], referrer: [], adviser: [], jpmorgan: [], organisation: [],
  };
  for (const [, n] of nodes) {
    if (!bt[n.type]) bt[n.type] = [];
    bt[n.type].push(n);
  }
  const sp = 150;
  if (type === 'by-type') {
    ['organisation', 'referrer', 'client', 'adviser', 'prospect', 'jpmorgan'].forEach((t, i) =>
      positionColumn(bt[t] || [], (i - 2.5) * 220, 0, sp)
    );
  } else if (type === 'clients-prospects') {
    positionColumn(bt.referrer || [], -400, 0, sp);
    positionColumn(bt.client || [], -200, 0, sp);
    positionColumn(bt.adviser || [], 0, 0, sp);
    positionColumn(bt.prospect || [], 200, 0, sp);
    positionColumn(bt.jpmorgan || [], -400, -300, sp);
    positionColumn(bt.organisation || [], 400, 0, sp);
  } else if (type === 'referrers-hub') {
    positionCircular(bt.referrer || [], 0, 0, 120);
    positionCircular(
      [...(bt.client || []), ...(bt.prospect || []), ...(bt.adviser || []), ...(bt.jpmorgan || [])],
      0, 0, 320
    );
    positionColumn(bt.organisation || [], 500, 0, sp);
  } else if (type === 'jpmorgan-view') {
    positionColumn(bt.jpmorgan || [], -400, 0, sp);
    positionColumn(bt.organisation || [], -150, 0, sp);
    positionColumn(bt.client || [], 100, 0, sp);
    positionColumn(bt.referrer || [], 300, 0, sp);
    positionColumn(bt.prospect || [], 500, 0, sp);
    positionColumn(bt.adviser || [], 100, -300, sp);
  }
  appState.animationRunning = false;
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
