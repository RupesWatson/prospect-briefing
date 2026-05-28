import { useState, useRef } from 'react';
import { useStore } from '../store';
import { appState } from '../appState';
import { markDirty } from '../persistence';
import { generateUUID } from '../utils';
import { downloadImportTemplate, importFromXLSX } from '../importExport';
import { gentleRestart } from '../simulation';
import type { GraphEdge } from '../types';

export default function Modals() {
  const { activeModal, setModal, bumpGraph, bumpDetail } = useStore();

  return (
    <>
      <ConnectionModal
        active={activeModal === 'connection'}
        onClose={() => setModal(null)}
        onAdd={() => { bumpGraph(); }}
      />
      <OrgDuplicateModal
        active={activeModal === 'orgDuplicate'}
        onClose={() => setModal(null)}
        onDone={() => { bumpGraph(); bumpDetail(); }}
      />
      <ApiKeyModal
        active={activeModal === 'apikey'}
        onClose={() => setModal(null)}
      />
      <ImportModal
        active={activeModal === 'import'}
        onClose={() => setModal(null)}
        onDone={() => { bumpGraph(); }}
      />

      {/* Context Menu */}
      <div
        id="contextMenu"
        style={{ display: 'none', position: 'fixed', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', boxShadow: '0 10px 15px rgba(0,0,0,.1)', zIndex: 2000, minWidth: '180px' }}
      >
        <button id="contextEdit"            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #e5e7eb' }}>Edit</button>
        <button id="contextDelete"          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #e5e7eb', color: '#dc2626' }}>Delete</button>
        <button id="contextAddConnection"   style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #e5e7eb' }}>Add connection</button>
        <button id="contextLinkNodes"       style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #e5e7eb' }}>Link to another node…</button>
        <button id="contextViewConnections" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}>View connections</button>
      </div>

      {/* Edge Context Menu */}
      <div
        id="edgeContextMenu"
        style={{ display: 'none', position: 'fixed', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', boxShadow: '0 10px 15px rgba(0,0,0,.1)', zIndex: 2000, minWidth: '200px' }}
      >
        <button id="ecEdit"          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #e5e7eb' }}>✏️ Edit connection</button>
        <button id="ecMarkContacted" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #e5e7eb' }}>✅ Mark contacted today</button>
        <button id="ecReverse"       style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #e5e7eb' }}>🔄 Reverse direction</button>
        <button id="ecResetBend"     style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #e5e7eb' }}>📐 Straighten connector</button>
        <button id="ecDelete"        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#dc2626' }}>🗑️ Delete connection</button>
      </div>

      {/* Edge Hover Tooltip */}
      <div id="edgeTooltip">
        <div className="et-route" id="etRoute"></div>
        <div id="etType" className="et-type"></div>
        <div className="et-strength" id="etStrength"></div>
        <div className="et-date" id="etDate"></div>
        <div className="et-notes" id="etNotes"></div>
      </div>

      {/* Node Hover Tooltip */}
      <div id="nodeTooltip">
        <div className="nt-header">
          <div className="nt-avatar" id="ntAvatar"></div>
          <div className="nt-header-text">
            <div className="nt-name" id="ntName"></div>
            <div className="nt-sub"  id="ntSub"></div>
          </div>
          <div className="nt-type" id="ntType"></div>
        </div>
        <div className="nt-body" id="ntBody"></div>
      </div>
    </>
  );
}

// ── Connection Modal ──
function ConnectionModal({ active, onClose, onAdd }: { active: boolean; onClose: () => void; onAdd: () => void }) {
  const [directionNote, setDirectionNote] = useState('');

  const nodesArr = Array.from(appState.simulation.nodes.values()).sort((a, b) => a.name.localeCompare(b.name));

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const srcId = fd.get('sourceNodeId') as string;
    const tgtId = fd.get('targetNodeId') as string;
    const rel   = fd.get('relationshipType') as string;
    const str   = parseInt(fd.get('strength') as string);
    const notes = fd.get('connectionNotes') as string;
    if (!srcId || !tgtId || !rel || !str) { alert('All fields required'); return; }
    const edge: GraphEdge = {
      id: generateUUID(), sourceId: srcId, targetId: tgtId,
      relationshipType: rel as GraphEdge['relationshipType'],
      strength: str, notes, bendOffset: 0, lastContact: '',
    };
    appState.simulation.edges.set(edge.id, edge);
    markDirty();
    onAdd();
    onClose();
    (e.target as HTMLFormElement).reset();
    setDirectionNote('');
  }

  function handleRelChange(e: React.ChangeEvent<HTMLSelectElement>, srcSel: HTMLSelectElement | null, tgtSel: HTMLSelectElement | null) {
    if (e.target.value === 'referred') {
      const sn = srcSel?.options[srcSel.selectedIndex]?.text || '';
      const tn = tgtSel?.options[tgtSel.selectedIndex]?.text || '';
      setDirectionNote(`Direction: ${sn} referred ${tn}`);
    } else {
      setDirectionNote('');
    }
  }

  const srcRef = useRef<HTMLSelectElement>(null);
  const tgtRef = useRef<HTMLSelectElement>(null);

  function filterTarget() {
    if (!tgtRef.current || !srcRef.current) return;
    const srcVal = srcRef.current.value;
    Array.from(tgtRef.current.options).forEach((o) => {
      o.style.display = o.value === srcVal ? 'none' : '';
    });
  }

  return (
    <div className={`modal-overlay${active ? ' active' : ''}`} id="connectionModal">
      <div className="modal-content">
        <div className="modal-title">Add Connection</div>
        <form id="connectionForm" onSubmit={handleSubmit}>
          <div className="modal-form-group">
            <label>From *</label>
            <select name="sourceNodeId" ref={srcRef} required onChange={filterTarget}>
              <option value="">Select person / org</option>
              {nodesArr.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
          </div>
          <div className="modal-form-group">
            <label>To *</label>
            <select name="targetNodeId" ref={tgtRef} required>
              <option value="">Select person / org</option>
              {nodesArr.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
          </div>
          <div className="modal-form-group">
            <label>Relationship Type *</label>
            <select name="relationshipType" required onChange={(e) => handleRelChange(e, srcRef.current, tgtRef.current)}>
              <option value="">Select type</option>
              <option value="referred">Referred</option>
              <option value="knows">Knows</option>
              <option value="works-at">Works at</option>
              <option value="client-of">Client of</option>
              <option value="colleague">Colleague</option>
              <option value="adviser-to">Adviser to</option>
              <option value="family">Family</option>
              <option value="covers">JPM Covers</option>
              <option value="board">Board (Companies House)</option>
            </select>
          </div>
          <div className="modal-form-group">
            <label>Strength *</label>
            <select name="strength" required>
              <option value="">Select strength</option>
              <option value="1">1 – Distant</option>
              <option value="2">2 – Solid</option>
              <option value="3">3 – Close</option>
            </select>
          </div>
          {directionNote && <div className="connection-note" id="directionNote">{directionNote}</div>}
          <div className="modal-form-group">
            <label>Notes</label>
            <textarea name="connectionNotes" placeholder="Any notes about this relationship" />
          </div>
          <div className="modal-buttons">
            <button type="submit" className="btn btn-primary">Add connection</button>
            <button type="button" className="btn btn-secondary" id="cancelModalBtn" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Org Duplicate Modal ──
function OrgDuplicateModal({ active, onClose, onDone }: { active: boolean; onClose: () => void; onDone: () => void }) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pending = appState.pendingOrgNode;
    const existingId = (window as unknown as Record<string, unknown>)._orgDuplicateExistingId as string;
    if (!pending || !existingId) { onClose(); return; }
    appState.simulation.nodes.set(pending.id, pending);
    const edge: GraphEdge = {
      id: generateUUID(),
      sourceId: existingId,
      targetId: pending.id,
      relationshipType: (fd.get('orgDupRelType') as GraphEdge['relationshipType']) || 'knows',
      strength: parseInt(fd.get('orgDupStrength') as string) || 2,
      notes: '', bendOffset: 0, lastContact: '',
    };
    appState.simulation.edges.set(edge.id, edge);
    appState.pendingOrgNode = null;
    markDirty();
    gentleRestart();
    const finishAdd = (window as unknown as Record<string, unknown>)._finishAddNode as (() => void) | undefined;
    if (finishAdd) finishAdd();
    onDone();
    onClose();
  }

  function handleSkip() {
    const pending = appState.pendingOrgNode;
    if (pending) {
      appState.simulation.nodes.set(pending.id, pending);
      appState.pendingOrgNode = null;
      markDirty();
      gentleRestart();
      const finishAdd = (window as unknown as Record<string, unknown>)._finishAddNode as (() => void) | undefined;
      if (finishAdd) finishAdd();
    }
    onDone();
    onClose();
  }

  const msg = document.getElementById('orgDuplicateMsg')?.textContent || '';

  return (
    <div className={`modal-overlay${active ? ' active' : ''}`} id="orgDuplicateModal">
      <div className="modal-content">
        <div className="modal-title">Organisation already exists</div>
        <div className="modal-subtitle" id="orgDuplicateMsg">{msg}</div>
        <form id="orgDuplicateForm" onSubmit={handleSubmit}>
          <div className="modal-form-group">
            <label>What is the connection between them?</label>
            <select name="orgDupRelType" required>
              <option value="refers">Referred / Introduced</option>
              <option value="knows">Knows / Associated</option>
              <option value="colleague">Same group / Colleague</option>
              <option value="adviser-to">Adviser relationship</option>
              <option value="family">Family / related</option>
            </select>
          </div>
          <div className="modal-form-group">
            <label>Strength</label>
            <select name="orgDupStrength">
              <option value="1">1 – Distant</option>
              <option value="2" defaultValue="2">2 – Solid</option>
              <option value="3">3 – Close</option>
            </select>
          </div>
          <div className="modal-buttons">
            <button type="submit" className="btn btn-primary">Create connection</button>
            <button type="button" className="btn btn-secondary" id="orgDupSkipBtn" onClick={handleSkip}>Add anyway (no connection)</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── API Key Modal ──
function ApiKeyModal({ active, onClose }: { active: boolean; onClose: () => void }) {
  const existingAI  = localStorage.getItem('anthropicApiKey') || '';
  const existingCH  = localStorage.getItem('chApiKey') || '';
  const [aiStatus,  setAiStatus]  = useState(existingAI  ? 'Key saved.' : 'No key saved yet.');
  const [chStatus,  setChStatus]  = useState(existingCH  ? 'Key saved.' : 'No key saved yet.');

  function handleAiSave() {
    const val = (document.getElementById('apiKeyInput') as HTMLInputElement)?.value.trim();
    if (!val || val.startsWith('•')) { alert('Enter a valid Anthropic API key.'); return; }
    localStorage.setItem('anthropicApiKey', val);
    setAiStatus('Key saved.');
    const btn = document.getElementById('apiKeyBtn');
    if (btn) btn.classList.add('api-key-set');
  }

  function handleAiClear() {
    if (!confirm('Remove the Anthropic API key?')) return;
    localStorage.removeItem('anthropicApiKey');
    setAiStatus('No key saved yet.');
    const btn = document.getElementById('apiKeyBtn');
    if (btn) btn.classList.remove('api-key-set');
  }

  function handleChSave() {
    const val = (document.getElementById('chApiKeyInput') as HTMLInputElement)?.value.trim();
    if (!val || val.startsWith('•')) { alert('Enter a valid Companies House API key.'); return; }
    localStorage.setItem('chApiKey', val);
    setChStatus('✅ Key saved — click "Test Key" to verify it works.');
  }

  function handleChClear() {
    if (!confirm('Remove the Companies House API key?')) return;
    localStorage.removeItem('chApiKey');
    setChStatus('No key saved yet.');
  }

  async function handleChTest() {
    const stored = localStorage.getItem('chApiKey');
    if (!stored) { setChStatus('⚠ No key saved — save a key first.'); return; }
    setChStatus('⏳ Testing key against Companies House…');
    try {
      const res = await fetch(`/api/ch?chPath=${encodeURIComponent('/search/officers?q=smith&items_per_page=1')}`, {
        headers: { 'x-ch-key': stored },
      });
      if (res.ok) {
        const data = await res.json() as { total_results?: number };
        setChStatus(`✅ Key works! Companies House returned ${data.total_results ?? '?'} total results for a test search.`);
      } else if (res.status === 401) {
        setChStatus('❌ 401 — Key rejected. Make sure you copied a REST API key from "Manage REST API keys", not a Client ID from "My Applications".');
      } else {
        const text = await res.text().catch(() => '');
        setChStatus(`❌ Error ${res.status}: ${text || res.statusText}`);
      }
    } catch (err) {
      setChStatus(`❌ Network error: ${(err as Error).message}`);
    }
  }

  return (
    <div className={`modal-overlay${active ? ' active' : ''}`} id="apiKeyModal">
      <div className="modal-content" style={{ maxWidth: '480px' }}>
        <div className="modal-title">API Keys</div>

        {/* ── Anthropic section ── */}
        <div className="api-keys-section">
          <div className="api-keys-section-title">🤖 Anthropic AI Research</div>
          <div className="modal-subtitle" style={{ marginBottom: '8px' }}>
            Used to auto-populate firm details from JP Morgan "Firms Covered" data.
            Key is stored locally and only sent to <strong>api.anthropic.com</strong>.
          </div>
          <div className="modal-form-group">
            <label>API Key</label>
            <input type="password" id="apiKeyInput" placeholder="sk-ant-api03-…" autoComplete="off" defaultValue={existingAI ? '••••••••••••••••' : ''} />
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>{aiStatus}</div>
          <div className="modal-buttons" style={{ marginBottom: 0 }}>
            <button type="button" className="btn btn-primary" style={{ width: 'auto' }} onClick={handleAiSave}>Save</button>
            <button type="button" className="btn btn-secondary" style={{ width: 'auto' }} onClick={handleAiClear}>Clear</button>
          </div>
        </div>

        <div className="api-keys-divider" />

        {/* ── Companies House section ── */}
        <div className="api-keys-section">
          <div className="api-keys-section-title">🏛 Companies House</div>
          <div className="modal-subtitle" style={{ marginBottom: '8px' }}>
            Looks up board directorships for contacts. If two contacts share a board,
            a <strong>Board</strong> connection is created automatically.<br /><br />
            <strong>How to get a free key:</strong><br />
            1. Register at{' '}
            <a href="https://developer.company-information.service.gov.uk/" target="_blank" rel="noopener noreferrer">
              developer.company-information.service.gov.uk
            </a><br />
            2. Once logged in, click <strong>"Manage REST API keys"</strong> (top menu)<br />
            3. Click <strong>"Create a new key"</strong>, give it any name, copy the key<br />
            <span style={{ color: '#f87171' }}>
              ⚠ Do NOT use "My Applications" → that gives an OAuth Client ID which won't work here.
            </span>
          </div>
          <div className="modal-form-group">
            <label>REST API Key (UUID format)</label>
            <input type="password" id="chApiKeyInput" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autoComplete="off" defaultValue={existingCH ? '••••••••••••••••' : ''} />
          </div>
          <div style={{ fontSize: '12px', color: chStatus.startsWith('✅') ? '#4ade80' : chStatus.startsWith('❌') ? '#f87171' : '#888', marginBottom: '8px', lineHeight: '1.4' }}>{chStatus}</div>
          <div className="modal-buttons" style={{ marginBottom: 0 }}>
            <button type="button" className="btn btn-primary" style={{ width: 'auto' }} onClick={handleChSave}>Save</button>
            <button type="button" className="btn btn-secondary" style={{ width: 'auto' }} onClick={handleChTest}>Test Key</button>
            <button type="button" className="btn btn-secondary" style={{ width: 'auto' }} onClick={handleChClear}>Clear</button>
          </div>
        </div>

        <div style={{ marginTop: '16px', textAlign: 'right' }}>
          <button type="button" className="btn btn-secondary" style={{ width: 'auto' }} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Import Modal ──
function ImportModal({ active, onClose, onDone }: { active: boolean; onClose: () => void; onDone: () => void }) {
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFile(file: File | undefined | null) {
    if (!file) return;
    setPendingFile(file);
  }

  function handleImport() {
    if (!pendingFile) return;
    importFromXLSX(pendingFile, () => {
      onDone();
      onClose();
      setPendingFile(null);
    });
  }

  return (
    <div className={`modal-overlay${active ? ' active' : ''}`} id="importModal">
      <div className="modal-content" style={{ maxWidth: '480px' }}>
        <div className="modal-title">Import Contacts</div>

        <div className="import-step">
          <div className="import-step-label">Step 1 — Download the template</div>
          <div className="import-step-desc">The Excel template contains every available field with example rows and a full instructions sheet. Fill in the Contacts tab, then delete the example rows.</div>
          <button type="button" id="downloadTemplateBtn" className="btn btn-secondary" style={{ width: '100%', fontSize: '13px', padding: '10px', textAlign: 'center' }} onClick={downloadImportTemplate}>
            Download Excel Template (.xlsx)
          </button>
        </div>

        <div className="import-step">
          <div className="import-step-label">Step 2 — Upload your completed file</div>
          <div className="import-step-desc">Contacts whose Organisation field matches an existing org node will be linked automatically. Rows missing a Name or Type will be skipped.</div>
          <label
            className={`import-drop-area${dragOver ? ' drag-over' : ''}`}
            id="importDropArea"
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
          >
            <input
              type="file"
              id="importFileInput"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <div className="import-drop-icon">📂</div>
            <div>Click to choose your .xlsx file</div>
            <div className="import-drop-sub">or drag and drop here</div>
            {pendingFile && <div className="import-file-chosen" id="importFileChosen">{pendingFile.name}</div>}
          </label>
        </div>

        <div className="modal-buttons" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-primary" id="runImportBtn" style={{ width: 'auto' }} disabled={!pendingFile} onClick={handleImport}>Import</button>
          <button type="button" className="btn btn-secondary" id="cancelImportBtn" style={{ width: 'auto' }} onClick={() => { setPendingFile(null); onClose(); }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
