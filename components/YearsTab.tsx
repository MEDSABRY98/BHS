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
import { InvoiceRow, YearAnalysis, CustomerAnalysis } from '@/types';

interface YearsTabProps {
  data: InvoiceRow[];
}

const columnHelper = createColumnHelper<YearAnalysis>();

// Helper functions (same as SalesRepsTab)
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

const calculateDebtRating = (customer: CustomerAnalysis, closedCustomersSet: Set<string>): 'Good' | 'Medium' | 'Bad' => {
  const customerNameNormalized = customer.customerName.toLowerCase().trim().replace(/\s+/g, ' ');
  const isClosed = closedCustomersSet.has(customerNameNormalized);

  if (isClosed) {
    return 'Bad';
  }

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

export default function YearsTab({ data }: YearsTabProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [closedCustomers, setClosedCustomers] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchClosedCustomers = async () => {
      try {
        const response = await fetch('/api/closed-customers');
        if (response.ok) {
          const data = await response.json();
          const normalizedSet = new Set<string>();
          data.closedCustomers.forEach((name: string) => {
            const normalized = name.toLowerCase().trim().replace(/\s+/g, ' ');
            normalizedSet.add(normalized);
          });
          setClosedCustomers(normalizedSet);
        }
      } catch (error) {
        console.error('Failed to fetch closed customers:', error);
      }
    };
    fetchClosedCustomers();
  }, []);

  // Calculate customer analysis for all customers (same as SalesRepsTab)
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
          salesReps: new Set(),
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

      if (row.salesRep && row.salesRep.trim()) {
        existing.salesReps?.add(row.salesRep.trim());
      }

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
        salesReps: c.salesReps,
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
      } as CustomerAnalysis & { payments3m: number; paymentsCount3m: number; sales3m: number; salesCount3m: number };
    });
  }, [data]);

  const yearAnalysis = useMemo(() => {
    const yearMap = new Map<string, YearAnalysis>();

    // Filter to include only customers with positive Net Debt (Debtors)
    const debitCustomersSet = new Set(
      customerAnalysis.filter(c => c.netDebt > 0.01).map(c => c.customerName)
    );

    data.forEach((row) => {
      // Skip if customer is not a debtor
      if (!debitCustomersSet.has(row.customerName)) return;
      const year = new Date(row.date).getFullYear().toString();
      if (isNaN(new Date(row.date).getTime())) {
        // Try to extract year from date string if date parsing fails
        const yearMatch = row.date.match(/\d{4}/);
        if (yearMatch) {
          const extractedYear = yearMatch[0];
          const existing = yearMap.get(extractedYear) || {
            year: extractedYear,
            totalDebit: 0,
            totalCredit: 0,
            netDebt: 0,
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

          yearMap.set(extractedYear, existing);
        }
        return;
      }

      const existing = yearMap.get(year) || {
        year,
        totalDebit: 0,
        totalCredit: 0,
        netDebt: 0,
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

      yearMap.set(year, existing);
    });

    // Calculate collection rate and customer ratings for each year
    const customersByYear = new Map<string, CustomerAnalysis[]>();

    // Group customers by year based on their transactions
    customerAnalysis.forEach((customer) => {
      const customerInvoices = data.filter(row => row.customerName === customer.customerName);
      const yearSet = new Set<string>();

      customerInvoices.forEach(inv => {
        const year = new Date(inv.date).getFullYear().toString();
        if (!isNaN(new Date(inv.date).getTime())) {
          yearSet.add(year);
        } else {
          const yearMatch = inv.date.match(/\d{4}/);
          if (yearMatch) {
            yearSet.add(yearMatch[0]);
          }
        }
      });

      yearSet.forEach(year => {
        if (!customersByYear.has(year)) {
          customersByYear.set(year, []);
        }
        customersByYear.get(year)!.push(customer);
      });
    });

    yearMap.forEach((year, yearName) => {
      year.collectionRate = year.totalDebit > 0 ? (year.totalCredit / year.totalDebit) * 100 : 0;

      // Get customers for this year and calculate ratings
      const yearCustomers = customersByYear.get(yearName) || [];
      const uniqueCustomers = Array.from(new Map(yearCustomers.map(c => [c.customerName, c])).values());

      let goodCount = 0;
      let mediumCount = 0;
      let badCount = 0;

      uniqueCustomers.forEach((customer) => {
        const rating = calculateDebtRating(customer, closedCustomers);
        if (rating === 'Good') {
          goodCount++;
        } else if (rating === 'Medium') {
          mediumCount++;
        } else {
          badCount++;
        }
      });

      year.goodCustomersCount = goodCount;
      year.mediumCustomersCount = mediumCount;
      year.badCustomersCount = badCount;
    });

    return Array.from(yearMap.values()).sort((a, b) => a.year.localeCompare(b.year));
  }, [data, customerAnalysis, closedCustomers]);

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return yearAnalysis;
    const query = searchQuery.toLowerCase();
    return yearAnalysis.filter((year) =>
      year.year.toLowerCase().includes(query)
    );
  }, [yearAnalysis, searchQuery]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('year', {
        header: 'Year',
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
      columnHelper.accessor('collectionRate', {
        header: 'Collection Rate',
        cell: (info) => {
          const value = info.getValue();
          let colorClass = 'text-gray-600 bg-gray-50';
          if (value >= 80) {
            colorClass = 'text-green-700 bg-green-50';
          } else if (value >= 50) {
            colorClass = 'text-amber-700 bg-amber-50';
          } else if (value > 0) {
            colorClass = 'text-red-700 bg-red-50';
          }
          return (
            <span className={`inline-flex items-center justify-center px-3 py-1 rounded-lg font-semibold ${colorClass}`}>
              {value.toFixed(1)}%
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

  const totalDebt = yearAnalysis.reduce((sum, y) => sum + y.netDebt, 0);

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="bg-blue-50 p-4 rounded-lg relative">
          <div className="flex items-center">
            <div>
              <p className="text-lg">
                <span className="font-semibold">Total Debt:</span>{' '}
                <span className={totalDebt > 0 ? 'text-red-600' : 'text-green-600'}>
                  {totalDebt.toLocaleString('en-US')}
                </span>
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Number of Years: {filteredData.length} {searchQuery && `(filtered from ${yearAnalysis.length})`}
              </p>
            </div>
            <div className="absolute left-1/2 transform -translate-x-1/2">
              <input
                type="text"
                placeholder="Search by year..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg w-64"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" style={{ tableLayout: 'fixed' }}>
            <thead className="bg-gray-100">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const getWidth = () => {
                      const columnId = header.column.id;
                      if (columnId === 'year') return '15%';
                      if (columnId === 'netDebt') return '15%';
                      if (columnId === 'collectionRate') return '15%';
                      if (columnId === 'goodCustomersCount') return '18%';
                      if (columnId === 'mediumCustomersCount') return '18%';
                      if (columnId === 'badCustomersCount') return '19%';
                      return 'auto';
                    };
                    return (
                      <th
                        key={header.id}
                        className="px-4 py-3 text-center font-semibold cursor-pointer hover:bg-gray-200"
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
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b hover:bg-gray-50">
                  {row.getVisibleCells().map((cell) => {
                    const getWidth = () => {
                      const columnId = cell.column.id;
                      if (columnId === 'year') return '15%';
                      if (columnId === 'netDebt') return '15%';
                      if (columnId === 'collectionRate') return '15%';
                      if (columnId === 'goodCustomersCount') return '18%';
                      if (columnId === 'mediumCustomersCount') return '18%';
                      if (columnId === 'badCustomersCount') return '19%';
                      return 'auto';
                    };
                    return (
                      <td key={cell.id} className="px-4 py-3 text-center text-lg" style={{ width: getWidth() }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                <td className="px-4 py-3 text-center text-lg" style={{ width: '15%' }}>Total</td>
                <td className="px-4 py-3 text-center text-lg" style={{ width: '15%' }}>
                  <span className={filteredData.reduce((sum, y) => sum + y.netDebt, 0) > 0 ? 'text-red-600' : filteredData.reduce((sum, y) => sum + y.netDebt, 0) < 0 ? 'text-green-600' : ''}>
                    {filteredData.reduce((sum, y) => sum + y.netDebt, 0).toLocaleString('en-US')}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-lg" style={{ width: '15%' }}>
                  {(() => {
                    const totalDebit = filteredData.reduce((sum, y) => sum + y.totalDebit, 0);
                    const totalCredit = filteredData.reduce((sum, y) => sum + y.totalCredit, 0);
                    const avgRate = totalDebit > 0 ? (totalCredit / totalDebit) * 100 : 0;
                    let colorClass = 'text-gray-600 bg-gray-50';
                    if (avgRate >= 80) {
                      colorClass = 'text-green-700 bg-green-50';
                    } else if (avgRate >= 50) {
                      colorClass = 'text-amber-700 bg-amber-50';
                    } else if (avgRate > 0) {
                      colorClass = 'text-red-700 bg-red-50';
                    }
                    return (
                      <span className={`inline-flex items-center justify-center px-3 py-1 rounded-lg font-semibold ${colorClass}`}>
                        {avgRate.toFixed(1)}%
                      </span>
                    );
                  })()}
                </td>
                <td className="px-4 py-3 text-center text-lg" style={{ width: '18%' }}>
                  <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold shadow-sm">
                    {filteredData.reduce((sum, y) => sum + y.goodCustomersCount, 0)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-lg" style={{ width: '18%' }}>
                  <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold shadow-sm">
                    {filteredData.reduce((sum, y) => sum + y.mediumCustomersCount, 0)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-lg" style={{ width: '19%' }}>
                  <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold shadow-sm">
                    {filteredData.reduce((sum, y) => sum + y.badCustomersCount, 0)}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
