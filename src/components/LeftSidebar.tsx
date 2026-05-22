import { useRef, useState } from 'react';
import { useStore } from '../store';
import { appState } from '../appState';
import { markDirty, clearAllData } from '../persistence';
import { checkJPMorganCoverage } from '../research';
import { generateUUID, getTypeColor, getInitials } from '../utils';
import { gentleRestart } from '../simulation';
import type { GraphNode } from '../types';

export default function LeftSidebar() {
  const { graphVersion, bumpGraph, bumpDetail, setModal } = useStore();
  const formRef = useRef<HTMLFormElement>(null);
  const formContainerRef = useRef<HTMLDivElement>(null);
  const [selectedType, setSelectedType] = useState('');
  const [engagementScore, setEngagementScore] = useState(3);
  const [referralLikelihood, setReferralLikelihood] = useState(3);

  // Suppress unused warning
  void graphVersion;

  function findExistingOrg(name: string): GraphNode | null {
    const lc = name.trim().toLowerCase();
    for (const [, n] of appState.simulation.nodes) {
      if (n.type === 'organisation' && n.name.toLowerCase() === lc) return n;
    }
    return null;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const type = fd.get('type') as string;
    const name = fd.get('name') as string;
    if (!type || !name) return;

    // Org duplicate check
    if (type === 'organisation') {
      const existing = findExistingOrg(name);
      if (existing) {
        const pendingNode: GraphNode = {
          id: generateUUID(), name, type: 'organisation',
          organisation: '', sector: '',
          estimatedAUM: (fd.get('estimatedAUM') as string) || '',
          engagementScore: 0, referralLikelihood: 0,
          notes: (fd.get('notes') as string) || '',
          introducedBy: (fd.get('introducedBy') as string) || null,
          areaOfFocus: '', firmsCovered: '', jpmTitle: '', jpmEngagement: '',
          industry: (fd.get('industry') as string) || '',
          website: (fd.get('website') as string) || '',
          keyContacts: (fd.get('keyContacts') as string) || '',
          x: Math.random() * 200 - 100, y: Math.random() * 200 - 100,
          vx: 0, vy: 0, fx: 0, fy: 0, fixed: false,
        };
        appState.pendingOrgNode = pendingNode;
        const msg = document.getElementById('orgDuplicateMsg');
        if (msg) msg.textContent = `"${existing.name}" already exists in your network. What is the connection between this new entry and the existing one?`;
        setModal('orgDuplicate');
        // Store the existing org id for the modal handler
        (window as unknown as Record<string, unknown>)._orgDuplicateExistingId = existing.id;
        return;
      }
    }

    const person: GraphNode = {
      id: generateUUID(), name, type: type as GraphNode['type'],
      organisation: (fd.get('organisation') as string) || '',
      sector: (fd.get('sector') as string) || '',
      estimatedAUM: (fd.get('estimatedAUM') as string) || '',
      engagementScore,
      referralLikelihood,
      notes: (fd.get('notes') as string) || '',
      introducedBy: (fd.get('introducedBy') as string) || null,
      areaOfFocus: (fd.get('areaOfFocus') as string) || '',
      firmsCovered: (fd.get('firmsCovered') as string) || '',
      jpmTitle: (fd.get('jpmTitle') as string) || '',
      jpmEngagement: (fd.get('jpmEngagement') as string) || '',
      industry: (fd.get('industry') as string) || '',
      website: (fd.get('website') as string) || '',
      keyContacts: (fd.get('keyContacts') as string) || '',
      x: Math.random() * 200 - 100, y: Math.random() * 200 - 100,
      vx: 0, vy: 0, fx: 0, fy: 0, fixed: false,
    };

    appState.simulation.nodes.set(person.id, person);

    if (type === 'jpmorgan') checkJPMorganCoverage(person);

    if (person.organisation && type !== 'organisation') {
      const matchedOrg = findExistingOrg(person.organisation);
      if (matchedOrg) {
        const alreadyLinked = Array.from(appState.simulation.edges.values()).some(
          (e) => (e.sourceId === person.id && e.targetId === matchedOrg.id) ||
                 (e.sourceId === matchedOrg.id && e.targetId === person.id)
        );
        if (!alreadyLinked && confirm(`"${matchedOrg.name}" exists as an organisation in your network. Connect ${person.name} to it?`)) {
          const edge = {
            id: generateUUID(), sourceId: person.id, targetId: matchedOrg.id,
            relationshipType: 'colleague' as const, strength: 2,
            notes: 'Works at / associated with', bendOffset: 0, lastContact: '',
          };
          appState.simulation.edges.set(edge.id, edge);
        }
      }
    }

    finishAdd();
  }

  function finishAdd() {
    formRef.current?.reset();
    setSelectedType('');
    setEngagementScore(3);
    setReferralLikelihood(3);
    markDirty();
    gentleRestart();
    bumpGraph();
  }

  // Expose finishAdd for modal to call
  (window as unknown as Record<string, unknown>)._finishAddNode = finishAdd;

  function handleDeleteNode(nodeId: string, name: string) {
    if (!confirm(`Delete ${name}?`)) return;
    appState.simulation.nodes.delete(nodeId);
    for (const [id, e] of appState.simulation.edges) {
      if (e.sourceId === nodeId || e.targetId === nodeId) appState.simulation.edges.delete(id);
    }
    if (appState.selectedNodeId === nodeId) { appState.selectedNodeId = null; appState.detailMode = null; }
    markDirty(); bumpGraph(); bumpDetail();
  }

  function handleSelectNode(nodeId: string) {
    const selectNode = (window as unknown as Record<string, unknown>)._selectNode as ((id: string) => void) | undefined;
    if (selectNode) selectNode(nodeId);
    bumpDetail();
  }

  const nodesArr = Array.from(appState.simulation.nodes.values()).sort((a, b) => a.name.localeCompare(b.name));

  function getTypeBadgeLabel(type: string) {
    if (type === 'jpmorgan') return 'JPM';
    if (type === 'organisation') return 'Organisation';
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  return (
    <div className="left-sidebar">
      <div className="form-container" id="formContainer" ref={formContainerRef}>
        <form id="addPersonForm" ref={formRef} onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name *</label>
            <input type="text" name="name" required />
          </div>

          <div className="form-group">
            <label>Type *</label>
            <select name="type" id="typeSelect" required value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
              <option value="">Select type</option>
              <option value="client">Client</option>
              <option value="prospect">Prospect</option>
              <option value="referrer">Referrer</option>
              <option value="adviser">Adviser</option>
              <option value="jpmorgan">JPM Contact</option>
              <option value="organisation">Organisation / Firm</option>
            </select>
          </div>

          <div className="form-group">
            <label>Organisation</label>
            <input type="text" name="organisation" id="orgNameInput" placeholder="e.g. Acme Capital" />
          </div>

          {/* Common fields — hidden for jpmorgan/organisation */}
          <div className={`common-fields${selectedType === 'jpmorgan' || selectedType === 'organisation' ? ' hidden' : ''}`} id="commonFields">
            <div className="form-group">
              <label>Sector</label>
              <input type="text" name="sector" placeholder="e.g. Private equity" list="sectorList" />
              <datalist id="sectorList">
                <option value="Private equity" />
                <option value="Hedge fund" />
                <option value="Tech founder" />
                <option value="Real estate" />
                <option value="Legal" />
                <option value="Accounting" />
                <option value="Family office" />
                <option value="Banking" />
                <option value="Corporate" />
                <option value="Insurance" />
                <option value="Other" />
              </datalist>
            </div>
            {(selectedType === 'client' || selectedType === 'prospect' || selectedType === '') && (
              <div className="form-group">
                <label>Net Worth</label>
                <input type="text" name="estimatedAUM" placeholder="e.g. >£50m" />
              </div>
            )}
            <div className="form-group">
              <label>Engagement</label>
              <StarPicker value={engagementScore} onChange={setEngagementScore} />
            </div>
            <div className="form-group">
              <label>Referral Likelihood</label>
              <StarPicker value={referralLikelihood} onChange={setReferralLikelihood} />
            </div>
          </div>

          {/* JP Morgan fields */}
          <div className={`jpmorgan-fields${selectedType === 'jpmorgan' ? ' visible' : ''}`} id="jpmorganFields">
            <div className="conditional-section-label">JPM Details</div>
            <div className="form-group">
              <label>Role / Title</label>
              <input type="text" name="jpmTitle" placeholder="e.g. Managing Director" />
            </div>
            <div className="form-group">
              <label>Area of Focus</label>
              <select name="areaOfFocus">
                <option value="">Select focus</option>
                <option value="Hedge Funds">Hedge Funds</option>
                <option value="Private Equity">Private Equity</option>
                <option value="Insurance">Insurance</option>
                <option value="Family Office">Family Office</option>
                <option value="Real Estate">Real Estate</option>
                <option value="Banking">Banking</option>
                <option value="Technology">Technology</option>
                <option value="Corporate">Corporate</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Firms / Clients Covered</label>
              <textarea name="firmsCovered" placeholder={"e.g. Bridgewater, Man Group, Citadel\n(matched to existing orgs automatically)"} />
            </div>
            <div className="form-group">
              <label>Engagement Level</label>
              <select name="jpmEngagement">
                <option value="warm">Warm – active dialogue</option>
                <option value="active">Active – frequent contact</option>
                <option value="cold">Cold – no recent contact</option>
                <option value="prospect">Prospect – not yet engaged</option>
              </select>
            </div>
          </div>

          {/* Organisation fields */}
          <div className={`org-fields${selectedType === 'organisation' ? ' visible' : ''}`} id="orgFields">
            <div className="conditional-section-label org-section-label">Organisation Details</div>
            <div className="form-group">
              <label>Industry</label>
              <input type="text" name="industry" placeholder="e.g. Asset Management" />
            </div>
            <div className="form-group">
              <label>AUM / Size</label>
              <input type="text" name="estimatedAUM" placeholder="e.g. >£50m" />
            </div>
            <div className="form-group">
              <label>Website</label>
              <input type="text" name="website" placeholder="e.g. acme.com" />
            </div>
            <div className="form-group">
              <label>Key Contacts</label>
              <textarea name="keyContacts" placeholder="e.g. James Hartley, Sarah Chen" />
            </div>
          </div>

          <div className="form-group">
            <label>Introduced By</label>
            <select name="introducedBy" id="introducedBySelect">
              <option value="">None</option>
              {nodesArr.map((n) => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea name="notes" placeholder="Any notes" />
          </div>

          <button type="submit" className="btn btn-primary">Add to Network</button>
        </form>
      </div>

      <div className="form-scroll-buttons">
        <button type="button" id="scrollFormUp" onClick={() => formContainerRef.current?.scrollBy({ top: -100, behavior: 'smooth' })}>
          <i className="ti ti-chevron-up" />
        </button>
        <button type="button" id="scrollFormDown" onClick={() => formContainerRef.current?.scrollBy({ top: 100, behavior: 'smooth' })}>
          <i className="ti ti-chevron-down" />
        </button>
      </div>

      <div className="divider" style={{ padding: '0 16px' }}>Network</div>

      <div className="people-list" id="peopleList">
        {nodesArr.map((node) => (
          <div
            key={node.id}
            className={`person-card${appState.selectedNodeId === node.id ? ' selected' : ''}`}
            data-node-id={node.id}
            onClick={() => handleSelectNode(node.id)}
          >
            <div
              className={`person-avatar${node.type === 'organisation' ? ' org-avatar' : ''}`}
              style={{ backgroundColor: getTypeColor(node.type) }}
            >
              {node.type === 'organisation' ? '🏢' : getInitials(node.name)}
            </div>
            <div className="person-info">
              <div className="person-name">{node.name}</div>
              <div className="person-meta">
                {node.type === 'organisation'
                  ? (node.industry || node.website || 'Firm')
                  : node.type === 'jpmorgan'
                    ? (node.areaOfFocus || node.jpmTitle || 'JPM')
                    : (node.organisation || node.sector || '')}
              </div>
              <div className={`person-type type-${node.type}`}>{getTypeBadgeLabel(node.type)}</div>
            </div>
            <div className="person-actions">
              <button
                className="action-btn"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectNode(node.id);
                  setTimeout(() => (document.getElementById('editBtn') as HTMLButtonElement)?.click(), 50);
                }}
              >
                <i className="ti ti-edit" />
              </button>
              <button
                className="action-btn"
                type="button"
                onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id, node.name); }}
              >
                <i className="ti ti-trash" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="save-indicator" id="saveIndicator">Never saved</div>
        <button
          className="clear-data-btn"
          onClick={() => clearAllData(() => { bumpGraph(); bumpDetail(); })}
        >
          Clear all data
        </button>
      </div>
    </div>
  );
}

// ── Star Picker component ──
function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="star-picker">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          className={`star-btn${i <= value ? ' active' : ''}`}
          onClick={() => onChange(i)}
        >
          <i className={`ti ${i <= value ? 'ti-star-filled' : 'ti-star'}`} />
        </button>
      ))}
    </div>
  );
}
