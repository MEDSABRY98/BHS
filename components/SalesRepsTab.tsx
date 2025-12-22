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
import { InvoiceRow, SalesRepAnalysis, CustomerAnalysis } from '@/types';

interface SalesRepsTabProps {
  data: InvoiceRow[];
}

const columnHelper = createColumnHelper<SalesRepAnalysis>();

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

  const totalScore = score1 + score2 + score3 + score4 + score5;

  let finalRating: 'Good' | 'Medium' | 'Bad';
  
  if (netDebt < 0) {
    finalRating = 'Good';
  } else if (riskFlag1 === 1 || riskFlag2 === 1) {
    finalRating = 'Bad';
  } else {
    if (totalScore >= 7) {
      finalRating = 'Good';
    } else if (totalScore >= 4) {
      finalRating = 'Medium';
    } else {
      finalRating = 'Bad';
    }
  }

  return finalRating;
};

export default function SalesRepsTab({ data }: SalesRepsTabProps) {
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

  const salesRepAnalysis = useMemo(() => {
    const repMap = new Map<string, SalesRepAnalysis>();
    const customerCountMap = new Map<string, Set<string>>();
    const customersByRep = new Map<string, CustomerAnalysis[]>();

    // Group customers by sales rep
    customerAnalysis.forEach((customer) => {
      if (customer.salesReps) {
        customer.salesReps.forEach((rep) => {
          if (!customersByRep.has(rep)) {
            customersByRep.set(rep, []);
          }
          customersByRep.get(rep)!.push(customer);
        });
      }
    });

    data.forEach((row) => {
      const existing = repMap.get(row.salesRep) || {
        salesRep: row.salesRep,
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

      if (!customerCountMap.has(row.salesRep)) {
        customerCountMap.set(row.salesRep, new Set());
      }
      customerCountMap.get(row.salesRep)!.add(row.customerName);

      repMap.set(row.salesRep, existing);
    });

    // Calculate collection rate and customer ratings for each rep
    repMap.forEach((rep, repName) => {
      rep.customerCount = customerCountMap.get(repName)?.size || 0;
      
      // Calculate collection rate
      rep.collectionRate = rep.totalDebit > 0 ? (rep.totalCredit / rep.totalDebit) * 100 : 0;
      
      // Get customers for this rep and calculate ratings
      const repCustomers = customersByRep.get(repName) || [];
      let goodCount = 0;
      let mediumCount = 0;
      let badCount = 0;
      
      repCustomers.forEach((customer) => {
        const rating = calculateDebtRating(customer, closedCustomers);
        if (rating === 'Good') {
          goodCount++;
        } else if (rating === 'Medium') {
          mediumCount++;
        } else {
          badCount++;
        }
      });
      
      rep.goodCustomersCount = goodCount;
      rep.mediumCustomersCount = mediumCount;
      rep.badCustomersCount = badCount;
    });

    return Array.from(repMap.values()).sort((a, b) => b.netDebt - a.netDebt);
  }, [data, customerAnalysis, closedCustomers]);

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return salesRepAnalysis;
    const query = searchQuery.toLowerCase();
    return salesRepAnalysis.filter((rep) =>
      rep.salesRep.toLowerCase().includes(query)
    );
  }, [salesRepAnalysis, searchQuery]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('salesRep', {
        header: 'Sales Rep',
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

  const totalDebt = salesRepAnalysis.reduce((sum, r) => sum + r.netDebt, 0);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Sales Reps Analysis</h2>
        <div className="bg-blue-50 p-4 rounded-lg relative">
          <div className="flex items-center">
            <div>
              <p className="text-lg">
                <span className="font-semibold">Total Debt:</span>{' '}
                <span className={totalDebt > 0 ? 'text-red-600' : totalDebt < 0 ? 'text-green-600' : ''}>
                  {totalDebt.toLocaleString('en-US')}
                </span>
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Number of Sales Reps: {filteredData.length} {searchQuery && `(filtered from ${salesRepAnalysis.length})`}
              </p>
            </div>
            <div className="absolute left-1/2 transform -translate-x-1/2">
              <input
                type="text"
                placeholder="Search by sales rep name..."
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
                      if (columnId === 'salesRep') return '20%';
                      if (columnId === 'customerCount') return '12%';
                      if (columnId === 'netDebt') return '15%';
                      if (columnId === 'collectionRate') return '15%';
                      if (columnId === 'goodCustomersCount') return '12%';
                      if (columnId === 'mediumCustomersCount') return '12%';
                      if (columnId === 'badCustomersCount') return '12%';
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
                      if (columnId === 'salesRep') return '20%';
                      if (columnId === 'customerCount') return '12%';
                      if (columnId === 'netDebt') return '15%';
                      if (columnId === 'collectionRate') return '15%';
                      if (columnId === 'goodCustomersCount') return '12%';
                      if (columnId === 'mediumCustomersCount') return '12%';
                      if (columnId === 'badCustomersCount') return '12%';
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
                <td className="px-4 py-3 text-center text-lg" style={{ width: '20%' }}>Total</td>
                <td className="px-4 py-3 text-center text-lg" style={{ width: '12%' }}>
                  {filteredData.reduce((sum, r) => sum + r.customerCount, 0)}
                </td>
                <td className="px-4 py-3 text-center text-lg" style={{ width: '15%' }}>
                  <span className={filteredData.reduce((sum, r) => sum + r.netDebt, 0) > 0 ? 'text-red-600' : filteredData.reduce((sum, r) => sum + r.netDebt, 0) < 0 ? 'text-green-600' : ''}>
                    {filteredData.reduce((sum, r) => sum + r.netDebt, 0).toLocaleString('en-US')}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-lg" style={{ width: '15%' }}>
                  {(() => {
                    const totalDebit = filteredData.reduce((sum, r) => sum + r.totalDebit, 0);
                    const totalCredit = filteredData.reduce((sum, r) => sum + r.totalCredit, 0);
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
                <td className="px-4 py-3 text-center text-lg" style={{ width: '12%' }}>
                  <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold shadow-sm">
                    {filteredData.reduce((sum, r) => sum + r.goodCustomersCount, 0)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-lg" style={{ width: '12%' }}>
                  <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold shadow-sm">
                    {filteredData.reduce((sum, r) => sum + r.mediumCustomersCount, 0)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-lg" style={{ width: '12%' }}>
                  <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold shadow-sm">
                    {filteredData.reduce((sum, r) => sum + r.badCustomersCount, 0)}
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
