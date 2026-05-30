const GRADE_CONFIG = {
  'AAA*': { bg: 'bg-emerald-950', border: 'border-emerald-400', text: 'text-emerald-300' },
  'AAA':  { bg: 'bg-emerald-950', border: 'border-emerald-400', text: 'text-emerald-300' },
  'AAB':  { bg: 'bg-blue-950',    border: 'border-blue-400',    text: 'text-blue-300'    },
  'ABB':  { bg: 'bg-amber-950',   border: 'border-amber-400',   text: 'text-amber-300'   },
  'BBB':  { bg: 'bg-red-950',     border: 'border-red-400',     text: 'text-red-300'     },
  'BCC':  { bg: 'bg-red-950',     border: 'border-red-500',     text: 'text-red-300'     },
};

function getGradeConfig(grade) {
  if (!grade) return { bg: 'bg-slate-800', border: 'border-slate-600', text: 'text-slate-400' };
  const clean = grade.replace(/\*/g, '').trim().toUpperCase();
  for (const [key, config] of Object.entries(GRADE_CONFIG)) {
    if (clean.startsWith(key.replace(/\*/g, ''))) return config;
  }
  return { bg: 'bg-slate-800', border: 'border-slate-600', text: 'text-slate-400' };
}

export default function GradeBadge({ grade }) {
  const config = getGradeConfig(grade);
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide border ${config.bg} ${config.border} ${config.text}`}>
      {grade}
    </span>
  );
}
