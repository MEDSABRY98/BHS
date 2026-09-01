'use client';

import { useMemo, useEffect, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import { InvoiceRow, CityAnalysis, CustomerAnalysis } from '@/types';
import NoData from '@/app/Components/DataState/NoDataTab';
import { Users } from 'lucide-react';

interface CityTabProps {
  data: InvoiceRow[];
}

const columnHelper = createColumnHelper<CityAnalysis>();

// Helper functions
const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;

  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    const p1 = parseInt(parts[0]);
    const p2 = parseInt(parts[1]);
    const p3 = parseInt(parts[2]);
    if (p1 > 12 || (p3 > 31)) {
      return new Date(p3, p2 - 1, p1);
    }
  }
  return null;
};

const isPaymentTxn = (inv: { number?: string | null; credit?: number | null }): boolean => {
  const num = (inv.number?.toString() || '').toUpperCase();
  if (num.startsWith('BNK')) return true;
  if ((inv.credit || 0) <= 0.01) return false;
  return (
    !num.startsWith('SAL') &&
    !num.startsWith('RSAL') &&
    !num.startsWith('BIL') &&
    !num.startsWith('JV') &&
    !num.startsWith('OB')
  );
};

const getPaymentAmount = (inv: { credit?: number | null; debit?: number | null }): number => {
  const credit = inv.credit || 0;
  const debit = inv.debit || 0;
  return credit - debit;
};

const calculateDebtRating = (customer: CustomerAnalysis): 'Good' | 'Medium' | 'Bad' => {
  

  const netDebt = customer.netDebt;
  const collRate = customer.totalDebit > 0 ? (customer.totalCredit / customer.totalDebit) : 0;
  const lastPay = customer.lastPaymentDate;
  const payCount = (customer as any).paymentsCount3m || 0;
  const payments90d = (customer as any).payments3m || 0;
  const sales90d = (customer as any).sales3m || 0;
  const lastSale = customer.lastSalesDate;
  const salesCount = (customer as any).salesCount3m || 0;

  const riskFlag1 = sales90d < 0 && payCount === 0 ? 1 : 0;
  const riskFlag2 = payCount === 0 && salesCount === 0 && netDebt > 0 ? 1 : 0;

  let score1 = 0;
  if (netDebt < 0) {
    score1 = 2;
  } else if (netDebt <= 5000) {
    score1 = 2;
  } else if (netDebt <= 20000) {
    score1 = 1;
  } else {
    score1 = 0;
  }

  let score2 = 0;
  if (collRate >= 0.8) {
    score2 = 2;
  } else if (collRate >= 0.5) {
    score2 = 1;
  } else {
    score2 = 0;
  }

  let score3 = 0;
  if (lastPay) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastPayDate = new Date(lastPay);
    lastPayDate.setHours(0, 0, 0, 0);
    const daysSinceLastPay = Math.floor((today.getTime() - lastPayDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceLastPay <= 30) {
      score3 = 2;
    } else if (daysSinceLastPay <= 90) {
      score3 = 1;
    } else {
      score3 = 0;
    }
  } else {
    score3 = 0;
  }

  let score4 = 0;
  if (payCount >= 2) {
    score4 = 2;
  } else if (payCount === 1) {
    score4 = 1;
  } else {
    score4 = 0;
  }

  let score5 = 0;
  if (lastSale) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastSaleDate = new Date(lastSale);
    lastSaleDate.setHours(0, 0, 0, 0);
    const daysSinceLastSale = Math.floor((today.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceLastSale <= 30) {
      score5 = 2;
    } else if (daysSinceLastSale <= 90) {
      score5 = 1;
    } else {
      score5 = 0;
    }
  } else {
    score5 = 0;
  }

  // score6 — Payment Value last 90d
  let score6 = 0;
  if ((customer.payments3m || 0) >= 10000) {
    score6 = 2;
  } else if ((customer.payments3m || 0) >= 2000) {
    score6 = 1;
  } else {
    score6 = 0;
  }

  // score7 — Sales Value last 90d
  let score7 = 0;
  if ((customer.sales3m || 0) >= 10000) {
    score7 = 2;
  } else if ((customer.sales3m || 0) >= 2000) {
    score7 = 1;
  } else {
    score7 = 0;
  }

  // score8 — Sales Count last 90d
  let score8 = 0;
  if ((customer.salesCount3m || 0) >= 2) {
    score8 = 2;
  } else if ((customer.salesCount3m || 0) === 1) {
    score8 = 1;
  } else {
    score8 = 0;
  }

  const totalScore = score1 + score2 + score3 + score4 + score5 + score6 + score7 + score8;

  let finalRating: 'Good' | 'Medium' | 'Bad';

  if (netDebt < 0) {
    finalRating = 'Good';
  } else if (riskFlag1 === 1 || riskFlag2 === 1) {
    finalRating = 'Bad';
  } else {
    if (totalScore >= 11) {
      finalRating = 'Good';
    } else if (totalScore >= 6) {
      finalRating = 'Medium';
    } else {
      finalRating = 'Bad';
    }
  }

  return finalRating;
};

