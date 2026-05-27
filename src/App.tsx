import './App.css';
import LeftSidebar from './components/LeftSidebar';
import Canvas from './components/Canvas';
import Canvas3D from './components/Canvas3D';
import Toolbar from './components/Toolbar';
import RightSidebar from './components/RightSidebar';
import Modals from './components/Modals';
import TableView from './components/TableView';
import { useStore } from './store';

export default function App() {
  const { tableViewOpen, setTableViewOpen, view3D } = useStore();

  return (
    <div className={`page-container${view3D ? ' view-3d' : ''}`}>
      <LeftSidebar />
      <div className="center-panel">
        <Toolbar />
        {view3D ? <Canvas3D /> : <Canvas />}
        {/* Table view trigger tab — only in 2D */}
        {!view3D && (
          <button
            className="tv-trigger-tab"
            onClick={() => setTableViewOpen(true)}
            title="Open contacts directory"
          >
            ⊞ Contacts Directory
          </button>
        )}
      </div>
      <RightSidebar />
      <Modals />
      {tableViewOpen && <TableView />}
    </div>
  );
}
