import { useState, useMemo } from 'react';
import universities from './data/universities.json';
import StatsBar from './components/StatsBar';
import Filters from './components/Filters';
import Table from './components/Table';

export default function App() {
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState('All');

  const filtered = useMemo(() => {
    return universities.filter(u => {
      const matchSearch = u.name.toLowerCase().includes(search.toLowerCase());
      const matchTier = tier === 'All' || u.tier === tier;
      return matchSearch && matchTier;
    });
  }, [search, tier]);

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #050e1f 0%, #061428 100%)' }}>
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        <header className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-blue-800/40" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-blue-400/60">CUG 2026 Data</span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-blue-800/40" />
          </div>
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-white text-center leading-tight mb-3">
            UK University Finance &amp;{' '}
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #93c5fd, #2563eb)' }}>
              Business Comparison
            </span>
          </h1>
          <p className="text-center text-slate-400 text-sm max-w-xl mx-auto">
            Compare Accounting &amp; Finance and Business Management degree courses across Red Brick universities
            and the tier immediately below — ranked by the Complete University Guide 2026.
          </p>
        </header>

        <StatsBar universities={filtered} />
        <Filters search={search} setSearch={setSearch} tier={tier} setTier={setTier} />
        <Table universities={filtered} />

        <footer className="mt-10 text-center text-xs text-slate-600">
          Data sourced from the Complete University Guide 2026, Times Good University Guide 2026, and UCAS.
          Rankings and entry requirements are indicative — always check individual university pages.
        </footer>
      </div>
    </div>
  );
}
