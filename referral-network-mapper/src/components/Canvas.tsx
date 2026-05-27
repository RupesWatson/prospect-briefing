import { useEffect, useRef } from 'react';
import { appState } from '../appState';
import { stepSimulation, computeEdgePath } from '../simulation';
import { getInitials, getEdgeStaleInfo } from '../utils';
import { markDirty } from '../persistence';
import { useStore } from '../store';

const SVG_NS = 'http://www.w3.org/2000/svg';

// ── Canvas visual constants ──
const CANVAS_EDGE_COLORS: Record<string, string> = {
  referred:     '#60a5fa',
  knows:        '#94a3b8',
  colleague:    '#34d399',
  'adviser-to': '#a78bfa',
  family:       '#f87171',
  covers:       '#38bdf8',
  'works-at':   '#fb923c',  // orange — employment link
  'client-of':  '#e879f9',  // purple-pink — firm-to-firm client relationship
};

// Flat node fill colours
const NODE_COLORS: Record<string, string> = {
  client:       '#2563eb',
  prospect:     '#059669',
  referrer:     '#dc2626',
  adviser:      '#7c3aed',
  jpmorgan:     '#1d4ed8',
  organisation: '#4b5563',
};

// Keep for aura colour lookup
const NODE_GRADIENTS: Record<string, [string, string]> = {
  client:       ['#60a5fa', '#1e40af'],
  prospect:     ['#34d399', '#065f46'],
  referrer:     ['#f87171', '#991b1b'],
  adviser:      ['#a78bfa', '#4c1d95'],
  jpmorgan:     ['#93c5fd', '#1e3a8a'],
  organisation: ['#9ca3af', '#374151'],
};

function markerId(type: string) { return `arrow-${type.replace(/-/g, '_')}`; }

function hexagonPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
  }
  return pts.join(' ');
}

function diamondPoints(cx: number, cy: number, r: number): string {
  return `${cx},${cy - r} ${cx + r * 0.78},${cy} ${cx},${cy + r} ${cx - r * 0.78},${cy}`;
}

function pentagonPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (2 * Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
  }
  return pts.join(' ');
}

// ============================================================================
// RENDER CANVAS — direct SVG DOM manipulation (no React reconciliation)
// ============================================================================

