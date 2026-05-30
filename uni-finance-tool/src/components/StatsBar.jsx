const GRADE_ORDER = ['AAA', 'AAB', 'ABB', 'BBB', 'BCC', 'CCC'];

function avgGrade(universities) {
  if (!universities.length) return '—';
  const counts = {};
  universities.forEach(u => {
    const g = u.aLevelGrades?.replace(/[*]/g, '').trim() || '';
    counts[g] = (counts[g] || 0) + 1;
  });
  let best = null, bestCount = 0;
  for (const [g, c] of Object.entries(counts)) {
    if (c > bestCount) { best = g; bestCount = c; }
  }
  return best || '—';
}

function topAfRank(universities) {
  const ranked = universities.filter(u => u.afRank != null);
  if (!ranked.length) return '—';
  const top = ranked.reduce((a, b) => a.afRank < b.afRank ? a : b);
  return `${top.name.replace('University of ', '').replace(' University', '')} (#${top.afRank})`;
}

function topProspects(universities) {
  if (!universities.length) return '—';
  const top = universities.reduce((a, b) => {
    const pa = parseInt(a.gradProspects);
    const pb = parseInt(b.gradProspects);
    return pa > pb ? a : b;
  });
  return `${top.gradProspects} — ${top.name.replace('University of ', '').replace(' University', '')}`;
}

export default function StatsBar({ universities }) {
  const stats = [
    { label: 'Universities Shown', value: universities.length },
    { label: 'Most Common Entry', value: avgGrade(universities) },
    { label: 'Top A&F Rank', value: topAfRank(universities) },
    { label: 'Highest Grad Prospects', value: topProspects(universities) },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {stats.map(({ label, value }) => (
        <div key={label} className="rounded-xl border border-blue-900/50 bg-[#0a1f3a]/60 px-4 py-3 backdrop-blur-sm">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-blue-400/70 mb-1">{label}</div>
          <div className="text-sm font-semibold text-blue-100 leading-tight">{value}</div>
        </div>
      ))}
    </div>
  );
}
