import { useState, useMemo } from 'react';
import { COURSES } from '../data/courses';
import StatsBar from '../components/StatsBar';
import Filters from '../components/Filters';
import CourseSelect from '../components/CourseSelect';
import Table from '../components/Table';

export default function Home() {
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState('All');
  const [courseId, setCourseId] = useState(COURSES[0].id);

  const course = COURSES.find(c => c.id === courseId) || COURSES[0];

  const filtered = useMemo(() => {
    return course.data.filter(u => {
      const matchSearch = u.name.toLowerCase().includes(search.toLowerCase());
      const matchTier = tier === 'All' || u.tier === tier;
      return matchSearch && matchTier;
    });
  }, [course, search, tier]);

  function handleCourseChange(id) {
    setCourseId(id);
    setSearch('');
    setTier('All');
  }

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
            Compare 16 finance and business degree courses across 23 leading UK universities.
            Select a subject, filter by tier, and click any row for full details.
          </p>
        </header>

        <CourseSelect selectedId={courseId} onChange={handleCourseChange} />
        <StatsBar universities={filtered} course={course} />
        <Filters search={search} setSearch={setSearch} tier={tier} setTier={setTier} />
        <Table universities={filtered} course={course} />

        <footer className="mt-10 text-center text-xs text-slate-600">
          Accounting &amp; Finance ranks from the Complete University Guide 2026. All other course ranks are indicative.
          Always verify entry requirements on individual university pages.
        </footer>
      </div>
    </div>
  );
}
