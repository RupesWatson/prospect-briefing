import './App.css';
import LeftSidebar from './components/LeftSidebar';
import Canvas from './components/Canvas';
import Toolbar from './components/Toolbar';
import RightSidebar from './components/RightSidebar';
import Modals from './components/Modals';
import TableView from './components/TableView';
import { useStore } from './store';

export default function App() {
  const { tableViewOpen, setTableViewOpen } = useStore();

  return (
    <div className="page-container">
      <LeftSidebar />
      <div className="center-panel">
        <Toolbar />
        <Canvas />
        {/* Table view trigger tab */}
        <button
          className="tv-trigger-tab"
          onClick={() => setTableViewOpen(true)}
          title="Open contacts directory"
        >
          ⊞ Contacts Directory
        </button>
      </div>
      <RightSidebar />
      <Modals />
      {tableViewOpen && <TableView />}
    </div>
  );
}