export default function CityTab({ data }: CityTabProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchQuery, setSearchQuery] = useState('');
  

  

  // Calculate customer analysis for all customers
  const customerAnalysis = useMemo(() => {
    type CustomerData = CustomerAnalysis & {
      matchingsMap: Map<string, number>;
      lastPaymentMatching: string | null;
      lastPaymentAmount: number | null;
      lastSalesAmount: number | null;
    };
    const customerMap = new Map<string, CustomerData>();

    data.forEach((row) => {
      let existing = customerMap.get(row.customerName);

      if (!existing) {
        existing = {
          customerName: row.customerName,
          totalDebit: 0,
          totalCredit: 0,
          netDebt: 0,
          netSales: 0,
          transactionCount: 0,
          matchingsMap: new Map(),
          cities: new Set(),
          invoiceNumbers: new Set(),
          lastPaymentDate: null,
          lastPaymentMatching: null,
          lastPaymentAmount: null,
          lastSalesDate: null,
          lastSalesAmount: null,
        };
      }

      existing.totalDebit += row.debit;
      existing.totalCredit += row.credit;
      existing.netDebt = existing.totalDebit - existing.totalCredit;
      existing.transactionCount += 1;

      const num = row.number?.toString().toUpperCase() || '';
      if (num.startsWith('SAL')) {
        existing.netSales = (existing.netSales || 0) + row.debit;
      } else if (num.startsWith('RSAL')) {
        existing.netSales = (existing.netSales || 0) - row.credit;
      }

      const rowCity = row.city?.trim() || 'Unknown';
      existing.cities?.add(rowCity);

      if (row.number) {
        existing.invoiceNumbers?.add(row.number.toString());
      }

      if (row.matching) {
        const currentMatchTotal = existing.matchingsMap.get(row.matching) || 0;
        existing.matchingsMap.set(row.matching, currentMatchTotal + (row.debit - row.credit));
      }

      const rowDate = parseDate(row.date);
      if (rowDate) {
        if (isPaymentTxn(row) && (row.credit || 0) > 0.01) {
          if (!existing.lastPaymentDate || rowDate > existing.lastPaymentDate) {
            existing.lastPaymentDate = rowDate;
            existing.lastPaymentMatching = row.matching || 'UNMATCHED';
            existing.lastPaymentAmount = getPaymentAmount(row);
          }
        }
        const num = row.number?.toString().toUpperCase() || '';
        if (num.startsWith('SAL') && row.debit > 0) {
          if (!existing.lastSalesDate || rowDate > existing.lastSalesDate) {
            existing.lastSalesDate = rowDate;
            existing.lastSalesAmount = row.debit;
          }
        }
      }

      customerMap.set(row.customerName, existing);
    });

    const customerInvoicesMap = new Map<string, InvoiceRow[]>();
    data.forEach(row => {
      const invoices = customerInvoicesMap.get(row.customerName) || [];
      invoices.push(row);
      customerInvoicesMap.set(row.customerName, invoices);
    });

    const now = new Date();
    const since90 = new Date();
    since90.setDate(now.getDate() - 90);
    const isInLast90 = (dateStr?: string) => {
      if (!dateStr) return false;
      const d = parseDate(dateStr);
      if (!d) return false;
      return d >= since90 && d <= now;
    };

    return Array.from(customerMap.values()).map(c => {
      const customerInvoices = customerInvoicesMap.get(c.customerName) || [];

      const sales3m = customerInvoices
        .filter(inv => {
          const num = inv.number?.toString().toUpperCase() || '';
          return num.startsWith('SAL') && isInLast90(inv.date);
        })
        .reduce((s, inv) => s + inv.debit, 0);

      const salesCount3m = customerInvoices
        .filter(inv => {
          const num = inv.number?.toString().toUpperCase() || '';
          return num.startsWith('SAL') && isInLast90(inv.date);
        })
        .length;

      const payments3m = customerInvoices
        .filter(inv => isInLast90(inv.date))
        .filter(inv => isPaymentTxn(inv))
        .reduce((s, inv) => s + getPaymentAmount(inv), 0);

      const paymentsCount3m = (() => {
        const paymentInvoices = customerInvoices
          .filter(inv => isInLast90(inv.date))
          .filter(inv => isPaymentTxn(inv));

        const creditCount = paymentInvoices.filter(inv => (inv.credit || 0) > 0.01).length;
        const debitCount = paymentInvoices.filter(inv => (inv.debit || 0) > 0.01).length;

        return creditCount - debitCount;
      })();

      return {
        customerName: c.customerName,
        totalDebit: c.totalDebit,
        totalCredit: c.totalCredit,
        netDebt: c.netDebt,
        netSales: c.netSales || 0,
        transactionCount: c.transactionCount,
        hasOpenMatchings: false,
        cities: c.cities,
        invoiceNumbers: c.invoiceNumbers,
        lastPaymentDate: c.lastPaymentDate,
        lastPaymentMatching: c.lastPaymentMatching,
        lastPaymentAmount: c.lastPaymentAmount,
        lastSalesDate: c.lastSalesDate,
        lastSalesAmount: c.lastSalesAmount,
        payments3m,
        paymentsCount3m,
        sales3m,
        salesCount3m
      };
    });
  }, [data]);

  const cityAnalysis = useMemo(() => {
    const cityMap = new Map<string, CityAnalysis>();
    const customerCountMap = new Map<string, Set<string>>();
    const customersByCity = new Map<string, CustomerAnalysis[]>();

    // Filter to include only customers with positive Net Debt (Debtors)
    const debitCustomersSet = new Set(
      customerAnalysis.filter(c => c.netDebt > 0.01).map(c => c.customerName)
    );

    // Group customers by sales city
    customerAnalysis.forEach((customer) => {
      // Skip if customer is not a debtor
      if (!debitCustomersSet.has(customer.customerName)) return;

      if (customer.cities) {
        customer.cities.forEach((city) => {
          if (!customersByCity.has(city)) {
            customersByCity.set(city, []);
          }
          customersByCity.get(city)!.push(customer);
        });
      }
    });

    data.forEach((row) => {
      // Skip if customer is not a debtor
      if (!debitCustomersSet.has(row.customerName)) return;
      const rowCity = row.city?.trim() || 'Unknown';
      const existing = cityMap.get(rowCity) || {
        city: rowCity,
        totalDebit: 0,
        totalCredit: 0,
        netDebt: 0,
        customerCount: 0,
        transactionCount: 0,
        collectionRate: 0,
        goodCustomersCount: 0,
        mediumCustomersCount: 0,
        badCustomersCount: 0,
      };

      existing.totalDebit += row.debit;
      existing.totalCredit += row.credit;
      existing.netDebt = existing.totalDebit - existing.totalCredit;
      existing.transactionCount += 1;

      if (!customerCountMap.has(rowCity)) {
        customerCountMap.set(rowCity, new Set());
      }
      customerCountMap.get(rowCity)!.add(row.customerName);

      cityMap.set(rowCity, existing);
    });

    // Calculate collection rate and customer ratings for each city
    cityMap.forEach((city, cityName) => {
      city.customerCount = customerCountMap.get(cityName)?.size || 0;

      // Calculate collection rate
      city.collectionRate = city.totalDebit > 0 ? (city.totalCredit / city.totalDebit) * 100 : 0;

      // Get customers for this city and calculate ratings
      const cityCustomers = customersByCity.get(cityName) || [];
      let goodCount = 0;
      let mediumCount = 0;
      let badCount = 0;

      cityCustomers.forEach((customer) => {
        const rating = calculateDebtRating(customer);
        if (rating === 'Good') {
          goodCount++;
        } else if (rating === 'Medium') {
          mediumCount++;
        } else {
          badCount++;
        }
      });

      city.goodCustomersCount = goodCount;
      city.mediumCustomersCount = mediumCount;
      city.badCustomersCount = badCount;
    });

    return Array.from(cityMap.values()).sort((a, b) => b.netDebt - a.netDebt);
  }, [data, customerAnalysis]);

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return cityAnalysis;
    const query = searchQuery.toLowerCase();
    return cityAnalysis.filter((city) =>
      city.city.toLowerCase().includes(query)
    );
  }, [cityAnalysis, searchQuery]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('city', {
        header: 'City',
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor('customerCount', {
        header: 'Customers',
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor('netDebt', {
        header: 'Net Debt',
        cell: (info) => {
          const value = info.getValue();
          return (
            <span className={value > 0 ? 'text-red-600' : value < 0 ? 'text-green-600' : ''}>
              {value.toLocaleString('en-US')}
            </span>
          );
        },
      }),
      columnHelper.accessor('goodCustomersCount', {
        header: 'Customer Good',
        cell: (info) => {
          const value = info.getValue();
          return (
            <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold shadow-sm">
              {value}
            </span>
          );
        },
      }),
      columnHelper.accessor('mediumCustomersCount', {
        header: 'Customer Medium',
        cell: (info) => {
          const value = info.getValue();
          return (
            <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold shadow-sm">
              {value}
            </span>
          );
        },
      }),
      columnHelper.accessor('badCustomersCount', {
        header: 'Customer Bad',
        cell: (info) => {
          const value = info.getValue();
          return (
            <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold shadow-sm">
              {value}
            </span>
          );
        },
      }),
    ],
    []
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
    onSortingChange: setSorting,
  });

  const totalDebt = cityAnalysis.reduce((sum, r) => sum + r.netDebt, 0);

  return (
    <div className="p-6 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-normal text-black tracking-tighter flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-500 shrink-0" />
            Cities Analysis
          </h1>
          <div className="flex flex-wrap gap-2">
            <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-black border border-blue-100 shadow-sm">
              {filteredData.length} {searchQuery && `of ${cityAnalysis.length}`} Cities
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-black border shadow-sm ${totalDebt > 0 ? 'bg-red-50 text-red-700 border-red-100' : totalDebt < 0 ? 'bg-green-50 text-green-700 border-green-100' : 'bg-gray-50 text-gray-700 border-gray-100'}`}>
              Total Debt: {totalDebt.toLocaleString('en-US')}
            </span>
          </div>
        </div>
        <div className="flex-1 max-w-md w-full md:w-auto">
          <input
            type="text"
            placeholder="Search by city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          {table.getRowModel().rows.length === 0 ? (
            <NoData />
          ) : (
          <table className="w-full text-center border-collapse" style={{ tableLayout: 'fixed', minWidth: '1000px', direction: 'ltr' }}>
            <thead className="bg-slate-900 text-white sticky top-0 z-30 shadow-md">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="text-center">
                  {headerGroup.headers.map((header) => {
                      const getWidth = () => {
                        const columnId = header.column.id;
                        if (columnId === 'city') return '25%';
                        if (columnId === 'customerCount') return '15%';
                        if (columnId === 'netDebt') return '20%';
                        if (columnId === 'goodCustomersCount') return '13%';
                        if (columnId === 'mediumCustomersCount') return '13%';
                        if (columnId === 'badCustomersCount') return '14%';
                        return 'auto';
                      };
                    return (
                        <th
                        key={header.id}
                        className="py-3 px-4 text-sm font-black uppercase tracking-wider text-center cursor-pointer hover:bg-slate-800 transition-colors"
                        style={{ width: getWidth() }}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{
                          asc: ' ↑',
                          desc: ' ↓',
                        }[header.column.getIsSorted() as string] ?? null}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-150">
              {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="group hover:bg-gray-50/50 transition-all text-center">
                    {row.getVisibleCells().map((cell) => {
                      const getWidth = () => {
                        const columnId = cell.column.id;
                        if (columnId === 'city') return '25%';
                        if (columnId === 'customerCount') return '15%';
                        if (columnId === 'netDebt') return '20%';
                        if (columnId === 'goodCustomersCount') return '13%';
                        if (columnId === 'mediumCustomersCount') return '13%';
                        if (columnId === 'badCustomersCount') return '14%';
                        return 'auto';
                      };
                      return (
                        <td key={cell.id} className="py-3 px-4 text-center text-lg font-semibold" style={{ width: getWidth() }}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              <tr className="bg-gray-100 font-bold border-t-2 border-gray-300 text-center">
                <td className="py-3 px-4 text-lg font-black text-black" style={{ width: '25%' }}>Total</td>
                <td className="py-3 px-4 text-lg font-black text-black" style={{ width: '15%' }}>
                  {filteredData.reduce((sum, r) => sum + r.customerCount, 0)}
                </td>
                <td className="py-3 px-4 text-lg font-black" style={{ width: '20%' }}>
                  <span className={filteredData.reduce((sum, r) => sum + r.netDebt, 0) > 0 ? 'text-red-600' : filteredData.reduce((sum, r) => sum + r.netDebt, 0) < 0 ? 'text-green-600' : ''}>
                    {filteredData.reduce((sum, r) => sum + r.netDebt, 0).toLocaleString('en-US')}
                  </span>
                </td>
                <td className="py-3 px-4 text-lg font-black" style={{ width: '13%' }}>
                  <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold shadow-sm">
                    {filteredData.reduce((sum, r) => sum + r.goodCustomersCount, 0)}
                  </span>
                </td>
                <td className="py-3 px-4 text-lg font-black" style={{ width: '13%' }}>
                  <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold shadow-sm">
                    {filteredData.reduce((sum, r) => sum + r.mediumCustomersCount, 0)}
                  </span>
                </td>
                <td className="py-3 px-4 text-lg font-black" style={{ width: '14%' }}>
                  <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold shadow-sm">
                    {filteredData.reduce((sum, r) => sum + r.badCustomersCount, 0)}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          )}
        </div>
      </div>
    </div>
  );
}
