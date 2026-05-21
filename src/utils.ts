import type { NodeType, StaleInfo } from './types';

// ============================================================================
// UTILITIES
// ============================================================================

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export const TYPE_COLORS: Record<NodeType, { fill: string; light: string }> = {
  client:       { fill: '#185FA5', light: '#E6F1FB' },
  prospect:     { fill: '#0F6E56', light: '#E1F5EE' },
  referrer:     { fill: '#993C1D', light: '#FAECE7' },
  adviser:      { fill: '#534AB7', light: '#EEEDFE' },
  jpmorgan:     { fill: '#003087', light: '#DCE9F5' },
  organisation: { fill: '#6B7280', light: '#F0F0F0' },
};

export function getTypeColor(type: NodeType): string {
  return TYPE_COLORS[type]?.fill || '#999';
}

export const EDGE_COLORS: Record<string, string> = {
  referred:     '#185FA5',
  knows:        '#888780',
  colleague:    '#0F6E56',
  'adviser-to': '#534AB7',
  family:       '#993C1D',
  covers:       '#003087',
};

export function getEdgeStaleInfo(edge: { lastContact: string }): StaleInfo {
  if (!edge.lastContact) return { level: 'none', color: '#d1d5db', label: 'No date set' };
  const days = Math.round((Date.now() - new Date(edge.lastContact).getTime()) / 86400000);
  if (days < 90)  return { level: 'fresh', color: '#0F6E56', label: days === 0 ? 'Today' : `${days}d ago` };
  if (days < 180) return { level: 'aging', color: '#f59e0b', label: `${Math.round(days / 30)}mo ago` };
  return              { level: 'stale', color: '#dc2626', label: `${Math.round(days / 30)}mo ago — overdue!` };
}

export function getTypeBreakdown(nodes: Map<string, { type: NodeType }>) {
  const b: Record<NodeType, number> = {
    client: 0, prospect: 0, referrer: 0, adviser: 0, jpmorgan: 0, organisation: 0,
  };
  for (const [, n] of nodes) b[n.type] = (b[n.type] || 0) + 1;
  return b;
}
