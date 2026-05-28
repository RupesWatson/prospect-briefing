import { useStore } from '../store';
import { appState } from '../appState';
import { markDirty } from '../persistence';
import { researchFirm, checkJPMorganCoverage } from '../research';
import { generateUUID, getTypeColor, getInitials, getEdgeStaleInfo } from '../utils';
import { exportAsJSON, exportAsSummary } from '../importExport';
import { searchOfficers, fetchAndStoreForCandidate, getCHApiKey, formatCandidateMeta } from '../companiesHouse';
import type { OfficerCandidate } from '../companiesHouse';
import type { GraphNode, GraphEdge, PriorityLevel } from '../types';

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
  const [chSearching, setChSearching] = useState(false);
  const [chSearchMode, setChSearchMode] = useState(false);
  const [chSearchQuery, setChSearchQuery] = useState('');
  const [chCandidates, setChCandidates] = useState<OfficerCandidate[] | null>(null);
  const [chSelecting, setChSelecting] = useState(false);
  const [chError, setChError] = useState<string | null>(null);
  const [chStatusMsg, setChStatusMsg] = useState<string | null>(null);
  const chSearchBoxRef = useRef<HTMLDivElement>(null);
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
  const [editPriority, setEditPriority] = useState<PriorityLevel>(node.priority || 'medium');

  function handleSave() {
    node.name = editName;
    node.organisation = editOrg;
    node.notes = editNotes;
    node.priority = editPriority;
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
    // Auto-connect to JPM org node if this node is a JPM contact or has JPM as organisation
    const isJPMRelated = node.type === 'jpmorgan' ||
      ['jp morgan', 'jpmorgan', 'jpm'].some((kw) => (node.organisation || '').toLowerCase().includes(kw));
    if (isJPMRelated) {
      const jpmOrg = Array.from(appState.simulation.nodes.values()).find(
        (n) => n.id !== node.id && n.type === 'organisation' && (
          n.name.toLowerCase().includes('jp morgan') ||
          n.name.toLowerCase().includes('jpmorgan') ||
          n.name.toLowerCase() === 'jpm'
        )
      );
      if (jpmOrg) {
        const alreadyLinked = Array.from(appState.simulation.edges.values()).some(
          (e) => (e.sourceId === node.id && e.targetId === jpmOrg.id) ||
                  (e.sourceId === jpmOrg.id && e.targetId === node.id)
        );
        if (!alreadyLinked) {
          const eid = generateUUID();
          appState.simulation.edges.set(eid, {
            id: eid, sourceId: node.id, targetId: jpmOrg.id,
            relationshipType: 'works-at' as const, strength: 2,
            notes: 'Works at JPM', bendOffset: 0, lastContact: '',
          });
        }
      }
    }

    markDirty();
    setEditing(false);
    useStore.getState().bumpGraph();
    useStore.getState().bumpDetail();
  }

  // Scroll the CH search panel into view whenever search mode opens
  useEffect(() => {
    if (chSearchMode && chSearchBoxRef.current) {
      chSearchBoxRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [chSearchMode]);

  function handleCHSearch() {
    if (!getCHApiKey()) {
      alert('No Companies House API key set.\n\nAdd your key in Settings (⚙ button in the toolbar → Companies House section).\n\nGet a free key at developer.company-information.service.gov.uk');
      return;
    }
    setChSearchMode(true);
    setChSearchQuery(node.name);
    setChCandidates(null);
    setChError(null);
    setChStatusMsg(null);
  }

  async function handleCHSearchExecute() {
    if (!chSearchQuery.trim()) return;
    setChSearching(true);
    setChCandidates(null);
    setChError(null);
    setChStatusMsg('⏳ Contacting Companies House…');
    try {
      const candidates = await searchOfficers(chSearchQuery.trim());
      setChCandidates(candidates);
      if (candidates.length === 0) {
        setChStatusMsg(`ℹ️ No results for "${chSearchQuery.trim()}" — try a surname only`);
      } else {
        setChStatusMsg(`✅ Found ${candidates.length} match${candidates.length !== 1 ? 'es' : ''} on Companies House`);
      }
    } catch (err) {
      setChError((err as Error).message || 'Search failed');
      setChStatusMsg(null);
    } finally {
      setChSearching(false);
    }
  }

  async function handleCHSelect(candidate: OfficerCandidate) {
    setChSelecting(true);
    setChError(null);
    setChStatusMsg('⏳ Loading appointments…');
    try {
      await fetchAndStoreForCandidate(node.id, candidate);
      setChCandidates(null);
      setChSearchMode(false);
      setChStatusMsg('✅ Directorships loaded from Companies House');
    } catch (err) {
      setChError((err as Error).message || 'Failed to load appointments');
      setChStatusMsg(null);
    } finally {
      setChSelecting(false);
    }
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
          <div className="form-group">
            <label>Priority</label>
            <select value={editPriority} onChange={(e) => setEditPriority(e.target.value as PriorityLevel)}>
              <option value="critical">🔴 Critical</option>
              <option value="high">🟠 High</option>
              <option value="medium">🟡 Medium</option>
              <option value="low">⚫ Low</option>
              <option value="background">🔵 Background</option>
            </select>
          </div>
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
        <div className="detail-section-title">Priority</div>
        <div className="detail-row">
          <PriorityBadge priority={node.priority || 'medium'} />
        </div>
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

        {/* ── Companies House Directorships ── */}
        {node.type !== 'organisation' && (() => {
          const active = (node.directorships ?? []).filter((d) => d.active);
          const past   = (node.directorships ?? []).filter((d) => !d.active);
          return (
            <>
              <div className="detail-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>🏛 Board Directorships</span>
                {node.directorshipsUpdatedAt && (
                  <span className="ch-updated">
                    {new Date(node.directorshipsUpdatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>

              {/* Status message banner */}
              {chStatusMsg && !chSearchMode && (
                <div className={`ch-status-msg${chStatusMsg.startsWith('✅') ? ' ch-status-ok' : ''}`}>
                  {chStatusMsg}
                </div>
              )}

              {/* Editable search box — shown when user clicks 🏛 */}
              {chSearchMode && (
                <div className="ch-picker" ref={chSearchBoxRef}>
                  <div className="ch-picker-hint">Edit the search name if needed, then click Search:</div>
                  <input
                    className="ch-search-input"
                    type="text"
                    value={chSearchQuery}
                    disabled={chSearching}
                    onChange={(e) => setChSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCHSearchExecute(); }}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                    <button
                      className="ch-candidate-btn"
                      disabled={chSearching || !chSearchQuery.trim()}
                      onClick={handleCHSearchExecute}
                      style={{ flex: 1, background: '#0891b2', color: 'white', fontWeight: 600 }}
                    >
                      {chSearching ? '⏳ Searching…' : '🔍 Search'}
                    </button>
                    <button
                      className="ch-picker-cancel"
                      style={{ flex: 0 }}
                      onClick={() => { setChSearchMode(false); setChCandidates(null); setChError(null); }}
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Status / error during search */}
                  {chStatusMsg && (
                    <div className={`ch-status-msg${chStatusMsg.startsWith('✅') ? ' ch-status-ok' : ''}`} style={{ marginTop: 6 }}>
                      {chStatusMsg}
                    </div>
                  )}
                  {chError && chCandidates === null && (
                    <div className="ch-error" style={{ marginTop: 6 }}>⚠ {chError}</div>
                  )}

                  {/* Results inside the search box */}
                  {chCandidates !== null && (
                    <>
                      {chCandidates.length === 0 ? (
                        <div className="ch-picker-empty" style={{ marginTop: 8 }}>
                          No results found for "{chSearchQuery}".<br />
                          Try a surname only or check the spelling.
                        </div>
                      ) : (
                        <>
                          <div className="ch-picker-hint" style={{ marginTop: 8 }}>
                            {chCandidates.length} result{chCandidates.length !== 1 ? 's' : ''} — select the right person:
                          </div>
                          {chCandidates.map((c, i) => (
                            <button
                              key={i}
                              className="ch-candidate-btn"
                              disabled={chSelecting}
                              onClick={() => handleCHSelect(c)}
                            >
                              <div className="ch-candidate-name">{c.name}</div>
                              <div className="ch-candidate-meta">{formatCandidateMeta(c)}</div>
                            </button>
                          ))}
                        </>
                      )}
                      {chError && <div className="ch-error">{chError}</div>}
                    </>
                  )}
                </div>
              )}

              {/* Error shown outside picker (e.g. CORS / network before search mode was used) */}
              {!chSearchMode && chError && chCandidates === null && (
                <div className="ch-error" style={{ marginBottom: 8 }}>
                  ⚠ {chError}
                </div>
              )}

              {/* Directorship list — hidden while search mode / picker is open */}
              {!chSearchMode && chCandidates === null && (
                active.length > 0 ? (
                  <div className="directorships-list">
                    {active.map((d, i) => (
                      <div key={i} className="directorship-card">
                        <div className="directorship-company">{d.companyName}</div>
                        <div className="directorship-role">
                          {d.role}{d.appointedOn ? ` · from ${d.appointedOn}` : ''}
                        </div>
                        <div className="directorship-number">{d.companyNumber}</div>
                      </div>
                    ))}
                    {past.length > 0 && (
                      <div className="ch-updated">{past.length} past appointment{past.length !== 1 ? 's' : ''} not shown</div>
                    )}
                  </div>
                ) : node.directorships ? (
                  <div className="detail-row ch-updated">No active directorships found</div>
                ) : (
                  <div className="detail-row ch-updated">Click 🏛 below to search</div>
                )
              )}
            </>
          );
        })()}
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
        {node.type !== 'organisation' && (
          <button
            id="chSearchBtn"
            title="Search Companies House for board directorships"
            onClick={chSearchMode ? () => chSearchBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) : handleCHSearch}
            disabled={chSearching || chSelecting}
            style={{
              background: chSearching || chSelecting ? '#e5e7eb'
                        : chSearchMode ? '#0e7490'
                        : '#0891b2',
              color: (chSearching || chSelecting) ? '#374151' : 'white',
              border: chSearchMode ? '2px solid #22d3ee' : 'none',
            }}
          >
            {chSearching ? '⏳ Searching CH…'
             : chSelecting ? '⏳ Loading…'
             : chSearchMode ? '🔍 Search open ↑'
             : '🏛 Companies House'}
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
              {['referred','knows','works-at','client-of','colleague','adviser-to','family','covers','board'].map((t) => (
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

// ── Priority badge ──
const PRIORITY_STYLES: Record<string, { color: string; label: string; desc: string }> = {
  critical:   { color: '#ef4444', label: '🔴 Critical',   desc: 'Innermost orbit' },
  high:       { color: '#f97316', label: '🟠 High',       desc: '2nd orbit' },
  medium:     { color: '#eab308', label: '🟡 Medium',     desc: '3rd orbit' },
  low:        { color: '#6b7280', label: '⚫ Low',        desc: '4th orbit' },
  background: { color: '#3b82f6', label: '🔵 Background', desc: 'Outermost orbit' },
};
function PriorityBadge({ priority }: { priority: string }) {
  const s = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.medium;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 12,
      background: s.color + '22', color: s.color,
      border: `1px solid ${s.color}55`, fontSize: 12, fontWeight: 600,
    }}>
      {s.label}
      <span style={{ fontWeight: 400, opacity: 0.7, fontSize: 10 }}>({s.desc})</span>
    </span>
  );
}

// ── Small hook helpers to avoid repetitive useState imports ──
import { useState, useEffect, useRef } from 'react';
function useEditMode(init: boolean): [boolean, (v: boolean) => void] { return useState(init); }
function useStateString(init: string): [string, (v: string) => void] { return useState(init); }

// Expose generateUUID for modal use
export { generateUUID };
