import { useState, useMemo } from 'react';
import { appState } from '../appState';
import { markDirty } from '../persistence';
import { generateUUID } from '../utils';
import { useStore } from '../store';
import type { GraphNode, NodeType } from '../types';

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const INDIVIDUAL_TYPES: NodeType[] = ['client', 'prospect', 'referrer', 'adviser', 'jpmorgan'];

function EditableCell({
  value,
  onSave,
  placeholder = '—',
  wide = false,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  wide?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <input
        className={`tbl-input${wide ? ' tbl-input-wide' : ''}`}
        value={draft}
        placeholder={placeholder}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { onSave(draft); setEditing(false); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
      />
    );
  }
  return (
    <span className="tbl-cell-text" onClick={() => { setDraft(value); setEditing(true); }}>
      {value || <span className="tbl-cell-empty">{placeholder}</span>}
    </span>
  );
}

function TypeBadge({ value, onSave }: { value: NodeType; onSave: (v: NodeType) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="tbl-type-wrap">
      <span className={`tbl-type-badge type-${value}`} onClick={() => setOpen(!open)}>
        {value} ▾
      </span>
      {open && (
        <div className="tbl-type-dropdown">
          {INDIVIDUAL_TYPES.map((t) => (
            <div
              key={t}
              className={`tbl-type-option type-${t}${t === value ? ' active' : ''}`}
              onClick={() => { onSave(t); setOpen(false); }}
            >
              {t}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DotPicker({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  return (
    <div className="tbl-dot-picker">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          className={i <= value ? 'on' : 'off'}
          onClick={() => onSave(i === value ? 0 : i)}
          title={String(i)}
        />
      ))}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TableView() {
  const { graphVersion, bumpGraph, setTableViewOpen } = useStore();
  const [activeTab, setActiveTab] = useState<'individuals' | 'firms'>('individuals');
  const [search, setSearch] = useState('');

  // Connection counts per node — recomputed when graph changes
  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const [, e] of appState.simulation.edges) {
      c.set(e.sourceId, (c.get(e.sourceId) || 0) + 1);
      c.set(e.targetId, (c.get(e.targetId) || 0) + 1);
    }
    return c;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphVersion]);

  const q = search.toLowerCase();

  const individuals = useMemo(() =>
    Array.from(appState.simulation.nodes.values())
      .filter((n) => n.type !== 'organisation')
      .filter((n) => !q || n.name.toLowerCase().includes(q) || n.organisation.toLowerCase().includes(q) || n.sector.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  , [graphVersion, search]);

  const firms = useMemo(() =>
    Array.from(appState.simulation.nodes.values())
      .filter((n) => n.type === 'organisation')
      .filter((n) => !q || n.name.toLowerCase().includes(q) || n.industry.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  , [graphVersion, search]);

  function update(id: string, patch: Partial<GraphNode>) {
    const node = appState.simulation.nodes.get(id);
    if (!node) return;
    Object.assign(node, patch);
    markDirty();
    bumpGraph();
  }

  function addIndividual() {
    const id = generateUUID();
    appState.simulation.nodes.set(id, {
      id, name: '', type: 'client', priority: 'medium',
      organisation: '', sector: '', estimatedAUM: '',
      engagementScore: 0, referralLikelihood: 0,
      notes: '', introducedBy: null,
      areaOfFocus: '', firmsCovered: '', jpmTitle: '', jpmEngagement: '',
      industry: '', website: '', keyContacts: '',
      x: (Math.random() - 0.5) * 300, y: (Math.random() - 0.5) * 300,
      vx: 0, vy: 0, fx: 0, fy: 0, fixed: false,
    });
    markDirty(); bumpGraph();
  }

  function addFirm() {
    const id = generateUUID();
    appState.simulation.nodes.set(id, {
      id, name: '', type: 'organisation', priority: 'medium',
      organisation: '', sector: '', estimatedAUM: '',
      engagementScore: 0, referralLikelihood: 0,
      notes: '', introducedBy: null,
      areaOfFocus: '', firmsCovered: '', jpmTitle: '', jpmEngagement: '',
      industry: '', website: '', keyContacts: '',
      x: (Math.random() - 0.5) * 300, y: (Math.random() - 0.5) * 300,
      vx: 0, vy: 0, fx: 0, fy: 0, fixed: false,
    });
    markDirty(); bumpGraph();
  }

  function deleteNode(id: string) {
    const node = appState.simulation.nodes.get(id);
    if (!node) return;
    if (!confirm(`Delete "${node.name || 'this contact'}"?`)) return;
    appState.simulation.nodes.delete(id);
    for (const [eid, e] of appState.simulation.edges) {
      if (e.sourceId === id || e.targetId === id) appState.simulation.edges.delete(eid);
    }
    markDirty(); bumpGraph();
  }

  const total = individuals.length + firms.length;

  return (
    <div className="tv-overlay">
      {/* ── Header ── */}
      <div className="tv-header">
        <div className="tv-title">
          <span className="tv-title-icon">⊞</span>
          Contacts Directory
          <span className="tv-total">{total} contact{total !== 1 ? 's' : ''}</span>
        </div>
        <div className="tv-header-right">
          <input
            className="tv-search"
            type="text"
            placeholder="🔍  Search name, organisation, sector…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="tv-close-btn" onClick={() => setTableViewOpen(false)}>
            ✕ Close
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="tv-body">
        {/* Left tabs */}
        <div className="tv-tabs">
          <button
            className={`tv-tab${activeTab === 'individuals' ? ' active' : ''}`}
            onClick={() => setActiveTab('individuals')}
          >
            <span className="tv-tab-icon">👤</span>
            <span className="tv-tab-label">Individuals</span>
            <span className="tv-tab-count">{individuals.length}</span>
          </button>
          <button
            className={`tv-tab${activeTab === 'firms' ? ' active' : ''}`}
            onClick={() => setActiveTab('firms')}
          >
            <span className="tv-tab-icon">🏢</span>
            <span className="tv-tab-label">Firms</span>
            <span className="tv-tab-count">{firms.length}</span>
          </button>
        </div>

        {/* Table area */}
        <div className="tv-table-wrap">
          {activeTab === 'individuals' ? (
            <>
              <table className="tv-table">
                <thead>
                  <tr>
                    <th className="col-name">Name</th>
                    <th className="col-type">Type</th>
                    <th>Organisation</th>
                    <th>Sector</th>
                    <th className="col-aum">Net Worth</th>
                    <th className="col-dots">Engagement</th>
                    <th className="col-dots">Ref. Likelihood</th>
                    <th>Introduced By</th>
                    <th className="col-notes">Notes</th>
                    <th className="col-cc">Links</th>
                    <th className="col-del"></th>
                  </tr>
                </thead>
                <tbody>
                  {individuals.map((n) => (
                    <tr key={n.id}>
                      <td className="col-name">
                        <EditableCell value={n.name} onSave={(v) => update(n.id, { name: v })} placeholder="Name" />
                      </td>
                      <td className="col-type">
                        <TypeBadge value={n.type as NodeType} onSave={(v) => update(n.id, { type: v })} />
                      </td>
                      <td>
                        <EditableCell value={n.organisation} onSave={(v) => update(n.id, { organisation: v })} placeholder="Organisation" />
                      </td>
                      <td>
                        <EditableCell value={n.sector} onSave={(v) => update(n.id, { sector: v })} placeholder="Sector" />
                      </td>
                      <td className="col-aum">
                        {(n.type === 'client' || n.type === 'prospect')
                          ? <EditableCell value={n.estimatedAUM} onSave={(v) => update(n.id, { estimatedAUM: v })} placeholder="e.g. £5m" />
                          : <span className="tbl-cell-empty">—</span>}
                      </td>
                      <td className="col-dots">
                        <DotPicker value={n.engagementScore} onSave={(v) => update(n.id, { engagementScore: v })} />
                      </td>
                      <td className="col-dots">
                        <DotPicker value={n.referralLikelihood} onSave={(v) => update(n.id, { referralLikelihood: v })} />
                      </td>
                      <td>
                        <EditableCell value={n.introducedBy || ''} onSave={(v) => update(n.id, { introducedBy: v || null })} placeholder="—" />
                      </td>
                      <td className="col-notes">
                        <EditableCell value={n.notes} onSave={(v) => update(n.id, { notes: v })} placeholder="Notes" wide />
                      </td>
                      <td className="col-cc">
                        <span className="tv-cc-badge">{counts.get(n.id) || 0}</span>
                      </td>
                      <td className="col-del">
                        <button className="tv-del-btn" onClick={() => deleteNode(n.id)} title="Delete">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {individuals.length === 0 && (
                <div className="tv-empty">No individuals found{search ? ' matching your search' : ''}.</div>
              )}
              <div className="tv-add-row">
                <button className="tv-add-btn" onClick={addIndividual}>+ Add Individual</button>
              </div>
            </>
          ) : (
            <>
              <table className="tv-table">
                <thead>
                  <tr>
                    <th className="col-name">Firm Name</th>
                    <th>Industry</th>
                    <th>Website</th>
                    <th className="col-notes">Key Contacts</th>
                    <th className="col-notes">Notes</th>
                    <th className="col-cc">Links</th>
                    <th className="col-del"></th>
                  </tr>
                </thead>
                <tbody>
                  {firms.map((n) => (
                    <tr key={n.id}>
                      <td className="col-name">
                        <EditableCell value={n.name} onSave={(v) => update(n.id, { name: v })} placeholder="Firm name" />
                      </td>
                      <td>
                        <EditableCell value={n.industry} onSave={(v) => update(n.id, { industry: v })} placeholder="Industry" />
                      </td>
                      <td>
                        <EditableCell value={n.website} onSave={(v) => update(n.id, { website: v })} placeholder="website.com" />
                      </td>
                      <td className="col-notes">
                        <EditableCell value={n.keyContacts} onSave={(v) => update(n.id, { keyContacts: v })} placeholder="Key contacts" wide />
                      </td>
                      <td className="col-notes">
                        <EditableCell value={n.notes} onSave={(v) => update(n.id, { notes: v })} placeholder="Notes" wide />
                      </td>
                      <td className="col-cc">
                        <span className="tv-cc-badge">{counts.get(n.id) || 0}</span>
                      </td>
                      <td className="col-del">
                        <button className="tv-del-btn" onClick={() => deleteNode(n.id)} title="Delete">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {firms.length === 0 && (
                <div className="tv-empty">No firms found{search ? ' matching your search' : ''}.</div>
              )}
              <div className="tv-add-row">
                <button className="tv-add-btn" onClick={addFirm}>+ Add Firm</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
