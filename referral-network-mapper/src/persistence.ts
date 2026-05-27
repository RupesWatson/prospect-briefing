import { appState } from './appState';
import { SAMPLE_DATA, warmupSimulation } from './simulation';

// ============================================================================
// PERSISTENCE
// ============================================================================

export function markDirty() {
  appState.dirty = true;
  if (appState.autosaveTimer) clearTimeout(appState.autosaveTimer);
  appState.autosaveTimer = setTimeout(persistToLocalStorage, 400);
}

export function persistToLocalStorage() {
  try {
    const data = {
      nodes: Array.from(appState.simulation.nodes.values()),
      edges: Array.from(appState.simulation.edges.values()),
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem('referralNetworkState', JSON.stringify(data));
    const ind = document.getElementById('saveIndicator');
    if (ind) ind.textContent = 'Saved just now';
  } catch {
    const ind = document.getElementById('saveIndicator');
    if (ind) ind.textContent = 'Error saving';
  }
}

export function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem('referralNetworkState');
    if (!raw) { initializeWithSampleData(); return; }
    const { nodes, edges } = JSON.parse(raw);
    appState.simulation.nodes = new Map(
      nodes.map((n: Record<string, unknown>) => [n.id, {
        areaOfFocus: '', firmsCovered: '', jpmTitle: '', jpmEngagement: '',
        industry: '', website: '', keyContacts: '', priority: 'medium', ...n,
      }])
    );
    appState.simulation.edges = new Map(
      edges.map((e: Record<string, unknown>) => [e.id, { bendOffset: 0, lastContact: '', ...e }])
    );
    warmupSimulation(150);
  } catch {
    initializeWithSampleData();
  }
}

export function initializeWithSampleData() {
  appState.simulation.nodes = new Map(SAMPLE_DATA.nodes.map((n) => [n.id, { ...n }]));
  appState.simulation.edges = new Map(SAMPLE_DATA.edges.map((e) => [e.id, { ...e }]));
  warmupSimulation();
  markDirty();
}

export function clearAllData(onDone: () => void) {
  if (!confirm('Delete all data?')) return;
  appState.simulation.nodes.clear();
  appState.simulation.edges.clear();
  appState.selectedNodeId = null;
  appState.selectedEdgeId = null;
  appState.detailMode = null;
  markDirty();
  onDone();
}
