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
import { InvoiceRow, CustomerAnalysis } from '@/types';
import CustomerDetails from './CustomerDetails';

interface CustomersTabProps {
  data: InvoiceRow[];
}

const columnHelper = createColumnHelper<CustomerAnalysis>();

const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  
  // Fallback for DD/MM/YYYY
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
      const p1 = parseInt(parts[0]);
      const p2 = parseInt(parts[1]);
      const p3 = parseInt(parts[2]);
      // Assuming DD/MM/YYYY if first part > 12 or generally preferred
      if (p1 > 12 || (p3 > 31)) { // rudimentary check
         return new Date(p3, p2 - 1, p1);
      }
      // If ambiguous, maybe try standard MM/DD/YYYY? 
      // Let's stick to what new Date() couldn't parse.
  }
  return null;
}

const exportToExcel = (data: CustomerAnalysis[], filename: string = 'customers_export') => {
  // CSV format (opens in Excel)
  // Order: Customer Name, Total Debit, Total Credit, Net Debt, Open OB, Last Payment Date, Collection Rate %, Overdue Amount, Net Sales, Last Sales Date
  const headers = ['Customer Name', 'Total Debit', 'Total Credit', 'Net Debt', 'Open OB', 'Last Payment Date', 'Collection Rate %', 'Overdue Amount', 'Net Sales', 'Last Sales Date'];
  
  const rows = data.map(customer => {
    const collectionRate = customer.totalDebit > 0 
      ? ((customer.totalCredit / customer.totalDebit) * 100).toFixed(2)
      : '0.00';
    
    return [
      customer.customerName || '',
      customer.totalDebit.toFixed(2) || '0.00',
      customer.totalCredit.toFixed(2) || '0.00',
      customer.netDebt.toFixed(2) || '0.00',
      (customer.openOBAmount || 0).toFixed(2),
      customer.lastPaymentDate ? customer.lastPaymentDate.toLocaleDateString() : '',
      collectionRate,
      (customer.overdueAmount || 0).toFixed(2),
      (customer.netSales || 0).toFixed(2),
      customer.lastSalesDate ? customer.lastSalesDate.toLocaleDateString() : ''
    ];
  });
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  // Add BOM for UTF-8 to ensure Excel opens it correctly
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default function CustomersTab({ data }: CustomersTabProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'PARTNERS' | 'FILTERS'>('PARTNERS');

  // Filters State
  const [matchingFilter, setMatchingFilter] = useState('ALL');
  const [selectedSalesRep, setSelectedSalesRep] = useState('ALL');
  const [customersWithEmails, setCustomersWithEmails] = useState<Set<string>>(new Set());

  // Advanced Filters
  const [debtOperator, setDebtOperator] = useState<'GT' | 'LT' | ''>('');
  const [debtAmount, setDebtAmount] = useState<string>('');
  const [debtType, setDebtType] = useState<'ALL' | 'DEBTOR' | 'CREDITOR'>('ALL'); // NEW: Debtor vs Creditor
  const [collectionRateOperator, setCollectionRateOperator] = useState<'GT' | 'LT' | ''>(''); // Collection Rate operator
  const [collectionRateValue, setCollectionRateValue] = useState<string>(''); // Collection Rate percentage
  const [netSalesOperator, setNetSalesOperator] = useState<'GT' | 'LT' | ''>(''); // Operator for Net Sales
  const [minTotalDebit, setMinTotalDebit] = useState<string>(''); // NEW: High volume customers
  
  const [lastPaymentValue, setLastPaymentValue] = useState<string>('');
  const [lastPaymentUnit, setLastPaymentUnit] = useState<'DAYS' | 'MONTHS'>('DAYS');
  
  const [noSalesValue, setNoSalesValue] = useState<string>('');
  const [noSalesUnit, setNoSalesUnit] = useState<'DAYS' | 'MONTHS'>('DAYS');

  // Date Range Filters
  const [dateRangeFrom, setDateRangeFrom] = useState<string>('');
  const [dateRangeTo, setDateRangeTo] = useState<string>('');
  const [dateRangeType, setDateRangeType] = useState<'LAST_TRANSACTION' | 'LAST_SALE' | 'LAST_PAYMENT'>('LAST_TRANSACTION');

  // Overdue Amount Filters
  const [overdueAmount, setOverdueAmount] = useState<string>('');
  const [overdueAging, setOverdueAging] = useState<string[]>([]); // ['AT_DATE', '1-30', '31-60', '61-90', '91-120', 'OLDER']
  
  // OB Filter
  const [hasOB, setHasOB] = useState(false);

  // Get unique Sales Reps
  const availableSalesReps = useMemo(() => {
    const reps = new Set<string>();
    data.forEach(row => {
      if (row.salesRep && row.salesRep.trim()) {
        reps.add(row.salesRep.trim());
      }
    });
    return Array.from(reps).sort();
  }, [data]);

  useEffect(() => {
    const fetchEmails = async () => {
      try {
        const response = await fetch('/api/customer-emails-list');
        if (response.ok) {
          const data = await response.json();
          // Store lowercased names for case-insensitive comparison
          setCustomersWithEmails(new Set(data.customers.map((name: string) => name.toLowerCase().trim())));
        }
      } catch (error) {
        console.error('Failed to fetch customer emails:', error);
      }
    };
    fetchEmails();
  }, []);

  const customerAnalysis = useMemo(() => {
    // Intermediate structure to track matchings per customer
    type CustomerData = CustomerAnalysis & { 
      matchingsMap: Map<string, number>; 
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
          lastSalesDate: null,
        };
      }

      existing.totalDebit += row.debit;
      existing.totalCredit += row.credit;
      existing.netDebt = existing.totalDebit - existing.totalCredit;
      existing.transactionCount += 1;
      
      // Calculate Net Sales (SAL debit - RSAL credit) - matching Dashboard logic
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
          // Last Payment: max date where credit > 0, excluding SAL, RSAL, BIL, JV (matching Dashboard logic)
          if (row.credit > 0.01) {
              const num = row.number?.toString().toUpperCase() || '';
              // Exclude SAL, RSAL, BIL, JV (same as Dashboard)
              if (!num.startsWith('SAL') && 
                  !num.startsWith('RSAL') && 
                  !num.startsWith('BIL') && 
                  !num.startsWith('JV')) {
                  if (!existing.lastPaymentDate || rowDate > existing.lastPaymentDate) {
                      existing.lastPaymentDate = rowDate;
                  }
              }
          }
          // Last Sale: max date where invoice number starts with SAL (matching Dashboard logic)
          const num = row.number?.toString().toUpperCase() || '';
          if (num.startsWith('SAL') && row.debit > 0) {
              if (!existing.lastSalesDate || rowDate > existing.lastSalesDate) {
                  existing.lastSalesDate = rowDate;
              }
          }
      }

      customerMap.set(row.customerName, existing);
    });

    // Calculate aging breakdown for each customer
    const customerInvoicesMap = new Map<string, InvoiceRow[]>();
    data.forEach(row => {
        const invoices = customerInvoicesMap.get(row.customerName) || [];
        invoices.push(row);
        customerInvoicesMap.set(row.customerName, invoices);
    });

    return Array.from(customerMap.values()).map(c => {
        // Check for any open matching
        let hasOpen = false;
        for (const amount of c.matchingsMap.values()) {
            if (Math.abs(amount) > 0.01) {
                hasOpen = true;
                break;
            }
        }

        // Calculate aging breakdown (matching Dashboard AGES tab logic)
        const customerInvoices = customerInvoicesMap.get(c.customerName) || [];
        const agingBreakdown = {
            atDate: 0,
            oneToThirty: 0,
            thirtyOneToSixty: 0,
            sixtyOneToNinety: 0,
            ninetyOneToOneTwenty: 0,
            older: 0,
        };
        let totalOverdue = 0;

        // Group invoices by matching to calculate residuals
        const matchingGroups = new Map<string, InvoiceRow[]>();
        customerInvoices.forEach(inv => {
            const key = inv.matching || 'UNMATCHED';
            const group = matchingGroups.get(key) || [];
            group.push(inv);
            matchingGroups.set(key, group);
        });

        matchingGroups.forEach((group, matchingKey) => {
            let groupNetDebt = group.reduce((sum, inv) => sum + (inv.debit - inv.credit), 0);
            
            if (Math.abs(groupNetDebt) <= 0.01) return; // Skip closed groups

            // For matched groups, use the first invoice's date/dueDate
            // For unmatched, use each invoice individually
            if (matchingKey === 'UNMATCHED') {
                group.forEach(inv => {
                    const invNetDebt = inv.debit - inv.credit;
                    if (Math.abs(invNetDebt) <= 0.01) return;

                    let daysOverdue = 0;
                    let targetDate = inv.dueDate ? parseDate(inv.dueDate) : null;
                    if (!targetDate && inv.date) {
                        targetDate = parseDate(inv.date);
                    }

                    if (targetDate) {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        targetDate.setHours(0, 0, 0, 0);
                        const diffTime = today.getTime() - targetDate.getTime();
                        daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    }

                    if (daysOverdue <= 0) {
                        agingBreakdown.atDate += invNetDebt;
                    } else if (daysOverdue <= 30) {
                        agingBreakdown.oneToThirty += invNetDebt;
                    } else if (daysOverdue <= 60) {
                        agingBreakdown.thirtyOneToSixty += invNetDebt;
                    } else if (daysOverdue <= 90) {
                        agingBreakdown.sixtyOneToNinety += invNetDebt;
                    } else if (daysOverdue <= 120) {
                        agingBreakdown.ninetyOneToOneTwenty += invNetDebt;
                    } else {
                        agingBreakdown.older += invNetDebt;
                    }
                    totalOverdue += invNetDebt;
                });
            } else {
                // Matched group - use first invoice for date calculation
                const firstInv = group[0];
                let daysOverdue = 0;
                let targetDate = firstInv.dueDate ? parseDate(firstInv.dueDate) : null;
                if (!targetDate && firstInv.date) {
                    targetDate = parseDate(firstInv.date);
                }

                if (targetDate) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    targetDate.setHours(0, 0, 0, 0);
                    const diffTime = today.getTime() - targetDate.getTime();
                    daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                }

                if (daysOverdue <= 0) {
                    agingBreakdown.atDate += groupNetDebt;
                } else if (daysOverdue <= 30) {
                    agingBreakdown.oneToThirty += groupNetDebt;
                } else if (daysOverdue <= 60) {
                    agingBreakdown.thirtyOneToSixty += groupNetDebt;
                } else if (daysOverdue <= 90) {
                    agingBreakdown.sixtyOneToNinety += groupNetDebt;
                } else if (daysOverdue <= 120) {
                    agingBreakdown.ninetyOneToOneTwenty += groupNetDebt;
                } else {
                    agingBreakdown.older += groupNetDebt;
                }
                totalOverdue += groupNetDebt;
            }
        });

        // Calculate Open OB amount from overdue invoices (matching OVERDUE tab logic)
        // This uses the same logic as overdue tab: unmatched invoices OR matched invoices with residual
        let hasOB = false;
        let openOBAmount = 0;
        
        // Calculate residual for each matching group (same as CustomerDetails)
        const matchingResiduals = new Map<string, { residual: number; residualHolderIndex: number }>();
        matchingGroups.forEach((group, matchingKey) => {
            if (matchingKey === 'UNMATCHED') return; // Skip unmatched, handled separately
            
            let groupNetDebt = group.reduce((sum, inv) => sum + (inv.debit - inv.credit), 0);
            if (Math.abs(groupNetDebt) <= 0.01) return; // Skip closed groups
            
            // Find the invoice with largest debit (the residual holder)
            let maxDebit = -1;
            let residualHolderIndex = 0;
            group.forEach((inv, idx) => {
                if (inv.debit > maxDebit) {
                    maxDebit = inv.debit;
                    residualHolderIndex = idx;
                }
            });
            
            matchingResiduals.set(matchingKey, {
                residual: groupNetDebt,
                residualHolderIndex
            });
        });
        
        // Now calculate OB from overdue invoices
        matchingGroups.forEach((group, matchingKey) => {
            let groupNetDebt = group.reduce((sum, inv) => sum + (inv.debit - inv.credit), 0);
            
            if (Math.abs(groupNetDebt) <= 0.01) return; // Skip closed groups
            
            if (matchingKey === 'UNMATCHED') {
                // Unmatched OB invoices - use individual netDebt
                group.forEach(inv => {
                    const num = inv.number?.toString().toUpperCase() || '';
                    if (num.startsWith('OB')) {
                        const invNetDebt = inv.debit - inv.credit;
                        if (Math.abs(invNetDebt) > 0.01) {
                            hasOB = true;
                            openOBAmount += invNetDebt;
                        }
                    }
                });
            } else {
                // Matched group - check if residual holder is OB
                const residualInfo = matchingResiduals.get(matchingKey);
                if (residualInfo) {
                    const residualHolder = group[residualInfo.residualHolderIndex];
                    const num = residualHolder.number?.toString().toUpperCase() || '';
                    if (num.startsWith('OB')) {
                        hasOB = true;
                        openOBAmount += residualInfo.residual;
                    }
                }
            }
        });
        
        return {
            customerName: c.customerName,
            totalDebit: c.totalDebit,
            totalCredit: c.totalCredit,
            netDebt: c.netDebt,
            netSales: c.netSales || 0,
            transactionCount: c.transactionCount,
            hasOpenMatchings: hasOpen,
            salesReps: c.salesReps,
            invoiceNumbers: c.invoiceNumbers,
            lastPaymentDate: c.lastPaymentDate,
            lastSalesDate: c.lastSalesDate,
            overdueAmount: totalOverdue,
            hasOB,
            openOBAmount,
            agingBreakdown,
        };
    }).sort((a, b) => b.netDebt - a.netDebt);
  }, [data]);

  const filteredData = useMemo(() => {
    let result = customerAnalysis;
    const now = new Date();

    // Date Range Filter
    if (dateRangeFrom || dateRangeTo) {
        const fromDate = dateRangeFrom ? new Date(dateRangeFrom) : null;
        const toDate = dateRangeTo ? new Date(dateRangeTo) : null;
        
        if (fromDate || toDate) {
            result = result.filter(c => {
                let targetDate: Date | null = null;
                
                switch(dateRangeType) {
                    case 'LAST_TRANSACTION':
                        // Use the most recent date (last payment or last sale)
                        if (c.lastPaymentDate && c.lastSalesDate) {
                            targetDate = c.lastPaymentDate > c.lastSalesDate ? c.lastPaymentDate : c.lastSalesDate;
                        } else if (c.lastPaymentDate) {
                            targetDate = c.lastPaymentDate;
                        } else if (c.lastSalesDate) {
                            targetDate = c.lastSalesDate;
                        }
                        break;
                    case 'LAST_SALE':
                        targetDate = c.lastSalesDate;
                        break;
                    case 'LAST_PAYMENT':
                        targetDate = c.lastPaymentDate;
                        break;
                }
                
                if (!targetDate) return false;
                
                if (fromDate && toDate) {
                    return targetDate >= fromDate && targetDate <= toDate;
                } else if (fromDate) {
                    return targetDate >= fromDate;
                } else if (toDate) {
                    return targetDate <= toDate;
                }
                
                return true;
            });
        }
    }

    if (matchingFilter === 'OPEN') {
      result = result.filter(c => c.hasOpenMatchings);
    } else if (matchingFilter === 'WITH_EMAIL') {
      result = result.filter(c => customersWithEmails.has(c.customerName.toLowerCase().trim()));
    }

    if (selectedSalesRep !== 'ALL') {
      result = result.filter(c => c.salesReps && c.salesReps.has(selectedSalesRep));
    }

    // Debt Filters
    if (debtOperator && debtAmount) {
        const amount = parseFloat(debtAmount);
        if (!isNaN(amount)) {
            if (debtOperator === 'GT') {
                result = result.filter(c => c.netDebt > amount);
            } else if (debtOperator === 'LT') {
                result = result.filter(c => c.netDebt < amount);
            }
        }
    }

    if (debtType === 'DEBTOR') {
        result = result.filter(c => c.netDebt > 0);
    } else if (debtType === 'CREDITOR') {
        result = result.filter(c => c.netDebt < 0);
    }

    // Collection Rate Filter
    if (collectionRateOperator && collectionRateValue) {
        const rate = parseFloat(collectionRateValue);
        if (!isNaN(rate)) {
            result = result.filter(c => {
                if (c.totalDebit === 0) return false; // Can't calculate rate if no sales
                const collectionRate = (c.totalCredit / c.totalDebit) * 100;
                if (collectionRateOperator === 'GT') {
                    return collectionRate > rate;
                } else if (collectionRateOperator === 'LT') {
                    return collectionRate < rate;
                }
                return true;
            });
        }
    }

    // OB Filter (Has unpaid OB invoices)
    if (hasOB) {
        result = result.filter(c => c.hasOB === true);
    }

    // Net Sales Filter (SAL - RSAL, matching Dashboard logic)
    if (netSalesOperator && minTotalDebit) {
        const val = parseFloat(minTotalDebit);
        if (!isNaN(val)) {
            if (netSalesOperator === 'GT') {
                result = result.filter(c => (c.netSales || 0) > val);
            } else if (netSalesOperator === 'LT') {
                result = result.filter(c => (c.netSales || 0) < val);
            }
        }
    } else if (minTotalDebit) {
        const val = parseFloat(minTotalDebit);
        if (!isNaN(val)) result = result.filter(c => (c.netSales || 0) >= val);
    }

    // Overdue Amount Filter
    if (overdueAmount) {
        const val = parseFloat(overdueAmount);
        if (!isNaN(val)) {
            result = result.filter(c => (c.overdueAmount || 0) >= val);
        }
    }

    // Overdue Aging Filter
    if (overdueAging.length > 0) {
        result = result.filter(c => {
            if (!c.agingBreakdown) return false;
            const aging = c.agingBreakdown;
            
            // Check if customer has any amount in selected aging buckets (matching AGES tab order)
            return overdueAging.some(bucket => {
                switch(bucket) {
                    case 'AT_DATE':
                        return Math.abs(aging.atDate) > 0.01;
                    case '1-30':
                        return Math.abs(aging.oneToThirty) > 0.01;
                    case '31-60':
                        return Math.abs(aging.thirtyOneToSixty) > 0.01;
                    case '61-90':
                        return Math.abs(aging.sixtyOneToNinety) > 0.01;
                    case '91-120':
                        return Math.abs(aging.ninetyOneToOneTwenty) > 0.01;
                    case 'OLDER':
                        return Math.abs(aging.older) > 0.01;
                    default:
                        return false;
                }
            });
        });
    }

    // Last Payment Filter (Time elapsed since last payment)
    if (lastPaymentValue) {
        const val = parseFloat(lastPaymentValue);
        if (!isNaN(val)) {
            const daysThreshold = lastPaymentUnit === 'MONTHS' ? val * 30 : val;
            result = result.filter(c => {
                if (!c.lastPaymentDate) return false; // Or true? If no payment ever, is it > X days? Yes.
                // Assuming "No payment" matches "Haven't paid in X days"
                // But let's check logic: if no payment date, it means no credit transaction found.
                // Let's include them? Or exclude? Usually filtering for "Slow payers".
                // If they never paid, they are the slowest.
                // But let's stick to calculated difference. If null, maybe include?
                // Let's stick to having a date for now to be safe.
                const diffTime = Math.abs(now.getTime() - c.lastPaymentDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                return diffDays >= daysThreshold;
            });
        }
    }

    // No Sales Filter (Time elapsed since last sale)
    if (noSalesValue) {
        const val = parseFloat(noSalesValue);
        if (!isNaN(val)) {
            const daysThreshold = noSalesUnit === 'MONTHS' ? val * 30 : val;
            result = result.filter(c => {
                 // If never bought, does it match?
                 // "People who haven't had a sales invoice for X days"
                 // If never had one, they satisfy the condition technically (infinity > X).
                 // But let's check if they exist in the list implies they have SOME transaction.
                 if (!c.lastSalesDate) return true; 
                 const diffTime = Math.abs(now.getTime() - c.lastSalesDate.getTime());
                 const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                 return diffDays >= daysThreshold;
            });
        }
    }

    if (!searchQuery.trim()) return result;
    
    const query = searchQuery.toLowerCase();
    return result.filter((customer) =>
      customer.customerName.toLowerCase().includes(query) ||
      Array.from((customer as any).invoiceNumbers || []).some((num: any) => 
        num.toString().toLowerCase().includes(query)
      )
    );
  }, [customerAnalysis, searchQuery, matchingFilter, selectedSalesRep, debtOperator, debtAmount, lastPaymentValue, lastPaymentUnit, noSalesValue, noSalesUnit, customersWithEmails, debtType, minTotalDebit, netSalesOperator, collectionRateOperator, collectionRateValue, overdueAmount, overdueAging, dateRangeFrom, dateRangeTo, dateRangeType, hasOB]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('customerName', {
        header: 'Customer Name',
        cell: (info) => (
          <button
            onClick={() => setSelectedCustomer(info.getValue())}
            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-left w-full flex items-center gap-2"
          >
            {info.getValue()}
            {info.row.original.hasOpenMatchings && (
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="Has Open Matching"></span>
            )}
          </button>
        ),
      }),
      columnHelper.accessor('totalDebit', {
        header: 'Total Debit',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      columnHelper.accessor('totalCredit', {
        header: 'Total Credit',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      columnHelper.accessor('netDebt', {
        header: 'Net Debit',
        cell: (info) => {
          const value = info.getValue();
          return (
            <span className={value > 0 ? 'text-red-600' : value < 0 ? 'text-green-600' : ''}>
              {value.toLocaleString('en-US')}
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

  const totalDebt = filteredData.reduce((sum, c) => sum + c.netDebt, 0);

  // Filter invoices for selected customer
  const selectedCustomerInvoices = useMemo(() => {
    if (!selectedCustomer) return [];
    return data.filter((row) => row.customerName === selectedCustomer);
  }, [selectedCustomer, data]);

  // If a customer is selected, show their details
  if (selectedCustomer) {
    return (
      <CustomerDetails
        customerName={selectedCustomer}
        invoices={selectedCustomerInvoices}
        onBack={() => setSelectedCustomer(null)}
      />
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4">Customers Analysis</h2>
        
        {/* Main Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
            <button
                className={`py-2 px-4 font-medium text-lg ${activeTab === 'PARTNERS' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('PARTNERS')}
            >
                All Partners
            </button>
            <button
                className={`py-2 px-4 font-medium text-lg ${activeTab === 'FILTERS' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('FILTERS')}
            >
                Filters
            </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'FILTERS' && (
             <div className="bg-white/80 backdrop-blur p-6 rounded-2xl mb-6 border border-gray-200 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 border-b border-gray-100 pb-4">
                    <div className="space-y-1.5">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 text-xs font-semibold uppercase tracking-wide shadow-[0_1px_3px_rgba(79,70,229,0.18)]">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" />
                            </svg>
                            Filters Panel
                        </div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold text-gray-900">Advanced Filtering</h3>
                            <span className="text-xs text-gray-400 font-medium px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200">Live preview</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-full shadow-md border border-gray-100">
                        <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Matches</span>
                        <span className="text-lg font-bold text-blue-600">{filteredData.length}</span>
                    </div>
                </div>

                <div className="space-y-6">
                    
                    {/* Date Range Section */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-purple-200 transition-colors">
                        <h4 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-4">
                            <span className="p-1.5 bg-purple-50 text-purple-600 rounded">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                                </svg>
                            </span>
                            Date Range Filters
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Date Range Type */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Filter By</label>
                                <select 
                                    className="w-full bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    value={dateRangeType}
                                    onChange={(e) => setDateRangeType(e.target.value as any)}
                                >
                                    <option value="LAST_TRANSACTION">Last Transaction (Any)</option>
                                    <option value="LAST_SALE">Last Sale</option>
                                    <option value="LAST_PAYMENT">Last Payment</option>
                                </select>
                            </div>

                            {/* From Date */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">From Date</label>
                                <input 
                                    type="date" 
                                    className="w-full bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    value={dateRangeFrom}
                                    onChange={(e) => setDateRangeFrom(e.target.value)}
                                />
                            </div>

                            {/* To Date */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">To Date</label>
                                <input 
                                    type="date" 
                                    className="w-full bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    value={dateRangeTo}
                                    onChange={(e) => setDateRangeTo(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Financial Section */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-blue-200 transition-colors">
                        <h4 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-4">
                            <span className="p-1.5 bg-red-50 text-red-600 rounded">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" />
                                </svg>
                            </span>
                            Debit Filters
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Net Debt Range */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Net Debt</label>
                                <div className="flex gap-2">
                                    <select 
                                        className="w-24 bg-white border border-gray-300 text-gray-700 text-sm py-2 px-2.5 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                        value={debtOperator}
                                        onChange={(e) => setDebtOperator(e.target.value as any)}
                                    >
                                        <option value="GT">&gt; More</option>
                                        <option value="LT">&lt; Less</option>
                                    </select>
                                    <div className="relative flex-1">
                                        <input 
                                            type="number" 
                                            placeholder="Amount" 
                                            className="w-full bg-white border text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 border-gray-300"
                                            value={debtAmount}
                                            onChange={(e) => setDebtAmount(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Collection Rate */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Collection Rate</label>
                                <div className="flex gap-2">
                                    <select 
                                        className="w-24 bg-white border border-gray-300 text-gray-700 text-sm py-2 px-2.5 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                        value={collectionRateOperator}
                                        onChange={(e) => setCollectionRateOperator(e.target.value as any)}
                                    >
                                        <option value="GT">&gt; More</option>
                                        <option value="LT">&lt; Less</option>
                                    </select>
                                    <div className="relative flex-1">
                                        <input 
                                            type="number" 
                                            placeholder="Percentage" 
                                            className="w-full bg-white border text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 border-gray-300"
                                            value={collectionRateValue}
                                            onChange={(e) => setCollectionRateValue(e.target.value)}
                                        />
                                        <span className="absolute right-3 top-2.5 text-gray-400 text-sm">%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Last Payment moved here */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Last Payment</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="number" 
                                        placeholder="Value" 
                                        className="w-full bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                        value={lastPaymentValue}
                                        onChange={(e) => setLastPaymentValue(e.target.value)}
                                    />
                                    <select 
                                        className="w-24 bg-white border border-gray-300 text-gray-700 text-sm py-2 px-2.5 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                        value={lastPaymentUnit}
                                        onChange={(e) => setLastPaymentUnit(e.target.value as any)}
                                    >
                                        <option value="DAYS">Days</option>
                                        <option value="MONTHS">Months</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* OB Filter Checkbox */}
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={hasOB}
                                    onChange={(e) => setHasOB(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm font-medium text-gray-700">Has Unpaid OB Invoices</span>
                            </label>
                        </div>
                    </div>

                    {/* Overdue Amount Section */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-orange-200 transition-colors">
                        <h4 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-4">
                            <span className="p-1.5 bg-orange-50 text-orange-600 rounded">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            </span>
                            Overdue Amount
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Overdue Amount Input */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Overdue Amount</label>
                                <input 
                                    type="number" 
                                    placeholder="Minimum overdue amount" 
                                    className="w-full bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    value={overdueAmount}
                                    onChange={(e) => setOverdueAmount(e.target.value)}
                                />
                            </div>

                            {/* Aging Buckets Checkboxes - Matching AGES tab order */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-2 uppercase">Aging Buckets</label>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                            checked={overdueAging.includes('AT_DATE')}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setOverdueAging([...overdueAging, 'AT_DATE']);
                                                } else {
                                                    setOverdueAging(overdueAging.filter(b => b !== 'AT_DATE'));
                                                }
                                            }}
                                        />
                                        <span className="text-sm text-gray-700">AT DATE</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                            checked={overdueAging.includes('1-30')}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setOverdueAging([...overdueAging, '1-30']);
                                                } else {
                                                    setOverdueAging(overdueAging.filter(b => b !== '1-30'));
                                                }
                                            }}
                                        />
                                        <span className="text-sm text-gray-700">1 - 30</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                            checked={overdueAging.includes('31-60')}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setOverdueAging([...overdueAging, '31-60']);
                                                } else {
                                                    setOverdueAging(overdueAging.filter(b => b !== '31-60'));
                                                }
                                            }}
                                        />
                                        <span className="text-sm text-gray-700">31 - 60</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                            checked={overdueAging.includes('61-90')}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setOverdueAging([...overdueAging, '61-90']);
                                                } else {
                                                    setOverdueAging(overdueAging.filter(b => b !== '61-90'));
                                                }
                                            }}
                                        />
                                        <span className="text-sm text-gray-700">61 - 90</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                            checked={overdueAging.includes('91-120')}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setOverdueAging([...overdueAging, '91-120']);
                                                } else {
                                                    setOverdueAging(overdueAging.filter(b => b !== '91-120'));
                                                }
                                            }}
                                        />
                                        <span className="text-sm text-gray-700">91 - 120</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                            checked={overdueAging.includes('OLDER')}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setOverdueAging([...overdueAging, 'OLDER']);
                                                } else {
                                                    setOverdueAging(overdueAging.filter(b => b !== 'OLDER'));
                                                }
                                            }}
                                        />
                                        <span className="text-sm text-gray-700">OLDER</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Activity Section */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-blue-200 transition-colors">
                        <h4 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-4">
                            <span className="p-1.5 bg-blue-50 text-blue-600 rounded">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                </svg>
                            </span>
                            Sales Filters
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Net Sales Volume (moved here) */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Net Sales</label>
                                <div className="flex gap-2">
                                    <select 
                                        className="w-24 bg-white border border-gray-300 text-gray-700 text-sm py-2 px-2.5 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                        value={netSalesOperator}
                                        onChange={(e) => setNetSalesOperator(e.target.value as any)}
                                    >
                                        <option value="GT">&gt; More</option>
                                        <option value="LT">&lt; Less</option>
                                    </select>
                                    <input 
                                        type="number" 
                                        placeholder="Net Sales amount" 
                                        className="w-full bg-white border text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 border-gray-300"
                                        value={minTotalDebit}
                                        onChange={(e) => setMinTotalDebit(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* No Sales */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Sales Inactivity</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="number" 
                                        placeholder="Value" 
                                        className="w-full bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                        value={noSalesValue}
                                        onChange={(e) => setNoSalesValue(e.target.value)}
                                    />
                                    <select 
                                        className="w-24 bg-white border border-gray-300 text-gray-700 text-sm py-2 px-2.5 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                        value={noSalesUnit}
                                        onChange={(e) => setNoSalesUnit(e.target.value as any)}
                                    >
                                        <option value="DAYS">Days</option>
                                        <option value="MONTHS">Months</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="mt-6 flex justify-end items-center gap-3 pt-4 border-t border-gray-200">
                    <button 
                        className={`text-sm font-medium px-3 py-2 rounded-md transition-colors ${
                            debtOperator || lastPaymentValue || noSalesValue || matchingFilter !== 'ALL' || selectedSalesRep !== 'ALL' || searchQuery || debtType !== 'ALL' || minTotalDebit || netSalesOperator || collectionRateOperator || overdueAmount || overdueAging.length > 0 || dateRangeFrom || dateRangeTo
                            ? 'text-red-600 hover:bg-red-50 cursor-pointer' 
                            : 'text-gray-300 cursor-not-allowed'
                        }`}
                        onClick={() => {
                            setDebtOperator('');
                            setDebtAmount('');
                            setLastPaymentValue('');
                            setNoSalesValue('');
                            setMatchingFilter('ALL');
                            setSelectedSalesRep('ALL');
                            setSearchQuery('');
                            setDebtType('ALL');
                            setMinTotalDebit('');
                            setNetSalesOperator('');
                            setCollectionRateOperator('');
                            setCollectionRateValue('');
                            setOverdueAmount('');
                            setOverdueAging([]);
                            setDateRangeFrom('');
                            setDateRangeTo('');
                            setDateRangeType('LAST_TRANSACTION');
                            setHasOB(false);
                        }}
                        disabled={!(debtOperator || lastPaymentValue || noSalesValue || matchingFilter !== 'ALL' || selectedSalesRep !== 'ALL' || searchQuery || debtType !== 'ALL' || minTotalDebit || netSalesOperator || collectionRateOperator || overdueAmount || overdueAging.length > 0 || dateRangeFrom || dateRangeTo || hasOB)}
                    >
                        Clear All
                    </button>
                    <button
                        className="bg-blue-600 text-white px-5 py-2 rounded-md hover:bg-blue-700 shadow-sm transition-all font-medium flex items-center gap-2 text-sm"
                        onClick={() => setActiveTab('PARTNERS')}
                    >
                        <span>View Results</span>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
             </div>
        )}

        {activeTab === 'PARTNERS' && (
          <>
            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <div className="flex justify-between items-start">
                <div>
          <p className="text-lg">
            <span className="font-semibold">Total Debit:</span>{' '}
            <span className={totalDebt > 0 ? 'text-red-600' : 'text-green-600'}>
              {totalDebt.toLocaleString('en-US')}
            </span>
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Number of Customers: {filteredData.length} {searchQuery && `(filtered from ${customerAnalysis.length})`}
          </p>
                </div>
                
                {(debtOperator || lastPaymentValue || noSalesValue || debtType !== 'ALL' || minTotalDebit || netSalesOperator || collectionRateOperator || overdueAmount || overdueAging.length > 0 || dateRangeFrom || dateRangeTo || hasOB) && (
                    <div className="flex items-center bg-yellow-100 px-5 py-3 rounded-lg border border-yellow-200 shadow-sm">
                        <svg className="h-6 w-6 text-yellow-600 mr-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <div className="text-base">
                            <span className="font-semibold text-yellow-800">Advanced Filters Active</span>
                            <button
                                onClick={() => setActiveTab('FILTERS')}
                                className="ml-3 text-blue-700 hover:text-blue-900 underline font-bold"
                            >
                                Edit Filters
                            </button>
                        </div>
                    </div>
                )}
        </div>
      </div>

      <div className="mb-4 flex flex-col items-center gap-4">
        <div className="flex gap-4 w-full justify-center items-center">
          <select
            value={matchingFilter}
            onChange={(e) => setMatchingFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg bg-white"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open Matching Only</option>
            <option value="WITH_EMAIL">Customers with Email</option>
          </select>

          <select
            value={selectedSalesRep}
            onChange={(e) => setSelectedSalesRep(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg bg-white"
          >
            <option value="ALL">All Sales Reps</option>
            {availableSalesReps.map(rep => (
              <option key={rep} value={rep}>{rep}</option>
            ))}
          </select>

          <button
            onClick={() => exportToExcel(filteredData, `customers_export_${new Date().toISOString().split('T')[0]}`)}
            className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
            title="Export to Excel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <input
          type="text"
          placeholder="Search by customer name or invoice number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-1/2 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg text-center"
        />
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
                      if (columnId === 'netDebt') return '22%';
                      if (columnId === 'totalCredit') return '22%';
                      if (columnId === 'totalDebit') return '22%';
                      return '34%';
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
                      if (columnId === 'netDebt') return '22%';
                      if (columnId === 'totalCredit') return '22%';
                      if (columnId === 'totalDebit') return '22%';
                      return '34%';
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
                <td className="px-4 py-3 text-center text-lg" style={{ width: '34%' }}>
                  Total
                </td>
                <td className="px-4 py-3 text-center text-lg" style={{ width: '22%' }}>
                  {filteredData.reduce((sum, c) => sum + c.totalDebit, 0).toLocaleString('en-US')}
                </td>
                <td className="px-4 py-3 text-center text-lg" style={{ width: '22%' }}>
                  {filteredData.reduce((sum, c) => sum + c.totalCredit, 0).toLocaleString('en-US')}
                </td>
                <td className="px-4 py-3 text-center text-lg" style={{ width: '22%' }}>
                  <span className={filteredData.reduce((sum, c) => sum + c.netDebt, 0) > 0 ? 'text-red-600' : filteredData.reduce((sum, c) => sum + c.netDebt, 0) < 0 ? 'text-green-600' : ''}>
                    {filteredData.reduce((sum, c) => sum + c.netDebt, 0).toLocaleString('en-US')}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
          </>
        )}
      </div>

    </div>
  );
}

