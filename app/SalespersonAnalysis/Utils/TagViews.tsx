'use client';

// Default / No Tags / Tags Only views of a customers table
// (same idea as Customers Analysis → Payment Terms). Tags come from bhs_CUSTOMERS "CUSTOMER TAG".

import React, { useMemo } from 'react';
import { Tag } from 'lucide-react';
import { SimpleTable, type Column } from './Cards';

export type TagView = 'DEFAULT' | 'NO TAGS' | 'TAGS ONLY';

export function TagViewToggle({ view, onChange }: { view: TagView; onChange: (v: TagView) => void }) {
  return (
    <div className="grid grid-cols-3 bg-slate-100 rounded-xl p-1 gap-1">
      {(['DEFAULT', 'NO TAGS', 'TAGS ONLY'] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`w-24 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider text-center transition-all ${
            view === v ? 'bg-slate-900 text-[#D4AF37]' : 'text-slate-500 hover:text-slate-800'
          }`}
          title={v === 'DEFAULT' ? 'All customers' : v === 'NO TAGS' ? 'Customers without a tag' : 'Tagged customers grouped by tag, A-Z'}
        >
          {v === 'DEFAULT' ? 'Default' : v === 'NO TAGS' ? 'No Tags' : 'Tags Only'}
        </button>
      ))}
    </div>
  );
}

/**
 * rows: the customers (each has a main customer name);
 * totals(list): the footer cells (same count as columns; the first 3 are left for the tag name on group rows).
 */
export function TagViewTable<T>({
  view,
  rows,
  columns,
  nameOf,
  tagsOf,
  totals,
  empty = 'No data',
}: {
  view: TagView;
  rows: T[];
  columns: Column<T>[];
  nameOf: (r: T) => string;
  tagsOf: (name: string) => string[];
  totals: (list: T[]) => React.ReactNode[];
  empty?: string;
}) {
  const noTags = useMemo(() => rows.filter((r) => !tagsOf(nameOf(r)).length), [rows, tagsOf, nameOf]);
  const groups = useMemo(() => {
    const map = new Map<string, T[]>();
    for (const r of rows) for (const t of tagsOf(nameOf(r))) map.set(t, [...(map.get(t) || []), r]);
    return [...map]
      .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .map(([tag, list]) => ({ tag, list: [...list].sort((x, y) => nameOf(x).localeCompare(nameOf(y), undefined, { sensitivity: 'base' })) }));
  }, [rows, tagsOf, nameOf]);

  if (view === 'DEFAULT') return <SimpleTable rows={rows} columns={columns} footer={totals(rows)} empty={empty} />;
  if (view === 'NO TAGS') return <SimpleTable rows={noTags} columns={columns} footer={totals(noTags)} empty="No customers without a tag" />;
  if (!groups.length) return <div className="text-center text-slate-400 py-10 font-medium">No tagged customers</div>;

  const tagged = rows.filter((r) => tagsOf(nameOf(r)).length);
  return (
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
          {groups.map((g) => (
            <React.Fragment key={g.tag}>
              {/* tag header row with the tag's totals */}
              <tr className="bg-slate-200 text-slate-800">
                <td colSpan={3} className="px-3 py-2.5 text-left border-y border-slate-300">
                  <span className="inline-flex items-center gap-2">
                    <Tag className="w-4 h-4 text-slate-500" />
                    <span className="font-black">{g.tag}</span>
                    <span className="text-xs font-semibold text-slate-500">
                      ({g.list.length} customer{g.list.length === 1 ? '' : 's'})
                    </span>
                  </span>
                </td>
                {totals(g.list)
                  .slice(3)
                  .map((v, i) => (
                    <td key={i} className="px-3 py-2.5 text-center font-mono font-black border-y border-slate-300">
                      {v}
                    </td>
                  ))}
              </tr>
              {g.list.map((r, i) => (
                <tr key={`${g.tag}|${nameOf(r)}|${i}`} className="border-b border-slate-100 odd:bg-white even:bg-slate-50/60 hover:bg-amber-50/40">
                  {columns.map((c) => (
                    <td key={c.header} className={`px-3 py-2 text-center text-slate-700 ${c.className || ''}`}>
                      {c.cell(r, i)}
                    </td>
                  ))}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
        {/* grand total of the tagged customers (each customer counted once) */}
        <tfoot>
          <tr className="bg-slate-900 text-white font-black">
            {totals(tagged).map((v, i) => (
              <td key={i} className="px-3 py-2.5 text-center font-mono">
                {v}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
