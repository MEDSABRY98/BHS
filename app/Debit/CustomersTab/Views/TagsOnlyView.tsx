import React, { useMemo, Fragment } from 'react';
import { flexRender, Table, Row } from '@tanstack/react-table';
import { Printer, Mail, Tag } from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';
import { CustomerAnalysis } from '@/types';
import { copyToClipboard, calculateDebtRating, formatDmy } from '../CstomersUtils';

interface TagsOnlyViewProps {
  table: Table<CustomerAnalysis>;
  selectedCustomersForDownload: Set<string>;
  toggleCustomerSelection: (name: string) => void;
  setSelectedCustomer: (name: string) => void;
  setSelectedCustomerForMonths: (name: string) => void;
  setSelectedCollectionStats: (stats: any) => void;
  setSelectedRatingCustomer: (customer: CustomerAnalysis) => void;
  setRatingBreakdown: (breakdown: any) => void;

  mode?: string;
  customerAnalysis: CustomerAnalysis[];
  filteredData: CustomerAnalysis[];
  isDateFilterActive: boolean;
}

const TagsOnlyView: React.FC<TagsOnlyViewProps> = ({
  table,
  selectedCustomersForDownload,
  toggleCustomerSelection,
  setSelectedCustomer,
  setSelectedCustomerForMonths,
  setSelectedCollectionStats,
  setSelectedRatingCustomer,
  setRatingBreakdown,
  mode,
  customerAnalysis,
  filteredData,
  isDateFilterActive,
}) => {
  const taggedData = useMemo(() => {
    return filteredData.filter(c => c.customerTags && c.customerTags.size > 0);
  }, [filteredData]);

  const groupedRows = useMemo(() => {
    const taggedRows = table.getRowModel().rows.filter(row => row.original.customerTags && row.original.customerTags.size > 0);
    const groups: Record<string, typeof taggedRows> = {};

    taggedRows.forEach(row => {
      const tags = Array.from(row.original.customerTags || []);
      tags.forEach(tag => {
        if (!groups[tag]) groups[tag] = [];
        groups[tag].push(row);
      });
    });

    const sortedTags = Object.keys(groups).sort();

    const result: { tag: string; rows: typeof taggedRows }[] = [];
    sortedTags.forEach(tag => {
      const rows = groups[tag];
      rows.sort((a, b) => {
        const cityA = (Array.from(a.original.cities || [])[0] as string) || '';
        const cityB = (Array.from(b.original.cities || [])[0] as string) || '';
        if (cityA !== cityB) return cityA.localeCompare(cityB);

        const nameA = a.original.customerName || '';
        const nameB = b.original.customerName || '';
        if (nameA !== nameB) return nameA.localeCompare(nameB);

        return (b.original.netDebt || 0) - (a.original.netDebt || 0);
      });
      result.push({ tag, rows });
    });

    return result;
  }, [table.getRowModel().rows]);
  return (
    <>
      <div className="mb-4 bg-black p-4 rounded-xl border border-gray-800">
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {table.getHeaderGroups().map((headerGroup) => (
            <div key={headerGroup.id} className="contents">
              {headerGroup.headers.filter(h => h.column.id !== 'select').map((header) => {
                const columnId = header.column.id;
                const isName = columnId === 'customerName';
                const isCity = columnId === 'city';
                return (
                  <div
                    key={header.id}
                    className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 font-semibold text-sm uppercase tracking-wider text-white ${isName ? 'md:col-span-3' : 'md:col-span-1'
                      } ${isCity ? 'hidden md:flex' : ''} hover:bg-gray-800 cursor-pointer`}
                  >
                    <div className="flex items-center justify-center gap-2 w-full">
                      {isName && (
                        <div className="flex items-center gap-2 mr-2">
                          {(() => {
                            const selectHeader = headerGroup.headers.find(h => h.column.id === 'select');
                            return selectHeader ? flexRender(selectHeader.column.columnDef.header, selectHeader.getContext()) : null;
                          })()}
                        </div>
                      )}
                      <button
                        onClick={header.column.getToggleSortingHandler()}
                        className="flex items-center justify-center gap-2 text-white"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <span className="text-white">
                          {{
                            asc: '↑',
                            desc: '↓',
                          }[header.column.getIsSorted() as string] ?? (
                              <span className="text-gray-400">↕</span>
                            )}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {groupedRows.length === 0 ? (
        <NoData />
      ) : (
        <>
          <div className="space-y-6 mb-6">
            {groupedRows.map((group) => {
              const groupNetDebt = group.rows.reduce((sum, row) => sum + row.original.netDebt, 0);
              return (
                <div key={group.tag} className="space-y-2">
                  <div className="flex items-center gap-2 px-2 py-3 bg-indigo-50 rounded-xl border border-indigo-100">
                    <Tag className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-lg font-black text-indigo-900">{group.tag}</h3>
                    <span className="ml-auto bg-white px-3 py-1 rounded-full text-indigo-700 font-bold text-sm border border-indigo-200">
                      {group.rows.length} Customers
                    </span>
                  </div>

                  {group.rows.map((row, index) => {
                    const customer = row.original;
                    const netDebt = customer.netDebt;
                    const totalDebit = customer.totalDebit;
                    const rating = calculateDebtRating(customer);
                    const ratingColor = rating === 'Good' ? 'from-emerald-500 to-green-600' : rating === 'Medium' ? 'from-amber-500 to-yellow-600' : 'from-red-500 to-rose-600';
                    const ratingBg = rating === 'Good' ? 'bg-emerald-50 border-emerald-200' : rating === 'Medium' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
                    const ratingText = rating === 'Good' ? 'text-emerald-700' : rating === 'Medium' ? 'text-amber-700' : 'text-red-700';

                    return (
                      <div
                        key={`${group.tag}-${row.id}`}
                        className="bg-white rounded-xl border-2 border-gray-200 shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-all duration-300 hover:border-blue-300 overflow-hidden group ml-4"
                      >
                        <div className="py-3 px-4">
                          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                            <div className="md:col-span-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-slate-400 min-w-[24px]">#{index + 1}</span>
                                <input
                                  type="checkbox"
                                  checked={selectedCustomersForDownload.has(customer.customerName)}
                                  onChange={() => toggleCustomerSelection(customer.customerName)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer shrink-0"
                                />
                                <button
                                  onClick={() => setSelectedCustomer(customer.customerName)}
                                  className="text-lg font-bold text-gray-900 hover:text-blue-600 transition-colors text-left flex-1 group-hover:underline"
                                >
                                  {customer.customerName}
                                </button>
                              </div>
                            </div>

                            <div className="md:col-span-1 hidden md:flex items-center justify-center">
                              <span className="text-sm font-semibold text-gray-700 text-center">
                                {(() => {
                                  const val = customer.cities;
                                  if (val && val instanceof Set && val.size > 0) return Array.from(val).join(', ');
                                  if (Array.isArray(val) && val.length > 0) return val.join(', ');
                                  return '-';
                                })()}
                              </span>
                            </div>

                            <div className="md:col-span-1">
                              <button
                                onClick={() => setSelectedCustomerForMonths(customer.customerName)}
                                className={`text-xl font-bold transition-colors w-full text-center ${netDebt > 0 ? 'text-red-600 hover:text-red-700' : netDebt < 0 ? 'text-green-600 hover:text-green-700' : 'text-gray-600 hover:text-gray-700'}`}
                              >
                                {netDebt.toLocaleString('en-US')}
                              </button>
                            </div>

                            <div className="md:col-span-1 flex items-center justify-center">
                              <div className="text-center">
                                <span className="text-lg font-bold text-gray-700">
                                  {customer.avgPaymentInterval ? `${customer.avgPaymentInterval.toFixed(1)} days` : '-'}
                                </span>
                              </div>
                            </div>

                            <div className="md:col-span-1">
                              <div className="flex justify-center">
                                <button
                                  onClick={() => {
                                    const breakdown = calculateDebtRating(customer, true);
                                    setSelectedRatingCustomer(customer);
                                    setRatingBreakdown(breakdown);
                                  }}
                                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${ratingText} ${ratingBg} border-2 transition-all hover:shadow-lg hover:scale-105 cursor-pointer`}
                                >
                                  <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${ratingColor}`}></div>
                                  {rating}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Tag Total Row */}
                  <div className="ml-4 bg-gray-50 rounded-xl border border-gray-200 p-3 mt-2 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-center">
                      <div className="md:col-span-3">
                        <span className="font-bold text-gray-700">Total for {group.tag}</span>
                      </div>
                      <div className="md:col-span-1 hidden md:block"></div>
                      <div className="md:col-span-1 text-center">
                        <span className={`text-xl font-black ${groupNetDebt > 0 ? 'text-red-600' : groupNetDebt < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                          {groupNetDebt.toLocaleString('en-US')}
                        </span>
                      </div>
                      <div className="md:col-span-1 text-center">
                        <span className="font-bold text-gray-500">
                          {(() => {
                            const c = group.rows.filter(d => d.original.avgPaymentInterval);
                            if (!c.length) return '-';
                            const avg = c.reduce((sum, d) => sum + (d.original.avgPaymentInterval || 0), 0) / c.length;
                            return `${avg.toFixed(1)} days`;
                          })()}
                        </span>
                      </div>
                      <div className="md:col-span-1"></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-white rounded-xl border-2 border-gray-200 shadow-[0_4px_12px_rgba(0,0,0,0.08)] mt-6 overflow-hidden">
            <div className="py-3 px-4">
              <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-center">
                <div className="md:col-span-3"></div>
                <div className="md:col-span-1 hidden md:block"></div>
                <div className="md:col-span-1">
                  <p className={`text-xl font-bold text-center ${taggedData.reduce((sum, c) => sum + c.netDebt, 0) > 0 ? 'text-red-600' : taggedData.reduce((sum, c) => sum + c.netDebt, 0) < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                    {taggedData.reduce((sum, c) => sum + c.netDebt, 0).toLocaleString('en-US')}
                  </p>
                </div>
                <div className="md:col-span-1 flex items-center justify-center">
                  <div className="text-center">
                    <span className="text-lg font-bold text-gray-700">
                      {(() => {
                        const c = taggedData.filter(d => d.avgPaymentInterval);
                        if (!c.length) return '-';
                        const avg = c.reduce((sum, d) => sum + (d.avgPaymentInterval || 0), 0) / c.length;
                        return `${avg.toFixed(1)} days`;
                      })()}
                    </span>
                  </div>
                </div>
                <div className="md:col-span-1"><p className="text-xl font-bold text-blue-600 text-center" title="Total Customers Count">{taggedData.length}</p></div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default TagsOnlyView;
