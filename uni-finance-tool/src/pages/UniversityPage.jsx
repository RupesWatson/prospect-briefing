import { useParams, Link } from 'react-router-dom';
import universityDetails from '../data/university-details.json';

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
  };
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${colors[color]}`}>{text}</span>
  );
}

function InfoGrid({ items }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {items.map(({ label, value }) => (
        <div key={label} className="space-y-1">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-blue-400/60">{label}</div>
          <div className="text-sm text-slate-200">{value}</div>
        </div>
      ))}
    </div>
  );
}

export default function UniversityPage() {
  const { slug } = useParams();
  const uni = universityDetails[slug];

  if (!uni) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#050e1f' }}>
        <div className="text-center">
          <div className="text-slate-400 mb-4">University not found.</div>
          <Link to="/" className="text-blue-400 hover:text-blue-300 underline">← Back to comparison</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #050e1f 0%, #061428 100%)' }}>
      <div className="max-w-screen-lg mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Nav */}
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors mb-6">
          <span>←</span> Back to comparison
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-start gap-3 mb-3">
            <span className={`px-2.5 py-1 rounded text-[11px] font-semibold tracking-wide border ${
              uni.campusType?.includes('City') ? 'bg-indigo-900/60 border-indigo-700/50 text-indigo-300' : 'bg-slate-800/60 border-slate-600/50 text-slate-300'
            }`}>{uni.campusType}</span>
            <span className="px-2.5 py-1 rounded text-[11px] font-semibold tracking-wide border bg-blue-900/40 border-blue-700/40 text-blue-300">Est. {uni.founded}</span>
            <span className="px-2.5 py-1 rounded text-[11px] font-semibold tracking-wide border bg-emerald-900/40 border-emerald-700/40 text-emerald-300">{uni.totalStudents?.toLocaleString()} students</span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-2">{uni.name}</h1>
          <p className="text-blue-300/70 text-sm font-medium mb-3">{uni.city}</p>
          <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">{uni.overview}</p>

          {uni.keyFacts && (
            <div className="flex flex-wrap gap-2 mt-4">
              {uni.keyFacts.map((f, i) => <Pill key={i} text={f} color={['blue','indigo','emerald'][i % 3]} />)}
            </div>
          )}
        </div>

        {/* City Life */}
        <Section title={`Living in ${uni.city}`}>
          <p className="text-slate-300 text-sm leading-relaxed mb-5">{uni.cityLife?.description}</p>
          <InfoGrid items={[
            { label: 'Average private rent', value: uni.cityLife?.avgRentPerMonth + ' per month' },
            { label: 'Cost of living', value: uni.cityLife?.costOfLiving },
            { label: 'Transport', value: uni.cityLife?.transport },
            { label: 'Nightlife', value: uni.cityLife?.nightlife },
          ]} />
          {uni.cityLife?.highlights && (
            <div className="mt-5">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-blue-400/60 mb-2">City highlights</div>
              <ul className="space-y-1">
                {uni.cityLife.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="text-blue-500 mt-0.5 flex-shrink-0">▸</span>{h}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        {/* Accommodation */}
        <Section title="Accommodation">
          <div className="flex flex-wrap gap-2 mb-4">
            <Pill text={uni.accommodation?.firstYearGuarantee ? '✓ First-year guarantee' : 'No first-year guarantee'} color={uni.accommodation?.firstYearGuarantee ? 'emerald' : 'amber'} />
            <Pill text={`University halls: ~${uni.accommodation?.avgWeeklyCost}/week`} color="blue" />
          </div>
          <p className="text-slate-300 text-sm leading-relaxed mb-5">{uni.accommodation?.description}</p>
          <InfoGrid items={[
            { label: 'Average hall cost', value: uni.accommodation?.avgWeeklyCost + '/week' },
            { label: 'Popular private rent areas', value: uni.accommodation?.privateRentAreas },
          ]} />
          {uni.accommodation?.halls && (
            <div className="mt-5">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-blue-400/60 mb-2">University halls of residence</div>
              <div className="flex flex-wrap gap-2">
                {uni.accommodation.halls.map(h => <Pill key={h} text={h} color="indigo" />)}
              </div>
            </div>
          )}
        </Section>

        {/* Open Days */}
        <Section title="Open Days 2025">
          {uni.openDays?.length ? (
            <div className="space-y-3">
              {uni.openDays.map((day, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-[#050e1f]/60 border border-blue-900/30">
                  <div className="text-blue-400 text-xl">📅</div>
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{day.date}</div>
                    <div className="text-xs text-slate-400">{day.type}</div>
                  </div>
                </div>
              ))}
              <p className="text-xs text-slate-600 mt-2">Dates are indicative — always confirm on the university's official website.</p>
            </div>
          ) : (
            <p className="text-slate-400 text-sm">Check the university website for open day dates.</p>
          )}
        </Section>

        {/* How to Apply */}
        <Section title="How to Apply">
          <InfoGrid items={[
            { label: 'UCAS code (A&F)', value: uni.application?.ucasCode },
            { label: 'Contextual offers', value: uni.application?.contextualOffers ? 'Yes — reduced offers for eligible students' : 'Standard offers only' },
            { label: 'Interview required', value: uni.application?.interviewRequired ? 'Yes — see course page' : 'No interview for most finance courses' },
            { label: 'Typical timeline', value: uni.application?.typicalTimeline },
          ]} />
          {uni.application?.personalStatementTips && (
            <div className="mt-5">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-blue-400/60 mb-2">Personal statement tips</div>
              <ul className="space-y-2">
                {uni.application.personalStatementTips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="text-blue-500 flex-shrink-0 mt-0.5">{i + 1}.</span>{tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        {/* Student Life */}
        <Section title="Student Life">
          <p className="text-slate-300 text-sm leading-relaxed mb-4">{uni.studentLife?.union}</p>
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Societies', value: uni.studentLife?.societiesCount },
              { label: 'Sports teams', value: uni.studentLife?.sportsTeams },
              { label: 'International students', value: uni.internationalStudents },
            ].map(({ label, value }) => (
              <div key={label} className="text-center p-3 rounded-lg bg-[#050e1f]/60 border border-blue-900/30">
                <div className="text-lg font-bold text-blue-300">{value}</div>
                <div className="text-[10px] uppercase tracking-wide text-slate-500 mt-1">{label}</div>
              </div>
            ))}
          </div>
          {uni.studentLife?.highlights && (
            <ul className="space-y-1">
              {uni.studentLife.highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="text-blue-500 mt-0.5 flex-shrink-0">▸</span>{h}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Notable Alumni */}
        {uni.notableAlumni?.length > 0 && (
          <Section title="Notable Alumni">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {uni.notableAlumni.map((a, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[#050e1f]/60 border border-blue-900/30">
                  <span className="text-blue-400 text-sm mt-0.5">★</span>
                  <span className="text-sm text-slate-300">{a}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        <div className="mt-6 text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
            ← Back to comparison table
          </Link>
        </div>

      </div>
    </div>
  );
}