export function renderCanvas(svg: SVGSVGElement) {
  svg.innerHTML = '';

  const { nodes, edges } = appState.simulation;
  const rect = svg.getBoundingClientRect();
  const W = rect.width || 800, H = rect.height || 600;
  svg.setAttribute('viewBox', `${-W / 2} ${-H / 2} ${W} ${H}`);
  const now = Date.now();

  // ── Defs ──
  const defs = document.createElementNS(SVG_NS, 'defs');

  // Background dot-grid pattern
  const pat = document.createElementNS(SVG_NS, 'pattern');
  pat.setAttribute('id', 'bgGrid');
  pat.setAttribute('width', '40'); pat.setAttribute('height', '40');
  pat.setAttribute('patternUnits', 'userSpaceOnUse');
  const dotEl = document.createElementNS(SVG_NS, 'circle');
  dotEl.setAttribute('cx', '1'); dotEl.setAttribute('cy', '1');
  dotEl.setAttribute('r', '1'); dotEl.setAttribute('fill', '#1e2a3a');
  pat.appendChild(dotEl);
  defs.appendChild(pat);

  // Per-relationship-type arrowhead markers
  for (const [type, color] of Object.entries(CANVAS_EDGE_COLORS)) {
    const mkr = document.createElementNS(SVG_NS, 'marker');
    mkr.setAttribute('id', markerId(type));
    mkr.setAttribute('markerUnits', 'userSpaceOnUse');
    mkr.setAttribute('markerWidth', '10'); mkr.setAttribute('markerHeight', '7');
    mkr.setAttribute('refX', '10'); mkr.setAttribute('refY', '3.5');
    mkr.setAttribute('orient', 'auto');
    const poly = document.createElementNS(SVG_NS, 'polygon');
    poly.setAttribute('points', '0 0, 10 3.5, 0 7');
    poly.setAttribute('fill', color);
    mkr.appendChild(poly);
    defs.appendChild(mkr);
  }
  // Selected-state gold arrowhead
  {
    const mkr = document.createElementNS(SVG_NS, 'marker');
    mkr.setAttribute('id', 'arrow-selected');
    mkr.setAttribute('markerUnits', 'userSpaceOnUse');
    mkr.setAttribute('markerWidth', '10'); mkr.setAttribute('markerHeight', '7');
    mkr.setAttribute('refX', '10'); mkr.setAttribute('refY', '3.5');
    mkr.setAttribute('orient', 'auto');
    const poly = document.createElementNS(SVG_NS, 'polygon');
    poly.setAttribute('points', '0 0, 10 3.5, 0 7'); poly.setAttribute('fill', '#ffd700');
    mkr.appendChild(poly);
    defs.appendChild(mkr);
  }

  // Node hover glow filter (blue halo)
  {
    const f = document.createElementNS(SVG_NS, 'filter');
    f.setAttribute('id', 'nodeGlow');
    f.setAttribute('x', '-60%'); f.setAttribute('y', '-60%');
    f.setAttribute('width', '220%'); f.setAttribute('height', '220%');
    const b = document.createElementNS(SVG_NS, 'feGaussianBlur');
    b.setAttribute('in', 'SourceGraphic'); b.setAttribute('stdDeviation', '7'); b.setAttribute('result', 'blur');
    const m = document.createElementNS(SVG_NS, 'feMerge');
    const m1 = document.createElementNS(SVG_NS, 'feMergeNode'); m1.setAttribute('in', 'blur');
    const m2 = document.createElementNS(SVG_NS, 'feMergeNode'); m2.setAttribute('in', 'SourceGraphic');
    m.appendChild(m1); m.appendChild(m2);
    f.appendChild(b); f.appendChild(m);
    defs.appendChild(f);
  }

  // Selected node glow filter (gold halo)
  {
    const f = document.createElementNS(SVG_NS, 'filter');
    f.setAttribute('id', 'nodeSelect');
    f.setAttribute('x', '-60%'); f.setAttribute('y', '-60%');
    f.setAttribute('width', '220%'); f.setAttribute('height', '220%');
    const b = document.createElementNS(SVG_NS, 'feGaussianBlur');
    b.setAttribute('in', 'SourceGraphic'); b.setAttribute('stdDeviation', '9'); b.setAttribute('result', 'blur');
    const flood = document.createElementNS(SVG_NS, 'feFlood');
    flood.setAttribute('flood-color', '#ffd700'); flood.setAttribute('flood-opacity', '0.7'); flood.setAttribute('result', 'color');
    const comp = document.createElementNS(SVG_NS, 'feComposite');
    comp.setAttribute('in', 'color'); comp.setAttribute('in2', 'blur');
    comp.setAttribute('operator', 'in'); comp.setAttribute('result', 'glow');
    const m = document.createElementNS(SVG_NS, 'feMerge');
    const m1 = document.createElementNS(SVG_NS, 'feMergeNode'); m1.setAttribute('in', 'glow');
    const m2 = document.createElementNS(SVG_NS, 'feMergeNode'); m2.setAttribute('in', 'SourceGraphic');
    m.appendChild(m1); m.appendChild(m2);
    f.appendChild(b); f.appendChild(flood); f.appendChild(comp); f.appendChild(m);
    defs.appendChild(f);
  }

  // Edge glow filter
  {
    const f = document.createElementNS(SVG_NS, 'filter');
    f.setAttribute('id', 'edgeGlow');
    const b = document.createElementNS(SVG_NS, 'feGaussianBlur');
    b.setAttribute('stdDeviation', '3'); b.setAttribute('result', 'blur');
    const m = document.createElementNS(SVG_NS, 'feMerge');
    const m1 = document.createElementNS(SVG_NS, 'feMergeNode'); m1.setAttribute('in', 'blur');
    const m2 = document.createElementNS(SVG_NS, 'feMergeNode'); m2.setAttribute('in', 'SourceGraphic');
    m.appendChild(m1); m.appendChild(m2);
    f.appendChild(b); f.appendChild(m);
    defs.appendChild(f);
  }

  // Per-edge linear gradients (source-colour → target-colour fade)
  for (const [, edge] of edges) {
    const src = nodes.get(edge.sourceId), tgt = nodes.get(edge.targetId);
    if (!src || !tgt) continue;
    const c = CANVAS_EDGE_COLORS[edge.relationshipType] || '#94a3b8';
    const lg = document.createElementNS(SVG_NS, 'linearGradient');
    lg.setAttribute('id', `eg-${edge.id}`);
    lg.setAttribute('gradientUnits', 'userSpaceOnUse');
    lg.setAttribute('x1', String(src.x)); lg.setAttribute('y1', String(src.y));
    lg.setAttribute('x2', String(tgt.x)); lg.setAttribute('y2', String(tgt.y));
    const s1 = document.createElementNS(SVG_NS, 'stop');
    s1.setAttribute('offset', '0%'); s1.setAttribute('stop-color', c); s1.setAttribute('stop-opacity', '0.3');
    const s2 = document.createElementNS(SVG_NS, 'stop');
    s2.setAttribute('offset', '100%'); s2.setAttribute('stop-color', c); s2.setAttribute('stop-opacity', '1');
    lg.appendChild(s1); lg.appendChild(s2);
    defs.appendChild(lg);
  }

  svg.appendChild(defs);

  // ── Fixed background (dot grid, outside pan/zoom group) ──
  const bgRect = document.createElementNS(SVG_NS, 'rect');
  bgRect.setAttribute('x', String(-W / 2)); bgRect.setAttribute('y', String(-H / 2));
  bgRect.setAttribute('width', String(W)); bgRect.setAttribute('height', String(H));
  bgRect.setAttribute('fill', 'url(#bgGrid)');
  bgRect.setAttribute('pointer-events', 'none');
  svg.appendChild(bgRect);

  // ── Layout annotations (ghost guides drawn behind everything) ──────────────
  const currentLayout = (document.getElementById('layoutSelect') as HTMLSelectElement | null)?.value ?? 'free';
  {
    const annotG = document.createElementNS(SVG_NS, 'g');
    annotG.setAttribute('transform', `translate(${appState.panX},${appState.panY}) scale(${appState.zoomLevel})`);
    annotG.setAttribute('pointer-events', 'none');

    if (currentLayout === 'priority-rings') {
      const rings = [
        { r: 130, label: 'Critical', color: '#ef4444' },
        { r: 260, label: 'High',     color: '#f97316' },
        { r: 420, label: 'Medium',   color: '#eab308' },
        { r: 600, label: 'Low',      color: '#6b7280' },
        { r: 800, label: 'Background', color: '#3b82f6' },
      ];
      rings.forEach(({ r, label, color }) => {
        const circ = document.createElementNS(SVG_NS, 'circle');
        circ.setAttribute('cx', '0'); circ.setAttribute('cy', '0');
        circ.setAttribute('r', String(r));
        circ.setAttribute('fill', 'none');
        circ.setAttribute('stroke', color);
        circ.setAttribute('stroke-width', '1');
        circ.setAttribute('opacity', '0.18');
        circ.setAttribute('stroke-dasharray', '6 4');
        annotG.appendChild(circ);
        const txt = document.createElementNS(SVG_NS, 'text');
        txt.setAttribute('x', String(r + 8)); txt.setAttribute('y', '-6');
        txt.setAttribute('fill', color); txt.setAttribute('font-size', '11');
        txt.setAttribute('opacity', '0.5'); txt.setAttribute('font-family', 'Inter,system-ui,sans-serif');
        txt.textContent = label;
        annotG.appendChild(txt);
      });
    } else if (currentLayout === 'pipeline') {
      const cols = [
        { x: -440, label: 'Cold Prospects', color: '#64748b' },
        { x: -220, label: 'Warm Prospects', color: '#f59e0b' },
        { x:    0, label: 'Hot Prospects',  color: '#f97316' },
        { x:  220, label: 'Clients',        color: '#3b82f6' },
      ];
      cols.forEach(({ x, label, color }) => {
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', String(x - 95)); line.setAttribute('y1', '-1500');
        line.setAttribute('x2', String(x - 95)); line.setAttribute('y2', '1500');
        line.setAttribute('stroke', color); line.setAttribute('stroke-width', '1');
        line.setAttribute('opacity', '0.1'); line.setAttribute('stroke-dasharray', '4 6');
        annotG.appendChild(line);
        const txt = document.createElementNS(SVG_NS, 'text');
        txt.setAttribute('x', String(x)); txt.setAttribute('y', '-320');
        txt.setAttribute('text-anchor', 'middle');
        txt.setAttribute('fill', color); txt.setAttribute('font-size', '11');
        txt.setAttribute('opacity', '0.45'); txt.setAttribute('font-family', 'Inter,system-ui,sans-serif');
        txt.setAttribute('font-weight', '600');
        txt.textContent = label;
        annotG.appendChild(txt);
      });
    } else if (currentLayout === 'referral-tree') {
      const txt = document.createElementNS(SVG_NS, 'text');
      txt.setAttribute('x', '0'); txt.setAttribute('y', '-420');
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('fill', '#94a3b8'); txt.setAttribute('font-size', '11');
      txt.setAttribute('opacity', '0.4'); txt.setAttribute('font-family', 'Inter,system-ui,sans-serif');
      txt.textContent = '← Original introductions — Introduced contacts →';
      annotG.appendChild(txt);
    } else if (currentLayout === 'sector-map') {
      // Show cluster labels for each sector
      const sectorMap = new Map<string, { x: number; y: number }>();
      for (const [, n] of nodes) {
        const key = (n.type === 'organisation' ? n.industry : n.sector) || n.sector || n.industry || 'Other';
        if (!sectorMap.has(key)) sectorMap.set(key, { x: n.x, y: n.y });
      }
      for (const [sector, pos] of sectorMap) {
        const txt = document.createElementNS(SVG_NS, 'text');
        txt.setAttribute('x', String(pos.x)); txt.setAttribute('y', String(pos.y - 50));
        txt.setAttribute('text-anchor', 'middle');
        txt.setAttribute('fill', '#94a3b8'); txt.setAttribute('font-size', '11');
        txt.setAttribute('opacity', '0.55'); txt.setAttribute('font-family', 'Inter,system-ui,sans-serif');
        txt.setAttribute('font-weight', '600');
        txt.textContent = sector;
        annotG.appendChild(txt);
      }
    }
    svg.appendChild(annotG);
  }

  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('transform', `translate(${appState.panX},${appState.panY}) scale(${appState.zoomLevel})`);

  // ── Pre-compute connection counts ──
  const connCount = new Map<string, number>();
  for (const [, edge] of edges) {
    connCount.set(edge.sourceId, (connCount.get(edge.sourceId) || 0) + 1);
    connCount.set(edge.targetId, (connCount.get(edge.targetId) || 0) + 1);
  }

  // ── Edges ──
  for (const [, edge] of edges) {
    const src = nodes.get(edge.sourceId), tgt = nodes.get(edge.targetId);
    if (!src || !tgt) continue;
    const isSel = appState.selectedEdgeId === edge.id;
    const isHov = appState.hoveredEdgeId === edge.id;
    const edgeColor = CANVAS_EDGE_COLORS[edge.relationshipType] || '#94a3b8';
    const geo = computeEdgePath(src, tgt, edge.bendOffset || 0);
    const { pathD, vmx, vmy, mx, my, perpX, perpY } = geo;

    // Compute bezier control point and tangent at target end
    const dxEdge = tgt.x - src.x, dyEdge = tgt.y - src.y;
    const lenEdge = Math.sqrt(dxEdge * dxEdge + dyEdge * dyEdge) || 1;
    const natBend = Math.min(lenEdge * 0.12, 55);
    const totBend = natBend + (edge.bendOffset || 0);
    const cpx = mx + perpX * totBend, cpy = my + perpY * totBend;
    const tdx = tgt.x - cpx, tdy = tgt.y - cpy;
    const tl = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
    const tnx = tdx / tl, tny = tdy / tl;
    // Arrow tip sits at the target node edge
    const tgtR = tgt.type === 'organisation' ? 22 : 20 + (tgt.referralLikelihood || 0) * 3;
    const tipX = tgt.x - tnx * tgtR, tipY = tgt.y - tny * tgtR;

    // Endpoint highlight rings when edge is selected
    if (isSel) {
      [edge.sourceId, edge.targetId].forEach((nid) => {
        const n = nodes.get(nid);
        if (!n) return;
        if (n.type === 'organisation') {
          const lbl = n.name.length > 22 ? n.name.substring(0, 19) + '…' : n.name;
          const w = Math.max(90, lbl.length * 7 + 24) + 14, h = 52;
          const gl = document.createElementNS(SVG_NS, 'rect');
          gl.setAttribute('x', String(n.x - w / 2)); gl.setAttribute('y', String(n.y - h / 2));
          gl.setAttribute('width', String(w)); gl.setAttribute('height', String(h));
          gl.setAttribute('rx', '12'); gl.setAttribute('fill', 'none');
          gl.setAttribute('stroke', '#ffd700'); gl.setAttribute('stroke-width', '2');
          gl.setAttribute('opacity', '0.55'); gl.setAttribute('pointer-events', 'none');
          g.appendChild(gl);
        } else {
          const r2 = 20 + (n.referralLikelihood || 0) * 3 + 8;
          const gl = document.createElementNS(SVG_NS, 'circle');
          gl.setAttribute('cx', String(n.x)); gl.setAttribute('cy', String(n.y));
          gl.setAttribute('r', String(r2)); gl.setAttribute('fill', 'none');
          gl.setAttribute('stroke', '#ffd700'); gl.setAttribute('stroke-width', '2');
          gl.setAttribute('opacity', '0.55'); gl.setAttribute('pointer-events', 'none');
          g.appendChild(gl);
        }
      });
    }

    // Wide transparent hit area
    const hit = document.createElementNS(SVG_NS, 'path');
    hit.setAttribute('d', pathD); hit.setAttribute('stroke', 'transparent');
    hit.setAttribute('stroke-width', '14'); hit.setAttribute('fill', 'none');
    hit.setAttribute('data-edge-id', edge.id); hit.style.cursor = 'pointer';
    g.appendChild(hit);

    // Visible curved path
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', pathD); path.setAttribute('fill', 'none');
    path.setAttribute('data-edge-id', edge.id); path.style.cursor = 'pointer';

    if (isSel) {
      path.setAttribute('stroke', '#ffd700');
      path.setAttribute('stroke-width', String(Math.max(3, 1.5 * edge.strength + 1)));
      path.setAttribute('filter', 'url(#edgeGlow)');
    } else {
      path.setAttribute('stroke', `url(#eg-${edge.id})`);
      path.setAttribute('stroke-width', String(Math.max(1.5, 1.5 * edge.strength)));
      path.setAttribute('opacity', isHov ? '1' : '0.8');

      if (edge.relationshipType === 'referred') {
        // Animated flowing dashes — direction of referral
        const dashLen = 10, gapLen = 8;
        const offset = -((now / 35) % (dashLen + gapLen));
        path.setAttribute('stroke-dasharray', `${dashLen},${gapLen}`);
        path.setAttribute('stroke-dashoffset', String(offset));
      } else if (edge.relationshipType === 'knows') {
        path.setAttribute('stroke-dasharray', '5,4');
      } else if (edge.relationshipType === 'adviser-to') {
        path.setAttribute('stroke-dasharray', '2,5');
      } else if (edge.relationshipType === 'covers') {
        path.setAttribute('stroke-dasharray', '4,4');
      }
    }
    path.setAttribute('class', 'edge');
    g.appendChild(path);

    // Arrowhead guide — separate clean path so marker always sits at node edge
    // regardless of dash animation or stroke-dashoffset on the main path
    const arrowStroke = String(Math.max(1.5, 1.5 * edge.strength));
    const arrowGuide = document.createElementNS(SVG_NS, 'path');
    arrowGuide.setAttribute('d', `M ${tipX - tnx * 12} ${tipY - tny * 12} L ${tipX} ${tipY}`);
    arrowGuide.setAttribute('stroke', isSel ? '#ffd700' : edgeColor);
    arrowGuide.setAttribute('stroke-width', arrowStroke);
    arrowGuide.setAttribute('fill', 'none');
    arrowGuide.setAttribute('marker-end', isSel ? 'url(#arrow-selected)' : `url(#${markerId(edge.relationshipType)})`);
    arrowGuide.setAttribute('pointer-events', 'none');
    g.appendChild(arrowGuide);

    // Stale dot at visual midpoint
    const stale = getEdgeStaleInfo(edge);
    if (stale.level !== 'none') {
      const sd = document.createElementNS(SVG_NS, 'circle');
      sd.setAttribute('cx', String(vmx)); sd.setAttribute('cy', String(vmy)); sd.setAttribute('r', '5');
      sd.setAttribute('fill', stale.color); sd.setAttribute('stroke', '#0f172a'); sd.setAttribute('stroke-width', '1.5');
      sd.setAttribute('pointer-events', 'none');
      g.appendChild(sd);
    }

    // Relationship label pill
    if (appState.showEdgeLabels) {
      const labelText = edge.relationshipType;
      const lx = vmx, ly = vmy + (stale.level !== 'none' ? -14 : 0);
      const tw = labelText.length * 5.5 + 14;
      const lbg = document.createElementNS(SVG_NS, 'rect');
      lbg.setAttribute('x', String(lx - tw / 2)); lbg.setAttribute('y', String(ly - 9));
      lbg.setAttribute('width', String(tw)); lbg.setAttribute('height', '16');
      lbg.setAttribute('rx', '4'); lbg.setAttribute('fill', '#0f172a');
      lbg.setAttribute('stroke', isSel ? '#ffd700' : edgeColor + '55');
      lbg.setAttribute('stroke-width', '1'); lbg.setAttribute('pointer-events', 'none');
      g.appendChild(lbg);
      const ltx = document.createElementNS(SVG_NS, 'text');
      ltx.setAttribute('x', String(lx)); ltx.setAttribute('y', String(ly));
      ltx.setAttribute('text-anchor', 'middle'); ltx.setAttribute('dy', '0.32em');
      ltx.setAttribute('font-size', '9'); ltx.setAttribute('font-weight', '600');
      ltx.setAttribute('fill', isSel ? '#ffd700' : edgeColor);
      ltx.setAttribute('pointer-events', 'none');
      ltx.textContent = labelText;
      g.appendChild(ltx);
    }

    // Midpoint drag handle
    const handleOpacity = isSel ? 1 : isHov ? 0.75 : 0.25;
    const handleR = isSel ? 6 : isHov ? 5 : 4;
    const handleEl = document.createElementNS(SVG_NS, 'circle');
    handleEl.setAttribute('cx', String(vmx)); handleEl.setAttribute('cy', String(vmy));
    handleEl.setAttribute('r', String(handleR));
    handleEl.setAttribute('fill', isSel ? '#ffd700' : '#0f172a');
    handleEl.setAttribute('stroke', isSel ? '#d97706' : edgeColor);
    handleEl.setAttribute('stroke-width', '2'); handleEl.setAttribute('opacity', String(handleOpacity));
    handleEl.setAttribute('data-edge-handle-id', edge.id); handleEl.style.cursor = 'grab';
    g.appendChild(handleEl);
  }

  // ── Hub & Spoke node rendering (Kumu-style) ──────────────────────────────
  if (currentLayout === 'hub-spoke') {
    // Determine hubs (org nodes + ≥3 connections)
    const hubIds = new Set<string>();
    for (const [id, n] of nodes) {
      if (n.type === 'organisation' || (connCount.get(id) || 0) >= 3) hubIds.add(id);
    }
    if (hubIds.size === 0) {
      const sorted = Array.from(nodes.keys()).sort((a, b) => (connCount.get(b) || 0) - (connCount.get(a) || 0));
      sorted.slice(0, 5).forEach((id) => hubIds.add(id));
    }

    for (const [id, node] of nodes) {
      if (appState.filter !== 'all' && node.type !== appState.filter) continue;
      const isSel = appState.selectedNodeId === id;
      const isHov = appState.hoveredNodeId === id;
      const isLinkSrc = appState.linkSourceNodeId === id;
      const cc = connCount.get(id) || 0;
      const isHub = hubIds.has(id);
      const nodeCol = NODE_COLORS[node.type] || '#374151';
      const strokeCol = isLinkSrc ? '#fbbf24' : isSel ? '#ffd700' : isHov ? '#e2e8f0' : 'rgba(255,255,255,0.15)';
      const strokeW = isSel || isLinkSrc ? '3' : isHub ? '2.5' : '2';

      // Hub radius scales with connection count; min 36, max 62
      const hubR = isHub ? Math.min(62, Math.max(36, 36 + cc * 2.5)) : 0;
      const spokeR = 22;
      const r = isHub ? hubR : spokeR;

      // Selection pulse
      if (isSel) {
        const pulse = (now % 2000) / 2000;
        const pr = document.createElementNS(SVG_NS, 'circle');
        pr.setAttribute('cx', String(node.x)); pr.setAttribute('cy', String(node.y));
        pr.setAttribute('r', String(r + 10 + pulse * 24));
        pr.setAttribute('fill', 'none'); pr.setAttribute('stroke', '#ffd700');
        pr.setAttribute('stroke-width', '2'); pr.setAttribute('opacity', String(0.7 * (1 - pulse)));
        pr.setAttribute('pointer-events', 'none');
        g.appendChild(pr);
        appState.animationRunning = true;
      }

      // Hover halo
      if (isHov && !isSel) {
        const hl = document.createElementNS(SVG_NS, 'circle');
        hl.setAttribute('cx', String(node.x)); hl.setAttribute('cy', String(node.y));
        hl.setAttribute('r', String(r + 8));
        hl.setAttribute('fill', nodeCol); hl.setAttribute('opacity', '0.15');
        hl.setAttribute('pointer-events', 'none');
        g.appendChild(hl);
      }

      // Priority glow ring
      const pgMap: Record<string, string> = { critical: '#ef4444', high: '#f97316' };
      const pg = pgMap[node.priority];
      if (pg) {
        const pRing = document.createElementNS(SVG_NS, 'circle');
        pRing.setAttribute('cx', String(node.x)); pRing.setAttribute('cy', String(node.y));
        pRing.setAttribute('r', String(r + (isHub ? 8 : 6)));
        pRing.setAttribute('fill', 'none'); pRing.setAttribute('stroke', pg);
        pRing.setAttribute('stroke-width', '2.5'); pRing.setAttribute('opacity', '0.5');
        pRing.setAttribute('pointer-events', 'none');
        g.appendChild(pRing);
      }

      if (isHub) {
        // ── Large hub circle ──
        // Outer glow ring
        const glow = document.createElementNS(SVG_NS, 'circle');
        glow.setAttribute('cx', String(node.x)); glow.setAttribute('cy', String(node.y));
        glow.setAttribute('r', String(r + 6));
        glow.setAttribute('fill', nodeCol); glow.setAttribute('opacity', '0.12');
        glow.setAttribute('pointer-events', 'none');
        g.appendChild(glow);

        const circ = document.createElementNS(SVG_NS, 'circle');
        circ.setAttribute('cx', String(node.x)); circ.setAttribute('cy', String(node.y));
        circ.setAttribute('r', String(r));
        circ.setAttribute('fill', nodeCol);
        circ.setAttribute('stroke', strokeCol); circ.setAttribute('stroke-width', strokeW);
        circ.setAttribute('class', 'node'); circ.setAttribute('data-node-id', id);
        if (isSel) circ.setAttribute('filter', 'url(#nodeSelect)');
        else if (isHov) circ.setAttribute('filter', 'url(#nodeGlow)');
        g.appendChild(circ);

        // Hub name inside (two lines if needed)
        const words = node.name.split(' ');
        const line1 = words.slice(0, Math.ceil(words.length / 2)).join(' ');
        const line2 = words.slice(Math.ceil(words.length / 2)).join(' ');
        const tl1 = document.createElementNS(SVG_NS, 'text');
        tl1.setAttribute('x', String(node.x)); tl1.setAttribute('y', String(node.y + (line2 ? -7 : 0)));
        tl1.setAttribute('text-anchor', 'middle'); tl1.setAttribute('dy', '0.35em');
        tl1.setAttribute('font-size', String(Math.max(9, Math.min(13, r * 0.28))));
        tl1.setAttribute('font-weight', '700');
        tl1.setAttribute('fill', '#fff'); tl1.setAttribute('pointer-events', 'none');
        tl1.textContent = line1.length > 16 ? line1.slice(0, 14) + '…' : line1;
        g.appendChild(tl1);
        if (line2) {
          const tl2 = document.createElementNS(SVG_NS, 'text');
          tl2.setAttribute('x', String(node.x)); tl2.setAttribute('y', String(node.y + 9));
          tl2.setAttribute('text-anchor', 'middle'); tl2.setAttribute('dy', '0.35em');
          tl2.setAttribute('font-size', String(Math.max(9, Math.min(13, r * 0.28))));
          tl2.setAttribute('font-weight', '700');
          tl2.setAttribute('fill', '#fff'); tl2.setAttribute('pointer-events', 'none');
          tl2.textContent = line2.length > 16 ? line2.slice(0, 14) + '…' : line2;
          g.appendChild(tl2);
        }

        // Connection count badge
        if (cc > 0) {
          const bx = node.x + r * 0.75, by = node.y - r * 0.75;
          const bdg = document.createElementNS(SVG_NS, 'circle');
          bdg.setAttribute('cx', String(bx)); bdg.setAttribute('cy', String(by));
          bdg.setAttribute('r', '11'); bdg.setAttribute('fill', '#0f172a');
          bdg.setAttribute('stroke', '#60a5fa'); bdg.setAttribute('stroke-width', '2');
          bdg.setAttribute('pointer-events', 'none'); g.appendChild(bdg);
          const bTx = document.createElementNS(SVG_NS, 'text');
          bTx.setAttribute('x', String(bx)); bTx.setAttribute('y', String(by));
          bTx.setAttribute('text-anchor', 'middle'); bTx.setAttribute('dy', '0.35em');
          bTx.setAttribute('font-size', '9'); bTx.setAttribute('font-weight', '700');
          bTx.setAttribute('fill', '#93c5fd'); bTx.setAttribute('pointer-events', 'none');
          bTx.textContent = String(cc); g.appendChild(bTx);
        }

      } else {
        // ── Spoke circle (person avatar) ──
        const circ = document.createElementNS(SVG_NS, 'circle');
        circ.setAttribute('cx', String(node.x)); circ.setAttribute('cy', String(node.y));
        circ.setAttribute('r', String(spokeR));
        circ.setAttribute('fill', nodeCol);
        circ.setAttribute('stroke', strokeCol); circ.setAttribute('stroke-width', strokeW);
        circ.setAttribute('class', 'node'); circ.setAttribute('data-node-id', id);
        if (isSel) circ.setAttribute('filter', 'url(#nodeSelect)');
        else if (isHov) circ.setAttribute('filter', 'url(#nodeGlow)');
        g.appendChild(circ);

        // Initials
        const initTx = document.createElementNS(SVG_NS, 'text');
        initTx.setAttribute('x', String(node.x)); initTx.setAttribute('y', String(node.y));
        initTx.setAttribute('text-anchor', 'middle'); initTx.setAttribute('dy', '0.35em');
        initTx.setAttribute('font-size', '11'); initTx.setAttribute('font-weight', '700');
        initTx.setAttribute('fill', '#fff'); initTx.setAttribute('pointer-events', 'none');
        initTx.textContent = getInitials(node.name).substring(0, 2);
        g.appendChild(initTx);

        // Name below
        const nameLbl = document.createElementNS(SVG_NS, 'text');
        nameLbl.setAttribute('x', String(node.x));
        nameLbl.setAttribute('y', String(node.y + spokeR + 14));
        nameLbl.setAttribute('text-anchor', 'middle'); nameLbl.setAttribute('font-size', '11');
        nameLbl.setAttribute('font-weight', '600');
        nameLbl.setAttribute('fill', isSel ? '#ffd700' : '#cbd5e1');
        nameLbl.setAttribute('pointer-events', 'none');
        nameLbl.textContent = node.name.length > 15 ? node.name.substring(0, 12) + '…' : node.name;
        g.appendChild(nameLbl);

        // Engagement dots
        if (node.engagementScore > 0) {
          for (let i = 0; i < 5; i++) {
            const d = document.createElementNS(SVG_NS, 'circle');
            d.setAttribute('cx', String(node.x - 10 + i * 5));
            d.setAttribute('cy', String(node.y + spokeR + 26));
            d.setAttribute('r', '2.5');
            d.setAttribute('fill', i < node.engagementScore ? '#60a5fa' : '#1e293b');
            d.setAttribute('pointer-events', 'none');
            g.appendChild(d);
          }
        }
      }
    }

    svg.appendChild(g);
    const emptyState = document.getElementById('emptyState');
    if (emptyState) emptyState.style.display = nodes.size === 0 ? 'block' : 'none';
    return; // skip standard node rendering
  }

  // ── Nodes (standard rendering) ─────────────────────────────────────────────
  for (const [id, node] of nodes) {
    if (appState.filter !== 'all' && node.type !== appState.filter) continue;
    const isSel = appState.selectedNodeId === id;
    const isHov = appState.hoveredNodeId === id;
    const isLinkSrc = appState.linkSourceNodeId === id;
    const cc = connCount.get(id) || 0;

    const strokeCol = isLinkSrc ? '#fbbf24' : isSel ? '#ffd700' : isHov ? '#93c5fd' : 'rgba(255,255,255,0.2)';
    const strokeW = isSel || isLinkSrc ? '2.5' : '1.5';
    const filterAttr = isSel ? 'url(#nodeSelect)' : isHov ? 'url(#nodeGlow)' : '';

    // Priority glow ring in 2D
    const PRIORITY_GLOW_2D: Record<string, { color: string; r: number }> = {
      critical:   { color: '#ef4444', r: 22 },
      high:       { color: '#f97316', r: 20 },
      medium:     { color: 'transparent', r: 0 },
      low:        { color: 'transparent', r: 0 },
      background: { color: 'transparent', r: 0 },
    };
    const pg = PRIORITY_GLOW_2D[node.priority || 'medium'];
    if (pg && pg.r > 0) {
      const pRing = document.createElementNS(SVG_NS, 'circle');
      pRing.setAttribute('cx', String(node.x)); pRing.setAttribute('cy', String(node.y));
      pRing.setAttribute('r', String(pg.r));
      pRing.setAttribute('fill', 'none');
      pRing.setAttribute('stroke', pg.color);
      pRing.setAttribute('stroke-width', '2');
      pRing.setAttribute('opacity', '0.45');
      pRing.setAttribute('pointer-events', 'none');
      g.appendChild(pRing);
    }

    if (node.type === 'organisation') {
      const lbl = node.name.length > 22 ? node.name.substring(0, 19) + '…' : node.name;
      const w = Math.max(90, lbl.length * 7 + 24), h = 38;

      if (node.researching) {
        const pulse = (now % 1200) / 1200;
        const pad = 6 + pulse * 10;
        const pr = document.createElementNS(SVG_NS, 'rect');
        pr.setAttribute('x', String(node.x - w / 2 - pad)); pr.setAttribute('y', String(node.y - h / 2 - pad));
        pr.setAttribute('width', String(w + pad * 2)); pr.setAttribute('height', String(h + pad * 2));
        pr.setAttribute('rx', '12'); pr.setAttribute('fill', 'none');
        pr.setAttribute('stroke', '#fbbf24'); pr.setAttribute('stroke-width', '2.5');
        pr.setAttribute('opacity', String(1 - pulse)); pr.setAttribute('pointer-events', 'none');
        g.appendChild(pr);
        appState.animationRunning = true;
      }

      // Selected pulse
      if (isSel) {
        const pulse = (now % 2000) / 2000;
        const pad2 = 6 + pulse * 18;
        const pr2 = document.createElementNS(SVG_NS, 'rect');
        pr2.setAttribute('x', String(node.x - w / 2 - pad2)); pr2.setAttribute('y', String(node.y - h / 2 - pad2));
        pr2.setAttribute('width', String(w + pad2 * 2)); pr2.setAttribute('height', String(h + pad2 * 2));
        pr2.setAttribute('rx', String(8 + pad2)); pr2.setAttribute('fill', 'none');
        pr2.setAttribute('stroke', '#ffd700'); pr2.setAttribute('stroke-width', '1.5');
        pr2.setAttribute('opacity', String(0.6 * (1 - pulse))); pr2.setAttribute('pointer-events', 'none');
        g.appendChild(pr2);
      }

      const r = document.createElementNS(SVG_NS, 'rect');
      r.setAttribute('x', String(node.x - w / 2)); r.setAttribute('y', String(node.y - h / 2));
      r.setAttribute('width', String(w)); r.setAttribute('height', String(h));
      r.setAttribute('rx', '8'); r.setAttribute('ry', '8');
      r.setAttribute('fill', NODE_COLORS['organisation']);
      r.setAttribute('stroke', strokeCol); r.setAttribute('stroke-width', strokeW);
      r.setAttribute('class', 'node'); r.setAttribute('data-node-id', id);
      if (filterAttr) r.setAttribute('filter', filterAttr);
      g.appendChild(r);

      const tx = document.createElementNS(SVG_NS, 'text');
      tx.setAttribute('x', String(node.x)); tx.setAttribute('y', String(node.y));
      tx.setAttribute('text-anchor', 'middle'); tx.setAttribute('dy', '0.35em');
      tx.setAttribute('font-size', '11'); tx.setAttribute('font-weight', 'bold');
      tx.setAttribute('fill', '#e2e8f0'); tx.setAttribute('pointer-events', 'none');
      tx.textContent = lbl;
      g.appendChild(tx);

      const sub = document.createElementNS(SVG_NS, 'text');
      sub.setAttribute('x', String(node.x)); sub.setAttribute('y', String(node.y + h / 2 + 13));
      sub.setAttribute('text-anchor', 'middle'); sub.setAttribute('font-size', '10');
      sub.setAttribute('fill', '#94a3b8'); sub.setAttribute('pointer-events', 'none');
      sub.textContent = 'Organisation';
      g.appendChild(sub);

      if (cc > 0) {
        const bx = node.x + w / 2 + 2, by = node.y - h / 2 - 2;
        const badge = document.createElementNS(SVG_NS, 'circle');
        badge.setAttribute('cx', String(bx)); badge.setAttribute('cy', String(by));
        badge.setAttribute('r', '9'); badge.setAttribute('fill', '#0f172a');
        badge.setAttribute('stroke', '#60a5fa'); badge.setAttribute('stroke-width', '1.5');
        badge.setAttribute('pointer-events', 'none');
        g.appendChild(badge);
        const btx = document.createElementNS(SVG_NS, 'text');
        btx.setAttribute('x', String(bx)); btx.setAttribute('y', String(by));
        btx.setAttribute('text-anchor', 'middle'); btx.setAttribute('dy', '0.35em');
        btx.setAttribute('font-size', '8'); btx.setAttribute('font-weight', '700');
        btx.setAttribute('fill', '#93c5fd'); btx.setAttribute('pointer-events', 'none');
        btx.textContent = String(cc);
        g.appendChild(btx);
      }

    } else {
      const radius = 20 + node.referralLikelihood * 3;

      if (node.researching) {
        const pulse = (now % 1200) / 1200;
        const pr = document.createElementNS(SVG_NS, 'circle');
        pr.setAttribute('cx', String(node.x)); pr.setAttribute('cy', String(node.y));
        pr.setAttribute('r', String(radius + 6 + pulse * 10));
        pr.setAttribute('fill', 'none'); pr.setAttribute('stroke', '#fbbf24');
        pr.setAttribute('stroke-width', '2.5'); pr.setAttribute('opacity', String(1 - pulse));
        pr.setAttribute('pointer-events', 'none');
        g.appendChild(pr);
        appState.animationRunning = true;
      }

      // Animated pulse ring for selected node
      if (isSel) {
        const pulse = (now % 2000) / 2000;
        const pr = document.createElementNS(SVG_NS, 'circle');
        pr.setAttribute('cx', String(node.x)); pr.setAttribute('cy', String(node.y));
        pr.setAttribute('r', String(radius + 8 + pulse * 20));
        pr.setAttribute('fill', 'none'); pr.setAttribute('stroke', '#ffd700');
        pr.setAttribute('stroke-width', '1.5'); pr.setAttribute('opacity', String(0.65 * (1 - pulse)));
        pr.setAttribute('pointer-events', 'none');
        g.appendChild(pr);
      }

      // Warm aura for high-likelihood contacts
      if (node.referralLikelihood >= 4 && !isSel) {
        const aura = document.createElementNS(SVG_NS, 'circle');
        aura.setAttribute('cx', String(node.x)); aura.setAttribute('cy', String(node.y));
        aura.setAttribute('r', String(radius + 14));
        aura.setAttribute('fill', 'none');
        aura.setAttribute('stroke', NODE_GRADIENTS[node.type][0]);
        aura.setAttribute('stroke-width', '10'); aura.setAttribute('opacity', '0.12');
        aura.setAttribute('pointer-events', 'none');
        g.appendChild(aura);
      }

      // Main shape — distinct per node type
      if (node.type === 'referrer') {
        const poly = document.createElementNS(SVG_NS, 'polygon');
        poly.setAttribute('points', diamondPoints(node.x, node.y, radius * 1.2));
        poly.setAttribute('fill', NODE_COLORS['referrer']);
        poly.setAttribute('stroke', strokeCol); poly.setAttribute('stroke-width', strokeW);
        poly.setAttribute('class', 'node'); poly.setAttribute('data-node-id', id);
        if (filterAttr) poly.setAttribute('filter', filterAttr);
        g.appendChild(poly);
      } else if (node.type === 'prospect') {
        const poly = document.createElementNS(SVG_NS, 'polygon');
        poly.setAttribute('points', hexagonPoints(node.x, node.y, radius * 1.1));
        poly.setAttribute('fill', NODE_COLORS['prospect']);
        poly.setAttribute('stroke', strokeCol); poly.setAttribute('stroke-width', strokeW);
        poly.setAttribute('class', 'node'); poly.setAttribute('data-node-id', id);
        if (filterAttr) poly.setAttribute('filter', filterAttr);
        g.appendChild(poly);
      } else if (node.type === 'adviser') {
        const poly = document.createElementNS(SVG_NS, 'polygon');
        poly.setAttribute('points', pentagonPoints(node.x, node.y, radius * 1.1));
        poly.setAttribute('fill', NODE_COLORS['adviser']);
        poly.setAttribute('stroke', strokeCol); poly.setAttribute('stroke-width', strokeW);
        poly.setAttribute('class', 'node'); poly.setAttribute('data-node-id', id);
        if (filterAttr) poly.setAttribute('filter', filterAttr);
        g.appendChild(poly);
      } else {
        // Circle (client, jpmorgan)
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', String(node.x)); circle.setAttribute('cy', String(node.y));
        circle.setAttribute('r', String(radius));
        circle.setAttribute('fill', NODE_COLORS[node.type] || '#374151');
        circle.setAttribute('stroke', strokeCol); circle.setAttribute('stroke-width', strokeW);
        circle.setAttribute('class', 'node'); circle.setAttribute('data-node-id', id);
        if (filterAttr) circle.setAttribute('filter', filterAttr);
        g.appendChild(circle);

        if (node.type === 'jpmorgan') {
          const ring1 = document.createElementNS(SVG_NS, 'circle');
          ring1.setAttribute('cx', String(node.x)); ring1.setAttribute('cy', String(node.y));
          ring1.setAttribute('r', String(radius + 5));
          ring1.setAttribute('fill', 'none'); ring1.setAttribute('stroke', '#93c5fd');
          ring1.setAttribute('stroke-width', '1.5'); ring1.setAttribute('stroke-dasharray', '4,3');
          ring1.setAttribute('opacity', '0.6'); ring1.setAttribute('pointer-events', 'none');
          g.appendChild(ring1);
          const ring2 = document.createElementNS(SVG_NS, 'circle');
          ring2.setAttribute('cx', String(node.x)); ring2.setAttribute('cy', String(node.y));
          ring2.setAttribute('r', String(radius + 11));
          ring2.setAttribute('fill', 'none'); ring2.setAttribute('stroke', '#3b82f6');
          ring2.setAttribute('stroke-width', '1'); ring2.setAttribute('stroke-dasharray', '2,6');
          ring2.setAttribute('opacity', '0.3'); ring2.setAttribute('pointer-events', 'none');
          g.appendChild(ring2);
        }
      }

      // Initials
      const initTx = document.createElementNS(SVG_NS, 'text');
      initTx.setAttribute('x', String(node.x)); initTx.setAttribute('y', String(node.y));
      initTx.setAttribute('text-anchor', 'middle'); initTx.setAttribute('dy', '0.3em');
      initTx.setAttribute('font-size', '12'); initTx.setAttribute('font-weight', 'bold');
      initTx.setAttribute('fill', '#fff'); initTx.setAttribute('pointer-events', 'none');
      initTx.textContent = getInitials(node.name).substring(0, 2);
      g.appendChild(initTx);

      // Name label
      const nameLbl = document.createElementNS(SVG_NS, 'text');
      nameLbl.setAttribute('x', String(node.x));
      nameLbl.setAttribute('y', String(node.y + radius + 16));
      nameLbl.setAttribute('text-anchor', 'middle'); nameLbl.setAttribute('font-size', '11');
      nameLbl.setAttribute('font-weight', '600');
      nameLbl.setAttribute('fill', isSel ? '#ffd700' : '#cbd5e1');
      nameLbl.setAttribute('pointer-events', 'none');
      nameLbl.textContent = node.name.length > 16 ? node.name.substring(0, 13) + '…' : node.name;
      g.appendChild(nameLbl);

      // Engagement dots
      if (node.engagementScore > 0) {
        const dotY = node.y + radius + 30;
        for (let i = 0; i < 5; i++) {
          const d = document.createElementNS(SVG_NS, 'circle');
          d.setAttribute('cx', String(node.x - 10 + i * 5)); d.setAttribute('cy', String(dotY));
          d.setAttribute('r', '2.5');
          d.setAttribute('fill', i < node.engagementScore ? '#60a5fa' : '#1e293b');
          d.setAttribute('pointer-events', 'none');
          g.appendChild(d);
        }
      }

      // Connection count badge
      if (cc > 0) {
        const bx = node.x + radius * 0.72, by = node.y - radius * 0.72;
        const badge = document.createElementNS(SVG_NS, 'circle');
        badge.setAttribute('cx', String(bx)); badge.setAttribute('cy', String(by));
        badge.setAttribute('r', '9'); badge.setAttribute('fill', '#0f172a');
        badge.setAttribute('stroke', '#60a5fa'); badge.setAttribute('stroke-width', '1.5');
        badge.setAttribute('pointer-events', 'none');
        g.appendChild(badge);
        const btx = document.createElementNS(SVG_NS, 'text');
        btx.setAttribute('x', String(bx)); btx.setAttribute('y', String(by));
        btx.setAttribute('text-anchor', 'middle'); btx.setAttribute('dy', '0.35em');
        btx.setAttribute('font-size', '8'); btx.setAttribute('font-weight', '700');
        btx.setAttribute('fill', '#93c5fd'); btx.setAttribute('pointer-events', 'none');
        btx.textContent = String(cc);
        g.appendChild(btx);
      }
    }
  }

  svg.appendChild(g);
  const emptyState = document.getElementById('emptyState');
  if (emptyState) emptyState.style.display = nodes.size === 0 ? 'block' : 'none';
}

