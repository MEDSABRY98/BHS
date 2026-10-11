'use client';

// Small UI pieces shared by the Sales / Debit / Collections sections.

import React, { useEffect, useState } from 'react';

export const Money = (n: number) =>
  (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const Whole = (n: number) => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
export const ShortMoney = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return Whole(n);
};
export const FmtDay = (iso: string) => {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

export const GOLD = '#D4AF37';
export const GOLD_DARK = '#B8860B';
export const SLATE = '#CBD5E1';
export const INK = '#0F172A';
export const GREEN = '#059669';
export const RED = '#DC2626';

export function ChangeBadge({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null || !Number.isFinite(value)) {
    return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">NEW</span>;
  }
  const good = invert ? value <= 0 : value >= 0;
  return (
    <span
      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${good ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}
    >
      {value > 0 ? '+' : ''}
      {value.toFixed(1)}%
    </span>
  );
}

export function KpiCard({
  label,
  value,
  icon,
  accent = 'gold',
  change,
  changeLabel = 'vs last year',
  previous,
  hint,
  invertChange = false,
  compact = false,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  accent?: 'gold' | 'green' | 'red' | 'ink' | 'slate';
  change?: number | null;
  changeLabel?: string;
  previous?: string;
  hint?: string;
  invertChange?: boolean;
  /** smaller card, for a row of 6 */
  compact?: boolean;
}) {
  const accentClass = {
    gold: 'bg-amber-50 text-[#B8860B]',
    green: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    ink: 'bg-slate-900 text-[#D4AF37]',
    slate: 'bg-slate-100 text-slate-600',
  }[accent];
  return (
    <div
      className={`bg-white rounded-2xl ${compact ? 'p-4 gap-2' : 'p-5 gap-3'} border border-slate-200/70 shadow-[0_4px_20px_-6px_rgba(0,0,0,0.06)] flex flex-col min-w-0`}
    >
      <div className="flex items-center gap-3">
        {icon ? <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${accentClass}`}>{icon}</div> : null}
        <h3 className="font-bold text-slate-500 uppercase tracking-wider text-[11px] leading-tight">{label}</h3>
      </div>
      <div className={`font-mono font-black ${compact ? 'text-lg' : 'text-2xl'} text-slate-900 truncate`} title={value}>
        {value}
      </div>
      {change !== undefined || previous || hint ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-medium">
          {change !== undefined ? (
            <>
              <ChangeBadge value={change} invert={invertChange} />
              <span>{changeLabel}</span>
            </>
          ) : null}
          {previous ? <span className="w-full">Last year: {previous}</span> : null}
          {hint ? <span className="w-full">{hint}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  right,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`bg-white rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_-6px_rgba(0,0,0,0.06)] p-5 min-w-0 ${className}`}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-2.5">
          <span className="w-1.5 h-5 rounded-full bg-[#D4AF37] mt-0.5 shrink-0" />
          <div>
            <h3 className="font-black text-slate-900 tracking-tight">{title}</h3>
            {subtitle ? <p className="text-xs text-slate-400 font-medium mt-0.5">{subtitle}</p> : null}
          </div>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export type Column<T> = {
  header: string;
  cell: (row: T, index: number) => React.ReactNode;
  className?: string;
};

/** Simple centered table: 25 rows per page, no inner scroll. */
export const PAGE_SIZE = 25;

export function SimpleTable<T>({
  columns,
  rows,
  empty = 'No data',
  footer,
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: string;
  footer?: React.ReactNode[];
}) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  // back to the first page when the data changes (other salesperson, period, search…)
  useEffect(() => setPage(0), [rows]);
  const current = Math.min(page, pages - 1);
  const offset = current * PAGE_SIZE;
  const pageRows = rows.slice(offset, offset + PAGE_SIZE);

  return (
    <div>
    <div className="overflow-x-auto rounded-xl border border-slate-100">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-900 text-white">
            {columns.map((c) => (
              <th key={c.header} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-center whitespace-nowrap">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center text-slate-400 py-10 font-medium">
                {empty}
              </td>
            </tr>
          ) : (
            pageRows.map((row, i) => (
              <tr key={offset + i} className="border-b border-slate-100 odd:bg-white even:bg-slate-50/60 hover:bg-amber-50/40">
                {columns.map((c) => (
                  <td key={c.header} className={`px-3 py-2 text-center text-slate-700 ${c.className || ''}`}>
                    {c.cell(row, offset + i)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {footer && rows.length > 0 ? (
          <tfoot>
            <tr className="bg-amber-50 font-black text-slate-900">
              {footer.map((f, i) => (
                <td key={i} className="px-3 py-2.5 text-center">
                  {f}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
    {pages > 1 ? (
      <div className="flex items-center justify-between gap-3 mt-3 text-xs font-semibold text-slate-500">
        <span>
          {offset + 1}-{Math.min(offset + PAGE_SIZE, rows.length)} of {rows.length}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(0)}
            disabled={current === 0}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            First
          </button>
          <button
            onClick={() => setPage(current - 1)}
            disabled={current === 0}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          <span className="px-3 py-1.5 rounded-lg bg-slate-900 text-[#D4AF37] font-bold">
            {current + 1} / {pages}
          </span>
          <button
            onClick={() => setPage(current + 1)}
            disabled={current >= pages - 1}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
          <button
            onClick={() => setPage(pages - 1)}
            disabled={current >= pages - 1}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Last
          </button>
        </div>
      </div>
    ) : null}
    </div>
  );
}

export function GrowthText({ value }: { value: number | null }) {
  if (value === null || !Number.isFinite(value)) return <span className="text-amber-600 font-bold">NEW</span>;
  return (
    <span className={`font-bold ${value >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
      {value > 0 ? '+' : ''}
      {value.toFixed(1)}%
    </span>
  );
}
