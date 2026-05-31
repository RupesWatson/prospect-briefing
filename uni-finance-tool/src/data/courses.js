import afRawData from './universities.json';
import econFinData from './economics-finance.json';
import fintechData from './fintech.json';
import finMathData from './financial-maths.json';
import bankingData from './banking-finance.json';
import finInnData from './finance-innovation.json';
import investmentBankingData from './investment-banking.json';
import appliedAIData from './applied-ai.json';
import dataScienceData from './data-science.json';
import esgFinanceData from './esg-finance.json';
import financeLawData from './finance-law.json';
import intlFinanceData from './international-finance.json';
import actuarialData from './actuarial.json';
import ventureCapitalData from './venture-capital.json';
import techManagementData from './tech-management.json';
import behaviouralFinanceData from './behavioural-finance.json';

const afData = afRawData.map(u => ({
  ...u,
  subjectRank: u.afRank,
  entryGrades: u.aLevelGrades,
}));

export const COURSES = [
  // ── Core Finance ──
  {
    id: 'af',
    label: 'Accounting & Finance',
    rankLabel: 'A&F Rank',
    description: 'CUG 2026 subject rankings',
    data: afData,
  },
  {
    id: 'econFin',
    label: 'Economics & Finance',
    rankLabel: 'Subject Rank',
    description: 'Indicative 2026',
    data: econFinData,
  },
  {
    id: 'finMath',
    label: 'Financial Mathematics',
    rankLabel: 'Subject Rank',
    description: 'Indicative 2026 — maths A-level required',
    data: finMathData,
  },
  {
    id: 'banking',
    label: 'Banking & Finance',
    rankLabel: 'Subject Rank',
    description: 'Indicative 2026',
    data: bankingData,
  },
  {
    id: 'actuarial',
    label: 'Actuarial Science',
    rankLabel: 'Subject Rank',
    description: 'Indicative 2026 — maths A-level required',
    data: actuarialData,
  },
  // ── Finance & Technology ──
  {
    id: 'fintech',
    label: 'Finance & FinTech',
    rankLabel: 'FinTech Rank',
    description: 'Indicative 2026',
    data: fintechData,
  },
  {
    id: 'appliedAI',
    label: 'Finance & Applied AI',
    rankLabel: 'Subject Rank',
    description: 'Indicative 2026',
    data: appliedAIData,
  },
  {
    id: 'dataScience',
    label: 'Finance & Data Science',
    rankLabel: 'Subject Rank',
    description: 'Indicative 2026',
    data: dataScienceData,
  },
  {
    id: 'techManagement',
    label: 'Finance & Technology Management',
    rankLabel: 'Subject Rank',
    description: 'Indicative 2026',
    data: techManagementData,
  },
  // ── Specialist & Emerging ──
  {
    id: 'investmentBanking',
    label: 'Finance & Investment Banking',
    rankLabel: 'Subject Rank',
    description: 'Indicative 2026',
    data: investmentBankingData,
  },
  {
    id: 'ventureCapital',
    label: 'Venture Capital & Private Equity',
    rankLabel: 'Subject Rank',
    description: 'Indicative 2026',
    data: ventureCapitalData,
  },
  {
    id: 'intlFinance',
    label: 'International Finance',
    rankLabel: 'Subject Rank',
    description: 'Indicative 2026',
    data: intlFinanceData,
  },
  {
    id: 'esgFinance',
    label: 'ESG & Sustainable Finance',
    rankLabel: 'Subject Rank',
    description: 'Indicative 2026',
    data: esgFinanceData,
  },
  {
    id: 'financeLaw',
    label: 'Finance & Law',
    rankLabel: 'Subject Rank',
    description: 'Indicative 2026',
    data: financeLawData,
  },
  {
    id: 'behaviouralFinance',
    label: 'Behavioural Finance',
    rankLabel: 'Subject Rank',
    description: 'Indicative 2026',
    data: behaviouralFinanceData,
  },
  {
    id: 'finInn',
    label: 'Finance & Innovation',
    rankLabel: 'Subject Rank',
    description: 'Indicative 2026',
    data: finInnData,
  },
];