// ============================================================================
// CANVAS COMPONENT
// ============================================================================

export default function Canvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const { bumpGraph, bumpDetail, setModal } = useStore.getState();

  useEffect(() => {
    const svg = svgRef.current!;
    const container = svg.parentElement as HTMLElement;

    function toWorld(clientX: number, clientY: number) {
      const r = svg.getBoundingClientRect();
      return {
        wx: (clientX - r.left - r.width / 2 - appState.panX) / appState.zoomLevel,
        wy: (clientY - r.top  - r.height / 2 - appState.panY) / appState.zoomLevel,
      };
    }

    function selectNode(nodeId: string) {
      appState.selectedNodeId = nodeId;
      appState.selectedEdgeId = null;
      appState.detailMode = 'node';
      const node = appState.simulation.nodes.get(nodeId);
      if (node) {
        appState.panTargetX = -node.x * appState.zoomLevel;
        appState.panTargetY = -node.y * appState.zoomLevel;
      }
      bumpDetail();
    }

    function selectEdge(edgeId: string) {
      appState.selectedEdgeId = edgeId;
      appState.selectedNodeId = null;
      appState.detailMode = 'edge';
      bumpDetail();
    }

    function deselect() {
      appState.selectedNodeId = null;
      appState.selectedEdgeId = null;
      appState.detailMode = null;
      bumpDetail();
    }

    function showEdgeTooltip(edgeId: string, clientX: number, clientY: number) {
      if (appState.draggingEdgeHandle || appState.draggingNodeId) return;
      const edge = appState.simulation.edges.get(edgeId);
      if (!edge) return;
      const src = appState.simulation.nodes.get(edge.sourceId);
      const tgt = appState.simulation.nodes.get(edge.targetId);
      if (!src || !tgt) return;

      const route = document.getElementById('etRoute');
      const typeEl = document.getElementById('etType');
      const strEl = document.getElementById('etStrength');
      const dateEl = document.getElementById('etDate');
      const notesEl = document.getElementById('etNotes');
      const tip = document.getElementById('edgeTooltip');
      if (!route || !typeEl || !strEl || !dateEl || !notesEl || !tip) return;

      route.textContent = `${src.name} → ${tgt.name}`;
      const col = CANVAS_EDGE_COLORS[edge.relationshipType] || '#888';
      typeEl.textContent = edge.relationshipType;
      typeEl.style.background = col + '22';
      typeEl.style.color = col;
      typeEl.style.border = `1px solid ${col}44`;
      strEl.innerHTML = [1, 2, 3].map((i) => `<span class="${i <= edge.strength ? 'filled' : ''}"></span>`).join('');
      const stale = getEdgeStaleInfo(edge);
      if (edge.lastContact) {
        dateEl.innerHTML = `Last contact: <span class="stale-${stale.level}">${stale.label}</span>`;
      } else {
        dateEl.textContent = '';
      }
      notesEl.textContent = edge.notes
        ? (edge.notes.length > 60 ? edge.notes.substring(0, 57) + '…' : edge.notes)
        : '';
      tip.classList.add('visible');
      const tw = 260, th = 120;
      tip.style.left = (clientX + 12 + tw > window.innerWidth ? clientX - tw - 8 : clientX + 12) + 'px';
      tip.style.top  = (clientY + 12 + th > window.innerHeight ? clientY - th - 8 : clientY + 12) + 'px';
    }

    function hideEdgeTooltip() {
      document.getElementById('edgeTooltip')?.classList.remove('visible');
    }

    // ── Node hover tooltip ──
    let nodeTooltipTimer: ReturnType<typeof setTimeout> | null = null;

    function showNodeTooltip(nodeId: string, clientX: number, clientY: number) {
      if (appState.draggingNodeId) return;
      const node = appState.simulation.nodes.get(nodeId);
      if (!node) return;

      const tip     = document.getElementById('nodeTooltip');
      const avatar  = document.getElementById('ntAvatar');
      const nameEl  = document.getElementById('ntName');
      const subEl   = document.getElementById('ntSub');
      const typeEl  = document.getElementById('ntType');
      const bodyEl  = document.getElementById('ntBody');
      if (!tip || !avatar || !nameEl || !subEl || !typeEl || !bodyEl) return;

      // Avatar initials / emoji
      const color = NODE_COLORS[node.type] || '#888';
      avatar.style.background = color;
      avatar.textContent = node.type === 'organisation' ? '🏢'
        : (node.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?');

      // Name & sub-line
      nameEl.textContent = node.name || 'Unnamed';
      subEl.textContent  = node.type === 'organisation'
        ? (node.industry || node.website || '')
        : node.type === 'jpmorgan'
          ? (node.jpmTitle || node.areaOfFocus || 'JPM')
          : [node.organisation, node.sector].filter(Boolean).join(' · ');

      // Type badge
      const typeLabel: Record<string, string> = {
        client: 'Client', prospect: 'Prospect', referrer: 'Referrer',
        adviser: 'Adviser', jpmorgan: 'JPM', organisation: 'Organisation',
      };
      typeEl.textContent = typeLabel[node.type] || node.type;
      typeEl.className = `nt-type type-${node.type}`;

      // Body rows
      const rows: string[] = [];

      if (node.type !== 'organisation' && node.type !== 'jpmorgan') {
        if (node.engagementScore) {
          const dots = [1,2,3,4,5].map((i) =>
            `<span class="nt-dot${i <= node.engagementScore ? ' on' : ''}"></span>`).join('');
          rows.push(`<div class="nt-row"><span class="nt-label">Engagement</span><span class="nt-dots">${dots}</span></div>`);
        }
        if (node.referralLikelihood) {
          const dots = [1,2,3,4,5].map((i) =>
            `<span class="nt-dot${i <= node.referralLikelihood ? ' on' : ''}"></span>`).join('');
          rows.push(`<div class="nt-row"><span class="nt-label">Referral</span><span class="nt-dots">${dots}</span></div>`);
        }
        if ((node.type === 'client' || node.type === 'prospect') && node.estimatedAUM)
          rows.push(`<div class="nt-row"><span class="nt-label">Net Worth</span><span>${node.estimatedAUM}</span></div>`);
      }
      if (node.type === 'jpmorgan') {
        if (node.firmsCovered) rows.push(`<div class="nt-row"><span class="nt-label">Covers</span><span>${node.firmsCovered.length > 40 ? node.firmsCovered.slice(0, 38) + '…' : node.firmsCovered}</span></div>`);
      }
      if (node.type === 'organisation') {
        if (node.estimatedAUM) rows.push(`<div class="nt-row"><span class="nt-label">AUM</span><span>${node.estimatedAUM}</span></div>`);
        if (node.keyContacts)  rows.push(`<div class="nt-row"><span class="nt-label">Contacts</span><span>${node.keyContacts.length > 40 ? node.keyContacts.slice(0, 38) + '…' : node.keyContacts}</span></div>`);
      }

      // Connections count
      const connCount = Array.from(appState.simulation.edges.values())
        .filter((e) => e.sourceId === nodeId || e.targetId === nodeId).length;
      if (connCount) rows.push(`<div class="nt-row"><span class="nt-label">Connections</span><span>${connCount}</span></div>`);

      if (node.notes) {
        const snippet = node.notes.length > 80 ? node.notes.slice(0, 78) + '…' : node.notes;
        rows.push(`<div class="nt-notes">${snippet}</div>`);
      }

      bodyEl.innerHTML = rows.join('');

      // Position tooltip — follow cursor, flip if near edges
      tip.classList.add('visible');
      const tw = 260, th = tip.offsetHeight || 160;
      const margin = 14;
      const left = clientX + margin + tw > window.innerWidth  ? clientX - tw - margin : clientX + margin;
      const top  = clientY + margin + th > window.innerHeight ? clientY - th - margin : clientY + margin;
      tip.style.left = left + 'px';
      tip.style.top  = top  + 'px';
    }

    function hideNodeTooltip() {
      if (nodeTooltipTimer) { clearTimeout(nodeTooltipTimer); nodeTooltipTimer = null; }
      document.getElementById('nodeTooltip')?.classList.remove('visible');
    }

    function showContextMenu(clientX: number, clientY: number, nodeId: string) {
      const m = document.getElementById('contextMenu')!;
      (window as unknown as Record<string, unknown>)._contextMenuNodeId = nodeId;
      m.style.display = 'block';
      m.style.left = clientX + 'px';
      m.style.top  = clientY + 'px';
    }

    function showEdgeContextMenu(clientX: number, clientY: number, edgeId: string) {
      (window as unknown as Record<string, unknown>)._contextMenuEdgeId = edgeId;
      const edge = appState.simulation.edges.get(edgeId);
      const ecReverse = document.getElementById('ecReverse');
      if (ecReverse) {
        ecReverse.style.display = edge && edge.relationshipType === 'referred' ? 'block' : 'none';
      }
      const m = document.getElementById('edgeContextMenu')!;
      m.style.display = 'block';
      m.style.left = clientX + 'px';
      m.style.top  = clientY + 'px';
    }

    function setLinkMode(active: boolean) {
      appState.linkMode = active;
      if (!active) appState.linkSourceNodeId = null;
      const btn = document.getElementById('linkNodesBtn');
      const tip = document.getElementById('linkTip');
      if (active) {
        btn?.classList.add('link-active');
        container.classList.add('link-mode');
        tip?.classList.add('visible');
      } else {
        btn?.classList.remove('link-active');
        container.classList.remove('link-mode');
        if (tip) { tip.classList.remove('visible'); tip.textContent = 'Click the first node, then the second to connect them'; }
      }
    }

    function onMouseDown(e: MouseEvent) {
      const target = e.target as Element;
      const handleEdgeId = target.getAttribute('data-edge-handle-id');
      const nodeId = target.getAttribute('data-node-id');

      if (handleEdgeId && !appState.linkMode) {
        e.stopPropagation();
        const edge = appState.simulation.edges.get(handleEdgeId);
        const src = appState.simulation.nodes.get(edge?.sourceId || '');
        const tgt = appState.simulation.nodes.get(edge?.targetId || '');
        if (edge && src && tgt) {
          const { wx: cx, wy: cy } = toWorld(e.clientX, e.clientY);
          const geo = computeEdgePath(src, tgt, 0);
          appState.draggingEdgeHandle = {
            edgeId: handleEdgeId,
            startBend: edge.bendOffset || 0,
            startMouseX: cx, startMouseY: cy,
            perpX: geo.perpX, perpY: geo.perpY,
            hasMoved: false,
          };
        }
      } else if (nodeId && !appState.linkMode) {
        appState.draggingNodeId = nodeId;
        const dn = appState.simulation.nodes.get(nodeId);
        if (dn) {
          dn.fixed = true;
          appState.dragStartX = dn.x;
          appState.dragStartY = dn.y;
        }
      } else if (!appState.linkMode) {
        appState.isPanning = true;
        appState.panStartX = e.clientX;
        appState.panStartY = e.clientY;
        appState.panStartPanX = appState.panX;
        appState.panStartPanY = appState.panY;
        appState.panHasMoved = false;
        appState.panTargetX = null;
        appState.panTargetY = null;
        container.classList.add('panning');
      }
    }

    function onMouseMove(e: MouseEvent) {
      const { wx: cx, wy: cy } = toWorld(e.clientX, e.clientY);

      if (appState.draggingEdgeHandle) {
        const dh = appState.draggingEdgeHandle;
        const edge = appState.simulation.edges.get(dh.edgeId);
        if (edge) {
          const dx = cx - dh.startMouseX, dy = cy - dh.startMouseY;
          if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dh.hasMoved = true;
          edge.bendOffset = dh.startBend + dx * dh.perpX + dy * dh.perpY;
          markDirty();
        }
      } else if (appState.draggingNodeId) {
        const node = appState.simulation.nodes.get(appState.draggingNodeId);
        if (node) { node.x = cx; node.y = cy; node.vx = 0; node.vy = 0; }
      } else if (appState.isPanning) {
        const dx = e.clientX - appState.panStartX;
        const dy = e.clientY - appState.panStartY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) appState.panHasMoved = true;
        appState.panX = appState.panStartPanX + dx;
        appState.panY = appState.panStartPanY + dy;
      }
    }

    function onMouseUp() {
      if (appState.draggingEdgeHandle) {
        if (!appState.draggingEdgeHandle.hasMoved) {
          selectEdge(appState.draggingEdgeHandle.edgeId);
        }
        appState.draggingEdgeHandle = null;
        markDirty();
      }
      if (appState.draggingNodeId) {
        const dn = appState.simulation.nodes.get(appState.draggingNodeId);
        if (dn) {
          dn.fixed = false;
          const moved = Math.hypot(dn.x - appState.dragStartX, dn.y - appState.dragStartY);
          if (moved < 5) {
            selectNode(appState.draggingNodeId);
            appState.panHasMoved = true;
          }
        }
        appState.draggingNodeId = null;
        markDirty();
        bumpGraph();
      }
      if (appState.isPanning) {
        appState.isPanning = false;
        container.classList.remove('panning');
      }
    }

    function onSvgClick(e: MouseEvent) {
      const target = e.target as Element;
      const nodeId = target.getAttribute('data-node-id');
      const edgeId = target.getAttribute('data-edge-id');
      document.getElementById('contextMenu')!.style.display = 'none';

      if (appState.linkMode) {
        if (!nodeId) return;
        if (!appState.linkSourceNodeId) {
          appState.linkSourceNodeId = nodeId;
          const nm = appState.simulation.nodes.get(nodeId)?.name || '';
          const tip = document.getElementById('linkTip');
          if (tip) tip.textContent = `Source: ${nm}. Now click target node.`;
        } else if (appState.linkSourceNodeId !== nodeId) {
          appState.selectedNodeId = appState.linkSourceNodeId;
          populateConnectionModal(appState.linkSourceNodeId);
          const srcSel = document.getElementById('sourceNodeId') as HTMLSelectElement;
          const tgtSel = document.getElementById('targetNodeId') as HTMLSelectElement;
          if (srcSel) srcSel.value = appState.linkSourceNodeId;
          if (tgtSel) tgtSel.value = nodeId;
          setModal('connection');
          setLinkMode(false);
        }
        return;
      }

      const handleEdgeId = target.getAttribute('data-edge-handle-id');
      if (handleEdgeId) {
        // handled by mouseup
      } else if (edgeId) {
        selectEdge(edgeId);
      } else if (!nodeId) {
        if (!appState.panHasMoved) {
          deselect();
          bumpGraph();
        }
        appState.panHasMoved = false;
      }
    }

    function onContextMenu(e: MouseEvent) {
      e.preventDefault();
      const target = e.target as Element;
      const nodeId = target.getAttribute('data-node-id');
      const edgeId = target.getAttribute('data-edge-id') || target.getAttribute('data-edge-handle-id');
      hideNodeTooltip();
      if (nodeId) showContextMenu(e.clientX, e.clientY, nodeId);
      else if (edgeId) showEdgeContextMenu(e.clientX, e.clientY, edgeId);
    }

    function onSvgMouseMove(e: MouseEvent) {
      if (appState.draggingEdgeHandle || appState.draggingNodeId) { hideEdgeTooltip(); hideNodeTooltip(); return; }
      const target = e.target as Element;
      const nodeId = target.getAttribute('data-node-id');
      const edgeId = target.getAttribute('data-edge-id') || target.getAttribute('data-edge-handle-id');

      if (nodeId) {
        if (appState.hoveredNodeId !== nodeId) { appState.hoveredNodeId = nodeId; }
        showNodeTooltip(nodeId, e.clientX, e.clientY);
        if (appState.hoveredEdgeId) { appState.hoveredEdgeId = null; hideEdgeTooltip(); }
      } else if (edgeId) {
        if (appState.hoveredNodeId) { appState.hoveredNodeId = null; hideNodeTooltip(); }
        if (appState.hoveredEdgeId !== edgeId) appState.hoveredEdgeId = edgeId;
        showEdgeTooltip(edgeId, e.clientX, e.clientY);
      } else {
        if (appState.hoveredNodeId) { appState.hoveredNodeId = null; hideNodeTooltip(); }
        if (appState.hoveredEdgeId) { appState.hoveredEdgeId = null; hideEdgeTooltip(); }
      }
    }

    function onMouseLeave() {
      appState.hoveredNodeId = null;
      appState.hoveredEdgeId = null;
      hideEdgeTooltip();
      hideNodeTooltip();
    }

    function onDblClick(e: MouseEvent) {
      const target = e.target as Element;
      const edgeId = target.getAttribute('data-edge-id') || target.getAttribute('data-edge-handle-id');
      if (edgeId) selectEdge(edgeId);
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      appState.zoomLevel = Math.max(0.3, Math.min(4, appState.zoomLevel + (e.deltaY < 0 ? 1 : -1) * 0.1));
    }

    function onDocKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (appState.linkMode) setLinkMode(false);
        document.getElementById('edgeContextMenu')!.style.display = 'none';
      }
    }

    function onDocClick() {
      document.getElementById('edgeContextMenu')!.style.display = 'none';
    }

    svg.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    svg.addEventListener('click', onSvgClick);
    svg.addEventListener('contextmenu', onContextMenu);
    svg.addEventListener('mousemove', onSvgMouseMove);
    svg.addEventListener('mouseleave', onMouseLeave);
    svg.addEventListener('dblclick', onDblClick);
    svg.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('keydown', onDocKeyDown);
    document.addEventListener('click', onDocClick);

    function populateConnectionModal(srcId?: string) {
      const srcSel = document.getElementById('sourceNodeId') as HTMLSelectElement;
      const tgtSel = document.getElementById('targetNodeId') as HTMLSelectElement;
      if (!srcSel || !tgtSel) return;
      const nodesArr = Array.from(appState.simulation.nodes.values()).sort((a, b) => a.name.localeCompare(b.name));
      srcSel.innerHTML = '<option value="">Select person / org</option>';
      tgtSel.innerHTML = '<option value="">Select person / org</option>';
      for (const n of nodesArr) {
        const o1 = document.createElement('option'); o1.value = n.id; o1.textContent = n.name; srcSel.appendChild(o1);
        const o2 = document.createElement('option'); o2.value = n.id; o2.textContent = n.name; tgtSel.appendChild(o2);
      }
      srcSel.value = srcId || appState.selectedNodeId || '';
      tgtSel.querySelectorAll('option').forEach((o) => {
        (o as HTMLOptionElement).style.display = (o as HTMLOptionElement).value === srcSel.value ? 'none' : '';
      });
    }

    (window as unknown as Record<string, unknown>)._populateConnectionModal = populateConnectionModal;
    (window as unknown as Record<string, unknown>)._selectNode = selectNode;
    (window as unknown as Record<string, unknown>)._selectEdge = selectEdge;
    (window as unknown as Record<string, unknown>)._setLinkMode = setLinkMode;
    (window as unknown as Record<string, unknown>)._deselect = deselect;

    // Zoom buttons
    const zoomIn = document.getElementById('zoomInBtn');
    const zoomOut = document.getElementById('zoomOutBtn');
    const zoomInH = () => { appState.zoomLevel = Math.min(4, appState.zoomLevel * 1.2); appState.panTargetX = null; appState.panTargetY = null; };
    const zoomOutH = () => { appState.zoomLevel = Math.max(0.3, appState.zoomLevel / 1.2); appState.panTargetX = null; appState.panTargetY = null; };
    zoomIn?.addEventListener('click', zoomInH);
    zoomOut?.addEventListener('click', zoomOutH);

    // Fit to screen
    const fitBtn = document.getElementById('fitToScreenBtn');
    const fitH = () => {
      const { nodes } = appState.simulation;
      if (nodes.size === 0) return;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const [, n] of nodes) { minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x); minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y); }
      const cr = svg.getBoundingClientRect(), pad = 120;
      appState.zoomLevel = Math.min(cr.width / (maxX - minX + pad), cr.height / (maxY - minY + pad), 2);
      appState.panX = -((minX + maxX) / 2) * appState.zoomLevel;
      appState.panY = -((minY + maxY) / 2) * appState.zoomLevel;
    };
    fitBtn?.addEventListener('click', fitH);

    // Legend toggle (collapse body)
    const legendToggle = document.getElementById('legendToggleBtn');
    const legendToggleH = () => {
      const b = document.getElementById('legendBody');
      b?.classList.toggle('collapsed');
      if (legendToggle) legendToggle.textContent = b?.classList.contains('collapsed') ? '+' : '−';
    };
    legendToggle?.addEventListener('click', legendToggleH);

    // Legend right-click → hide entirely; restore button shows it again
    const legendOverlay = document.getElementById('legendOverlay');
    const legendRestoreBtn = document.getElementById('legendRestoreBtn');
    const legendHideH = (e: Event) => {
      e.preventDefault();
      legendOverlay?.classList.add('legend-hidden');
      if (legendRestoreBtn) legendRestoreBtn.style.display = 'block';
    };
    const legendRestoreH = () => {
      legendOverlay?.classList.remove('legend-hidden');
      if (legendRestoreBtn) legendRestoreBtn.style.display = 'none';
    };
    legendOverlay?.addEventListener('contextmenu', legendHideH);
    legendRestoreBtn?.addEventListener('click', legendRestoreH);

    // Context menu buttons
    const ctxEdit = document.getElementById('contextEdit');
    const ctxDelete = document.getElementById('contextDelete');
    const ctxAddConn = document.getElementById('contextAddConnection');
    const ctxLink = document.getElementById('contextLinkNodes');
    const ctxView = document.getElementById('contextViewConnections');

    const ctxEditH = () => {
      const nid = (window as unknown as Record<string, unknown>)._contextMenuNodeId as string;
      if (nid) { selectNode(nid); bumpDetail(); setTimeout(() => { (document.getElementById('editBtn') as HTMLButtonElement)?.click(); }, 50); }
      document.getElementById('contextMenu')!.style.display = 'none';
    };
    const ctxDeleteH = () => {
      const nid = (window as unknown as Record<string, unknown>)._contextMenuNodeId as string;
      if (nid) {
        const n = appState.simulation.nodes.get(nid);
        if (n && confirm(`Delete ${n.name}?`)) {
          appState.simulation.nodes.delete(nid);
          for (const [eid, e] of appState.simulation.edges) {
            if (e.sourceId === nid || e.targetId === nid) appState.simulation.edges.delete(eid);
          }
          if (appState.selectedNodeId === nid) { appState.selectedNodeId = null; appState.detailMode = null; }
          markDirty(); bumpGraph(); bumpDetail();
        }
      }
      document.getElementById('contextMenu')!.style.display = 'none';
    };
    const ctxAddConnH = () => {
      const nid = (window as unknown as Record<string, unknown>)._contextMenuNodeId as string;
      if (nid) { populateConnectionModal(nid); setModal('connection'); }
      document.getElementById('contextMenu')!.style.display = 'none';
    };
    const ctxLinkH = () => {
      const nid = (window as unknown as Record<string, unknown>)._contextMenuNodeId as string;
      if (nid) {
        appState.linkSourceNodeId = nid;
        setLinkMode(true);
        const nm = appState.simulation.nodes.get(nid)?.name || '';
        const tip = document.getElementById('linkTip');
        if (tip) tip.textContent = `Source: ${nm}. Now click target node.`;
      }
      document.getElementById('contextMenu')!.style.display = 'none';
    };
    const ctxViewH = () => {
      const nid = (window as unknown as Record<string, unknown>)._contextMenuNodeId as string;
      if (nid) { selectNode(nid); bumpDetail(); }
      document.getElementById('contextMenu')!.style.display = 'none';
    };

    ctxEdit?.addEventListener('click', ctxEditH);
    ctxDelete?.addEventListener('click', ctxDeleteH);
    ctxAddConn?.addEventListener('click', ctxAddConnH);
    ctxLink?.addEventListener('click', ctxLinkH);
    ctxView?.addEventListener('click', ctxViewH);

    // Edge context menu
    const ecEdit = document.getElementById('ecEdit');
    const ecMark = document.getElementById('ecMarkContacted');
    const ecReverse = document.getElementById('ecReverse');
    const ecResetBend = document.getElementById('ecResetBend');
    const ecDelete = document.getElementById('ecDelete');

    const ecEditH = () => {
      const eid = (window as unknown as Record<string, unknown>)._contextMenuEdgeId as string;
      if (eid) { selectEdge(eid); bumpDetail(); }
      document.getElementById('edgeContextMenu')!.style.display = 'none';
    };
    const ecMarkH = () => {
      const eid = (window as unknown as Record<string, unknown>)._contextMenuEdgeId as string;
      if (eid) {
        const edge = appState.simulation.edges.get(eid);
        if (edge) { edge.lastContact = new Date().toISOString().split('T')[0]; markDirty(); if (appState.selectedEdgeId === eid) bumpDetail(); }
      }
      document.getElementById('edgeContextMenu')!.style.display = 'none';
    };
    const ecReverseH = () => {
      const eid = (window as unknown as Record<string, unknown>)._contextMenuEdgeId as string;
      if (eid) {
        const edge = appState.simulation.edges.get(eid);
        if (edge) { [edge.sourceId, edge.targetId] = [edge.targetId, edge.sourceId]; markDirty(); if (appState.selectedEdgeId === eid) bumpDetail(); }
      }
      document.getElementById('edgeContextMenu')!.style.display = 'none';
    };
    const ecResetBendH = () => {
      const eid = (window as unknown as Record<string, unknown>)._contextMenuEdgeId as string;
      if (eid) {
        const edge = appState.simulation.edges.get(eid);
        if (edge) { edge.bendOffset = 0; markDirty(); }
      }
      document.getElementById('edgeContextMenu')!.style.display = 'none';
    };
    const ecDeleteH = () => {
      const eid = (window as unknown as Record<string, unknown>)._contextMenuEdgeId as string;
      if (eid && confirm('Delete this connection?')) {
        appState.simulation.edges.delete(eid);
        if (appState.selectedEdgeId === eid) { appState.selectedEdgeId = null; appState.detailMode = null; bumpDetail(); }
        markDirty(); bumpGraph();
      }
      document.getElementById('edgeContextMenu')!.style.display = 'none';
    };

    ecEdit?.addEventListener('click', ecEditH);
    ecMark?.addEventListener('click', ecMarkH);
    ecReverse?.addEventListener('click', ecReverseH);
    ecResetBend?.addEventListener('click', ecResetBendH);
    ecDelete?.addEventListener('click', ecDeleteH);

    // ── Animation loop ──
    let animId: number;
    function loop() {
      if (appState.animationRunning && !appState.layoutLocked) stepSimulation();

      if (appState.panTargetX !== null && appState.panTargetY !== null && !appState.isPanning) {
        const dx = appState.panTargetX - appState.panX;
        const dy = appState.panTargetY - appState.panY;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
          appState.panX = appState.panTargetX;
          appState.panY = appState.panTargetY as number;
          appState.panTargetX = null;
          appState.panTargetY = null;
        } else {
          appState.panX += dx * 0.12;
          appState.panY += dy * 0.12;
        }
      }

      const zl = document.getElementById('zoomLabel');
      if (zl) zl.textContent = Math.round(appState.zoomLevel * 100) + '%';

      renderCanvas(svg);
      updateInsightsDOM();

      animId = requestAnimationFrame(loop);
    }
    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      svg.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      svg.removeEventListener('click', onSvgClick);
      svg.removeEventListener('contextmenu', onContextMenu);
      svg.removeEventListener('mousemove', onSvgMouseMove);
      svg.removeEventListener('mouseleave', onMouseLeave);
      svg.removeEventListener('dblclick', onDblClick);
      svg.removeEventListener('wheel', onWheel);
      document.removeEventListener('keydown', onDocKeyDown);
      document.removeEventListener('click', onDocClick);
      zoomIn?.removeEventListener('click', zoomInH);
      zoomOut?.removeEventListener('click', zoomOutH);
      fitBtn?.removeEventListener('click', fitH);
      legendToggle?.removeEventListener('click', legendToggleH);
      legendOverlay?.removeEventListener('contextmenu', legendHideH);
      legendRestoreBtn?.removeEventListener('click', legendRestoreH);
      ctxEdit?.removeEventListener('click', ctxEditH);
      ctxDelete?.removeEventListener('click', ctxDeleteH);
      ctxAddConn?.removeEventListener('click', ctxAddConnH);
      ctxLink?.removeEventListener('click', ctxLinkH);
      ctxView?.removeEventListener('click', ctxViewH);
      ecEdit?.removeEventListener('click', ecEditH);
      ecMark?.removeEventListener('click', ecMarkH);
      ecReverse?.removeEventListener('click', ecReverseH);
      ecResetBend?.removeEventListener('click', ecResetBendH);
      ecDelete?.removeEventListener('click', ecDeleteH);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div id="canvas-container">
      <svg ref={svgRef} id="canvas" />
      <div className="empty-state" id="emptyState">
        <div className="empty-state-circle"></div>
        <div>Add people using the form on the left to start building your network.</div>
      </div>
      <div className="link-tip" id="linkTip">Click the first node, then the second to connect them</div>

      <div className="zoom-controls">
        <button id="zoomInBtn" title="Zoom in">+</button>
        <span className="zoom-level-label" id="zoomLabel">100%</span>
        <button id="zoomOutBtn" title="Zoom out">−</button>
      </div>

      <button className="legend-restore-btn" id="legendRestoreBtn" title="Show legend">⊞ Legend</button>
      <div className="legend-overlay" id="legendOverlay" title="Right-click to hide">
        <div className="legend-header">
          <span>Legend</span>
          <button className="legend-toggle" id="legendToggleBtn">−</button>
        </div>
        <div id="legendBody">
          <div className="legend-section-title">Connections</div>
          <div className="legend-item"><span className="legend-line referred"></span> Referred</div>
          <div className="legend-item"><span className="legend-line knows"></span> Knows</div>
          <div className="legend-item"><span className="legend-line colleague"></span> Colleague</div>
          <div className="legend-item"><span className="legend-line adviser-to"></span> Adviser to</div>
          <div className="legend-item"><span className="legend-line family"></span> Family</div>
          <div className="legend-item"><span className="legend-line covers"></span> JPM Covers</div>
          <div className="legend-item"><span className="legend-line works-at"></span> Works at</div>
          <div className="legend-item"><span className="legend-line client-of"></span> Client of</div>
          <div className="legend-section-title">Node Types</div>
          <div className="legend-item"><span className="legend-dot" style={{ background: '#1e40af' }}></span> Client ●</div>
          <div className="legend-item"><span className="legend-dot legend-hex" style={{ background: '#065f46' }}></span> Prospect ⬡</div>
          <div className="legend-item"><span className="legend-dot legend-diamond" style={{ background: '#991b1b' }}></span> Referrer ◆</div>
          <div className="legend-item"><span className="legend-dot legend-penta" style={{ background: '#4c1d95' }}></span> Adviser ⬠</div>
          <div className="legend-item"><span className="legend-dot" style={{ background: '#1e3a8a' }}></span> JPM ●</div>
          <div className="legend-item"><span className="legend-rect" style={{ background: '#374151' }}></span> Organisation</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// UPDATE INSIGHTS DOM (called every animation frame)
