import React from 'react';
import { flexRender, Table } from '@tanstack/react-table';
import { Printer, Mail } from 'lucide-react';
import NoData from '../../../01-Unified/NoDataTab';
import { CustomerAnalysis } from '@/types';
import { copyToClipboard, calculateDebtRating, formatDmy } from '../CstomersUtils';

interface DefaultViewProps {
  table: Table<CustomerAnalysis>;
  selectedCustomersForDownload: Set<string>;
  toggleCustomerSelection: (name: string) => void;
  setSelectedCustomer: (name: string) => void;
  setSelectedCustomerForMonths: (name: string) => void;
  setSelectedCollectionStats: (stats: any) => void;
  setSelectedRatingCustomer: (customer: CustomerAnalysis) => void;
  setRatingBreakdown: (breakdown: any) => void;
  closedCustomers: Set<string>;
  mode?: string;
  customerAnalysis: CustomerAnalysis[];
  filteredData: CustomerAnalysis[];
  isDateFilterActive: boolean;
}

const DefaultView: React.FC<DefaultViewProps> = ({
  table,
  selectedCustomersForDownload,
  toggleCustomerSelection,
  setSelectedCustomer,
  setSelectedCustomerForMonths,
  setSelectedCollectionStats,
  setSelectedRatingCustomer,
  setRatingBreakdown,
  closedCustomers,
  mode,
  customerAnalysis,
  filteredData,
  isDateFilterActive,
}) => {
  return (
    <>
      <div className="mb-4 bg-gradient-to-r from-slate-50 via-gray-50 to-slate-50 p-4 rounded-xl border-2 border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {table.getHeaderGroups().map((headerGroup) => (
            <div key={headerGroup.id} className="contents">
              {headerGroup.headers.filter(h => h.column.id !== 'select').map((header) => {
                const columnId = header.column.id;
                const isName = columnId === 'customerName';
                return (
                  <div
                    key={header.id}
                    className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 font-semibold text-sm uppercase tracking-wider text-gray-700 ${isName ? 'md:col-span-3' : 'md:col-span-1'
                      } hover:bg-white cursor-pointer`}
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
                        className="flex items-center justify-center gap-2"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <span className="text-blue-600">
                          {{
                            asc: '↑',
                            desc: '↓',
                          }[header.column.getIsSorted() as string] ?? (
                              <span className="text-gray-300">↕</span>
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

      <div className="space-y-3 mb-6">
        {table.getRowModel().rows.length === 0 ? (
          <NoData />
        ) : (
          table.getRowModel().rows.map((row, index) => {
            const customer = row.original;
            const netDebt = customer.netDebt;
            const totalDebit = customer.totalDebit;
            const collectionRate = totalDebit > 0 ? ((customer.totalCredit / totalDebit) * 100) : 0;
            const creditDenom = customer.totalCredit || 0;
            const payRate = creditDenom > 0 ? ((customer.creditPayments || 0) / creditDenom * 100) : 0;
            const returnRate = creditDenom > 0 ? ((customer.creditReturns || 0) / creditDenom * 100) : 0;
            const discountRate = creditDenom > 0 ? ((customer.creditDiscounts || 0) / creditDenom * 100) : 0;
            const rating = calculateDebtRating(customer, closedCustomers);
            const ratingColor = rating === 'Good' ? 'from-emerald-500 to-green-600' : rating === 'Medium' ? 'from-amber-500 to-yellow-600' : 'from-red-500 to-rose-600';
            const ratingBg = rating === 'Good' ? 'bg-emerald-50 border-emerald-200' : rating === 'Medium' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
            const ratingText = rating === 'Good' ? 'text-emerald-700' : rating === 'Medium' ? 'text-amber-700' : 'text-red-700';

            return (
              <div
                key={row.id}
                className="bg-white rounded-xl border-2 border-gray-200 shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-all duration-300 hover:border-blue-300 overflow-hidden group"
              >
                <div className="p-5">
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
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const buttonEl = (e.currentTarget as HTMLButtonElement | null);
                            const originalTitle = buttonEl?.title || 'Copy customer name';
                            const success = await copyToClipboard(customer.customerName);
                            if (success && buttonEl) {
                              buttonEl.title = 'Copied!';
                              setTimeout(() => { buttonEl.title = originalTitle; }, 2000);
                            }
                          }}
                          className="flex flex-col gap-0.5 p-1 hover:bg-gray-100 rounded transition-colors shrink-0 ml-auto"
                          title="Copy customer name"
                        >
                          <div className="w-3 h-3 border border-gray-600 rounded-sm"></div>
                          <div className="w-3 h-3 border border-gray-600 rounded-sm"></div>
                        </button>
                      </div>
                    </div>

                    <div className="md:col-span-1 hidden md:flex items-center justify-center">
                      <span className="text-sm font-semibold text-gray-700 text-center">
                        {(() => {
                          const val = customer.salesReps;
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
                        title="Click to view monthly debt breakdown"
                      >
                        {netDebt.toLocaleString('en-US')}
                      </button>
                    </div>

                    <div className="md:col-span-1">
                      {mode === 'OB_POS' || mode === 'OB_NEG' ? (
                        <div className="text-xl font-bold transition-colors w-full text-center">
                          <span className={`${(customer.openOBAmount || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {(customer.openOBAmount || 0).toLocaleString('en-US')}
                          </span>
                        </div>
                      ) : mode === 'DEBIT' ? (
                        customer.netDebt < 0 ? (
                          <div className="text-center"><span className="text-gray-500 text-xl font-bold">-</span></div>
                        ) : (
                          <button
                            onClick={() => {
                              if (isDateFilterActive) return;
                              const stats = filteredData.map(c => {
                                const denom = c.totalCredit || 0;
                                return {
                                  name: c.customerName,
                                  collRate: c.totalDebit > 0 ? (c.totalCredit / c.totalDebit * 100) : 0,
                                  payRate: denom > 0 ? ((c.creditPayments || 0) / denom * 100) : 0,
                                  returnRate: denom > 0 ? ((c.creditReturns || 0) / denom * 100) : 0,
                                  discountRate: denom > 0 ? ((c.creditDiscounts || 0) / denom * 100) : 0,
                                };
                              });
                              const getRank = (metric: keyof typeof stats[0], val: number) => {
                                const sorted = [...stats].sort((a, b) => Number(b[metric]) - Number(a[metric]));
                                return sorted.findIndex(s => s.name === customer.customerName) + 1;
                              };
                              setSelectedCollectionStats({
                                customer,
                                ranks: {
                                  collRank: getRank('collRate', collectionRate),
                                  payRank: getRank('payRate', payRate),
                                  returnRank: getRank('returnRate', returnRate),
                                  discountRank: getRank('discountRate', discountRate),
                                  totalCount: filteredData.length
                                },
                                rates: { payRate, returnRate, discountRate }
                              });
                            }}
                            className={`flex flex-col items-center gap-2 w-full rounded-lg p-1 transition-colors ${isDateFilterActive ? 'cursor-default' : 'hover:bg-gray-50 group cursor-pointer'}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`text-xl font-bold ${collectionRate >= 80 ? 'text-green-600' : collectionRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {collectionRate.toFixed(1)}%
                              </span>
                              {!isDateFilterActive && (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              )}
                              {!isDateFilterActive && (
                                <span className="text-xs text-gray-500">
                                  ({payRate.toFixed(0)}%, {returnRate.toFixed(0)}%, {discountRate.toFixed(0)}%)
                                </span>
                              )}
                            </div>
                            <div className="w-full max-w-[120px] h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${collectionRate >= 80 ? 'bg-green-500' : collectionRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                style={{ width: `${Math.min(collectionRate, 100)}%` }}
                              />
                            </div>
                          </button>
                        )
                      ) : (
                        <div className="text-center text-gray-400 text-sm italic">N/A</div>
                      )}
                    </div>

                    <div className="md:col-span-1">
                      <div className="flex justify-center">
                        <button
                          onClick={() => {
                            const breakdown = calculateDebtRating(customer, closedCustomers, true);
                            setSelectedRatingCustomer(customer);
                            setRatingBreakdown(breakdown);
                          }}
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${ratingText} ${ratingBg} border-2 transition-all hover:shadow-lg hover:scale-105 cursor-pointer`}
                          title="اضغط لعرض تفاصيل التقييم"
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
          })
        )}
      </div>

      <div className="bg-white rounded-xl border-2 border-gray-200 shadow-[0_4px_12px_rgba(0,0,0,0.08)] mt-6 overflow-hidden">
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
            <div className="md:col-span-2"><p className="text-sm font-semibold text-gray-700">Summary</p></div>
            <div className="md:col-span-1 hidden md:block"></div>
            <div className="md:col-span-1">
              <p className={`text-xl font-bold text-center ${filteredData.reduce((sum, c) => sum + c.netDebt, 0) > 0 ? 'text-red-600' : filteredData.reduce((sum, c) => sum + c.netDebt, 0) < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                {filteredData.reduce((sum, c) => sum + c.netDebt, 0).toLocaleString('en-US')}
              </p>
            </div>
            <div className="md:col-span-1">
              {mode === 'DEBIT' ? (
                (() => {
                  const totalNetDebt = filteredData.reduce((sum, c) => sum + c.netDebt, 0);
                  if (totalNetDebt < 0) return <p className="text-gray-500 text-xl font-bold text-center">-</p>;
                  const totalDebit = filteredData.reduce((sum, c) => sum + c.totalDebit, 0);
                  const totalCredit = filteredData.reduce((sum, c) => sum + c.totalCredit, 0);
                  const avgCollectionRate = totalDebit > 0 ? ((totalCredit / totalDebit) * 100) : 0;
                  const rateColor = avgCollectionRate >= 80 ? 'text-green-600' : avgCollectionRate >= 50 ? 'text-yellow-600' : 'text-red-600';
                  return <p className={`text-xl font-bold text-center ${rateColor}`}>{avgCollectionRate.toFixed(1)}%</p>;
                })()
              ) : (mode === 'OB_POS' || mode === 'OB_NEG') ? (
                <p className={`text-xl font-bold text-center ${filteredData.reduce((sum, c) => sum + (c.openOBAmount || 0), 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {filteredData.reduce((sum, c) => sum + (c.openOBAmount || 0), 0).toLocaleString('en-US')}
                </p>
              ) : <div className="hidden md:block"></div>}
            </div>
            <div className="md:col-span-1"><p className="text-xl font-bold text-blue-600 text-center" title="Total Customers Count">{filteredData.length}</p></div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DefaultView;
