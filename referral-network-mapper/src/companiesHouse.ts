// ============================================================================
// COMPANIES HOUSE API — directorship lookup
//
// All requests go through /api/ch (a Vercel Edge proxy) to avoid CORS.
// In local dev, vite.config.ts proxies /api/ch → api.company-information.service.gov.uk.
//
// Two-step flow:
//   1. searchOfficers(name)  → returns candidates (name, DOB, address, appt count)
//   2. fetchAndStoreForCandidate(nodeId, candidate) → loads their appointments
//
// Get a free API key at developer.company-information.service.gov.uk
// ============================================================================

import { appState } from './appState';
import { markDirty } from './persistence';
import { generateUUID } from './utils';
import { useStore } from './store';
import type { Directorship } from './types';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── API key ──────────────────────────────────────────────────────────────────

export function getCHApiKey(): string | null {
  return localStorage.getItem('chApiKey') || null;
}

/** Route a CH API path through our server-side proxy to avoid CORS. */
function chFetch(chApiPath: string): Promise<Response> {
  const key = getCHApiKey();
  if (!key) throw new Error('No Companies House API key set. Add it in Settings (⚙).');
  return fetch(`/api/ch?chPath=${encodeURIComponent(chApiPath)}`, {
    headers: { 'x-ch-key': key },
  });
}

// ── Officer candidate type ────────────────────────────────────────────────────

export interface OfficerCandidate {
  /** Name as registered at Companies House (usually SURNAME, Forename) */
  name: string;
  /** API path to their full appointments list, e.g. /officers/ABC123/appointments */
  appointmentsPath: string;
  birthMonth?: number;
  birthYear?: number;
  address: string;
  appointmentCount: number;
}

export function formatCandidateMeta(c: OfficerCandidate): string {
  const parts: string[] = [];
  if (c.birthYear) {
    const m = c.birthMonth ? MONTHS[(c.birthMonth - 1) % 12] + ' ' : '';
    parts.push(`Born ${m}${c.birthYear}`);
  } else {
    parts.push('DOB not recorded');
  }
  parts.push(`${c.appointmentCount} appointment${c.appointmentCount !== 1 ? 's' : ''}`);
  if (c.address) parts.push(c.address);
  return parts.join(' · ');
}

// ── Step 1: Search for officer candidates ────────────────────────────────────

/**
 * Search Companies House for officers matching `name`.
 * Returns up to 10 candidates so the user can pick the right one.
 * On error, throws with a human-readable message.
 */
export async function searchOfficers(name: string): Promise<OfficerCandidate[]> {
  const res = await chFetch(`/search/officers?q=${encodeURIComponent(name)}&items_per_page=10`);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Companies House returned ${res.status}: ${text || res.statusText}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as any;
  if (!data.items?.length) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((item: any) => item.links?.officer?.appointments)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((item: any): OfficerCandidate => ({
      name:             String(item.title || item.description || name),
      appointmentsPath: String(item.links.officer.appointments),
      birthMonth:       item.date_of_birth?.month as number | undefined,
      birthYear:        item.date_of_birth?.year  as number | undefined,
      address:          [item.address?.address_line_1, item.address?.locality]
                          .filter(Boolean).join(', '),
      appointmentCount: Number(item.appointment_count) || 0,
    }));
}

// ── Step 2: Fetch appointments for chosen candidate ───────────────────────────

/**
 * Load all board appointments for the chosen candidate, store them on the
 * node, then run crossLinkBoards() to auto-create shared board connections.
 */
export async function fetchAndStoreForCandidate(
  nodeId: string,
  candidate: OfficerCandidate,
  onDone?: () => void
): Promise<void> {
  const node = appState.simulation.nodes.get(nodeId);
  if (!node) { onDone?.(); return; }

  const res = await chFetch(`${candidate.appointmentsPath}?items_per_page=50`);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Appointments fetch returned ${res.status}: ${text || res.statusText}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  node.directorships = (data.items ?? []).filter((item: any) => item.appointed_to).map((item: any): Directorship => ({
    companyName:   String(item.appointed_to.company_name   || ''),
    companyNumber: String(item.appointed_to.company_number || ''),
    role:          String(item.officer_role || 'director'),
    appointedOn:   item.appointed_on as string | undefined,
    resignedOn:    item.resigned_on  as string | undefined,
    active:        !item.resigned_on,
  }));
  node.directorshipsUpdatedAt = new Date().toISOString();

  crossLinkBoards();
  markDirty();
  useStore.getState().bumpGraph();
  useStore.getState().bumpDetail();
  onDone?.();
}

// ── Cross-link shared boards ─────────────────────────────────────────────────

/**
 * Scan every contact with directorships and create a 'board' edge between
 * any two who are both currently active on the same company board.
 * Safe to call repeatedly — deduplicates by company number.
 */
export function crossLinkBoards(): void {
  const nodes = Array.from(appState.simulation.nodes.values()).filter(
    (n) => n.type !== 'organisation' && n.directorships && n.directorships.length > 0
  );

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];

      const aActive = new Map<string, string>(
        (a.directorships ?? [])
          .filter((d) => d.active && d.companyNumber)
          .map((d) => [d.companyNumber, d.companyName])
      );

      for (const d of (b.directorships ?? [])) {
        if (!d.active || !d.companyNumber || !aActive.has(d.companyNumber)) continue;

        const already = Array.from(appState.simulation.edges.values()).some(
          (e) =>
            e.relationshipType === 'board' &&
            e.notes.includes(d.companyNumber) &&
            ((e.sourceId === a.id && e.targetId === b.id) ||
             (e.sourceId === b.id && e.targetId === a.id))
        );

        if (!already) {
          const eid = generateUUID();
          appState.simulation.edges.set(eid, {
            id: eid,
            sourceId: a.id,
            targetId: b.id,
            relationshipType: 'board',
            strength: 2,
            notes: `${aActive.get(d.companyNumber)} (${d.companyNumber})`,
            bendOffset: 0,
            lastContact: '',
          });
        }
      }
    }
  }
}
