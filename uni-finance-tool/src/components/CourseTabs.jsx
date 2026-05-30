import { COURSES } from '../data/courses';

export default function CourseTabs({ selectedId, onChange }) {
  return (
    <div className="mb-6">
      <div className="text-[10px] uppercase tracking-widest font-semibold text-blue-400/50 mb-2 px-1">Select Course</div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {COURSES.map(course => {
          const isActive = course.id === selectedId;
          return (
            <button
              key={course.id}
              onClick={() => onChange(course.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide border transition-all duration-150 ${
                isActive
                  ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/40'
                  : 'bg-[#0a1f3a]/70 border-blue-900/50 text-slate-400 hover:text-slate-200 hover:border-blue-700/60'
              }`}
            >
              {course.label}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 px-1 text-[10px] text-slate-600">
        {COURSES.find(c => c.id === selectedId)?.description}
      </div>
    </div>
  );
}
