import { useParams, Link } from 'react-router-dom';
import courseDetails from '../data/course-details.json';
import { COURSES } from '../data/courses';

function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-blue-900/40 bg-[#0a1f3a]/40 p-6 mb-5">
      <h2 className="font-display text-xl font-semibold text-white mb-4 pb-3 border-b border-blue-900/40">{title}</h2>
      {children}
    </div>
  );
}

function Pill({ text, color = 'blue' }) {
  const colors = {
    blue:   'bg-blue-900/40 border-blue-700/40 text-blue-300',
    indigo: 'bg-indigo-900/40 border-indigo-700/40 text-indigo-300',
    emerald:'bg-emerald-900/40 border-emerald-700/40 text-emerald-300',
    amber:  'bg-amber-900/40 border-amber-700/40 text-amber-300',
    purple: 'bg-purple-900/40 border-purple-700/40 text-purple-300',
  };
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${colors[color]}`}>{text}</span>
  );
}

const DEMAND_COLOR = { 'Very High': 'emerald', 'High': 'blue', 'Growing': 'indigo' };

export default function CoursePage() {
  const { courseId } = useParams();
  const course = courseDetails[courseId];
  const courseMeta = COURSES.find(c => c.id === courseId);

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#050e1f' }}>
        <div className="text-center">
          <div className="text-slate-400 mb-4">Course details not found.</div>
          <Link to="/" className="text-blue-400 hover:text-blue-300 underline">← Back to comparison</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #050e1f 0%, #061428 100%)' }}>
      <div className="max-w-screen-lg mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <Link to="/" className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors mb-6">
          <span>←</span> Back to comparison
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2 mb-3">
            <Pill text={course.duration} color="blue" />
            {courseMeta?.description && <Pill text={courseMeta.description} color="indigo" />}
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-3">{course.title}</h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">{course.overview}</p>
        </div>

        {/* What you'll study — year by year */}
        <Section title="What You'll Study">
          <div className="space-y-5">
            {course.yearByYear?.map(yr => (
              <div key={yr.year}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-sm font-bold text-blue-300">
                    {yr.year}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-100">Year {yr.year}</div>
                    <div className="text-xs text-blue-400/70">{yr.focus}</div>
                  </div>
                </div>
                <div className="ml-11 flex flex-wrap gap-2">
                  {yr.modules?.map(m => (
                    <span key={m} className="px-2.5 py-1 rounded text-xs bg-[#050e1f]/60 border border-blue-900/30 text-slate-300">{m}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {course.skills && (
            <div className="mt-6">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-blue-400/60 mb-2">Skills you'll develop</div>
              <div className="flex flex-wrap gap-2">
                {course.skills.map(s => <Pill key={s} text={s} color="indigo" />)}
              </div>
            </div>
          )}
        </Section>

        {/* Career Paths */}
        <Section title="Career Paths">
          <div className="space-y-3 mb-5">
            {course.careers?.map(c => (
              <div key={c.role} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 p-3 rounded-lg bg-[#050e1f]/60 border border-blue-900/30">
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-100">{c.role}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{c.salary}</div>
                </div>
                <Pill text={c.demand} color={DEMAND_COLOR[c.demand] || 'blue'} />
              </div>
            ))}
          </div>
          {course.furtherStudy && (
            <div className="p-3 rounded-lg bg-blue-900/20 border border-blue-800/40">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-blue-400/60 mb-1">Further study options</div>
              <div className="text-sm text-slate-300">{course.furtherStudy}</div>
            </div>
          )}
        </Section>

        {/* Top Employers */}
        <Section title="Who Recruits from This Degree">
          <p className="text-slate-300 text-sm leading-relaxed mb-5">{course.employerPerspective}</p>
          <div className="flex flex-wrap gap-2">
            {course.topEmployers?.map(e => <Pill key={e} text={e} color="emerald" />)}
          </div>
        </Section>

        {/* Professional Accreditations */}
        {course.professionalBodies?.length > 0 && (
          <Section title="Professional Accreditations & Exemptions">
            <div className="space-y-3">
              {course.professionalBodies.map(pb => (
                <div key={pb.name} className="flex items-start gap-4 p-3 rounded-lg bg-[#050e1f]/60 border border-blue-900/30">
                  <div className="flex-shrink-0">
                    <Pill text={pb.name} color="purple" />
                  </div>
                  <div className="text-sm text-slate-300">{pb.benefit}</div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Entry Requirements */}
        <Section title="Entry Requirements">
          <div className="p-4 rounded-lg bg-[#050e1f]/60 border border-blue-900/30 mb-4">
            <div className="text-[10px] uppercase tracking-widest font-semibold text-blue-400/60 mb-2">Typical A-level requirements</div>
            <div className="text-sm text-slate-200">{course.entryRequirements}</div>
          </div>
          {course.isItForYou && (
            <div>
              <div className="text-[10px] uppercase tracking-widest font-semibold text-blue-400/60 mb-3">Is this course right for you?</div>
              <ul className="space-y-2">
                {course.isItForYou.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className={`flex-shrink-0 mt-0.5 ${i === course.isItForYou.length - 1 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {i === course.isItForYou.length - 1 ? '⚠' : '✓'}
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        <div className="mt-6 text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
            ← Back to comparison table
          </Link>
        </div>

      </div>
    </div>
  );
}
