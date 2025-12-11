'use client';

import { useEffect, useMemo, useState } from 'react';
import { InvoiceRow } from '@/types';
import CustomerDetails from './CustomerDetails';

interface CustomersByMonthsTabProps {
  data: InvoiceRow[];
}

interface CustomerMonthlySummary {
  customerName: string;
  salesReps: string[];
  netTotal: number;
  months: { key: string; label: string; amount: number }[];
}

// Parse date with a small fallback for DD/MM/YYYY strings
const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed;

  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const y = parseInt(parts[2], 10);
    const candidate = new Date(y, m, d);
    if (!isNaN(candidate.getTime())) return candidate;
  }

  return null;
};

const formatMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const formatMonthLabel = (key: string) => {
  const [year, month] = key.split('-');
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  const monthIndex = parseInt(month, 10) - 1;
  const monthName = monthNames[monthIndex] || month;
  return `${monthName}${year.slice(-2)}`;
};

export default function CustomersByMonthsTab({ data }: CustomersByMonthsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [matchingFilter, setMatchingFilter] = useState<'ALL' | 'OPEN' | 'WITH_EMAIL'>('ALL');
  const [selectedSalesRep, setSelectedSalesRep] = useState('ALL');
  const [customersWithEmails, setCustomersWithEmails] = useState<Set<string>>(new Set());

  const summaries = useMemo(() => {
    const result: CustomerMonthlySummary[] = [];

    // Group invoices by customer first
    const customerGroups = new Map<string, InvoiceRow[]>();
    data.forEach((row) => {
      const group = customerGroups.get(row.customerName) || [];
      group.push(row);
      customerGroups.set(row.customerName, group);
    });

    customerGroups.forEach((rows, customerName) => {
      // 1) Prepare matching residuals (same approach as Overdue tab)
      const matchingTotals = new Map<string, number>();
      const maxDebits = new Map<string, number>();
      const mainInvoiceIndices = new Map<string, number>();

      rows.forEach((inv, idx) => {
        if (inv.matching) {
          const net = inv.debit - inv.credit;
          matchingTotals.set(inv.matching, (matchingTotals.get(inv.matching) || 0) + net);

          const currentMax = maxDebits.get(inv.matching) ?? -1;
          if (inv.debit > currentMax) {
            maxDebits.set(inv.matching, inv.debit);
            mainInvoiceIndices.set(inv.matching, idx);
          } else if (!mainInvoiceIndices.has(inv.matching)) {
            maxDebits.set(inv.matching, inv.debit);
            mainInvoiceIndices.set(inv.matching, idx);
          }
        }
      });

      // 2) Build open items (unmatched or residual holder)
      const openItems: { date: Date | null; amount: number }[] = [];
      const salesRepsSet = new Set<string>();

      rows.forEach((inv, idx) => {
        if (inv.salesRep?.trim()) salesRepsSet.add(inv.salesRep.trim());

        const netDebt = inv.debit - inv.credit;
        let residual: number | undefined;

        if (inv.matching && mainInvoiceIndices.get(inv.matching) === idx) {
          const total = matchingTotals.get(inv.matching) || 0;
          if (Math.abs(total) > 0.01) residual = total;
        }

        let amountToUse: number | null = null;
        if (!inv.matching && Math.abs(netDebt) > 0.01) {
          amountToUse = netDebt;
        } else if (residual !== undefined && Math.abs(residual) > 0.01) {
          amountToUse = residual;
        }

        if (amountToUse !== null) {
          const d = parseDate(inv.date);
          openItems.push({ date: d, amount: amountToUse });
        }
      });

      // 3) Aggregate by month using open amounts only
      const monthsMap = new Map<string, number>();
      let netTotal = 0;

      openItems.forEach(({ date, amount }) => {
        if (!date) return;
        const key = formatMonthKey(date);
        monthsMap.set(key, (monthsMap.get(key) || 0) + amount);
        netTotal += amount;
      });

      const monthEntries = Array.from(monthsMap.entries())
        .map(([key, amount]) => ({
          key,
          amount,
          label: `${formatMonthLabel(key)} (${Math.round(amount).toLocaleString('en-US')})`,
        }))
        .sort((a, b) => a.key.localeCompare(b.key));

      result.push({
        customerName,
        salesReps: Array.from(salesRepsSet).sort(),
        netTotal,
        months: monthEntries,
      });
    });

    // Default sort: highest open net total first
    return result.sort((a, b) => b.netTotal - a.netTotal);
  }, [data]);

  const filtered = useMemo(() => {
    let result = summaries;

    if (selectedSalesRep !== 'ALL') {
      result = result.filter((item) => item.salesReps.some((rep) => rep === selectedSalesRep));
    }

    if (matchingFilter === 'WITH_EMAIL') {
      result = result.filter((item) => customersWithEmails.has(item.customerName.toLowerCase().trim()));
    }
    // OPEN filter is implicit because we only compute open items.

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.customerName.toLowerCase().includes(query) ||
          item.salesReps.some((rep) => rep.toLowerCase().includes(query)),
      );
    }

    return result;
  }, [summaries, searchQuery, matchingFilter, selectedSalesRep, customersWithEmails]);

  const totalNet = filtered.reduce((sum, item) => sum + item.netTotal, 0);

  // Invoices for selected customer
  const selectedCustomerInvoices = useMemo(() => {
    if (!selectedCustomer) return [];
    return data.filter((row) => row.customerName === selectedCustomer);
  }, [selectedCustomer, data]);

  // Available sales reps
  const availableSalesReps = useMemo(() => {
    const reps = new Set<string>();
    data.forEach((row) => {
      if (row.salesRep && row.salesRep.trim()) {
        reps.add(row.salesRep.trim());
      }
    });
    return Array.from(reps).sort();
  }, [data]);

  // Fetch customers with emails (reuse API)
  useEffect(() => {
    const fetchEmails = async () => {
      try {
        const response = await fetch('/api/customer-emails-list');
        if (response.ok) {
          const res = await response.json();
          setCustomersWithEmails(new Set(res.customers.map((name: string) => name.toLowerCase().trim())));
        }
      } catch (error) {
        console.error('Failed to fetch customer emails:', error);
      }
    };
    fetchEmails();
  }, []);

  const exportToExcel = () => {
    const headers = ['Customer Name', 'Sales Rep', 'Net Total', 'Type', 'Months'];
    const rows: string[][] = [];
    
    filtered.forEach((item) => {
      const debitMonths = item.months.filter((m) => m.amount > 0.01).map((m) => m.label).join(' | ');
      const creditMonths = item.months.filter((m) => m.amount < -0.01).map((m) => m.label).join(' | ');
      
      const netTotal = Math.round(item.netTotal).toString();
      const salesRep = item.salesReps.join(', ') || '';
      let isFirstRow = true;
      
      // Add debit row if there are debit months
      if (debitMonths) {
        rows.push([item.customerName, isFirstRow ? salesRep : '', isFirstRow ? netTotal : '', 'Debit', debitMonths]);
        isFirstRow = false;
      }
      
      // Add credit row if there are credit months
      if (creditMonths) {
        rows.push([item.customerName, isFirstRow ? salesRep : '', isFirstRow ? netTotal : '', 'Credit', creditMonths]);
        isFirstRow = false;
      }
    });

    const csvContent = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `customers_by_months_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (selectedCustomer) {
    return (
      <CustomerDetails
        customerName={selectedCustomer}
        invoices={selectedCustomerInvoices}
        onBack={() => setSelectedCustomer(null)}
        initialTab="overdue"
      />
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Customers by Months</h2>
        <div className="bg-blue-50 p-4 rounded-lg flex flex-col gap-1">
          <p className="text-lg">
            <span className="font-semibold">Total Net:</span>{' '}
            <span className={totalNet > 0 ? 'text-red-600' : totalNet < 0 ? 'text-green-600' : ''}>
              {Math.round(totalNet).toLocaleString('en-US')}
            </span>
          </p>
          <p className="text-sm text-gray-600">
            Customers: {filtered.length} {searchQuery && `(filtered from ${summaries.length})`}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-col items-center gap-4">
        <div className="flex gap-4 w-full justify-center items-center">
          <select
            value={matchingFilter}
            onChange={(e) => setMatchingFilter(e.target.value as any)}
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
            {availableSalesReps.map((rep) => (
              <option key={rep} value={rep}>
                {rep}
              </option>
            ))}
          </select>

          <button
            onClick={exportToExcel}
            className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
            title="Export to Excel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <input
          type="text"
          placeholder="Search by customer or sales rep..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-1/2 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg text-center"
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '22.5%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '31.75%' }} />
              <col style={{ width: '31.75%' }} />
            </colgroup>
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Customer Name</th>
                <th className="px-4 py-3 text-right font-semibold">Net Total</th>
                <th className="px-4 py-3 text-left font-semibold">Debit Months</th>
                <th className="px-4 py-3 text-left font-semibold">Credit Months</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.customerName} className="border-b hover:bg-gray-50 align-top">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <button
                      onClick={() => setSelectedCustomer(item.customerName)}
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {item.customerName}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right text-lg">
                    <span className={item.netTotal > 0 ? 'text-red-600' : item.netTotal < 0 ? 'text-green-600' : ''}>
                      {Math.round(item.netTotal).toLocaleString('en-US')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {(() => {
                      const debitMonths = item.months.filter((m) => m.amount > 0.01);
                      if (debitMonths.length === 0) return '—';
                      return debitMonths.map((m, idx) => (
                        <span key={m.key} className={idx % 2 === 0 ? 'text-gray-800 font-semibold' : 'text-blue-700 font-semibold'}>
                          {idx > 0 && <span className="text-gray-500 mx-1">►</span>}
                          {m.label}
                        </span>
                      ));
                    })()}
                  </td>
                  <td className="px-4 py-3 text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {(() => {
                      const creditMonths = item.months.filter((m) => m.amount < -0.01);
                      if (creditMonths.length === 0) return '—';
                      return creditMonths.map((m, idx) => (
                        <span key={m.key} className={idx % 2 === 0 ? 'text-gray-800 font-semibold' : 'text-green-700 font-semibold'}>
                          {idx > 0 && <span className="text-gray-500 mx-1">►</span>}
                          {m.label}
                        </span>
                      ));
                    })()}
                  </td>
                </tr>
              ))}
              {filtered.length > 0 && (
                <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                  <td className="px-4 py-3 text-left">Total</td>
                  <td className="px-4 py-3 text-right">
                    <span className={totalNet > 0 ? 'text-red-600' : totalNet < 0 ? 'text-green-600' : ''}>
                      {Math.round(totalNet).toLocaleString('en-US')}
                    </span>
                  </td>
                  <td className="px-4 py-3"></td>
                </tr>
              )}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-gray-500">
                    No customers match your search
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


