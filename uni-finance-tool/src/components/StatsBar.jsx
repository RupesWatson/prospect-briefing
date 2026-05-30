function avgGrade(universities) {
  if (!universities.length) return '—';
  const counts = {};
  universities.forEach(u => {
    const g = (u.entryGrades || u.aLevelGrades || '').replace(/[*]/g, '').split(' ')[0].trim();
    if (g) counts[g] = (counts[g] || 0) + 1;
  });
  let best = null, bestCount = 0;
  for (const [g, c] of Object.entries(counts)) {
    if (c > bestCount) { best = g; bestCount = c; }
  }
  return best || '—';
}

function topRank(universities) {
  const ranked = universities.filter(u => u.subjectRank != null);
  if (!ranked.length) return '—';
  const top = ranked.reduce((a, b) => a.subjectRank < b.subjectRank ? a : b);
  return `${top.name.replace('University of ', '').replace(' University', '')} (#${top.subjectRank})`;
}

function topProspects(universities) {
  if (!universities.length) return '—';
  const top = universities.reduce((a, b) => {
    return (parseInt(a.gradProspects) > parseInt(b.gradProspects)) ? a : b;
  });
  return `${top.gradProspects} — ${top.name.replace('University of ', '').replace(' University', '')}`;
}

export default function StatsBar({ universities, course }) {
  const rankLabel = course?.rankLabel || 'Subject Rank';
  const stats = [
    { label: 'Universities Shown', value: universities.length },
    { label: 'Most Common Entry', value: avgGrade(universities) },
    { label: `Top ${rankLabel}`, value: topRank(universities) },
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