// ============================================================================

function updateInsightsDOM() {
  const { nodes, edges } = appState.simulation;

  let topRef = null, maxC = 0;
  for (const [, n] of nodes) {
    const c = Array.from(edges.values()).filter((e) => e.sourceId === n.id && e.relationshipType === 'referred').length;
    if (c > 0 && c > maxC) { maxC = c; topRef = n; }
  }
  const topEl = document.getElementById('topReferrerValue');
  if (topEl) topEl.textContent = topRef ? `${topRef.name} (${maxC})` : 'None yet';

  let warmest = null, maxS = 0;
  for (const [, n] of nodes) {
    if (n.type === 'prospect') {
      const s = n.engagementScore + n.referralLikelihood;
      if (s > maxS) { maxS = s; warmest = n; }
    }
  }
  const warmEl = document.getElementById('warmestProspectValue');
  if (warmEl) warmEl.textContent = warmest ? warmest.name : 'None yet';

  const clientIds = new Set(Array.from(nodes.values()).filter((n) => n.type === 'client').map((n) => n.id));
  const connP = new Set<string>();
  for (const [, e] of edges) {
    if (clientIds.has(e.sourceId) || clientIds.has(e.targetId)) { connP.add(e.sourceId); connP.add(e.targetId); }
  }
  const pCount = Array.from(nodes.values()).filter((n) => n.type === 'prospect').length;
  const gaps = pCount - Array.from(connP).filter((id) => nodes.get(id)?.type === 'prospect').length;
  const gapEl = document.getElementById('networkGapsValue');
  if (gapEl) gapEl.textContent = `${gaps} prospect${gaps !== 1 ? 's' : ''} isolated`;
}
