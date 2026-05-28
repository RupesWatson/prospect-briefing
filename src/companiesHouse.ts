// ============================================================================
// COMPANIES HOUSE API — directorship lookup
//
// Register for a free API key at:
//   https://developer.company-information.service.gov.uk/
//
// Rate limit: 600 requests / 5 minutes on the free tier.
// Each person lookup = 2 requests (search + appointments).
// ============================================================================

import { appState } from './appState';
import { markDirty } from './persistence';
import { generateUUID } from './utils';
import { useStore } from './store';
import type { Directorship } from './types';

const CH_BASE = 'https://api.company-information.service.gov.uk';

// ── API key helpers ──────────────────────────────────────────────────────────

export function getCHApiKey(): string | null {
  return localStorage.getItem('chApiKey') || null;
}

export function setCHApiKey(key: string) {
  localStorage.setItem('chApiKey', key);
}

export function clearCHApiKey() {
  localStorage.removeItem('chApiKey');
}

function chHeaders(): HeadersInit {
  const key = getCHApiKey();
  if (!key) return {};
  // Basic auth: API key as username, empty password
  return { Authorization: 'Basic ' + btoa(key + ':') };
}

// ── Core API calls ────────────────────────────────────────────────────────────

/**
 * Search Companies House for an officer by name and return all their
 * directorship appointments (active and resigned).
 */
export async function searchDirectorships(name: string): Promise<Directorship[]> {
  if (!getCHApiKey()) return [];

  try {
    // 1. Search for officers by name — take top result
    const searchRes = await fetch(
      `${CH_BASE}/search/officers?q=${encodeURIComponent(name)}&items_per_page=5`,
      { headers: chHeaders() }
    );
    if (!searchRes.ok) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const searchData = await searchRes.json() as any;
    if (!searchData.items?.length) return [];

    const officer = searchData.items[0];
    const appointmentsPath: string | undefined = officer.links?.officer?.appointments;
    if (!appointmentsPath) return [];

    // 2. Fetch all appointments for that officer
    const appRes = await fetch(
      `${CH_BASE}${appointmentsPath}?items_per_page=50`,
      { headers: chHeaders() }
    );
    if (!appRes.ok) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const appData = await appRes.json() as any;
    if (!appData.items?.length) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return appData.items.filter((item: any) => item.appointed_to).map((item: any): Directorship => ({
      companyName:  String(item.appointed_to.company_name  || ''),
      companyNumber: String(item.appointed_to.company_number || ''),
      role:          String(item.officer_role || 'director'),
      appointedOn:   item.appointed_on  as string | undefined,
      resignedOn:    item.resigned_on   as string | undefined,
      active:        !item.resigned_on,
    }));
  } catch {
    return [];
  }
}

// ── Higher-level helpers ──────────────────────────────────────────────────────

/**
 * Fetch + store directorships for one node, then cross-link shared boards.
 * Calls onDone when complete (pass a React re-render callback).
 */
export async function fetchAndStoreDirectorships(
  nodeId: string,
  onDone?: () => void
): Promise<void> {
  const node = appState.simulation.nodes.get(nodeId);
  if (!node || node.type === 'organisation') { onDone?.(); return; }

  const results = await searchDirectorships(node.name);
  node.directorships = results;
  node.directorshipsUpdatedAt = new Date().toISOString();

  crossLinkBoards();
  markDirty();

  // Trigger a React re-render so the sidebar and graph update
  useStore.getState().bumpGraph();
  useStore.getState().bumpDetail();

  onDone?.();
}

/**
 * Batch-fetch directorships for a list of node IDs, staggered to stay
 * within Companies House rate limits (600 req / 5 min = 2 req/500ms).
 */
export function batchFetchDirectorships(nodeIds: string[]): void {
  nodeIds.forEach((id, i) => {
    setTimeout(() => fetchAndStoreDirectorships(id), i * 500);
  });
}

/**
 * Scan every node that has directorships and create a 'board' edge between
 * any two contacts who are both currently active on the same board.
 * Safe to call repeatedly — duplicate-checks by company number.
 */
export function crossLinkBoards(): void {
  const nodes = Array.from(appState.simulation.nodes.values()).filter(
    (n) => n.type !== 'organisation' && n.directorships && n.directorships.length > 0
  );

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];

      // Map of company number → company name for a's active directorships
      const aActiveMap = new Map<string, string>(
        (a.directorships ?? [])
          .filter((d) => d.active && d.companyNumber)
          .map((d) => [d.companyNumber, d.companyName])
      );

      // Check b's active directorships for overlap
      for (const d of (b.directorships ?? [])) {
        if (!d.active || !d.companyNumber || !aActiveMap.has(d.companyNumber)) continue;

        const companyName = aActiveMap.get(d.companyNumber) || d.companyName;

        // Avoid duplicates — check by company number in the edge notes
        const exists = Array.from(appState.simulation.edges.values()).some(
          (e) =>
            e.relationshipType === 'board' &&
            e.notes.includes(d.companyNumber) &&
            ((e.sourceId === a.id && e.targetId === b.id) ||
              (e.sourceId === b.id && e.targetId === a.id))
        );

        if (!exists) {
          const eid = generateUUID();
          appState.simulation.edges.set(eid, {
            id: eid,
            sourceId: a.id,
            targetId: b.id,
            relationshipType: 'board',
            strength: 2,
            notes: `${companyName} (${d.companyNumber})`,
            bendOffset: 0,
            lastContact: '',
          });
        }
      }
    }
  }
}
