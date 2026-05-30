export default function Filters({ search, setSearch, tier, setTier }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <div className="relative flex-1">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search universities…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-[#0a1f3a] border border-blue-900/50 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
        />
      </div>

      <div className="flex rounded-lg border border-blue-900/50 overflow-hidden">
        {['All', 'Red Brick', 'One Tier Below'].map(t => (
          <button
            key={t}
            onClick={() => setTier(t)}
            className={`px-4 py-2.5 text-xs font-semibold tracking-wide transition-colors ${
              tier === t
                ? 'bg-blue-600 text-white'
                : 'bg-[#0a1f3a] text-slate-400 hover:text-slate-200 hover:bg-blue-900/30'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
