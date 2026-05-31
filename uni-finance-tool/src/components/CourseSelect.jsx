import { Link } from 'react-router-dom';
import { COURSES } from '../data/courses';

const GROUPS = [
  {
    label: 'Core Finance',
    ids: ['af', 'econFin', 'finMath', 'banking', 'actuarial'],
  },
  {
    label: 'Finance & Technology',
    ids: ['fintech', 'appliedAI', 'dataScience', 'techManagement'],
  },
  {
    label: 'Specialist & Emerging',
    ids: ['investmentBanking', 'ventureCapital', 'intlFinance', 'esgFinance', 'financeLaw', 'behaviouralFinance', 'finInn'],
  },
];

export default function CourseSelect({ selectedId, onChange }) {
  const selected = COURSES.find(c => c.id === selectedId) || COURSES[0];

  return (
    <div className="mb-6">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <label className="block text-[10px] uppercase tracking-widest font-semibold text-blue-400/60 mb-1.5">
            Select Subject Area
          </label>
          <div className="relative">
            <select
              value={selectedId}
              onChange={e => onChange(e.target.value)}
              className="w-full appearance-none pl-4 pr-10 py-3 rounded-lg bg-[#0a1f3a] border border-blue-900/50 text-sm text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors cursor-pointer"
            >
              {GROUPS.map(group => (
                <optgroup key={group.label} label={group.label} className="bg-[#0a1f3a]">
                  {group.ids.map(id => {
                    const course = COURSES.find(c => c.id === id);
                    return course ? (
                      <option key={id} value={id} className="bg-[#0a1f3a] text-slate-100">
                        {course.label}
                      </option>
                    ) : null;
                  })}
                </optgroup>
              ))}
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-blue-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          {selected.description && (
            <div className="mt-1.5 text-[11px] text-slate-600">{selected.description}</div>
          )}
        </div>

        <Link
          to={`/course/${selectedId}`}
          className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-blue-600/20 border border-blue-500/40 text-sm font-semibold text-blue-300 hover:bg-blue-600/30 hover:text-blue-200 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Course details
        </Link>
      </div>
    </div>
  );
}
