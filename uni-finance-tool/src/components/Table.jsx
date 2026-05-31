import { useState } from 'react';
import { Link } from 'react-router-dom';
import GradeBadge from './GradeBadge';
import ExpandedRow from './ExpandedRow';

function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/^university of /, '')
    .replace(/ university$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildColumns(rankLabel) {
  return [
    { key: 'name',          label: 'University',     sortable: true  },
    { key: 'tier',          label: 'Tier',           sortable: true  },
    { key: 'overallRank',   label: 'UK Rank',        sortable: true  },
    { key: 'subjectRank',   label: rankLabel,        sortable: true  },
    { key: 'entryGrades',   label: 'Entry Grades',   sortable: true  },
    { key: 'gradProspects', label: 'Grad Prospects', sortable: true  },
    { key: 'notes',         label: 'Highlights',     sortable: false },
  ];
}

function SortIcon({ direction }) {
  if (!direction) return <span className="ml-1 text-slate-600">↕</span>;
  return <span className="ml-1 text-blue-400">{direction === 'asc' ? '↑' : '↓'}</span>;
}

function rankVal(v) {
  if (v == null) return 9999;
  return typeof v === 'number' ? v : parseInt(v) || 9999;
}

function gradeOrder(g) {
  const order = ['AAA', 'AAB', 'ABB', 'BBB', 'BCC', 'CCC'];
  const idx = order.findIndex(o => g?.startsWith(o));
  return idx === -1 ? 99 : idx;
}

function compareValues(a, b, key, dir) {
  let va = a[key], vb = b[key];
  if (['subjectRank', 'overallRank'].includes(key)) {
    va = rankVal(va); vb = rankVal(vb);
  } else if (key === 'entryGrades') {
    va = gradeOrder(va); vb = gradeOrder(vb);
  } else if (key === 'gradProspects') {
    va = parseInt(va) || 0; vb = parseInt(vb) || 0;
  } else {
    va = String(va || '').toLowerCase(); vb = String(vb || '').toLowerCase();
  }
  if (va < vb) return dir === 'asc' ? -1 : 1;
  if (va > vb) return dir === 'asc' ? 1 : -1;
  return 0;
}

export default function Table({ universities, course }) {
  const [sortKey, setSortKey] = useState('subjectRank');
  const [sortDir, setSortDir] = useState('asc');
  const [expanded, setExpanded] = useState(null);

  const columns = buildColumns(course?.rankLabel || 'Subject Rank');

  function handleSort(key) {
    if (!columns.find(c => c.key === key)?.sortable) return;
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = [...universities].sort((a, b) => compareValues(a, b, sortKey, sortDir));

  function tierBadge(tier) {
    return tier === 'Red Brick'
      ? <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-900/60 border border-indigo-700/50 text-indigo-300 tracking-wide">Red Brick</span>
      : <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800/60 border border-slate-600/50 text-slate-300 tracking-wide">One Tier Below</span>;
  }

  function rankCell(val) {
    if (val == null) return <span className="text-slate-600">—</span>;
    return <span className="font-mono text-slate-300">#{val}</span>;
  }

  return (
    <div className="rounded-xl border border-blue-900/40 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#0a1f3a] border-b border-blue-900/50">
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-blue-300/80 whitespace-nowrap select-none ${col.sortable ? 'cursor-pointer hover:text-blue-200 transition-colors' : ''}`}
                >
                  {col.label}
                  {col.sortable && <SortIcon direction={sortKey === col.key ? sortDir : null} />}
                </th>
              ))}
              <th className="px-4 py-3 w-24 text-[11px] font-semibold uppercase tracking-wider text-blue-300/80 text-center">Details</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((uni, idx) => {
              const isExpanded = expanded === uni.name;
              const slug = toSlug(uni.name);
              return [
                <tr
                  key={uni.name}
                  onClick={() => setExpanded(isExpanded ? null : uni.name)}
                  className={`table-row-hover border-b border-blue-900/20 transition-colors ${idx % 2 === 0 ? 'bg-[#050e1f]' : 'bg-[#07152a]'} ${isExpanded ? 'bg-blue-950/30' : ''}`}
                >
                  <td className="px-4 py-3 font-medium text-slate-100 whitespace-nowrap">{uni.name}</td>
                  <td className="px-4 py-3">{tierBadge(uni.tier)}</td>
                  <td className="px-4 py-3 text-center">{rankCell(uni.overallRank)}</td>
                  <td className="px-4 py-3 text-center">{rankCell(uni.subjectRank)}</td>
                  <td className="px-4 py-3"><GradeBadge grade={uni.entryGrades} /></td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-blue-200">{uni.gradProspects}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs max-w-xs">{uni.notes}</td>
                  <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                    <Link
                      to={`/university/${slug}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-blue-600/15 border border-blue-600/30 text-blue-400 hover:bg-blue-600/25 hover:text-blue-300 transition-all whitespace-nowrap"
                    >
                      More info ↗
                    </Link>
                  </td>
                </tr>,
                isExpanded && (
                  <ExpandedRow key={`${uni.name}-expanded`} university={uni} course={course} colSpan={columns.length + 1} />
                ),
              ];
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-12 text-center text-slate-500">
                  No universities match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
