import * as XLSX from 'xlsx';
import { appState } from './appState';
import { markDirty } from './persistence';
import { researchFirm } from './research';
import { generateUUID, getTypeBreakdown } from './utils';
import { gentleRestart } from './simulation';
import type { GraphNode } from './types';

// ============================================================================
// IMPORT TEMPLATE HEADERS
// ============================================================================

const IMPORT_HEADERS = [
  'Name', 'Type', 'Organisation', 'Sector', 'Estimated AUM',
  'Engagement Score (1-5)', 'Referral Likelihood (1-5)', 'Notes', 'Introduced By (name)',
  'JPM Title', 'JPM Area of Focus', 'JPM Firms Covered', 'JPM Engagement Level',
  'Industry', 'Website', 'Key Contacts',
];

// ============================================================================
// DOWNLOAD TEMPLATE
// ============================================================================

export function downloadImportTemplate() {
  const wb = XLSX.utils.book_new();

  const examples = [
    ['John Smith',    'Client',           'Blackrock',          'Asset Management', '>£50m',   4, 3, 'Long-standing client',  'Jane Doe',  '',                 '',             '',                      '',       '',                 '',              ''],
    ['Sarah Jones',   'Prospect',         'Vanguard Capital',   'Private Equity',   '£25–50m', 2, 2, 'Met at conference',     '',          '',                 '',             '',                      '',       '',                 '',              ''],
    ['Michael Brown', 'Referrer',         'Brown Legal',        'Legal',            '',        4, 5, 'Top referrer',          '',          '',                 '',             '',                      '',       '',                 '',              ''],
    ['Claire White',  'Adviser',          'White Tax Advisory', 'Accounting',       '',        3, 4, '',                      '',          '',                 '',             '',                      '',       '',                 '',              ''],
    ['Alex Morgan',   'JP Morgan Contact','JP Morgan',          '',                 '',        0, 0, 'Covers HF space',       '',          'Managing Director','Hedge Funds',  'Bridgewater, Man Group','active', '',                 '',              ''],
    ['Blackrock',     'Organisation',     '',                   '',                 '>£1bn',   0, 0, 'Global asset manager',  '',          '',                 '',             '',                      '',       'Asset Management', 'blackrock.com', 'John Smith'],
  ];

  const wsData = [IMPORT_HEADERS, ...examples];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = IMPORT_HEADERS.map((h) => ({ wch: Math.max(h.length + 2, 18) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Contacts');

  const instructions = [
    ['Referral Network Mapper — Import Template'],
    [''],
    ['INSTRUCTIONS'],
    ['1. Fill in the Contacts sheet. Each row = one contact or organisation.'],
    ['2. Required fields: Name, Type.'],
    ['3. Valid Types: Client, Prospect, Referrer, Adviser, JP Morgan Contact, Organisation'],
    ['4. Engagement Score / Referral Likelihood: enter 1–5. Leave blank or 0 for JP Morgan Contact and Organisation.'],
    ['5. Introduced By: enter the exact name of a contact who introduced this person (must exist in the network or the same import file).'],
    ['6. Organisation: if this matches an existing Org node by name, a connection is created automatically.'],
    [''],
    ['JP MORGAN CONTACT FIELDS (leave blank for other types)'],
    ['  JPM Title          — e.g. Managing Director'],
    ['  JPM Area of Focus  — Hedge Funds | Private Equity | Insurance | Family Office | Real Estate | Banking | Technology | Corporate | Other'],
    ['  JPM Firms Covered  — comma-separated list; matched to existing nodes for auto-connection'],
    ['  JPM Engagement Level — warm | active | cold | prospect'],
    [''],
    ['ORGANISATION FIELDS (leave blank for other types)'],
    ['  Industry           — e.g. Asset Management'],
    ['  Website            — e.g. blackrock.com'],
    ['  Key Contacts       — comma-separated names'],
    [''],
    ['Delete the example rows (rows 2–7) before uploading. Keep the header row (row 1).'],
  ];
  const wsI = XLSX.utils.aoa_to_sheet(instructions);
  wsI['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsI, 'Instructions');

  XLSX.writeFile(wb, 'referral-network-template.xlsx');
}

// ============================================================================
// IMPORT HELPERS
// ============================================================================

function normalizeImportType(raw: string): string | null {
  const map: Record<string, string> = {
    'client': 'client',
    'prospect': 'prospect',
    'referrer': 'referrer',
    'adviser': 'adviser', 'advisor': 'adviser',
    'jp morgan contact': 'jpmorgan', 'jp morgan contacts': 'jpmorgan',
    'jp morgan': 'jpmorgan', 'jpmorgan contact': 'jpmorgan',
    'jpmorgan contacts': 'jpmorgan', 'jpmorgan': 'jpmorgan',
    'jpm contact': 'jpmorgan', 'jpm contacts': 'jpmorgan', 'jpm': 'jpmorgan',
    'j.p. morgan': 'jpmorgan', 'j.p. morgan contact': 'jpmorgan',
    'organisation': 'organisation', 'organization': 'organisation',
    'org': 'organisation', 'firm': 'organisation', 'company': 'organisation',
  };
  return map[(raw || '').toLowerCase().trim()] || null;
}

function clampScore(val: string): number {
  const n = parseInt(val) || 0;
  return Math.max(0, Math.min(5, n));
}

function findNodeByName(name: string): GraphNode | null {
  const lc = (name || '').toLowerCase().trim();
  if (!lc) return null;
  for (const [, n] of appState.simulation.nodes) {
    if (n.name.toLowerCase() === lc) return n;
  }
  return null;
}

function findExistingOrg(name: string): GraphNode | null {
  const lc = name.trim().toLowerCase();
  for (const [, n] of appState.simulation.nodes) {
    if (n.type === 'organisation' && n.name.toLowerCase() === lc) return n;
  }
  return null;
}

// ============================================================================
// IMPORT FROM XLSX
// ============================================================================

export function importFromXLSX(file: File, onDone: () => void) {
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wb = XLSX.read(new Uint8Array(e.target!.result as ArrayBuffer), { type: 'array' });
      const wsName = wb.SheetNames.find((n) => n.toLowerCase() === 'contacts') || wb.SheetNames[0];
      const ws = wb.Sheets[wsName];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
      if (!rawRows || rawRows.length < 2) {
        alert('No data rows found. Make sure the Contacts sheet has a header row followed by data.');
        return;
      }

      const headers = rawRows[0].map((h: unknown) => String(h).trim());
      const rows = rawRows.slice(1).map((arr) => {
        const obj: Record<string, string> = {};
        headers.forEach((h: string, i: number) => { obj[h] = String(arr[i] == null ? '' : arr[i]).trim(); });
        return obj;
      });

      const col = (row: Record<string, string>, ...keys: string[]): string => {
        for (const k of keys) { if (row[k] !== undefined && row[k] !== '') return row[k]; }
        return '';
      };

      let imported = 0, skipped = 0;
      const batch: { node: GraphNode; introByName: string }[] = [];
      const newOrgs: GraphNode[] = [];

      for (const row of rows) {
        const name = col(row, 'Name');
        const typeRaw = normalizeImportType(col(row, 'Type'));
        if (!name || !typeRaw) { skipped++; continue; }

        const node: GraphNode = {
          id: generateUUID(), name, type: typeRaw as GraphNode['type'],
          organisation:       col(row, 'Organisation'),
          sector:             col(row, 'Sector'),
          estimatedAUM:       col(row, 'Estimated AUM', 'AUM'),
          engagementScore:    clampScore(col(row, 'Engagement Score (1-5)', 'Engagement Score')),
          referralLikelihood: clampScore(col(row, 'Referral Likelihood (1-5)', 'Referral Likelihood')),
          notes:              col(row, 'Notes'),
          introducedBy:       null,
          jpmTitle:           col(row, 'JPM Title', 'Role', 'Title'),
          areaOfFocus:        col(row, 'JPM Area of Focus', 'Area of Focus'),
          firmsCovered:       col(row, 'JPM Firms Covered', 'Firms Covered', 'Firms/Clients Covered'),
          jpmEngagement:      col(row, 'JPM Engagement Level', 'Engagement Level'),
          industry:           col(row, 'Industry'),
          website:            col(row, 'Website'),
          keyContacts:        col(row, 'Key Contacts'),
          x: Math.random() * 400 - 200, y: Math.random() * 400 - 200,
          vx: 0, vy: 0, fx: 0, fy: 0, fixed: false,
        };

        appState.simulation.nodes.set(node.id, node);
        batch.push({ node, introByName: col(row, 'Introduced By (name)', 'Introduced By') });
        imported++;
      }

      for (const { node, introByName } of batch) {
        if (introByName) {
          const match = findNodeByName(introByName);
          if (match) node.introducedBy = match.id;
        }

        if (node.organisation && node.type !== 'organisation') {
          const orgNode = findExistingOrg(node.organisation);
          if (orgNode) {
            const linked = Array.from(appState.simulation.edges.values()).some(
              (e) => (e.sourceId === node.id && e.targetId === orgNode.id) ||
                     (e.sourceId === orgNode.id && e.targetId === node.id)
            );
            if (!linked) {
              const eid = generateUUID();
              appState.simulation.edges.set(eid, {
                id: eid, sourceId: node.id, targetId: orgNode.id,
                relationshipType: 'colleague', strength: 2,
                notes: 'Works at / associated with', bendOffset: 0, lastContact: '',
              });
            }
          }
        }

        if (node.type === 'jpmorgan' && node.firmsCovered) {
          const firms = node.firmsCovered.split(/[,;\n]+/).map((s) => s.trim()).filter((s) => s.length > 0);
          for (const firmName of firms) {
            const firmLc = firmName.toLowerCase();
            let existingNode: GraphNode | null = null;
            for (const [, n] of appState.simulation.nodes) {
              if (n.id !== node.id && n.name.toLowerCase() === firmLc) { existingNode = n; break; }
            }
            if (!existingNode) {
              const org: GraphNode = {
                id: generateUUID(), name: firmName, type: 'organisation',
                organisation: '', sector: '', estimatedAUM: '', engagementScore: 0, referralLikelihood: 0,
                notes: '', introducedBy: null,
                areaOfFocus: '', firmsCovered: '', jpmTitle: '', jpmEngagement: '',
                industry: '', website: '', keyContacts: '',
                x: node.x + (Math.random() - 0.5) * 300,
                y: node.y + (Math.random() - 0.5) * 300,
                vx: 0, vy: 0, fx: 0, fy: 0, fixed: false,
              };
              appState.simulation.nodes.set(org.id, org);
              existingNode = org;
              newOrgs.push(org);
            }
            const alreadyLinked = Array.from(appState.simulation.edges.values()).some(
              (e) => (e.sourceId === node.id && e.targetId === existingNode!.id) ||
                     (e.sourceId === existingNode!.id && e.targetId === node.id)
            );
            if (!alreadyLinked) {
              const eid = generateUUID();
              appState.simulation.edges.set(eid, {
                id: eid, sourceId: node.id, targetId: existingNode.id,
                relationshipType: 'covers', strength: 2, notes: 'JP Morgan coverage',
                bendOffset: 0, lastContact: '',
              });
            }
          }
        }
      }

      markDirty();
      gentleRestart();
      onDone();

      const apiKey = localStorage.getItem('anthropicApiKey');
      if (apiKey && newOrgs.length > 0) {
        for (const org of newOrgs) researchFirm(org.id);
      }

      const firmMsg = newOrgs.length > 0
        ? ` Created ${newOrgs.length} new firm node${newOrgs.length !== 1 ? 's' : ''} from JPM coverage (${newOrgs.map((o) => o.name).join(', ')}).`
        : '';
      const msg = `Import complete: ${imported} contact${imported !== 1 ? 's' : ''} added`
        + (skipped > 0 ? `, ${skipped} row${skipped !== 1 ? 's' : ''} skipped (missing Name or Type)` : '')
        + '.' + firmMsg;
      alert(msg);
    } catch (err) {
      alert('Error reading file: ' + (err as Error).message);
    }
  };
  reader.readAsArrayBuffer(file);
}

// ============================================================================
// EXPORTS
// ============================================================================

export function exportAsJSON() {
  const data = {
    exportedAt: new Date().toISOString(),
    nodes: Array.from(appState.simulation.nodes.values()),
    edges: Array.from(appState.simulation.edges.values()),
    stats: {
      nodeCount: appState.simulation.nodes.size,
      edgeCount: appState.simulation.edges.size,
      typeBreakdown: getTypeBreakdown(appState.simulation.nodes),
    },
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `referral-network-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportAsSummary() {
  const { nodes, edges } = appState.simulation;
  const b = getTypeBreakdown(nodes);
  let s = `REFERRAL NETWORK SUMMARY\nGenerated: ${new Date().toLocaleString()}\n\nOVERVIEW\nTotal Contacts: ${nodes.size}\nTotal Relationships: ${edges.size}\n\n`;
  s += `BREAKDOWN\nClients: ${b.client} | Prospects: ${b.prospect} | Referrers: ${b.referrer} | Advisers: ${b.adviser} | JP Morgan: ${b.jpmorgan} | Organisations: ${b.organisation}\n\n`;
  s += 'TOP REFERRERS\n';
  const rc = new Map<string, number>();
  for (const [, e] of edges) {
    if (e.relationshipType === 'referred') rc.set(e.sourceId, (rc.get(e.sourceId) || 0) + 1);
  }
  Array.from(rc.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([id, c]) => {
    const n = nodes.get(id);
    if (n) s += `${n.name} (${c})\n`;
  });
  const jpm = Array.from(nodes.values()).filter((n) => n.type === 'jpmorgan');
  if (jpm.length) {
    s += '\nJP MORGAN CONTACTS\n';
    jpm.forEach((n) => {
      s += `${n.name}${n.jpmTitle ? ' – ' + n.jpmTitle : ''}`;
      if (n.areaOfFocus) s += ` | ${n.areaOfFocus}`;
      if (n.firmsCovered) s += ` | Firms: ${n.firmsCovered}`;
      s += '\n';
    });
  }
  navigator.clipboard.writeText(s).then(() => alert('Summary copied')).catch(() => {});
}
