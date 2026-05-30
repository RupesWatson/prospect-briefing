import afRawData from './universities.json';
import econFinData from './economics-finance.json';
import fintechData from './fintech.json';
import finMathData from './financial-maths.json';
import bankingData from './banking-finance.json';
import finInnData from './finance-innovation.json';

const afData = afRawData.map(u => ({
  ...u,
  subjectRank: u.afRank,
  entryGrades: u.aLevelGrades,
}));

export const COURSES = [
  {
    id: 'af',
    label: 'Accounting & Finance',
    shortLabel: 'A&F',
    rankLabel: 'A&F Rank',
    description: 'CUG 2026 subject rankings',
    data: afData,
  },
  {
    id: 'econFin',
    label: 'Economics & Finance',
    shortLabel: 'Econ & Fin',
    rankLabel: 'Subject Rank',
    description: 'Indicative CUG 2026',
    data: econFinData,
  },
  {
    id: 'fintech',
    label: 'Finance & FinTech',
    shortLabel: 'FinTech',
    rankLabel: 'FinTech Rank',
    description: 'Indicative 2026',
    data: fintechData,
  },
  {
    id: 'finMath',
    label: 'Financial Mathematics',
    shortLabel: 'Fin Maths',
    rankLabel: 'Subject Rank',
    description: 'Indicative 2026',
    data: finMathData,
  },
  {
    id: 'banking',
    label: 'Banking & Finance',
    shortLabel: 'Banking',
    rankLabel: 'Subject Rank',
    description: 'Indicative 2026',
    data: bankingData,
  },
  {
    id: 'finInn',
    label: 'Finance & Innovation',
    shortLabel: 'Fin & Innovation',
    rankLabel: 'Subject Rank',
    description: 'Indicative 2026',
    data: finInnData,
  },
];
