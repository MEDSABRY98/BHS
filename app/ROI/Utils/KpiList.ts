// The ordered KPI boxes of one customer — used by the screen and by the PDF page.

import type { RoiResult, Tone } from './Types';

const money = (n: number) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = (n: number) => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const one = (n: number) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct = (n: number | null) => (n === null || !Number.isFinite(n) ? '-' : `${one(n)}%`);

export type KpiBox = { label: string; value: string; foot?: string; tone: Tone | 'ink' | 'gold' };

const fmtDay = (iso: string) => {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

export function KpiList(r: RoiResult): KpiBox[] {
  const rrTone: Tone = r.returnRate === null ? 'slate' : r.returnRate >= 25 ? 'red' : r.returnRate >= 10 ? 'amber' : 'green';
  const supTone: Tone = r.supportPctOfNet === null ? 'slate' : r.supportPctOfNet > 10 ? 'amber' : 'green';
  return [
    { label: 'Support (AED)', value: money(r.totalSupport), foot: r.monthsCount > 1 ? `${r.monthsCount} months • avg ${money(r.support.monthlySupport)} / mo` : '1 month', tone: 'gold' },
    { label: 'Gross Sales', value: money(r.gross), foot: `Avg / month ${money(r.avgGross)}`, tone: 'ink' },
    { label: 'Returns / Credit Notes', value: money(r.returns), foot: `Avg / month ${money(r.avgReturns)}`, tone: 'slate' },
    { label: 'Return Rate', value: pct(r.returnRate), foot: 'Returns / gross sales', tone: rrTone },
    { label: 'Net Sales', value: money(r.net), foot: 'Gross - returns', tone: 'ink' },
    { label: 'Avg Monthly Net Sales', value: money(r.avgNet), foot: 'Last 3 full months', tone: 'ink' },
    { label: 'Sales Invoices', value: whole(r.invoices), foot: `Avg ${one(r.avgInvoicesPerMonth)} / month`, tone: 'slate' },
    { label: 'Avg Invoice Value', value: money(r.avgInvoice), foot: 'Gross / invoices', tone: 'slate' },
    { label: 'Avg Items / Invoice', value: one(r.avgItems), foot: 'Distinct products', tone: 'slate' },
    { label: 'Support % of Avg Net', value: pct(r.supportPctOfNet), foot: 'Monthly support / avg net', tone: supTone },
    { label: 'Net Sales per 1 Support', value: r.netPerSupport === null ? '-' : one(r.netPerSupport), foot: 'Not ROI', tone: 'slate' },
    { label: 'Last Transaction', value: fmtDay(r.lastTransaction), foot: 'Last positive invoice', tone: 'slate' },
    { label: 'Assessment', value: r.assessment.label, foot: 'Screening flag', tone: r.assessment.tone },
  ];
}
