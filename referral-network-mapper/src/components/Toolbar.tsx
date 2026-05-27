import { useStore } from '../store';
import { appState } from '../appState';
import { applyLayout } from '../simulation';
import type { FilterType } from '../types';

export default function Toolbar() {
  const { graphVersion, setModal, view3D, setView3D } = useStore();

  // Keep labels button state in sync
  const labelsOn = appState.showEdgeLabels;

  const filters: { label: string; value: FilterType }[] = [
    { label: 'All', value: 'all' },
    { label: 'Clients', value: 'client' },
    { label: 'Prospects', value: 'prospect' },
    { label: 'Referrers', value: 'referrer' },
    { label: 'Advisers', value: 'adviser' },
    { label: 'JPM', value: 'jpmorgan' },
    { label: 'Orgs', value: 'organisation' },
  ];

  // suppress unused warning
  void graphVersion;

  return (
    <div className="canvas-toolbar">
      <div className="filter-pills" id="filterPills">
        {filters.map((f) => (
          <button
            key={f.value}
            className={`filter-pill${appState.filter === f.value ? ' active' : ''}`}
            data-filter={f.value}
            onClick={() => {
              appState.filter = f.value;
              useStore.getState().bumpGraph();
            }}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="toolbar-right">
        <select
          className="toolbar-select"
          id="layoutSelect"
          defaultValue="free"
          onChange={(e) => applyLayout(e.target.value)}
        >
          <option value="free">🔀 Free (organic)</option>
          <option value="hub-spoke">⬤ Hub &amp; Spoke</option>
          <option value="priority-rings">🎯 Priority Rings</option>
          <option value="referral-tree">🌳 Referral Tree</option>
          <option value="pipeline">📊 Engagement Pipeline</option>
          <option value="sector-map">🗂 Sector Map</option>
        </select>
        <button
          className={`toolbar-button${labelsOn ? ' labels-on' : ''}`}
          id="edgeLabelsBtn"
          title={labelsOn ? 'Hide relationship labels' : 'Show relationship labels'}
          onClick={() => {
            appState.showEdgeLabels = !appState.showEdgeLabels;
            useStore.getState().bumpGraph();
          }}
        >
          Labels
        </button>
        <button
          className={`toolbar-button${localStorage.getItem('anthropicApiKey') ? ' api-key-set' : ''}`}
          id="apiKeyBtn"
          title={localStorage.getItem('anthropicApiKey') ? 'API key set — click to update' : 'Set Anthropic API key for firm research'}
          onClick={() => setModal('apikey')}
        >
          ⚙ API Key
        </button>
        <button
          className="toolbar-button"
          id="importContactsBtn"
          onClick={() => setModal('import')}
        >
          ⬆ Import contacts
        </button>
        <button
          className={`toolbar-button${appState.linkMode ? ' link-active' : ''}`}
          id="linkNodesBtn"
          onClick={() => {
            const setLinkMode = (window as unknown as Record<string, unknown>)._setLinkMode as ((v: boolean) => void) | undefined;
            if (setLinkMode) setLinkMode(!appState.linkMode);
          }}
        >
          🔗 Link nodes
        </button>
        <button
          className="toolbar-button"
          id="addConnectionBtn"
          onClick={() => {
            const pop = (window as unknown as Record<string, unknown>)._populateConnectionModal as (() => void) | undefined;
            if (pop) pop();
            setModal('connection');
          }}
        >
          + Add connection
        </button>
        {!view3D && (
          <button className="toolbar-button" id="fitToScreenBtn">
            Fit to screen
          </button>
        )}
        <button
          className={`toolbar-button btn-3d-toggle${view3D ? ' active-3d' : ''}`}
          title={view3D ? 'Switch to 2D map' : 'Switch to 3D solar system view'}
          onClick={() => setView3D(!view3D)}
        >
          {view3D ? '🗺 2D Map' : '🌐 3D View'}
        </button>
      </div>
    </div>
  );
}
