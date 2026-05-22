import { appState } from './appState';
import { SAMPLE_DATA, warmupSimulation } from './simulation';
import { supabase } from './supabase';

// ============================================================================
// PERSISTENCE — writes to Supabase, falls back to localStorage
// ============================================================================

export function markDirty() {
  appState.dirty = true;
  if (appState.autosaveTimer) clearTimeout(appState.autosaveTimer);
  appState.autosaveTimer = setTimeout(persistToLocalStorage, 400);
}

// ── Local save (instant, runs on every change) ──────────────────────────────

export function persistToLocalStorage() {
  try {
    const data = {
      nodes: Array.from(appState.simulation.nodes.values()),
      edges: Array.from(appState.simulation.edges.values()),
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem('referralNetworkState', JSON.stringify(data));
    setIndicator('Saved');
    // Also push to Supabase in the background
    syncToSupabase();
  } catch {
    setIndicator('Error saving');
  }
}

// ── Supabase sync ────────────────────────────────────────────────────────────

export async function syncToSupabase() {
  try {
    const nodes = Array.from(appState.simulation.nodes.values()).map((n) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      organisation: n.organisation,
      sector: n.sector,
      estimated_aum: n.estimatedAUM,
      engagement_score: n.engagementScore,
      referral_likelihood: n.referralLikelihood,
      notes: n.notes,
      introduced_by: n.introducedBy,
      area_of_focus: n.areaOfFocus,
      firms_covered: n.firmsCovered,
      jpm_title: n.jpmTitle,
      jpm_engagement: n.jpmEngagement,
      industry: n.industry,
      website: n.website,
      key_contacts: n.keyContacts,
      x: n.x,
      y: n.y,
      updated_at: new Date().toISOString(),
    }));

    const edges = Array.from(appState.simulation.edges.values()).map((e) => ({
      id: e.id,
      source_id: e.sourceId,
      target_id: e.targetId,
      relationship_type: e.relationshipType,
      strength: e.strength,
      notes: e.notes,
      bend_offset: e.bendOffset,
      last_contact: e.lastContact,
      updated_at: new Date().toISOString(),
    }));

    const { error: ne } = await supabase.from('nodes').upsert(nodes);
    if (ne) throw ne;
    const { error: ee } = await supabase.from('edges').upsert(edges);
    if (ee) throw ee;

    setIndicator('Synced ✓');
  } catch (err) {
    console.warn('Supabase sync failed, data still saved locally:', err);
    setIndicator('Saved locally');
  }
}

// ── Load — tries Supabase first, falls back to localStorage ─────────────────

export async function loadFromSupabase(): Promise<boolean> {
  try {
    const { data: nodes, error: ne } = await supabase
      .from('nodes')
      .select('*');
    const { data: edges, error: ee } = await supabase
      .from('edges')
      .select('*');

    if (ne || ee || !nodes || nodes.length === 0) return false;

    appState.simulation.nodes = new Map(
      nodes.map((n) => [n.id, {
        id: n.id, name: n.name, type: n.type,
        organisation: n.organisation || '',
        sector: n.sector || '',
        estimatedAUM: n.estimated_aum || '',
        engagementScore: n.engagement_score || 0,
        referralLikelihood: n.referral_likelihood || 0,
        notes: n.notes || '',
        introducedBy: n.introduced_by || null,
        areaOfFocus: n.area_of_focus || '',
        firmsCovered: n.firms_covered || '',
        jpmTitle: n.jpm_title || '',
        jpmEngagement: n.jpm_engagement || '',
        industry: n.industry || '',
        website: n.website || '',
        keyContacts: n.key_contacts || '',
        x: n.x || 0, y: n.y || 0,
        vx: 0, vy: 0, fx: 0, fy: 0, fixed: false,
      }])
    );
    appState.simulation.edges = new Map(
      (edges || []).map((e) => [e.id, {
        id: e.id,
        sourceId: e.source_id,
        targetId: e.target_id,
        relationshipType: e.relationship_type,
        strength: e.strength || 1,
        notes: e.notes || '',
        bendOffset: e.bend_offset || 0,
        lastContact: e.last_contact || '',
      }])
    );
    warmupSimulation(150);
    setIndicator('Loaded from database');
    return true;
  } catch {
    return false;
  }
}

export async function loadFromLocalStorage() {
  // Try Supabase first
  const loaded = await loadFromSupabase();
  if (loaded) return;

  // Fall back to localStorage
  try {
    const raw = localStorage.getItem('referralNetworkState');
    if (!raw) { initializeWithSampleData(); return; }
    const { nodes, edges } = JSON.parse(raw);
    appState.simulation.nodes = new Map(
      nodes.map((n: Record<string, unknown>) => [n.id, {
        areaOfFocus: '', firmsCovered: '', jpmTitle: '', jpmEngagement: '',
        industry: '', website: '', keyContacts: '', ...n,
      }])
    );
    appState.simulation.edges = new Map(
      edges.map((e: Record<string, unknown>) => [e.id, { bendOffset: 0, lastContact: '', ...e }])
    );
    warmupSimulation(150);
    setIndicator('Loaded from local cache');
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

function setIndicator(text: string) {
  const ind = document.getElementById('saveIndicator');
  if (ind) ind.textContent = text;
}
