import GradeBadge from './GradeBadge';

export default function ExpandedRow({ university, course, colSpan }) {
  const rankLabel = course?.rankLabel || 'Subject Rank';
  const entryGrades = university.entryGrades || university.aLevelGrades;

  const fields = [
    { label: 'Typical Offer', value: university.typicalOffer },
    {
      label: rankLabel,
      value: university.subjectRank != null
        ? `#${university.subjectRank} nationally (indicative 2026)`
        : 'Not ranked / programme not offered',
    },
    ...(university.bmRank != null ? [{
      label: 'BMS Subject Rank',
      value: `#${university.bmRank} nationally (CUG 2026)`,
    }] : []),
    { label: 'Graduate Prospects', value: `${university.gradProspects} in graduate-level employment` },
    { label: 'Key Highlights', value: university.notes },
  ];

  return (
    <tr className="bg-[#061428]">
      <td colSpan={colSpan} className="px-6 py-0">
        <div className="expand-open py-5 border-t border-blue-900/30">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fields.map(({ label, value }) => (
              <div key={label} className="space-y-1">
                <div className="text-[10px] uppercase tracking-widest font-semibold text-blue-400/60">{label}</div>
                <div className="text-sm text-slate-200">{value}</div>
              </div>
            ))}
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-blue-400/60">Entry Grade</div>
              <GradeBadge grade={entryGrades} />
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}
