import type { ReportLine } from './ReportTypes';

const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];

function monthKey(label: unknown): string | null {
  const m = String(label ?? '').trim().toLowerCase().match(/^([a-z]+)\s+(\d{4})$/);
  if (!m) return null;
  const i = MONTHS.indexOf(m[1]);
  return i < 0 ? null : `${m[2]}-${String(i + 1).padStart(2, '0')}`;
}

export interface ParseResult { lines: ReportLine[]; months: string[]; analytics: string[]; warnings: string[] }

/**
 * Parses an Odoo pivot export (Analytic Items grouped by analytic account → GL account, months as columns).
 * `rows` = sheet as array of arrays (first column = label, indent by leading spaces: 5 = analytic account, 10 = GL line).
 */
export function parseOdooPivot(rows: unknown[][]): ParseResult {
  const warnings: string[] = [];
  let hdr = -1;
  let cols: { idx: number; month: string }[] = [];
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const c = (rows[r] || []).map((v, idx) => ({ idx, month: monthKey(v) })).filter((x): x is { idx: number; month: string } => !!x.month);
    if (c.length) { hdr = r; cols = c; break; }
  }
  if (hdr < 0) throw new Error('Could not find the month columns (expected headers like "September 2026").');

  const lines: ReportLine[] = [];
  const analytics: string[] = [];
  let current: string | null = null;
  for (let r = hdr + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const raw = String(row[0] ?? '');
    const label = raw.trim();
    if (!label) continue;
    const indent = raw.length - raw.trimStart().length;
    if (/^total$/i.test(label)) continue;
    if (indent < 8) { current = label; if (!analytics.includes(label)) analytics.push(label); continue; }
    const m = label.match(/^(\d{4,})\s+(.*)$/);
    if (!m || !current) { warnings.push(`Row ${r + 1}: unrecognised line "${label}"`); continue; }
    for (const c of cols) {
      const v = Number(row[c.idx]);
      if (Number.isFinite(v) && Math.abs(v) > 0.004) lines.push({ analytic: current, code: m[1], glName: m[2], month: c.month, amount: v });
    }
  }
  if (!lines.length) throw new Error('No GL lines found in the file.');
  return { lines, months: cols.map((c) => c.month), analytics, warnings };
}
