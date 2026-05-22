import { useStore } from '../store';
import { appState } from '../appState';
import { markDirty } from '../persistence';
import { researchFirm, checkJPMorganCoverage } from '../research';
import { generateUUID, getTypeColor, getInitials, getEdgeStaleInfo } from '../utils';
import { exportAsJSON, exportAsSummary } from '../importExport';
import type { GraphNode, GraphEdge } from '../types';

export default function RightSidebar() {
  const { graphVersion, detailKey, setModal } = useStore();
  void graphVersion;
  void detailKey;

  const node = appState.selectedNodeId ? appState.simulation.nodes.get(appState.selectedNodeId) : null;
  const edge = appState.selectedEdgeId ? appState.simulation.edges.get(appState.selectedEdgeId) : null;
  const showDetail = appState.detailMode !== null && (node || edge);

  // Smoothly pan the graph when the panel slides in/out so nodes stay visible
  const prevShowDetail = useRef<boolean | null>(null);
  useEffect(() => {
    if (prevShowDetail.current === null) { prevShowDetail.current = !!showDetail; return; }
    if (!!showDetail === prevShowDetail.current) return;
    prevShowDetail.current = !!showDetail;

    const SHIFT = 150; // half the 300px panel width
    const panStart = appState.panX;
    const panTarget = panStart + (showDetail ? -SHIFT : SHIFT);
    const duration = 280;
    const t0 = performance.now();

    function tick(now: number) {
      const p = Math.min((now - t0) / duration, 1);
      // ease-in-out cubic
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      appState.panX = panStart + (panTarget - panStart) * e;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [showDetail]);

  function handleDeleteNode() {
    if (!node) return;
    if (!confirm(`Delete ${node.name}?`)) return;
    appState.simulation.nodes.delete(node.id);
    for (const [id, e] of appState.simulation.edges) {
      if (e.sourceId === node.id || e.targetId === node.id) appState.simulation.edges.delete(id);
    }
    appState.selectedNodeId = null;
    appState.detailMode = null;
    markDirty();
    useStore.getState().bumpGraph();
    useStore.getState().bumpDetail();
  }

  function handleDeleteEdge() {
    if (!edge) return;
    if (!confirm('Delete this connection?')) return;
    appState.simulation.edges.delete(edge.id);
    appState.selectedEdgeId = null;
    appState.detailMode = null;
    markDirty();
    useStore.getState().bumpGraph();
    useStore.getState().bumpDetail();
  }

  function handleResearch() {
    if (!node) return;
    const apiKey = localStorage.getItem('anthropicApiKey');
    if (!apiKey) {
      if (confirm('No API key set. Open settings to add your Anthropic API key?')) {
        setModal('apikey');
      } else {
        researchFirm(node.id).then(() => useStore.getState().bumpDetail());
      }
    } else {
      researchFirm(node.id).then(() => useStore.getState().bumpDetail());
    }
  }

  return (
    <div className={`right-sidebar${showDetail ? '' : ' panel-hidden'}`}>
      {/* Insights */}
      <div className="insights-strip">
        <div className="insight-card">
          <div className="insight-label">Top Referrer</div>
          <div className="insight-value" id="topReferrerValue">None yet</div>
        </div>
        <div className="insight-card">
          <div className="insight-label">Warmest Prospect</div>
          <div className="insight-value" id="warmestProspectValue">None yet</div>
        </div>
        <div className="insight-card">
          <div className="insight-label">Network Gaps</div>
          <div className="insight-value" id="networkGapsValue">0 prospects isolated</div>
        </div>
      </div>

      {!showDetail && (
        <div className="detail-placeholder" id="detailPlaceholder">
          Click any node or connection to see details
        </div>
      )}

      {showDetail && node && appState.detailMode === 'node' && (
        <NodeDetail
          node={node}
          onDelete={handleDeleteNode}
          onResearch={handleResearch}
        />
      )}

      {showDetail && edge && appState.detailMode === 'edge' && (
        <EdgeDetail edge={edge} onDelete={handleDeleteEdge} />
      )}

      <div className="export-buttons">
        <button className="export-button" id="exportSummaryBtn" onClick={exportAsSummary}>
          Copy summary
        </button>
        <button className="export-button" id="exportJsonBtn" onClick={exportAsJSON}>
          Export JSON
        </button>
      </div>
    </div>
  );
}

// ── Node Detail ──
function NodeDetail({ node, onDelete, onResearch }: { node: GraphNode; onDelete: () => void; onResearch: () => void }) {
  const [editing, setEditing] = useEditMode(false);
  const [editName, setEditName] = useStateString(node.name);
  const [editOrg, setEditOrg] = useStateString(node.organisation);
  const [editNotes, setEditNotes] = useStateString(node.notes || '');
  const [editSector, setEditSector] = useStateString(node.sector || '');
  const [editAUM, setEditAUM] = useStateString(node.estimatedAUM || '');
  const [editJpmTitle, setEditJpmTitle] = useStateString(node.jpmTitle || '');
  const [editFocus, setEditFocus] = useStateString(node.areaOfFocus || '');
  const [editFirms, setEditFirms] = useStateString(node.firmsCovered || '');
  const [editJpmEng, setEditJpmEng] = useStateString(node.jpmEngagement || '');
  const [editIndustry, setEditIndustry] = useStateString(node.industry || '');
  const [editWebsite, setEditWebsite] = useStateString(node.website || '');
  const [editKeyContacts, setEditKeyContacts] = useStateString(node.keyContacts || '');

  function handleSave() {
    node.name = editName;
    node.organisation = editOrg;
    node.notes = editNotes;
    if (node.type === 'jpmorgan') {
      node.jpmTitle = editJpmTitle;
      node.areaOfFocus = editFocus;
      node.firmsCovered = editFirms;
      node.jpmEngagement = editJpmEng;
      checkJPMorganCoverage(node);
    } else if (node.type === 'organisation') {
      node.industry = editIndustry;
      node.estimatedAUM = editAUM;
      node.website = editWebsite;
      node.keyContacts = editKeyContacts;
    } else {
      node.sector = editSector;
      node.estimatedAUM = editAUM;
    }
    markDirty();
    setEditing(false);
    useStore.getState().bumpGraph();
    useStore.getState().bumpDetail();
  }

  function getTypeBadgeLabel(type: string) {
    if (type === 'jpmorgan') return 'JPM';
    if (type === 'organisation') return 'Organisation';
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  const connEdges = Array.from(appState.simulation.edges.values()).filter(
    (e) => e.sourceId === node.id || e.targetId === node.id
  );
  const referrals = connEdges.filter((e) => e.sourceId === node.id && e.relationshipType === 'referred');
  const intro = node.introducedBy ? appState.simulation.nodes.get(node.introducedBy) : null;

  if (editing) {
    return (
      <div className="detail-panel active" id="detailPanel">
        <div className="detail-header">
          <div
            className={`detail-avatar${node.type === 'organisation' ? ' org' : ''}`}
            style={{ backgroundColor: getTypeColor(node.type) }}
          >
            {node.type === 'organisation' ? '🏢' : getInitials(node.name)}
          </div>
          <div className="detail-title">
            <div className="detail-name">{node.name}</div>
            <div className="detail-org">{node.organisation || node.sector || ''}</div>
          </div>
        </div>
        <div className="edit-mode">
          <div className="form-group"><label>Name</label><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
          <div className="form-group"><label>Organisation</label><input type="text" value={editOrg} onChange={(e) => setEditOrg(e.target.value)} /></div>
          {node.type === 'jpmorgan' && <>
            <div className="form-group"><label>Role / Title</label><input type="text" value={editJpmTitle} onChange={(e) => setEditJpmTitle(e.target.value)} /></div>
            <div className="form-group"><label>Area of Focus</label>
              <select value={editFocus} onChange={(e) => setEditFocus(e.target.value)}>
                {['','Hedge Funds','Private Equity','Insurance','Family Office','Real Estate','Banking','Technology','Corporate','Other'].map((v) => (
                  <option key={v} value={v}>{v || 'Select...'}</option>
                ))}
              </select>
            </div>
            <div className="form-group"><label>Firms Covered</label><textarea value={editFirms} onChange={(e) => setEditFirms(e.target.value)} /></div>
            <div className="form-group"><label>Engagement</label>
              <select value={editJpmEng} onChange={(e) => setEditJpmEng(e.target.value)}>
                {['warm','active','cold','prospect'].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </>}
          {node.type === 'organisation' && <>
            <div className="form-group"><label>Industry</label><input type="text" value={editIndustry} onChange={(e) => setEditIndustry(e.target.value)} /></div>
            <div className="form-group"><label>AUM / Size</label><input type="text" value={editAUM} onChange={(e) => setEditAUM(e.target.value)} /></div>
            <div className="form-group"><label>Website</label><input type="text" value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} /></div>
            <div className="form-group"><label>Key Contacts</label><textarea value={editKeyContacts} onChange={(e) => setEditKeyContacts(e.target.value)} /></div>
          </>}
          {node.type !== 'jpmorgan' && node.type !== 'organisation' && <>
            <div className="form-group"><label>Sector</label><input type="text" value={editSector} onChange={(e) => setEditSector(e.target.value)} /></div>
            {(node.type === 'client' || node.type === 'prospect') && (
              <div className="form-group"><label>Net Worth</label><input type="text" value={editAUM} onChange={(e) => setEditAUM(e.target.value)} /></div>
            )}
          </>}
          <div className="form-group"><label>Notes</label><textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} /></div>
          <div className="detail-actions">
            <button id="saveNodeBtn" style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: '600', border: '1px solid #185fa5', borderRadius: '6px', cursor: 'pointer', background: '#185fa5', color: 'white' }} onClick={handleSave}>Save</button>
            <button id="cancelNodeBtn" style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: '600', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer', background: '#f3f4f6' }} onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="detail-panel active" id="detailPanel">
      <div className="detail-header">
        <div
          className={`detail-avatar${node.type === 'organisation' ? ' org' : ''}`}
          style={{ backgroundColor: getTypeColor(node.type) }}
        >
          {node.type === 'organisation' ? '🏢' : getInitials(node.name)}
        </div>
        <div className="detail-title">
          <div className="detail-name" id="detailName">{node.name}</div>
          <div className="detail-org" id="detailOrg">{node.organisation || node.sector || ''}</div>
          <div id="detailTypeContainer">
            <div className={`person-type type-${node.type}`}>{getTypeBadgeLabel(node.type)}</div>
          </div>
        </div>
      </div>

      <div id="detailContent">
        {node.type === 'organisation' && <>
          {node.industry && <><div className="detail-section-title">Industry</div><div className="detail-row">{node.industry}</div></>}
          {node.estimatedAUM && <><div className="detail-section-title">AUM / Size</div><div className="detail-row">{node.estimatedAUM}</div></>}
          {node.website && <><div className="detail-section-title">Website</div><div className="detail-row"><a href={`https://${node.website}`} target="_blank" rel="noopener noreferrer">{node.website}</a></div></>}
          {node.keyContacts && <><div className="detail-section-title">Key Contacts</div><div className="detail-row">{node.keyContacts}</div></>}
          {node.researchedAt && <div className="detail-row" style={{ fontSize: '10px', color: '#aaa', marginTop: '8px' }}>Researched {new Date(node.researchedAt).toLocaleDateString()}</div>}
        </>}
        {node.type === 'jpmorgan' && <>
          {node.jpmTitle && <><div className="detail-section-title">Role</div><div className="detail-row">{node.jpmTitle}</div></>}
          {node.areaOfFocus && <><div className="detail-section-title">Area of Focus</div><div className="detail-row">{node.areaOfFocus}</div></>}
          {node.firmsCovered && <><div className="detail-section-title">Firms Covered</div><div className="detail-row">{node.firmsCovered}</div></>}
          {node.jpmEngagement && <><div className="detail-section-title">Engagement</div><div className="detail-row">{node.jpmEngagement}</div></>}
        </>}
        {node.type !== 'organisation' && node.type !== 'jpmorgan' && <>
          <div className="detail-section-title">Engagement</div>
          <div className="detail-row">
            <div className="star-display">
              {[1,2,3,4,5].map((i) => <i key={i} className={`ti ${i <= node.engagementScore ? 'ti-star-filled' : 'ti-star'}`} />)}
            </div>
          </div>
          <div className="detail-section-title">Referral Likelihood</div>
          <div className="detail-row">
            <div className="star-display">
              {[1,2,3,4,5].map((i) => <i key={i} className={`ti ${i <= node.referralLikelihood ? 'ti-star-filled' : 'ti-star'}`} />)}
            </div>
          </div>
          {(node.type === 'client' || node.type === 'prospect') && node.estimatedAUM && <><div className="detail-section-title">Net Worth</div><div className="detail-row">{node.estimatedAUM}</div></>}
        </>}
        {node.notes && <><div className="detail-section-title">Notes</div><div className="detail-row">{node.notes}</div></>}
        {connEdges.length > 0 && <>
          <div className="detail-section-title">Connections</div>
          {connEdges.map((e) => {
            const oid = e.sourceId === node.id ? e.targetId : e.sourceId;
            const o = appState.simulation.nodes.get(oid);
            return o ? <div key={e.id} className="detail-row"><strong>{o.name}</strong> — {e.relationshipType}</div> : null;
          })}
        </>}
        {intro && <><div className="detail-section-title">Introduced By</div><div className="referral-pathway-item">{intro.name}</div></>}
        {referrals.length > 0 && <>
          <div className="detail-section-title">Has Referred</div>
          {referrals.map((e) => {
            const r = appState.simulation.nodes.get(e.targetId);
            return r ? <div key={e.id} className="referral-pathway-item">{r.name}</div> : null;
          })}
        </>}
      </div>

      <div className="detail-actions" id="detailActions">
        <button id="editBtn" onClick={() => setEditing(true)}>Edit</button>
        {node.type === 'organisation' && (
          <button
            id="researchBtn"
            title={node.researchedAt ? 'Re-research firm' : 'Research firm online'}
            onClick={onResearch}
          >
            {node.researching ? '⏳ Researching…' : '🔍 Research firm'}
          </button>
        )}
        <button id="deleteBtn" className="delete" onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}

// ── Edge Detail ──
function EdgeDetail({ edge, onDelete }: { edge: GraphEdge; onDelete: () => void }) {
  const [edgeType, setEdgeType] = useStateString(edge.relationshipType);
  const [strength, setStrength] = useStateString(String(edge.strength));
  const [lastContact, setLastContact] = useStateString(edge.lastContact || '');
  const [notes, setNotes] = useStateString(edge.notes || '');

  const src = appState.simulation.nodes.get(edge.sourceId);
  const tgt = appState.simulation.nodes.get(edge.targetId);
  const staleInfo = getEdgeStaleInfo(edge);

  function handleSave() {
    edge.relationshipType = edgeType as GraphEdge['relationshipType'];
    edge.strength = parseInt(strength);
    edge.lastContact = lastContact;
    edge.notes = notes;
    markDirty();
    useStore.getState().bumpGraph();
    useStore.getState().bumpDetail();
  }

  const staleBadge = edge.lastContact
    ? <span style={{ marginLeft: '6px', fontSize: '10px', padding: '1px 6px', borderRadius: '8px', background: staleInfo.color + '22', color: staleInfo.color, border: `1px solid ${staleInfo.color}44` }}>{staleInfo.label}</span>
    : null;

  return (
    <div className="detail-panel active" id="detailPanel">
      <div className="detail-header">
        <div className="detail-avatar edge" style={{ backgroundColor: '#888780' }}>⟷</div>
        <div className="detail-title">
          <div className="detail-name" id="detailName">{src?.name || '?'} → {tgt?.name || '?'}</div>
          <div className="detail-org" id="detailOrg">Connection</div>
          <div id="detailTypeContainer">
            <span className="edge-badge">{edge.relationshipType}</span>
          </div>
        </div>
      </div>
      <div id="detailContent">
        <div className="edit-mode">
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label>Relationship type</label>
            <select id="eeType" value={edgeType} onChange={(e) => setEdgeType(e.target.value)}>
              {['referred','knows','colleague','adviser-to','family','covers'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Strength</label>
            <select id="eeStrength" value={strength} onChange={(e) => setStrength(e.target.value)}>
              <option value="1">1 – Distant</option>
              <option value="2">2 – Solid</option>
              <option value="3">3 – Close</option>
            </select>
          </div>
          <div className="form-group">
            <label>Last contact {staleBadge}</label>
            <input type="date" id="eeLastContact" value={lastContact} onChange={(e) => setLastContact(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea id="eeNotes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button id="saveEdgeBtn" style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: '600', border: '1px solid #185fa5', borderRadius: '6px', cursor: 'pointer', background: '#185fa5', color: 'white' }} onClick={handleSave}>Save</button>
            <button id="deleteEdgeBtn" style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: '600', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer', background: '#fee2e2', color: '#991b1b' }} onClick={onDelete}>Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small hook helpers to avoid repetitive useState imports ──
import { useState, useEffect, useRef } from 'react';
function useEditMode(init: boolean): [boolean, (v: boolean) => void] { return useState(init); }
function useStateString(init: string): [string, (v: string) => void] { return useState(init); }

// Expose generateUUID for modal use
export { generateUUID };
