import { appState } from './appState';
import { markDirty } from './persistence';
import { generateUUID } from './utils';
import type { GraphNode } from './types';

// ============================================================================
// JP MORGAN COVERAGE CHECK
// ============================================================================

export function checkJPMorganCoverage(jpmNode: GraphNode, silent = false) {
  if (!jpmNode.firmsCovered) return;

  const firms = jpmNode.firmsCovered.split(/[,\n;]/).map((s) => s.trim()).filter(Boolean);
  const toConnect: { firm: string; node: GraphNode }[] = [];
  const toCreate: string[] = [];

  for (const firm of firms) {
    const firmLc = firm.toLowerCase().trim();
    if (!firmLc) continue;
    let found: GraphNode | null = null;
    for (const [, n] of appState.simulation.nodes) {
      if (n.id === jpmNode.id) continue;
      const nName = n.name.toLowerCase();
      const nOrg  = (n.organisation || '').toLowerCase();
      const exactName = nName === firmLc;
      const exactOrg  = nOrg.length >= 4 && nOrg === firmLc;
      const nameContainsFirm = firmLc.length >= 4 && nName.length >= 4 && nName.includes(firmLc);
      const orgContainsFirm  = firmLc.length >= 4 && nOrg.length  >= 4 && nOrg.includes(firmLc);
      const firmContainsName = firmLc.length >= 4 && nName.length >= 4 && firmLc.includes(nName);
      const firmContainsOrg  = firmLc.length >= 4 && nOrg.length  >= 4 && firmLc.includes(nOrg);
      if (exactName || exactOrg || nameContainsFirm || orgContainsFirm || firmContainsName || firmContainsOrg) {
        found = n; break;
      }
    }
    if (found) {
      const linked = Array.from(appState.simulation.edges.values()).some(
        (e) => (e.sourceId === jpmNode.id && e.targetId === found!.id) ||
                (e.sourceId === found!.id   && e.targetId === jpmNode.id)
      );
      if (!linked) toConnect.push({ firm, node: found });
    } else {
      toCreate.push(firm);
    }
  }

  if (toConnect.length > 0) {
    const proceed = silent || confirm(
      `Coverage matches existing nodes: ${toConnect.map((x) => x.node.name).join(', ')}.\n\nCreate "covers" connections?`
    );
    if (proceed) {
      for (const { node } of toConnect) {
        const edge = {
          id: generateUUID(), sourceId: jpmNode.id, targetId: node.id,
          relationshipType: 'covers' as const, strength: 2, notes: 'JP Morgan coverage',
          bendOffset: 0, lastContact: '',
        };
        appState.simulation.edges.set(edge.id, edge);
      }
    }
  }

  if (toCreate.length > 0) {
    const newOrgs: GraphNode[] = [];
    for (const firmName of toCreate) {
      const org: GraphNode = {
        id: generateUUID(), name: firmName, type: 'organisation',
        organisation: '', sector: '', estimatedAUM: '', engagementScore: 0, referralLikelihood: 0,
        notes: '', introducedBy: null,
        areaOfFocus: '', firmsCovered: '', jpmTitle: '', jpmEngagement: '',
        industry: '', website: '', keyContacts: '',
        x: jpmNode.x + (Math.random() - 0.5) * 320,
        y: jpmNode.y + (Math.random() - 0.5) * 320,
        vx: 0, vy: 0, fx: 0, fy: 0, fixed: false,
      };
      appState.simulation.nodes.set(org.id, org);
      const edge = {
        id: generateUUID(), sourceId: jpmNode.id, targetId: org.id,
        relationshipType: 'covers' as const, strength: 2, notes: 'JP Morgan coverage',
        bendOffset: 0, lastContact: '',
      };
      appState.simulation.edges.set(edge.id, edge);
      newOrgs.push(org);
    }

    markDirty();

    const apiKey = localStorage.getItem('anthropicApiKey');
    if (apiKey) {
      for (const org of newOrgs) researchFirm(org.id);
    }
  }

  markDirty();
}

// ============================================================================
// FIRM RESEARCH (Wikipedia + Anthropic API)
// ============================================================================

export async function researchFirm(nodeId: string) {
  const node = appState.simulation.nodes.get(nodeId);
  if (!node || node.type !== 'organisation') return;

  node.researching = true;

  try {
    let wikiText = '';
    try {
      const wr = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(node.name)}`,
        { headers: { Accept: 'application/json' } }
      );
      if (wr.ok) {
        const wd = await wr.json();
        if (wd.type !== 'disambiguation' && wd.extract) wikiText = wd.extract;
      }
    } catch (_) {}

    const apiKey = localStorage.getItem('anthropicApiKey');

    if (!apiKey) {
      if (wikiText) {
        const sentences = wikiText.split(/(?<=\.)\s+/);
        node.notes = sentences.slice(0, 2).join(' ');
      }
      return;
    }

    const userMsg = [
      `Research the financial firm "${node.name}" for a wealth management CRM.`,
      wikiText ? `\nWikipedia background: ${wikiText}\n` : '',
      '\nSearch the web for current information and return ONLY this JSON (no other text):',
      '{"industry":"","estimatedAUM":"","website":"","keyContacts":"","notes":""}',
    ].join('');

    const baseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    };

    let resultText = '';

    try {
      const r1 = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { ...baseHeaders, 'anthropic-beta': 'web-search-2025-03-05' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages: [{ role: 'user', content: userMsg }],
        }),
      });
      if (r1.ok) {
        const d1 = await r1.json();
        if (d1.stop_reason === 'end_turn') {
          for (const b of (d1.content || [])) {
            if (b.type === 'text') { resultText = b.text; break; }
          }
        }
      }
    } catch (_) {}

    if (!resultText) {
      try {
        const r2 = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: baseHeaders,
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 512,
            messages: [{ role: 'user', content: userMsg }],
          }),
        });
        if (r2.ok) {
          const d2 = await r2.json();
          for (const b of (d2.content || [])) {
            if (b.type === 'text') { resultText = b.text; break; }
          }
        }
      } catch (_) {}
    }

    if (resultText) {
      const m = resultText.match(/\{[\s\S]*?\}/);
      if (m) {
        try {
          const info = JSON.parse(m[0]);
          if (info.industry)     node.industry     = info.industry;
          if (info.estimatedAUM) node.estimatedAUM = info.estimatedAUM;
          if (info.website)      node.website      = info.website;
          if (info.keyContacts)  node.keyContacts  = info.keyContacts;
          if (info.notes)        node.notes        = info.notes;
          node.researchedAt = new Date().toISOString();
        } catch (_) {}
      }
    }
  } catch (err) {
    console.error('Research error for', node.name, err);
  } finally {
    node.researching = false;
    markDirty();
  }
}
